sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
  ], function (Controller, MessageToast, MessageBox) {
    "use strict";
  
    return Controller.extend("lojacap.controller.payment-page", {
  
      onInit: function () {
        // Dados fictícios do carrinho

        this.clienteID = "d2341b71-cc97-4b5e-b65e-9e8e10df5bd2";
        //dados mock do cliente
        const oMockData = {
          itens: [
            {
              produto: { nome: "beatriz", preco: 500 },
              quantidade: 1
            },
            {
              produto: { nome: "axel", preco: 500 },
              quantidade: 1
            }
          ]
         
        };
        const oCarrinhoModel = new sap.ui.model.json.JSONModel(oMockData);
        this.getView().setModel(oCarrinhoModel, "carrinho");
  
        const oEnumPagamento = new sap.ui.model.json.JSONModel([
          { key: "PIX", text: "PIX" },
          { key: "CARTAO", text: "Cartão" },
          { key: "BOLETO", text: "Boleto" }
        ]);
        this.getView().setModel(oEnumPagamento, "enum");
      },
  
      onFinalizarCompra: function () {
        const sTipoPagamento = this.byId("selectPayment").getSelectedKey();
  
        if (!sTipoPagamento) {
          MessageBox.warning("Escolha uma forma de pagamento.");
          return;
        }
  
        const oModel = this.getOwnerComponent().getModel();
        const oAction = oModel.bindContext("/realizarPagamento(...)");
        oAction.setParameter("clienteID", this.clienteID);
        oAction.setParameter("tipoPagamento", sTipoPagamento);
  
        oAction.execute().then(() => {
          const result = oAction.getBoundContext().getObject();
          if (!result) {
            MessageBox.error("Falha ao finalizar o pedido.");
            return;
          }
  
          MessageToast.show("Pedido realizado com sucesso!");
          this.getOwnerComponent().getRouter().navTo("Routehome-page");
        }).catch((err) => {
          MessageBox.error("Erro ao finalizar pedido: " + err.message);
        });
      }
  
    });
  });
  