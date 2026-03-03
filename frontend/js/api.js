async function jsonFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { erro: text };
  }

  if (!res.ok) {
    const msg = (data && (data.detalhe || data.erro || data.error)) || `Erro ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  listarPaginas: () => jsonFetch("/api/paginas"),
  pegarPagina: (id) => jsonFetch(`/api/pagina/${id}`),
  getRelations: (pageId) => jsonFetch(`/api/relations/${pageId}`),
  uploadImagem: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    let data = null;
    try { data = await res.json(); } catch { data = { erro: await res.text() } }
    if (!res.ok) throw new Error(data.erro || "Falha no upload");
    return data;
  },

  criarPagina: (payload) =>
    jsonFetch("/api/criar_pagina", { method: "POST", body: JSON.stringify(payload) }),

  editarPagina: (id, payload) =>
    jsonFetch(`/api/editar_pagina?id=${id}`, { method: "POST", body: JSON.stringify(payload) }),

  excluirPagina: (id) =>
    jsonFetch(`/api/excluir_pagina?id=${id}`, { method: "POST" }),
  criarRelacao: (payload) =>
    jsonFetch("/api/relations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deletarRelacao: (relacaoId) =>
    jsonFetch(`/api/relations/${relacaoId}`, {
      method: "DELETE",
    }),

  // Busca genérica (autocomplete)
  buscarPages: ({ entidade, q }) => {
    const params = new URLSearchParams();
    if (entidade) params.append("entidade", entidade);
    if (q) params.append("q", q);
    return jsonFetch(`/api/busca_pages?${params.toString()}`);
  }
};