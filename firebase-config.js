// Firebase configuration and initialization
const firebaseConfig = {
  apiKey: "AIzaSyAU2xblHOMa3xi2XyasuirGxPOMPnNVNR4",
  authDomain: "filament-foundry.firebaseapp.com",
  projectId: "filament-foundry",
  storageBucket: "filament-foundry.firebasestorage.app",
  messagingSenderId: "790601891888",
  appId: "1:790601891888:web:c2a9090382fa9b24b92df5",
  measurementId: "G-54BDBM3K1L"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence()
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support offline persistence');
    }
  });

console.log("Firebase initialized successfully");