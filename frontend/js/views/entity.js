import { api } from "../api.js";
import { navigate } from "../app.js";
import { SCHEMAS, RELATION_RULES } from "../schemas.js";

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
    <button id="voltar" class="btn-ghost" style="margin-bottom:12px; font-weight:bold;">← Voltar</button>
    
    <div style="display:flex; gap:24px; flex-wrap:wrap;">
      <!-- Esquerda: Informações e Campos -->
      <div class="dark-surface" style="flex:1; min-width:300px; max-width:520px; padding:24px; border-radius:var(--radius-lg);">
        <h2 class="title-paranormal" style="margin-top:0; border-bottom:1px solid var(--bg-surface-alt); padding-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
          ${escapeHtml(pagina.titulo || "")}
          <span style="font-size:10px; padding:4px 8px; border-radius:var(--radius-sm); border:1px solid var(--brand-accent); color:var(--brand-accent); letter-spacing:1px;">ID: ${pagina.id}</span>
        </h2>
        
        <div style="display:grid; gap:10px;">
          <label style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">Identificação (Título)<br/>
            <input id="campo-titulo" class="input-limiar campo-editavel" readonly value="${escapeHtml(pagina.titulo || "")}" style="width:100%;" />
          </label>
          <label style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">URL Referência Visual<br/>
            <input id="campo-imagem" class="input-limiar campo-editavel" readonly value="${escapeHtml(pagina.imagem || "")}" placeholder="URL ou deixe em branco" style="width:100%;" />
          </label>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <label style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">Autor do Dossiê<br/>
                <input id="campo-autor" class="input-limiar campo-editavel" readonly value="${escapeHtml(pagina.autor || "")}" style="width:100%;" />
              </label>
              <label style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">Tags Indexadoras<br/>
                <input id="campo-tags" class="input-limiar campo-editavel" readonly value="${escapeHtml(tagsText)}" style="width:100%;" />
              </label>
          </div>

          <div style="margin-top:16px; border-top:1px dashed var(--bg-surface-alt); padding-top:16px;">
             <h4 class="title-paranormal" style="margin-top:0; font-size:14px; color:var(--text-muted);">Variáveis Específicas</h4>
             <div style="display:grid; gap:12px;">
               ${renderCamposEspecificos(pagina)}
             </div>
          </div>
        </div>
        
        <div style="margin-top:24px; display:flex; gap:12px; border-top:1px solid var(--bg-surface-alt); padding-top:16px;">
          <button id="btn-editar" class="btn-limiar">Editar Registro</button>
          <button id="btn-excluir" class="btn-limiar btn-danger" style="margin-left:auto;">Exterminar</button>
        </div>
      </div>

      <!-- Direita: Display de Imagem Dinâmico -->
      <div style="width:280px; flex-shrink:0;">
          <div style="width:100%; aspect-ratio:1; background:var(--bg-app); border:1px solid var(--bg-surface-alt); border-radius:var(--radius-lg); overflow:hidden; display:flex; align-items:center; justify-content:center; box-shadow:var(--shadow-base);">
             ${pagina.imagem
      ? `<img id="preview-display" src="${escapeHtml(pagina.imagem)}" style="width:100%; height:auto; min-height:100%; object-fit:cover; display:block;" />`
      : `<span id="preview-display-placeholder" style="color:var(--text-muted); font-size:14px; text-transform:uppercase; letter-spacing:2px;">Sem Imagem</span>`
    }
          </div>
      </div>
    </div>

    <div id="relacionamentos" style="margin-top:40px;"></div>
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

    let novaImagem = root.querySelector("#campo-imagem").value.trim();
    payload.imagem = novaImagem || null;

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

      const imgDisplay = root.querySelector("#preview-display");
      const placeholder = root.querySelector("#preview-display-placeholder");
      if (novaImagem) {
        if (imgDisplay) { imgDisplay.src = novaImagem; }
        else {
          // Injetando no container caso antes estivesse com placeholder
          const container = placeholder.parentElement;
          container.innerHTML = `<img id="preview-display" src="${escapeHtml(novaImagem)}" style="width:100%; height:auto; min-height:100%; object-fit:cover; display:block;" />`;
        }
      } else {
        if (imgDisplay) {
          const container = imgDisplay.parentElement;
          container.innerHTML = `<span id="preview-display-placeholder" style="color:#999;font-size:14px;">Sem Imagem</span>`;
        }
      }

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
        <label style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">${f.label}<br/>
          <select id="${id}" class="input-limiar campo-editavel" disabled style="width:100%;">
            ${opts}
          </select>
        </label>
      `;
    }

    if (f.type === "textarea") {
      return `
        <label style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">${f.label}<br/>
          <textarea id="${id}" class="input-limiar campo-editavel" readonly style="width:100%; min-height:80px;">${val}</textarea>
        </label>
      `;
    }

    const inputType = f.type || "text";
    return `
      <label style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">${f.label}<br/>
        <input id="${id}" type="${inputType}" class="input-limiar campo-editavel" readonly value="${val}" style="width:100%;" />
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
function setupAutocompleteMembros(box, root, pagina) {
  const input = box.querySelector("#membro-busca");
  const sugestoesBox = box.querySelector("#membro-sugestoes");
  if (!input || !sugestoesBox) return;

  // evita corrida de requests
  let seq = 0;

  input.oninput = async () => {
    const termo = input.value.trim();
    if (!termo) {
      sugestoesBox.innerHTML = "";
      return;
    }

    const my = ++seq;

    try {
      const resultados = await api.buscarPages({ entidade: "personagem", q: termo });
      if (my !== seq) return;

      sugestoesBox.innerHTML = resultados
        .map(p => `<div class="sug-item" data-personagem-id="${p.id}" style="padding:6px; cursor:pointer;">${escapeHtml(p.titulo)}</div>`)
        .join("");
    } catch (e) {
      console.error(e);
    }
  };

  sugestoesBox.onclick = async (ev) => {
    const item = ev.target.closest(".sug-item");
    if (!item) return;

    const personagemId = Number(item.dataset.personagemId);
    if (!personagemId) return;

    try {
      await api.vincularOrganizacao(personagemId, { organizacao_id: pagina.id });
      await renderRelacionamentos(root, pagina);
    } catch (e) {
      alert("Erro ao adicionar membro: " + e.message);
    }
  };
}

