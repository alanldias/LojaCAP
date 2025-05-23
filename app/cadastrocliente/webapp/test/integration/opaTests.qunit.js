sap.ui.require(
    [
        'sap/fe/test/JourneyRunner',
        'cadastrocliente/cadastrocliente/test/integration/FirstJourney',
		'cadastrocliente/cadastrocliente/test/integration/pages/ClientesObjectPage'
    ],
    function(JourneyRunner, opaJourney, ClientesObjectPage) {
        'use strict';
        var JourneyRunner = new JourneyRunner({
            // start index.html in web folder
            launchUrl: sap.ui.require.toUrl('cadastrocliente/cadastrocliente') + '/index.html'
        });

       
        JourneyRunner.run(
            {
                pages: { 
					onTheClientesObjectPage: ClientesObjectPage
                }
            },
            opaJourney.run
        );
    }
);