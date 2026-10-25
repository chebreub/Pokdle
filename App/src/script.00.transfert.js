// Back from the old address (lib/site-move.js): the server put the progress this browser had
// saved on pokdle.onrender.com in the page. It fills in what this address does not have yet,
// before the rest of the app reads its storage, then the address bar loses the token.
(function () {
  const holder = document.getElementById('pokedle-transfert');
  if (!holder) return;
  try {
    const saved = JSON.parse(holder.textContent || '{}');
    for (const [key, value] of Object.entries(saved)) {
      if (typeof value === 'string' && localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }
  } catch (_error) { /* storage blocked: the player keeps the cookies that moved */ }
  holder.remove();
  const url = new URL(location.href);
  url.searchParams.delete('transfert');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
})();
