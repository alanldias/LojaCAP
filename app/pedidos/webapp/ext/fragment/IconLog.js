sap.ui.define([
    "sap/m/MessageToast"
], function(MessageToast) {
    'use strict';

    return {
        onPress: function(oEvent) {
            const oIcon = oEvent.getSource();
            const sCurrentColor = oIcon.getColor();

            // Toggle para testes
            if (sCurrentColor === "Positive") {
                oIcon.setColor("Negative");
                oIcon.setSrc("sap-icon://decline");
                MessageToast.show("⛔ Backstep detectado. Status negativo.");
            } else if (sCurrentColor === "Negative") {
                oIcon.setColor("Neutral");
                oIcon.setSrc("sap-icon://cancel");
                MessageToast.show("❌ Nenhum passo válido detectado. X mostrado.");
            } else {
                oIcon.setColor("Positive");
                oIcon.setSrc("sap-icon://accept");
                MessageToast.show("✅ Nextstep detectado. Status positivo.");
            }
        }
    };
});
