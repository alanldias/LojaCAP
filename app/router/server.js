const xsenv = require('@sap/xsenv');
const approuter = require('@sap/approuter');

// Carrega variáveis do default-env.json automaticamente
xsenv.loadEnv();

const ar = approuter();
ar.start();
