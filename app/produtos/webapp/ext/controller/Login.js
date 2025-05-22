sap.ui.define([
    "sap/m/MessageToast"
], function(MessageToast) {
    'use strict';

    return {
        Login: function(oEvent) {
            window.location.href = '/lojacap/webapp/index.html#login'     
        }
    };
});
