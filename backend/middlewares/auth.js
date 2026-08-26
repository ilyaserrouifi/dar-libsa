/**
 * DAMA — Middlewares d'authentification
 */
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET manquant — définis-le dans .env (chaîne longue et aléatoire).");
}

/** Vérifie le token JWT s'il est présent, et attache req.user. Ne bloque pas si absent. */
function attachUser(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    // Token invalide ou expiré : on continue sans utilisateur authentifié.
  }
  next();
}

/** Bloque la requête si l'utilisateur n'est pas authentifié. */
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentification requise." });
  next();
}

/** Bloque la requête si l'utilisateur n'est pas admin. */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Accès réservé aux administrateurs." });
  }
  next();
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

module.exports = { attachUser, requireAuth, requireAdmin, signToken };
