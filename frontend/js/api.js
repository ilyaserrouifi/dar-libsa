/**
 * DAMA — Client API
 * Centralise tous les appels vers le backend (routes /api/*).
 * En local: http://localhost:3000/api — en prod (Vercel): /api (même domaine).
 */
const API_BASE = (() => {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  return isLocal ? "http://localhost:3000/api" : "/api";
})();

function authHeaders() {
  const token = localStorage.getItem("dl_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000); // 20s — évite un bouton bloqué indéfiniment
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") throw new Error("Le serveur met trop de temps à répondre. Réessaie.");
    throw new Error("Impossible de contacter le serveur.");
  }
  clearTimeout(timeout);

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = body?.error || `Erreur API (${res.status})`;
    throw new Error(message);
  }
  return body;
}

const api = {
  // ---- Catégories ----
  getCategories: () => request("/categories"),
  createCategory: (data) => request("/categories", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id, data) => request(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: "DELETE" }),

  // ---- Produits ----
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },
  getProduct: (idOrSlug) => request(`/products/${idOrSlug}`),
  createProduct: (data) => request("/products", { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),

  // ---- Variants (taille / couleur / stock) ----
  getVariants: (productId) => request(`/products/${productId}/variants`),
  addVariant: (productId, data) =>
    request(`/products/${productId}/variants`, { method: "POST", body: JSON.stringify(data) }),
  updateVariantStock: (variantId, stock) =>
    request(`/variants/${variantId}`, { method: "PUT", body: JSON.stringify({ stock }) }),
  updateVariant: (variantId, data) =>
    request(`/variants/${variantId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteVariant: (variantId) => request(`/variants/${variantId}`, { method: "DELETE" }),

  // ---- Promotions (bannière popup accueil + page /promotions.html) ----
  getPromotions: () => request("/promotions"),
  createPromotion: (data) => request("/promotions", { method: "POST", body: JSON.stringify(data) }),
  updatePromotion: (id, data) => request(`/promotions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePromotion: (id) => request(`/promotions/${id}`, { method: "DELETE" }),

  // ---- Panier (persisté côté serveur si connecté, sinon localStorage côté client) ----
  syncCart: (items) => request("/cart", { method: "POST", body: JSON.stringify({ items }) }),
  getCart: () => request("/cart"),

  // ---- Commandes ----
  createOrder: (order) => request("/orders", { method: "POST", body: JSON.stringify(order) }),
  getOrders: () => request("/orders"),
  getOrder: (id) => request(`/orders/${id}`),
  updateOrderStatus: (id, status) =>
    request(`/orders/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),

  // ---- Upload (Vercel Blob) ----
  // file: un objet File (ex: input[type=file].files[0]). Retourne { url, ... }.
  uploadImage: async (file) => {
    const res = await fetch(
      `${API_BASE}/upload?filename=${encodeURIComponent(file.name)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          ...authHeaders(),
        },
        body: file,
      }
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || `Erreur upload (${res.status})`);
    return body; // { url, pathname, ... }
  },

  // ---- Auth ----
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (email, password, name) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  me: () => request("/auth/me"),

  // ---- Réglages du site (thème, hero, bannière promo) ----
  getSettings: () => request("/settings"),
  updateSettings: (data) => request("/settings", { method: "PUT", body: JSON.stringify(data) }),

  // ---- Jeton d'upload direct (pour les fichiers volumineux, ex: vidéos) ----
  // Le fichier est ensuite envoyé directement à Vercel Blob par blob-upload.js,
  // sans passer par notre fonction serverless (limite de 4.5 Mo évitée).
  getUploadToken: (filename) => request("/upload/token", { method: "POST", body: JSON.stringify({ filename }) }),
};

window.api = api;
window.API_BASE = API_BASE;
window.authHeaders = authHeaders;
