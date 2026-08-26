const express = require("express");
const { sql } = require("../db/connection");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

// GET /api/cart — panier de l'utilisateur connecté
router.get("/", requireAuth, async (req, res) => {
  const [cart] = await sql`SELECT items FROM carts WHERE user_id = ${req.user.id}`;
  res.json(cart?.items || []);
});

// POST /api/cart — remplace le panier de l'utilisateur connecté (upsert)
router.post("/", requireAuth, async (req, res) => {
  const { items } = req.body;
  await sql`
    INSERT INTO carts (user_id, items) VALUES (${req.user.id}, ${JSON.stringify(items)})
    ON CONFLICT (user_id) DO UPDATE SET items = ${JSON.stringify(items)}, updated_at = now()
  `;
  res.status(204).send();
});

module.exports = router;
