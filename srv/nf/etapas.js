// srv/nf/etapas.js
const cds = require('@sap/cds');
const { sucesso, falha, gravarLog } = require('./log');

function gerarNumeroNF() {
  return Math.floor(1_000_000_000 + Math.random() * 900_000_000).toString();
}

module.exports = function buildEtapas(srv) {
  // Acesso aos entities dentro do serviço
  const { NotaFiscalServicoMonitor } = srv.entities;

  /* --------------------------------------------------------- *
   *            Funções de AVANÇAR (01->05->15…)               *
   * --------------------------------------------------------- */
  async function trans01para05 (tx, ids) {
    const numeroNF = gerarNumeroNF();
  
    try {
      await tx.update(NotaFiscalServicoMonitor)
              .set({ status: '05', numeroNfseServico: numeroNF })
              .where({ idAlocacaoSAP: { in: ids } });
  
      /* loga sucesso */
      await Promise.all(
        ids.map(id =>
          gravarLog(tx, id,
            `Status 01→05 gerado – NF ${numeroNF}.`,
            'S', 'TRANS_01_05', '000')
        )
      );
  
      return sucesso(ids, '05', { numeroNfseServico: numeroNF });
  
    } catch (e) {
      for (const id of ids)
        await gravarLog(tx, id, e.message, 'E', 'TRANS_01_05', '002');
      return falha(ids, '01', 'Erro 01→05: ' + e.message);
    }
  }
  
  /* --------------------------------------------------- *
   * 05 → 15                                              *
   * --------------------------------------------------- */
  async function trans05para15 (tx, ids) {
    try {
      await tx.update(NotaFiscalServicoMonitor)
              .set({ status: '15' })
              .where({ idAlocacaoSAP: { in: ids } });
  
      await Promise.all(
        ids.map(id =>
          gravarLog(tx, id, 'Status 05→15 confirmado.', 'S', 'TRANS_05_15', '000')
        )
      );
  
      return sucesso(ids, '15');
  
    } catch (e) {
      for (const id of ids)
        await gravarLog(tx, id, e.message, 'E', 'TRANS_05_15', '003');
      return falha(ids, '05', 'Erro 05→15: ' + e.message);
    }
  }
  
  /* --------------------------------------------------- *
   * 15 → 30  (all-or-nothing)                            *
   * --------------------------------------------------- */
  async function trans15para30 (tx, notas) {
    const resultados     = [];
    const valoresPorNota = new Map();
    const erros          = new Map();
  
    /* 1. Validação BAPI ------------------------------------ */
    for (const nota of notas) {
      const id   = nota.idAlocacaoSAP;
      const resp = await BAPI_PO_CREATE1(nota);
  
      if (!resp.ok) {
        erros.set(id, resp.msg);
        await gravarLog(tx, id, resp.msg, 'E', 'BAPI_PO_CREATE1', '100');
        continue;
      }
      valoresPorNota.set(id, resp.valores);
    }
  
    /* 2. Houve erro → devolve só falhas --------------------- */
    if (erros.size) {
      notas.forEach(nota => {
        const id = nota.idAlocacaoSAP;
        resultados.push({
          idAlocacaoSAP : id,
          success       : false,
          message       : erros.get(id) ||
                          'Processo abortado — erros em outras NFs',
          novoStatus    : '15'
        });
      });
      return resultados;
    }
  
    /* 3. Nenhum erro → atualiza, loga sucessos -------------- */
    for (const nota of notas) {
      const id      = nota.idAlocacaoSAP;
      const valores = valoresPorNota.get(id);
  
      await tx.update(NotaFiscalServicoMonitor)
              .set({ status: '30', ...valores })
              .where({ idAlocacaoSAP: id });
  
      await gravarLog(
        tx, id,
        'Status 15→30 e valores gravados.',
        'S', 'TRANS_15_30', '000'
      );
  
      resultados.push({
        idAlocacaoSAP : id,
        success       : true,
        message       : 'Status 15→30 e valores gravados.',
        novoStatus    : '30'
      });
    }
    return resultados;
  }
  
  /* --------------------------------------------------- *
   * 30 → 35                                              *
   * --------------------------------------------------- */
  async function trans30para35 (tx, notas) {
    const resultados = [];
  
    for (const nota of notas) {
      const id = nota.idAlocacaoSAP;
      console.log(`[TRANSITION_LOG] Iniciando 30->35 para NF ${id}`);
  
      try {
        /* MIRO */
        const respMiro = await BAPI_INCOMINGINVOICE_CREATE1(nota);
        if (!respMiro.ok) throw new Error(respMiro.msg);
  
        /* NF */
        const respNF = await BAPI_J_1B_NF_CREATEFROMDATA(nota, respMiro.valores.numeroDocumentoMIRO);
        if (!respNF.ok) throw new Error(respNF.msg);
  
        /* sucesso */
        await tx.update(NotaFiscalServicoMonitor)
                .set({
                  status: '35',
                  numeroDocumentoMIRO: respMiro.valores.numeroDocumentoMIRO
                })
                .where({ idAlocacaoSAP: id });
  
        await gravarLog(
          tx, id,
          'Status 30→35 concluído com sucesso.',
          'S', 'TRANS_30_35', '000'
        );
  
        resultados.push({
          idAlocacaoSAP: id,
          success      : true,
          message      : 'Fatura e Nota Fiscal criadas com sucesso.',
          novoStatus   : '35'
        });
  
      } catch (error) {
        console.error(`[TRANSITION_LOG] Erro 30->35 para NF ${id}:`, error.message);
  
        await tx.update(NotaFiscalServicoMonitor)
                .set({ status: '99', MSG_TEXT: error.message.substring(0,120) })
                .where({ idAlocacaoSAP: id });
  
        await gravarLog(
          tx, id,
          error.message,
          'E', 'TRANS_30_35', '999'
        );
  
        resultados.push({
          idAlocacaoSAP: id,
          success      : false,
          message      : error.message,
          novoStatus   : '99'
        });
      }
    }
    return resultados;
  }
  
  /* --------------------------------------------------- *
   * 35 → 50                                              *
   * --------------------------------------------------- */
  async function trans35para50 (tx, ids) {
    await tx.update(NotaFiscalServicoMonitor)
            .set({ status: '50' })
            .where({ idAlocacaoSAP: { in: ids } });
  
    await Promise.all(
      ids.map(id =>
        gravarLog(tx, id, 'Status 35→50 confirmado.', 'S', 'TRANS_35_50', '000')
      )
    );
  
    return sucesso(ids, '50');
  }

  /* --------------------------------------------------------- *
   *            Funções de REVERTER (50->35->30…)              *
   * --------------------------------------------------------- */
 /** Reverte 50 → 35 */
async function trans50para35_reverso(tx, notas) {
    const ids = notas.map(n => n.idAlocacaoSAP);
    const criterio = { chaveDocumentoFilho: notas[0].chaveDocumentoFilho, status: notas[0].status };
    await tx.update(NotaFiscalServicoMonitor).set({ status: '35' }).where(criterio);
    return sucesso(ids, '35', {}, "Status revertido para 'Fatura Criada'.");
  }

/** Reverte 35 → 30 */
async function trans35para30_reverso(tx, notas) {
  const ids = notas.map(n => n.idAlocacaoSAP);
  const criterio = { chaveDocumentoFilho: notas[0].chaveDocumentoFilho, status: notas[0].status };
  await tx.update(NotaFiscalServicoMonitor).set({ status: '30', numeroDocumentoMIRO: null }).where(criterio);
  return sucesso(ids, '30', {}, "Status revertido. Dados da Fatura/MIRO removidos.");
}
/** Reverte 30 → 15 */
async function trans30para15_reverso(tx, notas) {
    const ids = notas.map(n => n.idAlocacaoSAP);
    const criterio = { chaveDocumentoFilho: notas[0].chaveDocumentoFilho, status: notas[0].status };
    await tx.update(NotaFiscalServicoMonitor)
        .set({ status: '15', valorBrutoNfse: 0.00, valorEfetivoFrete: 0.00, valorLiquidoFreteNfse: 0.00 })
        .where(criterio);
    return sucesso(ids, '15', {}, "Status revertido. Dados do Pedido de Compra removidos.");
  }
/** Reverte 15 → 05 */
async function trans15para05_reverso(tx, notas) {
    const ids = notas.map(n => n.idAlocacaoSAP);
    const criterio = { chaveDocumentoFilho: notas[0].chaveDocumentoFilho, status: notas[0].status };
    await tx.update(NotaFiscalServicoMonitor).set({ status: '05' }).where(criterio);
    return sucesso(ids, '05', {}, "Status revertido para 'NF Atribuída'.");
  }
/** Reverte 05 → 01 */
async function trans05para01_reverso(tx, notas) {
    const ids = notas.map(n => n.idAlocacaoSAP);
    const criterio = { chaveDocumentoFilho: notas[0].chaveDocumentoFilho, status: notas[0].status };
    await tx.update(NotaFiscalServicoMonitor).set({ status: '01', numeroNfseServico: null }).where(criterio);
    return sucesso(ids, '01', {}, "Status revertido para 'Não Atribuída'.");
  }

  async function BAPI_PO_CREATE1(nota) {
    const { valorBrutoNfse, valorEfetivoFrete, valorLiquidoFreteNfse } = nota;
    const temValor = (valorBrutoNfse        && valorBrutoNfse        > 0) ||
                     (valorEfetivoFrete     && valorEfetivoFrete     > 0) ||
                     (valorLiquidoFreteNfse && valorLiquidoFreteNfse > 0);
  
    if (temValor) return { ok: false, msg: 'Campos de valores já preenchidos.' };
  
    const bruto   = Math.floor(10_000 + Math.random() * 90_000);
    const efetivo = +(bruto * 0.10).toFixed(2);
    const liquido = +(efetivo * 0.80).toFixed(2);
  
    return {
      ok: true,
      valores: {
        valorBrutoNfse       : bruto,
        valorEfetivoFrete    : efetivo,
        valorLiquidoFreteNfse: liquido
      }
    };
  }

  async function BAPI_INCOMINGINVOICE_CREATE1(nota) {
    console.log(`[BAPI_SIMULATION] Criando MIRO para NF ${nota.idAlocacaoSAP}...`);
    // Aqui você pode adicionar lógicas de falha para teste, se quiser
    // if (nota.algumaCondicaoDeErro) {
    //    return { ok: false, msg: "Erro simulado na criação da MIRO." };
    // }
    return {
        ok: true,
        valores: {
            // Gera um número de documento de MIRO simulado
            numeroDocumentoMIRO: `510${Math.floor(1000000 + Math.random() * 9000000)}`
        }
    };
  }
  async function BAPI_J_1B_NF_CREATEFROMDATA(nota, miroDocNumber) {
    console.log(`[BAPI_SIMULATION] Criando NF de Serviço para MIRO ${miroDocNumber}...`);
    // if (miroDocNumber.endsWith('7')) { // Exemplo de condição de erro
    //    return { ok: false, msg: "Erro simulado: dados fiscais inválidos." };
    // }
    return { ok: true }; // Apenas confirma o sucesso
    }
    
  /* Exporta tudo que o service.js precisa */
  return {
    avancar: { trans01para05, trans05para15, trans15para30, trans30para35, trans35para50 },
    voltar : { trans50para35_reverso, trans35para30_reverso, trans30para15_reverso,
               trans15para05_reverso, trans05para01_reverso }
  };
};
