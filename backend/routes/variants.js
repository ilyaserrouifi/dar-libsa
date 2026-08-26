const express = require("express");
const { sql } = require("../db/connection");
const { requireAdmin } = require("../middlewares/auth");

const router = express.Router();

// PUT /api/variants/:id — mettre à jour un variant (taille, couleur, stock, sku, prix) (admin)
router.put("/:id", requireAdmin, async (req, res) => {
  const { size, color, stock, sku, price_override } = req.body;
  const [variant] = await sql`
    UPDATE product_variants SET
      size = COALESCE(${size}, size),
      color = COALESCE(${color}, color),
      stock = COALESCE(${stock}, stock),
      sku = COALESCE(${sku}, sku),
      price_override = COALESCE(${price_override}, price_override)
    WHERE id = ${req.params.id}
    RETURNING *
  `;
  if (!variant) return res.status(404).json({ error: "Variant introuvable." });
  res.json(variant);
});

// DELETE /api/variants/:id — retirer une combinaison taille/couleur (admin)
router.delete("/:id", requireAdmin, async (req, res) => {
  await sql`DELETE FROM product_variants WHERE id = ${req.params.id}`;
  res.status(204).send();
});

module.exports = router;
