'use strict';
/* Digit Dungeon · curriculum.js: The math: skills, fact pools, and the rule builders that make every room. */

/* =====================================================================
   CURRICULUM
   ===================================================================== */
const SKILLS = {
  frames:  { name: 'Ten-frame quick looks', short: 'Ten-frames', max: 3 },
  evenOdd: { name: 'Even & odd', short: 'Even & odd', max: 3 },
  skip10:  { name: 'Counting by 10s', short: 'By 10s', max: 2 },
  skip5:   { name: 'Counting by 5s', short: 'By 5s', max: 2 },
  skip2:   { name: 'Counting by 2s', short: 'By 2s', max: 3 },
  add:     { name: 'Addition facts to 20', short: 'Adding', max: 4 },
  sub:     { name: 'Take-away facts to 20', short: 'Take-away', max: 3, gate: () => sk('add').level >= 2, gateText: 'starts once Adding reaches level 2' },
};
const LEVEL_NOTES = {
  frames: ['1–10, one frame', 'teens: a ten and some more', 'any split, up to 20'],
  evenOdd: ['up to 10', 'up to 20', 'up to 40'],
  skip10: ['10, 20, 30…', 'from any number (3, 13, 23…)'],
  skip5: ['to 50', 'to 100'],
  skip2: ['to 20', 'to 40', 'from 1 (odd numbers)'],
  add: ['sums to 10: +0/1/2, doubles, ten-friends', 'doubles to 20, +10, count on', 'near doubles, +9', 'all facts to 20'],
  sub: ['within 10: −1/2/3, halves', 'teens: −10, back to ten', 'all facts to 20'],
};
/* This week's focus (a Grown-ups switch): the Unit 1 practice test. Rooms lean to sums and differences to 20
   (take-away unlocked, all facts in the mix) and even/odd to 20; fights favor the test-style powers: number-rack
   quick looks, even/odd beads, how many more, story problems and number cards. Skip counting and ten-frames rest. */
const FOCUS = { name: 'Unit 1 practice test', levels: { add: 4, sub: 3, evenOdd: 2 },
  weights: { add: 1.5, sub: 2.2, evenOdd: 1.6, frames: .5, skip10: .25, skip5: .25, skip2: .35 },
  powers: ['rack', 'rackParity', 'compare', 'story', 'cards', 'fact'] };
const focusOn = () => !!(save.settings && save.settings.focus);
function lvl(id) { const l = sk(id).level; return focusOn() && FOCUS.levels[id] ? Math.max(l, FOCUS.levels[id]) : l; }
function sk(id) { return save.skills[id] || (save.skills[id] = { level: 1, recent: [], correct: 0, tries: 0, last: -99 }); }
function availableSkills() {
  const ids = Object.keys(SKILLS).filter(id => save.settings.skills[id] !== false && (!SKILLS[id].gate || SKILLS[id].gate() || (focusOn() && FOCUS.levels[id])));
  return ids.length ? ids : ['add'];
}
function recentAcc(id, n = 12, dflt = .8) { const r = sk(id).recent.slice(-n); return r.length >= 4 ? mean(r) : dflt; }

/* Interleaved + weakness-weighted + spaced skill choice */
function pickSkill() {
  const ids = availableSkills();
  return weightedPick(ids, id => {
    const s = sk(id);
    let w = 1 + clamp(.9 - recentAcc(id), -.3, .6) * 2.5;
    if (id === 'add') w *= 2.2; if (id === 'sub') w *= 1.4;
    if (focusOn()) w *= FOCUS.weights[id] || 1;
    if (id === run.lastSkill && ids.length > 1) w *= .15;
    const since = save.roomCount - s.last; w *= 1 + clamp(since, 0, 8) * .08;
    return Math.max(.05, w);
  });
}

