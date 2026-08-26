const express = require("express");
const { sql } = require("../db/connection");
const { requireAdmin } = require("../middlewares/auth");

const router = express.Router();

// POST /api/orders — créer une commande (invité ou connecté)
// Vérifie le stock, décrémente les variants, calcule le total côté serveur
// (jamais confiance dans le prix envoyé par le client).
//
// IMPORTANT — décrémentation atomique du stock :
// Le driver Neon HTTP ne permet pas de transaction interactive classique
// (BEGIN ... COMMIT avec logique conditionnelle au milieu). On sécurise donc
// chaque décrémentation individuellement avec une clause conditionnelle
// (`WHERE stock >= quantity`), ce qui empêche toute survente même si deux
// commandes arrivent en même temps sur le même variant. Si un item échoue
// en cours de route (stock insuffisant, pris par une commande concurrente
// entre-temps), on annule (compense) les décrémentations déjà faites pour
// les items précédents avant de répondre en erreur.
router.post("/", async (req, res) => {
  const { customer, items } = req.body;
  if (!customer?.email || !items?.length) {
    return res.status(400).json({ error: "customer et items sont requis." });
  }

  const variantIds = items.map((i) => i.variantId);
  const variants = await sql`SELECT * FROM product_variants WHERE id = ANY(${variantIds})`;

  // Vérification préliminaire (rapide, évite de commencer à décrémenter pour
  // des variants inexistants) — le vrai garde-fou anti-survente reste la
  // décrémentation conditionnelle ci-dessous.
  for (const item of items) {
    const variant = variants.find((v) => v.id === item.variantId);
    if (!variant) return res.status(400).json({ error: `Variant ${item.variantId} introuvable.` });
  }

  // Récupère le prix de chaque produit une seule fois (évite les requêtes en double).
  const productIds = [...new Set(variants.map((v) => v.product_id))];
  const products = productIds.length
    ? await sql`SELECT id, base_price FROM products WHERE id = ANY(${productIds})`
    : [];
  const unitPriceFor = (variant) =>
    variant.price_override || products.find((p) => p.id === variant.product_id).base_price;

  // ---- Décrémentation atomique, item par item, avec rollback compensatoire ----
  const decremented = []; // { variantId, quantity } — pour pouvoir compenser en cas d'échec
  let stockError = null;

  for (const item of items) {
    const [updated] = await sql`
      UPDATE product_variants
      SET stock = stock - ${item.quantity}
      WHERE id = ${item.variantId} AND stock >= ${item.quantity}
      RETURNING id
    `;
    if (!updated) {
      stockError = `Stock insuffisant pour le variant ${item.variantId}.`;
      break;
    }
    decremented.push(item);
  }

  if (stockError) {
    // Restaure le stock des items déjà décrémentés avant d'échouer.
    for (const item of decremented) {
      await sql`UPDATE product_variants SET stock = stock + ${item.quantity} WHERE id = ${item.variantId}`;
    }
    return res.status(409).json({ error: stockError });
  }

  const total = items.reduce((sum, item) => {
    const variant = variants.find((v) => v.id === item.variantId);
    return sum + unitPriceFor(variant) * item.quantity;
  }, 0);

  let order;
  try {
    [order] = await sql`
      INSERT INTO orders (customer_name, customer_email, customer_phone, shipping_address, total, status)
      VALUES (
        ${customer.firstName + " " + customer.lastName},
        ${customer.email}, ${customer.phone},
        ${JSON.stringify({ address: customer.address, city: customer.city, zip: customer.zip })},
        ${total}, 'pending'
      )
      RETURNING *
    `;

    for (const item of items) {
      const variant = variants.find((v) => v.id === item.variantId);
      await sql`
        INSERT INTO order_items (order_id, variant_id, quantity, price)
        VALUES (${order.id}, ${item.variantId}, ${item.quantity}, ${unitPriceFor(variant)})
      `;
    }
  } catch (err) {
    // La commande n'a pas pu être enregistrée : on restaure le stock déjà décrémenté
    // pour ne pas bloquer des unités "fantômes".
    for (const item of decremented) {
      await sql`UPDATE product_variants SET stock = stock + ${item.quantity} WHERE id = ${item.variantId}`;
    }
    throw err;
  }

  res.status(201).json(order);
});

// GET /api/orders — liste (admin uniquement)
router.get("/", requireAdmin, async (req, res) => {
  const orders = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`;
  res.json(orders);
});

// GET /api/orders/:id — détail complet d'une commande, avec les articles
// (nom produit, taille, couleur, quantité, prix) — admin uniquement.
router.get("/:id", requireAdmin, async (req, res) => {
  const [order] = await sql`SELECT * FROM orders WHERE id = ${req.params.id}`;
  if (!order) return res.status(404).json({ error: "Commande introuvable." });

  const items = await sql`
    SELECT
      oi.quantity, oi.price,
      pv.size, pv.color, pv.sku,
      p.name AS product_name, p.image AS product_image, p.slug AS product_slug
    FROM order_items oi
    JOIN product_variants pv ON pv.id = oi.variant_id
    JOIN products p ON p.id = pv.product_id
    WHERE oi.order_id = ${order.id}
  `;

  res.json({ ...order, items });
});

// PUT /api/orders/:id — mise à jour du statut (admin uniquement)
router.put("/:id", requireAdmin, async (req, res) => {
  const { status } = req.body;
  const [order] = await sql`
    UPDATE orders SET status = ${status} WHERE id = ${req.params.id} RETURNING *
  `;
  if (!order) return res.status(404).json({ error: "Commande introuvable." });
  res.json(order);
});

module.exports = router;
