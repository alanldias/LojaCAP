sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Sorter",
    "lojacap/controller/formatter",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, MessageBox, MessageToast, Sorter, formatter, Fragment, Filter,FilterOperator) {
    "use strict";

    return Controller.extend("lojacap.controller.nota-fiscal", {

        formatter   : formatter,
        _coresLinha : {},            // { id : 'linhaVerde' | 'linhaVermelha' }
        _oLogDialog : null,

        onInit() {
            console.log("📜 Controller nota-fiscal inicializado");
        },

      
        /* Seleção agora é “livre”; apenas logs                                */
       
        onSelectionChange: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");   // linha clicada
            const bSel  = oEvent.getParameter("selected");   // true = selecionou
        
            if (!oItem) { return; }
        
            const oTable = this.byId("tableNotaFiscalServicoMonitor");
        
            if (bSel) {
                // 1) limpa todas as seleções (sem disparar um 2º evento)
                oTable.removeSelections(true);
        
                // 2) marca SÓ a linha clicada
                oItem.setSelected(true);
        
            } else {
                // Se o usuário acabou de desmarcar a linha, não faz nada:
                // nenhuma seleção ficará ativa (todas desmarcadas).
            }
        
            const ctx = oItem.getBindingContext();
            console.log(`[SEL] ${bSel ? 'Selecionado' : 'Desmarcado'} – ID: ${ctx.getProperty("idAlocacaoSAP")}`);
        },

        onMenuAction: function (oEvent) {
            const sId = oEvent.getParameter("item").getId();
            console.log("onMenuAction: Item do menu clicado:", sId);
            if (sId.endsWith("menuFiltroSelectfiltro")) {
                this.openFilterDialog();
            }
        },

        openFilterDialog: async function () {
            console.log("openFilterDialog: Abrindo o diálogo de filtro.");
            if (!this._oFilterDialog) {
                console.log("openFilterDialog: Carregando fragmento...");

                /* sem 'id' → controles vão para o Core (sap.ui.getCore().byId) */
                this._oFilterDialog = await Fragment.load({
                    name       : "lojacap.view.fragments.NFMonitorFilterDialog",
                    controller : this
                });
                this.getView().addDependent(this._oFilterDialog);
            }
            this._oFilterDialog.open();
        },

        onFilterCancel: function () {
            console.log("onFilterCancel: Fechando diálogo.");
            this._oFilterDialog.close();
        },

        /* ------------------- APLICA FILTROS ------------------- */
        onFilterApply: function () {
            console.log("--- onFilterApply: Iniciando a aplicação de filtros ---");

            const getVal = id => {
                const oCtrl = sap.ui.getCore().byId(id);
                if (!oCtrl) {
                    console.warn(`getVal: controle '${id}' não encontrado.`);
                    return null;
                }
                return oCtrl.getDateValue ? oCtrl.getDateValue() : oCtrl.getValue();
            };

            /* helper para montar range */
            const aFilters = [];
            const addRange = (idFrom, idTo, path) => {
                const v1 = getVal(idFrom);
                const v2 = getVal(idTo);
                if (!v1 && !v2) return;

                if (v1 && v2) {
                    console.log(`addRange: BETWEEN ${path}`, v1, v2);
                    aFilters.push(new Filter({ path, operator: FilterOperator.BT, value1: v1, value2: v2 }));
                } else if (v1) {
                    console.log(`addRange: GE ${path}`, v1);
                    aFilters.push(new Filter({ path, operator: FilterOperator.GE, value1: v1 }));
                } else {
                    console.log(`addRange: LE ${path}`, v2);
                    aFilters.push(new Filter({ path, operator: FilterOperator.LE, value1: v2 }));
                }
            };

            console.log("onFilterApply: Montando filtros...");
            addRange("inpIdSapFrom",    "inpIdSapTo",    "idAlocacaoSAP");
            addRange("inpOrderFrom",    "inpOrderTo",    "orderIdPL");
            addRange("inpStatusFrom",   "inpStatusTo",   "status");
            addRange("dpDateFrom",      "dpDateTo",      "dataEmissaoNfseServico");
            addRange("inpVlrBrutoFrom", "inpVlrBrutoTo", "valorBrutoNfse");

            console.log("onFilterApply: Filtros finais:", JSON.stringify(aFilters));

            const oTable   = this.byId("tableNotaFiscalServicoMonitor");
            const oBinding = oTable.getBinding("items");
            oBinding.filter(aFilters);
            console.log("onFilterApply: Filtros aplicados!");

            this._oFilterDialog.close();
        },
        //botão de reijetar frete
        async onRejeitarFrete() {
            const oTable = this.byId("tableNotaFiscalServicoMonitor");
            const oModel = this.getView().getModel();
            const aCtx   = oTable.getSelectedContexts();
        
            if (aCtx.length !== 1) {
                MessageToast.show("Selecione exatamente 1 NFSe para rejeitar.");
                return;
            }
        
            const id = aCtx[0].getProperty("idAlocacaoSAP");
            console.log("✖️ Rejeitando frete – ID:", id);
        
            const oAction = oModel.bindContext("/rejeitarFrete(...)");
            oAction.setParameter("idAlocacaoSAP", id);
        
            try {
                await oAction.execute();
                const res = oAction.getBoundContext().getObject();
                console.log("Resposta:", res);
        
                // /* atualiza mapa de cores para essa linha */
                // this._coresLinha[id] = res.success ? "linhaVermelha" : "linhaVerde"; // como aqui deu certo mas o 55 sempre vai ser vermelho então deixa assim ao contrario

                if (res.success) {
                    MessageToast.show("Frete rejeitado com sucesso (status 55).");
                } else {
                    MessageBox.error(`Falha ao rejeitar: ${res.message}`);
                }
        
                /* refresh table → updateFinished pintará */
                oTable.getBinding("items").refresh();
        
            } catch (e) {
                console.error("❌ Erro na action rejeitarFrete:", e);
                MessageBox.error("Falha ao rejeitar o frete.", {
                    details : e.message || JSON.stringify(e)
                });
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
            
                  /* === grupo de referência = primeiro item selecionado =========== */
            
                  const grpFilho = aCtxSel[0].getProperty("chaveDocumentoFilho");
            
                  const grpStatus = aCtxSel[0].getProperty("status");
            
               
            
                  console.log(`[NEXT] Grupo alvo -> filho:${grpFilho} | status:${grpStatus}`);
            
               
            
                  const aIds = []; // IDs que seguirão para action
            
               
            
                  /* === 1. percorre TODAS as linhas ================================= */
            
                  oTable.getItems().forEach(item => {
            
                    const ctx = item.getBindingContext();
            
                    if (!ctx) return;
            
               
            
                    const filho = ctx.getProperty("chaveDocumentoFilho");
            
                    const status = ctx.getProperty("status");
            
                    const id   = ctx.getProperty("idAlocacaoSAP");
            
               
            
                    const pertenceAoGrupo = filho === grpFilho && status === grpStatus;
            
               
            
                    /* Seleciona/deseleciona visualmente */
            
                    item.setSelected(pertenceAoGrupo);
            
               
            
                    /* monta lista de IDs */
            
                    if (pertenceAoGrupo) aIds.push(id);
            
                  });
            
               
            
                  console.log("▶️ IDs enviados para action:", aIds);
            
               
            
                  /* === 2. dispara action ========================================== */
            
                  const oAction = oModel.bindContext("/avancarStatusNFs(...)");
            
                  oAction.setParameter("notasFiscaisIDs", aIds);
            
               
            
                  try {
            
                    await oAction.execute();
            
                    const payload  = oAction.getBoundContext().getObject();
            
                    const resultados = Array.isArray(payload) ? payload : (payload?.value || []);
            
               
            
                    // resultados.forEach(r => {
            
                    //   /* pinta conforme resultado */
            
                    //   this._coresLinha[r.idAlocacaoSAP] = r.success ? "linhaVerde" : "linhaVermelha";
            
                    // });
            
               
            
                    const ok  = resultados.filter(r => r.success).length;
            
                    const errs = resultados.filter(r => !r.success);
            
                    if (errs.length) {
            
                      const txt = errs.map(r => `NF ${r.idAlocacaoSAP}: ${r.message}`).join("\n");
            
                      MessageBox.warning(`Processamento: ${ok} sucesso(s) e ${errs.length} erro(s).\n\n${txt}`,           
                               { title: "Resultado do Processamento" });          
                    } else {           
                      MessageToast.show(`${ok} NFSe(s) processada(s) com sucesso!`);
            
                    }  
                    oTable.getBinding("items").refresh();
                 } catch (e) {            
                    console.error("❌ Erro na action:", e);           
                    MessageBox.error("Falha ao processar as NFSe.", {           
                      details: e.message || JSON.stringify(e)          
                    });            
                  }
                },
        async onVoltarEtapa() {
            const oTable = this.byId("tableNotaFiscalServicoMonitor");
            const oModel = this.getView().getModel();
            const aCtxSel = oTable.getSelectedContexts();

            if (!aCtxSel.length) {
                MessageToast.show("Por favor, selecione ao menos uma NFSe para reverter.");
                return;
            }

            const grpFilho = aCtxSel[0].getProperty("chaveDocumentoFilho");
            const grpStatus = aCtxSel[0].getProperty("status");
            console.log(`[REVERT] Grupo alvo -> filho:${grpFilho} | status:${grpStatus}`);

            const aIds = [];
            oTable.getItems().forEach(item => {
                const ctx = item.getBindingContext();
                if (!ctx) return;
                const filho = ctx.getProperty("chaveDocumentoFilho");
                const status = ctx.getProperty("status");
                const id = ctx.getProperty("idAlocacaoSAP");
                const pertenceAoGrupo = filho === grpFilho && status === grpStatus;
                item.setSelected(pertenceAoGrupo);
                if (pertenceAoGrupo) aIds.push(id);
            });

            console.log("◀️ IDs enviados para action de reversão:", aIds);

            const oAction = oModel.bindContext("/voltarStatusNFs(...)");
            oAction.setParameter("notasFiscaisIDs", aIds);

            try {
                await oAction.execute();
                const payload = oAction.getBoundContext().getObject();
                const resultados = Array.isArray(payload) ? payload : (payload?.value || []);

                // Limpa o mapa de cores para os itens processados, para que voltem ao normal
                resultados.forEach(r => {
                    delete this._coresLinha[r.idAlocacaoSAP];
                });

                const ok = resultados.filter(r => r.success).length;
                const errs = resultados.filter(r => !r.success);

                if (errs.length) {
                    const txt = errs.map(r => `NF ${r.idAlocacaoSAP}: ${r.message}`).join("\n");
                    MessageBox.warning(`Processamento: ${ok} sucesso(s) e ${errs.length} erro(s) na reversão.\n\n${txt}`,
                        { title: "Resultado da Reversão" });
                } else {
                    MessageToast.show(`${ok} NFSe(s) revertida(s) com sucesso!`);
                }

                oTable.getBinding("items").refresh();

            } catch (e) {
                console.error("❌ Erro na action voltarStatusNFs:", e);
                MessageBox.error("Falha ao reverter o status das NFSe.", {
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
        
                const id      = ctx.getProperty("idAlocacaoSAP");
                const status  = ctx.getProperty("status");    // status da linha
        
                /* 1. Remove cores antigas para evitar acúmulo */
                item.removeStyleClass("linhaVerde");
                item.removeStyleClass("linhaVermelha");
        
                /* 2. Cor proveniente do último lote (_coresLinha) */
                const classeLote = this._coresLinha[id];
        
                if (classeLote === "linhaVerde") {
                    item.addStyleClass("linhaVerde");
                } else if (classeLote === "linhaVermelha") {
                    item.addStyleClass("linhaVermelha");
                } else if (status === "55") {
                    /* 3. Nenhuma cor do lote, mas status 55 → vermelho */
                    item.addStyleClass("linhaVermelha");
                } else if (status === "50") {
                    /* 3. Nenhuma cor do lote, mas status 55 → vermelho */
                    item.addStyleClass("linhaVerde");
                } 
                /* status diferente de 55 e sem cor no lote → fica sem cor */
            });
        }
       
    });
});
