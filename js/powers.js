'use strict';
/* Digit Dungeon · powers.js: the math "powers" used in boss fights and monster squashes.

   Each power is a different kind of Unit 1 problem, picked at her current level for that skill:
     double   Double Fire       doubles facts                       (Adding)
     friends  Ten-Friend Blast  7 + ? = 10, on a ten-frame          (Adding)
     fact     Fact Punch        an addition or take-away fact       (Adding / Take-away; monsters only)
     flash    Flash Frame       ten-frame quick look: how many?     (Ten-frames)
     parity   Pair Power        is it even or odd?                  (Even & odd)
     hop      Hop Combo         2, 4, 6, what comes next?           (Counting by 2s / 5s / 10s)
   Unit 1 practice-test types (favored while "This week" focus is on):
     rack       Rack Look       how many beads on the number rack? (10 + 4, 7 + 7)   (Adding)
     rackParity Bead Pairs      even or odd? beads on the rack                    (Even & odd)
     compare    How Many More   two strips of boxes: 8 and 5, the difference is 3  (Take-away)
     story      Story Time      altogether (9 + 6) / gave some away (16 − ? = 9)   (Adding / Take-away)
     cards      Card Combo      use two number cards to make 11 (any pair works)   (Adding)
   Answers bigger than the boss's health (or than 10) hit for 3 instead.
   A power "hits" for the number she works out (Pair Power hits for 2), so in a boss fight the bead rack
   still shows the take-away. Every problem carries its own picture hint, the sentence said when she gets it
   right, and the mistake card that comes back later if she misses it. Skills the grown-ups switched off
   are never asked. */
const POWERS = {
  double:  { name: 'Double Fire', icon: '🔥', skills: ['add'] },
  friends: { name: 'Ten-Friend Blast', icon: '🥽', skills: ['add'] },
  fact:    { name: 'Fact Punch', icon: '💥', skills: ['add', 'sub'] },
  flash:   { name: 'Flash Frame', icon: '✨', skills: ['frames'] },
  parity:  { name: 'Pair Power', icon: '🧦', skills: ['evenOdd'] },
  hop:     { name: 'Hop Combo', icon: '🐸', skills: ['skip2', 'skip5', 'skip10'] },
  rack:    { name: 'Rack Look', icon: '🧮', skills: ['add'] },
  rackParity: { name: 'Bead Pairs', icon: '🧦', skills: ['evenOdd'] },
  compare: { name: 'How Many More', icon: '📏', skills: ['sub'] },
  story:   { name: 'Story Time', icon: '🦉', skills: ['add', 'sub'] },
  cards:   { name: 'Card Combo', icon: '🃏', skills: ['add'] },
};
const hit = (ans, cap) => (ans >= 1 && ans <= cap ? ans : Math.min(3, cap));   // what a power takes off a boss
/* a rack split the way the test shows them: 10 and some more, doubles, near doubles, or 9 and some more */
function rackSplit(minT = 11, maxT = 20) {
  for (let k = 0; k < 50; k++) {
    const r = Math.random(); let a, b;
    if (r < .4) { a = 10; b = rnd(1, 9); } else if (r < .65) { a = b = rnd(5, 10); }
    else if (r < .85) { a = rnd(5, 9); b = a + (Math.random() < .5 ? 1 : -1); } else { a = 9; b = rnd(0, 9); }
    if (a + b >= minT && a + b <= maxT && b >= 0 && b <= 10) return [a, b];
  }
  return [10, 4];
}
/* a second way to make the same total (the test asks for TWO equations) */
function otherWay(a, b) {
  const t = a + b;
  if (a !== 10 && b !== 10 && t > 10) return { eq: `10 + ${t - 10} = ${t}`, say: `Ten and ${t - 10} more is ${t}.` };
  if (t % 2 === 0) return { eq: `${t / 2} + ${t / 2} = ${t}`, say: `Double ${t / 2} is ${t}!` };
  return { eq: `${(t - 1) / 2} + ${(t + 1) / 2} = ${t}`, say: `${(t - 1) / 2} plus ${(t + 1) / 2} is ${t}.` };
}
const STORY_THINGS = [['coins', '🪙'], ['gems', '💎'], ['apples', '🍎']];
const powerSkills = id => POWERS[id].skills.filter(s => availableSkills().includes(s));

