import { api } from "../api.js";
import { navigate } from "../app.js";

export async function renderHome(root) {
  root.innerHTML = `
    <section style="display:flex; gap:12px; align-items:end; flex-wrap:wrap;">
      <div>
        <label>Tipo</label><br/>
        <select id="filtro-tipo">
          <option value="">Todos</option>
          <option value="personagem">Personagem</option>
          <option value="item">Item</option>
          <option value="local">Local</option>
          <option value="organizacao">Organização</option>
          <option value="criatura">Criatura</option>
        </select>
      </div>

      <div>
        <label>Tag</label><br/>
        <input id="filtro-tag" placeholder="Digite uma tag" />
      </div>

      <button id="btn-filtrar">Filtrar</button>
    </section>

    <ul id="lista" style="margin-top:16px;"></ul>
  `;

  const lista = root.querySelector("#lista");
  lista.innerHTML = "<li>Carregando...</li>";

  let paginas = [];
  try {
    paginas = await api.listarPaginas();
  } catch (e) {
    lista.innerHTML = `<li>Erro: ${e.message}</li>`;
    return;
  }

  function desenhar(items) {
    if (!items.length) {
      lista.innerHTML = "<li>Nenhum resultado.</li>";
      return;
    }
    lista.innerHTML = "";
    for (const p of items) {
      const li = document.createElement("li");
      const tags = (p.tags || []).join(", ");
      li.innerHTML = `
        <a href="/entity/${p.id}" data-entity="${p.id}" style="text-decoration:underline; cursor:pointer;">
          [${p.tipo}] ${p.titulo}
        </a>
        <span style="opacity:.7;"> — ${tags || "Sem tags"}</span>
      `;
      li.querySelector("a").addEventListener("click", (e) => {
        e.preventDefault();
        navigate(`/entity/${p.id}`);
      });
      lista.appendChild(li);
    }
  }

  desenhar(paginas);

  root.querySelector("#btn-filtrar").addEventListener("click", () => {
    const tipo = root.querySelector("#filtro-tipo").value.trim().toLowerCase();
    const tag = root.querySelector("#filtro-tag").value.trim().toLowerCase();

    let filtradas = paginas;

    if (tipo) filtradas = filtradas.filter(p => (p.tipo || "").toLowerCase() === tipo);

    if (tag) filtradas = filtradas.filter(p =>
      (p.tags || []).some(t => t.toLowerCase().includes(tag))
    );

    desenhar(filtradas);
  });
}