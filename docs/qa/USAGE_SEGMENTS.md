# DATA-02 — Séparer essais, administrateurs et trafic non marqué

**Version prospective du 5 novembre 2026.** Ce changement ne supprime ni ne retraite `usage_event_daily`, `usage_unique_daily`, `visits` ou les journaux d'économie.

## Comment les événements sont classés

| Segment | Déclenchement | Fiabilité / limite |
| --- | --- | --- |
| `admin` | Le serveur valide le cookie de session et retrouve l'identifiant dans `ADMIN_ACCOUNT_IDS` | Rôle administrateur authentifié ; seuls les nouveaux événements sous session reconnue sont classés |
| `test` | Le navigateur déclare volontairement `usageTest: true` depuis un onglet marqué ; Socket.IO le signale dans `handshake.auth` | **Déclaration volontaire, non authentifiée** ; ne doit pas être utilisée comme preuve de trafic humain |
| `unmarked` | Aucun des deux critères précédents | Ne signifie **pas** « joueur réel » : robots, scripts et tests non marqués peuvent s'y trouver |
| **Non ventilable** | Total historique moins les segments disponibles de la période | Regroupe le passé avant la nouvelle instrumentation et toute mesure non classée, sans reconstitution impossible |

**Priorité :** `admin` prime sur `test`. La décision ne provient jamais d'un `admin: true` fourni par le client. Les événements de fin conservent l'absence d'UID, de compte, de réponse ou de Pokémon.

## Architecture / données

- Les valeurs anciennes de `usage_event_daily(day,event,hits)` restent les **totaux bruts**. Les KPI principaux ne sont pas filtrés.
- Une deuxième table `usage_event_segment_daily(day,event,segment,hits)` contient uniquement des **comptages journaliers**, sans identifiant de compte, navigateur, IP, secret ou action.
- Une seule instruction SQL avec CTE met à jour ensemble `usage_event_daily` et la table segmentée, pour éviter les écarts dus à un échec partiel.
- `usage_segment_metadata(name,started_at)` enregistre la date de mise en place côté base ; elle n'est pas la date de début de l'ensemble des compteurs historiques.
- La purge suit les mêmes 90 jours UTC que les agrégats existants.
- Tableau `/admin/stats` : ventilation par famille de signalements (sessions, ouvertures, fins, salons/partages) ; colonne « Antérieur ou non ventilé » = `total - admin - test - unmarked`.

Les chargements `visits`, bitmaps `usage_unique_daily`, cohortes Daily et métriques économiques ne sont **pas ventilés**. Les pages spéciales / partage servant l'index peuvent être classées admin mais ne peuvent pas connaître le marqueur `sessionStorage` lors du premier GET ; cette limite doit rester visible. Les éventuelles reconnexions Socket.IO après une connexion à un compte peuvent nécessiter d'ouvrir une nouvelle connexion pour être classées correctement.

## Marquer un essai de recette sans masquer les visites historiques

Dans **l'onglet de recette non administrateur seulement**, ouvrir la console navigateur et saisir :

```js
sessionStorage.setItem("pokedle_usage_test_v1", "1");
location.reload();
```

Effectuer les essais de modes / de salles, puis revenir à l'usage normal :

```js
sessionStorage.removeItem("pokedle_usage_test_v1");
location.reload();
```

La préférence est limitée à l'onglet/session, pas au compte et pas à une base de données de suivi individuel. Ne jamais partager une URL d'administration ni exposer `ADMIN_STATS_KEY`.

## Contrôles d'acceptation

1. **Sans marquage** : l'ancien total augmente et le segment `unmarked` augmente du même montant.
2. **Administrateur authentifié** : les nouveaux événements augmentent le segment `admin`, même si la console a marqué l'onglet comme test.
3. **Onglet de test** : événements HTTP et création/entrée/manches de Party Room correctement classés `test` ; chaque événement incrémente aussi le total.
4. **Historiques présents** : aucune donnée ancienne n'est supprimée ni transformée en vrai « joueur » ; l'écart est affiché comme non ventilable.
5. **Confidentialité** : aucune colonne avec identifiant de compte, identifiant navigateur ou IP.
6. **Tests automatiques** : `App/test/usage-metrics.test.js`, `App/test/usage-client.test.js` et `App/test/usage-segments.test.js`, suivis de la CI navigateur/base.

**Limites de vérification :** réussir ces tests et la CI n'est pas une recette manuelle sur Render ni sur un vrai iPhone. Il n'existe pas de taux historique de « vrais joueurs » qu'on puisse recalculer avant cette instrumentation.

## Travail suivant

Ne pas prolonger DATA-02 en analytics invasives : poursuivre le plan sur les jeux (dont `NIV-02`, `SER-01`, `MEDIA-01`) et le mobile, tout en laissant `BUG-MOB-01` en attente du retour réel de Jade. Toute décision économique continue d'exiger simulations et arbitrage final.
