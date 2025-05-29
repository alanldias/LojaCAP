sap.ui.require(
    [
        'sap/fe/test/JourneyRunner',
        'pedidos/test/integration/FirstJourney',
		'pedidos/test/integration/pages/PedidosList',
		'pedidos/test/integration/pages/PedidosObjectPage',
		'pedidos/test/integration/pages/ItemPedidoObjectPage'
    ],
    function(JourneyRunner, opaJourney, PedidosList, PedidosObjectPage, ItemPedidoObjectPage) {
        'use strict';
        var JourneyRunner = new JourneyRunner({
            // start index.html in web folder
            launchUrl: sap.ui.require.toUrl('pedidos') + '/index.html'
        });

       
        JourneyRunner.run(
            {
                pages: { 
					onThePedidosList: PedidosList,
					onThePedidosObjectPage: PedidosObjectPage,
					onTheItemPedidoObjectPage: ItemPedidoObjectPage
                }
            },
            opaJourney.run
        );
    }
);