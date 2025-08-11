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

// ----- Screen Navigation -----
function showScreen(id) {
  document.querySelectorAll("main, section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "library") renderLibrary();
  if (id === "history") renderHistory();
  if (id === "tracking") populateSpoolSelect();
  if (id === "addSpool") populateMaterialDropdown();
  if (id === "analytics") renderAnalytics();
  if (id === "settings") {
    // Setup for settings if needed
  }
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
  if (select.value === "Custom") {
    customInput.classList.remove("hidden");
  } else {
    customInput.classList.add("hidden");
    customInput.value = "";
  }
}

// ----- Save Spool -----
function saveSpool() {
  const brand = document.getElementById("brand").value.trim();
  const color = document.getElementById("color").value.trim();

  const materialSelect = document.getElementById("materialSelect");
  let material = materialSelect.value;

  const customMaterialInput = document.getElementById("customMaterialInput");
  const customMaterial = customMaterialInput.value.trim();

  if (material === "Custom") {
    if (!customMaterial) {
      alert("Please enter a custom material.");
      return;
    }
    material = customMaterial;

    // Add new custom material if not already present
    if (!materialsList.includes(material)) {
      materialsList.splice(materialsList.length - 1, 0, material); // before "Custom"
      localStorage.setItem("materialsList", JSON.stringify(materialsList));
    }
  }

  const length = parseFloat(document.getElementById("length").value);
  const weight = parseFloat(document.getElementById("weight").value);

  if (!brand || !color || !material || isNaN(length) || isNaN(weight)) {
    alert("Please fill out all fields.");
    return;
  }

  spoolLibrary.push({ brand, color, material, length, weight });
  localStorage.setItem("spoolLibrary", JSON.stringify(spoolLibrary));

  // Reset form
  document.getElementById("brand").value = "";
  document.getElementById("color").value = "";
  populateMaterialDropdown();
  document.getElementById("length").value = "";
  document.getElementById("weight").value = "";

  alert("Spool saved!");
  showScreen("library");
}

// ----- Populate Spool Select in Tracking -----
function populateSpoolSelect() {
  const select = document.getElementById("selectSpool");
  select.innerHTML = ""; // Clear existing options

  // Add the default placeholder option
  const defaultOption = document.createElement("option");
  defaultOption.value = "";           // empty value means no spool selected
  defaultOption.textContent = "~select a spool~";
  defaultOption.disabled = true;      // user cannot select it once another option is chosen
  defaultOption.selected = true;      // this option is selected by default
  select.appendChild(defaultOption);

  // Add the spools from the library
  spoolLibrary.forEach((spool, index) => {
    const option = document.createElement("option");
    option.value = index;              // use index as value
    option.textContent = `${spool.brand} - ${spool.color} - ${spool.material}`;
    select.appendChild(option);
  });
}

// ----- Save Usage -----
function saveUsage() {
  const select = document.getElementById("selectSpool");
  const selectedIndex = select.value;

  if (selectedIndex === "") {
    alert("Please select a spool.");
    return;
  }

  const spool = spoolLibrary[selectedIndex];
  const lengthUsed = parseFloat(document.getElementById("inputLengthUsed").value);

  if (isNaN(lengthUsed) || lengthUsed <= 0) {
    alert("Please enter a valid length used.");
    return;
  }

  usageHistory.push({
    spoolIndex: selectedIndex,
    spoolBrand: spool.brand,
    spoolMaterial: spool.material,
    spoolColor: spool.color,
    lengthUsed: lengthUsed,
    date: new Date().toISOString(),
  });
  localStorage.setItem("usageHistory", JSON.stringify(usageHistory));

  alert("Usage saved!");
  showScreen("home");
}

// ----- Render Library -----
function renderLibrary() {
  const list = document.getElementById("spoolList");
  list.innerHTML = "";

  if (spoolLibrary.length === 0) {
    list.innerHTML = "<li>No spools in inventory</li>";
    return;
  }

  spoolLibrary.forEach((spool) => {
    const li = document.createElement("li");
    li.textContent = `${spool.brand} - ${spool.color} - ${spool.material} (${spool.length}m, ${spool.weight}g)`;
    list.appendChild(li);
  });
}

// ----- Render History -----
function renderHistory() {
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  if (usageHistory.length === 0) {
    list.innerHTML = "<li>No usage recorded</li>";
    return;
  }

  usageHistory.forEach(entry => {
    const li = document.createElement("li");
    const dateStr = new Date(entry.date).toLocaleString();
    li.textContent = `${dateStr} - ${entry.lengthUsed}m used from ${entry.spoolBrand}`;
    list.appendChild(li);
  });
}

// ----- Render Analytics -----
function renderAnalytics() {
  const canvas = document.getElementById('usageChart');
  if (!canvas) return; // Canvas might not exist if section hidden

  const ctx = canvas.getContext('2d');

  // Clear canvas for re-rendering (if you want to re-run multiple times)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Aggregate usage by material
  const usageByMaterial = {};
  usageHistory.forEach(usage => {
    usageByMaterial[usage.spoolMaterial] = (usageByMaterial[usage.spoolMaterial] || 0) + usage.lengthUsed;
  });

  const labels = Object.keys(usageByMaterial);
  const data = Object.values(usageByMaterial);

  // Destroy existing chart instance if exists to prevent overlap (optional, requires storing chart globally)
  if (window.usageChartInstance) {
    window.usageChartInstance.destroy();
  }

  window.usageChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: 'Filament Used (m)',
        data: data,
        backgroundColor: [
          '#007acc', '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40'
        ],
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    }
  });
}

