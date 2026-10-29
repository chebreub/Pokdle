// « Dessine-le ! » (29/10): one friend draws a Pokémon only they can see, the others guess it live.
// Strokes are sent in small pieces (0–1000 coordinates) and drawn the same way on every screen.
// 16 colours (30/10): the first 8 are the first row of the palette; 16 is the eraser.
const DESSIN_COLORS = ['#2E2A33', '#8E8A93', '#E8453C', '#FF9F43', '#FFD45C', '#5DBE7E', '#4069E0', '#7C5BD6',
  '#FFFFFF', '#F1D3B3', '#8E2240', '#8A5A3C', '#FFF1A8', '#2F7D4F', '#7CC8F2', '#FF8FC1'];
const DESSIN_ERASER = 16;
const DESSIN_PAPER = '#FFFDF9';
const DESSIN_SIZES = [4, 9, 18];
const DESSIN_SEND_MS = 100;
const dessinState = { key: '', pieces: [], color: 0, size: 1, tool: 'pen', stroke: 0, drawing: null, timer: null, tick: null, bound: false, offset: 0, zoom: false };

function dessinRound() {
  const room = partyRoomState.room;
  return room && room.gameMode === 'dessin' && room.round && room.round.mode === 'dessin' ? room.round : null;
}

function dessinIsDrawer(room, round) {
  const me = (room.players || []).find((p) => p.isSelf);
  return Boolean(me && round && me.id === round.drawerId);
}

function dessinColor(c) {
  return c === DESSIN_ERASER ? DESSIN_PAPER : DESSIN_COLORS[c] || DESSIN_COLORS[0];
}

// « Remplir »: the area of the same colour under the point takes the new one. Close shades count as the
// same, so the soft edges of a line are filled too; every screen replays the fills in the same order.
function dessinFill(ctx, piece) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const x0 = Math.min(w - 1, Math.round(piece.p[0] * w / 1000)), y0 = Math.min(h - 1, Math.round(piece.p[1] * h / 1000));
  const img = ctx.getImageData(0, 0, w, h), px = img.data;
  const hex = dessinColor(piece.c), fr = parseInt(hex.slice(1, 3), 16), fg = parseInt(hex.slice(3, 5), 16), fb = parseInt(hex.slice(5, 7), 16);
  const at = (y0 * w + x0) * 4, tr = px[at], tg = px[at + 1], tb = px[at + 2];
  if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 12) return;
  const near = (i) => Math.abs(px[i] - tr) + Math.abs(px[i + 1] - tg) + Math.abs(px[i + 2] - tb) <= 120;
  const seen = new Uint8Array(w * h), stack = [x0, y0];
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    let l = x; while (l > 0 && !seen[y * w + l - 1] && near((y * w + l - 1) * 4)) l--;
    let r = x; while (r < w - 1 && !seen[y * w + r + 1] && near((y * w + r + 1) * 4)) r++;
    for (let i = l; i <= r; i++) {
      const n = y * w + i; if (seen[n]) continue; seen[n] = 1;
      px[n * 4] = fr; px[n * 4 + 1] = fg; px[n * 4 + 2] = fb; px[n * 4 + 3] = 255;
      if (y > 0 && !seen[n - w] && near((n - w) * 4)) stack.push(i, y - 1);
      if (y < h - 1 && !seen[n + w] && near((n + w) * 4)) stack.push(i, y + 1);
    }
  }
  ctx.putImageData(img, 0, 0);
}

