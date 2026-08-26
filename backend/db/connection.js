/**
 * DAMA — Connexion base de données (Neon PostgreSQL)
 * Utilise @neondatabase/serverless : driver HTTP, sans pool TCP persistant,
 * donc parfaitement adapté aux fonctions serverless de Vercel.
 */
const { neon } = require("@neondatabase/serverless");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant — copie .env.example vers .env et renseigne ton URL Neon.");
}

// `sql` est une fonction "tagged template" : sql`SELECT * FROM produits WHERE id = ${id}`
// Les paramètres sont automatiquement échappés (protection contre les injections SQL).
const sql = neon(process.env.DATABASE_URL);

module.exports = { sql };
