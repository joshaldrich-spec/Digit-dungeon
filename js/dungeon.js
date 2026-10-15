'use strict';
/* Digit Dungeon · dungeon.js: Items, floor maps, run setup, room generation (lesson, comeback, normal). */

/* =====================================================================
   ITEMS (helper items = picture supports that fade each new run)
   ===================================================================== */
const ITEMS = {
  specs:  { name: 'Ten-Frame Specs', icon: '🥽', desc: 'Shows ten-frame pictures of facts.', skills: ['add', 'sub', 'frames'] },
  socks:  { name: 'Pair Socks', icon: '🧦', desc: 'Shows numbers as pairs: even or odd?', skills: ['evenOdd'] },
  frog:   { name: 'Hop Frog', icon: '🐸', desc: 'Shows skip-counting hops.', skills: ['skip10', 'skip5', 'skip2'] },
  heart:  { name: 'Big Heart', icon: '💖', desc: 'One more heart, and it heals you.', repeat: true },
  clover: { name: 'Lucky Clover', icon: '🍀', desc: 'Rooms drop an extra coin.' },
  snail:  { name: 'Sleepy Snail', icon: '🐌', desc: 'Monsters move slower.' },
  bubble: { name: 'Bubble Shield', icon: '🫧', desc: 'Blocks one hit in every room.' },
};
const PEEK_ITEM = { add: 'specs', sub: 'specs', frames: 'specs', evenOdd: 'socks', skip10: 'frog', skip5: 'frog', skip2: 'frog' };
function itemWeight(id) {
  const it = ITEMS[id]; if (!it.skills) return id === 'heart' ? 1.3 : 1;
  const en = it.skills.filter(s => availableSkills().includes(s)); if (!en.length) return .05;
  return 1.3 + mean(en.map(s => 1 - recentAcc(s, 12, .7))) * 5;   // scaffold where she's weakest
}
function pickItemOffers(k, exclude = []) {
  const pool = Object.keys(ITEMS).filter(id => (ITEMS[id].repeat || !run.items.includes(id)) && !exclude.includes(id));
  return sampleW(pool, Math.min(k, pool.length), itemWeight);
}
function applyItem(id) {
  if (id === 'heart') { run.maxHearts = Math.min(12, run.maxHearts + 2); run.hearts = Math.min(run.maxHearts, run.hearts + 2); }
  if (id === 'bubble') run.shield = true;
}

