
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
    && ['screen-config', 'screen-all-modes', 'screen-leaderboard'].includes(state.screen);
}

(function installHalloween() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  function init() {
    const body = document.body;
    if (!body || document.getElementById('halloween-stage')) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const small = window.matchMedia('(max-width: 640px)');
    const visitors = [92, 93, 94, 198, 425, 607, 778];
    let stage = null, actor = null, arrival = null, departure = null, calendar = null;
    let enabled = false, lastVisitor = -1, bag = [];
    const decorations = [];
    const hat = '<svg viewBox="0 0 80 68" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 52 34 15 53 7 47 22 61 52Z" fill="#453153" stroke="#2F223E" stroke-width="2.5" stroke-linejoin="round"/><path d="m34 15 3 27 10-20 6-15Z" fill="#624375"/><path d="m24 41 32-1 4 10-40 3Z" fill="#E79950"/><path d="M38 41h10v10H38z" fill="#F7CF82" stroke="#46304F" stroke-width="2"/><path d="M41 44h4v4h-4z" fill="#56365F"/><path d="M7 54c11-9 53-12 66-2 6 7-14 10-31 10S3 61 7 54Z" fill="#453153" stroke="#2F223E" stroke-width="2.5"/><path d="M12 54c14-4 40-6 53-2" stroke="#81608D" stroke-width="2" stroke-linecap="round"/><path d="m55 10 2 4 4 1-4 2-1 4-2-4-4-1 4-2Z" fill="#F7CF82"/></svg>';
    const web = '<svg viewBox="0 0 112 112" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke="currentColor" stroke-width="1.15"><path d="M111 1H1m110 0v110M111 1 32 80M111 1 10 43M111 1 69 102"/><path d="M87 1q-1 6 2 9-5 3-6 7-6 1-8 6-4-3-9-3M63 1q-1 12 5 18-9 6-12 14-10 2-14 11-7-6-15-6M38 1q-1 18 9 28-14 8-18 21-15 2-20 15M111 25q-6 1-9-2-3 5-7 6-1 6-6 8 3 4 3 9M111 50q-12 1-18-5-6 9-14 12-2 10-11 14 6 7 6 15M111 76q-18 1-28-9-8 14-21 18-2 15-15 20"/></g></svg>';

    function decorate(parent, className, html) {
      if (!parent) return;
      const element = document.createElement('span');
      element.className = className;
      element.setAttribute('aria-hidden', 'true');
      element.innerHTML = html;
      parent.appendChild(element);
      decorations.push(element);
    }

    function mount() {
      decorate(document.querySelector('#logo-home .logo-row'), 'halloween-hat', hat);
      const hero = document.getElementById('daily-hero');
      decorate(hero, 'halloween-web halloween-web-top', web);
      decorate(hero, 'halloween-web halloween-web-bottom', web);
      decorate(hero, 'halloween-season-label', '<span>✦</span> Petits frissons d’octobre');
      decorate(hero, 'halloween-pumpkin', '<img src="/img/halloween/710.webp" width="68" height="68" alt="" draggable="false">');
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
        modal: body.classList.contains('modal-open'),
        editing: Boolean(document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')),
        screen: body.dataset.screen
      });
    }

    function nextVisitor() {
      if (!bag.length) {
        bag = [...visitors];
        // Fisher-Yates: everyone gets a visit before the next cycle.
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
      const delay = first ? 6500 : (small.matches ? 32000 : 22000) + Math.random() * 18000;
      arrival = setTimeout(visit, delay);
    }

    function finishVisit() {
      clearVisitor();
      planVisit();
    }

    function visit() {
      arrival = null;
      if (!allowed() || !stage) return;
      const id = nextVisitor();
      const fromRight = Math.random() > .5;
      const contentId = body.dataset.screen === 'screen-config' ? 'daily-hero' : body.dataset.screen;
      const hero = document.getElementById(contentId)?.getBoundingClientRect();
      const header = document.querySelector('body > header')?.getBoundingClientRect();
      const ticker = document.getElementById('news-ticker')?.getBoundingClientRect();
      const top = Math.max(0, header?.bottom || 0, ticker?.bottom || 0);
      // Cross only in the empty strip above the content. Otherwise peek at an edge.
      const crossing = !small.matches && hero && hero.top - top >= 32 && hero.top < innerHeight - 120
        && (id === 198 || Math.random() > .4);
      const duration = crossing ? (id === 198 ? 8500 : 12000) : 6800;
      const node = document.createElement('div');
      node.className = 'halloween-visitor ' + (crossing ? 'halloween-crossing' : 'halloween-peeking')
        + (fromRight ? ' is-from-right' : '') + (id === 198 ? ' is-crow' : '');
      node.style.setProperty('--visit-duration', duration + 'ms');
      if (crossing) {
        node.style.top = Math.max(top, hero.top - 54) + 'px';
      } else {
        // Keep mobile cameos above the tab bar and away from the main actions.
        node.style.top = Math.max(top + 14, Math.min(innerHeight * .7, innerHeight - 180)) + 'px';
      }
      const glow = document.createElement('span');
      glow.className = 'halloween-aura';
      const image = document.createElement('img');
      image.alt = '';
      image.width = 80;
      image.height = 80;
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
          if (event.target === node) finishVisit();
        });
        clearTimeout(departure);
        departure = setTimeout(finishVisit, duration + 500);
      };
      image.onerror = () => { if (actor === node) finishVisit(); };
      // Bound slow/missing image loads as well as animation lifetimes.
      departure = setTimeout(finishVisit, 5000);
      image.src = '/img/halloween/' + id + '.webp';
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
          stage?.remove();
          stage = null;
        }
      }
      if (allowed()) planVisit(true);
      else stopVisitors();
    }

    function checkCalendar() {
      clearTimeout(calendar);
      sync();
      // Recheck the Paris date in long-lived tabs; no animation loop when idle.
      if (!document.hidden) calendar = setTimeout(checkCalendar, 60000);
    }
    new MutationObserver(sync).observe(body, { attributes: true, attributeFilter: ['class', 'data-screen'] });
    document.addEventListener('visibilitychange', checkCalendar);
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', () => queueMicrotask(sync));
    motion.addEventListener('change', sync);
    // Never leave an old flight across content after a resize or scroll.
    window.addEventListener('resize', () => { stopVisitors(); planVisit(); }, { passive: true });
    window.addEventListener('scroll', () => { if (actor) { clearVisitor(); planVisit(); } }, { passive: true });
    window.addEventListener('pagehide', () => { stopVisitors(); clearTimeout(calendar); });
    window.addEventListener('pageshow', checkCalendar);
    checkCalendar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
