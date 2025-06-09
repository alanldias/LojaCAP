sap.ui.define([
    "sap/m/MessageToast"
], function(MessageToast) {
    'use strict';

    return {
        atualizar: function(oEvent) {
            MessageToast.show("Custom handler invoked.");
        }
    };
});
