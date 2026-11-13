// Intro de la Party Room (11/11/2026, maquette vidéo validée par Kayan : « go »).
// Inspiré du mode Classé de PokeQuizz (« il y a de beaux effets entre chaque action ») :
// au lancement, deux bandes en biais (lavande / bleu) avec des rayons, les joueurs arrivent un par un avec leur
// partenaire, puis — en « Jeu surprise » — une roue tourne et tombe sur le jeu tiré par le serveur ; enfin la carte du jeu.
// Le serveur envoie room.intro (jeu, liste de la roue, durée) et ne lance la partie qu'à la fin : tout le monde voit
// la même chose au même moment, et aucun chrono ne tourne pendant l'animation.
// Pas d'emoji (Kayan : « les emojis sont moches ») : artworks officiels et dessins SVG.
// « Réduire les animations » : une carte fixe avec la barre d'attente, rien ne bouge.

var PI_SHORT = { dessin: 'Dessine-le !', lastletter: 'Dernière lettre', quiestce1v1: 'Qui est-ce ?', petitbac: 'Petit Bac', dexrace: 'Course Dex', coop: 'Enquête', deduction: 'Mystère', guess: 'Course', nearest: 'Numéro', typecombo: 'Combo', duocriteria: 'Duo', statclashparty: 'Stat Clash', statclash: 'Meilleure stat' };
var PI_SLICE = ['#FFD45C', '#C9B6F2', '#9FD8C6', '#F6B6A8', '#FFE59A', '#F8C6DE', '#FFCF9E', '#B9D4F7', '#E8E1C9', '#B5E0F2', '#D9C9F5', '#C8EBC4'];
var piState = { id: null, raf: 0, el: null };

function piGame(key) {
  var g = typeof pl3Game === 'function' ? pl3Game(key) : null;
  var name = (typeof PARTY_MODE_SHORT_LABELS !== 'undefined' && PARTY_MODE_SHORT_LABELS[key]) || (g && g.name) || key;
  return { key: key, name: name, short: PI_SHORT[key] || name, art: g ? g.art : 'img/art/25.webp', rule: g ? g.rule : '' };
}
function piReduced() {
  try { if (typeof fxReduced === 'function') return fxReduced(); return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_e) { return false; }
}
function piSfx(kind) { try { if (typeof moSfx === 'function') moSfx(kind); } catch (_e) {} }
function piPartnerSrc(p) {
  var mon = p && p.partner && typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(p.partner)) : null;
  if (!mon) return '';
  // L'artwork officiel (comme la fiche du Pokédex), pas le petit sprite.
  return typeof pokedexDetailArtwork === 'function' ? pokedexDetailArtwork(mon, false) : typeof getPokemonSprite === 'function' ? getPokemonSprite(mon) : '';
}
function piAvatar(p) {
  var src = piPartnerSrc(p);
  var initial = String((p && p.nickname) || '?').trim().charAt(0).toUpperCase() || '?';
  return src ? '<img src="' + escapeHtml(src) + '" alt="" decoding="async">' : '<span class="pi-init">' + escapeHtml(initial) + '</span>';
}
var PI_BALL = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="#fff" stroke="#2E2A33" stroke-width="7"/><path d="M4 50a46 46 0 0 1 92 0z" fill="#E5463F" stroke="#2E2A33" stroke-width="7"/><line x1="4" y1="50" x2="96" y2="50" stroke="#2E2A33" stroke-width="7"/><circle cx="50" cy="50" r="14" fill="#fff" stroke="#2E2A33" stroke-width="7"/></svg>';

function piWheelSvg(pool) {
  var n = pool.length, step = 360 / n, html = '<circle r="99" fill="#2E2A33"/>';
  pool.forEach(function (key, i) {
    var g = piGame(key);
    var a0 = (i * step - 90 - step / 2) * Math.PI / 180, a1 = ((i + 1) * step - 90 - step / 2) * Math.PI / 180;
    html += '<path d="M0 0 L' + (96 * Math.cos(a0)).toFixed(2) + ' ' + (96 * Math.sin(a0)).toFixed(2) + ' A96 96 0 0 1 ' + (96 * Math.cos(a1)).toFixed(2) + ' ' + (96 * Math.sin(a1)).toFixed(2) + ' Z" fill="' + PI_SLICE[i % PI_SLICE.length] + '" stroke="#fff" stroke-width="1.6" data-i="' + i + '"/>';
    html += '<g transform="rotate(' + (i * step - 90) + ')"><text x="27" y="0" dominant-baseline="central" font-family="Fredoka, Nunito, sans-serif" font-weight="600" font-size="' + (g.short.length > 11 ? 8 : 9) + '" fill="#2E2A33">' + escapeHtml(g.short) + '</text>' +
      '<image href="' + escapeHtml(g.art) + '" x="77" y="-9" width="18" height="18" transform="rotate(90 86 0)"/></g>';
  });
  return html + '<circle r="22" fill="#2E2A33"/><circle r="15" fill="#FFD45C"/><circle r="99" fill="none" stroke="#FFD45C" stroke-width="4"/>';
}

