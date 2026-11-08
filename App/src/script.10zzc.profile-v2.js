// 📱 Profil plus court (9/11/2026, maquette validée : « go »).
// Kayan : « il faudra repenser la page profil sur PC et surtout sur iPhone » (carte trop haute,
// tuiles répétées, chiffres en double). Sur téléphone : carte de dresseur basse (partenaire · nom · niveau),
// barre d'XP sur une ligne, « ✏️ Modifier » en haut, les 4 tuiles sur une ligne, « Mes chiffres » en 3 colonnes.
// Partout : les onglets Pokédex / Missions / Secrets (en double avec les 4 tuiles, qui y mènent déjà) sont cachés.
// Rien n'est retiré de la page : mêmes boutons, mêmes actions (la QA s'en sert).

function pf2Paint() {
  var screen = document.getElementById('screen-profile');
  if (!screen) return;
  // « ✏️ Modifier » dans la barre du haut (le bouton de la carte reste pour le PC).
  var head = screen.querySelector('.ranking-head-actions');
  if (head && !head.querySelector('.pf2-edit')) {
    head.insertAdjacentHTML('afterbegin', '<button type="button" class="btn-ghost pf2-edit" data-action="openProfileEditor">✏️ Modifier</button>');
  }
  var back = screen.querySelector('.ranking-head-actions [data-action="goToConfig"]');
  if (back && !back.querySelector('.pf2-long')) {
    back.setAttribute('aria-label', 'Retour');
    back.innerHTML = '<span aria-hidden="true">←</span><span class="pf2-long"> Retour</span>';
  }
  // La barre d'XP : la même progression que l'anneau du niveau.
  var text = screen.querySelector('.profile-hero-level-text');
  var fill = screen.querySelector('.profile-hero-level .profile-ring-fill');
  if (text && fill) {
    var parts = String(fill.getAttribute('stroke-dasharray') || '').split(/\s+/).map(Number);
    var pct = parts.length === 2 && parts[1] > 0 ? Math.max(0, Math.min(100, Math.round(parts[0] * 100 / parts[1]))) : 0;
    var bar = text.querySelector('.pf2-xpbar');
    if (!bar) {
      text.insertAdjacentHTML('afterbegin', '<i class="pf2-xpbar" aria-hidden="true"><b></b></i>');
      bar = text.querySelector('.pf2-xpbar');
    }
    bar.firstChild.style.width = pct + '%';
  }
  // Les onglets en double avec les 4 tuiles.
  screen.querySelectorAll('.profile-tabs > button').forEach(function (b) {
    var action = b.getAttribute('data-action'), args = b.getAttribute('data-args') || '';
    var dup = action === 'openPokedexCollection' || (action === 'switchProfileView' && /album|secrets/.test(args));
    b.classList.toggle('pf2-dup', dup);
  });
}

// La carte se redessine parfois après le profil (niveau, médailles) : la barre revient alors aussi.
var pf2Observer = null;
function pf2Watch() {
  var card = document.getElementById('profile-trainer-card');
  if (!card || pf2Observer || typeof MutationObserver === 'undefined') return;
  pf2Observer = new MutationObserver(function () {
    if (card.querySelector('.profile-hero-level-text') && !card.querySelector('.pf2-xpbar')) { try { pf2Paint(); } catch (_e) {} }
  });
  pf2Observer.observe(card, { childList: true, subtree: true });
}

if (typeof renderProfileScreen === 'function') {
  var renderProfileScreenBeforePf2 = renderProfileScreen;
  renderProfileScreen = function () {
    var out = renderProfileScreenBeforePf2.apply(this, arguments);
    try { pf2Paint(); pf2Watch(); } catch (_e) {}
    return out;
  };
}
