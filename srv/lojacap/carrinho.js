// srv/lojacap/carrinho.js
const cds = require('@sap/cds');

module.exports = function (srv) {
  const { Carrinhos, ItemCarrinho, Clientes } = srv.entities;


  srv.on('mergeCarrinho', async (req) => {
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
  });

}