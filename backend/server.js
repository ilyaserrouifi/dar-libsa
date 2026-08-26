/**
 * DAMA — Serveur local
 * Sur Vercel, ce fichier n'est PAS utilisé : c'est /api/index.js qui sert
 * l'app Express comme fonction serverless. Ce fichier sert uniquement
 * au développement local (`npm run dev`).
 */
require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DAMA API en écoute sur http://localhost:${PORT}`);
});
