sap.ui.define([
    "sap/m/MessageToast",
    "sap/ui/core/format/NumberFormat",
    "sap/ui/core/format/DateFormat",
    "sap/ui/model/FilterType",
    "sap/ui/model/Sorter" 
], function (MessageToast, NumberFormat, DateFormat, FilterType, Sorter) {
    "use strict";

    /**
     * [JARVIS] CORREÇÃO FINAL: Acessa o modelo i18n via Componente, que é o dono do modelo.
     * Esta é a forma mais robusta e recomendada.
     * @param {sap.ui.core.mvc.Controller} oController O controller da view.
     * @returns {sap.ui.model.resource.ResourceModel} O modelo de recursos i18n.
     */
    function _getI18nModel(oController) {
        return oController.getOwnerComponent().getModel("i18n");
    }

    /**
     * Função "privada" para processar os contextos e gerar a impressão.
     * @param {sap.ui.model.Context[]} aContexts - Array de contextos a serem impressos.
     * @param {sap.ui.core.mvc.Controller} oController - O controller da view para acessar o i18n.
     */
    function _processAndPrint(aContexts, oController) {
        const bundle = _getI18nModel(oController).getResourceBundle();

        if (!aContexts || aContexts.length === 0) {
            MessageToast.show(bundle.getText("printUtil.noData"));
            return;
        }

        console.log("JARVIS_DEBUG: Iniciando formatação com i18n para", aContexts.length, "registros.");

        const texts = {
            reportTitle: bundle.getText("printUtil.reportTitle"),
            totalRecords: bundle.getText("printUtil.totalRecords"),
            reportGenerated: bundle.getText("printUtil.reportGenerated"),
            systemName: bundle.getText("printUtil.systemName"),
            appName: bundle.getText("appName"),
            col: {
                log: bundle.getText("print.col.log"),
                idAlocSap: bundle.getText("print.col.idAlocSap"),
                orderIdPL: bundle.getText("print.col.orderIdPL"),
                chaveDocMae: bundle.getText("print.col.chaveDocMae"),
                chaveDocFilho: bundle.getText("print.col.chaveDocFilho"),
                statusProc: bundle.getText("print.col.statusProc"),
                numeroNfse: bundle.getText("print.col.numeroNfse"),
                serieNfse: bundle.getText("print.col.serieNfse"),
                dtEmissaoNfse: bundle.getText("print.col.dtEmissaoNfse"),
                chaveAcessoNfse: bundle.getText("print.col.chaveAcessoNfse"),
                codVerificacao: bundle.getText("print.col.codVerificacao"),
                numeroMiro: bundle.getText("print.col.numeroMiro"),
                valorBruto: bundle.getText("print.col.valorBruto"),
                valorLiquido: bundle.getText("print.col.valorLiquido"),
                valorEfetivo: bundle.getText("print.col.valorEfetivo")
            }
        };

        const oCurrencyFormat = NumberFormat.getCurrencyInstance({ currencyCode: false, maxFractionDigits: 2, minFractionDigits: 2 });
        const oDateFormat = DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });
        const oTimeFormat = DateFormat.getTimeInstance({ pattern: "HH:mm:ss" });

        const aDadosTabela = aContexts.map(oContext => {
            const oRowData = oContext.getObject();
            let classeCor = "";
            if (oRowData.status === "50") {
                classeCor = "linhaVerde";
            } else if (oRowData.status === "55") {
                classeCor = "linhaVermelha";
            }
            let logSymbolHTML = "";
            switch (oRowData.tipoMensagemErro) {
                case 'S': logSymbolHTML = `<span style="color: green; font-size: 1.2em;">&#x2705;</span>`; break;
                case 'E': logSymbolHTML = `<span style="color: red; font-size: 1.2em;">&#x1F53A;</span>`; break;
                case 'R': logSymbolHTML = `<span style="color: orange; font-size: 1.2em;">&#x26A0;</span>`; break;
                default: logSymbolHTML = "";
            }
            return {
                classeCor: classeCor,
                log: logSymbolHTML,
                mensagemErro: oRowData.mensagemErro || "",
                idAlocacaoSAP: oRowData.idAlocacaoSAP || "",
                orderIdPL: oRowData.orderIdPL || "",
                chaveDocumentoMae: oRowData.chaveDocumentoMae || "",
                chaveDocumentoFilho: oRowData.chaveDocumentoFilho || "",
                status: oRowData.status || "",
                numeroNfseServico: oRowData.numeroNfseServico || "",
                serieNfseServico: oRowData.serieNfseServico || "",
                dataEmissaoNfseServico: oRowData.dataEmissaoNfseServico ? oDateFormat.format(new Date(oRowData.dataEmissaoNfseServico)) : "",
                chaveAcessoNfseServico: oRowData.chaveAcessoNfseServico || "",
                codigoVerificacaoNfse: oRowData.codigoVerificacaoNfse || "",
                numeroDocumentoMIRO: oRowData.numeroDocumentoMIRO || "",
                valorBrutoNfse: oRowData.valorBrutoNfse ? oCurrencyFormat.format(oRowData.valorBrutoNfse, "BRL") : "0,00",
                valorLiquidoFreteNfse: oRowData.valorLiquidoFreteNfse ? oCurrencyFormat.format(oRowData.valorLiquidoFreteNfse, "BRL") : "0,00",
                valorEfetivoFrete: oRowData.valorEfetivoFrete ? oCurrencyFormat.format(oRowData.valorEfetivoFrete, "BRL") : "0,00"
            };
        });

        let sHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${texts.reportTitle} - ${oDateFormat.format(new Date())}</title>
                <style>
                    body { font-family: Arial, sans-serif; font-size: 10px; padding: 20px; color: #333; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
                    .infoHeader { display: flex; justify-content: space-between; margin-top: 5px; font-size: 11px; }
                    .header h1 { color: #004b7c; margin: 0; font-size: 18px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 0.5px solid rgb(160, 160, 160); padding: 6px; text-align: left; word-break: break-word; }
                    th { background-color: #f2f2f2; font-weight: bold; text-transform: capitalize; font-size: 9.5px; }
                    .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
                    .col-log { width: 3%}
                    .col-chaveDocMae { width: 10% }
                    .col-chaveDocFilho { width: 10% }
                    .col-statusProc { width: 4% }
                    .col-chaveAcessoNfse { width: 10% }
                    .col-dtEmissaoNfse { width: 7% }
                    .col-valorBruto { width: 8%}
                    .col-valorLiquido { width: 8%}
                    .col-valorEfetivo { width: 8%}
                    .linhaVerde { background-color: #c8e6c9 !important; } 
                    .linhaVermelha { background-color: #ffcdd2 !important; } 
                    @media print {
                        body { margin: 0; padding: 10px; font-size: 9pt; }
                        @page { margin: 0.5cm; }
                        thead { display: table-header-group; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${texts.reportTitle}</h1>
                    <div class="infoHeader">
                        <span><strong>Data</strong>: ${oDateFormat.format(new Date())}</span>
                        <span><strong>Hora</strong>: ${oTimeFormat.format(new Date())}</span>
                        <span><strong>${texts.totalRecords}</strong>: ${aDadosTabela.length}</span>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th class="col-log">${texts.col.log}</th>
                            <th class="col-idAlocSap">${texts.col.idAlocSap}</th>
                            <th class="col-orderIdPL">${texts.col.orderIdPL}</th>
                            <th class="col-chaveDocMae">${texts.col.chaveDocMae}</th>
                            <th class="col-chaveDocFilho">${texts.col.chaveDocFilho}</th>
                            <th class="col-statusProc">${texts.col.statusProc}</th>
                            <th class="col-numeroNfse">${texts.col.numeroNfse}</th>
                            <th class="col-serieNfse">${texts.col.serieNfse}</th>
                            <th class="col-dtEmissaoNfse">${texts.col.dtEmissaoNfse}</th>
                            <th class="col-chaveAcessoNfse">${texts.col.chaveAcessoNfse}</th>
                            <th class="col-codVerificacao">${texts.col.codVerificacao}</th>
                            <th class="col-numeroMiro">${texts.col.numeroMiro}</th>
                            <th class="col-valorBruto">${texts.col.valorBruto}</th>
                            <th class="col-valorLiquido">${texts.col.valorLiquido}</th>
                            <th class="col-valorEfetivo">${texts.col.valorEfetivo}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${aDadosTabela.map(row => `
                            <tr class="${row.classeCor}">
                                <td class="col-log" title="${row.mensagemErro}">${row.log}</td>
                                <td>${row.idAlocacaoSAP}</td>
                                <td>${row.orderIdPL}</td>
                                <td>${row.chaveDocumentoMae}</td>
                                <td>${row.chaveDocumentoFilho}</td>
                                <td>${row.status}</td>
                                <td>${row.numeroNfseServico}</td>
                                <td>${row.serieNfseServico}</td>
                                <td>${row.dataEmissaoNfseServico}</td>
                                <td>${row.chaveAcessoNfseServico}</td>
                                <td>${row.codigoVerificacaoNfse}</td>
                                <td>${row.numeroDocumentoMIRO}</td>
                                <td>${row.valorBrutoNfse}</td>
                                <td>${row.valorLiquidoFreteNfse}</td>
                                <td>${row.valorEfetivoFrete}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    <p>${texts.reportGenerated} ${oDateFormat.format(new Date())} - ${oTimeFormat.format(new Date())}</p>
                    <p>${texts.systemName} - ${texts.appName}</p>
                </div>
            </body>
            </html>`;

        const oBlob = new Blob([sHTML], { type: 'text/html' });
        const sUrl = URL.createObjectURL(oBlob);
        const oJanelaImpressao = window.open(sUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');

        if (oJanelaImpressao) {
            oJanelaImpressao.onbeforeunload = () => { URL.revokeObjectURL(sUrl); };
            oJanelaImpressao.onload = () => { oJanelaImpressao.focus(); oJanelaImpressao.print(); };
        } else {
            MessageToast.show(bundle.getText("printUtil.popupError"));
            URL.revokeObjectURL(sUrl);
        }
    }

    // Este é o objeto que seu módulo 'PrintUtil.js' vai exportar.
// Cole este bloco de código inteiro no seu arquivo.

return {
    /**
     * Ponto de entrada para a impressão.
     * Contém a lógica final que diferencia a impressão com e sem filtros.
     * @param {sap.ui.table.Table | sap.m.Table} oTable A instância da tabela.
     * @param {sap.ui.core.mvc.Controller} oController O controller da view.
     */
    printTable: function (oTable, oController) {
        const bundle = oController.getOwnerComponent().getModel("i18n").getResourceBundle();
        MessageToast.show(bundle.getText("printUtil.moduleLoaded"));

        const oMainBinding = oTable.getBinding("items");
        if (!oMainBinding) {
            MessageToast.show(bundle.getText("printUtil.noData"));
            return;
        }

        const aFilters = oMainBinding.getFilters(FilterType.Application);

        // --- LÓGICA CONDICIONAL DEFINITIVA ---

        if (aFilters.length === 0) {
            // CENÁRIO 1: NENHUM FILTRO APLICADO
            console.log("JARVIS_DEBUG: Nenhum filtro detectado. Imprimindo apenas os itens visíveis na página atual.");
            
            // Pega os itens de linha (ex: ColumnListItem) que estão atualmente renderizados na tabela.
            const aVisibleItems = oTable.getItems();
            
            // Mapeia os itens da UI para seus respectivos contextos de dados.
            // Esta abordagem é segura e não interfere com o estado do binding principal.
            const aCurrentContexts = aVisibleItems.map(oItem => oItem.getBindingContext());
            
            _processAndPrint(aCurrentContexts, oController);

        } else {
            // CENÁRIO 2: FILTROS APLICADOS
            console.log("JARVIS_DEBUG: Filtros detectados. Buscando todos os registros do backend que correspondem à busca.");
            
            const oModel = oTable.getModel();
            const sPath = oMainBinding.getPath();
            
            // Abordagem pragmática e segura para obter a ordenação
            const aSorters = oMainBinding.aSorters || [];

            console.log("JARVIS_DEBUG: Filtros a serem aplicados na busca:", aFilters);
            console.log("JARVIS_DEBUG: Ordenação a ser aplicada na busca:", aSorters);

            const oTemporaryBinding = oModel.bindList(sPath);

            oTemporaryBinding.filter(aFilters);
            if (aSorters && aSorters.length > 0) {
                oTemporaryBinding.sort(aSorters);
            }

            // Busca todos os contextos que correspondem aos filtros
            oTemporaryBinding.requestContexts(0).then(aAllFilteredContexts => {
                _processAndPrint(aAllFilteredContexts, oController);
            }).catch(oError => {
                console.error("Erro ao carregar dados filtrados para impressão:", oError);
                MessageToast.show(bundle.getText("printUtil.filterError") + ": " + oError.message);
            }).finally(() => {
                // ESSENCIAL: Destrói o binding temporário para evitar vazamentos e erros de estado
                console.log("JARVIS_DEBUG: Destruindo binding temporário para manter a aplicação estável.");
                oTemporaryBinding.destroy();
            });
        }
    }
};
});



