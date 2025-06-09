sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    // Seus formatters estão referenciados na view como '.formatter.nomeDaFuncao'
    // Isso significa que eles devem estar em um arquivo separado e carregados,
    // ou definidos diretamente no controller e a view ajustada para chamá-los como 'nomeDaFuncao'
    // Exemplo de como carregar formatter: "./formatter" (se existir um arquivo formatter.js na mesma pasta)
    "lojacap/controller/formatter" // Assumindo que você tem um formatter.js
], function(Controller, JSONModel, MessageBox, MessageToast, formatter) {
    "use strict";

    return Controller.extend("lojacap.controller.nota-fiscal", {

        formatter: formatter, // Disponibiliza o formatter para a view

        onInit: function() {
            console.log("📜 Controller nota-fiscal.controller.js inicializado!");
            // Exemplo de inicialização de modelo local, se necessário para a view
            // var oViewModel = new JSONModel({
            // isBusy: false
            // });
            // this.getView().setModel(oViewModel, "view");
        },

        /**
         * @override
         * Chamado quando a seleção na tabela de notas fiscais é alterada.
         * Garante que apenas um grupo de 'Chave Doc. Filho' possa ser selecionado por vez.
         * @param {sap.ui.base.Event} oEvent O objeto do evento selectionChange.
         */
        onSelectionChange: function(oEvent) {
            console.log("[CONTROLLER_LOG] onSelectionChange acionado.");

            // Informações essenciais do evento
            const oListItem = oEvent.getParameter("listItem");
            const bIsSelected = oEvent.getParameter("selected"); // true se selecionou, false se desmarcou
            const oTable = this.byId("tableNotaFiscalServicoMonitor");

            if (!oListItem) {
                return;
            }

            const oBindingContext = oListItem.getBindingContext();
            const sChaveFilhoSelecionada = oBindingContext.getProperty("chaveDocumentoFilho");
            const sStatusSelecionado = oBindingContext.getProperty("status");
            console.log(`[CONTROLLER_LOG] Chave Filho: '${sChaveFilhoSelecionada}', Ação: ${bIsSelected ? 'Selecionar' : 'Desmarcar'}`);

            // --- LÓGICA PRINCIPAL MODIFICADA ---

            // Se o usuário está SELECIONANDO uma nova linha...
            if (bIsSelected) {
                // PASSO 1 (NOVO): Limpar todas as seleções anteriores.
                // O parâmetro 'true' é importante para não disparar o evento selectionChange novamente e causar um loop.
                console.log("[CONTROLLER_LOG] Limpando seleções antigas...");
                oTable.removeSelections(true);

                // PASSO 2: Percorrer todos os itens e selecionar APENAS o novo grupo.
                oTable.getItems().forEach(function(oItem) {
                    const sChaveFilhoAtual = oItem.getBindingContext().getProperty("chaveDocumentoFilho");
                    const sStatusAtual = oItem.getBindingContext().getProperty("status");
                    if (sChaveFilhoAtual === sChaveFilhoSelecionada && sStatusAtual === sStatusSelecionado) {
                        oItem.setSelected(true); // Seleciona este item
                    }
                });

            } else {
                // Se o usuário está DESMARCANDO uma linha, o comportamento é o mesmo de antes:
                // apenas desmarca todos os itens do seu próprio grupo.
                oTable.getItems().forEach(function(oItem) {
                    const sChaveFilhoAtual = oItem.getBindingContext().getProperty("chaveDocumentoFilho");
                    if (sChaveFilhoAtual === sChaveFilhoSelecionada) {
                        oItem.setSelected(false); // Desmarca este item
                    }
                });
            }
        },

        onProximaEtapa: async function () {
            console.log("▶️ Botão 'Próxima etapa' pressionado.");
        
            const oTable = this.byId("tableNotaFiscalServicoMonitor");
            const oModel = this.getView().getModel();
        
            try {
                const aSelectedContexts = oTable.getSelectedContexts();
                if (aSelectedContexts.length === 0) {
                    MessageToast.show("Por favor, selecione ao menos uma NFSe.");
                    return;
                }
        
                const aNotasIDs = aSelectedContexts.map(context => context.getProperty("idAlocacaoSAP"));
                console.log("🆔 IDs das NFSe selecionadas:", aNotasIDs);
        
                // Criar e configurar a chamada da action
                const oActionBinding = oModel.bindContext("/avancarStatusNFs(...)");
                oActionBinding.setParameter("notasFiscaisIDs", aNotasIDs);
        
                // Executar
                console.log("Frontend: Executando a action...");
                await oActionBinding.execute();
                
                // Obter e processar o payload
                const oPayload = oActionBinding.getBoundContext().getObject();
                console.log("Frontend: Payload recebido do backend:", oPayload);
                
                const resultados = Array.isArray(oPayload) ? oPayload : (oPayload?.value || []);
        
                let ok = 0;
                const mensagensDeErro = [];
        
                resultados.forEach(r => {
                    if (r.success) {
                        ok++;
                    } else {
                        mensagensDeErro.push(`NF ${r.idAlocacaoSAP}: ${r.message}`);
                    }
                });
        
                console.log(`Frontend: Processamento finalizado. Sucessos: ${ok}, Erros: ${mensagensDeErro.length}`);
        
                // Apresentar o resultado para o usuário
                if (mensagensDeErro.length > 0) {
                    MessageBox.warning(
                        `Processamento concluído com ${ok} sucesso(s) e ${mensagensDeErro.length} erro(s).\n\n` +
                        `Detalhes dos erros:\n${mensagensDeErro.join("\n")}`,
                        { title: "Resultado do Processamento" }
                    );
                } else {
                    MessageToast.show(`${ok} NFSe(s) processada(s) com sucesso!`);
                }
        
                // Atualizar a UI
                oTable.getBinding("items").refresh();
            
        
            } catch (e) {
                console.error("❌ Frontend: Erro na action capturado pelo CATCH:", e);
                MessageBox.error("Falha ao processar as NFSe.", {
                    details: e.message || JSON.stringify(e)
                });
            }
        },

        onUpdateFinishedNotaFiscal: function(oEvent) {
            var sTitle = "Notas Fiscais de Serviço";
            var oTable = oEvent.getSource();
            var iTotalItems = oEvent.getParameter("total");

            if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
                sTitle = `Notas Fiscais de Serviço (${iTotalItems})`;
            }
            // Você pode querer atualizar um título na view com esta contagem
            // Ex: this.getView().getModel("view").setProperty("/tableTitle", sTitle);
            console.log(`📝 Tabela de NFSe atualizada. Total de itens: ${iTotalItems}`);
        }

        // ... quaisquer outras funções do seu controller
    });
});