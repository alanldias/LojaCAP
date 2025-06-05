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
      console.log("Tabela ordenada por Nome em ordem crescente.")
    },

    onPrintTable: function () {
        var oTable = this.byId("tablePedidosFree"); // <-- ID da sua tabela no View.xml
        if (!oTable) {
            MessageToast.show("Tabela não encontrada para impressão.");
            return;
        }
    
        var oBinding = oTable.getBinding("items");
        if (!oBinding) {
            MessageToast.show("Nenhum binding de itens encontrado na tabela.");
            return;
        }
    
        // É importante obter TODOS os contextos, não apenas os visíveis,
        // se a tabela tiver rolagem e você quiser imprimir tudo.
        // Se a tabela já estiver mostrando todos os itens (sem paginação do lado do cliente que esconde dados),
        // requestContexts() deve funcionar bem. Considere o parâmetro de comprimento se necessário.
        oBinding.requestContexts(0, oBinding.getLength()).then(function(aContexts) { // Solicita todos os contextos
            // --- DEPURANDO: Console Logs para verificar dados ---
            console.log("Número de Contextos retornados:", aContexts.length);
            if (aContexts.length > 0) {
                console.log("Primeiro Contexto:", aContexts[0]);
                console.log("Dados do primeiro Contexto (oContext.getObject()):", aContexts[0].getObject());
            } else {
                console.warn("Nenhum contexto retornado. Verifique se há dados ou filtros.");
                MessageToast.show("Nenhum dado na tabela para imprimir."); // Informa o usuário
                return; // Não prossegue se não há dados
            }
            // ---------------------------------------------------
    
            var aDadosTabela = [];
    
            var oCurrencyFormat = sap.ui.core.format.NumberFormat.getCurrencyInstance({ // Certifique-se que NumberFormat está no escopo correto
                currencyCode: true, // Para exibir o código da moeda, ex: BRL
                maxFractionDigits: 2,
                minFractionDigits: 2
            });
            var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ // Certifique-se que DateFormat está no escopo correto
                pattern: "dd/MM/yyyy"
            });
            var oTimeFormat = sap.ui.core.format.DateFormat.getTimeInstance({ // Certifique-se que DateFormat está no escopo correto
                pattern: "HH:mm:ss"
            });
    
    
            aContexts.forEach(function(oContext) {
                var oRowData = oContext.getObject(); // Obtém o objeto de dados da linha
    
                aDadosTabela.push({
                    log: oRowData.log || "",
                    clienteNome: oRowData.cliente ? oRowData.cliente.nome : "",
                    total: oRowData.total ? oCurrencyFormat.format(oRowData.total, "BRL") : "",
                    rawTotal: oRowData.total, // <-- Armazena o valor numérico original do total
                    pagamento: oRowData.pagamento || "",
                    status: oRowData.status || "",
                    orderIdPl: oRowData.orderIdPl || "",
                    chaveDocumentoMae: oRowData.chaveDocumentoMae || "",
                    numeroDocExterno: oRowData.numeroDocExterno || "",
                    idParceiro: oRowData.idParceiro || "",
                    nomeParceiro: oRowData.nomeParceiro || "",
                    numeroNfeM: oRowData.numeroNfeM || ""
                });
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
                        <div class="info">
                            <span>Data: ${oDateFormat.format(new Date())}</span>
                            <span>Hora: ${oTimeFormat.format(new Date())}</span>
                            <span>Total de Registros: ${aDadosTabela.length}</span>
                        </div>
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
                            ${aDadosTabela.map(function(row) {
                                var statusClass = 'status-' + (row.status || '').replace(/\s+/g, '_').toUpperCase(); // Normaliza o nome do status para a classe CSS
                                var corLinhaClass = '';
                                // Aplica a lógica da cor da linha baseada no valor numérico 'rawTotal'
                                if (typeof row.rawTotal === 'number') {
                                    corLinhaClass = row.rawTotal > 400 ? "linhaVerde" : "linhaVermelha";
                                }
                                return `
                                    <tr class="${corLinhaClass}">
                                        <td class="col-log">${row.log}</td>
                                        <td class="col-cliente">${row.clienteNome}</td>
                                        <td class="col-total">${row.total}</td>
                                        <td class="col-pagamento">${row.pagamento}</td>
                                        <td class="col-status ${statusClass}">${row.status}</td>
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
            setTimeout(function() {
                oJanelaImpressao.focus(); // Foca na janela de impressão
                oJanelaImpressao.print();
                // oJanelaImpressao.close(); // Descomente se quiser fechar a janela automaticamente após a impressão
            }, 750); // Aumentei um pouco o timeout
    
        }.bind(this)).catch(function(oError) {
            console.error("Erro ao carregar dados da tabela para impressão:", oError);
            MessageToast.show("Erro ao gerar relatório: " + oError.message);
        });
    },

    onUpdateFinished: function () {
      const oTable = this.byId("tablePedidosFree");
      const aItems = oTable.getItems();

      aItems.forEach(function (oItem) {
        const oCtx = oItem.getBindingContext();
        const valorTotal = oCtx.getProperty("status");

        // Remove qualquer classe antiga, se quiser evitar acúmulo
        oItem.removeStyleClass("linhaVerde");
        oItem.removeStyleClass("linhaVermelha");

        // Adiciona a classe conforme valor
        const sClasse = valorTotal > 400 ? "linhaVerde" : "linhaVermelha";
        oItem.addStyleClass(sClasse);
      });
    }
  });
});
