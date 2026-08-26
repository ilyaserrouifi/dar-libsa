const express = require("express");
const { sql } = require("../db/connection");
const { requireAdmin } = require("../middlewares/auth");

const router = express.Router();

// Génère un slug à partir du nom du produit.
// Fonctionne aussi pour les noms non-latins (arabe, etc.) : si aucun caractère
// a-z0-9 ne subsiste après nettoyage, on retombe sur un slug aléatoire unique
// plutôt que de produire une chaîne vide (qui violait la contrainte UNIQUE
// dès le 2e produit avec un nom en arabe).
function slugify(name) {
  const base = name
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents latins
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base || `produit-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// S'assure que le slug est unique en base ; ajoute un suffixe si besoin.
async function uniqueSlug(baseSlug) {
  let slug = baseSlug;
  let i = 1;
  while (true) {
    const [existing] = await sql`SELECT id FROM products WHERE slug = ${slug}`;
    if (!existing) return slug;
    i += 1;
    slug = `${baseSlug}-${i}`;
  }
}

// GET /api/products?category=&size=&sort=&q=&limit=&includeVariants=&on_sale=
router.get("/", async (req, res) => {
  const { category, size, sort, q, limit, includeVariants, on_sale } = req.query;

  const categoryParam = category || null;
  const qParam = q ? `%${q}%` : null;
  const sortParam = sort || null;
  const limitParam = limit ? parseInt(limit, 10) : 60;
  const onSaleParam = on_sale === "true";

  let products = await sql`
    SELECT p.*, c.slug AS category
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.active = true
      AND (${categoryParam}::text IS NULL OR c.slug = ${categoryParam})
      AND (${qParam}::text IS NULL OR p.name ILIKE ${qParam})
      AND (${onSaleParam} = false OR (p.old_price IS NOT NULL AND p.old_price > p.base_price))
    ORDER BY
      CASE WHEN ${sortParam} = 'price_asc' THEN p.base_price END ASC,
      CASE WHEN ${sortParam} = 'price_desc' THEN p.base_price END DESC,
      p.created_at DESC
    LIMIT ${limitParam}
  `;

  if (size || includeVariants === "true") {
    const ids = products.map((p) => p.id);
    const variants = ids.length
      ? await sql`SELECT * FROM product_variants WHERE product_id = ANY(${ids})`
      : [];

    products = products
      .map((p) => ({ ...p, variants: variants.filter((v) => v.product_id === p.id) }))
      .filter((p) => !size || p.variants.some((v) => v.size === size && v.stock > 0));
  }

  res.json(products);
});

// GET /api/products/:idOrSlug — détail produit + variants
router.get("/:idOrSlug", async (req, res) => {
  const { idOrSlug } = req.params;
  const isNumeric = /^\d+$/.test(idOrSlug);

  const [product] = isNumeric
    ? await sql`SELECT p.*, c.slug AS category FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ${idOrSlug}`
    : await sql`SELECT p.*, c.slug AS category FROM products p JOIN categories c ON c.id = p.category_id WHERE p.slug = ${idOrSlug}`;

  if (!product) return res.status(404).json({ error: "Produit introuvable." });

  const variants = await sql`SELECT * FROM product_variants WHERE product_id = ${product.id}`;
  res.json({ ...product, variants });
});

// POST /api/products — création (admin)
router.post("/", requireAdmin, async (req, res) => {
  const { name, description, category, base_price, old_price, badge, image, images, videos, details, model_3d_url } = req.body;
  if (!name || !category || !base_price) {
    return res.status(400).json({ error: "name, category et base_price sont requis." });
  }

  const [cat] = await sql`SELECT id FROM categories WHERE slug = ${category}`;
  if (!cat) return res.status(400).json({ error: "Catégorie inconnue." });

  const slug = await uniqueSlug(slugify(name));
  const imagesJson = JSON.stringify(Array.isArray(images) ? images : []);
  const videosJson = JSON.stringify(Array.isArray(videos) ? videos : []);
  const detailsJson = JSON.stringify(details && typeof details === "object" ? details : {});

  const [product] = await sql`
    INSERT INTO products (name, slug, description, category_id, base_price, old_price, badge, image, images, videos, details, model_3d_url)
    VALUES (${name}, ${slug}, ${description || null}, ${cat.id}, ${base_price}, ${old_price || null}, ${badge || null}, ${image || null}, ${imagesJson}::jsonb, ${videosJson}::jsonb, ${detailsJson}::jsonb, ${model_3d_url || null})
    RETURNING *
  `;
  res.status(201).json(product);
});

// PUT /api/products/:id — mise à jour (admin)
router.put("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, base_price, old_price, badge, image, images, videos, details, model_3d_url, active } = req.body;
  const imagesJson = images !== undefined ? JSON.stringify(Array.isArray(images) ? images : []) : null;
  const videosJson = videos !== undefined ? JSON.stringify(Array.isArray(videos) ? videos : []) : null;
  const detailsJson = details !== undefined ? JSON.stringify(details && typeof details === "object" ? details : {}) : null;

  const [product] = await sql`
    UPDATE products SET
      name = COALESCE(${name}, name),
      description = COALESCE(${description}, description),
      base_price = COALESCE(${base_price}, base_price),
      old_price = ${old_price || null},
      badge = ${badge || null},
      image = COALESCE(${image}, image),
      images = COALESCE(${imagesJson}::jsonb, images),
      videos = COALESCE(${videosJson}::jsonb, videos),
      details = COALESCE(${detailsJson}::jsonb, details),
      model_3d_url = COALESCE(${model_3d_url}, model_3d_url),
      active = COALESCE(${active}, active)
    WHERE id = ${id}
    RETURNING *
  `;
  if (!product) return res.status(404).json({ error: "Produit introuvable." });
  res.json(product);
});

// DELETE /api/products/:id — désactivation logique (admin)
router.delete("/:id", requireAdmin, async (req, res) => {
  await sql`UPDATE products SET active = false WHERE id = ${req.params.id}`;
  res.status(204).send();
});

// GET /api/products/:id/variants
router.get("/:id/variants", async (req, res) => {
  const variants = await sql`SELECT * FROM product_variants WHERE product_id = ${req.params.id}`;
  res.json(variants);
});

// POST /api/products/:id/variants — ajouter une combinaison taille/couleur (admin)
router.post("/:id/variants", requireAdmin, async (req, res) => {
  const { size, color, stock, sku, price_override } = req.body;
  const [variant] = await sql`
    INSERT INTO product_variants (product_id, size, color, stock, sku, price_override)
    VALUES (${req.params.id}, ${size}, ${color}, ${stock || 0}, ${sku || null}, ${price_override || null})
    RETURNING *
  `;
  res.status(201).json(variant);
});

module.exports = router;
