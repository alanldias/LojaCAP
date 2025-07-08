sap.ui.define([
    "sap/ui/core/format/DateFormat"
], function (DateFormat) {
    "use strict";

    return {

        // Suas outras funções de formatter (formatStatusNfseText, etc.) ficam aqui...
        formatStatusNfseText: function (sStatus) {
            switch (sStatus) {
                case "01": return "Não Atribuída";
                case "05": return "Atribuída";
                case "15": return "Custo Absorção Calc.";
                case "30": return "Pedido Compra Criado";
                case "35": return "Fatura e NF Criadas";
                case "50": return "Proc. Finalizado PL";
                case "55": return "Rejeitado";
                default: return sStatus;
            }
        },

        formatStatusNfseState: function (sStatus) {
            switch (sStatus) {
                case "01": return "Information";
                case "05": return "Success";
                case "50": return "Success";
                case "55": return "Warning";
                case "99": return "Error";
                default: return "None";
            }
        },
        iconTipo: function (sTipo) {
            switch (sTipo) {
              case 'E': return 'sap-icon://project-definition-triangle-2';
              case 'S': return 'sap-icon://color-fill';
              case 'R': return 'sap-icon://circle-task-2';
              default : return 'sap-icon://question-mark';
            }
          },
          colorTipo: function (sTipo) {
            return (sTipo === 'E') ? 'Negative'
                 : (sTipo === 'S') ? 'Positive'
                 : (sTipo === 'R') ? 'Critical'
                 : 'Neutral';
          }          
    };
});