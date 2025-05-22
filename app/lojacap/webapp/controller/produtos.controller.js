sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("lojacap.controller.produtos", {

    onInit: function () {
      const oModel = this.getView().getModel();
      let carrinhoID = localStorage.getItem("carrinhoID");
    
      if (carrinhoID) {
        this.carrinhoID = carrinhoID; // <- Garante que ele é atribuído mesmo que já exista
        return;
      }
    
      carrinhoID = this._gerarUUID();
      localStorage.setItem("carrinhoID", carrinhoID);
      this.carrinhoID = carrinhoID; // <- Atribui o carrinhoID aqui também
    
      // Cria o carrinho no back
      oModel.create("/Carrinhos", { ID: carrinhoID }, {
        success: function () {
          console.log("✅ Carrinho criado com sucesso:", carrinhoID);
        },
        error: function (err) {
          console.error("❌ Erro ao criar carrinho:", err);
          sap.m.MessageToast.show("Erro ao criar carrinho: " + err.message);
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

    onComprar: function (oEvent) {
      const oModel = this.getView().getModel();
      const oProduto = oEvent.getSource().getBindingContext().getObject();
      const sCarrinhoID = this.carrinhoID;
    
      if (!sCarrinhoID) {
        MessageToast.show("Carrinho não inicializado!");
        return;
      }
    
      const oListBinding = oModel.bindList("/ItemCarrinho", null, null, [
        new Filter("carrinho_ID", FilterOperator.EQ, sCarrinhoID),
        new Filter("produto_ID", FilterOperator.EQ, oProduto.ID)
      ]);
    
      oListBinding.requestContexts().then(aContexts => {
        if (aContexts.length > 0) {
          const oContext = aContexts[0];
          const oData = oContext.getObject();
          oContext.setProperty("quantidade", oData.quantidade + 1);
          MessageToast.show("Quantidade atualizada no carrinho!");
        } else {
          const oBinding = oModel.bindList("/ItemCarrinho");
          oBinding.create({
            carrinho_ID: sCarrinhoID,
            produto_ID: oProduto.ID,
            quantidade: 1,
            precoUnitario: oProduto.preco
          });
          MessageToast.show("Produto adicionado ao carrinho!");
        }
      }).catch(err => {
        MessageToast.show("Erro ao verificar carrinho: " + err.message);
      });
    },

    onIrParaCarrinho: function () {
      this.getOwnerComponent().getRouter().navTo("RouteCarrinho");
    }

  });
});