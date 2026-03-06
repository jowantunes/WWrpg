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

  deletarRelacao: (id) => jsonFetch(`/api/relations/${id}`, { method: "DELETE" }),

  // Campaign Archive
  listarArquivos: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return jsonFetch(`/api/files?${qs}`);
  },
  uploadArquivo: (formData) => {
    // Note: formData should be used with fetch directly since it handles headers automatically
    return fetch("/api/files", {
      method: "POST",
      body: formData
    }).then(res => res.json());
  },
  getDetalheArquivo: (id) => jsonFetch(`/api/files/${id}`),
  editarArquivo: (id, data) => jsonFetch(`/api/files/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletarArquivo: (id) => jsonFetch(`/api/files/${id}`, { method: "DELETE" }),
  vincularArquivo: (fileId, pageId, note = "") => jsonFetch(`/api/files/${fileId}/links`, {
    method: "POST",
    body: JSON.stringify({ page_id: pageId, note })
  }),
  desvincularArquivo: (fileId, pageId) => jsonFetch(`/api/files/${fileId}/links/${pageId}`, { method: "DELETE" }),

  // Busca genérica (autocomplete)
  buscarPages: ({ entidade, q }) => {
    const params = new URLSearchParams();
    if (entidade) params.append("entidade", entidade);
    if (q) params.append("q", q);
    return jsonFetch(`/api/busca_pages?${params.toString()}`);
  },

  // Posts
  listarPosts: (pageId, tipo) =>
    jsonFetch(`/api/pages/${pageId}/posts?tipo=${encodeURIComponent(tipo)}`),

  criarPost: (pageId, payload) =>
    jsonFetch(`/api/pages/${pageId}/posts`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  editarPost: (postId, payload) =>
    jsonFetch(`/api/posts/${postId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  excluirPost: (postId) =>
    jsonFetch(`/api/posts/${postId}`, { method: "DELETE" }),

  reordenarPost: (postId, direction) =>
    jsonFetch(`/api/posts/${postId}/reorder`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    }),

  listarTimeline: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.start) searchParams.append("start", params.start);
    if (params.end) searchParams.append("end", params.end);
    if (params.group) searchParams.append("group", params.group);
    return jsonFetch(`/api/timeline?${searchParams.toString()}`);
  },

  patchTimelineEvent: (id, payload) =>
    jsonFetch(`/api/timeline/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // AUTH
  login: (username, password) =>
    jsonFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => jsonFetch("/api/auth/logout", { method: "POST" }),
  getMe: () => jsonFetch("/api/auth/me"),

  // ADMIN
  listUsers: () => jsonFetch("/api/admin/users"),
  createUser: (payload) =>
    jsonFetch("/api/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  patchUser: (id, payload) =>
    jsonFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  changeMyPassword: (payload) =>
    jsonFetch("/api/account/password", { method: "POST", body: JSON.stringify(payload) }),
  patchAccount: (payload) =>
    jsonFetch("/api/account", { method: "PATCH", body: JSON.stringify(payload) }),
};