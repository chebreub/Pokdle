# Étape 1 — reprise du 9 octobre 2026

Ordre confirmé : PR 2 → PR 1 → PR 4 → PR 3 → PR 6 → PR 7 → PR 8 → PR 11 → Google.
Une PR à la fois, recette du site avant la suivante. Aucun nouveau mode dans cette étape.

## PR 2 — cohérence Quiz / Ligue / quête / compteur, journée

- Quiz solo déjà à 15 questions : libellé initial et aide corrigés ; Party conserve 5 questions.
- Objectif Ligue 12/15, score proportionnel sur 200 (12/15 = 160, 15/15 = 200). Les manches Party 5/5 ne sont pas assimilées à un Quiz solo.
- Les accès Ligue préparent l'écran Speedrun/HL avant de démarrer la partie.
- Quête HL : meilleur score d'une série, pas addition des scores intermédiaires. Compatible avec une quête déjà sauvegardée sans son comparateur.
- Compteur Daily : ouverture hors ligne et réouverture ne créent plus de parties ; une journée active validée est comptée une fois dans les statistiques locales. La centralisation de la progression appartient à PR 1.
- Accueil : état serveur des quatre épreuves, prochaine épreuve ou Journée terminée, total /96 et bilan. Cache court par compte/jour, invalidation après jeu, anciennes réponses réseau ignorées.
- Enquête : points actuels /10 affichés sur le résultat, calculés côté serveur comme dans le bilan.
- Dossier interrompu : les bonnes réponses restent visibles mais la règle de zéro point est écrite explicitement, sans changer les règles.
- Aide : ✓ Exact / ≈ Partiel ou proche / × Différent, forme, marges et flèches réelles.
- Wordle : une proposition ordinaire sur partie initialisée passe de six à quatre appels SQL (BEGIN, lecture jointe verrouillée, UPDATE, COMMIT). Victoire : écritures de classement supplémentaires conservées. Migration, double clic et minuit Paris inchangés.
- Mesures : Server-Timing sépare attente de connexion, temps SQL et nombre d'appels ; `window.dailyWordleLastTiming` sépare temps réseau et rendu. Le gain réel dépend de la distance à la base et de la charge. Aucun temps de réponse production après proposition n'est inventé à partir du nombre de requêtes.

Validation : PostgreSQL réel pour Wordle/Daily ; tests des compteurs, quête et Ligue ; navigateurs Chromium/WebKit 1366×768 et 390×844 sur saisie, résultats, accueil après rechargement, Quiz et accès Ligue. Pas de nouvelle recette complète des modes sans lien.

## À rattacher à PR 1

Progression et Ligue indépendantes de l'historique local limité. Intégrer ou séquencer la fiche Pokédex, les XP et le résultat pour éviter leur superposition. Ne pas supprimer les récompenses attribuées.

## Proposition de pondération — NON APPLIQUÉE

Conserver 96 points : Enquête 40 (calcul actuel ×4), Wordle 12 (×2), Dossier 20, Défi 24 (score /60 ×0,4, arrondi à la fin). Le classement Enquête reste essais → indices → temps. Attendre validation utilisateur avant tout changement ou migration des anciens totaux.

Les périmètres détaillés PR 4/3/6/7/8 ne figurent pas dans le plan historique R0–R8 du dépôt : ne pas confondre ces deux plans ni inventer leur contenu. PR 11 : accès et noms du catalogue uniquement, sans fusion des moteurs, selon la consigne utilisateur.
