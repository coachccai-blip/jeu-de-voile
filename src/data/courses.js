/**
 * courses.js — Définition des parcours (mode Campagne).
 * Chaque parcours : tracé (bouées ordonnées), vent, courants, banque de questions.
 *
 * Repère monde : origine en haut-gauche, x→droite, y→bas (4200 × 3000).
 * `wind.dir` = direction VERS laquelle souffle le vent (radians, 0 = vers +x/est).
 * `marks` = liste ordonnée de bouées à virer. `side` = côté de contournement (indicatif visuel).
 * La ligne de départ et d'arrivée sont dérivées de `start`.
 */

// Couleurs pastel, lisibles sur l'océan sombre. Le joueur est en bleu pastel.
export const PLAYER = { id: 'joueur', name: 'Vous', color: '#8FB6F2', sail: '#ffffff' };

// Vivier d'adversaires : chaque course tire 4 concurrents AU HASARD dans ce pool.
// Prénoms anonymisés : surnom + patronyme « marin » (dans l'esprit « Clém Oussaillon »).
export const OPPONENT_POOL = [
  { name: 'Dav’ Larguevent',   color: '#9FE3B4', sail: '#ffffff' }, // David
  { name: 'Agn’ Ducabestan',        color: '#F2A9C4', sail: '#ffffff' }, // Agnès
  { name: 'Pierrot Deshoules',      color: '#F6B482', sail: '#ffffff' }, // Pierre
  { name: 'Sab’ Ladérive',     color: '#C7A9EC', sail: '#ffffff' }, // Sabra
  { name: 'Ben Wadecoco',           color: '#A9D8F2', sail: '#ffffff' }, // Benoit
  { name: 'Céci Bellécume',         color: '#F2D6A9', sail: '#ffffff' }, // Cécilia
  { name: 'Lindouche Froide',       color: '#E6A0A0', sail: '#ffffff' }, // Linda
  { name: 'Clém Oussaillon',        color: '#8FE0D2', sail: '#ffffff' }, // Clément
  { name: 'Thib’ Alizé',       color: '#B7C0F2', sail: '#ffffff' }, // Thibault
  { name: 'JuL Delavague',          color: '#F2A0DE', sail: '#ffffff' }, // Julie
  { name: 'Vaïana Durécif',         color: '#CDE89A', sail: '#ffffff' }, // Aina
  { name: 'Pierrad Tribord',        color: '#E0C4A0', sail: '#ffffff' }, // Pierre-Adrien
  { name: 'Mari Desabysses',        color: '#A0DFE6', sail: '#ffffff' }, // Mariana
  { name: 'Kim Ducorail',           color: '#D2A6F0', sail: '#ffffff' }, // Hakim
  { name: 'Grazi Auportant',        color: '#F5C0DA', sail: '#ffffff' }, // Graziella
  { name: 'Dam’ Duressac',     color: '#A6E0B0', sail: '#ffffff' }, // Damien
  { name: 'Fair’ Dumistral',   color: '#EAD79A', sail: '#ffffff' }, // Fairrouz
];

// Le joueur est toujours l'équipe index 0 ; les adversaires suivent.
export const PLAYER_TEAM_INDEX = 0;

