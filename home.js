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

let activePrintJob = null;
let historyDisplayCount = 10;
let historyPage = 0;

// ----- Screen Navigation -----
function showScreen(id) {
  document.querySelectorAll("main, section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "library") renderLibrary();
  if (id === "history") {
    resetHistoryPagination();
    renderHistory();
  }

  if (id === "tracking") {
    populateSpoolMultiSelect();

    if (activePrintJob) {
      document.getElementById("startPrintSection").classList.add("hidden");
      document.getElementById("endPrintSection").classList.remove("hidden");
      document.getElementById("activeJobName").textContent = `Active Job: ${activePrintJob.jobName}`;
      showEndPrintSection();
    } else {
      document.getElementById("startPrintSection").classList.remove("hidden");
      document.getElementById("endPrintSection").classList.add("hidden");
    }
  }

  if (id === "addSpool") {
    populateMaterialDropdown();
    populateEmptySpoolDropdown();
  }
  if (id === "analytics") renderAnalytics();
  if (id === "settings") {
    renderMaterialsList();
  }
}

// ----- Material Management Functions -----
function renderMaterialsList() {
  const list = document.getElementById("materialsList");
  if (!list) return;
  
  list.innerHTML = "";
  
  materialsList.forEach((material, index) => {
    const li = document.createElement("li");
    li.style.padding = "10px";
    li.style.marginBottom = "8px";
    li.style.background = "#f0f4f8";
    li.style.borderRadius = "6px";
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    
    const span = document.createElement("span");
    span.textContent = material;
    span.style.fontWeight = "500";
    
    li.appendChild(span);
    
    if (material !== "Custom") {
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.style.width = "auto";
      deleteBtn.style.padding = "6px 12px";
      deleteBtn.style.background = "#ff6b6b";
      deleteBtn.style.fontSize = "0.9em";
      deleteBtn.onclick = () => deleteMaterial(index);
      li.appendChild(deleteBtn);
    } else {
      const label = document.createElement("small");
      label.textContent = "(Default)";
      label.style.color = "#666";
      li.appendChild(label);
    }
    
    list.appendChild(li);
  });
}

function addNewMaterial() {
  const input = document.getElementById("newMaterialInput");
  const newMaterial = input.value.trim();
  
  if (!newMaterial) {
    alert("Please enter a material name.");
    return;
  }
  
  if (materialsList.includes(newMaterial)) {
    alert("This material already exists.");
    return;
  }
  
  const customIndex = materialsList.indexOf("Custom");
  if (customIndex !== -1) {
    materialsList.splice(customIndex, 0, newMaterial);
  } else {
    materialsList.push(newMaterial);
  }
  
  localStorage.setItem("materialsList", JSON.stringify(materialsList));
  input.value = "";
  renderMaterialsList();
  alert(`Material "${newMaterial}" added!`);
}

function deleteMaterial(index) {
  const material = materialsList[index];
  
  const spoolsUsingMaterial = spoolLibrary.filter(spool => spool.material === material);
  
  if (spoolsUsingMaterial.length > 0) {
    alert(`Cannot delete "${material}" because ${spoolsUsingMaterial.length} spool(s) are using it. Please update or remove those spools first.`);
    return;
  }
  
  if (confirm(`Delete material type "${material}"?`)) {
    materialsList.splice(index, 1);
    localStorage.setItem("materialsList", JSON.stringify(materialsList));
    renderMaterialsList();
    alert(`Material "${material}" deleted.`);
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

// ----- Data Storage for Empty Spools -----
let emptySpoolsLibrary = JSON.parse(localStorage.getItem("emptySpools")) || [];

// ----- Populate dropdown -----
function populateEmptySpoolDropdown() {
  const select = document.getElementById("emptySpoolSelect");
  if (!select) return;
  
  select.innerHTML = "";

  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "None";
  select.appendChild(noneOpt);

  emptySpoolsLibrary.forEach((spool, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = `${spool.brand} – ${spool.package} (${spool.weight} g)`;
    select.appendChild(opt);
  });

  const otherOpt = document.createElement("option");
  otherOpt.value = "other";
  otherOpt.textContent = "Other (Add new…)";
  select.appendChild(otherOpt);

  select.value = "";
}

// ----- Handle empty spool selection and calculate filament amount -----
function handleEmptySpoolSelection() {
  const select = document.getElementById("emptySpoolSelect");
  
  if (select.value === "other") {
    window.open("emptyspools.html", "_blank");
    select.value = "";
    return;
  }
  
  calculateFilamentAmount();
}

function calculateFilamentAmount() {
  const emptySpoolSelect = document.getElementById("emptySpoolSelect");
  const fullWeight = parseFloat(document.getElementById("fullSpoolWeight").value) || 0;
  
  let emptyWeight = 0;
  
  if (emptySpoolSelect.value !== "" && emptySpoolSelect.value !== "other") {
    const emptySpools = JSON.parse(localStorage.getItem("emptySpools")) || [];
    const selectedSpool = emptySpools[emptySpoolSelect.value];
    if (selectedSpool) {
      emptyWeight = selectedSpool.weight;
    }
  }
  
  const filamentAmount = fullWeight - emptyWeight;
  
  const displayDiv = document.getElementById("filamentAmountDisplay");
  const amountSpan = document.getElementById("filamentAmount");
  
  if (fullWeight > 0 && emptyWeight > 0 && filamentAmount > 0) {
    displayDiv.style.display = "block";
    amountSpan.textContent = `${filamentAmount.toFixed(2)}g (Full: ${fullWeight.toFixed(2)}g - Empty: ${emptyWeight.toFixed(2)}g)`;
  } else {
    displayDiv.style.display = "none";
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

    if (!materialsList.includes(material)) {
      materialsList.splice(materialsList.length - 1, 0, material);
      localStorage.setItem("materialsList", JSON.stringify(materialsList));
    }
  }

  const lengthInput = document.getElementById("length").value;
  const length = lengthInput ? parseFloat(lengthInput) : 0;
  
  const fullSpoolWeight = parseFloat(document.getElementById("fullSpoolWeight").value);

  const emptySpoolSelect = document.getElementById("emptySpoolSelect");
  let emptySpoolId = emptySpoolSelect.value === "" || emptySpoolSelect.value === "other" 
    ? null 
    : Number(emptySpoolSelect.value);
  
  let emptyWeight = 0;
  if (emptySpoolId !== null) {
    const emptySpools = JSON.parse(localStorage.getItem("emptySpools")) || [];
    const selectedSpool = emptySpools[emptySpoolId];
    if (selectedSpool) {
      emptyWeight = selectedSpool.weight;
    }
  }
  
  const weight = fullSpoolWeight - emptyWeight;

  if (!brand || !color || !material || isNaN(fullSpoolWeight)) {
    alert("Please fill out Brand, Color, Material, and Full Spool Weight fields.");
    return;
  }
  
  if (emptySpoolId !== null && weight <= 0) {
    alert("Full spool weight must be greater than empty spool weight.");
    return;
  }

  spoolLibrary.push({ 
    brand, 
    color, 
    material, 
    length, 
    weight: emptySpoolId !== null ? weight : fullSpoolWeight,
    emptyWeight: emptySpoolId !== null ? emptyWeight : 0,
    fullSpoolWeight,
    emptySpoolId 
  });
  localStorage.setItem("spoolLibrary", JSON.stringify(spoolLibrary));

  document.getElementById("brand").value = "";
  document.getElementById("color").value = "";
  populateMaterialDropdown();
  document.getElementById("length").value = "";
  document.getElementById("fullSpoolWeight").value = "";
  document.getElementById("filamentAmountDisplay").style.display = "none";
  populateEmptySpoolDropdown();

  const savedWeight = emptySpoolId !== null ? weight.toFixed(2) : fullSpoolWeight.toFixed(2);
  alert(`Spool saved! ${emptySpoolId !== null ? 'Filament amount: ' : 'Weight: '}${savedWeight}g`);
  showScreen("library");
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
    li.setAttribute('data-spool-id', index.toString());
    const lengthDisplay = spool.length > 0 ? `${spool.length}m, ` : '';
    
    let weightDisplay = `${spool.weight.toFixed(2)}g filament`;
    if (spool.fullSpoolWeight && spool.emptyWeight) {
      weightDisplay = `${spool.weight.toFixed(2)}g filament (Full: ${spool.fullSpoolWeight.toFixed(2)}g - Empty: ${spool.emptyWeight.toFixed(2)}g)`;
    }
    
    li.textContent = `${spool.brand} - ${spool.color} - ${spool.material} (${lengthDisplay}${weightDisplay})`;
    list.appendChild(li);
  });
}

// ----- Render History with Filtering -----
function renderHistory() {
  populateHistorySpoolDropdown();
  renderHistoryFiltered(true);
  setupLiveFilters();
}

function renderHistoryFiltered(defaultLastTen = false) {
  const usageHistory = JSON.parse(localStorage.getItem("usageHistory")) || [];

  const startDateVal = document.getElementById("filterStartDate")?.value || "";
  const endDateVal = document.getElementById("filterEndDate")?.value || "";
  const spoolLabel = document.getElementById("filterSpool")?.value || "";

  const startDate = startDateVal ? new Date(startDateVal) : null;
  const endDate = endDateVal ? new Date(endDateVal) : null;
  if (endDate) endDate.setHours(23, 59, 59, 999);

  let filtered = usageHistory.filter(job => {
    const jobDate = new Date(job.startTime);
    if (startDate && jobDate < startDate) return false;
    if (endDate && jobDate > endDate) return false;
    if (!spoolLabel) return true;
    return job.spools.some(s => (s.spoolLabel || "").toLowerCase().includes(spoolLabel.toLowerCase()));
  });

  filtered.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  const noFiltersApplied = !startDateVal && !endDateVal && !spoolLabel;
  if (defaultLastTen && noFiltersApplied) {
    filtered = filtered.slice(0, 10);
  }

  const list = document.getElementById("historyList");
  list.innerHTML = "";

  if (filtered.length === 0) {
    list.innerHTML = "<li>No usage history found for the selected filters.</li>";
    return;
  }

  filtered.forEach(job => {
    const li = document.createElement("li");
    const statusBadge = job.status === "failed" ? "❌ " : "";
    let spoolDetails = job.spools.map(s =>
      `<a href="#" class="spool-link" data-spool-index="${s.spoolId}">${s.spoolLabel}</a>: ${(s.used || 0).toFixed(2)} g used`
    ).join("<br>");
    li.innerHTML = `<strong>${statusBadge}${job.jobName}</strong> <small>(${new Date(job.startTime).toLocaleString()} → ${new Date(job.endTime).toLocaleString()})</small><br>${spoolDetails}`;
    list.appendChild(li);
  });

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
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  if (window.usageChartInstance) {
    window.usageChartInstance.destroy();
  }

  const usageByMaterial = {};
  
  usageHistory.forEach(job => {
    if (job.spools && Array.isArray(job.spools)) {
      job.spools.forEach(spool => {
        const materialMatch = spool.spoolLabel.match(/\(([^)]+)\)/);
        const material = materialMatch ? materialMatch[1] : "Unknown";
        const used = spool.used || spool.gramsUsed || 0;
        
        usageByMaterial[material] = (usageByMaterial[material] || 0) + used;
      });
    } else if (job.spoolMaterial && job.lengthUsed) {
      const material = job.spoolMaterial;
      const used = job.lengthUsed || 0;
      usageByMaterial[material] = (usageByMaterial[material] || 0) + used;
    }
  });

  const labels = Object.keys(usageByMaterial);
  const data = Object.values(usageByMaterial);

  if (labels.length === 0) {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#666";
    ctx.textAlign = "center";
    ctx.fillText("No usage data available", canvas.width / 2, canvas.height / 2);
    return;
  }

  window.usageChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: 'Filament Used (grams)',
        data: data,
        backgroundColor: [
          '#007acc', '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', 
          '#ff6384', '#4bc0c0', '#ffce56'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value.toFixed(1)}g (${percentage}%)`;
            }
          }
        }
      }
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
  prompt.innerHTML = `<span style="margin-right:10px;">Update available</span><button style="background:#fff;color:#007acc;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">Update</button>`;

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

  showScreen("home");
  populateMaterialDropdown();
});

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

    const estimatedInput = document.getElementById(`estimatedWeight_${opt.value}`);
    const estimatedWeight = estimatedInput ? parseFloat(estimatedInput.value) || null : null;

    const label = `${spoolInfo.brand || "Unknown"} - ${spoolInfo.color || "?"} (${spoolInfo.material || "?"}) (${startWeight}g)`;

    return {
      spoolId: opt.value,
      spoolLabel: label,
      startWeight,
      estimatedWeight
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
    div.style.marginBottom = "15px";
    
    let calculatedFinalWeight = "";
    let estimatedText = "";
    if (spool.estimatedWeight) {
      calculatedFinalWeight = (spool.startWeight - spool.estimatedWeight).toFixed(2);
      estimatedText = `<small style="color: #666;">(Estimated usage: ${spool.estimatedWeight}g → Expected final: ${calculatedFinalWeight}g)</small>`;
    }
    
    div.innerHTML = `
      <label>${spool.spoolLabel} ${estimatedText}<br>
      Final Weight After Print (g) - Optional if estimated:</label>
      <input 
        type="number" 
        id="endWeight_${spool.spoolId}" 
        step="0.01" 
        value="${calculatedFinalWeight}"
        placeholder="${spool.estimatedWeight ? 'Auto-calculated' : 'Enter final weight'}"
        style="width: 100%; padding: 8px; margin-top: 5px;" 
      />
    `;
    container.appendChild(div);
  });
}

function endPrintJob() {
  const spools = JSON.parse(localStorage.getItem("spoolLibrary")) || [];
  const history = JSON.parse(localStorage.getItem("usageHistory")) || [];

  const updatedSpools = activePrintJob.spools.map(spoolData => {
    const endWeightInput = document.getElementById(`endWeight_${spoolData.spoolId}`).value;
    let endWeight;
    
    if (endWeightInput && endWeightInput.trim() !== "") {
      endWeight = parseFloat(endWeightInput);
      if (isNaN(endWeight)) {
        alert("Invalid weight entered. Please check your inputs.");
        throw new Error("Invalid end weight");
      }
    } else if (spoolData.estimatedWeight) {
      endWeight = spoolData.startWeight - spoolData.estimatedWeight;
    } else {
      alert("Please enter final weight for all spools (or provide estimated usage when starting print).");
      throw new Error("Missing end weights");
    }
    
    const gramsUsed = spoolData.startWeight - endWeight;

    const spoolIndex = parseInt(spoolData.spoolId, 10);
    if (spoolIndex !== -1) {
      spools[spoolIndex].weight = endWeight;
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
    endTime: new Date().toISOString(),
    status: "success"
  });

  localStorage.setItem("usageHistory", JSON.stringify(history));
  localStorage.removeItem("activePrintJob");
  activePrintJob = null;

  alert("Print job ended and usage recorded.");
  showScreen("home");
}

function failedPrintJob() {
  if (!confirm("Mark this print as failed? You must weigh your spools and enter the actual final weights.")) {
    return;
  }
  
  const spools = JSON.parse(localStorage.getItem("spoolLibrary")) || [];
  const history = JSON.parse(localStorage.getItem("usageHistory")) || [];

  const updatedSpools = activePrintJob.spools.map(spoolData => {
    const endWeightInput = document.getElementById(`endWeight_${spoolData.spoolId}`).value;
    
    if (!endWeightInput || endWeightInput.trim() === "") {
      alert("For failed prints, you must weigh and enter the actual final weight for all spools.");
      throw new Error("Missing end weights for failed print");
    }
    
    const endWeight = parseFloat(endWeightInput);
    if (isNaN(endWeight)) {
      alert("Invalid weight entered. Please check your inputs.");
      throw new Error("Invalid end weight");
    }
    
    const gramsUsed = spoolData.startWeight - endWeight;

    const spoolIndex = parseInt(spoolData.spoolId, 10);
    if (spoolIndex !== -1) {
      spools[spoolIndex].weight = endWeight;
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
    jobName: `FAILED: ${activePrintJob.jobName}`,
    spools: updatedSpools,
    startTime: activePrintJob.startTime,
    endTime: new Date().toISOString(),
    status: "failed"
  });

  localStorage.setItem("usageHistory", JSON.stringify(history));
  localStorage.removeItem("activePrintJob");
  activePrintJob = null;

  alert("Failed print recorded. Spool weights updated.");
  showScreen("home");
}

function cancelActiveJob() {
  if (confirm("Cancel the active print job? Progress will be lost.")) {
    localStorage.removeItem("activePrintJob");
    activePrintJob = null;
    showScreen("home");
  }
}

document.getElementById("selectSpools")?.addEventListener("change", () => {
  const container = document.getElementById("estimatedWeightsContainer");
  if (!container) return;

  container.innerHTML = "";
  const selected = Array.from(document.getElementById("selectSpools").selectedOptions);
  
  if (selected.length > 0) {
    const heading = document.createElement("h3");
    heading.textContent = "Estimated Filament Needed:";
    heading.style.marginTop = "15px";
    container.appendChild(heading);
  }
  
  selected.forEach(opt => {
    const div = document.createElement("div");
    div.style.marginBottom = "10px";
    div.innerHTML = `<label>${opt.text} - Estimated Weight (g):</label><input type="number" id="estimatedWeight_${opt.value}" step="0.01" placeholder="Optional" style="width: 100%; padding: 8px; margin-top: 5px;" />`;
    container.appendChild(div);
  });
});

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

function populateHistorySpoolDropdown() {
  const spoolSelect = document.getElementById("filterSpool");
  if (!spoolSelect) return;

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

function clearHistoryFilters() {
  const s = document.getElementById("filterStartDate");
  const e = document.getElementById("filterEndDate");
  const f = document.getElementById("filterSpool");
  if (s) s.value = "";
  if (e) e.value = "";
  if (f) f.value = "";
  renderHistoryFiltered(true);
}

function setupLiveFilters() {
  const startDateInput = document.getElementById("filterStartDate");
  const endDateInput = document.getElementById("filterEndDate");
  const spoolSelect = document.getElementById("filterSpool");
  const filterBtn = document.getElementById("filterButton");
  const clearBtn = document.getElementById("clearFilterButton");

  const updateFilters = () => renderHistoryFiltered(false);

  startDateInput?.addEventListener("change", updateFilters);
  endDateInput?.addEventListener("change", updateFilters);
  spoolSelect?.addEventListener("change", updateFilters);

  filterBtn?.addEventListener("click", updateFilters);
  clearBtn?.addEventListener("click", () => clearHistoryFilters());
}

function resetHistoryPagination() {
  historyPage = 0;
}

window.showScreen = showScreen;
  