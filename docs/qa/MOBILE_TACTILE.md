# QA — zones tactiles mobile (BUG-MOB-01)

**Source :** retour joueur du 04/11/2026 sur « Qui est-ce ? ». Sur téléphone, certains éléments situés dans la partie basse semblent ne pas répondre ; le joueur doit faire défiler la page pour les remonter. Le navigateur et le modèle du téléphone sont inconnus.

**Statut :** signalement à reproduire ; cause non établie. Aucune correction du positionnement ou des `z-index` ne doit être livrée uniquement sur une hypothèse.

## Test automatisé : hit-test réel, pas clic forcé

Depuis la racine du dépôt :

```sh
cd App && npm ci && cd ..
python -m pip install playwright==1.55.0
python -m playwright install chromium webkit
python tools/mobile_touch_quality.py
```

- Lance `App/server.js` sur **127.0.0.1:3197** sans `DATABASE_URL`, avec des sessions invitées locales.
- Examine « Qui est-ce ? » en Chromium et WebKit, à 360×780, 390×844 et 1366×768.
- Pour chaque cible, le script défile pour la rendre visible, note la position et la pile d'éléments via `document.elementsFromPoint(x, y)`, puis effectue un **vrai tap aux coordonnées** (`touchscreen.tap`, sans l'auto-scroll des `locator.click`/`locator.tap`).
- Vérifie que le changement de carte ou de nombre de questions s'est bien produit, puis refait un contrôle après navigation.
- Contrôle qu'au moins un élément de jeu a été testé dans la moitié basse des fenêtres mobiles.
- Résultats : `quality-artifacts/mobile-touch/report.json` ; captures en cas d'échec.

**Limite importante :** les profils Playwright mobiles ne remplacent ni un vrai iPhone Safari, ni un Android Chrome, ni les effets des barres système ou du clavier réel. Un test vert n'autorise pas à marquer le signalement utilisateur « corrigé ».

## Recette réelle sur téléphone avant de clôturer

1. Ouvrir `Qui est-ce ?` sur l'appareil qui présentait le défaut. Noter **modèle, OS, navigateur, site installé ou onglet normal**.
2. Sans toucher à la mise en page : appuyer sur une carte en haut, au milieu et en bas de l'écran. Vérifier qu'elle se sélectionne.
3. Choisir une question en haut et une en bas de la liste. Vérifier réponse et retournement.
4. Déplacer la même cible dans la partie basse puis haute en défilant : noter précisément si seul l'emplacement dans le viewport change sa réactivité.
5. Avec clavier ouvert et fermé (sur un mode comportant un champ), tester le bas de l'écran. Tester barre de navigation du navigateur déployée puis réduite.
6. Ouvrir et fermer chat, aide, modale, récompense et animation, puis répéter.
7. Tester le bouton Précédent, le retour depuis l'arrière-plan et les orientations portrait/paysage.
8. Répéter sur un deuxième mode et, si possible, un second appareil Android.

Si un appui échoue, noter **la cible, les coordonnées approximatives, l'état du clavier, le panneau ouvert et le comportement au défilement**. Une vidéo courte sans données personnelles aide à reproduire.

## Diagnostic DOM dans un navigateur avec console développeur

Exécuter sur une **session de test uniquement** :

```js
(() => {
  const onTap = e => {
    const nodes = document.elementsFromPoint(e.clientX, e.clientY).slice(0, 6);
    console.log('[Pokédle touch]', {
      x: Math.round(e.clientX),
      y: Math.round(e.clientY),
      viewport: { width: innerWidth, height: innerHeight, visualHeight: visualViewport?.height },
      stack: nodes.map(n => ({
        tag: n.tagName, id: n.id, classes: typeof n.className === 'string' ? n.className : '',
        pointerEvents: getComputedStyle(n).pointerEvents
      }))
    });
  };
  document.addEventListener('pointerdown', onTap, { capture: true, passive: true });
  window.stopPokedleTouchDebug = () => document.removeEventListener('pointerdown', onTap, true);
})();
```

Pour arrêter : `stopPokedleTouchDebug()`. Ne pas intégrer cette journalisation à la télémétrie de production ni enregistrer les textes saisis dans le chat.

## Critères d'acceptation

- Le défaut est **reproduit**, le composant responsable nommé et le changement justifié.
- Les actions en bas et en haut répondent, y compris après fermeture d'une modale et avec clavier ouvert.
- Navigation, scroll des questions et barre mobile ne sont pas dégradés.
- Les tests automatisés concernés passent et la recette sur **appareil réel** est notée dans le plan.
- Aucune modification de compte, d'économie, de collection ou de difficulté n'est incluse dans ce lot.
