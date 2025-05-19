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

      const oListBinding = oModel.bindList("/ItensCarrinho", null, null, [
        new Filter("carrinho_ID", FilterOperator.EQ, sCarrinhoID),
        new Filter("produto_ID", FilterOperator.EQ, oProduto.ID)
      ]);

      oListBinding.requestContexts().then(aContexts => {
        if (aContexts.length > 0) {
          const oContext = aContexts[0];
          const oData = oContext.getObject();
          oContext.setProperty("quantidade", oData.quantidade + 1);
          oModel.submitBatch().then(() => {
            MessageToast.show("Quantidade atualizada no carrinho.");
          });
        } else {
          oModel.bindContext("/ItensCarrinho").create({
            carrinho_ID: sCarrinhoID,
            produto_ID: oProduto.ID,
            quantidade: 1
          });
          
          
          MessageToast.show("Produto adicionado ao carrinho!");
        }
      }).catch(err => {
        console.error("Erro ao consultar carrinho:", err);
        MessageToast.show("Erro ao adicionar ao carrinho.");
      });
    },

    onIrParaCarrinho: function () {
      this.getOwnerComponent().getRouter().navTo("carrinho");
    }

  });
});