/* --- fact pools (ordered facts so turnaround facts both appear) --- */
function addPool(level) {
  const out = [];
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) {
    const s = a + b, mn = Math.min(a, b); if (s === 0) continue;
    let ok = s <= 10 && (mn <= 2 || a === b || s === 10);
    if (level >= 2 && (a === b || a === 10 || b === 10 || mn <= 3)) ok = true;
    if (level >= 3 && (Math.abs(a - b) === 1 || a === 9 || b === 9 || s <= 10)) ok = true;
    if (level >= 4) ok = true;
    if (ok) out.push({ a, b, op: '+', val: s });
  }
  return out;
}
function subPool(level) {
  const out = [];
  for (let a = 1; a <= 20; a++) for (let b = 0; b <= 10; b++) {
    const r = a - b; if (r < 0 || r > 10) continue;
    let ok = a <= 10 && (b <= 3 || a === 2 * b || a === 10);
    if (level >= 2 && a > 10 && (b === 10 || b === a - 10 || a === 2 * b || b <= 3)) ok = true;
    if (level >= 3) ok = true;
    if (ok) out.push({ a, b, op: '−', val: r });
  }
  return out;
}
const factKey = f => `${f.a}${f.op === '+' ? '+' : '-'}${f.b}`;
const BOX_W = { 1: 5, 2: 3, 3: 2, 4: 1.2, 5: .7 };
function factWeight(f) { const r = save.facts[factKey(f)]; return BOX_W[r ? r.b : 2]; }

