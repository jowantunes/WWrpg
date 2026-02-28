// schemas.js
export const SCHEMAS = {
  personagem: [
    { key: "idade", label: "Idade", type: "number" },
    { key: "tipo", label: "Classe", type: "text", alias: "classe" }, // suporta pagina.classe antigo
    { key: "genero", label: "Gênero", type: "text" },
    { key: "status_vida", label: "Status", type: "select", options: ["vivo","morto","desconhecido"] },
    { key: "aparencia", label: "Aparência", type: "textarea" },
    { key: "descricao", label: "Descrição", type: "textarea" },
    { key: "aniversario", label: "Aniversário", type: "text" },
  ],
  local: [
    { key: "tipo", label: "Tipo", type: "text" },
    { key: "descricao", label: "Descrição", type: "textarea" },
    { key: "status_local", label: "Status", type: "select", options: ["ativo","destruido","abandonado","desconhecido"] },
  ],
  organizacao: [
    { key: "tipo", label: "Tipo", type: "text" },
    { key: "descricao", label: "Descrição", type: "textarea" },
    { key: "status_org", label: "Status", type: "select", options: ["ativa","extinta","desconhecida"] },
  ],
  criatura: [
    { key: "tipo", label: "Tipo", type: "text" },
    { key: "elemento", label: "Elemento", type: "text" },
    { key: "descricao", label: "Descrição", type: "textarea" },
    { key: "status", label: "Status", type: "select", options: ["viva","morta","extinta","desconhecida"] },
  ],
  evento: [
    { key: "tipo", label: "Tipo", type: "text" },
    { key: "descricao", label: "Descrição", type: "textarea" },
    { key: "data_inicio", label: "Data início", type: "text" },
    { key: "data_fim", label: "Data fim", type: "text" },
  ],
  item: [
    { key: "tipo", label: "Tipo", type: "text" },
    { key: "descricao", label: "Descrição", type: "textarea" },
  ],
};