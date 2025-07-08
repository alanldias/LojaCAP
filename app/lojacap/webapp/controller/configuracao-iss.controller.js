sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel"
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
                const DEFAULT_MANDT = "300";

                if (this._isEdit) {
                    oDialog.setTitle("Editar Configuração de ISS");
                    const oContext = oSource.getBindingContext();
                    
                    oContext.requestObject().then(oData => {
                        console.log("Dados recebidos do backend para edição:", oData);
                        const formData = JSON.parse(JSON.stringify(oData));

                        if (formData.empresa && formData.empresa.ID) {
                            formData.empresa_ID = formData.empresa.ID;
                        }
                        
                        formData.mandt = oData.mandt || DEFAULT_MANDT;
                        formData.verif = oData.verif === 'X';

                        const oFormModel = new JSONModel(formData);
                        oDialog.setModel(oFormModel, "formModel");
                        oDialog.setBindingContext(oContext);
                    });
                } else {
                    oDialog.setTitle("Nova Configuração de ISS");
                    const oFormModel = new JSONModel({
                        mandt: DEFAULT_MANDT,
                        verif: false
                    });
                    oDialog.setModel(oFormModel, "formModel");
                    oDialog.setBindingContext(null);
                }
                oDialog.open();
            });
        },

        onSave: function () {
            if (!this._validateInput() || !this._validateDateRange()) {
                MessageToast.show("Por favor, corrija os erros no formulário.");
                return;
            }

            const oDialog = this.byId("ConfiguracaoISSDialog");
            const oFormModel = oDialog.getModel("formModel");
            const formData = oFormModel.getData();
            const oMainModel = this.getView().getModel();

            const payload = {
                mandt: formData.mandt,
                empresa_ID: formData.empresa_ID,
                loc_neg: formData.loc_neg,
                loc_fornec: formData.loc_fornec,
                prestac_serv: formData.prestac_serv,
                prestad_serv: formData.prestad_serv,
                serv_prest: formData.serv_prest,
                serv_type: formData.serv_type,
                verif: this.byId('verifCheckBox').getSelected() ? 'X' : null,
                val_de: null,
                val_ate: null
            };
            
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
                const oContext = oDialog.getBindingContext();
                Object.keys(payload).forEach(key => oContext.setProperty(key, payload[key]));
            } else {
                const oListBinding = oMainModel.bindList("/ConfiguracoesISS");
                oListBinding.create(payload);
            }

            oMainModel.submitBatch("$auto").then(() => {
                MessageToast.show("Salvo com sucesso!");
                oDialog.close();
                this.byId("tblConfiguracoes").getBinding("items").refresh();
            }).catch((oError) => {
                console.error("Erro detalhado ao salvar:", oError);
                MessageToast.show("Erro ao salvar: " + oError.message);
            });
        },

        onCloseDialog: function () {
            this.getView().getModel().resetChanges("$auto");
            this.byId("ConfiguracaoISSDialog").close();
        },

        _validateInput: function() {
            let bIsValid = true;
            const oFormModelData = this.byId("ConfiguracaoISSDialog").getModel("formModel").getData();

            const oEmpresaSelect = this.byId("empresaSelect");
            if (!oFormModelData.empresa_ID) {
                oEmpresaSelect.setValueState("Error").setValueStateText("Este campo é obrigatório.");
                bIsValid = false;
            } else { oEmpresaSelect.setValueState("None"); }

            const oLocNegInput = this.byId("locNegInput");
            if (!oFormModelData.loc_neg || oFormModelData.loc_neg.trim() === "") {
                oLocNegInput.setValueState("Error").setValueStateText("Este campo é obrigatório.");
                bIsValid = false;
            } else { oLocNegInput.setValueState("None"); }
            
            return bIsValid;
        },

        _validateDateRange: function() {
            const oValDePicker = this.byId('valDeDatePicker');
            const oValAtePicker = this.byId('valAteDatePicker');
            const dValDe = oValDePicker.getDateValue();
            const dValAte = oValAtePicker.getDateValue();

            if (dValDe && dValAte && (dValAte < dValDe)) {
                oValAtePicker.setValueState("Error").setValueStateText("A data final não pode ser anterior à data inicial.");
                return false;
            }
            
            oValAtePicker.setValueState("None");
            return true;
        },

        _clearValueStates: function () {
            const oDialog = this.byId("ConfiguracaoISSDialog");
            if(oDialog) {
                this.byId("empresaSelect")?.setValueState("None");
                this.byId("locNegInput")?.setValueState("None");
                this.byId("valAteDatePicker")?.setValueState("None");
            }
        }
    });
});