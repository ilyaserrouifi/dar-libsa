const express = require("express");
const { sql } = require("../db/connection");
const { requireAdmin } = require("../middlewares/auth");

const router = express.Router();

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // enlève les accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// GET /api/categories — liste publique, avec le nombre de produits actifs par catégorie
router.get("/", async (req, res) => {
  const categories = await sql`
    SELECT c.id, c.name, c.slug, c.icon, c.image,
           COUNT(p.id) FILTER (WHERE p.active = true)::int AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `;
  res.json(categories);
});

// POST /api/categories — création (admin uniquement)
router.post("/", requireAdmin, async (req, res) => {
  const { name, icon, image } = req.body;
  let { slug } = req.body;
  if (!name) return res.status(400).json({ error: "Le nom est requis." });
  if (!slug) slug = slugify(name);

  const existing = await sql`SELECT id FROM categories WHERE slug = ${slug}`;
  if (existing.length) return res.status(409).json({ error: "Une catégorie avec ce slug existe déjà." });

  const [category] = await sql`
    INSERT INTO categories (name, slug, icon, image)
    VALUES (${name}, ${slug}, ${icon || "fa-shirt"}, ${image || null})
    RETURNING *
  `;
  res.status(201).json(category);
});

// PUT /api/categories/:id — modification (admin uniquement)
router.put("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, slug, icon, image } = req.body;

  const [existing] = await sql`SELECT * FROM categories WHERE id = ${id}`;
  if (!existing) return res.status(404).json({ error: "Catégorie introuvable." });

  if (slug && slug !== existing.slug) {
    const clash = await sql`SELECT id FROM categories WHERE slug = ${slug} AND id != ${id}`;
    if (clash.length) return res.status(409).json({ error: "Une catégorie avec ce slug existe déjà." });
  }

  const [category] = await sql`
    UPDATE categories SET
      name = ${name ?? existing.name},
      slug = ${slug || existing.slug},
      icon = ${icon || existing.icon},
      image = ${image !== undefined ? image : existing.image}
    WHERE id = ${id}
    RETURNING *
  `;
  res.json(category);
});

// DELETE /api/categories/:id — suppression (admin uniquement, bloquée si des produits l'utilisent)
router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM products WHERE category_id = ${id}`;
  if (count > 0) {
    return res.status(400).json({
      error: `Impossible de supprimer : ${count} produit${count > 1 ? "s" : ""} utilise${count > 1 ? "nt" : ""} encore cette catégorie.`,
    });
  }
  const deleted = await sql`DELETE FROM categories WHERE id = ${id} RETURNING id`;
  if (!deleted.length) return res.status(404).json({ error: "Catégorie introuvable." });
  res.json({ ok: true });
});

module.exports = router;
