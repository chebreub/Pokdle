# Prompt pour Claude design — Pokédle

> Copie-colle le bloc ci-dessous dans Claude design. Adapte la dernière section
> (« Ce que je veux que tu designes ») selon l'écran que tu veux à chaque fois.

---

Tu vas designer des écrans pour **Pokédle**, une plateforme web de jeux Pokémon (type Wordle) : un « Pokémon du jour » quotidien, du multijoueur 1v1 et party en temps réel, un Pokédex de 1025 fiches, un Team Builder VGC, des mini-jeux et un émulateur. Public : fans de Pokémon, desktop + mobile.

## Direction artistique (à respecter strictement)

- **Style** : moderne, propre, 2026. **PAS de rétro pixel Game Boy.** Cartes blanches, coins arrondis doux, ombres subtiles, beaucoup d'air.
- **Police** : **Nunito** partout (poids 700 / 800 / 900). Jamais de police pixel.
- **Couleurs** :
  - texte principal navy `#0c1930` (titres) / `#17345d` (courant), texte secondaire gris-bleu `#6a7a99`
  - rouge `#e4382f`, bleu `#2f76ff`, jaune `#ffcc33` (boutons d'action)
  - cartes : blanc `#ffffff`, bordure `rgba(12,25,48,.08)`, ombre `0 6px 16px rgba(12,25,48,.07)`
- **Fond de page** : clair mais avec du caractère — dégradé radial doux bleu/rouge + 2 halos flous (rouge en haut-gauche, bleu en haut-droite). **Pas de blanc uni plat.**
- **Rayons** : petits 12px, cartes 18px, gros blocs 26px. Boutons : pilules `999px` ou rounded 12-14px.
- **Logo** : pokéball ronde stylée (rouge/blanc, trait navy) + mot « Pokédle » en Nunito 900 navy. Légère animation de flottement.
- **Interactions** : survol des cartes = `translateY(-3px)` + ombre bleue. Respecte `prefers-reduced-motion`. Focus clavier visibles.

## Structure & composants de référence (réutilise-les tels quels)

- **Barre du haut, une seule rangée** : logo (gauche) · onglets de nav qui prennent l'espace central · à droite : carte de niveau (anneau circulaire + « Niv. X · Rang » + XP), icône réglages, et bouton **« Connexion Discord »** (ou avatar si connecté). Largeur max ~1200px, centrée.
- **Onglets de nav** (pilules) : Accueil (actif = bleu plein) · Jouer ▾ · Social ▾ · Pokédex · Outils ▾ · Succès · Profil. Inactifs = blancs, texte navy, fine bordure. Menus déroulants au survol/clic.
- **Sélecteur de générations** (juste sous la nav, AU-DESSUS du hero) : barre claire avec à gauche « Générations / N/9 incluses dans tes parties », puis des **chips compactes** « Gén N » (gras 13px) + région (10px), centrées, qui passent à la ligne si besoin ; à droite boutons « Tout » / « Aucune ». La chip active est bleu plein, texte blanc.
- **Hero « Pokémon du jour »** : grande carte au **dégradé rouge (gauche) → bleu (droite)**, badge « Défi du jour · <date> », gros titre, sous-titre, 2 chips (« Série : N » avec flamme jaune, « Prochain dans HH:MM:SS »), 2 boutons (jaune « Jouer » + ghost translucide « Comment jouer ? »). À droite : un **médaillon** (cercle pointillé) contenant une **silhouette sombre de Pokémon générique + un gros « ? » jaune** au centre. ⚠️ La silhouette ne doit JAMAIS révéler le Pokémon du jour — c'est une silhouette décorative fixe.
- **Cartes de modes** : blanches, en grille (3-4 par rangée), chacune avec une **tuile-icône** pastel (icône linéaire), un titre, une courte description ; badge « LIVE » (point rouge) sur les modes temps réel. Icônes linéaires cohérentes (style Lucide/Tabler outline).
- **Carte de progression** : stats en mini-cartes (parties, victoires, taux, série), barre de niveau, etc.

## Contraintes

- **Desktop ET mobile** (donne les deux). Mobile : tout s'empile, chips scrollables/wrap.
- Accessibilité : contrastes AA, focus visibles, pas de couleur seule pour le sens.
- Reste fidèle aux couleurs/police/rayons ci-dessus pour que ce soit directement intégrable.

## Ce que je veux que tu designes (à adapter)

[Décris ici l'écran voulu, par ex. :]
« Designe l'écran **Pokédex** : grille de cartes Pokémon (sprite, n°, nom, types), barre de filtres en haut (recherche, génération, type, tri, shiny), et un panneau de détail à droite (stats, talents, évolutions, comparateur). Desktop + mobile, dans la DA Pokédle ci-dessus. »

Autres écrans possibles à demander un par un : l'écran de **jeu quotidien** (grille d'indices type/gen/taille/poids avec flèches), le **Team Builder VGC** (6 slots, objet/nature/EV-IV/Téra/4 attaques + analyse de types), les **rooms multijoueur** (Duel 1v1, Party Room, Stat Clash), les **mini-jeux** (Silhouette, Pixelisé, Cri…), le **Profil / Succès**, l'**écran de résultat partageable** (grille 🟩🟨 type Wordle).
