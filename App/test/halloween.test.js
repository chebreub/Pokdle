'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/script.13.halloween.js'), 'utf8');

function fixture(iso = '2026-10-21T12:00:00Z') {
  const elements = [], timers = new Map(), events = {};
  let mutation, clock = 0, nextId = 0;
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [iso])); } }
  function element() {
    const classes = new Set();
    const el = { children: [], style: { setProperty() {} }, dataset: {},
      classList: { contains: x => classes.has(x), toggle: (x, on) => on ? classes.add(x) : classes.delete(x) },
      setAttribute() {}, addEventListener() {},
      getBoundingClientRect: () => ({ top:180, bottom:500, left:220, right:1146, width:926, height:320 }),
      appendChild(child) {
        child.remove();
        this.children.push(child); child.parentNode = this; child.removed = false;
        return child;
      },
      insertBefore(child, ref) {
        child.remove();
        this.children.splice(this.children.indexOf(ref), 0, child);
        child.parentNode = this; child.removed = false;
      },
      remove() {
        if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this);
        this.parentNode = null; this.removed = true;
      }
    };
    elements.push(el); return el;
  }
  const body = element(), hero = element(), logo = element(), header = element(), ball = element();
  logo.appendChild(ball);
  header.getBoundingClientRect = () => ({ bottom:100 });
  body.dataset.screen = 'screen-config';
  const document = { body, hidden:false, readyState:'complete',
    getElementById: id => id === 'daily-hero' || id.startsWith('screen-') ? hero : elements.find(e => e.id === id && !e.removed),
    querySelector: s => s.includes('pokeball-icon') ? ball : s.includes('logo-home') ? logo : s.includes('header') ? header : null,
    querySelectorAll: () => [],
    createElement(tag) { const el = element(); el.tag = tag; return el; },
    addEventListener(name, cb) { events[name] = cb; }
  };
  const media = { matches:false, addEventListener() {} };
  const ctx = { Date:FakeDate, Intl, document, innerHeight:900, innerWidth:1366,
    Math:Object.assign(Object.create(Math), { random:() => .6 }),
    window: { matchMedia:() => media, addEventListener(name, cb) { events[name] = cb; } },
    MutationObserver:class { constructor(cb) { mutation = cb; } observe() {} },
    setTimeout(cb, delay) { const id = ++nextId; timers.set(id, { cb, at:clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.createContext(ctx); vm.runInContext(source, ctx);
  function advance(ms) {
    const target = clock + ms;
    for (let count = 0; count < 1000; count++) {
      const item = [...timers].filter(([,t]) => t.at <= target).sort((a,b) => a[1].at - b[1].at)[0];
      if (!item) break;
      timers.delete(item[0]); clock = item[1].at; item[1].cb();
    }
    clock = target;
  }
  return { ctx, body, hero, logo, ball, elements, timers, events, document, media, advance,
    mutation:() => mutation(), stage:() => document.getElementById('halloween-stage'),
    images:() => elements.filter(el => el.tag === 'img') };
}

test('season follows the Paris calendar, including the DST boundary', () => {
  const {ctx} = fixture();
  for (const [iso, expected] of [
    ['2026-10-14T21:59:59Z', false], ['2026-10-14T22:00:00Z', true],
    ['2026-11-01T22:59:59Z', true], ['2026-11-01T23:00:00Z', false],
    ['2026-12-25T12:00:00Z', false], ['2027-10-31T12:00:00Z', true]
  ]) assert.equal(ctx.halloweenInSeason(new Date(iso)), expected, iso);
});

test('visits are available beyond home, but dialogs, typing and reduced motion stop them', () => {
  const {ctx} = fixture();
  const state = { active:true, screen:'screen-config', hidden:false, reduced:false, modal:false, editing:false };
  for (const flag of ['hidden','reduced','modal','editing']) assert.equal(ctx.halloweenMayAnimate({...state, [flag]:true}), false);
  for (const screen of ['screen-game','screen-pokedex','screen-profile','screen-wordle','screen-party-room'])
    assert.equal(ctx.halloweenMayAnimate({...state, screen}), true, screen);
});

test('placement never covers controls and cannot cross a game board', () => {
  const {ctx} = fixture();
  const options = { width:1366, height:900, top:100, content:{top:220},
    blockers:[{left:200,right:1166,top:220,bottom:850}], roaming:true, small:false, roll:.2 };
  assert.equal(ctx.halloweenChoosePlacement(options).kind, 'crossing');
  const game = ctx.halloweenChoosePlacement({...options, roaming:false});
  assert.notEqual(game.kind, 'crossing');
  assert.ok(game.x + game.size < 200 || game.x > 1166);
  assert.equal(ctx.halloweenChoosePlacement({...options, blockers:[{left:0,right:1366,top:100,bottom:900}]}), null);
  assert.equal(ctx.halloweenChoosePlacement({...options, height:180}), null);
});

test('outside the season no costume or artwork is requested', () => {
  const f = fixture('2026-11-02T12:00:00Z'); f.advance(120000);
  assert.equal(f.stage(), undefined); assert.equal(f.images().length, 0);
  assert.equal(f.ball.parentNode, f.logo); assert.equal(f.hero.children.length, 0);
});

test('first visit is prompt and navigation discards stale image callbacks', () => {
  const f = fixture(); f.advance(1599); assert.equal(f.images().length, 0);
  f.advance(1); assert.equal(f.images().length, 1);
  const stale = f.images()[0];
  f.body.dataset.screen = 'screen-game'; f.mutation(); stale.onload();
  assert.equal(f.stage().children.length, 0);
  f.advance(1600); f.images()[1].onload();
  assert.equal(f.stage().children.length, 1);
  assert.ok(!f.stage().children[0].className.includes('crossing'));
});

test('24 different local species appear before repeats, with bounded pauses and one actor', () => {
  const f = fixture(), seen = [];
  f.advance(1600);
  for (let i = 0; i < 24; i++) {
    const image = f.images().at(-1);
    seen.push(image.src); image.onload();
    assert.equal(f.stage().children.length, 1);
    assert.ok(fs.existsSync(path.join(__dirname, '..', image.src)));
    f.advance(8700); // 8.2 second non-crossing appearance plus fallback allowance.
    assert.equal(f.stage().children.length, 0);
    f.advance(7200); // Deterministic desktop pause at random=.6.
    assert.equal(f.images().length, i + 2);
  }
  assert.equal(new Set(seen).size, 24);
  assert.notEqual(f.images().at(-1).src, seen.at(-1));
});

test('typing cancels a visit, and idle input focus does not disable an entire game', () => {
  const f = fixture(); f.advance(1600); f.images()[0].onload();
  f.events.input({target:{matches:() => true}});
  assert.equal(f.stage().children.length, 0);
  f.advance(2199); assert.equal(f.images().length, 1);
  f.advance(1601); assert.equal(f.images().length, 2);
});

test('hidden tabs cancel arrivals and resume without a burst', () => {
  const f = fixture(); f.document.hidden = true; f.events.visibilitychange();
  f.advance(180000); assert.equal(f.images().length, 0); assert.equal(f.timers.size, 0);
  f.document.hidden = false; f.events.visibilitychange();
  f.advance(1599); assert.equal(f.images().length, 0);
  f.advance(1); assert.equal(f.images().length, 1);
});

test('opt-out restores the original ball node and re-enable creates only one costume', () => {
  const f = fixture();
  assert.notEqual(f.ball.parentNode, f.logo);
  f.body.classList.toggle('seasonal-disabled', true); f.mutation();
  assert.equal(f.stage(), undefined); assert.equal(f.ball.parentNode, f.logo);
  assert.equal(f.logo.children.length, 1); assert.equal(f.hero.children.length, 0);
  f.body.classList.toggle('seasonal-disabled', false); f.mutation(); f.mutation();
  assert.equal(f.logo.children.length, 1); assert.equal(f.ball.parentNode.children.length, 2);
  assert.equal(f.hero.children.length, 4);
  assert.equal(f.body.children.filter(e => e.id === 'halloween-stage').length, 1);
});

test('reduced motion retains the static costume but stops arrivals', () => {
  const f = fixture(); f.media.matches = true; f.mutation(); f.advance(120000);
  assert.equal(f.logo.children.length, 1); assert.equal(f.images().length, 0);
});

test('failed artwork cannot stall the schedule', () => {
  const f = fixture(); f.advance(1600); f.images()[0].onerror();
  assert.equal(f.stage().children.length, 0);
  f.advance(7200); assert.equal(f.images().length, 2);
});
