// Em produtos.controller.js
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("lojacap.controller.produtos", {
      _carrinhoInitializedPromise: null,
      carrinhoID: null, // Armazena o ID do carrinho atual do controller

      onInit: function () {
          this._initializeCarrinhoLogic(); // Chama a lógica de inicialização centralizada

          const oRouter = this.getOwnerComponent().getRouter();
      
          const oRoute = oRouter.getRoute("Routehome-page"); 
          if (oRoute) {
              oRoute.attachPatternMatched(this._onProdutosRouteMatched, this);
          } else {
             
              console.warn("Produtos Controller: Rota 'Routehome-page' (ou a rota de produtos) não encontrada para attachPatternMatched. A sincronização do carrinho pode depender apenas do onInit.");
          }
      },

      _onProdutosRouteMatched: function () {
          
          console.log("[Produtos Controller] _onProdutosRouteMatched foi acionado.");
          const sCurrentLocalStorageCarrinhoID = localStorage.getItem("carrinhoID");
          
    
          if (this.carrinhoID !== sCurrentLocalStorageCarrinhoID || !this._carrinhoInitializedPromise) {
               console.log("[Produtos Controller] Discrepância de CarrinhoID ou promise não inicializada. Re-inicializando o carrinho.");
               this._initializeCarrinhoLogic();
          } else {
              console.log("[Produtos Controller] CarrinhoID (" + this.carrinhoID + ") e promise de inicialização parecem consistentes com o localStorage. Não haverá re-inicialização forçada.");
          }
      },

      // Função centralizada para configurar a _carrinhoInitializedPromise
      _initializeCarrinhoLogic: function () {
          this._carrinhoInitializedPromise = new Promise((resolve, reject) => {
              const oModel = this.getOwnerComponent().getModel();

              if (!oModel || typeof oModel.bindContext !== "function") { // Validação do modelo OData V4
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
                      if (oData) { // Carrinho encontrado no backend
                          const isLoggedIn = localStorage.getItem("logado") === "true";
                          
                          if (oData.cliente_ID && !isLoggedIn) {
                              console.warn("Produtos Controller: Carrinho do localStorage (" + localCarrinhoID + ") pertence a um cliente, mas usuário atual está anônimo. Gerando novo carrinho.");
                              this._createAnonymousCartInBackend(oModel, resolve, reject);
                          } else {
                              
                              console.log("Produtos Controller: Usando carrinho existente (" + localCarrinhoID + ") do localStorage. Detalhes do carrinho:", oData);
                             
                              resolve(localCarrinhoID);
                          }
                      } else { // Carrinho não encontrado no backend com esse ID
                          console.log("Produtos Controller: Carrinho do localStorage (" + localCarrinhoID + ") não encontrado no backend. Criando novo.");
                          this._createAnonymousCartInBackend(oModel, resolve, reject);
                      }
                  }).catch(oError => {
                      console.warn("Produtos Controller: Erro ao tentar buscar carrinho (" + localCarrinhoID + ") via requestObject. Criando novo.", oError.message);
                      this._createAnonymousCartInBackend(oModel, resolve, reject);
                  });
              } else { // Nenhum carrinhoID no localStorage
                  console.log("Produtos Controller: Nenhum carrinhoID no localStorage. Criando novo carrinho anônimo.");
                  this._createAnonymousCartInBackend(oModel, resolve, reject);
              }
          });

          // Captura centralizada para erros na promise de inicialização do carrinho
          this._carrinhoInitializedPromise.catch(err => {
              // Evita logar/mostrar toast duas vezes se o reject já tratou disso
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
              this.carrinhoID = newCarrinhoID; // Atualiza o ID no controller
              resolve(newCarrinhoID);         // Resolve a promise principal
          }).catch((oError) => {
              console.error("❌ Produtos Controller: ERRO ao confirmar criação de carrinho (" + newCarrinhoID + ") no backend:", oError.message);
              if (localStorage.getItem("carrinhoID") === newCarrinhoID) { // Se por acaso setou antes de falhar
                  localStorage.removeItem("carrinhoID");
              }
              this.carrinhoID = null; // Limpa o ID do controller
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

              // Verifica se o ID resolvido pela promise ainda é o que está no localStorage.
              // E se ambos são válidos.
              if (sCarrinhoIDPromise && sCarrinhoIDLocalStorage && sCarrinhoIDPromise === sCarrinhoIDLocalStorage) {
                  this.getOwnerComponent().getRouter().navTo("RouteCarrinho");
              } else {
                  MessageToast.show("Preparando carrinho, por favor, tente ir ao carrinho novamente em um instante.");
                  console.warn(`[Produtos onIrParaCarrinho] Desincronia ou ID inválido detectado. Promise ID: ${sCarrinhoIDPromise}, LocalStorage ID: ${sCarrinhoIDLocalStorage}. Forçando re-inicialização do carrinho.`);
                  // Força uma nova tentativa de inicializar o carrinho e depois tenta navegar.
                  this._initializeCarrinhoLogic().then((finalCarrinhoID) => {
                       if(finalCarrinhoID && localStorage.getItem("carrinhoID") === finalCarrinhoID) {
                          this.getOwnerComponent().getRouter().navTo("RouteCarrinho");
                       } else {
                          MessageToast.show("Falha ao inicializar o carrinho para navegação após tentativa de sincronia.");
                       }
                  }).catch(initError => {
                      MessageToast.show("Erro crítico ao tentar re-inicializar o carrinho para navegação.");
                      console.error("[Produtos onIrParaCarrinho] Erro na re-inicialização forçada:", initError);
                  });
              }
          } catch (error) {
              MessageToast.show("Carrinho ainda não está pronto ou houve um erro ao prepará-lo. Tente novamente.");
              console.error("Produtos Controller: Erro ao aguardar _carrinhoInitializedPromise em onIrParaCarrinho:", error);
          }
      },

      onVoltar: function () { // Se você tiver um botão de voltar nesta página
          this.getOwnerComponent().getRouter().navTo("Routehome-page"); // Ou para a rota anterior
      }
  });
});