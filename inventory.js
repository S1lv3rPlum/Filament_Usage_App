// ----- Data Storage (shared keys with home2.js) -----
let spoolLibrary = JSON.parse(localStorage.getItem("spoolLibrary")) || [];
let materialsList = JSON.parse(localStorage.getItem("materialsList")) || [
  "PLA", "ABS", "PETG", "Nylon", "TPU", "Custom"
];

// ----- Utils -----
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

// ----- Add Form: material dropdown + custom toggle -----
function populateMaterialDropdown() {
  const select = document.getElementById("materialSelect");
  select.innerHTML = "";
  materialsList.forEach(material => {
    const option = document.createElement("option");
    option.value = material;
    option.textContent = material;
    select.appendChild(option);
  });
  select.value = materialsList[0];
  const custom = document.getElementById("customMaterialInput");
  custom.classList.add("hidden");
  custom.value = "";
}

function handleMaterialChange() {
  const select = document.getElementById("materialSelect");
  const custom = document.getElementById("customMaterialInput");
  if (select.value === "Custom") {
    custom.classList.remove("hidden");
  } else {
    custom.classList.add("hidden");
    custom.value = "";
  }
}

// ----- Add Form: save new spool -----
function saveNewSpool() {
  const brand = document.getElementById("brand").value.trim();
  const color = document.getElementById("color").value.trim();

  const materialSelect = document.getElementById("materialSelect");
  let material = materialSelect.value;

  const customMaterial = document.getElementById("customMaterialInput").value.trim();

  if (material === "Custom") {
    if (!customMaterial) {
      alert("Please enter a custom material.");
      return;
    }
    material = customMaterial;

    // Insert new custom material before "Custom"
    if (!materialsList.includes(material)) {
      const customIndex = materialsList.indexOf("Custom");
      const insertAt = customIndex === -1 ? materialsList.length : customIndex;
      materialsList.splice(insertAt, 0, material);
      saveMaterialsList();
    }
  }

  const length = parseFloat(document.getElementById("length").value);
  const weight = parseFloat(document.getElementById("weight").value);

  if (!brand || !color || !material) {
    alert("Brand, Color, and Material are required.");
    return;
  }
  if (isNaN(length) || isNaN(weight)) {
    alert("Length and Weight must be numbers.");
    return;
  }

  spoolLibrary.push({ brand, color, material, length, weight });
  saveSpoolLibrary();

  // reset form
  document.getElementById("brand").value = "";
  document.getElementById("color").value = "";
  populateMaterialDropdown();
  document.getElementById("length").value = "";
  document.getElementById("weight").value = "";

  alert("Spool saved!");
  renderInventoryTable();
}

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
  // ensure currentValue is present
  const list = [...materialsList];
  if (!list.includes(currentValue) && currentValue !== "Custom") list.splice(Math.max(0, list.length - 1), 0, currentValue);
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

  // Store original values on the row element
  tr._orig = { ...data };

  // brand
  const brandCell = tr.querySelector(".cell-brand");
  brandCell.innerHTML = `<input type="text" class="row-brand" value="${escapeHtml(data.brand)}" />`;

  // color
  const colorCell = tr.querySelector(".cell-color");
  colorCell.innerHTML = `<input type="text" class="row-color" value="${escapeHtml(data.color)}" />`;

  // material (select + optional custom)
  const materialCell = tr.querySelector(".cell-material");
  materialCell.innerHTML = "";
  const matControl = buildMaterialSelectForRow(data.material);
  materialCell.appendChild(matControl);

  // length
  const lengthCell = tr.querySelector(".cell-length");
  lengthCell.innerHTML = `<input type="number" step="0.01" class="row-length" value="${Number(data.length)}" />`;

  // weight
  const weightCell = tr.querySelector(".cell-weight");
  weightCell.innerHTML = `<input type="number" step="0.01" class="row-weight" value="${Number(data.weight)}" />`;

  // buttons
  tr.querySelector(".edit-btn").classList.add("hidden");
  tr.querySelector(".save-btn").classList.add("hidden"); // show only when changed
  tr.querySelector(".cancel-btn").classList.remove("hidden");

  // change detection → show Save only when something changes
  const inputs = getRowInputs(tr);
  inputs.forEach(el => el.addEventListener("input", () => updateSaveVisibility(tr)));
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
  const brand = tr.querySelector(".row-brand");
  const color = tr.querySelector(".row-color");
  const matSelect = tr.querySelector(".row-material-select");
  const matCustom = tr.querySelector(".row-custom-material-input");
  const length = tr.querySelector(".row-length");
  const weight = tr.querySelector(".row-weight");
  return [brand, color, matSelect, matCustom, length, weight].filter(Boolean);
}

function currentRowValues(tr) {
  const [brandEl, colorEl, matSel, matCustom, lengthEl, weightEl] = getRowInputs(tr);

  let material = matSel ? matSel.value : "";
  if (material === "Custom") {
    const val = (matCustom?.value || "").trim();
    material = val || ""; // empty if not provided -> will fail validation
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
  const changed = hasChanges(tr);
  tr.querySelector(".save-btn").classList.toggle("hidden", !changed);
}

function onEditRow(e) {
  const tr = e.target.closest("tr");
  enterEditMode(tr);
}

function onCancelRow(e) {
  const tr = e.target.closest("tr");
  exitEditMode(tr, false); // revert to original values
}

function onSaveRow(e) {
  const tr = e.target.closest("tr");
  if (!hasChanges(tr)) {
    // nothing changed; keep hidden but allow exit if desired
    exitEditMode(tr, true);
    return;
  }

  const idx = Number(tr.dataset.index);
  const vals = currentRowValues(tr);

  // Validation
  if (!vals.brand || !vals.color || !vals.material) {
    alert("Brand, Color, and Material cannot be empty.");
    return;
  }
  if (isNaN(vals.length) || isNaN(vals.weight)) {
    alert("Length and Weight must be numbers.");
    return;
  }

  // If material is new, insert before "Custom"
  if (!materialsList.includes(vals.material)) {
    const customIndex = materialsList.indexOf("Custom");
    const insertAt = customIndex === -1 ? materialsList.length : customIndex;
    materialsList.splice(insertAt, 0, vals.material);
    saveMaterialsList();
  }

  // Save to library (row-level save)
  spoolLibrary[idx] = {
    brand: vals.brand,
    color: vals.color,
    material: vals.material,
    length: vals.length,
    weight: vals.weight
  };
  saveSpoolLibrary();

  // Update UI in place
  exitEditMode(tr, true);
}

// ----- Init -----
document.addEventListener("DOMContentLoaded", () => {
  populateMaterialDropdown();
  document.getElementById("materialSelect").addEventListener("change", handleMaterialChange);
  document.getElementById("saveSpoolBtn").addEventListener("click", saveNewSpool);
  renderInventoryTable();
});