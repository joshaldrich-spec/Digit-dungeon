"""Digit Dungeon checks: one command before every release.

    python3 tests/check.py           # all checks (about a minute)
    python3 tests/check.py --shots   # also save screenshots to tests/shots/

Needs: pip install playwright (Chromium is used headless).
"""
import asyncio, functools, http.server, json, os, sys, threading, time
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
_srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(_Quiet, directory=ROOT))
threading.Thread(target=_srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{_srv.server_address[1]}/index.html'   # served over http so the voice recording can load
SHOTS = os.path.join(HERE, 'shots')
WANT_SHOTS = '--shots' in sys.argv
results, errors = [], []

def report(name, ok, detail=''):
    results.append((name, ok)); print(('PASS ' if ok else 'FAIL ') + name + (f'  {detail}' if detail else ''))

FRESH = "localStorage.clear(); save = defaultSave(); save.name = 'T'; save.settings.voice = false; save.settings.sound = false; persist();"

# ---- 0. every sentence the game can say is built from recorded clips
# phrases written into the game but not recorded yet (docs/voice-script-2.txt); until they are, those sentences use the
# device voice. A sentence passes if everything except these phrases is recorded.
PENDING = ['How many beads?', 'How many more?', 'The difference between', 'You found', 'Hoot found', 'How many altogether?',   # docs/voice-script-3.txt
           'You gave some to Hoot.', 'Now you have', 'How many did you give away?', 'gems', 'apples', 'Use two cards to make']
OK_SAID = "const PENDING = %s; const okSaid = t => { if (Clips.ids(t)) return true; const rest = PENDING.reduce((s, p) => s.split(p).join(' '), t).replace(/\\s+/g, ' ').trim(); return rest !== t.trim() && (!rest || !!Clips.ids(rest)); };" % json.dumps(PENDING)
VOICE = r"""() => { OK_SAID
  const missing = new Set(), texts = [];
  const add = t => { texts.push(t); if (!okSaid(t)) missing.add(t); };
  run = { lastSkill: null, lastTarget: null, items: [], floor: 1, roomsCleared: 0, comebackQueue: [] };
  for (const [skill, maxL] of [['add', 4], ['sub', 3], ['evenOdd', 3], ['skip10', 2], ['skip5', 2], ['skip2', 3], ['frames', 3]])
    for (let lv = 1; lv <= maxL; lv++) for (let i = 0; i < 60; i++) {
      const m = makeRule(skill, lv, 5, 13); add(m.rule.speak); add('Comeback room! ' + m.rule.speak);
      m.tiles.forEach(t => { if (t.correct) add(rightSpeech(m.rule, t)); else add(coachContent(m.rule, t).say); if (t.kind !== 'frame') add(t.label); });
    }
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) { add(addStrategy(a, b).text); add(itemCard({ type: 'fact', a, b, op: '+', val: a + b }).say); }
  for (let a = 0; a <= 20; a++) for (let b = 0; b <= Math.min(a, 10); b++) { add(subStrategy(a, b).text); add(itemCard({ type: 'fact', a, b, op: '−', val: a - b }).say); }
  for (let f = 1; f <= 3; f++) { run.floor = f; for (let hp = 1; hp <= 20; hp++) for (let i = 0; i < 20; i++) takeMoves(hp).forEach(m => { const p = takeProblem(hp, m); add(p.hint.say); add(p.say); add(`Hit! ${hp - m.k} left.`); }); }
  for (let lv = 1; lv <= 4; lv++) { Object.keys(SKILLS).forEach(id => sk(id).level = Math.min(lv, SKILLS[id].max));     // every power at every level
    for (const id of Object.keys(POWERS)) for (let i = 0; i < 60; i++) { const p = makeProblem(id, rnd(1, 20)); if (!p) continue;
      add(p.say); add(p.right); add(p.hint.say); add(`${p.right} Hit! ${rnd(1, 19)} left.`); add('A monster jumped out! ' + p.say); } }
  Object.keys(SKILLS).forEach(id => sk(id).level = 1);
  [[2, 0], [2, 1], [5, 0], [10, 0], [10, 7]].forEach(([step, offset]) => add(itemCard({ type: 'skip', step, offset }).say));
  for (let n = 1; n <= 40; n++) add(itemCard({ type: 'parity', n }).say);
  for (let n = 1; n <= 20; n++) add(itemCard({ type: 'frame', n }).say);
  Object.values(ITEMS).forEach(it => add(it.say));
  return { checked: texts.length, missing: [...missing].slice(0, 12) };
}""".replace('OK_SAID', OK_SAID)

# ---- 1. math truth: judge every tile from its label + the room title, never from the generator's own fields
MATH = r"""() => {
  const problems = [];
  const truth = (title, t) => {
    let m;
    if ((m = title.match(/^Make (\d+)$/))) { const e = t.label.match(/^(\d+) ([+−]) (\d+)$/); if (!e) return { err: 'bad label ' + t.label };
      const v = e[2] === '+' ? +e[1] + +e[3] : +e[1] - +e[3]; return { ok: v === +m[1], v, neg: v < 0 }; }
    if (title === 'Even numbers' || title === 'Odd numbers') { const n = +t.label; return { ok: (n % 2 === 0) === (title === 'Even numbers'), v: n }; }
    if ((m = title.match(/^Count by (\d+)s(?: from (\d+))?$/))) { const st = m[2] ? +m[2] : +m[1], n = +t.label; return { ok: n >= st && (n - st) % +m[1] === 0, v: n }; }
    if ((m = title.match(/^Find (\d+)$/))) { const dots = t.segs.reduce((a, g) => a + g.n, 0); return { ok: dots === +m[1], v: dots }; }
    return { err: 'unknown title ' + title };
  };
  const check = (made, tag, minRight) => {
    const r = made.rule;
    if (made.tiles.filter(t => t.correct).length < minRight) problems.push(`${tag}: too few right answers`);
    for (const t of made.tiles) {
      const tr = truth(r.title, t);
      if (tr.err) { problems.push(`${tag}: ${tr.err}`); continue; }
      if (tr.neg) problems.push(`${tag}: negative ${t.label}`);
      if (tr.ok !== t.correct) problems.push(`${tag}: "${t.label}" in "${r.title}" marked ${t.correct ? 'RIGHT' : 'WRONG'}`);
      if (tr.v !== t.value) problems.push(`${tag}: value mismatch ${t.label}`);
      if (!t.correct) {
        const c = coachContent(r, t);
        if (/undefined|NaN/.test(c.say + c.title + c.line)) problems.push(`${tag}: coach text broken`);
        if (r.kind === 'equals' && !c.title.includes('= ' + tr.v)) problems.push(`${tag}: coach says ${c.title}`);
        if (r.kind === 'parity' && c.title !== `${tr.v} is ${tr.v % 2 ? 'odd' : 'even'}`) problems.push(`${tag}: coach says ${c.title}`);
        if (r.kind === 'skip') { const mm = c.line.match(/By (\d+)s: (\d+), (\d+)/), mem = n => n >= r.start && (n - r.start) % r.step === 0;
          if (mm ? !(mem(+mm[2]) && mem(+mm[3]) && +mm[2] < tr.v && tr.v < +mm[3]) : !(tr.v < r.start)) problems.push(`${tag}: skip coach wrong for ${tr.v}`); }
      }
    }
  };
  run = { lastSkill: null, lastTarget: null, items: [], floor: 1, roomsCleared: 0, comebackQueue: [] };
  let rooms = 0;
  for (const [skill, maxL] of [['add', 4], ['sub', 3], ['evenOdd', 3], ['skip10', 2], ['skip5', 2], ['skip2', 3], ['frames', 3]])
    for (let lv = 1; lv <= maxL; lv++) for (let i = 0; i < 250; i++) for (const [nC, nT] of [[4, 8], [4, 11], [5, 13]]) { check(makeRule(skill, lv, nC, nT), `${skill} L${lv}`, 2); rooms++; }
  const items = [];
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) if (a + b) items.push({ type: 'fact', key: `f:${a}+${b}`, a, b, op: '+', val: a + b });
  for (let a = 1; a <= 20; a++) for (let b = 0; b <= 10; b++) if (a >= b) items.push({ type: 'fact', key: `f:${a}-${b}`, a, b, op: '−', val: a - b });
  for (let n = 1; n <= 40; n++) items.push({ type: 'parity', key: 'p:' + n, n });
  for (let n = 1; n <= 20; n++) items.push({ type: 'frame', key: 'fr:' + n, n });
  [[2, 0, 1], [2, 0, 2], [2, 1, 3], [5, 0, 1], [5, 0, 2], [10, 0, 1], [10, 3, 2]].forEach(([step, offset, level]) => items.push({ type: 'skip', key: `s:${step}:${offset}`, step, offset, level }));
  for (const it of items) for (const [nC, nT] of [[3, 7], [4, 11]]) {
    const made = comebackRule(it, nC, nT); rooms++;
    if (!made) { problems.push('no comeback room for ' + it.key); continue; }
    check(made, 'comeback ' + it.key, 1);
    if (it.type === 'fact' && !made.tiles.some(t => t.correct && t.a === it.a && t.b === it.b)) problems.push('comeback missing ' + it.key);
    if (it.type === 'parity' && !made.tiles.some(t => t.correct && t.value === it.n)) problems.push('comeback missing ' + it.key);
  }
  return { rooms, problems: [...new Set(problems)].slice(0, 15) };
}"""

# ---- 2. footprints never lie; hits only happen on footprints
HONEST = r"""() => {
  const problems = []; let hits = 0;
  for (let trial = 0; trial < 10; trial++) {
    FRESH; save.roomsEver = 9; newRun(); run.floor = 3; run.floorRoomsCleared = 4;
    const r = Object.values(run.map.rooms).find(x => x.type === 'normal' && !x.gen);
    hero.x = 2; hero.y = 0; enterRoom(r, { x: 2, y: 0 }); closeOverlay();
    for (let i = 0; i < 120; i++) {
      run.hearts = 6; run.shield = false;
      const snap = room.monsters.map(m => ({ m, x: m.x, y: m.y, next: m.next && { ...m.next }, dizzy: m.dizzy })), safe0 = hero.safe;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => inGrid(hero.x + a, hero.y + b));
      const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)], target = monsterAt(hero.x + dx, hero.y + dy);
      tryMove(dx, dy); const f = run.fight; if (f) { run.fight = null; closeOverlay(); }
      if (target && !(snap.find(s => s.m === target).dizzy > 0)) { if (!f || f.ambush) problems.push('walking into a monster did not start a squash fight'); continue; }
      const jumped = !!(f && f.ambush), threat = snap.filter(s => !s.dizzy && s.next && s.next.x === hero.x && s.next.y === hero.y && room.monsters.includes(s.m));
      if (6 - run.hearts) problems.push('a monster hurt her directly (it should start a fight)');
      if (jumped) hits++;
      if (jumped && !threat.length) problems.push('monster jumped out without footprints');
      if (!jumped && threat.length && safe0 <= 1) problems.push('footprints but no monster jumped out');
      for (const s of snap) { if (!room.monsters.includes(s.m)) continue; const m = s.m;
        if (s.dizzy || !s.next || (s.next.x === hero.x && s.next.y === hero.y)) { if (m.x !== s.x || m.y !== s.y) problems.push('moved off-plan'); }
        else if (m.x !== s.next.x || m.y !== s.next.y) problems.push('ignored its footprints'); }
    }
  }
  return { hits, problems: [...new Set(problems)] };
}""".replace('FRESH;', FRESH)

# ---- 2b. math powers (boss turns + squash fights): judge every answer from the question text alone
POWER_MATH = r"""() => {
  const problems = [], kinds = {}, strip2 = h => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  for (let trial = 0; trial < 4000; trial++) {
    Object.keys(SKILLS).forEach(id => sk(id).level = rnd(1, SKILLS[id].max));
    const id = pick(Object.keys(POWERS)), cap = rnd(1, 20), p = makeProblem(id, cap); if (!p) continue;
    kinds[id] = (kinds[id] || 0) + 1;
    const q = strip2(p.q); let truth = null, m;
    if (id === 'double' && (m = q.match(/^Double (\d+) = \?$/))) truth = 2 * m[1];
    if (id === 'friends' && (m = q.match(/^(\d+) \+ \? = 10$/))) truth = 10 - m[1];
    if (id === 'fact' && (m = q.match(/^(\d+) ([+−]) (\d+) = \?$/))) truth = m[2] === '+' ? +m[1] + +m[3] : m[1] - m[3];
    if (id === 'flash') truth = p.miss.segs.reduce((a, g) => a + g.n, 0);
    if (id === 'parity' && (m = q.match(/^(\d+) Even or odd\?$/))) truth = m[1] % 2 ? 'odd' : 'even';
    if (id === 'hop' && (m = q.match(/^(\d+), (\d+), (\d+), \?$/))) { const st = m[2] - m[1]; if (m[3] - m[2] === st && [2, 5, 10].includes(st)) truth = +m[3] + st; }
    if (id === 'rack') { truth = p.split[0] + p.split[1]; const w = p.hint.text.match(/Another way: (\d+) \+ (\d+) = (\d+)/); if (!w || +w[1] + +w[2] !== truth || +w[3] !== truth) problems.push(`rack: second way wrong: ${p.hint.text}`); }
    if (id === 'rackParity') truth = (p.split[0] + p.split[1]) % 2 ? 'odd' : 'even';
    if (id === 'compare') { truth = p.bars[0] > p.bars[1] ? p.bars[0] - p.bars[1] : null; }
    if (id === 'story') { const t = q.replace(/[^\x20-\x7e]/g, ''); if ((m = t.match(/^You found (\d+) *\. Hoot found (\d+) *\. How many altogether\?$/))) truth = +m[1] + +m[2];
      else if ((m = t.match(/^You had (\d+) *\. You gave some to Hoot\. Now you have (\d+)\. How many did you give away\?$/))) truth = m[1] - m[2]; }
    if (id === 'cards') { const ok = p.ways.length >= 2 && p.ways.every(([x, y]) => x + y === p.target && p.cards.includes(x) && p.cards.includes(y)) && new Set(p.cards).size === 5
        && p.cards.every((x, i) => p.cards.every((y, j) => i === j || x + y !== p.target || p.ways.some(w => w.includes(x) && w.includes(y)))) && q === `Use two cards to make ${p.target}`;
      truth = ok ? 'ok' : null; }
    if (truth === null || String(truth) !== p.ans) problems.push(`${id}: "${q}" answer ${p.ans}, really ${truth}`);
    if (id !== 'cards' && (p.choices.filter(c => c === p.ans).length !== 1 || new Set(p.choices).size !== p.choices.length)) problems.push(`${id}: choices ${p.choices}`);
    if (id !== 'cards' && (p.choices.length !== (p.words ? 2 : 3) || p.choices.some(c => /^-/.test(c)))) problems.push(`${id}: choices ${p.choices}`);
    if (id !== 'fact' && (p.power < 1 || p.power > cap)) problems.push(`${id}: hits for ${p.power} with ${cap} health`);
    if (/undefined|NaN/.test(p.q + p.say + p.right + p.hint.say + p.hint.text)) problems.push(`${id}: broken text`);
    if (id === 'double' && +p.ans < 4) problems.push('double 1 asked');
  }
  Object.keys(SKILLS).forEach(id => sk(id).level = 1);
  return { kinds, problems: [...new Set(problems)].slice(0, 10) };
}"""
# every boss turn: one take-away on the rack + one other kind of problem; switched-off skills never asked
BOSS_MIX = r"""() => {
  FRESH; save.roomsEver = 9; newRun(); closeOverlay(); const kinds = new Set(), problems = [];
  for (let f = 1; f <= 3; f++) { run.floor = f; run.boss = { hp: 15 };
    for (let i = 0; i < 120; i++) { const hp = rnd(1, 20); run.boss.hp = hp; const ms = bossMoves(hp);
      const takes = ms.filter(m => m.kind === 'take'), pows = ms.filter(m => m.kind === 'power');
      if (takes.length !== 1 || pows.length !== 1) problems.push(`health ${hp}: ${takes.length} take-away + ${pows.length} powers`);
      pows.forEach(p => { kinds.add(p.id); run.boss.lastPower = p.id; if (p.power > hp) problems.push(`${p.id} hits for ${p.power} with ${hp} health`); });
      takes.forEach(t => { if (t.k > hp || t.k < 1) problems.push(`take-away ${t.k} with ${hp} health`); }); } }
  save.settings.skills.evenOdd = false; let parity = 0;
  for (let i = 0; i < 300; i++) { run.boss.hp = rnd(2, 20); parity += bossMoves(run.boss.hp).filter(m => m.id === 'parity' || m.id === 'rackParity').length; }
  save.settings.skills.evenOdd = true; run.boss = null; closeOverlay();
  return { kinds: [...kinds].sort(), problems: [...new Set(problems)].slice(0, 8), parity_when_off: parity };
}""".replace('FRESH;', FRESH)
# this week's focus: test topics come up most, take-away is unlocked, all facts to 20; off = back to her own levels
FOCUS_T = r"""() => {
  FRESH; save.roomsEver = 9; newRun(); closeOverlay(); const out = {};
  sk('add').level = 1; sk('sub').level = 1;
  const tally = on => { save.settings.focus = on; const c = {}; for (let i = 0; i < 3000; i++) { const id = pickSkill(); c[id] = (c[id] || 0) + 1; } return c; };
  const on = tally(true), off = tally(false);
  save.settings.focus = true; out.on = on; out.off = off;
  out.take_away_unlocked = (on.sub || 0) > 400 && !off.sub;
  out.test_topics_lead = (on.add + on.sub + on.evenOdd) / 3000 > .8 && ((on.skip2 || 0) + (on.skip5 || 0) + (on.skip10 || 0)) / 3000 < .1;
  out.facts_to_20 = lvl('add') === 4 && lvl('sub') === 3 && lvl('evenOdd') >= 2;
  const pw = {}; for (let i = 0; i < 2000; i++) pickPowers(Object.keys(POWERS), 2, 20).forEach(p => pw[p.id] = (pw[p.id] || 0) + 1);
  out.fights_favor_test_types = FOCUS.powers.reduce((a, id) => a + (pw[id] || 0), 0) / Object.values(pw).reduce((a, b) => a + b, 0) > .7;
  save.settings.focus = false; out.off_uses_her_levels = lvl('add') === 1 && !availableSkills().includes('sub'); save.settings.focus = true;
  // Card Combo: any pair that makes the number counts, and another way is shown
  let p; do { p = makeProblem('cards', 20); } while (!p);
  const [x, y] = p.ways[0], i = p.cards.indexOf(x), j = p.cards.indexOf(y), bad = p.cards.findIndex((v, k) => k !== i && v + x !== p.target);
  out.card_first_tap_waits = pickCard(p, i) === null;
  out.card_pair_counts = pickCard(p, j) === 'ok' && !!p.other && p.other[0] + p.other[1] === p.target;
  pickCard(p, i); out.card_wrong_pair_misses = pickCard(p, bad) !== 'ok';
  return out;
}""".replace('FRESH;', FRESH)
SQUASH = r"""() => {
  FRESH; save.roomsEver = 9; newRun(); closeOverlay(); const out = {};
  const r = Object.values(run.map.rooms).find(x => x.type === 'normal' && !x.gen); hero.x = 0; hero.y = 0; enterRoom(r, { x: 0, y: 0 }); closeOverlay();
  room.monsters = [{ id: 'q1', kind: 'wisp', x: 1, y: 0, dir: [1, 0], t: 0, dizzy: 0, next: null }]; room.pickups = []; renderAll();
  const h0 = run.hearts, s0 = save.stars; tryMove(1, 0);
  out.walking_into_it_starts_a_fight = !!run.fight && document.querySelector('#ov').classList.contains('show') && hero.x === 0;
  if (run.fight.step === 'choose') { out.two_attacks_to_pick = run.fight.moves.length === 2 && run.fight.moves[0].id !== run.fight.moves[1].id; fightPick(0); }
  const p = run.fight.prob; fightAnswer(p.choices.find(c => c !== p.ans));
  out.wrong_costs_half_a_heart_and_shows_a_hint = run.hearts === h0 - 1 && !!document.querySelector('#ov-card .hint') && save.comeback.length >= (p.miss ? 1 : 0);
  fightAnswer(p.ans);
  out.right_answer_squashes = run.fight.step === 'won' && save.stars === s0 + 1;
  return out;
}""".replace('FRESH;', FRESH)

# ---- 3. the learning loop + pickups
LOOP = r"""() => {
  const out = {};
  FRESH; save.roomsEver = 9; newRun(); run.floor = 2; run.floorRoomsCleared = 3;
  let r = Object.values(run.map.rooms).find(x => x.type === 'normal' && !x.gen); hero.x = 2; hero.y = 0; enterRoom(r, { x: 2, y: 0 }); closeOverlay();
  const t = room.tiles.find(t => t.correct); hero.x = t.x; hero.y = t.y; const p0 = room.monsters.map(m => [m.x, m.y]); chomp();
  out.dizzy_after_right = room.monsters.every(m => m.dizzy > 0) && room.monsters.every((m, i) => m.x === p0[i][0] && m.y === p0[i][1]);
  const w = room.tiles.find(t => !t.correct); hero.x = w.x; hero.y = w.y; const h0 = run.hearts; chomp(); closeOverlay();
  out.wrong_cracks_heart = run.hearts === h0 - 1 && run.crack && save.comeback.length === 1;
  const c2 = room.tiles.find(t => t.correct && !t.chomped); hero.x = c2.x; hero.y = c2.y; chomp();
  out.right_mends_heart = run.hearts === h0 && !run.crack;
  if (room.monsters.length) { const m = room.monsters[0]; m.dizzy = 2; const s = [[1,0],[-1,0],[0,1],[0,-1]].map(([a,b]) => [m.x+a, m.y+b]).find(([x,y]) => inGrid(x,y) && !monsterAt(x,y));
    hero.x = s[0]; hero.y = s[1]; const n0 = room.pickups.length; tryMove(m.x - hero.x, m.y - hero.y); out.bonk_drops_coin = !room.monsters.includes(m) && room.pickups.length === n0 + 1; }
  room.monsters = []; room.tiles.filter(t => t.correct && !t.chomped).forEach(t => { hero.x = t.x; hero.y = t.y; chomp(); });
  const sizes = [...document.querySelectorAll('.actor.pickup')].map(e => e.querySelector('img,svg').getBoundingClientRect().width);
  out.coins_visible = sizes.length > 0 && sizes.every(w => w > 10);
  // fact comeback loop: miss 6+2 -> run-over card -> next run opens on it -> remembered
  FRESH; save.roomsEver = 9; newRun(); closeOverlay();
  r = Object.values(run.map.rooms).find(x => x.type === 'normal' && !x.gen); hero.x = 2; hero.y = 0; enterRoom(r, { x: 2, y: 0 }); closeOverlay();
  room.rule = { skill: 'add', kind: 'equals', op: '+', target: 10, title: 'Make 10', speak: '', level: 1 };
  room.tiles = [{ kind: 'fact', label: '6 + 2', value: 8, correct: false, a: 6, b: 2, op: '+', x: 1, y: 1 }, { kind: 'fact', label: '7 + 3', value: 10, correct: true, a: 7, b: 3, op: '+', x: 3, y: 3 }];
  room.monsters = []; hero.x = 1; hero.y = 1; chomp(); closeOverlay(); endRun(false);
  out.runover_card = (document.querySelector('.remember-t') || {}).textContent === '6 + 2 = 8';
  closeOverlay(); newRun(); closeOverlay();
  const ft = room.tiles.find(t => t.correct && t.a === 6 && t.b === 2);
  out.next_run_starts_with_it = room.special === 'comeback' && room.rule.title === 'Make 8' && !!ft;
  if (ft) { hero.x = ft.x; hero.y = ft.y; chomp(); } out.remembered = save.comeback.length === 0 && save.remembered === 1;
  // first ever run = 3-tile lesson
  FRESH; newRun(); out.lesson_room = room.rule.title === 'Make 5' && room.tiles.length === 3 && room.tiles.every(t => t.correct) && !room.monsters.length;
  closeOverlay(); return out;
}""".replace('FRESH;', FRESH)

STEP = r"""(targets) => {
  if (document.querySelector('#ov').classList.contains('show')) { if (room.type === 'boss' && !room.cleared) return 'boss'; closeOverlay(); return 'closed'; }
  if (room.type === 'normal' && !room.cleared) { room.monsters = []; room.tiles.filter(t => t.correct && !t.chomped).forEach(t => { hero.x = t.x; hero.y = t.y; chomp(); }); return 'cleared'; }
  if (room.type === 'treasure' && !room.taken) { room.offers = room.offers || pickItemOffers(2); takeItem(room.offers[0]); return 'item'; }
  if (room.type === 'shop' && !room.bought) { room.bought = true; run.coins = 20; openShop(); buy(1); ovState.actions.pick({ dataset: { v: '16' } }); closeOverlay(); return 'shopped ' + run.coins; }
  if (room.type === 'boss') return room.cleared ? 'bosswon' : 'boss';
  const rooms = run.map.rooms, D = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  const goalType = targets.find(t => !Object.values(rooms).some(r => r.type === t && r.visited)) || 'boss';
  const goal = Object.keys(rooms).find(k => rooms[k].type === goalType);
  const prev = { [run.pos]: null }, q = [run.pos];
  while (q.length) { const k = q.shift(), r = rooms[k]; for (const d of Object.keys(r.doors)) { const nk = (r.x + D[d][0]) + ',' + (r.y + D[d][1]); if (!(nk in prev)) { prev[nk] = [k, d]; q.push(nk); } } }
  let c = goal; while (prev[c] && prev[c][0] !== run.pos) c = prev[c][0];
  goThrough(prev[c][1]); return 'go ' + goalType;
}"""
BOSS = r"""() => { const b = run.boss; if (!b) return 'none';
  if (b.step === 'intro') { b.step = 'choose'; b.moves = bossMoves(b.hp); renderBoss(); }
  if (b.step === 'choose') bossPick(0);
  if (run.boss.step === 'answer') { if (!run.boss.triedWrong) { run.boss.triedWrong = true; bossAnswer(run.boss.choices.find(v => v !== run.boss.ans)); } bossAnswer(run.boss.ans); }
  return run.boss.step; }"""

async def smoke(page):
    await page.evaluate(FRESH + " newRun();"); await page.wait_for_timeout(300)
    log = []
    for floor in (1, 2, 3):
        for _ in range(60):
            s = await page.evaluate(STEP, ['treasure', 'shop', 'boss'] if floor == 1 else ['boss'])
            log.append(s)
            if s == 'boss':
                await page.wait_for_timeout(450)
                for _ in range(30):
                    st = await page.evaluate("(() => { run.hearts = 6; return 1; })()") and await page.evaluate(BOSS)
                    if st == 'win': break
                await page.evaluate("closeOverlay(); trapdoor();"); await page.wait_for_timeout(400)
                break
            await page.wait_for_timeout(230 if s.startswith('go') else 60)
    trophy = await page.evaluate("!!document.querySelector('.trophy')")
    return trophy, log

LAYOUT = r"""() => { const vw = innerWidth, vh = innerHeight, box = e => e.getBoundingClientRect();
  const g = box(document.querySelector('#grid')), c = box(document.querySelector('#btn-chomp'));
  return { hscroll: document.scrollingElement.scrollWidth > vw + 1, grid_in_view: g.left >= 0 && g.right <= vw && g.top >= 0 && g.bottom <= vh,
           chomp_in_view: c.right <= vw && c.bottom <= vh, cell: Math.round(g.width / 5) }; }"""
# floor, remembered and item banners: the ribbon (which grows with the words) stays on the popup and on screen
BANNERS = r"""() => { const bad = [], titles = ['Floor 1', 'Floor 3', 'You remembered!', ...Object.values(ITEMS).map(i => i.name)];
  for (const t of titles) { banner('', t, 'x'); const bt = document.querySelector('#banner .bt').getBoundingClientRect(), bx = document.querySelector('#banner .bx').getBoundingClientRect();
    if (bt.left < bx.left || bt.right > bx.right || bx.left < 0 || bx.right > innerWidth) bad.push(t); }
  return { skin: document.body.classList.contains('skin'), titles: titles.length, bad }; }"""


# ---- kid-style play: read the rule + tiles off the screen, walk with real d-pad presses, press CHOMP
import re as _re
def _truth(title, tile):
    m = _re.match(r'Make (\d+)$', title)
    if m:
        e = _re.match(r'(\d+)\s*([+−-])\s*(\d+)$', tile['text']); a, op, b = int(e[1]), e[2], int(e[3])
        return (a + b if op == '+' else a - b) == int(m[1])
    if title in ('Even numbers', 'Odd numbers'): return (int(tile['text']) % 2 == 0) == (title == 'Even numbers')
    m = _re.match(r'Count by (\d+)s(?: from (\d+))?$', title)
    if m: step = int(m[1]); st = int(m[2]) if m[2] else step; n = int(tile['text']); return n >= st and (n - st) % step == 0
    m = _re.match(r'Find (\d+)$', title)
    if m: return tile['dots'] == int(m[1])
    raise ValueError(title)
_READ = r"""() => ({ title: document.querySelector('#rule-title').textContent.trim(),
  tiles: [...document.querySelectorAll('#grid .cell')].map(c => { const t = c.querySelector('.tile'); if (!t) return null; const svg = t.querySelector('svg');
    const dots = svg ? [...svg.querySelectorAll('circle, image.counter')].filter(e => !/ffc2ca/i.test(e.getAttribute('fill') || '') && !e.classList.contains('x')).length : null;
    const txt = [...t.childNodes].filter(n => n.nodeType === 3 || (n.nodeType === 1 && !n.classList.contains('rv') && n.tagName !== 'svg')).map(n => n.textContent).join('').replace(/[ \s]+/g, ' ').trim();
    return { x: +c.dataset.x, y: +c.dataset.y, text: txt, dots }; }).filter(Boolean) })"""
async def _press(page, sel, hold=80):
    b = await page.locator(sel).bounding_box(); await page.mouse.move(b['x'] + b['width'] / 2, b['y'] + b['height'] / 2)
    await page.mouse.down(); await page.wait_for_timeout(hold); await page.mouse.up(); await page.wait_for_timeout(40)
async def kid_play(page):
    await page.evaluate(FRESH + " save.roomsEver = 9; save.settings.monsters = false; save.settings.music = false; DD.newRun(); DD.closeOverlay();")
    specs = [('add', l) for l in range(1, 5)] + [('sub', l) for l in range(1, 4)] + [('evenOdd', l) for l in range(1, 4)] + \
            [('skip10', 1), ('skip10', 2), ('skip5', 1), ('skip5', 2), ('skip2', 1), ('skip2', 2), ('skip2', 3)] + [('frames', l) for l in range(1, 4)]
    D = {(0, -1): '.dbtn.up', (0, 1): '.dbtn.down', (-1, 0): '.dbtn.left', (1, 0): '.dbtn.right'}
    checked, bad = 0, []
    for skill, lvl in specs:
        await page.evaluate(f"""() => {{ save.settings.skills = Object.fromEntries(Object.keys(SKILLS).map(k => [k, k === '{skill}'])); sk('{skill}').level = {lvl}; sk('add').level = Math.max(sk('add').level, 2);
          run.hearts = 12; run.maxHearts = 12; let r = Object.values(run.map.rooms).find(x => x.type === 'normal' && !x.gen);
          if (!r) {{ run.map = genFloor(1); r = Object.values(run.map.rooms).find(x => x.type === 'normal' && !x.gen); }}
          hero.x = 2; hero.y = 0; DD.enterRoom(r, {{ x: 2, y: 0 }}); DD.closeOverlay(); }}""")
        st = await page.evaluate(_READ)
        for t in st['tiles']:
            for _ in range(10):
                hx, hy = await page.evaluate("[DD.hero.x, DD.hero.y]")
                if (hx, hy) == (t['x'], t['y']): break
                await _press(page, D[(1 if t['x'] > hx else -1, 0) if t['x'] != hx else (0, 1 if t['y'] > hy else -1)])
            await _press(page, '#btn-chomp'); await page.wait_for_timeout(40)
            v = await page.evaluate("""(() => { const ov = document.querySelector('#ov').classList.contains('show'); const c = document.querySelector(`#grid .cell[data-x="${DD.hero.x}"][data-y="${DD.hero.y}"]`);
                const r = { wrong: ov, eaten: !!(c && c.querySelector('.crumbs')), cleared: DD.room.cleared }; if (ov) DD.closeOverlay(); run.hearts = 12; return r; })()""")
            checked += 1
            if (v['eaten'] and not v['wrong']) != _truth(st['title'], t): bad.append(f"{st['title']}: '{t['text'] or t['dots']}'")
            if v['cleared']: break
    return checked, bad

async def main():
    t0 = time.time()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await (await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)).new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(URL); await page.wait_for_timeout(500)

        await page.evaluate("Voice.log = []")
        v = await page.evaluate(VOICE); report(f"every generated sentence has recorded clips ({v['checked']} checked" + (f", {len(PENDING)} new phrases waiting to be recorded" if PENDING else '') + ")", not v['missing'], ' | '.join(v['missing']))
        n_files = sum(1 for _, _, fs in os.walk(os.path.join(ROOT, 'art')) for f in fs if f.endswith('.webp'))
        art = await page.evaluate("loadArt().then(() => { const n = o => Object.values(o).reduce((s, v) => s + (typeof v === 'string' ? 1 : n(v)), 0); return { loaded: n(ART), tile: document.body.classList.contains('has-tile'), floor: document.body.classList.contains('has-floor'), doors: document.body.classList.contains('has-doors') }; })")
        report(f'all {n_files} art files load and are used', art['loaded'] == n_files and art['tile'] and art['floor'] and art['doors'], json.dumps(art))
        m = await page.evaluate(MATH); report(f"math is true in {m['rooms']} generated rooms", not m['problems'], '; '.join(m['problems']))
        h = await page.evaluate(HONEST); report(f"footprints predict every monster step ({h['hits']} hits, all on footprints)", not h['problems'], '; '.join(h['problems']))
        pm = await page.evaluate(POWER_MATH)
        report(f"power math is true ({sum(pm['kinds'].values())} problems, {len(pm['kinds'])} kinds)", not pm['problems'] and len(pm['kinds']) == 11, '; '.join(pm['problems']) or ', '.join(sorted(pm['kinds'])))
        bm = await page.evaluate(BOSS_MIX)
        report(f"boss turns mix problems: take-away + one of {len(bm['kinds'])} powers", not bm['problems'] and len(bm['kinds']) >= 8 and bm['parity_when_off'] == 0, json.dumps(bm))
        fo = await page.evaluate(FOCUS_T)
        for k in ['take_away_unlocked', 'test_topics_lead', 'facts_to_20', 'fights_favor_test_types', 'off_uses_her_levels', 'card_first_tap_waits', 'card_pair_counts', 'card_wrong_pair_misses']:
            report('this week: ' + k.replace('_', ' '), fo[k], json.dumps({'on': fo['on'], 'off': fo['off']}) if k == 'test_topics_lead' else '')
        sq = await page.evaluate(SQUASH); await page.wait_for_timeout(1600)
        sq['squashed_monster_drops_a_coin'] = await page.evaluate("!DD.room.monsters.length && DD.room.pickups.some(p => p.type === 'coin' && p.x === 1 && p.y === 0) && !DD.run.fight && !document.querySelector('#ov').classList.contains('show')")
        for k, v in sq.items(): report('squash: ' + k.replace('_', ' '), v)
        lp = await page.evaluate(LOOP)
        for k, v in lp.items(): report(k.replace('_', ' '), v)
        trophy, log = await smoke(page)
        n, bad = await kid_play(page)
        report(f'kid-style play: {n} chomps by real button presses all scored right', not bad, '; '.join(bad[:6]))
        inp = await page.evaluate(FRESH + r""" save.roomsEver = 9; save.settings.monsters = false; DD.newRun(); DD.closeOverlay();
            const r = Object.values(run.map.rooms).find(x => x.type === 'normal' && !x.gen); hero.x = 0; hero.y = 2; DD.enterRoom(r, { x: 0, y: 2 }); DD.closeOverlay(); 1""")
        bb = await page.locator('.dbtn.right').bounding_box(); await page.mouse.move(bb['x'] + 20, bb['y'] + 20); await page.mouse.down(); await page.wait_for_timeout(1200); await page.mouse.up(); await page.wait_for_timeout(80)
        report('holding an arrow moves exactly one square', await page.evaluate("hero.x") == 1)
        await page.evaluate("hero.x = 0; hero.y = 0; renderAll();")
        g = await page.locator('#grid').bounding_box(); c = g['width'] / 5
        await page.mouse.click(g['x'] + 4.5 * c, g['y'] + 3.5 * c); await page.wait_for_timeout(1300)
        report('tapping a tile walks the hero all the way there', await page.evaluate("[hero.x, hero.y]") == [4, 3])
        tag = await page.evaluate("(() => { const t = DD.room.tiles.find(t => !t.chomped); hero.x = t.x; hero.y = t.y; renderAll(); const g = document.querySelector('#herotag'); return [t.kind === 'frame' ? 'frame' : t.label.replace(/ /g, ''), g.hidden ? null : (t.kind === 'frame' ? (g.querySelector('svg') ? 'frame' : '') : g.textContent.replace(/[\\u2009\\s]/g, ''))]; })()")
        report('the tag above the hero shows the tile CHOMP will eat', tag[0] == tag[1], json.dumps(tag))
        # tap play: a glowing square marks where she's walking to; tapping a dizzy monster walks up and bonks it
        await page.evaluate("DD.room.monsters = []; DD.room.tiles.forEach(t => t.chomped = false); hero.x = 0; hero.y = 0; renderAll();")
        await page.mouse.click(g['x'] + 4.5 * c, g['y'] + 4.5 * c); await page.wait_for_timeout(250)
        goal_on = await page.evaluate("!document.querySelector('#goal').hidden"); await page.wait_for_timeout(1700)
        goal_off = await page.evaluate("document.querySelector('#goal').hidden && hero.x === 4 && hero.y === 4")
        report('a marker shows where she is walking, and goes away when she gets there', goal_on and goal_off)
        bonk = await page.evaluate("""(() => { hero.x = 0; hero.y = 2; const m = { kind: 'wisp', x: 3, y: 2, dizzy: 3, next: null, hp: 1 }; DD.room.monsters = [m]; renderAll();
            window._m = m; window._p0 = DD.room.pickups.length; return 1; })()""")
        await page.mouse.click(g['x'] + 3.5 * c, g['y'] + 2.5 * c); await page.wait_for_timeout(900)
        report('tapping a dizzy monster walks up and bonks it', await page.evaluate("!DD.room.monsters.includes(window._m) && DD.room.pickups.length === window._p0 + 1 && hero.x === 2"))
        # zoom guard: blocked at normal size; if Safari zooms in anyway, pinching is allowed and the page snaps back
        zg = await page.evaluate("""new Promise(res => { const vp = document.querySelector('meta[name=viewport]'), before = vp.content;
            const e = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(e); const blocked = e.defaultPrevented;
            ZoomGuard.scale = () => 2.5; ZoomGuard.check(); const cls = document.body.classList.contains('zoomed');
            const e2 = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(e2); const pinchOk = !e2.defaultPrevented;
            setTimeout(() => { const reset = vp.content !== before; ZoomGuard.scale = () => 1; ZoomGuard.check();
              res({ blocked, cls, pinchOk, reset, cleared: !document.body.classList.contains('zoomed') }); }, 900); })""")
        report('zoom: blocked at normal size, and snaps back if it happens', all(zg.values()), json.dumps(zg))
        # closet: a save from before tops/shoes (like Molly's) gets the new things marked NEW, nothing she had before
        cl = await page.evaluate(r"""(() => { const keep = save; const old = { v: 1, name: 'M', stars: 123, cosmetics: { color: 'pink', hat: 'bow' }, unlocks: ['h:bow', 'c:sky', 'h:party', 'c:peach'] };
            save = merge(defaultSave(), JSON.parse(JSON.stringify(old))); save.seen = save.seen || [...save.unlocks]; checkUnlocks(true);
            const fresh = closetItems().filter(i => isNewItem(i.id, i.need)).map(i => i.id), old_new = fresh.filter(id => old.unlocks.includes(id));
            const missing = [];
            Object.keys(HATS).forEach(k => { if (k !== 'none' && (!ART.hats[k] || !HAT_FIT[k])) missing.push('hat ' + k); });
            Object.keys(TOPS).forEach(k => { if (k !== 'none' && (!ART.tops[k] || !ART.topIcons[k])) missing.push('top ' + k); });
            Object.keys(SHOES).forEach(k => { if (k !== 'none' && (!ART.shoes[k] || !ART.shoeIcons[k])) missing.push('shoes ' + k); });
            openCloset('top'); const tabs = document.querySelectorAll('#ov-card .ctab').length, sw = document.querySelectorAll('#ov-card .sw').length;
            document.querySelector('#ov-card .sw[data-k=sailor]').click();
            save.cosmetics.shoes = 'clogs'; const layers = (s => s.querySelectorAll('img').length)((d => { d.innerHTML = heroSVG(undefined, undefined, true); return d; })(document.createElement('div')));
            const seenNow = save.seen.includes('t:sailor'), wore = save.cosmetics.top; closeOverlay(); save = keep; persist();
            return { fresh: fresh.length, old_new, missing, tabs, tops_shown: sw, wore, layers, seenNow }; })()""")
        report(f"closet: {cl['fresh']} new things NEW for a returning player, 4 shelves, outfits layer on the hero",
               cl['fresh'] == 7 and not cl['old_new'] and not cl['missing'] and cl['tabs'] == 4 and cl['tops_shown'] == 19 and cl['wore'] == 'sailor'
               and cl['layers'] == 5 and cl['seenNow'], json.dumps(cl))
        mus = await page.evaluate("""new Promise(res => { save.settings.music = true; Sound.init(); Music.start(); const t0 = Date.now();
            (function w() { if (Music.on && Music.sources.length) { save.settings.voice = true; Voice.say('Double 6 is 12!'); setTimeout(() => res({ dur: Music.buf.duration, ducked: +Music.gain.gain.value.toFixed(2) }), 400); }
              else if (Date.now() - t0 > 8000) res(null); else setTimeout(w, 100); })(); })""")
        report('background music plays and dips under the voice', bool(mus) and mus['dur'] > 50 and mus['ducked'] <= 0.1, json.dumps(mus))
        await page.evaluate("Music.toggle(false); save.settings.voice = false")
        said = await page.evaluate("(() => { " + OK_SAID + " return [...new Set(Voice.log)].filter(t => !okSaid(t)); })()")
        report('everything said in a full run uses recorded clips', not said, ' | '.join(said[:8]))
        played = await page.evaluate("""new Promise(res => { Sound.init(); Clips.decode(); const t0 = Date.now();
            (function wait() { if (Clips.buf) { save.settings.voice = true; Voice.say('Double 6 is 12!'); res({ dur: Clips.buf.duration, scheduled: Clips.nodes.length }); }
              else if (Date.now() - t0 > 8000) res(null); else setTimeout(wait, 100); })(); })""")
        report('voice recording decodes and plays', bool(played) and played['scheduled'] == 4, json.dumps(played))
        # a notification cuts the audio off (like iOS does): the next tap builds a fresh engine and everything plays again
        await page.evaluate("""new Promise(res => { save.settings.music = true; Music.start(); const t0 = Date.now();
            (function w() { if (Music.on && Music.sources.length || Date.now() - t0 > 8000) res(); else setTimeout(w, 100); })(); })""")
        await page.evaluate("window._oldCtx = Sound.ctx; Sound.ctx.suspend().then(() => 1)"); await page.wait_for_timeout(200)
        cut = await page.evaluate("Sound.broken")
        await page.touchscreen.tap(195, 4); await page.wait_for_timeout(900)
        back = await page.evaluate("""(() => { Voice.say('Double 6 is 12!'); const c = Sound.ctx;
            return { noticed: %s, fresh: c !== window._oldCtx, old: window._oldCtx.state, state: c.state, music: Music.on && Music.sources.length > 0, voice: Clips.nodes.length, revivals: Sound.revivals }; })()""" % ('true' if cut else 'false'))
        report('sound comes back after a notification cuts it off', back['noticed'] and back['fresh'] and back['old'] == 'closed' and back['state'] == 'running' and back['music'] and back['voice'] == 4, json.dumps(back))
        await page.evaluate("Music.toggle(false); save.settings.voice = false")
        # number clips line up with their numbers: six/seven/sixteen/seventeen/sixty/seventy open with an "s" hiss,
        # one/eight/nine/ten/eleven/eighty/ninety don't. A clip map shifted by one in either direction fails this.
        hiss = await page.evaluate("""() => { const d = Clips.buf.getChannelData(0), sr = Clips.buf.sampleRate, out = {};
            for (const k of [6, 7, 16, 17, 60, 70, 1, 8, 9, 10, 11, 80, 90]) { const [s, len] = Clips.map['n' + k], a = Math.floor(s * sr), b = a + Math.floor(Math.min(len, .15) * sr);
              let e = 0, h = 0; for (let i = a + 1; i < b; i++) { e += d[i] * d[i]; h += (d[i] - d[i - 1]) ** 2; } out[k] = +(h / (e + 1e-12)).toFixed(2); } return out; }""")
        s_ok = all(hiss[str(k)] > 0.4 for k in [6, 7, 16, 17, 60, 70]); q_ok = all(hiss[str(k)] < 0.15 for k in [1, 8, 9, 10, 11, 80, 90])
        report('number clips match their numbers (s-sound check)', s_ok and q_ok, json.dumps(hiss))
        report('full run: 3 floors, treasure, shop, bosses, trophy', trophy, '' if trophy else ' > '.join(log[-8:]))

        for (w, hgt, name) in [(390, 844, 'phone'), (375, 667, 'small-phone'), (844, 390, 'phone-landscape'), (820, 1180, 'ipad'), (1180, 820, 'ipad-landscape'), (1366, 1024, 'big-ipad-landscape')]:
            pg = await (await b.new_context(viewport={'width': w, 'height': hgt}, has_touch=True)).new_page()
            pg.on('pageerror', lambda e, n=name: errors.append(f'{n}: {e}'))
            await pg.goto(URL); await pg.wait_for_timeout(300)
            iv = await pg.evaluate("""(() => { const r = e => document.querySelector(e).getBoundingClientRect(), p = r('#intro-play'), v = r('.intro-frame'), l = r('.intro-logo');
              return { play: p.top >= 0 && p.bottom <= innerHeight && p.left >= 0 && p.right <= innerWidth, video: v.top >= 0 && v.bottom <= innerHeight, logo: l.top >= 0, videoW: Math.round(v.width) }; })()""")
            report(f'intro Play screen fits on {name} ({w}x{hgt})', iv['play'] and iv['video'] and iv['logo'], json.dumps(iv))
            if WANT_SHOTS: os.makedirs(SHOTS, exist_ok=True); await pg.screenshot(path=f'{SHOTS}/{name}-intro.png')
            if name == 'phone-landscape': await pg.context.close(); continue      # the game itself is laid out for upright phones and any iPad
            if WANT_SHOTS: os.makedirs(SHOTS, exist_ok=True); await pg.screenshot(path=f'{SHOTS}/{name}-title.png')
            await pg.evaluate(FRESH + r""" save.roomsEver = 9; newRun(); closeOverlay(); run.floorRoomsCleared = 2;
              const r = Object.values(run.map.rooms).find(x => x.type === 'normal' && !x.gen); hero.x = 2; hero.y = 0; enterRoom(r, { x: 2, y: 0 });""")
            await pg.wait_for_timeout(2000)
            lay = await pg.evaluate(LAYOUT)
            report(f'layout fits on {name} ({w}x{hgt})', not lay['hscroll'] and lay['grid_in_view'] and lay['chomp_in_view'], json.dumps(lay))
            ban = await pg.evaluate(BANNERS)
            report(f'every banner title fits its ribbon on {name}', ban['skin'] and not ban['bad'], json.dumps(ban))
            if WANT_SHOTS: await pg.screenshot(path=f'{SHOTS}/{name}-room.png')
            await pg.context.close()
        # intro video: Play starts it (with a real tap), Skip and the end of the video both land on the title; Grown-ups can turn it off
        ctx = await b.new_context(viewport={'width': 820, 'height': 1180}, has_touch=True); pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(f'intro: {e}'))
        await pg.goto(URL); await pg.wait_for_timeout(600)
        start = await pg.evaluate("document.querySelector('#scr-intro').classList.contains('active')")
        await pg.click('#intro-play', force=True); await pg.wait_for_timeout(1500)
        rolling = await pg.evaluate("(() => { const v = document.querySelector('#intro-video'); return !v.paused && v.currentTime > .5 && !Music.on; })()")
        await pg.click('#intro-skip', force=True); await pg.wait_for_timeout(2500)
        skipped = await pg.evaluate("document.querySelector('#scr-title').classList.contains('active') && Music.on")
        await pg.reload(); await pg.wait_for_timeout(600); await pg.click('#intro-play', force=True); await pg.wait_for_timeout(500)
        await pg.evaluate("(() => { const v = document.querySelector('#intro-video'); v.currentTime = v.duration - .25; })()"); await pg.wait_for_timeout(1500)
        ended = await pg.evaluate("document.querySelector('#scr-title').classList.contains('active')")
        await pg.evaluate("save.settings.intro = false; persist();"); await pg.reload(); await pg.wait_for_timeout(500)
        off = await pg.evaluate("document.querySelector('#scr-title').classList.contains('active') && !document.querySelector('#scr-intro').classList.contains('active')")
        report('intro video: tap Play, Skip or the ending goes to the title, and it can be turned off',
               start and rolling and skipped and ended and off, json.dumps({'start': start, 'rolling': rolling, 'skipped': skipped, 'ended': ended, 'off': off}))
        await ctx.close()
        await b.close()
    report('no JavaScript errors', not errors, '; '.join(errors[:3]))
    bad = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed in {time.time() - t0:.0f}s" + (f" | FAILED: {', '.join(bad)}" if bad else ''))
    sys.exit(1 if bad else 0)

asyncio.run(main())
