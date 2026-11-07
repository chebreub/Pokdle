# DATA-01 — Dictionnaire des mesures et couverture observée

**État vérifié :** code de `main` au 5 novembre 2026. **Objet :** interpréter les compteurs déjà présents sans leur attribuer une précision ou un historique qu'ils n'ont pas. Aucun nouvel événement, identifiant, suivi individuel ni migration de données n'est demandé par DATA-01.

## Unité réelle de chaque indicateur

| Famille / clés techniques | Quand le code compte | Grain réel | Ce qu'il ne faut **pas** déduire |
| --- | --- | --- | --- |
| **« Sessions » — `visit`** | Le navigateur envoie `trackUsage("visit")` au chargement initial si `pokedle_visit_v1` n'est pas encore marqué dans son `sessionStorage`. | **Signalement de session navigateur** (onglets distincts ou restauration possibles), reçu et agrégé par jour UTC ; pas une personne. | Pas une session de jeu prouvée, un compte, un utilisateur unique ou une visite brute HTTP. |
| **« Navigateurs distincts estimés » — `usage_unique_daily`** | L'événement `visit` reçu avec l'identifiant navigateur local met un bit dans un tableau agrégé journalier, différent chaque jour. | **Estimation par navigateur et par jour UTC**, avec collisions possibles dans le bitmap. | Pas des personnes uniques sur 7/30 jours ; ne jamais sommer les uniques quotidiens en utilisateurs uniques de période. |
| **« Chargements bruts » — `visits`** | Le serveur appelle `recordVisitDb()` lorsqu'il sert `/` ou `/index.html`. | **Requêtes d'accès à la page**, y compris robots/aperçus/pings possibles, selon la base serveur. | Pas le nombre de sessions navigateur, de personnes ni de parties lancées. |
| **« Ouvertures de modes » — `solo:<mode>`** | Les points d'entrée de chaque mode client émettent un `trackUsage` ; couverture **inégale** selon les modes et variantes. | **Signalements d'entrée/ouverture**, parfois sans démarrage effectif. Un rejouement peut ne pas générer de nouvelle ouverture. | Pas des parties commencées distinctes, des manches, des victoires ni des joueurs uniques. |
| **« Fins suivies / victoires / sans victoire » — `complete:<mode>:win\|loss`** | `recordMatchHistory` émet un signalement pour une entrée dont le résultat est `win` ou `loss`, si le mode est dans la liste autorisée. | **Résultats / manches déclarés par le navigateur**, sans identifiant de partie ni vérification serveur de ce résultat dans cette table. | Pas un taux de complétion, un funnel ouvertures → fins ou une défaite par ouverture. Un même lancement peut engendrer plusieurs manches et fins. Les abandons non finalisés ne sont pas comptés. |
| **« Party — salles créées / entrées » — `party:create` et `party:join`** | Le serveur accepte la création ou l'entrée en salon. La reprise de connexion suit une route distincte. | **Actions de création et d'entrée**, pas individus. | Pas des joueurs actifs uniques, ni un taux de conversion calculable en divisant entrées par créations. |
| **« Party — modes lancés / manches » — `party:start:<mode>`** | Le serveur traite une commande de lancement du mode du salon. | **Commandes de lancement comptabilisées côté serveur** ; pas un événement par participant. Certains enchaînements automatiques peuvent ne pas passer par cette commande. | Pas nécessairement chaque manche réellement terminée ni une victoire, et pas un nombre de joueurs. |
| **« Duel/Stat Clash — salons créés » — `duel:create`, `statclash:create`** | Création d'un salon reçue par le serveur. | **Salons créés**. | Pas des matchs effectivement joués ou des participants uniques. |
| **« Partages / arrivées défi » — `share:daily`, `share:visit`** | Signalement d'action de partage, respectivement chargement serveur d'une page avec un paramètre de défi valide. | **Actions/chargements**, dont le second ne certifie pas une partie lancée. | Pas un entonnoir partage → visite → partie ni une attribution de conversion à un utilisateur. |
| **« Retour des joueurs »** | Cohortes spécifiques au **Pokémon du jour** via `lib/daily-retention.js`, sur 14 jours UTC complets indépendants du filtre d'affichage. | **Cohortes Daily** avec maturité J+1/J+7 propre à ce jeu. | Pas une rétention J1/J7 de tous les visiteurs ou de tous les modes. |