/** Tire `n` adversaires distincts au hasard dans le vivier. */
export function pickOpponents(n = 4) {
  const pool = OPPONENT_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

/** Grille de départ complète = joueur + n adversaires aléatoires. */
export function buildGrid(n = 4) {
  return [PLAYER, ...pickOpponents(n)];
}

function deg(d) { return d * Math.PI / 180; }

// Campagne = 8 chapitres Leyton (du CIR à la fiscalité de l'énergie), dans l'ordre.
// Chaque course pointe vers son chapitre (`chapter`) : la banque de questions
// vrai/faux de la course se cantonne aux affirmations de ce produit.
export const COURSES = [
  {
    id: 'saint-tropez',
    name: 'Saint-Tropez',
    country: 'France',
    chapter: 'cir',
    tagline: 'Baie technique, brise thermique tournante.',
    intro: 'Bienvenue à Saint-Tropez. Première étape : le Crédit d\'Impôt Recherche (CIR), l\'un des produits phares de Leyton et souvent la porte d\'entrée de la relation client. Distinguez le vrai du faux pour gagner en aisance sur ce sujet clé du cross-selling.',
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
    id: 'marseille',
    name: 'Marseille',
    country: 'France',
    chapter: 'ipbox',
    tagline: 'Mistral musclé : la stratégie prime.',
    intro: 'Direction Marseille pour l\'IP Box, la fiscalité de la propriété intellectuelle. Validez chaque affirmation : bien maîtriser ce produit ouvre de belles opportunités clients.',
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
  {
    id: 'cadix',
    name: 'Cadix',
    country: 'Espagne',
    chapter: 'aides',
    tagline: 'Levante capricieux : cap sur les subventions.',
    intro: 'Escale à Cadix, autour des aides et subventions — nationales, régionales et européennes. Testez vos réflexes : savoir orienter un client sur ces dispositifs fait la différence.',
    geo: { lat: 36.53, lon: -6.29 },
    wind: { dir: deg(80), strength: 1.05 },
    start: { x: 2000, y: 2550, angle: deg(-95) },
    marks: [
      { x: 1800, y: 1500, side: 'port', label: 'Au vent 1' },
      { x: 900,  y: 1000, side: 'starboard', label: 'Ouest' },
      { x: 3100, y: 1000, side: 'port', label: 'Est' },
      { x: 3000, y: 1900, side: 'starboard', label: 'Portant' },
      { x: 2000, y: 1500, side: 'port', label: 'Central' },
    ],
    currents: [
      { x: 1700, y: 1300, r: 560, dir: deg(10), strength: 24 },
      { x: 2900, y: 1500, r: 500, dir: deg(190), strength: 20 },
    ],
  },
  {
    id: 'sydney',
    name: 'Sydney',
    country: 'Australie',
    chapter: 'bpo',
    tagline: 'Vent fort et houle : gros portants.',
    intro: 'Étape de Sydney, consacrée au BPO : recouvrement des IJSS et gestion externalisée de l\'absence. Chaque bonne réponse affine votre discours sur ce produit.',
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
    id: 'dubai',
    name: 'Dubaï',
    country: 'Émirats',
    chapter: 'payroll',
    tagline: 'Plan d\'eau plat, vent stable, sprint pur.',
    intro: 'Bienvenue à Dubaï pour le Payroll : optimisation des charges sociales et dispositifs d\'exonération (réduction Fillon / RGDU). Prouvez votre maîtrise, affirmation après affirmation.',
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
    id: 'san-francisco',
    name: 'San Francisco',
    country: 'États-Unis',
    chapter: 'taxes-locales',
    tagline: 'Courants de baie puissants sous le pont.',
    intro: 'Cap sur San Francisco et les taxes locales — TLPE, TFPB, CFE, CVAE. Un terrain technique : distinguez le vrai du faux pour rassurer vos prospects.',
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
    id: 'auckland',
    name: 'Auckland',
    country: 'Nouvelle-Zélande',
    chapter: 'taxes-nationales',
    tagline: 'Bascules de vent : la stratégie prime.',
    intro: 'Étape d\'Auckland, dédiée aux taxes nationales : C3S, TVA et taxes sectorielles. Affûtez vos connaissances et prenez l\'avantage sur ce produit.',
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
    id: 'singapour',
    name: 'Singapour',
    country: 'Singapour',
    chapter: 'energie',
    tagline: 'Grande finale : brise tropicale et enjeux énergie.',
    intro: 'Grande finale à Singapour, sur la fiscalité de l\'énergie et les accises. Un dernier vrai/faux pour couronner votre parcours d\'expert des produits Leyton.',
    geo: { lat: 1.29, lon: 103.85 },
    wind: { dir: deg(70), strength: 1.1 },
    start: { x: 2100, y: 2600, angle: deg(-100) },
    marks: [
      { x: 1600, y: 1600, side: 'port', label: 'Au vent 1' },
      { x: 700,  y: 1100, side: 'starboard', label: 'Ouest' },
      { x: 2500, y: 700,  side: 'port', label: 'Nord' },
      { x: 3500, y: 1400, side: 'starboard', label: 'Est' },
      { x: 2700, y: 2000, side: 'port', label: 'Sud' },
      { x: 2100, y: 1500, side: 'port', label: 'Central' },
    ],
    currents: [
      { x: 1500, y: 1300, r: 600, dir: deg(120), strength: 28 },
      { x: 3000, y: 1500, r: 540, dir: deg(30), strength: 24 },
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
