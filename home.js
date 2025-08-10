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