// Homepage hero motion: a live candle chart, the bot panel's status sequence and Avalisa's turn,
// all on one 13 s loop. Plain DOM code so React renders the markup once and stays out of the way.
// Nothing here shows a result: the trade opens and the loop restarts before it would settle.

const GREEN = '#3fbf4a';
const RED = '#e5362f';
const LOOP = 392 / 30; // girl-turn.mp4: 197 frames forward + 195 back at 30 fps
export const MASCOT_VIDEO = '/assets/presenter/girl-turn.mp4';

function rng(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

class Chart {
  constructor(cv, ctx, o) {
    this.cv = cv; this.c = ctx;
    this.o = { pitch: 0.062, liveAt: 0.68, top: 0.24, bot: 0.15, dur: 1.3, rev: 0.14, ...o };
    this.bias = 0; this.mk = null; this.fadeIn = 1;
    this.swap(199.42, 0.012, 3, 5);
    this.ro = new ResizeObserver(() => { this.size(); this.draw(performance.now()); });
    this.ro.observe(cv); this.size();
  }
  destroy() { this.ro.disconnect(); }
  swap(base, tick, dec, seed) {
    this.base = base; this.tick = tick; this.dec = dec; this.r = rng(seed); this.id = 0; this.cs = [];
    let p = base;
    for (let i = 0; i < 70; i++) { const k = this.gen(p, 0); this.cs.push(k); p = k.c; }
    this.live = this.begin(p); this.lo = null; this.hi = null; this.mk = null; this.fadeIn = 0;
  }
  gen(o, b) {
    const r = this.r, k = this.tick;
    const d = (r() - 0.5 + b * 0.42) * k * 2.3 + (this.base - o) * this.o.rev * (b ? 0.25 : 1);
    const c = o + d;
    return { o, c, h: Math.max(o, c) + r() * k * 0.75, l: Math.min(o, c) - r() * k * 0.75, id: this.id++ };
  }
  begin(o) { const g = this.gen(o, this.bias); return { o, c: o, h: o, l: o, tc: g.c, th: g.h, tl: g.l, p: 0, id: g.id, w: this.r() * 6 }; }
  step(dt) {
    const L = this.live; L.p += dt / this.o.dur; this.fadeIn = Math.min(1, this.fadeIn + dt * 3.5);
    if (L.p >= 1) {
      this.cs.push({ o: L.o, c: L.tc, h: L.th, l: L.tl, id: L.id });
      if (this.cs.length > 90) this.cs.shift();
      this.live = this.begin(L.tc); return;
    }
    const e = L.p * L.p * (3 - 2 * L.p);
    L.c = L.o + (L.tc - L.o) * e + Math.sin(L.p * 10 + L.w) * (1 - L.p) * this.tick * 0.45;
    const q = Math.min(1, L.p * 1.5);
    L.h = Math.max(L.o, L.c, L.h, L.o + (L.th - L.o) * q);
    L.l = Math.min(L.o, L.c, L.l, L.o + (L.tl - L.o) * q);
  }
  place(amt) { this.mk = { id: this.live.id, price: this.live.c, amt, t0: performance.now(), out: 0 }; }
  clear() { if (this.mk && !this.mk.out) this.mk.out = performance.now(); }
  size() {
    const r = this.cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    this.W = this.cv.width = Math.max(2, Math.round(r.width * d));
    this.H = this.cv.height = Math.max(2, Math.round(r.height * d)); this.d = d;
  }
  draw(now) {
    const c = this.c, W = this.W, H = this.H, o = this.o; if (!W) return; c.clearRect(0, 0, W, H);
    const ax = W * 0.12, cw = W - ax, pitch = o.pitch * W, bw = Math.max(2, pitch * 0.62), L = this.live;
    const liveX = o.liveAt * cw + (1 - L.p) * pitch;
    const all = this.cs.concat([L]), n = all.length, top = H * o.top, bot = H * (1 - o.bot), X = (i) => liveX - (n - 1 - i) * pitch;
    let lo = 1e9, hi = -1e9, first = n - 1;
    for (let i = n - 1; i >= 0; i--) { if (X(i) < -pitch) break; first = i; lo = Math.min(lo, all[i].l); hi = Math.max(hi, all[i].h); }
    const pad = (hi - lo) * 0.14 + 1e-9; lo -= pad; hi += pad;
    this.lo = this.lo == null ? lo : this.lo + (lo - this.lo) * 0.07;
    this.hi = this.hi == null ? hi : this.hi + (hi - this.hi) * 0.07;
    const Y = (v) => top + ((this.hi - v) / (this.hi - this.lo)) * (bot - top), fs = Math.max(9 * this.d, W * 0.026);
    c.font = `500 ${fs}px Inter,system-ui,sans-serif`; c.textBaseline = 'middle';
    c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.055)'; c.fillStyle = 'rgba(139,147,170,.9)';
    let stp = this.tick * 2; while ((this.hi - this.lo) / stp > 5) stp *= 2;
    for (let v = Math.ceil(this.lo / stp) * stp; v < this.hi; v += stp) {
      const y = Math.round(Y(v)) + 0.5; c.beginPath(); c.moveTo(0, y); c.lineTo(cw, y); c.stroke();
      c.textAlign = 'left'; c.fillText(v.toFixed(this.dec), cw + fs * 0.5, y);
    }
    for (let i = first; i < n; i++) {
      if (all[i].id % 6) continue;
      const x = Math.round(X(i)) + 0.5; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
      c.textAlign = 'center'; c.fillText(`18:${String((12 + all[i].id) % 60).padStart(2, '0')}`, x, H - fs * 0.9);
    }
    c.globalAlpha = this.fadeIn;
    for (let i = first; i < n; i++) {
      const k = all[i], x = X(i); if (x > cw + bw) continue;
      c.fillStyle = k.c >= k.o ? GREEN : RED;
      const yo = Y(k.o), yc = Y(k.c), ww = Math.max(1, bw * 0.12);
      c.fillRect(x - ww / 2, Y(k.h), ww, Math.max(1, Y(k.l) - Y(k.h)));
      c.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(1.5 * this.d, Math.abs(yc - yo)));
    }
    c.globalAlpha = 1;
    const py = Y(L.c);
    c.setLineDash([4 * this.d, 4 * this.d]); c.strokeStyle = 'rgba(190,200,230,.6)'; c.beginPath(); c.moveTo(0, py); c.lineTo(cw, py); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#3d4a6e'; rr(c, cw + fs * 0.25, py - fs * 0.85, ax - fs * 0.5, fs * 1.7, fs * 0.3); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText(L.c.toFixed(this.dec), cw + fs * 0.5, py);
    const m = this.mk;
    if (m) {
      const i = all.findIndex((k) => k.id === m.id), x = i < 0 ? -1 : X(i);
      const age = (now - m.t0) / 1000, out = m.out ? Math.min(1, (now - m.out) / 500) : 0;
      if (i < 0 || x < pitch || out >= 1) { this.mk = null; return; }
      const y = Y(m.price), a = 1 - out, pop = Math.max(0, Math.min(1, age / 0.28)), s = 1 - (1 - pop) ** 3;
      c.globalAlpha = a; c.strokeStyle = RED; c.lineWidth = 1.4 * this.d; c.beginPath(); c.moveTo(x, y); c.lineTo(cw, y); c.stroke();
      if (age >= 0 && age < 1.3) { c.globalAlpha = a * (1 - age / 1.3); c.lineWidth = 2 * this.d; c.beginPath(); c.arc(x, y, bw * 0.5 + age * bw * 3.2, 0, 7); c.stroke(); c.globalAlpha = a; }
      c.fillStyle = RED; c.beginPath(); c.arc(x, y, Math.max(3 * this.d, bw * 0.36) * s + 0.01, 0, 7); c.fill(); c.lineWidth = 1.5 * this.d; c.strokeStyle = '#fff'; c.stroke();
      const left = Math.max(0, 30 - Math.floor(Math.max(0, age))), tf = fs * 1.08; c.font = `700 ${tf}px Inter,system-ui,sans-serif`;
      const txt = `▼ PUT  $${m.amt}   0:${String(left).padStart(2, '0')}`, tw = c.measureText(txt).width + tf * 1.4, th = tf * 2;
      const bx = Math.min(cw - tw - 2, Math.max(2, x - tw * 0.5)), by = Math.max(2, y - th - bw * 0.9 - tf * 0.4 * (1 - s));
      c.globalAlpha = a * s; c.fillStyle = RED; rr(c, bx, by, tw, th, tf * 0.4); c.fill();
      c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText(txt, bx + tf * 0.7, by + th / 2 + 1); c.globalAlpha = 1;
    }
  }
}

