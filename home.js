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

let activePrintJob = null; // Will hold current job data

// ----- Screen Navigation -----
function showScreen(id) {
  document.querySelectorAll("main, section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "library") renderLibrary();
  if (id === "history") renderHistory();

  if (id === "tracking") {
    populateSpoolMultiSelect();

    if (activePrintJob) {
      document.getElementById("startPrintSection").classList.add("hidden");
      document.getElementById("endPrintSection").classList.remove("hidden");
      document.getElementById("activeJobName").textContent = `Active Job: ${activePrintJob.jobName}`;
    } else {
      document.getElementById("startPrintSection").classList.remove("hidden");
      document.getElementById("endPrintSection").classList.add("hidden");
    }
  }

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
  const select = document.getElementById("selectSpools");
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
  const select = document.getElementById("selectSpools");
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
  spoolLibrary.forEach((spool, index) => {
    const li = document.createElement("li");
    li.setAttribute('data-spool-id', index.toString());  // Set data attribute for id
    li.textContent = `${spool.brand} - ${spool.color} - ${spool.material} (${spool.length}m, ${spool.weight}g)`;
    list.appendChild(li);
  });
}

// ----- Render History -----
function renderHistory() {
  const history = JSON.parse(localStorage.getItem("usageHistory")) || [];
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  if (history.length === 0) {
    list.innerHTML = "<li>No usage history available</li>";
    return;
  }

  history.forEach(job => {
    const li = document.createElement("li");
    let spoolDetails = job.spools.map((s, i) =>
      `<a href="#" class="spool-link" data-spool-index="${s.spoolId}">${s.spoolLabel}</a>: ${s.used.toFixed(2)} g used`
    ).join("<br>");
    li.innerHTML = `
      <strong>${job.jobName}</strong> 
      <small>(${new Date(job.startTime).toLocaleString()} → ${new Date(job.endTime).toLocaleString()})</small>
      <br>${spoolDetails}
    `;
    list.appendChild(li);
  });

  // Add click handlers to all spool links
  document.querySelectorAll('.spool-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const spoolIndex = e.target.getAttribute('data-spool-index');
      showScreen('library');
      highlightSpool(spoolIndex);
    });
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
    if (usage.spoolMaterial) {
      usageByMaterial[usage.spoolMaterial] = (usageByMaterial[usage.spoolMaterial] || 0) + (usage.lengthUsed || 0);
    }
  });

  const labels = Object.keys(usageByMaterial);
  const data = Object.values(usageByMaterial);

  // If no data, show message
  if (labels.length === 0) {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#666";
    ctx.textAlign = "center";
    ctx.fillText("No usage data available", canvas.width / 2, canvas.height / 2);
    return;
  }

  // Destroy existing chart instance if exists to prevent overlap
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

function populateSpoolMultiSelect() {
  const select = document.getElementById("selectSpools");
  select.innerHTML = "";
  spoolLibrary.forEach((spool, index) => {
    const option = document.createElement("option");
    option.value = index;  // keep index as value
    option.textContent = `${spool.brand} - ${spool.color} (${spool.material}) (${spool.weight}g)`;  // added weight here
    select.appendChild(option);
  });
}

