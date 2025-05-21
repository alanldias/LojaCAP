sap.ui.define([
    "sap/m/MessageToast"
], function(MessageToast) {
    'use strict';

    return {
        imprimirClientes: function() {
            MessageToast.show("Preparando dados para a impressão.");
        }
    };
});
