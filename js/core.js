'use strict';
/* Digit Dungeon · core.js: Helpers, save data, sound effects, read-aloud voice. */

/* =====================================================================
   DIGIT DUNGEON — a math roguelite for 2nd grade
   Curriculum: Bridges in Mathematics, Grade 2, Unit 1 "Figuring the Facts"
   (facts to 20, doubles, make ten, add ten, ten-frames, number rack,
    skip counting by 2s/5s/10s, even & odd)
   ===================================================================== */


const BUILD = 'v3';   // bump with the ?v3 tags in index.html on every release

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
  return { v: 1, name: '', stars: 0, cosmetics: { color: 'mint', hat: 'none' }, unlocks: [], best: { floor: 0, wins: 0 },
    runsPlayed: 0, roomCount: 0, roomsEver: 0, chompsEver: 0, remembered: 0, comeback: [], skills: {}, facts: {}, days: {},
    settings: { voice: true, sound: true, mistakes: true, monsters: true, readTiles: false,
      skills: { frames: true, evenOdd: true, skip10: true, skip5: true, skip2: true, add: true, sub: true } },
    run: null };
}
function merge(base, over) { for (const k in over) { if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') merge(base[k], over[k]); else base[k] = over[k]; } return base; }
function loadSave() { try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const v = merge(defaultSave(), JSON.parse(raw)); if (v.run && v.run.ver !== 2) v.run = null; return v; } } catch (e) {} return defaultSave(); }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
let save = loadSave();

/* ---------- sound ---------- */
const Sound = {
  ctx: null,
  init() { if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} },
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
    if (this.ctx.state === 'suspended') this.ctx.resume();
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
const Voice = {
  v: null, unlocked: false,
  pick() { try { const vs = speechSynthesis.getVoices(); const pref = ['Samantha', 'Karen', 'Moira', 'Google US English', 'Aria', 'Jenny'];
    this.v = pref.map(n => vs.find(v => v.name.includes(n) && /^en/i.test(v.lang))).find(Boolean) || vs.find(v => /^en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null; } catch (e) {} },
  unlock() { if (this.unlocked || !('speechSynthesis' in window)) return; this.unlocked = true; try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} },
  say(text) {
    if (!save.settings.voice || !('speechSynthesis' in window) || !text) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(mathSpeech(text)); if (!this.v) this.pick(); if (this.v) u.voice = this.v; u.rate = .95; u.pitch = 1.1; speechSynthesis.speak(u); } catch (e) {}
  },
  stop() { try { speechSynthesis.cancel(); } catch (e) {} }
};
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => Voice.pick();
document.addEventListener('pointerdown', () => { Sound.init(); if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume(); Voice.unlock(); }, true);
