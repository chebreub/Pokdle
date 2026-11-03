'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const balls = fs.readFileSync(path.join(__dirname, '../src/script.10xy.poke-balls.js'), 'utf8');
const helper = balls.slice(balls.indexOf('function ballPaidAction('));
function client(storage = new Map()) {
  const sent = [], applied = [];
  const c = vm.createContext({
    ballState: {actionScope: 'account-a'}, crypto: {randomUUID},
    sessionStorage: {getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k)},
    ballFetch: async (url, body) => { sent.push({url, body}); return c.response; },
    ballApply: data => applied.push(data), refreshBalls: async () => {}, response: null
  });
  vm.runInContext(helper, c);
  return {c, sent, applied, storage};
}
const url = '/api/shop/buy', buy = {item: 'poke', expectedPrice: 50};
test('uncertain purchase keeps its id through a reload; confirmed success clears it', async () => {
  const a = client(); await a.c.ballPaidAction(url, buy);
  const b = client(a.storage); b.c.response = {ok: true}; await b.c.ballPaidAction(url, buy);
  assert.equal(a.sent[0].body.actionScope, 'account-a'); assert.equal(a.sent[0].body.actionId, b.sent[0].body.actionId); assert.equal(a.storage.size, 0);
});
test('different purchase resolves pending one without sending the new intent', async () => {
  const a = client(); await a.c.ballPaidAction(url, buy); a.c.response = {ok: true};
  assert.equal((await a.c.ballPaidAction(url, {item: 'ultra', expectedPrice: 300})).error, 'previous_action');
  assert.equal(a.sent[1].body.item, 'poke'); assert.equal(a.applied.length, 1); assert.equal(a.storage.size, 0);
});
test('accounts isolate receipts and reject responses after an account switch', async () => {
  const a = client(); await a.c.ballPaidAction(url, buy); a.c.ballState.actionScope = 'account-b';
  await a.c.ballPaidAction(url, buy); assert.notEqual(a.sent[0].body.actionId, a.sent[1].body.actionId);
  a.c.ballFetch = async () => { a.c.ballState.actionScope = 'account-c'; return {ok: true}; };
  assert.equal((await a.c.ballPaidAction(url, buy)).error, 'account_changed'); assert.equal(a.applied.length, 0);
});
test('transient failures retain receipts; refusal clears them; unavailable storage sends nothing', async () => {
  const a = client(); a.c.response = {ok: false, error: 'unavailable'};
  await a.c.ballPaidAction(url, buy); assert.equal(a.storage.size, 1);
  a.c.response = {ok: false, error: 'price_changed'};
  await a.c.ballPaidAction(url, buy); assert.equal(a.storage.size, 0);
  a.c.sessionStorage.setItem = () => {throw Error('quota');};
  assert.equal((await a.c.ballPaidAction(url, buy)).error, 'storage_unavailable'); assert.equal(a.sent.length, 2);
});
test('shop confirmation binds item and price, including recharge from wild grass', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/script.10xzh.shop.js'), 'utf8'), sent = [];
  const c = vm.createContext({ shopConfirm: null, shopBusy: false, price: 100,
    shopCoins: () => ({enabled: true, balance: 1000}), shopPrice: () => c.price,
    shopRedraw: () => {}, showToast: () => {}, coinFmt: String, setTimeout: () => {},
    ballPaidAction: async (url, body) => {sent.push(body); return null;}, refreshBalls: () => {}, SHOP_ERRORS: {}
  });
  vm.runInContext(source.slice(source.indexOf('function shopBuy(item,'), source.indexOf('function shopWildRecharge')), c);
  c.shopBuy('recharge', 'wild'); assert.equal(sent.length, 0);
  c.price = 200; c.shopBuy('recharge', 'wild'); assert.equal(sent.length, 0);
  c.shopBuy('recharge', 'wild'); assert.equal(sent.length, 1); assert.equal(sent[0].expectedPrice, 200);
});
