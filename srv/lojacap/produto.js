// srv/lojacap/produto.js
const cds = require('@sap/cds');
const validator = require('validator');

module.exports = function (srv) {
    const { Produtos } = srv.entities;

    srv.before(['CREATE', 'UPDATE'], 'Produtos', async req => {
      const { nome, descricao, preco, estoque, imagemURL } = req.data;
      if (!nome || !descricao || !preco || !estoque || !imagemURL)
        return req.error(400, 'Todos os campos são obrigatórios!');

      if (preco < 0) return req.error(400, 'Preço não pode ser negativo!');
      if (estoque < 0) return req.error(400, 'Estoque não pode ser negativo!');

      if (!validator.isURL(imagemURL))
        return req.error(400, 'A imagem deve conter uma URL válida');
    });
  }
