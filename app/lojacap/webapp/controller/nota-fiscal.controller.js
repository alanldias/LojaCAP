sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Sorter",
    "lojacap/controller/formatter",
    "sap/ui/core/format/NumberFormat", 
    "sap/ui/core/format/DateFormat"
], function(Controller, JSONModel, MessageBox, MessageToast, Sorter, formatter, NumberFormat, DateFormat) {
    "use strict";

    return Controller.extend("lojacap.controller.nota-fiscal", {

        formatter          : formatter,
        _coresLinha        : {},          // { idAlocacaoSAP : "linhaVerde" | "linhaVermelha" }


        onInit() {
            console.log("📜 Controller nota-fiscal.controller.js inicializado!");
        },


        onSelectionChange(oEvent) {
            const oListItem = oEvent.getParameter("listItem");
            const bSel      = oEvent.getParameter("selected");
            const oTable    = this.byId("tableNotaFiscalServicoMonitor");
            
            if (!oListItem) return;

            const oCtx          = oListItem.getBindingContext();
            const chaveFilhoSel = oCtx.getProperty("chaveDocumentoFilho");
            const statusSel     = oCtx.getProperty("status");

            if (bSel) {
                oTable.removeSelections(true);                      // limpa tudo
                oTable.getItems().forEach(item => {
                    const ctx   = item.getBindingContext();
                    const chave = ctx.getProperty("chaveDocumentoFilho");
                    const status= ctx.getProperty("status");
                    if (chave === chaveFilhoSel && status === statusSel) {
                        item.setSelected(true);
                    }
                });
            } else {
                oTable.getItems().forEach(item => {
                    const chave = item.getBindingContext().getProperty("chaveDocumentoFilho");
                    if (chave === chaveFilhoSel) item.setSelected(false);
                });
            }
        },

        // -------------- FUNCIONALIDADES BOTÕES -------------- // 
        
        async onProximaEtapa() {
            const oTable = this.byId("tableNotaFiscalServicoMonitor");
            const oModel = this.getView().getModel();

            const aCtx = oTable.getSelectedContexts();
            if (!aCtx.length) {
                MessageToast.show("Por favor, selecione ao menos uma NFSe.");
                return;
            }

            const aIds = aCtx.map(c => c.getProperty("idAlocacaoSAP"));
            console.log("▶️ IDs selecionadas:", aIds);

            const oAction = oModel.bindContext("/avancarStatusNFs(...)");
            oAction.setParameter("notasFiscaisIDs", aIds);

            try {
                await oAction.execute();
                const payload   = oAction.getBoundContext().getObject();
                const resultados = Array.isArray(payload) ? payload : (payload?.value || []);

                console.log(payload)
                console.log(resultados)

                /* === Atualiza mapa de cores somente para IDs do lote === */
                resultados.forEach(r => {
                    this._coresLinha[r.idAlocacaoSAP] =
                        r.success ? "linhaVerde" : "linhaVermelha";
                });

                let ok = 0; const erros = [];
                resultados.forEach(r => r.success ? ok++ :
                    erros.push(`NF ${r.idAlocacaoSAP}: ${r.message}`));

                if (erros.length) {
                    MessageBox.warning(
                        `Processamento concluído com ${ok} sucesso(s) e ${erros.length} erro(s).\n\n${erros.join("\n")}`,
                        { title: "Resultado do Processamento" }
                    );
                } else {
                    MessageToast.show(`${ok} NFSe(s) processada(s) com sucesso!`);
                    
                }

                /* dispara updateFinished → pintará linhas */
                oTable.getBinding("items").refresh();

            } catch (e) {
                console.error("❌ Erro na action:", e);
                MessageBox.error("Falha ao processar as NFSe.", {
                    details : e.message || JSON.stringify(e)
                });
            }
        },

        onPressAscending: function () {
            var oTable = this.byId("tableNotaFiscalServicoMonitor")
            var oBinding = oTable.getBinding("items")

            var aSorter = [new Sorter("status", false)]

            oBinding.sort(aSorter)

            this.updateSortButtons("ascending")
            console.log("Tabela ordenada por Status em ordem crescente.")
        },

        onPressDescending: function () {
            var oTable = this.byId("tableNotaFiscalServicoMonitor")
            var oBinding = oTable.getBinding("items")

            var aSorter = [new Sorter("status", true)]

            oBinding.sort(aSorter)

            this.updateSortButtons("descending")
            console.log("Tabela ordenada por Status em ordem descrescente")
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
            const oTable = oEvent.getSource();
            const aItems = oTable.getItems();


            aItems.forEach(oItem => {
                const ctx = oItem.getBindingContext();
                if (!ctx) return;

                const id         = ctx.getProperty("idAlocacaoSAP");
                const classeNova = this._coresLinha[id];              // pode ser undefined

                if (!classeNova) return;                              // nunca colorida → ignora

                const temVerde = oItem.hasStyleClass("linhaVerde");
                const temVerm  = oItem.hasStyleClass("linhaVermelha");

                if (classeNova === "linhaVerde" && !temVerde) {
                    if (temVerm) oItem.removeStyleClass("linhaVermelha");
                    oItem.addStyleClass("linhaVerde");
                }
                if (classeNova === "linhaVermelha" && !temVerm) {
                    if (temVerde) oItem.removeStyleClass("linhaVerde");
                    oItem.addStyleClass("linhaVermelha");
                }
            });
        }

    });
});
