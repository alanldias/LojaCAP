sap.ui.define([
    "sap/m/MessageToast"
], function(MessageToast) {
    'use strict';

    return {
        RejeitarFrete: function(oEvent) {
            MessageToast.show("Custom handler invoked.");
        }
    };
});
