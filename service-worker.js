// DEV-SAFE SERVICE WORKER
// This will NOT break auth, Firebase, or Codespaces

self.addEventListener("install", event => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

// IMPORTANT:
// Do NOT intercept fetch at all during development
// Let the browser handle everything normally
