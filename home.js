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

// ----- Screen Navigation -----
function showScreen(id) {
  document.querySelectorAll("main, section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "library") Library();
  else if (id === "history") History();
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

function Analytics() {
  const usageHistory = JSON.parse(localStorage.getItem("usageHistory")) || [];
  const materialUsage = {};

  // Aggregate total grams used per material
  usageHistory.forEach(job => {
    job.spools.forEach(spool => {
      const material = spool.spoolLabel.match(/\(([^)]+)\)/)?.[1] || "Unknown"; // Extract material from label
      const used = spool.used || 0;
      materialUsage[material] = (materialUsage[material] || 0) + used;
    });
  });

  const labels = Object.keys(materialUsage);
  const data = labels.map(label => materialUsage[label]);

  const ctx = document.getElementById("usageChart").getContext("2d");

  // Clear previous chart if exists
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
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Grams Used"
          }
        },
        x: {
          title: {
            display: true,
            text: "Material"
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: "top"
        },
        tooltip: {
          enabled: true
        }
      }
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

  let material = document.getElementById("materialSelect").value;
  const customMaterial = document.getElementById("customMaterialInput").value.trim();

  if (material === "Custom") {
    if (!customMaterial) {
      alert("Please enter a custom material.");
      return;
    }
    material = customMaterial;

    if (!materialsList.includes(material)) {
      materialsList.splice(materialsList.length - 1, 0, material); // insert before "Custom"
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
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "~select a spool~";
  defaultOption.disabled = true;
  defaultOption.selected = true;
  select.appendChild(defaultOption);

  spoolLibrary.forEach((spool, index) => {
    const option = document.createElement("option");
    option.value = index;
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

// -----  Library -----
function Library() {
  const list = document.getElementById("spoolList");
  list.innerHTML = "";
  if (spoolLibrary.length === 0) {
    list.innerHTML = "<li>No spools in inventory</li>";
    return;
  }
  spoolLibrary.forEach((spool, index) => {
    const li = document.createElement("li");
    li.setAttribute('data-spool-id', index.toString());
    li.textContent = `${spool.brand} - ${spool.color} - ${spool.material} (${spool.length}m, ${spool.weight}g)`;
    list.appendChild(li);
  });
}

// ----- Populate spool multi-select (tracking) -----
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

// ----- Start Print Job -----
function startPrintJob() {
  const jobName = document.getElementById("jobName").value.trim();
  const selectedOptions = Array.from(document.getElementById("selectSpools").selectedOptions);
  const allSpools = spoolLibrary;

  if (selectedOptions.length === 0) {
    alert("Please select at least one spool.");
    return;
  }

  const spools = selectedOptions.map(opt => {
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

// ----- Show End Print Section -----
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

// ----- End Print Job -----
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

// ----- Cancel Active Job -----
function cancelActiveJob() {
  if (confirm("Cancel the active print job? Progress will be lost.")) {
    localStorage.removeItem("activePrintJob");
    activePrintJob = null;
    showScreen("home");
  }
}

// ----- Highlight Spool in Library -----
function highlightSpool(spoolId) {
  const spoolList = document.getElementById('spoolList');
  const items = spoolList.querySelectorAll('li');

  // Clear previous highlights
  items.forEach(item => item.style.backgroundColor = '');

  const targetItem = [...items].find(li => li.getAttribute('data-spool-id') === spoolId.toString());

  if (targetItem) {
    targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetItem.style.backgroundColor = 'yellow';

    setTimeout(() => {
      targetItem.style.backgroundColor = '';
    }, 3000);
  }
}

// ----- Populate Spool Filter Dropdown -----
function populateSpoolFilterDropdown() {
  const spoolSelect = document.getElementById("filterSpool");
  spoolSelect.innerHTML = '<option value="">All Spools</option>';

  const usageHistory = JSON.parse(localStorage.getItem("usageHistory")) || [];
  const uniqueLabels = new Set();

  usageHistory.forEach(job => {
    job.spools.forEach(spool => {
      uniqueLabels.add(spool.spoolLabel);
    });
  });

  [...uniqueLabels].sort().forEach(label => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    spoolSelect.appendChild(option);
  });
}

// -----  History with Filters -----
function HistoryFiltered() {
  const usageHistory = JSON.parse(localStorage.getItem("usageHistory")) || [];

  const startDateVal = document.getElementById("filterStartDate").value;
  const endDateVal = document.getElementById("filterEndDate").value;
  const spoolLabel = document.getElementById("filterSpool").value;

  const startDate = startDateVal ? new Date(startDateVal) : null;
  const endDate = endDateVal ? new Date(endDateVal) : null;
  if (endDate) {
    endDate.setHours(23,59,59,999); // include entire day
  }

  const filtered = usageHistory.filter(job => {
    const jobDate = new Date(job.startTime);

    if (startDate && jobDate < startDate) return false;
    if (endDate && jobDate > endDate) return false;

    if (!spoolLabel) return true;

    return job.spools.some(s => s.spoolLabel.toLowerCase().includes(spoolLabel.toLowerCase()));
  });

  const list = document.getElementById("historyList");
  list.innerHTML = "";

  if (filtered.length === 0) {
    list.innerHTML = "<li>No usage history found for the selected filters.</li>";
    return;
  }

  filtered.forEach(job => {
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

  // Add click handlers to spool links
  document.querySelectorAll('.spool-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const spoolIndex = e.target.getAttribute('data-spool-index');
      showScreen('library');
      highlightSpool(spoolIndex);
    });
  });
}

// ----- Apply and Clear Filters -----
function applyFilters() {
  HistoryFiltered();
}

function clearFilters() {
  document.getElementById("filterStartDate").value = "";
  document.getElementById("filterEndDate").value = "";
  document.getElementById("filterSpool").value = "";
  HistoryFiltered();
}

// -----  History (initial) -----
function History() {
  populateSpoolFilterDropdown();
  HistoryFiltered();
  setupLiveFilters();
}

// ----- Setup Live Filters -----
function setupLiveFilters() {
  const startDateInput = document.getElementById("filterStartDate");
  const endDateInput = document.getElementById("filterEndDate");
  const spoolSelect = document.getElementById("filterSpool");
  const clearBtn = document.getElementById("clearFiltersBtn");

  function updateFilters() {
    HistoryFiltered();
  }

  startDateInput.addEventListener("change", updateFilters);
  endDateInput.addEventListener("change", updateFilters);
  spoolSelect.addEventListener("change", updateFilters);

  clearBtn.addEventListener("click", () => {
    clearFilters();
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

// ----- Initialize -----
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

  // Restore active job if exists
  const savedJob = JSON.parse(localStorage.getItem("activePrintJob"));
  if (savedJob) {
    activePrintJob = savedJob;
    showEndPrintSection();
  } else {
    showScreen("home");
  }

  populateMaterialDropdown();
});


function renderAnalytics() {
  console.log("renderAnalytics called");
  const usageHistory = JSON.parse(localStorage.getItem("usageHistory")) || [];
  const materialUsage = {};

  usageHistory.forEach(job => {
    job.spools.forEach(spool => {
      const material = spool.spoolLabel.match(/\(([^)]+)\)/)?.[1] || "Unknown";
      const used = spool.used || 0;
      materialUsage[material] = (materialUsage[material] || 0) + used;
    });
  });

  const labels = Object.keys(materialUsage);
  const data = labels.map(label => materialUsage[label]);
  console.log("Labels:", labels, "Data:", data);

  if (labels.length === 0) {
    console.warn("No usage data to display");
  }

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
        y: {
          beginAtZero: true,
          title: { display: true, text: "Grams Used" }
        },
        x: {
          title: { display: true, text: "Material" }
        }
      },
      plugins: {
        legend: { display: true, position: "top" },
        tooltip: { enabled: true }
      }
    }
  });
}