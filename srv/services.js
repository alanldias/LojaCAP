const cds = require('@sap/cds');
const validator = require('validator')
const { serve } = require('@sap/cds');

module.exports = cds.service.impl(async function (srv) {
  const { Clientes, Pedidos, ItemPedido, Carrinhos, ItemCarrinho, Produtos, NotaFiscalServicoMonitor  } = srv.entities;

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
});

  const statusOrder = [
    'CANCELADO',            // 0
    'AGUARDANDO_PAGAMENTO', // 1
    'PAGO',                 // 2
    'ENVIADO',              // 3
    'ENTREGUE'              // 4
  ];


  function getNextStatus(currentStatus) {
    console.log(`🚦 Backend (getNextStatus - SEM DRAFT): Status atual: ${currentStatus}`);
    const currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex === -1) {
        console.warn(`🚦 Backend (getNextStatus - SEM DRAFT): Status '${currentStatus}' não reconhecido.`);
        return null;
    }
    if (currentIndex === statusOrder.length - 1) {
        console.log(`🚦 Backend (getNextStatus - SEM DRAFT): Status '${currentStatus}' já é o último.`);
        return null;
    }
    const next = statusOrder[currentIndex + 1];
    console.log(`🚦 Backend (getNextStatus - SEM DRAFT): Próximo status: ${next}`);
    return next;
}

  function getPreviousStatus(currentStatus) {
    const currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex === -1) {
        console.warn(`🚦 Backend (getPreviousStatus): Status atual '${currentStatus}' não reconhecido.`);
        return null; // Status atual não está na lista
    }
    if (currentIndex === 0) {
        console.log(`🚦 Backend (getPreviousStatus): Status '${currentStatus}' já é o primeiro.`);
        return null; // Já está no primeiro status
    }
    return statusOrder[currentIndex - 1];
  }

  srv.on('avancarStatus', 'Pedidos', async (req) => {
    const tx = cds.transaction(req);

    // Normalizar o valor da chave
    const aRawParams = req.params;
    const aPedidoKeys = [];

    // 💡 Corrigido: transforma string em objeto { ID: ... }
    for (const rawParam of aRawParams) {
        if (typeof rawParam === 'string') {
            aPedidoKeys.push({ ID: rawParam });
        } else if (rawParam && rawParam.ID) {
            aPedidoKeys.push(rawParam);
        } else {
            req.warn(`Chave de pedido inválida recebida: ${JSON.stringify(rawParam)}`);
        }
    }

    if (aPedidoKeys.length === 0) {
        console.error("🔴 Backend 'avancarStatus' (SEM DRAFT): Nenhuma chave válida.");
        return req.error(400, "Nenhum pedido selecionado ou chave inválida.");
    }

    let iSuccessCount = 0;

    for (const { ID: sPedidoID } of aPedidoKeys) {
        console.log(`🛠️ Atualizando pedido: ${sPedidoID}`);

        const pedido = await tx.run(SELECT.one.from(Pedidos).where({ ID: sPedidoID }));
        if (!pedido) {
            req.warn(`Pedido ${sPedidoID} não encontrado.`);
            continue;
        }

        const sNextStatus = getNextStatus(pedido.status);
        if (!sNextStatus) {
            req.warn(`Status '${pedido.status}' não pode ser avançado.`);
            continue;
        }

        await tx.run(UPDATE(Pedidos).set({ status: sNextStatus }).where({ ID: sPedidoID }));
        req.notify(`Pedido ${sPedidoID} avançado para '${sNextStatus}'.`);
        iSuccessCount++;
    }

    if (iSuccessCount === 0) {
        return req.error(400, "Nenhum pedido pôde ser atualizado.");
    }

    console.log(`✅ ${iSuccessCount} pedido(s) atualizados com sucesso.`);
});

srv.on('retrocederStatus', 'Pedidos', async (req) => {
  const tx = cds.transaction(req);
  const aRawParams = req.params;
  const aPedidoKeys = [];

  for (const raw of aRawParams) {
      if (typeof raw === 'string') {
          aPedidoKeys.push({ ID: raw });
      } else if (raw && raw.ID) {
          aPedidoKeys.push(raw);
      }
  }

  if (aPedidoKeys.length === 0) {
      return req.error(400, "Nenhum pedido selecionado.");
  }
  if (aPedidoKeys.length > 1) {
      return req.error(400, "Apenas um pedido pode ser selecionado para retroceder o status.");
  }

  const { ID: pedidoID } = aPedidoKeys[0];
  console.log(`⏪ Backend (SEM DRAFT): Retrocedendo status do pedido ${pedidoID}`);
  const pedido = await tx.run(SELECT.one.from(Pedidos).where({ ID: pedidoID }));

  if (!pedido) {
      return req.error(404, `Pedido ${pedidoID} não encontrado.`);
  }

  const previousStatus = getPreviousStatus(pedido.status);
  if (!previousStatus) {
      req.warn(`Status '${pedido.status}' não pode ser retrocedido.`);
      return;
  }

  await tx.run(
      UPDATE(Pedidos).set({ status: previousStatus }).where({ ID: pedidoID })
  );
  req.notify(`Status do Pedido ${pedidoID} retrocedido para '${previousStatus}'.`);
  console.log(`✅ Pedido ${pedidoID} atualizado com sucesso.`);
});

