sap.ui.require(
    [
        'sap/fe/test/JourneyRunner',
        'cadsatroclientes/cadastroclientes/test/integration/FirstJourney',
		'cadsatroclientes/cadastroclientes/test/integration/pages/ClientesObjectPage'
    ],
    function(JourneyRunner, opaJourney, ClientesObjectPage) {
        'use strict';
        var JourneyRunner = new JourneyRunner({
            // start index.html in web folder
            launchUrl: sap.ui.require.toUrl('cadsatroclientes/cadastroclientes') + '/index.html'
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