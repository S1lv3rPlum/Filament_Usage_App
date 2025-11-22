// ----- Data Storage -----
let emptySpools = JSON.parse(localStorage.getItem("emptySpools")) || [];

// ----- DOM Elements -----
const tableBody = document.querySelector("#emptySpoolsTable tbody");
const addBtn = document.getElementById("addEmptySpoolBtn");
const newBrandInput = document.getElementById("newBrand");
const newPackageInput = document.getElementById("newPackage");
const newWeightInput = document.getElementById("newWeight");

// ----- Functions -----
function saveToStorage() {
  localStorage.setItem("emptySpools", JSON.stringify(emptySpools));
}

function renderTable() {
  tableBody.innerHTML = "";
  emptySpools.forEach((spool, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><input type="text" value="${spool.brand}" data-index="${index}" data-field="brand" class="inlineInput" style="width:100%; padding:5px;" /></td>
      <td><input type="text" value="${spool.package}" data-index="${index}" data-field="package" class="inlineInput" style="width:100%; padding:5px;" /></td>
      <td><input type="number" value="${spool.weight}" data-index="${index}" data-field="weight" class="inlineInput" style="width:80px; padding:5px;" /></td>
      <td>
        <button data-action="save" data-index="${index}">Save</button>
        <button data-action="delete" data-index="${index}">Delete</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function addEmptySpool() {
  const brand = newBrandInput.value.trim();
  const packageName = newPackageInput.value.trim();
  const weight = parseFloat(newWeightInput.value);

  if (!brand || !packageName || isNaN(weight)) {
    alert("Please fill out all fields with valid values.");
    return;
  }

  emptySpools.push({ brand, package: packageName, weight });
  saveToStorage();
  renderTable();

  // Clear inputs
  newBrandInput.value = "";
  newPackageInput.value = "";
  newWeightInput.value = "";
}

// ----- Event Delegation for Inline Edit/Save/Delete -----
tableBody.addEventListener("click", e => {
  const btn = e.target;
  const index = parseInt(btn.dataset.index, 10);

  if (btn.dataset.action === "save") {
    const inputs = tableBody.querySelectorAll(`input[data-index="${index}"]`);
    inputs.forEach(input => {
      const field = input.dataset.field;
      let val = input.value;
      if (field === "weight") val = parseFloat(val) || 0;
      emptySpools[index][field] = val;
    });
    saveToStorage();
    alert("Empty spool updated.");
    renderTable();
  }

  if (btn.dataset.action === "delete") {
    if (confirm("Delete this empty spool entry?")) {
      emptySpools.splice(index, 1);
      saveToStorage();
      renderTable();
    }
  }
});

// ----- Add Button -----
addBtn.addEventListener("click", addEmptySpool);

// ----- Initial Render -----
renderTable();


// ---- go back Button

function goBack() {
  if (document.referrer && document.referrer !== window.location.href) {
    // Go back if there's a valid referrer
    window.history.back();
  } else {
    // Fallback if no history (direct entry, bookmark, etc.)
    window.location.href = "home.html"; 
  }
}
