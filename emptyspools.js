// ===== AUTH & FIREBASE CHECK =====
let currentUser = null;
let emptySpoolsLibrary = [];
let currentWorkspace = 'personal';
let activeOrganization = null;

// Wait for auth before loading
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'auth.html';
  } else {
    currentUser = user;
    await loadWorkspaceAndData();
    renderTable();
  }
});

// Load workspace info and empty spools data
async function loadWorkspaceAndData() {
  if (!currentUser) return;
  
  try {
    const userId = currentUser.uid;
    
    // Load user document to get workspace info
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      currentWorkspace = userData.currentWorkspace || 'personal';
      console.log(`📍 Current workspace: ${currentWorkspace}`);
    }
    
    // Determine which collection to load from
    let emptySpoolsRef;
    
    if (currentWorkspace === 'personal') {
      emptySpoolsRef = db.collection('users').doc(userId).collection('emptySpools');
      console.log('📦 Loading PERSONAL empty spools...');
    } else {
      // Load from organization
      const orgDoc = await db.collection('organizations').doc(currentWorkspace).get();
      if (orgDoc.exists) {
        activeOrganization = { id: currentWorkspace, ...orgDoc.data() };
        console.log(`🏢 Loading BUSINESS empty spools: ${activeOrganization.name}`);
      }
      
      emptySpoolsRef = db.collection('organizations').doc(currentWorkspace).collection('emptySpools');
    }
    
    // Load empty spools
    const snapshot = await emptySpoolsRef.get();
    emptySpoolsLibrary = snapshot.docs.map(doc => ({
      firestoreId: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ Loaded ${emptySpoolsLibrary.length} empty spools`);
    
  } catch (error) {
    console.error('Error loading data:', error);
    alert('Failed to load empty spools from cloud.');
  }
}

// Save empty spool to Firebase
async function saveEmptySpoolToFirebase(index) {
  if (!currentUser) return;
  
  try {
    const spool = emptySpoolsLibrary[index];
    const firestoreId = spool.firestoreId;
    
    if (firestoreId) {
      const { firestoreId: _, ...spoolData } = spool; // Remove Firestore metadata
      
      let spoolRef;
      if (currentWorkspace === 'personal') {
        spoolRef = db.collection('users').doc(currentUser.uid).collection('emptySpools').doc(firestoreId);
      } else {
        spoolRef = db.collection('organizations').doc(currentWorkspace).collection('emptySpools').doc(firestoreId);
      }
      
      await spoolRef.update(spoolData);
      console.log('✅ Empty spool updated in Firebase');
      alert('Changes saved to cloud!');
    }
  } catch (error) {
    console.error('Error saving empty spool:', error);
    alert('Failed to save changes to cloud. Please try again.');
  }
}

// Delete empty spool from Firebase
async function deleteEmptySpoolFromFirebase(index) {
  if (!currentUser) return;
  
  try {
    const spool = emptySpoolsLibrary[index];
    const firestoreId = spool.firestoreId;
    
    if (firestoreId) {
      let spoolRef;
      if (currentWorkspace === 'personal') {
        spoolRef = db.collection('users').doc(currentUser.uid).collection('emptySpools').doc(firestoreId);
      } else {
        spoolRef = db.collection('organizations').doc(currentWorkspace).collection('emptySpools').doc(firestoreId);
      }
      
      await spoolRef.delete();
      console.log('✅ Empty spool deleted from Firebase');
    }
  } catch (error) {
    console.error('Error deleting empty spool:', error);
    alert('Failed to delete from cloud. Please try again.');
  }
}

// ----- DOM Elements -----
const tableBody = document.querySelector("#emptySpoolsTable tbody");
const addBtn = document.getElementById("addEmptySpoolBtn");
const newBrandInput = document.getElementById("newBrand");
const newPackageInput = document.getElementById("newPackage");
const newWeightInput = document.getElementById("newWeight");

// ----- Functions -----
function renderTable() {
  if (!tableBody) return;
  
  tableBody.innerHTML = "";
  
  if (emptySpoolsLibrary.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="4" style="text-align: center; color: #666;">No empty spools saved yet</td>';
    tableBody.appendChild(tr);
    return;
  }
  
  emptySpoolsLibrary.forEach((spool, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><input type="text" value="${spool.brand}" data-index="${index}" data-field="brand" class="inlineInput" style="width:100%; padding:5px;" /></td>
      <td><input type="text" value="${spool.package}" data-index="${index}" data-field="package" class="inlineInput" style="width:100%; padding:5px;" /></td>
      <td><input type="number" value="${spool.weight}" data-index="${index}" data-field="weight" class="inlineInput" style="width:80px; padding:5px;" /></td>
      <td>
        <button data-action="save" data-index="${index}">Save</button>
        <button data-action="delete" data-index="${index}">Delete</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

async function addEmptySpool() {
  const brand = newBrandInput.value.trim();
  const packageName = newPackageInput.value.trim();
  const weight = parseFloat(newWeightInput.value);

  if (!brand || !packageName || isNaN(weight)) {
    alert("Please fill out all fields with valid values.");
    return;
  }

  const newEmptySpool = { 
    brand, 
    package: packageName, 
    weight 
  };
  
  // Add owner tracking if in business workspace
  if (currentWorkspace !== 'personal') {
    newEmptySpool.ownerId = currentUser.uid;
  }

  try {
    let docRef;
    
    // Determine where to save based on workspace
    if (currentWorkspace === 'personal') {
      docRef = await db.collection('users').doc(currentUser.uid).collection('emptySpools').add(newEmptySpool);
    } else {
      // Save to organization
      docRef = await db.collection('organizations').doc(currentWorkspace).collection('emptySpools').add(newEmptySpool);
    }
    
    // Add to local array
    emptySpoolsLibrary.push({
      firestoreId: docRef.id,
      ...newEmptySpool
    });
    
    console.log('✅ Empty spool added to Firebase');
    
    renderTable();

    // Clear inputs
    newBrandInput.value = "";
    newPackageInput.value = "";
    newWeightInput.value = "";
    
    alert('Empty spool saved to cloud!');
    
  } catch (error) {
    console.error('Error adding empty spool:', error);
    alert('Failed to save empty spool. Please try again.');
  }
}

// ----- Event Delegation for Inline Edit/Save/Delete -----
tableBody.addEventListener("click", async (e) => {
  const btn = e.target;
  const index = parseInt(btn.dataset.index, 10);

  if (btn.dataset.action === "save") {
    const inputs = tableBody.querySelectorAll(`input[data-index="${index}"]`);
    inputs.forEach(input => {
      const field = input.dataset.field;
      let val = input.value;
      if (field === "weight") val = parseFloat(val) || 0;
      emptySpoolsLibrary[index][field] = val;
    });
    
    await saveEmptySpoolToFirebase(index);
    renderTable();
  }

  if (btn.dataset.action === "delete") {
    if (confirm("Delete this empty spool entry?")) {
      await deleteEmptySpoolFromFirebase(index);
      emptySpoolsLibrary.splice(index, 1);
      renderTable();
      alert('Empty spool deleted from cloud.');
    }
  }
});

// ----- Add Button -----
if (addBtn) {
  addBtn.addEventListener("click", addEmptySpool);
}

// ---- Go Back Button ----
function goBack() {
  if (document.referrer && document.referrer !== window.location.href) {
    window.history.back();
  } else {
    window.location.href = "home.html"; 
  }
}