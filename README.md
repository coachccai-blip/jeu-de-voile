# ⛵ Regatta Quiz

Jeu de **course à la voile éducatif** inspiré de **SailGP** (catamarans F50 à foils),
en vue du dessus. Affrontez 4 bots sur un parcours à bouées : pour manœuvrer et
accélérer, répondez vite et juste à des questions de **calcul mental**. Stratégie
(vent, courants, trajectoires) + rapidité = sensation de vol sur foils.

> Prototype **v1** — HTML/CSS/JavaScript (ES modules), **Canvas 2D**, **zéro dépendance**,
> **100 % hors ligne**. Audio entièrement procédural (Web Audio API), libre de droits.

## 🎮 Jouer

- **En ligne** : voir la page GitHub Pages du dépôt (onglet *Deployments* /
  Settings → Pages). Rien à installer.
- **En local** : servez le dossier avec un serveur statique (les ES modules
  exigent `http://`, pas `file://`) :

  ```bash
  # au choix
  python3 -m http.server 8000
  # ou
  npx serve .
  ```

  Puis ouvrez <http://localhost:8000>.

### Commandes

| Action | Souris / Tactile | Clavier |
|---|---|---|
| Manœuvrer | Bouton rond en bas à droite | `Espace` |
| Répondre au QCM | Cliquer une réponse | `1`–`4` |
| Choisir le cap | Cliquer/glisser sur l'eau | — |
| Pause | Bouton `II` | `Échap` |

**Boucle de jeu** : *Manœuvrer* → question chronométrée → une bonne réponse rapide
donne un gros **boost** → choisissez votre nouveau **cap** sur l'eau. Une mauvaise
réponse : pas de boost, trajectoire conservée, et le cooldown de 3 s s'applique.
Enchaîner les échecs à basse vitesse fait **retomber le bateau dans l'eau**
(sortie de foils) : il faut « redécoller » avec de bonnes réponses.

## 🗺️ Contenu

- **Campagne** : 6 parcours (Saint-Tropez, Sydney, San Francisco, Dubaï, Auckland,
  Marseille), débloqués en gagnant le précédent, avec meilleurs temps locaux.
- **Tutoriel** guidé, **Réglages** (volumes, reset), **Crédits**.
- **Slider de difficulté** (Très facile → Extrême) modulant calculs, chrono et bots.

## 🏗️ Structure du code

```
index.html                 Point d'entrée (charge src/main.js)
styles/main.css            Toute l'UI (esthétique TV SailGP)
src/
  main.js                  Machine à états des écrans + lancement des courses
  config/balance.js        ⚙️ FICHIER D'ÉQUILIBRAGE CENTRALISÉ (toutes les valeurs)
  i18n/strings.js          Toutes les chaînes de texte (prêt i18n)
  save/save.js             localStorage + versioning de schéma + migration
  audio/
    audio.js               Moteur audio procédural (musique + bruitages)
    manifest.js            Manifeste des pistes (id → source)
  data/
    questionBank.js        Banque de questions découplée (getNextQuestion)
    mdLoader.js            Loader + spec du format .md (banques externes, futur)
    courses.js             Définition des parcours (tracés, vent, courants)
  game/
    engine.js              Moteur de course : simulation, rendu, manœuvre, classement
    entities.js            Le bateau (F50) : état + intégration physique
    physics.js             Modèle vent (près/portant) + courants
    ai.js                  IA des 4 bots (trajectoire valide + réponses simulées)
    mathutils.js           Helpers mathématiques
  ui/
    screens.js             Menu, carte, pré-course, podium, réglages, crédits, tutoriel
    hud.js                 HUD de course + départ + feedbacks (RaceView)
    qcm.js                 Panneau QCM chronométré
assets/audio/README.md     Note de licence audio + comment ajouter des pistes
```

**Séparation** moteur / UI / données / audio / sauvegarde respectée. Toutes les
valeurs de gameplay (vitesses, boosts, seuils, difficulté) sont centralisées dans
`src/config/balance.js` pour itérer sans toucher au moteur.

## 🔌 Extensibilité prévue (architecture v1, UI plus tard)

- **Banques de questions externes** en Markdown : format documenté et parseur
  fournis dans `src/data/mdLoader.js`. Une course pourra pointer vers sa propre
  banque (maths, conjugaison, géographie, anglais…) via une clé `bankKey`.
- **Nouvelles pistes audio** : déposer un fichier + une entrée de manifeste.
- **i18n** : ajouter une langue dans `src/i18n/strings.js`.

## 📦 Déploiement GitHub Pages

Un workflow (`.github/workflows/pages.yml`) publie automatiquement le site.
Deux façons d'activer Pages :

1. **GitHub Actions** *(recommandé)* : Settings → Pages → *Source : GitHub Actions*.
   Le workflow déploie à chaque push.
2. **Déploiement depuis une branche** : Settings → Pages → *Deploy from a branch*
   → choisir la branche et le dossier `/ (root)`. Le site étant statique à la
   racine, il fonctionne tel quel.

## 📄 Licence

Code sous licence MIT (voir `LICENSE`). Audio procédural CC0.
