
// Seasonal decoration only: no game state, scores, account data or network APIs.
function halloweenInSeason(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', month: 'numeric', day: 'numeric'
  }).formatToParts(now);
  const month = Number(parts.find(p => p.type === 'month').value);
  const day = Number(parts.find(p => p.type === 'day').value);
  return (month === 10 && day >= 15) || (month === 11 && day === 1);
}


function halloweenMayAnimate(state) {
  return state.active && !state.hidden && !state.reduced && !state.modal && !state.editing
    && Boolean(state.screen);
}

// All coordinates are viewport coordinates. Never put artwork over reading/playing controls.
function halloweenChoosePlacement({ width, height, top, content, blockers, roaming, small, roll }) {
  const bottom = height - (small ? 106 : 24);
  const clear = box => !blockers.some(r => r.right > box.left - 8 && r.left < box.right + 8
    && r.bottom > box.top - 8 && r.top < box.bottom + 8);
  const gap = (content?.top || 0) - top;
  if (roaming && !small && gap >= 62 && roll < .55) {
    const size = Math.min(84, gap - 12), y = top + (gap - size) / 2;
    if (y + size <= bottom && clear({ left: 0, right: width, top: y, bottom: y + size }))
      return { kind: 'crossing', size, y, right: roll > .27 };
  }
  const size = small ? 78 : 112;
  const ys = [.68, .35, .52, .82].map(p => Math.max(top + 12, Math.min(height * p, bottom - size)));
  if (bottom - top < size + 24) return null;
  const sides = roll > .5 ? [true, false] : [false, true];
  // Prefer fully visible Pokémon; a small edge peek is the fallback on dense pages.
  for (const visible of [size, small ? 42 : 64]) {
    for (const right of sides) {
      const x = right ? width - visible - 6 : visible - size + 6;
      for (const y of ys) {
        if (!clear({ left: Math.max(0, x), right: Math.min(width, x + size), top: y - 8, bottom: y + size + 8 })) continue;
        return { kind: visible < size ? 'peeking' : (roll < .45 ? 'rising' : 'appearing'), size, x, y, right };
      }
    }
  }
  return null;
}

