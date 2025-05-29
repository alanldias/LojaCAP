// Em: alanldias/lojacap/LojaCAP-thiago/app/pedidos/webapp/ext/controller/Nextstep.js
sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (MessageToast, MessageBox) {
    'use_strict';

    return {
        nextstep: async function () {
            console.log("🚀 FE Extension (nextstep - SEM DRAFT): Handler 'nextstep' invocado. 'this' é:", this);
            let aSelectedContexts;
            let oExtensionAPI;

            if (this.getExtensionAPI && typeof this.getExtensionAPI === 'function') {
                oExtensionAPI = this.getExtensionAPI();
                console.log("✨ FE Extension (nextstep - SEM DRAFT): ExtensionAPI obtida via this.getExtensionAPI()");
            } else if (this._controller && this._controller.extensionAPI && typeof this._controller.extensionAPI.getSelectedContexts === 'function') {
                oExtensionAPI = this._controller.extensionAPI;
                console.log("✨ FE Extension (nextstep - SEM DRAFT): ExtensionAPI obtida via this._controller.extensionAPI");
            } else {
                console.error("🔴 FE Extension (nextstep - SEM DRAFT): Não foi possível obter a extensionAPI.");
                MessageBox.error("Erro interno: Falha ao obter a API da extensão. Contacte o suporte.");
                return;
            }

            aSelectedContexts = oExtensionAPI.getSelectedContexts();
            console.log("📄 FE Extension (nextstep - SEM DRAFT): Contextos selecionados. Quantidade:", aSelectedContexts ? aSelectedContexts.length : 0);

            if (!aSelectedContexts || aSelectedContexts.length === 0) {
                MessageBox.information("Por favor, selecione pelo menos um pedido para avançar o status.");
                return;
            }

            MessageToast.show(`⏳ Avançando status para ${aSelectedContexts.length} pedido(s)...`);
            console.log("📡 FE Extension (nextstep - SEM DRAFT): Chamando backend 'avancarStatus' para", aSelectedContexts.length, "contextos.");

            let iSuccessCount = 0;
            let iErrorCount = 0;
            const aErrorMessages = [];

            for (const oContext of aSelectedContexts) {
                try {
                    // Com a remoção do draft, oContext sempre se referirá à entidade ativa.
                    console.log("🕵️ FE Extension (nextstep - SEM DRAFT): Processando contexto do pedido:", oContext.getPath(), "Dados:", JSON.parse(JSON.stringify(oContext.getObject())));

                    const sActionNameInMetadata = "ShopService.avancarStatus"; // Nome da ação
                    console.log(`📞 FE Extension (nextstep - SEM DRAFT): Preparando para invocar '${sActionNameInMetadata}' no contexto: ${oContext.getPath()}`);

                    const oOperationBinding = oContext.getModel().bindContext(`${sActionNameInMetadata}(...)`, oContext);
                    console.log("🔍 FE Extension (nextstep - SEM DRAFT): oOperationBinding criado:", oOperationBinding);

                    await oOperationBinding.execute(); // Executa a ação
                    console.log(`✅ FE Extension (nextstep - SEM DRAFT): Ação '${sActionNameInMetadata}' executada com sucesso para ${oContext.getPath()}`);
                    iSuccessCount++;

                } catch (error) {
                    iErrorCount++;
                    const sPath = oContext ? oContext.getPath() : "um item selecionado";
                    console.error(`🔴 FE Extension (nextstep - SEM DRAFT): Erro ao executar ação para ${sPath}:`, error);
                    let sDetailedErrorMessage = "Erro desconhecido.";
                    if (error) {
                        if (error.message) sDetailedErrorMessage = error.message;
                        if (error.error && error.error.message) sDetailedErrorMessage = error.error.message;
                        else if (typeof error === 'string') sDetailedErrorMessage = error;
                    }
                    aErrorMessages.push(`Erro no pedido ${sPath}: ${sDetailedErrorMessage}`);
                }
            }

            console.log("🔄 FE Extension (nextstep - SEM DRAFT): Finalizado processamento dos contextos. Tentando dar refresh na UI.");
            if (oExtensionAPI && typeof oExtensionAPI.refresh === 'function') {
                console.log("✨ FE Extension (nextstep - SEM DRAFT): Solicitando refresh da tabela/página via extensionAPI.refresh().");
                oExtensionAPI.refresh(); // Muito importante para atualizar a lista!
            } else {
                console.warn("⚠️ FE Extension (nextstep - SEM DRAFT): extensionAPI.refresh() não disponível ou não funcionou. Considere um model.refresh() como fallback se necessário.");
            }

            // Mensagens finais
            if (iErrorCount > 0) {
                MessageBox.error(`Falha ao tentar avançar o status para ${iErrorCount} pedido(s) de <span class="math-inline">\{aSelectedContexts\.length\}\.\\n\\nDetalhes\:\\n</span>{aErrorMessages.join("\n")}`);
            }
            if (iSuccessCount > 0 && iErrorCount === 0) {
                MessageToast.show(`${iSuccessCount} pedido(s) tiveram o status atualizado com sucesso.`);
            } else if (iSuccessCount > 0 && iErrorCount > 0) {
                MessageToast.show(`${iSuccessCount} status atualizado(s), mas ${iErrorCount} falharam. Verifique as mensagens.`);
            }
            if (iSuccessCount === 0 && iErrorCount === 0 && aSelectedContexts.length > 0) {
                MessageToast.show("Nenhum status pôde ser alterado (verifique se já estavam no status final ou se avisos foram gerados).");
            }
            console.log("🏁 FE Extension (nextstep - SEM DRAFT): Processamento do handler finalizado.");
        }
    };
});