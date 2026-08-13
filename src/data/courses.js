/**
 * courses.js — Définition des parcours (mode Campagne).
 * Chaque parcours : tracé (bouées ordonnées), vent, courants, banque de questions.
 *
 * Repère monde : origine en haut-gauche, x→droite, y→bas (4200 × 3000).
 * `wind.dir` = direction VERS laquelle souffle le vent (radians, 0 = vers +x/est).
 * `marks` = liste ordonnée de bouées à virer. `side` = côté de contournement (indicatif visuel).
 * La ligne de départ et d'arrivée sont dérivées de `start`.
 */

export const TEAMS = [
  { id: 'fr', name: 'France',     color: '#2f6fed', sail: '#ffffff' },
  { id: 'au', name: 'Australie',  color: '#e0b020', sail: '#0a2540' },
  { id: 'gb', name: 'Albion',     color: '#d43a3a', sail: '#ffffff' },
  { id: 'nz', name: 'Zélande',    color: '#111820', sail: '#20c997' },
  { id: 'us', name: 'Liberty',    color: '#7b3ff2', sail: '#ffd43b' },
];

// Le joueur est toujours l'équipe index 0 (France) ; les bots prennent les suivantes.
export const PLAYER_TEAM_INDEX = 0;

function deg(d) { return d * Math.PI / 180; }

export const COURSES = [
  {
    id: 'saint-tropez',
    name: 'Saint-Tropez',
    country: 'France',
    tagline: 'Baie technique, brise thermique tournante.',
    geo: { lat: 43.27, lon: 6.64 },
    wind: { dir: deg(90), strength: 1.0 }, // vent vers le sud
    start: { x: 2100, y: 2500, angle: deg(-90) }, // les bateaux visent le nord au départ
    marks: [
      { x: 2100, y: 1500, side: 'port', label: 'Au vent 1' },
      { x: 1200, y: 900,  side: 'starboard', label: 'Portant 1' },
      { x: 3000, y: 900,  side: 'port', label: 'Portant 2' },
      { x: 2100, y: 1500, side: 'port', label: 'Au vent 2' },
    ],
    currents: [
      { x: 1600, y: 1400, r: 500, dir: deg(20), strength: 22 },
      { x: 2900, y: 1200, r: 450, dir: deg(160), strength: 18 },
    ],
  },
  {
    id: 'sydney',
    name: 'Sydney',
    country: 'Australie',
    tagline: 'Vent fort et houle : gros portants.',
    geo: { lat: -33.86, lon: 151.21 },
    wind: { dir: deg(45), strength: 1.15 },
    start: { x: 1000, y: 2400, angle: deg(-45) },
    marks: [
      { x: 2000, y: 1400, side: 'port', label: 'Au vent 1' },
      { x: 3200, y: 1900, side: 'starboard', label: 'Reaching' },
      { x: 2400, y: 700,  side: 'port', label: 'Au vent 2' },
      { x: 900,  y: 1200, side: 'starboard', label: 'Portant' },
    ],
    currents: [
      { x: 2600, y: 1600, r: 620, dir: deg(70), strength: 30 },
    ],
  },
  {
    id: 'san-francisco',
    name: 'San Francisco',
    country: 'Liberty',
    tagline: 'Courants de baie puissants sous le pont.',
    geo: { lat: 37.77, lon: -122.42 },
    wind: { dir: deg(75), strength: 1.05 },
    start: { x: 2100, y: 2600, angle: deg(-100) },
    marks: [
      { x: 1500, y: 1600, side: 'port', label: 'Au vent 1' },
      { x: 700,  y: 1000, side: 'starboard', label: 'Ouest' },
      { x: 2800, y: 1000, side: 'port', label: 'Est' },
      { x: 3400, y: 1900, side: 'starboard', label: 'Portant' },
      { x: 2100, y: 1500, side: 'port', label: 'Central' },
    ],
    currents: [
      { x: 1400, y: 1300, r: 700, dir: deg(200), strength: 34 },
      { x: 3000, y: 1400, r: 520, dir: deg(-10), strength: 24 },
    ],
  },
  {
    id: 'dubai',
    name: 'Dubaï',
    country: 'Émirats',
    tagline: 'Plan d\'eau plat, vent stable, sprint pur.',
    geo: { lat: 25.20, lon: 55.27 },
    wind: { dir: deg(100), strength: 0.95 },
    start: { x: 2100, y: 2500, angle: deg(-90) },
    marks: [
      { x: 2100, y: 1400, side: 'port', label: 'Au vent' },
      { x: 3300, y: 1400, side: 'starboard', label: 'Est' },
      { x: 3300, y: 2200, side: 'starboard', label: 'SE' },
      { x: 900,  y: 2200, side: 'port', label: 'SO' },
      { x: 900,  y: 1400, side: 'port', label: 'Ouest' },
    ],
    currents: [
      { x: 2100, y: 1900, r: 500, dir: deg(0), strength: 14 },
    ],
  },
  {
    id: 'auckland',
    name: 'Auckland',
    country: 'Zélande',
    tagline: 'Bascules de vent : la stratégie prime.',
    geo: { lat: -36.85, lon: 174.76 },
    wind: { dir: deg(60), strength: 1.1 },
    start: { x: 1200, y: 2500, angle: deg(-60) },
    marks: [
      { x: 2200, y: 1600, side: 'port', label: 'Au vent 1' },
      { x: 3400, y: 1100, side: 'starboard', label: 'NE' },
      { x: 2000, y: 600,  side: 'port', label: 'Nord' },
      { x: 800,  y: 1100, side: 'starboard', label: 'NO' },
      { x: 1900, y: 1700, side: 'port', label: 'Central' },
    ],
    currents: [
      { x: 2600, y: 1200, r: 560, dir: deg(120), strength: 26 },
      { x: 1200, y: 1500, r: 480, dir: deg(-40), strength: 20 },
    ],
  },
  {
    id: 'marseille',
    name: 'Marseille',
    country: 'France',
    tagline: 'Mistral musclé : finale de championnat.',
    geo: { lat: 43.30, lon: 5.37 },
    wind: { dir: deg(115), strength: 1.2 },
    start: { x: 2100, y: 2600, angle: deg(-115) },
    marks: [
      { x: 1700, y: 1500, side: 'port', label: 'Au vent 1' },
      { x: 600,  y: 900,  side: 'starboard', label: 'Cap Ouest' },
      { x: 2400, y: 700,  side: 'port', label: 'Nord' },
      { x: 3500, y: 1300, side: 'starboard', label: 'Cap Est' },
      { x: 2700, y: 2000, side: 'port', label: 'Sud' },
      { x: 2100, y: 1500, side: 'port', label: 'Central' },
    ],
    currents: [
      { x: 1500, y: 1200, r: 640, dir: deg(150), strength: 32 },
      { x: 3000, y: 1500, r: 560, dir: deg(20), strength: 28 },
    ],
  },
];

export function getCourse(id) { return COURSES.find(c => c.id === id); }
export function courseIndex(id) { return COURSES.findIndex(c => c.id === id); }

/**
 * Projection équirectangulaire (identique au dessin de la carte) :
 * lon -180..180 → x 0..1, lat 90..-90 → y 0..1. Renvoie la position normalisée
 * d'une ville à sa VRAIE position géographique.
 */
export function geoToMap(geo) {
  return { x: (geo.lon + 180) / 360, y: (90 - geo.lat) / 180 };
}
