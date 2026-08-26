/**
 * DAMA — Filtres de catalogue
 * Lit les contrôles de la barre de filtres et recharge la grille de produits
 * via l'API (filtrage côté serveur — voir backend/routes/products.js).
 */
async function loadProducts() {
  const grid = document.querySelector("[data-product-grid]");
  if (!grid) return;

  const params = {};
  const category = document.querySelector("[data-filter='category']")?.value;
  const size = document.querySelector("[data-filter='size']")?.value;
  const sort = document.querySelector("[data-filter='sort']")?.value;
  const search = document.querySelector("[data-filter='search']")?.value;

  if (category) params.category = category;
  if (size) params.size = size;
  if (sort) params.sort = sort;
  if (search) params.q = search;

  grid.setAttribute("aria-busy", "true");
  try {
    const products = await api.getProducts(params);
    renderProducts(grid, products);
  } catch (err) {
    grid.innerHTML = `<p class="stock-note">Impossible de charger les produits: ${err.message}</p>`;
  } finally {
    grid.removeAttribute("aria-busy");
  }
}

function renderProducts(grid, products) {
  if (!products.length) {
    grid.innerHTML = `<p class="section-sub">Aucun produit ne correspond à ces filtres.</p>`;
    return;
  }
  grid.innerHTML = products.map(renderProductCard).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  document.querySelectorAll("[data-filter]").forEach((el) => {
    el.addEventListener("change", loadProducts);
  });
  document.querySelector("[data-filter='search']")?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") loadProducts();
  });
});
