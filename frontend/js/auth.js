/**
 * DAMA — Authentification client
 * Stocke le JWT en localStorage et expose des helpers pour les formulaires.
 */
const Auth = {
  isLoggedIn: () => !!localStorage.getItem("dl_token"),

  async login(email, password) {
    const { token, user } = await api.login(email, password);
    localStorage.setItem("dl_token", token);
    localStorage.setItem("dl_user", JSON.stringify(user));
    return user;
  },

  async register(email, password, name) {
    const { token, user } = await api.register(email, password, name);
    localStorage.setItem("dl_token", token);
    localStorage.setItem("dl_user", JSON.stringify(user));
    return user;
  },

  logout() {
    localStorage.removeItem("dl_token");
    localStorage.removeItem("dl_user");
    window.location.href = "index.html";
  },

  currentUser() {
    try {
      return JSON.parse(localStorage.getItem("dl_user"));
    } catch {
      return null;
    }
  },

  requireAdmin() {
    const user = this.currentUser();
    if (!user || user.role !== "admin") {
      window.location.href = "../index.html";
    }
  },
};

window.Auth = Auth;
