// srv/nf/etapas.js
const cds = require('@sap/cds');
const { sucesso, falha, gravarLog } = require('./log');

const { SELECT } = cds;   // se precisar
function gerarNumeroNF() {
  return Math.floor(1_000_000_000 + Math.random() * 900_000_000).toString();
}

module.exports = function buildEtapas(srv) {
  // Acesso aos entities dentro do serviço
  const { NotaFiscalServicoMonitor } = srv.entities;

  /* --------------------------------------------------------- *
   *            Funções de AVANÇAR (01->05->15…)               *
   * --------------------------------------------------------- */
  async function trans01para05(tx, ids) {
    const numeroNF = gerarNumeroNF();
    try {
      await tx.update(NotaFiscalServicoMonitor)
              .set({ status: '05', numeroNfseServico: numeroNF })
              .where({ idAlocacaoSAP: { in: ids } });
      return sucesso(ids, '05', { numeroNfseServico: numeroNF });
    } catch (e) {
      for (const id of ids)
        await gravarLog(tx, id, e.message, 'E', 'TRANS_01_05', '002');
      return falha(ids, '01', 'Erro 01→05: ' + e.message);
    }
  }

 /** 05 → 15 (apenas status) */
async function trans05para15(tx, ids) {
    try {
      await tx.update(NotaFiscalServicoMonitor)
              .set({ status: '15' })
              .where({ idAlocacaoSAP: { in: ids } });
      return sucesso(ids, '15');
    } catch (e) {
      for (const id of ids)
        await gravarLog(tx, id, e.message, 'E', 'TRANS_05_15', '003');
      return falha(ids, '05', 'Erro 05→15: ' + e.message);
    }
  }

 /** 15 → 30  (all-or-nothing, lista **todos** os erros) */
async function trans15para30(tx, notas) {
  const resultados     = [];
  const valoresPorNota = new Map();
  const erros          = new Map();

  for (const nota of notas) {
    const id   = nota.idAlocacaoSAP;
    const resp = await BAPI_PO_CREATE1(nota);

    if (!resp.ok) {
      erros.set(id, resp.msg);
      await gravarLog(tx, id, resp.msg, 'E', 'BAPI_PO_CREATE1', '100');
      continue;                               // continua validando
    }
    valoresPorNota.set(id, resp.valores);
  }

  if (erros.size) {
    const idsComErro = [...erros.keys()].join(', ');
    notas.forEach(nota => {
      const id  = nota.idAlocacaoSAP;
      resultados.push({
        idAlocacaoSAP : id,
        success       : false,
        message       : erros.get(id) ||
                        `Processo abortado — erros nas NFs em outras NFS`,
        novoStatus    : '15'
      });
    });
    return resultados;
  }

  /* 3. Nenhum erro → grava todas e devolve sucesso - */
  for (const nota of notas) {
    const id      = nota.idAlocacaoSAP;
    const valores = valoresPorNota.get(id);

    await tx.update(NotaFiscalServicoMonitor)
            .set({ status: '30', ...valores })
            .where({ idAlocacaoSAP: id });

    resultados.push({
      idAlocacaoSAP : id,
      success       : true,
      message       : 'Status 15→30 e valores gravados.',
      novoStatus    : '30'
    });
  }
  return resultados;
}

async function trans30para35(tx, notas) {
    const resultados = [];
    // Esta etapa é complexa e geralmente processada uma a uma (ou por documento filho)
    for (const nota of notas) {
        const { idAlocacaoSAP: id } = nota;
        console.log(`[TRANSITION_LOG] Iniciando 30->35 para a NF ${id}`);
  
        try {
            // --- ETAPA 1: Criar a MIRO ---
            const respMiro = await BAPI_INCOMINGINVOICE_CREATE1(nota);
            if (!respMiro.ok) {
                // Se a primeira BAPI falha, logamos o erro e pulamos para a próxima nota
                throw new Error(respMiro.msg);
            }
            console.log(`[TRANSITION_LOG] MIRO criada para NF ${id}. Documento: ${respMiro.valores.numeroDocumentoMIRO}`);
  
            // --- ETAPA 2: Criar a Nota Fiscal ---
            const respNF = await BAPI_J_1B_NF_CREATEFROMDATA(nota, respMiro.valores.numeroDocumentoMIRO);
            if (!respNF.ok) {
                // Se a segunda BAPI falha, a MIRO já foi "criada".
                // No mundo real, aqui teríamos uma lógica de compensação (cancelar a MIRO).
                // Na simulação, vamos apenas registrar o erro.
                console.error(`[TRANSITION_LOG] MIRO criada, mas criação da NF falhou para ${id}. Requer ação manual!`);
                throw new Error(respNF.msg);
            }
            console.log(`[TRANSITION_LOG] NF de serviço criada para ${id}.`);
  
            // --- ETAPA 3: Sucesso! Atualizar o status e gravar os dados ---
            await tx.update(NotaFiscalServicoMonitor)
                .set({
                    status: '35',
                    numeroDocumentoMIRO: respMiro.valores.numeroDocumentoMIRO,
                    // Adicione outros campos que a BAPI de NF retornaria, se houver
                })
                .where({ idAlocacaoSAP: id });
            
            resultados.push({
                idAlocacaoSAP: id,
                success: true,
                message: 'Fatura e Nota Fiscal criadas com sucesso.',
                novoStatus: '35'
            });
  
        } catch (error) {
            // Se qualquer passo falhar, o CATCH captura
            console.error(`[TRANSITION_LOG] Erro no fluxo 30->35 para NF ${id}:`, error.message);
            
            // Atualiza a NF para o status de erro
            await tx.update(NotaFiscalServicoMonitor)
                      .set({ status: '99', MSG_TEXT: error.message.substring(0,120) }) // Adicionei MSG_TEXT
                      .where({ idAlocacaoSAP: id });
            
            resultados.push({
                idAlocacaoSAP: id,
                success: false,
                message: error.message,
                novoStatus: '99'
            });
        }
    }
    return resultados;
  }
  
 /** 35 → 50 */
async function trans35para50(tx, ids) {
    await tx.update(NotaFiscalServicoMonitor)
            .set({ status: '50' })
            .where({ idAlocacaoSAP: { in: ids } });
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