function setupAutocompleteOrgs(box, root, pagina, orgsExistentes = []) {
  const input = box.querySelector("#org-busca");
  const sugestoesBox = box.querySelector("#org-sugestoes");
  if (!input || !sugestoesBox) return;

  const linkedIds = new Set(orgsExistentes.map(o => Number(o.organizacao_id ?? o.id)));
  let seq = 0;

  input.oninput = async () => {
    const termo = input.value.trim();
    if (!termo) {
      sugestoesBox.innerHTML = "";
      return;
    }

    const my = ++seq;

    try {
      const resultados = await api.buscarPages({ entidade: "organizacao", q: termo });
      if (my !== seq) return;

      sugestoesBox.innerHTML = resultados
        .filter(o => !linkedIds.has(Number(o.id)))
        .map(o => `<div class="sug-item" data-org-id="${o.id}" style="padding:6px; cursor:pointer;">${escapeHtml(o.titulo)}</div>`)
        .join("");
    } catch (e) {
      console.error(e);
    }
  };

  sugestoesBox.onclick = async (ev) => {
    const item = ev.target.closest(".sug-item");
    if (!item) return;

    const orgId = Number(item.dataset.orgId);
    if (!orgId) return;

    try {
      await api.vincularOrganizacao(pagina.id, { organizacao_id: orgId });
      await renderRelacionamentos(root, pagina);
    } catch (e) {
      alert("Erro ao adicionar organização: " + e.message);
    }
  };
}
async function renderRelacionamentos(root, pagina) {
  const box = root.querySelector("#relacionamentos");
  if (!box) return;

  box.innerHTML = `<h3 style="border-bottom:2px solid #ccc; padding-bottom:8px;">Relacionamentos</h3><p>Carregando...</p>`;

  let rel = null;
  try {
    rel = await api.getRelations(pagina.id);
  } catch (e) {
    rel = null;
  }

  // Normalizar array de relacoes retornadas do backend para facilitar filtros
  let todasRelacoes = [];
  if (rel) {
    const rawGroups = Array.isArray(rel) ? rel : (rel.groups || []);
    for (const g of rawGroups) {
      const items = g.items || [];
      for (const it of items) {
        todasRelacoes.push({
          relacao_id: it.relacao_id,
          tipo_relacao: g.label, // 'membro_de', etc
          id: it.id ?? it.page_id ?? it.target_id ?? it.pagina_id ?? it.relacionado_id,
          titulo: it.titulo ?? it.nome ?? it.target_titulo ?? it.pagina_titulo ?? "",
          entidade: (it.entidade ?? it.tipo ?? it.target_entidade ?? "").toLowerCase?.() ?? "",
          extra: it.extra ?? it.cargo ?? it.role ?? it.rotulo ?? ""
        });
      }
    }
  }

  const entidadeAtual = getEntidade(pagina);
  const entidadesPermitidas = RELATION_RULES[entidadeAtual] || [];

  if (entidadesPermitidas.length === 0) {
    box.innerHTML = `<h3 class="title-paranormal" style="border-bottom:1px solid var(--bg-surface-alt); padding-bottom:8px;">Relacionamentos</h3><p style="color:var(--text-muted);">Esta entidade não suporta vínculos.</p>`;
    return;
  }

  let htmlTotal = `<h3 class="title-paranormal" style="border-bottom:1px solid var(--brand-accent); padding-bottom:8px; margin-bottom:24px; display:inline-block; padding-right:40px;">Grafo de Conexões</h3>`;
  const labelsMapa = {
    "personagem": "Personagens Relacionados", "local": "Locais Relacionados",
    "organizacao": "Organizações Envolvidas", "item": "Itens Portados / Relacionados",
    "evento": "Eventos Históricos", "criatura": "Criaturas Vinculadas"
  };

  entidadesPermitidas.forEach(alvoTipo => {
    const relacoesDesteTipo = todasRelacoes.filter(r => r.entidade === alvoTipo);
    const title = labelsMapa[alvoTipo] || alvoTipo.toUpperCase();

    htmlTotal += `
        <div class="dark-surface" style="margin-bottom:24px; border-radius:var(--radius-lg); overflow:hidden;">
            <div style="background:var(--bg-app); padding:12px 16px; border-bottom:1px solid var(--bg-surface-alt); display:flex; justify-content:space-between; align-items:center;">
                <h4 class="title-paranormal" style="margin:0; font-size:14px; color:var(--text-muted);">${title}</h4>
                <span class="badge" style="background:var(--brand-danger); color:white; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:bold;">${relacoesDesteTipo.length}</span>
            </div>
            
            <div style="padding:16px;">
              ${relacoesDesteTipo.length > 0
        ? `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:12px; margin-bottom:16px;">` + relacoesDesteTipo.map(it => `
                      <div class="card-noir" style="display:flex; justify-content:space-between; align-items:flex-start; padding:12px;">
                        <div style="flex-grow:1; min-width:0;">
                          <div style="display:flex; align-items:center; margin-bottom:4px; gap:8px;">
                            <span style="font-size:10px; padding:2px 6px; background:var(--bg-app); border:1px solid var(--brand-accent); color:var(--brand-accent); border-radius:4px; text-transform:uppercase; letter-spacing:1px;">${escapeHtml(it.tipo_relacao)}</span>
                          </div>
                          <div>
                             <a href="javascript:void(0)" class="btn-ir-pagina" data-id="${it.id}" style="text-decoration:none; color:var(--text-main); font-weight:600; font-size:15px; display:block; margin-bottom:2px;">
                                 #${it.id} ${escapeHtml(it.titulo)}
                             </a>
                             ${it.extra ? `<div style="font-size:12px; color:var(--text-muted); font-style:italic;">"${escapeHtml(it.extra)}"</div>` : ""}
                          </div>
                        </div>
                        ${it.relacao_id ? `<button class="btn-remover-relacao btn-ghost" data-relacao="${it.relacao_id}" style="padding:4px; margin-left:8px; color:var(--text-muted);" title="Cortar Conexão">✕</button>` : ""}
                      </div>
                    `).join("") + `</div>`
        : `<p style="font-size:13px; color:var(--text-muted); font-style:italic; margin-bottom:16px;">Nenhum nó de rede correspondente a ${alvoTipo}.</p>`
      }

              <!-- Widget de Adição Rápida pra esse Tipo -->
              <div style="background:var(--bg-app); border:1px solid var(--bg-surface-alt); padding:12px; border-radius:var(--radius-md); display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end;">
                  <label style="flex-grow:1; min-width:180px; position:relative; color:var(--text-muted); font-size:11px; text-transform:uppercase;">
                    Vincular Novo(a)
                    <input type="text" class="input-limiar input-busca-estruturada" data-alvo="${alvoTipo}" placeholder="Buscar ${alvoTipo}..." autocomplete="off" style="width:100%; display:block; margin-top:4px;" />
                    <input type="hidden" class="input-destino-id" />
                    <div class="sugestoes-box" style="position:absolute; top:100%; left:0; right:0; background:var(--bg-surface); border:1px solid var(--bg-surface-alt); max-height:150px; overflow:auto; z-index:10; display:none; box-shadow:var(--shadow-base); border-radius:var(--radius-md); margin-top:4px;"></div>
                  </label>
                  
                  <label style="width:130px; color:var(--text-muted); font-size:11px; text-transform:uppercase;">
                    Relação (Lógico)
                    <input type="text" class="input-limiar input-tipo-relacao" placeholder="ex: aliado_de" list="tipos-${alvoTipo}" style="width:100%; display:block; margin-top:4px;" />
                  </label>

                  <label style="width:130px; color:var(--text-muted); font-size:11px; text-transform:uppercase;">
                    Rótulo (Display)
                    <input type="text" class="input-limiar input-rotulo" placeholder="ex: Líder Oculto" style="width:100%; display:block; margin-top:4px;" />
                  </label>
                  
                  <button class="btn-limiar btn-primary btn-add-estruturado" style="padding:10px 16px;">Adicionar Elo</button>
              </div>
            </div>
        </div>
      `;
  });

  box.innerHTML = htmlTotal;

  // Delegação de Eventos Geral (Remover, Ir Página, e Adicionar)
  box.onclick = async (ev) => {

    // 1 - Navegar
    const btnAbrir = ev.target.closest(".btn-ir-pagina");
    if (btnAbrir) {
      const id = Number(btnAbrir.dataset.id);
      if (id) navigate(`/entity/${id}`);
      return;
    }

    // 2 - Remover
    const btnRemover = ev.target.closest(".btn-remover-relacao");
    if (btnRemover) {
      const relacaoId = Number(btnRemover.dataset.relacao);
      if (!relacaoId) return;

      if (!confirm("Tem certeza que deseja remover esta relação?")) return;

      try {
        await api.deletarRelacao(relacaoId);
        await renderRelacionamentos(root, pagina); // Reload da grid estruturada
      } catch (e) {
        alert("Erro ao remover relação: " + e.message);
      }
      return;
    }

    // 3 - Adicionar
    const btnAdd = ev.target.closest(".btn-add-estruturado");
    if (btnAdd) {
      const wrapper = btnAdd.parentElement;
      const destinoId = Number(wrapper.querySelector(".input-destino-id").value);
      const tipoStr = wrapper.querySelector(".input-tipo-relacao").value.trim() || 'relacionado_a';
      const rotulo = wrapper.querySelector(".input-rotulo").value.trim();

      if (!destinoId) {
        alert("Selecione um destino primeiro através do campo de busca.");
        return;
      }

      try {
        await api.criarRelacao({
          origem_page_id: pagina.id,
          destino_page_id: destinoId,
          tipo_relacao: tipoStr,
          rotulo: rotulo || null
        });
        await renderRelacionamentos(root, pagina); // Reload da UI limpa e estruturada
      } catch (e) {
        alert("Erro ao criar relação: " + e.message);
      }
    }
  };

  // Autocomplete Setup Isolado por Seção (Multi-instâncias dinâmicas)
  const buscaInputs = box.querySelectorAll(".input-busca-estruturada");
  buscaInputs.forEach(input => {
    const wrapper = input.parentElement;
    const sugestoesBox = wrapper.querySelector(".sugestoes-box");
    const destinoIdInput = wrapper.querySelector(".input-destino-id");
    const tipoEntidadeRestrita = input.dataset.alvo;

    let seq = 0;
    input.oninput = async () => {
      const termo = input.value.trim();
      if (!termo) {
        sugestoesBox.innerHTML = "";
        sugestoesBox.style.display = "none";
        return;
      }

      const my = ++seq;
      try {
        // Buscando ESTRITAMENTE pelo tipo da aba!
        const resultados = await api.buscarPages({ entidade: tipoEntidadeRestrita, q: termo });
        if (my !== seq) return;

        if (!resultados.length) {
          sugestoesBox.innerHTML = "<div style='padding:8px; color:#999;font-size:12px;'>Nenhum encontrado</div>";
          sugestoesBox.style.display = "block";
          return;
        }

        sugestoesBox.innerHTML = resultados
          .filter(r => r.id !== pagina.id) // Excluir si mesmo
          .map(r => `
                  <div class="sug-item" data-id="${r.id}" data-titulo="${escapeHtml(r.titulo)}" style="padding:8px; cursor:pointer; border-bottom:1px solid #f0f0f0; font-size:13px;">
                     <strong>#${r.id}</strong> ${escapeHtml(r.titulo)}
                  </div>
               `).join("");
        sugestoesBox.style.display = "block";

      } catch (e) { console.error(e); }
    };

    sugestoesBox.onclick = (e) => {
      const item = e.target.closest(".sug-item");
      if (!item) return;

      destinoIdInput.value = item.dataset.id;
      input.value = `[Selecionado] ${item.dataset.titulo}`;

      sugestoesBox.innerHTML = "";
      sugestoesBox.style.display = "none";
    };

    document.addEventListener("click", (e) => {
      if (sugestoesBox && !wrapper.contains(e.target)) {
        sugestoesBox.style.display = "none";
      }
    });
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