const cds = require('@sap/cds');
const validator = require('validator')
const { serve } = require('@sap/cds');

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
      .set({}) 
      .where({ ID: user.ID });
  
    // Associar esse cliente ao user.id da sessão
    const result = await cds.run(
      UPDATE('my.shop.Cliente')
        .set({ createdBy: req.user.id })
        .where({ ID: user.ID })
    );
  
    return "OK"; // simples resposta, nada de token
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
  });

  srv.before(['CREATE','UPDATE'], 'Produtos', async (req) => {
    const { nome, descricao, preco, estoque, imagemURL } = req.data;
    const urlField = req.data.imagemURL;

    if (!nome || !descricao || !preco || !estoque || !imagemURL){
      return req.error(400, "Todos os campos são obrigatórios!")
    }

    if (preco < 0) {
      return req.error(400, "O preço não pode ser negativo!")
    }

    if (estoque < 0) {
      return req.error(400, "O estoque não pode estar negativo!")
    }
    
    if (urlField && !validator.isURL(urlField)) {
      return req.error(400, "A imagem deve conter uma URL válida")
    }
  });

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


  this.on('mergeCarrinho', async (req) => {
    const { carrinhoAnonimoID } = req.data; // ID do localStorage
    if (!carrinhoAnonimoID) {
      return req.error(400, "ID do carrinho anônimo não fornecido.");
    }

    const tx = cds.transaction(req); // Iniciar transação

    const cliente = await tx.run(SELECT.one.from(Clientes).where({ /* userUUID: req.user.id OU */ createdBy: req.user.id }));
    if (!cliente) {
      return req.error(401, "Cliente não identificado ou não encontrado.");
    }
    const clienteID = cliente.ID;

    // 2. Verificar se o cliente já possui um carrinho
    let carrinhoDoCliente = await tx.run(SELECT.one.from(Carrinhos).where({ cliente_ID: clienteID }));

    // 3. Buscar o carrinho anônimo pelo ID fornecido
    // Certifique-se de que ele é realmente anônimo (cliente_ID é null)
    const carrinhoAnonimo = await tx.run(SELECT.one.from(Carrinhos).where({ ID: carrinhoAnonimoID, cliente_ID: null }));

    let idCarrinhoFinal = null;

    if (carrinhoDoCliente) {
      // CASO A: Cliente já tem um carrinho.
      idCarrinhoFinal = carrinhoDoCliente.ID;

      if (carrinhoAnonimo && carrinhoAnonimo.ID !== carrinhoDoCliente.ID) {
        const itensAnonimos = await tx.run(SELECT.from(ItemCarrinho).where({ carrinho_ID: carrinhoAnonimo.ID }));

        for (const itemAnonimo of itensAnonimos) {
          const itemExistenteNoCarrinhoCliente = await tx.run(SELECT.one.from(ItemCarrinho).where({
            carrinho_ID: carrinhoDoCliente.ID,
            produto_ID: itemAnonimo.produto_ID
          }));

          if (itemExistenteNoCarrinhoCliente) {
            await tx.run(UPDATE(ItemCarrinho)
              .set({ quantidade: itemExistenteNoCarrinhoCliente.quantidade + itemAnonimo.quantidade })
              .where({ ID: itemExistenteNoCarrinhoCliente.ID }));
          } else {
            delete itemAnonimo.ID; // Garante novo ID para o item no novo carrinho
            await tx.run(INSERT.into(ItemCarrinho).entries({
              ...itemAnonimo, // Copia os campos relevantes (produto_ID, quantidade, precoUnitario)
              carrinho_ID: carrinhoDoCliente.ID // Associa ao carrinho do cliente
            }));
          }
        }
        await tx.run(DELETE.from(ItemCarrinho).where({ carrinho_ID: carrinhoAnonimo.ID }));
        await tx.run(DELETE.from(Carrinhos).where({ ID: carrinhoAnonimo.ID }));
        console.log(`Itens do carrinho anônimo ${carrinhoAnonimo.ID} mesclados ao carrinho ${carrinhoDoCliente.ID} do cliente ${clienteID}. Carrinho anônimo deletado.`);
      }
      // Se não houver carrinho anônimo, ou for o mesmo, nada a fazer.
      console.log("[BACKEND mergeCarrinho] CASO A - Preparando para retornar:", { carrinhoID: idCarrinhoFinal }, "(Tipo:", typeof idCarrinhoFinal, ")");
      return { carrinhoID: idCarrinhoFinal };

    } else {
      // CASO B: Cliente NÃO tem um carrinho.
      if (carrinhoAnonimo) {
        await tx.run(UPDATE(Carrinhos)
          .set({ cliente_ID: clienteID })
          .where({ ID: carrinhoAnonimo.ID }));
        idCarrinhoFinal = carrinhoAnonimo.ID;
        console.log(`Carrinho anônimo ${carrinhoAnonimo.ID} associado ao cliente ${clienteID}.`);
        // ----- LOG DE DEBUG ANTES DO RETURN (Passo 1 do diagnóstico) -----
        console.log("[BACKEND mergeCarrinho] CASO B - Preparando para retornar:", { carrinhoID: idCarrinhoFinal }, "(Tipo:", typeof idCarrinhoFinal, ")");
        return { carrinhoID: idCarrinhoFinal };

      } else {
        // CASO C: Cliente não tem carrinho E NÃO existe carrinho anônimo.
        const novoCarrinho = {
          ID: cds.utils.uuid(), // Servidor gera o ID
          cliente_ID: clienteID
        };
        await tx.run(INSERT.into(Carrinhos).entries(novoCarrinho));
        idCarrinhoFinal = novoCarrinho.ID;
        console.log(`Novo carrinho ${idCarrinhoFinal} criado para o cliente ${clienteID}.`);

        console.log("[BACKEND mergeCarrinho] CASO C - Preparando para retornar:", { carrinhoID: idCarrinhoFinal }, "(Tipo:", typeof idCarrinhoFinal, ")");
        return { carrinhoID: idCarrinhoFinal };
      }
    }
  })
});
