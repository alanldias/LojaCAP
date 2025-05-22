// No seu home-page.controller.js (ou App.controller.js)
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/library",
    "sap/m/MessageToast" // Adicionado para feedback
], function(Controller, mobileLibrary, MessageToast) {
    "use strict";


    return Controller.extend("lojacap.controller.home-page", { 
        onIrParaProdutos: function () {
            this.getOwnerComponent().getRouter().navTo("RouteProdutos"); 
        },
        onLogoutPress: function() {
            console.log("onLogoutPress chamado");

            // 1. Limpar o estado de login customizado do localStorage
            localStorage.removeItem("logado");
            localStorage.removeItem("carrinhoID"); 

            console.log("localStorage 'logado' e 'carrinhoID' removidos.");
            MessageToast.show("Você está sendo desconectado...");

            
            this.getOwnerComponent().getRouter().navTo("Routehome-page", {}, true /* bReplace */);
        }
    });
});