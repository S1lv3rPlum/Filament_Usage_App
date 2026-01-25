if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('Service Worker registered'))
    .catch(err => console.log('Service Worker failed:', err));
}

// ===== AUTH CHECK - MUST BE AT TOP =====
let currentUser = null;
let userSubscription = null;
let lowFilamentThreshold = 200;  
let currentWorkspace = 'personal'; 
let userOrganizations = [];  
let activeOrganization = null;  // - stores current org data if in business mode

console.log('Setting up auth listener...');
console.log('auth object:', auth);

auth.onAuthStateChanged(async (user) => {
  console.log('Auth state changed! User:', user);
  
  if (!user) {
    console.log('No user logged in, redirecting to auth...');
    window.location.href = 'auth.html';
  } else {
    currentUser = user;
    console.log('User logged in:', user.email);
    
    // Load user's subscription status
    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        userSubscription = userDoc.data().subscription || { status: 'free', plan: 'free' };
        console.log('Subscription status:', userSubscription.status);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
    
    // Load all user data from Firebase
    await loadUserData();
  }
});

// ===== END AUTH CHECK =====

// Check if user has Pro subscription
function isProUser() {
  if (!userSubscription) return false;
  
  // Check if subscription is active
  if (userSubscription.status === 'active' || userSubscription.status === 'trial') {
    // If there's an end date, check it hasn't expired
    if (userSubscription.endDate) {
      const endDate = userSubscription.endDate.toDate();
      if (endDate < new Date()) {
        console.log('Subscription expired');
        return false;
      }
    }
    return true;
  }
  
  return false;
}

// ===== LOAD DATA FROM FIREBASE =====
async function loadUserData() {
  if (!currentUser) return;

  console.log('Loading user data from Firebase...');

  try {
    const userId = currentUser.uid;

    // Load user document first to get workspace info and settings
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      
      // Load workspace tracking
      currentWorkspace = userData.currentWorkspace || 'personal';
      userOrganizations = userData.organizations || [];
      
      console.log(`📍 Current workspace: ${currentWorkspace}`);
      console.log(`🏢 Organizations: ${userOrganizations.length}`);
      
      // Load materials list
      if (userData.materialsList) {
        materialsList = userData.materialsList;
        console.log(`✅ Loaded ${materialsList.length} materials from Firebase`);
      } else {
        // Set default materials if none exist
        materialsList = ["PLA", "ABS", "PETG", "Nylon", "TPU", "Custom"];
      }
      
      // Load low filament threshold
      if (userData.lowFilamentThreshold !== undefined) {
        lowFilamentThreshold = userData.lowFilamentThreshold;
        console.log(`✅ Low filament threshold: ${lowFilamentThreshold}g`);
      } else {
        // Set default if not exists
        lowFilamentThreshold = 200;
        await db.collection('users').doc(userId).update({
          lowFilamentThreshold: 200
        });
      }
    }

    // Determine which collection to load from based on workspace
    let spoolsRef, historyRef, emptySpoolsRef;
    
    if (currentWorkspace === 'personal') {
      // Load from user's personal collections
      spoolsRef = db.collection('users').doc(userId).collection('spools');
      historyRef = db.collection('users').doc(userId).collection('history');
      emptySpoolsRef = db.collection('users').doc(userId).collection('emptySpools');
      
      console.log('📦 Loading PERSONAL workspace data...');
    } else {
      // Load from organization collections
      const orgId = currentWorkspace;
      
      // Load organization data
      const orgDoc = await db.collection('organizations').doc(orgId).get();
      if (orgDoc.exists) {
        activeOrganization = { id: orgId, ...orgDoc.data() };
        console.log(`🏢 Loading BUSINESS workspace: ${activeOrganization.name}`);
        
        // Use organization's materials and threshold if available
        if (activeOrganization.materialsList) {
          materialsList = activeOrganization.materialsList;
        }
        if (activeOrganization.lowFilamentThreshold) {
          lowFilamentThreshold = activeOrganization.lowFilamentThreshold;
        }
      }
      
      spoolsRef = db.collection('organizations').doc(orgId).collection('spools');
      historyRef = db.collection('organizations').doc(orgId).collection('history');
      emptySpoolsRef = db.collection('organizations').doc(orgId).collection('emptySpools');
    }

    // Load spools
    const spoolsSnapshot = await spoolsRef.get();
    spoolLibrary = spoolsSnapshot.docs.map(doc => ({ 
      firestoreId: doc.id, 
      ...doc.data() 
    }));
    console.log(`✅ Loaded ${spoolLibrary.length} spools from Firebase`);

    // Load history
    const historySnapshot = await historyRef.get();
    usageHistory = historySnapshot.docs.map(doc => ({ 
      firestoreId: doc.id, 
      ...doc.data() 
    }));
    console.log(`✅ Loaded ${usageHistory.length} history entries from Firebase`);

    // Load empty spools
    const emptySpoolsSnapshot = await emptySpoolsRef.get();
    emptySpoolsLibrary = emptySpoolsSnapshot.docs.map(doc => ({ 
      firestoreId: doc.id, 
      ...doc.data() 
    }));
    console.log(`✅ Loaded ${emptySpoolsLibrary.length} empty spools from Firebase`);

    console.log('✅ All data loaded from Firebase successfully!');

    updateLowFilamentBadge();
    await initializeWorkspace();  // NEW - Initialize workspace switcher

    //Debug check: If currentWorkspace is an org but not in userOrganizations, reset to personal
    if (currentWorkspace !== 'personal' && !userOrganizations.includes(currentWorkspace)) {
      console.warn('⚠️ Current workspace not in user orgs, resetting to personal');
      await db.collection('users').doc(currentUser.uid).update({
        currentWorkspace: 'personal'
      });
      currentWorkspace = 'personal';
      await loadUserData(); // Reload with corrected workspace
    }

  } catch (error) {
    console.error('❌ Error loading user data:', error);
    alert('Failed to load your data from the cloud. Please try refreshing the page.');
  }
}
// ===== END LOAD DATA =====


// Logout function
async function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    try {
      await auth.signOut();
      console.log('User logged out');
      window.location.href = 'auth.html';
    } catch (error) {
      console.error('Logout error:', error);
      alert('Logout failed. Please try again.');
    }
  }
}