**Différence fondamentale :** à ce jour, le système de compteurs agrégés ne possède pas d'événements exhaustifs et appariés « partie commencée », « manche commencée », « abandon », « partie terminée » pour **chaque mode**, avec identifiant de tentative. Il n'est donc pas possible de reconstruire un funnel fiable ni de calculer un taux d'abandon global. En mode solo, `solo:<mode>` est un signalement d'entrée et `complete:...` un résultat enregistré, **pas** deux étapes liées d'une même tentative. Pour Higher or Lower, le suivi des ouvertures de la variante 60 secondes a été séparé des modes classiques après le début de l'instrumentation : les périodes antérieures ne sont pas homogènes.

## Calendrier, disponibilité et date de début

- Les compteurs de fréquentation `usage_event_daily(day,event,hits)` sont **agrégés par jour UTC** et conservés **au plus 90 jours**, après purge au démarrage et quotidiennement. Les diagnostics en mémoire (`usageDays`) sont distincts : **14 jours maximum, perdus au redémarrage**. `usage_unique_daily` garde un bitmap agrégé journalier pendant la même durée de rétention.
- Dans Admin Stats, « 1 jour » et « 3 jours » comprennent **le jour UTC en cours**, nécessairement partiel ; « 7, 14, 30 et 90 jours » portent sur des **jours UTC clos hier**. Les journaux économiques utilisent, eux, le **jour de jeu Europe/Paris** ; ils ne doivent pas être joints naïvement aux jours de trafic UTC.
- **Date exacte de mise en service de chaque événement : non établie par le code ni par les documents actuels.** Certaines ouvertures ont été instrumentées progressivement (Wordle, Dossier, Grille, entraînement, Higher or Lower 60 s). Un SHA Git, la date du présent document ou les chiffres observés du 22/10 au 04/11 ne prouvent **pas** leur date effective de déploiement sur Render.
- La **première date encore observée** est consultable, **sans lire de données personnelles**, avec la requête agrégée ci-dessous. Elle est différente de la vraie date de début du suivi : aucune observation un jour donné ne peut vouloir dire absence de trafic, compteur non déployé, signalement perdu ou donnée purgée. Ne pas remplacer une date inconnue par la première valeur disponible ni afficher `0` à la place de `indisponible`.

```sql
-- Lecture seule, à exécuter uniquement sur une connexion autorisée.
-- Limité aux agrégats conservés (90 jours maximum), sans table utilisateur.
SELECT event,
       MIN(day) AS premier_jour_encore_observe,
       MAX(day) AS dernier_jour_observe,
       SUM(hits) AS signalements_encore_conserves
FROM usage_event_daily
GROUP BY event
ORDER BY event;
```

Si l'on veut dater **le vrai démarrage en production** d'un événement, il faut confronter les journaux de déploiement Render, l'historique des releases et les premières observations agrégées. **Ce rapprochement n'a pas été effectué** ; les dates restent « non confirmées » et aucun historique n'est reconstitué.

## Contrôles / sources vérifiables

- `App/src/script.01.core.js` : `trackUsage()`, `sessionStorage.pokedle_visit_v1` et UUID local ; les résultats `complete:` sont émis **sans** identifiant navigateur.
- `App/src/script.07.delegation-party.js` : `recordMatchHistory()` émet un résultat uniquement pour `win` / `loss`, hors Party Room.
- `App/server.js` : `sendIndex()` → `visits`, liste blanche `USAGE_EVENTS`, `recordUsage()`, `/api/track`, événements `party:create`, `party:join` et `party:start:`.
- `App/lib/usage-metrics.js` : catalogue, correspondance des fins, stockage `usage_event_daily` / `usage_unique_daily`, calendrier et purge 90 jours, agrégation des ouvertures et résultats.
- `App/lib/admin-stats-dashboard.js` : dénominateurs, libellés, périodes et messages d'indisponibilité. `docs/usage-metrics.md` explique la distinction UTC/Europe-Paris.
- `App/test/usage-metrics.test.js` et `App/test/usage-client.test.js` : tests existants sur les modes, la séparation des fins, l'anonymisation et la conservation.

