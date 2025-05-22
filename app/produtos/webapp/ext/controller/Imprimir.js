sap.ui.define([
    "sap/m/MessageToast"
], function(MessageToast) {
    'use strict';

    return {
        Imprimir: function(oEvent) {
            MessageToast.show("Custom handler invoked.");
        }
    };
});
