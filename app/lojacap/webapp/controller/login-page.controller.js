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
  
      onLoginPress: function () {
        const email = this.byId("emailInput").getValue();
        const senha = this.byId("senhaInput").getValue();
      
        if (!email || !senha) {
          MessageBox.warning("Preencha todos os campos.");
          return;
        }
      
        const oModel = this.getOwnerComponent().getModel();
      
        const oAction = oModel.bindContext("/loginCliente(...)"); // DEFERRED :(!
        oAction.setParameter("email", email);
        oAction.setParameter("senha", senha);
      
        oAction.execute().then(() => {
          const response = oAction.getBoundContext().getObject();
          const result = response?.value; // <- agora sim!
    if (!result || result !== "OK") {
            MessageBox.error("E-mail ou senha inválidos.");
            return;
          }
        
          localStorage.setItem("logado", "true"); // <- é isso que o carrinho vai verificar
          MessageToast.show("Login realizado!");
          this.getOwnerComponent().getRouter().navTo("Routehome-page");
        }).catch((err) => {
          MessageBox.error("Erro ao fazer login: " + err.message);
          oAction.resetChanges();
        });      
      }
    });

 
  });
  