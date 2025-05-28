sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("lojacap.controller.payment-page", {

        onInit: function () {
            console.log("💰 Controller payment-page.js: onInit - Iniciando.");
            // 1. Modelo para os dados da view de pagamento
            const oPaymentViewModel = new JSONModel({
                itens: [],
                valorTotal: "0.00",
                clienteID: null,        // Será buscado
                itensNoCarrinho: false, // Para controlar se há itens
                isBuyNowFlow: false   // <<< NOSSA NOVA FLAG INICIALIZADA AQUI
            });
            this.getView().setModel(oPaymentViewModel, "paymentView");

            // 2. Modelo para os tipos de pagamento
            const oEnumPagamento = new JSONModel([
                { key: "PIX", text: "PIX" },
                { key: "CARTAO", text: "Cartão" },
                { key: "BOLETO", text: "Boleto" }
            ]);
            this.getView().setModel(oEnumPagamento, "enum");

            // 3. Anexa uma função para ser chamada quando a rota "RoutePayment" for acessada
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RoutePayment").attachPatternMatched(this._onRouteMatched, this);
            console.log("💰 Controller payment-page.js: onInit - Rota 'RoutePayment' monitorada.");
        },

        _onRouteMatched: function (oEvent) {
            console.log("💰 Controller payment-page.js: _onRouteMatched - Rota acessada.");
            const oPaymentViewModel = this.getView().getModel("paymentView");
            const oMainModel = this.getOwnerComponent().getModel(); // Modelo OData principal

            const oNavArgsModel = this.getOwnerComponent().getModel("navArgs");
            const oNavData = oNavArgsModel.getData();
            console.log("💰 Controller payment-page.js: Dados recebidos via modelo 'navArgs':", JSON.stringify(oNavData));

            const sBuyNowProductId = oNavData.buyNowProductId; 

            if (sBuyNowProductId) { // FLUXO "COMPRAR AGORA"
                console.log("💰 Controller payment-page.js: Fluxo 'Comprar Agora' DETECTADO via navArgs. Produto ID:", sBuyNowProductId);
                oPaymentViewModel.setProperty("/isBuyNowFlow", true); // <<< DEFINE A FLAG COMO TRUE
                
                const fBuyNowProductPreco = parseFloat(oNavData.buyNowProductPreco);
                const iBuyNowProductQty = parseInt(oNavData.buyNowProductQty, 10);
                const sBuyNowProdutoNome = oNavData.buyNowProdutoNome;

                // Limpa o navArgs APÓS ler os dados para não interferir em futuras navegações
                oNavArgsModel.setData({}); 
                console.log("💰 Controller payment-page.js: Modelo 'navArgs' limpo.");

                const oItemUnico = {
                    produto_ID: sBuyNowProductId,
                    quantidade: iBuyNowProductQty,
                    precoUnitario: fBuyNowProductPreco,
                    produto: { // Simulando o $expand: "produto" que _carregarItensEFinalizarCalculo faz
                        ID: sBuyNowProductId,
                        nome: sBuyNowProdutoNome,
                        preco: fBuyNowProductPreco
                        // Adicione outros campos do produto se sua view de pagamento os mostrar
                    }
                };

                oPaymentViewModel.setProperty("/itens", [oItemUnico]);
                oPaymentViewModel.setProperty("/valorTotal", (fBuyNowProductPreco * iBuyNowProductQty).toFixed(2));
                oPaymentViewModel.setProperty("/itensNoCarrinho", true);

                // Lógica para buscar clienteID (vital para "Comprar Agora" também)
                // this.carrinhoID será usado para buscar o clienteID do carrinho principal do usuário
                this.carrinhoID = localStorage.getItem("carrinhoID"); 
                if (this.carrinhoID) {
                    const sCarrinhoPath = "/Carrinhos(ID=" + this.carrinhoID + ")"; 
                    console.log("💰 Controller payment-page.js: Buscando Carrinho (NÃO DRAFT) para clienteID (fluxo Comprar Agora):", sCarrinhoPath);
                    const oCarrinhoContextBinding = oMainModel.bindContext(sCarrinhoPath);
                    
                    oCarrinhoContextBinding.requestObject().then(oCarrinhoData => {
                        if (oCarrinhoData && oCarrinhoData.cliente_ID) {
                            oPaymentViewModel.setProperty("/clienteID", oCarrinhoData.cliente_ID);
                            console.log("💰 Controller payment-page.js: Cliente ID (via carrinho) para pagamento:", oCarrinhoData.cliente_ID);
                        } else {
                            console.warn("💰 Controller payment-page.js: Não foi possível obter clienteID via carrinho (cliente_ID nulo no carrinho ou carrinho não encontrado). Dados do carrinho:", JSON.stringify(oCarrinhoData));
                             MessageBox.error("Não foi possível obter os dados do cliente. Faça login ou certifique-se de que seu usuário tem um carrinho associado.", {
                                 onClose: () => this.getOwnerComponent().getRouter().navTo("RouteProdutos")
                             });
                        }
                    }).catch(oError => {
                         console.error("💰 Controller payment-page.js: Erro ao buscar clienteID do carrinho (fluxo Comprar Agora):", oError);
                         MessageBox.error("Erro ao obter dados do cliente. Tente novamente.");
                    });
                } else {
                     console.warn("💰 Controller payment-page.js: CarrinhoID não encontrado no localStorage para buscar clienteID (fluxo Comprar Agora).");
                     MessageBox.error("Carrinho não encontrado para obter dados do cliente. Adicione um item ao carrinho na tela de produtos ou faça login.", {
                         onClose: () => this.getOwnerComponent().getRouter().navTo("RouteProdutos")
                     });
                }

            } else { // FLUXO CARRINHO COMPLETO
                console.log("💰 Controller payment-page.js: Fluxo 'Comprar Agora' NÃO detectado via navArgs. Carregando carrinho completo.");
                oPaymentViewModel.setProperty("/isBuyNowFlow", false); // <<< DEFINE A FLAG COMO FALSE

                this.carrinhoID = localStorage.getItem("carrinhoID");
                if (!this.carrinhoID) {
                    MessageBox.warning("Seu carrinho para pagamento está vazio. Adicione produtos.", { 
                        onClose: () => this.getOwnerComponent().getRouter().navTo("RouteProdutos")
                    });
                    oPaymentViewModel.setProperty("/itensNoCarrinho", false);
                    oPaymentViewModel.setProperty("/valorTotal", "0.00");
                    oPaymentViewModel.setProperty("/itens", []); // Limpa os itens se o carrinho está vazio
                    return;
                }
        
                const sCarrinhoPath = "/Carrinhos(ID=" + this.carrinhoID + ")";
                console.log("💰 Controller payment-page.js: Buscando Carrinho (NÃO DRAFT) para clienteID (carrinho completo):", sCarrinhoPath);
                const oCarrinhoContextBinding = oMainModel.bindContext(sCarrinhoPath);
        
                oCarrinhoContextBinding.requestObject().then(oCarrinhoData => {
                    if (oCarrinhoData && oCarrinhoData.cliente_ID) {
                        oPaymentViewModel.setProperty("/clienteID", oCarrinhoData.cliente_ID);
                        console.log("💰 Cliente ID para pagamento (carrinho completo):", oCarrinhoData.cliente_ID);
                        this._carregarItensEFinalizarCalculo(this.carrinhoID);
                    } else {
                        MessageBox.error("Não foi possível obter os dados do cliente para este carrinho.", {
                            onClose: () => this.getOwnerComponent().getRouter().navTo("RouteCarrinho")
                        });
                        oPaymentViewModel.setProperty("/itensNoCarrinho", false); // Garante que não há itens se o clienteID falhar
                    }
                }).catch(oError => {
                    console.error("Erro ao buscar dados do Carrinho (completo):", oError);
                    MessageBox.error("Erro ao carregar dados do carrinho.");
                    oPaymentViewModel.setProperty("/itensNoCarrinho", false);
                    oPaymentViewModel.setProperty("/valorTotal", "0.00");
                    oPaymentViewModel.setProperty("/itens", []);
                });
            }
        },

        _carregarItensEFinalizarCalculo: function (sCarrinhoID) {
            const oMainModel = this.getOwnerComponent().getModel(); 
            const oPaymentViewModel = this.getView().getModel("paymentView");

            const oListBinding = oMainModel.bindList("/ItemCarrinho", undefined,
                undefined, 
                [new Filter("carrinho_ID", FilterOperator.EQ, sCarrinhoID)], 
                { $expand: "produto" } 
            );

            oListBinding.requestContexts().then(aContexts => {
                const aItens = aContexts.map(oContext => oContext.getObject());
                oPaymentViewModel.setProperty("/itens", aItens); 

                let totalCalculado = 0;
                if (aItens.length > 0) {
                    oPaymentViewModel.setProperty("/itensNoCarrinho", true);
                    aItens.forEach(item => {
                        totalCalculado += (parseFloat(item.precoUnitario) || 0) * (parseInt(item.quantidade, 10) || 0);
                    });
                } else {
                    oPaymentViewModel.setProperty("/itensNoCarrinho", false);
                }
                oPaymentViewModel.setProperty("/valorTotal", totalCalculado.toFixed(2));

                if (!oPaymentViewModel.getProperty("/itensNoCarrinho")) {
                    MessageBox.warning("Seu carrinho para pagamento está vazio. Adicione produtos.", {
                        onClose: () => {
                            this.getOwnerComponent().getRouter().navTo("RouteProdutos");
                        }
                    });
                }
            }).catch(oError => {
                console.error("Erro ao carregar itens do carrinho para pagamento:", oError);
                MessageBox.error("Não foi possível carregar os itens do seu carrinho.");
                oPaymentViewModel.setProperty("/itensNoCarrinho", false);
                oPaymentViewModel.setProperty("/valorTotal", "0.00");
            });
        },

        onFinalizarCompra: async function () {
            console.log("💰 Controller payment-page.js: onFinalizarCompra - Iniciando.");
            const oPaymentViewModel = this.getView().getModel("paymentView");
            // Não precisamos mais do navArgs aqui diretamente, vamos usar a flag do paymentViewModel
            
            const sTipoPagamento = this.byId("selectPayment").getSelectedKey();
            const sClienteID = oPaymentViewModel.getProperty("/clienteID");
            const oMainODataModel = this.getView().getModel(); // Modelo OData padrão
        
            // Suas Validações Essenciais
            if (!sTipoPagamento) { MessageBox.warning("Escolha uma forma de pagamento."); return; }
            if (!sClienteID) { 
                MessageBox.error("ID do cliente não está disponível. Não é possível finalizar o pedido."); 
                console.error("💰 Controller payment-page.js: ClienteID faltando para finalizar compra.");
                return; 
            }
            if (!oPaymentViewModel.getProperty("/itensNoCarrinho") || !oPaymentViewModel.getProperty("/itens") || oPaymentViewModel.getProperty("/itens").length === 0) {
                MessageBox.error("Não há itens para finalizar o pedido."); 
                console.error("💰 Controller payment-page.js: Nenhum item na view de pagamento para finalizar.");
                return;
            }
        
            // <<< USA A FLAG DO paymentViewModel PARA DECIDIR O FLUXO >>>
            const bIsBuyNowFlow = oPaymentViewModel.getProperty("/isBuyNowFlow"); 
            let oAction; 
        
            if (bIsBuyNowFlow) {
                console.log("💰 'Comprar Agora' (usando flag /isBuyNowFlow): Chamando ação 'realizarPagamentoItemUnico'.");
                const oItemUnico = oPaymentViewModel.getProperty("/itens")[0]; 
        
                oAction = oMainODataModel.bindContext("/realizarPagamentoItemUnico(...)");
                oAction.setParameter("clienteID", sClienteID);
                oAction.setParameter("tipoPagamento", sTipoPagamento);
                oAction.setParameter("produtoID", oItemUnico.produto.ID); 
                oAction.setParameter("quantidade", oItemUnico.quantidade);
                oAction.setParameter("precoUnitario", oItemUnico.precoUnitario);
                console.log("💰 Parâmetros para realizarPagamentoItemUnico:", {
                    clienteID: sClienteID, tipoPagamento: sTipoPagamento, produtoID: oItemUnico.produto.ID,
                    quantidade: oItemUnico.quantidade, precoUnitario: oItemUnico.precoUnitario
                });
        
            } else {
                console.log("💰 Carrinho Completo (usando flag /isBuyNowFlow): Chamando ação 'realizarPagamento'.");
                oAction = oMainODataModel.bindContext("/realizarPagamento(...)");
                oAction.setParameter("clienteID", sClienteID);
                oAction.setParameter("tipoPagamento", sTipoPagamento);
                console.log("💰 Parâmetros para realizarPagamento:", {
                    clienteID: sClienteID, tipoPagamento: sTipoPagamento
                });
            }
        
            try {
                console.log("💰 Executando ação OData...");
                const sPedidoID = await oAction.execute(); 
                console.log("💰 Ação OData executada. Pedido ID:", sPedidoID); 

                MessageToast.show("Pedido realizado com sucesso!" + (sPedidoID ? " ID: " + sPedidoID : ""));
        
                // Decide se remove o carrinhoID do localStorage baseado no fluxo
                if (!bIsBuyNowFlow) { 
                    console.log("💰 Finalização de Carrinho Completo: Removendo carrinhoID do localStorage.");
                    localStorage.removeItem("carrinhoID"); 
                    this.carrinhoID = null; 
                } else {
                    console.log("💰 Finalização de 'Comprar Agora': NÃO removemos o carrinhoID do localStorage.");
                }
                
                // Limpeza do ViewModel da Página de Pagamento
                oPaymentViewModel.setProperty("/itensNoCarrinho", false);
                oPaymentViewModel.setProperty("/itens", []);
                oPaymentViewModel.setProperty("/valorTotal", "0.00");
                oPaymentViewModel.setProperty("/clienteID", null); 
                oPaymentViewModel.setProperty("/isBuyNowFlow", false); // <<< RESETA A FLAG
        
                // O navArgs já foi limpo no _onRouteMatched quando era "Comprar Agora"
        
                this.getOwnerComponent().getRouter().navTo("Routehome-page");
        
            } catch (err) {
                const sErrorMessage = err.message || "Erro desconhecido.";
                MessageBox.error("Erro ao finalizar pedido: " + sErrorMessage);
                console.error("💰 Erro na execução da ação OData:", err);
                
                if (oAction && typeof oAction.resetChanges === 'function') {
                    oAction.resetChanges();
                }
            }
        },

        onPrintOrder: function () {
            // Seu código onPrintOrder original
            var oPaymentViewModel = this.getView().getModel("paymentView");
            var oPaymentViewData = oPaymentViewModel.getData();

            if (!oPaymentViewData || !oPaymentViewData.itens || oPaymentViewData.itens.length === 0) {
                MessageToast.show("Não há itens no pedido para imprimir.");
                return;
            }

            var sPrintContent = "<h1>Detalhes do Pedido</h1>";
            sPrintContent += "<p><strong>Data:</strong> " + new Date().toLocaleDateString() + "</p>";
            sPrintContent += "<p><strong>Hora:</strong> " + new Date().toLocaleTimeString() + "</p>";
            sPrintContent += "<h2>Itens:</h2>";
            sPrintContent += "<table border='1' style='width:100%; border-collapse: collapse;'>";
            sPrintContent += "<thead><tr><th>Produto</th><th>Preço Unitário</th><th>Quantidade</th><th>Total</th></tr></thead>";
            sPrintContent += "<tbody>";

            oPaymentViewData.itens.forEach(function (oItem) {
                var fItemTotal = (parseFloat(oItem.precoUnitario) || 0) * (parseInt(oItem.quantidade, 10) || 0);
                sPrintContent += "<tr>";
                sPrintContent += "<td>" + (oItem.produto ? oItem.produto.nome : "N/A") + "</td>"; // Verifica se oItem.produto existe
                sPrintContent += "<td>" + (parseFloat(oItem.precoUnitario) || 0).toFixed(2) + "</td>";
                sPrintContent += "<td>" + oItem.quantidade + "</td>";
                sPrintContent += "<td>" + fItemTotal.toFixed(2) + "</td>";
                sPrintContent += "</tr>";
            });

            sPrintContent += "</tbody></table>";
            sPrintContent += "<h3>Valor Total do Pedido: " + (parseFloat(oPaymentViewData.valorTotal) || 0).toFixed(2) + "</h3>";

            var printWindow = window.open('', '_blank');
            printWindow.document.write('<html><head><title>Imprimir Pedido</title>');
            printWindow.document.write('<style>');
            printWindow.document.write('body { font-family: Arial, sans-serif; margin: 20px; }');
            printWindow.document.write('h1, h2, h3 { color: #333; }');
            printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
            printWindow.document.write('th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }');
            printWindow.document.write('th { background-color: #f2f2f2; }');
            printWindow.document.write('</style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(sPrintContent);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.print();
        },

        onNavToCart: function () {
            this.getOwnerComponent().getRouter().navTo("RouteCarrinho");
        }
    });
});