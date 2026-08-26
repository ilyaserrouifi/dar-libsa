const express = require("express");
const cors = require("cors");
const { attachUser } = require("./middlewares/auth");

// ---------------------------------------------------------------------------
// Filet de sécurité : dans Express 4, une route "async (req,res) => {...}"
// qui rejette (ex: erreur SQL parce qu'une colonne n'existe pas encore en
// base) n'est PAS transmise au middleware d'erreurs — la requête reste
// bloquée indéfiniment et le bouton "Enregistrement…" ne se débloque jamais
// côté front. On corrige ça une fois pour toutes en enveloppant chaque route
// pour qu'une erreur appelle bien next(err).
// ---------------------------------------------------------------------------
["get", "post", "put", "delete", "patch"].forEach((method) => {
  const original = express.Router.prototype[method];
  express.Router.prototype[method] = function (path, ...handlers) {
    const wrapped = handlers.map((h) => {
      if (typeof h !== "function") return h;
      return function (req, res, next) {
        Promise.resolve(h(req, res, next)).catch(next);
      };
    });
    return original.call(this, path, ...wrapped);
  };
});

const app = express();

app.use(cors()); // en prod, restreindre à ton domaine Vercel via CORS_ORIGIN
// Limite relevée à 4 Mo : les images (logo, catégories, produits, galerie)
// sont désormais compressées et envoyées en base64 dans le JSON plutôt que
// via un upload direct vers un stockage externe (voir frontend/js/image-compress.js) —
// la limite par défaut d'Express (100 Ko) les aurait sinon rejetées avec une
// erreur "PayloadTooLarge" peu explicite côté interface.
app.use(express.json({ limit: "4mb" }));
app.use(attachUser); // attache req.user si un JWT valide est présent

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/categories", require("./routes/categories"));
app.use("/api/products", require("./routes/products"));
app.use("/api/variants", require("./routes/variants"));
app.use("/api/promotions", require("./routes/promotions"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/settings", require("./routes/settings"));

// Gestion d'erreurs centralisée — toute erreur non interceptée finit ici.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Erreur serveur inattendue." });
});

module.exports = app;
