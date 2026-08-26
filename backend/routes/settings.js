const express = require("express");
const { sql } = require("../db/connection");
const { requireAdmin } = require("../middlewares/auth");

const router = express.Router();

const DEFAULTS = {
  theme: "rose",
  logo: "",
  hero_eyebrow: "Collection en cours",
  hero_title: "Des pièces taillées pour la vie de tous les jours.",
  hero_subtitle: "T-shirts, sacs, chaussures et sandales — chaque produit se voit en 3D avant d'être dans votre panier.",
  hero_image: "",
  hero_images: "[]",
  hero_video: "",
  promo_active: "false",
  promo_text: "",
  site_description: "DAMA — vêtements, sacs, chaussures et sandales pensés pour la femme marocaine.",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  maps_link: "",
  horaires: "",
  facebook: "",
  instagram: "",
  tiktok: "",
};

// GET /api/settings — public, renvoie un objet { key: value }
router.get("/", async (req, res) => {
  const rows = await sql`SELECT key, value FROM site_settings`;
  const settings = { ...DEFAULTS };
  rows.forEach((r) => { settings[r.key] = r.value; });
  res.json(settings);
});

// PUT /api/settings — admin uniquement, upsert de plusieurs clés à la fois
// Body: { theme: "rose", hero_title: "...", ... }
router.put("/", requireAdmin, async (req, res) => {
  const entries = Object.entries(req.body || {});
  if (!entries.length) return res.status(400).json({ error: "Aucun réglage à mettre à jour." });

  for (const [key, value] of entries) {
    await sql`
      INSERT INTO site_settings (key, value) VALUES (${key}, ${String(value)})
      ON CONFLICT (key) DO UPDATE SET value = ${String(value)}
    `;
  }

  const rows = await sql`SELECT key, value FROM site_settings`;
  const settings = { ...DEFAULTS };
  rows.forEach((r) => { settings[r.key] = r.value; });
  res.json(settings);
});

module.exports = router;