function piBuild(room, intro) {
  var players = (room.players || []).filter(function (p) { return p.connected !== false; }).slice(0, 8);
  var game = piGame(intro.mode);
  var pool = intro.surprise && Array.isArray(intro.pool) && intro.pool.length ? intro.pool : null;
  var total = Number(room.totalRounds) || 0;
  var el = document.createElement('div');
  el.className = 'pi' + (piReduced() ? ' is-still' : '') + (players.length === 2 ? ' is-duo' : '');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-label', (pool ? 'Jeu surprise : ' : '') + game.name + ', la partie commence');
  el.innerHTML = '<div class="pi-pan is-a"><i class="pi-rays"></i></div><div class="pi-pan is-b"><i class="pi-rays"></i></div><i class="pi-seam"></i>' +
    players.map(function (p, i) {
      return '<div class="pi-pl" data-i="' + i + '"><span class="pi-av">' + piAvatar(p) + '</span><b>' + escapeHtml(p.nickname || 'Dresseur') + '</b>' + (p.level ? '<small>Niv. ' + Number(p.level) + '</small>' : '') + '</div>';
    }).join('') +
    '<div class="pi-badge">' + (players.length === 2 ? '<span class="pi-vs">VS</span>' : PI_BALL) + '</div>' +
    '<p class="pi-count">' + (players.length === 2 ? 'Duel' : players.length + ' dresseurs') + ' · c\'est parti</p>' +
    (pool ? '<div class="pi-wheel"><svg class="pi-wsvg" viewBox="-100 -100 200 200">' + piWheelSvg(pool) + '</svg>' +
      '<svg class="pi-pointer" viewBox="0 0 34 40" aria-hidden="true"><path d="M17 38 3 8a14 14 0 1 1 28 0z" fill="#FFD45C" stroke="#2E2A33" stroke-width="3"/></svg></div>' +
      '<div class="pi-wlabel"><img alt="" src="' + escapeHtml(game.art) + '"><span>Jeu surprise</span></div>' : '') +
    '<div class="pi-card"><span class="pi-art"><img alt="" src="' + escapeHtml(game.art) + '"></span>' +
      (pool ? '<span class="pi-tag">Jeu surprise</span>' : '') +
      '<h2>' + escapeHtml(game.name) + '</h2>' +
      (game.rule ? '<p>' + escapeHtml(game.rule) + '</p>' : '') +
      (total > 1 ? '<small>Manche 1 sur ' + total + '</small>' : '') +
      '<span class="pi-bar"><i></i></span></div>';
  // Accrochée à <html> : un style du <body> (transform/filter) ferait défiler une couche « fixe » avec la page.
  document.documentElement.appendChild(el);
  return { el: el, players: players.length, pool: pool, target: pool ? Math.max(0, pool.indexOf(intro.mode)) : 0 };
}

function piStop() {
  if (piState.raf) cancelAnimationFrame(piState.raf);
  piState.raf = 0;
  if (piState.el) piState.el.remove();
  piState.el = null;
}

function piFadeOut() {
  var el = piState.el;
  if (!el || el.classList.contains('is-out')) return;
  el.classList.add('is-out');
  el.style.pointerEvents = 'none';
  setTimeout(function () { if (piState.el === el) piStop(); }, 220);
}

