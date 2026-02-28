import { api } from "../api.js";
import { navigate } from "../app.js";
import { SCHEMAS } from "../schemas.js";

function renderRelacionamentoCriacaoUI({ titulo, placeholder, inputId, sugestoesId, listaId }) {
  return `
    <div style="margin-top:14px; padding-top:10px; border-top:1px solid #eee;">
      <h3 style="margin:0 0 8px;">${titulo}</h3>

      <div style="position:relative; margin:10px 0;">
        <input id="${inputId}" placeholder="${placeholder}" style="width:100%;" autocomplete="off" />
        <div id="${sugestoesId}" style="
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

      <div id="${listaId}"></div>
    </div>
  `;
}

function renderPendentesLista(container, pendentes, kind) {
  // kind: "org" | "membro"
  container.innerHTML = pendentes.length
    ? pendentes.map(p => `
      <div style="display:flex; justify-content:space-between; gap:8px; padding:8px 0; border-bottom:1px solid #eee;">
        <div><strong>#${p.id}</strong> ${escapeHtml(p.titulo || "")}</div>
        <button class="btn-remover-pendente" data-kind="${kind}" data-id="${p.id}">Remover</button>
      </div>
    `).join("")
    : `<p style="opacity:.75;">Nenhum adicionado ainda.</p>`;
}

function renderCamposCriacao(entidade) {
  const fields = SCHEMAS[entidade] || [];
  if (!fields.length) return "";

  return fields.map(f => {
    const id = `novo-${f.key}`;

    if (f.type === "select") {
      const opts = (f.options || []).map(o =>
        `<option value="${o}">${o}</option>`
      ).join("");
      return `
        <label>${f.label}<br/>
          <select id="${id}">
            <option value="">—</option>
            ${opts}
          </select>
        </label>
      `;
    }

    if (f.type === "textarea") {
      return `
        <label>${f.label}<br/>
          <textarea id="${id}" rows="4"></textarea>
        </label>
      `;
    }

    const inputType = f.type || "text";
    return `
      <label>${f.label}<br/>
        <input id="${id}" type="${inputType}" />
      </label>
    `;
  }).join("");
}

