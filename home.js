console.log("JS Loaded, showScreen is:", typeof showScreen);
window.showScreen = showScreen;

// ----- Data Storage -----
let spoolLibrary = JSON.parse(localStorage.getItem("spoolLibrary")) || [];
let usageHistory = JSON.parse(localStorage.getItem("usageHistory")) || [];
let materialsList = JSON.parse(localStorage.getItem("materialsList")) || [
  "PLA",
  "ABS",
  "PETG",
  "Nylon",
  "TPU",
  "Custom"
];

let activePrintJob = JSON.parse(localStorage.getItem("activePrintJob")) || null;

// ----- Navigation -----
function showScreen(id) {
  document.querySelectorAll("main, section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "library") Library();
  else if (id === "history") {
    resetHistoryPagination();
    History();
  }
  else if (id === "tracking") {
    populateSpoolMultiSelect();

    if (activePrintJob) {
      document.getElementById("startPrintSection").classList.add("hidden");
      document.getElementById("endPrintSection").classList.remove("hidden");
      document.getElementById("activeJobName").textContent = `Active Job: ${activePrintJob.jobName}`;
    } else {
      document.getElementById("startPrintSection").classList.remove("hidden");
      document.getElementById("endPrintSection").classList.add("hidden");
    }
  } else if (id === "addSpool") {
    populateMaterialDropdown();
  } else if (id === "analytics") {
    Analytics();
  } else if (id === "settings") {
    // Setup for settings if needed
  }
}

// ----- Analytics -----
function Analytics() {
  const usageHistory = JSON.parse(localStorage.getItem("usageHistory")) || [];
  const materialUsage = {};

  usageHistory.forEach(job => {
    job.spools.forEach(spool => {
      const material = spool.spoolLabel.match(/([^)]+)/)?.[1] || "Unknown";
      const used = spool.used || 0;
      materialUsage[material] = (materialUsage[material] || 0) + used;
    });
  });

  const labels = Object.keys(materialUsage);
  const data = labels.map(label => materialUsage[label]);

  const ctx = document.getElementById("usageChart").getContext("2d");

  if (window.usageChartInstance) {
    window.usageChartInstance.destroy();
  }

  window.usageChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Filament Used (grams)",
        data,
        backgroundColor: "rgba(0, 122, 204, 0.7)",
        borderColor: "rgba(0, 122, 204, 1)",
        borderWidth: 1,
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Grams Used" } },
        x: { title: { display: true, text: "Material" } }
      },
      plugins: { legend: { display: true, position: "top" }, tooltip: { enabled: true } }
    }
  });
}

// ----- Material Dropdown -----
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
  document.getElementById("customMaterialInput").classList.add("hidden");
  document.getElementById("customMaterialInput").value = "";
}

function handleMaterialChange() {
  const select = document.getElementById("materialSelect");
  const customInput = document.getElementById("customMaterialInput");
  if (select.value === "Custom") customInput.classList.remove("hidden");
  else { customInput.classList.add("hidden"); customInput.value = ""; }
}

// ----- Save Spool -----
function saveSpool() {
  const brand = document.getElementById("brand").value.trim();
  const color = document.getElementById("color").value.trim();

  let material = document.getElementById("materialSelect").value;
  const customMaterial = document.getElementById("customMaterialInput").value.trim();

  if (material === "Custom") {
    if (!customMaterial) { alert("Please enter a custom material."); return; }
    material = customMaterial;

    if (!materialsList.includes(material)) {
      materialsList.splice(materialsList.length - 1, 0, material);
      localStorage.setItem("materialsList", JSON.stringify(materialsList));
    }
  }

  const length = parseFloat(document.getElementById("length").value);
  const weight = parseFloat(document.getElementById("weight").value);

  if (!brand || !color || !material || isNaN(length) || isNaN(weight)) {
    alert("Please fill out all fields correctly.");
    return;
  }

  spoolLibrary.push({ brand, color, material, length, weight });
  localStorage.setItem("spoolLibrary", JSON.stringify(spoolLibrary));

  document.getElementById("brand").value = "";
  document.getElementById("color").value = "";
  populateMaterialDropdown();
  document.getElementById("length").value = "";
  document.getElementById("weight").value = "";

  alert("Spool saved!");
  showScreen("library");
}

// ----- Library -----
function Library() {
  const list = document.getElementById("spoolList");
  list.innerHTML = "";
  if (spoolLibrary.length === 0) { list.innerHTML = "<li>No spools in inventory</li>"; return; }

  spoolLibrary.forEach((spool, index) => {
    const li = document.createElement("li");
    li.setAttribute('data-spool-id', index.toString());
    li.textContent = `${spool.brand} - ${spool.color} - ${spool.material} (${spool.length}m, ${spool.weight}g)`;
    list.appendChild(li);
  });
}

// ----- Tracking -----
function populateSpoolMultiSelect() {
  const select = document.getElementById("selectSpools");
  select.innerHTML = "";
  spoolLibrary.forEach((spool, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${spool.brand} - ${spool.color} (${spool.material}) (${spool.weight}g)`;
    select.appendChild(option);
  });
}

function startPrintJob() {
  const jobName = document.getElementById("jobName").value.trim();
  const selectedOptions = Array.from(document.getElementById("selectSpools").selectedOptions);
  const allSpools = spoolLibrary;

  if (selectedOptions.length === 0) { alert("Please select at least one spool."); return; }

  const spools = selectedOptions.map(opt => {
    const spoolInfo = allSpools[opt.value] || {};
    const startWeight = spoolInfo.weight;
    if (typeof startWeight !== "number" || isNaN(startWeight)) throw new Error("Invalid start weight");
    const label = `${spoolInfo.brand || "Unknown"} - ${spoolInfo.color || "?"} (${spoolInfo.material || "?"}) (${startWeight}g)`;
    return { spoolId: opt.value, spoolLabel: label, startWeight };
  });

  activePrintJob = {
    jobId: Date.now(),
    jobName: jobName || `Print ${new Date().toLocaleString()}`,
    spools,
    startTime: new Date().toISOString(),
  };

  localStorage.setItem("activePrintJob", JSON.stringify(activePrintJob));
  showEndPrintSection();
}

function showEndPrintSection() {
  document.getElementById("startPrintSection").classList.add("hidden");
  document.getElementById("endPrintSection").classList.remove("hidden");
  document.getElementById("activeJobName").textContent = `Active Job: ${activePrintJob.jobName}`;

  const container = document.getElementById("endWeightsContainer");
  container.innerHTML = "";
  activePrintJob.spools.forEach(spool => {
    const div = document.createElement("div");
    div.innerHTML = `<label>${spool.spoolLabel} End Weight (g):</label>
                     <input type="number" id="endWeight_${spool.spoolId}" step="0.01" />`;
    container.appendChild(div);
  });
}

function endPrintJob() {
  const spools = JSON.parse(localStorage.getItem("spoolLibrary")) || [];
  const history = JSON.parse(localStorage.getItem("usageHistory")) || [];

  const updatedSpools = activePrintJob.spools.map(spoolData => {
    const endWeight = parseFloat(document.getElementById(`endWeight_${spoolData.spoolId}`).value);
    if (isNaN(end