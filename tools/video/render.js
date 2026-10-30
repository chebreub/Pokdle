// node render.js <name> [--stills t1,t2,...]  -> out/<name>.mp4 (or stills)
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const name = process.argv[2]; const si = process.argv.indexOf('--stills');
const stills = si > 0 ? process.argv[si + 1].split(',').map(Number) : null;
(async () => {
  fs.mkdirSync('out', { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('http://127.0.0.1:4180/' + (process.env.PAGE || 'compose.html'));
  const total = await page.evaluate((n) => setup(n), name);
  if (stills) {
    for (const t of stills) { await page.evaluate((t) => renderAt(t), t); await page.screenshot({ path: `out/${name}-${t}.png` }); }
    const ins = stills.flatMap((t) => ['-i', `out/${name}-${t}.png`]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...ins, '-filter_complex', stills.map((_, i) => `[${i}]scale=360:-1[v${i}]`).join(';') + ';' + stills.map((_, i) => `[v${i}]`).join('') + `hstack=${stills.length}`, `out/${name}-stills.png`]);
    console.log('total', total); await browser.close(); return;
  }
  const n = Math.round(total * 30);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', '30', `out/${name}-video.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => renderAt(t), i / 30);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(name, i, '/', n);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  const audio = await page.evaluate('(typeof S !== "undefined" && S ? S.audio : E.audio) || []');
  fs.writeFileSync(`out/${name}-audio.json`, JSON.stringify({ total, audio }));
  await browser.close();
  console.log('done', name, total);
})();
