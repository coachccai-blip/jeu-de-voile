/**
 * sw.js — Service Worker : met le jeu en cache pour un fonctionnement 100% hors ligne
 * (une fois la page ouverte une première fois, elle est jouable sans réseau, et
 * installable « sur l'écran d'accueil » / en application sur PC).
 *
 * Stratégie : cache-first avec repli réseau, puis mise en cache à la volée.
 * Chemins RELATIFS au scope du SW → fonctionne aussi bien à la racine que sous
 * /jeu-de-voile/ sur GitHub Pages.
 */
const CACHE = 'regatta-quiz-v23';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'styles/main.css',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-512-maskable.png',
  'src/main.js',
  'src/pwa.js',
  'src/config/balance.js',
  'src/i18n/strings.js',
  'src/save/save.js',
  'src/audio/audio.js',
  'src/audio/manifest.js',
  'src/data/questionBank.js',
  'src/data/leyton.js',
  'src/data/mdLoader.js',
  'src/data/courses.js',
  'src/game/engine.js',
  'src/game/entities.js',
  'src/game/physics.js',
  'src/game/ai.js',
  'src/game/mathutils.js',
  'src/ui/screens.js',
  'src/ui/raceIntro.js',
  'src/ui/hud.js',
  'src/ui/qcm.js',
  'src/ui/worldmap.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll échoue si UNE ressource manque ; on tolère les absences.
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // met en cache les réponses valides de même origine
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
