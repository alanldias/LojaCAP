sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    // Seus formatters estão referenciados na view como '.formatter.nomeDaFuncao'
    // Isso significa que eles devem estar em um arquivo separado e carregados,
    // ou definidos diretamente no controller e a view ajustada para chamá-los como 'nomeDaFuncao'
    // Exemplo de como carregar formatter: "./formatter" (se existir um arquivo formatter.js na mesma pasta)
    "lojacap/controller/formatter" // Assumindo que você tem um formatter.js
], function(Controller, JSONModel, MessageBox, MessageToast, formatter) {
    "use strict";

    return Controller.extend("lojacap.controller.nota-fiscal", {

        formatter: formatter, // Disponibiliza o formatter para a view

        onInit: function() {
            console.log("📜 Controller nota-fiscal.controller.js inicializado!");
            // Exemplo de inicialização de modelo local, se necessário para a view
            // var oViewModel = new JSONModel({
            // isBusy: false
            // });
            // this.getView().setModel(oViewModel, "view");
        },

        onProximaEtapa: async function () {
            console.log("▶️ Botão 'Próxima etapa' pressionado.");
        
            const oTable = this.byId("tableNotaFiscalServicoMonitor");
            const aSel   = oTable.getSelectedItems();
        
            if (!aSel.length) {
                MessageToast.show("Por favor, selecione pelo menos uma NFSe.");
                return;
            }
        
            // trocar por id se eu quiser
            const aIds = aSel.map(i => i.getBindingContext().getProperty("idAlocacaoSAP"));
            console.log("🆔 IDs das NFSe selecionadas:", aIds);
        
            const oModel = this.getView().getModel();          // ODataModel V4
            const oAction = oModel.bindContext("/avancarStatusNFs(...)", null, {
                $$groupId : "$direct"        // dispara logo, sem batch
            });
        
            oAction.setParameter("notasFiscaisIDs", aIds);
        
            try {
                const oResult = await oAction.execute();       // chama a action
                console.log("✅ Sucesso:", oResult);
        
                let ok = 0, erros = [];
                (oResult?.value || []).forEach(r =>
                    r.success ? ok++ : erros.push(`NF ${r.idAlocacaoSAP}: ${r.message}`)
                );
        
                if (erros.length) {
                    MessageBox.warning(
                        `Processamento: ${ok} ok, ${erros.length} erro(s).\n\n${erros.join("\n")}`,
                        { title: "Resultado" }
                    );
                } else {
                    MessageToast.show(`${ok} NFSe(s) processada(s) com sucesso!`);
                }
        
                oTable.getBinding("items").refresh();   // recarrega lista
                oTable.removeSelections(true);
        
            } catch (e) {
                console.error("❌ Erro na action:", e);
                MessageBox.error("Falha ao processar as NFSe.", {
                    details : e.message || e
                });
            }
        },

        onUpdateFinishedNotaFiscal: function(oEvent) {
            var sTitle = "Notas Fiscais de Serviço";
            var oTable = oEvent.getSource();
            var iTotalItems = oEvent.getParameter("total");

            if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
                sTitle = `Notas Fiscais de Serviço (${iTotalItems})`;
            }
            // Você pode querer atualizar um título na view com esta contagem
            // Ex: this.getView().getModel("view").setProperty("/tableTitle", sTitle);
            console.log(`📝 Tabela de NFSe atualizada. Total de itens: ${iTotalItems}`);
        }

        // ... quaisquer outras funções do seu controller
    });
});