import { api } from "../api.js";
import { navigate } from "../app.js";

// ─────────────────────────────────────────────────────────────
//  Public entry point
// ─────────────────────────────────────────────────────────────

/**
 * Render the posts tab for a given page/tipo.
 * @param {HTMLElement} container  - The tab-panel div to render into
 * @param {Object}      pagina     - The current page object (needs .id)
 * @param {'historia'|'nota'} tipo
 */
export async function renderPostsTab(container, pagina, tipo) {
    container.innerHTML = `<p style="color:var(--text-muted);padding:16px;">Carregando posts...</p>`;
    await _refreshList(container, pagina, tipo);
}

// ─────────────────────────────────────────────────────────────
//  List rendering
// ─────────────────────────────────────────────────────────────

async function _refreshList(container, pagina, tipo) {
    let posts = [];
    try {
        posts = await api.listarPosts(pagina.id, tipo);
    } catch (e) {
        container.innerHTML = `<p style="color:var(--text-muted);padding:16px;">Erro ao carregar posts: ${e.message}</p>`;
        return;
    }

    const tipoLabel = tipo === "historia" ? "História" : "Nota";
    const tipoIcon = tipo === "historia" ? "📖" : "📝";

    container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <h4 class="title-paranormal" style="margin:0;font-size:14px;color:var(--text-muted);">${tipoIcon} ${tipoLabel.toUpperCase()}</h4>
      <button class="btn-limiar btn-primary btn-novo-post" style="font-size:13px;">+ Novo Post</button>
    </div>
    <div class="posts-list">
      ${posts.length === 0
            ? `<div class="tab-placeholder" style="padding:32px 0;">
             <p>Nenhum post de ${tipoLabel.toLowerCase()} ainda. Clique em "Novo Post" para começar.</p>
           </div>`
            : posts.map((p, idx) => _renderPostCard(p, idx, posts.length)).join("")
        }
    </div>
  `;

    // ── New post button
    container.querySelector(".btn-novo-post").addEventListener("click", () => {
        _openEditor(container, pagina, tipo, null, () => _refreshList(container, pagina, tipo));
    });

    // ── Delegated events for cards
    container.querySelector(".posts-list").addEventListener("click", async (ev) => {
        // Navigate mention links
        const mention = ev.target.closest(".mention");
        if (mention) {
            ev.preventDefault();
            const mid = mention.dataset.id;
            if (mid) navigate(`/entity/${mid}`);
            return;
        }

        const postId = Number(ev.target.closest("[data-post-id]")?.dataset.postId);
        if (!postId) return;

        if (ev.target.closest(".btn-edit-post")) {
            const post = posts.find(p => p.id === postId);
            if (post) _openEditor(container, pagina, tipo, post, () => _refreshList(container, pagina, tipo));
            return;
        }

        if (ev.target.closest(".btn-delete-post")) {
            if (!confirm("Excluir este post?")) return;
            try {
                await api.excluirPost(postId);
                await _refreshList(container, pagina, tipo);
            } catch (e) {
                alert("Erro ao excluir: " + e.message);
            }
            return;
        }

        if (ev.target.closest(".btn-up-post")) {
            try {
                await api.reordenarPost(postId, "up");
                await _refreshList(container, pagina, tipo);
            } catch (e) {
                alert("Erro ao reordenar: " + e.message);
            }
            return;
        }

        if (ev.target.closest(".btn-down-post")) {
            try {
                await api.reordenarPost(postId, "down");
                await _refreshList(container, pagina, tipo);
            } catch (e) {
                alert("Erro ao reordenar: " + e.message);
            }
            return;
        }
    });
}

function _renderPostCard(post, idx, total) {
    const dataFmt = post.criado_em
        ? new Date(post.criado_em.replace(" ", "T") + "Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
        : "";

    const isFirst = idx === 0;
    const isLast = idx === total - 1;

    return `
    <div class="post-card" data-post-id="${post.id}">
      <div class="post-card-header">
        <div style="flex:1;min-width:0;">
          ${post.titulo
            ? `<div class="post-card-title">${_escHtml(post.titulo)}</div>`
            : `<div class="post-card-title" style="color:var(--text-muted);font-style:italic;">Sem título</div>`
        }
          <div class="post-card-meta">${dataFmt}</div>
        </div>
        <div class="post-card-actions">
          <button class="btn-ghost btn-up-post post-order-btn" title="Mover para cima" ${isFirst ? "disabled" : ""}>↑</button>
          <button class="btn-ghost btn-down-post post-order-btn" title="Mover para baixo" ${isLast ? "disabled" : ""}>↓</button>
          <button class="btn-ghost btn-edit-post" title="Editar">✏️</button>
          <button class="btn-ghost btn-delete-post" style="color:var(--text-muted);" title="Excluir">🗑</button>
        </div>
      </div>
      <div class="post-card-body post-rendered-content">
        ${post.conteudo_html || "<em style='color:var(--text-muted)'>Sem conteúdo.</em>"}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
//  Editor modal
// ─────────────────────────────────────────────────────────────

function _openEditor(container, pagina, tipo, postExistente, onSaved) {
    // Remove any stale overlay
    document.getElementById("post-modal-overlay")?.remove();

    const isEdit = !!postExistente;
    const tipoLabel = tipo === "historia" ? "História" : "Nota";

    const overlay = document.createElement("div");
    overlay.id = "post-modal-overlay";
    overlay.className = "post-modal-overlay";
    overlay.innerHTML = `
    <div class="post-modal-box" role="dialog" aria-modal="true">
      <div class="post-modal-header">
        <span class="title-paranormal" style="font-size:13px;color:var(--text-muted);">
          ${isEdit ? "Editar" : "Novo"} Post de ${tipoLabel}
        </span>
        <button class="btn-ghost btn-modal-close" title="Fechar">✕</button>
      </div>

      <div style="padding:0 20px 20px;display:flex;flex-direction:column;gap:14px;">
        <label style="color:var(--text-muted);font-size:11px;text-transform:uppercase;">
          Título (opcional)
          <input id="post-modal-titulo" class="input-limiar"
            style="width:100%;display:block;margin-top:4px;box-sizing:border-box;"
            placeholder="Título do post..."
            value="${_escHtml(postExistente?.titulo || "")}" />
        </label>

        <div>
          <div style="color:var(--text-muted);font-size:11px;text-transform:uppercase;margin-bottom:6px;">Conteúdo</div>
          <div class="post-editor-toolbar">
            <button class="post-toolbar-btn" data-cmd="bold" title="Negrito"><b>B</b></button>
            <button class="post-toolbar-btn" data-cmd="italic" title="Itálico"><i>I</i></button>
            <button class="post-toolbar-btn" data-cmd="underline" title="Sublinhado"><u>U</u></button>
            <div class="post-toolbar-sep"></div>
            <button class="post-toolbar-btn" data-cmd="insertUnorderedList" title="Lista">≡</button>
            <button class="post-toolbar-btn" data-cmd="insertOrderedList" title="Lista numerada">1.</button>
          </div>
          <div id="post-modal-editor" class="post-editor-content" contenteditable="true"></div>
          <!-- mention autocomplete dropdown -->
          <div id="post-mention-dropdown" class="post-mention-dropdown" style="display:none;"></div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px;">
          <button class="btn-ghost btn-modal-cancel">Cancelar</button>
          <button class="btn-limiar btn-primary btn-modal-save">Salvar Post</button>
        </div>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    // ── Set initial content (after append so innerHTML is safe)
    const editor = overlay.querySelector("#post-modal-editor");
    editor.innerHTML = postExistente?.conteudo_html || "";

    // ── Close handlers
    const closeModal = () => overlay.remove();
    overlay.querySelector(".btn-modal-close").addEventListener("click", closeModal);
    overlay.querySelector(".btn-modal-cancel").addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

    // ── Toolbar
    overlay.querySelectorAll(".post-toolbar-btn").forEach(btn => {
        btn.addEventListener("mousedown", (e) => {
            e.preventDefault(); // keep editor focus
            document.execCommand(btn.dataset.cmd, false, null);
            editor.focus();
        });
    });

    // ── @mention autocomplete
    _setupMentionAutocomplete(overlay, editor);

    // ── Save
    overlay.querySelector(".btn-modal-save").addEventListener("click", async () => {
        const titulo = overlay.querySelector("#post-modal-titulo").value.trim() || null;
        const conteudo_html = editor.innerHTML.trim();

        const payload = { tipo, titulo, conteudo_html };
        try {
            if (isEdit) {
                await api.editarPost(postExistente.id, payload);
            } else {
                await api.criarPost(pagina.id, payload);
            }
            closeModal();
            await onSaved();
        } catch (e) {
            alert("Erro ao salvar: " + e.message);
        }
    });
}

// ─────────────────────────────────────────────────────────────
//  @mention autocomplete inside editor
// ─────────────────────────────────────────────────────────────

function _setupMentionAutocomplete(overlay, editor) {
    const dropdown = overlay.querySelector("#post-mention-dropdown");
    let seq = 0;
    let mentionStart = null; // { node, offset } where @ was typed

    editor.addEventListener("input", async () => {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        const text = range.startContainer.textContent || "";
        const pos = range.startOffset;

        // Find the last @ before cursor
        const before = text.slice(0, pos);
        const atIdx = before.lastIndexOf("@");
        if (atIdx === -1) { _hideMentionDropdown(dropdown); return; }

        const query = before.slice(atIdx + 1);
        if (query.length < 2) { _hideMentionDropdown(dropdown); return; }
        // Stop if there's a space (mention ended without selection)
        if (query.includes(" ")) { _hideMentionDropdown(dropdown); return; }

        mentionStart = { node: range.startContainer, atIdx };

        const my = ++seq;
        let results = [];
        try { results = await api.buscarPages({ q: query }); } catch (_) { }
        if (my !== seq) return;

        if (!results.length) { _hideMentionDropdown(dropdown); return; }

        dropdown.innerHTML = results.slice(0, 8).map(r => `
      <div class="post-mention-item" data-id="${r.id}" data-titulo="${_escAttr(r.titulo)}" data-entidade="${_escAttr(r.entidade)}">
        <span style="font-size:10px;color:var(--text-muted);margin-right:6px;">${_escHtml(r.entidade)}</span>
        <strong>${_escHtml(r.titulo)}</strong>
      </div>
    `).join("");
        dropdown.style.display = "block";
        dropdown.style.position = "relative";
    });

    dropdown.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const item = e.target.closest(".post-mention-item");
        if (!item) return;

        const id = item.dataset.id;
        const titulo = item.dataset.titulo;

        // Replace @query in the text node with a mention chip
        if (mentionStart) {
            const { node, atIdx } = mentionStart;
            const sel2 = window.getSelection();
            const range = document.createRange();
            const pos = sel2.getRangeAt(0).startOffset;

            // Remove @query text
            range.setStart(node, atIdx);
            range.setEnd(node, pos);
            range.deleteContents();

            // Insert mention anchor
            const a = document.createElement("a");
            a.className = "mention";
            a.dataset.id = id;
            a.href = `javascript:void(0)`;
            a.textContent = `@${titulo}`;
            a.contentEditable = "false";
            range.insertNode(a);

            // Move cursor after the mention
            const afterRange = document.createRange();
            afterRange.setStartAfter(a);
            afterRange.collapse(true);
            sel2.removeAllRanges();
            sel2.addRange(afterRange);

            // Insert a non-breaking space so user can keep typing
            document.execCommand("insertText", false, "\u00a0");
        }

        _hideMentionDropdown(dropdown);
        mentionStart = null;
    });

    editor.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { _hideMentionDropdown(dropdown); mentionStart = null; }
    });

    // clicks inside rendered posts should navigate (delegated to list, but also handle editor clicks)
    editor.addEventListener("click", (e) => {
        const m = e.target.closest(".mention");
        if (m) {
            e.preventDefault();
            navigate(`/entity/${m.dataset.id}`);
        }
    });
}

function _hideMentionDropdown(dropdown) {
    dropdown.style.display = "none";
    dropdown.innerHTML = "";
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

function _escHtml(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function _escAttr(str) {
    return String(str ?? "").replaceAll('"', "&quot;");
}
