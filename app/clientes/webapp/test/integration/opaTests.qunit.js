sap.ui.require(
    [
        'sap/fe/test/JourneyRunner',
        'clientes/clientes/test/integration/FirstJourney',
		'clientes/clientes/test/integration/pages/ClientesList',
		'clientes/clientes/test/integration/pages/ClientesObjectPage'
    ],
    function(JourneyRunner, opaJourney, ClientesList, ClientesObjectPage) {
        'use strict';
        var JourneyRunner = new JourneyRunner({
            // start index.html in web folder
            launchUrl: sap.ui.require.toUrl('clientes/clientes') + '/index.html'
        });

       
        JourneyRunner.run(
            {
                pages: { 
					onTheClientesList: ClientesList,
					onTheClientesObjectPage: ClientesObjectPage
                }
            },
            opaJourney.run
        );
    }
);