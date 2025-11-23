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

// Helper to format color details for display
function formatColorDetails(spool) {
  const details = [];
  
  if (spool.colorType === "gradient" && spool.gradientColors) {
    details.push(`Gradient: ${spool.gradientColors}`);
  } else if (spool.colorType) {
    details.push(`Type: ${spool.colorType}`);
  }
  
  if (spool.sheen) {
    details.push(`Sheen: ${spool.sheen}`);
  }
  
  if (spool.glowInDark) {
    details.push("Glow in Dark");
  }
  
  if (spool.texture) {
    details.push(`Texture: ${spool.texture}`);
  }
  
  return details.length > 0 ? details.join(", ") : "—";
}

// ----- Inventory table rendering & inline editing -----
function renderInventoryTable() {
  const tbody = document.querySelector("#inventoryTable tbody");
  tbody.innerHTML = "";

  if (spoolLibrary.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
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

    const colorDetails = formatColorDetails(spool);

    tr.innerHTML = `
   <td class="cell-brand"><span>${escapeHtml(spool.brand)}</span></td>
   <td class="cell-color"><span>${escapeHtml(spool.color)}</span></td>
   <td class="cell-material"><span>${escapeHtml(spool.material)}</span></td>
   <td class="cell-length"><span>${spool.length > 0 ? Number(spool.length).toFixed(2) : 'N/A'}</span></td>
   <td class="cell-weight"><span>${Number(spool.weight).toFixed(2)}</span></td>
   <td class="cell-color-details"><span style="font-size: 0.85em;">${colorDetails}</span></td>
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

  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "None";
  sel.appendChild(noneOpt);

  emptySpools.forEach((spool, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = `${spool.brand} - ${spool.package} (${spool.weight}g)`;
    sel.appendChild(opt);
  });

  sel.value = currentValue !== null && currentValue !== undefined ? currentValue : "";

  return sel;
}

function buildColorDetailsEditFields(spool) {
  const wrapper = document.createElement("div");
  wrapper.style.fontSize = "0.85em";
  
  // Color Type
  const typeLabel = document.createElement("label");
  typeLabel.textContent = "Type:";
  typeLabel.style.display = "block";
  typeLabel.style.marginBottom = "3px";
  
  const typeSelect = document.createElement("select");
  typeSelect.className = "row-color-type";
  typeSelect.style.width = "100%";
  typeSelect.style.padding = "4px";
  typeSelect.style.marginBottom = "5px";
  ["solid", "gradient"].forEach(val => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val.charAt(0).toUpperCase() + val.slice(1);
    typeSelect.appendChild(opt);
  });
  typeSelect.value = spool.colorType || "solid";
  
  // Gradient Colors
  const gradientInput = document.createElement("input");
  gradientInput.type = "text";
  gradientInput.className = "row-gradient-colors";
  gradientInput.placeholder = "Gradient colors";
  gradientInput.value = spool.gradientColors || "";
  gradientInput.style.width = "100%";
  gradientInput.style.padding = "4px";
  gradientInput.style.marginBottom = "5px";
  gradientInput.style.display = spool.colorType === "gradient" ? "block" : "none";
  
  typeSelect.addEventListener("change", () => {
    gradientInput.style.display = typeSelect.value === "gradient" ? "block" : "none";
  });
  
  // Sheen
  const sheenLabel = document.createElement("label");
  sheenLabel.textContent = "Sheen:";
  sheenLabel.style.display = "block";
  sheenLabel.style.marginTop = "5px";
  sheenLabel.style.marginBottom = "3px";
  
  const sheenSelect = document.createElement("select");
  sheenSelect.className = "row-sheen";
  sheenSelect.style.width = "100%";
  sheenSelect.style.padding = "4px";
  sheenSelect.style.marginBottom = "5px";
  ["", "matte", "glossy", "silk", "glitter", "metallic", "satin"].forEach(val => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val ? val.charAt(0).toUpperCase() + val.slice(1) : "—";
    sheenSelect.appendChild(opt);
  });
  sheenSelect.value = spool.sheen || "";
  
  // Glow in Dark
  const glowLabel = document.createElement("label");
  glowLabel.style.display = "block";
  glowLabel.style.marginTop = "5px";
  
  const glowCheckbox = document.createElement("input");
  glowCheckbox.type = "checkbox";
  glowCheckbox.className = "row-glow";
  glowCheckbox.checked = spool.glowInDark || false;
  glowCheckbox.style.width = "auto";
  glowCheckbox.style.marginRight = "5px";
  
  glowLabel.appendChild(glowCheckbox);
  glowLabel.appendChild(document.createTextNode("Glow"));
  
  // Texture
  const textureLabel = document.createElement("label");
  textureLabel.textContent = "Texture:";
  textureLabel.style.display = "block";
  textureLabel.style.marginTop = "5px";
  textureLabel.style.marginBottom = "3px";
  
  const textureSelect = document.createElement("select");
  textureSelect.className = "row-texture";
  textureSelect.style.width = "100%";
  textureSelect.style.padding = "4px";
  ["", "smooth", "textured", "wood-grain", "marble", "carbon-fiber", "fuzzy"].forEach(val => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val ? val.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "—";
    textureSelect.appendChild(opt);
  });
  textureSelect.value = spool.texture || "";
  
  wrapper.appendChild(typeLabel);
  wrapper.appendChild(typeSelect);
  wrapper.appendChild(gradientInput);
  wrapper.appendChild(sheenLabel);
  wrapper.appendChild(sheenSelect);
  wrapper.appendChild(glowLabel);
  wrapper.appendChild(textureLabel);
  wrapper.appendChild(textureSelect);
  
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
    `<input type="number" step="0.01" class="row-length" value="${Number(data.length) || 0}" />`;
  tr.querySelector(".cell-weight").innerHTML =
    `<input type="number" step="0.01" class="row-weight" value="${Number(data.weight)}" />`;

  const colorDetailsCell = tr.querySelector(".cell-color-details");
  colorDetailsCell.innerHTML = "";
  colorDetailsCell.appendChild(buildColorDetailsEditFields(data));

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

  const colorDetails = formatColorDetails(data);

  tr.querySelector(".cell-brand").innerHTML = `<span>${escapeHtml(data.brand)}</span>`;
  tr.querySelector(".cell-color").innerHTML = `<span>${escapeHtml(data.color)}</span>`;
  tr.querySelector(".cell-material").innerHTML = `<span>${escapeHtml(data.material)}</span>`;
  tr.querySelector(".cell-length").innerHTML = `<span>${data.length > 0 ? Number(data.length).toFixed(2) : 'N/A'}</span>`;
  tr.querySelector(".cell-weight").innerHTML = `<span>${Number(data.weight).toFixed(2)}</span>`;
  tr.querySelector(".cell-color-details").innerHTML = `<span style="font-size: 0.85em;">${colorDetails}</span>`;
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
    tr.querySelector(".row-color-type"),
    tr.querySelector(".row-gradient-colors"),
    tr.querySelector(".row-sheen"),
    tr.querySelector(".row-glow"),
    tr.querySelector(".row-texture"),
    tr.querySelector(".row-empty-spool-select"),
  ].filter(Boolean);
}

function currentRowValues(tr) {
  const [brandEl, colorEl, matSel, matCustom, lengthEl, weightEl, colorTypeEl, gradientEl, sheenEl, glowEl, textureEl, emptySpoolSel] = getRowInputs(tr);

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
    colorType: colorTypeEl?.value || "solid",
    gradientColors: gradientEl?.value?.trim() || "",
    sheen: sheenEl?.value || "",
    glowInDark: glowEl?.checked || false,
    texture: textureEl?.value || "",
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
    now.colorType !== (orig.colorType || "solid") ||
    now.gradientColors !== (orig.gradientColors || "") ||
    now.sheen !== (orig.sheen || "") ||
    now.glowInDark !== (orig.glowInDark || false) ||
    now.texture !== (orig.texture || "") ||
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

  // Keep the existing fullSpoolWeight and emptyWeight values
  const existingSpool = spoolLibrary[idx];
  spoolLibrary[idx] = {
    ...vals,
    fullSpoolWeight: existingSpool.fullSpoolWeight,
    emptyWeight: existingSpool.emptyWeight
  };
  
  saveSpoolLibrary();
  exitEditMode(tr, true);
}

// ----- Init -----
document.addEventListener("DOMContentLoaded", renderInventoryTable);