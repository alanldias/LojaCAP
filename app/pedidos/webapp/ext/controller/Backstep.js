sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (MessageToast, MessageBox) {
    'use_strict';

    return {
        backstep: async function () {
            console.log("🌀 FE Extension (backstep - SEM DRAFT): Handler 'backstep' invocado.");
            let aSelectedContexts;
            let oExtensionAPI;

            // Obter extensionAPI de forma segura
            if (this.getExtensionAPI && typeof this.getExtensionAPI === 'function') {
                oExtensionAPI = this.getExtensionAPI();
            } else if (this._controller && this._controller.extensionAPI) {
                oExtensionAPI = this._controller.extensionAPI;
            }

            if (!oExtensionAPI || typeof oExtensionAPI.getSelectedContexts !== 'function') {
                console.error("🔴 FE Extension (backstep - SEM DRAFT): Falha ao obter extensionAPI.");
                MessageBox.error("Erro interno: Falha ao acessar a extensão do Fiori Elements.");
                return;
            }

            aSelectedContexts = oExtensionAPI.getSelectedContexts();

            if (!aSelectedContexts || aSelectedContexts.length === 0) {
                MessageBox.information("Selecione um pedido para retroceder o status.");
                return;
            }
            if (aSelectedContexts.length > 1) {
                MessageBox.warning("Apenas um pedido pode ser retrocedido por vez.");
                return;
            }

            const oContext = aSelectedContexts[0];
            const sActionNameInMetadata = "ShopService.retrocederStatus";

            try {
                console.log("⏪ FE Extension (backstep - SEM DRAFT): Executando ação para", oContext.getPath());

                const oOperationBinding = oContext.getModel().bindContext(`${sActionNameInMetadata}(...)`, oContext);
                await oOperationBinding.execute();

                MessageToast.show("Status retrocedido com sucesso.");
                if (typeof oExtensionAPI.refresh === 'function') {
                    oExtensionAPI.refresh(); // Atualiza a lista
                }
            } catch (error) {
                const sPath = oContext ? oContext.getPath() : "o item selecionado";
                console.error(`🔴 Erro ao executar 'retrocederStatus' para ${sPath}:`, error);

                let sErrorMessage = "Erro desconhecido.";
                if (error.message) sErrorMessage = error.message;
                else if (error.error && error.error.message) sErrorMessage = error.error.message;

                MessageBox.error(`Erro ao retroceder status:\n${sErrorMessage}`);
            }
        }
    };
});
