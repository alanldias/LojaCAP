sap.ui.define([], function() {
    'use strict';

    return {
        Imprimir: function(oEvent) {
            var oModel = this.getModel();
            
            // Buscar dados diretamente
            oModel.bindList("/Produtos").requestContexts(0, 1000).then(function(aContexts) {
                var aProdutos = [];
                
                aContexts.forEach(function(oContext) {
                    var oProduto = oContext.getObject();
                    aProdutos.push({
                        nome: oProduto.nome || "",
                        descricao: oProduto.descricao || "",
                        preco: oProduto.preco ? "R$ " + parseFloat(oProduto.preco).toFixed(2) : "",
                        estoque: oProduto.estoque || 0
                    });
                });
                
                // Ordenar produtos por nome (opcional)
                aProdutos.sort(function(a, b) {
                    return a.nome.localeCompare(b.nome);
                });
                
                // Gerar HTML
                var sHTML = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>Lista de Produtos - ${new Date().toLocaleDateString('pt-BR')}</title>
                        <style>
                            body { 
                                font-family: Arial, sans-serif; 
                                padding: 20px; 
                                color: #333;
                            }
                            .header { 
                                text-align: center; 
                                margin-bottom: 30px;
                                border-bottom: 2px solid #0066cc;
                                padding-bottom: 10px;
                            }
                            .header h1 {
                                color: #0066cc;
                                margin: 0;
                            }
                            .info {
                                display: flex;
                                justify-content: space-between;
                                margin-top: 10px;
                                font-size: 14px;
                                color: #666;
                            }
                            table { 
                                width: 100%; 
                                border-collapse: collapse; 
                                margin-top: 20px;
                            }
                            th { 
                                background-color: #0066cc; 
                                color: white; 
                                padding: 12px;
                                text-align: left;
                            }
                            td { 
                                border-bottom: 1px solid #ddd; 
                                padding: 10px; 
                            }
                            tr:nth-child(even) { 
                                background-color: #f8f9fa; 
                            }
                            .preco {
                                font-weight: bold;
                                color: #0066cc;
                            }
                            .estoque {
                                text-align: center;
                            }
                            .estoque-baixo {
                                color: #d32f2f;
                                font-weight: bold;
                            }
                            .footer {
                                margin-top: 30px;
                                text-align: center;
                                font-size: 12px;
                                color: #666;
                            }
                            @media print { 
                                body { margin: 0; }
                                @page { margin: 1cm; }
                                .no-print { display: none; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>Lista de Produtos</h1>
                            <div class="info">
                                <span>Data: ${new Date().toLocaleDateString('pt-BR')}</span>
                                <span>Hora: ${new Date().toLocaleTimeString('pt-BR')}</span>
                                <span>Total: ${aProdutos.length} produtos</span>
                            </div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 5%">#</th>
                                    <th style="width: 25%">Nome</th>
                                    <th style="width: 40%">Descrição</th>
                                    <th style="width: 15%">Preço</th>
                                    <th style="width: 15%">Estoque</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${aProdutos.map(function(p, index) {
                                    var estoqueClass = p.estoque < 10 ? 'estoque-baixo' : '';
                                    return `
                                        <tr>
                                            <td>${index + 1}</td>
                                            <td>${p.nome}</td>
                                            <td>${p.descricao}</td>
                                            <td class="preco">${p.preco}</td>
                                            <td class="estoque ${estoqueClass}">${p.estoque}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                        <div class="footer">
                            <p>Relatório gerado pelo sistema Loja CAP</p>
                        </div>
                    </body>
                    </html>
                `;
                
                // Criar e abrir janela de impressão
                var oJanelaImpressao = window.open('', '_blank', 'width=800,height=600');
                oJanelaImpressao.document.write(sHTML);
                oJanelaImpressao.document.close();
                
                setTimeout(function() {
                    oJanelaImpressao.print();
                }, 500);
            }).catch(function(oError) {
                console.error("Erro ao carregar produtos:", oError);
            });
        }
    };
});