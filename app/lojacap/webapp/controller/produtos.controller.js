sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("lojacap.controller.produtos", {
    _carrinhoInitializedPromise: null,
    carrinhoID: null,

    onInit: function () {
      this._carrinhoInitializedPromise = new Promise((resolve, reject) => {
        const oModel = this.getOwnerComponent().getModel();

        if (!oModel) {
          console.error("❌ Modelo não encontrado no OwnerComponent (produtos.controller.js > onInit).");
          reject(new Error("Modelo principal não pôde ser carregado."));
          return;
        }
        // Verifica se é um modelo OData V4 (tem o método bindContext)
        if (typeof oModel.bindContext !== "function") {
            console.error("❌ oModel não parece ser um OData V4 Model válido (falta bindContext).", oModel);
            reject(new Error("oModel obtido não é um OData V4 Model."));
            return;
        }

        let localCarrinhoID = localStorage.getItem("carrinhoID");

        if (localCarrinhoID) {

          const sPath = "/Carrinhos('" + localCarrinhoID + "')";
          const oContextBinding = oModel.bindContext(sPath);

          oContextBinding.requestObject().then(oData => { // oData é o objeto do carrinho se encontrado
            if (oData) { // Carrinho encontrado
              if (oData.cliente_ID) {
                console.warn("Carrinho do localStorage (" + localCarrinhoID + ") já associado a um cliente. Gerando novo.");
                this._createAnonymousCartInBackend(oModel, resolve, reject);
              } else {
                console.log("✅ Carrinho anônimo (" + localCarrinhoID + ") recuperado do backend via requestObject.");
                this.carrinhoID = localCarrinhoID;
                resolve(localCarrinhoID);
              }
            } else {
              // Se oData for undefined/null, o carrinho não foi encontrado com essa chave.
              console.log("Carrinho do localStorage (" + localCarrinhoID + ") não encontrado no backend (requestObject retornou sem dados). Criando novo.");
              this._createAnonymousCartInBackend(oModel, resolve, reject);
            }
          }).catch(oError => {
            // Erros na requisição, como 404, são capturados aqui.
            console.log("Erro ao tentar buscar carrinho (" + localCarrinhoID + ") via requestObject (provavelmente não existe). Criando novo.", oError.message);
            this._createAnonymousCartInBackend(oModel, resolve, reject);
          });
      
        } else {
          this._createAnonymousCartInBackend(oModel, resolve, reject);
        }
      });

      this._carrinhoInitializedPromise.catch(err => {
        console.error("❌ Erro na promise de inicialização do carrinho (produtos.controller.js):", err);
        MessageToast.show("Não foi possível inicializar o carrinho. Tente recarregar a página.");
      });
    },

    _gerarUUID: function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

    _createAnonymousCartInBackend: function(oModel, resolve, reject) {
      const newCarrinhoID = this._gerarUUID();

      if (!oModel || typeof oModel.bindList !== 'function') {
          console.error("❌ Modelo OData V4 (ou método bindList) não disponível em _createAnonymousCartInBackend.");
          reject(new Error("Modelo OData V4 (ou método bindList) não disponível para criar carrinho."));
          return;
      }

      const oListBinding = oModel.bindList("/Carrinhos");
      // O payload para criação. O ID é fornecido pelo cliente.
      const oPayload = { ID: newCarrinhoID };
      const oContext = oListBinding.create(oPayload);

      // .created() retorna uma Promise que resolve quando a entidade foi criada no backend
      oContext.created().then(() => {
        console.log("✅ Carrinho anônimo criado no backend com ID:", newCarrinhoID);
        localStorage.setItem("carrinhoID", newCarrinhoID);
        this.carrinhoID = newCarrinhoID;
        resolve(newCarrinhoID);
      }).catch((oError) => {
        console.error("❌ Erro ao confirmar criação de carrinho anônimo (" + newCarrinhoID + ") no backend:", oError.message);

        localStorage.removeItem("carrinhoID"); // Remove o ID que não foi salvo
        MessageToast.show("Erro ao criar carrinho no servidor: " + (oError.message || "Erro desconhecido"));
        reject(oError);
      });
     
    },

    onComprar: async function (oEvent) {
      try {
        // Espera a promise de inicialização do carrinho ser resolvida
        const sCarrinhoID = await this._carrinhoInitializedPromise;
        if (!sCarrinhoID) {
          // Este caso não deveria acontecer se a promise sempre resolve ou rejeita.
          MessageToast.show("Carrinho não inicializado corretamente! Tente novamente.");
          return;
        }

        const oModel = this.getOwnerComponent().getModel();
        const oProduto = oEvent.getSource().getBindingContext().getObject();

        // Sua lógica para adicionar/atualizar ItemCarrinho (parece já usar API V4 corretamente)
        const oListBindingItems = oModel.bindList("/ItemCarrinho", undefined, undefined, [
          new Filter("carrinho_ID", FilterOperator.EQ, sCarrinhoID),
          new Filter("produto_ID", FilterOperator.EQ, oProduto.ID)
        ]);

        oListBindingItems.requestContexts(0, 1).then(aContexts => { // Pede no máximo 1 contexto
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
          console.error("Erro em onComprar, requestContexts para ItemCarrinho:", err);
        });

      } catch (error) {
        // Este catch agora pegará erros da rejeição de _carrinhoInitializedPromise
        MessageToast.show("Erro ao processar compra (carrinho não pronto): " + (error.message || "Erro desconhecido"));
        console.error("Erro em onComprar, capturado pela promise _carrinhoInitializedPromise:", error);
      }
    },

    onIrParaCarrinho: function () {
      this.getOwnerComponent().getRouter().navTo("RouteCarrinho");
    },
    onVoltar: function () {
      this.getOwnerComponent().getRouter().navTo("Routehome-page");
    },
  });
});