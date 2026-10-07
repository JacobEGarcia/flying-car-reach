// Flying-car reach visualisation. Plain canvas, no dependencies.
const LAYERS = { near: { R: 45, N: 360 }, mid: { R: 150, N: 375 }, wide: { R: 400, N: 400 } };
const P = 1200;
const COL = { car: '#34465f', a: '#b3262e', b: '#e3661f', c: '#d9a21b', ink: '#1b1a17', bg: '#e9e8e3' };
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ' ' + (m % 60) : ''}` : `${m} min`);
const fmtN = (n) => Math.round(n).toLocaleString('en-US');
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function loadImg(url) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
}
async function loadGrid(url, N) {
  const img = await loadImg(url);
  const c = document.createElement('canvas'); c.width = N; c.height = N;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, N, N).data; const a = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) a[i] = d[i * 4];
  return a;
}
const elevOf = (v) => (v <= 1 ? 0 : Math.pow((v - 2) / 253, 2) * 4300);

function renderTerrain(grid, N, R, ex) {
  const c = document.createElement('canvas'); c.width = P; c.height = P;
  const g = c.getContext('2d'); seed = 11;
  const step = 3.3; const cell = P / N; const cellMi = (2 * R) / N;
  for (let y = 0; y < P; y += step) for (let x = 0; x < P; x += step) {
    const px = x + (rnd() - 0.5) * step, py = y + (rnd() - 0.5) * step;
    const gi = Math.min(N - 1, Math.max(0, Math.floor(px / cell))), gj = Math.min(N - 1, Math.max(0, Math.floor(py / cell)));
    const v = grid[gj * N + gi]; if (v <= 1) continue;
    const at = (i, j) => elevOf(grid[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))]);
    const gx = (at(gi + 1, gj) - at(gi - 1, gj)) / (2 * cellMi * 1609);
    const gy = (at(gi, gj + 1) - at(gi, gj - 1)) / (2 * cellMi * 1609); // y grows south
    const lit = -(gx * -0.7 + gy * -0.7) * ex; // light from NW
    const shade = Math.max(0, Math.min(1, 0.5 - lit * 0.5));
    const dark = 0.14 + 0.62 * (1 - shade) + 0.22 * Math.min(1, elevOf(v) / 2500);
    if (rnd() > 0.25 + dark * 1.1) continue;
    const r = 0.38 + dark * 1.15;
    g.fillStyle = `rgba(104,107,103,${0.38 + dark * 0.5})`;
    g.beginPath(); g.arc(px, py, r, 0, 6.283); g.fill();
  }
  return c;
}
function polyPath(g, rings, R) {
  const s = P / (2 * R);
  g.beginPath();
  for (const poly of rings) for (const ring of poly) {
    ring.forEach((p, i) => { const X = (p[0] + R) * s, Y = (R - p[1]) * s; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    g.closePath();
  }
}
function renderCar(rings, R, grid, N) {
  const c = document.createElement('canvas'); c.width = P; c.height = P;
  const g = c.getContext('2d'); seed = 5;
  g.save(); polyPath(g, rings, R); g.clip('evenodd');
  g.fillStyle = 'rgba(52,70,95,0.10)'; g.fillRect(0, 0, P, P);
  g.strokeStyle = 'rgba(40,56,80,0.9)'; g.lineWidth = 1.05; g.lineCap = 'round';
  const cell = P / N;
  for (let y = 0; y < P; y += 3) for (let x = 0; x < P; x += 3) {
    const px = x + rnd() * 3, py = y + rnd() * 3;
    const v = grid[Math.min(N - 1, Math.floor(py / cell)) * N + Math.min(N - 1, Math.floor(px / cell))];
    if (v <= 1) continue;
    const L = 2 + rnd() * 4; g.beginPath();
    if (rnd() < 0.5) { g.moveTo(px, py); g.lineTo(px + L, py); } else { g.moveTo(px, py); g.lineTo(px, py + L); }
    g.stroke();
  }
  g.restore();
  // land-only polygon pixel mask for area
  const m = document.createElement('canvas'); m.width = P; m.height = P;
  const mg = m.getContext('2d', { willReadFrequently: true }); mg.fillStyle = '#000';
  polyPath(mg, rings, R); mg.fill('evenodd');
  const d = mg.getImageData(0, 0, P, P).data; let n = 0;
  for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
    if (d[(y * P + x) * 4 + 3] < 128) continue;
    if (grid[Math.min(N - 1, Math.floor(y / cell)) * N + Math.min(N - 1, Math.floor(x / cell))] > 1) n++;
  }
  const mi = (2 * R) / P; const area = n * mi * mi;
  let extent = 0; for (const poly of rings) for (const ring of poly) for (const p of ring) extent = Math.max(extent, Math.hypot(p[0], p[1]));
  return { canvas: c, area, extent };
}
function renderCircle(rMi, color, layer, grid) {
  const { R, N } = layer; const c = document.createElement('canvas'); c.width = P; c.height = P;
  const g = c.getContext('2d'); seed = 3; const s = P / (2 * R); const cell = P / N; const rp = rMi * s;
  g.fillStyle = color; const sp = rMi > 200 ? 3.6 : 3.1;
  for (let y = 0; y < P; y += sp) for (let x = 0; x < P; x += sp) {
    const px = x + rnd() * sp, py = y + rnd() * sp; const dx = px - P / 2, dy = py - P / 2; const d = Math.hypot(dx, dy);
    if (d > rp) continue;
    const v = grid[Math.min(N - 1, Math.floor(py / cell)) * N + Math.min(N - 1, Math.floor(px / cell))]; if (v <= 1) continue;
    const f = d / rp; g.globalAlpha = 0.35 + 0.6 * f; g.beginPath(); g.arc(px, py, 0.95, 0, 6.283); g.fill();
  }
  g.globalAlpha = 1;
  let n = 0; const mi = (2 * R) / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { if (grid[j * N + i] <= 1) continue; const dx = (i + 0.5) * mi - R, dy = (j + 0.5) * mi - R; if (Math.hypot(dx, dy) <= rMi) n++; }
  return { canvas: c, area: n * mi * mi };
}

export function mount(root, cfg) {
  if (root.__fcv && root.__fcv.destroy) root.__fcv.destroy();
  let dead = false;
  root.classList.add('fcv');
  root.innerHTML = `
  <div class="fcv-stage"><canvas class="fcv-canvas"></canvas>
    <div class="fcv-head"><h2 class="fcv-title"></h2><div class="fcv-stat"><span class="fcv-num"></span><span class="fcv-sub"></span></div></div>
    <label class="fcv-city"><span class="fcv-sr">City</span><select></select></label>
    <div class="fcv-legend"></div>
    <div class="fcv-load">Loading map…</div>
  </div>
  <div class="fcv-ctl"><button type="button" class="fcv-play" aria-label="Play or pause"></button><div class="fcv-dots"></div></div>`;
  const $ = (s) => root.querySelector(s);
  const cv = $('.fcv-canvas'), ctx = cv.getContext('2d');
  const sel = $('select'); cfg.cities.forEach((c) => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });
  const STEPS = [
    { key: 'car', mph: 0, min: 30 }, { key: 'a', mph: 120, min: 30 }, { key: 'b', mph: 250, min: 30 }, { key: 'c', mph: 250, min: 90 },
  ];
  const LEG = [['car', 'Car · 30 min', COL.car, 0], ['a', '120 mph · 30 min', COL.a, 1], ['b', '250 mph · 30 min', COL.b, 2], ['c', '250 mph · 90 min', COL.c, 3]];
  $('.fcv-legend').innerHTML = LEG.map((l) => `<span data-s="${l[3]}"><i style="background:${l[2]}"></i>${l[1]}</span>`).join('');
  $('.fcv-dots').innerHTML = STEPS.map((_, i) => `<button type="button" data-s="${i}" aria-label="Step ${i + 1}"></button>`).join('');

  const S = { city: cfg.cities.find((c) => c.id === (cfg.start || 'sf')) ? (cfg.start || 'sf') : cfg.cities[0].id, step: 0, span: 60, from: 60, to: 60, t: 1, play: true, last: 0, stepAt: 0, data: null, num: 0, numFrom: 0, numTo: 0, numT: 1, cards: [] };
  sel.value = S.city;
  const cache = {};
  async function loadCity(id) {
    if (cache[id]) return cache[id];
    const meta = await cfg.getMeta(id); const dests = (await cfg.getDests())[id] || [];
    const grids = {}; for (const k of Object.keys(LAYERS)) grids[k] = await loadGrid(await cfg.layerUrl(id, k), LAYERS[k].N);
    const ter = {}; const exs = { near: 2.2, mid: 5, wide: 12 };
    for (const k of Object.keys(LAYERS)) ter[k] = renderTerrain(grids[k], LAYERS[k].N, LAYERS[k].R, exs[k]);
    const carLayer = (() => { let ext = 0; for (const poly of meta.iso) for (const ring of poly) for (const p of ring) ext = Math.max(ext, Math.hypot(p[0], p[1])); return ext * 1.08 <= 45 ? 'near' : 'mid'; })();
    const car = renderCar(meta.iso, LAYERS[carLayer].R, grids[carLayer], LAYERS[carLayer].N);
    const circ = {
      a: renderCircle(60, COL.a, LAYERS.mid, grids.mid), b: renderCircle(125, COL.b, LAYERS.mid, grids.mid),
      c: renderCircle(375, COL.c, LAYERS.wide, grids.wide),
    };
    const res = { meta, dests, ter, car, carLayer, circ };
    cache[id] = res; return res;
  }
  function viewFor(step, d) {
    const e = d.car.extent;
    return [Math.max(e * 2.5, 36), 165, 340, 760][step];
  }
  function statFor(step, d) {
    const c = d.car.area;
    if (step === 0) return { num: c, big: true };
    if (step === 1) return { num: d.circ.a.area / c, mult: true };
    if (step === 2) return { num: d.circ.b.area / c, mult: true };
    const far = d.dests.filter((x) => x.mi <= 375).sort((a, b) => b.mi - a.mi)[0];
    S.hero = far || null;
    return far ? { num: Math.round((far.mi / 250) * 60), min: true } : { num: 9, mult: true };
  }
  function setStep(i, instant) {
    if (!S.data) return; S.step = i; S.from = S.span; S.to = viewFor(i, S.data); S.t = instant ? 1 : 0; if (instant) S.span = S.to;
    const st = statFor(i, S.data); S.numFrom = instant ? st.num : S.num; S.numTo = st.num; S.numT = instant ? 1 : 0; if (instant) S.num = st.num; S.mult = !!st.mult; S.kind = st.min ? 'min' : st.mult ? 'mult' : 'area'; S.stepAt = performance.now();
    const city = S.data.meta.name; const t = $('.fcv-title'); const sub = $('.fcv-sub');
    if (i === 0) { t.innerHTML = '30 minutes by car.'; sub.textContent = 'square miles of land within a 30-minute drive'; }
    else if (i === 3) { t.innerHTML = '<span>3× the time.</span> <em class="c">9× the area.</em>'; sub.textContent = S.hero ? `to ${S.hero.name}, ${S.hero.carMin == null ? 'no drive route' : 'about ' + fmtMin(S.hero.carMin) + ' by car'}` : `by flying car at 250 mph, 90 minutes from ${city}`; }
    else { t.innerHTML = `30 minutes <em class="${i === 1 ? 'a' : 'b'}">by flying car.</em>`; sub.textContent = 'more land within 30 minutes than by car'; }
    $('.fcv-num').className = 'fcv-num ' + (i === 0 ? 'car' : i === 1 ? 'a' : i === 2 ? 'b' : 'c');
    root.querySelectorAll('.fcv-legend span').forEach((s) => { s.classList.toggle('on', +s.dataset.s === i || (i === 3 && +s.dataset.s === 0 && false) || (+s.dataset.s <= i && +s.dataset.s !== 3 && i < 3)); s.classList.toggle('now', +s.dataset.s === i); });
    root.querySelectorAll('.fcv-dots button').forEach((b, k) => b.classList.toggle('on', k === i));
    buildCards();
  }
  function buildCards() {
    const d = S.data; const st = STEPS[S.step]; S.cards = [];
    if (S.step === 0) return;
    const mph = st.mph, maxMi = (mph * st.min) / 60; const minMi = S.step === 3 ? 126 : 8;
    const list = d.dests.filter((x) => x.mi <= maxMi && x.mi >= minMi).sort((a, b) => b.mi - a.mi).slice(0, S.step === 3 ? 4 : 3);
    S.cards = list.map((x) => {
      const fly = Math.max(1, Math.round((x.mi / mph) * 60)); const car = x.carMin;
      return { name: x.name, tag: x.tag, fly, car, dx: x.dx, dy: x.dy, mph };
    });
  }
  const SZ = { w: 0, h: 0, dpr: 1 };
  function resize() {
    const r = $('.fcv-stage').getBoundingClientRect(); const w = Math.max(300, Math.floor(r.width)); const h = Math.floor(w * (w < 560 ? 1.18 : 0.92));
    SZ.dpr = Math.min(2, window.devicePixelRatio || 1); SZ.w = w; SZ.h = h; cv.width = w * SZ.dpr; cv.height = h * SZ.dpr; cv.style.height = h + 'px'; $('.fcv-stage').style.height = h + 'px';
  }
  function pickLayer(span) {
    const need = (span * Math.max(SZ.h / SZ.w, 1)) * 1.05;
    return need <= 2 * LAYERS.near.R ? 'near' : need <= 2 * LAYERS.mid.R ? 'mid' : 'wide';
  }
  function draw(now) {
    const d = S.data; const W = SZ.w, H = SZ.h;
    ctx.setTransform(SZ.dpr, 0, 0, SZ.dpr, 0, 0); ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
    if (!d) return;
    const scale = S.span / W; const cx = W / 2, cy = H * (W < 560 ? 0.6 : 0.58);
    const X = (x) => cx + x / scale, Y = (y) => cy - y / scale;
    const L = pickLayer(S.span); const lay = LAYERS[L];
    ctx.globalAlpha = 1; ctx.drawImage(d.ter[L], X(-lay.R), Y(lay.R), (2 * lay.R) / scale, (2 * lay.R) / scale);
    const drawOff = (off, R, alpha) => { ctx.globalAlpha = alpha; ctx.drawImage(off, X(-R), Y(R), (2 * R) / scale, (2 * R) / scale); ctx.globalAlpha = 1; };
    const sinceStep = (now - S.stepAt) / 1000; const appear = Math.min(1, sinceStep / 0.9);
    const R_car = LAYERS[d.carLayer].R;
    drawOff(d.car.canvas, R_car, S.step === 0 ? 1 : 0.9);
    const ring = (rMi, color, label, lx, a) => {
      ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(X(0), Y(0), rMi / scale, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
      if (a < 0.6) return; const ang = lx; const px = X(0) + Math.cos(ang) * rMi / scale, py = Y(0) - Math.sin(ang) * rMi / scale;
      ctx.font = '600 12px Inter, system-ui, sans-serif'; const tw = ctx.measureText(label).width + 20; const bx = Math.min(W - tw - 8, Math.max(8, px - tw / 2)), by = Math.min(H - 70, Math.max(70, py - 11));
      ctx.fillStyle = color; roundRect(ctx, bx, by, tw, 24, 12); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(label, bx + 10, by + 12.5);
    };
    if (S.step >= 1 && S.step <= 2) { drawOff(d.circ.a.canvas, LAYERS.mid.R, S.step === 1 ? appear : 0.55); ring(60, COL.a, '30 min · 120 mph', 0.9, S.step === 1 ? appear : 0.7); }
    if (S.step === 2) { drawOff(d.circ.b.canvas, LAYERS.mid.R, appear); ring(125, COL.b, '30 min · 250 mph', 0.55, appear); }
    if (S.step === 3) { drawOff(d.circ.b.canvas, LAYERS.mid.R, 0.8); drawOff(d.circ.c.canvas, LAYERS.wide.R, appear); ring(125, COL.b, '30 min · 250 mph', 0.3, 1); ring(375, COL.c, '90 min · 250 mph', 0.8, appear); }
    // city marker
    ctx.fillStyle = '#fff'; ctx.strokeStyle = COL.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(0), Y(0), 5, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(X(0), Y(0), 2, 0, 6.283); ctx.fill();
    // cards
    const color = S.step === 1 ? COL.a : S.step === 2 ? COL.b : COL.c; const dark = S.step === 3 ? '#a8730c' : color;
    const placed = []; const ca = Math.max(0, Math.min(1, (sinceStep - 0.5) / 0.6));
    S.cards.forEach((c, k) => {
      const px = X(c.dx), py = Y(c.dy); if (px < -20 || px > W + 20 || py < -20 || py > H + 20) return;
      ctx.globalAlpha = ca; ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); const mx = (X(0) + px) / 2 + (py - Y(0)) * 0.18, my = (Y(0) + py) / 2 - (px - X(0)) * 0.18; ctx.quadraticCurveTo(mx, my, px, py); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(px, py, 4, 0, 6.283); ctx.fill(); ctx.stroke();
      const cw = Math.min(176, W * 0.42), ch = 62; let bx = px + 10, by = py - ch - 8; if (bx + cw > W - 6) bx = px - cw - 10; if (by < 92) by = py + 12; if (by + ch > H - 52) by = H - 52 - ch;
      for (const p of placed) if (bx < p.x + p.w && bx + cw > p.x && by < p.y + p.h && by + ch > p.y) by = p.y + p.h + 6 > H - 52 - ch ? p.y - ch - 6 : p.y + p.h + 6;
      placed.push({ x: bx, y: by, w: cw, h: ch });
      ctx.shadowColor = 'rgba(0,0,0,.16)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; ctx.fillStyle = '#fff'; roundRect(ctx, bx, by, cw, ch, 8); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = COL.ink; ctx.textBaseline = 'alphabetic'; ctx.font = '600 12.5px Inter, system-ui, sans-serif'; ctx.fillText(c.name, bx + 10, by + 18);
      if (c.tag) { const nw = ctx.measureText(c.name).width; ctx.fillStyle = '#85827a'; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillText('· ' + c.tag, bx + 14 + nw, by + 18); }
      ctx.fillStyle = dark; ctx.font = '700 21px Inter, system-ui, sans-serif'; ctx.fillText(c.fly + ' min', bx + 10, by + 43);
      const fw = ctx.measureText(c.fly + ' min').width; ctx.fillStyle = '#85827a'; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillText(c.car == null ? 'no drive route' : `${fmtMin(c.car)} by car`, bx + 16 + fw, by + 43); ctx.globalAlpha = 1;
    });
    // city label
    ctx.font = '600 12px Inter, system-ui, sans-serif'; const nm = d.meta.name; const nw = ctx.measureText(nm).width + 16; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.14)'; ctx.shadowBlur = 6; roundRect(ctx, X(0) - 4 - nw, Y(0) - 12, nw, 24, 6); ctx.fill(); ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.fillStyle = COL.ink; ctx.textBaseline = 'middle'; ctx.fillText(nm, X(0) - nw + 4, Y(0));
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function tick(now) {
    if (dead) return;
    if (!S.last) S.last = now; const dt = Math.min(0.1, (now - S.last) / 1000); S.last = now;
    if (S.t < 1) { S.t = Math.min(1, S.t + dt / 1.6); const e = ease(S.t); S.span = S.from * Math.pow(S.to / S.from, e); }
    if (S.numT < 1) { S.numT = Math.min(1, S.numT + dt / 1.5); const e = ease(S.numT); S.num = S.numFrom + (S.numTo - S.numFrom) * e; }
    if (S.data) { $('.fcv-num').textContent = S.kind === 'area' ? fmtN(S.num) : S.kind === 'min' ? `${Math.round(S.num)} min` : `${Math.round(S.num)}×`; }
    if (S.play && S.data && now - S.stepAt > 6500 && S.t >= 1) setStep((S.step + 1) % STEPS.length);
    draw(now); requestAnimationFrame(tick);
  }
  async function go(id, step = 0) {
    S.city = id; sel.value = id; $('.fcv-load').style.display = 'flex';
    try { S.data = await loadCity(id); } catch (e) { $('.fcv-load').textContent = 'Could not load map data: ' + (e && e.message ? e.message : e); console.error(e); return; }
    $('.fcv-load').style.display = 'none'; S.span = viewFor(0, S.data); setStep(step, true); S.stepAt = performance.now();
  }
  function paintPlay() { $('.fcv-play').textContent = S.play ? '❚❚' : '▶'; }
  $('.fcv-play').addEventListener('click', () => { S.play = !S.play; S.stepAt = performance.now(); paintPlay(); });
  $('.fcv-dots').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.play = false; paintPlay(); setStep(+b.dataset.s); });
  root.querySelector('.fcv-legend').addEventListener('click', (e) => { const s = e.target.closest('span'); if (!s) return; S.play = false; paintPlay(); setStep(+s.dataset.s); });
  sel.addEventListener('change', () => go(sel.value, 0));
  window.addEventListener('resize', resize); resize(); paintPlay();
  root.__fcv = { S, setStep, go, destroy() { dead = true; window.removeEventListener('resize', resize); } };
  go(S.city, 0);
  requestAnimationFrame(tick);
  return root.__fcv;
}
