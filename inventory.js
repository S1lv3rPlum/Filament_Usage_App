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
  window.location.href = "home2.html";
}
window.smartBack = smartBack;

// ----- Inventory table rendering & inline editing -----
function renderInventoryTable() {
  const tbody = document.querySelector("#inventoryTable tbody");
  tbody.innerHTML = "";

  if (spoolLibrary.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "No spools in inventory";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  spoolLibrary.forEach((spool, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;

    tr.innerHTML = `
      <td class="cell-brand"><span>${escapeHtml(spool.brand)}</span></td>
      <td class="cell-color"><span>${escapeHtml(spool.color)}</span></td>
      <td class="cell-material"><span>${escapeHtml(spool.material)}</span></td>
      <td class="cell-length"><span>${Number(spool.length).toFixed(2)}</span></td>
      <td class="cell-weight"><span>${Number(spool.weight).toFixed(2)}</span></td>
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
    `<input type="number" step="0.01" class="row-length" value="${Number(data.length)}" />`;
  tr.querySelector(".cell-weight").innerHTML =
    `<input type="number" step="0.01" class="row-weight" value="${Number(data.weight)}" />`;

  tr.querySelector(".edit-btn").classList.add("hidden");
  tr.querySelector(".save-btn").classList.add("hidden");
  tr.querySelector(".cancel-btn").classList.remove("hidden");

  getRowInputs(tr).forEach(el => el.addEventListener("input", () => updateSaveVisibility(tr)));
}

function exitEditMode(tr, useLatest = true) {
  const idx = Number(tr.dataset.index);
  const data = useLatest ? spoolLibrary[idx] : tr._orig;

  tr.querySelector(".cell-brand").innerHTML = `<span>${escapeHtml(data.brand)}</span>`;
  tr.querySelector(".cell-color").innerHTML = `<span>${escapeHtml(data.color)}</span>`;
  tr.querySelector(".cell-material").innerHTML = `<span>${escapeHtml(data.material)}</span>`;
  tr.querySelector(".cell-length").innerHTML = `<span>${Number(data.length).toFixed(2)}</span>`;
  tr.querySelector(".cell-weight").innerHTML = `<span>${Number(data.weight).toFixed(2)}</span>`;

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
  ].filter(Boolean);
}

function currentRowValues(tr) {
  const [brandEl, colorEl, matSel, matCustom, lengthEl, weightEl] = getRowInputs(tr);

  let material = matSel ? matSel.value : "";
  if (material === "Custom") {
    const val = (matCustom?.value || "").trim();
    material = val || "";
  }

  return {
    brand: (brandEl?.value || "").trim(),
    color: (colorEl?.value || "").trim(),
    material: (material || "").trim(),
    length: parseFloat(lengthEl?.value),
    weight: parseFloat(weightEl?.value),
  };
}

function hasChanges(tr) {
  const now = currentRowValues(tr);
  const orig = tr._orig || {};
  return (
    now.brand !== orig.brand ||
    now.color !== orig.color ||
    now.material !== orig.material ||
    (isNaN(now.length) ? "" : now.length) !== (isNaN(orig.length) ? "" : Number(orig.length)) ||
    (isNaN(now.weight) ? "" : now.weight) !== (isNaN(orig.weight) ? "" : Number(orig.weight))
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
  if (isNaN(vals.length) || isNaN(vals.weight)) {
    alert("Length and Weight must be numbers.");
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