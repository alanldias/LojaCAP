sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "lojacap/controller/formatter"
  ], (
    Controller, MessageBox, MessageToast,
    Filter, FilterOperator, Sorter, JSONModel, Fragment, formatter
  ) => {
    "use strict";
  
    /* =========================================================== *
     *  Constantes (IDs de campos / paths que se repetem)           *
     * =========================================================== */
    const TBL_NOTAS = "tableNotaFiscalServicoMonitor";
    const PATH_LOGS = "/NotaFiscalServicoLog";
    const FILTER_ERRO = new Filter("tipoMensagemErro", FilterOperator.EQ, "E");
   
      
    /* =========================================================== *
     *  Controller                                                 *
     * =========================================================== */
    return Controller.extend("lojacap.controller.nota-fiscal", {
  
      formatter,                                   // exposição direta
      /* estado “privado” ---------------------------------------------------- */
      _coresLinha   : Object.create(null),         // { id : 'linhaVerde' | 'linhaVermelha' }
      _oFilterDialog: null,
      _oLogDialog   : null,
      _filtroIdsErro: null,
      _oUploadDialog: null,
      _oCriarFreteDialog: null,
      _selGrpFilho  : null,
      _selGrpStatus : null,                        // toggle do botão “NF c/ erro”
  
      /* ======================================================= *
       *  Lifecycle                                              *
       * ======================================================= */
      onInit() {
        console.log("📜 nota-fiscal controller ready");
        
        const oTotalModel = new JSONModel({
            mostrarTotais: false,
            bruto: { value: "", visible: false },
            liquido: { value: "", visible: false },
            frete: { value: "", visible: false }
        });
        this.getView().setModel(oTotalModel, "totalModel");
      },
  
      /* ======================================================= *
       *  SELEÇÃO (apenas 1 linha por vez)                       *
       * ======================================================= */
      onSelectionChange(oEvt) {
        const oItem = oEvt.getParameter("listItem");
        const bSel  = oEvt.getParameter("selected");
        if (!oItem || !bSel) return;            // ignorar desmarcar
      
        const oTable = this.byId(TBL_NOTAS);
      
        /* limpa tudo, marca a linha clicada */
        oTable.removeSelections(true);
        oItem.setSelected(true);
      
        /* reaproveita o helper → seleciona visualmente todo o grupo */
        this._collectIdsDoGrupo();              // ← nada de variáveis extras
      },
      
      /* ======================================================= *
       *  MENU / FILTRO                                          *
       * ======================================================= */
      onMenuAction(oEvt) {
        if (oEvt.getParameter("item").getId().endsWith("menuFiltroSelectfiltro")) {
          this.openFilterDialog();
        }
      },
  
      /* ---------- diálogo de filtro ---------- */
      async openFilterDialog() {
        if (!this._oFilterDialog) {
          this._oFilterDialog = await Fragment.load({
            name      : "lojacap.view.fragments.NFMonitorFilterDialog",
            controller: this
          });
          this.getView().addDependent(this._oFilterDialog);
        }
        this._oFilterDialog.open();
      },
      onFilterCancel() { this._oFilterDialog.close(); },
  
      /* ---------- aplicar filtros ---------- */
      onFilterApply() {
        const oTable   = this.byId(TBL_NOTAS);
        const oBinding = oTable.getBinding("items");
  
        /* helper leitura de campo (Input / DatePicker) */
        const readVal = id => {
          const c = sap.ui.getCore().byId(id);
          return c?.getDateValue?.() ?? c?.getValue?.() ?? null;
        };
  
        /* helper range → filter */
        const filters = [];
        const addRange = (fromId, toId, path) => {
          const v1 = readVal(fromId), v2 = readVal(toId);
          if (!v1 && !v2) return;
          const op = v1 && v2 ? FilterOperator.BT
                : v1 ? FilterOperator.GE : FilterOperator.LE;
          filters.push(new Filter(path, op, v1 || v2, v2));
        };
  
        addRange("inpIdSapFrom", "inpIdSapTo", "idAlocacaoSAP");
        addRange("inpOrderFrom", "inpOrderTo", "orderIdPL");
        addRange("inpStatusFrom","inpStatusTo","status");
        addRange("dpDateFrom",   "dpDateTo",   "dataEmissaoNfseServico");
        addRange("inpVlrBrutoFrom","inpVlrBrutoTo","valorBrutoNfse");
  
        oBinding.filter(filters);
        console.log("🔎 filtros aplicados:", filters);
        this._oFilterDialog.close();
      },

      // ====================================================
      // ATUALIZAR TABELA E LIMPAR FILTROS
      // ====================================================
      onAtualizar() {
        const oTable = this.byId(TBL_NOTAS);
        const oBind  = oTable.getBinding("items");
      
        /* 1. remove qualquer filtro ativo */
        oBind.filter([]);
        this._filtroIdsErro = null;          // zera flag do botão “NF c/ erro”
      
        /* 2. limpa seleções e estado de grupo */
        oTable.removeSelections();
        this._selGrpFilho  = null;
        this._selGrpStatus = null;
      
        oBind.refresh();                     // ← sem “true” aqui
      
        sap.m.MessageToast.show("Dados atualizados.");
      },
  
      /* ======================================================= *
       *  AÇÕES de negócios                                      *
       * ======================================================= */
      /* ---------- rejeitar frete ---------- */
      async onRejeitarFrete() {
        /* 1. obtém o grupo a partir da linha selecionada */
        const { grpFilho } = this._collectIdsDoGrupo();

        const oAction = this.getView().getModel().bindContext("/rejeitarFrete(...)");
        oAction.setParameter("grpFilho", grpFilho);;

        /* 3. delega exibição de toast/erros ao helper genérico      */
        await this._executeLote(oAction, "NFSe rejeitada(s)");

        /* 4. se o filtro “NF c/ erro” estiver ativo, refaz a busca  */
        if (this._filtroIdsErro) {
          await this.onFilterNfComErro();   // remove
          await this.onFilterNfComErro();   // aplica novamente
        }
      },
  
      async onProximaEtapa() {
        /* ainda usamos o helper só para descobrir o grupo selecionado */
        const { grpFilho } = this._collectIdsDoGrupo();
        if (!grpFilho) return;               // nada selecionado
      
        /* dispara a action enviando somente grpFilho */
        const oAction = this.getView().getModel().bindContext("/avancarStatusNFs(...)");
        oAction.setParameter("grpFilho", grpFilho);   // único parâmetro agora
      
        await this._executeLote(oAction, "NFSe processada(s)");
      },
  
      /* ---------- voltar etapa (lote) ---------- */
      async onVoltarEtapa() {
        const { grpFilho, grpStatus } = this._collectIdsDoGrupo();
        if (!grpFilho) {
            return;
        }

        const oAction = this.getView().getModel()
            .bindContext("/voltarStatusNFs(...)");

        oAction.setParameter("grpFilho", grpFilho);
        oAction.setParameter("grpStatus", grpStatus); 

        await this._executeLote(oAction, "NFSe revertida(s)");
      },

    /* ====================================================== *
    *  CSV - Upload de Arquivo                                *
    * ======================================================= */

    onOpenUploadDialog: function () {
        if (!this._oUploadDialog) {
            Fragment.load({
                id: this.getView().getId(), // Adiciona o ID da view como prefixo
                name: "lojacap.view.fragments.UploadFreteDialog", // Use o caminho correto do seu fragmento
                controller: this
            }).then(oDialog => {
                this._oUploadDialog = oDialog;
                this.getView().addDependent(this._oUploadDialog);
                this._oUploadDialog.open();
            });
        } else {
            this._oUploadDialog.open();
        }
    },
    
    // Fecha o Dialog
    onUploadDialogClose: function () {
        this._resetFileUploader();
        if (this._oUploadDialog) {
            this._oUploadDialog.close();
        }
    },
    
    // Evento disparado ao selecionar um arquivo
    onFileChange: function (oEvent) {
        // Guarda a referência do arquivo e habilita o botão de upload
        this._file = oEvent.getParameter("files") && oEvent.getParameter("files")[0];
        this.byId("btnConfirmUpload").setEnabled(!!this._file);
    },
    
    // Disparado ao clicar no botão "Processar" do Dialog
    onPressUploadFrete: function () {
        if (!this._file) {
            MessageBox.error("Por favor, selecione um arquivo CSV.");
            return;
        }
    
        // Usa a API FileReader para ler o conteúdo do arquivo no navegador
        const oReader = new FileReader();
    
        // Callback para quando a leitura do arquivo for concluída
        oReader.onload = (oEvent) => {
            var sFileContent = oEvent.target.result;
            console.log("[FRONTEND-LOG] Arquivo lido. O conteúdo em Base64 começa com:", sFileContent.substring(0, 80));
            this._callUploadAction(sFileContent);
        };
    
        oReader.onerror = (oError) => {
            MessageBox.error("Erro ao ler o arquivo selecionado.");
            console.error("FileReader Error:", oError);
        };
    
        // Inicia a leitura do arquivo
        oReader.readAsDataURL(this._file);
    },

    /* ====================================================== *
    *  Inserção Frete Manual                                  *
    * ======================================================= */

    onAbrirDialogoCriacao: function () {
        const oView = this.getView();
        // Modelo JSON com uma estrutura vazia para o formulário
        const oNovoRegistroModel = new JSONModel({
            status: "01", // Status inicial padrão
            issRetido: "2",
            estornado: false,
            logErroFlag: false
            // Outros campos iniciarão como undefined ou vazios
        });
    
        if (!this._oCriarFreteDialog) {
            Fragment.load({
                id: oView.getId(),
                name: "lojacap.view.fragments.CriarFreteDialog",
                controller: this
            }).then(oDialog => {
                this._oCriarFreteDialog = oDialog;
                oView.addDependent(this._oCriarFreteDialog);
                oDialog.setModel(oNovoRegistroModel, "novoRegistro");
                oDialog.open();
            });
        } else {
            // Limpa o modelo com a estrutura padrão e abre o dialog
            this._oCriarFreteDialog.getModel("novoRegistro").setData(oNovoRegistroModel.getData());
            this._oCriarFreteDialog.open();
        }
    },
    onCancelarDialogoCriacao: function() {
        this._oCriarFreteDialog.close();
    },
    onSalvarNovoRegistro: function() {
        const oDialog = this.byId("criarFreteDialog");
        const oNovoRegistroModel = oDialog.getModel("novoRegistro");
        const oNovoRegistroData = oNovoRegistroModel.getData();
    
        // 1. Validação no Frontend (UX Imediata)
        if (!oNovoRegistroData.idAlocacaoSAP || !oNovoRegistroData.orderIdPL) {
            MessageBox.error("Por favor, preencha os campos de identificação obrigatórios.");
            return;
        }
        const oModel = this.getView().getModel();
        // O binding para a coleção correta
        const oListBinding = oModel.bindList("/NotaFiscalServicoMonitor");
    
        oDialog.setBusy(true);
    
        // 2. Chamada para o CREATE padrão do OData
        oListBinding.create(oNovoRegistroData)
            .created()
            .then(() => {
                MessageToast.show("Novo registro de frete criado com sucesso!");
                this.byId("tableNotaFiscalServicoMonitor").getBinding("items").refresh();
            })
            .catch((oError) => {
                MessageBox.error("Erro ao criar registro: " + oError.message);
            })
            .finally(() => {
                oDialog.setBusy(false);
                oDialog.close();
            });
        },
  
      /* ======================================================= *
       *  SORT                                                   *
       * ======================================================= */
      onPressAscending()  { this._sortByStatus(false); },
      onPressDescending() { this._sortByStatus(true ); },

      /* ======================================================= *
       *  Botão de Soma                                          *
       * ======================================================= */

      onCalcularTotal: function(oEvent) {
        const oMenuItem = oEvent.getParameter("item");
        const sActionKey = oMenuItem.data("coluna");

        const oTable = this.byId(TBL_NOTAS);
        // MUDANÇA CRÍTICA: Pegamos os itens renderizados, não os contextos do binding.
        const aItems = oTable.getItems(); 
        const oTotalModel = this.getView().getModel("totalModel");

        // Limpa a visibilidade de todos os totais antes de calcular
        
        oTotalModel.setProperty("/bruto/visible", false);
        oTotalModel.setProperty("/liquido/visible", false);
        oTotalModel.setProperty("/frete/visible", false);

        if (sActionKey === "limpartodos") {
          oTotalModel.setProperty("/bruto", { value: "", visible: false });
          oTotalModel.setProperty("/liquido", { value: "", visible: false });
          oTotalModel.setProperty("/frete", { value: "", visible: false });
          oTotalModel.setProperty("/mostrarTotais", false); // Oculta o footer inteiro
      
          MessageToast.show("Totais limpos.");
          return; 
      }

        if (sActionKey === "todos") {
            // Passamos a lista de itens para a função auxiliar
            const sTotalBruto = this._calculateColumnTotal(aItems, "valorBrutoNfse");
            const sTotalLiquido = this._calculateColumnTotal(aItems, "valorLiquidoFreteNfse");
            const sTotalFrete = this._calculateColumnTotal(aItems, "valorEfetivoFrete");

            oTotalModel.setProperty("/bruto/value", sTotalBruto);
            oTotalModel.setProperty("/liquido/value", sTotalLiquido);
            oTotalModel.setProperty("/frete/value", sTotalFrete);

            oTotalModel.setProperty("/bruto/visible", true);
            oTotalModel.setProperty("/liquido/visible", true);
            oTotalModel.setProperty("/frete/visible", true);
            oTotalModel.setProperty("/mostrarTotais", true);

            MessageToast.show("Todos os totais foram calculados.");

        } else {
            const sTotalFormatado = this._calculateColumnTotal(aItems, sActionKey);
            
            if (sActionKey === 'valorBrutoNfse') {
                oTotalModel.setProperty("/bruto/value", sTotalFormatado);
                oTotalModel.setProperty("/bruto/visible", true);
                oTotalModel.setProperty("/mostrarTotais", true);
            } else if (sActionKey === 'valorLiquidoFreteNfse') {
                oTotalModel.setProperty("/liquido/value", sTotalFormatado);
                oTotalModel.setProperty("/liquido/visible", true);
                oTotalModel.setProperty("/mostrarTotais", true);
            } else if (sActionKey === 'valorEfetivoFrete') {
                oTotalModel.setProperty("/frete/value", sTotalFormatado);
                oTotalModel.setProperty("/frete/visible", true);
                oTotalModel.setProperty("/mostrarTotais", true);
            }

            MessageToast.show(`Total da coluna '${oMenuItem.getText()}' calculado: ${sTotalFormatado}`);
        }
    },

      /* ======================================================= *
       *  Imprimir                                               *
       * ======================================================= */

      onPressPrint: function ()  {
        const oController = this; 
        const oTable = oController.byId("tableNotaFiscalServicoMonitor");
        sap.ui.require(["lojacap/util/PrintUtil"], function (PrintUtil) {
            MessageToast.show("Módulo de impressão carregado sob demanda!");
            PrintUtil.printTable(oTable, oController._coresLinha);
        });
    },
  
      /* ======================================================= *
       *  LOG – diálogo e filtro “NF com erro”                   *
       * ======================================================= */
      onLogPress() {
        if (!this._oLogDialog) {
          Fragment.load({
            name      : "lojacap.view.fragments.NotaFiscalServicoLogDialog",
            controller: this
          }).then(oDlg => {
            this.getView().addDependent(oDlg);
            oDlg.setModel(this.getView().getModel());

            /* sempre que o diálogo abrir ⇒ refresh nos logs */
            oDlg.attachAfterOpen(() => this._refreshLogs());
      
            this._oLogDialog = oDlg;
            oDlg.open();
          });
        } else {
          this._refreshLogs();    // força leitura antes de reabrir
          this._oLogDialog.open();
        }
      },
      onLogClose() { this._oLogDialog?.close(); },
  
      /* ---------- botão “NF c/ erro” ---------- */
      async onFilterNfComErro() {
        const oTable = this.byId(TBL_NOTAS);
        const oBind  = oTable.getBinding("items");
  
        /* toggle → remove filtro */
        if (this._filtroIdsErro) {
          oBind.filter([]);
          this._filtroIdsErro = null;
          return;
        }
  
        sap.ui.core.BusyIndicator.show(0);
        try {
          const aIds = await this._getIdsComErro();
          if (!aIds.length) {
            MessageToast.show("Nenhuma NF com erro.");
            return;
          }
          const orFilter = new Filter({
            filters: aIds.map(id => new Filter("idAlocacaoSAP", FilterOperator.EQ, id)),
            and    : false
          });
          oBind.filter(orFilter);
          this._filtroIdsErro = orFilter;
        } catch (e) { this._handleActionError("filtrar logs", e); }
        finally { sap.ui.core.BusyIndicator.hide(); }
      },
  
      /* ======================================================= *
       *  RENDERING (cores)                                      *
       * ======================================================= */
      onUpdateFinishedNotaFiscal(oEvt) {
        const aItems = oEvt.getSource().getItems();
      
        /* 🎨 cores já existentes ------------------------------ */
        aItems.forEach(item => {
          const ctx    = item.getBindingContext();
          const id     = ctx?.getProperty("idAlocacaoSAP");
          const status = ctx?.getProperty("status");
      
          item.toggleStyleClass("linhaVerde",
            this._coresLinha[id] === "linhaVerde" || status === "50");
          item.toggleStyleClass("linhaVermelha",
            this._coresLinha[id] === "linhaVermelha" || status === "55");
        });
      
        /* ✅ se ainda há algo selecionado → amplia para as linhas novas */
        const oTable = this.byId(TBL_NOTAS);
        if (oTable.getSelectedContexts().length) {
          this._collectIdsDoGrupo();            // reaplica seleção ao novo lote
        }
      },
  
      /* ======================================================= *
       *  HELPERS privados                                       *
       * ======================================================= */
      /** único ID selecionado → bind action */
      _prepareSingleIdAction(path) {
        const oTable = this.byId(TBL_NOTAS);
        const aCtx   = oTable.getSelectedContexts();
        if (aCtx.length !== 1) {
          MessageToast.show("Selecione exatamente 1 NFSe.");
          return {};
        }
        const id      = aCtx[0].getProperty("idAlocacaoSAP");
        const oAction = this.getView().getModel().bindContext(path)
                           .setParameter(path.includes("rejeitar") ? "idAlocacaoSAP" : "notasFiscaisIDs", path.includes("rejeitar") ? id : [id]);
        return { id, oAction };
      },
  
      /** coleta IDs do mesmo grupo (filho + status) — usado em avançar / voltar */
      _collectIdsDoGrupo() {
        const oTable    = this.byId(TBL_NOTAS);
        const aCtxSel   = oTable.getSelectedContexts();
        if (!aCtxSel.length) {
          MessageToast.show("Selecione ao menos uma NFSe.");
          return {};
        }
        const grpFilho  = aCtxSel[0].getProperty("chaveDocumentoFilho");
        const grpStatus = aCtxSel[0].getProperty("status");
        const aIds      = [];
         oTable.getItems().forEach(item => {
          const c = item.getBindingContext();
          const match = c && c.getProperty("chaveDocumentoFilho") === grpFilho &&
                        c.getProperty("status") === grpStatus;
          item.setSelected(match);
          if (match) aIds.push(c.getProperty("idAlocacaoSAP"));
        });
        return { aIds, grpFilho, grpStatus };
      },
  
      /** executa action de lote e mostra toast/erros */
      async _executeLote(oAction, toastSuccess) {
        try {
          await oAction.execute();
          const res   = oAction.getBoundContext().getObject();
          const lista = Array.isArray(res) ? res : (res?.value || []);
          const ok    = lista.filter(r => r.success).length;
          const errs  = lista.filter(r => !r.success);
          if (errs.length) {
            MessageBox.warning(
              `Processamento: ${ok} sucesso(s) e ${errs.length} erro(s).\n\n` +
              errs.map(r => `NF ${r.idAlocacaoSAP}: ${r.message}`).join("\n"),
              { title: "Resultado" }
            );
          } else { MessageToast.show(`${ok} ${toastSuccess}`); }
          this._refreshNotas();
        } catch (e) { this._handleActionError("action", e); }
      },
  
      _refreshNotas() { this.byId(TBL_NOTAS).getBinding("items").refresh(); },
  
      _sortByStatus(desc) {
        this.byId(TBL_NOTAS).getBinding("items").sort(new Sorter("status", desc));
      },
  
      /** busca IDs cujo log mais recente é 'E' */
      async _getIdsComErro() {
        const oModel = this.getView().getModel();
      
        /* bindList já com filtro tipoMensagemErro = 'E' e ordem decrescente */
        const bLog = oModel.bindList(
          PATH_LOGS,
          null,
          [ new Sorter("createdAt", true) ],   // true = descending
          [ FILTER_ERRO ]
        );
      
        /* traz TODOS os contextos de uma vez */
        const aCtx = await bLog.requestContexts(0, Infinity);
        if (!aCtx.length) { return []; }
      
        /* mantém o primeiro (mais recente) de cada NF */
        const latest = Object.create(null);          // id -> true
        aCtx.forEach(ctx => {
          const o = ctx.getObject();
          if (!latest[o.idAlocacaoSAP]) {
            latest[o.idAlocacaoSAP] = true;          // 1º já é o mais novo
          }
        });
        return Object.keys(latest);                  // lista de IDs
      },
  
      _handleActionError(tag, err) {
        console.error(`❌ ${tag}:`, err);
        MessageBox.error(err.message || JSON.stringify(err));
      },

      _refreshLogs() {
        const oTable = sap.ui.getCore().byId("logTable");
        if (!oTable) return;
      
        const oBind = oTable.getBinding("items");
        if (oBind) {
          /* ↙  aplica o sort antes de refrescar  */
          oBind.sort(this._logSorter ||= new sap.ui.model.Sorter("createdAt", /*descending=*/true));
      
          oTable.setBusy(true);
          Promise.resolve(oBind.refresh())           // OData V4 → nova query c/ $orderby
            .finally(() => oTable.setBusy(false));
        }
      },

    /* ======================================================= *
     *  HELPERS privados                                       *
     * ======================================================= */

    // ***** COLE A FUNÇÃO _calculateColumnTotal AQUI *****
    _calculateColumnTotal: function(aItems, sColunaKey) {
        let fTotal = 0;
        // Agora iteramos sobre os itens da tabela (ex: ColumnListItem)
        aItems.forEach(oItem => {
            // E pegamos o contexto de binding de cada item
            const oContext = oItem.getBindingContext();
            if (!oContext) {
                return;
            }

            const oRowData = oContext.getObject();
            const sValor = oRowData[sColunaKey];

            if (sValor && (typeof sValor === 'number' || !isNaN(sValor))) {
                const fValor = typeof sValor === 'number' ? sValor : parseFloat(String(sValor).replace(/\./g, '').replace(',', '.'));
                fTotal += fValor;
            }
        });
        return fTotal.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    },
    
    // Dispara para fazer o upload do arquivo de frete.
    _callUploadAction: function(sFileContent) {
        const oModel = this.getView().getModel();
        const oActionBinding = oModel.bindContext("/uploadArquivoFrete(...)");
    
        oActionBinding.setParameter("data", sFileContent);
        this.getView().setBusy(true);
    
        console.log("[FRONTEND-LOG] Preparando para executar a action 'uploadArquivoFrete' no backend.");
    
        oActionBinding.execute()
            .then(() => {
                console.log("[FRONTEND-LOG] Ação 'uploadArquivoFrete' executada com sucesso no backend.");
                const bSuccess = oActionBinding.getBoundContext().getObject();
                if (bSuccess) {
                    MessageBox.success("Arquivo processado e registros importados com sucesso!");
                    this.byId("tableNotaFiscalServicoMonitor").getBinding("items").refresh();
                    this.onUploadDialogClose();
                }
            })
            .catch((oError) => {
                console.error("[FRONTEND-LOG] Erro retornado pelo backend ao executar a ação:", oError);
                MessageBox.error(oError.message); 
            })
            .finally(() => {
                this.getView().setBusy(false);
            });
    },
    
    // Reseta o FileUploader para um novo upload
    _resetFileUploader: function() {
        const oFileUploader = this.byId("fileUploader");
        if (oFileUploader) {
            oFileUploader.clear();
            this.byId("btnConfirmUpload").setEnabled(false);
            this._file = null;
        }
    }
    });  
});
  