// Avalisa: one H.264 file, colour on the left half and its matte on the right, joined in a shader.
// Works in every browser without an alpha-video codec. Falls back to the still image.
export function startMascot(wrap, { reduced = false } = {}) {
  const cv = wrap.querySelector('canvas');
  const v = document.createElement('video');
  let ok = false, gl = null, lastT = -1;
  v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = true; v.preload = 'auto';
  v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
  try { gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }); } catch (e) { gl = null; }
  if (gl) {
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 a;varying vec2 u;void main(){u=a*.5+.5;gl_Position=vec4(a,0.,1.);}'));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 u;uniform sampler2D t;void main(){float x=clamp(u.x,.002,.998)*.5;vec3 c=texture2D(t,vec2(x,u.y)).rgb;float a=smoothstep(.05,.95,texture2D(t,vec2(x+.5,u.y)).r);gl_FragColor=vec4(min(c,vec3(a)),a);}'));
    gl.linkProgram(p); gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture()); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.viewport(0, 0, cv.width, cv.height);
  }
  function paint() {
    if (!gl || v.readyState < 2) return;
    if (v.currentTime === lastT && ok) return;
    lastT = v.currentTime;
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!ok) { ok = true; wrap.classList.add('is-live'); }
    } catch (e) { gl = null; wrap.classList.remove('is-live'); }
  }
  v.addEventListener('loadeddata', paint);
  if (gl && !reduced) { v.src = MASCOT_VIDEO; v.load(); }
  return {
    paint,
    playing: () => ok && !v.paused && !v.ended,
    time: () => v.currentTime,
    show(on) { if (!gl || reduced) return; if (on) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause(); },
    destroy() { v.pause(); v.removeAttribute('src'); v.load(); wrap.classList.remove('is-live'); },
  };
}

