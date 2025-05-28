sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",            
    "sap/ui/model/FilterOperator" 
], function (Controller, History, MessageToast, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("lojacap.controller.produtoDetalhe", {

        onInit: function () {
            console.log("🎮 Controller produtoDetalhe.js: onInit - Iniciando...");
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("produtoDetalhe").attachPatternMatched(this._onObjectMatched, this);
            console.log("🎮 Controller produtoDetalhe.js: onInit - Rota 'produtoDetalhe' monitorada.");
        },

        _onObjectMatched: function (oEvent) {
            var sProdutoId = oEvent.getParameter("arguments").produtoId;
            console.log("🎮 Controller produtoDetalhe.js: _onObjectMatched - ID do Produto recebido:", sProdutoId);

            // MUDANÇA FINAL (🤞): Adicionando IsActiveEntity=true para DRAFT!
            var sPath = "/Produtos(ID=" + sProdutoId + ",IsActiveEntity=true)"; 

            console.log("🎮 Controller produtoDetalhe.js: _onObjectMatched - Tentando fazer Binding com Path (DRAFT):", sPath);

            this.getView().bindElement({
                path: sPath, // Caminho atualizado
                events: {
                    dataRequested: function() {
                        console.log("📡 Controller produtoDetalhe.js: bindElement - Pedido de dados iniciado para:", sPath);
                    },
                    dataReceived: function(oDataEvent) {
                        var oData = oDataEvent ? oDataEvent.getParameter("data") : null;
                        console.log("✅ Controller produtoDetalhe.js: bindElement - Dados recebidos!", oData || "(Nenhum dado retornado ou evento nulo)");
                        if (oData) {
                            console.log("🎉 Controller produtoDetalhe.js: Dados do produto:", JSON.stringify(oData)); // Log extra para ver os dados!
                        } else {
                            console.error("🚨 Controller produtoDetalhe.js: NENHUM DADO RECEBIDO! Verifique o path e o serviço OData. Veja a aba Network (F12)!");
                        }
                    },
                    change: function() {
                         console.log("🔄️ Controller produtoDetalhe.js: bindElement - Binding alterado (dados provavelmente aplicados)!");
                    }
                }
            });
            console.log("🎮 Controller produtoDetalhe.js: _onObjectMatched - Chamada bindElement concluída.");
        },

        onNavBack: function () {
            console.log("🎮 Controller produtoDetalhe.js: onNavBack - Navegando para trás...");
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteProdutos", {}, true);
            }
        },

        onAddToCart: async function (oEvent) {
            console.log("🛒 Controller produtoDetalhe.js: onAddToCart - Iniciando...");

            // --- LÓGICA PARA OBTER CARRINHO ID (ASSUMINDO localStorage) ---
            // !!! ATENÇÃO: Verifique como o ID é realmente guardado no seu app!
            // !!! Pode ser que esteja em outro lugar (Component.js, etc.)
            var sCarrinhoID = localStorage.getItem("carrinhoID"); 

            if (!sCarrinhoID) {
                MessageToast.show("Erro: Carrinho não encontrado. Volte para a lista de produtos para inicializar.");
                console.error("🛒 Controller produtoDetalhe.js: ID do Carrinho não encontrado no localStorage.");
                return; // Para aqui se não achar o carrinho
            }
            console.log("🛒 Controller produtoDetalhe.js: Usando Carrinho ID:", sCarrinhoID);
            // --- FIM DA LÓGICA DO CARRINHO ID ---

            try {
                const oModel = this.getView().getModel(); // Modelo OData padrão
                const oContext = this.getView().getBindingContext(); // Contexto da view (já está no produto certo)

                if (!oContext) {
                    MessageToast.show("Erro: Não foi possível identificar o produto.");
                    console.error("🛒 Controller produtoDetalhe.js: Contexto do produto não encontrado na view.");
                    return;
                }

                const oProduto = oContext.getObject();
                console.log("🛒 Controller produtoDetalhe.js: Produto a adicionar:", oProduto.nome, "(ID:", oProduto.ID, ")");

                // Filtros para achar o ItemCarrinho (carrinho E produto)
                const oListBindingItems = oModel.bindList("/ItemCarrinho", undefined, undefined, [
                    new Filter("carrinho_ID", FilterOperator.EQ, sCarrinhoID),
                    new Filter("produto_ID", FilterOperator.EQ, oProduto.ID)
                ]);

                console.log("🛒 Controller produtoDetalhe.js: Verificando se item já existe...");

                // Pede o contexto (o item) para o backend
                oListBindingItems.requestContexts(0, 1).then(aContexts => {
                    if (aContexts.length > 0) {
                        // JÁ EXISTE: Atualiza a quantidade
                        const oItemContext = aContexts[0];
                        const oItemData = oItemContext.getObject();
                        const novaQuantidade = (oItemData.quantidade || 0) + 1; // Garante que começa com 0 se for nulo
                        
                        console.log("🛒 Controller produtoDetalhe.js: Item encontrado. Atualizando quantidade para", novaQuantidade);
                        oItemContext.setProperty("quantidade", novaQuantidade);
                        // NOTA: OData V4 pode precisar de model.submitBatch("$auto"); se não salvar sozinho.
                        
                        MessageToast.show(`Quantidade de produto atualizada para ${novaQuantidade}!`);

                    } else {
                        // NÃO EXISTE: Cria um novo item
                        console.log("🛒 Controller produtoDetalhe.js: Item não encontrado. Criando novo...");
                        const oNewCollectionBinding = oModel.bindList("/ItemCarrinho");
                        
                        oNewCollectionBinding.create({
                            carrinho_ID: sCarrinhoID,
                            produto_ID: oProduto.ID,
                            quantidade: 1,
                            precoUnitario: oProduto.preco // Usando o preço do produto
                        });
                        
                        MessageToast.show(`produto adicionado ao carrinho com sucesso!`);
                    }
                }).catch(err => {
                    MessageToast.show("Erro ao adicionar/verificar produto: " + err.message);
                    console.error("🛒 Controller produtoDetalhe.js: Erro no requestContexts:", err);
                });

            } catch (error) {
                MessageToast.show("Erro inesperado ao adicionar ao carrinho: " + error.message);
                console.error("🛒 Controller produtoDetalhe.js: Erro geral:", error);
            }
        },
        
        onBuyNow: async function () { // Mantemos async se você usar requestProperty, senão pode ser síncrono
            console.log("🛍️ Controller produtoDetalhe.js: onBuyNow - Iniciando compra imediata...");
            const oContext = this.getView().getBindingContext();
        
            if (!oContext) {
                MessageToast.show("Erro: Não foi possível identificar o produto.");
                console.error("🛍️ Controller produtoDetalhe.js: Contexto do produto não encontrado.");
                return;
            }
        
            // Usando a forma que funcionou para você pegar o nome e os outros dados
            const oProduto = oContext.getObject(); 
            let sProdutoNome = oProduto ? oProduto.nome : undefined;
            const oTitleControl = this.getView().byId("nomeProduto"); // Certifique-se do ID
        
            if (!sProdutoNome && oTitleControl) {
                sProdutoNome = oTitleControl.getText();
            }
            
            const sProdutoID = oProduto ? oProduto.ID : undefined;
            const fProdutoPreco = oProduto ? oProduto.preco : undefined;
        
            console.log("🛍️ Controller produtoDetalhe.js: Dados coletados para compra imediata - ID:", sProdutoID, "Nome:", sProdutoNome, "Preço:", fProdutoPreco);
        
            if (!sProdutoID || !sProdutoNome || fProdutoPreco === undefined) {
                MessageToast.show("Erro: Dados do produto incompletos para compra imediata.");
                console.error("🛍️ Controller produtoDetalhe.js: Dados incompletos. ID:", sProdutoID, "Nome:", sProdutoNome, "Preco:", fProdutoPreco);
                return;
            }
        
            // Coloca os dados no modelo 'navArgs'
            this.getOwnerComponent().getModel("navArgs").setData({
                buyNowProductId: sProdutoID,
                buyNowProductQty: 1,
                buyNowProductPreco: fProdutoPreco,
                buyNowProdutoNome: sProdutoNome
            });
            console.log("🛍️ Controller produtoDetalhe.js: Dados do produto único colocados no modelo 'navArgs'.");
        
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RoutePayment"); // Navega sem passar parâmetros aqui
            console.log("🛍️ Controller produtoDetalhe.js: Navegando para RoutePayment.");
        }

    });
});