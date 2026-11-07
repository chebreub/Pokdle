# GEST-02 — Fermer une fenêtre par sa poignée : protocole

**Objet :** sur téléphone, fermer une fenêtre ou un panneau du bas en le tirant vers le bas, en gardant le bouton ✕. Maquette validée par Kayan le 07/11.

## Règles
- **Concerné** : la fenêtre générale du site (défis, échanges, partage, paramètres…), le panneau des Pokémon préférés et du tirage au hasard, et l'éditeur du Team Builder.
  - Les poignées de ces deux panneaux existaient déjà mais ne faisaient rien.
  - La fenêtre générale et l'éditeur gagnent une poignée.
- **Téléphone seulement** (≤ 640 px) et **au doigt** : la souris ne déclenche pas le geste, et il n'y a pas de poignée sur PC.
- Le geste ne part **que de la poignée ou du titre**. Le contenu, les boutons et les champs ne le déclenchent jamais, donc faire défiler une liste ne ferme rien.
- Lâchée au-delà de 22 % de la hauteur (90 px au moins), ou d'un geste rapide d'au moins 40 px, la fenêtre se ferme. Sinon elle remonte. « ⬇ Lâche pour fermer » s'affiche quand ça va fermer.
- La fermeture passe par la même fonction que le ✕ (`closeOverlayModal`, `closeRankingPicker`, `closeTeamEditor`).
- En « Animations réduites », la fenêtre se ferme sans effet. Rien n'est envoyé au serveur.

## Contrôles
- `App/test/gest02-sheet-drag.test.js` : seuils de fermeture ; zones du geste ; boutons et champs exclus ; téléphone seulement ; animations réduites respectées ; aucun appel réseau.
- Chromium (iPhone 13 émulé), avec de vrais gestes tactiles :
  - un petit tirage laisse la fenêtre ouverte et revient à sa place ;
  - glisser dans le contenu ne ferme rien ;
  - un grand tirage ferme, et la fenêtre se rouvre propre ;
  - le ✕ ferme toujours ;
  - le panneau des préférés se ferme par sa poignée.
- PC 1366 px : pas de poignée.
- `npm test` avec PostgreSQL local : 1017/1017. **Aucune recette sur iPhone physique revendiquée** : le geste est à confirmer sur un vrai téléphone.
