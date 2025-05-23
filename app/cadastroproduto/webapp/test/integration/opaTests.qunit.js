sap.ui.require(
    [
        'sap/fe/test/JourneyRunner',
        'cadastroproduto/cadastroproduto/test/integration/FirstJourney',
		'cadastroproduto/cadastroproduto/test/integration/pages/ProdutosObjectPage'
    ],
    function(JourneyRunner, opaJourney, ProdutosObjectPage) {
        'use strict';
        var JourneyRunner = new JourneyRunner({
            // start index.html in web folder
            launchUrl: sap.ui.require.toUrl('cadastroproduto/cadastroproduto') + '/index.html'
        });

       
        JourneyRunner.run(
            {
                pages: { 
					onTheProdutosObjectPage: ProdutosObjectPage
                }
            },
            opaJourney.run
        );
    }
);