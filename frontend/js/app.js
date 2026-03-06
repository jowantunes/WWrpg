import { renderHome } from "./views/home.js";
import { renderEntity } from "./views/entity.js";
import { renderAdmin } from "./views/admin.js";
import { renderCategoria } from "./views/categoria.js";
import { renderTimeline } from "./views/timeline.js";
import { renderLogin } from "./views/login.js";
import { renderAccount } from "./views/account.js";
import { renderAdminUsers } from "./views/adminUsers.js";
import { renderFileList } from "./views/files.js";
import { renderFileDetail } from "./views/fileDetail.js";
import { api } from "./api.js";
import { state } from "./state.js";

const app = document.getElementById("app");
const authContainer = document.getElementById("auth-status-container");

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

function updateSidebarAuth() {
  if (!authContainer) return;

  const navNewEntity = document.getElementById("nav-new-entity");
  if (navNewEntity) {
    navNewEntity.style.display = state.canWrite() ? "flex" : "none";
  }

  if (state.isLoggedIn()) {
    authContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.5rem; color:var(--text-primary); font-size:0.85rem;">
        <span style="opacity:0.7">Logado como:</span>
        <a href="/account" data-link style="text-decoration:none;">
          <strong style="color:var(--accent-primary)">@${state.user.username}</strong>
        </a>
        <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted)">${state.user.role}</span>
        
        ${state.isAdmin() ? `
          <a href="/admin/users" data-link class="nav-item" style="margin-top:0.5rem; padding: 4px 0; font-size:12px;">
            <span class="icon">👥</span><span class="label" style="font-size:11px;">Gerir Usuários</span>
          </a>
        ` : ""}
        
        <button id="logout-btn" class="tl-btn-cancel" style="padding:4px 8px; font-size:11px; margin-top:0.5rem;">Sair</button>
      </div>
    `;

    authContainer.querySelector("#logout-btn").addEventListener("click", async () => {
      await api.logout();
      state.setUser(null);
      navigate("/login");
    });
  } else {
    authContainer.innerHTML = `
      <a href="/login" data-link class="nav-item">
        <span class="icon">🔑</span><span class="label">Entrar</span>
      </a>
    `;
  }
}

async function route(fullPath) {
  updateSidebarAuth();

  const [path, queryString] = fullPath.split("?");
  const params = new URLSearchParams(queryString || "");

  if (path === "/login") return renderLogin(app);
  if (path === "/account") return renderAccount(app);
  if (path === "/admin/users") return renderAdminUsers(app);
  if (path === "/files") return renderFileList(app, params);
  if (path.startsWith("/files/")) {
    const id = path.split("/")[2];
    return renderFileDetail(app, id);
  }
  if (path === "/") return renderHome(app);
  if (path === "/admin") return renderAdmin(app);
  if (path === "/timeline") return renderTimeline(app);

  const entityMatch = path.match(/^\/entity\/(\d+)$/);
  if (entityMatch) {
    const id = entityMatch[1];
    return renderEntity(app, id);
  }

  const catMatch = path.match(/^\/categorias\/(.+)$/);
  if (catMatch) {
    const tipo = catMatch[1];
    return renderCategoria(app, tipo);
  }

  // 404
  app.innerHTML = `<h2>404</h2><p>Não encontrei essa rota.</p>`;
}

// Inicializa Autenticação
async function initAuth() {
  try {
    const res = await api.getMe();
    state.setUser(res.user);
  } catch (err) {
    console.error("Erro ao verificar sessão:", err);
    state.setUser(null);
  } finally {
    // Escuta mudanças de auth para atualizar sidebar
    document.addEventListener("authStateChanged", () => {
      updateSidebarAuth();
    });

    route(location.pathname);
  }
}

// Intercepta erros globais de API (401/403)
window.addEventListener("unhandledrejection", (event) => {
  const err = event.reason;
  if (err && err.message) {
    if (err.message.includes("Login necessário") || err.message.includes("401")) {
      state.setUser(null);
      navigate("/login");
    } else if (err.message.includes("Sem permissão") || err.message.includes("403")) {
      alert("Você não tem permissão para realizar esta ação.");
    }
  }
});

initAuth();