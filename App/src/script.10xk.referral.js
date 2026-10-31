
// ===== 🎁 Invite un ami (31/10/2026) =====
// A signed-in player shares pokdle.fr/?ami=<public id>. The friend's browser keeps that id; at the
// friend's very first Pokémon du jour found, the server checks it and both get +100 XP (the friend
// at once, the referrer at their next visit). The server decides; the page only shows and awards.
var REFERRAL_KEY = 'pokedle.referrer';
var referralMine = null;

function referralStored() {
  try { var v = JSON.parse(localStorage.getItem(REFERRAL_KEY) || 'null'); return v && /^[0-9a-f]{16}$/.test(v.pid) ? v : null; }
  catch (_e) { return null; }
}
function referralStore(value) {
  try { value ? localStorage.setItem(REFERRAL_KEY, JSON.stringify(value)) : localStorage.removeItem(REFERRAL_KEY); } catch (_e) {}
}

// Arriving from a friend's link: remember who invited, clean the address, say what is on offer.
function captureReferralFromUrl() {
  var match = /[?&]ami=([0-9a-f]{16})\b/.exec(location.search || '');
  if (!match) return;
  if (!referralStored()) referralStore({ pid: match[1], at: Date.now() });
  try {
    var params = new URLSearchParams(location.search);
    params.delete('ami');
    var query = params.toString();
    history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash);
  } catch (_e) {}
  setTimeout(function () {
    if (typeof showToast === 'function') showToast('🎁 Un ami t’invite : trouve ton premier Pokémon du jour, +100 XP pour vous deux !');
  }, 2200);
}

function sendReferralFriendWin() {
  var stored = referralStored();
  if (!stored) return;
  fetch('/api/daily/referral', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: stored.pid }) })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data) return;
      if (data.ok) {
        if (typeof awardXp === 'function') awardXp(Number(data.xp) || 100, 'Parrainage', 'referral');
        if (typeof showToast === 'function') showToast('🎁 Parrainage : +' + (Number(data.xp) || 100) + ' XP pour toi et ton ami !');
      }
      // Done either way, except a passing failure: an old player, one's own link or a repeat never pays.
      if (data.ok || data.error !== 'unavailable') referralStore(null);
    })
    .catch(function () {});
}

// The referrer's bonuses for friends who joined since the last visit.
function claimReferralRewards() {
  fetch('/api/referral/mine', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data || !data.ok) return;
      referralMine = data;
      if (!(Number(data.pending) > 0)) return;
      return fetch('/api/referral/claim', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(function (res) { return res.json(); })
        .then(function (claimed) {
          if (!claimed || !claimed.ok || !(claimed.friends > 0)) return;
          if (typeof awardXp === 'function') awardXp(Number(claimed.xp) || 0, 'Parrainage', 'referral');
          referralMine.pending = 0;
          if (typeof showToast === 'function') showToast('🎁 ' + (claimed.friends > 1 ? claimed.friends + ' amis ont' : 'Un ami a') + ' trouvé son premier Pokémon du jour : +' + claimed.xp + ' XP !');
        });
    })
    .catch(function () {});
}

function referralLink(pid) {
  var origin = /pokdle\.fr$/.test(location.hostname) ? 'https://pokdle.fr' : location.origin;
  return origin + '/?ami=' + pid;
}

function inviteFriendHtml(data) {
  if (!data || !data.ok || !data.pid) {
    return '<div class="invite-friend"><p class="invite-friend-lead">Connecte-toi pour avoir ton lien d’invitation : tes amis et toi gagnez +100 XP quand ils trouvent leur premier Pokémon du jour.</p></div>';
  }
  var link = referralLink(data.pid);
  return '<div class="invite-friend">' +
    '<p class="invite-friend-lead">Envoie ton lien à un ami. Quand il trouve <b>son premier Pokémon du jour</b>, vous gagnez <b>+' + (Number(data.xp) || 100) + ' XP chacun</b>.</p>' +
    '<div class="invite-friend-link"><input id="invite-friend-url" type="text" readonly value="' + escapeHtml(link) + '" aria-label="Ton lien d’invitation" /></div>' +
    '<div class="invite-friend-actions"><button type="button" class="btn-blue" data-action="shareInviteLink">Partager mon lien</button><button type="button" class="btn-ghost" data-action="copyInviteLink">Copier</button></div>' +
    '<p class="invite-friend-count">' + (Number(data.total) > 0 ? '🎉 ' + Number(data.total) + ' ami' + (data.total > 1 ? 's' : '') + ' parrainé' + (data.total > 1 ? 's' : '') : 'Aucun ami parrainé pour l’instant.') + '</p>' +
    '</div>';
}

function openInviteFriend() {
  ensureOverlay('🎁 Invite un ami', inviteFriendHtml(referralMine));
  fetch('/api/referral/mine', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (res) { return res.json(); })
    .then(function (data) { referralMine = data && data.ok ? data : referralMine; var body = document.querySelector('#overlay-body .invite-friend'); if (body) body.outerHTML = inviteFriendHtml(referralMine); })
    .catch(function () {});
}
window.openInviteFriend = openInviteFriend;

function copyInviteLink() {
  var input = document.getElementById('invite-friend-url');
  if (!input) return;
  var done = function () { if (typeof showToast === 'function') showToast('Lien copié ✓'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(input.value).then(done).catch(function () { input.select(); });
  else { input.select(); try { document.execCommand('copy'); done(); } catch (_e) {} }
}
window.copyInviteLink = copyInviteLink;

function shareInviteLink() {
  var input = document.getElementById('invite-friend-url');
  if (!input) return;
  var text = 'Viens jouer à Pokédle avec moi : trouve le Pokémon du jour, on gagne tous les deux des XP 🎁';
  if (navigator.share) navigator.share({ title: 'Pokédle', text: text, url: input.value }).catch(function () {});
  else copyInviteLink();
}
window.shareInviteLink = shareInviteLink;

if (typeof window !== 'undefined' && window.addEventListener) {
  captureReferralFromUrl();
  window.addEventListener('pokedle:auth-ready', function (event) {
    if (event && event.detail && event.detail.user) setTimeout(claimReferralRewards, 2500);
  });
  if (typeof applyDailyObservedState === 'function') {
    var applyDailyBeforeReferral = applyDailyObservedState;
    applyDailyObservedState = function (data, options) {
      var value = applyDailyBeforeReferral.apply(this, arguments);
      if (data && data.won && options && options.awardFreshWin) setTimeout(sendReferralFriendWin, 800);
      return value;
    };
  }
}
