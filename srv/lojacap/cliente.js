// srv/lojacap/cliente.js
const cds = require('@sap/cds');

module.exports = function (srv) {
  const { Clientes } = srv.entities;

    // 🔐 loginCliente
    srv.on('loginCliente', async req => {
      const { email, senha } = req.data;
      const user = await SELECT.one.from(Clientes).where({ email, senha });
      if (!user) return req.reject(401, 'Login inválido');

      await UPDATE(Clientes).set({}).where({ ID: user.ID });
      await UPDATE('my.shop.Cliente')
        .set({ createdBy: req.user.id })
        .where({ ID: user.ID });

      return 'OK';
    });

    // 🛂 before CREATE/UPDATE Clientes
    srv.before(['CREATE', 'UPDATE'], 'Clientes', async req => {
      const { nome, email, senha } = req.data;
      if (!nome || !email || !senha)
        return req.error(400, 'Todos os campos são obrigatórios');

      if (nome.length < 6)
        return req.error(400, 'O nome deve ter pelo menos 6 caracteres.');

      if (senha.length < 6)
        return req.error(400, 'A senha deve ter pelo menos 6 caracteres.');

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email))
        return req.error(400, 'Formato de e-mail inválido.');
    });
  }
