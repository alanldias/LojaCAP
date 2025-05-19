sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("lojacap.controller.home-page", {
        onInit() {
        },
        onIrParaProdutos: function () {
            this.getOwnerComponent().getRouter().navTo("produtos"); 
          }
    });
});