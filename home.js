function showScreen(id) {
  document.querySelectorAll("main, section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "library") renderLibrary();
  if (id === "history") renderHistory(true); // Pass true to use default last 10
  if (id === "tracking") populateSpoolMultiSelect();
  if (id === "addSpool") populateMaterialDropdown();
  if (id === "analytics") renderAnalytics();
  if (id === "settings") {
    // Setup for settings if needed
  }
}

// ==============================
// Spool Management
// ==============================
function saveSpool() {
  const brand = document.getElementById("brand").value.trim();
  const color = document.getElementById("color").value.trim();
  const material = document.getElementById("materialSelect").value === "custom"
    ? document.getElementById("customMaterialInput").value.trim()
    : document.getElementById("materialSelect").value;
  const length = parseFloat(document.getElementById("length").value);
  const weight = parseFloat(document.getElementById("weight").value);

  if (!brand || !color || !material || isNaN(length) || isNaN(weight)) {
    alert("Please fill in all fields.");
    return;
  }

  const spools = JSON.parse(localStorage.getItem("spools") || "[]");
  spools.push({
    id: Date.now(),
    brand,
    color,
    material,
    length,
    weight
  });

  localStorage.setItem("spools", JSON.stringify(spools));
  alert("Spool saved!");
  showScreen("home");
}

function renderLibrary() {
  const spoolList = document.getElementById("spoolList");
  spoolList.innerHTML = "";

  const spools = JSON.parse(localStorage.getItem("spools") || "[]");
  spools.forEach(spool => {
    const li = document.createElement("li");
    li.textContent = `${spool.brand} - ${spool.color} (${spool.material}) | ${spool.length}m, ${spool.weight}g`;
    spoolList.appendChild(li);
  });
}

// ==============================
// Tracking
// ==============================
function populateSpoolMultiSelect() {
  const select = document.getElementById("selectSpools");
  select.innerHTML = "";

  const spools = JSON.parse(localStorage.getItem("spools") || "[]");
  spools.forEach(spool => {
    const option = document.createElement("option");
    option.value = spool.id;
    option.textContent = `${spool.brand} - ${spool.color} (${spool.material}, ${spool.weight}g)`;
    select.appendChild(option);
  });
}

function startPrintJob() {
  const jobName = document.getElementById("jobName").value.trim() || "Untitled Job";
  const selectedSpools = Array.from(document.getElementById("selectSpools").selectedOptions).map(o => o.value);

  if (selectedSpools.length === 0) {
    alert("Please select at least one spool.");
    return;
  }

  const activeJob = {
    id: Date.now(),
    name: jobName,
    spools: selectedSpools,
    startTime: new Date().toISOString(),
    startWeights: selectedSpools.map(spoolId => {
      const spool = JSON.parse(localStorage.getItem("spools") || "[]").find(s => s.id == spoolId);
      return { spoolId, weight: spool.weight };
    })
  };

  localStorage.setItem("activeJob", JSON.stringify(activeJob));
  alert(`Started job: ${jobName}`);
  document.getElementById("startPrintSection").classList.add("hidden");
  document.getElementById("endPrintSection").classList.remove("hidden");
  document.getElementById("activeJobName").textContent = `Active Job: ${jobName}`;
}

function endPrintJob() {
  const activeJob = JSON.parse(localStorage.getItem("activeJob"));
  if (!activeJob) {
    alert("No active job found.");
    return;
  }

  const endWeights = [];
  activeJob.spools.forEach(spoolId => {
    const newWeight = parseFloat(prompt(`Enter new weight for spool ${spoolId} (g):`));
    if (isNaN(newWeight)) {
      alert("Invalid weight entered.");
      return;
    }
    endWeights.push({ spoolId, weight: newWeight });

    // Update spool in inventory
    const spools = JSON.parse(localStorage.getItem("spools") || "[]");
    const spool = spools.find(s => s.id == spoolId);
    if (spool) spool.weight = newWeight;
    localStorage.setItem("spools", JSON.stringify(spools));
  });

  const history = JSON.parse(localStorage.getItem("history") || "[]");
  history.push({
    id: activeJob.id,
    name: activeJob.name,
    spools: activeJob.spools,
    startTime: activeJob.startTime,
    endTime: new Date().toISOString(),
    startWeights: activeJob.startWeights,
    endWeights
  });
  localStorage.setItem("history", JSON.stringify(history));

  localStorage.removeItem("activeJob");
  alert("Job ended and history updated.");
  showScreen("home");
}

function cancelActiveJob() {
  localStorage.removeItem("activeJob");
  alert("Active job cancelled.");
  showScreen("home");
}

// ==============================
// History
// ==============================
function renderHistory(defaultLastTen = false) {
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "";

  const history = JSON.parse(localStorage.getItem("history") || "[]");

  let filtered = history;
  if (defaultLastTen) {
    filtered = history
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      .slice(0, 10);
  } else {
    const startDate = document.getElementById("filterStartDate").value;
    const endDate = document.getElementById("filterEndDate").value;
    const spoolFilter = document.getElementById("filterSpool").value;

    filtered = history.filter(job => {
      const jobDate = new Date(job.startTime);
      let pass = true;
      if (startDate) pass = pass && jobDate >= new Date(startDate);
      if (endDate) pass = pass && jobDate <= new Date(endDate);
      if (spoolFilter) pass = pass && job.spools.includes(spoolFilter);
      return pass;
    }).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  }

  filtered.forEach(job => {
    const li = document.createElement("li");
    li.textContent = `${job.name} | ${new Date(job.startTime).toLocaleString()}`;
    historyList.appendChild(li);
  });
}

// ==============================
// Analytics
// ==============================
function renderAnalytics() {
  const history = JSON.parse(localStorage.getItem("history") || "[]");
  const materialUsage = {};

  history.forEach(job => {
    job.startWeights.forEach((start, index) => {
      const end = job.endWeights[index];
      const used = start.weight - end.weight;
      materialUsage[start.spoolId] = (materialUsage[start.spoolId] || 0) + used;
    });
  });

  const ctx = document.getElementById("usageChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(materialUsage),
      datasets: [{
        label: "Material Used (g)",
        data: Object.values(materialUsage)
      }]
    }
  });
}

// ==============================
// Material Dropdown
// ==============================
function populateMaterialDropdown() {
  const select = document.getElementById("materialSelect");
  select.innerHTML = "";

  const materials = ["PLA", "ABS", "PETG", "TPU", "Nylon", "custom"];
  materials.forEach(mat => {
    const option = document.createElement("option");
    option.value = mat;
    option.textContent = mat === "custom" ? "Custom..." : mat;
    select.appendChild(option);
  });
}

function handleMaterialChange() {
  const customInput = document.getElementById("customMaterialInput");
  if (document.getElementById("materialSelect").value === "custom") {
    customInput.classList.remove("hidden");
  } else {
    customInput.classList.add("hidden");
  }
}

// ==============================
// Event Listeners
// ==============================
document.getElementById("filterButton").addEventListener("click", () => renderHistory(false));
document.getElementById("clearFilterButton").addEventListener("click", () => {
  document.getElementById("filterStartDate").value = "";
  document.getElementById("filterEndDate").value = "";
  document.getElementById("filterSpool").value = "";
  renderHistory(true);
});