// ===== DATA EXPORT/IMPORT FUNCTIONS =====

// Export user data as JSON file
async function exportUserData() {
  if (!currentUser) {
    alert('You must be logged in to export data.');
    return;
  }
  
  try {
    const userId = currentUser.uid;
    
    // Gather all user data from Firebase
    const userData = {
      exportDate: new Date().toISOString(),
      userEmail: currentUser.email,
      version: "1.0",
      data: {}
    };
    
    // Get spools
    const spoolsSnapshot = await db.collection('users').doc(userId).collection('spools').get();
    userData.data.spools = spoolsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get history
    const historySnapshot = await db.collection('users').doc(userId).collection('history').get();
    userData.data.history = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get empty spools
    const emptySpoolsSnapshot = await db.collection('users').doc(userId).collection('emptySpools').get();
    userData.data.emptySpools = emptySpoolsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get user document (includes materials list)
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      userData.data.userSettings = userDoc.data();
    }
    
    // Create download
    const dataStr = JSON.stringify(userData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `filament-foundry-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert('✅ Data exported successfully!\n\nSave this file in a safe place. You can use it to restore your data if needed.');
    
  } catch (error) {
    console.error('Export error:', error);
    alert('❌ Export failed. Please try again or contact support.');
  }
}

// Import user data from JSON file
async function importUserData(event) {
  if (!currentUser) {
    alert('You must be logged in to import data.');
    return;
  }
  
  const file = event.target.files[0];
  if (!file) return;
  
  // Confirm before importing
  if (!confirm('⚠️ WARNING: Importing will ADD to your existing data.\n\nIf you want to REPLACE your data, please export a backup first, then delete your current data, then import.\n\nContinue with import?')) {
    event.target.value = ''; // Reset file input
    return;
  }
  
  try {
    const fileContent = await file.text();
    const importData = JSON.parse(fileContent);
    
    // Validate file structure
    if (!importData.data || !importData.version) {
      throw new Error('Invalid backup file format');
    }
    
    const userId = currentUser.uid;
    const batch = db.batch();
    
    // Import spools
    if (importData.data.spools && Array.isArray(importData.data.spools)) {
      importData.data.spools.forEach((spool, index) => {
        const spoolRef = db.collection('users').doc(userId).collection('spools').doc();
        const { id, ...spoolData } = spool; // Remove old ID
        batch.set(spoolRef, {
          ...spoolData,
          importedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    }
    
    // Import history
    if (importData.data.history && Array.isArray(importData.data.history)) {
      importData.data.history.forEach((job, index) => {
        const historyRef = db.collection('users').doc(userId).collection('history').doc();
        const { id, ...jobData } = job; // Remove old ID
        batch.set(historyRef, jobData);
      });
    }
    
    // Import empty spools
    if (importData.data.emptySpools && Array.isArray(importData.data.emptySpools)) {
      importData.data.emptySpools.forEach((spool, index) => {
        const emptySpoolRef = db.collection('users').doc(userId).collection('emptySpools').doc();
        const { id, ...spoolData } = spool; // Remove old ID
        batch.set(emptySpoolRef, spoolData);
      });
    }
    
    // Import materials list if present
    if (importData.data.userSettings && importData.data.userSettings.materialsList) {
      const userRef = db.collection('users').doc(userId);
      batch.update(userRef, {
        materialsList: importData.data.userSettings.materialsList
      });
    }
    
    // Commit all changes
    await batch.commit();
    
    alert('✅ Data imported successfully!\n\nYour data has been restored. The page will now refresh.');
    window.location.reload();
    
  } catch (error) {
    console.error('Import error:', error);
    alert('❌ Import failed. Please check that you selected a valid backup file.\n\nError: ' + error.message);
  } finally {
    event.target.value = ''; // Reset file input
  }
}

// Contact developer
function contactDeveloper() {
  const subject = encodeURIComponent('Filament Foundry Support Request');
  const body = encodeURIComponent(`Hi DataForge Team,

I need help with Filament Foundry.

User Email: ${currentUser?.email || 'Not logged in'}
Issue/Question:

[Please describe your issue or question here]

Thank you!`);
  
  window.location.href = `mailto:DataForgeApps@gmail.com?subject=${subject}&body=${body}`;
}

// Request data deletion
function requestDataDeletion() {
  if (!confirm('⚠️ This will send an email to request deletion of your account and all associated data.\n\nYou should export your data first if you want a backup.\n\nContinue?')) {
    return;
  }
  
  const subject = encodeURIComponent('Data Deletion Request - Filament Foundry');
  const body = encodeURIComponent(`Hi DataForge Team,

I would like to request deletion of my account and all associated data from Filament Foundry.

User Email: ${currentUser?.email || 'Not logged in'}
User ID: ${currentUser?.uid || 'Unknown'}

Please confirm when this has been completed.

Thank you!`);
  
  window.location.href = `mailto:DataForgeApps@gmail.com?subject=${subject}&body=${body}`;
  
  alert('✅ Email draft created!\n\nPlease send the email to complete your deletion request. We will respond within 48 hours.');
}

// ===== END DATA MANAGEMENT =====

console.log("JS Loaded, showScreen is:", typeof showScreen);
console.log("JS Loaded, showScreen is:", typeof showScreen);
window.showScreen = showScreen;


// ----- Data Storage -----
let spoolLibrary = [];
let usageHistory = [];
let materialsList = [];
let emptySpoolsLibrary = [];

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

   if (id === "home") {
    updateLowFilamentBadge();  // NEW LINE
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
  if (id === "materials") {
    renderMaterialsList(); // Render materials list when opening materials screen
  }
  if (id === "settings") {
    // Update spool count
    const spoolCount = document.getElementById("spoolCount");
    if (spoolCount) {
      const count = spoolLibrary.length;
      const limit = isProUser() ? "∞" : "25";
      spoolCount.innerHTML = `<strong>Spools:</strong> ${count} / ${limit}`;
      
      // Warning if near limit
      if (count >= 20 && !isProUser()) {
        spoolCount.style.color = "#ff6b6b";
        spoolCount.innerHTML += ` <small>(${25 - count} remaining)</small>`;
      }
    }
    
    // Populate low filament threshold
    const thresholdInput = document.getElementById("lowFilamentThreshold");
    if (thresholdInput) {
      thresholdInput.value = lowFilamentThreshold;
    }
    
    // NEW CODE - Show/hide and populate business management section
    const businessSection = document.getElementById("businessManagementSection");
    if (businessSection) {
      if (currentWorkspace !== 'personal' && activeOrganization) {
        // Show business section
        businessSection.classList.remove("hidden");
        
        // Populate business info
        document.getElementById("bizName").textContent = activeOrganization.name;
        
        const currentMember = activeOrganization.members.find(m => m.userId === currentUser.uid);
        document.getElementById("bizRole").textContent = currentMember ? currentMember.role : 'member';
        document.getElementById("bizLocation").textContent = currentMember ? currentMember.location : '—';
        document.getElementById("bizPlan").textContent = activeOrganization.plan === 'free' ? 'Free' : 'Pro';
        document.getElementById("bizMemberCount").textContent = `${activeOrganization.members.length} ${activeOrganization.members.length === 3 ? '(Free tier limit)' : ''}`;
        
        // Show invite code if admin
        const inviteSection = document.getElementById("inviteCodeSection");
        if (currentMember && currentMember.role === 'admin') {
          inviteSection.classList.remove("hidden");
          document.getElementById("inviteCodeDisplay").value = activeOrganization.inviteCode;
        } else {
          inviteSection.classList.add("hidden");
        }
      } else {
        // Hide business section when in personal workspace
        businessSection.classList.add("hidden");
      }
    }
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

// ----- Branding Functions -----
function saveBranding() {
  const companyName = document.getElementById("companyName").value.trim();
  localStorage.setItem("companyName", companyName);
  
  // Update the display immediately
  loadBranding();
  
  alert("Branding saved!");
}

function loadBranding() {
  const companyName = localStorage.getItem("companyName") || "";
  const display = document.getElementById("companyNameDisplay");
  const input = document.getElementById("companyName");
  
  // Update header display
  if (display) {
    if (companyName) {
      display.textContent = companyName;
      display.style.display = "block";
    } else {
      display.style.display = "none";
    }
  }
  
  // Update input field if on settings page
  if (input) {
    input.value = companyName;
  }
}

async function addNewMaterial() {
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

  await db.collection("users").doc(currentUser.uid).update({
    materialsList: materialsList
  });

  input.value = "";
  renderMaterialsList();
  alert(`Material "${newMaterial}" added!`);
}


async function deleteMaterial(index) {
  const material = materialsList[index];

  const spoolsUsingMaterial = spoolLibrary.filter(
    spool => spool.material === material
  );

  if (spoolsUsingMaterial.length > 0) {
    alert(`Cannot delete "${material}" because ${spoolsUsingMaterial.length} spool(s) are using it.`);
    return;
  }

  if (confirm(`Delete material type "${material}"?`)) {
    materialsList.splice(index, 1);

    await db.collection("users").doc(currentUser.uid).update({
      materialsList: materialsList
    });

    renderMaterialsList();
    alert(`Material "${material}" deleted.`);
  }
}

// Save low filament threshold
async function saveLowFilamentThreshold() {
  const input = document.getElementById("lowFilamentThreshold");
  const newThreshold = parseInt(input.value);
  
  if (isNaN(newThreshold) || newThreshold < 10) {
    alert("Please enter a valid threshold (minimum 10g).");
    return;
  }
  
  try {
    await db.collection('users').doc(currentUser.uid).update({
      lowFilamentThreshold: newThreshold
    });
    
    lowFilamentThreshold = newThreshold;
    console.log('✅ Low filament threshold saved:', newThreshold);
    
    // Update the badge immediately
    updateLowFilamentBadge();
    
    alert(`Alert settings saved!\n\n🟡 Yellow warning: ${newThreshold}g\n🔴 Red critical: ${Math.floor(newThreshold / 2)}g\n\nInventory page will update when you navigate to it.`);
    
  } catch (error) {
    console.error('Error saving threshold:', error);
    alert('Failed to save settings. Please try again.');
  }
}

// Update low filament badge
function updateLowFilamentBadge() {
  const badge = document.getElementById("lowFilamentBadge");
  const countSpan = document.getElementById("lowFilamentCount");
  
  if (!badge || !countSpan) return;
  
  // Count active spools below threshold
  const lowSpools = spoolLibrary.filter(spool => {
    const isActive = !spool.status || spool.status === "active";
    const isLow = spool.weight <= lowFilamentThreshold;
    return isActive && isLow;
  });
  
  if (lowSpools.length > 0) {
    countSpan.textContent = lowSpools.length;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// ----- Material Dropdown -----
function populateMaterialDropdown() {
  const select = document.getElementById("materialSelect");
  if (!select) return;
  
  select.innerHTML = "";

  materialsList.forEach(material => {
    const option = document.createElement("option");
    option.value = material;
    option.textContent = material;
    select.appendChild(option);
  });

  // Add "Add New Material" option at the end
  const addNewOpt = document.createElement("option");
  addNewOpt.value = "add_new";
  addNewOpt.textContent = "➕ Add New Material...";
  select.appendChild(addNewOpt);

  select.value = materialsList[0] || "";
}

function handleMaterialChange() {
  const select = document.getElementById("materialSelect");
  const customInput = document.getElementById("customMaterialInput");
  
  if (select.value === "add_new") {
    // Show input for new material
    const newMaterial = prompt("Enter new material name:");
    if (newMaterial && newMaterial.trim()) {
      const trimmedMaterial = newMaterial.trim();
      
      // Add to materials list if not already exists
      if (!materialsList.includes(trimmedMaterial)) {
        // Insert before "Custom" if it exists, otherwise at end
        const customIndex = materialsList.indexOf("Custom");
        if (customIndex !== -1) {
          materialsList.splice(customIndex, 0, trimmedMaterial);
        } else {
          materialsList.push(trimmedMaterial);
        }
        
        // Save to Firebase
        if (currentUser) {
          db.collection('users').doc(currentUser.uid).update({
            materialsList: materialsList
          }).then(() => {
            console.log('New material saved to Firebase');
          }).catch(err => {
            console.error('Error saving material:', err);
          });
        }
        
        // Repopulate dropdown and select the new material
        populateMaterialDropdown();
        select.value = trimmedMaterial;
      } else {
        // Material already exists, just select it
        select.value = trimmedMaterial;
      }
    } else {
      // User cancelled or entered empty, reset to first option
      select.value = materialsList[0] || "";
    }
    
    customInput.classList.add("hidden");
    customInput.value = "";
  } else {
    customInput.classList.add("hidden");
    customInput.value = "";
  }
}

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
    openEmptySpoolModal(); // Open modal instead of new tab
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
    const selectedSpool = emptySpoolsLibrary[emptySpoolSelect.value];
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



// ----- Handle Color Type Change -----
function handleColorTypeChange() {
  const colorType = document.getElementById("colorType").value;
  const solidFields = document.getElementById("solidColorFields");
  const gradientFields = document.getElementById("gradientColorFields");
  
  if (colorType === "gradient") {
    solidFields.classList.add("hidden");
    gradientFields.classList.remove("hidden");
  } else {
    solidFields.classList.remove("hidden");
    gradientFields.classList.add("hidden");
  }
}

// ----- Save Spool -----
async function saveSpool() {
  // Check spool limit for free users
  if (spoolLibrary.length >= 25 && !isProUser()) {
    alert('Free tier limit: 25 spools maximum.\n\n🔓 Upgrade to Pro for unlimited spools!\n\n(Subscription options coming soon!)');
    return;
  }

  const brand = document.getElementById("brand").value.trim();
  const color = document.getElementById("color").value.trim();

 const materialSelect = document.getElementById("materialSelect");
let material = materialSelect.value;

// Validate material selection
if (!material || material === "add_new") {
  alert("Please select a material.");
  return;
}

  const lengthInput = document.getElementById("length").value;
  const length = lengthInput ? parseFloat(lengthInput) : 0;
  
  const fullSpoolWeight = parseFloat(document.getElementById("fullSpoolWeight").value);

  // Get empty spool reference if selected
  const emptySpoolSelect = document.getElementById("emptySpoolSelect");
  let emptySpoolId = emptySpoolSelect.value === "" || emptySpoolSelect.value === "other" 
    ? null 
    : Number(emptySpoolSelect.value);
  
  let emptyWeight = 0;
  if (emptySpoolId !== null && emptySpoolsLibrary[emptySpoolId]) {
    emptyWeight = emptySpoolsLibrary[emptySpoolId].weight;
  }
  
  const weight = fullSpoolWeight - emptyWeight;

  // Get color details
  const colorType = document.getElementById("colorType").value;
  let baseColor = "";
  let gradientBaseColors = [];
  
  if (colorType === "solid") {
    baseColor = document.getElementById("baseColorSolid").value;
  } else {
    // Get checked gradient colors
    const checkedBoxes = document.querySelectorAll('input[name="gradientColors"]:checked');
    gradientBaseColors = Array.from(checkedBoxes).map(cb => cb.value);
  }
  
  const sheen = document.getElementById("sheen").value;
  const glowInDark = document.querySelector('input[name="glowInDark"]:checked').value;
  const texture = document.getElementById("texture").value;

  // Validation
  if (!brand || !color || !material || isNaN(fullSpoolWeight)) {
    alert("Please fill out Brand, Color, Material, and Full Spool Weight fields.");
    return;
  }
  
  if (emptySpoolId !== null && weight <= 0) {
    alert("Full spool weight must be greater than empty spool weight.");
    return;
  }

  if (colorType === "solid" && !baseColor) {
    alert("Please select a base color.");
    return;
  }
  
  if (colorType === "gradient" && gradientBaseColors.length === 0) {
    alert("Please select at least one base color for the gradient.");
    return;
  }
  
  if (colorType === "gradient" && gradientBaseColors.length > 3) {
    alert("Please select up to 3 base colors for the gradient.");
    return;
  }

// Create spool object
  const newSpool = { 
    brand, 
    color, 
    material, 
    length, 
    weight: emptySpoolId !== null ? weight : fullSpoolWeight,
    emptyWeight: emptySpoolId !== null ? emptyWeight : 0,
    fullSpoolWeight,
    emptySpoolId,
    colorType,
    baseColor: colorType === "solid" ? baseColor : "",
    gradientBaseColors: colorType === "gradient" ? gradientBaseColors : [],
    sheen,
    glowInDark,
    texture,
    status: "active",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  // Add owner tracking if in business workspace
  if (currentWorkspace !== 'personal') {
    newSpool.ownerId = currentUser.uid;
    newSpool.location = activeOrganization.members.find(m => m.userId === currentUser.uid)?.location || 'Unknown';
  }

  try {
    let docRef;
    
    // Determine where to save based on workspace
    if (currentWorkspace === 'personal') {
      docRef = await db.collection('users').doc(currentUser.uid).collection('spools').add(newSpool);
    } else {
      // Save to organization
      docRef = await db.collection('organizations').doc(currentWorkspace).collection('spools').add(newSpool);
    }

    // Add to local array with Firestore ID
    spoolLibrary.push({
      firestoreId: docRef.id,
      ...newSpool,
      createdAt: new Date() // Use local timestamp for immediate display
    });

    console.log('✅ Spool saved to Firebase');

    // Reset form
    document.getElementById("brand").value = "";
    document.getElementById("color").value = "";
    populateMaterialDropdown();
    document.getElementById("length").value = "";
    document.getElementById("fullSpoolWeight").value = "";
    document.getElementById("filamentAmountDisplay").style.display = "none";
    populateEmptySpoolDropdown();
    document.getElementById("colorType").value = "solid";
    document.getElementById("baseColorSolid").value = "";
    document.querySelectorAll('input[name="gradientColors"]').forEach(cb => cb.checked = false);
    handleColorTypeChange();
    document.getElementById("sheen").value = "";
    document.querySelector('input[name="glowInDark"][value="no"]').checked = true;
    document.getElementById("texture").value = "";

    const savedWeight = emptySpoolId !== null ? weight.toFixed(2) : fullSpoolWeight.toFixed(2);
    alert(`Spool saved to cloud! ${emptySpoolId !== null ? 'Filament amount: ' : 'Weight: '}${savedWeight}g`);
    showScreen("library");

  } catch (error) {
    console.error('Error saving spool:', error);
    alert('Failed to save spool to cloud. Please try again.');
  }
}

// ----- Render Library -----
function renderLibrary() {
  const list = document.getElementById("spoolList");
  list.innerHTML = "";
  
  // Filter to only show active spools
  const activeSpools = spoolLibrary.filter(spool => !spool.status || spool.status === "active");
  
  if (activeSpools.length === 0) {
    list.innerHTML = "<li>No spools in inventory</li>";
    return;
  }
  
  activeSpools.forEach((spool) => {
    const index = spoolLibrary.indexOf(spool);
    const li = document.createElement("li");
    li.setAttribute('data-spool-id', index.toString());
    const lengthDisplay = spool.length > 0 ? `${spool.length}m, ` : '';
    
    let weightDisplay = `${spool.weight.toFixed(2)}g filament`;
    if (spool.fullSpoolWeight && spool.emptyWeight) {
      weightDisplay = `${spool.weight.toFixed(2)}g filament (Full: ${spool.fullSpoolWeight.toFixed(2)}g - Empty: ${spool.emptyWeight.toFixed(2)}g)`;
    }
    
    // Build color display
    let colorDisplay = spool.color;
    if (spool.colorType === "solid" && spool.baseColor) {
      colorDisplay += ` - [${spool.baseColor}]`;
    } else if (spool.colorType === "gradient" && spool.gradientBaseColors && spool.gradientBaseColors.length > 0) {
      colorDisplay += ` - [${spool.gradientBaseColors.join(", ")}]`;
    }
    
    li.textContent = `${spool.brand} - ${colorDisplay} - ${spool.material} (${lengthDisplay}${weightDisplay})`;
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
    let spoolDetails = job.spools.map(s => {
      const spoolIndex = parseInt(s.spoolId, 10);
      const spool = spoolLibrary[spoolIndex];
      const isRetired = spool && spool.status === "retired";
      const retiredBadge = isRetired ? ' <span style="color: #999; font-size: 0.85em;">(RETIRED)</span>' : '';
      
      return `<a href="#" class="spool-link" data-spool-index="${s.spoolId}">${s.spoolLabel}</a>${retiredBadge}: ${(s.used || 0).toFixed(2)} g used`;
    }).join("<br>");
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
  loadBranding(); // NEW LINE - Load branding when page loads
});

function populateSpoolMultiSelect() {
  const select = document.getElementById("selectSpools");
  select.innerHTML = "";
  
  // Filter to only show active spools
  const activeSpools = spoolLibrary.filter(spool => !spool.status || spool.status === "active");
  
  if (activeSpools.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No active spools available";
    option.disabled = true;
    select.appendChild(option);
    return;
  }
  
  activeSpools.forEach((spool) => {
    const index = spoolLibrary.indexOf(spool);
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

async function endPrintJob() {
  try {
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

      // Update spool weight in local array
      if (spoolIndex !== -1 && spoolLibrary[spoolIndex]) {
        spoolLibrary[spoolIndex].weight = endWeight;
        
        // Update in Firebase - workspace aware
        if (spoolLibrary[spoolIndex].firestoreId) {
          let spoolRef;
          if (currentWorkspace === 'personal') {
            spoolRef = db.collection('users').doc(currentUser.uid).collection('spools').doc(spoolLibrary[spoolIndex].firestoreId);
          } else {
            spoolRef = db.collection('organizations').doc(currentWorkspace).collection('spools').doc(spoolLibrary[spoolIndex].firestoreId);
          }
          
          spoolRef.update({ weight: endWeight })
            .catch(err => console.error('Error updating spool weight:', err));
        }
      }

      return {
        ...spoolData,
        endWeight,
        gramsUsed,
        used: gramsUsed,
      };
    });

    // Create history entry
    const historyEntry = {
      jobId: activePrintJob.jobId,
      jobName: activePrintJob.jobName,
      spools: updatedSpools,
      startTime: activePrintJob.startTime,
      endTime: new Date().toISOString(),
      status: "success"
    };
    
    // Add user tracking if in business workspace
    if (currentWorkspace !== 'personal') {
      historyEntry.userId = currentUser.uid;
      historyEntry.location = activeOrganization.members.find(m => m.userId === currentUser.uid)?.location || 'Unknown';
    }

    let docRef;
    
    // Determine where to save based on workspace
    if (currentWorkspace === 'personal') {
      docRef = await db.collection('users').doc(currentUser.uid).collection('history').add(historyEntry);
    } else {
      // Save to organization
      docRef = await db.collection('organizations').doc(currentWorkspace).collection('history').add(historyEntry);
    }
    
    // Add to local array
    usageHistory.push({
      firestoreId: docRef.id,
      ...historyEntry
    });

    // Clear active job
    localStorage.removeItem("activePrintJob");
    activePrintJob = null;

    console.log('✅ Print job saved to Firebase');
    alert("Print job ended and usage recorded in cloud.");
    showScreen("home");

  } catch (error) {
    console.error('Error ending print job:', error);
    if (error.message !== "Invalid end weight" && error.message !== "Missing end weights") {
      alert('Failed to save print job. Please try again.');
    }
  }
}

async function failedPrintJob() {
  if (!confirm("Mark this print as failed? You must weigh your spools and enter the actual final weights.")) {
    return;
  }
  
  try {
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

      // Update spool weight in local array
      if (spoolIndex !== -1 && spoolLibrary[spoolIndex]) {
        spoolLibrary[spoolIndex].weight = endWeight;
        
        // Update in Firebase - workspace aware
        if (spoolLibrary[spoolIndex].firestoreId) {
          let spoolRef;
          if (currentWorkspace === 'personal') {
            spoolRef = db.collection('users').doc(currentUser.uid).collection('spools').doc(spoolLibrary[spoolIndex].firestoreId);
          } else {
            spoolRef = db.collection('organizations').doc(currentWorkspace).collection('spools').doc(spoolLibrary[spoolIndex].firestoreId);
          }
          
          spoolRef.update({ weight: endWeight })
            .catch(err => console.error('Error updating spool weight:', err));
        }
      }

      return {
        ...spoolData,
        endWeight,
        gramsUsed,
        used: gramsUsed,
      };
    });

    // Create history entry
    const historyEntry = {
      jobId: activePrintJob.jobId,
      jobName: `FAILED: ${activePrintJob.jobName}`,
      spools: updatedSpools,
      startTime: activePrintJob.startTime,
      endTime: new Date().toISOString(),
      status: "failed"
    };
    
    // Add user tracking if in business workspace
    if (currentWorkspace !== 'personal') {
      historyEntry.userId = currentUser.uid;
      historyEntry.location = activeOrganization.members.find(m => m.userId === currentUser.uid)?.location || 'Unknown';
    }

    let docRef;
    
    // Determine where to save based on workspace
    if (currentWorkspace === 'personal') {
      docRef = await db.collection('users').doc(currentUser.uid).collection('history').add(historyEntry);
    } else {
      // Save to organization
      docRef = await db.collection('organizations').doc(currentWorkspace).collection('history').add(historyEntry);
    }
    
    // Add to local array
    usageHistory.push({
      firestoreId: docRef.id,
      ...historyEntry
    });

    // Clear active job
    localStorage.removeItem("activePrintJob");
    activePrintJob = null;

    console.log('✅ Failed print saved to Firebase');
    alert("Failed print recorded. Spool weights updated in cloud.");
    showScreen("home");

  } catch (error) {
    console.error('Error recording failed print:', error);
    if (error.message !== "Invalid end weight" && error.message !== "Missing end weights for failed print") {
      alert('Failed to save print job. Please try again.');
    }
  }
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

// ----- Empty Spool Modal Functions -----
function openEmptySpoolModal() {
  const modal = document.getElementById("emptySpoolModal");
  const modalBody = document.getElementById("emptySpoolModalBody");
  
  // Load the empty spool interface
  modalBody.innerHTML = `
    <div style="margin-bottom: 20px;">
      <input id="modalEmptyBrand" placeholder="Brand" style="width: 100%; padding: 10px; margin-bottom: 10px; font-size: 1em; border-radius: 4px; border: 1px solid #ccc;" />
      <input id="modalEmptyPackage" placeholder="Package Type (e.g., 1kg, 500g)" style="width: 100%; padding: 10px; margin-bottom: 10px; font-size: 1em; border-radius: 4px; border: 1px solid #ccc;" />
      <input id="modalEmptyWeight" type="number" step="0.01" placeholder="Empty Spool Weight (g)" style="width: 100%; padding: 10px; margin-bottom: 15px; font-size: 1em; border-radius: 4px; border: 1px solid #ccc;" />
      <button onclick="saveEmptySpoolFromModal()" style="width: 100%; padding: 12px; background: #007acc; color: white; border: none; border-radius: 6px; font-size: 1em; cursor: pointer;">Save Empty Spool</button>
    </div>
    
    <h3 style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e0e0e0;">Existing Empty Spools</h3>
    <ul id="modalEmptySpoolList" style="list-style: none; padding: 0;"></ul>
  `;
  
  // Render existing empty spools
  renderModalEmptySpoolList();
  
  modal.style.display = "block";
}

function closeEmptySpoolModal() {
  const modal = document.getElementById("emptySpoolModal");
  modal.style.display = "none";
  
  // Refresh the dropdown in Add Spool form
  populateEmptySpoolDropdown();
}

async function saveEmptySpoolFromModal() {
  const brand = document.getElementById("modalEmptyBrand").value.trim();
  const packageType = document.getElementById("modalEmptyPackage").value.trim();
  const weight = parseFloat(document.getElementById("modalEmptyWeight").value);

  if (!brand || !packageType || isNaN(weight)) {
    alert("Please fill out all fields.");
    return;
  }

  const emptySpoolData = { 
    brand, 
    package: packageType, 
    weight 
  };
  
  // Add owner tracking if in business workspace
  if (currentWorkspace !== 'personal') {
    emptySpoolData.ownerId = currentUser.uid;
  }

  try {
    let docRef;
    
    // Determine where to save based on workspace
    if (currentWorkspace === 'personal') {
      docRef = await db.collection('users').doc(currentUser.uid).collection('emptySpools').add(emptySpoolData);
    } else {
      // Save to organization
      docRef = await db.collection('organizations').doc(currentWorkspace).collection('emptySpools').add(emptySpoolData);
    }

    emptySpoolsLibrary.push({
      firestoreId: docRef.id,
      ...emptySpoolData
    });

    // Clear inputs
    document.getElementById("modalEmptyBrand").value = "";
    document.getElementById("modalEmptyPackage").value = "";
    document.getElementById("modalEmptyWeight").value = "";

    renderModalEmptySpoolList();
    alert('Empty spool saved!');
    
  } catch (error) {
    console.error('Error saving empty spool:', error);
    alert('Failed to save empty spool. Please try again.');
  }
}


function renderModalEmptySpoolList() {
  const list = document.getElementById("modalEmptySpoolList");
  if (!list) return;
  
  list.innerHTML = "";
  
  if (emptySpoolsLibrary.length === 0) {
    list.innerHTML = "<li style='padding: 10px; color: #666;'>No empty spools saved yet.</li>";
    return;
  }
  
  emptySpoolsLibrary.forEach((spool, index) => {
    const li = document.createElement("li");
    li.style.padding = "10px";
    li.style.marginBottom = "8px";
    li.style.background = "#f0f4f8";
    li.style.borderRadius = "6px";
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    
    const span = document.createElement("span");
    span.textContent = `${spool.brand} – ${spool.package} (${spool.weight}g)`;
    
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.style.padding = "6px 12px";
    deleteBtn.style.background = "#ff6b6b";
    deleteBtn.style.color = "white";
    deleteBtn.style.border = "none";
    deleteBtn.style.borderRadius = "4px";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.onclick = () => deleteEmptySpoolFromModal(index);
    
    li.appendChild(span);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  });
}

function deleteEmptySpoolFromModal(index) {
  if (confirm("Delete this empty spool?")) {
    emptySpoolsLibrary.splice(index, 1);
    saveEmptySpoolsLibrary();
    renderModalEmptySpoolList();
  }
}



// Close modal when clicking outside of it
window.addEventListener("click", (e) => {
  const modal = document.getElementById("emptySpoolModal");
  if (e.target === modal) {
    closeEmptySpoolModal();
  }
});

window.showScreen = showScreen;

// iOS keyboard scroll fix
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
  document.querySelectorAll('input, select, textarea').forEach(element => {
    element.addEventListener('focus', function() {
      setTimeout(() => {
        this.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    });
  });
}

// Populate workspace selector
async function populateWorkspaceSelector() {
  const select = document.getElementById("workspaceSelect");
  if (!select) return;
  
  // Clear existing options
  select.innerHTML = '<option value="personal">👤 Personal</option>';
  
  // Add organization options
  if (userOrganizations && userOrganizations.length > 0) {
    for (const orgId of userOrganizations) {
      try {
        const orgDoc = await db.collection('organizations').doc(orgId).get();
        if (orgDoc.exists) {
          const orgData = orgDoc.data();
          const option = document.createElement('option');
          option.value = orgId;
          option.textContent = `🏢 ${orgData.name}`;
          select.appendChild(option);
        }
      } catch (error) {
        console.error('Error loading organization:', error);
      }
    }
  }
  
  // Set current selection AFTER all options are loaded
  select.value = currentWorkspace;
  
  updateWorkspaceInfo();
}

// Update workspace info display
function updateWorkspaceInfo() {
  const infoDiv = document.getElementById("workspaceInfo");
  if (!infoDiv) return;
  
  if (currentWorkspace === 'personal') {
    infoDiv.textContent = "Viewing your personal inventory and print history";
  } else if (activeOrganization) {
    const member = activeOrganization.members.find(m => m.userId === currentUser.uid);
    const role = member ? member.role : 'member';
    const location = member ? member.location : 'Unknown';
    
    infoDiv.innerHTML = `Viewing <strong>${activeOrganization.name}</strong> • Role: ${role} • Location: ${location}`;
  }
}

// Switch workspace
async function switchWorkspace() {
  const select = document.getElementById("workspaceSelect");
  const newWorkspace = select.value;
  
  if (newWorkspace === currentWorkspace) {
    console.log('Already in this workspace');
    return;
  }
  
  console.log(`Attempting to switch from ${currentWorkspace} to ${newWorkspace}`);
  
  try {
    // Update in Firebase
    await db.collection('users').doc(currentUser.uid).update({
      currentWorkspace: newWorkspace
    });
    
    console.log('✅ Workspace updated in Firebase');
    
    currentWorkspace = newWorkspace;
    console.log(`Switched to workspace: ${newWorkspace}`);
    
    // Clear current data
    spoolLibrary = [];
    usageHistory = [];
    emptySpoolsLibrary = [];
    activeOrganization = null;
    
    // Reload all data for new workspace
    await loadUserData();
    
    console.log('✅ Data reloaded for new workspace');
    
    // Refresh current screen
    const currentScreen = document.querySelector('main:not(.hidden), section:not(.hidden)');
    if (currentScreen) {
      showScreen(currentScreen.id);
    }
    
    alert(`Switched to ${newWorkspace === 'personal' ? 'Personal' : activeOrganization?.name || 'Business'} workspace!`);
    
  } catch (error) {
    console.error('❌ Error switching workspace:', error);
    alert('Failed to switch workspace. Error: ' + error.message);
    select.value = currentWorkspace; // Revert selection
  }
}

// Call this after loading user data
async function initializeWorkspace() {
  await populateWorkspaceSelector();
  updateWorkspaceInfo();
}

// ===== ORGANIZATION MANAGEMENT =====

// Show create organization modal
function showCreateOrganizationModal() {
  // Check if user already has a business
  if (userOrganizations.length > 0) {
    alert("You already belong to a business account. Each user can only create or join one business.");
    return;
  }
  
  document.getElementById("createOrgModal").style.display = "block";
}

// Close create organization modal
function closeCreateOrgModal() {
  document.getElementById("createOrgModal").style.display = "none";
  document.getElementById("orgName").value = "";
  document.getElementById("orgLocation").value = "";
}

// Generate random invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create organization
async function createOrganization() {
  const orgName = document.getElementById("orgName").value.trim();
  const location = document.getElementById("orgLocation").value.trim();
  
  if (!orgName) {
    alert("Please enter a business name.");
    return;
  }
  
  if (!location) {
    alert("Please enter your location identifier.");
    return;
  }
  
  if (userOrganizations.length > 0) {
    alert("You already belong to a business account.");
    return;
  }
  
  try {
    const inviteCode = generateInviteCode();
    
    // Create organization document
    const orgRef = await db.collection('organizations').add({
      name: orgName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUser.uid,
      plan: 'free',
      inviteCode: inviteCode,
      members: [{
        userId: currentUser.uid,
        role: 'admin',
        location: location,
        joinedAt: new Date()
      }],
      materialsList: [...materialsList], // Copy from personal
      lowFilamentThreshold: lowFilamentThreshold // Copy from personal
    });
    
    const orgId = orgRef.id;
    
    // Update user document
    await db.collection('users').doc(currentUser.uid).update({
      organizations: firebase.firestore.FieldValue.arrayUnion(orgId),
      location: location,
      currentWorkspace: orgId // Auto-switch to new business
    });
    
    console.log('✅ Organization created:', orgId);
    
    closeCreateOrgModal();
    
    alert(`Business created successfully!\n\n📋 Invite Code: ${inviteCode}\n\nShare this code with team members so they can join. You can find it in Settings > Business Management.`);
    
    // Reload data to show new workspace
    userOrganizations.push(orgId);
    currentWorkspace = orgId;
    await loadUserData();
    
  } catch (error) {
    console.error('Error creating organization:', error);
    alert('Failed to create business. Please try again.');
  }
}

// Show join organization modal
function showJoinOrganizationModal() {
  // Check if user already has a business
  if (userOrganizations.length > 0) {
    alert("You already belong to a business account. Each user can only join one business.");
    return;
  }
  
  document.getElementById("joinOrgModal").style.display = "block";
}

// Close join organization modal
function closeJoinOrgModal() {
  document.getElementById("joinOrgModal").style.display = "none";
  document.getElementById("joinInviteCode").value = "";
  document.getElementById("joinLocation").value = "";
}

// Join organization
async function joinOrganization() {
  const inviteCode = document.getElementById("joinInviteCode").value.trim().toUpperCase();
  const location = document.getElementById("joinLocation").value.trim();
  
  if (!inviteCode) {
    alert("Please enter an invite code.");
    return;
  }
  
  if (!location) {
    alert("Please enter your location identifier.");
    return;
  }
  
  try {
    // FIRST: Ensure user document exists
    const userDocRef = db.collection('users').doc(currentUser.uid);
    const userDoc = await userDocRef.get();
    
    if (!userDoc.exists) {
      // Create user document if it doesn't exist
      console.log('Creating user document...');
      await userDocRef.set({
        email: currentUser.email,
        displayName: currentUser.displayName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        accountType: 'free',
        subscription: {
          status: 'free',
          plan: 'free',
          startDate: firebase.firestore.FieldValue.serverTimestamp(),
          endDate: null,
          provider: null,
          transactionId: null
        },
        organizations: [],
        lowFilamentThreshold: 200,
        currentWorkspace: 'personal',
        location: null
      });
    }
    
    // Check if already in an organization
    const userData = (await userDocRef.get()).data();
    const existingOrgs = userData.organizations || [];
    
    if (existingOrgs.length > 0) {
      alert("You already belong to a business account.");
      closeJoinOrgModal();
      return;
    }
    
    // Find organization by invite code
    const orgsSnapshot = await db.collection('organizations')
      .where('inviteCode', '==', inviteCode)
      .limit(1)
      .get();
    
    if (orgsSnapshot.empty) {
      alert("Invalid invite code. Please check and try again.");
      return;
    }
    
    const orgDoc = orgsSnapshot.docs[0];
    const orgId = orgDoc.id;
    const orgData = orgDoc.data();
    
    // Check if user is already a member
    const isAlreadyMember = orgData.members.some(m => m.userId === currentUser.uid);
    if (isAlreadyMember) {
      alert(`You're already a member of ${orgData.name}. Please switch to the business workspace from the dropdown.`);
      
      // Make sure user document has this org
      await userDocRef.update({
        organizations: firebase.firestore.FieldValue.arrayUnion(orgId),
        location: location,
        currentWorkspace: orgId
      });
      
      closeJoinOrgModal();
      
      userOrganizations = [orgId];
      currentWorkspace = orgId;
      await loadUserData();
      return;
    }
    
    // Check member limit for free tier
    if (orgData.plan === 'free' && orgData.members.length >= 3) {
      alert("This business has reached the free tier limit of 3 members. The admin needs to upgrade to Pro to add more members.");
      return;
    }
    
    // Create new member object
    const newMember = {
      userId: currentUser.uid,
      role: 'member',
      location: location,
      joinedAt: new Date()
    };
    
    // Add user to organization
    const updatedMembers = [...orgData.members, newMember];
    await db.collection('organizations').doc(orgId).update({
      members: updatedMembers
    });
    
    // Update user document
    await userDocRef.update({
      organizations: [orgId],
      location: location,
      currentWorkspace: orgId
    });
    
    console.log('✅ Joined organization:', orgId);
    
    closeJoinOrgModal();
    
    alert(`Successfully joined ${orgData.name}!`);
    
    // Reload data to show new workspace
    userOrganizations = [orgId];
    currentWorkspace = orgId;
    await loadUserData();
    
  } catch (error) {
    console.error('Error joining organization:', error);
    alert('Failed to join business. Error: ' + error.message);
  }
}

