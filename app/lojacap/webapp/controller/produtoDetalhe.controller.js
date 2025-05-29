sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox"
], function (Controller, History, MessageToast, Filter, FilterOperator, JSONModel, MessageBox) {
    "use strict";

    return Controller.extend("lojacap.controller.produtoDetalhe", {

        onInit: function () {
            console.log("🎮 Controller produtoDetalhe.js: onInit");
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("produtoDetalhe").attachPatternMatched(this._onObjectMatched, this);

            const oRelatedProductsModel = new JSONModel({ itens: [] });
            this.getView().setModel(oRelatedProductsModel, "relatedProductsView");
            console.log("🎮 Controller produtoDetalhe.js: Modelo 'relatedProductsView' inicializado.");
        },

        _onObjectMatched: function (oEvent) {
            const sProdutoId = oEvent.getParameter("arguments").produtoId;
            this._sCurrentProductId = sProdutoId;
            console.log("🎮 Controller produtoDetalhe.js: _onObjectMatched - ID Produto Atual da Rota:", sProdutoId);

            const oView = this.getView();
            oView.getModel("relatedProductsView").setData({ itens: [] }); // Limpa modelo de relacionados
            console.log("🎮 Controller produtoDetalhe.js: Modelo 'relatedProductsView' resetado.");

            const sPath = "/Produtos(ID=" + sProdutoId + ",IsActiveEntity=true)";
            console.log("🎮 Controller produtoDetalhe.js: Configurando bindElement para path:", sPath);

            oView.bindElement({
                path: sPath,
                events: {
                    dataRequested: () => {
                        console.log("📡 Controller produtoDetalhe.js: bindElement (Produto Principal) - Pedido de dados iniciado para:", sPath);
                    },
                    dataReceived: (oDataEvent) => {
                        const oRawData = oDataEvent ? oDataEvent.getParameter("data") : null;
                        console.log("✅ Controller produtoDetalhe.js: bindElement (Produto Principal) - Evento dataReceived. Dados brutos da requisição:", JSON.stringify(oRawData));
                        // Continuamos confiando no 'change'
                    },
                    change: async () => { // Marcado como async
                        console.log("🔄️ Controller produtoDetalhe.js: bindElement (Produto Principal) - Evento 'change' disparado.");
                        const oContext = oView.getBindingContext();

                        if (oContext) {
                            console.log("✨ Controller produtoDetalhe.js (change): Contexto da view OBTIDO. Path:", oContext.getPath());
                            try {
                                const oProdutoPrincipal = await oContext.requestObject(); // Pede o objeto do contexto
                                console.log("🎉 Controller produtoDetalhe.js (change): Objeto do produto principal via oContext.requestObject():", JSON.stringify(oProdutoPrincipal));

                                if (oProdutoPrincipal && typeof oProdutoPrincipal.categoria === 'string' && oProdutoPrincipal.categoria.trim() !== "" && oProdutoPrincipal.ID) {
                                    console.log("🏷️ Controller produtoDetalhe.js (change): Categoria:", oProdutoPrincipal.categoria, "| ID:", oProdutoPrincipal.ID, "-> Chamando _loadRelatedProducts");
                                    this._loadRelatedProducts(oProdutoPrincipal.categoria, oProdutoPrincipal.ID);
                                } else {
                                    console.warn("⚠️ Controller produtoDetalhe.js (change): Categoria ou ID não encontrado no produto principal. Produto:", JSON.stringify(oProdutoPrincipal));
                                    oView.getModel("relatedProductsView").setProperty("/itens", []);
                                }
                            } catch (error) {
                                console.error("❌ Controller produtoDetalhe.js (change): Erro ao fazer oContext.requestObject():", error, JSON.stringify(error));
                                oView.getModel("relatedProductsView").setProperty("/itens", []);
                                MessageBox.error("Erro ao obter os dados detalhados do produto principal: " + error.message);
                            }
                        } else {
                            console.error("❌ Controller produtoDetalhe.js (change): Contexto da view (oView.getBindingContext()) é NULO.");
                            oView.getModel("relatedProductsView").setProperty("/itens", []);
                            MessageBox.error("Falha crítica: Não foi possível estabelecer o contexto de dados para o produto principal.");
                        }
                    }
                }
            });
            console.log("🎮 Controller produtoDetalhe.js: bindElement para produto principal configurado.");
        },

        _loadRelatedProducts: function (sCategoria, sProdutoAtualID) {
            console.log("🔍 Controller produtoDetalhe.js: _loadRelatedProducts - Categoria:", sCategoria, "Excluir ID:", sProdutoAtualID);
            const oView = this.getView();
            const oMainModel = oView.getModel();
            const oRelatedModelJson = oView.getModel("relatedProductsView");

            if (!sCategoria || !sProdutoAtualID) {
                console.warn("⚠️ Controller produtoDetalhe.js: _loadRelatedProducts - Parâmetros inválidos.");
                oRelatedModelJson.setProperty("/itens", []);
                return;
            }

            const aFilters = [
                new Filter("categoria", FilterOperator.EQ, sCategoria),
                new Filter("ID", FilterOperator.NE, sProdutoAtualID),
                new Filter("IsActiveEntity", FilterOperator.EQ, true)
            ];
            const iMaxRelated = 4;
            const sSelectFields = "ID,nome,preco,imagemURL,categoria"; // Campos que você precisa

            console.log("🔍 Controller produtoDetalhe.js: _loadRelatedProducts - Filtros:", JSON.stringify(aFilters.map(f => ({ path: f.sPath, op: f.sOperator, val1: f.oValue1 }))));

            // *** MUDANÇA PRINCIPAL AQUI ***
            // Remover o parâmetro de custom query options ($top, $select) do bindList,
            // e controlar o $select e o limite via parâmetros do requestContexts ou setParameter na lista.
            // O $select pode ser passado como um parâmetro no 'mParameters' do bindList.
            const oListBinding = oMainModel.bindList("/Produtos", undefined, [], aFilters, {
                 $select: sSelectFields // Tentar passar o $select aqui
            });

            console.log("⏳ Controller produtoDetalhe.js: _loadRelatedProducts - Solicitando produtos relacionados...");
            // Usar o parâmetro 'length' do requestContexts para limitar os resultados (equivalente ao $top)
            oListBinding.requestContexts(0, iMaxRelated).then(aContexts => {
                const aProdutosRelacionados = aContexts.map(context => context.getObject());
                console.log("✅ Controller produtoDetalhe.js: _loadRelatedProducts - Produtos relacionados RECEBIDOS (" + aProdutosRelacionados.length + ").");
                if (aProdutosRelacionados.length > 0) {
                    console.log("👍 Controller produtoDetalhe.js: _loadRelatedProducts - Definindo itens. Primeiro item:", JSON.stringify(aProdutosRelacionados[0]));
                } else {
                    console.log("🍃 Controller produtoDetalhe.js: _loadRelatedProducts - Nenhum produto relacionado encontrado.");
                }
                oRelatedModelJson.setProperty("/itens", aProdutosRelacionados);
            }).catch(oError => {
                // ESTE CATCH AGORA É O MAIS RELEVANTE PARA O ERRO "$top not supported" SE ELE VIER DAQUI
                console.error("❌ Controller produtoDetalhe.js: _loadRelatedProducts - ERRO ao buscar/processar produtos relacionados:", oError, JSON.stringify(oError));
                MessageBox.error("Erro ao carregar produtos sugeridos: " + (oError.message || "Verifique o console."));
                oRelatedModelJson.setProperty("/itens", []);
            });
        },

        // ... (onNavBack, onAddToCart, onBuyNow, onProdutoRelacionadoPress permanecem os mesmos)
        onNavBack: function () {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteProdutos", {}, true);
            }
        },

        onAddToCart: async function () {
            const oContext = this.getView().getBindingContext();
            if (!oContext) { MessageToast.show("Produto não carregado."); return; }
            const oProduto = await oContext.requestObject();
            if (!oProduto || !oProduto.ID) { MessageToast.show("Dados do produto incompletos."); console.error("🛒 addCart: oProduto ou ID nulo", oProduto); return; }

            const sCarrinhoID = localStorage.getItem("carrinhoID");
            if (!sCarrinhoID) { MessageToast.show("Erro: Carrinho não encontrado."); return; }

            const oModel = this.getView().getModel();
            const oListBindingItems = oModel.bindList("/ItemCarrinho", undefined, undefined, [
                new Filter("carrinho_ID", FilterOperator.EQ, sCarrinhoID),
                new Filter("produto_ID", FilterOperator.EQ, oProduto.ID)
            ]);
            oListBindingItems.requestContexts(0, 1).then(aContexts => {
                if (aContexts.length > 0) {
                    const oItemContext = aContexts[0];
                    const oItemData = oItemContext.getObject();
                    const novaQuantidade = (oItemData.quantidade || 0) + 1;
                    oItemContext.setProperty("quantidade", novaQuantidade);
                    MessageToast.show(`Quantidade de ${oProduto.nome} atualizada para ${novaQuantidade}!`);
                } else {
                    const oNewCollectionBinding = oModel.bindList("/ItemCarrinho");
                    oNewCollectionBinding.create({
                        carrinho_ID: sCarrinhoID,
                        produto_ID: oProduto.ID,
                        quantidade: 1,
                        precoUnitario: oProduto.preco
                    });
                    MessageToast.show(`${oProduto.nome} adicionado ao carrinho!`);
                }
            }).catch(err => {
                MessageToast.show("Erro ao adicionar produto: " + err.message);
                console.error("Erro ao adicionar/atualizar item no carrinho:", err);
            });
        },

        onBuyNow: async function () {
            const oContext = this.getView().getBindingContext();
            if (!oContext) { MessageToast.show("Produto não carregado."); return; }
            const oProduto = await oContext.requestObject();
            if (!oProduto || !oProduto.ID) { MessageToast.show("Dados do produto incompletos."); console.error("🛍️ buyNow: oProduto ou ID nulo", oProduto); return; }

            const sProdutoNome = oProduto.nome;
            const sProdutoID = oProduto.ID;
            const fProdutoPreco = oProduto.preco;

            if (!sProdutoID || typeof sProdutoNome === 'undefined' || typeof fProdutoPreco === 'undefined') {
                MessageToast.show("Erro: Dados do produto incompletos para compra."); return;
            }
            this.getOwnerComponent().getModel("navArgs").setData({
                buyNowProductId: sProdutoID, buyNowProductQty: 1, buyNowProductPreco: fProdutoPreco, buyNowProdutoNome: sProdutoNome
            });
            this.getOwnerComponent().getRouter().navTo("RoutePayment");
        },

        onProdutoRelacionadoPress: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("relatedProductsView");
            if (oContext) {
                const sProdutoId = oContext.getProperty("ID");
                console.log("🖱️ Controller produtoDetalhe.js: onProdutoRelacionadoPress - Navegando para ID:", sProdutoId);
                this.getOwnerComponent().getRouter().navTo("produtoDetalhe", { produtoId: sProdutoId });
            } else {
                MessageToast.show("Não foi possível navegar para este produto.");
                console.error("❌ Controller produtoDetalhe.js: onProdutoRelacionadoPress - Contexto não encontrado.");
            }
        }

    });
});