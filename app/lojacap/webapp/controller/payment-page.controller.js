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
                isBuyNowFlow: false    // Flag para diferenciar os fluxos
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

            // Resetar a view model para evitar dados de navegações anteriores no mesmo view instance
            oPaymentViewModel.setProperty("/itens", []);
            oPaymentViewModel.setProperty("/valorTotal", "0.00");
            oPaymentViewModel.setProperty("/clienteID", null);
            oPaymentViewModel.setProperty("/itensNoCarrinho", false);
            oPaymentViewModel.setProperty("/isBuyNowFlow", false); // Reset da flag
            console.log("💰 Controller payment-page.js: paymentViewModel resetado para nova entrada na rota.");


            const oNavArgsModel = this.getOwnerComponent().getModel("navArgs");
            const oNavData = oNavArgsModel.getData();
            console.log("💰 Controller payment-page.js: Dados recebidos via modelo 'navArgs':", JSON.stringify(oNavData));

            const sBuyNowProductId = oNavData.buyNowProductId;

            if (sBuyNowProductId) { // FLUXO "COMPRAR AGORA"
                console.log("💰 Controller payment-page.js: Fluxo 'Comprar Agora' DETECTADO. Produto ID:", sBuyNowProductId);
                oPaymentViewModel.setProperty("/isBuyNowFlow", true);

                const fBuyNowProductPreco = parseFloat(oNavData.buyNowProductPreco);
                const iBuyNowProductQty = parseInt(oNavData.buyNowProductQty, 10);
                const sBuyNowProdutoNome = oNavData.buyNowProdutoNome;

                // Limpa o navArgs APÓS ler os dados
                oNavArgsModel.setData({});
                console.log("💰 Controller payment-page.js: Modelo 'navArgs' limpo.");

                const oItemUnico = {
                    produto_ID: sBuyNowProductId,
                    quantidade: iBuyNowProductQty,
                    precoUnitario: fBuyNowProductPreco,
                    produto: {
                        ID: sBuyNowProductId,
                        nome: sBuyNowProdutoNome,
                        preco: fBuyNowProductPreco
                    }
                };

                oPaymentViewModel.setProperty("/itens", [oItemUnico]);
                oPaymentViewModel.setProperty("/valorTotal", (fBuyNowProductPreco * iBuyNowProductQty).toFixed(2));
                oPaymentViewModel.setProperty("/itensNoCarrinho", true); // Há um item para pagar

                // ### INÍCIO DA MUDANÇA CRÍTICA PARA "COMPRAR AGORA" ###
                // No fluxo "Comprar Agora", o clienteID DEVE vir diretamente dos dados do usuário logado (localStorage).
                const sClienteIDLogado = localStorage.getItem("clienteID");
                console.log("💰 Controller payment-page.js (Comprar Agora): Tentando obter clienteID do localStorage. Valor:", sClienteIDLogado);

                if (sClienteIDLogado) {
                    oPaymentViewModel.setProperty("/clienteID", sClienteIDLogado);
                    console.log("💰 Controller payment-page.js (Comprar Agora): Cliente ID (localStorage) definido para pagamento:", sClienteIDLogado);
                } else {
                    // Se não há clienteID no localStorage, o usuário não está logado ou houve um problema no login.
                    console.error("💰 Controller payment-page.js (Comprar Agora): CRÍTICO - clienteID não encontrado no localStorage. O usuário não está devidamente logado.");
                    MessageBox.error("Seus dados de login não foram encontrados. Por favor, faça login novamente para continuar.", {
                        onClose: () => this.getOwnerComponent().getRouter().navTo("RouteLogin") // Redireciona para o login
                    });
                    // Interrompe o fluxo aqui, pois sem clienteID não podemos prosseguir
                    return;
                }
                // ### FIM DA MUDANÇA CRÍTICA PARA "COMPRAR AGORA" ###

            } else { // FLUXO CARRINHO COMPLETO
                console.log("💰 Controller payment-page.js: Fluxo 'Carrinho Completo' detectado.");
                oPaymentViewModel.setProperty("/isBuyNowFlow", false);

                this.carrinhoID = localStorage.getItem("carrinhoID"); // Usa o carrinhoID da sessão
                if (!this.carrinhoID) {
                    console.warn("💰 Controller payment-page.js (Carrinho Completo): Nenhum carrinhoID no localStorage.");
                    MessageBox.warning("Seu carrinho para pagamento está vazio ou não foi encontrado. Adicione produtos ao carrinho.", {
                        onClose: () => this.getOwnerComponent().getRouter().navTo("RouteProdutos")
                    });
                    // Garante que a view reflita o estado de carrinho vazio
                    oPaymentViewModel.setProperty("/itensNoCarrinho", false);
                    oPaymentViewModel.setProperty("/valorTotal", "0.00");
                    oPaymentViewModel.setProperty("/itens", []);
                    return; // Interrompe se não há carrinho para carregar
                }

                const sCarrinhoPath = "/Carrinhos(ID=" + this.carrinhoID + ")";
                console.log("💰 Controller payment-page.js (Carrinho Completo): Buscando Carrinho para obter cliente_ID e itens. Path:", sCarrinhoPath);
                const oCarrinhoContextBinding = oMainModel.bindContext(sCarrinhoPath);

                oCarrinhoContextBinding.requestObject().then(oCarrinhoData => {
                    console.log("💰 Controller payment-page.js (Carrinho Completo): Dados do carrinho recebidos:", JSON.stringify(oCarrinhoData));
                    if (oCarrinhoData && oCarrinhoData.cliente_ID) {
                        oPaymentViewModel.setProperty("/clienteID", oCarrinhoData.cliente_ID);
                        console.log("💰 Controller payment-page.js (Carrinho Completo): Cliente ID (via carrinho) definido:", oCarrinhoData.cliente_ID);
                        this._carregarItensEFinalizarCalculo(this.carrinhoID); // Carrega os itens do carrinho
                    } else {
                        // Este é o cenário que causa o erro se o carrinhoID for de um carrinho anônimo sem cliente
                        console.warn("💰 Controller payment-page.js (Carrinho Completo): Não foi possível obter cliente_ID do carrinho. Dados:", JSON.stringify(oCarrinhoData));
                        MessageBox.error("Não foi possível obter os dados do cliente para este carrinho. Verifique se o carrinho está correto ou faça login.", {
                            onClose: () => this.getOwnerComponent().getRouter().navTo("RouteProdutos") // Ou RouteCarrinho
                        });
                        oPaymentViewModel.setProperty("/itensNoCarrinho", false);
                    }
                }).catch(oError => {
                    console.error("💰 Controller payment-page.js (Carrinho Completo): Erro ao buscar dados do Carrinho:", oError);
                    MessageBox.error("Erro ao carregar dados do carrinho. Tente novamente.");
                    oPaymentViewModel.setProperty("/itensNoCarrinho", false);
                    oPaymentViewModel.setProperty("/valorTotal", "0.00");
                    oPaymentViewModel.setProperty("/itens", []);
                });
            }
        },

        _carregarItensEFinalizarCalculo: function (sCarrinhoID) {
            console.log("💰 Controller payment-page.js: _carregarItensEFinalizarCalculo - Iniciando para carrinhoID:", sCarrinhoID);
            const oMainModel = this.getOwnerComponent().getModel();
            const oPaymentViewModel = this.getView().getModel("paymentView");

            // Busca os itens do carrinho especificado, expandindo os dados do produto
            const oListBinding = oMainModel.bindList("/ItemCarrinho", undefined,
                undefined,
                [new Filter("carrinho_ID", FilterOperator.EQ, sCarrinhoID)],
                { $expand: "produto" }
            );

            oListBinding.requestContexts().then(aContexts => {
                const aItens = aContexts.map(oContext => oContext.getObject());
                console.log("💰 Controller payment-page.js: _carregarItensEFinalizarCalculo - Itens do carrinho carregados:", JSON.stringify(aItens));
                oPaymentViewModel.setProperty("/itens", aItens);

                let totalCalculado = 0;
                if (aItens.length > 0) {
                    oPaymentViewModel.setProperty("/itensNoCarrinho", true);
                    aItens.forEach(item => {
                        // Garante que precoUnitario e quantidade são válidos para o cálculo
                        const preco = parseFloat(item.produto?.preco || item.precoUnitario || 0); // Prioriza o preço do produto expandido
                        const qtd = parseInt(item.quantidade, 10) || 0;
                        totalCalculado += preco * qtd;
                    });
                    console.log("💰 Controller payment-page.js: _carregarItensEFinalizarCalculo - Total calculado:", totalCalculado);
                } else {
                    console.log("💰 Controller payment-page.js: _carregarItensEFinalizarCalculo - Nenhum item encontrado para o carrinhoID:", sCarrinhoID);
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
                console.error("💰 Controller payment-page.js: _carregarItensEFinalizarCalculo - Erro ao carregar itens:", oError);
                MessageBox.error("Não foi possível carregar os itens do seu carrinho para pagamento.");
                oPaymentViewModel.setProperty("/itensNoCarrinho", false);
                oPaymentViewModel.setProperty("/valorTotal", "0.00");
                oPaymentViewModel.setProperty("/itens", []);
            });
        },

        onFinalizarCompra: async function () {
            console.log("💰 Controller payment-page.js: onFinalizarCompra - Iniciando.");
            const oPaymentViewModel = this.getView().getModel("paymentView");

            const sTipoPagamento = this.byId("selectPayment").getSelectedKey(); // Supondo que o ID do seu Select é "selectPayment"
            const sClienteID = oPaymentViewModel.getProperty("/clienteID");
            const oMainODataModel = this.getView().getModel();

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

            const bIsBuyNowFlow = oPaymentViewModel.getProperty("/isBuyNowFlow");
            let oAction;
            let sActionPath; // Para log

            if (bIsBuyNowFlow) {
                sActionPath = "/realizarPagamentoItemUnico(...)";
                console.log("💰 Controller payment-page.js (Finalizar Compra - Comprar Agora): Chamando ação 'realizarPagamentoItemUnico'.");
                const oItemUnico = oPaymentViewModel.getProperty("/itens")[0];

                oAction = oMainODataModel.bindContext(sActionPath);
                oAction.setParameter("clienteID", sClienteID);
                oAction.setParameter("tipoPagamento", sTipoPagamento);
                oAction.setParameter("produtoID", oItemUnico.produto.ID); // ID do produto
                oAction.setParameter("quantidade", oItemUnico.quantidade); // Quantidade
                // Sua ação 'realizarPagamentoItemUnico' parece esperar 'precoUnitario' também.
                // Se o preço já está no produto, você pode buscá-lo ou passar como está.
                // Se sua action recalcula o preço no backend baseado no produtoID, talvez não precise enviar.
                // Vou manter como no seu código original.
                oAction.setParameter("precoUnitario", oItemUnico.precoUnitario);

                console.log("💰 Controller payment-page.js: Parâmetros para realizarPagamentoItemUnico:", {
                    clienteID: sClienteID, tipoPagamento: sTipoPagamento, produtoID: oItemUnico.produto.ID,
                    quantidade: oItemUnico.quantidade, precoUnitario: oItemUnico.precoUnitario
                });

            } else { // Fluxo Carrinho Completo
                sActionPath = "/realizarPagamento(...)";
                console.log("💰 Controller payment-page.js (Finalizar Compra - Carrinho): Chamando ação 'realizarPagamento'.");
                oAction = oMainODataModel.bindContext(sActionPath);
                // A ação 'realizarPagamento' no seu código original espera 'clienteID'.
                // Se o carrinhoID também for necessário no backend para identificar os itens,
                // sua action precisa lidar com isso a partir do clienteID ou você precisaria enviar carrinhoID também.
                // Mantendo como no seu código:
                oAction.setParameter("clienteID", sClienteID);
                oAction.setParameter("tipoPagamento", sTipoPagamento);
                // Se a action precisar do carrinhoID para identificar os itens do carrinho específico daquele cliente:
                // oAction.setParameter("carrinhoID", this.carrinhoID); // this.carrinhoID foi definido no _onRouteMatched para este fluxo

                console.log("💰 Controller payment-page.js: Parâmetros para realizarPagamento:", {
                    clienteID: sClienteID, tipoPagamento: sTipoPagamento
                    // carrinhoID: this.carrinhoID // Adicione se necessário
                });
            }

            MessageToast.show("Processando seu pedido...");

            try {
                console.log("💰 Controller payment-page.js: Executando ação OData:", sActionPath);
                // O resultado da action (sPedidoID) depende de como sua action OData V4 retorna o valor.
                // Se for um tipo complexo, é oActionResult.getObject().<propriedade>.
                // Se for um tipo primitivo diretamente, pode ser oActionResult.getProperty("value") ou similar.
                // Seu código original esperava o ID diretamente.
                const oActionResult = await oAction.execute();
                let sPedidoID;

                // Tentativa de obter o PedidoID da resposta da Action
                if (oActionResult) {
                    if (typeof oActionResult.getObject === "function" && oActionResult.getObject() && oActionResult.getObject().pedidoID) {
                        sPedidoID = oActionResult.getObject().pedidoID;
                         console.log("💰 Controller payment-page.js: Pedido ID obtido de getObject().pedidoID:", sPedidoID);
                    } else if (oActionResult.getProperty && typeof oActionResult.getProperty("value") === 'string') { // Se a action retorna uma string simples
                        sPedidoID = oActionResult.getProperty("value");
                         console.log("💰 Controller payment-page.js: Pedido ID obtido de getProperty('value') (string):", sPedidoID);
                    } else if (oActionResult.getProperty && typeof oActionResult.getProperty("value") === 'object' && oActionResult.getProperty("value")?.pedidoID) { // Se value é um objeto
                        sPedidoID = oActionResult.getProperty("value").pedidoID;
                        console.log("💰 Controller payment-page.js: Pedido ID obtido de getProperty('value').pedidoID (objeto):", sPedidoID);
                    } else {
                        console.warn("💰 Controller payment-page.js: Formato de resposta da action não reconhecido para PedidoID. Resposta completa:", JSON.stringify(oActionResult.getObject ? oActionResult.getObject() : oActionResult));
                    }
                } else {
                     console.warn("💰 Controller payment-page.js: Ação OData não retornou resultado (oActionResult é nulo/undefined).");
                }


                if (sPedidoID) {
                    MessageToast.show("Pedido realizado com sucesso! ID: " + sPedidoID);
                } else {
                    MessageToast.show("Pedido processado! (ID do pedido não recuperado da resposta).");
                    console.warn("💰 Controller payment-page.js: Pedido processado, mas ID do pedido não foi claramente extraído da resposta da action.");
                }


                if (!bIsBuyNowFlow) {
                    console.log("💰 Controller payment-page.js: Finalização de Carrinho Completo: Removendo carrinhoID do localStorage.");
                    localStorage.removeItem("carrinhoID");
                    this.carrinhoID = null; // Limpa a propriedade do controller também
                } else {
                    console.log("💰 Controller payment-page.js: Finalização de 'Comprar Agora': carrinhoID do localStorage não é removido aqui.");
                }

                // Limpeza do ViewModel da Página de Pagamento após sucesso
                oPaymentViewModel.setProperty("/itensNoCarrinho", false);
                oPaymentViewModel.setProperty("/itens", []);
                oPaymentViewModel.setProperty("/valorTotal", "0.00");
                oPaymentViewModel.setProperty("/clienteID", null);
                oPaymentViewModel.setProperty("/isBuyNowFlow", false); // Reseta a flag

                this.getOwnerComponent().getRouter().navTo("Routehome-page"); // Navega para a home

            } catch (err) {
                const sErrorMessage = err.message || "Erro desconhecido ao processar o pedido.";
                MessageBox.error("Erro ao finalizar pedido: " + sErrorMessage);
                console.error("💰 Controller payment-page.js: Erro na execução da ação OData:", err, JSON.stringify(err));

                if (oAction && typeof oAction.resetChanges === 'function') {
                    oAction.resetChanges();
                }
            }
        },

        onPrintOrder: function () {
            console.log("💰 Controller payment-page.js: onPrintOrder chamado.");
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
                const precoUnit = parseFloat(oItem.produto?.preco || oItem.precoUnitario || 0);
                const qtd = parseInt(oItem.quantidade, 10) || 0;
                var fItemTotal = precoUnit * qtd;
                sPrintContent += "<tr>";
                sPrintContent += "<td>" + (oItem.produto ? oItem.produto.nome : "N/A") + "</td>";
                sPrintContent += "<td>" + precoUnit.toFixed(2) + "</td>";
                sPrintContent += "<td>" + qtd + "</td>";
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
            console.log("💰 Controller payment-page.js: Navegando para RouteCarrinho.");
            this.getOwnerComponent().getRouter().navTo("RouteCarrinho");
        }
    });
});