(function installHalloween() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  function init() {
    const body = document.body;
    if (!body || document.getElementById('halloween-stage')) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const small = window.matchMedia('(max-width: 640px)');
    const localWebp = new Set([92, 93, 94, 198, 425, 607, 710, 778]);
    const visitors = [92, 93, 94, 198, 200, 302, 353, 354, 355, 425, 429, 430,
      442, 477, 479, 562, 570, 607, 609, 708, 709, 710, 778, 855];
    const browseScreens = new Set(['screen-config', 'screen-all-modes', 'screen-leaderboard',
      'screen-pokedex', 'screen-profile', 'screen-achievements', 'screen-history',
      'screen-ranking', 'screen-games-ranking', 'screen-teams', 'screen-team-builder', 'screen-type-chart']);
    const blockerSelector = 'button, a, input, textarea, select, [contenteditable="true"], h1, h2, h3, h4, p, table, '
      + '.card-title, .card-desc, .game-topbar, .search-bar, .results-wrap, .mode-banner, '
      + '.wordle-board, .dossier-board, .daily-grid, .quiz-options, .pokedex-grid, '
      + '[role="dialog"], [role="menu"], [role="listbox"]';
    let stage = null, actor = null, arrival = null, departure = null, calendar = null, typingTimer = null;
    let enabled = false, editing = false, lastVisitor = -1, bag = [], currentScreen = '';
    let costume = null, ball = null;
    const decorations = [];
    const hat = '<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 39 31 8 53 3 46 16 60 39Z" fill="#453153" stroke="#2F223E" stroke-width="2" stroke-linejoin="round"/><path d="M31 8 34 31 46 16 53 3Z" fill="#725181"/><path d="m23 29 32-1 4 10-40 2Z" fill="#E89A51"/><rect x="36" y="29" width="12" height="10" rx="1" fill="#F7D58A" stroke="#382744" stroke-width="2"/><path d="M40 32h4v4h-4z" fill="#654473"/><path d="M6 40c13-8 54-8 68 0 3 6-14 8-34 8S3 46 6 40Z" fill="#453153" stroke="#2F223E" stroke-width="2"/><path d="M12 40c14-4 41-4 56 0" stroke="#9872A4" stroke-width="2" stroke-linecap="round"/><path d="m58 6 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="#F7D58A"/></svg>';
    const web = '<svg viewBox="0 0 112 112" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke="currentColor" stroke-width="1.15"><path d="M111 1H1m110 0v110M111 1 32 80M111 1 10 43M111 1 69 102"/><path d="M87 1q-1 6 2 9-5 3-6 7-6 1-8 6-4-3-9-3M63 1q-1 12 5 18-9 6-12 14-10 2-14 11-7-6-15-6M38 1q-1 18 9 28-14 8-18 21-15 2-20 15M111 25q-6 1-9-2-3 5-7 6-1 6-6 8 3 4 3 9M111 50q-12 1-18-5-6 9-14 12-2 10-11 14 6 7 6 15M111 76q-18 1-28-9-8 14-21 18-2 15-15 20"/></g></svg>';

    function decorate(parent, className, html) {
      if (!parent) return;
      const element = document.createElement('span');
      element.className = className;
      element.setAttribute('aria-hidden', 'true');
      element.innerHTML = html;
      parent.appendChild(element);
      decorations.push(element);
      return element;
    }

    function mount() {
      ball = document.querySelector('#logo-home .pokeball-icon');
      if (ball) {
        costume = document.createElement('span');
        costume.className = 'halloween-logo-costume';
        ball.parentNode.insertBefore(costume, ball);
        costume.appendChild(ball);
        decorate(costume, 'halloween-hat', hat);
      }
      const hero = document.getElementById('daily-hero');
      decorate(hero, 'halloween-web halloween-web-top', web);
      decorate(hero, 'halloween-web halloween-web-bottom', web);
      decorate(hero, 'halloween-season-label', '<span>✦</span> La nuit des Pokémon');
      decorate(hero, 'halloween-pumpkin', '<img src="/img/halloween/710.webp" width="76" height="76" alt="" draggable="false">');
      decorate(document.querySelector('body > header'), 'halloween-web halloween-header-web', web);
      const frame = decorate(body, 'halloween-frame',
        '<span class="halloween-web halloween-frame-web">' + web + '</span>'
        + '<span class="halloween-mist halloween-mist-left"></span><span class="halloween-mist halloween-mist-right"></span>');
      if (frame) frame.id = 'halloween-frame';
      stage = document.createElement('div');
      stage.id = 'halloween-stage';
      stage.setAttribute('aria-hidden', 'true');
      stage.setAttribute('inert', '');
      body.appendChild(stage);
    }

    function clearVisitor() {
      clearTimeout(departure);
      departure = null;
      if (actor) actor.remove();
      actor = null;
    }
    function stopVisitors() {
      clearTimeout(arrival);
      arrival = null;
      clearVisitor();
    }
    function allowed() {
      return halloweenMayAnimate({
        active: enabled, hidden: document.hidden,
        reduced: motion.matches || body.classList.contains('reduce-motion'),
        modal: body.classList.contains('modal-open'), editing, screen: body.dataset.screen
      });
    }
    function nextVisitor() {
      if (!bag.length) {
        bag = [...visitors];
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag[bag.length - 1] === lastVisitor) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
      lastVisitor = bag.pop();
      return lastVisitor;
    }
    function planVisit(first = false) {
      if (!allowed() || arrival !== null || actor) return;
      const delay = first ? 1600 : (small.matches ? 7000 : 4500) + Math.random() * 4500;
      arrival = setTimeout(visit, delay);
    }
    function finishVisit() {
      clearVisitor();
      planVisit();
    }
    function visit() {
      arrival = null;
      if (!allowed() || !stage) return;
      const header = document.querySelector('body > header')?.getBoundingClientRect();
      const ticker = document.getElementById('news-ticker')?.getBoundingClientRect();
      const content = document.getElementById(body.dataset.screen === 'screen-config' ? 'daily-hero' : body.dataset.screen);
      const blockers = Array.from(document.querySelectorAll(blockerSelector), el => el.getBoundingClientRect())
        .filter(r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight);
      const place = halloweenChoosePlacement({
        width: innerWidth, height: innerHeight,
        top: Math.max(0, header?.bottom || 0, ticker?.bottom || 0),
        content: content?.getBoundingClientRect(), blockers,
        roaming: browseScreens.has(body.dataset.screen), small: small.matches, roll: Math.random()
      });
      if (!place) { planVisit(); return; }
      const id = nextVisitor(), flying = [198, 430, 425].includes(id);
      // Flyers bob; other visitors materialize, rise from the mist or peek from the edge.
      const kind = place.kind === 'appearing' && flying ? 'floating' : place.kind;
      const duration = kind === 'crossing' ? 9500 : 8200;
      const node = document.createElement('div');
      node.className = 'halloween-visitor halloween-' + kind + (place.right ? ' is-from-right' : '')
        + (flying ? ' is-flying' : '');
      node.dataset.pokemon = String(id);
      node.style.setProperty('--visit-duration', duration + 'ms');
      node.style.width = node.style.height = place.size + 'px';
      node.style.top = place.y + 'px';
      if (kind !== 'crossing') node.style.left = place.x + 'px';
      const glow = document.createElement('span');
      glow.className = 'halloween-aura';
      const image = document.createElement('img');
      image.alt = '';
      image.width = image.height = 112;
      image.draggable = false;
      image.decoding = 'async';
      const pose = document.createElement('span');
      pose.className = 'halloween-pose';
      pose.appendChild(glow);
      pose.appendChild(image);
      node.appendChild(pose);
      actor = node;
      image.onload = () => {
        if (actor !== node || !allowed()) return;
        stage.appendChild(node);
        node.addEventListener('animationend', event => {
          if (event.target === node && actor === node) finishVisit();
        });
        clearTimeout(departure);
        departure = setTimeout(() => { if (actor === node) finishVisit(); }, duration + 500);
      };
      image.onerror = () => { if (actor === node) finishVisit(); };
      departure = setTimeout(() => { if (actor === node) finishVisit(); }, 5000);
      image.src = '/img/halloween/' + id + (localWebp.has(id) ? '.webp' : '.png');
    }
    function sync() {
      const next = halloweenInSeason() && !body.classList.contains('seasonal-disabled');
      if (next !== enabled) {
        enabled = next;
        body.classList.toggle('halloween-season', enabled);
        if (enabled) mount();
        else {
          stopVisitors();
          decorations.splice(0).forEach(element => element.remove());
          if (costume && ball) { costume.parentNode.insertBefore(ball, costume); costume.remove(); }
          costume = ball = null;
          stage?.remove();
          stage = null;
        }
      }
      // Recompute placement immediately after navigation; old flights must never enter a game.
      if (currentScreen !== body.dataset.screen) {
        currentScreen = body.dataset.screen;
        stopVisitors();
      }
      if (allowed()) planVisit(true);
      else stopVisitors();
    }
    function checkCalendar() {
      clearTimeout(calendar);
      sync();
      if (!document.hidden) calendar = setTimeout(checkCalendar, 60000);
    }
    function pauseForTyping(event) {
      if (!event.target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      editing = true;
      stopVisitors();
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => { editing = false; sync(); }, 2200);
    }
    new MutationObserver(sync).observe(body, { attributes: true, attributeFilter: ['class', 'data-screen'] });
    document.addEventListener('visibilitychange', checkCalendar);
    document.addEventListener('input', pauseForTyping);
    document.addEventListener('focusin', pauseForTyping);
    motion.addEventListener('change', sync);
    window.addEventListener('resize', () => { stopVisitors(); planVisit(true); }, { passive: true });
    window.addEventListener('scroll', () => { if (actor) { clearVisitor(); planVisit(true); } }, { passive: true });
    window.addEventListener('pagehide', () => { stopVisitors(); clearTimeout(calendar); clearTimeout(typingTimer); editing = false; });
    window.addEventListener('pageshow', checkCalendar);
    checkCalendar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
