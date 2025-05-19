sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
  ], function (Controller, MessageBox, MessageToast) {
    "use strict";
  
    return Controller.extend("lojacap.controller.register-page", {
      onInit: function () {},
  
      onRegisterPress: function () {

        console.log("Botão de registrar clicado!");

        const nome = this.byId("nomeInputRegister").getValue();
        const email = this.byId("emailInputRegister").getValue();
        const senha = this.byId("senhaInputRegister").getValue();
  
        if (!nome || !email || !senha) {
          MessageBox.warning("Preencha todos os campos.");
          return;
        }
  
        const oModel = this.getOwnerComponent().getModel();
        
        //  Correção: deferred = necessário para action
        console.log("➡️ Enviando para a action registerCliente");
        const oAction = oModel.bindContext("/registerCliente(...)");
  
        oAction.setParameter("nome", nome);
        oAction.setParameter("email", email);
        oAction.setParameter("senha", senha);
  
        oAction.execute().then(() => {
          const token = oAction.getBoundContext().getObject();
          if (!token) {
            MessageBox.error("Erro no cadastro.");
            return;
          }
  
          localStorage.setItem("token", token);
          MessageToast.show("Cadastro realizado com sucesso!");
          this.getOwnerComponent().getRouter().navTo("RouteLogin");
        }).catch((err) => {
          MessageBox.error("Erro ao cadastrar: " + err.message);
        });
      }
    });
  });
  