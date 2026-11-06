# ECO-08 — Conservation temporaire d'une rencontre légendaire : étude préalable

**Base vérifiée :** `main` `2e67dfee51984b9059b7d4934d054f9c4f5b5f2c` du 06/11/2026. **Statut : étude hors production, aucune durée ni activation approuvée.**

## Règle réelle et points de rupture

Dans `App/lib/poke-balls.js` :
- `wild_encounters` conserve déjà un identifiant, l'identité, le `kind` (`wild`, `legend`, `prestige`), le Pokémon, le shiny, le nombre de lancers et leur consommation, `created_at`, `status` et `ended_at`.
- `wildState` transforme **toute rencontre `open` d'un autre jour** en `fled` ; `day` et `dailyCalendar(clock()).day` sont au calendrier Europe/Paris. Le passage de minuit supprime la reprise même si aucun lancer n'a été tenté.
- `throwBall` ne cible que `status='open' AND day=jour_courant` ; prolonger `wildState` ne suffirait pas : **le lancer deviendrait impossible le lendemain**.
- `skipEncounter` filtre lui aussi `day=jour_courant` : cette opération devra être cohérente pour une rencontre conservée.
- `meetLegend` autorise **une seule rencontre par semaine de l'expédition** ; toute rencontre ouverte existante interdit une nouvelle ouverture. `meetPrestige` est séparé, avec sa quête et son cooldown propres.
- `wildState` renvoie le même `encounterView` pour une rencontre encore ouverte. Les chances et les tirages sont calculés côté serveur. Aucun nouveau tirage ne doit avoir lieu à la reprise.
- Le client réaffiche déjà la rencontre retournée par `/api/balls` ; il faudra tester sa visibilité après changement de jour, fermeture de l'onglet, reconnexion et autre appareil. La continuité côté navigateur **n'est pas prouvée** par les tests de calcul d'expiration ci-dessous.

**Périmètre choisi pour cette étude :** `kind='legend'` seulement. **Drattak** et les rencontres ordinaires sont exclus ; ECO-02 et ECO-07 doivent rester autonomes. Une extension à Drattak serait un arbitrage séparé.

## Quatre politiques étudiées

| Politique | Durée depuis l'ouverture | Passage au lundi / nouvelle expédition | Statut |
| --- | --- | --- | --- |
| **A — actuelle** | Jusqu'au prochain minuit heure de Paris | Toujours expirée | Règle en vigueur |
| **B — 48 h glissantes** | 48 heures réelles | Peut traverser le lundi | Simple alternative |
| **C — 72 h glissantes** | 72 heures réelles | **Peut traverser le lundi** | Proposition 72 h à arbitrer |
| **D — 72 h plafonnées à la semaine** | Min(72 h, prochain lundi 00:00 Paris) | Expiration au lundi | Variante plus stricte |

Le script `App/tools/study-special-encounter-window.js` utilise uniquement des exemples de dates, une fonction d'expiration pure et le `createdAt` existant, **sans lecture ou modification de base**. Le modèle **ne teste pas l'intégration PostgreSQL**, les risques de concurrence ni les achats ; il ne présente aucune donnée d'utilisation réelle.

## Comparaison chiffrée sur des ouvertures fictives (Europe/Paris)

| Ouverture | A · actuel | B · 48 h | C · 72 h | D · plafond semaine |
| --- | ---: | ---: | ---: | ---: |
| Lundi 09 h | 15 h | 48 h | **72 h** | 72 h |
| Vendredi 22 h | 2 h | 48 h | **72 h** | 50 h |
| Dimanche 21 h | 3 h | 48 h | **72 h** | **3 h** |
| Dimanche 25/10/2026 à 02 h 30, avant recul de l'horloge | 22,5 h | 48 h | **72 h** | 22,5 h |
| Dimanche 28/03/2027 à 01 h 30, avant avance de l'horloge | 21,5 h | 48 h | **72 h** | 21,5 h |

Une ouverture le dimanche 08/11/2026 à 21 h (Paris) expirerait **mercredi 11/11 à 21 h** sous C, contre **lundi 09/11 à 00 h** sous A et D.

**Interprétation :** D favorise une frontière hebdomadaire simple, mais n'améliore pratiquement rien pour un joueur qui débloque le légendaire le dimanche soir. C répond mieux à la promesse « 72 heures » tout en conservant une seule rencontre issue de la semaine précédente. B réduit l'attente potentielle sans résoudre l'inégalité des ouvertures tardives.

## Effets attendus et contraintes