// ===== END ORGANIZATION MANAGEMENT =====

// Close modals when clicking outside
window.addEventListener("click", (e) => {
  const createOrgModal = document.getElementById("createOrgModal");
  const joinOrgModal = document.getElementById("joinOrgModal");
  
  if (e.target === createOrgModal) {
    closeCreateOrgModal();
  }
  if (e.target === joinOrgModal) {
    closeJoinOrgModal();
  }
});

// ===== BUSINESS MANAGEMENT IN SETTINGS =====

// Copy invite code to clipboard
function copyInviteCode() {
  const input = document.getElementById("inviteCodeDisplay");
  input.select();
  input.setSelectionRange(0, 99999); // For mobile devices
  
  try {
    document.execCommand('copy');
    alert('Invite code copied to clipboard!');
  } catch (err) {
    alert('Failed to copy. Please manually copy the code: ' + input.value);
  }
}

// Leave business confirmation
async function leaveBusinessConfirm() {
  if (!activeOrganization) return;
  
  const currentMember = activeOrganization.members.find(m => m.userId === currentUser.uid);
  
  // Check if user is the only admin
  const adminCount = activeOrganization.members.filter(m => m.role === 'admin').length;
  if (currentMember && currentMember.role === 'admin' && adminCount === 1) {
    alert('You are the only admin. Please promote another member to admin before leaving, or delete the business instead.');
    return;
  }
  
  if (!confirm(`Are you sure you want to leave ${activeOrganization.name}?\n\nYou will lose access to all business spools and history.`)) {
    return;
  }
  
  try {
    const orgId = activeOrganization.id;
    
    // Remove user from organization members array
    const updatedMembers = activeOrganization.members.filter(m => m.userId !== currentUser.uid);
    await db.collection('organizations').doc(orgId).update({
      members: updatedMembers
    });
    
    // Remove organization from user's organizations array
    await db.collection('users').doc(currentUser.uid).update({
      organizations: firebase.firestore.FieldValue.arrayRemove(orgId),
      currentWorkspace: 'personal', // Switch back to personal
      location: firebase.firestore.FieldValue.delete() // Remove location
    });
    
    console.log('✅ Left organization');
    
    alert('You have left the business. Returning to personal workspace...');
    
    // Reset local state
    userOrganizations = [];
    currentWorkspace = 'personal';
    activeOrganization = null;
    
    // Reload data
    await loadUserData();
    showScreen('home');
    
  } catch (error) {
    console.error('Error leaving organization:', error);
    alert('Failed to leave business. Please try again.');
  }
}

// Show business management modal (placeholder for now)
function showBusinessManagementModal() {
  alert('Business member management coming in the next step!\n\nFor now, use Settings to view your invite code and business info.');
}

// ===== END BUSINESS MANAGEMENT =====