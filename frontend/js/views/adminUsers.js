import { api } from "../api.js";
import { state } from "../state.js";
import { navigate } from "../app.js";

export async function renderAdminUsers(root) {
  if (!state.isAdmin()) {
    alert("Acesso negado.");
    return navigate("/");
  }

  root.innerHTML = `
    <div class="admin-users-container" style="padding: 20px;">
      <h2 class="title-paranormal">Gerenciar Usuários</h2>

      <div class="dark-surface" style="padding: 20px; border-radius: var(--radius-lg); margin-bottom: 24px;">
        <h3 class="title-paranormal" style="margin-top: 0; font-size: 16px; color: var(--text-muted);">Novo Usuário</h3>
        <form id="create-user-form" style="display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;">
          <label style="flex: 1; min-width: 150px; font-size: 11px; color: var(--text-muted); text-transform: uppercase;">
            Username
            <input type="text" id="new-username" class="input-limiar" style="width: 100%; margin-top: 4px;" required>
          </label>
          <label style="flex: 1; min-width: 150px; font-size: 11px; color: var(--text-muted); text-transform: uppercase;">
            Password (mín. 4)
            <input type="password" id="new-password" class="input-limiar" style="width: 100%; margin-top: 4px;" required minlength="4">
          </label>
          <label style="width: 120px; font-size: 11px; color: var(--text-muted); text-transform: uppercase;">
            Role
            <select id="new-role" class="input-limiar" style="width: 100%; margin-top: 4px;">
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button type="submit" class="btn-limiar btn-primary" style="padding: 10px 20px;">Criar</button>
        </form>
      </div>

      <div class="dark-surface" style="padding: 20px; border-radius: var(--radius-lg); overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; color: var(--text-primary); font-size: 14px;">
          <thead>
            <tr style="text-align: left; border-bottom: 1px solid var(--bg-surface-alt); color: var(--text-muted);">
              <th style="padding: 12px;">ID</th>
              <th style="padding: 12px;">Usuário</th>
              <th style="padding: 12px;">Cargo</th>
              <th style="padding: 12px;">Sessão / Status</th>
              <th style="padding: 12px;">Ações</th>
            </tr>
          </thead>
          <tbody id="users-tbody">
            <tr><td colspan="5" style="padding: 20px; text-align: center;">Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = root.querySelector("#users-tbody");
  const createForm = root.querySelector("#create-user-form");

  async function loadUsers() {
    try {
      const { users } = await api.listUsers();
      tbody.innerHTML = users.map(u => {
        const isSelf = u.id === state.user.id;
        const statusClass = u.is_active ? "status-active" : "status-inactive";
        const statusLabel = u.is_active ? "Ativo" : "Desativado";

        return `
          <tr style="border-bottom: 1px solid var(--bg-surface-alt); ${!u.is_active ? 'opacity: 0.6;' : ''}">
            <td style="padding: 12px;">${u.id}</td>
            <td style="padding: 12px; font-weight: 600;">
              @${u.username} ${isSelf ? '<span style="color:var(--brand-accent); font-size:10px;">(VOCÊ)</span>' : ''}
            </td>
            <td style="padding: 12px;">
              <select class="input-limiar role-select" data-id="${u.id}" ${isSelf ? 'disabled' : ''} style="padding: 2px 6px; font-size: 12px;">
                <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                <option value="editor" ${u.role === 'editor' ? 'selected' : ''}>Editor</option>
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
              </select>
            </td>
            <td style="padding: 12px;">
              <span class="entity-type-badge ${statusClass}">${statusLabel}</span>
            </td>
            <td style="padding: 12px;">
               <div style="display:flex; gap:8px;">
                 <button class="btn-ghost reset-pwd-btn" data-id="${u.id}" style="font-size: 12px; color: var(--brand-accent);">Reset Senha</button>
                 ${!isSelf ? `
                    ${u.is_active
              ? `<button class="btn-ghost toggle-active-btn" data-id="${u.id}" data-active="0" style="font-size: 12px; color: var(--brand-danger);">Excluir</button>`
              : `<button class="btn-ghost toggle-active-btn" data-id="${u.id}" data-active="1" style="font-size: 12px; color: var(--accent-primary);">Reativar</button>`
            }
                 ` : ''}
               </div>
            </td>
          </tr>
        `;
      }).join("");

      // Action Listeners
      tbody.querySelectorAll(".role-select").forEach(sel => {
        sel.onchange = async () => {
          try {
            await api.patchUser(sel.dataset.id, { role: sel.value });
          } catch (e) { alert(e.message); loadUsers(); }
        }
      });

      tbody.querySelectorAll(".toggle-active-btn").forEach(btn => {
        btn.onclick = async () => {
          const activate = btn.dataset.active === "1";
          const msg = activate ? "Reativar este usuário?" : "Isto vai desativar o acesso do usuário. Continuará no sistema. Confirmar?";
          if (!confirm(msg)) return;

          try {
            await api.patchUser(btn.dataset.id, { is_active: activate });
            loadUsers();
          } catch (e) { alert(e.message); }
        }
      });

      tbody.querySelectorAll(".reset-pwd-btn").forEach(btn => {
        btn.onclick = async () => {
          const newPass = prompt("Digite a nova senha para este usuário (mín. 4 chars):");
          if (!newPass) return;
          if (newPass.length < 4) return alert("Senha muito curta.");
          try {
            await api.patchUser(btn.dataset.id, { password: newPass });
            alert("Senha resetada com sucesso.");
          } catch (e) { alert(e.message); }
        }
      });

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding: 20px; color: var(--brand-danger); text-align: center;">Erro: ${err.message}</td></tr>`;
    }
  }

  createForm.onsubmit = async (e) => {
    e.preventDefault();
    const username = root.querySelector("#new-username").value.trim();
    const password = root.querySelector("#new-password").value;
    const role = root.querySelector("#new-role").value;

    try {
      await api.createUser({ username, password, role });
      createForm.reset();
      loadUsers();
    } catch (err) {
      alert("Erro ao criar usuário: " + err.message);
    }
  };

  loadUsers();
}
