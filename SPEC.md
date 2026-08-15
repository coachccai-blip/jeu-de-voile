# X-Sail Quiz — Spécification de reproduction

Ce document décrit **l'intégralité** du jeu **X-Sail Quiz** afin de le reproduire
à l'identique. Il couvre l'architecture, chaque module, toutes les constantes
d'équilibrage, les données (produits Leyton, parcours, adversaires), les écrans,
l'audio, la sauvegarde, le mode hors-ligne (PWA) et le déploiement.

> Le contenu **verbatim** volumineux (les 8×60 affirmations Leyton, la géométrie
> exacte des parcours) vit dans `src/data/leyton.js` et `src/data/courses.js`.
> Pour une copie strictement identique, reprendre ces deux fichiers tels quels ;
> ce document donne tout le reste + la structure de ces données.

---

## 1. Concept

Jeu de **course à la voile** (vue du dessus, esthétique SailGP / catamarans F50 à
foils) détourné en **outil d'entraînement Leyton**. Le joueur (« Vous ») affronte
4 adversaires sur un parcours à bouées. Pour **manœuvrer et accélérer**, il doit
répondre à des questions :

- **Tutoriel** : calcul mental (QCM 4 choix).
- **Courses de campagne** : **Vrai / Faux** sur les **8 produits Leyton**
  (du CIR à la fiscalité de l'énergie). Chaque course = 1 produit ; sa banque est
  cantonnée aux 30 affirmations vraies + 30 fausses du produit.

Boucle : bouton **Manœuvrer** (cooldown 1 s) → une **question chronométrée**
apparaît, le monde passe en **ralenti** → réponse → si correct, **boost** de
vitesse continu (proportionnel à la rapidité) puis le joueur **choisit son cap**
en cliquant sur l'eau ; si faux, pas de boost, vitesse ÷ 2. Enchaîner de bonnes
réponses = voler sur les foils.

**Nom** : « X-Sail Quiz ». **Sous-titre** : « Course à la voile pour booster sa
transversalité ». **Présentateur** : *Clém Oussaillon*. **Créateur (crédits)** :
Clém Oussaillon.

---

## 2. Stack & principes

- **HTML / CSS / JavaScript (ES modules)**, **aucune dépendance**, **aucun build**.
- **Canvas 2D** pour la scène de course et les fonds animés (carte du monde, menu,
  aperçu de parcours). Le reste de l'UI est en **HTML/CSS** par-dessus.
- **Audio 100 % procédural** (Web Audio API) : aucune ressource binaire audio.
- **100 % hors-ligne** après première visite (**PWA** + Service Worker).
- **Persistance** : `localStorage` (schéma versionné).
- Lancement : servir la racine en HTTP (ES modules interdisent `file://`).
  `python3 -m http.server` ou `npx serve .`, puis ouvrir `index.html`.

---

## 3. Arborescence

```
index.html                 Point d'entrée (charge src/main.js en module)
manifest.webmanifest       Manifeste PWA (nom, icônes, couleurs)
sw.js                      Service Worker (cache-first, hors-ligne)
.nojekyll                  Sert les fichiers tels quels sur GitHub Pages
styles/main.css            TOUTE l'UI (esthétique TV SailGP, thème océan)
assets/icon-192.png, icon-512.png, icon-512-maskable.png   Icônes PWA (voilier)
assets/audio/README.md     Note : audio procédural, licence CC0
.github/workflows/pages.yml   Déploiement GitHub Pages (Actions)

src/
  main.js                  Machine à états des écrans + lancement des courses
  pwa.js                   Enregistrement SW + invite d'installation
  config/balance.js        FICHIER D'ÉQUILIBRAGE CENTRALISÉ (toutes les valeurs)
  i18n/strings.js          Toutes les chaînes FR (accès via t('clef'))
  save/save.js             localStorage : schéma v3 + migration + trophées
  audio/
    audio.js               Moteur audio procédural (musique + bruitages)
    manifest.js            Manifeste des pistes (procédural)
  data/
    leyton.js              8 chapitres produits : intro + 30 vraies + 30 fausses
    courses.js             8 parcours + joueur + vivier d'adversaires + projection
    questionBank.js        Banques : calcul (tuto) + VraiFaux (par produit)
    mdLoader.js            Spéc/parseur de banques externes .md (futur)
  game/
    engine.js              Moteur course : simulation, rendu Canvas, manœuvre, arrivée
    entities.js            Bateau (F50) : état + intégration physique
    physics.js             Modèle vent (près/portant) + courants
    ai.js                  IA des adversaires
    mathutils.js           Helpers math (clamp, lerp, angles, intersection segments)
  ui/
    screens.js             Menu, carte, pré-course + fiche mémo, podium, réglages,
                           crédits, tutoriel
    hud.js                 HUD de course + départ + feedbacks + ralenti (RaceView)
    qcm.js                 Panneau question (QCM math ou Vrai/Faux)
    raceIntro.js           Écran d'intro « présentateur » avant chaque course
    worldmap.js            Dessin des continents (carte de campagne)
```

---

## 4. Machine à états (main.js)

`go(screen, params)` remplace le contenu de `#screen-root`. Écrans :
`menu → campaign(carte) → precourse → race → podium`, plus `tutorial`,
`settings`, `credits`.

- **Audio** initialisé au 1er geste utilisateur (politique autoplay).
- **campaign** : si le tutoriel n'a jamais été vu → lance `tutorial` d'abord.
- **race** : crée un canvas plein écran, un `RaceEngine`, un `RaceView`, démarre
  le moteur **en pause** puis affiche l'**intro présentateur** ; le top départ
  ne démarre qu'au clic « C'est parti ! ».
- **Fin de course** → enregistre le résultat (trophée de la difficulté jouée) →
  `podium`.
- `window.__regatta = { go, engine }` (hook debug/tests).

---

## 5. Équilibrage (config/balance.js) — valeurs exactes

Monde : `4200 × 3000` unités.

**Bateau** : `length 34`, `minSpeed 55`, `maxSpeed 240`, `baseCruise 95`,
`turnRate 4.4` rad/s, `accel 90`, `decel 130`, `foilingThreshold 0.42`.

**Boost** (échelle continue selon rapidité de réponse) : `maxAdd 150`,
`minAdd 35`, `maxDuration 1.5 s`, `minDuration 0.8 s`, `decayPerSec 70`.
→ la vitesse max ne tient qu'~1,5 s puis décroît : il faut répondre régulièrement.

**Manœuvre** : `cooldown 1.0 s`. **Ralenti** pendant la question
`questionTimeScale 0.1` (quasi-arrêt). Après la réponse, ralenti **maintenu**
`resumeDelay 1.0 s` (temps réel) avant retour à vitesse normale.

**Pénalité** mauvaise réponse : `wrongSpeedMult 0.5` (vitesse ÷ 2 immédiate).

**Chute (splashdown)** : `failThreshold 2` mauvaises réponses consécutives à
vitesse mini, `nearMinRatio 0.30`, `speedPenalty 0.45`, `duration 2.4 s`.

**Vent** (polaire simplifiée) : `noGoAngle 42°`, `bestReach 100°`,
`minEfficiency 0.30`, `maxEfficiency 1.15`, `baseStrength 1.0`.

**Course** : `countdownFrom 5`, `laps 1`, `buoyRadius 26`.

**Difficulté** (le curseur ne change QUE les adversaires ; les questions restent
faciles/constantes). 5 crans, `timeLimit` = temps RÉEL pour répondre :

| Cran | maxOperand | carry | timeLimit | botSkill | botSpeed |
|---|---|---|---|---|---|
| Très facile | 10 | non | 8.0 | 0.30 | 3.0 |
| Facile | 10 | non | 8.0 | 0.45 | 2.5 |
| Moyen | 10 | non | 8.0 | 0.60 | 2.0 |
| Difficile | 10 | non | 8.0 | 0.75 | 1.6 |
| Extrême | 10 | non | 8.0 | 0.92 | 1.3 |

`defaultIndex 1`. Le curseur en jeu est **discret** (5 crans, pas 0.25).
Helpers : `difficultyFromSlider(t)` (interpole), `difficultyIndexFromSlider(t)`.

**IA** : `reactionJitter 0.5`, `steerNoise 0.10`.
**Audio** : `musicVolume 0.5`, `sfxVolume 0.7`.

> Le temps de réponse Vrai/Faux est **8 s** (constante `VF_TIME_LIMIT` dans
> `questionBank.js`) ; le tutoriel (calcul) utilise `difficulty.timeLimit` = 8 s.

---

## 6. Physique (physics.js + entities.js)

- **Rendement du vent** selon l'angle entre le cap et la provenance du vent :
  no-go zone (< 42°) → rendement minimal ; montée sinusoïdale jusqu'au largue
  (~100°) → max ; léger repli au vent arrière. Naviguer face au vent est
  pénalisant (il faut tirer des bords).
- **Vitesse cible** = `baseCruise × rendement × force_vent + boostAdd`, bornée
  `[minSpeed, maxSpeed]`.
- **Courants** : zones circulaires `{x,y,r,dir,strength}` ; poussée = vecteur
  ajouté au déplacement, décroissante du centre au bord.
- **Intégration** (par frame, dt réel plafonné 0.05 s puis multiplié par le
  `timeScale`) : rotation du cap vers `targetHeading` à `turnRate` ; decay du
  boost ; approche de la vitesse cible (`accel`/`decel`) ; déplacement + courant ;
  bornage dans le monde ; état « foiling » ; sillage.
- **Waypoint** : une manœuvre réussie fixe un **point précis** (le pixel cliqué) ;
  le bateau vire vers ce point et le traverse, puis file tout droit.
- `prevX/prevY` mémorisés pour la **détection de franchissement de ligne**.
- Conversion d'affichage : `speedKnots = speed / maxSpeed × 52` (~52 nds max).

---

## 7. IA des adversaires (ai.js)

- **Trajectoire toujours valide** : chaque bot vise la prochaine bouée
  (`atan2`) avec un léger bruit (`steerNoise`) pour paraître naturel.
- **Réponses simulées** à intervalle ~ `botSpeed` (± `reactionJitter`) : succès
  avec proba `botSkill`. Un succès applique un boost (comme le joueur, force
  aléatoire) ; un échec, rien. Échecs répétés à basse vitesse → chute.

---

## 8. Moteur de course (engine.js)

Machine à états : `PRESTART → RACING → FINISHED` ; sous-état manœuvre
`NONE → QUESTION → AIMING`.

- **Grille** = joueur (index 0) + **4 adversaires tirés au hasard** (`buildGrid(4)`),
  placés en éventail derrière la ligne.
- **Top départ** : compte à rebours 5→GO (bips + « GO »). Peut être **maintenu en
  pause** (intro présentateur / 1er dialogue du tutoriel).
- **Question** : `pressManeuver()` (si cooldown écoulé et phase RACING) tire une
  question de la banque, passe en QUESTION (ralenti 0,1×), émet `onQuestionShow`.
  Chrono en **temps réel** (`qElapsed += dt`), timeout → mauvaise réponse.
- **Résolution** : correct → boost continu `add = minAdd + (maxAdd-minAdd)×(1-frac)`
  et durée analogue (`frac = elapsed/timeLimit`), passage en AIMING ; faux →
  vitesse ÷ 2, boost annulé, cooldown, éventuelle chute. Dans tous les cas :
  **ralenti maintenu 1 s** (`slowmoHold`) puis retour normal (`onSlowmoEnd`).
- **Choix du cap (AIMING)** : la flèche suit la souris (survol) ; clic/tap =
  `confirmAim` → waypoint + boost appliqués ; cooldown 1 s.
- **Checkpoints** : bouées virées dans l'ordre (distance < rayon).
- **ARRIVÉE = grand rectangle invisible** couvrant toute la ligne
  (`finishZone` : `halfLen 280` le long de la ligne, `halfDepth 90`) : y **entrer**
  n'importe où déclenche la victoire ; filet de sécurité = intersection du segment
  prev→cur avec la ligne. Ligne dessinée en **damier « ARRIVÉE »** quand toutes
  les bouées sont virées.
- **Classement** temps réel (finis d'abord, puis progression = index bouée −
  distance restante).
- **Rendu Canvas** (caméra centrée sur le joueur, zoom `clamp(w/1500,0.35,0.9)`) :
  eau (dégradé + houle animée), zones de courant (arcs animés), particules de
  vent, ligne de départ/arrivée, bouées (prochaine surlignée + label + anneau
  pulsant), sillages (écume), bateaux (coque catamaran bicolore + aile/voile +
  gîte + spray de foils + halo joueur + pastille de rang), flèche d'objectif
  **près du bateau** (sur le cercle directionnel), minimap (coin haut-droit).
- **Ralenti visuel** : classe CSS `slowmo` sur le canvas (grisé) + onde grise
  émanant du bouton Manœuvrer.
- Callbacks vers l'UI : `onHud, onQuestionShow, onQuestionTick, onQuestionResult,
  onAimStart, onManeuverEnd, onSlowmoEnd, onCountdown, onFeedback, onFinish`.

---

## 9. Banques de questions (data/questionBank.js)

- **ProceduralMathBank** (tutoriel) : additions/soustractions d'entiers ≤ 10,
  QCM 4 choix (distracteurs ±1/±10…), `getNextQuestion(difficulty)`.
- **VraiFauxBank** (courses) : cantonnée à un chapitre Leyton. Pool = 30 vraies +
  30 fausses, mélangé ; `getNextQuestion()` → `{ type:'vraifaux', prompt (affirmation),
  choices:['Vrai','Faux'], correctIndex (0 si vraie, 1 si fausse), timeLimit: 8 }`.
- `getBank(key)` : `'math-proc'` → math ; sinon id de chapitre → VraiFaux (cache).
- Le moteur choisit : `tutoriel ? math : getBank(course.chapter)`.
- `mdLoader.js` : format `.md` documenté + parseur pour banques externes futures.

---

## 10. Données

### 10.1 Produits (data/leyton.js)
`LEYTON_CHAPTERS` = 8 objets `{ id, short, title, intro[5], vrai[30], faux[30] }`.
Contenu **verbatim** issu du document interne Leyton « 8 produits — Vrai ou Faux ».
Ordre (= ordre de campagne) et identifiants :

| # | id | short | Produit |
|---|---|---|---|
| 1 | `cir` | CIR | Le Crédit d'Impôt Recherche (CIR) |
| 2 | `ipbox` | IP Box | L'IP Box (fiscalité de la propriété intellectuelle) |
| 3 | `aides` | Aides & subventions | Aides et subventions (nationales, régionales, européennes) |
| 4 | `bpo` | BPO — IJSS | BPO — Recouvrement des IJSS et gestion externalisée de l'absence |
| 5 | `payroll` | Payroll | Payroll — charges sociales & exonérations (Fillon / RGDU) |
| 6 | `taxes-locales` | Taxes locales | TLPE, TFPB, CFE, CVAE, TASCOM… |
| 7 | `taxes-nationales` | Taxes nationales | C3S, TVA, taxes sectorielles |
| 8 | `energie` | Fiscalité énergie | Fiscalité de l'énergie (accises) |

`getChapter(id)`. La fiche mémo affiche `intro` (présentation) + les deux listes.

### 10.2 Parcours (data/courses.js)
`COURSES` = 8 objets, **dans l'ordre des chapitres**, chacun :
`{ id (slug ville), name, country, chapter (id produit), tagline, intro (réplique
présentateur), geo{lat,lon}, wind{dir,strength}, start{x,y,angle}, marks[], currents[] }`.

Mapping ville ↔ produit : Saint-Tropez→CIR, Marseille→IP Box, Cadix→Aides,
Sydney→BPO, Dubaï→Payroll, San Francisco→Taxes locales, Auckland→Taxes nationales,
Singapour→Énergie. `geo` réel (lat/lon) → projection équirectangulaire pour la
carte (`geoToMap`). Déblocage progressif (gagner la course précédente).

### 10.3 Joueur & adversaires (data/courses.js)
- **Joueur** : `PLAYER = { name:'Vous', color:'#8FB6F2' (bleu pastel) }`, toujours
  index 0.
- **Vivier** `OPPONENT_POOL` (18 alias marins anonymisés, couleurs pastel
  distinctes). Chaque course tire 4 concurrents au hasard (`pickOpponents(4)`,
  `buildGrid(4)`). Le présentateur **Clém Oussaillon** figure aussi dans le vivier
  (il peut donc courir « contre lui-même »). Liste :

  Dav' Larguevent, Nessie Duloch, Pierrot Deshoules, Sab' Ladérive, Ben Wadecoco,
  Céci Bellécume, Lindouche Froide, Clém Oussaillon, Thib' Alizé, JuL Delavague,
  Vaïana Durécif, PA Tribord, Mari Desabysses, Kim Ducorail, Yoshi Vespa,
  Damn Duressac, Fair' Dumistral, Jess Lafourmi.

---

## 11. Écrans (ui/screens.js, hud.js, qcm.js, raceIntro.js)

- **Menu** : titre « X-SAIL QUIZ » + sous-titre, fond animé (voiliers pastel),
  boutons Campagne / Tutoriel / Réglages / **📲 Installer le jeu** / Crédits.
- **Carte du monde** : continents dessinés (worldmap.js) + graticule + reflets
  animés ; pins aux vraies positions géographiques (anti-chevauchement), chaque
  pin indique **le produit** (n° + nom) ; carte au survol (produit, statut,
  trophées x/5, meilleur temps).
- **Pré-course** : aperçu du parcours (canvas), **bannière produit** + bouton
  **📖 Fiche mémo** (présentation pédagogique **enrichie d'emojis pertinents** +
  les 30 affirmations vraies (✓) et 30 fausses (✗) pour réviser), infos (bouées,
  vent, 4 adversaires au hasard), **curseur de difficulté discret (5 crans)**,
  trophées, bouton « Prendre le départ ».
- **Intro présentateur** (raceIntro.js) : carte « Clém Oussaillon » + réplique
  du parcours (ton professionnel) ; « 🏁 C'est parti ! » lance le top départ.
- **En course (HUD)** : télémétrie (position, temps, bouée, vitesse en nœuds,
  vent), bouton **Manœuvrer** (anneau de cooldown), **panneau question** :
  - QCM math : énoncé « a ± b = ? », 4 boutons (touches 1-4).
  - Vrai/Faux : **affirmation en graisse normale**, boutons **Vrai** (vert) /
    **Faux** (rouge) (touches V/F), barre de chrono. Répondu → le panneau devient
    non cliquable (bas de l'écran libéré pour choisir le cap) et disparaît vite si
    correct.
  - Toasts de feedback (BOOST, bouée, chute, foils, arrivée), séquence de départ,
    pause (Reprendre / Recommencer / Quitter), ralenti grisé + onde.
- **Podium / résultats** (refonte « broadcast », tient sans défilement) :
  bandeau parcours, titre VICTOIRE/défaite, **vedette : le TEMPS** (grand chiffre
  doré « Votre temps » + badges Record / Trophée difficulté / Position), podium
  top-3 (médailles + temps), classement complet + statistiques, trophées du
  parcours (x/5, celui gagné animé), **sélecteur de difficulté pour Rejouer**,
  actions Rejouer / Course suivante / Carte. Confettis dimensionnés à l'écran si
  victoire.
- **Tutoriel** : mini-course guidée (6 étapes) sur le calcul mental. Le top départ
  attend le 1er dialogue ; après le dernier, le joueur peut **finir la course** ;
  bouton **« ✕ Quitter le tutoriel »** en haut à gauche.
- **Réglages** : volumes musique/effets, réinitialisation (avec confirmation).
- **Crédits** : X-Sail Quiz, créateur Clém Oussaillon, contenu Leyton, audio CC0.

---

## 12. Audio procédural (audio/audio.js)

Web Audio : master → gains musique / effets / vent. **2 musiques** (menu calme,
course rythmée) via petit séquenceur (accords/arpèges/percussions synthétisés).
**Ambiance vent** (bruit filtré, intensité ∝ vitesse). **Bruitages** (oscillateurs
+ bruit) : clic/hover UI, ouverture question, bonne/mauvaise réponse, tic-tac,
boost, passage bouée, chute, redécollage foils, bips de compte à rebours, GO,
franchissement d'arrivée, fanfare victoire/défaite, déblocage. Volumes persistés.
Aucun fichier binaire — licence CC0.

---

## 13. Sauvegarde (save/save.js) — schéma v3

```
{ version: 3,
  tutorialSeen: bool,
  settings: { musicVolume, sfxVolume, lastDifficulty (float 0..1) },
  courses: { [courseId]: { won: bool, bestTimes: [ms×5 triés], trophies: [bool×5] } } }
```
- **5 trophées par course** (un par difficulté) : gagner à un cran remplit son
  trophée. `recordResult(courseId, won, timeMs, diffIndex)` → `{isRecord, bestTimes,
  trophies, newTrophy}`. Migration v1→v2→v3 (ajout `lastDifficulty`, puis `trophies`).
- Réinitialisation dans les Réglages.

---

## 14. Hors-ligne & installation (PWA)

- `manifest.webmanifest` : `name "X-Sail Quiz — Course à la voile"`,
  `short_name "X-Sail Quiz"`, `display standalone`, `background_color #052033`,
  `theme_color #062a45`, icônes 192/512/512-maskable.
- `sw.js` : **cache-first** avec repli réseau ; précache de tous les fichiers
  listés (`ASSETS`) ; bump de la constante `CACHE` (`regatta-quiz-vN`) à chaque
  changement pour invalider le cache. Chemins **relatifs** (fonctionne à la racine
  comme sous `/jeu-de-voile/`).
- `pwa.js` : enregistre le SW ; capture `beforeinstallprompt` ; bouton
  « Installer le jeu » (invite native PC/Android, sinon instructions iOS Safari).

---

## 15. Déploiement (GitHub Pages)

Site statique à la racine + `.nojekyll`. Deux voies :
1. **Deploy from a branch** : Settings → Pages → source = branche + dossier `/root`.
2. **GitHub Actions** : workflow `.github/workflows/pages.yml`
   (`upload-pages-artifact` + `deploy-pages`), source = « GitHub Actions ».

---

## 16. Checklist de reproduction

1. Recréer l'arborescence (§3) et les fichiers.
2. Reprendre **`src/data/leyton.js`** (8×60 affirmations) et **`src/data/courses.js`**
   (géométrie parcours + vivier) verbatim.
3. Reprendre les **constantes** de `balance.js` (§5) et le **modèle physique** (§6).
4. Implémenter moteur (§8), IA (§7), banques (§9), écrans (§11), audio (§12),
   sauvegarde (§13), PWA (§14).
5. Externaliser **toutes** les chaînes dans `i18n/strings.js`.
6. Servir en HTTP et vérifier : menu → tutoriel (calcul) → carte (8 produits) →
   fiche mémo → course Vrai/Faux (8 s, ralenti) → arrivée (rectangle) → podium
   (temps mis en avant, trophée) → progression persistée. 60 fps sur la course.

---

*Document de reproduction — X-Sail Quiz. Contenu Leyton confidentiel, usage interne.*
