sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {
  "use strict";

  return Controller.extend("lojacap.controller.PedidosFree", {
    onInit: function () {
      MessageToast.show("PedidosFree carregado!");
    },

    onUpdateFinished: function () {
      const oTable = this.byId("tablePedidosFree");
      const aItems = oTable.getItems();

      aItems.forEach(function (oItem) {
        const oCtx = oItem.getBindingContext();
        const valorTotal = oCtx.getProperty("total");

        // Remove qualquer classe antiga, se quiser evitar acúmulo
        oItem.removeStyleClass("linhaVerde");
        oItem.removeStyleClass("linhaVermelha");

        // Adiciona a classe conforme valor
        const sClasse = valorTotal > 400 ? "linhaVermelha" : "linhaVerde";
        oItem.addStyleClass(sClasse);
      });
    }
  });
});