- **Rareté et shiny :** conserver une rencontre ne produit aucun Pokémon supplémentaire, aucun nouveau tirage shiny, aucune Ball et aucun Pokédollar. Le Pokémon, le booléen shiny, les lancers déjà utilisés et les chances restent ceux de **l'unique ligne de rencontre**. Une disponibilité plus longue pourrait **augmenter la proportion réelle de joueurs qui lancent leurs Balls**, mais ce résultat ne peut pas être chiffré sans données d'usage.
- **Lancers et économie :** toujours trois lancers **au total**, non renouvelés à minuit. Seules les Balls lancées sont débitées. Pas de stock offert ou de renouvellement en cas de fermeture.
- **Semaines consécutives :** avec C, la rencontre de la semaine précédente peut traverser le lundi. Tant qu'elle est ouverte, elle doit **bloquer toute nouvelle rencontre** et rester celle du joueur ; après capture, fuite ou expiration, les conditions de la nouvelle expédition sont vérifiées normalement, avec **une seule rencontre par semaine**. Cela doit être décidé explicitement, surtout si une ancienne rencontre est conservée après le dimanche.
- **Cohérence serveur :** toutes les méthodes `wildState`, `throwBall`, `skipEncounter`, `encounter`, `meetLegend` et `meetPrestige` doivent vérifier l'expiration dans la même transaction ; les requêtes de lancer ne doivent pas exiger `day=today` pour une rencontre légendaire encore valide. Les rencontres `wild` et `prestige` doivent continuer à expirer à minuit sans exception.
- **Autorité, race conditions et replays :** ne pas créer une seconde ligne ou une rencontre à chaque rafraîchissement ; préserver l'identité serveur et les reçus de lancers, vérifier un seul open par joueur même après le changement de semaine, et rejeter les doubles requêtes / tentatives expirées côté serveur.
- **Sécurité de déploiement :** une règle rétroactive calculée uniquement sur `created_at` pourrait faire **revivre une rencontre ancienne déjà fugitive** si le code est erroné. Recommandation d'implémentation future : `expires_at TIMESTAMPTZ` **nullable et non destructif**, attribué **seulement aux nouvelles rencontres légendaires** après validation. Les anciennes lignes `expires_at IS NULL` gardent la règle actuelle. Aucun statut `fled` ou `caught` ne doit redevenir `open`.
- **Interface / multi-appareils :** afficher la date et l'heure d'expiration Europe/Paris dans la rencontre, permettre sa reprise depuis le sac, gérer la déconnexion/reconnexion, l'absence de connexion et un délai dépassé pendant un écran ouvert.
- **ECO-02 Drattak :** aucune ouverture supplémentaire ni fenêtre 72 h ajoutée ; le cooldown 21 jours et le weekend de G restent inchangés.

## Recommandation à arbitrer

**C — 72 heures réelles glissantes**, **exclusivement pour les nouvelles rencontres légendaires hebdomadaires**, semble répondre le mieux à l'objectif initial de conservation : durée compréhensible et identique quel que soit le jour d'ouverture. La rencontre peut traverser le lundi **mais reste unique, et bloque une deuxième rencontre tant qu'elle est ouverte**. La durée exacte, l'exclusion de Drattak, la gestion du lundi et la date d'entrée en vigueur **nécessitent un accord explicite avant une PR de gameplay**.

**Choix alternatifs :** A pour conserver la rareté et les règles actuelles ; B pour une fenêtre de 48 h ; D si aucune rencontre ne doit survivre à la rotation du lundi, au prix d'une expérience inéquitable le dimanche.

## Vérifications reproductibles (hors production)

```sh
node App/tools/study-special-encounter-window.js
node App/tools/study-special-encounter-window.js --json
cd App && node --test test/eco08-hold-window.test.js
```

**Cinq tests ciblés** : passage de minuit Europe/Paris, passage à l'heure d'hiver et d'été, changement d'expédition le lundi, reprise exacte de l'identifiant/Pokémon/shiny/lancers, et aucune nouvelle tentative après expiration. Le simulateur est **autonome, sans dépendance aux règles de capture et sans aucun effet de bord**. Les tests d'intégration transactionnelle PostgreSQL, navigateur et sur appareil physique **restent à écrire après accord sur les règles**.

**Suivi des 43 actions :** ECO-08 ne peut pas être déclarée terminée sur la seule base de cette étude. Les PR #301 (ECO-02) et #302 (ECO-07) sont des chantiers distincts ; ne pas les compter clôturés avant fusion et vérification de la CI.
