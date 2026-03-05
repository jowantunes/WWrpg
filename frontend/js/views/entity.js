import { api } from "../api.js";
import { navigate } from "../app.js";
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
    <div class="entity-hero dark-surface">
      <div class="entity-hero-img-wrap">
        ${pagina.imagem
      ? `<img id="preview-display" class="entity-hero-img" src="${escapeHtml(pagina.imagem)}" />`
      : `<span id="preview-display-placeholder" style="color:var(--text-muted);font-size:12px;text-transform:uppercase;letter-spacing:2px;text-align:center;padding:8px;">Sem Imagem</span>`
    }
      </div>
      <div class="entity-hero-info">
        <div>
          <h2 class="entity-hero-title" id="hero-titulo">${escapeHtml(pagina.titulo || "")}</h2>
          <span style="font-size:11px;color:var(--text-muted);">ID: ${pagina.id}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <span class="entity-type-badge">${escapeHtml(entidade || "entidade")}</span>
          <span id="hero-autor" style="color:var(--text-muted);font-size:13px;">${pagina.autor ? "por " + escapeHtml(pagina.autor) : ""}</span>
        </div>
        <div class="entity-tags" id="hero-tags">
          ${(pagina.tags || []).map(t => `<span class="entity-tag-badge">${escapeHtml(t)}</span>`).join("")}
        </div>
        <div class="entity-hero-actions">
          <button id="btn-editar" class="btn-limiar">Editar Registro</button>
          <button id="btn-excluir" class="btn-limiar btn-danger">Exterminar</button>
        </div>
      </div>
    </div>

    <!-- TAB BAR -->
    <div class="tab-bar">
      <button class="tab-btn active" data-tab="0">📋 Visão Geral</button>
      <button class="tab-btn" data-tab="1">📖 História</button>
      <button class="tab-btn" data-tab="2">🕸️ Conexões</button>
      <button class="tab-btn" data-tab="3">🗡️ Itens</button>
      <button class="tab-btn" data-tab="4">📅 Eventos</button>
      <button class="tab-btn" data-tab="5">📝 Notas</button>
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

        <!-- EDIT MODE (Organized Grid) -->
        <div class="details-edit dark-surface" style="padding:24px;border-radius:var(--radius-lg);display:grid;gap:20px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <label style="color:var(--text-muted);font-size:12px;text-transform:uppercase;">Identificação (Título)<br/>
              <input id="campo-titulo" class="input-limiar campo-editavel" readonly value="${escapeHtml(pagina.titulo || "")}" style="width:100%;" />
            </label>
            <label style="color:var(--text-muted);font-size:12px;text-transform:uppercase;">URL Referência Visual<br/>
              <input id="campo-imagem" class="input-limiar campo-editavel" readonly value="${escapeHtml(pagina.imagem || "")}" placeholder="URL ou deixe em branco" style="width:100%;" />
            </label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <label style="color:var(--text-muted);font-size:12px;text-transform:uppercase;">Autor do Dossiê<br/>
              <input id="campo-autor" class="input-limiar campo-editavel" readonly value="${escapeHtml(pagina.autor || "")}" style="width:100%;" />
            </label>
            <label style="color:var(--text-muted);font-size:12px;text-transform:uppercase;">Tags Indexadoras<br/>
              <input id="campo-tags" class="input-limiar campo-editavel" readonly value="${escapeHtml(tagsText)}" placeholder="tag1, tag2..." style="width:100%;" />
            </label>
          </div>
          <div id="specific-fields-edit" style="margin-top:8px;border-top:1px dashed var(--bg-surface-alt);padding-top:16px;">
            <h4 class="title-paranormal" style="margin-top:0;font-size:14px;color:var(--text-muted);">Variáveis Específicas</h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:16px;">${renderCamposEspecificosEdit(pagina)}</div>
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
  const campos = root.querySelectorAll(".campo-editavel");

  btnEditar.addEventListener("click", async () => {
    const editando = btnEditar.textContent.trim() === "Salvar";

    if (!editando) {
      setPageMode(root, true);
      btnEditar.textContent = "Salvar";
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
      setPageMode(root, false);
      btnEditar.textContent = "Editar Registro";

      // ── Update View UI (Refresh the "dossie" mode without reload) ──
      // Merge payload into local pagina object for consistency
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

  // ── Excluir ────────────────────────────────────────────────
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
}

function renderRelacoesPainel(root, pagina, tipos, todasRelacoes, containerId) {
  const box = root.querySelector(containerId);
  if (!box) return;

  if (!tipos.length) {
    box.innerHTML = `<p style="color:var(--text-muted);font-style:italic;padding:16px;">Esta entidade não tem vínculos nesta categoria.</p>`;
    return;
  }

  const labelsMapa = {
    personagem: "Personagens Relacionados", local: "Locais Relacionados",
    organizacao: "Organizações Envolvidas", item: "Itens Portados / Relacionados",
    evento: "Eventos Históricos", criatura: "Criaturas Vinculadas"
  };

  let html = "";
  tipos.forEach(alvoTipo => {
    const rels = todasRelacoes.filter(r => r.entidade === alvoTipo);
    const title = labelsMapa[alvoTipo] || alvoTipo.toUpperCase();

    html += `
      <div class="dark-surface" style="margin-bottom:24px;border-radius:var(--radius-lg);overflow:hidden;">
        <div style="background:var(--bg-app);padding:12px 16px;border-bottom:1px solid var(--bg-surface-alt);display:flex;justify-content:space-between;align-items:center;">
          <h4 class="title-paranormal" style="margin:0;font-size:14px;color:var(--text-muted);">${title}</h4>
          <span style="background:var(--brand-danger);color:white;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold;">${rels.length}</span>
        </div>
        <div style="padding:16px;">
          ${rels.length > 0
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:16px;">` +
        rels.map(it => `
                <div class="card-noir" style="display:flex;justify-content:space-between;align-items:flex-start;padding:12px;">
                  <div style="flex-grow:1;min-width:0;">
                    <div style="margin-bottom:4px;">
                      <span style="font-size:10px;padding:2px 6px;background:var(--bg-app);border:1px solid var(--brand-accent);color:var(--brand-accent);border-radius:4px;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(it.tipo_relacao)}</span>
                    </div>
                    <a href="javascript:void(0)" class="btn-ir-pagina" data-id="${it.id}" style="text-decoration:none;color:var(--text-main);font-weight:600;font-size:15px;display:block;margin-bottom:2px;">#${it.id} ${escapeHtml(it.titulo)}</a>
                    ${it.extra ? `<div style="font-size:12px;color:var(--text-muted);font-style:italic;">"${escapeHtml(it.extra)}"</div>` : ""}
                  </div>
                  ${it.relacao_id ? `<button class="btn-remover-relacao btn-ghost" data-relacao="${it.relacao_id}" style="padding:4px;margin-left:8px;color:var(--text-muted);" title="Cortar Conexão">✕</button>` : ""}
                </div>
              `).join("") + `</div>`
        : `<p style="font-size:13px;color:var(--text-muted);font-style:italic;margin-bottom:16px;">Nenhum nó de rede correspondente a ${alvoTipo}.</p>`
      }
          <!-- Adicionar elo -->
          <div style="background:var(--bg-app);border:1px solid var(--bg-surface-alt);padding:12px;border-radius:var(--radius-md);display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
            <label style="flex-grow:1;min-width:180px;position:relative;color:var(--text-muted);font-size:11px;text-transform:uppercase;">
              Vincular Novo(a)
              <input type="text" class="input-limiar input-busca-estruturada" data-alvo="${alvoTipo}" placeholder="Buscar ${alvoTipo}..." autocomplete="off" style="width:100%;display:block;margin-top:4px;" />
              <input type="hidden" class="input-destino-id" />
              <div class="sugestoes-box" style="position:absolute;top:100%;left:0;right:0;background:var(--bg-surface);border:1px solid var(--bg-surface-alt);max-height:150px;overflow:auto;z-index:10;display:none;box-shadow:var(--shadow-base);border-radius:var(--radius-md);margin-top:4px;"></div>
            </label>
            <label style="width:130px;color:var(--text-muted);font-size:11px;text-transform:uppercase;">
              Relação (Lógico)
              <input type="text" class="input-limiar input-tipo-relacao" placeholder="ex: aliado_de" style="width:100%;display:block;margin-top:4px;" />
            </label>
            <label style="width:130px;color:var(--text-muted);font-size:11px;text-transform:uppercase;">
              Rótulo (Display)
              <input type="text" class="input-limiar input-rotulo" placeholder="ex: Líder Oculto" style="width:100%;display:block;margin-top:4px;" />
            </label>
            <button class="btn-limiar btn-primary btn-add-estruturado" style="padding:10px 16px;">Adicionar Elo</button>
          </div>
        </div>
      </div>
    `;
  });

  box.innerHTML = html;

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
        <label style="color:var(--text-muted);font-size:12px;text-transform:uppercase;">${f.label}<br/>
          <select id="${id}" class="input-limiar campo-editavel" disabled style="width:100%;">${opts}</select>
        </label>`;
    }

    if (f.type === "textarea") {
      return `
        <label style="color:var(--text-muted);font-size:12px;text-transform:uppercase;">${f.label}<br/>
          <textarea id="${id}" class="input-limiar campo-editavel" readonly style="width:100%;min-height:80px;">${val}</textarea>
        </label>`;
    }

    const inputType = f.type || "text";
    return `
      <label style="color:var(--text-muted);font-size:12px;text-transform:uppercase;">${f.label}<br/>
        <input id="${id}" type="${inputType}" class="input-limiar campo-editavel" readonly value="${val}" style="width:100%;" />
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