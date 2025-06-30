sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, JSONModel) {
    "use strict";

    return Controller.extend("lojacap.controller.chatbot", {

        onInit: function () {
            // Padrão ouro: inicializa o modelo com os dados corretos. Perfeito!
            this.getView().setModel(new JSONModel({ chat: [] }), "chat");
            console.log("Controller onInit: Modelo 'chat' inicializado.");
        },

        onSend: async function () {
            const oView = this.getView();
            const oInput = oView.byId("input");
            const sQuestion = oInput.getValue().trim();

            if (!sQuestion) {
                console.warn("onSend: Tentativa de enviar mensagem vazia.");
                return;
            }

            console.log("onSend: Mensagem do usuário:", sQuestion);
            this._addMessageToChat("user", sQuestion);
            oInput.setValue("");

            // Bloco de chamada da sua function
            const oModel = oView.getModel();
            const oFunction = oModel.bindContext("/callDeepSeek(...)");
            oFunction.setParameter("question", sQuestion);

            try {
                console.log("onSend: Executando a function 'callDeepSeek'.");
                await oFunction.execute();
                const sAnswer = (await oFunction.getBoundContext().requestObject()).value;
                console.log("onSend: Resposta recebida do bot:", sAnswer);

                this._addMessageToChat("bot", sAnswer);
            } catch (e) {
                console.error("onSend: Erro ao chamar a function.", e);
                MessageToast.show("Erro ao conectar com o serviço: " + e.message);
            }
        },

        _addMessageToChat: function (sSender, sText) {
            const oChatModel = this.getView().getModel("chat");
            const aHistory = oChatModel.getProperty("/chat");

            console.log("Adicionando mensagem. Sender:", sSender, "| Text:", sText);

            aHistory.push({
                sender: sSender,
                text: sText
            });

            oChatModel.refresh();
            console.log("Modelo 'chat' atualizado e refresh forçado.");

            // Leva o scroll para o final da conversa
            setTimeout(() => {
                const oScrollContainer = this.byId("scrollContainer");
                if (oScrollContainer) {
                    oScrollContainer.scrollTo(0, 999999, 300); // Rola para o fim com animação
                    console.log("Auto-scroll para o final executado.");
                }
            }, 0);
        },
        onChatUpdateFinished: function (oEvent) {
            console.log("onChatUpdateFinished: A lista foi atualizada. Aplicando estilos...");

            const aItems = oEvent.getSource().getItems(); // Pega todos os itens da lista

            aItems.forEach(item => {
                // Pega o VBox (nosso balão) que está dentro do CustomListItem
                // A estrutura é: CustomListItem -> HBox -> VBox
                const oChatBubbleVBox = item.getContent()[0].getItems()[0]; 
                
                // Pega o objeto de dados vinculado a este item
                const oContext = item.getBindingContext("chat");
                const oMessageData = oContext.getObject();

                if (oMessageData && oChatBubbleVBox) {
                    const isUser = oMessageData.sender === "user";
                    console.log(`- Processando item para sender: '${oMessageData.sender}'. É usuário? ${isUser}`);
                    
                    // toggleStyleClass é perfeito: adiciona a classe se o segundo parâmetro for true,
                    // e remove se for false.
                    oChatBubbleVBox.toggleStyleClass("chatUserMsg", isUser);
                    oChatBubbleVBox.toggleStyleClass("chatBotMsg", !isUser);
                }
            });
        }
    });
});