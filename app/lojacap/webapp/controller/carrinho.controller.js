sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, JSONModel, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("lojacap.controller.carrinho", {

    onInit: function () {
      // Pega o carrinhoID do localStorage para manter o carrinho do usuário
      this.carrinhoID = localStorage.getItem("carrinhoID");
      if (!this.carrinhoID) {
        MessageToast.show("Nenhum carrinho ativo encontrado.");
        this.getOwnerComponent().getRouter().navTo("RouteProdutos");
        return;
      }
      const oTotalModel = new JSONModel({ valorTotal: 0 });
      this.getView().setModel(oTotalModel, "total");
      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("RouteCarrinho").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this._carregarItensCarrinho();
      this._calcularTotal();
    },

    onVoltarParaProdutos: function () {
      this.getOwnerComponent().getRouter().navTo("RouteProdutos");
    },

    _calcularTotal: function () {
      const oModel = this.getView().getModel();
      const oTotalModel = this.getView().getModel("total");
      const sCarrinhoID = this.carrinhoID;

      const oBinding = oModel.bindList("/ItemCarrinho", null, null, [
        new sap.ui.model.Filter("carrinho_ID", sap.ui.model.FilterOperator.EQ, sCarrinhoID)
      ]);

      oBinding.requestContexts().then((aContexts) => {
        let total = 0;
        aContexts.forEach((oContext) => {
          const item = oContext.getObject();
          const preco = item.precoUnitario || 0;
          const quantidade = item.quantidade || 0;
          total += preco * quantidade;
        });
        oTotalModel.setProperty("/valorTotal", total.toFixed(2));
      }).catch(err => {
        console.error("Erro ao calcular total:", err);
      });
    },

    _carregarItensCarrinho: function () {
      const oList = this.byId("lista");

      const oTemplate = new sap.m.ObjectListItem({
        title: "{produto/nome}",
        number: "{= 'R$ ' + ${precoUnitario} }",
        intro: "{= ${quantidade} + 'x'}",
        icon: "{produto/imagemURL}",
        type: "Inactive",
        attributes: [
          new sap.m.ObjectAttribute({ text: "{produto/descricao}" })
        ]
      });

      oList.bindItems({
        path: "/ItemCarrinho",
        templateShareable: false,
        filters: [
          new Filter("carrinho_ID", FilterOperator.EQ, this.carrinhoID)
        ],
        template: oTemplate
      });
    },

    onRemoverItem: function (oEvent) {
      const oItem = oEvent.getParameter("listItem");
      const oContext = oItem.getBindingContext();

      oContext.delete().then(() => {
        MessageToast.show("Item removido do carrinho.");
        this._calcularTotal();
      }).catch((err) => {
        MessageToast.show("Erro ao remover item: " + err.message);
      });
    },

    onFinalizar: function () {
      console.log(this.carrinhoID)
      MessageToast.show("Compra finalizada!");
    }
  });
});
