/**
 * DAMA — Injection des partials (header / footer)
 * Chaque page publique inclut <div data-include="partials/header.html"></div>
 * ce script remplace le div par le contenu du fichier.
 */
async function includePartials() {
  const nodes = document.querySelectorAll("[data-include]");
  await Promise.all(
    Array.from(nodes).map(async (node) => {
      const path = node.getAttribute("data-include");
      try {
        const res = await fetch(path);
        node.outerHTML = await res.text();
      } catch {
        node.remove();
      }
    })
  );
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
  window.updateCartBadge?.();
  await applySiteSettings();
  await renderCategoryNav();
  document.dispatchEvent(new Event("partials:loaded"));
}

/**
 * Charge les catégories depuis l'API et remplit dynamiquement le menu du
 * header et la colonne "Boutique" du footer. Toute catégorie ajoutée,
 * renommée ou supprimée depuis l'admin (Catégories) apparaît donc
 * immédiatement, sans qu'aucune page HTML n'ait besoin d'être modifiée.
 */
async function renderCategoryNav() {
  try {
    const categories = await window.api?.getCategories();
    if (!categories) return;
    window.siteCategories = categories;

    const headerSlot = document.querySelector("[data-nav-categories]");
    if (headerSlot) {
      headerSlot.innerHTML = categories
        .map((c) => `<a href="products.html?category=${c.slug}">${c.name}</a>`)
        .join("");
    }

    const footerSlot = document.querySelector("[data-footer-categories]");
    if (footerSlot) {
      footerSlot.innerHTML = categories
        .map((c) => `<a href="products.html?category=${c.slug}">${c.name}</a>`)
        .join("");
    }

    document.dispatchEvent(new CustomEvent("categories:loaded", { detail: categories }));
  } catch {
    // Si l'API est indisponible, le menu garde ses liens par défaut (aucun ici).
  }
}

/**
 * Charge les réglages du site (thème, bannière promo) depuis l'API et les
 * applique. Piloté depuis admin/parametres.html — aucune page publique n'a
 * besoin d'être modifiée pour changer le thème ou le message promo.
 */
async function applySiteSettings() {
  try {
    const settings = await window.api?.getSettings();
    if (!settings) return;
    window.siteSettings = settings;

    document.body.classList.remove("theme-indigo", "theme-rose");
    document.body.classList.add(`theme-${settings.theme || "indigo"}`);

    if (settings.promo_active === "true" && settings.promo_text) {
      let bar = document.querySelector(".promo-banner");
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "promo-banner";
        document.body.prepend(bar);
      }
      bar.textContent = settings.promo_text;
    } else {
      document.querySelector(".promo-banner")?.remove();
    }

    // ---------- Logo (header + footer) ----------
    // IMPORTANT : on ne remplace que l'icône (data-logo-mark, la rose par
    // défaut) par l'image uploadée — le texte "DAMA" à côté n'est JAMAIS
    // écrasé, pour que le nom reste toujours écrit même si un logo image
    // est configuré depuis l'admin.
    if (settings.logo) {
      document.querySelectorAll("[data-logo-mark]").forEach((el) => {
        el.innerHTML = `<img src="${settings.logo}" alt="DAMA" />`;
      });

      // ---------- Favicon (onglet du navigateur) ----------
      // Aucune page HTML ne référence de favicon statique car le logo est
      // uploadé dynamiquement depuis l'admin (Paramètres) — sans ceci,
      // l'onglet garde l'icône générique du navigateur sur toutes les pages.
      let favicon = document.querySelector('link[rel="icon"]');
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }
      favicon.href = settings.logo;
    }

    // ---------- Footer : description, contact, horaires, réseaux sociaux ----------
    const descEl = document.querySelector("[data-footer-description]");
    if (descEl && settings.site_description) descEl.textContent = settings.site_description;

    const contactEl = document.querySelector("[data-footer-contact]");
    if (contactEl) {
      const lines = [];
      if (settings.phone) lines.push(`<a href="tel:${settings.phone.replace(/\s+/g, "")}">${settings.phone}</a>`);
      if (settings.email) lines.push(`<a href="mailto:${settings.email}">${settings.email}</a>`);
      if (settings.address) lines.push(settings.maps_link
        ? `<a href="${settings.maps_link}" target="_blank" rel="noopener">${settings.address}</a>`
        : `<p>${settings.address}</p>`);
      contactEl.innerHTML = lines.join("") || "<p>—</p>";
    }

    const horairesEl = document.querySelector("[data-footer-horaires]");
    if (horairesEl && settings.horaires) horairesEl.textContent = settings.horaires;

    const socialEl = document.querySelector("[data-footer-social]");
    if (socialEl) {
      const socials = [
        { key: "whatsapp", icon: "fa-brands fa-whatsapp", href: (v) => `https://wa.me/${v.replace(/\D/g, "")}` },
        { key: "facebook", icon: "fa-brands fa-facebook-f", href: (v) => v },
        { key: "instagram", icon: "fa-brands fa-instagram", href: (v) => v },
        { key: "tiktok", icon: "fa-brands fa-tiktok", href: (v) => v },
      ];
      socialEl.innerHTML = socials
        .filter((s) => settings[s.key])
        .map((s) => `<a href="${s.href(settings[s.key])}" target="_blank" rel="noopener" aria-label="${s.key}"><i class="${s.icon}"></i></a>`)
        .join("");
    }

    // ---------- Bouton WhatsApp flottant + bouton footer ----------
    const waFloat = document.querySelector("[data-whatsapp-float]");
    const waFooterBtn = document.querySelector("[data-footer-whatsapp-btn]");
    if (settings.whatsapp) {
      const waLink = `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`;
      if (waFloat) { waFloat.href = waLink; waFloat.style.display = "flex"; }
      if (waFooterBtn) { waFooterBtn.href = waLink; waFooterBtn.style.display = "inline-flex"; }
    } else {
      if (waFloat) waFloat.style.display = "none";
      if (waFooterBtn) waFooterBtn.style.display = "none";
    }

    // ---------- Carte Google Maps (cadre) ----------
    // Priorité : un vrai lien "Intégrer une carte" (Google Maps → Partager →
    // Intégrer une carte, contient /maps/embed ou output=embed) est utilisé
    // tel quel. Un lien "partagé" classique (ex: maps.app.goo.gl/...) ne peut
    // PAS être affiché dans un iframe (Google bloque ça), donc on l'ignore et
    // on retombe sur une recherche à partir de l'adresse texte plutôt que
    // d'afficher une carte cassée. Si rien n'est utilisable, on masque le bloc.
    const mapEl = document.querySelector("[data-footer-map]");
    if (mapEl) {
      const mapsLink = (settings.maps_link || "").trim();
      const address = (settings.address || "").trim();
      let embedUrl = null;

      if (mapsLink && (mapsLink.includes("/maps/embed") || mapsLink.includes("output=embed"))) {
        embedUrl = mapsLink;
      } else if (address) {
        embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
      }

      if (embedUrl) {
        mapEl.style.display = "block";
        mapEl.innerHTML = `<iframe src="${embedUrl}" loading="lazy" allowfullscreen title="Localisation DAMA"></iframe>`;
      } else {
        mapEl.style.display = "none";
      }
    }

    document.dispatchEvent(new CustomEvent("settings:loaded", { detail: settings }));
  } catch {
    // Si l'API est indisponible, le site garde son thème par défaut.
  }
}

document.addEventListener("DOMContentLoaded", includePartials);
