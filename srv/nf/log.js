// srv/nf/log.js
const cds = require('@sap/cds');

function sucesso(ids, proximoStatus, extra = {}, msg = `NF avançada para ${proximoStatus}.`) {
  return ids.map(id => ({ idAlocacaoSAP: id, success: true,  message: msg,  novoStatus: proximoStatus, ...extra }));
}

function falha(ids, statusAtual, motivo) {
  return ids.map(id => ({ idAlocacaoSAP: id, success: false, message: motivo, novoStatus: statusAtual }));
}

async function gravarLog (tx, id, msg,
                           tipo='E', classe='TRANSICAO', num='001', origem='avancarStatusNFs') {
  const { NotaFiscalServicoLog } = tx.model.entities;
  await tx.run(
    INSERT.into(NotaFiscalServicoLog).entries({
      ID: cds.utils.uuid(),
      idAlocacaoSAP: id,
      mensagemErro: msg,
      tipoMensagemErro: tipo,
      classeMensagemErro: classe,
      numeroMensagemErro: num,
      origem
    })
  );
}

module.exports = { sucesso, falha, gravarLog };
