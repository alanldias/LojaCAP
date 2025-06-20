const cds = require('@sap/cds');

const csv = require('csv-parser');
const { Readable } = require('stream');

const validation = require('./lib/validation');

const axios = require('axios');
require('dotenv').config();

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

  const { NotaFiscalServicoMonitor } = srv.entities;

  console.log("✅ CAP Service inicializado");


  srv.on('getPOSubcontractingComponents', async req => {
    const axiosCfg = {
        headers: {
            Accept: 'application/json',
            APIKey: process.env.PO_API_KEY
        },
        timeout: 10_000
    };

    const base = `${process.env.PO_API_BASE}/POSubcontractingComponent`;
    const top = 50;
    let url = `${base}?$top=${top}`;
    let result = [];
    let pageCount = 1; // Contador de páginas para o log

    try {
        while (url && result.length < top) {
            console.log(`🔎 Página ${pageCount}: Chamando a URL -> ${url}`);
            const { data } = await axios.get(url, axiosCfg);
            
            if (data.value) {
                console.log(`✅ Página ${pageCount}: Recebidos ${data.value.length} itens.`);
                result = result.concat(data.value);
            } else {
                console.log(`⚠️ Página ${pageCount}: A resposta não continha um array 'value'.`);
            }

            // O log mais importante de todos!
            console.log(`📦 A resposta da página ${pageCount} contém um @odata.nextLink? ->`, data['@odata.nextLink'] || 'Não');

            // server-driven paging ➜ segue o @odata.nextLink
            url = data['@odata.nextLink']
                ? `${process.env.PO_API_BASE}/${data['@odata.nextLink']}` // Cuidado aqui, veja a observação abaixo
                : null;
            
            pageCount++;
        }
        
        console.log(`🏁 Fim do loop. Total de itens acumulados: ${result.length}`);
        return JSON.stringify(result.slice(0, top)); // garante no máx. 50

    } catch (e) {
        req.error(
            e.response?.status || 500,
            e.response?.data?.error?.message?.value || e.message
        );
    }
});
  

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

this.on('uploadArquivoFrete', async (req) => {
  console.log('\n[Upload de Arquivo] 🚀 Início do processamento.');
  const { data } = req.data;
  if (!data) { 
      return req.error(400, 'Nenhum arquivo recebido.');
  }

  const buffer = Buffer.from(data.split(';base64,')[1], 'base64');
  const stream = Readable.from(buffer).pipe(csv({ 
      mapHeaders: ({ header }) => header.trim()
  }));

  try {
      console.log('⏳ Tentando iniciar a transação (forçada)...');

      // <<< MUDANÇA CRÍTICA: Removido o 'req' para forçar uma transação de DB real >>>
      await cds.tx(async (tx) => { 
          
          // <<< IMPORTANTE: Reatribuindo o contexto da requisição à transação >>>
          tx.req = req;

          console.log('✅✅✅ SUCESSO! Transação iniciada.');

          let batch = [];
          let contadorDeLinhas = 0;
          const todosOsIdsDoArquivo = [];

          console.log('[UPLOAD-LOG] Iniciando processamento de stream transacional...');

          for await (const registro of stream) {
              contadorDeLinhas++;
              if (registro.idAlocacaoSAP) {
                  todosOsIdsDoArquivo.push(registro.idAlocacaoSAP);
              }
              const validacao = validation.validarNotaFiscal(registro, contadorDeLinhas);
              if (!validacao.isValid) {
                const linhaDoArquivo = contadorDeLinhas + 1;
                throw new Error(`O arquivo foi rejeitado. Erro encontrado no item ${linhaDoArquivo} do seu CSV:\n\n${validacao.errors.join('\n')}`);
              }
              
              // Monta o batch SEM o campo 'ID'
              batch.push({ 
                  idAlocacaoSAP: registro.idAlocacaoSAP,
                  orderIdPL: registro.orderIdPL,
                  chaveDocumentoMae: registro.chaveDocumentoMae,
                  // ... e todos os outros campos do seu CSV
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
          }

          console.log(`  [Upload de Arquivo] 📄 ${contadorDeLinhas} itens lidos e validados individualmente.`);
          if (contadorDeLinhas === 0) {
              throw new Error("O arquivo está vazio ou em um formato inválido.");
          }

          console.log("  [Upload de Arquivo] 🔗 Verificando consistência Mãe-Filho no arquivo completo...");
          const consistencia = validation.validarConsistenciaMaeFilho(batch);
          if(!consistencia.isValid) {
            const mensagemDeErro = `O arquivo foi rejeitado por inconsistência nos dados:\n\n- ${consistencia.errors.join('\n- ')}`;
            throw new Error(mensagemDeErro);
          }
          console.log("    [Upload de Arquivo] ✅ Consistência de dados validada.");

          console.log(`  [Upload de Arquivo] 🔍 Verificando se os ${contadorDeLinhas} registros já existem no banco...`);
          const idsExistentes = await tx.run(
              SELECT.from(NotaFiscalServicoMonitor, ['idAlocacaoSAP']).where({ idAlocacaoSAP: { in: todosOsIdsDoArquivo } })
          );
          if (idsExistentes.length > 0) {
              const listaIds = idsExistentes.map(nf => nf.idAlocacaoSAP).join(', ');
              throw new Error(`O arquivo foi rejeitado. As seguintes NFs já existem no sistema: ${listaIds}`);
          }
          console.log("    [Upload de Arquivo] ✅ Registros são novos, prontos para inserção.");

          console.log(`  [Upload de Arquivo] 💾 Inserindo ${batch.length} novos registros no banco de dados...`);
          await tx.run(INSERT.into(NotaFiscalServicoMonitor).entries(batch));
         
          console.log("  [Upload de Arquivo] ✨ Tudo certo! Preparando para salvar as alterações.");
          req.notify(`Arquivo processado e ${contadorDeLinhas} registros importados com sucesso!`);
      });

      console.log('[Upload de Arquivo] ✅ Processo finalizado com sucesso.');
      return true;

  } catch (error) {
    console.error(`\n[Upload de Arquivo] ❌ FALHA! Rollback executado. Motivo: ${error.message}\n`);
    return req.error(400, error.message);
  }
});

});