/* --- rule builders: each returns {rule, tiles} --- */
function ruleEquals(skill, level, nC, nT) {
  const op = skill === 'add' ? '+' : '−';
  const pool = skill === 'add' ? addPool(level) : subPool(level);
  const byVal = {}; pool.forEach(f => (byVal[f.val] = byVal[f.val] || []).push(f));
  const [lo, hi] = skill === 'add' ? [[5, 10], [6, 20], [8, 18], [10, 18]][level - 1] : [[1, 7], [2, 10], [3, 10]][level - 1];
  let vals = Object.keys(byVal).map(Number).filter(v => v >= lo && v <= hi && byVal[v].length >= Math.min(nC, 4));
  if (!vals.length) vals = Object.keys(byVal).map(Number);
  const N = weightedPick(vals, v => mean(byVal[v].map(factWeight)) * (v === run.lastTarget ? .15 : 1) * (skill === 'add' && v === 10 && level <= 2 ? 1.6 : 1));
  run.lastTarget = N;
  const correct = sampleW(byVal[N], Math.min(nC, byVal[N].length), factWeight);
  const near = pool.filter(f => f.val !== N && Math.abs(f.val - N) <= 2);
  let dis = sampleW(near, nT - correct.length, f => (Math.abs(f.val - N) === 1 ? 2.5 : 1.2) * factWeight(f));
  if (dis.length < nT - correct.length) dis = dis.concat(sampleW(pool.filter(f => f.val !== N && !dis.includes(f)), nT - correct.length - dis.length, () => 1));
  const tile = (f, ok) => ({ kind: 'fact', label: `${f.a} ${f.op} ${f.b}`, value: f.val, correct: ok, a: f.a, b: f.b, op: f.op });
  return {
    rule: { skill, kind: 'equals', op, target: N, title: `Make ${N}`, speak: skill === 'add' ? `Chomp the facts that make ${N}!` : `Chomp the take-away facts that make ${N}!` },
    tiles: [...correct.map(f => tile(f, true)), ...dis.map(f => tile(f, false))]
  };
}
function ruleParity(level, nC, nT, force) {
  const max = Math.max([10, 20, 40][level - 1], force || 0);
  const want = force ? (force % 2 ? 'odd' : 'even') : (Math.random() < .5 ? 'even' : 'odd');
  const isW = n => (n % 2 === 0) === (want === 'even');
  const nums = []; for (let n = 1; n <= max; n++) nums.push(n);
  let good = takeCycle(shuffle(nums.filter(n => isW(n) && n !== force)), force ? nC - 1 : nC);
  if (force) good = [force, ...good];
  const bad = takeCycle(shuffle(nums.filter(n => !isW(n))), nT - nC);
  const t = (n, ok) => ({ kind: 'num', label: String(n), value: n, correct: ok });
  return { rule: { skill: 'evenOdd', kind: 'parity', want, title: want === 'even' ? 'Even numbers' : 'Odd numbers', speak: `Chomp the ${want} numbers!` },
    tiles: [...good.map(n => t(n, true)), ...bad.map(n => t(n, false))] };
}
function ruleSkip(step, level, nC, nT, force) {
  let start = step, max, offset = 0;
  if (step === 10) { if (level === 1) max = 100; else { offset = force || rnd(1, 9); start = offset; max = offset + 90; } }
  if (step === 5) max = level === 1 ? 50 : 100;
  if (step === 2) { if (level === 1) max = 20; else if (level === 2) max = 40; else { offset = 1; start = 1; max = 31; } }
  const seq = []; for (let v = start; v <= max; v += step) seq.push(v);
  // True math: any number we say in the count is right, no matter how big.
  // (Bug fix: 22 used to be "wrong" in Count by 2s because that room stopped at 20.)
  const inSeq = n => n >= start && (n - start) % step === 0;
  const cand = new Set();
  seq.forEach(v => [-2, -1, 1, 2, 3, step === 10 ? 5 : 4].forEach(d => { const n = v + d; if (n >= 1 && n <= max + 4 && !inSeq(n)) cand.add(n); }));
  const good = takeCycle(shuffle(seq.slice()), nC), bad = takeCycle(shuffle([...cand]), nT - nC);
  const t = (n, ok) => ({ kind: 'num', label: String(n), value: n, correct: ok });
  const from = offset ? ` from ${offset}` : '', word = { 2: 'twos', 5: 'fives', 10: 'tens' }[step];
  return { rule: { skill: 'skip' + step, kind: 'skip', step, start, max, offset, title: `Count by ${step}s${from}`, speak: `Chomp the numbers we say when we count by ${word}${offset ? `, starting at ${offset}` : ''}!` },
    tiles: [...good.map(n => t(n, true)), ...bad.map(n => t(n, false))] };
}
function frameSegs(v, level) {
  if (level === 2 && v > 10) return [{ n: 10, cls: 'a' }, { n: v - 10, cls: 'b' }];
  if (level === 3 && v > 1) { const s = rnd(1, v - 1); return [{ n: s, cls: 'a' }, { n: v - s, cls: 'b' }]; }
  return [{ n: v, cls: 'a' }];
}
function ruleFrames(level, nC, nT, force) {
  let [lo, hi, nlo, nhi] = [[1, 10, 3, 9], [8, 20, 11, 19], [1, 20, 6, 19]][level - 1], N;
  if (force) { N = force; lo = Math.max(1, Math.min(lo, N - 2)); hi = Math.min(20, Math.max(hi, N + 2)); }
  else do { N = rnd(nlo, nhi); } while (N === run.lastTarget && nhi > nlo);
  run.lastTarget = N;
  const near = [N - 2, N - 1, N + 1, N + 2].filter(v => v >= lo && v <= hi);
  if (level === 3 && N > 10) near.push(N - 10);
  const frames = level >= 2 || N > 10 ? 2 : 1;
  const t = (v, ok) => ({ kind: 'frame', label: 'a ten frame', value: v, correct: ok, segs: frameSegs(v, level), frames });
  const bad = takeCycle(shuffle(near), Math.max(2, nT - nC - 3));
  return { rule: { skill: 'frames', kind: 'frames', target: N, title: `Find ${N}`, speak: `Chomp the ten frames that show ${N}!` },
    tiles: [...Array(nC).fill(0).map(() => t(N, true)), ...bad.map(v => t(v, false))] };
}
function makeRule(skill, level, nC, nT) {
  switch (skill) {
    case 'add': case 'sub': return ruleEquals(skill, level, nC, nT);
    case 'evenOdd': return ruleParity(level, nC, nT);
    case 'skip10': return ruleSkip(10, level, nC, nT);
    case 'skip5': return ruleSkip(5, level, nC, nT);
    case 'skip2': return ruleSkip(2, level, nC, nT);
    default: return ruleFrames(level, nC, nT);
  }
}
