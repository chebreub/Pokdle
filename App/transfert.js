// Runs on the old address (pokdle.onrender.com/transfert, see lib/site-move.js): hands the
// progress this browser saved there to the server for a one-time token, then goes back to the
// new address with it. If anything fails, the player still lands on the new address.
(function () {
  var site = document.documentElement.getAttribute('data-site') || '';
  var query = new URLSearchParams(location.search);
  var back = query.get('retour') || '/';
  if (back.charAt(0) !== '/' || back.charAt(1) === '/') back = '/';
  function leave(token) {
    var url = site + back;
    if (token) url += (url.indexOf('?') < 0 ? '?' : '&') + 'transfert=' + encodeURIComponent(token);
    location.replace(url);
  }
  // A cache the new address rebuilds by itself.
  var skip = { pokedle_form_sprites_v3: true };
  var data = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && !skip[key]) data[key] = localStorage.getItem(key);
    }
  } catch (_error) { /* storage blocked: only the cookies move */ }
  fetch('/api/transfert', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nonce: query.get('n') || '', data: data }),
  }).then(function (response) { return response.ok ? response.json() : null; })
    .then(function (result) { leave(result && result.token); }, function () { leave(null); });
})();
