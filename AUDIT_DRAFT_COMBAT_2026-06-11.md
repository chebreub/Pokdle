# État des lieux — Draft Arènes & Combat — 11 juin 2026

**Méthode.** Run complète jouée en live : draft Gen 1 (6 picks), évaluation d'équipe, lancement « Affronter Pierre », deux tours de combat joués. Plus cartographie du code. Objectif : te donner une vision claire pour décider quoi garder, réparer ou couper — pas de modification faite.

## L'échelle du chantier (pour comprendre la frustration)

Le bloc Draft représente **~260 fonctions et ~8 000 lignes** de script.js, dont un **moteur de combat complet** (« SimpleBattle » : ~800 références — PP, stages de stats, table des types par ère, IA, effets, Lutte, movesets générés) + un mode réseau dédié côté serveur (`draft-battle:*` rooms) + Score Attack + le duel local 1v1. C'est de loin la plus grosse feature du site — plus grosse que le Pokédle lui-même. C'est normal qu'elle concentre les bugs : elle fait 5 jeux à la fois.

## Ce qui marche bien ✅

- **Le draft lui-même** : 6 propositions claires avec BST + « Moy. après pick », anti-doublons, renouvellement des options, métriques d'équipe (BST total/moyenne, synergie), choix de génération, badges par gen — solide et agréable.
- La persistance de la run (refresh = reprise, ajoutée récemment).
- Le bouton contextuel « Affronter Pierre » (au lieu d'un générique).
- Le moteur de combat **fonctionne** mécaniquement : tours résolus, KO, remplacement, PP décomptés, l'esthétique GBA est assumée et cohérente.

## Les problèmes constatés en jouant 🔴

1. **Équilibrage cassé (le tueur de fun)** : mon Kabuto 65 PV s'est fait mettre **0/65 en un échange** par un Racaillou de niveau équivalent (N.36 vs N.33), alors que mon Hydrocanon ×4 super-efficace avait one-shot Gravalanch au tour d'avant. Impression : dégâts adverses énormes, et le Pokémon de remplacement semble agir dans la même séquence que son entrée. Résultat : le joueur se sent volé, pas challengé.
2. **Types d'attaques faux** : « Attraction » et « Métronome » affichés **type Roche** (ce sont des capacités Normal). Le générateur de movesets assigne des noms d'attaques qui ne correspondent pas à leur vrai type → n'importe quel fan le remarque en 10 secondes.
3. **Écran de préparation illisible** : panneau adversaire en texte sombre sur fond sombre (on ne voit que sa barre de PV), titre « Arène 1 • Pierre » illisible, et l'instruction « Clique un Pokémon dans le banc joueur pour choisir ton lead » alors qu'**aucun banc n'est visible** à l'écran.
4. **Flux lourd** : textbox façon GBA lettre par lettre qu'il faut cliquer plusieurs fois **à chaque tour** ; niveaux (N.33, N.35…) sortis de nulle part sans explication ; « SAC » et « FUITE » présents mais grisés (du bruit).
5. **Trois modes de duel entremêlés** : le panneau de préparation mélange le duel d'arène solo avec « Mode local 1v1 », « Créer room 1v1 », « Rejoindre room » — pour un joueur, c'est confus ; pour toi, c'est 3× plus de code à maintenir.
6. **Après le draft, l'écran reste chargé** : la section « Sélection de génération » demeure affichée et cliquable, l'équipe s'affiche en gris pâle illisible.

## Tes trois options (avec mon avis)

**Option A — Réparer le combat (~3-4 sessions)**
Corriger l'équilibrage (formule de dégâts, niveaux, séquence de remplacement), les types d'attaques, la lisibilité de la préparation, accélérer la textbox (vitesse ×3 + clic pour tout passer). Garder local 1v1 + rooms. C'est viable mais c'est le chantier le plus coûteux, et le multi du duel d'arène fait doublon avec Duel 1v1/Stat Clash qui marchent déjà.

**Option B — Recentrer (1-2 sessions) ← ma recommandation**
Garder ce qui est bon : draft + badges + **combat vs IA uniquement**. Couper du périmètre : « Mode local 1v1 », « Créer/Rejoindre room » du duel d'arène (le multi du site vit déjà dans Duel 1v1 / Stat Clash / Party Room). Puis réparer le cœur en 4 fixes : équilibrage des dégâts, types d'attaques corrects, écran de préparation lisible avec le banc visible, textbox rapide. Résultat : une feature nette, finissable, qui fait UNE chose bien.

**Option C — Couper le combat (1 session)**
Draft + badges + Score Attack restent (ils sont bons), le bouton « Affronter » disparaît, ~5 000 lignes de moteur de combat partent. Le mode devient « drafte et découvre quels badges ton équipe peut viser ». Honnête, mais on perd la payoff du mode.

## Mon conseil franc

Ne jette pas le projet : 90 % du site est maintenant propre et testé — c'est UNE feature qui déborde. Le draft est bon, l'enrobage est bon, c'est le **combat** qui trahit la promesse. L'option B te donne un mode fini dont tu seras fier sans t'enterrer : on coupe le multi d'arène redondant, on répare 4 choses précises, et si un jour tu veux le 1v1 d'arène, le code serveur restera dans l'historique git.

Dis-moi A, B ou C et je lance le chantier.
