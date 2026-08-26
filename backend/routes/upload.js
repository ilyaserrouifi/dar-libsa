/**
 * DAMA — Upload d'images (Vercel Blob)
 *
 * POST /api/upload?filename=mon-produit.jpg
 * Body: le fichier brut (pas de multipart/form-data côté client, juste le File).
 * Header: Authorization: Bearer <token admin>
 *
 * Réponse: { url: "https://<store>.public.blob.vercel-storage.com/..." }
 * `url` est ensuite stockée dans products.image ou products.model_3d_url.
 */
const express = require("express");
const { put } = require("@vercel/blob");
const { generateClientTokenFromReadWriteToken } = require("@vercel/blob/client");
const { requireAdmin } = require("../middlewares/auth");

const router = express.Router();

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.warn("⚠️ BLOB_READ_WRITE_TOKEN manquant — /api/upload ne fonctionnera pas.");
}

// express.raw() capte le corps de la requête comme Buffer brut (le fichier envoyé
// directement via fetch(url, { method: "POST", body: file })).
router.post(
  "/",
  requireAdmin,
  express.raw({ type: "*/*", limit: "15mb" }),
  async (req, res) => {
    const { filename } = req.query;
    if (!filename) {
      return res.status(400).json({ error: "Paramètre ?filename= requis." });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "Fichier vide ou manquant dans le corps de la requête." });
    }

    try {
      const blob = await put(filename, req.body, {
        access: "public",
        addRandomSuffix: true,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      res.status(201).json(blob); // { url, downloadUrl, pathname, ... }
    } catch (err) {
      console.error("Erreur upload Blob:", err);
      res.status(500).json({ error: "Échec de l'upload vers Vercel Blob." });
    }
  }
);

/**
 * POST /api/upload/token — génère un jeton d'upload direct.
 *
 * Le fichier ne transite JAMAIS par notre fonction serverless (qui est
 * plafonnée à 4.5 Mo sur Vercel) : le navigateur envoie les octets
 * directement à Vercel Blob avec ce jeton. Indispensable pour les vidéos
 * et les photos de téléphone qui dépassent souvent 4.5 Mo.
 *
 * Body: { filename: "hero.mp4" }
 * Réponse: { token: "...", pathname: "hero.mp4" }
 */
router.post("/token", requireAdmin, async (req, res) => {
  const { filename } = req.body || {};
  if (!filename) return res.status(400).json({ error: "filename est requis." });

  try {
    const token = await generateClientTokenFromReadWriteToken({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      pathname: filename,
      addRandomSuffix: true,
      allowedContentTypes: ["image/*", "video/*"],
      maximumSizeInBytes: 300 * 1024 * 1024, // 300 Mo — large pour une vidéo courte
    });
    res.json({ token, pathname: filename });
  } catch (err) {
    console.error("Erreur génération token Blob:", err);
    res.status(500).json({ error: "Impossible de générer le jeton d'upload." });
  }
});

module.exports = router;
