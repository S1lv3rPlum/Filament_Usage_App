function showScreen(id) {
  document.querySelectorAll("main, section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "library") renderLibrary();
  if (id === "history") renderHistory();
  if (id === "tracking") populateSpoolMultiSelect();
  if (id === "addSpool") populateMaterialDropdown();
  if (id === "analytics") renderAnalytics();
  if (id === "settings") {
    // settings setup if needed
  }
}

function renderHistory() {
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "";

  const startDate = document.getElementById("filterStartDate").value;
  const endDate = document.getElementById("filterEndDate").value;
  const spoolFilter = document.getElementById("filterSpool").value;

  let filtered = usageHistory;

  if (startDate) {
    filtered = filtered.filter(item => new Date(item.date) >= new Date(startDate));
  }
  if (endDate) {
    filtered = filtered.filter(item => new Date(item.date) <= new Date(endDate));
  }
  if (spoolFilter) {
    filtered = filtered.filter(item => item.spoolId === spoolFilter);
  }

  // If no filters, show the last 10 by default
  if (!startDate && !endDate && !spoolFilter) {
    filtered = [...usageHistory]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
  } else {
    filtered = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  filtered.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.date}: ${item.jobName || "Unnamed Job"} — ${item.materialUsed}g`;
    historyList.appendChild(li);
  });
}

// Event listeners for filter buttons
document.getElementById("filterButton").addEventListener("click", renderHistory);
document.getElementById("clearFilterButton").addEventListener("click", () => {
  document.getElementById("filterStartDate").value = "";
  document.getElementById("filterEndDate").value = "";
  document.getElementById("filterSpool").value = "";
  renderHistory();
});