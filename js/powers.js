'use strict';
/* Digit Dungeon · powers.js: the math "powers" used in boss fights and monster squashes.

   Each power is a different kind of Unit 1 problem, picked at her current level for that skill:
     double   Double Fire       doubles facts                       (Adding)
     friends  Ten-Friend Blast  7 + ? = 10, on a ten-frame          (Adding)
     fact     Fact Punch        an addition or take-away fact       (Adding / Take-away; monsters only)
     flash    Flash Frame       ten-frame quick look: how many?     (Ten-frames)
     parity   Pair Power        is it even or odd?                  (Even & odd)
     hop      Hop Combo         2, 4, 6, what comes next?           (Counting by 2s / 5s / 10s)
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
};
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
      const top = Math.min(sk('add').level >= 2 ? 10 : 5, Math.floor(Math.min(cap, 20) / 2)); if (top < 2) return null;   // double 1 is too easy
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
      const pool = (skill === 'add' ? addPool(sk('add').level) : subPool(sk('sub').level)).filter(f => f.val <= cap);
      if (!pool.length) return null;
      const f = pickFact(pool), plus = f.op === '+', st = plus ? addStrategy(f.a, f.b) : subStrategy(f.a, f.b);
      return { ...base, skill, fact: { kind: 'fact', ...f }, ans: String(f.val), power: f.val, choices: numChoices(f.val),
        q: `${f.a} ${f.op} ${f.b} = <span class="qmark">?</span>`, say: `${f.a} ${plus ? 'plus' : 'minus'} ${f.b} equals what?`,
        right: `${f.a} ${plus ? 'plus' : 'minus'} ${f.b} is ${f.val}!`,
        hint: { text: `<span class="strat">${st.name}</span> ${st.text}`, say: st.text, pic: itemCard({ type: 'fact', ...f }).model },
        miss: { type: 'fact', key: `f:${f.a}${plus ? '+' : '-'}${f.b}`, ...f } };
    }
    case 'flash': {
      const lv = sk('frames').level, [lo, hi] = [[3, 10], [8, 20], [4, 20]][lv - 1], top = Math.min(hi, cap);
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
      const n = rnd(1, [10, 20, 40][sk('evenOdd').level - 1]), w = n % 2 ? 'odd' : 'even';
      const line = n <= 20 ? (n % 2 ? 'One is left over.' : 'Every dot has a partner.') : `It ends in ${n % 10}.`;
      return { ...base, skill: 'evenOdd', ans: w, power: Math.min(2, cap), choices: ['even', 'odd'], words: true,
        q: `<span class="bign">${n}</span> Even or odd?`, say: `Is ${n} even or odd?`, right: `${n} is ${w}!`,
        hint: { text: `${line} ${n} is ${w}.`, say: `${n} is ${w}. ${line}`, pic: n <= 20 ? pairsSVG(n, 16) : onesSVG(n) },
        miss: { type: 'parity', key: `p:${n}`, n } };
    }
    case 'hop': {
      const ok = skills.filter(s => +s.slice(4) <= cap); if (!ok.length) return null;
      const skill = weightedPick(ok, s => 1 + clamp(.9 - recentAcc(s), -.3, .6) * 2.5), step = +skill.slice(4), lv = sk(skill).level;
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
  }
  return null;
}
/* which powers to offer: weaker skills come up more (like the rooms), never the same kind twice in a row */
function pickPowers(ids, n, cap, favor = [], last = null) {
  const out = [], pool = ids.filter(id => powerSkills(id).length);
  while (out.length < n && pool.length) {
    const id = weightedPick(pool, p => {
      const acc = Math.min(...powerSkills(p).map(s => recentAcc(s)));
      return (1 + clamp(.9 - acc, -.3, .6) * 2.5) * (favor.includes(p) ? 2 : 1) * (p === last ? .2 : 1);
    });
    pool.splice(pool.indexOf(id), 1);
    const prob = makeProblem(id, cap); if (prob) out.push(prob);
  }
  return out;
}
const answerHTML = (p, wrong = []) => `<div class="choices">${p.choices.map(c => `<button class="ch${p.words ? ' word' : ''}" data-act="ans" data-v="${c}" ${wrong.includes(c) ? 'disabled' : ''}>${p.words ? c[0].toUpperCase() + c.slice(1) : c}</button>`).join('')}</div>`;
/* the problem as it appears in a fight: picture (quick looks fade; tap to peek again), question, choices, hint */
function problemHTML(p, wrong = [], hinted = false) {
  return `${p.pic ? `<div class="ppic${p.flash ? ' flashpic' : ''}" ${p.flash ? 'data-act="peek"' : ''}>${p.pic}${p.flash ? '<span class="peek-tag">👀 tap to peek</span>' : ''}</div>` : ''}
    <p class="boss-q pq">${p.q}</p>${answerHTML(p, wrong)}
    ${hinted ? `<div class="hint">${p.hint.pic ? `<div class="hpic">${p.hint.pic}</div>` : ''}💡 ${p.hint.text}</div>` : ''}`;
}
const peekAgain = el => { el.classList.remove('flashpic'); void el.offsetWidth; el.classList.add('flashpic'); };
