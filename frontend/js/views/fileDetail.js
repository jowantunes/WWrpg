import { navigate } from "../app.js";
import { api } from "../api.js";
import { state } from "../state.js";

export async function renderFileDetail(root, id) {
    root.innerHTML = `<p class="text-muted">Carregando detalhes...</p>`;

    try {
        const file = await api.getDetalheArquivo(id);
        render(file);
    } catch (e) {
        root.innerHTML = `<div class="rel-empty">Erro ao carregar arquivo: ${e.message}</div>`;
    }

    function render(file) {
        const canWrite = state.canWrite();
        root.innerHTML = `
            <div class="hero-noir" style="padding: 40px 0;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <a href="/files" data-link class="text-muted" style="text-decoration:none; font-size:12px;">← Voltar ao Arquivo</a>
                        <h1 class="title-paranormal" id="display-title" style="margin-top:8px;">${escapeHtml(file.title)}</h1>
                    </div>
                    <div style="display:flex; gap:12px;">
                        <a href="/api/files/${file.id}/view" target="_blank" class="btn-limiar btn-primary">
                            <i data-lucide="download" style="width:16px; height:16px;"></i> Download
                        </a>
                        ${canWrite ? `
                            <button class="btn-limiar btn-primary" id="btn-edit-toggle">
                                <i data-lucide="edit-3" style="width:16px; height:16px;"></i> Editar
                            </button>
                            <button class="btn-limiar btn-danger" id="btn-delete-file">Remover</button>
                        ` : ""}
                    </div>
                </div>
            </div>

            <div class="file-detail-container">
                <div class="file-viewer-column">
                    <div class="file-viewer-box">
                        ${file.file_kind === 'image'
                ? `<img src="/api/files/${file.id}/view" alt="${escapeHtml(file.title)}" />`
                : `<iframe src="/api/files/${file.id}/view"></iframe>`
            }
                    </div>
                    
                    <!-- VIEW MODE -->
                    <div id="file-view-mode" class="dark-surface" style="margin-top:24px; padding:24px; border-radius:var(--radius-lg);">
                        <h4 class="title-paranormal" style="font-size:14px; margin-bottom:12px;">Descrição</h4>
                        <p id="display-description" style="color:var(--text-muted); line-height:1.6; white-space: pre-wrap;">${escapeHtml(file.description || "Sem descrição.")}</p>
                        
                        <div id="display-tags" style="margin-top:24px; display:flex; gap:8px; flex-wrap:wrap;">
                            ${(file.tags_text || "").split(',').filter(t => t.trim()).map(t => `
                                <span style="background:var(--bg-surface-alt); color:var(--text-main); padding:4px 12px; border-radius:12px; font-size:11px;">#${escapeHtml(t.trim())}</span>
                            `).join('')}
                        </div>
                    </div>

                    <!-- EDIT MODE -->
                    ${canWrite ? `
                    <div id="file-edit-mode" class="dark-surface" style="margin-top:24px; padding:24px; border-radius:var(--radius-lg); display:none;">
                        <h4 class="title-paranormal" style="font-size:14px; margin-bottom:16px;">Editar Informações</h4>
                        <div style="display:flex; flex-direction:column; gap:16px;">
                            <label class="editor-label">Título
                                <input type="text" id="edit-title" class="input-limiar" value="${escapeHtml(file.title)}" />
                            </label>
                            <label class="editor-label">Descrição
                                <textarea id="edit-description" class="input-limiar" style="min-height:120px;">${escapeHtml(file.description || "")}</textarea>
                            </label>
                            <label class="editor-label">Tags (separadas por vírgula)
                                <input type="text" id="edit-tags" class="input-limiar" value="${escapeHtml(file.tags_text || "")}" />
                            </label>
                            <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-muted); cursor:pointer;">
                                <input type="checkbox" id="edit-public" style="width:16px; height:16px;" ${file.is_public ? "checked" : ""} />
                                Visível para Jogadores
                            </label>
                            <div style="display:flex; gap:12px; margin-top:8px;">
                                <button class="btn-limiar btn-primary" id="btn-save-file" style="flex:1;">Guardar Alterações</button>
                                <button class="btn-limiar btn-ghost" id="btn-cancel-edit">Cancelar</button>
                            </div>
                        </div>
                    </div>
                    ` : ""}
                </div>

                <div class="file-sidebar-column">
                    <div class="dark-surface" style="padding:24px; border-radius:var(--radius-lg);">
                        <h4 class="title-paranormal" style="font-size:14px; margin-bottom:16px;">Metadados</h4>
                        <div style="display:flex; flex-direction:column; gap:12px;">
                            <div class="info-item">
                                <span class="info-label">Tipo:</span>
                                <span class="info-value" id="display-type">${file.file_kind?.toUpperCase()}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Tamanho:</span>
                                <span class="info-value">${(file.file_size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Visibilidade:</span>
                                <span class="info-value" id="display-visibility">${file.is_public ? "Público" : "Privado"}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Autor:</span>
                                <span class="info-value">${file.author_username}</span>
                            </div>
                        </div>
                    </div>

                    <div class="dark-surface" style="margin-top:24px; padding:24px; border-radius:var(--radius-lg);">
                        <h4 class="title-paranormal" style="font-size:14px; margin-bottom:16px;">Vínculos</h4>
                        <div id="file-links-list" style="display:flex; flex-direction:column; gap:8px;">
                            ${file.links.length ? file.links.map(l => `
                                <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-app); padding:8px 12px; border-radius:8px;">
                                    <a href="/entity/${l.id}" data-link style="text-decoration:none; color:var(--text-main); font-size:12px;">${escapeHtml(l.titulo)}</a>
                                    ${canWrite ? `<button class="btn-desvincular" data-page-id="${l.id}" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">✕</button>` : ""}
                                </div>
                            `).join('') : `<p style="color:var(--text-muted); font-size:12px; font-style:italic;">Nenhum vínculo.</p>`}
                        </div>
                        
                        ${canWrite ? `
                            <div style="margin-top:16px; border-top:1px solid var(--bg-surface-alt); padding-top:16px; position:relative;">
                                <label class="editor-label">Vincular a Entidade
                                    <input type="text" id="input-link-search" class="input-limiar" style="font-size:12px;" placeholder="Buscar personagem, local..." autocomplete="off" />
                                    <div id="link-sugestoes" class="sugestoes-box" style="position:absolute; top:100%; left:0; right:0; display:none;"></div>
                                </label>
                            </div>
                        ` : ""}
                    </div>
                </div>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();

        if (canWrite) {
            const viewMode = root.querySelector("#file-view-mode");
            const editMode = root.querySelector("#file-edit-mode");
            const btnEditToggle = root.querySelector("#btn-edit-toggle");

            btnEditToggle.onclick = () => {
                const isViewing = editMode.style.display === "none";
                viewMode.style.display = isViewing ? "none" : "block";
                editMode.style.display = isViewing ? "block" : "none";
                btnEditToggle.innerHTML = isViewing
                    ? `<i data-lucide="eye" style="width:16px; height:16px;"></i> Visualizar`
                    : `<i data-lucide="edit-3" style="width:16px; height:16px;"></i> Editar`;
                if (window.lucide) window.lucide.createIcons();
            };

            root.querySelector("#btn-cancel-edit").onclick = () => btnEditToggle.click();

            root.querySelector("#btn-save-file").onclick = async () => {
                const payload = {
                    title: root.querySelector("#edit-title").value.trim(),
                    description: root.querySelector("#edit-description").value.trim(),
                    tags_text: root.querySelector("#edit-tags").value.trim(),
                    is_public: root.querySelector("#edit-public").checked
                };

                try {
                    await api.editarArquivo(file.id, payload);
                    // Refresh current view
                    renderFileDetail(root, file.id);
                } catch (e) {
                    alert("Erro ao salvar: " + e.message);
                }
            };

            root.querySelector("#btn-delete-file").onclick = async () => {
                if (!confirm("Remover este arquivo definitivamente?")) return;
                const res = await api.deletarArquivo(file.id);
                if (res.ok) navigate("/files");
            };

            // Autocomplete for links
            const searchInput = root.querySelector("#input-link-search");
            const sugBox = root.querySelector("#link-sugestoes");
            let seq = 0;

            if (searchInput) {
                searchInput.oninput = async () => {
                    const q = searchInput.value.trim();
                    if (!q) { sugBox.innerHTML = ""; sugBox.style.display = "none"; return; }
                    const mySeq = ++seq;
                    const results = await api.buscarPages({ q });
                    if (mySeq !== seq) return;

                    if (!results.length) {
                        sugBox.innerHTML = `<div style="padding:8px; color:var(--text-muted); font-size:12px;">Nenhuma entidade encontrada.</div>`;
                    } else {
                        sugBox.innerHTML = results.map(r => `
                            <div class="sug-item" data-id="${r.id}" style="padding:8px; cursor:pointer; border-bottom:1px solid var(--bg-surface-alt); font-size:12px;">
                                <strong>#${r.id}</strong> ${escapeHtml(r.titulo)}
                            </div>
                        `).join('');
                    }
                    sugBox.style.display = "block";
                };

                sugBox.onclick = async (e) => {
                    const item = e.target.closest(".sug-item");
                    if (!item) return;
                    const pid = item.dataset.id;
                    const res = await api.vincularArquivo(file.id, pid);
                    if (res.ok) renderFileDetail(root, file.id);
                    else alert("Erro: " + res.erro);
                };

                document.addEventListener("click", (e) => {
                    if (!searchInput.contains(e.target) && !sugBox.contains(e.target)) {
                        sugBox.style.display = "none";
                    }
                });
            }

            root.querySelectorAll(".btn-desvincular").forEach(btn => {
                btn.onclick = async () => {
                    const pid = btn.dataset.pageId;
                    await api.desvincularArquivo(file.id, pid);
                    renderFileDetail(root, file.id);
                };
            });
        }
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
