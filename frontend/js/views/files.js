import { navigate } from "../app.js";
import { api } from "../api.js";
import { state } from "../state.js";

export async function renderFileList(root, params) {
    root.innerHTML = `<p class="text-muted">Carregando arquivo...</p>`;

    async function fetchData() {
        const query = params.get("q") || "";
        const files = await api.listarArquivos({ q: query });
        render(files, query);
    }

    function render(files, queryValue) {
        const canWrite = state.canWrite();
        root.innerHTML = `
            <div class="hero-noir" style="padding: 40px 0;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h1 class="title-paranormal">Arquivo da Campanha</h1>
                        <p class="text-muted">Repositório de pistas, documentos e evidências.</p>
                    </div>
                    ${canWrite ? `<button class="btn-limiar btn-primary" id="btn-open-upload">
                        <i data-lucide="upload" style="width:16px; height:16px;"></i> Upload
                    </button>` : ""}
                </div>
            </div>

            <div class="search-bar" style="margin-top:24px; display:flex; gap:12px;">
                <input type="text" id="file-search" class="input-limiar" style="flex:1;" placeholder="Buscar arquivos..." value="${escapeHtml(queryValue)}" />
                <select class="input-limiar" style="width:150px;" id="filter-kind">
                    <option value="all">Todos os Tipos</option>
                    <option value="image">Imagens</option>
                    <option value="pdf">PDFs</option>
                </select>
            </div>

            <div class="file-grid">
                ${files.length ? files.map(f => `
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
                                ${f.is_public ? `<span class="file-badge-public">Público</span>` : ""}
                            </div>
                        </div>
                    </a>
                `).join('') : `<div class="rel-empty" style="grid-column: 1/-1;">Nenhum arquivo encontrado.</div>`}
            </div>

            <!-- Modal Upload -->
            <div id="modal-upload" class="modal-paranormal" style="display:none;">
                <div class="modal-content dark-surface">
                    <h2 class="title-paranormal">Subir Documento</h2>
                    <form id="form-upload" style="display:flex; flex-direction:column; gap:16px; margin-top:20px;">
                        <label class="editor-label">Arquivo (JPG/PNG/PDF)
                            <input type="file" name="file" accept=".jpg,.jpeg,.png,.pdf" required />
                        </label>
                        <label class="editor-label">Título
                            <input type="text" name="title" class="input-limiar" required />
                        </label>
                        <label class="editor-label">Descrição
                            <textarea name="description" class="input-limiar" style="min-height:80px;"></textarea>
                        </label>
                        <label class="editor-label">Tags (separadas por vírgula)
                            <input type="text" name="tags" class="input-limiar" placeholder="pista, hospital, etc" />
                        </label>
                        <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-muted); cursor:pointer;">
                            <input type="checkbox" name="is_public" style="width:16px; height:16px;" />
                            Visível para Jogadores
                        </label>
                        <div style="display:flex; gap:12px; margin-top:12px;">
                            <button type="submit" class="btn-limiar btn-primary" style="flex:1;">Enviar Arquivo</button>
                            <button type="button" class="btn-limiar btn-ghost" id="btn-close-upload">Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();

        // Events
        const searchInput = root.querySelector("#file-search");
        searchInput.onkeypress = (e) => {
            if (e.key === "Enter") {
                const q = searchInput.value.trim();
                navigate(q ? `/files?q=${encodeURIComponent(q)}` : "/files");
            }
        };

        if (canWrite) {
            const modal = root.querySelector("#modal-upload");
            root.querySelector("#btn-open-upload").onclick = () => modal.style.display = "flex";
            root.querySelector("#btn-close-upload").onclick = () => modal.style.display = "none";

            const form = root.querySelector("#form-upload");
            form.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                formData.set("is_public", form.is_public.checked);

                try {
                    const btn = form.querySelector('button[type="submit"]');
                    btn.disabled = true;
                    btn.innerText = "Enviando...";

                    const res = await api.uploadArquivo(formData);
                    if (res.ok) {
                        navigate(`/files/${res.id}`);
                    } else {
                        alert("Erro: " + res.erro);
                        btn.disabled = false;
                        btn.innerText = "Enviar Arquivo";
                    }
                } catch (err) {
                    alert("Erro no upload");
                }
            };
        }
    }

    fetchData();
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
