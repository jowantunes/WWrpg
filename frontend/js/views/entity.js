import { api } from "../api.js";
import { navigate } from "../app.js";

export async function renderEntity(root, id) {
  root.innerHTML = `<p>Carregando entidade #${id}...</p>`;

  let pagina;
  try {
    pagina = await api.pegarPagina(id);
  } catch (e) {
    root.innerHTML = `<h2>Erro</h2><p>${e.message}</p>`;
    return;
  }

  const tagsText = (pagina.tags || []).join(", ");

  // Campos básicos + idade (se vier do backend)
  root.innerHTML = `
    <button id="voltar">← Voltar</button>
    <h2 style="margin-top:12px;"> ${escapeHtml(pagina.titulo || "")} </h2>

    <div style="display:grid; gap:10px; max-width:520px;">
      <label>Título<br/>
        <input id="campo-titulo" class="campo-editavel" readonly value="${escapeHtml(pagina.titulo || "")}" />
      </label>

      <label>Autor<br/>
        <input id="campo-autor" class="campo-editavel" readonly value="${escapeHtml(pagina.autor || "")}" />
      </label>

      <label>Tags (vírgula)<br/>
        <input id="campo-tags" class="campo-editavel" readonly value="${escapeHtml(tagsText)}" />
      </label>


      ${renderCamposEspecificos(pagina)}

      <div id="relacionamentos" style="margin-top:16px;"></div>

    <div style="margin-top:12px; display:flex; gap:8px;">
      <button id="btn-editar">Editar</button>
      <button id="btn-excluir">Excluir</button>
    </div>
  `;

  await renderRelacionamentos(root, pagina);

  root.querySelector("#voltar").addEventListener("click", () => navigate("/"));

  const btnEditar = root.querySelector("#btn-editar");
  const btnExcluir = root.querySelector("#btn-excluir");
  const campos = root.querySelectorAll(".campo-editavel");

  btnEditar.addEventListener("click", async () => {
    const editando = btnEditar.textContent === "Salvar";

    if (!editando) {
      setEditMode(campos, true);
      btnEditar.textContent = "Salvar";
      return;
}

    // Salvar
    const payload = {};
    payload.titulo = root.querySelector("#campo-titulo").value;
    payload.id = pagina.id;
    payload.autor = root.querySelector("#campo-autor").value;

    const tags = root.querySelector("#campo-tags").value
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    payload.tags = tags;

    const entidade = getEntidade(pagina);
    const fields = SCHEMAS[entidade] || [];

    for (const f of fields) {
      const el = root.querySelector(`#campo-${f.key}`);
      if (!el) continue;

      let v = el.value;

      if (v && typeof v === "object") v = "";
      if (typeof v === "string") v = v.trim();

      if (f.type === "number") {
        v = v === "" ? null : Number(v);
      }

      // compatibilidade personagem (classe → subtipo)
      if (entidade === "personagem" && f.key === "tipo") {
        payload.classe = String(v || "").trim();
      } else {
        payload[f.key] = typeof v === "string" ? v.trim() : v;
      }
    }

    try {
      await api.editarPagina(id, payload);
      setEditMode(campos, false);
      btnEditar.textContent = "Editar";
      alert("Salvo!");
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    }
  });

  btnExcluir.addEventListener("click", async () => {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    try {
      await api.excluirPagina(id);
      alert("Excluída!");
      navigate("/");
    } catch (e) {
      alert("Erro ao excluir: " + e.message);
    }
  });
}
const SCHEMAS = {
  personagem: [
    { key: "idade", label: "Idade", type: "number" },
    { key: "tipo", label: "Classe", type: "text", alias: "classe" }, // suporta pagina.classe antigo
    { key: "genero", label: "Gênero", type: "text" },
    { key: "status_vida", label: "Status", type: "select", options: ["vivo","morto","desconhecido"] },
    { key: "aparencia", label: "Aparência", type: "textarea" },
    { key: "descricao", label: "Descrição", type: "textarea" },
    { key: "aniversario", label: "Aniversário", type: "text" },
  ],
  local: [
    { key: "tipo", label: "Tipo", type: "text" },
    { key: "descricao", label: "Descrição", type: "textarea" },
    { key: "status_local", label: "Status", type: "select", options: ["ativo","destruido","abandonado","desconhecido"] },
  ],
  organizacao: [
    { key: "tipo", label: "Tipo", type: "text" },
    { key: "descricao", label: "Descrição", type: "textarea" },
    { key: "status_org", label: "Status", type: "select", options: ["ativa","extinta","desconhecida"] },
  ],
  criatura: [
    { key: "tipo", label: "Tipo", type: "text" },
    { key: "elemento", label: "Elemento", type: "text" },
    { key: "descricao", label: "Descrição", type: "textarea" },
    { key: "status", label: "Status", type: "select", options: ["viva","morta","extinta","desconhecida"] },
  ],
  evento: [
    { key: "tipo", label: "Tipo", type: "text" },
    { key: "descricao", label: "Descrição", type: "textarea" },
    { key: "data_inicio", label: "Data início", type: "text" },
    { key: "data_fim", label: "Data fim", type: "text" },
  ],
  item: [
    { key: "tipo", label: "Tipo", type: "text" },
    { key: "descricao", label: "Descrição", type: "textarea" },
  ],
};
function renderCamposEspecificos(pagina) {
  const entidade = getEntidade(pagina);
  const fields = SCHEMAS[entidade] || [];
  if (!fields.length) return "";

  return fields.map(f => {
    const id = `campo-${f.key}`;
    const rawVal =
      pagina[f.key] ??
      (f.alias ? pagina[f.alias] : undefined) ??
      "";
    const val = (f.type === "textarea") ? escapeHtml(rawVal) : escapeHtml(rawVal);

    if (f.type === "select") {
      const opts = (f.options || []).map(o => {
        const selected = String(rawVal).toLowerCase() === o ? "selected" : "";
        return `<option value="${o}" ${selected}>${o}</option>`;
      }).join("");
      return `
        <label>${f.label}<br/>
          <select id="${id}" class="campo-editavel" disabled>
            ${opts}
          </select>
        </label>
      `;
    }

    if (f.type === "textarea") {
      return `
        <label>${f.label}<br/>
          <textarea id="${id}" class="campo-editavel" readonly>${val}</textarea>
        </label>
      `;
    }

    const inputType = f.type || "text";
    return `
      <label>${f.label}<br/>
        <input id="${id}" type="${inputType}" class="campo-editavel" readonly value="${val}" />
      </label>
    `;
  }).join("");
}

