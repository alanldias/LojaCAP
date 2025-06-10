sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Sorter",
    "lojacap/controller/formatter",
    "sap/ui/core/format/NumberFormat", 
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, MessageBox, MessageToast, Sorter, formatter, NumberFormat, DateFormat, Fragment, Filter, FilterOperator) {

    "use strict";

    return Controller.extend("lojacap.controller.nota-fiscal", {

        formatter   : formatter,
        _coresLinha : {},            // { id : 'linhaVerde' | 'linhaVermelha' }
        _oLogDialog : null,

        onInit() {
            console.log("📜 Controller nota-fiscal inicializado");
        },

      
        /* Seleção agora é “livre”; apenas logs                                */
       
        onSelectionChange(oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const bSel  = oEvent.getParameter("selected");
            if (oItem) {
                const ctx   = oItem.getBindingContext();
                console.log(`[SEL] ${bSel ? 'Selecionado' : 'Desmarcado'} – ID: ${ctx.getProperty("idAlocacaoSAP")}`);
            }
        },
        onMenuAction: function (oEvent) {
            const sId = oEvent.getParameter("item").getId();
            console.log("onMenuAction: Item do menu clicado:", sId);
            if (sId.endsWith("menuFiltroSelectfiltro")) {
                this.openFilterDialog();
            }
        },

        openFilterDialog: async function () {
            console.log("openFilterDialog: Abrindo o diálogo de filtro.");
            if (!this._oFilterDialog) {
                console.log("openFilterDialog: Carregando fragmento...");

                /* sem 'id' → controles vão para o Core (sap.ui.getCore().byId) */
                this._oFilterDialog = await Fragment.load({
                    name       : "lojacap.view.fragments.NFMonitorFilterDialog",
                    controller : this
                });
                this.getView().addDependent(this._oFilterDialog);
            }
            this._oFilterDialog.open();
        },

        onFilterCancel: function () {
            console.log("onFilterCancel: Fechando diálogo.");
            this._oFilterDialog.close();
        },

        /* ------------------- APLICA FILTROS ------------------- */
        onFilterApply: function () {
            console.log("--- onFilterApply: Iniciando a aplicação de filtros ---");

            const getVal = id => {
                const oCtrl = sap.ui.getCore().byId(id);
                if (!oCtrl) {
                    console.warn(`getVal: controle '${id}' não encontrado.`);
                    return null;
                }
                return oCtrl.getDateValue ? oCtrl.getDateValue() : oCtrl.getValue();
            };

            /* helper para montar range */
            const aFilters = [];
            const addRange = (idFrom, idTo, path) => {
                const v1 = getVal(idFrom);
                const v2 = getVal(idTo);
                if (!v1 && !v2) return;

                if (v1 && v2) {
                    console.log(`addRange: BETWEEN ${path}`, v1, v2);
                    aFilters.push(new Filter({ path, operator: FilterOperator.BT, value1: v1, value2: v2 }));
                } else if (v1) {
                    console.log(`addRange: GE ${path}`, v1);
                    aFilters.push(new Filter({ path, operator: FilterOperator.GE, value1: v1 }));
                } else {
                    console.log(`addRange: LE ${path}`, v2);
                    aFilters.push(new Filter({ path, operator: FilterOperator.LE, value1: v2 }));
                }
            };

            console.log("onFilterApply: Montando filtros...");
            addRange("inpIdSapFrom",    "inpIdSapTo",    "idAlocacaoSAP");
            addRange("inpOrderFrom",    "inpOrderTo",    "orderIdPL");
            addRange("inpStatusFrom",   "inpStatusTo",   "status");
            addRange("dpDateFrom",      "dpDateTo",      "dataEmissaoNfseServico");
            addRange("inpVlrBrutoFrom", "inpVlrBrutoTo", "valorBrutoNfse");

            console.log("onFilterApply: Filtros finais:", JSON.stringify(aFilters));

            const oTable   = this.byId("tableNotaFiscalServicoMonitor");
            const oBinding = oTable.getBinding("items");
            oBinding.filter(aFilters);
            console.log("onFilterApply: Filtros aplicados!");

            this._oFilterDialog.close();
        },
        //botão de reijetar frete
        async onRejeitarFrete() {
            const oTable = this.byId("tableNotaFiscalServicoMonitor");
            const oModel = this.getView().getModel();
            const aCtx   = oTable.getSelectedContexts();
        
            if (aCtx.length !== 1) {
                MessageToast.show("Selecione exatamente 1 NFSe para rejeitar.");
                return;
            }
        
            const id = aCtx[0].getProperty("idAlocacaoSAP");
            console.log("✖️ Rejeitando frete – ID:", id);
        
            const oAction = oModel.bindContext("/rejeitarFrete(...)");
            oAction.setParameter("idAlocacaoSAP", id);
        
            try {
                await oAction.execute();
                const res = oAction.getBoundContext().getObject();
                console.log("Resposta:", res);
        
                /* atualiza mapa de cores para essa linha */
                this._coresLinha[id] = res.success ? "linhaVermelha" : "linhaVerde"; // como aqui deu certo mas o 55 sempre vai ser vermelho então deixa assim ao contrario

                if (res.success) {
                    MessageToast.show("Frete rejeitado com sucesso (status 55).");
                } else {
                    MessageBox.error(`Falha ao rejeitar: ${res.message}`);
                }
        
                /* refresh table → updateFinished pintará */
                oTable.getBinding("items").refresh();
        
            } catch (e) {
                console.error("❌ Erro na action rejeitarFrete:", e);
                MessageBox.error("Falha ao rejeitar o frete.", {
                    details : e.message || JSON.stringify(e)
                });
            }
        },
        //Botão Próxima Etapa – expande seleção p/ todo o grupo     
       
        async onProximaEtapa() {
            const oTable = this.byId("tableNotaFiscalServicoMonitor");
            const oModel = this.getView().getModel();
            const aCtxSel = oTable.getSelectedContexts();
        
            if (!aCtxSel.length) {
                MessageToast.show("Por favor, selecione ao menos uma NFSe.");
                return;
            }
        
            /* === grupo de referência = primeiro item selecionado =========== */
            const grpFilho  = aCtxSel[0].getProperty("chaveDocumentoFilho");
            const grpStatus = aCtxSel[0].getProperty("status");
        
            console.log(`[NEXT] Grupo alvo -> filho:${grpFilho} | status:${grpStatus}`);
        
            const aIds = [];  // IDs que seguirão para action
        
            /* === 1. percorre TODAS as linhas ================================= */
            oTable.getItems().forEach(item => {
                const ctx = item.getBindingContext();
                if (!ctx) return;
        
                const filho  = ctx.getProperty("chaveDocumentoFilho");
                const status = ctx.getProperty("status");
                const id     = ctx.getProperty("idAlocacaoSAP");
        
                const pertenceAoGrupo = filho === grpFilho && status === grpStatus;
        
                /* Seleciona/deseleciona visualmente */
                item.setSelected(pertenceAoGrupo);
        
                /* monta lista de IDs */
                if (pertenceAoGrupo) aIds.push(id);
            });
        
            console.log("▶️ IDs enviados para action:", aIds);
        
            /* === 2. dispara action ========================================== */
            const oAction = oModel.bindContext("/avancarStatusNFs(...)");
            oAction.setParameter("notasFiscaisIDs", aIds);
        
            try {
                await oAction.execute();
                const payload    = oAction.getBoundContext().getObject();
                const resultados = Array.isArray(payload) ? payload : (payload?.value || []);
        
                resultados.forEach(r => {
                    /* pinta conforme resultado */
                    this._coresLinha[r.idAlocacaoSAP] = r.success ? "linhaVerde" : "linhaVermelha";
                });
        
                const ok   = resultados.filter(r => r.success).length;
                const errs = resultados.filter(r => !r.success);
                if (errs.length) {
                    const txt = errs.map(r => `NF ${r.idAlocacaoSAP}: ${r.message}`).join("\n");
                    MessageBox.warning(`Processamento: ${ok} sucesso(s) e ${errs.length} erro(s).\n\n${txt}`,
                                       { title: "Resultado do Processamento" });
                } else {
                    MessageToast.show(`${ok} NFSe(s) processada(s) com sucesso!`);
                }
        
                /* refresh → onUpdateFinished pintará cores */
                oTable.getBinding("items").refresh();
        
            } catch (e) {
                console.error("❌ Erro na action:", e);
                MessageBox.error("Falha ao processar as NFSe.", {
                    details: e.message || JSON.stringify(e)
                });
            }
        },

        onPressAscending() {
            const oBinding = this.byId("tableNotaFiscalServicoMonitor").getBinding("items");
            oBinding.sort(new Sorter("status", false));
            this.updateSortButtons?.("ascending");
        },

        onPressDescending() {
            const oBinding = this.byId("tableNotaFiscalServicoMonitor").getBinding("items");
            oBinding.sort(new Sorter("status", true));
            this.updateSortButtons?.("descending");
        },


        onLogPress() {
            const oView = this.getView();
            if (!this._oLogDialog) {
                Fragment.load({
                    name: "lojacap.view.fragments.NotaFiscalServicoLogDialog",
                    controller: this
                }).then(oDialog => {
                    oView.addDependent(oDialog);
                    oDialog.setModel(oView.getModel());
                    this._oLogDialog = oDialog;
                    oDialog.open();
                });
            } else {
                this._oLogDialog.open();
            }
        },
        onLogClose() {
            this._oLogDialog?.close();
        },

        onPressPrint: function () {
            const oTable = this.byId("tableNotaFiscalServicoMonitor");
        
            if (!oTable) {
                MessageToast.show("Tabela não encontrada para impressão.");
                return;
            }
        
            const oBinding = oTable.getBinding("items");
            if (!oBinding) {
                MessageToast.show("Nenhum binding de itens encontrado na tabela.");
                return;
            }
        
            oBinding.requestContexts(0, oBinding.getLength()).then(aContexts => {
                if (!aContexts || aContexts.length === 0) {
                    MessageToast.show("Nenhum dado na tabela para imprimir.");
                    return;
                }
                
                const NumberFormat = sap.ui.core.format.NumberFormat;
                const DateFormat = sap.ui.core.format.DateFormat;
        
                const oCurrencyFormat = NumberFormat.getCurrencyInstance({ currencyCode: false, maxFractionDigits: 2, minFractionDigits: 2 });
                const oDateFormat = DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });
                const oTimeFormat = DateFormat.getTimeInstance({ pattern: "HH:mm:ss" });
        
                const aDadosTabela = aContexts.map(oContext => {
                    const oRowData = oContext.getObject();
                    const id = oRowData.idAlocacaoSAP;
                    const classeCor = this._coresLinha[id] || "";
                    return {
                        classeCor: classeCor,
                        log: oRowData.logErroFlag ? oRowData.mensagemErro : "",
                        idAlocacaoSAP: oRowData.idAlocacaoSAP || "",
                        orderIdPL: oRowData.orderIdPL || "",
                        chaveDocumentoMae: oRowData.chaveDocumentoMae || "",
                        chaveDocumentoFilho: oRowData.chaveDocumentoFilho || "",
                        status: oRowData.status || "",
                        numeroNfseServico: oRowData.numeroNfseServico || "",
                        serieNfseServico: oRowData.serieNfseServico || "",
                        dataEmissaoNfseServico: oRowData.dataEmissaoNfseServico || "",
                        chaveAcessoNfseServico: oRowData.chaveAcessoNfseServico || "",
                        codigoVerificacaoNfse: oRowData.codigoVerificacaoNfse || "",
                        numeroDocumentoMIRO: oRowData.numeroDocumentoMIRO || "",
                        valorBrutoNfse: oRowData.valorBrutoNfse ? oCurrencyFormat.format(oRowData.valorBrutoNfse, "BRL") : "0.00",
                        valorLiquidoFreteNfse: oRowData.valorLiquidoFreteNfse ? oCurrencyFormat.format(oRowData.valorLiquidoFreteNfse, "BRL") : "0.00",
                        valorEfetivoFrete: oRowData.valorEfetivoFrete ? oCurrencyFormat.format(oRowData.valorEfetivoFrete, "BRL") : "0.00"
                    };
                });
        
                var sHTML = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>Relatório de Detalhes do Documento - ${oDateFormat.format(new Date())}</title>
                        <style>
                            body { font-family: Arial, sans-serif; font-size: 10px; padding: 20px; color: #333; }
                            .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
                            .infoHeader { display: flex; justify-content: space-between; margin-top: 5px; font-size: 11px; }
                            .header h1 { color: #004b7c; margin: 0; font-size: 18px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                            th, td { border: 0.5px solid rgb(160, 160, 160); padding: 6px; text-align: left; word-break: break-word; }
                            th { background-color: #f2f2f2; font-weight: bold; text-transform: capitalize; font-size: 9.5px; }
                            .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
        
                            /* <<< CORREÇÃO DEFINITIVA: ADICIONAR AS CLASSES DE COR AQUI >>> */
                            .linhaVerde { background-color: #c8e6c9 !important; } /* Verde mais suave */
                            .linhaVermelha { background-color: #ffcdd2 !important; } /* Vermelho mais suave */
        
                            @media print {
                                body { margin: 0; padding: 10px; font-size: 9pt; }
                                @page { margin: 0.5cm; }
                                thead { display: table-header-group; }
                                * { 
                                    -webkit-print-color-adjust: exact !important; 
                                    print-color-adjust: exact !important; 
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>Relatório de Detalhes do Documento</h1>
                            <div class="infoHeader">
                                <span><strong>Data</strong>: ${oDateFormat.format(new Date())}</span>
                                <span><strong>Hora</strong>: ${oTimeFormat.format(new Date())}</span>
                                <span><strong>Total de Registros</strong>: ${aDadosTabela.length}</span>
                            </div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Log</th><th>ID Aloc. SAP</th><th>Order ID PL</th><th>Chave Doc. Mãe</th><th>Chave Doc. Filho</th><th>Status Proc.</th>
                                    <th>Nº NFS-e</th><th>Série NFS-e</th><th>Dt. Emissão NFS-e</th><th>Chave Acesso NFS-e</th><th>Cód. Verificação</th>
                                    <th>Nº Doc. MIRO</th><th>Valor Bruto NFSe</th><th>Valor Líquido Frete</th><th>Valor Efetivo Frete</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${aDadosTabela.map(row => `
                                    <tr class="${row.classeCor}">
                                        <td>${row.log}</td><td>${row.idAlocacaoSAP}</td><td>${row.orderIdPL}</td><td>${row.chaveDocumentoMae}</td>
                                        <td>${row.chaveDocumentoFilho}</td><td>${row.status}</td><td>${row.numeroNfseServico}</td>
                                        <td>${row.serieNfseServico}</td><td>${row.dataEmissaoNfseServico}</td><td>${row.chaveAcessoNfseServico}</td>
                                        <td>${row.codigoVerificacaoNfse}</td><td>${row.numeroDocumentoMIRO}</td><td>${row.valorBrutoNfse}</td>
                                        <td>${row.valorLiquidoFreteNfse}</td><td>${row.valorEfetivoFrete}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <div class="footer">
                            <p>Relatório gerado em ${oDateFormat.format(new Date())} - ${oTimeFormat.format(new Date())}</p>
                            <p>Sistema NTTTESTTE - Plataforma Logística</p>
                        </div>
                    </body>
                    </html>`;
                
                const oBlob = new Blob([sHTML], { type: 'text/html' });
                const sUrl = URL.createObjectURL(oBlob);
                const oJanelaImpressao = window.open(sUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
        
                if (oJanelaImpressao) {
                    oJanelaImpressao.onload = () => {
                        oJanelaImpressao.requestAnimationFrame(() => {
                            oJanelaImpressao.requestAnimationFrame(() => {
                                oJanelaImpressao.focus();
                                oJanelaImpressao.print();
                                URL.revokeObjectURL(sUrl);
                            });
                        });
                    };
                } else {
                    MessageToast.show("Não foi possível abrir a janela de impressão. Por favor, desative o bloqueador de pop-ups.");
                }
        
            }).catch(oError => {
                console.error("Erro ao carregar dados da tabela para impressão:", oError);
                MessageToast.show("Erro ao gerar relatório: " + oError.message);
            });
        },

        // -------------- FIM FUNCIONALIDADES BOTÕES -------------- // 
  
        onUpdateFinishedNotaFiscal(oEvent) {
            const aItems = oEvent.getSource().getItems();
        
            aItems.forEach(item => {
                const ctx = item.getBindingContext();
                if (!ctx) return;
        
                const id      = ctx.getProperty("idAlocacaoSAP");
                const status  = ctx.getProperty("status");    // status da linha
        
                /* 1. Remove cores antigas para evitar acúmulo */
                item.removeStyleClass("linhaVerde");
                item.removeStyleClass("linhaVermelha");
        
                /* 2. Cor proveniente do último lote (_coresLinha) */
                const classeLote = this._coresLinha[id];
        
                if (classeLote === "linhaVerde") {
                    item.addStyleClass("linhaVerde");
                } else if (classeLote === "linhaVermelha") {
                    item.addStyleClass("linhaVermelha");
                } else if (status === "55") {
                    /* 3. Nenhuma cor do lote, mas status 55 → vermelho */
                    item.addStyleClass("linhaVermelha");
                }
                /* status diferente de 55 e sem cor no lote → fica sem cor */
            });
        }
    });
});
