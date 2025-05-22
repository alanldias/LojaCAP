const jwt = require('jsonwebtoken');
const cds = require('@sap/cds');

module.exports = cds.service.impl(async function (srv) {
  const { Clientes, Pedidos, ItemPedido, Carrinhos, ItemCarrinho, Produtos } = srv.entities;

  console.log("✅ CAP Service inicializado");

  // ==== loginCliente ====
  srv.on('loginCliente', async (req) => {
    const { email, senha } = req.data;

    const user = await SELECT.one.from(Clientes).where({ email, senha });
    if (!user) req.reject(401, "Login inválido");

    const token = jwt.sign(
      { id: user.ID, email },
      'naotenhoenventaoissovaisersupersecreto',
      { expiresIn: '1h' }
    );

    return token;
  });

  srv.before(['CREATE', 'UPDATE'], 'Clientes', async (req) => {
    const { nome, email, senha } = req.data;
    console.log("📥 Chamado registerCliente");

    if (!nome || !email || !senha) {
      return req.error(400, "Todos os campos são obrigatórios")
    }
 
    // Validação: nome com pelo menos 6 caracteres
    if (nome.length < 6) {
      return req.error(400, "O nome deve ter pelo menos 6 caracteres.");
    }
 
    // Validação: senha com pelo menos 6 caracteres
    if (senha.length < 6) {
      return req.error(400, "A senha deve ter pelo menos 6 caracteres.");
    }
 
    // Validação: formato do e-mail (básico)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return req.error(400, "Formato de e-mail inválido.");
    }
 
    // Validação: senha com letras e números (opcional, força mínima)
    const senhaFraca = !/\d/.test(senha) || !/[a-zA-Z]/.test(senha);
    if (senhaFraca) {
      return req.error(400, "A senha deve conter letras e números.");
    }
 
    // Validação: e-mail duplicado
    const existente = await SELECT.one.from(Clientes).where({ email });
    if (existente) {
      return req.error(400, "Este e-mail já está em uso.");
    }
  });

  // ==== realizarPagamento ====
  srv.on('realizarPagamento', async (req) => {
    const { clienteID, tipoPagamento } = req.data;

    if (!clienteID || !tipoPagamento) {
      return req.error(400, 'clienteID e tipoPagamento são obrigatórios.');
    }

    const carrinho = await SELECT.one.from(Carrinhos).where({ cliente_ID: clienteID });
    if (!carrinho) {
      return req.error(404, `Carrinho não encontrado para o cliente ${clienteID}.`);
    }

    const itensCarrinho = await SELECT.from(ItemCarrinho).where({ carrinho_ID: carrinho.ID });
    if (!itensCarrinho || itensCarrinho.length === 0) {
      return req.error(400, 'O carrinho está vazio.');
    }

    let total = 0;
    for (const item of itensCarrinho) {
      const produto = await SELECT.one.from(Produtos).where({ ID: item.produto_ID });
      if (!produto) {
        return req.error(404, `Produto com ID ${item.produto_ID} não encontrado.`);
      }
      total += produto.preco * item.quantidade;
    }

    let pedidoCriadoID;

    await cds.tx(req).run(async (tx) => {
      pedidoCriadoID = cds.utils.uuid();
      await tx.run(
        INSERT.into(Pedidos).entries({
          ID: pedidoCriadoID,
          cliente_ID: clienteID,
          total: total,
          pagamento: tipoPagamento,
          status: 'AGUARDANDO_PAGAMENTO'
        })
      );

      const itensParaPedido = [];
      for (const item of itensCarrinho) {
        const produto = await tx.run(SELECT.one.from(Produtos).where({ ID: item.produto_ID }));
        itensParaPedido.push({
          pedido_ID: pedidoCriadoID,
          produto_ID: produto.ID,
          quantidade: item.quantidade,
          precoUnitario: produto.preco
        });
      }

      await tx.run(INSERT.into(ItemPedido).entries(itensParaPedido));
      await tx.run(DELETE.from(ItemCarrinho).where({ carrinho_ID: carrinho.ID }));
    });

    return pedidoCriadoID;
  });
});
