// Pega o id da página da URL, ex: /pagina.html?id=1
const params = new URLSearchParams(window.location.search);
const paginaId = params.get("id");

async function carregarPagina() {
    const tituloEl = document.getElementById("titulo");
    const tipoEl = document.getElementById("tipo");
    const autorEl = document.getElementById("autor");
    const dataEl = document.getElementById("data_criacao");
    const tagsEl = document.getElementById("tags");

    try {
        const res = await fetch(`/pagina/${paginaId}`);
        if (!res.ok) throw new Error("Página não encontrada");
        const pagina = await res.json();

        tituloEl.textContent = pagina.titulo;
        tipoEl.textContent = pagina.tipo;
        autorEl.textContent = pagina.autor;
        dataEl.textContent = pagina.data_criacao;
        tagsEl.textContent = pagina.tags.join(", ") || "Sem tags";

    } catch (err) {
        tituloEl.textContent = "Erro ao carregar a página";
        console.error(err);
    }
}

window.onload = carregarPagina;
document.addEventListener("DOMContentLoaded", () => {
    const btnEditar = document.getElementById("btn-editar");
    const campos = document.querySelectorAll(".campo-editavel");
    const paginaId = new URLSearchParams(window.location.search).get("id");

    btnEditar.onclick = () => {
        const editando = btnEditar.textContent === "Salvar";

        if (editando) {
            const dadosAtualizados = {};
            campos.forEach(c => {
                const nome = c.id.replace("campo-", "");
                if (nome === "tags") {
                    dadosAtualizados[nome] = c.value.split(",").map(t => t.trim());
                } else {
                    dadosAtualizados[nome] = c.value;
                }
                c.setAttribute("readonly", true);
            });

            fetch(`/editar_pagina?id=${paginaId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dadosAtualizados)
            })
            .then(res => res.json())
            .then(resp => {
                if (resp.sucesso) {
                    alert("Página atualizada!");
                    btnEditar.textContent = "Editar";
                } else {
                    alert("Erro ao atualizar página");
                }
            });

        } else {
            campos.forEach(c => c.removeAttribute("readonly"));
            btnEditar.textContent = "Salvar";
        }
    };
});

fetch(`/pagina/${paginaId}`)
    .then(res => res.json())
    .then(pagina => {
        document.getElementById("campo-titulo").value = pagina.titulo;
        document.getElementById("campo-autor").value = pagina.autor;
        document.getElementById("campo-tags").value = pagina.tags.join(", ");
    });


    const btnExcluir = document.getElementById("btn-excluir");

btnExcluir.onclick = () => {
    if (!confirm("Tem certeza que deseja excluir esta página? Essa ação não pode ser desfeita.")) return;

    fetch(`/excluir_pagina?id=${paginaId}`, { method: "POST" })
        .then(res => res.json())
        .then(resp => {
            if (resp.sucesso) {
                alert("Página excluída com sucesso!");
                window.location.href = "/frontend/index.html"; // volta pra Home
            } else {
                alert("Erro ao excluir página");
            }
        });
};