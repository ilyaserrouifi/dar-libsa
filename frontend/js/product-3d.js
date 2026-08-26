/**
 * DAMA — Fiche produit + visionneuse 3D
 * Charge le produit depuis l'API via ?slug=..., affiche le modèle 3D (model-viewer)
 * si product.model_3d_url existe, sinon retombe sur une image.
 * Gère la sélection couleur/taille et calcule le stock disponible par variant.
 */
let currentProduct = null;
let selectedColor = null;
let selectedSize = null;

function getSlug() {
  return new URLSearchParams(window.location.search).get("slug");
}

function variantFor(color, size) {
  return currentProduct.variants.find((v) => v.color === color && v.size === size);
}

function renderOptions() {
  const colors = [...new Set(currentProduct.variants.map((v) => v.color))];
  const sizes = [...new Set(currentProduct.variants.map((v) => v.size))];

  document.querySelector("[data-colors]").innerHTML = colors
    .map((c) => `<button class="swatch ${c === selectedColor ? "active" : ""}" data-color="${c}">${c}</button>`)
    .join("");

  document.querySelector("[data-sizes]").innerHTML = sizes
    .map((s) => {
      const v = variantFor(selectedColor, s);
      const oos = !v || v.stock <= 0;
      return `<button class="size-box ${s === selectedSize ? "active" : ""} ${oos ? "oos" : ""}"
                data-size="${s}" ${oos ? "disabled" : ""}>${s}</button>`;
    })
    .join("");

  document.querySelectorAll("[data-color]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedColor = btn.dataset.color;
      selectedSize = null;
      renderOptions();
      updateAddButton();
    });
  });
  document.querySelectorAll("[data-size]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedSize = btn.dataset.size;
      renderOptions();
      updateAddButton();
    });
  });
}

function updateAddButton() {
  const btn = document.querySelector("[data-add-to-cart]");
  const note = document.querySelector("[data-stock-note]");
  const variant = selectedColor && selectedSize ? variantFor(selectedColor, selectedSize) : null;

  if (variant && variant.stock > 0) {
    btn.disabled = false;
    btn.textContent = "Ajouter au panier";
    note.style.display = "none";
  } else {
    btn.disabled = true;
    btn.textContent = selectedColor && selectedSize ? "Rupture de stock" : "Choisir taille & couleur";
    if (variant && variant.stock <= 0) {
      note.textContent = "Cette combinaison est actuellement en rupture de stock.";
      note.style.display = "block";
    }
  }

  btn.onclick = () => {
    if (!variant) return;
    Cart.add(variant.id, {
      productId: currentProduct.id,
      name: currentProduct.name,
      size: selectedSize,
      color: selectedColor,
      price: Number(variant.price_override || currentProduct.base_price),
      image: currentProduct.image,
    });
    btn.textContent = "Ajouté ✓";
    setTimeout(() => updateAddButton(), 1200);
  };
}

async function loadProduct() {
  const slug = getSlug();
  const root = document.querySelector("[data-product-root]");
  if (!slug) {
    root.innerHTML = "<p>Produit introuvable.</p>";
    return;
  }
  try {
    currentProduct = await api.getProduct(slug);
  } catch (err) {
    root.innerHTML = `<p>Impossible de charger ce produit: ${err.message}</p>`;
    return;
  }

  document.querySelector("[data-name]").textContent = currentProduct.name;
  document.title = `${currentProduct.name} — DAMA`;
  document.querySelector("[data-breadcrumb-current]").textContent = currentProduct.name;
  document.querySelector("[data-description]").textContent = currentProduct.description || "";

  // ---------- Prix + badge promo ----------
  const priceEl = document.querySelector("[data-price]");
  const basePrice = Number(currentProduct.base_price);
  const oldPrice = currentProduct.old_price ? Number(currentProduct.old_price) : null;
  if (oldPrice && oldPrice > basePrice) {
    const pct = Math.round(100 - (basePrice / oldPrice) * 100);
    priceEl.innerHTML = `${basePrice.toFixed(2)} MAD <span class="pd-price-old">${oldPrice.toFixed(2)} MAD</span> <span class="pd-price-pct">-${pct}%</span>`;
  } else {
    priceEl.textContent = `${basePrice.toFixed(2)} MAD`;
  }
  const badgeEl = document.querySelector("[data-pd-badge]");
  if (currentProduct.badge) {
    badgeEl.textContent = currentProduct.badge;
    badgeEl.style.display = "inline-block";
  }

  // ---------- Image/vidéo principale + galerie de miniatures ----------
  // La galerie mélange les photos (image + images[]) et les vidéos (videos[]) :
  // chaque entrée garde son type pour savoir quoi afficher au clic sur sa miniature.
  const gallery = [currentProduct.image, ...(Array.isArray(currentProduct.images) ? currentProduct.images : [])]
    .filter(Boolean)
    .map((url) => ({ type: "image", url }));
  const videoItems = (Array.isArray(currentProduct.videos) ? currentProduct.videos : [])
    .filter(Boolean)
    .map((url) => ({ type: "video", url }));
  const media = [...gallery, ...videoItems];

  const viewer = document.querySelector("[data-viewer]");
  const img = document.querySelector("[data-fallback-image]");
  const video = document.querySelector("[data-fallback-video]");

  function showImage(url) {
    video.pause();
    video.style.display = "none";
    img.src = url || "assets/img/placeholder.svg";
    img.alt = currentProduct.name;
    img.style.display = "block";
    img.style.width = "100%";
  }

  function showVideo(url) {
    img.style.display = "none";
    video.src = url;
    video.style.display = "block";
  }

  if (currentProduct.model_3d_url) {
    viewer.src = currentProduct.model_3d_url;
    viewer.alt = currentProduct.name;
    viewer.style.display = "block";
  } else if (gallery.length) {
    showImage(gallery[0].url);
  } else if (videoItems.length) {
    showVideo(videoItems[0].url);
  }

  const thumbsWrap = document.querySelector("[data-pd-thumbs]");
  if (media.length > 1) {
    thumbsWrap.style.display = "flex";
    thumbsWrap.innerHTML = media
      .map((item, i) => `
        <button type="button" class="pd-thumb ${item.type === "video" ? "pd-thumb-video" : ""} ${i === 0 && !currentProduct.model_3d_url ? "active" : ""}"
                data-thumb-type="${item.type}" data-thumb="${item.url}">
          ${item.type === "video"
            ? `<video src="${item.url}" muted playsinline preload="metadata"></video>`
            : `<img src="${item.url}" alt="" />`}
        </button>`)
      .join("");
    thumbsWrap.querySelectorAll("[data-thumb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        thumbsWrap.querySelectorAll(".pd-thumb").forEach((t) => t.classList.remove("active"));
        btn.classList.add("active");
        viewer.style.display = "none";
        if (btn.dataset.thumbType === "video") {
          showVideo(btn.dataset.thumb);
        } else {
          showImage(btn.dataset.thumb);
        }
      });
    });
  }

  // ---------- Caractéristiques techniques ----------
  const details = currentProduct.details && typeof currentProduct.details === "object" ? currentProduct.details : {};
  const detailKeys = Object.keys(details).filter((k) => details[k]);
  if (detailKeys.length) {
    document.querySelector("[data-pd-details]").style.display = "block";
    document.querySelector("[data-pd-details-table]").innerHTML = detailKeys
      .map((k) => `<tr><th>${k}</th><td>${details[k]}</td></tr>`)
      .join("");
  }

  renderOptions();
  updateAddButton();
  root.removeAttribute("aria-busy");
}

document.addEventListener("DOMContentLoaded", loadProduct);
