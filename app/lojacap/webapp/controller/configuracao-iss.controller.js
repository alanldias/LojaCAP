sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (Controller, MessageToast, Fragment) {
    "use strict";

    return Controller.extend("lojacap.controller.configuracao-iss", {

        // ... (onInit, onOpenDialog, onCloseDialog, _clearValueStates, _validateInput)
        // Suas outras funções podem continuar como na última versão que te passei...

        onInit: function () { },

        onOpenDialog: function (oEvent) {
            const oView = this.getView();
            const oDataModel = oView.getModel();
            this._isEdit = !!oEvent.getSource().getBindingContext();

            if (!this._pDialog) {
                this._pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "lojacap.view.fragments.ConfiguracaoISSDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pDialog.then(function (oDialog) {
                if (this._isEdit) {
                    oDialog.setTitle("Editar Configuração de ISS");
                    oDialog.setBindingContext(oEvent.getSource().getBindingContext());
                } else {
                    oDialog.setTitle("Nova Configuração de ISS");
                    const oListBinding = oDataModel.bindList("/ConfiguracoesISS");
                    const oNewContext = oListBinding.create({});
                    oDialog.setBindingContext(oNewContext);
                }
                this._clearValueStates();
                oDialog.open();
            }.bind(this));
        },

        onCloseDialog: function () {
            this.byId("tblConfiguracoes").getBinding("items").resetChanges();
            this.byId("ConfiguracaoISSDialog").close();
        },

        _clearValueStates: function () {
            this.byId("empresaSelect")?.setValueState("None");
            this.byId("locNegInput")?.setValueState("None");
        },

        _validateInput: function () {
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

        // 👇 SUBSTITUA SUA FUNÇÃO onSave POR ESTA VERSÃO COMPLETA 👇
        onSave: function () {
            if (!this._validateInput()) {
                MessageToast.show("Por favor, preencha todos os campos obrigatórios.");
                return;
            }
        
            const oView = this.getView();
            const oDialog = this.byId("ConfiguracaoISSDialog");
            const oContext = oDialog.getBindingContext();
        
            // Esta parte já está correta para pegar todos os valores!
            oContext.setProperty('mandt', this.byId('mandtInput').getValue());
            oContext.setProperty('loc_neg', this.byId('locNegInput').getValue());
            oContext.setProperty('loc_fornec', this.byId('locFornecInput').getValue()); // <-- Ele está aqui!
            oContext.setProperty('prestac_serv', this.byId('prestacServInput').getValue());
            oContext.setProperty('prestad_serv', this.byId('prestadServInput').getValue());
            oContext.setProperty('serv_prest', this.byId('servPrestInput').getValue());
            oContext.setProperty('serv_type', this.byId('servTypeInput').getValue());
            oContext.setProperty('verif', this.byId('verifCheckBox').getSelected() ? 'X' : null);
            
            
            // Para datas, é crucial garantir o formato correto que o OData V4 espera (YYYY-MM-DD)
            const valDe = this.byId('valDeDatePicker').getDateValue();
            const valAte = this.byId('valAteDatePicker').getDateValue();

            if (valDe) {
                oContext.setProperty('val_de', new Date(valDe.getTime() - (valDe.getTimezoneOffset() * 60000)).toISOString().split('T')[0]);
            }
            if (valAte) {
                oContext.setProperty('val_ate', new Date(valAte.getTime() - (valAte.getTimezoneOffset() * 60000)).toISOString().split('T')[0]);
            }
            // --- FIM DA CORREÇÃO ---


            oView.getModel().submitBatch("$auto").then(() => {
                MessageToast.show("Salvo com sucesso!");
                oDialog.close();
                oView.getModel().refresh();
            }).catch((oError) => {
                console.error("Erro detalhado ao salvar:", oError);
                MessageToast.show("Erro ao salvar: " + oError.message);
            });
        }
    });
});