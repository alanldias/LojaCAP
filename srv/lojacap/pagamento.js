const cds = require('@sap/cds');

module.exports = function (srv) {
  const { Pedidos, ItemPedido, Carrinhos, ItemCarrinho, Produtos } = srv.entities;

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

  srv.on('realizarPagamentoItemUnico', async (req) => {
    const { clienteID, tipoPagamento, produtoID, quantidade, precoUnitario } = req.data;
    console.log("🛍️ Backend: Ação 'realizarPagamentoItemUnico' chamada com clienteID:", clienteID, "produtoID:", produtoID);

    if (!clienteID || !tipoPagamento || !produtoID || !quantidade || precoUnitario === undefined) {
      return req.error(400, 'clienteID, tipoPagamento, produtoID, quantidade e precoUnitario são obrigatórios.');
    }
    if (quantidade <= 0) {
      return req.error(400, 'Quantidade deve ser maior que zero.');
    }

    const tx = cds.transaction(req);
    try {
      // 1. Verifica se o produto existe. 
      //    Vamos tentar sem IsActiveEntity: true para ver se o erro some,
      //    espelhando a leitura no realizarPagamento que funciona.
      //    O CAP geralmente resolve para a entidade ativa por padrão em leituras.
      console.log("🛍️ Backend: 'realizarPagamentoItemUnico' - Buscando produto SEM IsActiveEntity explícito:", produtoID);
      const produto = await tx.run(SELECT.one.from(Produtos).where({ ID: produtoID })); // << MUDANÇA AQUI

      if (!produto) {
        // Se o produto não for encontrado aqui, pode ser que ele só exista como draft e não como ativo.
        // Nesse caso, você pode querer adicionar uma checagem secundária ou decidir o comportamento.
        // Por agora, vamos manter simples. Se não achar, é erro.
        console.error("🛍️ Backend: 'realizarPagamentoItemUnico' - Produto não encontrado (ou apenas draft existente) para ID:", produtoID);
        return req.error(404, `Produto com ID ${produtoID} não encontrado.`);
      }
      console.log("🛍️ Backend: 'realizarPagamentoItemUnico' - Produto encontrado:", JSON.stringify(produto));


      // Se o produto encontrado não for o ativo (raro se o SELECT padrão funcionar bem),
      // e você PRECISAR garantir que é o ativo, você poderia checar produto.IsActiveEntity aqui.
      // Mas se a query acima já te dá o ativo, ótimo.

      const totalPedido = parseFloat(precoUnitario) * parseInt(quantidade);

      // 2. Cria o Pedido
      const novoPedidoID = cds.utils.uuid();
      await tx.run(INSERT.into(Pedidos).entries({
        ID: novoPedidoID,
        cliente_ID: clienteID,
        total: totalPedido,
        pagamento: tipoPagamento,
        status: 'AGUARDANDO_PAGAMENTO'
      }));
      console.log("🛍️ Backend: 'realizarPagamentoItemUnico' - Pedido criado:", novoPedidoID);

      // 3. Cria o ItemPedido
      await tx.run(INSERT.into(ItemPedido).entries({
        pedido_ID: novoPedidoID,
        produto_ID: produtoID, // Usamos o produtoID original, já validado
        quantidade: quantidade,
        precoUnitario: parseFloat(precoUnitario)
      }));
      console.log("🛍️ Backend: 'realizarPagamentoItemUnico' - ItemPedido criado para o pedido:", novoPedidoID);

      await tx.commit();
      return novoPedidoID;

    } catch (error) {
      console.error("🛍️ Backend: Erro em 'realizarPagamentoItemUnico':", error);
      await tx.rollback(error);
      if (!req.errors && error.message && !error.message.includes("Virtual elements")) { // Evita duplicar o erro de virtual elements se ele voltar
        req.error(500, "Erro interno ao processar o pedido do item único: " + error.message);
      } else if (!req.errors) { // Erro genérico se não for o de virtual elements
        req.error(500, "Erro interno desconhecido ao processar o pedido do item único.");
      }
      // Se o erro de "Virtual elements" persistir, ele será propagado pelo CAP.
    }
  });

}