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
      campos.forEach(c => c.removeAttribute("readonly"));
      btnEditar.textContent = "Salvar";
      return;
    }

    // Salvar
    const payload = {};
    payload.titulo = root.querySelector("#campo-titulo").value;
    payload.autor = root.querySelector("#campo-autor").value;

    const tags = root.querySelector("#campo-tags").value
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    payload.tags = tags;

    if (pagina.tipo === "personagem") {
      const idadeVal = root.querySelector("#campo-idade").value;
      payload.idade = idadeVal === "" ? null : Number(idadeVal);
      payload.classe = root.querySelector("#campo-classe").value.trim();
    }

    try {
      await api.editarPagina(id, payload);
      campos.forEach(c => c.setAttribute("readonly", true));
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

function renderCamposEspecificos(pagina) {
  if (pagina.tipo === "personagem") {
    return `
      <label>Idade<br/>
        <input type="number" id="campo-idade" class="campo-editavel" readonly value="${pagina.idade ?? ""}" />
      </label>
      
      <label>Classe<br/>
        <input id="campo-classe" class="campo-editavel" readonly value="${escapeHtml(pagina.classe || "")}" />
      </label>
    `;
  }

  // organizacao ainda não tem campos
  return "";
}

async function renderRelacionamentos(root, pagina) {
  const box = root.querySelector("#relacionamentos");
  if (!box) return;

// ORGANIZAÇÃO -> MEMBROS (com adicionar/remover)
if (pagina.tipo === "organizacao") {
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