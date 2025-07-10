const cds = require('@sap/cds');

module.exports = function (srv) {
    const { Pedidos } = srv.entities;
    const { SELECT, UPDATE } = cds;


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
                case 'PAGO': each.statusCriticality = 3; break; // Verde (Success)
                case 'ENVIADO': each.statusCriticality = 5; break; // Azul (Information)
                case 'ENTREGUE': each.statusCriticality = 3; break; // Verde (Success) ou 0 (Neutro)
                case 'CANCELADO': each.statusCriticality = 1; break; // Vermelho (Error)
                default: each.statusCriticality = 0; // Cinza (Neutral)
            }
        } else {
            each.statusCriticality = 0; // Default se status for nulo
        }
    });
}