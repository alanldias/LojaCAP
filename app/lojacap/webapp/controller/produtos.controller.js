sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/routing/History",    // Esta é a 5ª dependência
    "sap/ui/model/json/JSONModel"  // Esta é a 6ª dependência
], function (Controller, MessageToast, Filter, FilterOperator, History, JSONModel) { // <<< --- CORREÇÃO: History e JSONModel adicionados aqui
    "use strict";

    return Controller.extend("lojacap.controller.produtos", {
        _carrinhoInitializedPromise: null,
        carrinhoID: null,
        oHeaderModel: null,

        onInit: function () {
            this.oHeaderModel = new JSONModel({ // Agora JSONModel está definido
                isLoggedIn: false,
                userName: "",
                loginButtonVisible: true,
                logoutButtonVisible: false,
                welcomeTextVisible: false
            });
            this.getView().setModel(this.oHeaderModel, "headerModel");

            // Sua lógica de inicialização do carrinho existente
            // (Removido _initializeCarrinhoLogic() direto daqui para ser chamado por _onProdutosRouteMatched ou uma vez no final do onInit se a rota não for encontrada)


            const oRouter = this.getOwnerComponent().getRouter();
            // IMPORTANTE: Substitua "RouteProdutos" pelo NOME REAL da rota que leva a esta view de produtos.
            // Você estava usando "Routehome-page" aqui antes, o que provavelmente estava errado para o controller de produtos.
            const oRoute = oRouter.getRoute("RouteProdutos");
            if (oRoute) {
                oRoute.attachPatternMatched(this._onProdutosRouteMatched, this);
            } else {
                console.warn("Produtos Controller: Rota 'RouteProdutos' (ou a rota específica desta view) não encontrada para attachPatternMatched. A lógica de inicialização e atualização do header pode não funcionar como esperado na navegação.");
                // Chamar uma vez no onInit como fallback se a rota não for encontrada ou para o primeiro carregamento
                this._updateHeaderState(); // Atualiza o header
                this._initializeCarrinhoLogic(); // Inicializa o carrinho
            }
        },

        _updateHeaderState: function () {
            const isLoggedIn = localStorage.getItem("logado") === "true";
            let userName = localStorage.getItem("userName");

            if (userName === null || userName === undefined || userName === "undefined" || userName.trim() === "") {
                userName = "";
            }

            if (this.oHeaderModel) {
                this.oHeaderModel.setData({
                    isLoggedIn: isLoggedIn,
                    userName: userName,
                    loginButtonVisible: !isLoggedIn,
                    logoutButtonVisible: isLoggedIn,
                    welcomeTextVisible: isLoggedIn && !!userName
                });
                console.log("produtos.controller: headerModel atualizado:", this.oHeaderModel.getData());
            } else {
                console.error("produtos.controller: oHeaderModel não está inicializado ao tentar _updateHeaderState.");
            }
        },

        _onProdutosRouteMatched: function (oEvent) { // oEvent é passado automaticamente
            console.log("[Produtos Controller] _onProdutosRouteMatched foi acionado.");
            this._updateHeaderState(); // Atualiza o estado do header sempre que a rota é acessada

            // Sua lógica de verificação e re-inicialização do carrinho
            const sCurrentLocalStorageCarrinhoID = localStorage.getItem("carrinhoID");
            if (this.carrinhoID !== sCurrentLocalStorageCarrinhoID || !this._carrinhoInitializedPromise) {
                console.log("[Produtos Controller] Discrepância de CarrinhoID ou promise não inicializada. Re-inicializando o carrinho.");
                this._initializeCarrinhoLogic();
            } else {
                console.log("[Produtos Controller] CarrinhoID (" + this.carrinhoID + ") e promise de inicialização parecem consistentes com o localStorage. Não haverá re-inicialização forçada.");
            }
        },

        _initializeCarrinhoLogic: function () {
            this._carrinhoInitializedPromise = new Promise((resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel();

                if (!oModel || typeof oModel.bindContext !== "function") {
                    console.error("❌ Produtos Controller: Modelo OData V4 não encontrado ou inválido em _initializeCarrinhoLogic.");
                    reject(new Error("Modelo principal não pôde ser carregado ou é inválido."));
                    return;
                }

                let localCarrinhoID = localStorage.getItem("carrinhoID");
                this.carrinhoID = localCarrinhoID;

                console.log("[Produtos _initializeCarrinhoLogic] Iniciando. localStorage carrinhoID:", localCarrinhoID);

                if (localCarrinhoID) {
                    const sPath = "/Carrinhos('" + localCarrinhoID + "')";
                    const oContextBinding = oModel.bindContext(sPath);

                    oContextBinding.requestObject().then(oData => {
                        if (oData) {
                            const isLoggedIn = localStorage.getItem("logado") === "true";
                            if (oData.cliente_ID && !isLoggedIn) {
                                console.warn("Produtos Controller: Carrinho do localStorage (" + localCarrinhoID + ") pertence a um cliente, mas usuário atual está anônimo. Gerando novo carrinho.");
                                this._createAnonymousCartInBackend(oModel, resolve, reject);
                            } else {
                                console.log("Produtos Controller: Usando carrinho existente (" + localCarrinhoID + ") do localStorage. Detalhes do carrinho:", oData);
                                resolve(localCarrinhoID);
                            }
                        } else {
                            console.log("Produtos Controller: Carrinho do localStorage (" + localCarrinhoID + ") não encontrado no backend. Criando novo.");
                            this._createAnonymousCartInBackend(oModel, resolve, reject);
                        }
                    }).catch(oError => {
                        console.warn("Produtos Controller: Erro ao tentar buscar carrinho (" + localCarrinhoID + ") via requestObject. Criando novo.", oError.message);
                        this._createAnonymousCartInBackend(oModel, resolve, reject);
                    });
                } else {
                    console.log("Produtos Controller: Nenhum carrinhoID no localStorage. Criando novo carrinho anônimo.");
                    this._createAnonymousCartInBackend(oModel, resolve, reject);
                }
            });

            this._carrinhoInitializedPromise.catch(err => {
                if (err && !err.customHandled) {
                    console.error("❌ Produtos Controller: Erro GERAL na _carrinhoInitializedPromise (não tratado internamente):", err);
                    MessageToast.show("Falha crítica na inicialização do carrinho.");
                }
            });
        },

        _gerarUUID: function () {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0,
                    v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        _createAnonymousCartInBackend: function (oModel, resolve, reject) {
            const newCarrinhoID = this._gerarUUID();
            console.log("[Produtos _createAnonymousCartInBackend] Tentando criar novo carrinho anônimo com ID:", newCarrinhoID);

            if (!oModel || typeof oModel.bindList !== 'function') {
                console.error("❌ Produtos Controller: Modelo OData V4 (ou bindList) não disponível em _createAnonymousCartInBackend.");
                reject({ message: "Modelo OData V4 não disponível para criar carrinho.", customHandled: true });
                return;
            }

            const oListBinding = oModel.bindList("/Carrinhos");
            const oPayload = { ID: newCarrinhoID };
            const oContext = oListBinding.create(oPayload);

            oContext.created().then(() => {
                console.log("✅ Produtos Controller: Carrinho anônimo CRIADO no backend com ID:", newCarrinhoID);
                localStorage.setItem("carrinhoID", newCarrinhoID);
                this.carrinhoID = newCarrinhoID;
                resolve(newCarrinhoID);
            }).catch((oError) => {
                console.error("❌ Produtos Controller: ERRO ao confirmar criação de carrinho (" + newCarrinhoID + ") no backend:", oError.message);
                if (localStorage.getItem("carrinhoID") === newCarrinhoID) {
                    localStorage.removeItem("carrinhoID");
                }
                this.carrinhoID = null;
                MessageToast.show("Erro ao criar novo carrinho no servidor: " + (oError.message || "Erro desconhecido"));
                reject({ message: oError.message || "Erro ao criar carrinho", originalError: oError, customHandled: true });
            });
        },

        onComprar: async function (oEvent) {
            try {
                const sCarrinhoID = await this._carrinhoInitializedPromise;
                if (!sCarrinhoID) {
                    MessageToast.show("Carrinho não inicializado para compra! Tente recarregar.");
                    return;
                }
                const oModel = this.getOwnerComponent().getModel();
                const oProduto = oEvent.getSource().getBindingContext().getObject();
                const oListBindingItems = oModel.bindList("/ItemCarrinho", undefined, undefined, [
                    new Filter("carrinho_ID", FilterOperator.EQ, sCarrinhoID),
                    new Filter("produto_ID", FilterOperator.EQ, oProduto.ID)
                ]);
                oListBindingItems.requestContexts(0, 1).then(aContexts => {
                    if (aContexts.length > 0) {
                        const oItemContext = aContexts[0];
                        const oItemData = oItemContext.getObject();
                        oItemContext.setProperty("quantidade", oItemData.quantidade + 1);
                        MessageToast.show("Quantidade atualizada no carrinho!");
                    } else {
                        const oNewCollectionBinding = oModel.bindList("/ItemCarrinho");
                        oNewCollectionBinding.create({
                            carrinho_ID: sCarrinhoID,
                            produto_ID: oProduto.ID,
                            quantidade: 1,
                            precoUnitario: oProduto.preco
                        });
                        MessageToast.show("Produto adicionado ao carrinho!");
                    }
                }).catch(err => {
                    MessageToast.show("Erro ao adicionar produto ao carrinho: " + err.message);
                });
            } catch (error) {
                MessageToast.show("Erro ao processar compra (carrinho não pronto): " + (error.message || "Erro desconhecido"));
                console.error("Erro em onComprar, capturado pela promise _carrinhoInitializedPromise:", error);
            }
        },

        onIrParaCarrinho: async function () {
            try {
                const sCarrinhoIDPromise = await this._carrinhoInitializedPromise;
                const sCarrinhoIDLocalStorage = localStorage.getItem("carrinhoID");
                console.log(`[Produtos onIrParaCarrinho] ID da Promise: ${sCarrinhoIDPromise}, ID do LocalStorage ATUAL: ${sCarrinhoIDLocalStorage}`);

                if (sCarrinhoIDPromise && sCarrinhoIDLocalStorage && sCarrinhoIDPromise === sCarrinhoIDLocalStorage) {
                    this.getOwnerComponent().getRouter().navTo("RouteCarrinho");
                } else {
                    MessageToast.show("Preparando carrinho, por favor, tente ir ao carrinho novamente em um instante.");
                    console.warn(`[Produtos onIrParaCarrinho] Desincronia ou ID inválido. Forçando re-inicialização.`);
                    this._initializeCarrinhoLogic().then((finalCarrinhoID) => {
                        if(finalCarrinhoID && localStorage.getItem("carrinhoID") === finalCarrinhoID) {
                            this.getOwnerComponent().getRouter().navTo("RouteCarrinho");
                        } else {
                            MessageToast.show("Falha ao inicializar o carrinho para navegação.");
                        }
                    }).catch(initError => {
                        MessageToast.show("Erro crítico ao tentar re-inicializar o carrinho.");
                        console.error("[Produtos onIrParaCarrinho] Erro na re-inicialização forçada:", initError);
                    });
                }
            } catch (error) {
                MessageToast.show("Carrinho ainda não está pronto ou houve um erro. Tente novamente.");
                console.error("Produtos Controller: Erro ao aguardar _carrinhoInitializedPromise em onIrParaCarrinho:", error);
            }
        },

        onVoltar: function () { // Renomeado de onNavBack para corresponder ao que você tinha na view
            var oHistory = History.getInstance(); // History agora está definido
            var sPreviousHash = oHistory.getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                // Substitua "Routehome-page" pelo nome da sua rota da home page
                this.getOwnerComponent().getRouter().navTo("Routehome-page", {}, true);
            }
        },

        onGoToLoginHeader: function() {
            this.getOwnerComponent().getRouter().navTo("RouteLogin");
        },

        onLogoutPressHeader: function() {
            console.log("produtos.controller: onLogoutPressHeader chamado");
            localStorage.removeItem("logado");
            localStorage.removeItem("userName");
            localStorage.removeItem("clienteID");
            localStorage.removeItem("carrinhoID");
            MessageToast.show("Você foi desconectado.");
            this._updateHeaderState();
            // Substitua "RouteLogin" pelo nome da sua rota de login
            this.getOwnerComponent().getRouter().navTo("Routehome-page", {}, true);
        }
    });
});