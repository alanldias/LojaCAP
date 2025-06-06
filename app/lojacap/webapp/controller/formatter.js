// webapp/controller/formatter.js
sap.ui.define([], function () {
    "use strict";
    return {
        formatStatusNfseText: function (sStatus) {
            // Adapte conforme sua necessidade
            switch (sStatus) {
                case "01": return "Não Atribuída";
                case "05": return "Atribuída";
                case "15": return "Custo Absorção Calc.";
                case "30": return "Pedido Compra Criado";
                case "35": return "Fatura e NF Criadas";
                case "50": return "Proc. Finalizado PL";
                case "55": return "Rejeitado";
                case "99": return "Erro";
                default: return sStatus;
            }
        },
        formatStatusNfseState: function (sStatus) {
            // Adapte conforme sua necessidade
            switch (sStatus) {
                case "01": return sap.ui.core.ValueState.Information; // ou Warning
                case "05": return sap.ui.core.ValueState.Success;
                case "50": return sap.ui.core.ValueState.Success;
                case "55": return sap.ui.core.ValueState.Warning;
                case "99": return sap.ui.core.ValueState.Error;
                default: return sap.ui.core.ValueState.None;
            }
        }
    };
});