import { api } from "../api.js";
import { state } from "../state.js";
import { navigate } from "../app.js";

export async function renderAccount(root) {
  if (!state.isLoggedIn()) {
    return navigate("/login");
  }

  root.innerHTML = `
    <div class="acct-container" style="max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 class="title-paranormal">Minha Conta</h2>
      
      <div class="dark-surface" style="padding: 20px; border-radius: var(--radius-lg); margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
          <div id="acct-avatar" style="width: 60px; height: 60px; background: var(--brand-accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; color: white;">
            ${state.user.username[0].toUpperCase()}
          </div>
          <div>
            <h3 id="acct-display-name" style="margin: 0; color: var(--text-primary);">@${state.user.username}</h3>
            <span class="entity-type-badge">${state.user.role}</span>
          </div>
        </div>
        
        <button id="acct-logout-btn" class="tl-btn-cancel" style="width: 100%; padding: 10px;">Sair da Conta</button>
      </div>

      <!-- Alterar Username -->
      <div class="dark-surface" style="padding: 20px; border-radius: var(--radius-lg); margin-bottom: 24px;">
        <h4 class="title-paranormal" style="margin-top: 0; font-size: 14px; color: var(--text-muted);">Alterar Username</h4>
        <form id="change-username-form" style="display: flex; flex-direction: column; gap: 12px;">
          <label style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">
            Novo Username (3-30 chars, sem espaços)
            <input type="text" id="new-username" class="input-limiar" style="width: 100%; margin-top: 4px;" 
              value="${state.user.username}" required minlength="3" maxlength="30" pattern="[a-zA-Z0-9._-]+">
          </label>
          <button type="submit" class="btn-limiar btn-primary" style="margin-top: 8px; padding: 12px;">Salvar Username</button>
          <p id="username-msg" style="font-size: 13px; text-align: center; margin-top: 8px;"></p>
        </form>
      </div>

      <!-- Alterar Senha -->
      <div class="dark-surface" style="padding: 20px; border-radius: var(--radius-lg);">
        <h4 class="title-paranormal" style="margin-top: 0; font-size: 14px; color: var(--text-muted);">Alterar Senha</h4>
        <form id="change-pwd-form" style="display: flex; flex-direction: column; gap: 12px;">
          <label style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">
            Senha Atual
            <input type="password" id="current-pwd" class="input-limiar" style="width: 100%; margin-top: 4px;" required>
          </label>
          <label style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">
            Nova Senha (mín. 4 caracteres)
            <input type="password" id="new-pwd" class="input-limiar" style="width: 100%; margin-top: 4px;" required minlength="4">
          </label>
          <label style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">
            Confirmar Nova Senha
            <input type="password" id="confirm-pwd" class="input-limiar" style="width: 100%; margin-top: 4px;" required minlength="4">
          </label>
          
          <button type="submit" class="btn-limiar btn-primary" style="margin-top: 8px; padding: 12px;">Atualizar Senha</button>
          <p id="pwd-msg" style="font-size: 13px; text-align: center; margin-top: 8px;"></p>
        </form>
      </div>
    </div>
  `;

  root.querySelector("#acct-logout-btn").addEventListener("click", async () => {
    await api.logout();
    state.setUser(null);
    navigate("/login");
  });

  // Handle Username Change
  const userForm = root.querySelector("#change-username-form");
  const userMsg = root.querySelector("#username-msg");
  userForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = root.querySelector("#new-username").value.trim();
    if (username === state.user.username) return;

    try {
      userMsg.style.color = "var(--text-muted)";
      userMsg.textContent = "Atualizando...";
      const res = await api.patchAccount({ username });

      // Update local state
      state.setUser(res.user);

      // Update UI elements
      root.querySelector("#acct-display-name").textContent = `@${res.user.username}`;
      root.querySelector("#acct-avatar").textContent = res.user.username[0].toUpperCase();

      userMsg.style.color = "#4CAF50";
      userMsg.textContent = "Username atualizado!";
    } catch (err) {
      userMsg.style.color = "var(--brand-danger)";
      userMsg.textContent = err.message || "Erro ao atualizar username.";
    }
  });

  // Handle Password Change
  const pwdForm = root.querySelector("#change-pwd-form");
  const pwdMsg = root.querySelector("#pwd-msg");
  pwdForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const current_password = root.querySelector("#current-pwd").value;
    const new_password = root.querySelector("#new-pwd").value;
    const confirm_password = root.querySelector("#confirm-pwd").value;

    if (new_password !== confirm_password) {
      pwdMsg.style.color = "var(--brand-danger)";
      pwdMsg.textContent = "As senhas não coincidem.";
      return;
    }

    try {
      pwdMsg.style.color = "var(--text-muted)";
      pwdMsg.textContent = "Processando...";
      await api.changeMyPassword({ current_password, new_password });
      pwdMsg.style.color = "#4CAF50";
      pwdMsg.textContent = "Senha alterada com sucesso!";
      pwdForm.reset();
    } catch (err) {
      pwdMsg.style.color = "var(--brand-danger)";
      pwdMsg.textContent = err.message || "Erro ao alterar senha.";
    }
  });
}
