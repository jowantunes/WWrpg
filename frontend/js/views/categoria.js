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

export async function renderCategoria(root, tipo) {
    const labellings = {
        "personagem": "Personagens",
        "local": "Locais",
        "organizacao": "Organizações",
        "evento": "Eventos Históricos",
        "item": "Itens & Artefatos",
        "criatura": "Criaturas"
    };

    const displayTitle = labellings[tipo] || tipo.toUpperCase();

    root.innerHTML = `
    <div style="max-width:1000px; margin:0 auto; padding-bottom:40px;">
       
       <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--bg-surface-alt); padding-bottom:12px; margin-bottom:24px;">
           <h2 class="title-paranormal" style="margin:0; font-size:24px;">Diretório: <span style="color:var(--brand-accent);">${displayTitle}</span></h2>
           
           <div style="display:flex; gap:12px; align-items:center;">
              <input id="busca-categoria" class="input-limiar" type="text" placeholder="Filtrar por nome..." style="width:240px; padding:8px 12px;" />
              <button id="btn-novo" class="btn-limiar btn-primary">+ Novo</button>
           </div>
       </div>

       <div id="grid-resultados" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:20px;">
          <p style="grid-column: 1 / -1; text-align:center; color:var(--text-muted); padding:40px 0;">Carregando diretório...</p>
       </div>
    </div>
  `;

    const btnNovo = root.querySelector("#btn-novo");
    const inputBusca = root.querySelector("#busca-categoria");
    const grid = root.querySelector("#grid-resultados");

    btnNovo.addEventListener("click", () => navigate("/admin"));

    async function loadData(q = "") {
        try {
            grid.innerHTML = `<p style="grid-column: 1 / -1; text-align:center; color:#777; padding:40px 0;">Buscando...</p>`;
            // GET /api/paginas?entidade=${tipo}
            const pages = await api.buscarPages({ entidade: tipo, q: q });

            // Notice we used `buscarPages`, which hits `/api/busca_pages`? 
            // Wait, `busca_pages` returns only `[id, titulo, entidade]`. 
            // We need the NEW `listarPaginas` that brings `imagem` and `resumo`.
            // Let's call GET `/api/paginas` directly via a custom fetch or modifying api.js later.
            // For now, let's just make the direct fetch:

            const params = new URLSearchParams();
            params.append("entidade", tipo);
            if (q) params.append("q", q);

            const res = await fetch(`/api/paginas?${params.toString()}`);
            if (!res.ok) throw new Error("Falha ao carregar.");
            const results = await res.json();

            if (results.length === 0) {
                grid.innerHTML = `<p style="grid-column: 1 / -1; text-align:center; color:#999; padding:40px 0; font-style:italic;">Nenhum registro encontrado nesta categoria.</p>`;
                return;
            }

            grid.innerHTML = results.map(p => {
                const imgHtml = p.imagem
                    ? `<img src="${escapeHtml(p.imagem)}" style="width:100%; height:100%; object-fit:cover;" />`
                    : `<div style="width:100%; height:100%; background:var(--bg-app); display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:12px;">Sem Imagem</div>`;

                const snippet = p.resumo
                    ? (p.resumo.length > 70 ? escapeHtml(p.resumo.substring(0, 70)) + "..." : escapeHtml(p.resumo))
                    : `<span style="opacity:0.5; font-style:italic;">Sem descrição detalhada.</span>`;

                return `
              <div class="card-noir cat-card" data-id="${p.id}" style="display:flex; flex-direction:column; height: 100%; overflow:hidden;">
                 <div style="height:140px; border-bottom:1px solid var(--bg-surface-alt); background:var(--bg-app);">
                    ${imgHtml}
                 </div>
                 <div style="padding:12px; flex-grow:1; display:flex; flex-direction:column;">
                    <div style="font-size:11px; color:var(--brand-accent); text-transform:uppercase; font-weight:bold; margin-bottom:4px;">#${p.id}</div>
                    <h3 class="title-paranormal" style="margin:0 0 6px 0; font-size:16px; line-height:1.2;">${escapeHtml(p.titulo)}</h3>
                    <p style="margin:0; font-size:13px; color:var(--text-muted); line-height:1.4; flex-grow:1;">${snippet}</p>
                 </div>
              </div>
            `;
            }).join("");
        } catch (e) {
            grid.innerHTML = `<p style="grid-column: 1 / -1; text-align:center; color:red;">${e.message}</p>`;
        }
    }

    // Hover animations via injected styling just for the cards
    // Hover animation now natively handled by .card-noir utility in style.css!

    grid.addEventListener("click", (e) => {
        const card = e.target.closest(".cat-card");
        if (card) {
            navigate(`/entity/${card.dataset.id}`);
        }
    });

    let debounceTimer;
    inputBusca.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            loadData(e.target.value.trim());
        }, 300);
    });

    await loadData();
}
