sap.ui.define([
    "sap/m/MessageToast"
], function(MessageToast) {
    'use strict';

    return {
        VerLogs: function(oEvent) {
            MessageToast.show("Custom handler invoked.");
        }
    };
});
