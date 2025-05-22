sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox" // Mantendo a importação
], function (Controller, MessageToast, JSONModel, Filter, FilterOperator, MessageBox) {
  "use strict";

  return Controller.extend("lojacap.controller.carrinho", {

    onInit: function () {
      this.carrinhoID = localStorage.getItem("carrinhoID");
      if (!this.carrinhoID) {
        MessageToast.show("Nenhum carrinho ativo encontrado.");
        // Considerar redirecionar ou desabilitar funcionalidades
        return;
      }
      // Estado inicial do modelo 'total'
      const oTotalModel = new JSONModel({ valorTotal: "0.00", itensNoCarrinho: false });
      this.getView().setModel(oTotalModel, "total");

      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("RouteCarrinho").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this.carrinhoID = localStorage.getItem("carrinhoID"); // Garante que temos o ID mais recente
      if (!this.carrinhoID) {
        MessageToast.show("Carrinho não encontrado após navegação.");
        // Limpa o estado se o carrinhoID sumir
        const oTotalModel = this.getView().getModel("total");
        oTotalModel.setProperty("/valorTotal", "0.00");
        oTotalModel.setProperty("/itensNoCarrinho", false);
        const oList = this.byId("lista");
        if (oList) {
            oList.unbindItems();
            oList.setNoDataText("Seu carrinho está vazio ou não foi encontrado.");
        }
        return;
      }
      this._carregarItensCarrinho();
    },

    onVoltarParaProdutos: function () {
      this.getOwnerComponent().getRouter().navTo("RouteProdutos");
    },

    _calcularTotal: function (aItensDoCarrinho) {
      const oTotalModel = this.getView().getModel("total");
      let valorCalculado = 0;
      let temItens = false;

      console.log("[_calcularTotal] Itens recebidos para cálculo:", aItensDoCarrinho); // DEBUG

      if (aItensDoCarrinho && aItensDoCarrinho.length > 0) {
        temItens = true;
        aItensDoCarrinho.forEach((itemContextoOuObjeto) => {
          // Verifica se é um contexto de binding ou já o objeto
          const item = typeof itemContextoOuObjeto.getObject === 'function' ? itemContextoOuObjeto.getObject() : itemContextoOuObjeto;
          const preco = parseFloat(item.precoUnitario) || 0;
          const quantidade = parseInt(item.quantidade, 10) || 0;
          valorCalculado += preco * quantidade;
        });
      }

      oTotalModel.setProperty("/valorTotal", valorCalculado.toFixed(2));
      oTotalModel.setProperty("/itensNoCarrinho", temItens);
      console.log("[_calcularTotal] Modelo 'total' atualizado:", oTotalModel.getData()); // DEBUG
    },

    _carregarItensCarrinho: function () {
      const oList = this.byId("lista");
      const oModel = this.getView().getModel(); // Modelo OData principal

      if (!this.carrinhoID) {
        console.warn("[_carregarItensCarrinho] Sem carrinhoID.");
        this._calcularTotal([]); // Limpa o total e marca como sem itens
        if (oList) {
            oList.unbindItems(); // Remove itens antigos se houver
            oList.setNoDataText("Seu carrinho está vazio ou ID não definido.");
        }
        return;
      }
      
      oList.setNoDataText("Carregando itens do carrinho...");

      const oBindingInfo = {
        path: "/ItemCarrinho",
        parameters: {
          $expand: "produto",
          // $count: true // $count é útil, mas vamos garantir que os 'results' sejam usados
        },
        filters: [
          new Filter("carrinho_ID", FilterOperator.EQ, String(this.carrinhoID))
        ],
        template: new sap.m.ObjectListItem({ // Seu template corrigido para CURRENCY_CODE
            title: "{produto/nome}",
            number: "{= 'R$ ' + (${precoUnitario} ? parseFloat(${precoUnitario}).toFixed(2) : '0.00') }",
            intro: "{= ${quantidade} + 'x'}",
            icon: "{produto/imagemURL}",
            type: "Inactive",
            attributes: [ new sap.m.ObjectAttribute({ text: "{produto/descricao}" }) ],
            firstStatus: new sap.m.ObjectStatus({
                text: "{= 'Subtotal: R$ ' + (${precoUnitario} && ${quantidade} ? (parseFloat(${precoUnitario}) * parseInt(${quantidade},10)).toFixed(2) : '0.00') }"
            })
        }),
        templateShareable: false
      };
      
      oList.bindItems(oBindingInfo);
      const oListBinding = oList.getBinding("items");

      if (oListBinding) {
        // Função para ser chamada quando os dados são recebidos
        const fnDataReceived = (oEvent) => {
          console.log("[_carregarItensCarrinho] dataReceived disparado!", oEvent); // DEBUG
          const oData = oEvent.getParameter("data"); // Para OData V4, os dados podem estar diretamente aqui.
                                                 
          
          // para obter os contextos já carregados.
          const aContexts = oListBinding.getContexts();
          const aItens = aContexts.map(context => context.getObject());
          
          console.log("[_carregarItensCarrinho] Itens extraídos dos contextos:", aItens); // DEBUG
          this._calcularTotal(aItens);

          if (aItens.length === 0) {
            oList.setNoDataText("Seu carrinho está vazio!");
          }
        };

        // Remover handler antigo para evitar duplicação se _carregarItensCarrinho for chamado de novo
        oListBinding.detachEvent("dataReceived", fnDataReceived); // Não precisa do 'this' aqui se fnDataReceived não usa 'this' ou usa arrow
        oListBinding.attachEventOnce("dataReceived", fnDataReceived);

        // Handler para falha
        const fnRequestFailed = (oEvent) => {
            console.error("[_carregarItensCarrinho] requestFailed disparado!", oEvent.getParameters()); // DEBUG
            MessageToast.show("Falha ao carregar os itens do carrinho.");
            this._calcularTotal([]); // Limpa o total
            oList.setNoDataText("Não foi possível carregar os itens do carrinho.");
        };
        oListBinding.detachEvent("requestFailed", fnRequestFailed);
        oListBinding.attachEventOnce("requestFailed", fnRequestFailed);

        // O refresh pode não ser necessário se o binding é novo ou o filtro mudou.
        // Mas para garantir que os dados sejam buscados:
        console.log("[_carregarItensCarrinho] Chamando refresh no binding para carrinhoID:", this.carrinhoID); // DEBUG
        oListBinding.refresh(); // O parâmetro 'true' (hard refresh) pode ou não ser necessário.

      } else {
        console.error("[_carregarItensCarrinho] Falha ao obter o binding 'items'.");
        this._calcularTotal([]);
        oList.setNoDataText("Erro ao carregar itens.");
      }
    },

    onRemoverItem: function (oEvent) {
      const oItem = oEvent.getParameter("listItem");
      const oContext = oItem.getBindingContext();

      oContext.delete().then(() => {
        MessageToast.show("Item removido do carrinho.");
        // Se não, um refresh no binding da lista pode ser necessário aqui:
        // this.byId("lista").getBinding("items").refresh();
      }).catch((err) => {
        MessageToast.show("Erro ao remover item: " + err.message);
      });
    },

    onFinalizar: async function () {
      const isLoggedIn = localStorage.getItem("logado") === "true";
      const carrinhoID = this.carrinhoID;

      if (!carrinhoID) {
        MessageBox.error("Não foi possível identificar seu carrinho. Tente adicionar itens ou refazer o login.");
        return;
      }
      
      const oTotalModel = this.getView().getModel("total");
      // ADICIONAR LOG AQUI para ver o valor de itensNoCarrinho
      console.log("[onFinalizar] Verificando itensNoCarrinho:", oTotalModel.getProperty("/itensNoCarrinho"));
      console.log("[onFinalizar] Modelo 'total' completo:", oTotalModel.getData());


      if (!oTotalModel.getProperty("/itensNoCarrinho")) {
          MessageBox.information("Seu carrinho está vazio. Adicione produtos antes de finalizar a compra.");
          return;
      }

      if (!isLoggedIn) {
        MessageBox.confirm("Você precisa estar logado para finalizar a compra. Deseja ir para a página de login?", {
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            onClose: (sAction) => {
                if (sAction === MessageBox.Action.OK) {
                    this.getOwnerComponent().getRouter().navTo("RouteLogin");
                }
            }
        });
        return;
      }

      const oModel = this.getOwnerComponent().getModel();
      const oAction = oModel.bindContext("/mergeCarrinho(...)");
      oAction.setParameter("carrinhoAnonimoID", carrinhoID);

      try {
        await oAction.execute();
        const oContext = oAction.getBoundContext();

        if (!oContext) {
            MessageToast.show("Erro ao obter contexto da resposta do servidor.");
            return;
        }
        const result = oContext.getObject();
        const novoCarrinhoID = result?.carrinhoID;

        if (!novoCarrinhoID || typeof novoCarrinhoID !== "string") {
          MessageToast.show("Carrinho retornado inválido! (Servidor não retornou ID esperado)");
          return;
        }

        localStorage.setItem("carrinhoID", novoCarrinhoID);
        this.carrinhoID = novoCarrinhoID;

        MessageToast.show("Carrinho pronto para pagamento!");
        this.getOwnerComponent().getRouter().navTo("RoutePayment");

      } catch (err) {
        MessageToast.show("Erro ao finalizar carrinho: " + err.message);
        if (oAction && typeof oAction.resetChanges === 'function') {
            oAction.resetChanges();
        }
      }
    }
  });
});