/* three answer choices: the answer and two near misses (never negative) */
function numChoices(ans, extra = []) {
  const set = new Set([ans]);
  [...shuffle(extra), ...shuffle([ans + 1, ans - 1, ans + 2, ans - 2])].filter(v => v >= 0 && v !== ans).forEach(v => { if (set.size < 3) set.add(v); });
  return shuffle([...set]).map(String);
}
const pickFact = facts => weightedPick(facts, factWeight);

/* make one problem. cap = most it may hit for (a boss's health; monsters have no health, so 20). null = can't. */
function makeProblem(id, cap = 20) {
  const P = POWERS[id], base = { id, name: P.name, icon: P.icon };
  const skills = powerSkills(id); if (!skills.length) return null;
  switch (id) {
    case 'double': {
      const top = Math.min(lvl('add') >= 2 ? 10 : 5, Math.floor(Math.min(cap, 20) / 2)); if (top < 2) return null;   // double 1 is too easy
      const facts = []; for (let n = 2; n <= top; n++) facts.push({ a: n, b: n, op: '+', val: 2 * n });
      const f = pickFact(facts), n = f.a;
      return { ...base, skill: 'add', fact: { kind: 'fact', ...f }, ans: String(2 * n), power: 2 * n, choices: numChoices(2 * n, [2 * n + 2, 2 * n - 2, n + 1]),
        q: `Double ${n} = <span class="qmark">?</span>`, say: `Double ${n} equals what?`, right: `Double ${n} is ${2 * n}!`,
        hint: { text: `Double ${n} is ${2 * n}! ${n} + ${n} = ${2 * n}.`, say: `Double ${n} is ${2 * n}!`, pic: framesSVG([{ n, cls: 'a' }, { n, cls: 'b' }], { cell: 20, frames: 2 * n > 10 ? 2 : 1 }) },
        miss: { type: 'fact', key: `f:${n}+${n}`, a: n, b: n, op: '+', val: 2 * n } };
    }
    case 'friends': {
      const facts = []; for (let a = 1; a <= 9; a++) if (10 - a <= cap) facts.push({ a, b: 10 - a, op: '+', val: 10 });
      if (!facts.length) return null;
      const f = pickFact(facts), { a, b } = f;
      return { ...base, skill: 'add', fact: { kind: 'fact', ...f }, ans: String(b), power: b, choices: numChoices(b, [a, 11 - a]),
        pic: framesSVG([{ n: a, cls: 'a' }], { cell: 22, frames: 1 }),
        q: `${a} + <span class="qmark">?</span> = 10`, say: `${a} and what make ten?`, right: `${a} and ${b} are ten-friends!`,
        hint: { text: `Count the empty boxes. ${a} and ${b} are ten-friends!`, say: `${a} and ${b} are ten-friends!`, pic: framesSVG([{ n: a, cls: 'a' }, { n: b, cls: 'b' }], { cell: 20, frames: 1 }) },
        miss: { type: 'fact', key: `f:${a}+${b}`, a, b, op: '+', val: 10 } };
    }
    case 'fact': {
      const skill = skills.includes('sub') && (!skills.includes('add') || Math.random() < .4) ? 'sub' : 'add';
      const pool = (skill === 'add' ? addPool(lvl('add')) : subPool(lvl('sub'))).filter(f => f.val <= cap);
      if (!pool.length) return null;
      const f = pickFact(pool), plus = f.op === '+', st = plus ? addStrategy(f.a, f.b) : subStrategy(f.a, f.b);
      return { ...base, skill, fact: { kind: 'fact', ...f }, ans: String(f.val), power: f.val, choices: numChoices(f.val),
        q: `${f.a} ${f.op} ${f.b} = <span class="qmark">?</span>`, say: `${f.a} ${plus ? 'plus' : 'minus'} ${f.b} equals what?`,
        right: `${f.a} ${plus ? 'plus' : 'minus'} ${f.b} is ${f.val}!`,
        hint: { text: `<span class="strat">${st.name}</span> ${st.text}`, say: st.text, pic: factLine(f.a, f.b, f.op, st.name) || itemCard({ type: 'fact', ...f }).model },
        miss: { type: 'fact', key: `f:${f.a}${plus ? '+' : '-'}${f.b}`, ...f } };
    }
    case 'flash': {
      const lv = lvl('frames'), [lo, hi] = [[3, 10], [8, 20], [4, 20]][lv - 1], top = Math.min(hi, cap);
      if (top < 1) return null;
      const n = rnd(Math.min(lo, top), top), segs = frameSegs(n, lv), frames = lv >= 2 || n > 10 ? 2 : 1;
      return { ...base, skill: 'frames', ans: String(n), power: n, choices: numChoices(n, [n + 10, n - 10, n + 5]),
        pic: framesSVG(segs, { cell: 22, frames }), flash: true,
        q: 'How many dots?', say: 'How many dots?', right: `This ten frame shows ${n}.`,
        hint: { text: describeFrame(n), say: `This ten frame shows ${n}. ${describeFrame(n)}`, pic: framesSVG(segs, { cell: 20, frames }) },
        miss: { type: 'frame', key: `fr:${n}`, n, segs, frames } };
    }
    case 'parity': {
      if (cap < 1) return null;
      const n = rnd(1, [10, 20, 40][lvl('evenOdd') - 1]), w = n % 2 ? 'odd' : 'even';
      const line = n <= 20 ? (n % 2 ? 'One is left over.' : 'Every dot has a partner.') : `It ends in ${n % 10}.`;
      return { ...base, skill: 'evenOdd', ans: w, power: Math.min(2, cap), choices: ['even', 'odd'], words: true,
        q: `<span class="bign">${n}</span> Even or odd?`, say: `Is ${n} even or odd?`, right: `${n} is ${w}!`,
        hint: { text: `${line} ${n} is ${w}.`, say: `${n} is ${w}. ${line}`, pic: n <= 20 ? pairsSVG(n, 16) : onesSVG(n) },
        miss: { type: 'parity', key: `p:${n}`, n } };
    }
    case 'hop': {
      const ok = skills.filter(s => +s.slice(4) <= cap); if (!ok.length) return null;
      const skill = weightedPick(ok, s => 1 + clamp(.9 - recentAcc(s), -.3, .6) * 2.5), step = +skill.slice(4), lv = lvl(skill);
      let start = step, max, offset = 0;                                    // same counts as the skip-counting rooms
      if (step === 10) { if (lv === 1) max = 100; else { offset = rnd(1, 9); start = offset; max = offset + 90; } }
      if (step === 5) max = lv === 1 ? 50 : 100;
      if (step === 2) { if (lv === 1) max = 20; else if (lv === 2) max = 40; else { offset = 1; start = 1; max = 31; } }
      const count = Math.floor((max - start) / step) + 1, k = rnd(0, Math.max(0, count - 4));
      const seq = [0, 1, 2].map(i => start + (k + i) * step), next = start + (k + 3) * step;
      const word = STEP_WORD[step];
      return { ...base, skill, ans: String(next), power: step, choices: numChoices(next, [next + 1, next - 1, next + step, seq[2] + 1]),
        q: `${seq.join(', ')}, <span class="qmark">?</span>`, say: `${seq.join(', ')}, what comes next?`, right: `${next}!`,
        hint: { text: `Counting by ${step}s: ${seq.join(', ')}, ${next}.`, say: `Counting by ${word}, we say ${seq.join(', ')}, ${next}`, pic: pathSVG(step, seq[0], next) },
        miss: { type: 'skip', key: `s:${step}:${offset}`, step, offset, level: lv, skill } };
    }
    case 'rack': {                     // test Q1: how many beads? two different equations
      const [a, b] = rackSplit(11, 20), t = a + b, two = otherWay(a, b), lead = a === 10 ? `Ten and ${b} more is ${t}.` : `${a} plus ${b} is ${t}.`;
      return { ...base, skill: 'add', split: [a, b], fact: { kind: 'fact', a, b, op: '+' }, ans: String(t), power: hit(t, cap),
        choices: numChoices(t, [t + 10, t - 10, t + 1, t - 1]), pic: rackHTML(t, 0, [a, b]), q: 'How many beads?', say: 'How many beads?', right: lead,
        hint: { text: `Top row ${a}, bottom row ${b}: ${a} + ${b} = ${t}. Another way: ${two.eq}.`, say: `${lead} ${two.say}`, pic: rackHTML(t, 0, [a, b]) },
        miss: { type: 'fact', key: `f:${a}+${b}`, a, b, op: '+', val: t } };
    }
    case 'rackParity': {               // test Q3: odd or even for each group of beads
      const [a, b] = Math.random() < .6 ? [10, rnd(0, 9)] : Math.random() < .5 ? [rnd(5, 9), 0] : rackSplit(11, 19), n = a + b, w = n % 2 ? 'odd' : 'even';
      const line = n % 2 ? 'One is left over.' : 'Every dot has a partner.';
      return { ...base, skill: 'evenOdd', split: [a, b], ans: w, power: Math.min(2, cap), choices: ['even', 'odd'], words: true, pic: rackHTML(n, 0, [a, b]),
        q: 'Even or odd?', say: 'Even or odd?', right: `${n} is ${w}!`,
        hint: { text: `${a} + ${b} = ${n}. ${line} ${n} is ${w}.`, say: `${n} is ${w}. ${line}`, pic: pairsSVG(n, 16) },
        miss: { type: 'parity', key: `p:${n}`, n } };
    }
    case 'compare': {                  // test Q2: color the boxes, the difference between 8 and 5 is 3
      const a = rnd(4, 10), b = rnd(1, a - 1), d = a - b;
      return { ...base, skill: 'sub', bars: [a, b], fact: { kind: 'fact', a, b, op: '−' }, ans: String(d), power: hit(d, cap),
        choices: numChoices(d, [a, b, d + 1]), pic: compareSVG(a, b), q: 'How many more?', say: 'How many more?', right: `${a} minus ${b} is ${d}!`,
        hint: { text: `Look at the boxes past ${b}. The difference between ${a} and ${b} is ${d}: ${a} − ${b} = ${d}.`, say: `The difference between ${a} and ${b} is ${d}.`, pic: compareSVG(a, b, true) },
        miss: { type: 'fact', key: `f:${a}-${b}`, a, b, op: '−', val: d } };
    }
    case 'story': {                    // test Q4: altogether, or gave some away (count up on a number line)
      const [thing, ic] = pick(STORY_THINGS), join = !skills.includes('sub') || (skills.includes('add') && Math.random() < .5);
      if (join) {
        let a, b; do { a = rnd(5, 9); b = rnd(3, 9); } while (a + b <= 10);
        const t = a + b, j = makeTenJumps(a, b);
        return { ...base, skill: 'add', story: { kind: 'join', a, b }, fact: { kind: 'fact', a, b, op: '+' }, ans: String(t), power: hit(t, cap), choices: numChoices(t, [t + 1, t - 1, t + 10, Math.abs(a - b)]),
          q: `<span class="story">You found <b>${a}</b> ${ic}. Hoot found <b>${b}</b> ${ic}. How many altogether?</span>`,
          say: `You found ${a} ${thing}. Hoot found ${b} ${thing}. How many altogether?`, right: `${a} plus ${b} is ${t}!`,
          hint: { text: `${a} + ${b} = ${t}. Make ten: ${Math.max(a, b)} + ${10 - Math.max(a, b)} = 10, then ${t - 10} more.`, say: `${a} plus ${b} is ${t}!`, pic: j ? jumpLineSVG(j.start, j.jumps) : framesSVG([{ n: a, cls: 'a' }, { n: b, cls: 'b' }], { cell: 20, frames: 2 }) },
          miss: { type: 'fact', key: `f:${a}+${b}`, a, b, op: '+', val: t } };
      }
      let a, b; do { a = rnd(11, 18); b = rnd(5, 9); } while (a - b < 2 || a - b > 9);
      const d = a - b, j = countUpJumps(a, b);
      return { ...base, skill: 'sub', story: { kind: 'away', a, b }, fact: { kind: 'fact', a, b: d, op: '−' }, ans: String(d), power: hit(d, cap), choices: numChoices(d, [b, a - 10, d + 1]),
        q: `<span class="story">You had <b>${a}</b> ${ic}. You gave some to Hoot. Now you have <b>${b}</b>. How many did you give away?</span>`,
        say: `You had ${a} ${thing}. You gave some to Hoot. Now you have ${b}. How many did you give away?`, right: `${a} minus ${d} is ${b}!`,
        hint: { text: `Count up from ${b} to ${a}: ${10 - b} to get to 10, then ${a - 10} more. ${10 - b} + ${a - 10} = ${d}, so ${a} − ${d} = ${b}.`, say: `${b} plus ${d} is ${a}. So ${a} minus ${b} is ${d}.`, pic: j ? jumpLineSVG(j.start, j.jumps) : '' },
        miss: { type: 'fact', key: `f:${a}-${d}`, a, b: d, op: '−', val: b } };
    }
    case 'cards': {                    // test Q8: use number cards to make your number (two different ways)
      for (let k = 0; k < 200; k++) {
        const t = rnd(11, 16), pairs = []; for (let x = 2; x <= 9; x++) { const y = t - x; if (y > x && y <= 9) pairs.push([x, y]); }
        if (pairs.length < 2) continue;
        const [p1, p2] = shuffle(pairs).slice(0, 2), used = new Set([...p1, ...p2]); if (used.size < 4) continue;
        const extra = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter(v => !used.has(v) && !used.has(t - v)))[0]; if (!extra) continue;
        const cards = shuffle([...p1, ...p2, extra]), ways = pairs.filter(([x, y]) => cards.includes(x) && cards.includes(y));
        return { ...base, skill: 'add', cards, target: t, ways, fact: { kind: 'fact', a: p1[0], b: p1[1], op: '+' }, ans: 'ok', power: Math.min(3, cap), choices: [],
          q: `Use two cards to make <b>${t}</b>`, say: `Use two cards to make ${t}.`, right: `${p1[0]} plus ${p1[1]} is ${t}!`,
          hint: { text: `Two ways: ${ways.map(([x, y]) => `${x} + ${y} = ${t}`).join(' and ')}.`, say: `${ways[0][0]} plus ${ways[0][1]} is ${t}.`, pic: '' },
          miss: { type: 'fact', key: `f:${p1[0]}+${p1[1]}`, a: p1[0], b: p1[1], op: '+', val: t } };
      }
      return null;
    }
  }
  return null;
}
/* which powers to offer: weaker skills come up more (like the rooms), never the same kind twice in a row */
function pickPowers(ids, n, cap, favor = [], last = null) {
  const out = [], pool = ids.filter(id => powerSkills(id).length);
  while (out.length < n && pool.length) {
    const id = weightedPick(pool, p => {
      const acc = Math.min(...powerSkills(p).map(s => recentAcc(s)));
      const fw = focusOn() ? (FOCUS.powers.includes(p) ? 3 : .35) : (FOCUS.powers.includes(p) && p !== 'fact' ? .6 : 1);   // this week's test types
      return (1 + clamp(.9 - acc, -.3, .6) * 2.5) * (favor.includes(p) ? 2 : 1) * (p === last ? .2 : 1) * fw;
    });
    pool.splice(pool.indexOf(id), 1);
    const prob = makeProblem(id, cap); if (prob) out.push(prob);
  }
  return out;
}
const answerHTML = (p, wrong = []) => p.cards
  ? `<div class="cards">${p.cards.map((v, i) => `<button class="ncard${(p.sel || []).includes(i) ? ' sel' : ''}" data-act="card" data-i="${i}">${numCardSVG(v, (p.sel || []).includes(i))}</button>`).join('')}</div>`
  : `<div class="choices">${p.choices.map(c => `<button class="ch${p.words ? ' word' : ''}" data-act="ans" data-v="${c}" ${wrong.includes(c) ? 'disabled' : ''}>${p.words ? c[0].toUpperCase() + c.slice(1) : c}</button>`).join('')}</div>`;
