'use strict';
/* Digit Dungeon · core.js: Helpers, save data, sound effects, read-aloud voice. */

/* =====================================================================
   DIGIT DUNGEON — a math roguelite for 2nd grade
   Curriculum: Bridges in Mathematics, Grade 2, Unit 1 "Figuring the Facts"
   (facts to 20, doubles, make ten, add ten, ten-frames, number rack,
    skip counting by 2s/5s/10s, even & odd)
   ===================================================================== */


const BUILD = 'v10';   // bump with the ?v3 tags in index.html on every release

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const uid = () => Math.random().toString(36).slice(2, 9);
const strip = s => String(s).replace(/<[^>]+>/g, '');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function weightedPick(items, wf) {
  let tot = 0; const ws = items.map(i => { const w = Math.max(0, wf(i)); tot += w; return w; });
  if (tot <= 0) return pick(items);
  let r = Math.random() * tot;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function sampleW(arr, k, wf) { const pool = arr.slice(), out = []; while (out.length < k && pool.length) { const it = weightedPick(pool, wf); out.push(it); pool.splice(pool.indexOf(it), 1); } return out; }
function takeCycle(arr, k) { const out = []; if (!arr.length) return out; let i = 0; while (out.length < k) { out.push(arr[i % arr.length]); i++; if (i % arr.length === 0) shuffle(arr); } return out; }
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const show = s => s.replace(/ ([+−]) /g, ' $1 ');

/* ---------- save data ---------- */
const SAVE_KEY = 'digit-dungeon-v1';
function defaultSave() {
  return { v: 1, name: '', stars: 0, cosmetics: { color: 'mint', hat: 'none', top: 'none', shoes: 'none' }, unlocks: [], seen: null, best: { floor: 0, wins: 0 },
    runsPlayed: 0, roomCount: 0, roomsEver: 0, chompsEver: 0, remembered: 0, comeback: [], skills: {}, facts: {}, days: {},
    settings: { voice: true, sound: true, music: true, mistakes: true, monsters: true, readTiles: false,
      skills: { frames: true, evenOdd: true, skip10: true, skip5: true, skip2: true, add: true, sub: true } },
    run: null };
}
function merge(base, over) { for (const k in over) { if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') merge(base[k], over[k]); else base[k] = over[k]; } return base; }
function loadSave() { try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const v = merge(defaultSave(), JSON.parse(raw)); if (v.run && v.run.ver !== 2) v.run = null; return v; } } catch (e) {} return defaultSave(); }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
let save = loadSave();

/* ---------- sound ----------
   iPhones and iPads cut web audio off when a notification, call or Siri plays: Safari marks the audio engine
   "interrupted" and it can stay silent or crackly afterwards. When we see that (or the audio clock stalls),
   her next tap builds a fresh engine (taps are allowed to start sound). Decoded voice and music are kept,
   and the music fades back in. */
const quiet = p => { if (p && p.catch) p.catch(() => {}); };
const Sound = {
  ctx: null, broken: false, pausing: false, lastA: 0, lastW: 0, stalls: 0, revivals: 0,
  init() { if (!this.ctx) this.make(); },
  make() {
    let c; try { c = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.ctx = c; this.lastW = 0; this.stalls = 0;
    c.onstatechange = () => {
      if (c !== this.ctx) return;
      if (c.state === 'running') c.ran = true;
      else if (c.ran && c.state !== 'closed' && !this.pausing && !document.hidden) this.broken = true;   // cut off by the system
    };
  },
  kick() { const c = this.ctx; if (c && c.state !== 'running' && c.state !== 'closed') { try { quiet(c.resume()); } catch (e) {} } },
  wake(gesture) {     // on every tap, and when the page comes back
    if (!this.ctx) { this.make(); this.kick(); return; }
    if (this.broken && gesture) { this.revive(); return; }
    this.pausing = false;
    const c = this.ctx; if (c.state === 'running') return;
    this.kick();
    setTimeout(() => { if (c === this.ctx && c.ran && c.state !== 'running' && !document.hidden && !this.pausing) this.broken = true; }, 600);
  },
  pause() { this.pausing = true; if (this.ctx) { try { quiet(this.ctx.suspend()); } catch (e) {} } },
  revive() {          // replace the audio engine (must run inside a tap so the new one is allowed to play)
    const old = this.ctx; this.broken = false; this.pausing = false; this.revivals++;
    if (old) { old.onstatechange = null; try { quiet(old.close()); } catch (e) {} }
    this.ctx = null; Clips.nodes = []; Clips.endAt = 0; Music.reset();
    this.make(); if (!this.ctx) return;
    this.kick(); Music.start();
  },
  watch() {           // a running engine whose clock stopped moving is broken too
    const c = this.ctx, w = performance.now() / 1000;
    if (c && c.state === 'running' && !document.hidden && this.lastW) {
      const dw = w - this.lastW, da = c.currentTime - this.lastA;
      this.stalls = dw > 1 && da < dw * 0.25 ? this.stalls + 1 : 0;
      if (this.stalls >= 2) this.broken = true;
    }
    this.lastW = w; this.lastA = c ? c.currentTime : 0;
  },
  tone(f, d, type = 'square', vol = .08, slide = 0, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .03);
  },
  play(n) {
    if (!save.settings.sound || !this.ctx) return;
    this.kick();
    const T = this.tone.bind(this);
    switch (n) {
      case 'tap': T(660, .04, 'triangle', .04); break;
      case 'step': T(230, .05, 'triangle', .05); break;
      case 'bump': T(95, .08, 'square', .05); break;
      case 'chomp': T(190, .07, 'square', .08, -90); T(270, .08, 'square', .07, -130, .07); break;
      case 'good': [523, 659, 784].forEach((f, i) => T(f, .12, 'triangle', .08, 0, i * .07)); break;
      case 'bad': T(210, .28, 'sawtooth', .05, -100); break;
      case 'hurt': T(340, .3, 'square', .07, -260); break;
      case 'coin': T(988, .06, 'square', .05); T(1319, .12, 'square', .05, 0, .06); break;
      case 'door': T(140, .3, 'triangle', .08, 140); break;
      case 'clear': [392, 523, 659, 784, 1047].forEach((f, i) => T(f, .14, 'triangle', .08, 0, i * .08)); break;
      case 'item': [523, 784, 1047, 1319].forEach((f, i) => T(f, .2, 'sine', .09, 0, i * .1)); break;
      case 'boss': T(110, .5, 'sawtooth', .06, -40); T(82, .6, 'sawtooth', .05, -20, .25); break;
      case 'hit': T(620, .1, 'square', .08, -420); T(300, .15, 'triangle', .07, -150, .08); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => T(f, .18, 'triangle', .09, 0, i * .11)); break;
    }
  }
};