function piStart(room) {
  var intro = room.intro;
  piStop();
  piState.id = intro.id;
  var built = piBuild(room, intro);
  piState.el = built.el;
  var el = built.el, n = built.players, pool = built.pool;
  var dur = Math.max(1000, Number(intro.durationMs) || 3200);
  var t0 = performance.now() - Math.max(0, dur - (Number(intro.remainingMs) || dur));
  var bar = el.querySelector('.pi-bar i');
  if (el.classList.contains('is-still')) {
    // Animations réduites : la carte du jeu, fixe, et la barre qui se remplit (pas de mouvement).
    var tickStill = function () {
      var t = performance.now() - t0;
      if (bar) bar.style.width = Math.min(100, t / dur * 100) + '%';
      if (t >= dur + 400) { piStop(); return; }
      piState.raf = requestAnimationFrame(tickStill);
    };
    piState.raf = requestAnimationFrame(tickStill);
    return;
  }
  var q = function (s) { return el.querySelector(s); };
  var pans = el.querySelectorAll('.pi-pan'), rays = el.querySelectorAll('.pi-rays');
  var seam = q('.pi-seam'), badge = q('.pi-badge'), count = q('.pi-count'), card = q('.pi-card');
  var wheel = q('.pi-wheel'), wsvg = q('.pi-wsvg'), pointer = q('.pi-pointer'), wlabel = q('.pi-wlabel');
  var plEls = el.querySelectorAll('.pi-pl');
  var cl = function (x) { return Math.max(0, Math.min(1, x)); };
  var pr = function (t, s, d) { return cl((t - s) / d); };
  var out = function (x) { return 1 - Math.pow(1 - x, 3); };
  var back = function (x) { var c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  var elastic = function (x) { return x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (2 * Math.PI) / 3) + 1; };
  // Repères : la roue (si « Jeu surprise ») prend le milieu ; la carte arrive pour la dernière seconde et demie.
  var T = pool ? { lift: 1500, wheel: 1600, spin: 2000, spinEnd: 4700, card: 5100 } : { lift: 1500, wheel: 0, spin: 0, spinEnd: 0, card: 1700 };
  var steps = pool ? pool.length : 1, step = 360 / steps;
  var finalRot = -(5 * 360 + built.target * step);
  var lastSlice = -1, popped = {}, landed = false, opened = false;
  var tick = function () {
    var t = performance.now() - t0;
    var W = window.innerWidth, H = window.innerHeight;
    var pa = out(pr(t, 0, 450)), lift = out(pr(t, T.lift, 450));
    pans[0].style.transform = 'translateX(' + ((1 - pa) * -110) + '%) translateY(' + (-lift * 40) + '%)';
    pans[1].style.transform = 'translateX(' + ((1 - pa) * 110) + '%) translateY(' + (lift * 12) + '%)';
    rays[0].style.transform = rays[1].style.transform = 'rotate(' + (t * 0.014) + 'deg)';
    seam.style.transform = 'rotate(-9deg) scaleX(' + pr(t, 350, 250) + ')';
    seam.style.opacity = t < 350 ? 0 : 1 - lift;
    // Les joueurs arrivent un par un (2 : l'un en haut, l'autre en bas ; plus : deux colonnes en zigzag), puis se rangent en haut.
    var rows = Math.ceil(n / 2), big = n <= 4 ? 1 : 0.72;
    for (var i = 0; i < plEls.length; i++) {
      var p = pr(t, 450 + i * (n > 4 ? 90 : 130), 450);
      if (p > 0 && !popped[i]) { popped[i] = true; piSfx('pop'); }
      var x, y;
      if (n === 2) { x = W * 0.5; y = i ? H * 0.60 : H * 0.10; }
      else {
        // Deux colonnes en zigzag : la moitié des rangées au-dessus de la Poké Ball, l'autre moitié en dessous.
        var r = Math.floor(i / 2), topRows = Math.ceil(rows / 2);
        x = W * (i % 2 ? 0.72 : 0.28);
        y = r < topRows ? H * 0.05 + r * H * 0.36 / topRows : H * 0.56 + (r - topRows) * H * 0.34 / Math.max(1, rows - topRows);
        if (i % 2) y += H * 0.04;
      }
      var from = (n === 2 ? (i ? 1 : -1) : (i % 2 ? 1 : -1)) * W * 0.8;
      var ex = x + (1 - out(p)) * from;
      var fx = W * ((i + 0.5) / n), fy = H * 0.03;
      var cx = ex + (fx - ex) * lift, cy = y + (fy - y) * lift;
      var sc = (0.6 + 0.4 * back(p)) * big * (1 - lift * (n > 4 ? 0.35 : 0.5));
      plEls[i].style.opacity = p > 0 ? 1 : 0;
      plEls[i].style.transform = 'translate(' + (cx - 75) + 'px,' + cy + 'px) scale(' + sc + ')';
    }
    var b = pr(t, 900, 500);
    badge.style.opacity = t < 900 ? 0 : 1 - lift;
    badge.style.transform = 'scale(' + elastic(b) + ') rotate(' + ((1 - out(b)) * -200) + 'deg)';
    var c = pr(t, 1150, 350);
    count.style.opacity = c * (1 - lift);
    count.style.transform = 'translateY(' + ((1 - out(c)) * 14) + 'px)';
    if (pool) {
      var wu = out(pr(t, T.wheel, 400)), sp = pr(t, T.spin, T.spinEnd - T.spin);
      var rot = finalRot * (1 - Math.pow(1 - sp, 4));
      var shrink = out(pr(t, T.card - 100, 400));
      wheel.style.transform = 'translateY(' + ((1 - wu) * H * 0.8) + 'px) scale(' + (1 - shrink * 0.6) + ')';
      wheel.style.opacity = 1 - shrink;
      wsvg.style.transform = 'rotate(' + rot + 'deg)';
      var rel = ((-rot) % step + step) % step;
      pointer.style.transform = 'rotate(' + (sp < 1 ? -Math.max(0, 1 - rel / (step * 0.35)) * 22 : 0) + 'deg)';
      var cur = ((Math.round(-rot / step) % steps) + steps) % steps;
      if (sp > 0 && sp < 1 && cur !== lastSlice) { lastSlice = cur; piSfx('tick'); var g = piGame(pool[cur]); wlabel.lastChild.textContent = g.name; wlabel.firstChild.src = g.art; }
      if (sp >= 1 && !landed) { landed = true; piSfx('sparkle'); wlabel.classList.add('is-win'); var gw = piGame(pool[built.target]); wlabel.lastChild.textContent = gw.name; wlabel.firstChild.src = gw.art; }
      wlabel.style.opacity = t < T.wheel ? 0 : 1 - shrink;
      wlabel.style.transform = 'translate(-50%,' + ((1 - wu) * H * 0.8) + 'px)';
      var win = wsvg.querySelector('path[data-i="' + built.target + '"]');
      if (win) win.style.filter = t > T.spinEnd && t < T.card && Math.sin((t - T.spinEnd) / 50) > 0 ? 'brightness(1.25)' : '';
    }
    var cc = pr(t, T.card, 500);
    if (cc > 0 && !opened) { opened = true; piSfx('open'); }
    card.style.opacity = t < T.card ? 0 : 1;
    card.style.transform = 'translate(-50%,-50%) scale(' + back(cc) + ') rotate(' + ((1 - out(cc)) * -8) + 'deg)';
    if (bar) bar.style.width = Math.min(100, pr(t, T.card, dur - T.card) * 100) + '%';
    if (t >= dur + 400) { piStop(); return; }
    piState.raf = requestAnimationFrame(tick);
  };
  piState.raf = requestAnimationFrame(tick);
}

