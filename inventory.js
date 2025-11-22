// ----- Data Storage -----
let spoolLibrary = JSON.parse(localStorage.getItem("spoolLibrary")) || [];
let materialsList = JSON.parse(localStorage.getItem("materialsList")) || [
  "PLA", "ABS", "PETG", "Nylon", "TPU", "Custom"
];

function saveSpoolLibrary() {
  localStorage.setItem("spoolLibrary", JSON.stringify(spoolLibrary));
}
function saveMaterialsList() {
  localStorage.setItem("materialsList", JSON.stringify(materialsList));
}
function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function smartBack() {
  try {
    if (document.referrer && new URL(document.referrer).origin === location.origin) {
      history.back();
      return;
    }
  } catch (_) {}
  window.location.href = "home.html";
}
window.smartBack = smartBack;

// Helper to get empty spool label by ID
function getEmptySpoolLabel(emptySpoolId) {
  const emptySpools = JSON.parse(localStorage.getItem("emptySpools")) || [];
  const emptySpool = emptySpools[emptySpoolId];
  if (emptySpool) {
    return `${emptySpool.brand} - ${emptySpool.package} (${emptySpool.weight}g)`;
  }
  return "";
}

// ----- Inventory table rendering & inline editing -----
function renderInventoryTable() {
  const tbody = document.querySelector("#inventoryTable tbody");
  tbody.innerHTML = "";

  if (spoolLibrary.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.textContent = "No spools in inventory";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  spoolLibrary.forEach((spool, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;

    const emptySpoolDisplay = spool.emptySpoolId !== null && spool.emptySpoolId !== undefined 
      ? getEmptySpoolLabel(spool.emptySpoolId) 
      : "None";

    tr.innerHTML = `
   <td class="cell-brand"><span>${escapeHtml(spool.brand)}</span></td>
   <td class="cell-color"><span>${escapeHtml(spool.color)}</span></td>
   <td class="cell-material"><span>${escapeHtml(spool.material)}</span></td>
   <td class="cell-length"><span>${spool.length > 0 ? Number(spool.length).toFixed(2) : 'N/A'}</span></td>
   <td class="cell-weight"><span>${Number(spool.weight).toFixed(2)}</span></td>
   <td class="cell-empty"><span>${emptySpoolDisplay}</span></td>
   <td class="cell-actions">
     <button class="edit-btn">Edit</button>
     <button class="save-btn hidden">Save</button>
     <button class="cancel-btn hidden">Cancel</button>
   </td>
`;

    tbody.appendChild(tr);
  });

  attachRowHandlers();
}

function attachRowHandlers() {
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", onEditRow);
  });
  document.querySelectorAll(".save-btn").forEach(btn => {
    btn.addEventListener("click", onSaveRow);
  });
  document.querySelectorAll(".cancel-btn").forEach(btn => {
    btn.addEventListener("click", onCancelRow);
  });
}

function buildMaterialSelectForRow(currentValue) {
  const sel = document.createElement("select");
  sel.className = "row-material-select";
  const list = [...materialsList];
  if (!list.includes(currentValue) && currentValue !== "Custom")
    list.splice(Math.max(0, list.length - 1), 0, currentValue);
  list.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  });
  sel.value = list.includes(currentValue) ? currentValue : currentValue;

  const customInput = document.createElement("input");
  customInput.type = "text";
  customInput.className = "row-custom-material-input hidden";
  customInput.placeholder = "Enter custom material";

  const wrapper = document.createElement("div");
  wrapper.appendChild(sel);
  wrapper.appendChild(customInput);

  sel.addEventListener("change", () => {
    if (sel.value === "Custom") {
      customInput.classList.remove("hidden");
    } else {
      customInput.classList.add("hidden");
      customInput.value = "";
    }
  });

  return wrapper;
}

function buildEmptySpoolSelectForRow(currentValue) {
  const emptySpools = JSON.parse(localStorage.getItem("emptySpools")) || [];
  const sel = document.createElement("select");
  sel.className = "row-empty-spool-select";

  // None option
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "None";
  sel.appendChild(noneOpt);

  // Existing empty spools
  emptySpools.forEach((spool, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = `${spool.brand} - ${spool.package} (${spool.weight}g)`;
    sel.appendChild(opt);
  });

  // Set current value
  sel.value = currentValue !== null && currentValue !== undefined ? currentValue : "";

  return sel;
}

