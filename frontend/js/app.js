import { renderHome } from "./views/home.js";
import { renderEntity } from "./views/entity.js";
import { renderAdmin } from "./views/admin.js";

const app = document.getElementById("app");

// Navegação SPA: intercepta links com data-link
document.addEventListener("click", (e) => {
  const link = e.target.closest("a[data-link]");
  if (!link) return;

  e.preventDefault();
  navigate(link.getAttribute("href"));
});

// Voltar/avançar do navegador
window.addEventListener("popstate", () => {
  route(location.pathname);
});

export function navigate(path) {
  history.pushState({}, "", path);
  route(path);
}

function route(path) {
  // Rotas:
  // "/" -> Home
  // "/admin" -> Admin
  // "/entity/123" -> Entidade ID 123

  if (path === "/") return renderHome(app);
  if (path === "/admin") return renderAdmin(app);

  const entityMatch = path.match(/^\/entity\/(\d+)$/);
  if (entityMatch) {
    const id = entityMatch[1];
    return renderEntity(app, id);
  }

  // 404
  app.innerHTML = `<h2>404</h2><p>Não encontrei essa rota.</p>`;
}

// Inicializa
route(location.pathname);