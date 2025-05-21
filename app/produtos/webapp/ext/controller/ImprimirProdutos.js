sap.ui.define([
    "sap/m/MessageToast"
], function(MessageToast) {
    'use strict';

    return {
        ImprimirProdutos: function(oEvent) {
            MessageToast.show("Custom handler invoked.");
        }
    };
});
