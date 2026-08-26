/**
 * DAMA — Entrée Vercel
 * Vercel transforme automatiquement tout fichier sous /api en fonction
 * serverless. Comme une app Express est elle-même une fonction (req, res),
 * on peut l'exporter directement : toutes les routes /api/* définies dans
 * backend/app.js sont alors servies par cette unique fonction.
 */
module.exports = require("../backend/app");
