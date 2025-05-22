sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
  "use strict";

  return Controller.extend("lojacap.controller.login-page", {

    onInit: function () {},

    onGoToRegister: function () {
      window.location.href = "/cadastroclientes/index.html";
    },

    // Marque a função como async
    onLoginPress: async function () {
      const email = this.byId("emailInput").getValue();
      const senha = this.byId("senhaInput").getValue();

      if (!email || !senha) {
        MessageBox.warning("Preencha todos os campos.");
        return;
      }

      const oModel = this.getOwnerComponent().getModel();

      // 1. Executar o Login
      const oLoginAction = oModel.bindContext("/loginCliente(...)"); // Verifique se o path está correto
      oLoginAction.setParameter("email", email);
      oLoginAction.setParameter("senha", senha);

      try {
        await oLoginAction.execute();
        const loginResponseContext = oLoginAction.getBoundContext();
        if (!loginResponseContext) {
            MessageBox.error("Erro ao processar resposta do login.");
            oLoginAction.resetChanges();
            return;
        }
        const loginResponse = loginResponseContext.getObject();
        const loginResult = loginResponse?.value; // Assumindo que a action retorna um objeto com a propriedade 'value'

        if (!loginResult || loginResult !== "OK") {
          MessageBox.error("E-mail ou senha inválidos.");
          oLoginAction.resetChanges(); // Importante resetar em caso de erro de lógica de negócio
          return;
        }

        // Login bem-sucedido! Agora, vamos tentar o merge do carrinho.
        const carrinhoAnonimoIDAtual = localStorage.getItem("carrinhoID");
        let mensagemLogin = "Login realizado!";

        if (carrinhoAnonimoIDAtual) {
    
          const oMergeAction = oModel.bindContext("/mergeCarrinho(...)");
          oMergeAction.setParameter("carrinhoAnonimoID", carrinhoAnonimoIDAtual);

          try {
            await oMergeAction.execute();
            const mergeResponseContext = oMergeAction.getBoundContext();
            if (mergeResponseContext) {
              const mergeResult = mergeResponseContext.getObject();
              // Supondo que sua action mergeCarrinho retorna um objeto como { carrinhoID: "ID_DO_CARRINHO_FINAL" }
              if (mergeResult && mergeResult.carrinhoID) {
                localStorage.setItem("carrinhoID", mergeResult.carrinhoID);
                MessageToast.show("Carrinho sincronizado!");
              } else {
                // O merge pode ter sido executado, mas não retornou o ID esperado.
                // Não é um erro fatal para o login, mas registre.
                console.warn("Merge do carrinho executado, mas o ID do carrinho não foi retornado como esperado.", mergeResult);
                mensagemLogin = "Login realizado! Problema ao obter ID do carrinho sincronizado.";
              }
            } else {
                console.warn("Contexto da resposta do merge do carrinho não encontrado.");
                mensagemLogin = "Login realizado! Resposta do merge do carrinho não processada.";
            }
          } catch (mergeErr) {
            // O login foi bem-sucedido, mas o merge do carrinho falhou.
            // O usuário pode continuar, mas o carrinho não estará sincronizado.
            console.error("Erro ao sincronizar carrinho:", mergeErr);
            MessageToast.show("Login realizado, mas houve um problema ao sincronizar seu carrinho: " + mergeErr.message);
            // Não definir mensagemLogin aqui, pois o MessageToast acima já informou o problema específico.
            oMergeAction.resetChanges();
          }
        }

        // Finalizar o processo de login
        localStorage.setItem("logado", "true");
        if (mensagemLogin === "Login realizado!") { // Só mostra o toast de login simples se não houve outro mais específico
            MessageToast.show(mensagemLogin);
        }
        this.getOwnerComponent().getRouter().navTo("Routehome-page");

      } catch (loginErr) {
        MessageBox.error("Erro ao fazer login: " + loginErr.message);
        oLoginAction.resetChanges();
      }
    }
  });
});