// ----- Service Worker Update Handling -----
let newWorker = null;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").then(registration => {
    console.log("Service Worker registered");

    registration.addEventListener("updatefound", () => {
      newWorker = registration.installing;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdatePrompt(() => {
            newWorker.postMessage({ action: "skipWaiting" });
          });
        }
      });
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

function showUpdatePrompt(onConfirm) {
  const prompt = document.createElement("div");
  prompt.style.position = "fixed";
  prompt.style.bottom = "20px";
  prompt.style.left = "50%";
  prompt.style.transform = "translateX(-50%)";
  prompt.style.background = "#007acc";
  prompt.style.color = "white";
  prompt.style.padding = "10px 20px";
  prompt.style.borderRadius = "8px";
  prompt.style.boxShadow = "0 4px 6px rgba(0,0,0,0.2)";
  prompt.style.zIndex = "9999";
  prompt.innerHTML = `
    <span style="margin-right:10px;">Update available</span>
    <button style="background:#fff;color:#007acc;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">Update</button>
  `;

  prompt.querySelector("button").addEventListener("click", () => {
    document.body.removeChild(prompt);
    onConfirm();
  });

  document.body.appendChild(prompt);
}

// ----- Setup check updates button -----
document.addEventListener("DOMContentLoaded", () => {
  const checkUpdatesBtn = document.getElementById("checkUpdatesBtn");
  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener("click", () => {
      if (!newWorker) {
        alert("No update available at this time.");
      } else {
        showUpdatePrompt(() => {
          newWorker.postMessage({ action: "skipWaiting" });
        });
      }
    });
  }

  // Initialize by showing home screen and populating material dropdown
  showScreen("home");
  populateMaterialDropdown();
});

function renderAnalytics() {
  const canvas = document.getElementById('usageChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Aggregate usage data here (example)
  const usageByMaterial = {};
  usageHistory.forEach(usage => {
    usageByMaterial[usage.spoolMaterial] = (usageByMaterial[usage.spoolMaterial] || 0) + usage.lengthUsed;
  });

  const labels = Object.keys(usageByMaterial);
  const data = Object.values(usageByMaterial);

  // Destroy previous chart instance if exists (optional)
  if (window.usageChartInstance) {
    window.usageChartInstance.destroy();
  }

  // Create new pie chart
  window.usageChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: 'Filament Used (m)',
        data: data,
        backgroundColor: ['#007acc', '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40'],
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    }
  });
}