// Après chaque rendu du salon : lancer l'intro reçue (une seule fois par lancement), l'enlever quand la partie a commencé.
function piSync() {
  var room = typeof partyRoomState !== 'undefined' ? partyRoomState.room : null;
  var screen = document.getElementById('screen-party-room');
  var visible = screen && !screen.classList.contains('hidden');
  if (room && room.intro && visible) {
    if (piState.id !== room.intro.id) piStart(room);
    return;
  }
  // Lancement annulé (un joueur est parti) : l'intro s'arrête tout de suite. Si la partie a commencé, elle finit seule.
  if (piState.el && (!room || (!room.intro && room.status !== 'playing'))) piStop();
  // La partie a commencé : l'intro laisse passer les clics tout de suite et s'efface en 0,2 s (le champ de réponse est prêt).
  else if (piState.el && room && room.status === 'playing' && !room.intro) piFadeOut();
  piSurpriseTile(room);
}

// « Jeu surprise » : une tuile de plus, en tête du choix du jeu (l'hôte seulement peut la choisir).
function piSurpriseTile(room) {
  var sel = document.getElementById('party-mode-select');
  if (!sel || !room) return;
  var btn = document.getElementById('party-mode-surprise');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'party-mode-surprise';
    btn.type = 'button';
    btn.className = 'party-mode-btn party-mode-tile pi-surprise-tile';
    btn.setAttribute('data-action', 'partySetMode');
    btn.setAttribute('data-args', '["surprise"]');
    btn.innerHTML = '<span class="pmt-emoji pi-dice" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#7C5BD6"/><path d="M14 17a6 6 0 1 1 9 5.2c-2 1.1-3 2-3 3.8" stroke="#fff" stroke-width="3.6" fill="none" stroke-linecap="round"/><circle cx="20" cy="31" r="2.4" fill="#fff"/></svg></span>' +
      '<span class="pmt-text"><small class="pmt-tag">Au hasard</small><b>Jeu surprise</b><span>Une roue choisit le jeu</span></span><span class="pmt-check" aria-hidden="true">✓</span>';
    sel.insertBefore(btn, sel.firstChild);
  }
  var me = (room.players || []).find(function (p) { return p.isSelf; });
  var on = Boolean(room.surprise);
  btn.classList.toggle('is-active', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.disabled = !(me && me.isHost);
  if (on) {
    sel.querySelectorAll('.party-mode-tile:not(#party-mode-surprise)').forEach(function (b) { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
    var hint = document.getElementById('party-mode-hint');
    if (hint && (room.status === 'waiting' || room.status === 'complete')) hint.textContent = 'Jeu surprise : au lancement, une roue tire un des jeux du salon, le même pour tout le monde. La Course au Pokédex reste à choisir à part (elle se prépare en équipes).';
  }
}

if (typeof renderPartyRoom === 'function') {
  var piBefore = renderPartyRoom;
  renderPartyRoom = function () { var r = piBefore.apply(this, arguments); try { piSync(); } catch (_e) {} return r; };
}
