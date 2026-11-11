// Scènes animées, lot 1 (11/11/2026, Kayan : « faut que les tuiles soient animées… et d'ailleurs toutes »).
// Six jeux de devinette reçoivent leur petite scène, dans le même style que celles de la Sélection (lueur, rayons,
// éclats, nom du Pokémon) : Pixelisé, Cri, Description Pokédex, Wordle, Illimité et Stat mystère.
// Elles servent partout où les scènes existent déjà : accueil (grande tuile), « Tous les jeux ».
// L'image de chaque tuile reste son image du catalogue. Rien ne bouge avec « Animations réduites ».

(function () {
  if (typeof HM_SCENES === 'undefined' || typeof hmSceneHtml !== 'function') return;
  HM_SCENES.startPixelGame = 'pix';
  HM_SCENES.startCryGame = 'cry';
  HM_SCENES.startDescriptionMode = 'desc';
  HM_SCENES.startWordleTraining = 'wordle';
  HM_SCENES.startNormalGame = 'inf';
  HM_SCENES.startMysteryStatGame = 'stat';

  var found = '<span class="hm-name">Trouvé !</span>';
  var lot1 = {
    // Pixelisé : l'image passe de gros pixels à nette, puis le Pokémon est trouvé.
    pix: function () {
      return hmAtmo() + '<span class="hm-pix"><span class="hm-pix-l is-1"><img alt=""></span><span class="hm-pix-l is-2"><img alt=""></span><span class="hm-pix-l is-3"><img alt=""></span><span class="hm-pix-main" data-hm-main></span></span>' + found + '<i class="hm-flash"></i>' + hmBurst();
    },
    // Cri : un haut-parleur, des ondes et un égaliseur ; la silhouette prend ses couleurs.
    cry: function () {
      return hmAtmo() + '<span class="hm-spk"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/></svg><i class="hm-wave is-1"></i><i class="hm-wave is-2"></i><i class="hm-wave is-3"></i></span>' +
        '<span class="hm-eq"><i></i><i></i><i></i><i></i><i></i></span><span class="hm-shadow" data-hm-main></span>' + found + '<i class="hm-flash"></i>' + hmBurst();
    },
    // Description Pokédex : une fiche s'écrit ligne après ligne, puis le Pokémon sort de la fiche.
    desc: function () {
      return hmAtmo() + '<span class="hm-dexcard"><b>N° ???</b><i class="is-1"></i><i class="is-2"></i><i class="is-3"></i></span><span class="hm-shadow is-desc" data-hm-main></span>' + found + '<i class="hm-flash"></i>' + hmBurst();
    },
    // Wordle : une ligne de lettres se retourne (gris, jaune, vert), puis tout passe au vert.
    wordle: function () {
      var w = ['Z', 'A', 'R', 'B', 'I'], c = ['is-g', 'is-y', 'is-n', 'is-y', 'is-g'];
      return hmAtmo() + '<span class="hm-wd">' + w.map(function (l, i) { return '<i class="' + c[i] + '" style="--i:' + i + '">' + l + '</i>'; }).join('') + '</span><span class="hm-wd-mon" data-hm-main></span>' + hmBurst();
    },
    // Illimité : le signe infini se dessine, et les parties s'enchaînent (+1, +1, +1…).
    inf: function () {
      return hmAtmo() + '<svg class="hm-inf" viewBox="0 0 100 50" aria-hidden="true"><path d="M50 25c-8-10-14-15-22-15a15 15 0 0 0 0 30c8 0 14-5 22-15s14-15 22-15a15 15 0 0 1 0 30c-8 0-14-5-22-15z"/></svg>' +
        '<span class="hm-inf-mon" data-hm-main></span><span class="hm-plus1"><i>+1</i><i>+1</i><i>+1</i></span>';
    },
    // Stat mystère : six barres de stats montent, puis le Pokémon est reconnu.
    stat: function () {
      var labels = ['PV', 'Att', 'Déf', 'AtS', 'DéS', 'Vit'], widths = [62, 84, 48, 92, 56, 76];
      return hmAtmo() + '<span class="hm-stats">' + labels.map(function (l, i) { return '<span style="--i:' + i + ';--w:' + widths[i] + '%"><b>' + l + '</b><i></i></span>'; }).join('') + '</span>' +
        '<span class="hm-shadow is-stat" data-hm-main></span>' + found + '<i class="hm-flash"></i>' + hmBurst();
    }
  };

  var baseScene = hmSceneHtml;
  hmSceneHtml = function (kind) { return lot1[kind] ? lot1[kind]() : baseScene(kind); };

  // Pixelisé : les trois couches pixelisées reprennent l'image de la tuile.
  var baseDecorate = hmDecorateTile;
  hmDecorateTile = function (tile) {
    baseDecorate(tile);
    var scene = tile.querySelector('.hm-scene.is-pix');
    var main = scene && scene.querySelector('.hm-pix-main img, .hm-pix-main .mode-tile-sprite');
    if (!scene || !main) return;
    var layers = scene.querySelectorAll('.hm-pix-l img');
    var paint = function () {
      // L'image de la tuile réduite à 7, 14 puis 28 pixels de côté, puis agrandie sans lissage : de vrais gros pixels.
      [7, 14, 28].forEach(function (n, i) {
        try {
          var small = document.createElement('canvas'); small.width = small.height = n;
          var sx = small.getContext('2d'); sx.drawImage(main, 0, 0, n, n);
          var big = document.createElement('canvas'); big.width = big.height = 140;
          var bx = big.getContext('2d'); bx.imageSmoothingEnabled = false; bx.drawImage(small, 0, 0, 140, 140);
          if (layers[i]) layers[i].src = big.toDataURL('image/png');
        } catch (_e) { if (layers[i]) layers[i].src = main.currentSrc || main.src; }
      });
    };
    if (main.complete && main.naturalWidth) paint(); else main.addEventListener('load', paint, { once: true });
  };
})();