function dessinPaint(ctx, piece) {
  if (piece.f === 1) { dessinFill(ctx, piece); return; }
  const w = ctx.canvas.width, h = ctx.canvas.height, p = piece.p;
  ctx.strokeStyle = ctx.fillStyle = dessinColor(piece.c);
  ctx.lineWidth = (DESSIN_SIZES[piece.s] || 9) * w / 400;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (p.length === 2) { ctx.beginPath(); ctx.arc(p[0] * w / 1000, p[1] * h / 1000, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); return; }
  ctx.beginPath();
  for (let i = 0; i < p.length; i += 2) { const x = p[i] * w / 1000, y = p[i + 1] * h / 1000; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
}

function dessinRedraw() {
  const canvas = document.getElementById('party-dessin-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = DESSIN_PAPER; ctx.fillRect(0, 0, canvas.width, canvas.height);
  dessinState.pieces.forEach((piece) => dessinPaint(ctx, piece));
}

function dessinEmit(op, extra = {}) {
  const room = partyRoomState.room, round = dessinRound();
  const socket = typeof ensureMultiplayerSocket === 'function' ? ensureMultiplayerSocket() : null;
  if (!room || !round || !socket) return;
  socket.emit('party:dessin-draw', { code: room.code, roundSerial: round.roundSerial, op, ...extra }, (res) => {
    if (res && !res.ok && res.error) setPartyStatus(res.error);
  });
}

// Pieces leave every 100 ms; each one starts where the previous ended so the line has no gap.
function dessinFlush() {
  const d = dessinState.drawing;
  clearTimeout(dessinState.timer); dessinState.timer = null;
  if (!d || d.buf.length < 2) return;
  const piece = { k: d.k, c: d.c, s: d.s, p: d.buf.slice(0, 400) };
  d.buf = d.buf.slice(-2);
  if (piece.p.length === 2 && d.sent) return;
  d.sent = true;
  dessinEmit('add', { piece });
}

function dessinPoint(canvas, event) {
  const box = canvas.getBoundingClientRect();
  return [Math.max(0, Math.min(1000, Math.round((event.clientX - box.left) / box.width * 1000))), Math.max(0, Math.min(1000, Math.round((event.clientY - box.top) / box.height * 1000)))];
}

function dessinBindCanvas(canvas) {
  canvas.addEventListener('pointerdown', (event) => {
    const room = partyRoomState.room, round = dessinRound();
    if (!round || round.phase !== 'draw' || !dessinIsDrawer(room, round) || room.status !== 'playing') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    if (dessinState.drawing) end();
    dessinState.stroke += 1;
    const pt = dessinPoint(canvas, event);
    if (dessinState.tool === 'fill') {
      const piece = { k: dessinState.stroke, c: dessinState.color, s: dessinState.size, p: pt, f: 1 };
      dessinState.pieces.push(piece);
      dessinPaint(canvas.getContext('2d'), piece);
      dessinEmit('add', { piece });
      return;
    }
    try { canvas.setPointerCapture(event.pointerId); } catch (_e) {}
    dessinState.drawing = { canvas, pointerId: event.pointerId, k: dessinState.stroke, c: dessinState.color, s: dessinState.size, buf: pt.slice(), local: { k: dessinState.stroke, c: dessinState.color, s: dessinState.size, p: pt.slice() }, sent: false };
    dessinState.pieces.push(dessinState.drawing.local);
    dessinPaint(canvas.getContext('2d'), dessinState.drawing.local);
  });
  canvas.addEventListener('pointermove', (event) => {
    const d = dessinState.drawing;
    if (!d || d.canvas !== canvas || d.pointerId !== event.pointerId) return;
    // A mouse moving with no button pressed is not drawing (the stroke was left open somewhere).
    if (event.pointerType === 'mouse' && !(event.buttons & 1)) { end(); return; }
    event.preventDefault();
    const pt = dessinPoint(canvas, event), last = d.local.p.slice(-2);
    if (Math.abs(pt[0] - last[0]) + Math.abs(pt[1] - last[1]) < 3) return;
    d.buf.push(pt[0], pt[1]); d.local.p.push(pt[0], pt[1]);
    const ctx = canvas.getContext('2d');
    dessinPaint(ctx, { c: d.c, s: d.s, p: [last[0], last[1], pt[0], pt[1]] });
    if (d.buf.length >= 398) dessinFlush();
    else if (!dessinState.timer) dessinState.timer = setTimeout(dessinFlush, DESSIN_SEND_MS);
  });
  function end() { if (!dessinState.drawing) return; dessinFlush(); if (!dessinState.drawing.sent) dessinEmit('add', { piece: dessinState.drawing.local }); dessinState.drawing = null; }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
}

function partyDessinTool(kind, value) {
  if (kind === 'color') { dessinState.color = Number(value); if (dessinState.tool === 'eraser') dessinState.tool = 'pen'; }
  if (kind === 'size') dessinState.size = Number(value);
  if (kind === 'eraser') { dessinState.color = DESSIN_ERASER; dessinState.tool = 'eraser'; }
  if (kind === 'fill') { if (dessinState.color === DESSIN_ERASER) dessinState.color = 0; dessinState.tool = dessinState.tool === 'fill' ? 'pen' : 'fill'; }
  if (kind === 'pen') { if (dessinState.color === DESSIN_ERASER) dessinState.color = 0; dessinState.tool = 'pen'; }
  dessinRenderTools();
}

function partyDessinZoomModel() {
  dessinState.zoom = !dessinState.zoom;
  document.getElementById('party-dessin-top')?.classList.toggle('is-zoom', dessinState.zoom);
}

function partyDessinUndo() {
  if (!dessinState.pieces.length) return;
  const last = dessinState.pieces[dessinState.pieces.length - 1].k;
  dessinState.pieces = dessinState.pieces.filter((piece) => piece.k !== last);
  dessinRedraw();
  dessinEmit('undo');
}

function partyDessinClear() {
  dessinState.pieces = [];
  dessinRedraw();
  dessinEmit('clear');
}

function partyDessinChoose(index) {
  const room = partyRoomState.room, round = dessinRound();
  const socket = typeof ensureMultiplayerSocket === 'function' ? ensureMultiplayerSocket() : null;
  if (!room || !round || !socket) return;
  socket.emit('party:submit-answer', { code: room.code, roundSerial: round.roundSerial, dessinAction: 'choose', option: Number(index) }, (res) => {
    if (res && !res.ok && res.error) setPartyStatus(res.error);
    if (res && res.room) { partyRoomState.room = res.room; renderPartyRoom(); }
  });
}

function dessinRenderTools() {
  const tools = document.getElementById('party-dessin-tools');
  if (!tools) return;
  tools.innerHTML = '<div class="dessin-colors">' + DESSIN_COLORS.map((c, i) => '<button type="button" class="dessin-dot' + (dessinState.color === i ? ' is-on' : '') + '" style="background:' + c + '" data-action="partyDessinTool" data-args=\'["color",' + i + ']\' aria-label="Couleur ' + (i + 1) + '" aria-pressed="' + (dessinState.color === i) + '"></button>').join('') + '</div>' +
    '<div class="dessin-actions">' + DESSIN_SIZES.map((s, i) => '<button type="button" class="dessin-size' + (dessinState.size === i ? ' is-on' : '') + '" data-action="partyDessinTool" data-args=\'["size",' + i + ']\' aria-label="Taille ' + (i + 1) + '" aria-pressed="' + (dessinState.size === i) + '"><i style="width:' + (s * 0.9 + 3) + 'px;height:' + (s * 0.9 + 3) + 'px"></i></button>').join('') +
    '<button type="button" class="dessin-btn' + (dessinState.tool === 'pen' ? ' is-on' : '') + '" data-action="partyDessinTool" data-args=\'["pen"]\'>✏️ Crayon</button>' +
    '<button type="button" class="dessin-btn' + (dessinState.tool === 'fill' ? ' is-on' : '') + '" data-action="partyDessinTool" data-args=\'["fill"]\'>🪣 Remplir</button>' +
    '<button type="button" class="dessin-btn' + (dessinState.tool === 'eraser' ? ' is-on' : '') + '" data-action="partyDessinTool" data-args=\'["eraser"]\'>🧽 Gomme</button>' +
    '<button type="button" class="dessin-btn" data-action="partyDessinUndo">↶ Annuler</button>' +
    '<button type="button" class="dessin-btn" data-action="partyDessinClear">🗑️ Effacer</button></div>';
}

function dessinSeconds(at) {
  return Math.max(0, Math.ceil((Number(at) - (Date.now() + dessinState.offset)) / 1000));
}

function dessinHintHtml(round) {
  const type = round.typeHint ? '<span class="dessin-chip">' + escapeHtml(round.typeHint) + '</span>' : '<span class="dessin-chip is-soon">Type dans ' + dessinSeconds(round.typeHintAt) + ' s</span>';
  const gen = round.genHint ? '<span class="dessin-chip">Gen ' + Number(round.genHint) + '</span>' : '<span class="dessin-chip is-soon">Génération dans ' + dessinSeconds(round.genHintAt) + ' s</span>';
  return '<span class="dessin-letters" aria-label="' + (round.pattern || '').replace(/[^_]/g, '').length + ' lettres">' + escapeHtml(round.pattern || '').split('').join(' ') + '</span>' + type + gen;
}

function dessinFeedHtml(round) {
  if (!round.guesses || !round.guesses.length) return '<span class="dessin-muted">Les réponses s’afficheront ici.</span>';
  return round.guesses.map((g) => g.correct ? '<span class="is-ok">🎉 ' + escapeHtml(g.nickname) + ' a trouvé ! +' + Number(g.gain || 0) + '</span>'
    : '<span class="' + (g.close ? 'is-close' : 'is-no') + '">' + escapeHtml(g.nickname) + ' : ' + escapeHtml(g.name || '?') + (g.close ? ', presque !' : ' ✗') + '</span>').join('');
}

function dessinFoundText(n) {
  return n ? n + (n > 1 ? ' ont trouvé' : ' a trouvé') : 'Personne n’a encore trouvé';
}

function dessinArtwork(id) {
  const pokemon = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(id)) : null;
  return pokemon ? pokedexDetailArtwork(pokemon) : '';
}

function renderPartyDessin(room, me, enabled, playing) {
  const panel = document.getElementById('party-dessin');
  if (!panel) return;
  const round = room.round;
  panel.classList.toggle('hidden', !enabled);
  if (!enabled || !round) { if (panel.innerHTML) { panel.innerHTML = ''; dessinState.key = ''; } clearInterval(dessinState.tick); dessinState.tick = null; return; }
  if (!dessinState.bound) {
    const socket = typeof ensureMultiplayerSocket === 'function' ? ensureMultiplayerSocket() : null;
    if (socket) {
      dessinState.bound = true;
      socket.on('party:dessin-draw', (msg) => {
        const current = dessinRound();
        if (!current || !msg || msg.roundSerial !== current.roundSerial || dessinIsDrawer(partyRoomState.room, current)) return;
        if (msg.op === 'add' && msg.piece) { dessinState.pieces.push(msg.piece); const canvas = document.getElementById('party-dessin-canvas'); if (canvas) dessinPaint(canvas.getContext('2d'), msg.piece); }
        else if (msg.op === 'undo') { dessinState.pieces = dessinState.pieces.filter((piece) => piece.k !== msg.k); dessinRedraw(); }
        else if (msg.op === 'clear') { dessinState.pieces = []; dessinRedraw(); }
      });
    }
  }
  dessinState.offset = Number(round.serverNow) ? Number(round.serverNow) - Date.now() : 0;
  const drawer = me && me.id === round.drawerId;
  const revealed = !playing;
  const view = round.phase === 'choose' && playing ? 'choose' : 'board';
  const key = room.code + ':' + round.roundSerial + ':' + view + ':' + (drawer ? 'd' : 'g') + ':' + (revealed ? 'r' : 'p');
  if (key !== dessinState.key) {
    const sameRound = dessinState.key.split(':').slice(0, 2).join(':') === room.code + ':' + round.roundSerial;
    dessinState.key = key;
    // A rebuilt board never inherits a stroke still open on the old one.
    clearTimeout(dessinState.timer); dessinState.timer = null; dessinState.drawing = null;
    if (!sameRound) { dessinState.pieces = []; dessinState.stroke = 0; dessinState.color = 0; dessinState.size = 1; dessinState.tool = 'pen'; dessinState.zoom = false; }
    if (view === 'choose') {
      panel.innerHTML = drawer
        ? '<div class="dessin-choose"><h4>À toi de dessiner !</h4><p>Choisis ton Pokémon. Les autres ne le voient pas.</p><div class="dessin-options">' + (round.options || []).map((o, i) => '<button type="button" class="dessin-option is-' + o.level + '" data-action="partyDessinChoose" data-args="[' + i + ']"><img src="' + dessinArtwork(o.id) + '" alt="" width="120" height="120" draggable="false"><b>' + escapeHtml(o.name) + '</b><span class="dessin-level">' + o.label + '</span><small>+' + o.points + ' si trouvé</small></button>').join('') + '</div><p class="dessin-muted">Sans choix au bout de 10 s, le Pokémon facile est pris.</p></div>'
        : '<div class="dessin-choose"><h4>' + escapeHtml(round.drawerNickname) + ' choisit son Pokémon…</h4><p>Prépare-toi à deviner : plus tu trouves vite, plus tu marques.</p></div>';
    } else {
      panel.innerHTML = '<div id="party-dessin-top" class="dessin-top"></div><div class="dessin-board"><canvas id="party-dessin-canvas" width="800" height="600" aria-label="Dessin de ' + escapeHtml(round.drawerNickname) + '"></canvas>' + (drawer && !revealed ? '<div id="party-dessin-tools" class="dessin-tools"></div>' : '') + '</div><div id="party-dessin-feed" class="dessin-feed" aria-live="polite"></div>';
      const canvas = document.getElementById('party-dessin-canvas');
      if (drawer && !revealed) { dessinBindCanvas(canvas); dessinRenderTools(); }
    }
  }
  if (view !== 'board') return;
  // The drawer keeps their own strokes; everyone else follows the server's copy.
  if (!drawer || !dessinState.pieces.length || revealed) {
    dessinState.pieces = (round.strokes || []).slice();
    dessinState.stroke = Math.max(dessinState.stroke, ...dessinState.pieces.map((piece) => piece.k), 0);
    dessinRedraw();
  }
  const top = document.getElementById('party-dessin-top');
  if (top) {
    top.innerHTML = revealed
      ? '<img src="' + dessinArtwork(round.answerId) + '" alt="" width="64" height="64"><div><small>C’ÉTAIT</small><b>' + escapeHtml(round.answer || '?') + '</b></div><span class="dessin-found">' + (round.foundIds || []).length + ' joueur' + ((round.foundIds || []).length > 1 ? 's ont' : ' a') + ' trouvé</span>'
      : drawer && round.secret
        ? '<button type="button" class="dessin-model" data-action="partyDessinZoomModel" aria-label="Agrandir le modèle"><img src="' + dessinArtwork(round.secret.id) + '" alt="" width="110" height="110" draggable="false"></button><div><small>TU DESSINES · ' + round.secret.label + '</small><b>' + escapeHtml(round.secret.name) + '</b></div><span class="dessin-found">🔒 Toi seul le vois<br>' + dessinFoundText((round.foundIds || []).length) + '</span>'
        : '<div class="dessin-hint">' + dessinHintHtml(round) + '</div>';
    top.classList.toggle('is-secret', Boolean(drawer || revealed));
    top.classList.toggle('is-zoom', Boolean(drawer && !revealed && dessinState.zoom));
  }
  const feed = document.getElementById('party-dessin-feed');
  if (feed) feed.innerHTML = dessinFeedHtml(round);
  clearInterval(dessinState.tick); dessinState.tick = null;
  if (playing && !drawer && (!round.typeHint || !round.genHint)) dessinState.tick = setInterval(() => { const r = dessinRound(); const hint = document.querySelector('#party-dessin-top .dessin-hint'); if (r && hint) hint.innerHTML = dessinHintHtml(r); }, 1000);
}
