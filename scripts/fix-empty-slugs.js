/**
 * DAMA — Corrige les produits existants dont le slug est vide ou invalide
 * (généralement des produits dont le nom est en arabe, généré avant le fix
 * de backend/routes/products.js).
 *
 * Usage: node scripts/fix-empty-slugs.js
 * Nécessite DATABASE_URL dans .env
 */
require("dotenv").config();
const { sql } = require("../backend/db/connection");

function slugify(name) {
  const base = name
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base || `produit-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function uniqueSlug(baseSlug, excludeId) {
  let slug = baseSlug;
  let i = 1;
  while (true) {
    const [existing] = await sql`SELECT id FROM products WHERE slug = ${slug} AND id != ${excludeId}`;
    if (!existing) return slug;
    i += 1;
    slug = `${baseSlug}-${i}`;
  }
}

async function main() {
  // Cible les slugs vides, null, ou composés uniquement de tirets (résidu de l'ancien bug)
  const broken = await sql`SELECT id, name, slug FROM products WHERE slug IS NULL OR slug = '' OR slug ~ '^-*$'`;

  if (broken.length === 0) {
    console.log("Aucun produit avec un slug cassé. Rien à faire.");
    return;
  }

  console.log(`${broken.length} produit(s) avec un slug cassé trouvé(s).`);

  for (const p of broken) {
    const newSlug = await uniqueSlug(slugify(p.name), p.id);
    await sql`UPDATE products SET slug = ${newSlug} WHERE id = ${p.id}`;
    console.log(`- #${p.id} "${p.name}": "${p.slug}" -> "${newSlug}"`);
  }

  console.log("Terminé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
