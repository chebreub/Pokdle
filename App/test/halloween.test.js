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
      setAttribute() {}, addEventListener() {}, getBoundingClientRect: () => ({ top: 180, bottom: 100 }),
      appendChild(child) { this.children.push(child); child.parent = this; child.removed = false; },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.removed = true; }
    };
    elements.push(el);
    return el;
  }
  const body = element(), hero = element(), logo = element(), header = element();
  body.dataset.screen = 'screen-config';
  const document = { body, hidden: false, readyState: 'complete', activeElement: { matches: () => false },
    getElementById: id => id === 'daily-hero' || id === 'screen-config' ? hero : elements.find(e => e.id === id && !e.removed),
    querySelector: s => s.includes('logo-home') ? logo : s.includes('header') ? header : null,
    createElement(tag) { const el = element(); el.tag = tag; return el; },
    addEventListener(name, cb) { events[name] = cb; }
  };
  const media = { matches: false, addEventListener() {} };
  const ctx = { Date: FakeDate, Intl, document, innerHeight: 900,
    window: { matchMedia: () => media, addEventListener(name, cb) { events[name] = cb; } },
    MutationObserver: class { constructor(cb) { mutation = cb; } observe() {} },
    setTimeout(cb, delay) { const id = ++nextId; timers.set(id, { cb, at: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); }, queueMicrotask: cb => cb()
  };
  vm.createContext(ctx); vm.runInContext(source, ctx);
  function advance(ms) {
    const target = clock + ms;
    for (let count = 0; count < 100; count++) {
      const item = [...timers].filter(([,t]) => t.at <= target).sort((a,b) => a[1].at - b[1].at)[0];
      if (!item) break;
      timers.delete(item[0]); clock = item[1].at; item[1].cb();
    }
    clock = target;
  }
  return { ctx, body, hero, logo, elements, timers, events, document, media, advance,
    mutation: () => mutation(), stage: () => document.getElementById('halloween-stage'),
    images: () => elements.filter(el => el.tag === 'img') };
}

test('Halloween begins/ends on the Paris calendar, including the DST boundary', () => {
  const {ctx} = fixture();
  for (const [iso, expected] of [
    ['2026-10-14T21:59:59Z', false], ['2026-10-14T22:00:00Z', true],
    ['2026-11-01T22:59:59Z', true], ['2026-11-01T23:00:00Z', false],
    ['2026-12-25T12:00:00Z', false], ['2027-10-31T12:00:00Z', true]
  ]) assert.equal(ctx.halloweenInSeason(new Date(iso)), expected, iso);
});

test('game screens, typing, dialogs, hidden tabs and reduced motion prohibit visitors', () => {
  const {ctx} = fixture();
  const state = { active:true, screen:'screen-config', hidden:false, reduced:false, modal:false, editing:false };
  assert.equal(ctx.halloweenMayAnimate(state), true);
  for (const flag of ['hidden','reduced','modal','editing']) assert.equal(ctx.halloweenMayAnimate({...state, [flag]:true}), false);
  for (const screen of ['screen-game','screen-speedrun','screen-multiplayer','screen-wordle','screen-petit-bac'])
    assert.equal(ctx.halloweenMayAnimate({...state, screen}), false, screen);
});

test('outside the season there are no decorations or visitor image requests', () => {
  const f = fixture('2026-11-02T12:00:00Z'); f.advance(120000);
  assert.equal(f.stage(), undefined); assert.equal(f.images().length, 0);
  assert.equal(f.logo.children.length, 0); assert.equal(f.hero.children.length, 0);
});

test('one visitor loads after a pause, and leaving home removes it immediately', () => {
  const f = fixture(); f.advance(6500);
  assert.equal(f.images().length, 1); f.images()[0].onload();
  assert.equal(f.stage().children.length, 1);
  f.body.dataset.screen = 'screen-game'; f.mutation();
  assert.equal(f.stage().children.length, 0);
  f.advance(120000); assert.equal(f.images().length, 1);
});

test('late image loads cannot create a visitor on a game screen', () => {
  const f = fixture(); f.advance(6500);
  f.body.dataset.screen = 'screen-game'; f.mutation(); f.images()[0].onload();
  assert.equal(f.stage().children.length, 0);
});

test('hidden tabs cancel arrivals and resume without a burst', () => {
  const f = fixture(); f.document.hidden = true; f.events.visibilitychange();
  f.advance(180000); assert.equal(f.images().length, 0); assert.equal(f.timers.size, 0);
  f.document.hidden = false; f.events.visibilitychange();
  f.advance(6499); assert.equal(f.images().length, 0);
  f.advance(1); assert.equal(f.images().length, 1);
});

test('seasonal opt-out removes the costume, and re-enabling does not duplicate it', () => {
  const f = fixture();
  f.body.classList.toggle('seasonal-disabled', true); f.mutation();
  assert.equal(f.stage(), undefined); assert.equal(f.logo.children.length, 0); assert.equal(f.hero.children.length, 0);
  f.body.classList.toggle('seasonal-disabled', false); f.mutation(); f.mutation();
  assert.equal(f.logo.children.length, 1); assert.equal(f.hero.children.length, 4);
  assert.equal(f.body.children.filter(e => e.id === 'halloween-stage').length, 1);
});

test('reduced motion retains the static costume but stops arrivals', () => {
  const f = fixture(); f.media.matches = true; f.mutation(); f.advance(120000);
  assert.equal(f.logo.children.length, 1); assert.equal(f.images().length, 0);
});

test('a failed image is discarded and another visit remains possible', () => {
  const f = fixture(); f.advance(6500); f.images()[0].onerror();
  assert.equal(f.stage().children.length, 0); f.advance(41000);
  assert.ok(f.images().length >= 2);
});
