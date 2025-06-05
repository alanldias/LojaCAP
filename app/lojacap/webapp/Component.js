sap.ui.define([
    "sap/ui/core/UIComponent",
    "lojacap/model/models",
    "sap/ui/model/json/JSONModel"
], (UIComponent, models, JSONModel) => {
    "use strict";

    return UIComponent.extend("lojacap.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();

            this.setModel(new JSONModel({}), "navArgs"); 
            console.log("🌀 Component.js: Modelo 'navArgs' criado.");
        }
    });
});