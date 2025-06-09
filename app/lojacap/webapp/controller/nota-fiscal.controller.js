sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "lojacap/controller/formatter"
], function (Controller, JSONModel, MessageBox, MessageToast, formatter) {
    "use strict";

    return Controller.extend("lojacap.controller.nota-fiscal", {

        formatter          : formatter,
        _coresLinha        : {},          // { idAlocacaoSAP : "linhaVerde" | "linhaVermelha" }


        onInit() {
            console.log("📜 Controller nota-fiscal.controller.js inicializado!");
        },


        onSelectionChange(oEvent) {
            const oListItem = oEvent.getParameter("listItem");
            const bSel      = oEvent.getParameter("selected");
            const oTable    = this.byId("tableNotaFiscalServicoMonitor");
            if (!oListItem) return;

            const oCtx          = oListItem.getBindingContext();
            const chaveFilhoSel = oCtx.getProperty("chaveDocumentoFilho");
            const statusSel     = oCtx.getProperty("status");

            if (bSel) {
                oTable.removeSelections(true);                      // limpa tudo
                oTable.getItems().forEach(item => {
                    const ctx   = item.getBindingContext();
                    const chave = ctx.getProperty("chaveDocumentoFilho");
                    const status= ctx.getProperty("status");
                    if (chave === chaveFilhoSel && status === statusSel) {
                        item.setSelected(true);
                    }
                });
            } else {
                oTable.getItems().forEach(item => {
                    const chave = item.getBindingContext().getProperty("chaveDocumentoFilho");
                    if (chave === chaveFilhoSel) item.setSelected(false);
                });
            }
        },
        
        async onProximaEtapa() {
            const oTable = this.byId("tableNotaFiscalServicoMonitor");
            const oModel = this.getView().getModel();

            const aCtx = oTable.getSelectedContexts();
            if (!aCtx.length) {
                MessageToast.show("Por favor, selecione ao menos uma NFSe.");
                return;
            }

            const aIds = aCtx.map(c => c.getProperty("idAlocacaoSAP"));
            console.log("▶️ IDs selecionadas:", aIds);

            const oAction = oModel.bindContext("/avancarStatusNFs(...)");
            oAction.setParameter("notasFiscaisIDs", aIds);

            try {
                await oAction.execute();
                const payload   = oAction.getBoundContext().getObject();
                const resultados = Array.isArray(payload) ? payload : (payload?.value || []);

                console.log(payload)
                console.log(resultados)

                /* === Atualiza mapa de cores somente para IDs do lote === */
                resultados.forEach(r => {
                    this._coresLinha[r.idAlocacaoSAP] =
                        r.success ? "linhaVerde" : "linhaVermelha";
                });

                let ok = 0; const erros = [];
                resultados.forEach(r => r.success ? ok++ :
                    erros.push(`NF ${r.idAlocacaoSAP}: ${r.message}`));

                if (erros.length) {
                    MessageBox.warning(
                        `Processamento concluído com ${ok} sucesso(s) e ${erros.length} erro(s).\n\n${erros.join("\n")}`,
                        { title: "Resultado do Processamento" }
                    );
                } else {
                    MessageToast.show(`${ok} NFSe(s) processada(s) com sucesso!`);
                    
                }

                /* dispara updateFinished → pintará linhas */
                oTable.getBinding("items").refresh();

            } catch (e) {
                console.error("❌ Erro na action:", e);
                MessageBox.error("Falha ao processar as NFSe.", {
                    details : e.message || JSON.stringify(e)
                });
            }
        },

        onUpdateFinishedNotaFiscal(oEvent) {
            const oTable = oEvent.getSource();
            const aItems = oTable.getItems();

            aItems.forEach(oItem => {
                const ctx = oItem.getBindingContext();
                if (!ctx) return;

                const id         = ctx.getProperty("idAlocacaoSAP");
                const classeNova = this._coresLinha[id];              // pode ser undefined

                if (!classeNova) return;                              // nunca colorida → ignora

                const temVerde = oItem.hasStyleClass("linhaVerde");
                const temVerm  = oItem.hasStyleClass("linhaVermelha");

                if (classeNova === "linhaVerde" && !temVerde) {
                    if (temVerm) oItem.removeStyleClass("linhaVermelha");
                    oItem.addStyleClass("linhaVerde");
                }
                if (classeNova === "linhaVermelha" && !temVerm) {
                    if (temVerde) oItem.removeStyleClass("linhaVerde");
                    oItem.addStyleClass("linhaVermelha");
                }
            });
        }

    });
});
