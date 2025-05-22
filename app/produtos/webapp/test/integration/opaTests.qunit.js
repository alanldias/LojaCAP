sap.ui.require(
    [
        'sap/fe/test/JourneyRunner',
        'produtos/test/integration/FirstJourney',
		'produtos/test/integration/pages/ProdutosList',
		'produtos/test/integration/pages/ProdutosObjectPage'
    ],
    function(JourneyRunner, opaJourney, ProdutosList, ProdutosObjectPage) {
        'use strict';
        var JourneyRunner = new JourneyRunner({
            // start index.html in web folder
            launchUrl: sap.ui.require.toUrl('produtos') + '/index.html'
        });

       
        JourneyRunner.run(
            {
                pages: { 
					onTheProdutosList: ProdutosList,
					onTheProdutosObjectPage: ProdutosObjectPage
                }
            },
            opaJourney.run
        );
    }
);