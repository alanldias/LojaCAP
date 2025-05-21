sap.ui.define(['sap/fe/test/ObjectPage'], function(ObjectPage) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ObjectPage(
        {
            appId: 'produtos.produtos',
            componentId: 'ProdutosObjectPage',
            contextPath: '/Produtos'
        },
        CustomPageDefinitions
    );
});