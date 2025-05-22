const jwt = require('jsonwebtoken');
const cds = require('@sap/cds');

module.exports = cds.service.impl(async function (srv) {
  const { Clientes, Pedidos, ItemPedido, Carrinhos, ItemCarrinho, Produtos } = srv.entities;

  console.log("✅ CAP Service inicializado");

  // ==== loginCliente ====
  srv.on('loginCliente', async (req) => {
    const { email, senha } = req.data;
  
    const user = await SELECT.one.from(Clientes).where({ email, senha });
    if (!user) {
      req.reject(401, "Login inválido");
    }
  
    // Atualiza createdBy com o usuário atual da sessão
    await UPDATE(Clientes)
      .set({}) // não precisa mudar nada além de atualizar o owner
      .where({ ID: user.ID });
  
    // Associar esse cliente ao user.id da sessão
    const result = await cds.run(
      UPDATE('my.shop.Cliente')
        .set({ createdBy: req.user.id })
        .where({ ID: user.ID })
    );
  
    return "OK"; // simples resposta, nada de token
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


  srv.on('mergeCarrinho', async (req) => {
    const { carrinhoAnonimoID } = req.data;
  
    const cliente = await SELECT.one.from(Clientes).where({ createdBy: req.user.id });
    if (!cliente) return req.error(401, "Cliente não identificado");
  
    const clienteID = cliente.ID;
  
    const carrinhoDoCliente = await SELECT.one.from(Carrinhos).where({ cliente_ID: clienteID });
  
    if (carrinhoDoCliente) {
      // Cliente já tem carrinho → fazer merge
      const itensAnonimos = await SELECT.from(ItemCarrinho).where({ carrinho_ID: carrinhoAnonimoID });
  
      for (const item of itensAnonimos) {
        const existente = await SELECT.one.from(ItemCarrinho).where({
          carrinho_ID: carrinhoDoCliente.ID,
          produto_ID: item.produto_ID
        });
  
        if (existente) {
          await UPDATE(ItemCarrinho)
            .set({ quantidade: existente.quantidade + item.quantidade })
            .where({ ID: existente.ID });
        } else {
          await INSERT.into(ItemCarrinho).entries({
            carrinho_ID: carrinhoDoCliente.ID,
            produto_ID: item.produto_ID,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario
          });
        }
      }
  
      await DELETE.from(ItemCarrinho).where({ carrinho_ID: carrinhoAnonimoID });
      // await DELETE.from(Carrinhos).where({ ID: carrinhoAnonimoID });
  
      return novoCarrinhoID;
    } else {
      // Cliente ainda não tem carrinho
      const carrinhoAnonimo = await SELECT.one.from(Carrinhos).where({ ID: carrinhoAnonimoID });
  
      if (carrinhoAnonimo) {
        const novoCarrinhoID = cds.utils.uuid();
  
        await INSERT.into(Carrinhos).entries({
          ID: novoCarrinhoID,
          cliente_ID: clienteID
        });
  
        const itensAnonimos = await SELECT.from(ItemCarrinho).where({ carrinho_ID: carrinhoAnonimoID });
  
        for (const item of itensAnonimos) {
          await INSERT.into(ItemCarrinho).entries({
            carrinho_ID: novoCarrinhoID,
            produto_ID: item.produto_ID,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario
          });
        }
  
        await DELETE.from(ItemCarrinho).where({ carrinho_ID: carrinhoAnonimoID });
        await DELETE.from(Carrinhos).where({ ID: carrinhoAnonimoID });
  
        return novoCarrinhoID; // ✅ aqui também
      } else {
        // Não existe carrinho anônimo → cria um novo vazio
        const novoCarrinhoID = cds.utils.uuid();
  
        await INSERT.into(Carrinhos).entries({
          ID: novoCarrinhoID,
          cliente_ID: clienteID
        });
  
        return novoCarrinhoID;
      }
    }
  });
  
});
