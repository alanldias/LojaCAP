// No seu home-page.controller.js
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/library",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel" // Path correto para JSONModel
], function(Controller, mobileLibrary, MessageToast, JSONModel) { // <<< --- CORREÇÃO: JSONModel adicionado aqui
    "use strict";

    // const URLHelper = mobileLibrary.URLHelper; // Descomente se for usar em outra parte

    return Controller.extend("lojacap.controller.home-page", { 
        onInit: function () {
        

            var oRouter = this.getOwnerComponent().getRouter();
            
            var oRoute = oRouter.getRoute("Routehome-page"); 
            if (oRoute) {
                 oRoute.attachPatternMatched(this._updateHeaderState, this);
            } else {
                console.error("Rota 'Routehome-page' não encontrada no manifest para home-page.controller.js. Verifique o nome da rota no manifest.json.");
                // Como fallback, atualiza o header uma vez no init
                this._updateHeaderState();
            }
        },

        _updateHeaderState: function () {
            const isLoggedIn = localStorage.getItem("logado") === "true";
            const userName = localStorage.getItem("userName") || ""; 

            console.log("home-page.controller: _updateHeaderState - isLoggedIn (localStorage):", isLoggedIn, "userName (localStorage):", userName);

            if (isLoggedIn && userName) {
                this.oHeaderModel.setData({
                    isLoggedIn: true,
                    userName: userName,
                    loginButtonVisible: false,
                    logoutButtonVisible: true,
                    welcomeTextVisible: true
                });
            } else {
                this.oHeaderModel.setData({
                    isLoggedIn: false,
                    userName: "",
                    loginButtonVisible: true,
                    logoutButtonVisible: false,
                    welcomeTextVisible: false
                });
                if (isLoggedIn && !userName) {
                    console.warn("home-page.controller: 'logado' era true no localStorage, mas 'userName' não. Limpando 'logado'.");
                    localStorage.removeItem("logado"); 
                }
            }
            console.log("home-page.controller: headerModel atualizado:", this.oHeaderModel.getData());
        },

        onIrParaProdutos: function () {
            this.getOwnerComponent().getRouter().navTo("RouteProdutos"); 
        },

        
    });
});