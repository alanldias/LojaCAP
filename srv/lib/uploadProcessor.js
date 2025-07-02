// srv/lib/uploadProcessor.js

const { INSERT, SELECT } = require('@sap/cds/lib').ql;

/**
 * Lê o stream do CSV, valida cada linha individualmente e retorna um lote de registros.
 * @param {ReadableStream} stream - O stream do arquivo CSV.
 * @param {object} validation - O módulo de validação com a função 'validarNotaFiscal'.
 * @returns {Promise<Array<object>>} - Um array com os registros validados.
 */
async function processarStream(stream, validation) {
    const batch = [];
    let contadorDeLinhas = 0;
    console.log("  [Processador] 📄 Lendo e validando itens individualmente...");

    for await (const registro of stream) {
        contadorDeLinhas++;
        const validacao = validation.validarNotaFiscal(registro, contadorDeLinhas);
        if (!validacao.isValid) {
            const linhaDoArquivo = contadorDeLinhas + 1;
            throw new Error(`O arquivo foi rejeitado. Erro encontrado no item ${linhaDoArquivo} do seu CSV:\n\n- ${validacao.errors.join('\n- ')}`);
        }
        batch.push({
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
    }
    console.log(`    [Processador] ✅ ${contadorDeLinhas} itens lidos e validados.`);
    if (contadorDeLinhas === 0) throw new Error("O arquivo está vazio ou em um formato inválido.");
    return batch;
}

/**
 * Executa todas as validações que precisam do lote completo de dados.
 * @param {Array<object>} batch - O lote de registros do CSV.
 * @param {object} tx - O objeto da transação CAP.
 * @param {object} NotaFiscalServicoMonitor - A entidade do CDS para fazer queries.
 */
async function validarLoteCompleto(batch, tx, NotaFiscalServicoMonitor) {
    // 1. Validação de Consistência Mãe-Filho
    console.log("  [Processador] 🔗 Verificando consistência Mãe-Filho no arquivo completo...");
    _validarConsistenciaMaeFilho(batch); // Esta função vai lançar um erro se falhar
    console.log("    [Processador] ✅ Consistência de dados validada.");

    // 2. Verificação de Duplicados no Banco
    console.log(`  [Processador] 🔍 Verificando se os ${batch.length} registros já existem no banco...`);
    const todosOsIdsDoArquivo = batch.map(r => r.idAlocacaoSAP);
    const idsExistentes = await tx.run(
        SELECT.from(NotaFiscalServicoMonitor, ['idAlocacaoSAP']).where({ idAlocacaoSAP: { in: todosOsIdsDoArquivo } })
    );

    if (idsExistentes.length > 0) {
        const listaIds = idsExistentes.map(nf => nf.idAlocacaoSAP).join(', ');
        throw new Error(`O arquivo foi rejeitado. As seguintes NFs já existem no sistema: ${listaIds}`);
    }
    console.log("    [Processador] ✅ Registros são novos, prontos para inserção.");
}

/**
 * Insere o lote de registros no banco de dados.
 * @param {Array<object>} batch - O lote de registros a ser inserido.
 * @param {object} tx - O objeto da transação CAP.
 * @param {object} NotaFiscalServicoMonitor - A entidade do CDS para a inserção.
 */
async function inserirRegistros(batch, tx, NotaFiscalServicoMonitor) {
    console.log(`  [Processador] 💾 Inserindo ${batch.length} novos registros no banco de dados...`);
    await tx.run(INSERT.into(NotaFiscalServicoMonitor).entries(batch));
}


// --- Funções Auxiliares Internas ---

function _validarConsistenciaMaeFilho(registros) {
    const filhoParaMaeMap = new Map();
    registros.forEach((registro, index) => {
        const linhaAtual = index + 1;
        const { chaveDocumentoFilho, chaveDocumentoMae } = registro;
        if (chaveDocumentoFilho && chaveDocumentoMae) {
            if (filhoParaMaeMap.has(chaveDocumentoFilho)) {
                const primeiraOcorrencia = filhoParaMaeMap.get(chaveDocumentoFilho);
                if (primeiraOcorrencia.mae !== chaveDocumentoMae) {
                    const erroMsg = `Inconsistência no Item ${linhaAtual}: A chave de filho "${chaveDocumentoFilho}" está ligada à mãe "${chaveDocumentoMae}", mas no Item ${primeiraOcorrencia.linha} ela já estava ligada à mãe "${primeiraOcorrencia.mae}".`;
                    throw new Error(`O arquivo foi rejeitado por inconsistência nos dados:\n\n- ${erroMsg}`);
                }
            } else {
                filhoParaMaeMap.set(chaveDocumentoFilho, { mae: chaveDocumentoMae, linha: linhaAtual });
            }
        }
    });
}


module.exports = {
    processarStream,
    validarLoteCompleto,
    inserirRegistros
};