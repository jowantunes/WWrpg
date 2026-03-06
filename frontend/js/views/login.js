import { api } from "../api.js";
import { state } from "../state.js";
import { navigate } from "../app.js";

export function renderLogin(root) {
    root.innerHTML = `
    <div class="tl-container">
      <div class="auth-card" style="max-width: 400px; margin: 4rem auto; background: var(--bg-surface); padding: 2rem; border-radius: var(--radius-lg); border: 1px solid var(--border-color); box-shadow: var(--shadow-base);">
        <h2 style="margin-bottom: 2rem; text-align: center; color: var(--accent-primary);">Acessar Wiki</h2>
        
        <form id="login-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
          <div class="tl-filter-group">
            <label>Usuário</label>
            <input type="text" id="login-username" required placeholder="Digite seu usuário" style="width: 100%;">
          </div>
          
          <div class="tl-filter-group">
            <label>Senha</label>
            <input type="password" id="login-password" required placeholder="********" style="width: 100%;">
          </div>
          
          <div id="login-error" class="tl-error-inline" style="text-align: center; display: none;"></div>
          
          <button type="submit" class="tl-btn-save" style="width: 100%; padding: 0.75rem; font-size: 1rem;">Entrar</button>
        </form>
        
        <p style="margin-top: 1.5rem; font-size: 0.85rem; color: var(--text-muted); text-align: center;">
          Caso não possua acesso, entre em contato com o administrador.
        </p>
      </div>
    </div>
  `;

    const form = root.querySelector("#login-form");
    const usernameInput = root.querySelector("#login-username");
    const passwordInput = root.querySelector("#login-password");
    const errorEl = root.querySelector("#login-error");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = usernameInput.value;
        const password = passwordInput.value;

        errorEl.style.display = "none";
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Verificando...";

        try {
            const resp = await api.login(username, password);
            if (resp.ok) {
                state.setUser(resp.user);
                navigate("/"); // Redireciona para home após login
            }
        } catch (err) {
            errorEl.textContent = err.message || "Erro ao fazer login";
            errorEl.style.display = "block";
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Entrar";
        }
    });
}
