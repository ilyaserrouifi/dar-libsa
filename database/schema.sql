-- ==========================================================================
-- DAMA — Schéma de base de données (Neon PostgreSQL)
-- À exécuter une fois sur ta base Neon (SQL editor de la console Neon,
-- ou via `psql $DATABASE_URL -f database/schema.sql`).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  icon       TEXT NOT NULL DEFAULT 'fa-shirt',  -- icône Font Awesome (ex: 'fa-shirt', 'fa-bag-shopping')
  image      TEXT                               -- image de couverture, affichée sur la page d'accueil
);

-- Ajout rétro-compatible si la table categories existait déjà avant ces colonnes.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'fa-shirt';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image TEXT;

CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  category_id   INTEGER NOT NULL REFERENCES categories(id),
  base_price    NUMERIC(10,2) NOT NULL,
  old_price     NUMERIC(10,2),  -- prix barré si le produit est en promo
  badge         TEXT,           -- ex: 'Promo', 'Nouveau' — affiché sur la carte produit
  image         TEXT,
  images        JSONB NOT NULL DEFAULT '[]', -- galerie de photos supplémentaires (fiche produit)
  videos        JSONB NOT NULL DEFAULT '[]', -- galerie de vidéos (fiche produit), URLs Vercel Blob ou externes
  details       JSONB NOT NULL DEFAULT '{}', -- caractéristiques libres: {"Matière":"Coton bio", "Dimensions":"…"}
  model_3d_url  TEXT,           -- URL du modèle .glb/.gltf pour la visionneuse 3D
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ajout rétro-compatible si la table products existait déjà avant ces colonnes.
ALTER TABLE products ADD COLUMN IF NOT EXISTS old_price NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS videos JSONB NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}';

-- Chaque ligne = une combinaison taille + couleur, avec son propre stock.
CREATE TABLE IF NOT EXISTS product_variants (
  id             SERIAL PRIMARY KEY,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size           TEXT NOT NULL,   -- ex: 'S','M','L','XL' ou '38','40','42'
  color          TEXT NOT NULL,
  stock          INTEGER NOT NULL DEFAULT 0,
  sku            TEXT UNIQUE,
  price_override NUMERIC(10,2),  -- si NULL, on utilise products.base_price
  UNIQUE (product_id, size, color)
);

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  name           TEXT,
  role           TEXT NOT NULL DEFAULT 'client', -- 'client' | 'admin'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carts (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  items       JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id                SERIAL PRIMARY KEY,
  customer_name     TEXT NOT NULL,
  customer_email    TEXT NOT NULL,
  customer_phone    TEXT,
  shipping_address  JSONB,
  total             NUMERIC(10,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending', -- pending|paid|shipped|delivered|cancelled
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id  INTEGER NOT NULL REFERENCES product_variants(id),
  quantity    INTEGER NOT NULL,
  price       NUMERIC(10,2) NOT NULL  -- prix unitaire au moment de la commande
);

-- Réglages du site pilotés depuis l'admin (Paramètres) : identité (logo),
-- thème de couleurs, diaporama/vidéo du hero, bannière promo, coordonnées de
-- contact et réseaux sociaux. Stockage clé/valeur simple — chaque nouveau
-- réglage est juste une nouvelle ligne, aucune migration de schéma requise.
CREATE TABLE IF NOT EXISTS site_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT
);

INSERT INTO site_settings (key, value) VALUES
  ('theme', 'rose'),
  ('logo', ''),
  ('hero_eyebrow', 'Collection en cours'),
  ('hero_title', 'Des pièces taillées pour la vie de tous les jours.'),
  ('hero_subtitle', 'T-shirts, sacs, chaussures et sandales — chaque produit se voit en 3D avant d''être dans votre panier.'),
  ('hero_image', ''),
  ('hero_images', '[]'),          -- JSON: liste d'URLs pour le diaporama de l'accueil
  ('hero_video', ''),             -- si renseigné, remplace le diaporama par une vidéo de fond
  ('promo_active', 'false'),
  ('promo_text', 'Livraison offerte dès 500 MAD'),
  ('site_description', 'DAMA — vêtements, sacs, chaussures et sandales pensés pour la femme marocaine.'),
  ('phone', ''),
  ('whatsapp', ''),
  ('email', ''),
  ('address', ''),
  ('maps_link', ''),
  ('horaires', ''),
  ('facebook', ''),
  ('instagram', ''),
  ('tiktok', '')
ON CONFLICT (key) DO NOTHING;

-- Index utiles pour les filtres et le tri du catalogue.
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Promotions : gérées depuis l'admin (onglet "Promotions"), affichées en
-- popup sur la page d'accueil (une seule fois par visite, via sessionStorage
-- côté client) et listées sur la page /promotions.html.
CREATE TABLE IF NOT EXISTS promotions (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  image       TEXT,
  link_url    TEXT,             -- optionnel : où mène le bouton du popup (ex: products.html?category=sacs)
  link_label  TEXT,             -- texte du bouton (ex: "Voir la collection")
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active);

-- ---------- Données de démarrage ----------
INSERT INTO categories (name, slug, icon) VALUES
  ('T-shirts', 't-shirts', 'fa-shirt'),
  ('Sacs', 'sacs', 'fa-bag-shopping'),
  ('Chaussures', 'chaussures', 'fa-shoe-prints'),
  ('Sandales', 'sandales', 'fa-socks')
ON CONFLICT (slug) DO NOTHING;

-- Compte admin de test — email: admin@dama.ma / mot de passe: à définir
-- via le script scripts/create-admin.js (voir README), ne jamais committer
-- un mot de passe en clair dans ce fichier.
