
// ===== /?pokedex=<n> : la fiche d'un Pokémon dans le Pokédex (01/11/2026) =====
// The Pokémon pages (/pokemon/<nom>, lib/seo-pokemon.js) link to the Pokédex of the site with
// « Sa fiche dans le Pokédex »: the page opens the Pokédex on that Pokémon.
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', function () {
    var match = /[?&]pokedex=(\d{1,4})\b/.exec(location.search || '');
    if (!match) return;
    var id = Number(match[1]);
    try {
      var params = new URLSearchParams(location.search);
      params.delete('pokedex');
      var query = params.toString();
      history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash);
    } catch (_e) {}
    if (!(id >= 1 && id <= 1025)) return;
    setTimeout(function () {
      if (typeof openPokedexMode !== 'function') return;
      openPokedexMode();
      if (typeof openPokedexRecent === 'function') openPokedexRecent(id);
      if (typeof showPokedexMobileDetail === 'function') showPokedexMobileDetail();
    }, 700);
  });
}
