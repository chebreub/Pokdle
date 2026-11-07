# DISC-01 — Carte « À découvrir aujourd'hui » : protocole

**Objet :** faire essayer un jeu secondaire sans refaire l'accueil ni déplacer les jeux habituels (maquette validée par Kayan le 07/11).

## Règles
- **Une seule carte**, dans la section des mini-jeux de l'accueil, sous l'étagère et les liens « Découvrir les jeux ». Rien d'autre ne bouge.
- **Un jeu par jour de Paris**, pris dans une liste fixe de 14 jeux qui ne sont pas sur l'étagère par défaut de l'accueil. Les jeux récents (« Récents ») et les jeux absents du catalogue sont écartés.
- Les jeux **jamais joués** dans ce navigateur passent d'abord, avec l'étiquette « Jamais joué ». Un jeu compte comme joué s'il a été ouvert depuis la carte ou s'il est dans l'historique des parties. Quand tout a été joué, la carte continue de tourner, sans l'étiquette.
- « **+1 Ball** » seulement pour un jeu vérifié par le serveur dont la Ball du jour n'est pas encore gagnée, avec la même règle que les tuiles.
- « **Essayer →** » ouvre le jeu. « **Pas aujourd'hui** » cache la carte jusqu'au lendemain (clé locale `pokedle_disc_hide_v1`).
- **Rien n'est envoyé au serveur.** L'ouverture du jeu reste comptée par les compteurs existants (`solo:<mode>`). Seules deux clés locales sont ajoutées (`pokedle_disc_opened_v1`, `pokedle_disc_hide_v1`), et aucune autre donnée n'est effacée.

## Contrôles
- `App/test/disc01-discovery-card.test.js` :
  - un choix stable dans la journée, qui change le lendemain ;
  - les jeux jamais joués d'abord ;
  - jamais un jeu de l'étagère, un jeu récent ou un jeu absent du catalogue ;
  - « Pas aujourd'hui » vaut pour le jour seulement ;
  - aucun appel réseau.
- Chromium à 320, 390 et 1366 px, sans défilement horizontal :
  - « Essayer » ouvre le jeu et le marque ;
  - au retour, la carte propose le jeu suivant jamais joué ;
  - « Pas aujourd'hui » cache la carte, même après rechargement.
- **Aucune recette sur iPhone physique revendiquée.**
