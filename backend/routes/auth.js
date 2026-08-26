const express = require("express");
const bcrypt = require("bcryptjs");
const { sql } = require("../db/connection");
const { signToken, requireAuth } = require("../middlewares/auth");

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email et password sont requis." });

  const [existing] = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing) return res.status(409).json({ error: "Un compte existe déjà avec cet email." });

  const password_hash = await bcrypt.hash(password, 10);
  const [user] = await sql`
    INSERT INTO users (email, password_hash, name, role)
    VALUES (${email}, ${password_hash}, ${name || null}, 'client')
    RETURNING id, email, name, role
  `;
  res.status(201).json({ user, token: signToken(user) });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
  if (!user) return res.status(401).json({ error: "Email ou mot de passe incorrect." });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Email ou mot de passe incorrect." });

  const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  res.json({ user: safeUser, token: signToken(safeUser) });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
