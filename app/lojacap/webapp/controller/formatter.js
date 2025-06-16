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
        formatDate: function(sDateString) {
            // 1. Primeira verificação: se não veio nada, retorna vazio.
            if (!sDateString) {
                return "";
            }

            // 2. Tenta criar um objeto de Data.
            const oDate = new Date(sDateString);

            // 3. <<< CORREÇÃO PRINCIPAL >>>
            //    Verifica se a data criada é válida. `oDate.getTime()` retorna NaN 
            //    (Not-a-Number) para datas inválidas, e NaN nunca é igual a si mesmo.
            //    É um truque certeiro para validar datas em JavaScript!
            if (isNaN(oDate.getTime())) {
                console.warn(`[Formatter] Valor de data inválido recebido: ${sDateString}`);
                return ""; // Retorna vazio se a data for inválida, evitando o erro.
            }

            // 4. Se a data é válida, formata e retorna.
            const oDateFormat = DateFormat.getDateInstance({ style: "short" });
            return oDateFormat.format(oDate);
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