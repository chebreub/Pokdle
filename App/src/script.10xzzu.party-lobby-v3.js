// 🎉 Party Room, version C (8/11/2026, maquette validée par Kayan : « go les 2 »).
// Kayan : « l'écran Party Room a l'air compliqué ». Comme un menu de console :
// - un jeu en vedette en grand (ou « Joue avec tes amis » tant qu'aucun n'est choisi) ;
// - les jeux en vignettes : « En groupe » (choisir = le jeu du salon) et « À deux » (ouvrent leur mode) ;
// - un seul gros bouton « ▶ Lancer Dessine-le ! » (le bouton « Créer mon salon » d'origine, renommé) ;
// - le pseudo et le code en petit dessous.
// Rien n'est créé ni retiré : les champs, les boutons et leurs actions restent ceux d'origine (la QA les utilise),
// seuls l'ordre et l'habillage changent. Le texte de présentation et les étapes 01/02/03 sont cachés.

var PL3_GAMES = [
  { key: 'dessin', name: 'Dessine-le !', art: 'img/home/235.webp', tint: '#FDE7DD', who: '2 à 8 joueurs', rule: 'Un joueur dessine un Pokémon, les autres le devinent. Indices lettres, puis type et génération.' },
  { key: 'quiestce1v1', name: 'Qui est-ce ?', art: 'img/home/132.webp', tint: '#EDE6FF', who: 'À deux', rule: 'Chacun son Pokémon secret : pose des questions oui ou non, tour par tour.' },
  { key: 'petitbac', name: 'Petit Bac', art: 'img/home/201.webp', tint: '#DDF3EC', who: '2 à 8 joueurs', rule: 'Une lettre, vos thèmes, et le premier qui a tout rempli crie STOP.' },
  { key: 'dexrace', name: 'Course au Pokédex', art: 'img/home/479.webp', tint: '#E3ECFF', who: '2 à 8 joueurs', rule: 'Une grille de Pokémon : le premier qui trouve prend la case.' },
  // Les 8 autres jeux du salon (Kayan : « il y en a plus ») : mêmes modes que le choix de l'hôte dans le salon.
  { key: 'coop', name: 'Enquête coop', art: 'img/art/65.webp', tint: '#FFF1C7', who: '2 à 8 joueurs', rule: 'Tous dans la même équipe : chacun a des indices différents, 12 essais communs, 3 minutes.' },
  { key: 'deduction', name: 'Pokémon mystère', art: 'img/art/151.webp', tint: '#FBE3EE', who: '2 à 8 joueurs', rule: 'Le duel jusqu’à 8 : indices privés, proximité des autres en %, le premier qui trouve gagne.' },
  { key: 'guess', name: 'Course Pokémon', art: 'img/art/149.webp', tint: '#FFE9D2', who: '2 à 8 joueurs', rule: 'Devine le Pokémon le plus vite possible : les points dépendent du rang.' },
  { key: 'nearest', name: 'Numéro mystère', art: 'img/art/137.webp', tint: '#E3F1FF', who: '2 à 8 joueurs', rule: 'Un numéro du Pokédex est tiré : le Pokémon le plus proche gagne.' },
  { key: 'typecombo', name: 'Combo de types', art: 'img/art/493.webp', tint: '#F1ECDD', who: '2 à 8 joueurs', rule: 'Deux types tirés au sort : le premier Pokémon valide marque la manche.' },
  { key: 'duocriteria', name: 'Duo de critères', art: 'img/art/233.webp', tint: '#E8F4FF', who: '2 à 8 joueurs', rule: 'Deux critères croisés (type, couleur, habitat…) : le premier qui coche les deux gagne.' },
  { key: 'statclashparty', name: 'Stat Clash Party', art: 'img/art/107.webp', tint: '#F2E6FF', who: '2 à 8 joueurs', rule: 'Six manches, une par statistique : tu marques la vraie valeur de la stat choisie.' },
  { key: 'statclash', name: 'Meilleure stat', art: 'img/art/106.webp', tint: '#EAF6E6', who: '2 à 8 joueurs', rule: 'Choisis la stat la plus élevée du Pokémon : les bons choix marquent des points.' },
];
var PL3_DUEL_ART = { openMultiplayerMode: 25, openStatClashMode: 68, openStatAuctionMode: 52, openDefiAmiFromAllModes: 448 };
var PL3_NEW_UNTIL = Date.parse('2026-11-13T00:00:00+01:00'); // même date que le badge « Nouveau » de Dessine-le !

function pl3Game(key) {
  for (var i = 0; i < PL3_GAMES.length; i++) if (PL3_GAMES[i].key === key) return PL3_GAMES[i];
  return null;
}
function pl3Pending() {
  return typeof partyRoomState !== 'undefined' && partyRoomState ? pl3Game(partyRoomState.pendingMode) : null;
}

