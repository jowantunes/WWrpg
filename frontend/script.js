let todasPaginas = [];
let todasTags = {};

async function carregarPaginas() {
    const lista = document.getElementById("lista-paginas");
    lista.innerHTML = "<li>Carregando...</li>";

    try {
        const [resPaginas, resTags] = await Promise.all([
            fetch("/paginas"),
            fetch("/paginas_tags")
        ]);

        todasPaginas = await resPaginas.json();
        todasTags = await resTags.json();

        // garante que todasTags seja pelo menos um objeto vazio
        if (!todasTags) todasTags = {};

        mostrarPaginas(todasPaginas);

    } catch (err) {
        console.error(err);
        lista.innerHTML = "<li>Não foi possível carregar totalmente, tente filtrar.</li>";
    }
}

function mostrarPaginas(paginas) {
    const lista = document.getElementById("lista-paginas");
    lista.innerHTML = "";
    paginas.forEach(p => {
        const li = document.createElement("li");
        const tags = todasTags[p.id] ? todasTags[p.id].join(", ") : "Sem tags";
        li.innerHTML = `<a href="pagina.html?id=${p.id}">[${p.tipo}] ${p.titulo}</a> - Tags: ${p.tags.join(", ")}`;
        lista.appendChild(li);
    });
}

// Evento do botão Filtrar
document.getElementById("btn-filtrar").addEventListener("click", () => {
    const tipo = document.getElementById("filtro-tipo").value.toLowerCase();
    const tag = document.getElementById("filtro-tag").value.toLowerCase();

    let filtradas = todasPaginas;

    if (tipo) {
        filtradas = filtradas.filter(p => p.tipo.toLowerCase() === tipo);
    }

    if (tag) {
        filtradas = filtradas.filter(p => {
            return p.tags.some(t => t.toLowerCase().includes(tag));
        });
    }

    mostrarPaginas(filtradas);
});

// Carrega ao abrir a página
window.onload = carregarPaginas;

const btnNova = document.getElementById("btn-nova-pagina");
const formNova = document.getElementById("form-nova-pagina");

btnNova.onclick = () => {
    formNova.style.display = formNova.style.display === "none" ? "block" : "none";
};

// Salvar nova página
document.getElementById("btn-salvar").onclick = async () => {
    const tipo = document.getElementById("tipo").value;
    const titulo = document.getElementById("titulo").value;
    const autor = document.getElementById("autor").value;
    const tags = document.getElementById("tags").value.split(",").map(t => t.trim()).filter(t => t);

    const data = { tipo, titulo, autor, tags };

    try {
        const res = await fetch("/criar_pagina", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const resultado = await res.json();
        if (res.ok) {
            alert("Página criada! ID: " + resultado.id);
            location.reload(); // recarrega a lista
        } else {
            alert("Erro: " + resultado.erro);
        }
    } catch (err) {
        console.error(err);
        alert("Erro ao criar página");
    }
};