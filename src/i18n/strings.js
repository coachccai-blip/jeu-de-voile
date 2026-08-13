/**
 * strings.js — Toutes les chaînes de texte de l'UI (fr).
 * Externalisées pour préparer une future i18n. Accès via t('clef').
 */
export const STRINGS = {
  fr: {
    gameTitle: 'REGATTA QUIZ',
    gameSubtitle: 'Course à la voile · Foils & calcul mental',

    // Menu
    menuCampaign: 'Campagne',
    menuTutorial: 'Tutoriel',
    menuSettings: 'Réglages',
    menuCredits: 'Crédits',
    menuTapToStart: 'Cliquez pour naviguer',

    // Carte du monde
    mapTitle: 'Carte du monde',
    mapBack: '← Menu',
    mapLocked: 'Verrouillé',
    mapAvailable: 'Disponible',
    mapWon: 'Gagné',
    mapBestTime: 'Meilleur temps',
    mapNoTime: '—',
    mapUnlockHint: 'Gagnez la course précédente pour débloquer.',
    mapTrophies: 'Trophées',

    // Pré-course
    preRaceStart: 'Prendre le départ',
    preRaceBack: '← Carte',
    preRaceDifficulty: 'Difficulté',
    preRaceWind: 'Vent',
    preRaceCurrent: 'Courants',
    preRaceRivals: 'Adversaires',
    preRaceCourse: 'Parcours',
    preRaceBuoys: 'bouées',

    // HUD course
    hudSpeed: 'nds',
    hudNextBuoy: 'Bouée',
    hudLap: 'Bouée',
    hudManeuver: 'Manœuvrer',
    hudManeuverHint: 'Choisissez un cap',
    hudPosition: 'Pos',
    hudWind: 'Vent',

    // Départ
    countGo: 'GO !',
    countGet: 'Parez…',

    // QCM
    qcmTimeUp: 'Trop tard !',
    qcmCorrect: 'Juste !',
    qcmWrong: 'Faux',
    qcmBoost: 'BOOST',

    // Feedback course
    fbFoiling: 'SUR FOILS !',
    fbSplash: 'CHUTE À L\'EAU !',
    fbBuoy: 'Bouée virée',
    fbWrongWay: 'Mauvais sens',

    // Podium
    podiumTitle: 'Arrivée',
    podiumVictory: 'VICTOIRE !',
    podiumDefeat: 'Course terminée',
    podiumNewRecord: 'Nouveau record !',
    podiumNewTrophy: 'Nouveau trophée !',
    podiumTrophies: 'Trophées du parcours',
    podiumRank: 'Classement',
    podiumTime: 'Temps',
    podiumStats: 'Statistiques',
    podiumQuestions: 'Questions jouées',
    podiumAccuracy: 'Bonnes réponses',
    podiumBestReply: 'Meilleur temps de réponse',
    podiumTopSpeed: 'Vitesse max',
    podiumBestTimes: 'Meilleurs temps',
    podiumReplay: 'Rejouer',
    podiumNext: 'Course suivante',
    podiumMap: 'Carte du monde',

    // Réglages
    settingsTitle: 'Réglages',
    settingsMusic: 'Musique',
    settingsSfx: 'Effets sonores',
    settingsReset: 'Réinitialiser la sauvegarde',
    settingsResetConfirm: 'Effacer toute la progression et les records ?',
    settingsResetYes: 'Oui, tout effacer',
    settingsResetNo: 'Annuler',
    settingsDone: 'Terminé',
    settingsBack: '← Retour',

    // Crédits
    creditsTitle: 'Crédits',
    creditsBody:
      'Regatta Quiz — prototype open-source inspiré de SailGP.\n' +
      'Conception & code : projet éducatif.\n' +
      'Audio 100% procédural (Web Audio API), libre de droits.\n' +
      'Aucune dépendance réseau — jouable hors ligne.',
    creditsBack: '← Menu',

    // Commun
    keyHint: 'Astuce : touches 1-4 pour répondre, Espace pour manœuvrer.',
    pause: 'Pause',
    resume: 'Reprendre',
    restart: 'Recommencer',
    quitRace: 'Quitter la course',

    // Tutoriel
    tutTitle: 'Tutoriel',
    tutSkip: 'Passer le tutoriel',
    tutNext: 'Suivant →',
    tutStep1: 'Bienvenue ! Votre catamaran avance en permanence. La caméra le suit. Voici votre télémétrie : vitesse, position, prochaine bouée.',
    tutStep2: 'Appuyez sur « Manœuvrer » (ou Espace) pour ouvrir une question. Répondez vite : une bonne réponse rapide = gros boost !',
    tutStep3: 'Après la réponse, cliquez/glissez sur l\'eau pour choisir votre nouveau cap. Bonne réponse = manœuvre exécutée + boost.',
    tutStep4: 'Le vent (flèches) ralentit si vous naviguez droit dedans : tirez des bords ! Les courants (traînées) vous poussent.',
    tutStep5: 'Virez les bouées dans l\'ordre (l\'anneau indique la prochaine). Enchaînez les bonnes réponses pour voler sur vos foils.',
    tutStep6: 'Franchissez la ligne d\'arrivée devant les 4 adversaires. Prêt ? Lancez votre première vraie course !',
    tutFinish: 'Compris, jouons !',
  },
};

let currentLang = 'fr';
export function setLang(l) { if (STRINGS[l]) currentLang = l; }
export function t(key) {
  const v = STRINGS[currentLang][key];
  return v === undefined ? key : v;
}
