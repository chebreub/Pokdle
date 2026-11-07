# DISC-02 — Missions plus variées : protocole

**Objet :** varier les quêtes du jour existantes, **sans nouveaux gains** ni liste quotidienne obligatoire.

## Avant
Il y avait 10 quêtes, dont 3 sur le Draft / Score Attack. Deux quêtes Score Attack pouvaient tomber le même jour, et beaucoup de jeux n'avaient jamais de quête.

## Après
- **13 quêtes « Termine une partie de … »** pour des jeux qui enregistrent déjà leurs parties terminées (journal des parties) : Pixelisé, Cri, Description, Zoom progressif, Stat mystère, Évolution, Ordre Pokédex, Quiz, Intrus, Duel de poids, Shiny ou normal, Qui est-ce ?, Petit Bac.
  - Elles sont comptées à la fin d'une partie, gagnée ou perdue, une seule fois, par le même chemin que « Joue à 3 modes différents ».
- **Les gains ne bougent pas** : 50 XP pour les nouvelles quêtes, soit le montant de « Termine un draft d'équipe ». Toutes les quêtes restent entre 30 et 150 XP, et la moyenne du tirage baisse un peu.
- **4 quêtes par jour**, toujours facultatives et identiques pour tout le monde, avec deux règles :
  - **une seule quête par famille de jeux** (plus jamais deux Score Attack, ni deux jeux de devinette) ;
  - **aucune quête de la veille**. Les jours sont tirés dans l'ordre depuis le 07/11/2026 : le résultat est exact et le même sur tous les appareils.
- Les quêtes déjà tirées pour aujourd'hui sont gardées. Seul un nouveau jour fait un nouveau tirage. Aucune donnée serveur n'est touchée.

## Contrôles
- `App/test/disc02-quest-variety.test.js` :
  - les gains restent dans l'ancienne fourchette ;
  - sur 120 jours, 4 quêtes par jour, stables, une par famille, aucune de la veille ;
  - presque toutes les quêtes sortent ;
  - jamais deux quêtes Draft sur 365 jours ;
  - une partie finie valide sa quête une seule fois et compte aussi pour « 3 modes ».
- `App/test/daily-quests-wired.test.js` : chaque quête est comptée quelque part. Les quêtes « Termine… » visent un jeu du journal des parties.
- `npm test` avec PostgreSQL local : 1009/1009. Fenêtre des quêtes contrôlée dans Chromium (iPhone 13 émulé). **Aucune recette sur iPhone physique revendiquée.**
