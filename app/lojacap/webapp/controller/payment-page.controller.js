sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",  
  "sap/ui/model/Filter",           
  "sap/ui/model/FilterOperator",   
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
  "use strict";

  return Controller.extend("lojacap.controller.payment-page", {

      onInit: function () {
          // 1. Modelo para os dados da view de pagamento (itens, total, clienteID)
          const oPaymentViewModel = new JSONModel({
              itens: [],
              valorTotal: "0.00",
              clienteID: null,      // Será buscado
              itensNoCarrinho: false // Para controlar se há itens
          });
          this.getView().setModel(oPaymentViewModel, "paymentView"); // Nome do modelo: "paymentView"

          // 2. Modelo para os tipos de pagamento (como você já tinha)
          const oEnumPagamento = new JSONModel([
              { key: "PIX", text: "PIX" },
              { key: "CARTAO", text: "Cartão" },
              { key: "BOLETO", text: "Boleto" }
          ]);
          this.getView().setModel(oEnumPagamento, "enum");

          // 3. Anexa uma função para ser chamada quando a rota "RoutePayment" for acessada
          const oRouter = this.getOwnerComponent().getRouter();
          oRouter.getRoute("RoutePayment").attachPatternMatched(this._onRouteMatched, this);
      },

      // Função chamada quando a rota é acessada
      _onRouteMatched: function () {
          this.carrinhoID = localStorage.getItem("carrinhoID"); // Pega o ID do carrinho
          const oPaymentViewModel = this.getView().getModel("paymentView");
          const oMainModel = this.getOwnerComponent().getModel(); // Seu modelo OData principal

          if (!this.carrinhoID) {
              MessageBox.error("Carrinho não encontrado. Você será redirecionado.", {
                  onClose: () => {
                      // Volta para a página de produtos ou home, pois não há carrinho para pagar
                      this.getOwnerComponent().getRouter().navTo("RouteProdutos");
                  }
              });
              oPaymentViewModel.setProperty("/itensNoCarrinho", false);
              oPaymentViewModel.setProperty("/valorTotal", "0.00");
              return;
          }

          // Passo A: Buscar o Carrinho para obter o cliente_ID
          const sCarrinhoPath = "/Carrinhos('" + this.carrinhoID + "')";


          const oCarrinhoContextBinding = oMainModel.bindContext(sCarrinhoPath);

          oCarrinhoContextBinding.requestObject().then(oCarrinhoData => {
              if (oCarrinhoData && oCarrinhoData.cliente_ID) {
                  oPaymentViewModel.setProperty("/clienteID", oCarrinhoData.cliente_ID);
                  console.log("Cliente ID para pagamento:", oCarrinhoData.cliente_ID);
                  // Passo B: Com o carrinhoID confirmado e clienteID obtido, carregar os itens
                  this._carregarItensEFinalizarCalculo(this.carrinhoID);
              } else {
                  MessageBox.error("Não foi possível obter os dados do cliente para este carrinho. Tente novamente.", {
                      onClose: () => {
                          this.getOwnerComponent().getRouter().navTo("RouteCarrinho"); // Volta para o carrinho
                      }
                  });
                  oPaymentViewModel.setProperty("/itensNoCarrinho", false);
              }
          }).catch(oError => {
              console.error("Erro ao buscar dados do Carrinho para pagamento:", oError);
              MessageBox.error("Erro ao carregar dados do carrinho. Verifique o console.", {
                   onClose: () => {
                      this.getOwnerComponent().getRouter().navTo("RouteCarrinho");
                  }
              });
              oPaymentViewModel.setProperty("/itensNoCarrinho", false);
          });
      },

      // Função para carregar os itens do carrinho e calcular o total
      _carregarItensEFinalizarCalculo: function (sCarrinhoID) {
          const oMainModel = this.getOwnerComponent().getModel(); // Modelo OData
          const oPaymentViewModel = this.getView().getModel("paymentView");

          const oListBinding = oMainModel.bindList("/ItemCarrinho", undefined, 
              undefined, // Sorters
              [new Filter("carrinho_ID", FilterOperator.EQ, sCarrinhoID)], // Filters
              { $expand: "produto" } // Parameters (para incluir dados do produto)
          );

          oListBinding.requestContexts().then(aContexts => {
              const aItens = aContexts.map(oContext => oContext.getObject());
              oPaymentViewModel.setProperty("/itens", aItens); // Atualiza o modelo da view com os itens

              let totalCalculado = 0;
              if (aItens.length > 0) {
                  oPaymentViewModel.setProperty("/itensNoCarrinho", true);
                  aItens.forEach(item => {
                      totalCalculado += (parseFloat(item.precoUnitario) || 0) * (parseInt(item.quantidade, 10) || 0);
                  });
              } else {
                  oPaymentViewModel.setProperty("/itensNoCarrinho", false);
              }
              oPaymentViewModel.setProperty("/valorTotal", totalCalculado.toFixed(2));

              // Se, após carregar, o carrinho estiver vazio, avisa e redireciona
              if (!oPaymentViewModel.getProperty("/itensNoCarrinho")) {
                   MessageBox.warning("Seu carrinho para pagamento está vazio. Adicione produtos.", {
                      onClose: () => {
                          this.getOwnerComponent().getRouter().navTo("RouteProdutos");
                      }
                  });
              }
          }).catch(oError => {
              console.error("Erro ao carregar itens do carrinho para pagamento:", oError);
              MessageBox.error("Não foi possível carregar os itens do seu carrinho.");
              oPaymentViewModel.setProperty("/itensNoCarrinho", false);
              oPaymentViewModel.setProperty("/valorTotal", "0.00");
          });
      },

      onFinalizarCompra: async function () {
          const sTipoPagamento = this.byId("selectPayment").getSelectedKey();
          const oPaymentViewModel = this.getView().getModel("paymentView");
          const sClienteID = oPaymentViewModel.getProperty("/clienteID");
          // O this.carrinhoID foi definido em _onRouteMatched

          if (!sTipoPagamento) {
              MessageBox.warning("Escolha uma forma de pagamento.");
              return;
          }

          if (!sClienteID) {
              MessageBox.error("ID do cliente não está disponível. Não é possível finalizar o pedido.");
              return;
          }
          
          if (!this.carrinhoID) {
              MessageBox.error("ID do Carrinho não está disponível. Não é possível finalizar o pedido.");
              return;
          }
          
          if (!oPaymentViewModel.getProperty("/itensNoCarrinho")) {
              MessageBox.error("Seu carrinho está vazio. Não é possível finalizar o pedido.");
              return;
          }

          const oMainODataModel = this.getOwnerComponent().getModel(); // Modelo OData principal
          

          const oAction = oMainODataModel.bindContext("/realizarPagamento(...)"); 
          
          oAction.setParameter("clienteID", sClienteID);  
          oAction.setParameter("tipoPagamento", sTipoPagamento);


          try {
              await oAction.execute();
            

              MessageToast.show("Pedido realizado com sucesso!");
              
              // Limpa o carrinho do localStorage, pois o pedido foi feito
              localStorage.removeItem("carrinhoID");
              this.carrinhoID = null; // Limpa o ID no controller
              oPaymentViewModel.setProperty("/itensNoCarrinho", false); // Reseta o estado da view

              this.getOwnerComponent().getRouter().navTo("Routehome-page"); // Ou para uma página de "Pedido Confirmado"

          } catch (err) {
              MessageBox.error("Erro ao finalizar pedido: " + (err.message || "Erro desconhecido."));
              console.error("Erro na action realizarPagamento:", err);
              if (oAction && typeof oAction.resetChanges === 'function') {
                  oAction.resetChanges();
              }
          }
      }
  });
});