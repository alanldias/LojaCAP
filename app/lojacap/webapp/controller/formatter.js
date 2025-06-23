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
                case "99": return "Erro";
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

        //não é o ideal mas só para o console log parar de reclamar 
        formatDate: function(oDate) { // O nome 'oDate' reforça que esperamos um objeto

            // 1. Sempre verifique se o valor de entrada existe
            if (!oDate) {
                return ""; // Retorna vazio se a data for nula ou indefinida
            }
        
            // 2. Verifique se o valor já não é um objeto Date. Se for, use-o diretamente.
            // Se não for, tente convertê-lo.
            const dateObject = (oDate instanceof Date) ? oDate : new Date(oDate);
            
            // 3. Verifique se a conversão resultou em uma data válida
            if (isNaN(dateObject.getTime())) {
                console.warn(`[Formatter] Valor de data inválido recebido: ${oDate}`); // O aviso que você viu
                return "Data Inválida"; // Retorna um texto de erro amigável na tela
            }
        
            // 4. Se tudo estiver certo, formate a data para o padrão brasileiro
            // Garanta que o sap.ui.core.format.DateFormat está importado no seu controller/formatter
            var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                pattern: "dd/MM/yyyy"
            });
        
            return oDateFormat.format(dateObject);
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