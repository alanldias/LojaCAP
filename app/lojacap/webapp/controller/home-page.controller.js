// No seu home-page.controller.js
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/library",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], function(Controller, mobileLibrary, MessageToast, JSONModel) {
    "use strict";

    return Controller.extend("lojacap.controller.home-page", {
        oHeaderModel: null, // Declare a propriedade aqui também

        onInit: function () {
            // Inicialize o oHeaderModel AQUI!
            this.oHeaderModel = new JSONModel({
                isLoggedIn: false,
                userName: "",
                loginButtonVisible: true,
                logoutButtonVisible: false,
                welcomeTextVisible: false
            });
            this.getView().setModel(this.oHeaderModel, "headerModel"); // Atribua à view

            var oRouter = this.getOwnerComponent().getRouter();
            var oRoute = oRouter.getRoute("Routehome-page");
            if (oRoute) {
                 oRoute.attachPatternMatched(this._updateHeaderState, this);
            } else {
                console.warn("home-page.controller: Rota 'Routehome-page' não encontrada. A lógica de atualização do header pode não funcionar como esperado na navegação.");
                this._updateHeaderState(); // Chamar uma vez no onInit como fallback
            }
        },

        onGoPedidosFree: function () {
            this.getOwnerComponent().getRouter().navTo("RoutePedidosFree");
          },

        onGonotafiscal: function () {
            this.getOwnerComponent().getRouter().navTo("Routenota-fiscal");
          },
          onGoIss: function () {
            this.getOwnerComponent().getRouter().navTo("RouteConfiguracaoISS");
          },



        _updateHeaderState: function () {
            const isLoggedIn = localStorage.getItem("logado") === "true";
            const userName = localStorage.getItem("userName") || "";

            console.log("home-page.controller: _updateHeaderState - isLoggedIn:", isLoggedIn, "userName:", userName); // DEBUG

            if (!this.oHeaderModel) { // Verificação de segurança
                console.error("home-page.controller: oHeaderModel não está definido em _updateHeaderState!");
                return;
            }

            this.oHeaderModel.setData({
                isLoggedIn: isLoggedIn,
                userName: userName,
                loginButtonVisible: !isLoggedIn,
                logoutButtonVisible: isLoggedIn,
                welcomeTextVisible: isLoggedIn && !!userName // !!userName converte para booleano
            });

            // Lógica adicional para limpar 'logado' se 'userName' não existir
            if (isLoggedIn && !userName) {
                console.warn("home-page.controller: 'logado' era true no localStorage, mas 'userName' não. Limpando 'logado'.");
                localStorage.removeItem("logado");
                // Re-set data para refletir a limpeza
                this.oHeaderModel.setData({
                    isLoggedIn: false,
                    userName: "",
                    loginButtonVisible: true,
                    logoutButtonVisible: false,
                    welcomeTextVisible: false
                });
            }
            console.log("home-page.controller: headerModel atualizado:", this.oHeaderModel.getData()); // DEBUG
        },

        onIrParaProdutos: function () {
            this.getOwnerComponent().getRouter().navTo("RouteProdutos");
        }
    });
});