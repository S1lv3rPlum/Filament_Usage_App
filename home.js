// ----- Global showScreen ----- console.log("JS Loaded, showScreen is:", typeof showScreen); window.showScreen = showScreen;

// ----- Data Storage ----- let spoolLibrary = JSON.parse(localStorage.getItem("spoolLibrary")) || []; let usageHistory = JSON.parse(localStorage.getItem("usageHistory")) || []; let materialsList = JSON.parse(localStorage.getItem("materialsList")) || ["PLA","ABS","PETG","Nylon","TPU","Custom"]; let activePrintJob = JSON.parse(localStorage.getItem("activePrintJob")) || null;

// ----- Navigation ----- function showScreen(id) { document.querySelectorAll("main, section").forEach(s => s.classList.add("hidden")); document.getElementById(id).classList.remove("hidden");

if (id === "library") Library(); else if (id === "history") { resetHistoryPagination(); renderHistory(); } else if (id === "tracking") { populateSpoolMultiSelect(); if (activePrintJob) { document.getElementById("startPrintSection").classList.add("hidden"); document.getElementById("endPrintSection").classList.remove("hidden"); document.getElementById("activeJobName").textContent = Active Job: ${activePrintJob.jobName}; } else { document.getElementById("startPrintSection").classList.remove("hidden"); document.getElementById("endPrintSection").classList.add("hidden"); } } else if (id === "addSpool") { populateMaterialDropdown(); } else if (id === "analytics") { Analytics(); } }

// ----- History Pagination and Display ----- let historyDisplayCount = 10; // number of entries per page let historyPage = 0; // current page (0 = newest 10)

function resetHistoryPagination() { historyPage = 0; }

function renderHistory() { const usageHistory = JSON.parse(localStorage.getItem("usageHistory")) || []; usageHistory.sort((a, b) => new Date(b.startTime) - new Date(a.startTime)); // newest first

const start = historyPage * historyDisplayCount; const end = start + historyDisplayCount; const slice = usageHistory.slice(start, end);

const list = document.getElementById("historyList"); list.innerHTML = "";

if (slice.length === 0) { list.innerHTML = "<li>No print jobs found.</li>"; return; }

slice.forEach(job => { const materialTotals = {}; job.spools.forEach(spool => { const material = spool.spoolLabel.match(//)?.[1] || "Unknown"; materialTotals[material] = (materialTotals[material] || 0) + (spool.used || 0); });

const materialsUsed = Object.entries(materialTotals)
  .map(([mat, grams]) => `${mat}: ${grams.toFixed(2)} g`)
  .join(", ");

const li = document.createElement("li");
li.innerHTML = `
  <strong>${job.jobName}</strong><br/>
  <small>${new Date(job.startTime).toLocaleString()} → ${new Date(job.endTime).toLocaleString()}</small><br/>
  Materials used: ${materialsUsed}
`;
list.appendChild(li);

});

// Load More button const loadMoreBtn = document.getElementById("loadMoreHistoryBtn"); if (!loadMoreBtn) { const btn = document.createElement("button"); btn.id = "loadMoreHistoryBtn"; btn.textContent = "Load More"; btn.style.marginTop = "10px"; btn.onclick = () => { historyPage++; renderHistory(); }; list.parentNode.appendChild(btn); }

if (end >= usageHistory.length) { if (loadMoreBtn) loadMoreBtn.style.display = "none"; } else { if (loadMoreBtn) loadMoreBtn.style.display = "inline-block"; } }

