import { api } from "../api.js";
import { navigate } from "../app.js";
import { SCHEMAS } from "../schemas.js";

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
    <h2 style="margin-top:12px;">${escapeHtml(pagina.titulo || "")}</h2>

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
    </div>

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

// relations_ui.js

async function renderRelacionamentos(root, pagina) {
  const box = root.querySelector("#relacionamentos");
  if (!box) return;

  box.innerHTML = `<h3>Relacionamentos</h3><p>Carregando...</p>`;

  // 1) Carrega TODAS as relações do backend (rota nova)
  let rel;
  try {
    rel = await api.getRelations(pagina.id); // GET /api/relations/<page_id>
  } catch (e) {
    rel = null;
  }

  // 2) Render genérico de relações (qualquer entidade)
  const htmlGenerico = renderRelacoesGenericas(rel);

  // 3) Render específico (UI rica) pros dois casos que tu já tinha
  const entidade = getEntidade(pagina);

  if (entidade === "organizacao") {
    // mantém o bloco de membros (com busca/add/remove)
    const htmlMembros = await renderBlocoMembrosOrg(pagina);
    box.innerHTML = htmlMembros + htmlGenerico;
    return;
  }

  if (entidade === "personagem") {
    // mantém o bloco de orgs (com busca/add/remove)
    const htmlOrgs = await renderBlocoOrgsPersonagem(pagina);
    box.innerHTML = htmlOrgs + htmlGenerico;
    return;
  }

  // outras entidades: só o genérico
  box.innerHTML = htmlGenerico || "";
}

// -------------------------
// Render genérico
// -------------------------
function renderRelacoesGenericas(rel) {
  // Se teu backend ainda não retorna nada, não quebra
  if (!rel) return "";

  // Aceita alguns formatos comuns:
  // A) { groups: [{label, items:[{id,titulo,entidade}]}] }
  // B) { relacoes: { itens:[...], locais:[...] } }
  // C) [{label, items:[...]}]
  const groups =
    Array.isArray(rel) ? rel :
    Array.isArray(rel.groups) ? rel.groups :
    rel.relacoes && typeof rel.relacoes === "object"
      ? Object.entries(rel.relacoes).map(([k, items]) => ({ label: k, items }))
      : [];

  const normItems = (items) => (items || []).map(x => ({
    id: x.id ?? x.page_id ?? x.target_id ?? x.pagina_id ?? x.relacionado_id,
    titulo: x.titulo ?? x.nome ?? x.target_titulo ?? x.pagina_titulo ?? "",
    entidade: (x.entidade ?? x.tipo ?? x.target_entidade ?? "").toLowerCase?.() ?? "",
    extra: x.extra ?? x.cargo ?? x.role ?? ""
  })).filter(i => i.id != null);

  const sections = groups
    .map(g => {
      const items = normItems(g.items);
      if (!items.length) return "";

      const label = escapeHtml(String(g.label || "Relações"));

      return `
        <div style="margin-top:14px;">
          <h4 style="margin:0 0 8px 0;">${label}</h4>
          <div style="border:1px solid #eee; border-radius:10px; padding:8px;">
            ${items.map(it => `
              <div style="display:flex; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid #f2f2f2;">
                <div style="min-width:0;">
                  <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    <strong>#${it.id}</strong> ${escapeHtml(it.titulo)}
                    ${it.entidade ? `<span style="opacity:.65; font-size:12px;"> (${escapeHtml(it.entidade)})</span>` : ""}
                  </div>
                  ${it.extra ? `<div style="font-size:12px; opacity:.8;">${escapeHtml(it.extra)}</div>` : ""}
                </div>
                <button class="btn-ir-pagina" data-id="${it.id}">Abrir</button>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    })
    .join("");

  // bind dos botões "Abrir"
  queueMicrotask(() => {
    document.querySelectorAll(".btn-ir-pagina").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-id"));
        if (id) navigate(`/entity/${id}`);
      });
    });
  });

  return sections ? `<h3>Relacionamentos</h3>${sections}` : "";
}

