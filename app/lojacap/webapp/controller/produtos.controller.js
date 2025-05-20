sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("lojacap.controller.produtos", {

    onInit: function () {
      this.carrinhoID = "8b0a61b5-68e0-4dc1-8eb9-c4d93d69a6ac"; // substituir por ID real
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
          // Novo item no carrinho
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