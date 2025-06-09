sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/ui/core/format/NumberFormat",
  "sap/ui/core/format/DateFormat",
  "sap/ui/model/Sorter"
], function (Controller, JSONModel, MessageToast, NumberFormat, DateFormat, Sorter) {
  "use strict";

  return Controller.extend("lojacap.controller.PedidosFree", {

    /**
         * @function _getClasseParaTotal
         * @description Função auxiliar (privada) para determinar a classe CSS com base no valor total.
         * Isso centraliza a lógica e a torna reutilizável.
         * @param {number} valorTotal - O valor numérico a ser verificado.
         * @returns {string} - O nome da classe CSS ('linhaVerde', 'linhaVermelha') ou uma string vazia.
    */

    _getClasseParaTotal: function (valorTotal) {
        if(typeof valorTotal === 'number') {
            return valorTotal > 300 ? "linhaVerde" : "linhaVermelha";
        }
        return "";
    },

    onInit: function () {
      MessageToast.show("PedidosFree carregado!");
    },
  
    onPressAscending() {
      var oTable = this.byId("tablePedidosFree");
      var oBinding = oTable.getBinding("items");

      var aSorter = [new Sorter("cliente/nome", false)];

      oBinding.sort(aSorter);

      this.updateSortButtons("ascending");
      console.log("Tabela ordenada por Nome em ordem crescente.")
    },

    onPressDescending() {
      var oTable = this.byId("tablePedidosFree");
      var oBinding = oTable.getBinding("items");

      var aSorter = [new Sorter("cliente/nome", true)];

      oBinding.sort(aSorter);

      this.updateSortButtons("descending");
      console.log("Tabela ordenada por Nome em ordem decrescente.")
    },

    /**
         * @function onUpdateFinished
         * @description Chamado quando a tabela termina de ser renderizada/atualizada.
         * Usa a função auxiliar para aplicar as classes CSS nas linhas da tabela.
    */

    onUpdateFinished: function (oEvent) {
        const oTable = oEvent.getSource();
        const aItems = oTable.getItems();

        aItems.forEach(oItem => {
            const oCtx = oItem.getBindingContext();
            if (!oCtx) return;

            const valorTotal = oCtx.getProperty("total");
            const sClasse = this._getClasseParaTotal(valorTotal);

            oItem.removeStyleClass("linhaVerde");
            oItem.removeStyleClass("linhaVermelha");

            if(sClasse) {
                oItem.addStyleClass(sClasse);
            }
        });
    },

    onPrintTable: function () {
        const oTable = this.byId("tablePedidosFree"); // <-- ID da sua tabela no View.xml
        if (!oTable) {
            MessageToast.show("Tabela não encontrada para impressão.");
            return;
        }
    
        const oBinding = oTable.getBinding("items");
        if (!oBinding) {
            MessageToast.show("Nenhum binding de itens encontrado na tabela.");
            return;
        }
    
        // É importante obter TODOS os contextos, não apenas os visíveis,
        // se a tabela tiver rolagem e você quiser imprimir tudo.
        // Se a tabela já estiver mostrando todos os itens (sem paginação do lado do cliente que esconde dados),
        // requestContexts() deve funcionar bem. Considere o parâmetro de comprimento se necessário.
        oBinding.requestContexts(0, oBinding.getLength()).then(aContexts => { // Usando arrow function
            if (!aContexts || aContexts.length === 0) {
                MessageToast.show("Nenhum dado na tabela para imprimir.");
                return;
            }

            const oCurrencyFormat = NumberFormat.getCurrencyInstance({
                currencyCode: false, // O símbolo já deve vir do formatador
                maxFractionDigits: 2,
                minFractionDigits: 2
            });
            const oDateFormat = DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });
            const oTimeFormat = DateFormat.getTimeInstance({ pattern: "HH:mm:ss" });

            const aDadosTabela = aContexts.map(oContext => {
                const oRowData = oContext.getObject();
                return {
                    log: oRowData.log || "",
                    clienteNome: oRowData.cliente ? oRowData.cliente.nome : "",
                    total: oRowData.total ? oCurrencyFormat.format(oRowData.total, "BRL") : "",
                    rawTotal: oRowData.total, // Valor numérico original para a lógica
                    pagamento: oRowData.pagamento || "",
                    status: oRowData.status || "",
                    orderIdPl: oRowData.orderIdPl || "",
                    chaveDocumentoMae: oRowData.chaveDocumentoMae || "",
                    numeroDocExterno: oRowData.numeroDocExterno || "",
                    idParceiro: oRowData.idParceiro || "",
                    nomeParceiro: oRowData.nomeParceiro || "",
                    numeroNfeM: oRowData.numeroNfeM || ""
                };
            });
    
            // --- Gerar HTML dinamicamente ---
            var sHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Relatório de Entregas - ${oDateFormat.format(new Date())}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            font-weight: 400;
                            padding: 20px;
                            color: #333;
                            font-size: 10px; /* Reduzido para caber mais na impressão */
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 20px;
                            border-bottom: 1px solid #ccc;
                            padding-bottom: 10px;
                        }
                        .header h1 {
                            color: #004b7c;
                            margin: 0;
                            font-size: 18px; /* Reduzido */
                        }
                        .info {
                            display: flex;
                            justify-content: space-between;
                            margin-top: 5px;
                            font-size: 9px; /* Reduzido */
                            color: #666;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 15px; /* Reduzido */
                        }
                        th, td {
                            border: 0.5px solid rgb(160, 160, 160);
                            padding: 6px; /* Reduzido */
                            text-align: left;
                            text-transform: capitalize;
                            word-break: break-word; /* Para quebrar palavras longas e evitar estouro de layout */
                        }
                        th {
                            background-color: #f2f2f2;
                            color: #333;
                            font-weight: bold;
                            text-transform: uppercase;
                            font-size: 9.5px; /* Reduzido */
                        }
                        /* Removido tr:nth-child(even) para não interferir com as cores condicionais das linhas */
    
                        /* Classes para cores das linhas */
                        .linhaVerde {
                            background-color: #ccffcc !important; /* Verde claro */
                        }
                        .linhaVermelha {
                            background-color: #ffcccc !important; /* Vermelho claro */
                        }
    
                        .col-log { width: 3%; } 
                        .col-cliente { width: 8%; }
                        .col-total { width: 8%; }
                        .col-pagamento { width: 8%; }
                        .col-status { width: 8%; }
                        .col-orderidpl { width: 10%; }
                        .col-chaveDocMae { width: 10%; }
                        .col-numeroDocExterno { width: 7%; }
                        .col-idParceiro { width: 8%; }
                        .col-nomeParceiro { width: 10%; }
                        .col-numeroNfeM { width: 8%; }
    
                        .footer {
                            margin-top: 20px; /* Reduzido */
                            text-align: center;
                            font-size: 8px; /* Reduzido */
                            color: #666;
                            border-top: 1px solid #eee;
                            padding-top: 0px; /* Reduzido */
                        }
    
                        @media print {
                            body { margin: 0; padding: 10px; font-size: 9pt; } /* Ajuste a margem do corpo para impressão */
                            @page { 
                                margin: 0.5cm; /* Margens da página menores */
                                // size: A4 landscape; /* Define a orientação para paisagem, se preferir */
                            }
                            thead { display: table-header-group; } /* Repete o cabeçalho em cada página */
                            tfoot { display: table-footer-group; } /* Repete o rodapé em cada página (se houver) */
                            
                            /* ESSENCIAL PARA IMPRIMIR CORES DE FUNDO */
                            * {
                                -webkit-print-color-adjust: exact !important;   /* Chrome, Safari, Edge */
                                print-color-adjust: exact !important;             /* Firefox */
                            }
                            table { page-break-inside: auto; } /* Tenta evitar quebra de tabela no meio */
                            tr { page-break-inside: avoid; page-break-after: auto; } /* Tenta evitar quebra de linha no meio */
                                                    
                            /* Garante que as cores de fundo e texto sejam impressas */
                            .linhaVerde { background-color: #ccffcc !important; }
                            .linhaVermelha { background-color: #ffcccc !important; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Relatório de Detalhes do Documento</h1>
                        
                            <span>Data: ${oDateFormat.format(new Date())}</span>
                            <span>Hora: ${oTimeFormat.format(new Date())}</span>
                            <span>Total de Registros: ${aDadosTabela.length}</span>
                        
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th class="col-log">Log</th>
                                <th class="col-cliente">Cliente</th>
                                <th class="col-total">Total</th>
                                <th class="col-pagamento">Pagamento</th>
                                <th class="col-status">Status</th>
                                <th class="col-orderidpl">Order ID PL</th>
                                <th class="col-chaveDocMae">Chave Doc. Mãe</th>
                                <th class="col-numeroDocExterno">Núm. Doc. Ext.</th>
                                <th class="col-idParceiro">ID Parceiro</th>
                                <th class="col-nomeParceiro">Nome Parceiro</th>
                                <th class="col-numeroNfeM">Nº NF-e M</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${aDadosTabela.map(row => {
                                const corLinhaClass = this._getClasseParaTotal(row.rawTotal);
                                return `
                                    <tr class="${corLinhaClass}">
                                        <td class="col-log">${row.log}</td>
                                        <td class="col-cliente">${row.clienteNome}</td>
                                        <td class="col-total">${row.total}</td>
                                        <td class="col-pagamento">${row.pagamento}</td>
                                        <td class="col-status">${row.status}</td>
                                        <td class="col-orderidpl">${row.orderIdPl}</td>
                                        <td class="col-chaveDocMae">${row.chaveDocumentoMae}</td>
                                        <td class="col-numeroDocExterno">${row.numeroDocExterno}</td>
                                        <td class="col-idParceiro">${row.idParceiro}</td>
                                        <td class="col-nomeParceiro">${row.nomeParceiro}</td>
                                        <td class="col-numeroNfeM">${row.numeroNfeM}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    <div class="footer">
                        <p>Relatório gerado em ${oDateFormat.format(new Date())} - ${oTimeFormat.format(new Date())}</p>
                        <p>Sistema NTTTESTTE - Plataforma Logística</p>
                    </div>
                </body>
                </html>
            `;
    
            var oJanelaImpressao = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes'); // Aumentei um pouco o tamanho da janela
            oJanelaImpressao.document.write(sHTML);
            oJanelaImpressao.document.close();
    
            // Adiciona um pequeno delay para garantir que o CSS seja aplicado
            setTimeout(() => {
                oJanelaImpressao.focus(); // Foca na janela de impressão
                oJanelaImpressao.print();
                // oJanelaImpressao.close(); // Descomente se quiser fechar a janela automaticamente após a impressão
            }, 750); // Aumentei um pouco o timeout
    
        }).catch(oError => {
            console.error("Erro ao carregar dados da tabela para impressão:", oError);
            MessageToast.show("Erro ao gerar relatório: " + oError.message);
        });
    },
  });
});