function enterEditMode(tr) {
  const idx = Number(tr.dataset.index);
  const data = spoolLibrary[idx];
  tr._orig = { ...data };

  tr.querySelector(".cell-brand").innerHTML =
    `<input type="text" class="row-brand" value="${escapeHtml(data.brand)}" />`;
  tr.querySelector(".cell-color").innerHTML =
    `<input type="text" class="row-color" value="${escapeHtml(data.color)}" />`;

  const materialCell = tr.querySelector(".cell-material");
  materialCell.innerHTML = "";
  materialCell.appendChild(buildMaterialSelectForRow(data.material));

  tr.querySelector(".cell-length").innerHTML =
    `<input type="number" step="0.01" class="row-length" value="${Number(data.length) || 0}" />`;
  tr.querySelector(".cell-weight").innerHTML =
    `<input type="number" step="0.01" class="row-weight" value="${Number(data.weight)}" />`;

  const emptySpoolCell = tr.querySelector(".cell-empty");
  emptySpoolCell.innerHTML = "";
  emptySpoolCell.appendChild(buildEmptySpoolSelectForRow(data.emptySpoolId));

  tr.querySelector(".edit-btn").classList.add("hidden");
  tr.querySelector(".save-btn").classList.remove("hidden");
  tr.querySelector(".cancel-btn").classList.remove("hidden");

  getRowInputs(tr).forEach(el => el.addEventListener("input", () => updateSaveVisibility(tr)));
  getRowInputs(tr).forEach(el => el.addEventListener("change", () => updateSaveVisibility(tr)));
}

function exitEditMode(tr, useLatest = true) {
  const idx = Number(tr.dataset.index);
  const data = useLatest ? spoolLibrary[idx] : tr._orig;

  const emptySpoolDisplay = data.emptySpoolId !== null && data.emptySpoolId !== undefined 
    ? getEmptySpoolLabel(data.emptySpoolId) 
    : "None";

  tr.querySelector(".cell-brand").innerHTML = `<span>${escapeHtml(data.brand)}</span>`;
  tr.querySelector(".cell-color").innerHTML = `<span>${escapeHtml(data.color)}</span>`;
  tr.querySelector(".cell-material").innerHTML = `<span>${escapeHtml(data.material)}</span>`;
  tr.querySelector(".cell-length").innerHTML = `<span>${data.length > 0 ? Number(data.length).toFixed(2) : 'N/A'}</span>`;
  tr.querySelector(".cell-weight").innerHTML = `<span>${Number(data.weight).toFixed(2)}</span>`;
  tr.querySelector(".cell-empty").innerHTML = `<span>${emptySpoolDisplay}</span>`;

  tr.querySelector(".edit-btn").classList.remove("hidden");
  tr.querySelector(".save-btn").classList.add("hidden");
  tr.querySelector(".cancel-btn").classList.add("hidden");

  delete tr._orig;
}

function getRowInputs(tr) {
  return [
    tr.querySelector(".row-brand"),
    tr.querySelector(".row-color"),
    tr.querySelector(".row-material-select"),
    tr.querySelector(".row-custom-material-input"),
    tr.querySelector(".row-length"),
    tr.querySelector(".row-weight"),
    tr.querySelector(".row-empty-spool-select"),
  ].filter(Boolean);
}

function currentRowValues(tr) {
  const [brandEl, colorEl, matSel, matCustom, lengthEl, weightEl, emptySpoolSel] = getRowInputs(tr);

  let material = matSel ? matSel.value : "";
  if (material === "Custom") {
    const val = (matCustom?.value || "").trim();
    material = val || "";
  }

  const emptySpoolValue = emptySpoolSel?.value || "";
  const emptySpoolId = emptySpoolValue === "" ? null : Number(emptySpoolValue);

  return {
    brand: (brandEl?.value || "").trim(),
    color: (colorEl?.value || "").trim(),
    material: (material || "").trim(),
    length: parseFloat(lengthEl?.value) || 0,
    weight: parseFloat(weightEl?.value),
    emptySpoolId: emptySpoolId,
  };
}

function hasChanges(tr) {
  const now = currentRowValues(tr);
  const orig = tr._orig || {};
  return (
    now.brand !== orig.brand ||
    now.color !== orig.color ||
    now.material !== orig.material ||
    now.length !== (orig.length || 0) ||
    now.weight !== Number(orig.weight) ||
    now.emptySpoolId !== orig.emptySpoolId
  );
}

function updateSaveVisibility(tr) {
  tr.querySelector(".save-btn").classList.toggle("hidden", !hasChanges(tr));
}

function onEditRow(e) {
  enterEditMode(e.target.closest("tr"));
}
function onCancelRow(e) {
  exitEditMode(e.target.closest("tr"), false);
}
function onSaveRow(e) {
  const tr = e.target.closest("tr");
  if (!hasChanges(tr)) {
    exitEditMode(tr, true);
    return;
  }
  const idx = Number(tr.dataset.index);
  const vals = currentRowValues(tr);

  if (!vals.brand || !vals.color || !vals.material) {
    alert("Brand, Color, and Material cannot be empty.");
    return;
  }
  if (isNaN(vals.weight)) {
    alert("Weight must be a number.");
    return;
  }

  if (!materialsList.includes(vals.material)) {
    const customIndex = materialsList.indexOf("Custom");
    const insertAt = customIndex === -1 ? materialsList.length : customIndex;
    materialsList.splice(insertAt, 0, vals.material);
    saveMaterialsList();
  }

  spoolLibrary[idx] = vals;
  saveSpoolLibrary();
  exitEditMode(tr, true);
}

// ----- Init -----
document.addEventListener("DOMContentLoaded", renderInventoryTable);