let activePrintJob = null; // Will hold current job data

function populateSpoolMultiSelect() {
  const spools = JSON.parse(localStorage.getItem("spools")) || [];
  const select = document.getElementById("selectSpools");
  select.innerHTML = "";
  spools.forEach((spool, index) => {
    const option = document.createElement("option");
    option.value = spool.id || index;
    option.textContent = `${spool.brand} - ${spool.color} (${spool.material})`;
    select.appendChild(option);
  });
}

function startPrintJob() {
  const jobName = document.getElementById("jobName").value.trim();
  const selectedOptions = Array.from(document.getElementById("selectSpools").selectedOptions);
  const allSpools = JSON.parse(localStorage.getItem("spools")) || [];

  if (selectedOptions.length === 0) {
    alert("Please select at least one spool.");
    return;
  }

  const spools = selectedOptions.map(opt => {
    const startWeight = parseFloat(document.getElementById(`startWeight_${opt.value}`).value);
    if (isNaN(startWeight)) {
      alert("Please enter all start weights.");
      throw new Error("Missing start weights");
    }

    // Find the spool in inventory for display purposes
    const spoolInfo = allSpools.find(s => (s.id || s.index) == opt.value) || {};
    const label = `${spoolInfo.brand || "Unknown"} - ${spoolInfo.color || "?"} (${spoolInfo.material || "?"})`;

    return {
      spoolId: opt.value,
      spoolLabel: label,
      startWeight
    };
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
    div.innerHTML = `
      <label>${spool.spoolLabel} End Weight (g):</label>
      <input type="number" id="endWeight_${spool.spoolId}" step="0.01" />
    `;
    container.appendChild(div);
  });
}

function endPrintJob() {
  const spools = JSON.parse(localStorage.getItem("spools")) || [];
  const history = JSON.parse(localStorage.getItem("history")) || [];

  activePrintJob.spools.forEach(spoolData => {
    const endWeight = parseFloat(document.getElementById(`endWeight_${spoolData.spoolId}`).value);
    if (isNaN(endWeight)) {
      alert("Please enter all end weights.");
      throw new Error("Missing end weights");
    }
    spoolData.endWeight = endWeight;
    spoolData.gramsUsed = spoolData.startWeight - endWeight;

    // Update spool in inventory
    const spoolIndex = spools.findIndex(s => (s.id || s.index) == spoolData.spoolId);
    if (spoolIndex !== -1) {
      spools[spoolIndex].weight = endWeight;
    }

    // Add to history
    history.push({
      jobName: activePrintJob.jobName,
      spoolId: spoolData.spoolId,
      gramsUsed: spoolData.gramsUsed,
      date: new Date().toISOString()
    });
  });

  // Save updates
  localStorage.setItem("spools", JSON.stringify(spools));
  localStorage.setItem("history", JSON.stringify(history));
  localStorage.removeItem("activePrintJob");

  activePrintJob = null;
  alert("Print job ended and usage recorded.");
  showScreen("home");
}

function cancelActiveJob() {
  if (confirm("Cancel the active print job? Progress will be lost.")) {
    localStorage.removeItem("activePrintJob");
    activePrintJob = null;
    showScreen("home");
  }
}

// UI helper to show start weights when spools selected
document.getElementById("selectSpools").addEventListener("change", () => {
  const container = document.getElementById("startWeightsContainer");
  container.innerHTML = "";
  const selected = Array.from(document.getElementById("selectSpools").selectedOptions);
  selected.forEach(opt => {
    const div = document.createElement("div");
    div.innerHTML = `
      <label>${opt.text} Start Weight (g):</label>
      <input type="number" id="startWeight_${opt.value}" step="0.01" />
    `;
    container.appendChild(div);
  });
});

// Restore job if page reloads
window.addEventListener("load", () => {
  populateSpoolMultiSelect();
  const savedJob = JSON.parse(localStorage.getItem("activePrintJob"));
  if (savedJob) {
    activePrintJob = savedJob;
    showEndPrintSection();
  }
});