export function renderAdmin(root) {
  root.innerHTML = `
    <button id="voltar">← Voltar</button>
    <h2>Admin</h2>

    <div style="display:grid; gap:10px; max-width:520px;">
      <label>Tipo<br/>
        <select id="tipo">
          <option value="personagem">Personagem</option>
          <option value="item">Item</option>
          <option value="local">Local</option>
          <option value="organizacao">Organização</option>
          <option value="criatura">Criatura</option>
          <option value="evento">Evento</option>
        </select>
      </label>

      <label>Título<br/>
        <input id="titulo" />
      </label>

      <label>Autor<br/>
        <input id="autor" />
      </label>

      <label>Tags (vírgula)<br/>
        <input id="tags" placeholder="mocinho, cabeludo" />
      </label>

      <div id="extra"></div>

      <button id="criar">Criar</button>
    </div>
  `;

  root.querySelector("#voltar").addEventListener("click", () => navigate("/"));

    const tipoEl = root.querySelector("#tipo");
    const extra = root.querySelector("#extra");

    let pendOrgs = [];
    let pendMembros = [];

    function rerenderSchemaFields() {
    const tipo = tipoEl.value;

    let html = renderCamposCriacao(tipo);

    // PERSONAGEM: escolher orgs pendentes
    if (tipo === "personagem") {
      html += renderRelacionamentoCriacaoUI({
        titulo: "Organizações (opcional)",
        placeholder: "Digite o nome da organização...",
        inputId: "pend-org-busca",
        sugestoesId: "pend-org-sugestoes",
        listaId: "pend-org-lista",
      });
    }

    // ORGANIZAÇÃO: escolher membros pendentes
    if (tipo === "organizacao") {
      html += renderRelacionamentoCriacaoUI({
        titulo: "Membros (opcional)",
        placeholder: "Digite o nome do personagem...",
        inputId: "pend-membro-busca",
        sugestoesId: "pend-membro-sugestoes",
        listaId: "pend-membro-lista",
      });
    }
    extra.innerHTML = html;
  }
  
function bindPendentes() {
  const tipo = tipoEl.value;

  // PERSONAGEM -> ORGS
  if (tipo === "personagem") {
    const input = root.querySelector("#pend-org-busca");
    const sugestoes = root.querySelector("#pend-org-sugestoes");
    const lista = root.querySelector("#pend-org-lista");
    if (!input || !sugestoes || !lista) return;

    renderPendentesLista(lista, pendOrgs, "org");

    input.oninput = async () => {
      const termo = input.value.trim();
      if (!termo) { sugestoes.innerHTML = ""; return; }

      try {
        const resultados = await api.buscarPages({ entidade: "organizacao", q: termo });
        sugestoes.innerHTML = "";

        const idsJa = new Set(pendOrgs.map(o => Number(o.id)));

        resultados
          .filter(o => !idsJa.has(Number(o.id)))
          .forEach(o => {
            const item = document.createElement("div");
            item.textContent = o.titulo;
            item.style.padding = "6px";
            item.style.cursor = "pointer";

            item.onclick = () => {
              pendOrgs.push({ id: o.id, titulo: o.titulo });
              input.value = "";
              sugestoes.innerHTML = "";
              renderPendentesLista(lista, pendOrgs, "org");
            };

            sugestoes.appendChild(item);
          });
      } catch (e) {
        console.error(e);
      }
    };

    lista.onclick = (e) => {
      const btn = e.target.closest(".btn-remover-pendente");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      pendOrgs = pendOrgs.filter(o => Number(o.id) !== id);
      renderPendentesLista(lista, pendOrgs, "org");
    };

    return;
  }

  // ORGANIZAÇÃO -> MEMBROS
  if (tipo === "organizacao") {
    const input = root.querySelector("#pend-membro-busca");
    const sugestoes = root.querySelector("#pend-membro-sugestoes");
    const lista = root.querySelector("#pend-membro-lista");
    if (!input || !sugestoes || !lista) return;

    renderPendentesLista(lista, pendMembros, "membro");

    input.oninput = async () => {
      const termo = input.value.trim();
      if (!termo) { sugestoes.innerHTML = ""; return; }

      try {
        const resultados = await api.buscarPages({ entidade: "personagem", q: termo });
        sugestoes.innerHTML = "";

        const idsJa = new Set(pendMembros.map(p => Number(p.id)));

        resultados
          .filter(p => !idsJa.has(Number(p.id)))
          .forEach(p => {
            const item = document.createElement("div");
            item.textContent = p.titulo;
            item.style.padding = "6px";
            item.style.cursor = "pointer";

            item.onclick = () => {
              pendMembros.push({ id: p.id, titulo: p.titulo });
              input.value = "";
              sugestoes.innerHTML = "";
              renderPendentesLista(lista, pendMembros, "membro");
            };

            sugestoes.appendChild(item);
          });
      } catch (e) {
        console.error(e);
      }
    };

    lista.onclick = (e) => {
      const btn = e.target.closest(".btn-remover-pendente");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      pendMembros = pendMembros.filter(p => Number(p.id) !== id);
      renderPendentesLista(lista, pendMembros, "membro");
    };

    return;
  }
}

// ✅ único change (sem duplicar)
tipoEl.onchange = () => {
  rerenderSchemaFields();
  bindPendentes();
};

// ✅ inicial
rerenderSchemaFields();
bindPendentes();
  root.querySelector("#criar").addEventListener("click", async () => {
    const tipo = tipoEl.value;
    const titulo = root.querySelector("#titulo").value.trim();
    const autor = root.querySelector("#autor").value.trim();
    const tags = root.querySelector("#tags").value
      .split(",").map(t => t.trim()).filter(Boolean);

    const payload = { tipo, titulo, autor, tags };

    // pega os campos do schema (igual ao editar)
  const fields = SCHEMAS[tipo] || [];
  for (const f of fields) {
    const el = root.querySelector(`#novo-${f.key}`);
    if (!el) continue;

    let v = el.value;
    if (typeof v === "string") v = v.trim();

    if (f.type === "number") {
      v = v === "" ? null : Number(v);
    } else {
      v = v === "" ? null : v;
    }

    // ✅ personagem: classe vem do campo "tipo" do schema
    if (tipo === "personagem" && f.key === "tipo") {
      payload.classe = v;
      continue;
    }

    // ✅ IMPORTANTÍSSIMO:
    // para outras entidades, o campo "tipo" do schema NÃO pode sobrescrever payload.tipo (entidade)
    if (f.key === "tipo") {
      payload.subtipo = v; // ou payload.tipo_interno = v
      continue;
    }

    payload[f.key] = v;
  }

    console.log("payload que vou enviar:", payload);

    try {
      const resp = await api.criarPagina(payload);
      // cria relacionamentos depois de ter ID
        try {
          if (tipo === "personagem" && pendOrgs.length) {
            for (const o of pendOrgs) {
              await api.vincularOrganizacao(resp.id, { organizacao_id: o.id });
            }
          }

          if (tipo === "organizacao" && pendMembros.length) {
            for (const p of pendMembros) {
              // tu já usa esse mesmo endpoint: personagem -> vincular organizacao
              await api.vincularOrganizacao(p.id, { organizacao_id: resp.id });
            }
          }
        } catch (e) {
          // não impede a criação, mas avisa
          alert("Criou, mas deu erro ao vincular relacionamentos: " + e.message);
        }
      alert("Criada! ID: " + resp.id);
      navigate(`/entity/${resp.id}`);
    } catch (e) {
      alert("Erro: " + e.message);
    }
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}