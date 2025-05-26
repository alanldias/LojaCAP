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
            // 1. Modelo para os dados da view de pagamento (itens, total, clienteID)
            const oPaymentViewModel = new JSONModel({
                itens: [],
                valorTotal: "0.00",
                clienteID: null,      // Será buscado
                itensNoCarrinho: false // Para controlar se há itens
            });
            this.getView().setModel(oPaymentViewModel, "paymentView"); // Nome do modelo: "paymentView"

            // 2. Modelo para os tipos de pagamento (como você já tinha)
            const oEnumPagamento = new JSONModel([
                { key: "PIX", text: "PIX" },
                { key: "CARTAO", text: "Cartão" },
                { key: "BOLETO", text: "Boleto" }
            ]);
            this.getView().setModel(oEnumPagamento, "enum");

            // 3. Anexa uma função para ser chamada quando a rota "RoutePayment" for acessada
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RoutePayment").attachPatternMatched(this._onRouteMatched, this);
        },

        // Função chamada quando a rota é acessada
        _onRouteMatched: function () {
            this.carrinhoID = localStorage.getItem("carrinhoID"); // Pega o ID do carrinho
            const oPaymentViewModel = this.getView().getModel("paymentView");
            const oMainModel = this.getOwnerComponent().getModel(); // Seu modelo OData principal

            if (!this.carrinhoID) {
                MessageBox.error("Carrinho não encontrado. Você será redirecionado.", {
                    onClose: () => {
                        // Volta para a página de produtos ou home, pois não há carrinho para pagar
                        this.getOwnerComponent().getRouter().navTo("RouteProdutos");
                    }
                });
                oPaymentViewModel.setProperty("/itensNoCarrinho", false);
                oPaymentViewModel.setProperty("/valorTotal", "0.00");
                return;
            }

            // Passo A: Buscar o Carrinho para obter o cliente_ID
            const sCarrinhoPath = "/Carrinhos('" + this.carrinhoID + "')";

            const oCarrinhoContextBinding = oMainModel.bindContext(sCarrinhoPath);

            oCarrinhoContextBinding.requestObject().then(oCarrinhoData => {
                if (oCarrinhoData && oCarrinhoData.cliente_ID) {
                    oPaymentViewModel.setProperty("/clienteID", oCarrinhoData.cliente_ID);
                    console.log("Cliente ID para pagamento:", oCarrinhoData.cliente_ID);
                    // Passo B: Com o carrinhoID confirmado e clienteID obtido, carregar os itens
                    this._carregarItensEFinalizarCalculo(this.carrinhoID);
                } else {
                    MessageBox.error("Não foi possível obter os dados do cliente para este carrinho. Tente novamente.", {
                        onClose: () => {
                            this.getOwnerComponent().getRouter().navTo("RouteCarrinho"); // Volta para o carrinho
                        }
                    });
                    oPaymentViewModel.setProperty("/itensNoCarrinho", false);
                }
            }).catch(oError => {
                console.error("Erro ao buscar dados do Carrinho para pagamento:", oError);
                MessageBox.error("Erro ao carregar dados do carrinho. Verifique o console.", {
                    onClose: () => {
                        this.getOwnerComponent().getRouter().navTo("RouteCarrinho");
                    }
                });
                oPaymentViewModel.setProperty("/itensNoCarrinho", false);
                oPaymentViewModel.setProperty("/valorTotal", "0.00");
            });
        },

        // Função para carregar os itens do carrinho e calcular o total
        _carregarItensEFinalizarCalculo: function (sCarrinhoID) {
            const oMainModel = this.getOwnerComponent().getModel(); // Modelo OData
            const oPaymentViewModel = this.getView().getModel("paymentView");

            const oListBinding = oMainModel.bindList("/ItemCarrinho", undefined,
                undefined, // Sorters
                [new Filter("carrinho_ID", FilterOperator.EQ, sCarrinhoID)], // Filters
                { $expand: "produto" } // Parameters (para incluir dados do produto)
            );

            oListBinding.requestContexts().then(aContexts => {
                const aItens = aContexts.map(oContext => oContext.getObject());
                oPaymentViewModel.setProperty("/itens", aItens); // Atualiza o modelo da view com os itens

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

                // Se, após carregar, o carrinho estiver vazio, avisa e redireciona
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
            const sTipoPagamento = this.byId("selectPayment").getSelectedKey();
            const oPaymentViewModel = this.getView().getModel("paymentView");
            const sClienteID = oPaymentViewModel.getProperty("/clienteID");
            // O this.carrinhoID foi definido em _onRouteMatched

            if (!sTipoPagamento) {
                MessageBox.warning("Escolha uma forma de pagamento.");
                return;
            }

            if (!sClienteID) {
                MessageBox.error("ID do cliente não está disponível. Não é possível finalizar o pedido.");
                return;
            }

            if (!this.carrinhoID) {
                MessageBox.error("ID do Carrinho não está disponível. Não é possível finalizar o pedido.");
                return;
            }

            if (!oPaymentViewModel.getProperty("/itensNoCarrinho")) {
                MessageBox.error("Seu carrinho está vazio. Não é possível finalizar o pedido.");
                return;
            }

            const oMainODataModel = this.getOwnerComponent().getModel(); // Modelo OData principal

            const oAction = oMainODataModel.bindContext("/realizarPagamento(...)");

            oAction.setParameter("clienteID", sClienteID);
            oAction.setParameter("tipoPagamento", sTipoPagamento);

            try {
                await oAction.execute();

                MessageToast.show("Pedido realizado com sucesso!");

                // Limpa o carrinho do localStorage, pois o pedido foi feito
                localStorage.removeItem("carrinhoID");
                this.carrinhoID = null; // Limpa o ID no controller
                oPaymentViewModel.setProperty("/itensNoCarrinho", false); // Reseta o estado da view

                this.getOwnerComponent().getRouter().navTo("Routehome-page"); // Ou para uma página de "Pedido Confirmado"

            } catch (err) {
                MessageBox.error("Erro ao finalizar pedido: " + (err.message || "Erro desconhecido."));
                console.error("Erro na action realizarPagamento:", err);
                if (oAction && typeof oAction.resetChanges === 'function') {
                    oAction.resetChanges();
                }
            }
        },

        // FUNÇÃO PARA IMPRIMIR O PEDIDO 
        onPrintOrder: function () {
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
                // Aqui usamos item.produto.nome e item.precoUnitario, conforme o binding do seu XML e o retorno do OData
                var fItemTotal = (parseFloat(oItem.precoUnitario) || 0) * (parseInt(oItem.quantidade, 10) || 0);
                sPrintContent += "<tr>";
                sPrintContent += "<td>" + oItem.produto.nome + "</td>";
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

        // FUNÇÃO PARA VOLTAR AO CARRINHO (ADICIONAR AQUI)
        onNavToCart: function () {
            this.getOwnerComponent().getRouter().navTo("RouteCarrinho");
        }
    });
});