/* =====================================================================
   MAP (Isaac-style floor of rooms)
   ===================================================================== */
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const FLOOR_NAMES = ['The Cellar', 'The Caves', 'The Depths'];
const key = (x, y) => `${x},${y}`;
function genFloor(floor) {
  const normals = 3 + floor, total = normals + 4;
  for (let attempt = 0; attempt < 300; attempt++) {
    const rooms = { '0,0': 1 }, list = [[0, 0]];
    let guard = 0;
    while (list.length < total && guard++ < 600) {
      const [bx, by] = pick(list), d = pick(Object.values(DIRS)), nx = bx + d[0], ny = by + d[1];
      if (rooms[key(nx, ny)] || Math.abs(nx) > 3 || Math.abs(ny) > 3) continue;
      if (Object.values(DIRS).filter(([dx, dy]) => rooms[key(nx + dx, ny + dy)]).length > 1) continue;
      rooms[key(nx, ny)] = 1; list.push([nx, ny]);
    }
    if (list.length < total) continue;
    const nbs = (x, y) => Object.keys(DIRS).filter(dk => rooms[key(x + DIRS[dk][0], y + DIRS[dk][1])]);
    const dist = { '0,0': 0 }, q = [[0, 0]];
    while (q.length) { const [x, y] = q.shift(); for (const dk of nbs(x, y)) { const nx = x + DIRS[dk][0], ny = y + DIRS[dk][1]; if (dist[key(nx, ny)] === undefined) { dist[key(nx, ny)] = dist[key(x, y)] + 1; q.push([nx, ny]); } } }
    const dead = list.filter(([x, y]) => (x || y) && nbs(x, y).length === 1).sort((A, B) => dist[key(...B)] - dist[key(...A)]);
    if (dead.length < 3 || dist[key(...dead[0])] < 3) continue;
    return buildMap(list, floor, key(...dead[0]), key(...dead[1]), key(...dead[2]));
  }
  const list = [[0, 0]]; for (let i = 1; i <= normals; i++) list.push([i, 0]);
  list.push([normals + 1, 0], [1, -1], [2, 1]);
  return buildMap(list, floor, key(normals + 1, 0), key(1, -1), key(2, 1));
}
function buildMap(list, floor, bossK, aK, bK) {
  const map = { floor, rooms: {} };
  list.forEach(([x, y]) => map.rooms[key(x, y)] = { x, y, type: 'normal', doors: {}, visited: false, known: false, cleared: false, gen: false });
  const swap = Math.random() < .5;
  map.rooms['0,0'].type = 'start'; map.rooms[bossK].type = 'boss';
  map.rooms[swap ? aK : bK].type = 'treasure'; map.rooms[swap ? bK : aK].type = 'shop';
  Object.values(map.rooms).forEach(r => {
    Object.keys(DIRS).forEach(dk => { if (map.rooms[key(r.x + DIRS[dk][0], r.y + DIRS[dk][1])]) r.doors[dk] = true; });
    if (r.type !== 'normal' && r.type !== 'boss') r.cleared = true;
  });
  return map;
}

/* =====================================================================
   GAME STATE
   ===================================================================== */
let run = null, hero = null, room = null, transitioning = false, ovState = null;
const neighbor = (r, d) => run.map.rooms[key(r.x + DIRS[d][0], r.y + DIRS[d][1])];
const doorCell = d => ({ n: { x: 2, y: 0 }, s: { x: 2, y: 4 }, e: { x: 4, y: 2 }, w: { x: 0, y: 2 } })[d];
const tileAt = (x, y) => room && room.tiles ? room.tiles.find(t => t.x === x && t.y === y) : null;
const overlayOpen = () => $('#ov').classList.contains('show');
const blocked = () => transitioning || overlayOpen() || !run || run.over;

function newRun() {
  run = { ver: 2, floor: 1, hearts: 6, maxHearts: 6, crack: false, coins: 0, items: [], glow: 0, shield: false, map: genFloor(1), pos: '0,0',
    hero: { x: 2, y: 2, safe: 0, face: 'right' }, lastSkill: null, lastTarget: null, roomsCleared: 0, floorRoomsCleared: 0,
    correct: 0, wrong: 0, stars: 0, startStars: save.stars, ms: 0, tick: Date.now(), turn: 0, streak: 0, boss: null, bySkill: {},
    misses: [], lastHurt: null, comebackQueue: save.comeback.slice(0, 4).map(c => ({ ...c, after: 0 })) };
  hero = run.hero; save.run = run;
  const start = run.map.rooms['0,0'];
  // Very first run: the start room is the lesson. Later runs: it's a warm-up made from last run's mistakes.
  if (!save.roomsEver) Object.assign(start, { type: 'normal', cleared: false, special: 'lesson' });
  else if (run.comebackQueue.length) Object.assign(start, { type: 'normal', cleared: false, special: 'comeback' });
  showScreen('game');
  $('#scr-game').dataset.floor = 1;
  enterRoom(start);
  banner('🕯️', 'Floor 1', FLOOR_NAMES[0]);
}
function continueRun() {
  run = save.run; hero = run.hero; room = run.map.rooms[run.pos]; run.tick = Date.now(); run.over = false;
  showScreen('game'); $('#scr-game').dataset.floor = run.floor;
  clearActors(); renderAll(); Hint.poke();
  if (room.type === 'boss' && !room.cleared) { if (run.boss) renderBoss(); else startBoss(); }
  else if (room.type === 'normal' && !room.cleared) setTimeout(() => Voice.say(room.rule.speak), 300);
}
function saveRun() { if (run && !run.over) { save.run = run; persist(); } }
function tickTime() {
  if (!run) return; const now = Date.now(), dt = Math.min(now - (run.tick || now), 45000); run.tick = now; run.ms += dt;
  const d = save.days[today()] = save.days[today()] || { ms: 0, c: 0, w: 0 }; d.ms += dt;
}

