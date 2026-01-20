// ===== AUTH & FIREBASE CHECK =====
let currentUser = null;
let spoolLibrary = [];
let materialsList = [];
let emptySpoolsLibrary = [];
let showingRetired = false;
let showingOnlyLow = false;  
let lowFilamentThreshold = 200 // Default threshold
let spoolToRetire = null;

// Wait for auth before loading
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'auth.html';
  } else {
    currentUser = user;
    await loadInventoryData();
    renderInventoryTable();
  }
});

// Load data from Firebase
async function loadInventoryData() {
  if (!currentUser) return;
  
  try {
    const userId = currentUser.uid;
    
    // Load spools
    const spoolsSnapshot = await db.collection('users').doc(userId).collection('spools').get();
    spoolLibrary = spoolsSnapshot.docs.map(doc => ({ 
      firestoreId: doc.id, 
      ...doc.data() 
    }));
    console.log(`✅ Loaded ${spoolLibrary.length} spools for inventory`);
    
    // Load empty spools
    const emptySpoolsSnapshot = await db.collection('users').doc(userId).collection('emptySpools').get();
    emptySpoolsLibrary = emptySpoolsSnapshot.docs.map(doc => ({ 
      firestoreId: doc.id, 
      ...doc.data() 
    }));
    
    // Load materials
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists && userDoc.data().materialsList) {
      materialsList = userDoc.data().materialsList;
    } else {
      materialsList = ["PLA", "ABS", "PETG", "Nylon", "TPU", "Custom"];
    }
    
    // Load low filament threshold
    if (userDoc.exists && userDoc.data().lowFilamentThreshold !== undefined) {
      lowFilamentThreshold = userDoc.data().lowFilamentThreshold;
      console.log(`✅ Low filament threshold: ${lowFilamentThreshold}g`);
    } else {
      lowFilamentThreshold = 200;
    }

  } catch (error) {
    console.error('Error loading inventory:', error);
    alert('Failed to load inventory from cloud.');
  }
}

// Save spool to Firebase
async function saveSpoolToFirebase(index) {
  if (!currentUser) return;
  
  try {
    const spool = spoolLibrary[index];
    const firestoreId = spool.firestoreId;
    
    if (firestoreId) {
      // Update existing spool in Firebase
      const { firestoreId: _, createdAt, ...spoolData } = spool; // Remove Firestore metadata
      await db.collection('users').doc(currentUser.uid)
        .collection('spools').doc(firestoreId)
        .update(spoolData);
      console.log('✅ Spool updated in Firebase');
      alert('Changes saved to cloud!');
    }
  } catch (error) {
    console.error('Error saving spool:', error);
    alert('Failed to save changes to cloud. Please try again.');
  }
}

// Save materials list to Firebase
async function saveMaterialsToFirebase() {
  if (!currentUser) return;
  
  try {
    await db.collection('users').doc(currentUser.uid).update({
      materialsList: materialsList
    });
    console.log('✅ Materials saved to Firebase');
  } catch (error) {
    console.error('Error saving materials:', error);
  }
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
  if (emptySpoolId === null || emptySpoolId === undefined) return "None";
  
  const emptySpool = emptySpoolsLibrary[emptySpoolId];
  if (emptySpool) {
    return `${emptySpool.brand} - ${emptySpool.package} (${emptySpool.weight}g)`;
  }
  
  return "None";
}

// Helper to format color details for display
function formatColorDetails(spool) {
  const details = [];
  
  if (spool.colorType === "gradient" && spool.gradientBaseColors && Array.isArray(spool.gradientBaseColors)) {
    details.push(`Gradient: ${spool.gradientBaseColors.join(", ")}`);
  } else if (spool.colorType === "gradient" && spool.gradientColors) {
    details.push(`Gradient: ${spool.gradientColors}`);
  } else if (spool.colorType) {
    details.push(`Type: ${spool.colorType}`);
  }
  
  if (spool.sheen) {
    details.push(`Sheen: ${spool.sheen}`);
  }
  
  if (spool.glowInDark && spool.glowInDark !== "no") {
    details.push("Glow in Dark");
  }
  
  if (spool.texture) {
    details.push(`Texture: ${spool.texture}`);
  }
  
  return details.length > 0 ? details.join(", ") : "—";
}

// Toggle low spools filter
function toggleLowSpools() {
  showingOnlyLow = !showingOnlyLow;
  const toggleBtn = document.getElementById("toggleLowBtn");
  
  if (showingOnlyLow) {
    toggleBtn.textContent = "Show All Spools";
    toggleBtn.style.background = "#ff9800";
  } else {
    toggleBtn.textContent = "Show Only Low Spools";
    toggleBtn.style.background = "#ffc107";
  }
  
  renderInventoryTable();
}

