/**
 * pwa.js — Installation & hors-ligne.
 * - Enregistre le Service Worker (jeu jouable hors ligne après 1re visite).
 * - Capture l'événement d'installation pour proposer « Installer le jeu »
 *   (téléphone : écran d'accueil ; PC : application).
 */
let deferredPrompt = null;
let installed = false;
const listeners = new Set();
function notify() { listeners.forEach((f) => f()); }

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();      // on déclenche nous-mêmes le prompt plus tard
  deferredPrompt = e;
  notify();
});
window.addEventListener('appinstalled', () => { installed = true; deferredPrompt = null; notify(); });

export function onPwaChange(f) { listeners.add(f); return () => listeners.delete(f); }
export function canInstall() { return !!deferredPrompt; }
export function isInstalled() {
  return installed
    || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true;
}
export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

/** Déclenche l'invite d'installation native si disponible. */
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return choice.outcome; // 'accepted' | 'dismissed'
}

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne / non supporté */ });
  });
}