function startPrintJob() {
  const jobName = document.getElementById("jobName").value.trim();
  const selectedOptions = Array.from(document.getElementById("selectSpools").selectedOptions);
  const allSpools = spoolLibrary;

  if (selectedOptions.length === 0) {
    alert("Please select at least one spool.");
    return;
  }

  const spools = selectedOptions.map(opt => {
    // Use the current weight from spoolLibrary directly, no need to ask for start weight input
    const spoolInfo = allSpools[opt.value] || {};
    const startWeight = spoolInfo.weight;
    if (typeof startWeight !== "number" || isNaN(startWeight)) {
      alert("Spool weight data missing or invalid.");
      throw new Error("Invalid start weight");
    }

    const label = `${spoolInfo.brand || "Unknown"} - ${spoolInfo.color || "?"} (${spoolInfo.material || "?"}) (${startWeight}g)`;

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
  const spools = JSON.parse(localStorage.getItem("spoolLibrary")) || [];
  const history = JSON.parse(localStorage.getItem("usageHistory")) || [];

  const updatedSpools = activePrintJob.spools.map(spoolData => {
    const endWeight = parseFloat(document.getElementById(`endWeight_${spoolData.spoolId}`).value);
    if (isNaN(endWeight)) {
      alert("Please enter all end weights.");
      throw new Error("Missing end weights");
    }
    const gramsUsed = spoolData.startWeight - endWeight;

    // Find the correct spool index in the current spools array
    const spoolIndex = parseInt(spoolData.spoolId, 10);
    if (spoolIndex !== -1) {
      spools[spoolIndex].weight = endWeight;  // update weight
    }

    return {
      ...spoolData,
      endWeight,
      gramsUsed,
      used: gramsUsed,
    };
  });

  // Save updated spools and history
  localStorage.setItem("spoolLibrary", JSON.stringify(spools));
  
  history.push({
    jobId: activePrintJob.jobId,
    jobName: activePrintJob.jobName,
    spools: updatedSpools,
    startTime: activePrintJob.startTime,
    endTime: new Date().toISOString()
  });

  localStorage.setItem("usageHistory", JSON.stringify(history));
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
document.getElementById("selectSpools")?.addEventListener("change", () => {
  const container = document.getElementById("startWeightsContainer");
  if (!container) return;
  
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
  const savedJob = JSON.parse(localStorage.getItem("activePrintJob"));
  if (savedJob) {
    activePrintJob = savedJob;
    showEndPrintSection();
  }
});

function highlightSpool(spoolId) {
  const spoolList = document.getElementById('spoolList');
  const items = spoolList.querySelectorAll('li');

  // Clear previous highlights
  items.forEach(item => item.style.backgroundColor = '');

  // spoolId might be string or number — compare as string for safety
  const targetItem = [...items].find(li => li.getAttribute('data-spool-id') === spoolId.toString());

  if (targetItem) {
    targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetItem.style.backgroundColor = 'yellow';

    setTimeout(() => {
      targetItem.style.backgroundColor = '';
    }, 3000);
  }
}


// Populate spool filter dropdown
function populateSpoolFilterDropdown() {
  const select = document.getElementById("filterSpool");
  select.innerHTML = '<option value="">All Spools</option>';

  // Collect all unique spools ever used in history
  const history = JSON.parse(localStorage.getItem("usageHistory")) || [];
  const spoolsSet = new Set();

  history.forEach(job => {
    job.spools.forEach(spool => {
      spoolsSet.add(spool.spoolLabel);
    });
  });

  Array.from(spoolsSet).sort().forEach(spoolLabel => {
    const option = document.createElement("option");
    option.value = spoolLabel;
    option.textContent = spoolLabel;
    select.appendChild(option);
  });
}

// Render history with optional filters
function renderHistoryFiltered(startDate, endDate, spoolLabel) {
  const history = JSON.parse(localStorage.getItem("usageHistory")) || [];
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  // Convert date strings to Date objects for comparison
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  // Filter jobs by date and spool
  const filteredJobs = history.filter(job => {
    const jobStart = new Date(job.startTime);
    const jobEnd = new Date(job.endTime);

    // Check date range
    if (start && jobEnd < start) return false;
    if (end && jobStart > end) return false;

    // Check spool filter
    if (spoolLabel) {
      const usesSpool = job.spools.some(s => s.spoolLabel === spoolLabel);
      if (!usesSpool) return false;
    }
    return true;
  });

  if (filteredJobs.length === 0) {
    list.innerHTML = "<li>No usage history available for selected filters.</li>";
    return;
  }

  filteredJobs.forEach(job => {
    const li = document.createElement("li");
    let spoolDetails = job.spools.map(s =>
      `<a href="#" class="spool-link" data-spool-index="${s.spoolId}">${s.spoolLabel}</a>: ${s.used.toFixed(2)} g used`
    ).join("<br>");
    li.innerHTML = `
      <strong>${job.jobName}</strong> 
      <small>(${new Date(job.startTime).toLocaleString()} → ${new Date(job.endTime).toLocaleString()})</small>
      <br>${spoolDetails}
    `;
    list.appendChild(li);
  });

  // Re-add spool link click handlers
  document.querySelectorAll('.spool-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const spoolIndex = e.target.getAttribute('data-spool-index');
      showScreen('library');
      highlightSpool(spoolIndex);
    });
  });
}

function applyFilters() {
  const startDate = document.getElementById("filterStartDate").value;
  const endDate = document.getElementById("filterEndDate").value;
  const spoolLabel = document.getElementById("filterSpool").value;

  renderHistoryFiltered(startDate, endDate, spoolLabel);
}

function clearFilters() {
  document.getElementById("filterStartDate").value = "";
  document.getElementById("filterEndDate").value = "";
  document.getElementById("filterSpool").value = "";
  renderHistoryFiltered();
}

// Override renderHistory to do initial load without filters
function renderHistory() {
  populateSpoolFilterDropdown();
  renderHistoryFiltered();
}

// Setup live filtering
function setupLiveFilters() {
  const startDateInput = document.getElementById("filterStartDate");
  const endDateInput = document.getElementById("filterEndDate");
  const spoolSelect = document.getElementById("filterSpool");
  const clearBtn = document.getElementById("clearFiltersBtn");

  function updateFilters() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const spoolLabel = spoolSelect.value;
    renderHistoryFiltered(startDate, endDate, spoolLabel);
  }

  startDateInput.addEventListener("change", updateFilters);
  endDateInput.addEventListener("change", updateFilters);
  spoolSelect.addEventListener("change", updateFilters);

  clearBtn.addEventListener("click", () => {
    startDateInput.value = "";
    endDateInput.value = "";
    spoolSelect.value = "";
    renderHistoryFiltered();
  });
}

// Override renderHistory to setup dropdown and live filters
function renderHistory() {
  populateSpoolFilterDropdown();
  renderHistoryFiltered();
  setupLiveFilters();
}



window.showScreen = showScreen;

