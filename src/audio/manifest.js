/**
 * manifest.js — Manifeste des pistes musicales.
 * En v1 les musiques sont générées procéduralement (0 fichier binaire, libre de droits).
 * Pour ajouter/remplacer une piste par un fichier audio réel plus tard, il suffit
 * d'ajouter une entrée { id, type:'file', src:'assets/audio/xxx.ogg' } et de la
 * charger dans audio.js. Le reste du jeu ne référence que les `id`.
 */
export const MUSIC_MANIFEST = [
  {
    id: 'menu',
    type: 'procedural',
    mood: 'calm-ocean',
    bpm: 82,
    // Progression d'accords (demi-tons relatifs à la fondamentale) — ambiance large et posée.
    root: 220, // A3
    chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [2, 5, 9, 12], [-1, 2, 7, 11]],
    license: 'CC0 — synthèse temps réel, aucun échantillon externe.',
  },
  {
    id: 'race',
    type: 'procedural',
    mood: 'sport-drive',
    bpm: 128,
    root: 165, // E3
    chords: [[0, 7, 12], [3, 10, 12], [5, 12, 15], [-2, 5, 10]],
    license: 'CC0 — synthèse temps réel, aucun échantillon externe.',
  },
];
