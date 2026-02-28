export function setupRelationUI({
  root,
  mountEl,            // elemento onde renderiza (ex: box ou extra)
  mode,               // "edit" | "create"
  sourceId,           // id no edit; null no create
  title,
  placeholder,
  searchTarget,       // (q) => Promise<[{id,titulo}]>
  listTargets,        // (sourceId) => Promise<array>
  linkTarget,         // (sourceId, targetId) => Promise<void>
  unlinkTarget,       // (sourceId, targetId) => Promise<void>
  normalizeListItem,  // (row) => { id, titulo }  // p/ lidar com formatos diferentes
}) {
  let pendentes = [];

  mountEl.innerHTML = `
    <h3>${title}</h3>
    <div style="position:relative; margin:10px 0;">
      <input id="rel-busca" placeholder="${placeholder}" style="width:100%;" autocomplete="off" />
      <div id="rel-sugestoes" style="
        position:absolute; top:100%; left:0; right:0;
        background:white; border:1px solid #ccc;
        max-height:150px; overflow:auto; z-index:10;"></div>
    </div>
    <div id="rel-lista"></div>
  `;

  const input = mountEl.querySelector("#rel-busca");
  const sugestoes = mountEl.querySelector("#rel-sugestoes");
  const lista = mountEl.querySelector("#rel-lista");

  const renderLista = (items) => {
    lista.innerHTML = items.length
      ? items.map(it => `
        <div style="display:flex; justify-content:space-between; gap:8px; padding:8px 0; border-bottom:1px solid #eee;">
          <div><strong>#${it.id}</strong> ${escapeHtml(it.titulo || "")}</div>
          <button class="btn-rel-remover" data-id="${it.id}" type="button">Remover</button>
        </div>
      `).join("")
      : `<p style="opacity:.75;">Nenhum adicionado.</p>`;
  };

  const loadEdit = async () => {
    const rows = await listTargets(sourceId);
    const items = rows.map(normalizeListItem);
    renderLista(items);
    return items;
  };

  // inicial
  let currentItems = [];
  (async () => {
    if (mode === "edit") currentItems = await loadEdit();
    else renderLista(pendentes);
  })();

  input.oninput = async () => {
    const termo = input.value.trim();
    if (!termo) { sugestoes.innerHTML = ""; return; }

    const results = await searchTarget(termo);
    sugestoes.innerHTML = "";

    const idsBloqueados = new Set(
      (mode === "edit" ? currentItems : pendentes).map(x => Number(x.id))
    );

    results
      .filter(r => !idsBloqueados.has(Number(r.id)))
      .forEach(r => {
        const item = document.createElement("div");
        item.textContent = r.titulo;
        item.style.padding = "6px";
        item.style.cursor = "pointer";

        item.onclick = async () => {
          if (mode === "create") {
            pendentes.push({ id: r.id, titulo: r.titulo });
            renderLista(pendentes);
          } else {
            await linkTarget(sourceId, r.id);
            currentItems = await loadEdit();
          }
          input.value = "";
          sugestoes.innerHTML = "";
        };

        sugestoes.appendChild(item);
      });
  };

  lista.onclick = async (e) => {
    const btn = e.target.closest(".btn-rel-remover");
    if (!btn) return;
    const targetId = Number(btn.dataset.id);

    if (mode === "create") {
      pendentes = pendentes.filter(p => Number(p.id) !== targetId);
      renderLista(pendentes);
    } else {
      await unlinkTarget(sourceId, targetId);
      currentItems = await loadEdit();
    }
  };

  // para o CREATE: devolver como pegar pendentes e depois linkar quando tiver id
  return {
    getPending: () => pendentes.slice(),
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