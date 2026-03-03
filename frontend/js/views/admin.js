import { api } from "../api.js";
import { navigate } from "../app.js";
import { SCHEMAS } from "../schemas.js";

function renderCamposCriacao(entidade) {
  const fields = SCHEMAS[entidade] || [];
  if (!fields.length) return "<p style='color:#777; font-size:14px; margin:0;'>Nenhum campo específico.</p>";

  return fields.map(f => {
    const id = `novo-${f.key}`;

    if (f.type === "select") {
      const opts = (f.options || []).map(o =>
        `<option value="${o}">${o}</option>`
      ).join("");
      return `
        <label style="color:var(--text-muted);">${f.label}<br/>
          <select id="${id}" class="input-limiar" style="width:100%; padding:6px; margin-top:4px;">
            <option value="">—</option>
            ${opts}
          </select>
        </label>
      `;
    }

    if (f.type === "textarea") {
      return `
        <label style="color:var(--text-muted);">${f.label}<br/>
          <textarea id="${id}" rows="3" class="input-limiar" style="width:100%; padding:6px; margin-top:4px; max-width:100%;"></textarea>
        </label>
      `;
    }

    const inputType = f.type || "text";
    return `
      <label style="color:var(--text-muted);">${f.label}<br/>
        <input id="${id}" type="${inputType}" class="input-limiar" style="width:100%; padding:6px; margin-top:4px;" />
      </label>
    `;
  }).join("");
}

