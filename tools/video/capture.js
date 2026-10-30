// Films the local site with a CDP screencast and logs timed events for the composer.
const fs = require('fs');
const path = require('path');
const { open, BASE } = require('./common');

async function capture(name, script, opts = {}) {
  const dir = path.join(__dirname, 'raw', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const { browser, ctx, page, failed } = await open(opts);
  if (opts.before) await opts.before(page, ctx);
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  const events = [];
  let t0 = null;
  let writing = Promise.resolve();
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    if (t0 === null) return;
    const t = metadata.timestamp - t0;
    if (t < 0) return;
    const file = String(frames.length).padStart(5, '0') + '.jpg';
    frames.push({ t, file });
    writing = writing.then(() => fs.promises.writeFile(path.join(dir, file), Buffer.from(data, 'base64')));
  });
  const now = () => Date.now() / 1000 - t0;
  const rects = [];
  const SEL = opts.selectors || [];
  const snap = async () => {
    try {
      const r = await page.evaluate((sel) => Object.fromEntries(sel.map((s) => { const e = document.querySelector(s); if (!e) return [s, null]; const b = e.getBoundingClientRect(); return [s, [b.x, b.y, b.width, b.height]]; })), SEL);
      rects.push({ t: now(), r });
    } catch (_) {}
  };
  let snapping = true;
  const snapLoop = (async () => { while (t0 === null) await new Promise((r) => setTimeout(r, 20)); while (snapping) { await snap(); await new Promise((r) => setTimeout(r, 150)); } })();
  const api = {
    page,
    mark: (type, extra = {}) => events.push({ t: now(), type, ...extra }),
    wait: (ms) => page.waitForTimeout(ms),
    async tap(selector, type = 'tap') {
      const box = await page.locator(selector).first().boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      events.push({ t: now(), type, x, y });
      await page.locator(selector).first().click();
    },
    async typeGuess(text, { delay = 85, pause = 350 } = {}) {
      await api.tap('#guess-input', 'focus');
      await page.locator('#guess-input').fill('');
      await page.locator('#guess-input').pressSequentially(text, { delay });
      await page.waitForTimeout(pause);
      await api.tap('#btn-submit', 'submit');
      events[events.length - 1].guess = text;
    },
  };
  await script.setup?.(api);
  await page.waitForTimeout(400);
  t0 = Date.now() / 1000;
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: opts.q || 82, everyNthFrame: 1, maxWidth: Math.round((opts.w || 432) * (opts.dpr || 2.5)), maxHeight: Math.round((opts.h || 768) * (opts.dpr || 2.5)) });
  await script.run(api);
  snapping = false; await snapLoop;
  await cdp.send('Page.stopScreencast');
  await writing;
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ frames, events, rects, duration: now(), viewport: { w: opts.w || 432, h: opts.h || 768, dpr: opts.dpr || 2.5 } }, null, 1));
  console.log([...new Set(failed)].slice(0,5)); console.log(name, 'frames', frames.length, 'dur', now().toFixed(1), 'fps~', (frames.length / now()).toFixed(1), 'failed', [...new Set(failed)].length);
  await browser.close();
  return { frames, events };
}
module.exports = { capture, BASE };
