sap.ui.define([
    "sap/m/MessageToast"
], function(MessageToast) {
    'use strict';

    return {
        Login: function(oEvent) {
            window.location.href = '/lojacap/webapp/index.html#login'
        },
        voltarInicio: function() {
            window.location.href = '/lojacap/webapp/index.html'
        },
        irClientesCadastrados: function() {
            window.location.href = '/clientes/webapp/index.html'
        },
        verProdutosCadastrados: function() {
            window.location.href = '/produtos/webapp/index.html'
        }
    };
});
