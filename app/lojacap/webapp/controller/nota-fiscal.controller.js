sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Sorter",
    "lojacap/controller/formatter",
    "sap/ui/core/Fragment"
], function (Controller, JSONModel, MessageBox, MessageToast, Sorter, formatter, Fragment) {
    "use strict";

    return Controller.extend("lojacap.controller.nota-fiscal", {

        formatter   : formatter,
        _coresLinha : {},            // { id : 'linhaVerde' | 'linhaVermelha' }
        _oLogDialog : null,

        onInit() {
            console.log("📜 Controller nota-fiscal inicializado");
        },

      
        /* Seleção agora é “livre”; apenas logs                                */
       
        onSelectionChange(oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const bSel  = oEvent.getParameter("selected");
            if (oItem) {
                const ctx   = oItem.getBindingContext();
                console.log(`[SEL] ${bSel ? 'Selecionado' : 'Desmarcado'} – ID: ${ctx.getProperty("idAlocacaoSAP")}`);
            }
        },

       
        //Botão Próxima Etapa – expande seleção p/ todo o grupo     
       
        async onProximaEtapa() {
            const oTable = this.byId("tableNotaFiscalServicoMonitor");
            const oModel = this.getView().getModel();

            const aCtxSel = oTable.getSelectedContexts();
            if (!aCtxSel.length) {
                MessageToast.show("Por favor, selecione ao menos uma NFSe.");
                return;
            }

            // 1. Identifica grupo (filho + status)
            const grpFilho  = aCtxSel[0].getProperty("chaveDocumentoFilho");
            const grpStatus = aCtxSel[0].getProperty("status");
            const aIds      = [];                       // IDs do lote

            // === Marca TODAS as linhas do grupo como selecionadas
            oTable.getItems().forEach(item => {
                const ctx    = item.getBindingContext();
                if (!ctx) return;

                const filho  = ctx.getProperty("chaveDocumentoFilho");
                const status = ctx.getProperty("status");

                if (filho === grpFilho && status === grpStatus) {
                    const id = ctx.getProperty("idAlocacaoSAP");
                    aIds.push(id);
                    if (!item.getSelected()) item.setSelected(true);
                }
            });

            console.log("▶️ IDs enviados para action:", aIds);

           //action
            const oAction = oModel.bindContext("/avancarStatusNFs(...)");
            oAction.setParameter("notasFiscaisIDs", aIds);

            try {
                await oAction.execute();
                const payload     = oAction.getBoundContext().getObject();
                const resultados  = Array.isArray(payload) ? payload : (payload?.value || []);

                resultados.forEach(r => {
                    this._coresLinha[r.idAlocacaoSAP] = r.success ? "linhaVerde" : "linhaVermelha";
                });

                const ok   = resultados.filter(r => r.success).length;
                const errs = resultados.filter(r => !r.success);

                if (errs.length) {
                    const txt = errs.map(r => `NF ${r.idAlocacaoSAP}: ${r.message}`).join("\n");
                    MessageBox.warning(
                        `Processamento: ${ok} sucesso(s) e ${errs.length} erro(s).\n\n${txt}`,
                        { title: "Resultado do Processamento" }
                    );
                } else {
                    MessageToast.show(`${ok} NFSe(s) processada(s) com sucesso!`);
                }

                /* Após refresh, updateFinished pintará linhas */
                oTable.getBinding("items").refresh();

            } catch (e) {
                console.error("❌ Erro na action:", e);
                MessageBox.error("Falha ao processar as NFSe.", {
                    details: e.message || JSON.stringify(e)
                });
            }
        },

        onPressAscending() {
            const oBinding = this.byId("tableNotaFiscalServicoMonitor").getBinding("items");
            oBinding.sort(new Sorter("status", false));
            this.updateSortButtons?.("ascending");
        },

        onPressDescending() {
            const oBinding = this.byId("tableNotaFiscalServicoMonitor").getBinding("items");
            oBinding.sort(new Sorter("status", true));
            this.updateSortButtons?.("descending");
        },


        onLogPress() {
            const oView = this.getView();
            if (!this._oLogDialog) {
                Fragment.load({
                    name: "lojacap.view.fragments.NotaFiscalServicoLogDialog",
                    controller: this
                }).then(oDialog => {
                    oView.addDependent(oDialog);
                    oDialog.setModel(oView.getModel());
                    this._oLogDialog = oDialog;
                    oDialog.open();
                });
            } else {
                this._oLogDialog.open();
            }
        },
        onLogClose() {
            this._oLogDialog?.close();
        },

  
        onUpdateFinishedNotaFiscal(oEvent) {
            const aItems = oEvent.getSource().getItems();

            aItems.forEach(item => {
                const ctx = item.getBindingContext();
                if (!ctx) return;

                const id       = ctx.getProperty("idAlocacaoSAP");
                const classe   = this._coresLinha[id];
                if (!classe) return;

                if (classe === "linhaVerde") {
                    item.removeStyleClass("linhaVermelha");
                    item.addStyleClass("linhaVerde");
                } else {
                    item.removeStyleClass("linhaVerde");
                    item.addStyleClass("linhaVermelha");
                }
            });
        }
    });
});