export function renderAdmin(root) {
  root.innerHTML = `
    <button id="voltar" class="btn-ghost" style="margin-bottom:12px; font-weight:bold;">← Voltar</button>
    <div style="max-width:600px; margin:0 auto; padding-bottom:40px;">
      <h2 class="title-paranormal" style="margin-top:0; border-bottom:1px solid var(--bg-surface-alt); padding-bottom:8px;">Nova Inserção no Diretório</h2>

      <div class="dark-surface" style="padding:16px; border-radius:var(--radius-lg); margin-bottom:16px;">
        <h3 class="title-paranormal" style="margin-top:0; font-size:16px; color:var(--text-muted);">Informações Básicas</h3>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <label style="grid-column: span 2; color:var(--text-muted);">Tipo de Entidade<br/>
            <select id="tipo" class="input-limiar" style="width:100%; padding:8px; margin-top:4px; font-weight:bold;">
              <option value="personagem">Personagem</option>
              <option value="item">Item</option>
              <option value="local">Local</option>
              <option value="organizacao">Organização</option>
              <option value="criatura">Criatura</option>
              <option value="evento">Evento</option>
            </select>
          </label>

          <label style="grid-column: span 2; color:var(--text-muted);">Título / Nome <span style="color:var(--brand-accent);">*</span><br/>
            <input id="titulo" class="input-limiar" style="width:100%; padding:8px; margin-top:4px;" placeholder="Ex: Gandalf, O Condado" />
          </label>

          <div style="grid-column: span 2; display:flex; gap:16px; margin-top:8px; align-items:center;">
             <div style="flex-grow:1;">
               <label style="color:var(--text-muted);">URL da Imagem (Opcional)<br/>
                 <input id="imagem-url" class="input-limiar" type="url" placeholder="https://..." style="width:100%; padding:8px; margin-top:4px; margin-bottom:8px;" />
               </label>
               <label style="display:block; margin-top:8px; font-size:14px; color:var(--text-muted);">Ou faça Upload de Arquivo:<br/>
                 <input type="file" id="imagem-file" accept="image/*" class="input-limiar" style="margin-top:6px; font-size:13px; padding:5px; width:100%;" />
               </label>
             </div>
             <div style="flex-shrink:0; width:100px; height:100px; border:1px solid var(--bg-surface-alt); border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; overflow:hidden; background:var(--bg-app);">
                <img id="imagem-preview" src="" style="max-width:100%; max-height:100%; display:none; object-fit:cover;" />
                <span id="imagem-placeholder" style="font-size:11px; color:var(--text-muted); text-align:center;">Nenhum<br>Registro</span>
             </div>
          </div>
        </div>
      </div>

      <div class="dark-surface" style="padding:16px; border-radius:var(--radius-lg); margin-bottom:16px;">
        <h3 class="title-paranormal" style="margin-top:0; font-size:16px; color:var(--text-muted);">Campos Específicos (<span id="label-tipo-esp">Personagem</span>)</h3>
        <div id="extra" style="display:grid; grid-template-columns: 1fr; gap:10px;"></div>
      </div>

      <div class="dark-surface" style="padding:16px; border-radius:var(--radius-lg); margin-bottom:16px;">
        <h3 class="title-paranormal" style="margin-top:0; font-size:16px; color:var(--brand-danger);">Metadata Confidential</h3>
        <div style="display:grid; gap:10px;">
          <label style="color:var(--text-muted);">Autor Original<br/>
            <input id="autor" class="input-limiar" style="width:100%; padding:6px; margin-top:4px;" />
          </label>

          <label style="color:var(--text-muted);">Tags Limiar (separadas por vírgula)<br/>
            <input id="tags" class="input-limiar" placeholder="ex: protagonista, mago, antigo" style="width:100%; padding:6px; margin-top:4px;" />
          </label>
        </div>
      </div>

      <button id="criar" class="btn-limiar btn-primary" style="width:100%; padding:14px; font-size:16px; text-transform:uppercase; letter-spacing:1px; cursor:pointer;">
        Inicializar Entidade
      </button>
    </div>
  `;

  root.querySelector("#voltar").addEventListener("click", () => navigate("/"));

  const tipoEl = root.querySelector("#tipo");
  const extra = root.querySelector("#extra");
  const labelTipoEsp = root.querySelector("#label-tipo-esp");

  function rerenderSchemaFields() {
    const tipo = tipoEl.value;
    const labelMapping = {
      "personagem": "Personagem", "item": "Item", "local": "Local",
      "organizacao": "Organização", "criatura": "Criatura", "evento": "Evento"
    };
    labelTipoEsp.textContent = labelMapping[tipo] || tipo;

    extra.innerHTML = renderCamposCriacao(tipo);
  }

  tipoEl.onchange = () => {
    rerenderSchemaFields();
  };

  // Inicializa a tela com os campos de Personagem
  rerenderSchemaFields();

  root.querySelector("#criar").addEventListener("click", async () => {
    const btnCriar = root.querySelector("#criar");
    btnCriar.disabled = true;
    btnCriar.textContent = "Criando...";

    try {
      const tipo = tipoEl.value;
      const titulo = root.querySelector("#titulo").value.trim();
      let imagem = root.querySelector("#imagem-url").value.trim();
      const fileInput = root.querySelector("#imagem-file");

      if (!titulo) {
        alert("O Título/Nome é obrigatório.");
        return;
      }

      // Se houver arquivo selecionado, prioriza o Upload!
      if (fileInput.files.length > 0) {
        try {
          btnCriar.textContent = "Fazendo upload da imagem...";
          const ret = await api.uploadImagem(fileInput.files[0]);
          imagem = ret.url;
        } catch (err) {
          alert("Erro ao fazer upload da imagem: " + err.message);
          return;
        }
      }

      const autor = root.querySelector("#autor").value.trim();
      const tags = root.querySelector("#tags").value
        .split(",").map(t => t.trim()).filter(Boolean);

      const payload = { tipo, titulo, autor, tags, imagem: imagem || null };

      // Extrai os campos do schema da entidade atual preenchidos pelo form gerado dinâmicamente
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

        // mapeamento legado para classe no schema antigo
        if (tipo === "personagem" && f.key === "tipo") {
          payload.classe = v;
          continue;
        }

        if (f.key === "tipo") {
          payload.subtipo = v;
          continue;
        }

        payload[f.key] = v;
      }

      const resp = await api.criarPagina(payload);
      alert("Entidade Criada! ID: " + resp.id);
      navigate(`/entity/${resp.id}`);

    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      btnCriar.disabled = false;
      btnCriar.textContent = "Criar Entidade";
    }
  });

  // Imagem Preview Listeners
  const urlInput = root.querySelector("#imagem-url");
  const fileInput = root.querySelector("#imagem-file");
  const preview = root.querySelector("#imagem-preview");
  const placeholder = root.querySelector("#imagem-placeholder");

  function atualizarPreview(src) {
    if (src) {
      preview.src = src;
      preview.style.display = "block";
      placeholder.style.display = "none";
    } else {
      preview.style.display = "none";
      placeholder.style.display = "block";
      preview.src = "";
    }
  }

  urlInput.addEventListener("input", (e) => {
    if (fileInput.files.length === 0) {
      atualizarPreview(e.target.value.trim());
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      const url = URL.createObjectURL(e.target.files[0]);
      atualizarPreview(url);
    } else {
      atualizarPreview(urlInput.value.trim());
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