# MEDIA-01 — mode « Cri du Pokémon » : échec audio non pénalisant

**Lot du 6 novembre 2026, PR à vérifier avant fusion.**

## Constat confirmé dans le code

- Le mode Cri permet déjà d'écouter le même son autant de fois que souhaité ; la proposition d'un Pokémon et l'abandon sont des actions séparées.
- En partie vérifiée, le secret reste côté serveur. Le navigateur reçoit une URL opaque `/api/arcade/cry/:token` ; le serveur essaie déjà deux hébergeurs de fichiers OGG avant d'échouer.
- Auparavant, le navigateur pouvait réutiliser un lecteur en erreur ou rester sur un état « Chargement… » sans délai de sécurité, avec l'instruction « réessaie ou abandonne ». Le code ne prouvait **pas** qu'une panne audio débitait directement une tentative ; le risque principal était d'inciter le joueur bloqué à déclarer une défaite.
- Les parties en série 5/10/20 réemploient l'écran Cri. Un son lié à la manche précédente ne doit pas perturber une nouvelle manche.

## Correctif minimal

1. **Réessayer sans changer le secret** : en cas de rejet `play()`, de ressource indisponible, de format invalide ou d'élément audio en erreur, le lecteur indique « Réessayer le cri », se réactive, puis crée un élément audio neuf au prochain clic. Aucun nom ni identifiant de Pokémon n'est ajouté au message.
2. **Chargement borné** : échec explicite après **12 s** pour une URL locale CDN et **20 s** pour l'URL opaque vérifiée (deux tentatives amont de 8 s). Les coupures `waiting` reçoivent elles aussi une échéance.
3. **Absence de perte automatique** : aucun échec audio ne déclenche `surrenderGame`, `verifiedGuessAbandon`, `recordMatchHistory`, validation de réponse, modification du nombre d'essais ou du compteur de trouvailles. Après erreur, le joueur peut réécouter **ou quitter vers les modes sans déclarer de défaite** grâce à une action explicite.
4. **Protection des retours tardifs** : numéro de tentative de lecture, invalidation des promesses et événements précédents, annulation du délai de chargement lors de l'arrêt, changement de jeu ou nouvelle manche Cri. Un ancien cri ne peut pas réécrire le statut du nouveau.
5. **Conservation du volume** : le cri du mode Cri joue indépendamment du commutateur des cris décoratifs, à la valeur `appSoundVolume()` déjà configurée.
6. **Autorité serveur conservée** : aucune URL CDN contenant l'ID du Pokémon ne remplace l'URL opaque pendant une partie vérifiée. Le serveur, les gains de première partie, le tirage, les sauvegardes et les réponses ne sont pas modifiés.

## Limites et choix volontaires

- Une lecture techniquement démarrée ne prouve pas que le haut-parleur, le casque ou le volume matériel a effectivement été audible.
- « Quitter sans défaite » revient à l'accueil des modes, sans inventer de réussite ni fabriquer un résultat serveur. Il ne crée **pas** une fonctionnalité de manche « saut gratuit » ou de relance serveur infinie.
- Une panne persistante du fournisseur audio ne peut pas être réparée par le navigateur ; la sortie non pénalisante reste possible.
- L'instrumentation de véritables téléphones Safari/Android et la recette sur Render restent à distinguer des contrôles automatisés.
- Aucun changement des Poké Balls, Pokédollars, taux, récompenses ou règles d'identification.

## Recette automatisée exigée

- Tests Node `App/test/cry-retry-media-01.test.js` : refus autoplay, ressource `error`, délai, coupure de lecture, URL opaque, lien invalide, sortie sans défaite et retours tardifs, plus maintien des compteurs.
- Test existant du volume `App/test/sound-volume-2026-10-31.test.js` actualisé uniquement pour la variable locale du lecteur.
- Vérifications du shell d'identification, de l'autorité serveur, des parcours navigateurs Chromium/WebKit et des autres modes en CI.
- Validation Node et navigateur sur **le même commit exact** avant toute fusion.

**Suite après fusion :** avancer sur une autre priorité indépendante, notamment **PC-02** (raccourcis clavier contextuels sur ordinateur), sans déclarer `BUG-MOB-01` résolu sur le téléphone de Jade.
