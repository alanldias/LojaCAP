sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'produtos.produtos',
            componentId: 'ProdutosList',
            contextPath: '/Produtos'
        },
        CustomPageDefinitions
    );
});