/* Card Combo: tap two cards. Returns the answer to check ('ok' if they make the number), or null while picking. */
function pickCard(p, i) {
  p.sel = (p.sel || []).includes(i) ? p.sel.filter(k => k !== i) : [...(p.sel || []), i];
  if (p.sel.length < 2) return null;
  const [x, y] = p.sel.map(k => p.cards[k]); p.sel = [];
  if (x + y === p.target) { p.right = `${x} plus ${y} is ${p.target}!`; p.fact = { kind: 'fact', a: x, b: y, op: '+' }; p.other = p.ways.find(w => !(w.includes(x) && w.includes(y))); return 'ok'; }
  return `${x}+${y}`;
}
/* the problem as it appears in a fight: picture (quick looks fade; tap to peek again), question, choices, hint */
function problemHTML(p, wrong = [], hinted = false) {
  return `${p.pic ? `<div class="ppic${p.flash ? ' flashpic' : ''}" ${p.flash ? 'data-act="peek"' : ''}>${p.pic}${p.flash ? '<span class="peek-tag">👀 tap to peek</span>' : ''}</div>` : ''}
    <p class="boss-q pq">${p.q}</p>${answerHTML(p, wrong)}
    ${hinted ? `<div class="hint">${p.hint.pic ? `<div class="hpic">${p.hint.pic}</div>` : ''}💡 ${p.hint.text}</div>` : ''}`;
}
const peekAgain = el => { el.classList.remove('flashpic'); void el.offsetWidth; el.classList.add('flashpic'); };
const POWER_ART = { rackParity: 'parity' };   // shares the paired-counters picture
const POWER_PIC = {                             // drawn icons for powers without Gemini art (big shapes so they read when small)
  rack: () => { let b = ''; [[0, 5], [1, 3]].forEach(([r, n]) => { for (let i = 0; i < n; i++) b += `<circle cx="${17 + i * 15}" cy="${21 + r * 24}" r="6.6" fill="${i < 3 ? '#ff5a6e' : '#fff3da'}" stroke="#2a1f3a" stroke-width="2"/>`; });
    return `<svg viewBox="0 0 100 64" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="94" height="58" rx="8" fill="#c98a4a" stroke="#2a1f3a" stroke-width="3.5"/><rect x="10" y="10" width="80" height="44" rx="4" fill="#f3dfb8" stroke="#2a1f3a" stroke-width="2"/><path d="M10 21H90M10 45H90" stroke="#8a7aa3" stroke-width="3"/>${b}</svg>`; },
  compare: () => compareSVG(5, 3), cards: () => `<span class="trio">${[7, 4, 9].map(v => numCardSVG(v)).join('')}</span>` };
const powerIcon = p => { const a = ART.powers && ART.powers[POWER_ART[p.id] || p.id];
  return a ? `<img class="pwi" src="${a}" alt="" draggable="false">` : POWER_PIC[p.id] ? `<span class="pwi pwsvg">${POWER_PIC[p.id]()}</span>` : p.icon; };