function getEntidade(pagina) {
  return (pagina.entidade || pagina.tipo || "").toLowerCase().trim();
}

function setEditMode(campos, enabled) {
  campos.forEach(c => {
    if (c.tagName === "SELECT") {
      if (enabled) c.removeAttribute("disabled");
      else c.setAttribute("disabled", true);
    } else {
      if (enabled) c.removeAttribute("readonly");
      else c.setAttribute("readonly", true);
    }
  });
}

async function renderRelacionamentos(root, pagina) {
  const box = root.querySelector("#relacionamentos");
  if (!box) return;

// ORGANIZAÇÃO -> MEMBROS (com adicionar/remover)
if (getEntidade(pagina) === "organizacao") {
  box.innerHTML = `<h3>Membros</h3><p>Carregando...</p>`;

  let membros = [];
  try {
    membros = await api.listarMembrosDaOrg(pagina.id);
  } catch (e) {
    box.innerHTML = `<h3>Membros</h3><p>Erro ao carregar: ${escapeHtml(e.message)}</p>`;
    return;
  }

  box.innerHTML = `
    <h3>Membros</h3>

    <div style="display:flex; gap:8px; margin:10px 0;">
      <input id="membro-id" placeholder="ID do personagem" style="flex:1;" />
      <button id="btn-adicionar-membro">Adicionar</button>
    </div>

    <div id="lista-membros">
      ${
        membros.length
          ? membros.map(m => `
            <div style="display:flex; justify-content:space-between; gap:8px; padding:8px 0; border-bottom:1px solid #eee;">
              <div>
                <div><strong>#${m.personagem_id}</strong> ${escapeHtml(m.personagem_titulo || "")}</div>
                ${m.cargo ? `<div style="font-size:12px;">Cargo: ${escapeHtml(m.cargo)}</div>` : ""}
              </div>
              <button class="btn-remover-membro" data-personagem="${m.personagem_id}">Remover</button>
            </div>
          `).join("")
          : `<p>Nenhum membro vinculado.</p>`
      }
    </div>
  `;

  // Adicionar membro: usa o endpoint do personagem
  box.querySelector("#btn-adicionar-membro").addEventListener("click", async () => {
    const personagemId = Number(box.querySelector("#membro-id").value);
    if (!personagemId) return alert("Informe o ID do personagem");

    try {
      await api.vincularOrganizacao(personagemId, { organizacao_id: pagina.id });
      await renderRelacionamentos(root, pagina);
    } catch (e) {
      alert("Erro ao adicionar membro: " + e.message);
    }
  });

  // Remover membro: usa o endpoint do personagem
  box.querySelectorAll(".btn-remover-membro").forEach(btn => {
    btn.addEventListener("click", async () => {
      const personagemId = Number(btn.getAttribute("data-personagem"));
      try {
        await api.desvincularOrganizacao(personagemId, pagina.id);
        await renderRelacionamentos(root, pagina);
      } catch (e) {
        alert("Erro ao remover membro: " + e.message);
      }
    });
  });
}
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}