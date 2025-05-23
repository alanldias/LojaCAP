sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/ui/model/Filter", // Adicionado para a busca do cliente
  "sap/ui/model/FilterOperator" // Adicionado para a busca do cliente
], function (Controller, MessageBox, MessageToast, Filter, FilterOperator) { // Adicionados Filter e FilterOperator
  "use strict";

  return Controller.extend("lojacap.controller.login-page", {

      onInit: function () {},

      onGoToRegister: function () {
          window.location.href = "/cadastrocliente/webapp/index.html";
      },

      onLoginPress: async function () {
          const email = this.byId("emailInput").getValue();
          const senha = this.byId("senhaInput").getValue();

          if (!email || !senha) {
              MessageBox.warning("Preencha todos os campos.");
              return;
          }

          const oModel = this.getOwnerComponent().getModel();
          if (!oModel) {
              MessageBox.error("Erro crítico: Modelo principal não encontrado.");
              return;
          }

          const oLoginAction = oModel.bindContext("/loginCliente(...)");
          oLoginAction.setParameter("email", email);
          oLoginAction.setParameter("senha", senha);

          try {
              await oLoginAction.execute(); // Espera a action de login ser executada
              const loginResponseContext = oLoginAction.getBoundContext();

              if (!loginResponseContext) {
                  MessageBox.error("Erro ao processar resposta do login (contexto não encontrado).");
                  oLoginAction.resetChanges();
                  return;
              }

              const loginResponse = loginResponseContext.getObject();
              console.log("DEBUG: Resposta da Action loginCliente:", JSON.stringify(loginResponse));

              const loginResult = loginResponse?.value;

              if (!loginResult || loginResult !== "OK") {
                  MessageBox.error(loginResult || "E-mail ou senha inválidos.");
                  oLoginAction.resetChanges();
                  return;
              }

              // LOGIN BEM-SUCEDIDO (value === "OK")
              // Agora, vamos buscar os dados do cliente usando o e-mail
              localStorage.setItem("logado", "true"); // Marca como logado imediatamente

              try {
                  // Criar um binding para a lista de Clientes com um filtro pelo e-mail
                  // Assumindo que sua entidade Clientes pode ser acessada via /Clientes
                  // e que o campo de e-mail na entidade se chama 'email'
                  const oClienteListBinding = oModel.bindList("/Clientes", undefined, undefined, [
                      new Filter("email", FilterOperator.EQ, email)
                  ]);

                  // Solicita os contextos (dados) dos clientes filtrados (deve ser apenas 1)
                  const aClienteContexts = await oClienteListBinding.requestContexts(0, 1); // Pega o primeiro (e único esperado)

                  if (aClienteContexts && aClienteContexts.length > 0) {
                      const oClienteData = aClienteContexts[0].getObject();
                      console.log("DEBUG: Dados do cliente recuperados:", JSON.stringify(oClienteData));

                      // IMPORTANTE: Verifique no log acima qual é o nome EXATO da propriedade
                      // que contém o nome do cliente no objeto oClienteData.
                      // Estou assumindo que se chama 'nome'. Pode ser 'userName', 'nomeCompleto', etc.
                      const nomeClienteRecuperado = oClienteData?.nome;
                      const idClienteRecuperado = oClienteData?.ID; // Pega o ID também, pode ser útil

                      if (nomeClienteRecuperado && typeof nomeClienteRecuperado === 'string' && nomeClienteRecuperado.trim() !== "") {
                          localStorage.setItem("userName", nomeClienteRecuperado.trim());
                          console.log("DEBUG: login-page.controller - userName salvo no localStorage:", nomeClienteRecuperado.trim());
                          if (idClienteRecuperado) {
                              localStorage.setItem("clienteID", idClienteRecuperado); // Salva o ID do cliente
                          }
                      } else {
                          console.warn("DEBUG: login-page.controller - Nome do cliente não encontrado ou inválido nos dados recuperados do /Clientes. userName não será salvo.");
                          localStorage.removeItem("userName"); // Garante que não haja valor antigo
                      }
                  } else {
                      console.error("DEBUG: login-page.controller - Cliente não encontrado com o e-mail fornecido (" + email + ") após o login. userName não será salvo.");
                      localStorage.removeItem("userName");
                      // Você pode querer tratar isso como um erro mais sério, pois o login foi "OK"
                      // mas os dados do cliente não foram encontrados.
                      MessageBox.error("Login confirmado, mas houve um problema ao buscar os detalhes do seu usuário. Algumas funcionalidades podem não estar completas.");
                  }

              } catch (fetchError) {
                  console.error("DEBUG: login-page.controller - Erro ao tentar buscar dados do cliente após login:", fetchError);
                  localStorage.removeItem("userName");
                  MessageBox.error("Houve um erro ao carregar seus dados após o login. Tente novamente mais tarde.");
                  // Neste ponto, "logado" ainda está true. Você pode decidir se quer reverter isso.
                  // localStorage.removeItem("logado");
                  // oLoginAction.resetChanges(); // Pode não ser mais relevante aqui
                  return; // Interrompe o fluxo se não conseguir buscar os dados do cliente
              }


              // Lógica de Merge do Carrinho (mantida como estava)
              const carrinhoAnonimoIDAtual = localStorage.getItem("carrinhoID");
              let mensagemLogin = "Login realizado!"; // Mensagem padrão

              if (carrinhoAnonimoIDAtual) {
                  const oMergeAction = oModel.bindContext("/mergeCarrinho(...)");
                  oMergeAction.setParameter("carrinhoAnonimoID", carrinhoAnonimoIDAtual);
                  // IMPORTANTE: A action mergeCarrinho no backend pode precisar do clienteID.
                  // Se você salvou clienteID no localStorage, pode passá-lo aqui se necessário.
                  // Ex: oMergeAction.setParameter("clienteID", localStorage.getItem("clienteID"));
                  // Isso depende de como sua action mergeCarrinho identifica o cliente.

                  try {
                      await oMergeAction.execute();
                      const mergeResponseContext = oMergeAction.getBoundContext();
                      if (mergeResponseContext) {
                          const mergeResult = mergeResponseContext.getObject();
                          if (mergeResult && mergeResult.carrinhoID) {
                              localStorage.setItem("carrinhoID", mergeResult.carrinhoID);
                              MessageToast.show("Carrinho sincronizado!");
                          } else {
                              console.warn("Merge do carrinho executado, mas o ID do carrinho não foi retornado como esperado.", mergeResult);
                              mensagemLogin = "Login realizado! Problema ao obter ID do carrinho sincronizado.";
                          }
                      } else {
                          console.warn("Contexto da resposta do merge do carrinho não encontrado.");
                          mensagemLogin = "Login realizado! Resposta do merge do carrinho não processada.";
                      }
                  } catch (mergeErr) {
                      console.error("Erro ao sincronizar carrinho:", mergeErr);
                      MessageToast.show("Login realizado, mas houve um problema ao sincronizar seu carrinho: " + mergeErr.message);
                      oMergeAction.resetChanges();
                  }
              }
              localStorage.setItem("logado", "true");
              const nomeFinalParaToast = localStorage.getItem("userName");
              if (mensagemLogin === "Login realizado!") { // Só mostra o toast de login simples se não houve outro mais específico
                  MessageToast.show(mensagemLogin);
                  MessageToast.show("Bem-vindo(a), " + nomeFinalParaToast + "!");
              }
              // Finalizar o processo de login
              


              this.getOwnerComponent().getRouter().navTo("Routehome-page");

          } catch (loginErr) {
              MessageBox.error("Erro ao tentar fazer login: " + (loginErr.message || "Serviço indisponível."));
              console.error("DEBUG: Erro na execução da action de login:", loginErr);
              if (oLoginAction && typeof oLoginAction.resetChanges === 'function') {
                  oLoginAction.resetChanges();
              }
          }
      }
  });
});