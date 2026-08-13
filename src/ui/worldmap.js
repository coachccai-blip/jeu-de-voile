/**
 * worldmap.js — Dessin d'une vraie carte du monde stylisée (continents) sur canvas.
 * Projection ~ équirectangulaire ; contours simplifiés en coordonnées normalisées
 * [0..1] pour rester légers et lisibles. Utilisé en fond de la carte de campagne.
 */

// Continents (silhouettes simplifiées, coordonnées normalisées x→droite, y→bas).
const CONTINENTS = [
  // Amérique du Nord
  [[0.05,0.24],[0.10,0.16],[0.16,0.14],[0.20,0.17],[0.24,0.15],[0.28,0.20],[0.26,0.25],
   [0.29,0.29],[0.25,0.31],[0.26,0.36],[0.22,0.41],[0.20,0.47],[0.175,0.43],[0.175,0.37],
   [0.135,0.35],[0.125,0.30],[0.075,0.29],[0.055,0.26]],
  // Amérique centrale + Sud
  [[0.205,0.47],[0.235,0.49],[0.26,0.48],[0.30,0.49],[0.325,0.54],[0.315,0.60],[0.295,0.66],
   [0.275,0.74],[0.25,0.83],[0.235,0.78],[0.245,0.69],[0.225,0.61],[0.215,0.54],[0.20,0.50]],
  // Europe
  [[0.455,0.205],[0.49,0.18],[0.52,0.185],[0.55,0.20],[0.545,0.235],[0.515,0.25],[0.53,0.275],
   [0.495,0.285],[0.475,0.265],[0.485,0.24],[0.46,0.235]],
  // Afrique
  [[0.475,0.31],[0.515,0.30],[0.56,0.315],[0.605,0.35],[0.60,0.40],[0.615,0.47],[0.585,0.55],
   [0.55,0.63],[0.51,0.665],[0.495,0.61],[0.485,0.53],[0.455,0.47],[0.445,0.40],[0.455,0.345]],
  // Asie
  [[0.55,0.225],[0.585,0.185],[0.63,0.155],[0.69,0.145],[0.75,0.155],[0.81,0.15],[0.86,0.18],
   [0.885,0.225],[0.845,0.255],[0.865,0.30],[0.815,0.325],[0.765,0.30],[0.735,0.335],
   [0.695,0.315],[0.665,0.35],[0.63,0.33],[0.60,0.35],[0.565,0.31],[0.55,0.26]],
  // Inde (péninsule)
  [[0.655,0.34],[0.69,0.345],[0.705,0.375],[0.685,0.415],[0.665,0.435],[0.655,0.40],[0.645,0.36]],
  // Australie
  [[0.795,0.635],[0.85,0.625],[0.89,0.65],[0.90,0.695],[0.865,0.725],[0.82,0.72],[0.785,0.685],[0.78,0.655]],
];

// Petites îles / archipels (cercles doux) : [x, y, rayon].
const ISLANDS = [
  [0.455,0.175,0.012], // Îles Britanniques
  [0.875,0.30,0.014],  // Japon
  [0.79,0.47,0.02],    // Indonésie
  [0.63,0.63,0.012],   // Madagascar
  [0.935,0.775,0.013], // Nouvelle-Zélande
  [0.115,0.145,0.02],  // Groenland
];

function poly(ctx, pts, w, h) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = p[0] * w, y = p[1] * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/**
 * Dessine la carte. `time` (s) anime un léger scintillement océan.
 */
export function drawWorldMap(ctx, w, h, time = 0) {
  // Océan (dégradé profond)
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#062037');
  g.addColorStop(0.55, '#083b60');
  g.addColorStop(1, '#052033');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Graticule (méridiens / parallèles)
  ctx.save();
  ctx.strokeStyle = 'rgba(130,200,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 12; i++) { const x = (i / 12) * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let i = 1; i < 6; i++) { const y = (i / 6) * h; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  // Équateur marqué
  ctx.strokeStyle = 'rgba(130,200,255,0.14)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Reflets océan animés
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#bfe6ff';
  for (let i = 0; i < 7; i++) {
    const y = (i / 7) * h + Math.sin(time * 0.6 + i) * 4;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.01 + time * 0.5 + i) * 6);
    ctx.stroke();
  }
  ctx.restore();

  // Continents
  const land = ctx.createLinearGradient(0, 0, 0, h);
  land.addColorStop(0, '#12405f');
  land.addColorStop(1, '#0d3350');
  for (const c of CONTINENTS) {
    poly(ctx, c, w, h);
    // halo côtier
    ctx.save();
    ctx.shadowColor = 'rgba(80,200,255,0.5)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = land;
    ctx.fill();
    ctx.restore();
    // trait de côte
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(150,220,255,0.55)';
    ctx.stroke();
  }
  for (const [x, y, r] of ISLANDS) {
    ctx.beginPath();
    ctx.arc(x * w, y * h, r * Math.min(w, h), 0, Math.PI * 2);
    ctx.fillStyle = land;
    ctx.save(); ctx.shadowColor = 'rgba(80,200,255,0.5)'; ctx.shadowBlur = 8; ctx.fill(); ctx.restore();
    ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(150,220,255,0.5)'; ctx.stroke();
  }
}
