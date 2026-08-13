/**
 * balance.js — Fichier d'équilibrage CENTRALISÉ.
 * Toutes les valeurs numériques du gameplay vivent ici pour itérer facilement.
 * (Vitesses en unités monde / seconde. 1 unité monde ≈ 1 mètre à l'échelle carte.)
 */

export const BALANCE = {
  world: {
    // Dimensions logiques du plan d'eau (unités monde). La caméra suit le joueur.
    width: 4200,
    height: 3000,
  },

  boat: {
    length: 34,              // longueur visuelle du F50 (unités monde)
    minSpeed: 55,            // vitesse de croisière minimale (le bateau avance toujours)
    maxSpeed: 240,           // plafond de vitesse "sur foils"
    baseCruise: 95,          // vitesse cible sans boost, cap optimal
    turnRate: 4.4,           // rad/s — rotation vive vers le cap (détours peu amples)
    accel: 90,               // accélération vers la vitesse cible (u/s^2)
    decel: 130,              // décélération (u/s^2)
    // "Vol sur foils" : au-dessus de ce ratio de vitesse, le bateau déjauge (écume+).
    foilingThreshold: 0.42,
  },

  boost: {
    // Boost = échelle CONTINUE selon la rapidité de réponse (pas de paliers cachés).
    maxAdd: 150,             // ajout de vitesse cible max (réponse instantanée)
    minAdd: 35,              // ajout minimal (bonne réponse au buzzer)
    maxDuration: 4.2,        // durée max du boost (s) pour réponse ultra-rapide
    minDuration: 1.6,        // durée min (bonne réponse lente)
    decayPerSec: 55,         // vitesse à laquelle le boost s'estompe
  },

  maneuver: {
    cooldown: 1.0,           // cooldown du bouton Manœuvrer (s)
    // Ralenti « bullet-time » pendant la question : quasi-arrêt du monde pour
    // laisser réfléchir. Retour à 1× dès que le joueur choisit son cap.
    questionTimeScale: 0.1,
  },

  splashdown: {
    // "Chute dans l'eau" : sortie de foils après échecs répétés à vitesse minimale.
    failThreshold: 2,        // nb de mauvaises réponses consécutives à vitesse mini => chute
    nearMinRatio: 0.30,      // "vitesse minimale" = sous ce ratio de maxSpeed
    speedPenalty: 0.45,      // multiplicateur de vitesse appliqué lors de la chute
    duration: 2.4,           // durée de la pénalité de rétablissement (s)
  },

  wind: {
    baseStrength: 1.0,       // multiplicateur global de l'effet du vent
    // Modèle de polaire simplifié : rendement selon l'angle au vent (près/portant).
    // Angle 0 = vent de face (no-go zone), 180 = vent arrière.
    noGoAngle: 42 * Math.PI / 180, // sous cet angle au vent réel => quasi à l'arrêt (il faut tirer des bords)
    bestUpwind: 50 * Math.PI / 180,
    bestReach: 100 * Math.PI / 180, // travers/largue = plus rapide
    minEfficiency: 0.30,     // rendement minimal dans la no-go zone
    maxEfficiency: 1.15,     // rendement au portant/largue optimal
  },

  current: {
    strengthScale: 1.0,      // multiplicateur global des courants
  },

  race: {
    countdownFrom: 5,        // top départ : 5..GO (séquence régate condensée)
    laps: 1,                 // nombre de tours (parcours = suite de portes)
    buoyRadius: 26,          // rayon de validation de bouée (checkpoint)
    finishReward: true,
  },

  difficulty: {
    // 5 crans, du plus facile au plus extrême. Interpolation continue entre crans.
    levels: [
      { key: 'tresFacile', label: 'Très facile', maxOperand: 9,  carry: false, timeLimit: 9.0, botSkill: 0.40, botSpeed: 2.6 },
      { key: 'facile',     label: 'Facile',      maxOperand: 20, carry: false, timeLimit: 7.5, botSkill: 0.55, botSpeed: 2.1 },
      { key: 'moyen',      label: 'Moyen',       maxOperand: 49, carry: true,  timeLimit: 6.0, botSkill: 0.68, botSpeed: 1.7 },
      { key: 'difficile',  label: 'Difficile',   maxOperand: 99, carry: true,  timeLimit: 5.0, botSkill: 0.80, botSpeed: 1.3 },
      { key: 'extreme',    label: 'Extrême',     maxOperand: 199,carry: true,  timeLimit: 3.8, botSkill: 0.90, botSpeed: 1.0 },
    ],
    defaultIndex: 1,
  },

  ai: {
    // Le bot "répond" à intervalle ~ botSpeed. Trajectoire toujours valide.
    reactionJitter: 0.5,     // variation aléatoire (s) du temps de réponse bot
    steerNoise: 0.10,        // petite variation de cap pour paraître naturel
    lookaheadBuoys: 1,
  },

  audio: {
    musicVolume: 0.5,
    sfxVolume: 0.7,
  },
};

/** Interpole les paramètres de difficulté à partir d'un curseur continu [0..1]. */
export function difficultyFromSlider(t) {
  const L = BALANCE.difficulty.levels;
  const clamped = Math.max(0, Math.min(1, t));
  const pos = clamped * (L.length - 1);
  const i = Math.min(L.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = L[i], b = L[i + 1];
  const lerp = (x, y) => x + (y - x) * f;
  return {
    slider: clamped,
    nearestLabel: f < 0.5 ? a.label : b.label,
    maxOperand: Math.round(lerp(a.maxOperand, b.maxOperand)),
    carry: f < 0.5 ? a.carry : b.carry,
    timeLimit: lerp(a.timeLimit, b.timeLimit),
    botSkill: lerp(a.botSkill, b.botSkill),
    botSpeed: lerp(a.botSpeed, b.botSpeed),
  };
}
