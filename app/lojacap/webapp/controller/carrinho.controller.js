sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("lojacap.controller.carrinho", {

    onInit: function () {
      this.carrinhoID = "8b0a61b5-68e0-4dc1-8eb9-c4d93d69a6ac"; // substituir por ID real
      this._carregarItensCarrinho();
    },

    _carregarItensCarrinho: function () {
      const oList = this.byId("carrinhoList");
      const oBindingInfo = {
        path: "/ItensCarrinho",
        filters: [
          new Filter("carrinho_ID", FilterOperator.EQ, this.carrinhoID)
        ],
        template: oList.getItems()[0].clone()
      };
      oList.bindItems(oBindingInfo);
    },

    onRemoverItem: function (oEvent) {
      const oItem = oEvent.getParameter("listItem");
      const oContext = oItem.getBindingContext();
      const oModel = this.getView().getModel();

      oModel.remove(oContext.getPath(), {
        success: () => MessageToast.show("Item removido do carrinho."),
        error: () => MessageToast.show("Erro ao remover item.")
      });
    },

    onFinalizar: function () {
      MessageToast.show("Finalizando pedido (lógica ainda não implementada).");
    }
  });
});