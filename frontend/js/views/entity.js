import { api } from "../api.js";
import { navigate } from "../app.js";
import { state } from "../state.js";
import { SCHEMAS, RELATION_RULES } from "../schemas.js";
import { renderPostsTab } from "./posts.js";

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
  const entidade = getEntidade(pagina);
  const { longCardsHtml, infoCardHtml } = renderCamposEspecificosView(pagina);

  root.innerHTML = `
    <button id="voltar" class="btn-ghost" style="margin-bottom:16px;font-weight:bold;">← Voltar</button>

    <!-- HERO -->
    <div class="entity-hero dark-surface" style="position:relative; overflow:visible;">
      <div class="entity-hero-img-wrap" style="box-shadow: 0 8px 32px rgba(0,0,0,0.5); border-color: var(--bg-surface-alt);">
        ${pagina.imagem
      ? `<img id="preview-display" class="entity-hero-img" src="${escapeHtml(pagina.imagem)}" />`
      : `<div id="preview-display-placeholder" style="display:flex; flex-direction:column; align-items:center; gap:8px;">
           <i data-lucide="image-off" style="width:32px; height:32px; opacity:0.3;"></i>
           <span style="color:var(--text-muted);font-size:10px;text-transform:uppercase;letter-spacing:2px;">Sem Imagem</span>
         </div>`
    }
      </div>
      
      <div class="entity-hero-info">
        <div style="display:flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap;">
          <div style="flex:1; min-width:300px;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
              <span class="entity-type-badge" style="background: rgba(193, 18, 31, 0.1); border-radius: 4px;">${escapeHtml(entidade || "entidade")}</span>
              <span style="font-family:monospace; font-size:11px; color:var(--text-muted); background: var(--bg-app); padding:2px 6px; border-radius:4px;">ID #${pagina.id}</span>
            </div>
            <h2 class="entity-hero-title" id="hero-titulo" style="margin-bottom:8px;">${escapeHtml(pagina.titulo || "")}
            ${pagina.status_vida === "morto" ? "✟" : ""}</h2>
            
            <div class="hero-meta">
              <span><i data-lucide="user" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i> ${pagina.autor ? "@" + escapeHtml(pagina.autor) : "Desconhecido"}</span>
              ${pagina.data_atualizacao ? `<span><i data-lucide="clock" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i> ${new Date(pagina.data_atualizacao).toLocaleDateString()}</span>` : ""}
            </div>
          </div>

          <div class="entity-hero-actions" style="margin-top: 0;">
            ${state.canWrite() ? `
              <button id="btn-editar" class="btn-limiar btn-primary btn-xl" style="display:flex; align-items:center; gap:8px;">
                <i data-lucide="edit-3" style="width:16px; height:16px;"></i>
                <span>Editar Registro</span>
              </button>
              <button id="btn-excluir" class="btn-limiar btn-danger btn-xl" style="display:flex; align-items:center; gap:8px;">
                <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                <span>Exterminar</span>
              </button>
            ` : `
              <div style="background: var(--bg-surface-alt); padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); color: var(--text-muted); font-size: 12px; display: flex; align-items: center; gap: 8px;">
                <i data-lucide="eye" style="width:14px; height:14px;"></i>
                MODO LEITURA
              </div>
            `}
          </div>
        </div>

        <div class="entity-tags" id="hero-tags" style="margin-top: 12px; border-top: 1px solid var(--bg-surface-alt); padding-top: 12px;">
          ${(pagina.tags || []).length > 0
      ? (pagina.tags || []).map(t => `<span class="entity-tag-badge" style="background:var(--bg-app); border:1px solid var(--bg-surface-alt); padding: 4px 12px;">${escapeHtml(t)}</span>`).join("")
      : `<span style="color:var(--text-muted); font-size:11px; font-style:italic;">Nenhuma tag indexada</span>`
    }
        </div>
      </div>
    </div>
    
    <div id="save-feedback">Registro Guardado com sucesso</div>

    <!-- TAB BAR -->
    <div class="tab-bar">
      <button class="tab-btn active" data-tab="0">📋 Visão Geral</button>
      <button class="tab-btn" data-tab="1">📖 História</button>
      <button class="tab-btn" data-tab="2">🕸️ Conexões</button>
      <button class="tab-btn" data-tab="3">🗡️ Itens</button>
      <button class="tab-btn" data-tab="4">📅 Eventos</button>
      <button class="tab-btn" data-tab="5">📝 Notas</button>
      <button class="tab-btn" data-tab="6">📁 Arquivos</button>
    </div>

    <!-- PANEL 0: Visão Geral -->
    <div class="tab-panel active" data-panel="0">
      <div id="entity-details-root" class="entity-details-container">
        <!-- VIEW MODE (Image 2 style) -->
        <div class="details-view">
          <div class="view-grid-2col">
            <!-- Left Column: Long Fields (Description, Appearance, etc) -->
            <div class="details-column" id="specific-fields-long-view">
              ${longCardsHtml}
            </div>
            
            <!-- Right Column: Info Card (Compact fields) -->
            <div class="info-column">
              <div class="dossie-card">
                <h4 class="dossie-card-title">Informações</h4>
                <div class="info-list" id="specific-fields-info-view">
                  ${infoCardHtml}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- EDIT MODE (Organized Cards) -->
        <div class="details-edit" style="display:grid; gap:24px;">
          
          <div class="editor-grid">
            <!-- Card: Identificação -->
            <div class="editor-card">
              <h4 class="editor-card-title">Identificação</h4>
              <div style="display:grid; gap:16px;">
                <label class="editor-label">Título da Entidade
                  <input id="campo-titulo" class="input-limiar campo-editavel" readonly value="${escapeHtml(pagina.titulo || "")}" placeholder="Ex: Grande Ritual de 1923" />
                </label>
                <label class="editor-label">URL da Imagem / Referência
                  <input id="campo-imagem" class="input-limiar campo-editavel" readonly value="${escapeHtml(pagina.imagem || "")}" placeholder="https://..." />
                </label>
                <label class="editor-label">Tags (separadas por vírgula)
                  <input id="campo-tags" class="input-limiar campo-editavel" readonly value="${escapeHtml(tagsText)}" placeholder="misterio, evento, oculto" />
                </label>
              </div>
            </div>

            <!-- Card: Metadados -->
            <div class="editor-card">
              <h4 class="editor-card-title">Metadados de Arquivo</h4>
              <div style="display:grid; gap:16px;">
                <label class="editor-label">Autor (Automático)
                  <input id="campo-autor" class="input-limiar editor-field-read-only" readonly value="${escapeHtml(pagina.autor || "")}" />
                </label>
                <label class="editor-label">Tipo de Entidade
                  <input class="input-limiar editor-field-read-only" readonly value="${escapeHtml(entidade.toUpperCase())}" />
                </label>
                <label class="editor-label">Registro no Banco
                  <input class="input-limiar editor-field-read-only" readonly value="PAGINA #${pagina.id}" />
                </label>
              </div>
            </div>
          </div>

          <!-- Card: Variáveis Específicas -->
          <div class="editor-card" id="specific-fields-edit-container">
            <h4 class="editor-card-title">Variáveis de Categoria</h4>
            <div id="specific-fields-edit" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
              ${renderCamposEspecificosEdit(pagina)}
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- PANEL 1: História -->
    <div class="tab-panel" data-panel="1">
      <div id="posts-historia-container"></div>
    </div>

    <!-- PANEL 2: Conexões (personagens, orgs, locais, criaturas) -->
    <div class="tab-panel" data-panel="2">
      <div id="rel-conexoes"></div>
    </div>

    <!-- PANEL 3: Itens -->
    <div class="tab-panel" data-panel="3">
      <div id="rel-itens"></div>
    </div>

    <!-- PANEL 4: Eventos -->
    <div class="tab-panel" data-panel="4">
      <div id="rel-eventos"></div>
    </div>

    <!-- PANEL 5: Notas -->
    <div class="tab-panel" data-panel="5">
      <div id="posts-notas-container"></div>
    </div>

    <!-- PANEL 6: Arquivos -->
    <div class="tab-panel" data-panel="6">
      <div id="entity-files-root">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; gap:20px;">
           <h3 class="title-paranormal" style="margin:0; font-size:16px; white-space:nowrap;">Documentos / Evidências</h3>
           ${state.canWrite() ? `
             <div style="position:relative; flex:1; max-width:400px;">
                <input type="text" id="input-search-files-to-link" class="input-limiar" style="font-size:12px; width:100%;" placeholder="Vincular arquivo (buscar por título)..." autocomplete="off" />
                <div id="file-sugestoes" class="sugestoes-box" style="position:absolute; top:100%; left:0; right:0; display:none; z-index:100;"></div>
             </div>
           ` : ""}
        </div>
        <div id="entity-files-grid" class="file-grid"></div>
      </div>
    </div>
  `;

  // ── Tab switching ──────────────────────────────────────────
  const tabBtns = root.querySelectorAll(".tab-btn");
  const tabPanels = root.querySelectorAll(".tab-panel");

  // Track which post tabs have been loaded (lazy)
  const postsLoaded = { historia: false, nota: false };

  tabBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      tabPanels.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      root.querySelector(`[data-panel="${btn.dataset.tab}"]`).classList.add("active");

      const tabIdx = btn.dataset.tab;

      // Lazy-load História (tab 1)
      if (tabIdx === "1" && !postsLoaded.historia) {
        postsLoaded.historia = true;
        const c = root.querySelector("#posts-historia-container");
        if (c) await renderPostsTab(c, pagina, "historia");
      }
      // Lazy-load Notas (tab 5)
      if (tabIdx === "5" && !postsLoaded.nota) {
        postsLoaded.nota = true;
        const c = root.querySelector("#posts-notas-container");
        if (c) await renderPostsTab(c, pagina, "nota");
      }
    });
  });

  // ── Render relations ───────────────────────────────────────
  await renderTodasRelacoes(root, pagina);

  // ── Voltar ─────────────────────────────────────────────────
  root.querySelector("#voltar").addEventListener("click", () => navigate("/"));

  // ── Editar / Salvar ────────────────────────────────────────
  const btnEditar = root.querySelector("#btn-editar");
  const btnExcluir = root.querySelector("#btn-excluir");

  if (btnEditar) {
    btnEditar.addEventListener("click", async () => {
      // ... (logic remains same, just inside if)
      const editando = btnEditar.textContent.trim() === "Salvar";

      if (!editando) {
        setPageMode(root, true);
        btnEditar.innerHTML = `<i data-lucide="save" style="width:16px; height:16px;"></i> <span>Salvar</span>`;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      // ── Build payload ──────────────────────────────────────
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

      const ent = getEntidade(pagina);
      const fields = SCHEMAS[ent] || [];
      for (const f of fields) {
        const el = root.querySelector(`#campo-${f.key}`);
        if (!el) continue;
        let v = el.value;
        if (v && typeof v === "object") v = "";
        if (typeof v === "string") v = v.trim();
        if (f.type === "number") v = v === "" ? null : Number(v);
        if (ent === "personagem" && f.key === "tipo") {
          payload.classe = String(v || "").trim();
        } else {
          payload[f.key] = typeof v === "string" ? v.trim() : v;
        }
      }

      try {
        await api.editarPagina(id, payload);

        // ── Feedback Toast ────────────────────────────────
        const feedback = root.querySelector("#save-feedback");
        if (feedback) {
          feedback.classList.add("show");
          setTimeout(() => feedback.classList.remove("show"), 3000);
        }

        setPageMode(root, false);
        btnEditar.innerHTML = `<i data-lucide="edit-3" style="width:16px; height:16px;"></i> <span>Editar Registro</span>`;
        if (window.lucide) window.lucide.createIcons();

        // ── Update View UI (Refresh the "dossie" mode without reload) ──
        Object.assign(pagina, payload);

        const viewAutor = root.querySelector("#view-autor");
        if (viewAutor) viewAutor.textContent = pagina.autor || "Desconhecido";

        const viewTags = root.querySelector("#view-tags");
        if (viewTags) viewTags.innerHTML = (pagina.tags || []).map(t => `<span class="badge-tag">${escapeHtml(t)}</span>`).join("");

        const imgLink = root.querySelector("#view-imagem-link");
        if (imgLink) {
          if (pagina.imagem) {
            imgLink.href = pagina.imagem;
            imgLink.parentElement.style.display = "flex";
          } else {
            imgLink.parentElement.style.display = "none";
          }
        }

        // Update specific fields view
        const splitView = renderCamposEspecificosView(pagina);
        const longView = root.querySelector("#specific-fields-long-view");
        const infoView = root.querySelector("#specific-fields-info-view");
        if (longView) longView.innerHTML = splitView.longCardsHtml;
        if (infoView) infoView.innerHTML = splitView.infoCardHtml;
        const heroTitulo = root.querySelector("#hero-titulo");
        if (heroTitulo) heroTitulo.textContent = payload.titulo;

        const heroAutor = root.querySelector("#hero-autor");
        if (heroAutor) heroAutor.textContent = payload.autor ? `por ${payload.autor}` : "";

        const heroTags = root.querySelector("#hero-tags");
        if (heroTags) heroTags.innerHTML = tags.map(t => `<span class="entity-tag-badge">${escapeHtml(t)}</span>`).join("");

        // ── Update image in hero ───────────────────────────
        const imgDisplay = root.querySelector("#preview-display");
        const imgWrap = root.querySelector(".entity-hero-img-wrap");
        if (novaImagem) {
          if (imgDisplay) {
            imgDisplay.src = novaImagem;
          } else if (imgWrap) {
            imgWrap.innerHTML = `<img id="preview-display" class="entity-hero-img" src="${escapeHtml(novaImagem)}" />`;
          }
        } else {
          if (imgDisplay && imgWrap) {
            imgWrap.innerHTML = `<span id="preview-display-placeholder" style="color:var(--text-muted);font-size:12px;text-transform:uppercase;letter-spacing:2px;text-align:center;padding:8px;">Sem Imagem</span>`;
          }
        }

        alert("Salvo!");
      } catch (e) {
        alert("Erro ao salvar: " + e.message);
      }
    });
  }

  // ── Excluir ────────────────────────────────────────────────
  if (btnExcluir) {
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
}
// Compat: alguns lugares ainda chamam renderCamposEspecificos(pagina)
function renderCamposEspecificos(pagina) {
  // Se o patch criou a versão edit, usa ela
  if (typeof renderCamposEspecificosEdit === "function") {
    return renderCamposEspecificosEdit(pagina);
  }
  // Se só existe a view, usa ela (não ideal, mas evita crash)
  if (typeof renderCamposEspecificosView === "function") {
    return renderCamposEspecificosView(pagina);
  }
  // fallback seguro
  return "";
}
// ─────────────────────────────────────────────────────────────
//  Relations — split into Conexões / Itens / Eventos
// ─────────────────────────────────────────────────────────────

async function renderTodasRelacoes(root, pagina) {
  // Loading state
  ["#rel-conexoes", "#rel-itens", "#rel-eventos"].forEach(sel => {
    const el = root.querySelector(sel);
    if (el) el.innerHTML = `<p style="color:var(--text-muted);padding:16px;">Carregando elos...</p>`;
  });

  // Single fetch for all panels
  let rel = null;
  try { rel = await api.getRelations(pagina.id); } catch (e) { rel = null; }

  // Normalise
  const todasRelacoes = [];
  if (rel) {
    const rawGroups = Array.isArray(rel) ? rel : (rel.groups || []);
    for (const g of rawGroups) {
      for (const it of (g.items || [])) {
        todasRelacoes.push({
          relacao_id: it.relacao_id,
          tipo_relacao: g.label,
          id: it.id ?? it.page_id ?? it.target_id ?? it.pagina_id ?? it.relacionado_id,
          titulo: it.titulo ?? it.nome ?? it.target_titulo ?? it.pagina_titulo ?? "",
          entidade: (it.entidade ?? it.tipo ?? it.target_entidade ?? "").toLowerCase?.() ?? "",
          extra: it.extra ?? it.cargo ?? it.role ?? it.rotulo ?? ""
        });
      }
    }
  }

  const entidadeAtual = getEntidade(pagina);
  const permitidas = RELATION_RULES[entidadeAtual] || [];
  const conexoesTipos = permitidas.filter(t => t !== "item" && t !== "evento");
  const itensTipos = permitidas.filter(t => t === "item");
  const eventosTipos = permitidas.filter(t => t === "evento");

  renderRelacoesPainel(root, pagina, conexoesTipos, todasRelacoes, "#rel-conexoes");
  renderRelacoesPainel(root, pagina, itensTipos, todasRelacoes, "#rel-itens");
  renderRelacoesPainel(root, pagina, eventosTipos, todasRelacoes, "#rel-eventos");

  renderArquivosTab(root, pagina);
}

async function renderArquivosTab(root, pagina) {
  const grid = root.querySelector("#entity-files-grid");
  if (!grid) return;

  try {
    const files = await api.listarArquivos({ page_id: pagina.id });
    if (!files.length) {
      grid.innerHTML = `<div class="rel-empty" style="grid-column: 1/-1;">Nenhum arquivo vinculado a esta entidade.</div>`;
    } else {
      grid.innerHTML = files.map(f => `
        <a href="/files/${f.id}" data-link class="file-card">
          <div class="file-card-preview">
            ${f.file_kind === 'image'
          ? `<img src="/api/files/${f.id}/view" />`
          : `<i data-lucide="file-text" style="width:32px; height:32px;"></i>`
        }
          </div>
          <div class="file-card-body">
            <div class="file-card-title">${escapeHtml(f.title)}</div>
            <div class="file-card-meta">
              <span>${f.file_kind?.toUpperCase()}</span>
            </div>
          </div>
        </a>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons();

    // Autocomplete logic for linking files
    const searchInput = root.querySelector("#input-search-files-to-link");
    const sugBox = root.querySelector("#file-sugestoes");
    let seq = 0;

    if (searchInput) {
      searchInput.oninput = async () => {
        const q = searchInput.value.trim();
        if (!q) { sugBox.innerHTML = ""; sugBox.style.display = "none"; return; }
        const mySeq = ++seq;
        const results = await api.listarArquivos({ q }); // Using listarArquivos to search global files
        if (mySeq !== seq) return;

        if (!results.length) {
          sugBox.innerHTML = `<div style="padding:8px; color:var(--text-muted); font-size:12px;">Nenhum arquivo encontrado.</div>`;
        } else {
          sugBox.innerHTML = results.map(f => `
            <div class="sug-item" data-id="${f.id}" style="padding:8px; cursor:pointer; border-bottom:1px solid var(--bg-surface-alt); font-size:12px; display:flex; gap:8px; align-items:center;">
              <div style="width:24px; height:24px; background:var(--bg-app); display:flex; align-items:center; justify-content:center; border-radius:4px;">
                ${f.file_kind === 'image' ? `<img src="/api/files/${f.id}/view" style="width:100%; height:100%; object-fit:cover; border-radius:4px;"/>` : `<i data-lucide="file-text" style="width:14px;"></i>`}
              </div>
              <span>${escapeHtml(f.title)}</span>
            </div>
          `).join('');
          if (window.lucide) window.lucide.createIcons();
        }
        sugBox.style.display = "block";
      };

      sugBox.onclick = async (e) => {
        const item = e.target.closest(".sug-item");
        if (!item) return;
        const fileId = item.dataset.id;
        const res = await api.vincularArquivo(fileId, pagina.id);
        if (res.ok) {
          searchInput.value = "";
          sugBox.style.display = "none";
          renderArquivosTab(root, pagina);
        } else {
          alert("Erro: " + res.erro);
        }
      };

      document.addEventListener("click", (e) => {
        if (!searchInput.contains(e.target) && !sugBox.contains(e.target)) {
          sugBox.style.display = "none";
        }
      });
    }
  } catch (e) {
    grid.innerHTML = `<div class="rel-empty" style="grid-column: 1/-1;">Erro ao carregar arquivos.</div>`;
  }
}

function renderRelacoesPainel(root, pagina, tipos, todasRelacoes, containerId) {
  const box = root.querySelector(containerId);
  if (!box) return;

  if (!tipos.length) {
    box.innerHTML = `<div class="rel-empty">Esta entidade não possui propriedades indexadas para esta categoria.</div>`;
    return;
  }

  const iconsMapa = {
    personagem: "user", local: "map-pin",
    organizacao: "landmark", item: "package",
    evento: "calendar", criatura: "dino"
  };

  const labelsMapa = {
    personagem: "Personagens", local: "Locais",
    organizacao: "Organizações", item: "Itens / Artefatos",
    evento: "Eventos", criatura: "Criaturas"
  };

  let html = "";

  tipos.forEach(alvoTipo => {
    const rels = todasRelacoes.filter(r => r.entidade === alvoTipo);
    const title = labelsMapa[alvoTipo] || alvoTipo.toUpperCase();
    const icon = iconsMapa[alvoTipo] || "link";

    html += `
      <div class="rel-section" style="margin-bottom:48px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:24px; border-bottom:1px solid var(--bg-surface-alt); padding-bottom:12px;">
          <div style="background:var(--bg-surface-alt); padding:8px; border-radius:8px; display:flex; align-items:center;">
             <i data-lucide="${icon}" style="width:18px; height:18px; color:var(--brand-accent);"></i>
          </div>
          <h3 class="title-paranormal" style="margin:0; font-size:16px; letter-spacing:2px; flex:1;">${title}</h3>
          <span style="font-family:monospace; background:var(--bg-surface-alt); color:var(--text-muted); padding:2px 10px; border-radius:12px; font-size:12px;">${rels.length}</span>
        </div>

        ${rels.length > 0
        ? `<div class="rel-grid">` +
        rels.map(it => `
              <div class="rel-card">
                ${(it.relacao_id && state.canWrite()) ? `
                  <button class="rel-card-remove btn-remover-relacao" data-relacao="${it.relacao_id}" title="Remover Elo">
                    <i data-lucide="x" style="width:14px; height:14px;"></i>
                  </button>
                ` : ""}

                ${it.imagem
            ? `<img src="${escapeHtml(it.imagem)}" class="rel-card-img" />`
            : `<div class="rel-card-no-img"><i data-lucide="image" style="width:24px; height:24px; opacity:0.3;"></i></div>`
          }
                
                <span class="rel-card-badge">${escapeHtml(it.tipo_relacao)}</span>
                
                <div class="rel-card-body">
                  <a href="javascript:void(0)" class="rel-card-title btn-ir-pagina" data-id="${it.id}">
                    ${escapeHtml(it.titulo)}
                  </a>
                  <div class="rel-card-sub">
                    ID #${it.id} ${it.extra ? `• <span style="font-style:italic;">"${escapeHtml(it.extra)}"</span>` : ""}
                  </div>
                </div>
              </div>
            `).join("") + `</div>`
        : `
            <div class="rel-empty" style="margin-bottom:24px;">
              <i data-lucide="ghost" style="width:32px; height:32px; margin-bottom:12px; opacity:0.2; display:block; margin-left:auto; margin-right:auto;"></i>
              Nenhum(a) ${alvoTipo} vinculado(a) no momento.
            </div>
          `
      }

        <!-- Add Relationship Toggle -->
        ${state.canWrite() ? `
          <div class="rel-add-container">
            <button class="btn-add-rel-toggle" onclick="this.nextElementSibling.style.display = 'grid'; this.style.display = 'none';">
              <i data-lucide="plus" style="width:18px; height:18px;"></i>
              Adicionar Relação com ${itTitle(alvoTipo)}
            </button>
            <div class="rel-add-form" style="display:none;">
              <label class="editor-label">Buscar Entidade
                <input type="text" class="input-limiar input-busca-estruturada" data-alvo="${alvoTipo}" placeholder="Nome ou fragmento..." autocomplete="off" />
                <input type="hidden" class="input-destino-id" />
                <div class="sugestoes-box" style="position:absolute;top:100%;left:0;right:0;background:var(--bg-surface);border:1px solid var(--bg-surface-alt);max-height:150px;overflow:auto;z-index:100;display:none;box-shadow:var(--shadow-base);border-radius:var(--radius-md);"></div>
              </label>
              
              <label class="editor-label">Tipo (Lógico)
                <input type="text" class="input-limiar input-tipo-relacao" placeholder="ex: aliado_de" />
              </label>

              <label class="editor-label">Rótulo (Display)
                <input type="text" class="input-limiar input-rotulo" placeholder="ex: Líder Oculto" />
              </label>

              <button class="btn-limiar btn-primary btn-add-estruturado btn-xl">Vincular</button>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  });

  box.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();

  function itTitle(tipo) {
    return labelsMapa[tipo] || tipo;
  }

  // ── Delegated events ───────────────────────────────────────
  box.onclick = async (ev) => {
    const btnAbrir = ev.target.closest(".btn-ir-pagina");
    if (btnAbrir) {
      const tid = Number(btnAbrir.dataset.id);
      if (tid) navigate(`/entity/${tid}`);
      return;
    }

    const btnRemover = ev.target.closest(".btn-remover-relacao");
    if (btnRemover) {
      const relacaoId = Number(btnRemover.dataset.relacao);
      if (!relacaoId) return;
      if (!confirm("Tem certeza que deseja remover esta relação?")) return;
      try {
        await api.deletarRelacao(relacaoId);
        await renderTodasRelacoes(root, pagina);
      } catch (e) {
        alert("Erro ao remover relação: " + e.message);
      }
      return;
    }

    const btnAdd = ev.target.closest(".btn-add-estruturado");
    if (btnAdd) {
      const wrapper = btnAdd.parentElement;
      const destinoId = Number(wrapper.querySelector(".input-destino-id").value);
      const tipoStr = wrapper.querySelector(".input-tipo-relacao").value.trim() || "relacionado_a";
      const rotulo = wrapper.querySelector(".input-rotulo").value.trim();
      if (!destinoId) { alert("Selecione um destino primeiro através do campo de busca."); return; }
      try {
        await api.criarRelacao({
          origem_page_id: pagina.id,
          destino_page_id: destinoId,
          tipo_relacao: tipoStr,
          rotulo: rotulo || null
        });
        await renderTodasRelacoes(root, pagina);
      } catch (e) {
        alert("Erro ao criar relação: " + e.message);
      }
    }
  };

  // ── Autocomplete ───────────────────────────────────────────
  box.querySelectorAll(".input-busca-estruturada").forEach(input => {
    const wrapper = input.parentElement;
    const sugestoesBox = wrapper.querySelector(".sugestoes-box");
    const destinoIdInput = wrapper.querySelector(".input-destino-id");
    const alvo = input.dataset.alvo;
    let seq = 0;

    input.oninput = async () => {
      const termo = input.value.trim();
      if (!termo) { sugestoesBox.innerHTML = ""; sugestoesBox.style.display = "none"; return; }
      const my = ++seq;
      try {
        const resultados = await api.buscarPages({ entidade: alvo, q: termo });
        if (my !== seq) return;
        if (!resultados.length) {
          sugestoesBox.innerHTML = `<div style="padding:8px;color:#999;font-size:12px;">Nenhum encontrado</div>`;
          sugestoesBox.style.display = "block";
          return;
        }
        sugestoesBox.innerHTML = resultados
          .filter(r => r.id !== pagina.id)
          .map(r => `<div class="sug-item" data-id="${r.id}" data-titulo="${escapeHtml(r.titulo)}" style="padding:8px;cursor:pointer;border-bottom:1px solid var(--bg-surface-alt);font-size:13px;"><strong>#${r.id}</strong> ${escapeHtml(r.titulo)}</div>`)
          .join("");
        sugestoesBox.style.display = "block";
      } catch (e) { console.error(e); }
    };

    sugestoesBox.onclick = (e) => {
      e.stopPropagation(); // Evita que o clique feche a box antes do tempo
      const item = e.target.closest(".sug-item");
      if (!item) return;
      destinoIdInput.value = item.dataset.id;
      input.value = `[Selecionado] ${item.dataset.titulo}`;
      sugestoesBox.innerHTML = "";
      sugestoesBox.style.display = "none";
    };

    document.addEventListener("click", (e) => {
      if (sugestoesBox && !wrapper.contains(e.target)) sugestoesBox.style.display = "none";
    });
  });
}

// Kept for internal backward-compat (called by legacy autocomplete helpers)
async function renderRelacionamentos(root, pagina) {
  await renderTodasRelacoes(root, pagina);
}

// ─────────────────────────────────────────────────────────────
//  Field rendering helpers (unchanged)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  Field rendering helpers
// ─────────────────────────────────────────────────────────────

function renderCamposEspecificosView(pagina) {
  const entidade = getEntidade(pagina);
  const fields = SCHEMAS[entidade] || [];
  if (!fields.length) return { longCardsHtml: "", infoCardHtml: "" };

  const compactFields = fields.filter(f => f.type !== "textarea");
  const longFields = fields.filter(f => f.type === "textarea");

  // Ordem de campos prioritários para a coluna de Informações
  const priorityOrder = ["idade", "aniversario", "genero", "status_vida", "status_local", "status_org", "status", "tipo"];
  compactFields.sort((a, b) => {
    let idxA = priorityOrder.indexOf(a.key);
    let idxB = priorityOrder.indexOf(b.key);
    if (idxA === -1) idxA = 99;
    if (idxB === -1) idxB = 99;
    return idxA - idxB;
  });

  const longCardsHtml = longFields.map(f => {
    const val = pagina[f.key] ?? (f.alias ? pagina[f.alias] : undefined) ?? "";
    if (!val) return "";
    return `
      <div class="dossie-card">
        <h4 class="dossie-card-title">${escapeHtml(f.label)}</h4>
        <div class="field-block-content">${escapeHtml(val)}</div>
      </div>
    `;
  }).join("");

  const infoCardHtml = compactFields.map(f => {
    const val = pagina[f.key] ?? (f.alias ? pagina[f.alias] : undefined) ?? "—";
    return `
      <div class="info-item">
        <span class="info-label">${escapeHtml(f.label)}:</span>
        <span class="info-value">${escapeHtml(val)}</span>
      </div>
    `;
  }).join("");

  return { longCardsHtml, infoCardHtml };
}

function renderCamposEspecificosEdit(pagina) {
  const entidade = getEntidade(pagina);
  const fields = SCHEMAS[entidade] || [];
  if (!fields.length) return "";

  return fields.map(f => {
    const id = `campo-${f.key}`;
    const rawVal = pagina[f.key] ?? (f.alias ? pagina[f.alias] : undefined) ?? "";
    const val = escapeHtml(rawVal);

    if (f.type === "select") {
      const opts = (f.options || []).map(o => {
        const selected = String(rawVal).toLowerCase() === o ? "selected" : "";
        return `<option value="${o}" ${selected}>${o}</option>`;
      }).join("");
      return `
        <label class="editor-label">${f.label}
          <select id="${id}" class="input-limiar campo-editavel" disabled>${opts}</select>
        </label>`;
    }

    if (f.type === "textarea") {
      return `
        <label class="editor-label" style="grid-column: span 2;">${f.label}
          <textarea id="${id}" class="input-limiar campo-editavel" readonly style="min-height:120px; resize:vertical;">${val}</textarea>
        </label>`;
    }

    const inputType = f.type || "text";
    return `
      <label class="editor-label">${f.label}
        <input id="${id}" type="${inputType}" class="input-limiar campo-editavel" readonly value="${val}" />
      </label>`;
  }).join("");
}

function getEntidade(pagina) {
  return (pagina.entidade || pagina.tipo || "").toLowerCase().trim();
}

function setPageMode(root, isEditing) {
  const container = root.querySelector(".entity-details-container");
  if (container) {
    if (isEditing) container.classList.add("is-editing");
    else container.classList.remove("is-editing");
  }

  const campos = root.querySelectorAll(".campo-editavel");
  campos.forEach(c => {
    if (c.tagName === "SELECT") {
      if (isEditing) c.removeAttribute("disabled");
      else c.setAttribute("disabled", true);
    } else {
      if (isEditing) c.removeAttribute("readonly");
      else c.setAttribute("readonly", true);
    }
  });
}

// Legacy helpers (not called from current flow, kept for safety)
function setupAutocompleteMembros(box, root, pagina) {
  const input = box.querySelector("#membro-busca");
  const sugestoesBox = box.querySelector("#membro-sugestoes");
  if (!input || !sugestoesBox) return;
  let seq = 0;
  input.oninput = async () => {
    const termo = input.value.trim();
    if (!termo) { sugestoesBox.innerHTML = ""; return; }
    const my = ++seq;
    try {
      const resultados = await api.buscarPages({ entidade: "personagem", q: termo });
      if (my !== seq) return;
      sugestoesBox.innerHTML = resultados
        .map(p => `<div class="sug-item" data-personagem-id="${p.id}" style="padding:6px;cursor:pointer;">${escapeHtml(p.titulo)}</div>`)
        .join("");
    } catch (e) { console.error(e); }
  };
  sugestoesBox.onclick = async (ev) => {
    const item = ev.target.closest(".sug-item");
    if (!item) return;
    const personagemId = Number(item.dataset.personagemId);
    if (!personagemId) return;
    try {
      await api.vincularOrganizacao(personagemId, { organizacao_id: pagina.id });
      await renderTodasRelacoes(root, pagina);
    } catch (e) { alert("Erro ao adicionar membro: " + e.message); }
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
    if (!termo) { sugestoesBox.innerHTML = ""; return; }
    const my = ++seq;
    try {
      const resultados = await api.buscarPages({ entidade: "organizacao", q: termo });
      if (my !== seq) return;
      sugestoesBox.innerHTML = resultados
        .filter(o => !linkedIds.has(Number(o.id)))
        .map(o => `<div class="sug-item" data-org-id="${o.id}" style="padding:6px;cursor:pointer;">${escapeHtml(o.titulo)}</div>`)
        .join("");
    } catch (e) { console.error(e); }
  };
  sugestoesBox.onclick = async (ev) => {
    const item = ev.target.closest(".sug-item");
    if (!item) return;
    const orgId = Number(item.dataset.orgId);
    if (!orgId) return;
    try {
      await api.vincularOrganizacao(pagina.id, { organizacao_id: orgId });
      await renderTodasRelacoes(root, pagina);
    } catch (e) { alert("Erro ao adicionar organização: " + e.message); }
  };
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}