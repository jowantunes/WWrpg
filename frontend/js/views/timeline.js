import { api } from "../api.js";
import { state } from "../state.js";

function formatPtDate(s) {
  const m = (s || "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return s || "";
  const [, y, mo, d, h, mi] = m;
  return `${d}/${mo}/${y} ${h}:${mi}`;
}

// Converts "YYYY-MM-DD HH:MM" to "YYYY-MM-DDTHH:MM" for <input type="datetime-local">
function toIsoForInput(s) {
  if (!s) return "";
  return s.replace(" ", "T").substring(0, 16);
}

// Converts "YYYY-MM-DDTHH:MM" back to "YYYY-MM-DD HH:MM" for API
function fromIsoToApi(s) {
  if (!s) return "";
  return s.replace("T", " ").substring(0, 16);
}

export async function renderTimeline(root) {
  let allEvents = [];
  let availableGroups = [];

  root.innerHTML = `
    <div class="tl-container">
      <div class="tl-toolbar-sticky">
        <div class="tl-filters">
          <div class="tl-filter-group">
            <label>Início</label>
            <input type="text" id="tl-start" placeholder="YYYY-MM-DD HH:MM">
          </div>
          <div class="tl-filter-group">
            <label>Fim</label>
            <input type="text" id="tl-end" placeholder="YYYY-MM-DD HH:MM">
          </div>
          <div class="tl-filter-group">
            <label>Grupo</label>
            <select id="tl-group-select">
              <option value="Todos">Todos</option>
            </select>
          </div>
          <button id="tl-clear-btn" class="tl-btn-secondary">Limpar</button>
        </div>
      </div>
      <div id="tl-list" class="tl-list-content">
        <div class="tl-loading">Carregando eventos...</div>
      </div>
      <!-- Datalist for groups -->
      <datalist id="tl-groups-datalist"></datalist>
    </div>
  `;

  const listEl = root.querySelector("#tl-list");
  const startInput = root.querySelector("#tl-start");
  const endInput = root.querySelector("#tl-end");
  const groupSelect = root.querySelector("#tl-group-select");
  const clearBtn = root.querySelector("#tl-clear-btn");
  const groupsDatalist = root.querySelector("#tl-groups-datalist");

  let currentFilters = {
    start: "",
    end: "",
    group: "Todos"
  };

  async function loadEvents() {
    listEl.innerHTML = '<div class="tl-loading">Carregando eventos...</div>';
    try {
      const groupParam = currentFilters.group === "Todos" ? "" : currentFilters.group;

      const { events, groups } = await api.listarTimeline({
        start: currentFilters.start.trim(),
        end: currentFilters.end.trim(),
        group: groupParam
      });

      allEvents = events || [];
      availableGroups = groups || [];

      renderGroups(availableGroups);
      renderList(allEvents);
    } catch (err) {
      listEl.innerHTML = `<div class="tl-error">Erro ao carregar eventos: ${escapeHtml(err?.message || String(err))}</div>`;
    }
  }

  function renderGroups(groups) {
    const currentGroup = groupSelect.value;
    groupSelect.innerHTML = '<option value="Todos">Todos</option>';
    groupsDatalist.innerHTML = "";

    groups.forEach(g => {
      // For the filter select
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = g;
      if (g === currentGroup) opt.selected = true;
      groupSelect.appendChild(opt);

      // For the datalist
      const dlOpt = document.createElement("option");
      dlOpt.value = g;
      groupsDatalist.appendChild(dlOpt);
    });
  }

  function renderList(events) {
    if (events.length === 0) {
      listEl.innerHTML = '<div class="tl-empty">Sem eventos nesse intervalo.</div>';
      return;
    }

    let html = "";
    events.forEach(ev => {
      html += renderItemHtml(ev);
    });
    listEl.innerHTML = html;
  }

  function renderItemHtml(ev, isEditing = false) {
    const color = ev.color || "var(--text-muted)";
    const pageLink = ev.pageUrl ? `<a href="${ev.pageUrl}" data-link class="tl-cta-btn">Abrir</a>` : `<span class="tl-item-date">(Sem página)</span>`;
    const banner = ev.image ? `<div class="tl-card-banner" style="background-image: url('${ev.image}')"></div>` : "";

    if (isEditing) {
      return `
        <div class="tl-item tl-editing" data-id="${ev.id}">
          <div class="tl-item-left">
            <div class="tl-dot" style="background-color: ${color}"></div>
          </div>
          <div class="tl-item-content tl-card tl-inline-edit">
            <div class="tl-edit-fields">
              <div class="tl-field-inline">
                <label>Data/Hora</label>
                <input type="datetime-local" class="tl-edit-start" value="${toIsoForInput(ev.start)}">
              </div>
              <div class="tl-field-inline">
                <label>Grupo</label>
                <input type="text" class="tl-edit-group" list="tl-groups-datalist" value="${escapeHtml(ev.group || "")}">
              </div>
              <div class="tl-field-inline">
                <label>Cor</label>
                <input type="color" class="tl-edit-color" value="${ev.color || "#666666"}">
              </div>
            </div>
            <div class="tl-edit-actions">
              <button class="tl-btn-save" data-action="save">Salvar</button>
              <button class="tl-btn-cancel" data-action="cancel">Cancelar</button>
              <span class="tl-error-inline"></span>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="tl-item" data-id="${ev.id}">
        <div class="tl-item-left">
          <div class="tl-dot" style="background-color: ${color}"></div>
        </div>
        <div class="tl-item-content tl-card">
          ${banner}
          <div class="tl-card-top">
            <span class="tl-item-date">${escapeHtml(formatPtDate(ev.start))}</span>
            ${ev.group ? `<span class="tl-item-badge" style="border-color: ${color}; color: ${color}">${escapeHtml(ev.group)}</span>` : ""}
          </div>
          
          <div style="display:flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <h3 class="tl-card-title">${escapeHtml(ev.title)}</h3>
            ${state.canWrite() ? `
              <div class="tl-actions" style="margin-left: auto;">
                <button class="tl-btn-edit" data-action="edit">Editar</button>
              </div>
            ` : ""}
          </div>

          ${ev.desc ? `<p class="tl-card-desc">${escapeHtml(ev.desc)}</p>` : ""}
          
          <div class="tl-card-actions">
            ${pageLink}
          </div>
        </div>
      </div>
    `;
  }

  // Event Delegation
  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const itemEl = btn.closest(".tl-item");
    if (!itemEl) return;

    const id = parseInt(itemEl.dataset.id);
    const ev = allEvents.find(event => event.id === id);
    if (!ev) return;

    if (action === "edit") {
      itemEl.outerHTML = renderItemHtml(ev, true);
    } else if (action === "cancel") {
      itemEl.outerHTML = renderItemHtml(ev, false);
    } else if (action === "save") {
      await handleSave(itemEl, ev);
    }
  });

  async function handleSave(itemEl, originalEv) {
    const errorEl = itemEl.querySelector(".tl-error-inline");
    const saveBtn = itemEl.querySelector('[data-action="save"]');

    const startVal = fromIsoToApi(itemEl.querySelector(".tl-edit-start").value);
    const groupVal = itemEl.querySelector(".tl-edit-group").value.trim();
    const colorVal = itemEl.querySelector(".tl-edit-color").value;

    if (!startVal) {
      errorEl.textContent = "Data é obrigatória";
      return;
    }

    saveBtn.disabled = true;
    errorEl.textContent = "Salvando...";

    try {
      await api.patchTimelineEvent(originalEv.id, {
        start_text: startVal,
        group_name: groupVal || null,
        color: colorVal
      });

      // Update local state and re-render the item
      originalEv.start = startVal;
      originalEv.group = groupVal || null;
      originalEv.color = colorVal;

      itemEl.outerHTML = renderItemHtml(originalEv, false);

      // If a new group was added, we might want to refresh the filters
      if (groupVal && !availableGroups.includes(groupVal)) {
        loadEvents(); // Full reload to catch the new group in the dropdown
      }
    } catch (err) {
      saveBtn.disabled = false;
      errorEl.textContent = `Erro: ${err.message}`;
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updateFilters() {
    currentFilters.start = startInput.value;
    currentFilters.end = endInput.value;
    currentFilters.group = groupSelect.value;
    loadEvents();
  }

  startInput.addEventListener("change", updateFilters);
  endInput.addEventListener("change", updateFilters);
  groupSelect.addEventListener("change", updateFilters);

  clearBtn.addEventListener("click", () => {
    startInput.value = "";
    endInput.value = "";
    groupSelect.value = "Todos";
    updateFilters();
  });

  // Initial load
  loadEvents();
}