const PAIRS = { ada: ['Cardano OTC', 0.2784, 0.00022, 4, 21, 1], chf: ['CHF/JPY OTC', 199.42, 0.012, 3, 5, 2] };

/** Starts the hero loop inside `root` (the .pzh-frame element). Returns a cleanup function. */
export function startHeroShow(root) {
  if (typeof window === 'undefined' || !root) return () => {};
  if (!('IntersectionObserver' in window) || !('ResizeObserver' in window)) return () => {};
  const cv = root.querySelector('canvas.pzh-chart');
  let ctx = null;
  try { ctx = cv && cv.getContext('2d'); } catch (e) { ctx = null; }
  if (!ctx) return () => {};
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const chart = new Chart(cv, ctx);
  const m = startMascot(root.querySelector('.pz-mascot'), { reduced });
  const $ = (s) => root.querySelector(s);
  const panelEl = $('.avp'), st = $('.avp__status'), pairName = $('.avp__pairname'), score = $('.avp__score');
  const lis = [...root.querySelectorAll('.avp__rules li')], age = $('.avp__age'), tr = $('.avp__trades');
  const tabs = [...root.querySelectorAll('.po__tab')], pairEl = $('.po__pair');
  let t = 0, last = 0, key = '', placed = false, pairKey = '', fireT = 0, on = false, raf = 0, prev = performance.now();

  function apply() {
    const pk = t < 2.7 ? 'ada' : 'chf', P = PAIRS[pk];
    if (pk !== pairKey) {
      pairKey = pk; chart.swap(P[1], P[2], P[3], P[4]); placed = false;
      pairEl.textContent = P[0]; tabs.forEach((x, i) => x.classList.toggle('is-on', i === P[5]));
    }
    chart.bias = t < 2.7 ? 0 : t < 4.9 ? 1 : t < 6.6 ? -1.6 : 0;
    const open = t >= 6.7 && t < 12.5, met = t < 2.7 ? [3] : t < 4.3 ? [] : t < 6.1 ? [2] : [2, 3];
    const k = pk + open + met.join() + (t >= 12.5);
    if (k !== key) {
      key = k;
      st.textContent = open ? 'Status: Trade open — waiting 30s for result…' : `Status: Scanning ${t >= 12.5 ? 'AUD/USD OTC' : P[0]} (92%)`;
      pairName.textContent = `${pk === 'ada' ? 'BTCUSD_otc' : 'CHFJPY_otc'} · mean-revert · PUT`;
      lis.forEach((li, i) => li.classList.toggle('met', met.includes(i)));
      score.textContent = `${met.length}/2 rules`; score.classList.toggle('ready', met.length >= 2);
      age.textContent = open ? 'checked 4s ago' : 'checked just now';
      tr.textContent = `Trades this session: ${t >= 6.7 ? 1 : 0}`;
    }
    if (open && !placed) {
      placed = true; chart.place(1); panelEl.classList.add('is-fired');
      window.clearTimeout(fireT); fireT = window.setTimeout(() => panelEl.classList.remove('is-fired'), 1700);
    }
    if (t >= 12.5) chart.clear();
  }
  function frame(now) {
    const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
    if (on && !document.hidden) {
      t = m.playing() ? m.time() : (t + dt) % LOOP;
      if (t < last - 1) { key = ''; pairKey = ''; }
      last = t; apply(); chart.step(dt); chart.draw(now); m.paint();
    }
    raf = window.requestAnimationFrame(frame);
  }
  const io = new IntersectionObserver((es) => es.forEach((e) => { on = e.isIntersecting; m.show(on); }), { threshold: 0.1 });
  io.observe(root);
  if (reduced) {
    // One still frame that already shows the trade placed.
    t = 5; apply(); for (let i = 0; i < 60; i++) chart.step(0.05);
    t = 7.4; apply(); for (let i = 0; i < 40; i++) chart.step(0.05);
    chart.draw(performance.now() + 900);
  } else {
    raf = window.requestAnimationFrame(frame);
  }
  return () => { window.cancelAnimationFrame(raf); window.clearTimeout(fireT); io.disconnect(); chart.destroy(); m.destroy(); };
}
