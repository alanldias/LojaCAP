sap.ui.require(
    [
        'sap/fe/test/JourneyRunner',
        'cadastroprodutos/cadastroprodutos/test/integration/FirstJourney',
		'cadastroprodutos/cadastroprodutos/test/integration/pages/ProdutosObjectPage'
    ],
    function(JourneyRunner, opaJourney, ProdutosObjectPage) {
        'use strict';
        var JourneyRunner = new JourneyRunner({
            // start index.html in web folder
            launchUrl: sap.ui.require.toUrl('cadastroprodutos/cadastroprodutos') + '/index.html'
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