// SEU HANDLER PARA statusCriticality (MUITO IMPORTANTE PARA A UI)
srv.after('READ', 'Pedidos', each => {
    if (each.status) { // Certifique-se que 'each' existe e tem 'status'
        switch (each.status) {
            case 'AGUARDANDO_PAGAMENTO': each.statusCriticality = 2; break; // Amarelo/Laranja (Warning)
            case 'PAGO':                 each.statusCriticality = 3; break; // Verde (Success)
            case 'ENVIADO':              each.statusCriticality = 5; break; // Azul (Information)
            case 'ENTREGUE':             each.statusCriticality = 3; break; // Verde (Success) ou 0 (Neutro)
            case 'CANCELADO':            each.statusCriticality = 1; break; // Vermelho (Error)
            default:                     each.statusCriticality = 0; // Cinza (Neutral)
        }
    } else {
        each.statusCriticality = 0; // Default se status for nulo
    }
});

this.on('avancarStatusNFs', async (req) => {
  const { notasFiscaisIDs } = req.data || {};
  const tx = this.transaction(req);
  const results = [];

  if (!notasFiscaisIDs?.length) {
    return req.error(400, 'Selecione ao menos uma NFSe.');
  }

  /* ------------------------------------------------------------------
   * 1. Carrega TODAS as NFs de uma vez (menos round-trips)
   * -----------------------------------------------------------------*/
  const notas = await tx.read(NotaFiscalServicoMonitor)
                        .where({ idAlocacaoSAP: { in: notasFiscaisIDs } });

  if (notas.length !== notasFiscaisIDs.length) {
    return req.error(400, 'Alguma NFSe selecionada não foi encontrada.');
  }

  /* ------------------------------------------------------------------
   * 2. Verifica unicidade de chaveDocumentoFilho e status
   * -----------------------------------------------------------------*/
  const uniqueChild  = new Set(notas.map(n => n.chaveDocumentoFilho));
  const uniqueStatus = new Set(notas.map(n => n.status));

  if (uniqueChild.size > 1) {
    return req.error(400,
      'Os registros selecionados têm chaves-filho diferentes. Seleção deve ter o mesmo documento filho.');
  }
  if (uniqueStatus.size > 1) {
    return req.error(400,
      'Os registros selecionados estão em status diferentes. Seleção deve ter o mesmo status.');
  }

  /* ------------------------------------------------------------------
   * 3. Decide próximo status
   * -----------------------------------------------------------------*/
  const statusAtual = [...uniqueStatus][0];
  let proximoStatus;
  let precisaNumeroNF = false;

  switch (statusAtual) {
    case '01':
      proximoStatus     = '05';
      precisaNumeroNF   = true;
      break;
    case '05':
      proximoStatus     = '15';
      break;
    default:
      return req.error(400,
        `Não há transição definida para o status ${statusAtual}.`);
  }

  /* ------------------------------------------------------------------
   * 4. Atualiza em massa (bulk update)
   * -----------------------------------------------------------------*/
  const dataToSet = { status: proximoStatus };
  if (precisaNumeroNF) {
    // gera o mesmo número para todas ou, se quiser, gere um por NF
    dataToSet.numeroNfseServico =
      Math.floor(1_000_000_000 + Math.random() * 900_000_000).toString();
  }

  const rows = await tx.update(NotaFiscalServicoMonitor)
                       .set(dataToSet)
                       .where({ idAlocacaoSAP: { in: notasFiscaisIDs } });

  /* ------------------------------------------------------------------
   * 5. Monta o retorno
   * -----------------------------------------------------------------*/
  notasFiscaisIDs.forEach(id => {
    const ok = rows > 0; // rows é o total de registros afetados
    results.push({
      idAlocacaoSAP     : id,
      success           : ok,
      message           : ok
        ? `NF avançada para ${proximoStatus}.`
        : 'Falha ao atualizar.',
      novoStatus        : ok ? proximoStatus : statusAtual,
      numeroNfseServico : precisaNumeroNF ? dataToSet.numeroNfseServico : null
    });
  });

  return results;
});



});
