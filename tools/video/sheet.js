// node sheet.js name t1 t2 ... -> sheet-name.png (frames nearest to times)
const fs = require('fs'); const { execFileSync } = require('child_process');
const [name, ...ts] = process.argv.slice(2);
const idx = JSON.parse(fs.readFileSync(`raw/${name}/index.json`));
const files = ts.map(Number).map((t) => { let f = idx.frames[0]; for (const fr of idx.frames) if (fr.t <= t) f = fr; return `raw/${name}/${f.file}`; });
const inputs = files.flatMap((f) => ['-i', f]);
const filt = files.map((_, i) => `[${i}]scale=300:-1[v${i}]`).join(';') + ';' + files.map((_, i) => `[v${i}]`).join('') + `hstack=${files.length}`;
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filt, `sheet-${name}.png`]);
console.log(idx.events.map((e) => e.t.toFixed(2) + ' ' + e.type + (e.guess ? ' ' + e.guess : '')).join('\n'));
