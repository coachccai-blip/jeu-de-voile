# Audio

En v1, **toute la musique et tous les bruitages sont générés en temps réel**
via la Web Audio API (voir `src/audio/audio.js` et `src/audio/manifest.js`).

- **Aucun fichier binaire** n'est requis → le jeu fonctionne hors ligne et le
  dépôt reste léger.
- **Licence : CC0 / domaine public** — les sons étant synthétisés à la volée
  (oscillateurs + bruit), il n'y a aucun échantillon externe soumis à droits.

## Ajouter/remplacer une piste par un fichier réel

1. Déposez le fichier (`.ogg`/`.mp3`) dans ce dossier.
2. Ajoutez une entrée dans `MUSIC_MANIFEST` (`src/audio/manifest.js`) :
   `{ id: 'race', type: 'file', src: 'assets/audio/ma-piste.ogg', license: '...' }`
3. Documentez sa licence ici même.

Le reste du jeu ne référence les pistes que par leur `id`.
