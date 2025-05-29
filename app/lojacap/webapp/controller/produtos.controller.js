sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/routing/History",    // Esta é a 5ª dependência
    "sap/ui/model/json/JSONModel",  // Esta é a 6ª dependência
    "sap/ui/core/Fragment"
], function (Controller, MessageToast, Filter, FilterOperator, History, JSONModel, Fragment) { // <<< --- CORREÇÃO: History e JSONModel adicionados aqui
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

        onIrCadastroProdutos: function () {
            window.location.href = "/cadastroproduto/webapp/index.html"; 
        },

        onIrCadastroClientes: function () {
            window.location.href = "/cadastrocliente/webapp/index.html"; 
        },

        /**
         * Chamado quando o usuário digita no SearchField (liveChange) ou pressiona Enter/busca (search).
         * @param {sap.ui.base.Event} oEvent O objeto do evento.
         */
        _applySearchFilter: function (sQuery) {
            var aFilters = [];
            if (sQuery && sQuery.length > 0) {
                // Criar um filtro para o campo 'nome' (ou o campo que você quer filtrar)
                // O FilterOperator.Contains não é case-sensitive por padrão na maioria dos backends OData
                // Se precisar de case-insensitive e o backend não suportar, pode ser mais complexo.
                // Para OData V4, a sensibilidade a maiúsculas/minúsculas depende da implementação do serviço.
                // A função 'contains' do OData V4 é geralmente case-insensitive.
                var oNomeFilter = new Filter({
                    path: "nome",
                    operator: FilterOperator.Contains,
                    value1: sQuery,
                    caseSensitive: false // Para OData V4, o serviço decide. Isso é mais uma dica.
                });
                aFilters.push(oNomeFilter);

                // Você pode adicionar filtros para outros campos aqui se desejar, por exemplo, descrição:
                // var oDescricaoFilter = new Filter({
                //     path: "descricao",
                //     operator: FilterOperator.Contains,
                //     value1: sQuery,
                //     caseSensitive: false
                // });
                // aFilters.push(new Filter({ filters: [oNomeFilter, oDescricaoFilter], and: false })); // Filtra se nome OU descrição contêm
            }

            // Obter o binding da GridList
            var oGridList = this.byId("productGrid");
            if (!oGridList) {
                console.error("GridList 'productGrid' não encontrada.");
                return;
            }
            var oBinding = oGridList.getBinding("items");

            if (oBinding) {
                oBinding.filter(aFilters);
                console.log("Filtros aplicados:", aFilters);
            } else {
                console.error("Binding 'items' da GridList não encontrado.");
            }
        },

        /**
         * Manipulador para o evento 'search' do SearchField.
         * @param {sap.ui.base.Event} oEvent O objeto do evento.
         */
        onSearchProduto: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            // Se você quiser limpar o filtro quando o usuário limpar o campo de busca e pressionar enter
            // if (!sQuery && oEvent.getParameter("clearButtonPressed")) {
            // this._applySearchFilter("");
            // return;
            // }
            this._applySearchFilter(sQuery);
            console.log("onSearchProduto acionado com query:", sQuery);
        },

        /**
         * Manipulador para o evento 'liveChange' do SearchField.
         * @param {sap.ui.base.Event} oEvent O objeto do evento.
         */
        onSearchProdutoLive: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue"); // Para liveChange, é newValue
            this._applySearchFilter(sQuery);
            console.log("onSearchProdutoLive acionado com newValue:", sQuery);
        },
         
        onAbrirDialogFiltro: async function () {
            console.log("✅ Botão de Filtro clicado");
        
            if (!this._oFiltroDialog || !this._oFiltroDialog.isOpen?.()) {
                if (!this._oFiltroDialog) {
                    this._oFiltroDialog = await Fragment.load({
                        name: "lojacap.view.fragments.FiltroDialog",
                        controller: this
                    });
                    this.getView().addDependent(this._oFiltroDialog);
                }
                this._oFiltroDialog.open();
            } else {
                console.log("⚠️ Dialog já estava aberto ou visível, ignorando novo open.");
            }
        },
        
        onCancelarDialogFiltro: function () {
            if (this._oFiltroDialog) {
                this._oFiltroDialog.close();
            }
        },
        
        onLimparFiltrosDialog: function () {
            sap.ui.getCore().byId("filtroNomeInput").setValue("");
            sap.ui.getCore().byId("filtroCategoriaSelect").setSelectedKey("");
            sap.ui.getCore().byId("filtroPrecoMinInput").setValue("");
            sap.ui.getCore().byId("filtroPrecoMaxInput").setValue("");
        },
        
        onAplicarFiltrosDialog: function () {
        
            const nome = sap.ui.getCore().byId("filtroNomeInput").getValue().trim();
            const categoria = sap.ui.getCore().byId("filtroCategoriaSelect").getSelectedKey();
            const precoMin = sap.ui.getCore().byId("filtroPrecoMinInput").getValue();
            const precoMax = sap.ui.getCore().byId("filtroPrecoMaxInput").getValue();
        
            const aFilters = [];
            console.log("Valores do diálogo - Nome:", nome, "Categoria:", categoria, "Preço Min:", precoMin, "Preço Max:", precoMax);
        
            if (nome) {
                // Use a mesma estrutura do filtro principal
                aFilters.push(new Filter({
                    path: "nome",
                    operator: FilterOperator.Contains,
                    value1: nome,
                    caseSensitive: false // Adicione para consistência, embora o backend decida no OData V4
                }));
                console.log("Filtro de nome do diálogo adicionado:", nome);
            }
        
            if (categoria) {
                // Supondo que 'categoria' seja o nome do campo no seu modelo
                aFilters.push(new Filter({
                    path: "categoria", // Verifique se este é o nome correto do campo no seu modelo de dados
                    operator: FilterOperator.Contains,
                    value1: categoria,
                    caseSensitive: false
                }));
                console.log("Filtro de categoria do diálogo adicionado:", categoria);
            }
        
            if (precoMin) {
                const fPrecoMin = parseFloat(precoMin);
                if (!isNaN(fPrecoMin)) { // Verifique se a conversão é válida
                    aFilters.push(new Filter("preco", FilterOperator.GE, fPrecoMin));
                    console.log("Filtro de preço mínimo do diálogo adicionado:", fPrecoMin);
                } else {
                    console.warn("Valor de preço mínimo inválido:", precoMin);
                }
            }
        
            if (precoMax) {
                const fPrecoMax = parseFloat(precoMax);
                if (!isNaN(fPrecoMax)) { // Verifique se a conversão é válida
                    aFilters.push(new Filter("preco", FilterOperator.LE, fPrecoMax));
                    console.log("Filtro de preço máximo do diálogo adicionado:", fPrecoMax);
                } else {
                    console.warn("Valor de preço máximo inválido:", precoMax);
                }
            }
        
            const oGrid = this.byId("productGrid"); // Confirmado que é a GridList da view principal
            const oBinding = oGrid.getBinding("items");
        
            if (oBinding) {
                // Se aFilters estiver vazio, oBinding.filter([]) limpa os filtros.
                // Se tiver filtros, eles são aplicados com AND.
                oBinding.filter(aFilters.length > 0 ? new Filter({ filters: aFilters, and: true }) : []);
                console.log("Filtros aplicados pelo diálogo:", JSON.stringify(aFilters));
            } else {
                console.error("Binding 'items' da GridList (aplicado pelo diálogo) não encontrado.");
            }
        
            if (this._oFiltroDialog) {
                this._oFiltroDialog.close();
            }
        },
        onProductPress: function (oEvent) {
            var oItem = oEvent.getSource(); // O item da lista que foi clicado
            var oContext = oItem.getBindingContext(); // O contexto de dados do item
            var sProdutoId = oContext.getProperty("ID"); // Pega o ID do produto (Certifique-se que 'ID' é o nome da sua chave primária)

            console.log("🖱️ Controller produtos.js: onProductPress - Produto clicado! ID:", sProdutoId);

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("produtoDetalhe", {
                produtoId: sProdutoId // Passa o ID como parâmetro para a rota
            });
            console.log("🖱️ Controller produtos.js: onProductPress - Navegando para produtoDetalhe...");
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

            this.getOwnerComponent().getRouter().navTo("Routehome-page", {}, true);
            
        }
    });
});