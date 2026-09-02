(function () {
  "use strict";

  const STORAGE_KEY = "programas-reuniones-static-v3";
  const MONTHS = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  const defaultCatalogs = {
    people: [
      "Alberto Palma", "Dorian Droguett", "Eduardo Gómez", "Ernesto Valdebenito",
      "Esteban Silva", "Guillermo Delso", "Jean Delso", "Miguel Benítez",
      "Moisés Rivera", "Ramón Cabello", "Ricardo González", "Victor Armijo",
      "Victor Miranda"
    ].map((name, index) => ({ id: `person-${index}`, name, note: "", active: true })),
    congregations: [
      { id: "cong-1", name: "Congregación Machalí", active: true },
      { id: "cong-2", name: "Gultro", active: true }
    ],
    talks: [
      [55, "¿Cómo puede ganarse una buena reputación?"],
      [71, "Ahora es el momento de estar despiertos"],
      [72, "El amor identifica a la religión verdadera."],
      [74, "Jehová está pendiente de nosotros"],
      [108, "Mire al futuro sin miedo"],
      [150, "¿Está este mundo condenado a la destrucción?"],
      [194, "Cómo nos beneficia la sabiduría divina."]
    ].map(([number, title], index) => ({ id: `talk-${index}`, number, title, active: true })),
    hospitality: [1, 2, 3, 4, 5].map((number) => ({
      id: `group-${number}`, name: `Grupo ${number}`, active: true
    }))
  };

  const state = loadState();
  let editingId = null;
  let editorCovers = { left: "", right: "" };
  let previewProgram = null;
  let activeCatalog = "people";

  const views = {
    programs: document.getElementById("programs-view"),
    editor: document.getElementById("editor-view"),
    preview: document.getElementById("preview-view"),
    catalogs: document.getElementById("catalogs-view")
  };

  function uid(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaultState() {
    return {
      version: 3,
      programs: [],
      catalogs: clone(defaultCatalogs)
    };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && Array.isArray(parsed.programs) && parsed.catalogs) {
        return parsed;
      }
    } catch (error) {
      console.warn("No se pudo leer el almacenamiento local.", error);
    }
    return defaultState();
  }

  function persistState(showStorageWarning = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      if (showStorageWarning) {
        showMessage(
          "No hubo espacio suficiente para guardar todo en el navegador. El programa seguirá disponible mientras esta pestaña permanezca abierta; exporta un respaldo JSON.",
          "warning"
        );
      }
      return false;
    }
  }

  function showMessage(text, type = "success") {
    const area = document.getElementById("message-area");
    const message = document.createElement("div");
    message.className = `message message-${type}`;
    message.textContent = text;
    area.replaceChildren(message);
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(() => area.replaceChildren(), 6500);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showView(route) {
    Object.entries(views).forEach(([name, view]) => {
      view.hidden = name !== route;
    });
    if (route === "programs") renderProgramList();
    if (route === "catalogs") renderCatalog();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formatDate(isoDate) {
    if (!isoDate) return "";
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
  }

  function formatTimestamp(value) {
    try {
      return new Intl.DateTimeFormat("es-CL", {
        dateStyle: "short", timeStyle: "short"
      }).format(new Date(value));
    } catch (error) {
      return "";
    }
  }

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase("es");
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/congregacion/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function setupMonthSelects() {
    const editorSelect = document.getElementById("program-month");
    const filterSelect = document.getElementById("filter-month");
    for (let month = 1; month <= 12; month += 1) {
      editorSelect.add(new Option(MONTHS[month], String(month)));
      filterSelect.add(new Option(MONTHS[month], String(month)));
    }
  }

  function renderProgramList() {
    const body = document.getElementById("program-list-body");
    const year = document.getElementById("filter-year").value;
    const month = document.getElementById("filter-month").value;
    const status = document.getElementById("filter-status").value;
    const years = [...new Set(state.programs.map((program) => program.year))]
      .sort((a, b) => b - a);
    const yearSelect = document.getElementById("filter-year");
    const previousYear = yearSelect.value;
    yearSelect.replaceChildren(new Option("Todos", ""));
    years.forEach((item) => yearSelect.add(new Option(String(item), String(item))));
    yearSelect.value = previousYear;

    const programs = state.programs
      .filter((program) => !year || String(program.year) === year)
      .filter((program) => !month || String(program.month) === month)
      .filter((program) => !status || program.status === status)
      .sort((a, b) => b.year - a.year || b.month - a.month || String(b.updatedAt).localeCompare(String(a.updatedAt)));

    body.replaceChildren();
    programs.forEach((program) => {
      const row = document.createElement("tr");
      const period = document.createElement("td");
      const strong = document.createElement("strong");
      strong.textContent = `${MONTHS[program.month]} ${program.year}`;
      period.append(strong);
      const congregation = document.createElement("td");
      congregation.textContent = program.congregationName;
      const statusCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `badge badge-${program.status}`;
      badge.textContent = program.status === "final" ? "Finalizado" : "Borrador";
      statusCell.append(badge);
      const modified = document.createElement("td");
      modified.textContent = formatTimestamp(program.updatedAt);
      const actions = document.createElement("td");
      actions.className = "actions";
      [
        ["edit", "Editar"],
        ["preview", "Ver"],
        ["duplicate", "Duplicar"],
        ["delete", "Eliminar"]
      ].forEach(([action, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.action = action;
        button.dataset.id = program.id;
        button.textContent = label;
        if (action === "delete") button.className = "danger-link";
        actions.append(button);
      });
      row.append(period, congregation, statusCell, modified, actions);
      body.append(row);
    });
    document.getElementById("empty-programs").hidden = programs.length > 0;
    document.querySelector(".table-panel .responsive-table").hidden = programs.length === 0;
  }

  function blankProgram() {
    const now = new Date();
    return {
      id: uid("program"),
      congregationName: "",
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      status: "draft",
      updatedAt: new Date().toISOString(),
      covers: { left: "", right: "" },
      publicTalks: [],
      outgoingTalks: [],
      watchtowerAssignments: []
    };
  }

  function openEditor(programId) {
    const source = programId
      ? state.programs.find((program) => program.id === programId)
      : blankProgram();
    if (!source) return;
    const program = clone(source);
    editingId = program.id;
    editorCovers = clone(program.covers || { left: "", right: "" });
    document.getElementById("editor-title").textContent = programId
      ? "Editar programa"
      : "Crear programa mensual";
    document.getElementById("congregation-name").value = program.congregationName;
    document.getElementById("program-month").value = String(program.month);
    document.getElementById("program-year").value = String(program.year);
    document.getElementById("program-status").value = program.status;
    renderEditorRows("public", program.publicTalks);
    renderEditorRows("outgoing", program.outgoingTalks);
    renderEditorRows("watchtower", program.watchtowerAssignments);
    renderCoverPreview("left");
    renderCoverPreview("right");
    updateDatalists();
    showView("editor");
  }

  function makeInput(field, value = "", options = {}) {
    const input = document.createElement("input");
    input.dataset.field = field;
    input.value = value ?? "";
    input.type = options.type || "text";
    if (options.list) input.setAttribute("list", options.list);
    if (options.min !== undefined) input.min = String(options.min);
    if (options.max !== undefined) input.max = String(options.max);
    if (options.maxLength) input.maxLength = options.maxLength;
    if (options.placeholder) input.placeholder = options.placeholder;
    return input;
  }

  function inputCell(input, className = "") {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.append(input);
    return cell;
  }

  function renderEditorRows(type, rows) {
    const body = document.querySelector(`[data-rows="${type}"]`);
    body.replaceChildren();
    rows.forEach((row) => addEditorRow(type, row));
  }

  function addEditorRow(type, data = {}) {
    const body = document.querySelector(`[data-rows="${type}"]`);
    const row = document.createElement("tr");
    row.className = "formset-row";
    row.dataset.id = data.id || uid(type);
    const drag = document.createElement("td");
    drag.className = "drag-cell";
    drag.textContent = "⋮⋮";
    row.append(drag, inputCell(makeInput("date", data.date, { type: "date" })));

    if (type === "public" || type === "outgoing") {
      row.append(
        inputCell(makeInput("speaker", data.speaker, { list: "people-list", maxLength: 160 })),
        inputCell(makeInput("talkNumber", data.talkNumber, { type: "number", min: 0, max: 999 }), "talk-number"),
        inputCell(makeInput("talkTitle", data.talkTitle, { list: "talk-titles-list", maxLength: 260 }))
      );
      if (type === "public") {
        row.append(
          inputCell(makeInput("congregation", data.congregation, { list: "congregations-list", maxLength: 160 })),
          inputCell(makeInput("hospitality", data.hospitality, { list: "hospitality-list", maxLength: 100 }))
        );
      }
    } else {
      row.append(
        inputCell(makeInput("chairman", data.chairman, { list: "people-list", maxLength: 160 })),
        inputCell(makeInput("reader", data.reader, { list: "people-list", maxLength: 160 }))
      );
    }

    const actions = document.createElement("td");
    actions.className = "row-actions";
    [
      ["move-up", "↑", "Subir fila"],
      ["move-down", "↓", "Bajar fila"],
      ["remove-row", "×", "Eliminar fila"]
    ].forEach(([className, label, ariaLabel]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `icon-button ${className}${className === "remove-row" ? " danger" : ""}`;
      button.textContent = label;
      button.setAttribute("aria-label", ariaLabel);
      actions.append(button);
    });
    row.append(actions);
    body.append(row);
  }

  function rowIsEmpty(row) {
    return [...row.querySelectorAll("input")].every((input) => !input.value.trim());
  }

  function markInvalid(input) {
    input.classList.add("invalid");
  }

  function validIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function collectRows(type, errors) {
    const results = [];
    const rows = [...document.querySelectorAll(`[data-rows="${type}"] .formset-row`)];
    rows.forEach((row, index) => {
      const fields = {};
      row.querySelectorAll("input[data-field]").forEach((input) => {
        input.classList.remove("invalid");
        fields[input.dataset.field] = input.value.trim();
      });
      if (rowIsEmpty(row)) return;

      const required = type === "watchtower"
        ? ["date", "chairman", "reader"]
        : ["date", "speaker", "talkNumber", "talkTitle"];
      required.forEach((field) => {
        if (!fields[field]) {
          markInvalid(row.querySelector(`[data-field="${field}"]`));
          errors.push(`Completa la fila ${index + 1} de ${sectionLabel(type)}.`);
        }
      });
      if (fields.date && !validIsoDate(fields.date)) {
        markInvalid(row.querySelector('[data-field="date"]'));
        errors.push(`La fecha de la fila ${index + 1} no es válida.`);
      }
      if (type !== "watchtower" && fields.talkNumber) {
        const number = Number(fields.talkNumber);
        if (!Number.isInteger(number) || number < 1 || number > 999) {
          markInvalid(row.querySelector('[data-field="talkNumber"]'));
          errors.push(`El número de discurso de la fila ${index + 1} no es válido.`);
        }
        fields.talkNumber = number;
      }
      results.push({ id: row.dataset.id || uid(type), ...fields });
    });
    return results;
  }

  function sectionLabel(type) {
    return {
      public: "discursos públicos",
      outgoing: "salidas de discursantes",
      watchtower: "La Atalaya y presidencia"
    }[type];
  }

  function collectEditorProgram() {
    const errors = [];
    const congregationInput = document.getElementById("congregation-name");
    const monthInput = document.getElementById("program-month");
    const yearInput = document.getElementById("program-year");
    [congregationInput, monthInput, yearInput].forEach((input) => input.classList.remove("invalid"));

    const congregationName = congregationInput.value.trim();
    const month = Number(monthInput.value);
    const year = Number(yearInput.value);
    if (!congregationName) {
      markInvalid(congregationInput);
      errors.push("Indica el nombre de la congregación.");
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      markInvalid(monthInput);
      errors.push("Selecciona un mes válido.");
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      markInvalid(yearInput);
      errors.push("El año debe estar entre 2000 y 2100.");
    }

    const publicTalks = collectRows("public", errors);
    const outgoingTalks = collectRows("outgoing", errors);
    const watchtowerAssignments = collectRows("watchtower", errors);
    if (errors.length) {
      showMessage(errors[0], "error");
      document.querySelector(".invalid")?.focus();
      return null;
    }
    return {
      id: editingId || uid("program"),
      congregationName,
      month,
      year,
      status: document.getElementById("program-status").value,
      updatedAt: new Date().toISOString(),
      covers: clone(editorCovers),
      publicTalks,
      outgoingTalks,
      watchtowerAssignments
    };
  }

  function duplicatedValues(program) {
    const warnings = [];
    [
      ["discursos públicos", program.publicTalks],
      ["salidas", program.outgoingTalks],
      ["asignaciones de La Atalaya", program.watchtowerAssignments]
    ].forEach(([label, rows]) => {
      const dates = rows.map((row) => row.date).filter(Boolean);
      if (new Set(dates).size !== dates.length) {
        warnings.push(`Hay fechas repetidas en ${label}.`);
      }
    });
    return warnings;
  }

  function saveProgram(openPreviewAfter = false) {
    const program = collectEditorProgram();
    if (!program) return null;
    const index = state.programs.findIndex((item) => item.id === program.id);
    if (index >= 0) state.programs[index] = clone(program);
    else state.programs.push(clone(program));
    updateCatalogsFromProgram(program);
    const stored = persistState();
    editingId = program.id;
    const warnings = duplicatedValues(program);
    if (warnings.length) showMessage(warnings.join(" "), "warning");
    else if (stored) showMessage("El programa se guardó en este navegador.");
    renderProgramList();
    if (openPreviewAfter) openPreview(program);
    return program;
  }

  function sundaysForMonth(year, month) {
    const dates = [];
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCDay() === 0) dates.push(date.toISOString().slice(0, 10));
    }
    return dates;
  }

  function generateSundays(type) {
    const year = Number(document.getElementById("program-year").value);
    const month = Number(document.getElementById("program-month").value);
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || month < 1 || month > 12) {
      showMessage("Selecciona primero un mes y un año válidos.", "error");
      return;
    }
    const existing = new Set(
      [...document.querySelectorAll(`[data-rows="${type}"] [data-field="date"]`)]
        .map((input) => input.value)
        .filter(Boolean)
    );
    sundaysForMonth(year, month).forEach((date) => {
      if (!existing.has(date)) addEditorRow(type, { date });
    });
  }

  function renderCoverPreview(side) {
    const container = document.getElementById(`preview-${side}`);
    container.replaceChildren();
    if (editorCovers[side]) {
      const image = document.createElement("img");
      image.src = editorCovers[side];
      image.alt = `Vista previa de la portada ${side === "left" ? "izquierda" : "derecha"}`;
      container.append(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.textContent = side === "left" ? "Portada izquierda" : "Portada derecha";
      container.append(placeholder);
    }
  }

  function readCover(side, file) {
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      showMessage("Usa una imagen JPG, JPEG, PNG o WEBP.", "error");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showMessage("La imagen no puede superar los 5 MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      editorCovers[side] = String(reader.result);
      renderCoverPreview(side);
    };
    reader.onerror = () => showMessage("No se pudo leer la imagen seleccionada.", "error");
    reader.readAsDataURL(file);
  }

  function openPreview(program) {
    previewProgram = clone(program);
    document.getElementById("doc-congregation").textContent = program.congregationName.toUpperCase();
    document.getElementById("doc-subtitle").textContent =
      `REUNIÓN PÚBLICA Y ESTUDIO DE LA ATALAYA ${MONTHS[program.month].toUpperCase()} ${program.year}`;
    renderDocumentRows("public", program.publicTalks);
    renderDocumentRows("outgoing", program.outgoingTalks);
    renderDocumentRows("watchtower", program.watchtowerAssignments);
    renderDocumentCover("left", program.covers?.left);
    renderDocumentCover("right", program.covers?.right);
    showView("preview");
    window.requestAnimationFrame(() => {
      const page = document.getElementById("program-document");
      document.getElementById("overflow-warning").hidden =
        page.scrollHeight <= page.clientHeight + 2;
    });
  }

  function makeCell(text, options = {}) {
    const cell = document.createElement("td");
    if (options.strongPrefix) {
      const strong = document.createElement("strong");
      strong.textContent = options.strongPrefix;
      cell.append(strong, document.createTextNode(` “${text}”`));
    } else {
      cell.textContent = text || "";
    }
    return cell;
  }

  function renderDocumentRows(type, rows) {
    const body = document.getElementById(`doc-${type}-rows`);
    body.replaceChildren();
    if (!rows.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.className = "empty-cell";
      cell.colSpan = type === "public" ? 5 : 3;
      cell.textContent = "Sin asignaciones";
      row.append(cell);
      body.append(row);
      return;
    }
    rows.forEach((item) => {
      const row = document.createElement("tr");
      if (type === "public") {
        row.append(
          makeCell(formatDate(item.date)),
          makeCell(item.speaker),
          makeCell(item.talkTitle, { strongPrefix: String(item.talkNumber) }),
          makeCell(item.congregation),
          makeCell(item.hospitality)
        );
      } else if (type === "outgoing") {
        row.append(
          makeCell(formatDate(item.date)),
          makeCell(item.speaker),
          makeCell(item.talkTitle, { strongPrefix: String(item.talkNumber) })
        );
      } else {
        row.append(makeCell(formatDate(item.date)), makeCell(item.chairman), makeCell(item.reader));
      }
      body.append(row);
    });
  }

  function renderDocumentCover(side, source) {
    const container = document.getElementById(`doc-cover-${side}`);
    container.replaceChildren();
    if (source) {
      const image = document.createElement("img");
      image.src = source;
      image.alt = `Portada ${side === "left" ? "izquierda" : "derecha"} de La Atalaya`;
      container.append(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.textContent = "PORTADA DE LA REVISTA";
      container.append(placeholder);
    }
  }

  function printProgram() {
    if (!previewProgram) return;
    const previousTitle = document.title;
    document.title = `programa-reunion-publica-${slugify(previewProgram.congregationName)}-${MONTHS[previewProgram.month].toLowerCase()}-${previewProgram.year}`;
    window.print();
    window.setTimeout(() => { document.title = previousTitle; }, 500);
  }

  function updateCatalogsFromProgram(program) {
    ensureNamedCatalog("congregations", program.congregationName);
    program.publicTalks.forEach((row) => {
      ensureNamedCatalog("people", row.speaker);
      ensureNamedCatalog("congregations", row.congregation);
      ensureNamedCatalog("hospitality", row.hospitality);
      ensureTalk(row.talkNumber, row.talkTitle);
    });
    program.outgoingTalks.forEach((row) => {
      ensureNamedCatalog("people", row.speaker);
      ensureTalk(row.talkNumber, row.talkTitle);
    });
    program.watchtowerAssignments.forEach((row) => {
      ensureNamedCatalog("people", row.chairman);
      ensureNamedCatalog("people", row.reader);
    });
    updateDatalists();
  }

  function ensureNamedCatalog(type, name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    if (!state.catalogs[type].some((item) => normalize(item.name) === normalize(trimmed))) {
      state.catalogs[type].push({
        id: uid(type),
        name: trimmed,
        active: true,
        ...(type === "people" ? { note: "" } : {})
      });
    }
  }

  function ensureTalk(number, title) {
    if (!number || !String(title || "").trim()) return;
    if (!state.catalogs.talks.some((item) =>
      Number(item.number) === Number(number) && normalize(item.title) === normalize(title)
    )) {
      state.catalogs.talks.push({
        id: uid("talk"), number: Number(number), title: String(title).trim(), active: true
      });
    }
  }

  function updateDatalists() {
    const mappings = [
      ["people-list", state.catalogs.people, (item) => item.name],
      ["congregations-list", state.catalogs.congregations, (item) => item.name],
      ["hospitality-list", state.catalogs.hospitality, (item) => item.name],
      ["talk-titles-list", state.catalogs.talks, (item) => item.title]
    ];
    mappings.forEach(([id, items, value]) => {
      const list = document.getElementById(id);
      list.replaceChildren();
      items.filter((item) => item.active).forEach((item) => {
        const option = document.createElement("option");
        option.value = value(item);
        if (item.number) option.label = String(item.number);
        list.append(option);
      });
    });
  }

  const catalogMeta = {
    people: { singular: "persona", label: "Personas" },
    congregations: { singular: "congregación", label: "Congregaciones" },
    talks: { singular: "discurso", label: "Discursos" },
    hospitality: { singular: "grupo", label: "Hospitalidad" }
  };

  function renderCatalogForm() {
    const form = document.getElementById("catalog-form");
    form.replaceChildren();
    document.getElementById("catalog-form-title").textContent =
      `Agregar ${catalogMeta[activeCatalog].singular}`;
    if (activeCatalog === "talks") {
      form.append(
        catalogField("Número", "catalog-number", "number", { min: 1, max: 999 }),
        catalogField("Título", "catalog-title", "text")
      );
    } else {
      form.append(catalogField("Nombre", "catalog-name", "text"));
      if (activeCatalog === "people") {
        const label = document.createElement("label");
        label.className = "field";
        label.textContent = "Observación";
        const textarea = document.createElement("textarea");
        textarea.id = "catalog-note";
        textarea.rows = 3;
        label.append(textarea);
        form.append(label);
      }
    }
    const button = document.createElement("button");
    button.type = "submit";
    button.className = "button button-primary";
    button.textContent = "Guardar";
    form.append(button);
  }

  function catalogField(labelText, id, type, attrs = {}) {
    const label = document.createElement("label");
    label.className = "field";
    label.textContent = labelText;
    const input = document.createElement("input");
    input.id = id;
    input.type = type;
    input.required = true;
    if (attrs.min) input.min = String(attrs.min);
    if (attrs.max) input.max = String(attrs.max);
    label.append(input);
    return label;
  }

  function catalogDisplay(item) {
    return activeCatalog === "talks" ? `${item.number} ${item.title}` : item.name;
  }

  function renderCatalog() {
    document.querySelectorAll("[data-catalog]").forEach((button) => {
      button.classList.toggle("active", button.dataset.catalog === activeCatalog);
    });
    renderCatalogForm();
    const body = document.getElementById("catalog-body");
    body.replaceChildren();
    const items = [...state.catalogs[activeCatalog]].sort((a, b) =>
      catalogDisplay(a).localeCompare(catalogDisplay(b), "es", { numeric: true })
    );
    items.forEach((item) => {
      const row = document.createElement("tr");
      const value = document.createElement("td");
      const strong = document.createElement("strong");
      strong.textContent = catalogDisplay(item);
      value.append(strong);
      if (item.note) {
        const note = document.createElement("small");
        note.className = "table-note";
        note.textContent = item.note;
        value.append(note);
      }
      const status = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `badge ${item.active ? "badge-final" : "badge-inactive"}`;
      badge.textContent = item.active ? "Activo" : "Inactivo";
      status.append(badge);
      const actions = document.createElement("td");
      actions.className = "actions";
      [["edit", "Editar"], ["toggle", item.active ? "Desactivar" : "Activar"]]
        .forEach(([action, label]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.catalogAction = action;
          button.dataset.id = item.id;
          button.textContent = label;
          actions.append(button);
        });
      row.append(value, status, actions);
      body.append(row);
    });
  }

  function addCatalogItem() {
    if (activeCatalog === "talks") {
      const number = Number(document.getElementById("catalog-number").value);
      const title = document.getElementById("catalog-title").value.trim();
      if (!Number.isInteger(number) || number < 1 || number > 999 || !title) {
        showMessage("Indica un número válido y el título del discurso.", "error");
        return;
      }
      if (state.catalogs.talks.some((item) =>
        item.number === number && normalize(item.title) === normalize(title)
      )) {
        showMessage("Ese discurso ya existe.", "warning");
        return;
      }
      state.catalogs.talks.push({ id: uid("talk"), number, title, active: true });
    } else {
      const name = document.getElementById("catalog-name").value.trim();
      if (!name) {
        showMessage("Escribe un nombre.", "error");
        return;
      }
      if (state.catalogs[activeCatalog].some((item) => normalize(item.name) === normalize(name))) {
        showMessage("Ese elemento ya existe.", "warning");
        return;
      }
      state.catalogs[activeCatalog].push({
        id: uid(activeCatalog),
        name,
        active: true,
        ...(activeCatalog === "people"
          ? { note: document.getElementById("catalog-note").value.trim() }
          : {})
      });
    }
    persistState();
    updateDatalists();
    renderCatalog();
    showMessage("El elemento se agregó al catálogo.");
  }

  function editCatalogItem(item) {
    if (activeCatalog === "talks") {
      const numberValue = window.prompt("Número del discurso:", String(item.number));
      if (numberValue === null) return;
      const titleValue = window.prompt("Título del discurso:", item.title);
      if (titleValue === null) return;
      const number = Number(numberValue);
      const title = titleValue.trim();
      if (!Number.isInteger(number) || number < 1 || number > 999 || !title) {
        showMessage("Los datos del discurso no son válidos.", "error");
        return;
      }
      item.number = number;
      item.title = title;
    } else {
      const name = window.prompt("Nombre:", item.name);
      if (name === null || !name.trim()) return;
      item.name = name.trim();
      if (activeCatalog === "people") {
        const note = window.prompt("Observación:", item.note || "");
        if (note !== null) item.note = note.trim();
      }
    }
    persistState();
    updateDatalists();
    renderCatalog();
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `respaldo-programas-reuniones-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (!imported || !Array.isArray(imported.programs) || !imported.catalogs) {
          throw new Error("Estructura inválida");
        }
        if (!window.confirm("¿Reemplazar los programas y catálogos de este navegador con el respaldo importado?")) {
          return;
        }
        state.version = 3;
        state.programs = imported.programs;
        state.catalogs = imported.catalogs;
        persistState();
        updateDatalists();
        renderProgramList();
        showMessage("El respaldo se importó correctamente.");
      } catch (error) {
        showMessage("El archivo no es un respaldo válido.", "error");
      }
    };
    reader.onerror = () => showMessage("No se pudo leer el respaldo.", "error");
    reader.readAsText(file);
  }

  function bindEvents() {
    document.querySelectorAll("[data-route]").forEach((button) => {
      button.addEventListener("click", () => showView(button.dataset.route));
    });
    document.querySelectorAll("[data-new-program]").forEach((button) => {
      button.addEventListener("click", () => openEditor(null));
    });
    ["filter-year", "filter-month", "filter-status"].forEach((id) => {
      document.getElementById(id).addEventListener("change", renderProgramList);
    });
    document.getElementById("clear-filters").addEventListener("click", () => {
      document.getElementById("filter-year").value = "";
      document.getElementById("filter-month").value = "";
      document.getElementById("filter-status").value = "";
      renderProgramList();
    });
    document.getElementById("program-list-body").addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const program = state.programs.find((item) => item.id === button.dataset.id);
      if (!program) return;
      if (button.dataset.action === "edit") openEditor(program.id);
      if (button.dataset.action === "preview") {
        editingId = program.id;
        openPreview(program);
      }
      if (button.dataset.action === "duplicate") {
        const copy = clone(program);
        copy.id = uid("program");
        copy.congregationName = `${copy.congregationName} (copia)`;
        copy.status = "draft";
        copy.updatedAt = new Date().toISOString();
        [...copy.publicTalks, ...copy.outgoingTalks, ...copy.watchtowerAssignments]
          .forEach((row) => { row.id = uid("row"); });
        state.programs.push(copy);
        persistState();
        renderProgramList();
        showMessage("Se creó una copia editable.");
      }
      if (button.dataset.action === "delete" &&
          window.confirm(`¿Eliminar el programa de ${MONTHS[program.month]} ${program.year}?`)) {
        state.programs = state.programs.filter((item) => item.id !== program.id);
        persistState();
        renderProgramList();
        showMessage("El programa se eliminó.");
      }
    });

    document.querySelectorAll(".row-section").forEach((section) => {
      const type = section.dataset.rowType;
      section.querySelector(".add-row").addEventListener("click", () => addEditorRow(type));
      section.querySelector(".generate-sundays")?.addEventListener("click", () => generateSundays(type));
      section.addEventListener("click", (event) => {
        const row = event.target.closest(".formset-row");
        if (!row) return;
        if (event.target.closest(".remove-row") &&
            window.confirm("¿Eliminar esta fila?")) {
          row.remove();
        }
        if (event.target.closest(".move-up") && row.previousElementSibling) {
          row.previousElementSibling.before(row);
        }
        if (event.target.closest(".move-down") && row.nextElementSibling) {
          row.nextElementSibling.after(row);
        }
      });
      section.addEventListener("change", (event) => {
        const input = event.target;
        if (input.dataset.field !== "talkTitle") return;
        const talk = state.catalogs.talks.find((item) =>
          item.active && normalize(item.title) === normalize(input.value)
        );
        const numberInput = input.closest("tr").querySelector('[data-field="talkNumber"]');
        if (talk && !numberInput.value) numberInput.value = String(talk.number);
      });
    });

    document.getElementById("save-draft").addEventListener("click", () => saveProgram(false));
    document.getElementById("save-preview").addEventListener("click", () => saveProgram(true));
    document.getElementById("editor-preview-top").addEventListener("click", () => {
      const program = collectEditorProgram();
      if (program) openPreview(program);
    });
    document.getElementById("print-from-editor").addEventListener("click", () => {
      const program = collectEditorProgram();
      if (program) openPreview(program);
    });
    document.getElementById("back-to-editor").addEventListener("click", () => {
      if (editingId && state.programs.some((program) => program.id === editingId)) {
        openEditor(editingId);
      } else {
        showView("editor");
      }
    });
    document.getElementById("preview-edit").addEventListener("click", () => {
      if (previewProgram && state.programs.some((program) => program.id === previewProgram.id)) {
        openEditor(previewProgram.id);
      } else {
        showView("editor");
      }
    });
    document.getElementById("print-program").addEventListener("click", printProgram);

    document.getElementById("cover-left").addEventListener("change", (event) => {
      readCover("left", event.target.files[0]);
      event.target.value = "";
    });
    document.getElementById("cover-right").addEventListener("change", (event) => {
      readCover("right", event.target.files[0]);
      event.target.value = "";
    });
    document.querySelectorAll(".remove-cover").forEach((button) => {
      button.addEventListener("click", () => {
        editorCovers[button.dataset.cover] = "";
        renderCoverPreview(button.dataset.cover);
      });
    });

    document.getElementById("catalog-tabs").addEventListener("click", (event) => {
      const button = event.target.closest("[data-catalog]");
      if (!button) return;
      activeCatalog = button.dataset.catalog;
      renderCatalog();
    });
    document.getElementById("catalog-form").addEventListener("submit", (event) => {
      event.preventDefault();
      addCatalogItem();
    });
    document.getElementById("catalog-body").addEventListener("click", (event) => {
      const button = event.target.closest("[data-catalog-action]");
      if (!button) return;
      const item = state.catalogs[activeCatalog].find((entry) => entry.id === button.dataset.id);
      if (!item) return;
      if (button.dataset.catalogAction === "toggle") {
        item.active = !item.active;
        persistState();
        updateDatalists();
        renderCatalog();
      } else {
        editCatalogItem(item);
      }
    });
    document.getElementById("export-json").addEventListener("click", exportBackup);
    document.getElementById("import-json").addEventListener("change", (event) => {
      importBackup(event.target.files[0]);
      event.target.value = "";
    });
  }

  setupMonthSelects();
  updateDatalists();
  bindEvents();
  renderProgramList();
  showView("programs");
})();
