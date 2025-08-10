function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  if (screenId === 'history') loadHistory();
}

function saveSpool() {
  const name = document.getElementById('spoolName').value.trim();
  const weight = document.getElementById('spoolWeight').value;
  const material = document.getElementById('spoolMaterial').value;
  const color = document.getElementById('spoolColor').value;

  if (!name || !weight || !material) {
    alert("Please fill out all required fields.");
    return;
  }

  const spool = {
    name,
    weight: parseInt(weight),
    material,
    color,
    date: new Date().toLocaleDateString()
  };

  let history = JSON.parse(localStorage.getItem('filamentHistory')) || [];
  history.push(spool);
  localStorage.setItem('filamentHistory', JSON.stringify(history));

  alert("Spool saved!");
  document.getElementById('spoolName').value = "";
  document.getElementById('spoolWeight').value = "";
  document.getElementById('spoolMaterial').value = "";
  document.getElementById('spoolColor').value = "#000000";
}

function loadHistory() {
  const historyList = document.getElementById('historyList');
  historyList.innerHTML = "";

  let history = JSON.parse(localStorage.getItem('filamentHistory')) || [];
  if (history.length === 0) {
    historyList.innerHTML = "<p>No history yet.</p>";
    return;
  }

  history.forEach(item => {
    const div = document.createElement('div');
    div.classList.add('list-item');
    div.innerHTML = `<strong>${item.name}</strong> - ${item.material} - ${item.weight}g - ${item.date}
                     <br><span style="color:${item.color}">⬤</span>`;
    historyList.appendChild(div);
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").then(registration => {
    console.log("Service Worker registered");

    // Listen for updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdatePrompt(() => {
            newWorker.postMessage({ action: "skipWaiting" });
          });
        }
      });
    });
  });

  // Reload when the new SW activates
  let refreshing;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      window.location.reload();
      refreshing = true;
    }
  });
}

// Show update prompt
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

// ----- Navigation -----
function showScreen(id) {
  document.querySelectorAll("main, section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "library") renderLibrary();
  if (id === "history") renderHistory();
}

// ----- Data Handling -----
let spoolLibrary = JSON.parse(localStorage.getItem("spoolLibrary")) || [];
let usageHistory = JSON.parse(localStorage.getItem("usageHistory")) || [];

// Save new spool to inventory
function saveSpool() {
  const brand = document.getElementById("brand").value.trim();
  const color = document.getElementById("color").value.trim();
  const material = document.getElementById("material").value.trim();
  const length = parseFloat(document.getElementById("length").value);
  const weight = parseFloat(document.getElementById("weight").value);

  if (!brand || !color || !material || isNaN(length) || isNaN(weight)) {
    alert("Please fill out all fields");
    return;
  }

  spoolLibrary.push({ brand, color, material, length, weight });
  localStorage.setItem("spoolLibrary", JSON.stringify(spoolLibrary));

  document.getElementById("brand").value = "";
  document.getElementById("color").value = "";
  document.getElementById("material").value = "";
  document.getElementById("length").value = "";
  document.getElementById("weight").value = "";

  alert("Spool saved!");
  showScreen("library");
}

// Render spool inventory
function renderLibrary() {
  const list = document.getElementById("spoolList");
  list.innerHTML = "";
  if (spoolLibrary.length === 0) {
    list.innerHTML = "<li>No spools in inventory</li>";
    return;
  }
  spoolLibrary.forEach((spool, index) => {
    const li = document.createElement("li");
    li.textContent = `${spool.brand} - ${spool.color} - ${spool.material} (${spool.length}m, ${spool.weight}g)`;
    list.appendChild(li);
  });
}

// Render usage history
function renderHistory() {
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  if (usageHistory.length === 0) {
    list.innerHTML = "<li>No usage recorded</li>";
    return;
  }
  usageHistory.forEach(entry => {
    const li = document.createElement("li");
    li.textContent = `${entry.date} - ${entry.amount}g used from ${entry.spoolBrand}`;
    list.appendChild(li);
  });
}

// ----- PWA Service Worker Registration -----
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").then(registration => {
    console.log("Service Worker registered");

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdatePrompt(() => {
            newWorker.postMessage({ action: "skipWaiting" });
          });
        }
      });
    });
  });

  let refreshing;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      window.location.reload();
      refreshing = true;
    }
  });
}

// Update prompt UI
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