# MOB-03 — commandes mobiles, périmètre et validation

## Livraisons

- #285 : les boutons Deviner/Abandonner conservent leur espace sous les suggestions du champ solo partagé.
- #287 : chat Party ajusté au viewport visuel ; messages, réactions et brouillon préservés ; célébrations différées pendant le chat ou le clavier.
- Dernier volet : Party, Duel et choix du Pokémon du Défi ami. La liste réserve une hauteur stable pendant la saisie, se réduit à l'ouverture du clavier et garde le bouton principal dans la zone visible. Aucun scroll à chaque lettre ni écoute du scroll du viewport. L'ancrage de scroll est désactivé uniquement sur les trois zones concernées pendant le clavier, pour éviter que le redimensionnement déplace le champ.
- Party/Duel : le tap conserve le focus jusqu'à son traitement, pour que le bouton ne se déplace pas entre pointerdown et click. Aucun envoi supplémentaire. Défi ami : choisir le Pokémon ferme volontairement le clavier et expose la copie du lien, sans copier ni envoyer automatiquement.

## Défauts reproduits

Sur Chromium mobile, viewport visuel simulé à 400 px : après placement du champ dans la zone visible, le bouton Party descendait à 522 px et celui du Duel à 696 px. Le test d'envoi a aussi révélé qu'une perte de focus pendant le tap pouvait déplacer le bouton avant le click : zéro tentative était transmise. Les corrections sont limitées à ces chemins de présentation/interactions.

## Recette automatisée

`tools/mobile_guess_controls_quality.py` ouvre deux vrais invités sur un serveur local isolé par résolution. Chromium et WebKit : 360×740, 390×844 et 1366×768. Sur mobile, simulation `visualViewport` à 260/320/400 px et décalage de 60 px. Vérifie champ, bouton, au moins une suggestion entière, liste défilable, stabilité sur plusieurs lettres/aucun résultat, tap aux coordonnées sans auto-scroll mobile, un seul envoi et une seule tentative serveur, abandon avec confirmation, sélection du défi sans copie automatique. Captures et rapport dans `quality-artifacts/mobile-controls/`.

Les tests ciblés existants protègent le clavier PC, les suggestions solo, le chat et la file de célébrations. La CI complète reste requise avant fusion. Les sources sont reconstruites via `npm run build` ; les tests utilisent les ressources réellement servies depuis `App/dist/`.

## Limites et suite

La clôture technique de MOB-03 exige les trois volets intégrés et les contrôles automatisés verts ; elle ne clôture ni BUG-MOB-01 (téléphone de Jade), ni MOB-04 (focus/scroll Safari réel). Le viewport clavier est simulé, aucun test sur iPhone physique ni vérification Render n'est revendiqué. Prix, probabilités, gains, captures, sauvegardes et règles serveur restent inchangés.

Après fusion du dernier volet et validation complète : **14/43 = 32,6 %**. Prochaine action autonome : **DEX-01**, distinguer vu/découvert, déjà capturé et possédé actuellement, en s'appuyant sur les données existantes.
