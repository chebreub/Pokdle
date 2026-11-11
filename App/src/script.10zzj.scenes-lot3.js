// Scènes animées, lot 3 (11/11/2026, « go ») : les derniers jeux du catalogue sans scène.
// Pokémon du jour, Œuf mystère, Mes Pokémon préférés, Marathon mini-jeux ; Qui est-ce ? et Petit Bac en solo
// reprennent les scènes de leur version Party Room. Même style, 2,6 s, une tuile à la fois. Pas d'emoji.

(function () {
  if (typeof HM_SCENES === 'undefined' || typeof hmSceneHtml !== 'function') return;
  HM_SCENES.startDailyGame = 'daily';
  HM_SCENES.openEggGame = 'egg';
  HM_SCENES.openRankingMode = 'fav';
  HM_SCENES.startPartyMode = 'marathon';
  HM_SCENES.openQuiEstCeMode = 'who';
  HM_SCENES.openPetitBacMode = 'bac';

  var lot3 = {
    // Pokémon du jour : la silhouette, trois pastilles d'indices (gris, jaune, vert), puis il se révèle.
    daily: function () {
      return hmAtmo() + '<span class="hm-clues"><i class="is-g">Gen</i><i class="is-y">Type</i><i class="is-n">Taille</i></span><span class="hm-daily-mon" data-hm-main></span><span class="hm-name">Trouvé !</span><i class="hm-flash"></i>' + hmBurst();
    },
    // Œuf mystère : l'œuf tremble, se fend, et un éclat de lumière sort.
    egg: function () {
      return hmAtmo() + '<span class="hm-egg" data-hm-main><svg class="hm-crack" viewBox="0 0 40 12" aria-hidden="true"><path d="M2 6l6-4 5 6 6-5 5 6 6-5 6 4"/></svg></span><span class="hm-hint">+1 indice</span>' + hmBurst();
    },
    // Mes Pokémon préférés : une petite grille se remplit, un cœur se pose sur le préféré.
    fav: function () {
      return hmAtmo() + '<span class="hm-favgrid"><i>' + hmImg(hmArt(25)) + '</i><i>' + hmImg(hmArt(133)) + '</i><i class="is-main" data-hm-main></i><i>' + hmImg(hmArt(1)) + '</i><i>' + hmImg(hmArt(9)) + '</i><i data-hm-second></i></span>' +
        '<svg class="hm-heart" viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21s-9-6.2-9-12.4A5 5 0 0 1 12 5a5 5 0 0 1 9 3.6C21 14.8 12 21 12 21z"/></svg>';
    },
    // Marathon : trois manches s'enchaînent sur une barre de progression jusqu'au drapeau.
    marathon: function () {
      return hmAtmo() + '<span class="hm-track"><i class="hm-fill"></i><u class="is-1"></u><u class="is-2"></u><u class="is-3"></u></span>' +
        '<svg class="hm-flag" viewBox="0 0 20 24" aria-hidden="true"><path d="M3 23V2M3 3h13l-3 4 3 4H3"/></svg><span class="hm-run-mon" data-hm-main></span>';
    },
    who: function () { return typeof hmPartySceneHtml === 'function' ? hmPartySceneHtml('who') : ''; },
    bac: function () { return typeof hmPartySceneHtml === 'function' ? hmPartySceneHtml('bac') : ''; }
  };

  var base = hmSceneHtml;
  hmSceneHtml = function (kind) { return lot3[kind] ? lot3[kind]() : base(kind); };
})();
