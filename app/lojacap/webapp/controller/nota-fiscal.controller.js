sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/core/ValueState" // Importar ValueState para o formatter de estado
], function(Controller, Filter, FilterOperator, MessageToast, ValueState) {
    "use strict";

    return Controller.extend("lojacap.controller.nota-fiscal", { // Seu controller name

        formatter: { // Objeto para agrupar nossos formatters
            /**
             * Formata o código do status da NFS-e para um texto descritivo.
             * @param {string} sStatus - O código do status (ex: "01", "05").
             * @returns {string} O texto descritivo do status.
             */
            formatStatusNfseText: function(sStatus) {
                if (!sStatus) {
                    return "";
                }
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                // Usaremos o i18n para os textos, caso queira traduzir depois
                switch (sStatus) {
                    case "01":
                        return oResourceBundle.getText("statusNfse01", "Não Atribuída"); //getText(chave, textoDefault)
                    case "05":
                        return oResourceBundle.getText("statusNfse05", "NF Atribuída");
                    case "15":
                        return oResourceBundle.getText("statusNfse15", "Custo Absorção Calc.");
                    case "30":
                        return oResourceBundle.getText("statusNfse30", "Pedido Compra Criado");
                    case "35":
                        return oResourceBundle.getText("statusNfse35", "Fatura e NF Criadas");
                    case "50":
                        return oResourceBundle.getText("statusNfse50", "Processo Finalizado - PL");
                    case "55":
                        return oResourceBundle.getText("statusNfse55", "Rejeitado");
                    case "99":
                        return oResourceBundle.getText("statusNfse99", "Erro no Processamento");
                    default:
                        return sStatus;
                }
            },

            /**
             * Determina o ValueState (cor) para o ObjectStatus baseado no código do status da NFS-e.
             * @param {string} sStatus - O código do status (ex: "01", "05").
             * @returns {sap.ui.core.ValueState} O ValueState correspondente.
             */
            formatStatusNfseState: function(sStatus) {
                if (!sStatus) {
                    return ValueState.None;
                }
                switch (sStatus) {
                    case "01":
                        return ValueState.Information; // Azul
                    case "05":
                        return ValueState.Success; // Verde
                    case "15":
                        return ValueState.Information;
                    case "30":
                        return ValueState.Information;
                    case "35":
                        return ValueState.Success;
                    case "50":
                        return ValueState.Success;
                    case "55":
                        return ValueState.Warning; // Laranja
                    case "99":
                        return ValueState.Error; // Vermelho
                    default:
                        return ValueState.None;
                }
            }
        },

        onInit: function() {
            console.log("[CONTROLLER_LOG] NotaFiscal.controller.js onInit chamado.");
            // Aqui você pode inicializar modelos, buscar dados iniciais, etc.
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
                    if (sChaveFilhoAtual === sChaveFilhoSelecionada) {
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

        onAtribuirNotaFiscal: function(oEvent) {
            const oTable = this.byId("tableNotaFiscalServicoMonitor");
            const aSelectedItems = oTable.getSelectedItems();

            console.log("[CONTROLLER_LOG] Botão 'Atribuir NF (01->05)' pressionado.");

            if (aSelectedItems.length === 0) {
                MessageToast.show("Por favor, selecione pelo menos uma Nota Fiscal para atribuir.");
                console.warn("[CONTROLLER_LOG] Nenhuma NF selecionada para atribuição.");
                return;
            }

            aSelectedItems.forEach(function(oSelectedItem) {
                const oBindingContext = oSelectedItem.getBindingContext(); // Ajuste se estiver usando modelo nomeado
                if (oBindingContext) {
                    const sIdAlocacaoSAP = oBindingContext.getProperty("idAlocacaoSAP");
                    const sStatusAtual = oBindingContext.getProperty("status");

                    console.log(`[CONTROLLER_LOG] Tentando atribuir NF: idAlocacaoSAP='${sIdAlocacaoSAP}', Status Atual='${sStatusAtual}'`);

                    if (sStatusAtual !== "01") {
                        MessageToast.show(`A NF ${sIdAlocacaoSAP} não está no status 'Não Atribuída' (01).`);
                        console.warn(`[CONTROLLER_LOG] NF '${sIdAlocacaoSAP}' não pode ser atribuída. Status: ${sStatusAtual}`);
                        return; // Pula para o próximo item selecionado
                    }

                    // Simular a entrada do número do Pedido de Frete (em um app real, viria de um Dialog/Input)
                    const sNumeroPedidoFretePL = "PF_EXEMPLO_" + new Date().getTime().toString().slice(-5);
                    console.log(`[CONTROLLER_LOG] Número do Pedido de Frete PL (simulado): ${sNumeroPedidoFretePL}`);

                    // Aqui você chamaria a Action do seu backend
                    // Exemplo de como obter o modelo OData (assumindo modelo default ou um modelo nomeado)
                    const oModel = this.getView().getModel(); // Se for modelo default
                    // const oModel = this.getView().getModel("meuModeloOData"); // Se for modelo nomeado

                    // O CAP OData V4 usa um contexto de "bound action" ou "unbound action"
                    // A action "atribuirNotaFiscal" que definimos parece ser uma unbound action no serviço.
                    // A chamada exata pode variar um pouco dependendo de como o proxy do modelo OData é gerado/usado.
                    // Uma forma comum com v4.ODataModel:
                    const oAction = oModel.bindContext("/NfseMonitorService/atribuirNotaFiscal(...)"); // A unbound action do serviço
                                        
                    oAction.setParameter("idAlocacaoSAP", sIdAlocacaoSAP);
                    oAction.setParameter("numeroPedidoFretePL", sNumeroPedidoFretePL);

                    oAction.execute()
                        .then(function(oData) {
                            console.log(`[CONTROLLER_LOG] Ação 'atribuirNotaFiscal' executada com sucesso para ${sIdAlocacaoSAP}. Resposta:`, oData);
                            MessageToast.show(`Nota Fiscal ${sIdAlocacaoSAP} atribuída com Pedido de Frete ${sNumeroPedidoFretePL}!`);
                            // É importante atualizar o modelo da view ou a tabela para refletir a mudança
                            oModel.refresh(); // Refresh geral do modelo pode funcionar
                            // ou um refresh específico no binding da tabela: this.byId("tableNotaFiscalServicoMonitor").getBinding("items").refresh();
                        }.bind(this))
                        .catch(function(oError) {
                            console.error(`[CONTROLLER_LOG] Erro ao executar ação 'atribuirNotaFiscal' para ${sIdAlocacaoSAP}:`, oError);
                            MessageToast.show(`Erro ao atribuir NF ${sIdAlocacaoSAP}: ${oError.message}`);
                        }.bind(this));

                } else {
                    console.error("[CONTROLLER_LOG] Erro: Não foi possível obter o contexto de binding para o item selecionado.");
                }
            }.bind(this)); // Garante o 'this' correto dentro do forEach

            // Limpa a seleção da tabela após a ação
            oTable.removeSelections(true);
        },

        onUpdateFinishedNotaFiscal: function(oEvent) {
            const iTotalItems = oEvent.getParameter("total");
            console.log(`[CONTROLLER_LOG] Tabela 'tableNotaFiscalServicoMonitor' atualizada. Total de itens: ${iTotalItems}.`);
            // Você pode, por exemplo, atualizar um contador de itens na tela aqui.
        },

        onFiltrarPorStatus: function(sStatus) { // Exemplo de função para os botões de filtro
            const oTable = this.byId("tableNotaFiscalServicoMonitor");
            const oBinding = oTable.getBinding("items");
            let aFilters = [];

            console.log(`[CONTROLLER_LOG] Filtrando por status: '${sStatus}'`);

            if (sStatus && sStatus !== "TODOS") { // Supondo que "TODOS" limpa o filtro
                aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
            }

            oBinding.filter(aFilters);
        },

        onFiltroTodosPress: function() {
            this.onFiltrarPorStatus("TODOS"); // Ou simplesmente limpar o filtro: this.byId("tableNotaFiscalServicoMonitor").getBinding("items").filter([]);
        },
        onFiltroNaoAtribuidasPress: function() {
            this.onFiltrarPorStatus("01");
        },
        onFiltroAtribuidasPress: function() {
            this.onFiltrarPorStatus("05");
        },
        onFiltroErroPress: function() {
            this.onFiltrarPorStatus("99");
        },
        onFiltroFinalizadoPLPress: function() {
            this.onFiltrarPorStatus("50");
        }

        // Adicione aqui os handlers para os outros botões da toolbar de ações e filtros de ícone, se necessário.
        // Ex: onBtnProximaEtapaPress: function() { ... }
        // Ex: onBtnVoltarEtapaPress: function() { ... }
    });
});