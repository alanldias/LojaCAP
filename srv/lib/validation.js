/**
 * Valida os dados de um registro de Nota Fiscal de Serviço.
 * Funciona tanto para criação manual (índice 0) quanto para linhas de CSV.
 * @param {object} data - Os dados do registro a serem validados.
 * @param {number} [indice=0] - O índice da linha no CSV (opcional).
 * @returns {{isValid: boolean, errors: string[]}} - Retorna se é válido e uma lista de mensagens de erro.
 */
function validarNotaFiscal(data, indice = 0) {
    const errors = [];
    // Se o índice for maior que 0 (vem do CSV), formatamos a mensagem com a linha.
    const linha = indice > 0 ? `Linha ${indice + 2}:` : "Erro:";

    console.log(`[VALIDATION] Validando registro (ID: ${data.idAlocacaoSAP || 'N/A'})`);

    if (!data.idAlocacaoSAP || !data.orderIdPL || !data.chaveDocumentoMae || !data.chaveDocumentoFilho) {
        errors.push(`${linha} Os campos de ID e Chaves Principais são obrigatórios.`);
    }
    
    if (data.idAlocacaoSAP && data.idAlocacaoSAP.length > 13) {
        errors.push(`${linha} O campo 'ID Alocação SAP' excedeu o limite de 13 caracteres.`);
    }

    if (data.orderIdPL && data.orderIdPL.length > 20) {
        errors.push(`${linha} O campo 'Order ID PL' excedeu o limite de 20 caracteres.`);
    }

    if (data.chaveDocumentoMae && data.chaveDocumentoMae.length > 44) {
        errors.push(`${linha} O campo 'Chave Documento Mãe' excedeu o limite de 44 caracteres.`);
    }

    if (data.chaveDocumentoFilho && data.chaveDocumentoFilho.length > 44) {
        errors.push(`${linha} O campo 'Chave Documento Filho' excedeu o limite de 44 caracteres.`);
    }

    if(!data.numeroNfseServico || !data.serieNfseServico) {
        errors.push(`${linha} O número da Nota Fiscal e o número de Série são obrigatórios!`)
    }

    if(!data.dataEmissaoNfseServico){
        errors.push(`${linha} A data de emissão do serviço é obrigatória!`)
    }

    if (data.dataEmissaoNfseServico) {
        if (isNaN(new Date(data.dataEmissaoNfseServico).getTime())) { 
            errors.push(`${linha} A data '${data.dataEmissaoNfseServico}' é inválida.`);
        }
    }
    if (data.valorBrutoNfse < 0) {
        errors.push(`${linha} O Valor Bruto da NFS-e não pode ser negativo.`);
    }

    // Você pode adicionar quantas outras regras precisar aqui...

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

module.exports = {
    validarNotaFiscal
};