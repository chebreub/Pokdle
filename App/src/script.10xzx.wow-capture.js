
// 🎬 V2-FX-01 (7/11/2026, maquette validée par Kayan : « A + carte C ») : rencontres et captures plus « wow ».
// A · Cinéma, à chaque rencontre : les herbes s'agitent dans la pénombre, la silhouette du Pokémon se dresse, un
// éclair le révèle et un bandeau annonce « Un … sauvage apparaît ! » ; au lancer, la Ball laisse une traînée
// lumineuse, des étincelles sont aspirées avec le Pokémon, la caméra se resserre et l'écran s'assombrit sur les
// bords pendant les secousses ; à la capture, onde dorée, éclair et « Attrapé ! ».
// C · Carte holo, pour une 1re capture : rayons derrière la carte « Nouvelle entrée » et reflet holographique
// (doré pour un shiny).
// Seule la mise en scène change : le serveur décide toujours du résultat, les taux, les Balls, les sons et
// « Passer › » sont ceux d'avant. Rien de tout ça en « Animations réduites » ; tout va deux fois plus vite en
// « Rapides ». Les boutons restent utilisables pendant l'apparition.
function wowMs(ms) { return typeof fxMs === 'function' ? fxMs(ms) : ms; }
function wowOff() { return typeof wildReducedMotion === 'function' ? wildReducedMotion() : false; }
function wowSpeed(el) { if (el) el.style.setProperty('--wowk', typeof fxFast === 'function' && fxFast() ? '.5' : '1'); }
// Les instants de l'animation de capture (script.10xzd.motion.js), en vitesse normale : la Ball touche le
// Pokémon à 1 000 ms, se pose à 2 580 ms, chaque secousse dure 900 ms et le « clic » vient 320 ms après.
function wowCaptureTimeline(shakes) {
  var n = Math.max(0, Math.min(3, Number(shakes) || 0));
  return { impact: 1000, landed: 2580, click: 2580 + 900 * n + 320 };
}

// --- A · L'apparition ---
if (typeof renderWildEncounter === 'function') {
  var renderWildEncounterBeforeWow = renderWildEncounter;
  renderWildEncounter = function (state, message, intro) {
    var out = renderWildEncounterBeforeWow.apply(this, arguments);
    var scene = document.getElementById('wild-scene'), stage = scene && scene.querySelector('.wild-stage');
    if (!intro || !stage || wowOff() || stage.querySelector('.wow-dark')) return out;
    var e = state && (state.encounter || state.wild && state.wild.open), p = e && typeof wildPokemon === 'function' ? wildPokemon(e.pokemonId) : null;
    wowSpeed(stage);
    stage.classList.add('is-wow-intro');
    stage.insertAdjacentHTML('beforeend', '<div class="wow-dark" aria-hidden="true"></div><div class="wow-halo" aria-hidden="true"></div>' +
      (p ? '<div class="wow-banner" aria-hidden="true">' + (e.shiny ? '✨ ' : '') + 'Un ' + escapeHtml(p.name) + ' sauvage apparaît !</div>' : ''));
    setTimeout(function () { stage.classList.remove('is-wow-intro'); stage.querySelectorAll('.wow-dark,.wow-halo,.wow-banner').forEach(function (n) { n.remove(); }); }, wowMs(3200));
    return out;
  };
}

