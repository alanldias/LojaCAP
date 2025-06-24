sap.ui.define([
    "sap/m/MessageToast",
    "sap/ui/core/format/NumberFormat",
    "sap/ui/core/format/DateFormat"
], function (MessageToast, NumberFormat, DateFormat) {
    "use strict";

    return {
        /**
         * Gera e abre uma janela de impressão para uma tabela sap.m.Table.
         * @param {sap.m.Table} oTable A instância da tabela que será impressa.
         * @param {object} mCoresLinha Um mapa de IDs para classes de cor (ex: { 'someId': 'linhaVerde' }).
         */
        printTable: function (oTable) {
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
                    const tipoMensagem = oRowData.tipoMensagemErro;

                    switch (tipoMensagem) {
                        case 'S': // Sucesso
                            // Usamos um símbolo Unicode para o 'check' e aplicamos a cor verde.
                            logSymbolHTML = `<span style="color: green; font-size: 1.2em;">&#x2705;</span>`;
                            break;
                        case 'E': // Erro
                            // Símbolo de triângulo vermelho, como na sua imagem.
                            logSymbolHTML = `<span style="color: red; font-size: 1.2em;">&#x1F53A;</span>`;
                            break;
                        case 'R': // Rejeição (assumindo uma cor de aviso/laranja)
                            // Símbolo de aviso.
                            logSymbolHTML = `<span style="color: orange; font-size: 1.2em;">&#x26A0;</span>`;
                            break;
                        default:
                            // Se não houver tipo de mensagem, não exibe nada.
                            logSymbolHTML = "";
                            break;
                    }

                    return {
                        classeCor: classeCor,
                        log: logSymbolHTML, // <--- AQUI USAMOS O HTML GERADO
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

                // O restante do seu código HTML é exatamente o mesmo
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
                                <th class="col-log">Log</th>
                                <th class="col-idAlocSap">ID Aloc. SAP</th>
                                <th class="col-orderIdPL">Order ID PL</th>
                                <th class="col-chaveDocMae">Chave Doc. Mãe</th>
                                <th class="col-chaveDocFilho">Chave Doc. Filho</th>
                                <th class="col-statusProc">Status Proc.</th>
                                <th class="col-numeroNfse">Nº NFS-e</th>
                                <th class="col-serieNfse">Série NFS-e</th>
                                <th class="col-dtEmissaoNfse">Dt. Emissão NFS-e</th>
                                <th class="col-chaveAcessoNfse">Chave Acesso NFS-e</th>
                                <th class="col-codVerificacao">Cód. Verificação</th>
                                <th class="col-numeroMiro">Nº Doc. MIRO</th>
                                <th class="col-valorBruto">Valor Bruto NFSe</th>
                                <th class="col-valorLiquido">Valor Líquido Frete</th>
                                <th class="col-valorEfetivo">Valor Efetivo Frete</th>
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
                        <p>Relatório gerado em ${oDateFormat.format(new Date())} - ${oTimeFormat.format(new Date())}</p>
                        <p>Sistema NTTTESTTE - Plataforma Logística</p>
                    </div>
                </body>
                </html>`;

                const oBlob = new Blob([sHTML], { type: 'text/html' });
                const sUrl = URL.createObjectURL(oBlob);
                const oJanelaImpressao = window.open(sUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');

                if (oJanelaImpressao) {
                    // Adiciona um evento para revogar o blob quando a janela de impressão for fechada
                    oJanelaImpressao.onbeforeunload = () => {
                        URL.revokeObjectURL(sUrl);
                        console.log('Blob URL revogado ao fechar a janela de impressão.');
                    };

                    oJanelaImpressao.onload = () => {
                        oJanelaImpressao.focus();
                        oJanelaImpressao.print();
                        // Importante: NÃO revogue o URL do blob aqui imediatamente
                        // Deixe o onbeforeunload da janela de impressão cuidar disso.
                    };
                } else {
                    MessageToast.show("Não foi possível abrir a janela de impressão. Por favor, desative o bloqueador de pop-ups.");
                    // Se a janela não puder ser aberta, revogue o blob imediatamente para evitar vazamento.
                    URL.revokeObjectURL(sUrl);
                }

            }).catch(oError => {
                console.error("Erro ao carregar dados da tabela para impressão:", oError);
                MessageToast.show("Erro ao gerar relatório: " + oError.message);
            });
        }
    };
});