/* ---------- read-aloud ---------- */
function mathSpeech(t) {
  return strip(t).replace(/\p{Extended_Pictographic}|️/gu, '')
    .replace(/ \? /g, ' what ').replace(/−/g, ' minus ').replace(/\+/g, ' plus ').replace(/=/g, ' equals ').replace(/ /g, ' ').replace(/…/g, '');
}
/* Voice: recorded clips (audio/voice.mp3 + audio/voice.js) are strung together to say each
   sentence, e.g. "Double" + "6" + "is" + "12". Anything the recording can't cover falls back to
   the device's built-in voice. */
const NUM_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
function speechTokens(text) {
  return mathSpeech(text).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
    .map(w => (w in NUM_WORDS ? String(NUM_WORDS[w]) : w));
}
const Clips = {
  map: null, index: {}, raw: null, buf: null, decoding: false, nodes: [], endAt: 0, waiting: null,
  init() {
    const V = window.VOICE; if (!V) return;
    this.map = V.clips;
    for (const [id, c] of Object.entries(V.clips)) {
      if (/^n\d+$/.test(id)) continue;
      const tk = speechTokens(c[2]); (this.index[tk[0]] = this.index[tk[0]] || []).push({ id, tk });
    }
    Object.values(this.index).forEach(a => a.sort((x, y) => y.tk.length - x.tk.length));
    try { fetch(V.file).then(r => (r.ok ? r.arrayBuffer() : null)).then(b => { this.raw = b; this.decode(); }).catch(() => {}); } catch (e) {}
  },
  decode() {
    if (this.buf || this.decoding || !this.raw) return;
    Sound.init(); if (!Sound.ctx) return;
    this.decoding = true;
    const done = b => { this.buf = b; this.decoding = false; const w = this.waiting; this.waiting = null; if (w) Voice.say(w.text, w.opts); };
    try { const p = Sound.ctx.decodeAudioData(this.raw.slice(0), done, () => { this.decoding = false; }); if (p && p.catch) p.catch(() => {}); } catch (e) { this.decoding = false; }
  },
  ids(text) {                      // longest-phrase-first match; null if any word isn't recorded
    if (!this.map) return null;
    const tk = speechTokens(text), out = [];
    for (let i = 0; i < tk.length;) {
      const hit = (this.index[tk[i]] || []).find(p => p.tk.every((w, k) => tk[i + k] === w));
      if (hit) { out.push(hit.id); i += hit.tk.length; continue; }
      if (/^\d+$/.test(tk[i]) && this.map['n' + tk[i]]) { out.push('n' + tk[i]); i++; continue; }
      return null;
    }
    return out.length ? out : null;
  },
  play(ids, queue) {
    const ctx = Sound.ctx; Sound.kick();
    let t = ctx.currentTime + 0.03;
    if (queue && this.endAt > t) t = this.endAt + 0.08; else this.stop();
    for (const id of ids) {
      const [off, dur] = this.map[id], s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = this.buf; g.gain.value = 0.95; s.connect(g).connect(ctx.destination);
      s.start(t, off, dur); this.nodes.push(s); t += dur - 0.03;
    }
    this.endAt = t;
    Music.duck(t);
  },
  stop() { this.nodes.forEach(n => { try { n.stop(); } catch (e) {} }); this.nodes = []; this.endAt = 0; },
};
/* Music: one composed 16-bar loop (audio/music.mp3, made by tools/music.py). A fresh copy starts every
   LOOP seconds and the 3 s tail rings into the next pass, so it repeats with no gap. Medium-low volume,
   ducked while the voice talks. */