**Décision DATA-01 :** conserver les règles de calcul existantes, documenter les unités et dates connues / inconnues, puis traiter séparément **DATA-02** (séparer les tests/admin de l'activité de joueurs réelle sans supprimer les journaux). Toute mesure nouvelle des abandons ou des funnels doit faire l'objet d'un chantier ultérieur, avec validation de la vie privée et de l'autorité serveur ; pas d'inférence rétroactive.

## DATA-03 — trois étapes d'un lien partagé (7 novembre 2026)

Trois compteurs **indépendants** par lien partagé, agrégés par jour UTC comme les autres, sans identifiant ni empreinte. Ce n'est **pas** un entonnoir par personne : un partage peut être ouvert plusieurs fois, et un lien ouvert ne lance pas toujours une partie.

| Lien | 1. Partage (navigateur) | 2. Lien ouvert (serveur) | 3. Partie lancée (serveur) |
| --- | --- | --- | --- |
| Pokémon du jour `?defi=N-K` | `share:daily` : bouton Partager du résultat (texte prêt, pas forcément envoyé) | `share:visit` : page servie avec un défi valide, **navigateur d'une personne** | `share:daily-start` : **1er essai accepté** par le serveur pour la partie du jour, dans un onglet arrivé par le lien le même jour |
| Invitation Party `?party=CODE` | `share:party` : « Copier l'invitation » | `share:party-visit` : page servie avec un code de salon au bon format, navigateur d'une personne | `share:party-start` : **1er lancement** d'un salon où un joueur connecté est entré avec le code du lien ; **une fois par salon** |

- **`share:preview`** : les robots d'aperçu des messageries (WhatsApp, Discord, Telegram, Slack, Facebook, Twitter…) et les agents sans user-agent ou headless qui chargent un lien `?defi=` ou `?party=`. Avant DATA-03, ces chargements étaient comptés dans `share:visit` : **les périodes antérieures ne sont pas comparables** et ne sont pas reconstituées.
- **Autorité serveur** : l'étape 3 n'est comptée qu'après une action acceptée par le serveur (essai enregistré, salon lancé). L'**origine** (« venu du lien ») est déclarée par le navigateur (`arrival: "defi"` dans l'essai, `via: "link"` dans l'entrée en salon) : c'est une indication, pas une preuve. Les essais rejoués, les abandons et les relances d'un même salon ne recomptent jamais.
- **Hors périmètre** : les défis entre amis (`/api/challenges`) ne passent pas par un lien externe ; l'ancien « Défi ami » `?defi=<code>` (Pokémon choisi) n'est pas un défi du jour et n'est pas compté.
- **Sources** : `App/server.js` (`sendIndex`, `party:join-room`, `party:start`, `USAGE_EVENTS`), `App/lib/usage-metrics.js` (`isLinkPreviewAgent`), `App/lib/daily-game.js` (`firstGuess`, `onSharedStart`), `App/lib/admin-stats-dashboard.js` (tableau « Partage et découverte »), `App/test/data03-share-steps.test.js`.

### PART-03 — carte de capture partagée (7 novembre 2026)

| Lien | 1. Partage (navigateur) | 2. Lien ouvert (serveur) | 3. Partie lancée |
| --- | --- | --- | --- |
| Capture `/pokemon/<nom>?via=capture` | `share:capture` : partage natif **terminé** (annulation non comptée) ou lien **copié**, une fois par capture ; « Enregistrer l'image » seul ne compte pas | `share:capture-visit` : fiche publique servie avec `?via=capture` à un navigateur d'une personne (robots → `share:preview`, redirections non comptées) | non mesurée : le lien mène à une fiche Pokémon, pas à une partie |

- **Compteurs serveur protégés** : `share:visit`, `share:preview`, `share:daily-start`, `share:party-visit`, `share:party-start` et `share:capture-visit` ne sont plus acceptés par `POST /api/track` (`SERVER_ONLY_USAGE`) : seul le serveur les incrémente. Les étapes 1 (`share:daily`, `share:party`, `share:capture`) restent déclarées par le navigateur.
- Sources : `App/src/script.10xzs.capture-share.js`, `App/lib/seo-render.js` (`onCaptureVisit`), `App/server.js`, `App/test/part03-capture-share.test.js`.
