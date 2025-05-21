sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("lojacap.controller.produtos", {

    onInit: function () {
      // Tenta pegar carrinhoID do localStorage, senão gera e cria um novo carrinho
      let carrinhoID = localStorage.getItem("carrinhoID");
      if (!carrinhoID) {
        carrinhoID = this._gerarUUID();
        localStorage.setItem("carrinhoID", carrinhoID);
        // Cria o carrinho no backend
        this.getView().getModel().create("/Carrinho", { ID: carrinhoID });
      }
      this.carrinhoID = carrinhoID;
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

      const oListBinding = oModel.bindList("/ItemCarrinho", null, null, [
        new Filter("carrinho_ID", FilterOperator.EQ, sCarrinhoID),
        new Filter("produto_ID", FilterOperator.EQ, oProduto.ID)
      ]);

      oListBinding.requestContexts().then(aContexts => {
        if (aContexts.length > 0) {
          // Já existe no carrinho: atualizar quantidade
          const oContext = aContexts[0];
          const oData = oContext.getObject();
          oContext.setProperty("quantidade", oData.quantidade + 1);
          MessageToast.show("Quantidade atualizada no carrinho!");
        } else {
          // Novo item no carrinho (incluindo precoUnitario já aqui!)
          const oBinding = oModel.bindList("/ItemCarrinho");
          oBinding.create({
            carrinho_ID: sCarrinhoID,
            produto_ID: oProduto.ID,
            quantidade: 1,
            precoUnitario: oProduto.preco // Salva o preço atual do produto!
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