const Music = {
  LOOP: 54.8571, LEVEL: 0.2, DUCK: 0.08,
  raw: null, buf: null, gain: null, next: 0, timer: null, on: false, decoding: false,
  init() { try { fetch('audio/music.mp3').then(r => (r.ok ? r.arrayBuffer() : null)).then(b => { this.raw = b; this.start(); }).catch(() => {}); } catch (e) {} },
  start() {
    if (!save.settings.music || !this.raw || !Sound.ctx) return;
    if (!this.buf) {
      if (this.decoding) return; this.decoding = true;
      const ok = b => { this.buf = b; this.decoding = false; this.start(); };
      try { const p = Sound.ctx.decodeAudioData(this.raw.slice(0), ok, () => { this.decoding = false; }); if (p && p.catch) p.catch(() => {}); } catch (e) { this.decoding = false; }
      return;
    }
    if (this.on) return;
    const ctx = Sound.ctx; Sound.kick();
    if (!this.gain) { this.gain = ctx.createGain(); this.gain.connect(ctx.destination); }
    this.gain.gain.cancelScheduledValues(ctx.currentTime); this.gain.gain.setValueAtTime(0, ctx.currentTime);
    this.gain.gain.linearRampToValueAtTime(this.LEVEL, ctx.currentTime + 2.5);       // fade in
    this.on = true; this.next = ctx.currentTime + 0.1; this.sources = []; this.pump();
    this.timer = setInterval(() => this.pump(), 1000);
  },
  pump() {
    const ctx = Sound.ctx; if (!this.on || !ctx) return;
    while (this.next < ctx.currentTime + 3) {
      const s = ctx.createBufferSource(); s.buffer = this.buf; s.connect(this.gain); s.start(this.next);
      this.sources.push(s); this.next += this.LOOP;
      s.onended = () => { this.sources = this.sources.filter(x => x !== s); };
    }
  },
  stop() {
    if (!this.on) return; this.on = false; clearInterval(this.timer);
    const ctx = Sound.ctx, t = ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t); this.gain.gain.setValueAtTime(this.gain.gain.value, t); this.gain.gain.linearRampToValueAtTime(0, t + 0.6);
    const old = this.sources; this.sources = []; setTimeout(() => old.forEach(s => { try { s.stop(); } catch (e) {} }), 700);
  },
  duck(until) {   // lower the music while the voice speaks
    if (!this.on || !this.gain) return;
    const ctx = Sound.ctx, g = this.gain.gain, t = ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(this.DUCK, t + 0.15);
    g.setValueAtTime(this.DUCK, Math.max(t + 0.15, until)); g.linearRampToValueAtTime(this.LEVEL, Math.max(t + 0.15, until) + 0.6);
  },
  reset() { clearInterval(this.timer); this.on = false; this.gain = null; this.sources = []; },   // engine replaced: old nodes are gone
  toggle(onOff) { save.settings.music = onOff; persist(); onOff ? this.start() : this.stop(); },
};
const Voice = {
  v: null, unlocked: false, log: null,
  pick() { try { const vs = speechSynthesis.getVoices(); const pref = ['Samantha', 'Karen', 'Moira', 'Google US English', 'Aria', 'Jenny'];
    this.v = pref.map(n => vs.find(v => v.name.includes(n) && /^en/i.test(v.lang))).find(Boolean) || vs.find(v => /^en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null; } catch (e) {} },
  unlock() { if (this.unlocked || !('speechSynthesis' in window)) return; this.unlocked = true; try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} },
  say(text, opts = {}) {
    if (!text) return;
    if (this.log) this.log.push(text);
    if (!save.settings.voice) return;
    const ids = Clips.ids(text);
    if (ids && Clips.buf && Sound.ctx) { if (!opts.queue) this.ttsStop(); Clips.play(ids, opts.queue); return; }
    if (ids && (Clips.decoding || (Clips.raw && !Clips.buf))) {           // recording still loading: wait briefly
      Clips.waiting = { text, opts }; Clips.decode();
      setTimeout(() => { if (Clips.waiting && Clips.waiting.text === text) { Clips.waiting = null; this.tts(text, opts); } }, 1500);
      return;
    }
    this.tts(text, opts);
  },
  tts(text, opts = {}) {
    if (!('speechSynthesis' in window)) return;
    try { if (!opts.queue) { speechSynthesis.cancel(); Clips.stop(); } const u = new SpeechSynthesisUtterance(mathSpeech(text)); if (!this.v) this.pick(); if (this.v) u.voice = this.v; u.rate = .95; u.pitch = 1.1; speechSynthesis.speak(u); } catch (e) {}
  },
  ttsStop() { try { speechSynthesis.cancel(); } catch (e) {} },
  stop() { this.ttsStop(); Clips.stop(); }
};
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => Voice.pick();
document.addEventListener('pointerdown', () => { Sound.wake(true); Clips.decode(); Music.start(); Voice.unlock(); }, true);
document.addEventListener('touchend', () => Sound.wake(true), true);     // older iPads only unlock audio on touchend
['pageshow', 'focus'].forEach(ev => window.addEventListener(ev, () => { if (Sound.ctx) Sound.wake(false); }));
setInterval(() => Sound.watch(), 1500);