// Toggle retired spools visibility
function toggleRetiredSpools() {
  showingRetired = !showingRetired;
  const retiredSection = document.getElementById("retiredSpoolsSection");
  const toggleBtn = document.getElementById("toggleRetiredBtn");
  
  if (showingRetired) {
    retiredSection.classList.remove("hidden");
    toggleBtn.textContent = "Hide Retired Spools";
    toggleBtn.style.background = "#007acc";
    renderRetiredSpoolsTable();
  } else {
    retiredSection.classList.add("hidden");
    toggleBtn.textContent = "Show Retired Spools";
    toggleBtn.style.background = "#666";
  }
}

// ----- Inventory table rendering & inline editing -----
function renderInventoryTable() {
  const tbody = document.querySelector("#inventoryTable tbody");
  tbody.innerHTML = "";

  // Filter to only show active spools
  const activeSpools = spoolLibrary.filter(spool => !spool.status || spool.status === "active");

  // Further filter if showing only low spools
  if (showingOnlyLow) {
    activeSpools = activeSpools.filter(spool => spool.weight <= lowFilamentThreshold);
  }

  if (activeSpools.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "No active spools in inventory";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  activeSpools.forEach((spool) => {
    const index = spoolLibrary.indexOf(spool);
    const tr = document.createElement("tr");
    tr.dataset.index = index;

    // Determine alert level
    const criticalThreshold = Math.floor(lowFilamentThreshold / 2);
    let alertClass = "";
    let alertStyle = "";
    
    if (spool.weight <= criticalThreshold) {
      alertClass = "critical-low";
      alertStyle = "background-color: #ffebee;"; // Light red
    } else if (spool.weight <= lowFilamentThreshold) {
      alertClass = "warning-low";
      alertStyle = "background-color: #fff9e6;"; // Light yellow
    }
    
    tr.className = alertClass;
    if (alertStyle) {
      tr.setAttribute("style", alertStyle);
    }

    const emptySpoolDisplay = spool.emptySpoolId !== null && spool.emptySpoolId !== undefined 
      ? getEmptySpoolLabel(spool.emptySpoolId) 
      : "None";

    const colorDetails = formatColorDetails(spool);

    // Bold weight if low
    const weightStyle = spool.weight <= lowFilamentThreshold ? "font-weight: bold;" : "";


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
     <button class="retire-btn" style="background: #ff6b6b; margin-top: 5px;">Retire</button>
   </td>
`;

    tbody.appendChild(tr);
  });

  attachRowHandlers();
}

// Render retired spools table
function renderRetiredSpoolsTable() {
  const tbody = document.querySelector("#retiredSpoolsTable tbody");
  tbody.innerHTML = "";

  // Filter to only show retired spools
  const retiredSpools = spoolLibrary.filter(spool => spool.status === "retired");

  if (retiredSpools.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.textContent = "No retired spools";
    td.style.color = "#666";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  retiredSpools.forEach((spool) => {
    const index = spoolLibrary.indexOf(spool);
    const tr = document.createElement("tr");
    tr.style.opacity = "0.7";
    tr.dataset.index = index;

    const retiredDate = spool.retiredAt 
      ? new Date(spool.retiredAt.toDate ? spool.retiredAt.toDate() : spool.retiredAt).toLocaleDateString()
      : "Unknown";

    tr.innerHTML = `
      <td>${escapeHtml(spool.brand)}</td>
      <td>${escapeHtml(spool.color)}</td>
      <td>${escapeHtml(spool.material)}</td>
      <td>${Number(spool.weight).toFixed(2)}g</td>
      <td>${retiredDate}</td>
      <td style="font-size: 0.9em;">${escapeHtml(spool.retirementReason || "—")}</td>
      <td>
        <button onclick="unretireSpool(${index})" style="background: #4CAF50; color: white; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer;">Unretire</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
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
  document.querySelectorAll(".retire-btn").forEach(btn => {
    btn.addEventListener("click", onRetireRow);
  });
}

// Open retirement modal
function onRetireRow(e) {
  const tr = e.target.closest("tr");
  const index = Number(tr.dataset.index);
  const spool = spoolLibrary[index];
  
  spoolToRetire = index;
  
  document.getElementById("retireSpoolName").textContent = 
    `${spool.brand} - ${spool.color} (${spool.material})`;
  
  document.getElementById("retirementReason").value = "Empty";
  document.getElementById("otherReasonContainer").classList.add("hidden");
  document.getElementById("otherReason").value = "";
  
  document.getElementById("retirementModal").style.display = "block";
}

// Handle retirement reason change
document.addEventListener("DOMContentLoaded", () => {
  const reasonSelect = document.getElementById("retirementReason");
  if (reasonSelect) {
    reasonSelect.addEventListener("change", () => {
      const otherContainer = document.getElementById("otherReasonContainer");
      if (reasonSelect.value === "Other") {
        otherContainer.classList.remove("hidden");
      } else {
        otherContainer.classList.add("hidden");
      }
    });
  }
});

// Confirm retirement
async function confirmRetirement() {
  if (spoolToRetire === null) return;
  
  let reason = document.getElementById("retirementReason").value;
  
  if (reason === "Other") {
    const otherReason = document.getElementById("otherReason").value.trim();
    if (!otherReason) {
      alert("Please specify a reason.");
      return;
    }
    reason = otherReason;
  }
  
  try {
    const spool = spoolLibrary[spoolToRetire];
    
    // Update spool status
    spool.status = "retired";
    spool.retiredAt = firebase.firestore.FieldValue.serverTimestamp();
    spool.retirementReason = reason;
    
    // Update in Firebase
    if (spool.firestoreId) {
      await db.collection('users').doc(currentUser.uid)
        .collection('spools').doc(spool.firestoreId)
        .update({
          status: "retired",
          retiredAt: firebase.firestore.FieldValue.serverTimestamp(),
          retirementReason: reason
        });
      
      console.log('✅ Spool retired in Firebase');
      alert(`Spool retired successfully!\n\nReason: ${reason}`);
      
      closeRetirementModal();
      renderInventoryTable();
      
      // If retired section is visible, update it
      if (showingRetired) {
        renderRetiredSpoolsTable();
      }
    }
  } catch (error) {
    console.error('Error retiring spool:', error);
    alert('Failed to retire spool. Please try again.');
  }
}

// Close retirement modal
function closeRetirementModal() {
  document.getElementById("retirementModal").style.display = "none";
  spoolToRetire = null;
}

// Unretire a spool
async function unretireSpool(index) {
  if (!confirm("Restore this spool to active inventory?")) return;
  
  try {
    const spool = spoolLibrary[index];
    
    // Update spool status
    spool.status = "active";
    delete spool.retiredAt;
    delete spool.retirementReason;
    
    // Update in Firebase
    if (spool.firestoreId) {
      await db.collection('users').doc(currentUser.uid)
        .collection('spools').doc(spool.firestoreId)
        .update({
          status: "active",
          retiredAt: firebase.firestore.FieldValue.delete(),
          retirementReason: firebase.firestore.FieldValue.delete()
        });
      
      console.log('✅ Spool unretired in Firebase');
      alert('Spool restored to active inventory!');
      
      renderInventoryTable();
      renderRetiredSpoolsTable();
    }
  } catch (error) {
    console.error('Error unretiring spool:', error);
    alert('Failed to restore spool. Please try again.');
  }
}

// Close modal when clicking outside
window.addEventListener("click", (e) => {
  const modal = document.getElementById("retirementModal");
  if (e.target === modal) {
    closeRetirementModal();
  }
});

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
  const sel = document.createElement("select");
  sel.className = "row-empty-spool-select";

  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "None";
  sel.appendChild(noneOpt);

  emptySpoolsLibrary.forEach((spool, idx) => {
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
  gradientInput.placeholder = "Gradient colors (comma-separated)";
  // Handle both array and string formats
  const gradientValue = Array.isArray(spool.gradientBaseColors) 
    ? spool.gradientBaseColors.join(", ") 
    : (spool.gradientColors || "");
  gradientInput.value = gradientValue;
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
  glowCheckbox.checked = spool.glowInDark && spool.glowInDark !== "no";
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
  tr.querySelector(".retire-btn").classList.add("hidden");

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
  tr.querySelector(".retire-btn").classList.remove("hidden");

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
// Parse gradient colors as array
const gradientColors = gradientEl?.value ? gradientEl.value.split(',').map(c => c.trim()).filter(Boolean) : [];
return {
brand: (brandEl?.value || "").trim(),
color: (colorEl?.value || "").trim(),
material: (material || "").trim(),
length: parseFloat(lengthEl?.value) || 0,
weight: parseFloat(weightEl?.value),
colorType: colorTypeEl?.value || "solid",
gradientBaseColors: gradientColors,
sheen: sheenEl?.value || "",
glowInDark: glowEl?.checked ? "yes" : "no",
texture: textureEl?.value || "",
emptySpoolId: emptySpoolId,
};
}
function hasChanges(tr) {
const now = currentRowValues(tr);
const orig = tr._orig || {};
// Compare gradient arrays
const origGradient = Array.isArray(orig.gradientBaseColors) ? orig.gradientBaseColors.join(",") : "";
const nowGradient = Array.isArray(now.gradientBaseColors) ? now.gradientBaseColors.join(",") : "";
return (
now.brand !== orig.brand ||
now.color !== orig.color ||
now.material !== orig.material ||
now.length !== (orig.length || 0) ||
now.weight !== Number(orig.weight) ||
now.colorType !== (orig.colorType || "solid") ||
nowGradient !== origGradient ||
now.sheen !== (orig.sheen || "") ||
now.glowInDark !== (orig.glowInDark || "no") ||
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
async function onSaveRow(e) {
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
// Add new material to list if needed
if (!materialsList.includes(vals.material)) {
const customIndex = materialsList.indexOf("Custom");
const insertAt = customIndex === -1 ? materialsList.length : customIndex;
materialsList.splice(insertAt, 0, vals.material);
await saveMaterialsToFirebase();
}
// Keep the existing fullSpoolWeight, emptyWeight, and firestoreId
const existingSpool = spoolLibrary[idx];
spoolLibrary[idx] = {
...existingSpool,
...vals,
};
// Save to Firebase
await saveSpoolToFirebase(idx);
exitEditMode(tr, true);
}