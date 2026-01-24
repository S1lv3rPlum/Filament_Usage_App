// Switch between login and signup tabs
function switchTab(tab) {
  const tabs = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');
  
  tabs.forEach(t => t.classList.remove('active'));
  forms.forEach(f => f.classList.remove('active'));
  
  if (tab === 'login') {
    tabs[0].classList.add('active');
    document.getElementById('loginForm').classList.add('active');
  } else {
    tabs[1].classList.add('active');
    document.getElementById('signupForm').classList.add('active');
  }
  
  hideError();
}

// Show error message
function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.classList.add('show');
}

// Hide error message
function hideError() {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.classList.remove('show');
}

// Set loading state
function setLoading(isLoading) {
  const forms = document.querySelectorAll('.auth-form');
  forms.forEach(form => {
    if (isLoading) {
      form.classList.add('loading');
    } else {
      form.classList.remove('loading');
    }
  });
}

// Handle login
async function handleLogin(event) {
  event.preventDefault();
  hideError();
  setLoading(true);
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    await auth.signInWithEmailAndPassword(email, password);
    // User will be redirected by onAuthStateChanged listener
  } catch (error) {
    console.error('Login error:', error);
    let message = 'Login failed. Please try again.';
    
    if (error.code === 'auth/user-not-found') {
      message = 'No account found with this email.';
    } else if (error.code === 'auth/wrong-password') {
      message = 'Incorrect password.';
    } else if (error.code === 'auth/invalid-email') {
      message = 'Invalid email address.';
    } else if (error.code === 'auth/too-many-requests') {
      message = 'Too many failed attempts. Please try again later.';
    }
    
    showError(message);
    setLoading(false);
  }
}

// Handle signup
async function handleSignup(event) {
  event.preventDefault();
  hideError();
  
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
  
  // Validate passwords match
  if (password !== passwordConfirm) {
    showError('Passwords do not match.');
    return;
  }
  
  setLoading(true);
  
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    // Create user document in Firestore
await db.collection('users').doc(user.uid).set({
  email: user.email,
  displayName: null,
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
  currentWorkspace: 'personal',  // NEW
  location: null  // NEW - will be set if they join a business
});
    // User will be redirected by onAuthStateChanged listener
  } catch (error) {
    console.error('Signup error:', error);
    let message = 'Signup failed. Please try again.';
    
    if (error.code === 'auth/email-already-in-use') {
      message = 'An account with this email already exists.';
    } else if (error.code === 'auth/invalid-email') {
      message = 'Invalid email address.';
    } else if (error.code === 'auth/weak-password') {
      message = 'Password should be at least 6 characters.';
    }
    
    showError(message);
    setLoading(false);
  }
}

// Handle Google Sign-In
async function handleGoogleSignIn() {
  hideError();
  setLoading(true);
  

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'  // Forces account picker every time
  });

  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    
    // Check if user document exists, create if not
    const userDoc = await db.collection('users').doc(user.uid).get();
    
    if (!userDoc.exists) {
  await db.collection('users').doc(user.uid).set({
    email: user.email,
    displayName: user.displayName,
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
    currentWorkspace: 'personal',  // NEW
    location: null  // NEW
  });
}
    
// In handleSignup function, update the user document creation:
await db.collection('users').doc(user.uid).set({
  email: user.email,
  displayName: null,
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
  lowFilamentThreshold: 200  // NEW LINE
});

// In handleGoogleSignIn function, update the user document creation:
if (!userDoc.exists) {
  await db.collection('users').doc(user.uid).set({
    email: user.email,
    displayName: user.displayName,
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
    lowFilamentThreshold: 200  // NEW LINE
  });
}

    // User will be redirected by onAuthStateChanged listener
  } catch (error) {
    console.error('Google sign-in error:', error);
    let message = 'Google sign-in failed. Please try again.';
    
    if (error.code === 'auth/popup-closed-by-user') {
      message = 'Sign-in cancelled.';
    } else if (error.code === 'auth/popup-blocked') {
      message = 'Pop-up blocked. Please allow pop-ups and try again.';
    }
    
    showError(message);
    setLoading(false);
  }
}

// Listen for auth state changes
auth.onAuthStateChanged(async (user) => {
  if (user) {
    console.log('User logged in:', user.email);
    
    // Check if this is first login (has localStorage data to migrate)
    const hasLocalData = localStorage.getItem('spoolLibrary') || 
                        localStorage.getItem('usageHistory') || 
                        localStorage.getItem('emptySpools');
    
    if (hasLocalData) {
      // Store flag to trigger migration on home page
      sessionStorage.setItem('needsMigration', 'true');
    }
    
    // Redirect to home page
    window.location.href = 'home.html';
  }
});   