// --- A · Le lancer, les secousses et la capture ---
function wowTrail(stage, until) {
  var last = 0;
  var tick = function (now) {
    if (!stage.isConnected || now > until) return;
    var ball = stage.querySelector('.mo-ball');
    if (ball && now - last > 34) {
      last = now;
      var b = ball.getBoundingClientRect(), s = stage.getBoundingClientRect();
      if (b.width) {
        var dot = document.createElement('i');
        dot.className = 'wow-trail'; dot.setAttribute('aria-hidden', 'true');
        dot.style.left = Math.round(b.left - s.left + b.width / 2) + 'px'; dot.style.top = Math.round(b.top - s.top + b.height / 2) + 'px';
        stage.appendChild(dot);
        setTimeout(function () { dot.remove(); }, wowMs(520));
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function wowSparks(stage, x, y) {
  var html = '';
  for (var i = 0; i < 10; i++) {
    var a = (i / 10) * Math.PI * 2, r = 90 + (i % 3) * 22;
    html += '<i class="wow-spark" style="left:' + Math.round(x) + 'px;top:' + Math.round(y) + 'px;--dx:' + Math.round(Math.cos(a) * r) + 'px;--dy:' + Math.round(Math.sin(a) * r) + 'px;animation-delay:' + (i % 4) * 30 + 'ms"></i>';
  }
  stage.insertAdjacentHTML('beforeend', html);
}
if (typeof wildAnimate === 'function') {
  var wildAnimateBeforeWow = wildAnimate;
  wildAnimate = function (scene, ball, shakes, caught) {
    var stage = scene && scene.querySelector('.wild-stage'), mon = stage && stage.querySelector('.wild-mon');
    if (!stage || !mon || wowOff()) return wildAnimateBeforeWow.apply(this, arguments);
    stage.classList.remove('is-wow-intro');
    stage.querySelectorAll('.wow-dark,.wow-halo,.wow-banner').forEach(function (n) { n.remove(); });
    wowSpeed(stage); wowSpeed(scene);
    var sr = stage.getBoundingClientRect(), mr = mon.getBoundingClientRect();
    var cx = mr.left - sr.left + mr.width / 2, cy = Math.max(60, mr.top - sr.top + mr.height * 0.45);
    var ground = Math.min(sr.height - 30, mr.bottom - sr.top - 22);
    stage.style.setProperty('--wow-x', Math.round(cx) + 'px');
    stage.style.setProperty('--wow-gy', Math.round(ground) + 'px');
    var t = wowCaptureTimeline(shakes), timers = [];
    var at = function (ms, fn) { timers.push(setTimeout(fn, wowMs(ms))); };
    wowTrail(stage, performance.now() + wowMs(t.impact + 60));
    at(t.impact, function () { wowSparks(stage, cx, cy - 14); });
    if (shakes > 0) at(t.landed, function () { scene.classList.add('is-wow-tense'); stage.classList.add('is-wow-tense'); });
    if (caught) at(t.click, function () {
      scene.classList.remove('is-wow-tense'); stage.classList.remove('is-wow-tense');
      stage.insertAdjacentHTML('beforeend', '<div class="wow-ring" aria-hidden="true"></div><div class="wow-flash" aria-hidden="true"></div><div class="wow-caught" aria-hidden="true">Attrapé !</div>');
    });
    else at(t.click - 100, function () { scene.classList.remove('is-wow-tense'); stage.classList.remove('is-wow-tense'); });
    var clean = function () {
      timers.forEach(clearTimeout);
      scene.classList.remove('is-wow-tense');
      if (stage.isConnected) { stage.classList.remove('is-wow-tense'); stage.querySelectorAll('.wow-trail,.wow-spark').forEach(function (n) { n.remove(); }); }
    };
    return wildAnimateBeforeWow.apply(this, arguments).then(function (v) { clean(); return v; }, function (err) { clean(); throw err; });
  };
}

// --- C · La carte holo de la 1re capture ---
if (typeof fxCaptureCard === 'function') {
  var fxCaptureCardBeforeWow = fxCaptureCard;
  fxCaptureCard = function (p, shiny) {
    var out = fxCaptureCardBeforeWow.apply(this, arguments);
    var all = document.querySelectorAll('.fx-catch'), wrap = all[all.length - 1];
    var card = wrap && wrap.querySelector('.fx-catch-card');
    if (!card || (typeof fxReduced === 'function' && fxReduced())) return out;
    wowSpeed(wrap);
    wrap.classList.add('is-wow');
    wrap.insertAdjacentHTML('afterbegin', '<div class="wow-rays" aria-hidden="true"></div>');
    card.insertAdjacentHTML('beforeend', '<div class="wow-holo' + (shiny ? ' is-gold' : '') + '" aria-hidden="true"></div>');
    return out;
  };
  window.fxCaptureCard = fxCaptureCard;
}
window.wowCaptureTimeline = wowCaptureTimeline;
