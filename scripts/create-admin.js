/**
 * DAMA — Créer le compte admin initial
 * Usage: node scripts/create-admin.js admin@dama.ma "MotDePasseSolide123"
 * Nécessite DATABASE_URL dans .env
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { sql } = require("../backend/db/connection");

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: node scripts/create-admin.js <email> "<mot de passe>"');
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(password, 10);
  const [user] = await sql`
    INSERT INTO users (email, password_hash, name, role)
    VALUES (${email}, ${password_hash}, 'Admin', 'admin')
    ON CONFLICT (email) DO UPDATE SET password_hash = ${password_hash}, role = 'admin'
    RETURNING id, email, role
  `;
  console.log("Compte admin prêt:", user);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