function pl3Build() {
  var lobby = document.getElementById('party-lobby');
  if (!lobby || lobby.querySelector('.pl3')) return;
  var entry = lobby.querySelector('.party-entry-panel');
  if (!entry) return;
  var pl3 = document.createElement('div');
  pl3.className = 'pl3';
  pl3.innerHTML = '<div class="pl3-feat" id="pl3-feat" aria-live="polite"></div>' +
    '<div class="pl3-menu"><p class="pl3-menu-t">En groupe · ' + PL3_GAMES.length + ' jeux<span class="pl3-swipe" aria-hidden="true">glisse →</span></p><div class="pl3-strip" id="pl3-group">' +
    PL3_GAMES.map(function (g) {
      return '<button type="button" class="pl3-game" data-action="pl3Pick" data-args=\'["' + g.key + '"]\' data-pl3="' + g.key + '" aria-pressed="false">' +
        '<span class="pl3-thumb" style="background:' + g.tint + '"><img src="' + g.art + '" alt="" loading="lazy" decoding="async" width="96" height="96"></span>' +
        '<span class="pl3-name"><b>' + escapeHtml(g.name) + '</b><small>' + escapeHtml(g.who) + '</small></span></button>';
    }).join('') + '</div><p class="pl3-menu-t">À deux</p><div class="pl3-strip" id="pl3-duo"></div></div>';
  lobby.insertBefore(pl3, lobby.firstChild);
  // Les 4 jeux à deux d'origine (mêmes boutons, mêmes actions) rejoignent le menu, avec leur image.
  var duo = pl3.querySelector('#pl3-duo');
  lobby.querySelectorAll('.party-duels-grid .party-duel-link').forEach(function (b) {
    var id = PL3_DUEL_ART[b.getAttribute('data-action')];
    if (id && !b.querySelector('.pl3-thumb')) b.insertAdjacentHTML('afterbegin', '<span class="pl3-thumb is-duo"><img src="img/art/' + id + '.webp" alt="" loading="lazy" decoding="async" width="96" height="96"></span>');
    duo.appendChild(b);
  });
  pl3.appendChild(entry);
  lobby.classList.add('pl3-on');
  pl3Paint();
}

function pl3FeatHtml(g) {
  if (!g) {
    return '<div class="pl3-stage is-any"><img class="pl3-f is-l" src="img/art/25.webp" alt="" aria-hidden="true"><img class="pl3-f is-r" src="img/art/39.webp" alt="" aria-hidden="true">' +
      '<span class="pl3-tag">ENTRE AMIS · SANS COMPTE</span><h3>Joue avec tes amis</h3><p>Choisis un jeu ci-dessous, ou crée ton salon et choisis-le dedans.</p></div>';
  }
  var isNew = g.key === 'dessin' && Date.now() < PL3_NEW_UNTIL;
  return '<div class="pl3-stage" style="--pl3-tint:' + g.tint + '">' + (isNew ? '<span class="pl3-new">NOUVEAU</span>' : '') +
    '<h3>' + escapeHtml(g.name) + '</h3><p>' + escapeHtml(g.rule) + '</p><span class="pl3-who">👥 ' + escapeHtml(g.who) + '</span>' +
    '<img class="pl3-hero" src="' + g.art + '" alt="" aria-hidden="true"></div>';
}
function pl3Paint() {
  var feat = document.getElementById('pl3-feat');
  if (!feat) return;
  var g = pl3Pending(), html = pl3FeatHtml(g);
  if (feat.dataset.html !== html) { feat.innerHTML = html; feat.dataset.html = html; }
  document.querySelectorAll('#pl3-group .pl3-game').forEach(function (b) {
    var on = !!g && b.getAttribute('data-pl3') === g.key;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  var create = document.querySelector('#party-lobby .party-entry-panel [data-action="partyCreateRoom"]');
  if (create) {
    var label = g ? '▶ Lancer ' + g.name : 'Créer mon salon';
    if (create.dataset.pl3 !== label) { create.innerHTML = escapeHtml(label) + (g ? '' : ' <span aria-hidden="true">→</span>'); create.dataset.pl3 = label; }
  }
}

// Une vignette « En groupe » : choisie = le jeu du salon (comme depuis l'accueil) ; touchée à nouveau = plus de jeu choisi.
function pl3Pick(key) {
  if (typeof partyRoomState === 'undefined' || !partyRoomState || !pl3Game(key)) return;
  if (partyRoomState.room) { if (typeof openPartyRoomWithGame === 'function') openPartyRoomWithGame(key); return; }
  if (partyRoomState.pendingMode === key) { if (typeof clearPartyPendingGame === 'function') clearPartyPendingGame(); else partyRoomState.pendingMode = null; }
  else { partyRoomState.pendingMode = key; if (typeof renderPartyPendingGame === 'function') renderPartyPendingGame(); }
  if (typeof partyPrefillNickname === 'function') partyPrefillNickname();
  pl3Paint();
}
window.pl3Pick = pl3Pick;

if (typeof renderPartyPendingGame === 'function') {
  var renderPartyPendingGameBeforePl3 = renderPartyPendingGame;
  renderPartyPendingGame = function () {
    var out = renderPartyPendingGameBeforePl3.apply(this, arguments);
    pl3Build();
    pl3Paint();
    return out;
  };
}
if (typeof openPartyRoomMode === 'function') {
  var openPartyRoomModeBeforePl3 = openPartyRoomMode;
  openPartyRoomMode = function () {
    var out = openPartyRoomModeBeforePl3.apply(this, arguments);
    pl3Build();
    pl3Paint();
    if (typeof partyPrefillNickname === 'function') partyPrefillNickname();
    return out;
  };
}
pl3Build();
