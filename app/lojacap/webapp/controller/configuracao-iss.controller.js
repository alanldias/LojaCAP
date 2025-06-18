sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (Controller, MessageToast, Fragment) {
    "use strict";

    return Controller.extend("lojacap.controller.configuracao-iss", {

        onInit: function () {
            // Pode adicionar código de inicialização aqui, se precisar.
        },

        // Função para abrir o diálogo, tanto para criar um novo quanto para editar.
        onOpenDialog: function (oEvent) {
            const oView = this.getView();
            const oDataModel = oView.getModel(); // Modelo OData V4 principal
            
            // Determina se é uma edição (se o botão clicado pertence a uma linha da tabela)
            this._isEdit = !!oEvent.getSource().getBindingContext(); 

            // Carrega o fragmento do diálogo se ainda não foi carregado
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

            // Depois que o diálogo for carregado, configura e abre
            this._pDialog.then(function(oDialog) {
                if (this._isEdit) {
                    // MODO EDIÇÃO
                    oDialog.setTitle("Editar Configuração de ISS");
                    // O contexto do item clicado já está disponível, apenas o definimos no diálogo
                    const oContext = oEvent.getSource().getBindingContext();
                    oDialog.setBindingContext(oContext);
                } else {
                    // MODO CRIAÇÃO
                    oDialog.setTitle("Nova Configuração de ISS");
                    // Cria uma nova entrada na entidade do serviço OData.
                    // Isso acontece em memória e só é enviado ao backend ao salvar.
                    const oListBinding = oDataModel.bindList("/ConfiguracoesISS");
                    const oNewContext = oListBinding.create({});
                    oDialog.setBindingContext(oNewContext);
                }
                oDialog.open();
            }.bind(this));
        },

        // Função para fechar o diálogo
        onCloseDialog: function () {
            const oDialog = this.byId("ConfiguracaoISSDialog");
            const oContext = oDialog.getBindingContext();

            // Se for um novo registro que foi cancelado, remove a entrada da memória.
            if (oContext && !this._isEdit) {
                oContext.delete();
            }
            oDialog.close();
        },

        // Função para salvar os dados
        onSave: function () {
            const oView = this.getView();
            const oDialog = this.byId("ConfiguracaoISSDialog");

            // O data-binding do UI5 já atualizou os dados no modelo em memória.
            // O submitBatch envia todas as alterações pendentes para o backend (neste caso, o CREATE ou UPDATE).
            oView.getModel().submitBatch("$auto").then(() => {
                MessageToast.show("Salvo com sucesso!");
                oDialog.close();
            }).catch((oError) => {
                // Em caso de erro do backend, exibe a mensagem.
                MessageToast.show("Erro ao salvar: " + oError.message);
            });
        }
    });
});