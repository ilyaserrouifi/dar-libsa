/**
 * DAMA — Rendu de la carte produit (grille catalogue + accueil)
 * Fonction partagée pour éviter la duplication entre index.html et filters.js.
 */
function renderProductCard(p) {
  const oldPrice = p.old_price ? Number(p.old_price) : null;
  const basePrice = Number(p.base_price);
  const onSale = oldPrice && oldPrice > basePrice;
  const priceHtml = onSale
    ? `${basePrice.toFixed(2)} MAD <span class="price-old">${oldPrice.toFixed(2)} MAD</span>`
    : `${basePrice.toFixed(2)} MAD`;
  return `
    <a class="product-card" href="product-detail.html?slug=${p.slug}">
      <div class="thumb">
        ${p.badge ? `<span class="tag">${p.badge}</span>` : onSale ? `<span class="tag">Promo</span>` : ""}
        <img src="${p.image || 'assets/img/placeholder.svg'}" alt="${p.name}" loading="lazy" />
      </div>
      <h4>${p.name}</h4>
      <div class="price">${priceHtml}</div>
    </a>`;
}
