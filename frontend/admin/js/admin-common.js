/**
 * DAMA — Admin partials & helpers communs
 * Injecte la sidebar, marque le lien actif via data-page sur <body>,
 * branche la déconnexion, et expose un helper de toast.
 */
async function includeAdminSidebar() {
  const el = document.querySelector("[data-admin-sidebar]");
  if (!el) return;
  const res = await fetch("partials/sidebar.html");
  el.outerHTML = await res.text();

  const page = document.body.dataset.page;
  if (page) {
    document.querySelector(`[data-nav="${page}"]`)?.classList.add("active");
  }
  document.getElementById("logout-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    Auth.logout();
  });
}

function showToast(message, type = "success") {
  document.querySelectorAll(".a-toast").forEach((t) => t.remove());
  const toast = document.createElement("div");
  toast.className = `a-toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i> ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

document.addEventListener("DOMContentLoaded", () => {
  Auth.requireAdmin();
  includeAdminSidebar();
});
