import { api } from "../api.js";
import { navigate } from "../app.js";

export function renderAdmin(root) {
  root.innerHTML = `
    <button id="voltar">← Voltar</button>
    <h2>Admin</h2>

    <div style="display:grid; gap:10px; max-width:520px;">
      <label>Tipo<br/>
        <select id="tipo">
          <option value="personagem">Personagem</option>
          <option value="item">Item</option>
          <option value="local">Local</option>
          <option value="organizacao">Organização</option>
          <option value="criatura">Criatura</option>
        </select>
      </label>

      <label>Título<br/>
        <input id="titulo" />
      </label>

      <label>Autor<br/>
        <input id="autor" />
      </label>

      <label>Tags (vírgula)<br/>
        <input id="tags" placeholder="mocinho, cabeludo" />
      </label>

      <div id="extra"></div>

      <button id="criar">Criar</button>
    </div>
  `;

  root.querySelector("#voltar").addEventListener("click", () => navigate("/"));

  const tipoEl = root.querySelector("#tipo");
  const extra = root.querySelector("#extra");

  function renderExtra() {
    const tipo = tipoEl.value;
    extra.innerHTML = "";
    if (tipo === "personagem") {
      extra.innerHTML = `
        <label>Idade<br/>
          <input id="idade" type="number" />
        </label>

        <label>Classe<br/>
          <input id="classe" type="text" />
        </label>
      `;
    }
  }
  tipoEl.addEventListener("change", renderExtra);
  renderExtra();

  root.querySelector("#criar").addEventListener("click", async () => {
    const tipo = tipoEl.value;
    const titulo = root.querySelector("#titulo").value.trim();
    const autor = root.querySelector("#autor").value.trim();
    const tags = root.querySelector("#tags").value
      .split(",").map(t => t.trim()).filter(Boolean);

    const payload = { tipo, titulo, autor, tags };

    if (tipo === "personagem") {
      const idadeVal = root.querySelector("#idade").value;
      payload.idade = idadeVal === "" ? null : Number(idadeVal);

      const classeVal = root.querySelector("#classe").value.trim();
      payload.classe = classeVal === "" ? null : classeVal;
}
console.log("payload que vou enviar:", payload);
    try {
      const resp = await api.criarPagina(payload);
      alert("Criada! ID: " + resp.id);
      navigate(`/entity/${resp.id}`);
    } catch (e) {
      alert("Erro: " + e.message);
    }
  });
}