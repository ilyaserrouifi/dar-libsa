/**
 * DAMA — Panier
 * Le panier vit dans localStorage (fonctionne sans compte), et se synchronise
 * avec /api/cart si l'utilisateur est connecté.
 */
const CART_KEY = "dl_cart";

function readCart() {
  try {
    const items = JSON.parse(localStorage.getItem(CART_KEY)) || [];
    // Coerce price/quantity to numbers in case older entries were stored
    // as strings (e.g. price coming straight from the API as "376.00").
    return items.map((i) => ({
      ...i,
      price: Number(i.price) || 0,
      quantity: Number(i.quantity) || 0,
    }));
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  updateCartBadge();
  if (localStorage.getItem("dl_token")) {
    window.api?.syncCart(items).catch(() => {});
  }
}

function updateCartBadge() {
  const count = readCart().reduce((sum, i) => sum + i.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = count;
    el.style.display = count > 0 ? "inline-flex" : "none";
  });
}

const Cart = {
  items: () => readCart(),

  add(variantId, { productId, name, size, color, price, image }, quantity = 1) {
    const items = readCart();
    const existing = items.find((i) => String(i.variantId) === String(variantId));
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({ variantId, productId, name, size, color, price: Number(price) || 0, image, quantity });
    }
    writeCart(items);
  },

  updateQuantity(variantId, quantity) {
    let items = readCart();
    if (quantity <= 0) {
      items = items.filter((i) => String(i.variantId) !== String(variantId));
    } else {
      items = items.map((i) => (String(i.variantId) === String(variantId) ? { ...i, quantity } : i));
    }
    writeCart(items);
  },

  remove(variantId) {
    writeCart(readCart().filter((i) => String(i.variantId) !== String(variantId)));
  },

  clear() {
    writeCart([]);
  },

  subtotal() {
    return readCart().reduce((sum, i) => sum + i.price * i.quantity, 0);
  },
};

window.Cart = Cart;
window.updateCartBadge = updateCartBadge;
document.addEventListener("DOMContentLoaded", updateCartBadge);
document.addEventListener("partials:loaded", updateCartBadge);
