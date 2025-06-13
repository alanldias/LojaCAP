const cds = require('@sap/cds');
const validator = require('validator')

const csv = require('csv-parser');
const { Readable } = require('stream');

const validation = require('./lib/validation');

module.exports = cds.service.impl(async function (srv) {
  const { Clientes, Pedidos, ItemPedido, Carrinhos, ItemCarrinho, Produtos, NotaFiscalServicoMonitor, NotaFiscalServicoLog } = srv.entities;

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

srv.before('CREATE', 'NotaFiscalServicoMonitor', (req) => {
  // Chamamos nossa função unificada
  const validacao = validation.validarNotaFiscal(req.data);

  // Se ela retornar que não é válido...
  if (!validacao.isValid) {
      // ...nós disparamos o erro do CAP com as mensagens retornadas.
      const mensagemDeErro = validacao.errors.join('\n');
      req.error(400, mensagemDeErro);
  }
});

this.on('avancarStatusNFs', async req => {
  const { grpFilho } = req.data || {};
  if (!grpFilho) return req.error(400, 'grpFilho é obrigatório');

  const tx = cds.transaction(req);

  /* 1. SELECT – traz IDs + status da 1ª linha;                   *
   *    lê valores extras só se precisar (status 15 ou 30).       */
  const rows = await tx.run(
    SELECT.from(NotaFiscalServicoMonitor)
          .columns(
            'idAlocacaoSAP',           // sempre
            'status',                  // sempre (para decidir a transição)
            'valorBrutoNfse',          // extras – virão, mas serão usados só
            'valorEfetivoFrete',       // quando status for 15 ou 30
            'valorLiquidoFreteNfse'
          )
          .where({ chaveDocumentoFilho: grpFilho })
  );
  if (!rows.length)
    return req.error(404, 'Nenhuma NF encontrada para esse grupo');

  const grpStatus = rows[0].status;        // status comum do grupo
  const ids       = rows.map(r => r.idAlocacaoSAP);

  /* 2. Despacha para a transição correta */
  switch (grpStatus) {
    case '01':  return trans01para05(tx, ids);
    case '05':  return trans05para15(tx, ids);
    case '15':  return trans15para30(tx, rows);
    case '30':  return trans30para35(tx, rows);
    case '35':  return trans35para50(tx, ids);
    default :   return req.error(400, `Status ${grpStatus} não suportado`);
  }
});



this.on('rejeitarFrete', async req => {
  const { grpFilho } = req.data || {};
  if (!grpFilho) return req.error(400, 'grpFilho é obrigatório');

  const tx = cds.transaction(req);

  /* 1️⃣  SELECT – pegar TODOS os IDs do grupo --------------------- */
  const linhas = await tx.run(
    SELECT.from(NotaFiscalServicoMonitor)
          .columns('idAlocacaoSAP')
          .where({ chaveDocumentoFilho: grpFilho })
  );
  if (!linhas.length) return req.error(404, 'Nenhuma NF no grupo');

  const ids = linhas.map(l => l.idAlocacaoSAP);

  /* 2️⃣  UPDATE em bloco – põe status 55 em todo o grupo ---------- */
  try {
    await tx.update(NotaFiscalServicoMonitor)
            .set({ status: '55' })
            .where({ chaveDocumentoFilho: grpFilho });

    /* grava LOG de sucesso (tipo = S) */
    // se preicsar tirar isso de aparecer na tabela de log só mudar isso 
    await tx.run(
      INSERT.into(NotaFiscalServicoLog).entries(
        ids.map(id => ({
          idAlocacaoSAP      : id,
          mensagemErro       : 'Frete rejeitado – status 55',
          tipoMensagemErro   : 'S',
          classeMensagemErro : 'REJ_FRETE',
          numeroMensagemErro : '055',
          origem             : 'rejeitarFrete'
        }))
      )
    );

    return sucesso(ids, '55');                         // helper padrão

  } catch (e) {
    /* qualquer erro → 1 log por NF com helper gravarLog */
    for (const id of ids) {
      await gravarLog(tx, id, e.message,
                      'E', 'REJ_FRETE', '055', 'rejeitarFrete');
    }
    return falha(ids, 'erro', 'Falha ao rejeitar: ' + e.message);
  }
});


function gerarNumeroNF() {
  return Math.floor(1_000_000_000 + Math.random() * 900_000_000).toString();
}

/** Monta array de resultados-padrão (sucesso = true). */
function sucesso(ids, proximoStatus, extra = {}) {
  return ids.map(id => ({
    idAlocacaoSAP     : id,
    success           : true,
    message           : `NF avançada para ${proximoStatus}.`,
    novoStatus        : proximoStatus,
    ...extra
  }));
}

/** Monta array de resultados-padrão (falha = false). */
function falha(ids, statusAtual, motivo) {
  return ids.map(id => ({
    idAlocacaoSAP     : id,
    success           : false,
    message           : motivo,
    novoStatus        : statusAtual
  }));
}


 //  Transições encapsuladas


/** 01 → 05 (gera n.º NF) */
async function trans01para05(tx, ids) {
  const numeroNF = gerarNumeroNF();
  try {
    await tx.update(NotaFiscalServicoMonitor)
            .set({ status: '05', numeroNfseServico: numeroNF })
            .where({ idAlocacaoSAP: { in: ids } });

    return sucesso(ids, '05', { numeroNfseServico: numeroNF });

  } catch (e) {
    for (const id of ids)
      await gravarLog(tx, id, e.message, 'E', 'TRANS_01_05', '002');
    return falha(ids, '01', 'Erro 01→05: ' + e.message);
  }
}

/** 05 → 15 (apenas status) */
async function trans05para15(tx, ids) {
  try {
    await tx.update(NotaFiscalServicoMonitor)
            .set({ status: '15' })
            .where({ idAlocacaoSAP: { in: ids } });
    return sucesso(ids, '15');
  } catch (e) {
    for (const id of ids)
      await gravarLog(tx, id, e.message, 'E', 'TRANS_05_15', '003');
    return falha(ids, '05', 'Erro 05→15: ' + e.message);
  }
}

/** 15 → 30  (all-or-nothing, lista **todos** os erros) */
async function trans15para30(tx, notas) {
  const resultados     = [];
  const valoresPorNota = new Map();
  const erros          = new Map();

  for (const nota of notas) {
    const id   = nota.idAlocacaoSAP;
    const resp = await BAPI_PO_CREATE1(nota);

    if (!resp.ok) {
      erros.set(id, resp.msg);
      await gravarLog(tx, id, resp.msg, 'E', 'BAPI_PO_CREATE1', '100');
      continue;                               // continua validando
    }
    valoresPorNota.set(id, resp.valores);
  }

  if (erros.size) {
    const idsComErro = [...erros.keys()].join(', ');
    notas.forEach(nota => {
      const id  = nota.idAlocacaoSAP;
      resultados.push({
        idAlocacaoSAP : id,
        success       : false,
        message       : erros.get(id) ||
                        `Processo abortado — erros nas NFs em outras NFS`,
        novoStatus    : '15'
      });
    });
    return resultados;
  }

  /* 3. Nenhum erro → grava todas e devolve sucesso - */
  for (const nota of notas) {
    const id      = nota.idAlocacaoSAP;
    const valores = valoresPorNota.get(id);

    await tx.update(NotaFiscalServicoMonitor)
            .set({ status: '30', ...valores })
            .where({ idAlocacaoSAP: id });

    resultados.push({
      idAlocacaoSAP : id,
      success       : true,
      message       : 'Status 15→30 e valores gravados.',
      novoStatus    : '30'
    });
  }
  return resultados;
}

/**
* Função de transição para o status 30 -> 35.
* Orquestra a chamada das BAPIs de MIRO e NF.
* @param {object} tx - A transação CAP.
* @param {Array<object>} notas - O array de notas a serem processadas.
* @returns {Promise<Array<object>>} Um array com os resultados do processamento.
*/
async function trans30para35(tx, notas) {
  const resultados = [];
  // Esta etapa é complexa e geralmente processada uma a uma (ou por documento filho)
  for (const nota of notas) {
      const { idAlocacaoSAP: id } = nota;
      console.log(`[TRANSITION_LOG] Iniciando 30->35 para a NF ${id}`);

      try {
          // --- ETAPA 1: Criar a MIRO ---
          const respMiro = await BAPI_INCOMINGINVOICE_CREATE1(nota);
          if (!respMiro.ok) {
              // Se a primeira BAPI falha, logamos o erro e pulamos para a próxima nota
              throw new Error(respMiro.msg);
          }
          console.log(`[TRANSITION_LOG] MIRO criada para NF ${id}. Documento: ${respMiro.valores.numeroDocumentoMIRO}`);

          // --- ETAPA 2: Criar a Nota Fiscal ---
          const respNF = await BAPI_J_1B_NF_CREATEFROMDATA(nota, respMiro.valores.numeroDocumentoMIRO);
          if (!respNF.ok) {
              // Se a segunda BAPI falha, a MIRO já foi "criada".
              // No mundo real, aqui teríamos uma lógica de compensação (cancelar a MIRO).
              // Na simulação, vamos apenas registrar o erro.
              console.error(`[TRANSITION_LOG] MIRO criada, mas criação da NF falhou para ${id}. Requer ação manual!`);
              throw new Error(respNF.msg);
          }
          console.log(`[TRANSITION_LOG] NF de serviço criada para ${id}.`);

          // --- ETAPA 3: Sucesso! Atualizar o status e gravar os dados ---
          await tx.update(NotaFiscalServicoMonitor)
              .set({
                  status: '35',
                  numeroDocumentoMIRO: respMiro.valores.numeroDocumentoMIRO,
                  // Adicione outros campos que a BAPI de NF retornaria, se houver
              })
              .where({ idAlocacaoSAP: id });
          
          resultados.push({
              idAlocacaoSAP: id,
              success: true,
              message: 'Fatura e Nota Fiscal criadas com sucesso.',
              novoStatus: '35'
          });

      } catch (error) {
          // Se qualquer passo falhar, o CATCH captura
          console.error(`[TRANSITION_LOG] Erro no fluxo 30->35 para NF ${id}:`, error.message);
          
          // Atualiza a NF para o status de erro
          await tx.update(NotaFiscalServicoMonitor)
                    .set({ status: '99', MSG_TEXT: error.message.substring(0,120) }) // Adicionei MSG_TEXT
                    .where({ idAlocacaoSAP: id });
          
          resultados.push({
              idAlocacaoSAP: id,
              success: false,
              message: error.message,
              novoStatus: '99'
          });
      }
  }
  return resultados;
}


/** 35 → 50 */
async function trans35para50(tx, ids) {
  await tx.update(NotaFiscalServicoMonitor)
          .set({ status: '50' })
          .where({ idAlocacaoSAP: { in: ids } });
  return sucesso(ids, '50');
}

//  BAPI mocks 

async function BAPI_PO_CREATE1(nota) {
  const { valorBrutoNfse, valorEfetivoFrete, valorLiquidoFreteNfse } = nota;
  const temValor = (valorBrutoNfse        && valorBrutoNfse        > 0) ||
                   (valorEfetivoFrete     && valorEfetivoFrete     > 0) ||
                   (valorLiquidoFreteNfse && valorLiquidoFreteNfse > 0);

  if (temValor) return { ok: false, msg: 'Campos de valores já preenchidos.' };

  const bruto   = Math.floor(10_000 + Math.random() * 90_000);
  const efetivo = +(bruto * 0.10).toFixed(2);
  const liquido = +(efetivo * 0.80).toFixed(2);

  return {
    ok: true,
    valores: {
      valorBrutoNfse       : bruto,
      valorEfetivoFrete    : efetivo,
      valorLiquidoFreteNfse: liquido
    }
  };
}

async function BAPI_TRANSACTION_ROLLBACK(motivo) {
  console.warn('↩️  Rollback:', motivo);
  return { ok: true, msg: motivo };
}
// /**
//  * MOCK da BAPI_INCOMINGINVOICE_CREATE1 para criar a MIRO (fatura).
//  * @returns {{ok: boolean, msg?: string, valores?: {numeroDocumentoMIRO: string}}}
//  */
async function BAPI_INCOMINGINVOICE_CREATE1(nota) {
  console.log(`[BAPI_SIMULATION] Criando MIRO para NF ${nota.idAlocacaoSAP}...`);
  // Aqui você pode adicionar lógicas de falha para teste, se quiser
  // if (nota.algumaCondicaoDeErro) {
  //    return { ok: false, msg: "Erro simulado na criação da MIRO." };
  // }
  return {
      ok: true,
      valores: {
          // Gera um número de documento de MIRO simulado
          numeroDocumentoMIRO: `510${Math.floor(1000000 + Math.random() * 9000000)}`
      }
  };
}

/**
* MOCK da BAPI_J_1B_NF_CREATEFROMDATA para criar a Nota Fiscal de Serviço.
* @returns {{ok: boolean, msg?: string}}
*/
  async function BAPI_J_1B_NF_CREATEFROMDATA(nota, miroDocNumber) {
  console.log(`[BAPI_SIMULATION] Criando NF de Serviço para MIRO ${miroDocNumber}...`);
  // if (miroDocNumber.endsWith('7')) { // Exemplo de condição de erro
  //    return { ok: false, msg: "Erro simulado: dados fiscais inválidos." };
  // }
  return { ok: true }; // Apenas confirma o sucesso
  }
async function gravarLog(
    tx,                        // transação CAP
    id,                        // idAlocacaoSAP da NF
    msg,
    tipo   = 'E',              // E=Error, W=Warning, I=Info
    classe = 'TRANSICAO',      // origem/classe mensagem
    num    = '001',            // código
    origem = 'avancarStatusNFs'
  ) {
  await tx.run(
    INSERT.into(NotaFiscalServicoLog).entries({
      ID                 : cds.utils.uuid(),
      idAlocacaoSAP      : id,      // FK lógico p/ a NF
      mensagemErro       : msg,
      tipoMensagemErro   : tipo,
      classeMensagemErro : classe,
      numeroMensagemErro : num,
      origem
    })
);
}
this.on('voltarStatusNFs', async (req) => {
  const { grpFilho, grpStatus } = req.data;

  if (!grpFilho || grpStatus === undefined) {
      return req.error(400, 'Critérios inválidos. Chave do documento filho e status são obrigatórios.');
  }
  
  const tx = cds.transaction(req);
  const notasParaReverter = await tx.read(NotaFiscalServicoMonitor).where({
      chaveDocumentoFilho: grpFilho,
      status: grpStatus 
  });

  if (notasParaReverter.length === 0) {
      return [];
  }

  switch (grpStatus) {
      case '50': return trans50para35_reverso(tx, notasParaReverter);
      case '35': return trans35para30_reverso(tx, notasParaReverter);
      case '30': return trans30para15_reverso(tx, notasParaReverter);
      case '15': return trans15para05_reverso(tx, notasParaReverter);
      case '05': return trans05para01_reverso(tx, notasParaReverter);
      default:
          return req.error(400, `Reversão não permitida para o status ${grpStatus}.`);
  }
});

// =======================================================
// ==                  FUNÇÕES HELPER                   ==
// =======================================================

/** Reverte 50 → 35 */
async function trans50para35_reverso(tx, notas) {
  const ids = notas.map(n => n.idAlocacaoSAP);
  const criterio = { chaveDocumentoFilho: notas[0].chaveDocumentoFilho, status: notas[0].status };
  await tx.update(NotaFiscalServicoMonitor).set({ status: '35' }).where(criterio);
  return sucesso(ids, '35', {}, "Status revertido para 'Fatura Criada'.");
}

/** Reverte 35 → 30 */
async function trans35para30_reverso(tx, notas) {
  const ids = notas.map(n => n.idAlocacaoSAP);
  const criterio = { chaveDocumentoFilho: notas[0].chaveDocumentoFilho, status: notas[0].status };
  await tx.update(NotaFiscalServicoMonitor).set({ status: '30', numeroDocumentoMIRO: null }).where(criterio);
  return sucesso(ids, '30', {}, "Status revertido. Dados da Fatura/MIRO removidos.");
}

/** Reverte 30 → 15 */
async function trans30para15_reverso(tx, notas) {
  const ids = notas.map(n => n.idAlocacaoSAP);
  const criterio = { chaveDocumentoFilho: notas[0].chaveDocumentoFilho, status: notas[0].status };
  await tx.update(NotaFiscalServicoMonitor)
      .set({ status: '15', valorBrutoNfse: 0.00, valorEfetivoFrete: 0.00, valorLiquidoFreteNfse: 0.00 })
      .where(criterio);
  return sucesso(ids, '15', {}, "Status revertido. Dados do Pedido de Compra removidos.");
}

/** Reverte 15 → 05 */
async function trans15para05_reverso(tx, notas) {
  const ids = notas.map(n => n.idAlocacaoSAP);
  const criterio = { chaveDocumentoFilho: notas[0].chaveDocumentoFilho, status: notas[0].status };
  await tx.update(NotaFiscalServicoMonitor).set({ status: '05' }).where(criterio);
  return sucesso(ids, '05', {}, "Status revertido para 'NF Atribuída'.");
}

/** Reverte 05 → 01 */
async function trans05para01_reverso(tx, notas) {
  const ids = notas.map(n => n.idAlocacaoSAP);
  const criterio = { chaveDocumentoFilho: notas[0].chaveDocumentoFilho, status: notas[0].status };
  await tx.update(NotaFiscalServicoMonitor).set({ status: '01', numeroNfseServico: null }).where(criterio);
  return sucesso(ids, '01', {}, "Status revertido para 'Não Atribuída'.");
}

srv.on('uploadArquivoFrete', async (req) => {
  const { data } = req.data;

  if (!data) {
      req.error(400, 'Nenhum arquivo recebido.');
      return false;
  }

  const buffer = Buffer.from(data.split(';base64,')[1], 'base64');
  const registrosDoCsv = [];

  return new Promise((resolve, reject) => {
      Readable.from(buffer)
          .pipe(csv({
              separator: ',',
              mapHeaders: ({ header }) => header.trim()
          }))
          .on('data', (row) => {
              registrosDoCsv.push(row);
          })
          .on('end', async () => {
              console.log(`[UPLOAD-LOG] Fim da leitura do CSV. Encontrados ${registrosDoCsv.length} registros.`);
              if (registrosDoCsv.length === 0) {
                  req.warn('O arquivo CSV está vazio ou em formato inválido.');
                  return resolve(false);
              }

              const registrosValidos = [];
              const todosOsErros = [];

              registrosDoCsv.forEach((registro, index) => {
                  // CHAMANDO A MESMA FUNÇÃO UNIFICADA DE VALIDAÇÃO
                  const validacao = validation.validarNotaFiscal(registro, index);

                  if (validacao.isValid) {
                      // Se válido, mapeia o registro para o formato da entidade
                      registrosValidos.push({
                          ID: registro.ID,
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
                  } else {
                      todosOsErros.push(...validacao.errors);
                  }
              });

              if (todosOsErros.length > 0) {
                  const mensagemDeErro = `O arquivo foi rejeitado por conter ${todosOsErros.length} erro(s):\n\n${todosOsErros.join('\n')}`;
                  console.error("[UPLOAD-VALIDATION] Erros encontrados:\n", mensagemDeErro);
                  req.error(400, mensagemDeErro);
                  return resolve(false);
              }

              try {
                  if (registrosValidos.length > 0) {
                      await cds.tx(req).run(UPSERT.into(NotaFiscalServicoMonitor).entries(registrosValidos));
                      req.notify(`Upload bem-sucedido! ${registrosValidos.length} registros importados/atualizados.`);
                      console.log(`[UPLOAD-LOG] SUCESSO! Inseridos/Atualizados ${registrosValidos.length} registros.`);
                      resolve(true);
                  } else {
                      req.warn("Nenhum registro válido encontrado no arquivo para processar.");
                      resolve(false);
                  }
              } catch (dbError) {
                  console.error("[UPLOAD-DB] Erro ao inserir dados no banco:", dbError);
                  req.error(500, 'Ocorreu um erro interno ao salvar os dados no banco de dados.');
                  reject(dbError);
              }
          })
          .on('error', (error) => {
              console.error("[UPLOAD] Erro crítico ao processar o CSV:", error);
              req.error(500, 'Ocorreu um erro na leitura do arquivo CSV.');
              reject(error);
          });
  });
});

});