// -------------------------
// Blocos específicos (tu já tinha lógica; só empacotei)
// -------------------------
async function renderBlocoMembrosOrg(pagina) {
  let membros = [];
  try {
    membros = await api.listarMembrosDaOrg(pagina.id);
  } catch (e) {
    return `<h3>Membros</h3><p>Erro ao carregar: ${escapeHtml(e.message)}</p>`;
  }

  const html = `
    <h3>Membros</h3>

    <div style="position:relative; margin:10px 0;">
      <input id="membro-busca" placeholder="Digite o nome do personagem..." style="width:100%;" autocomplete="off" />
      <div id="membro-sugestoes" style="
        position:absolute;
        top:100%;
        left:0;
        right:0;
        background:white;
        border:1px solid #ccc;
        max-height:150px;
        overflow:auto;
        z-index:10;
      "></div>
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

  // bind events depois que entrar no DOM
  queueMicrotask(() => {
    const box = document.querySelector("#relacionamentos");
    const inputBusca = box?.querySelector("#membro-busca");
    const sugestoesBox = box?.querySelector("#membro-sugestoes");
    if (!inputBusca || !sugestoesBox) return;

    inputBusca.addEventListener("input", async () => {
      const termo = inputBusca.value.trim();
      if (!termo) { sugestoesBox.innerHTML = ""; return; }

      try {
        const resultados = await api.buscarPages({ entidade: "personagem", q: termo });
        sugestoesBox.innerHTML = "";

        resultados.forEach(p => {
          const item = document.createElement("div");
          item.textContent = p.titulo;
          item.style.padding = "6px";
          item.style.cursor = "pointer";

          item.addEventListener("click", async () => {
            try {
              await api.vincularOrganizacao(p.id, { organizacao_id: pagina.id });
              // re-render do entity atual
              await renderEntity(document.querySelector("#app"), pagina.id);
            } catch (e) {
              alert("Erro ao adicionar membro: " + e.message);
            }
          });

          sugestoesBox.appendChild(item);
        });
      } catch (e) {
        console.error(e);
      }
    });

    box.querySelectorAll(".btn-remover-membro").forEach(btn => {
      btn.addEventListener("click", async () => {
        const personagemId = Number(btn.getAttribute("data-personagem"));
        try {
          await api.desvincularOrganizacao(personagemId, pagina.id);
          await renderEntity(document.querySelector("#app"), pagina.id);
        } catch (e) {
          alert("Erro ao remover membro: " + e.message);
        }
      });
    });
  });

  return html;
}

async function renderBlocoOrgsPersonagem(pagina) {
  let orgs = [];
  try {
    orgs = await api.listarOrganizacoesDoPersonagem(pagina.id);
  } catch (e) {
    return `<h3>Organizações</h3><p>Erro ao carregar: ${escapeHtml(e.message)}</p>`;
  }

  const linkedIds = new Set(orgs.map(o => Number(o.organizacao_id ?? o.id)));

  const html = `
    <h3>Organizações</h3>

    <div style="position:relative; margin:10px 0;">
      <input id="org-busca" placeholder="Digite o nome da organização..." style="width:100%;" autocomplete="off" />
      <div id="org-sugestoes" style="
        position:absolute;
        top:100%;
        left:0;
        right:0;
        background:white;
        border:1px solid #ccc;
        max-height:150px;
        overflow:auto;
        z-index:10;
      "></div>
    </div>

    <div id="lista-orgs">
      ${
        orgs.length
          ? orgs.map(o => `
            <div style="display:flex; justify-content:space-between; gap:8px; padding:8px 0; border-bottom:1px solid #eee;">
              <div>
                <div><strong>#${o.organizacao_id ?? o.id}</strong> ${escapeHtml(o.organizacao_titulo ?? o.titulo ?? o.nome ?? "")}</div>
              </div>
              <button class="btn-remover-org" data-org="${o.organizacao_id ?? o.id}">Remover</button>
            </div>
          `).join("")
          : `<p>Nenhuma organização vinculada.</p>`
      }
    </div>
  `;

  queueMicrotask(() => {
    const box = document.querySelector("#relacionamentos");
    const inputBusca = box?.querySelector("#org-busca");
    const sugestoesBox = box?.querySelector("#org-sugestoes");
    if (!inputBusca || !sugestoesBox) return;

    inputBusca.addEventListener("input", async () => {
      const termo = inputBusca.value.trim();
      if (!termo) { sugestoesBox.innerHTML = ""; return; }

      try {
        const resultados = await api.buscarPages({ entidade: "organizacao", q: termo });
        sugestoesBox.innerHTML = "";

        resultados
          .filter(o => !linkedIds.has(Number(o.id)))
          .forEach(o => {
            const item = document.createElement("div");
            item.textContent = o.titulo;
            item.style.padding = "6px";
            item.style.cursor = "pointer";

            item.addEventListener("click", async () => {
              try {
                await api.vincularOrganizacao(pagina.id, { organizacao_id: o.id });
                await renderEntity(document.querySelector("#app"), pagina.id);
              } catch (e) {
                alert("Erro ao adicionar organização: " + e.message);
              }
            });

            sugestoesBox.appendChild(item);
          });

      } catch (e) {
        console.error(e);
      }
    });

    box.querySelectorAll(".btn-remover-org").forEach(btn => {
      btn.addEventListener("click", async () => {
        const orgId = Number(btn.getAttribute("data-org"));
        try {
          await api.desvincularOrganizacao(pagina.id, orgId);
          await renderEntity(document.querySelector("#app"), pagina.id);
        } catch (e) {
          alert("Erro ao remover organização: " + e.message);
        }
      });
    });
  });

  return html;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}