function monsterCount() {
  if (!save.settings.monsters || (save.roomsEver || 0) < 2) return 0;
  const f = run.floor, c = run.floorRoomsCleared;
  return f === 1 ? (c >= 1 ? 1 : 0) : f === 2 ? (c >= 2 ? 2 : 1) : (c >= 2 ? 3 : 2);
}
/* rooms start small while she's new, then grow */
function roomSize() {
  const ever = save.roomsEver || 0;
  return { nC: run.floor === 1 ? 4 : 5, nT: Math.min([6, 8, 10][ever] || 12, 10 + run.floor) };
}
function spawnMonsters(r, entry) {
  r.monsters = [];
  const nm = monsterCount(), used = new Set();
  for (let i = 0; i < nm; i++) {
    const spots = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (Math.abs(x - entry.x) + Math.abs(y - entry.y) >= 3 && !used.has(key(x, y))) spots.push({ x, y });
    if (!spots.length) break;
    const c = pick(spots); used.add(key(c.x, c.y));
    let dir = Math.random() < .5 ? [1, 0] : [0, 1];                 // wisps pace back and forth in a straight line
    if (dir[0] && c.y === entry.y) dir = [0, 1]; else if (dir[1] && c.x === entry.x) dir = [1, 0];
    if (Math.random() < .5) dir = [-dir[0], -dir[1]];
    r.monsters.push({ id: 'm' + i + uid(), x: c.x, y: c.y, kind: run.floor >= 2 && i === nm - 1 ? 'grumble' : 'wisp', dir, t: 0, dizzy: 0, next: null });
  }
}
function layRoom(r, made, entry) {
  r.rule = made.rule; r.rule.level = r.rule.level || sk(r.rule.skill).level;
  const cells = []; for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (!(x === entry.x && y === entry.y)) cells.push({ x, y });
  shuffle(cells);
  r.tiles = made.tiles.slice(0, cells.length).map((t, i) => ({ ...t, x: cells[i].x, y: cells[i].y, chomped: false, missed: false, glow: false }));
  r.pickups = []; r.gen = true; r.mistakes = 0;
  spawnMonsters(r, entry);
}
function genRoom(r, entry) {
  const { nC, nT } = roomSize();
  const cb = Math.random() < .6 ? nextComeback() : null;
  let made = cb ? comebackRule(cb, nC, nT) : null;
  if (!made) { const skill = pickSkill(); made = makeRule(skill, sk(skill).level, nC, nT); }
  const s = sk(made.rule.skill); s.last = save.roomCount; save.roomCount++; run.lastSkill = made.rule.skill;
  layRoom(r, made, entry);
}
/* World 1-1: three easy matches right beside her, nothing to get wrong, no instructions */
function genLessonRoom(r) {
  const facts = shuffle([[4, 1], [2, 3], [3, 2], [1, 4]]).slice(0, 3);
  const spots = shuffle([{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 1 }, { x: 2, y: 3 }]);
  r.rule = { skill: 'add', kind: 'equals', op: '+', target: 5, title: 'Make 5', speak: 'Chomp the facts that make 5!', level: 1 };
  r.tiles = facts.map(([a, b], i) => ({ kind: 'fact', label: `${a} + ${b}`, value: 5, correct: true, a, b, op: '+', ...spots[i], chomped: false, missed: false, glow: false }));
  r.pickups = []; r.monsters = []; r.gen = true; r.mistakes = 0;
}
/* first room of a new run: a small warm-up built from last run's mistakes */
function genComebackStart(r) {
  const cb = nextComeback(), made = cb ? comebackRule(cb, 3, 7) : null;
  if (!made) { r.special = null; return genRoom(r, { x: 2, y: 2 }); }
  layRoom(r, made, { x: 2, y: 2 }); r.monsters = [];
}
function factsMaking(val, op) {
  const out = [];
  if (op === '+') { for (let a = 0; a <= 10; a++) { const b = val - a; if (b >= 0 && b <= 10 && val > 0) out.push({ a, b, op, val }); } }
  else for (let b = 0; b <= 10; b++) { const a = val + b; if (a >= 1 && a <= 20) out.push({ a, b, op, val }); }
  return out;
}
/* build a room where a missed item shows up again as a RIGHT answer */
function comebackRule(item, nC, nT) {
  let made = null;
  if (item.type === 'fact') {
    const tile = f => ({ kind: 'fact', label: `${f.a} ${f.op} ${f.b}`, value: f.val, correct: f.val === item.val, a: f.a, b: f.b, op: f.op });
    const same = shuffle(factsMaking(item.val, item.op).filter(f => !(f.a === item.a && f.b === item.b))).slice(0, nC - 1);
    const near = shuffle([-2, -1, 1, 2].flatMap(d => item.val + d >= 0 ? factsMaking(item.val + d, item.op) : [])).slice(0, Math.max(0, nT - 1 - same.length));
    made = { rule: { skill: item.op === '+' ? 'add' : 'sub', kind: 'equals', op: item.op, target: item.val, title: `Make ${item.val}`,
      speak: item.op === '+' ? `Chomp the facts that make ${item.val}!` : `Chomp the take-away facts that make ${item.val}!` },
      tiles: [tile(item), ...same.map(tile), ...near.map(tile)] };
  } else if (item.type === 'parity') made = ruleParity(sk('evenOdd').level, nC, nT, item.n);
  else if (item.type === 'frame') made = ruleFrames(sk('frames').level, nC, nT, item.n);
  else if (item.type === 'skip') { made = ruleSkip(item.step, item.level || 1, nC, nT, item.offset || undefined); made.rule.level = item.level || 1; }
  if (made) made.rule.comeback = item.key;
  return made;
}
function enterRoom(r, entry = { x: 2, y: 2 }) {
  run.pos = key(r.x, r.y); room = r; r.visited = true; r.known = true;
  Object.keys(r.doors).forEach(d => neighbor(r, d).known = true);
  if (r.type === 'normal' && !r.gen) {
    if (r.special === 'lesson') genLessonRoom(r);
    else if (r.special === 'comeback') genComebackStart(r);
    else genRoom(r, entry);
    planMonsters();
  }
  if (r.type === 'normal' && !r.cleared && run.items.includes('bubble')) run.shield = true;
  clearActors(); renderAll(); Hint.poke();
  if (r.type === 'normal' && !r.cleared) setTimeout(() => Voice.say(r.rule.comeback ? `Comeback room! ${r.rule.speak}` : r.rule.speak), 250);
  if (r.type === 'treasure' && !r.taken && !r.seen) { r.seen = true; setTimeout(openTreasure, 300); }
  if (r.type === 'shop' && !r.seen) { r.seen = true; setTimeout(openShop, 300); }
  if (r.type === 'boss' && !r.cleared) setTimeout(startBoss, 350);
  saveRun();
}
function goThrough(dir) {
  if (blocked()) return;
  const next = neighbor(room, dir); if (!next) return;
  transitioning = true; Sound.play('door'); tickTime();
  $('#room').classList.add('leave');
  setTimeout(() => {
    const e = doorCell(OPP[dir]); hero.x = e.x; hero.y = e.y; hero.safe = 0;
    enterRoom(next, e);
    $('#room').classList.remove('leave');
    transitioning = false;
  }, 170);
}
