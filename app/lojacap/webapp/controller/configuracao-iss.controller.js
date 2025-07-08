sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel" // Adicione o JSONModel aqui
], function (Controller, MessageToast, Fragment, JSONModel) {
    "use strict";

    return Controller.extend("lojacap.controller.configuracao-iss", {

        onOpenDialog: function (oEvent) {
            const oView = this.getView();
            const oSource = oEvent.getSource();
            this._isEdit = !!oSource.getBindingContext();
        
            const openDialogPromise = this._pDialog ? Promise.resolve(this._pDialog) :
                Fragment.load({
                    id: oView.getId(),
                    name: "lojacap.view.fragments.ConfiguracaoISSDialog",
                    controller: this
                }).then(oDialog => {
                    oView.addDependent(oDialog);
                    this._pDialog = oDialog;
                    return oDialog;
                });
        
            openDialogPromise.then((oDialog) => {
                this._clearValueStates();
        
                if (this._isEdit) {
                    oDialog.setTitle("Editar Configuração de ISS");
                    const oContext = oSource.getBindingContext();
                    
                    oContext.requestObject().then(oData => {
                        console.log("Dados brutos do backend para edição:", oData); 
        
                        const formData = JSON.parse(JSON.stringify(oData));
        
                        // Se a associação 'empresa' foi carregada, pega a ID
                        if (formData.empresa && formData.empresa.ID) {
                            formData.empresa_ID = formData.empresa.ID;
                        }
                        
                        // ✨ AQUI ESTÁ O AJUSTE PARA O MANDANTE ✨
                        // Garante que o mandante tenha um valor, mesmo que o backend não o envie.
                        console.log(formData.mandt)
                        if (!formData.mandt) {
                            formData.mandt = "100"; // Ou qualquer outro valor padrão que faça sentido
                            console.log("Mandante não encontrado, usando valor padrão '100'.");
                        }
        
                        formData.verif = formData.verif === 'X';
        
                        const oFormModel = new JSONModel(formData);
                        oDialog.setModel(oFormModel, "formModel");
                        oDialog.setBindingContext(oContext);
                    });
                } else {
                    // MODO CRIAÇÃO: Modelo local limpo
                    oDialog.setTitle("Nova Configuração de ISS");
                    const oFormModel = new JSONModel({
                        mandt: "100", // Valor padrão para novos itens
                        verif: false
                    });
                    oDialog.setModel(oFormModel, "formModel");
                    oDialog.setBindingContext(null);
                }
                oDialog.open();
            });
        },

        onSave: function () {
            if (!this._validateInput()) {
                MessageToast.show("Por favor, preencha todos os campos obrigatórios.");
                return;
            }
        
            const oDialog = this.byId("ConfiguracaoISSDialog");
            const oFormModel = oDialog.getModel("formModel");
            const formData = oFormModel.getData();
            const oMainModel = this.getView().getModel();
        
            console.log("Dados do formulário para salvar:", formData); // Ótimo para debug!
        
            // Vamos criar um 'payload' limpo com os dados do formulário.
            // Isso evita o erro de tentar salvar o objeto de associação 'empresa'.
            const payload = {
                mandt: formData.mandt,
                empresa_ID: formData.empresa_ID, // A chave estrangeira que queremos atualizar!
                loc_neg: formData.loc_neg,
                loc_fornec: formData.loc_fornec,
                prestac_serv: formData.prestac_serv,
                prestad_serv: formData.prestad_serv,
                serv_prest: formData.serv_prest,
                serv_type: formData.serv_type,
                verif: this.byId('verifCheckBox').getSelected() ? 'X' : null, // Garante o formato 'X' ou nulo
                val_de: formData.val_de,
                val_ate: formData.val_ate
            };
            
            // Tratamento de datas para garantir o formato YYYY-MM-DD sem problemas de fuso horário
            const valDePicker = this.byId('valDeDatePicker');
            if (valDePicker && valDePicker.isValidValue() && valDePicker.getDateValue()) {
                const valDe = valDePicker.getDateValue();
                payload.val_de = new Date(valDe.getTime() - (valDe.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            }
        
            const valAtePicker = this.byId('valAteDatePicker');
             if (valAtePicker && valAtePicker.isValidValue() && valAtePicker.getDateValue()) {
                const valAte = valAtePicker.getDateValue();
                payload.val_ate = new Date(valAte.getTime() - (valAte.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            }
        
        
            if (this._isEdit) {
                // MODO EDIÇÃO: Pega o contexto e atualiza campo por campo com o payload limpo
                const oContext = oDialog.getBindingContext();
                Object.keys(payload).forEach(key => {
                    oContext.setProperty(key, payload[key]);
                });
            } else {
                // MODO CRIAÇÃO: Cria a nova entrada usando o payload
                const oListBinding = oMainModel.bindList("/ConfiguracoesISS");
                oListBinding.create(payload);
            }
        
            // Envia o batch para o backend
            oMainModel.submitBatch("$auto").then(() => {
                MessageToast.show("Salvo com sucesso!");
                oDialog.close();
                oMainModel.refresh();
            }).catch((oError) => {
                // Se o erro for de 'Binding', pode ser que o usuário fechou o dialog antes da hora.
                if (oError.message.includes("Binding")) {
                     console.warn("Possível erro benigno de binding após fechar o dialog.");
                     return;
                }
                console.error("Erro detalhado ao salvar:", oError);
                MessageToast.show("Erro ao salvar: " + oError.message);
            });
        },

        onCloseDialog: function () {
            // Se houver alguma alteração pendente no modelo OData (de uma edição, por exemplo), desfaz.
            this.getView().getModel().resetChanges("$auto");
            this.byId("ConfiguracaoISSDialog").close();
        },

        _validateInput: function() {
            // Sua lógica de validação está ótima, só precisa ler do formModel
             const oEmpresaSelect = this.byId("empresaSelect");
             const oLocNegInput = this.byId("locNegInput");
             let bIsValid = true;
             
             if (!oEmpresaSelect.getSelectedKey()) {
                 oEmpresaSelect.setValueState("Error").setValueStateText("Este campo é obrigatório.");
                 bIsValid = false;
             } else { oEmpresaSelect.setValueState("None"); }

             if (!oLocNegInput.getValue()) {
                 oLocNegInput.setValueState("Error").setValueStateText("Este campo é obrigatório.");
                 bIsValid = false;
             } else { oLocNegInput.setValueState("None"); }

             return bIsValid;
        },

        _clearValueStates: function () {
            // Limpa as mensagens de erro
            const oDialog = this.byId("ConfiguracaoISSDialog");
            if(oDialog) {
                this.byId("empresaSelect")?.setValueState("None");
                this.byId("locNegInput")?.setValueState("None");
            }
        }
    });
});