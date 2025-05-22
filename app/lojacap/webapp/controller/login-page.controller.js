sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
  ], function (Controller, MessageBox, MessageToast) {
    "use strict";
  
    return Controller.extend("lojacap.controller.login-page", {   
  
      onInit: function () {},

      onGoToRegister: function () {
        window.location.href = "/cadastrocliente/webapp/index.html";
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
            const token = oAction.getBoundContext().getObject();
          
            if (!token) {
                MessageBox.error("E-mail ou senha inválidos.");
                return;
              }
              
              localStorage.setItem("token", token);
              MessageToast.show("Login realizado!");
              this.getOwnerComponent().getRouter().navTo("Routehome-page");
          }).catch((err) => {
            MessageBox.error("Erro ao fazer login: " + err.message);
            oAction.resetChanges(); // limpa o binding
          });          
      }
    });

 
  });
  