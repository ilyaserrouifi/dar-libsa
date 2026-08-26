const express = require("express");
const { sql } = require("../db/connection");
const { requireAdmin } = require("../middlewares/auth");

const router = express.Router();

// GET /api/promotions — public, liste complète (le front filtre active=true
// pour le popup / la page /promotions.html ; l'admin voit tout, y compris
// les promos désactivées, pour pouvoir les réactiver).
router.get("/", async (req, res) => {
  const promotions = await sql`SELECT * FROM promotions ORDER BY created_at DESC`;
  res.json(promotions);
});

// POST /api/promotions — création (admin)
router.post("/", requireAdmin, async (req, res) => {
  const { title, description, image, link_url, link_label, active } = req.body;
  if (!title) return res.status(400).json({ error: "Le titre est requis." });

  const [promo] = await sql`
    INSERT INTO promotions (title, description, image, link_url, link_label, active)
    VALUES (${title}, ${description || null}, ${image || null}, ${link_url || null}, ${link_label || null}, ${active !== false})
    RETURNING *
  `;
  res.status(201).json(promo);
});

// PUT /api/promotions/:id — modification (admin)
router.put("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, description, image, link_url, link_label, active } = req.body;

  const [existing] = await sql`SELECT * FROM promotions WHERE id = ${id}`;
  if (!existing) return res.status(404).json({ error: "Promotion introuvable." });

  const [promo] = await sql`
    UPDATE promotions SET
      title = ${title ?? existing.title},
      description = ${description !== undefined ? description : existing.description},
      image = ${image !== undefined ? image : existing.image},
      link_url = ${link_url !== undefined ? link_url : existing.link_url},
      link_label = ${link_label !== undefined ? link_label : existing.link_label},
      active = ${active !== undefined ? active : existing.active}
    WHERE id = ${id}
    RETURNING *
  `;
  res.json(promo);
});

// DELETE /api/promotions/:id — suppression (admin)
router.delete("/:id", requireAdmin, async (req, res) => {
  const deleted = await sql`DELETE FROM promotions WHERE id = ${req.params.id} RETURNING id`;
  if (!deleted.length) return res.status(404).json({ error: "Promotion introuvable." });
  res.status(204).send();
});

module.exports = router;
