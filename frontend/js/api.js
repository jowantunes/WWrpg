async function jsonFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = (data && (data.erro || data.error)) || `Erro ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  listarPaginas: () => jsonFetch("/api/paginas"),
  pegarPagina: (id) => jsonFetch(`/api/pagina/${id}`),

  criarPagina: (payload) =>
    jsonFetch("/api/criar_pagina", { method: "POST", body: JSON.stringify(payload) }),

  editarPagina: (id, payload) =>
    jsonFetch(`/api/editar_pagina?id=${id}`, { method: "POST", body: JSON.stringify(payload) }),

  excluirPagina: (id) =>
    jsonFetch(`/api/excluir_pagina?id=${id}`, { method: "POST" }),

  // Personagem -> Organizações
  listarOrganizacoesDoPersonagem: (personagemId) =>
    jsonFetch(`/api/personagem/${personagemId}/organizacoes`),

  vincularOrganizacao: (personagemId, payload) =>
    jsonFetch(`/api/personagem/${personagemId}/organizacoes`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  desvincularOrganizacao: (personagemId, orgId) =>
    jsonFetch(`/api/personagem/${personagemId}/organizacoes/${orgId}`, {
      method: "DELETE",
    }),

  // Organização -> Membros
  listarMembrosDaOrg: (orgId) =>
    jsonFetch(`/api/organizacao/${orgId}/membros`),
};