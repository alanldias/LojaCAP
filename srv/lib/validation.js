/**
 * Valida os dados de um registro de Nota Fiscal de Serviço com mensagens de erro detalhadas.
 * @param {object} data - Os dados do registro a serem validados.
 * @param {number} indice - O índice da linha de dados no CSV (começando em 1).
 * @returns {{isValid: boolean, errors: string[]}} - Retorna se é válido e uma lista de mensagens de erro.
 */
function validarNotaFiscal(data, indice = 0) {
    const errors = [];
    // A linha real no arquivo é o índice da linha de dados + 1 (para o cabeçalho)
    const linha = `Item ${indice + 1} do arquivo:`;

    console.log(`[VALIDATION] Validando dados do Item ${indice} do arquivo (ID: ${data.idAlocacaoSAP || 'N/A'})`);

    // --- Validações de Campos Obrigatórios ---
    if (!data.idAlocacaoSAP) {
        errors.push(`${linha} O campo 'idAlocacaoSAP' é obrigatório e não foi encontrado.`);
    }
    if (!data.orderIdPL) {
        errors.push(`${linha} O campo 'orderIdPL' é obrigatório e não foi encontrado.`);
    }
    if (!data.chaveDocumentoMae) {
        errors.push(`${linha} O campo 'chaveDocumentoMae' é obrigatório e não foi encontrado.`);
    }
    if (!data.chaveDocumentoFilho) {
        errors.push(`${linha} O campo 'chaveDocumentoFilho' é obrigatório e não foi encontrado.`);
    }
    if (!data.numeroNfseServico) {
        errors.push(`${linha} O campo 'numeroNfseServico' é obrigatório e não foi encontrado.`);
    }
    if (!data.serieNfseServico) {
        errors.push(`${linha} O campo 'serieNfseServico' é obrigatório e não foi encontrado.`);
    }
    if (!data.dataEmissaoNfseServico) {
        errors.push(`${linha} O campo 'dataEmissaoNfseServico' é obrigatório e não foi encontrado.`);
    }

    // --- Validações de Formato e Tamanho ---
    if (data.idAlocacaoSAP && data.idAlocacaoSAP.length > 13) {
        errors.push(`${linha} O campo 'idAlocacaoSAP' com valor "${data.idAlocacaoSAP}" excedeu o limite de 13 caracteres.`);
    }
    if (data.orderIdPL && data.orderIdPL.length > 20) {
        errors.push(`${linha} O campo 'orderIdPL' com valor "${data.orderIdPL}" excedeu o limite de 20 caracteres.`);
    }
    if (data.chaveDocumentoMae && data.chaveDocumentoMae.length > 44) {
        errors.push(`${linha} O campo 'chaveDocumentoMae' com valor "${data.chaveDocumentoMae}" excedeu o limite de 44 caracteres.`);
    }
    if (data.chaveDocumentoFilho && data.chaveDocumentoFilho.length > 44) {
        errors.push(`${linha} O campo 'chaveDocumentoFilho' com valor "${data.chaveDocumentoFilho}" excedeu o limite de 44 caracteres.`);
    }
    if (data.dataEmissaoNfseServico && isNaN(new Date(data.dataEmissaoNfseServico).getTime())) { 
        errors.push(`${linha} A data no campo 'dataEmissaoNfseServico' ("${data.dataEmissaoNfseServico}") é inválida.`);
    }

    // --- Validações de Valores ---
    const valorBruto = parseFloat(data.valorBrutoNfse);
    if (!isNaN(valorBruto) && valorBruto < 0) {
        errors.push(`${linha} O campo 'valorBrutoNfse' não pode ser negativo. Valor encontrado: "${data.valorBrutoNfse}".`);
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

module.exports = {
    validarNotaFiscal 
};