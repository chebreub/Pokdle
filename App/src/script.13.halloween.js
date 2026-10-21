
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

// Moving visitors use real viewport-spanning paths; resting visitors use empty space.
function halloweenFlight({ width, height, top, small, lane, right, ascending, roll }) {
  const size = small ? 76 : 104;
  const minY = Math.max(0, top) + 10, maxY = height - size - (small ? 108 : 24);
  if (maxY < minY + 20) return null;
  const y = minY + (maxY - minY) * (lane + .2 + roll * .6) / 3;
  const endY = Math.max(minY, Math.min(maxY, y + (right ? -1 : 1) * (42 + roll * 70)));
  if (ascending) {
    const x = 10 + (width - size - 20) * (.18 + roll * .64);
    return { kind:'ascending', size, right, points:[
      [x, height + size], [x + (right ? -28 : 28), (height + minY) / 2],
      [Math.max(6, Math.min(width - size - 6, x + (right ? -56 : 56))), minY]
    ] };
  }
  return { kind:'crossing', size, right, points:[
    [right ? width + size : -size - 16, y],
    [(width - size) / 2, Math.max(minY, Math.min(maxY, y + (right ? 48 : -48)))],
    [right ? -size - 16 : width + size, endY]
  ] };
}

function halloweenChoosePlacement({ width, height, top, blockers, small, roll, previous }) {
  const size = small ? 78 : 112, bottom = height - (small ? 108 : 24);
  if (bottom - top < size + 24) return null;
  const candidates = [];
  const clear = box => !blockers.some(r => r.right > box.left - 8 && r.left < box.right + 8
    && r.bottom > box.top - 8 && r.top < box.bottom + 8);
  for (const visible of [size, small ? 42 : 64]) {
    for (const right of [false, true]) {
      const x = right ? width - visible - 6 : visible - size + 6;
      for (let y = top + 12; y <= bottom - size; y += 36) {
        if (previous && Math.abs(previous.x - x) < size && Math.abs(previous.y - y) < size * 1.3) continue;
        if (clear({left:Math.max(0,x),right:Math.min(width,x+size),top:y-8,bottom:y+size+8}))
          candidates.push({kind:visible < size ? 'peeking' : 'appearing',size,x,y,right});
      }
    }
    // Prefer an entirely visible cameo when one fits.
    if (candidates.length) break;
  }
  return candidates.length ? candidates[Math.min(candidates.length - 1, Math.floor(roll * candidates.length))] : null;
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
    const blockerSelector = 'button, a, input, textarea, select, [contenteditable="true"], h1, h2, h3, h4, p, table, '
      + '.card-title, .card-desc, .game-topbar, .search-bar, .results-wrap, .mode-banner, '
      + '.wordle-board, .dossier-board, .daily-grid, .quiz-options, .pokedex-grid, .halloween-pumpkin, '
      + '[role="dialog"], [role="menu"], [role="listbox"]';
    let stage = null, actor = null, arrival = null, departure = null, calendar = null, typingTimer = null;
    let enabled = false, editing = false, lastVisitor = -1, bag = [], currentScreen = '';
    let costume = null, ball = null;
    let visitNumber = 0, flightNumber = 0, lastLane = -1, lastRest = null;
    const decorations = [];
    const hat = '<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 39 31 8 53 3 46 16 60 39Z" fill="#453153" stroke="#2F223E" stroke-width="2" stroke-linejoin="round"/><path d="M31 8 34 31 46 16 53 3Z" fill="#725181"/><path d="m23 29 32-1 4 10-40 2Z" fill="#E89A51"/><rect x="36" y="29" width="12" height="10" rx="1" fill="#F7D58A" stroke="#382744" stroke-width="2"/><path d="M40 32h4v4h-4z" fill="#654473"/><path d="M6 40c13-8 54-8 68 0 3 6-14 8-34 8S3 46 6 40Z" fill="#453153" stroke="#2F223E" stroke-width="2"/><path d="M12 40c14-4 41-4 56 0" stroke="#9872A4" stroke-width="2" stroke-linecap="round"/><path d="m58 6 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="#F7D58A"/></svg>';
    const web = "<svg viewBox=\"0 0 128 128\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><g stroke=\"currentColor\" stroke-width=\".8\" stroke-linecap=\"round\"><path d=\"M128 0L4.0 0.0 M128 0L8.2 32.1 M128 0L20.6 62.0 M128 0L40.3 87.7 M128 0L66.0 107.4 M128 0L95.9 119.8 M128 0L128.0 124.0 \" /><path d=\"M104 0Q106.8 2.8 104.8 6.2Q108.3 8.2 107.2 12.0Q111.1 13.0 111.0 17.0Q115.0 16.9 116.0 20.8Q119.8 19.7 121.8 23.2Q125.2 21.2 128.0 24.0\"/><path d=\"M83 0Q88.3 5.2 84.5 11.6Q91.0 15.3 89.0 22.5Q96.2 24.4 96.2 31.8Q103.6 31.8 105.5 39.0Q112.7 37.0 116.4 43.5Q122.8 39.7 128.0 45.0\"/><path d=\"M59 0Q67.1 8.0 61.4 17.9Q71.3 23.5 68.2 34.5Q79.3 37.4 79.2 48.8Q90.6 48.7 93.5 59.8Q104.5 56.7 110.1 66.6Q120.0 60.9 128.0 69.0\"/><path d=\"M34 0Q45.1 10.9 37.2 24.3Q50.7 32.0 46.6 47.0Q61.6 50.9 61.5 66.5Q77.1 66.4 81.0 81.4Q96.0 77.3 103.7 90.8Q117.1 82.9 128.0 94.0\"/><path d=\"M6 0Q20.3 14.2 10.2 31.6Q27.7 41.6 22.3 61.0Q41.9 66.1 41.7 86.3Q61.9 86.1 67.0 105.7Q86.4 100.3 96.4 117.8Q113.8 107.7 128.0 122.0\"/></g><g fill=\"#FFF8EE\" opacity=\".8\"><circle cx=\"81\" cy=\"81.4\" r=\"1.5\"/><circle cx=\"61.3\" cy=\"17.9\" r=\"1.4\"/><circle cx=\"116.4\" cy=\"43.5\" r=\"1.2\"/></g><path d=\"M116 44v25\" stroke=\"currentColor\" stroke-width=\".65\"/><g stroke=\"currentColor\" stroke-width=\".8\" stroke-linecap=\"round\"><path d=\"m114 70-4-2m4 4-5 1m5 1-3 4m7-8 4-2m-4 4 5 1m-5 1 3 4\"/></g><ellipse cx=\"116\" cy=\"72\" rx=\"2.6\" ry=\"3.4\" fill=\"currentColor\"/></svg>";
    const leaves = "<svg viewBox=\"0 0 180 54\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M4 42c45-18 102 10 171-26\" stroke=\"#9C7455\" stroke-width=\"1.3\"/><path d=\"M22 35C4 34 7 12 7 12s25 4 15 23Z\" fill=\"#CB884C\"/><path d=\"M47 35c-8-20 9-29 9-29s11 24-9 29Z\" fill=\"#D8A65A\"/><path d=\"M76 36C64 40 65 54 65 54s25 0 11-18Z\" fill=\"#98709D\"/><path d=\"M107 31c-10-19 7-27 7-27s10 22-7 27Z\" fill=\"#BF794C\"/><path d=\"M139 26c-4 20 16 22 16 22s2-24-16-22Z\" fill=\"#D9AB62\"/><path d=\"m164 20 8-14m-125 27 7-20m53 16 5-18m29 17 9 15\" stroke=\"#805E4C\" stroke-width=\".8\" opacity=\".7\"/></svg>";
    const lanterns = "<svg viewBox=\"0 0 64 180\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M29 0q18 37 3 68t6 82\" stroke=\"#826385\" stroke-width=\"1\"/><path d=\"M34 25q-7-10 0-14\" stroke=\"#707A4D\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M33 26c-21-12-31 22-14 32 10 6 28 3 30-11 2-13-8-23-16-21Z\" fill=\"#E9A251\" stroke=\"#9A663E\" stroke-width=\"1.2\"/><ellipse cx=\"32\" cy=\"42\" rx=\"9\" ry=\"18\" fill=\"#F5BA6A\"/><path d=\"m23 35 5 3-5 3m17-6-5 3 5 3m-17 5q10 8 18-1\" fill=\"#FFE7A8\" stroke=\"#9A663E\" stroke-width=\".8\" stroke-linejoin=\"round\"/><path d=\"M32 92q10-8 6-17\" stroke=\"#707A4D\" stroke-width=\"2.6\" stroke-linecap=\"round\"/><path d=\"M34 93c-16-8-26 16-15 27 7 7 28 6 30-8 2-11-7-22-15-19Z\" fill=\"#806088\" stroke=\"#503D60\" stroke-width=\"1.2\"/><ellipse cx=\"34\" cy=\"108\" rx=\"7\" ry=\"16\" fill=\"#A07BA2\"/><path d=\"m26 103 1 3 3 1-3 1-1 3-1-3-3-1 3-1Zm15 0 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z\" fill=\"#FFE5A0\"/><path d=\"m29 115 5 3 6-4\" stroke=\"#FFE5A0\" stroke-width=\"1.5\"/><path d=\"m39 145 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z\" fill=\"#E8BF75\" stroke=\"#AD8552\" stroke-width=\".8\"/></svg>";

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
      decorate(hero, 'halloween-leaves', leaves);
      decorate(hero, 'halloween-season-label', '<span>✦</span> La nuit des Pokémon');
      decorate(hero, 'halloween-pumpkin', '<img src="/img/halloween/pumpkin-garden.png" width="216" height="120" alt="" draggable="false" decoding="async">');
      const frame = decorate(body, 'halloween-frame',
        '<span class="halloween-corner-pumpkins"><img src="/img/halloween/pumpkin-garden.png" width="148" height="82" alt="" draggable="false" decoding="async"></span>'
        + '<span class="halloween-lanterns">' + lanterns + '</span>'
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
      const delay = first ? 1400 : (small.matches ? 4500 : 3500) + Math.random() * 3500;
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

      const top = Math.max(0, header?.bottom || 0, ticker?.bottom || 0);
      const blockers = Array.from(document.querySelectorAll(blockerSelector))
        .filter(el => el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) !== false)
        .map(el => el.getBoundingClientRect())
        .filter(r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight);
      const roll = Math.random();
      const lane = (lastLane + 1 + Math.floor(Math.random() * 2)) % 3;
      const right = flightNumber % 2 === 1;
      // Three moving scenes per five visits; the very first is always a full crossing.
      const scene = ['crossing', 'appearing', 'crossing', 'ascending', 'peeking'][visitNumber % 5];
      let place = null;
      if (scene === 'appearing' || scene === 'peeking') {
        place = halloweenChoosePlacement({ width:innerWidth, height:innerHeight, top,
          blockers, small:small.matches, roll, previous:lastRest });
        if (place) lastRest = { x:place.x, y:place.y };
      }
      if (!place) place = halloweenFlight({ width:innerWidth, height:innerHeight, top,
        small:small.matches, roll, lane, right, ascending:scene === 'ascending' });
      if (!place) { planVisit(); return; }
      if (place.points) { lastLane = lane; flightNumber++; }
      visitNumber++;
      const id = nextVisitor(), flying = [198, 430, 425].includes(id);
      const kind = place.kind === 'appearing' && flying ? 'floating' : place.kind;
      const duration = place.points ? (small.matches ? 8200 : 10000) : 7200;
      const node = document.createElement('div');
      node.className = 'halloween-visitor halloween-' + kind + (place.right ? ' is-from-right' : '')
        + (flying ? ' is-flying' : '');
      node.dataset.pokemon = String(id);
      node.dataset.motion = place.points ? 'travel' : 'rest';
      node.dataset.duration = String(duration);
      node.style.setProperty('--visit-duration', duration + 'ms');
      node.style.width = node.style.height = place.size + 'px';
      if (place.points) {
        place.points.forEach(([x,y],i) => {
          node.style.setProperty('--x' + i, Math.round(x) + 'px');
          node.style.setProperty('--y' + i, Math.round(y) + 'px');
        });
      } else {
        node.style.top = place.y + 'px';
        node.style.left = place.x + 'px';
      }
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
    // Scrollbars, wheel gestures and scrolling keys must not cancel a viewport flight.
    function pauseForControl(event) {
      if (event.key === 'PageUp' || event.key === 'PageDown') return;
      const control = event.target?.closest?.('button, a, input, textarea, select, [role="button"], [contenteditable="true"]');
      const scrollKey = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Home','End',' ','Tab','Shift','Control','Alt','Meta'].includes(event.key);
      if (control || (event.type === 'keydown' && !scrollKey))
        pauseForTyping({target:{matches:() => true}});
    }
    document.addEventListener('pointerdown', pauseForControl, {passive:true});
    document.addEventListener('keydown', pauseForControl);
    motion.addEventListener('change', sync);
    let viewportWidth = innerWidth;
    window.addEventListener('resize', () => {
      // Mobile browser bars change height while scrolling; keep the current flight alive.
      if (innerWidth !== viewportWidth) {
        viewportWidth = innerWidth;
        stopVisitors(); planVisit(true);
      }
    }, { passive: true });
    window.addEventListener('pagehide', () => { stopVisitors(); clearTimeout(calendar); clearTimeout(typingTimer); editing = false; });
    window.addEventListener('pageshow', checkCalendar);
    checkCalendar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
