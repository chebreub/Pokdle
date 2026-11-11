// Scènes animées, lot 2 (11/11/2026, « go ») : Évolution, Ordre Pokédex, Combo de types, Speedrun,
// Shiny ou normal, Draft Score Attack. Même style que les autres scènes (lueur, rayons, éclats),
// elles se jouent 2,6 s, une tuile à la fois ; rien ne bouge avec « Animations réduites ». Pas d'emoji.

(function () {
  if (typeof HM_SCENES === 'undefined' || typeof hmSceneHtml !== 'function') return;
  HM_SCENES.startEvolutionChainGame = 'evo';
  HM_SCENES.startPokedexOrderGame = 'order';
  HM_SCENES.openTypeComboSolo = 'combo';
  HM_SCENES.openSpeedrunMode = 'speed';
  HM_SCENES.openShinyMode = 'shiny';
  HM_SCENES.openDraftScoreAttackMode = 'draft';

  var lot2 = {
    // Évolution : Magicarpe, une flèche, un flash blanc, et Léviator apparaît à sa place.
    evo: function () {
      return hmAtmo() + '<span class="hm-evo-a" data-hm-second></span><svg class="hm-evo-arrow" viewBox="0 0 40 16" aria-hidden="true"><path d="M2 8h30M26 2l8 6-8 6"/></svg>' +
        '<span class="hm-evo-b" data-hm-main></span><i class="hm-flash"></i>' + hmBurst();
    },
    // Ordre Pokédex : 001 · ??? · 003, le point d'interrogation se change en 002 avec Bulbizarre.
    order: function () {
      return hmAtmo() + '<span class="hm-ord"><i>001</i><i class="is-q"><u>???</u><u>002</u></i><i>003</i></span><span class="hm-ord-mon" data-hm-main></span>' + hmBurst();
    },
    // Combo de types : deux pastilles Eau et Glace arrivent des côtés, se rejoignent, et Lokhlass répond.
    combo: function () {
      return hmAtmo() + '<span class="hm-ty is-l">Eau</span><span class="hm-ty is-r">Glace</span><span class="hm-ty-plus">+</span><span class="hm-combo-mon" data-hm-main></span>' + hmBurst();
    },
    // Speedrun : un chrono tourne, Ninjask file en laissant des traînées, le compteur monte.
    speed: function () {
      return hmAtmo() + '<span class="hm-clock"><i></i></span><span class="hm-dash"><i></i><i></i><i></i></span><span class="hm-speed-mon" data-hm-main></span>' +
        '<span class="hm-count"><u>12</u><u>13</u><u>14</u></span>';
    },
    // Shiny ou normal : l'artwork se retourne comme une carte et devient shiny, avec des étincelles.
    shiny: function () {
      return hmAtmo() + '<span class="hm-flipcard" data-hm-main></span><span class="hm-sparkles"><i></i><i></i><i></i><i></i></span><span class="hm-name">Shiny !</span>';
    },
    // Draft : six emplacements se remplissent un par un, puis le score s'affiche.
    draft: function () {
      return hmAtmo() + '<span class="hm-slots"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="hm-draft-mon" data-hm-main></span><span class="hm-score">552</span>' + hmBurst();
    }
  };

  var base = hmSceneHtml;
  hmSceneHtml = function (kind) { return lot2[kind] ? lot2[kind]() : base(kind); };

  // Shiny ou normal : la face shiny est la même image, teintée (pas d'image de plus à charger).
  var baseDecorate = hmDecorateTile;
  hmDecorateTile = function (tile) {
    baseDecorate(tile);
    var card = tile.querySelector('.hm-scene.is-shiny .hm-flipcard');
    if (card && !card.querySelector('.hm-flip-back')) {
      var img = card.querySelector('img');
      if (img) {
        var back = img.cloneNode();
        back.className = 'hm-flip-back';
        card.appendChild(back);
      }
    }
  };
})();
