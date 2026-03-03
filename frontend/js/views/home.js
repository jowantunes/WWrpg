import { api } from "../api.js";
import { navigate } from "../app.js";

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function renderHome(root) {
  root.innerHTML = `
    <!-- Hero Banner -->
    <div style="position:relative; width:100%; height:600px; border-radius:var(--radius-lg); overflow:hidden; margin-bottom:40px; border:1px solid var(--bg-surface-alt); box-shadow:var(--shadow-base);">
       <div style="position:absolute; inset:0; background: linear-gradient(180deg, #2b4361 20%, #1019243b 100%);"></div>
       <div style="position:absolute; inset:0; background: url('http://jowantunes.com/wp-content/uploads/2026/03/ChatGPT-Image-Mar-1-2026-11_03_23-PM.png') repeat; opacity:0.9; mix-blend-mode: normal;"></div>
       
       <div style="position:absolute; bottom:40px; left:40px; z-index:2;">
          <h1 class="title-paranormal" style="font-size:42px; margin:0; text-shadow: 0 4px 12px rgba(0,0,0,0.8);">Universo Limiar</h1>
          <button id="hero-btn" class="btn-limiar btn-primary" style="margin-top:16px; padding:10px 24px; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">Iniciar Protocolo</button>
       </div>
    </div>

    <!-- Seção: Últimas Atualizações -->
    <h2 class="title-paranormal" style="font-size:20px; border-bottom:1px solid var(--bg-surface-alt); padding-bottom:8px; margin-bottom:20px; display:flex; align-items:center; gap:8px;">
       <span style="color:var(--brand-accent);">⚡</span> Últimas Atualizações
    </h2>
    <div id="grid-home" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:20px;">
       <p style="color:var(--text-muted);">Decodificando log de arquivos...</p>
    </div>
  `;

  root.querySelector("#hero-btn").addEventListener("click", () => navigate("/categorias/personagem"));

  const grid = root.querySelector("#grid-home");

  try {
    let results = await api.listarPaginas();

    // Order updates chronologically if timestamp exists, fallback to latest ID
    if (results.length > 0 && results[0].data_atualizacao) {
      results.sort((a, b) => new Date(b.data_atualizacao) - new Date(a.data_atualizacao));
    } else {
      results.sort((a, b) => b.id - a.id);
    }

    const slice = results.slice(0, 8); // Top 8 most recent

    if (slice.length === 0) {
      grid.innerHTML = `<p style="color:var(--text-muted); font-style:italic;">O diretório está vazio.</p>`;
      return;
    }

    grid.innerHTML = slice.map(p => {
      const imgHtml = p.imagem
        ? `<img src="${escapeHtml(p.imagem)}" style="width:60px; height:60px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid var(--bg-surface-alt);" />`
        : `<div style="width:60px; height:60px; background:var(--bg-app); border:1px solid var(--bg-surface-alt); border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:10px;">Vazio</div>`;

      const dateStr = p.data_atualizacao || "";
      const prettyDate = dateStr.includes(" ") ? dateStr.split(" ")[0] : dateStr;

      return `
         <div class="card-noir" data-id="${p.id}" style="display:flex; align-items:center; gap:16px; padding:12px;">
            ${imgHtml}
            <div style="flex-grow:1; min-width:0;">
               <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <span style="font-size:10px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:var(--brand-accent); background:rgba(193,18,31,0.1); padding:2px 6px; border-radius:4px;">${escapeHtml(p.tipo)}</span>
                  <span style="font-size:11px; color:var(--text-muted);">${escapeHtml(prettyDate)}</span>
               </div>
               <div class="title-paranormal" style="font-size:14px; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.titulo)}</div>
            </div>
         </div>
       `;
    }).join("");

    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".card-noir");
      if (card) navigate(`/entity/${card.dataset.id}`);
    });

  } catch (e) {
    grid.innerHTML = `<p style="color:var(--brand-danger);">Erro de carregamento remoto: ${e.message}</p>`;
  }
}