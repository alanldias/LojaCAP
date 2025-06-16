const cds = require('@sap/cds');

const csv = require('csv-parser');
const { Readable } = require('stream');

const validation = require('./lib/validation');

const handlers = [
  require('./lojacap/cliente'),
  require('./lojacap/produto'),
  require('./lojacap/pagamento'),
  require('./lojacap/carrinho'),
  require('./lojacap/pedidos')
];

module.exports = cds.service.impl(function (srv) {
  handlers.forEach(register => register(srv));

  const etapas = require('./nf/etapas')(srv);    // devolve { avancar, voltar }
  const { sucesso, falha, gravarLog } = require('./nf/log');

  const { NotaFiscalServicoMonitor, NotaFiscalServicoLog, as } = srv.entities;

  console.log("✅ CAP Service inicializado");

srv.before('CREATE', 'NotaFiscalServicoMonitor', (req) => {
  // Chamamos nossa função unificada
  const validacao = validation.validarNotaFiscal(req.data);

  // Se ela retornar que não é válido...
  if (!validacao.isValid) {
      // ...nós disparamos o erro do CAP com as mensagens retornadas.
      const mensagemDeErro = validacao.errors.join('\n');
      req.error(400, mensagemDeErro);
  }
});

this.on('avancarStatusNFs', async req => {
    const { grpFilho } = req.data || {};
    if (!grpFilho) return req.error(400, 'grpFilho é obrigatório');

    const tx   = cds.transaction(req);
    const rows = await tx.run(
      SELECT.from(NotaFiscalServicoMonitor).columns(
        'idAlocacaoSAP', 'status', 'valorBrutoNfse',
        'valorEfetivoFrete', 'valorLiquidoFreteNfse'
      ).where({ chaveDocumentoFilho: grpFilho })
    );
    if (!rows.length) return req.error(404,'Nenhuma NF encontrada');

    const grpStatus = rows[0].status;
    const ids       = rows.map(r => r.idAlocacaoSAP);

    switch (grpStatus) {
      case '01': return etapas.avancar.trans01para05(tx, ids);
      case '05': return etapas.avancar.trans05para15(tx, ids);
      case '15': return etapas.avancar.trans15para30(tx, rows);
      case '30': return etapas.avancar.trans30para35(tx, rows);
      case '35': return etapas.avancar.trans35para50(tx, ids);
      default:   return req.error(400,`Status ${grpStatus} não suportado`);
    }
  });

  this.on('voltarStatusNFs', async req => {
    const { grpFilho, grpStatus } = req.data;
    if (!grpFilho || grpStatus === undefined)
      return req.error(400, 'grpFilho e grpStatus são obrigatórios');
  
    const tx  = cds.transaction(req);
    const nfs = await tx.read(NotaFiscalServicoMonitor).where({
      chaveDocumentoFilho: grpFilho, status: grpStatus });
  
    if (!nfs.length) return [];
  
    switch (grpStatus) {
      case '50': return etapas.voltar.trans50para35_reverso(tx, nfs);
      case '35': return etapas.voltar.trans35para30_reverso(tx, nfs);
      case '30': return etapas.voltar.trans30para15_reverso(tx, nfs);
      case '15': return etapas.voltar.trans15para05_reverso(tx, nfs);
      case '05': return etapas.voltar.trans05para01_reverso(tx, nfs);
      default:   return req.error(400, `Reversão não permitida para ${grpStatus}`);
    }
  });


  this.on('rejeitarFrete', async req => {
    const { grpFilho } = req.data || {};
    if (!grpFilho) return req.error(400, 'grpFilho é obrigatório');
  
    const tx = cds.transaction(req);
  
    /* 1️⃣  Pega todos os IDs do grupo ------------------------- */
    const linhas = await tx.run(
      SELECT.from(NotaFiscalServicoMonitor)
            .columns('idAlocacaoSAP')
            .where({ chaveDocumentoFilho: grpFilho })
    );
    if (!linhas.length) return req.error(404, 'Nenhuma NF no grupo');
  
    const ids = linhas.map(l => l.idAlocacaoSAP);
  
    /* 2️⃣  Atualiza status para 55 + grava LOG "R" ------------ */
    try {
      await tx.update(NotaFiscalServicoMonitor)
              .set({ status: '55' })
              .where({ chaveDocumentoFilho: grpFilho });
  
      // um log "R" para cada NF  ➜ gravarLog já propaga campos na tabela
      await Promise.all(
        ids.map(id =>
          gravarLog(
            tx,
            id,
            'Frete rejeitado – status 55',
            'R',                       // tipoMensagemErro = Rejeitado
            'REJ_FRETE',               // classe
            '055',                     // número
            'rejeitarFrete'            // origem
          )
        )
      );
  
      return sucesso(ids, '55');       // helper padrão
  
    } catch (e) {
      // Se algo falhar, gera um log de erro por NF
      await Promise.all(
        ids.map(id =>
          gravarLog(
            tx,
            id,
            e.message,
            'E', 'REJ_FRETE', '055', 'rejeitarFrete'
          )
        )
      );
      return falha(ids, '55', 'Falha ao rejeitar: ' + e.message);
    }
  });
  

// =======================================================
// ==                  FUNÇÕES HELPER                   ==
// =======================================================

srv.on('uploadArquivoFrete', async (req) => {
  const { data } = req.data;

  if (!data) {
      req.error(400, 'Nenhum arquivo recebido.');
      return false;
  }

  const buffer = Buffer.from(data.split(';base64,')[1], 'base64');
  const registrosDoCsv = [];

  return new Promise((resolve, reject) => {
      Readable.from(buffer)
          .pipe(csv({
              separator: ',',
              mapHeaders: ({ header }) => header.trim()
          }))
          .on('data', (row) => {
              registrosDoCsv.push(row);
          })
          .on('end', async () => {
              console.log(`[UPLOAD-LOG] Fim da leitura do CSV. Encontrados ${registrosDoCsv.length} registros.`);
              if (registrosDoCsv.length === 0) {
                  req.warn('O arquivo CSV está vazio ou em formato inválido.');
                  return resolve(false);
              }

              const registrosValidos = [];
              const todosOsErros = [];

              registrosDoCsv.forEach((registro, index) => {
                  // CHAMANDO A MESMA FUNÇÃO UNIFICADA DE VALIDAÇÃO
                  const validacao = validation.validarNotaFiscal(registro, index);

                  if (validacao.isValid) {
                      // Se válido, mapeia o registro para o formato da entidade
                      registrosValidos.push({
                          ID: registro.ID,
                          idAlocacaoSAP: registro.idAlocacaoSAP,
                          orderIdPL: registro.orderIdPL,
                          chaveDocumentoMae: registro.chaveDocumentoMae,
                          chaveDocumentoFilho: registro.chaveDocumentoFilho,
                          status: registro.status,
                          numeroNfseServico: registro.numeroNfseServico,
                          serieNfseServico: registro.serieNfseServico,
                          dataEmissaoNfseServico: registro.dataEmissaoNfseServico || null,
                          chaveAcessoNfseServico: registro.chaveAcessoNfseServico,
                          codigoVerificacaoNfse: registro.codigoVerificacaoNfse,
                          cnpjTomador: registro.cnpjTomador,
                          codigoFornecedor: registro.codigoFornecedor,
                          nomeFornecedor: registro.nomeFornecedor,
                          numeroPedidoCompra: registro.numeroPedidoCompra,
                          itemPedidoCompra: registro.itemPedidoCompra,
                          numeroDocumentoMIRO: registro.numeroDocumentoMIRO,
                          anoFiscalMIRO: registro.anoFiscalMIRO,
                          documentoContabilMiroSAP: registro.documentoContabilMiroSAP,
                          numeroNotaFiscalSAP: registro.numeroNotaFiscalSAP,
                          serieNotaFiscalSAP: registro.serieNotaFiscalSAP,
                          numeroControleDocumentoSAP: registro.numeroControleDocumentoSAP,
                          documentoVendasMae: registro.documentoVendasMae,
                          documentoFaturamentoMae: registro.documentoFaturamentoMae,
                          localPrestacaoServico: registro.localPrestacaoServico,
                          valorEfetivoFrete: parseFloat(registro.valorEfetivoFrete) || 0.0,
                          valorLiquidoFreteNfse: parseFloat(registro.valorLiquidoFreteNfse) || 0.0,
                          valorBrutoNfse: parseFloat(registro.valorBrutoNfse) || 0.0,
                          issRetido: registro.issRetido,
                          estornado: registro.estornado === 'true',
                          enviadoParaPL: registro.enviadoParaPL,
                          logErroFlag: registro.logErroFlag === 'true',
                          mensagemErro: registro.mensagemErro,
                          tipoMensagemErro: registro.tipoMensagemErro,
                          classeMensagemErro: registro.classeMensagemErro,
                          numeroMensagemErro: registro.numeroMensagemErro
                      });
                  } else {
                      todosOsErros.push(...validacao.errors);
                  }
              });

              if (todosOsErros.length > 0) {
                  const mensagemDeErro = `O arquivo foi rejeitado por conter ${todosOsErros.length} erro(s):\n\n${todosOsErros.join('\n')}`;
                  console.error("[UPLOAD-VALIDATION] Erros encontrados:\n", mensagemDeErro);
                  req.error(400, mensagemDeErro);
                  return resolve(false);
              }

              try {
                  if (registrosValidos.length > 0) {
                      await cds.tx(req).run(UPSERT.into(NotaFiscalServicoMonitor).entries(registrosValidos));
                      req.notify(`Upload bem-sucedido! ${registrosValidos.length} registros importados/atualizados.`);
                      console.log(`[UPLOAD-LOG] SUCESSO! Inseridos/Atualizados ${registrosValidos.length} registros.`);
                      resolve(true);
                  } else {
                      req.warn("Nenhum registro válido encontrado no arquivo para processar.");
                      resolve(false);
                  }
              } catch (dbError) {
                  console.error("[UPLOAD-DB] Erro ao inserir dados no banco:", dbError);
                  req.error(500, 'Ocorreu um erro interno ao salvar os dados no banco de dados.');
                  reject(dbError);
              }
          })
          .on('error', (error) => {
              console.error("[UPLOAD] Erro crítico ao processar o CSV:", error);
              req.error(500, 'Ocorreu um erro na leitura do arquivo CSV.');
              reject(error);
          });
  });
});

});
