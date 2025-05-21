sap.ui.define([
    "sap/m/MessageToast"
], function(MessageToast) {
    'use strict';

    return {
        Login: function(oEvent) {
            MessageToast.show("Custom handler invoked.");
        }
    };
});
