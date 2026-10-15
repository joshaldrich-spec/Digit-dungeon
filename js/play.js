'use strict';
/* Digit Dungeon · play.js: Turns, monsters, chomping, the learning loop, treasure, shop, boss, end of run. */

/* ---------- turns ----------------------------------------------------
   Monsters only move when she WALKS (chomping never moves them).
   Before they move, footprints show the exact tile each one steps to next.
   A monster hurts her only by stepping onto her tile — so stepping onto
   footprints is the one way to get hit, and she can always see it coming.
---------------------------------------------------------------------- */
const inGrid = (x, y) => x >= 0 && y >= 0 && x <= 4 && y <= 4;
const monsterAt = (x, y, not) => (room.monsters || []).find(m => m !== not && m.x === x && m.y === y);
function tryMove(dx, dy) {
  if (blocked()) return;
  tickTime(); Hint.poke();
  if (dx) hero.face = dx < 0 ? 'left' : 'right';
  const nx = hero.x + dx, ny = hero.y + dy;
  if (!inGrid(nx, ny)) {
    const dir = dx > 0 ? 'e' : dx < 0 ? 'w' : dy > 0 ? 's' : 'n', dc = doorCell(dir);
    if (room.doors[dir] && hero.x === dc.x && hero.y === dc.y) { if (room.cleared) return goThrough(dir); return nudgeLocked(); }
    Sound.play('bump'); nudgeHero(dx, dy); return;
  }
  const mon = monsterAt(nx, ny);
  if (mon) {
    if (mon.dizzy > 0) { bonk(mon); endTurn(); return; }   // dizzy monsters can be bonked
    Sound.play('bump'); nudgeHero(dx, dy); return;         // awake ones just block (no turn used)
  }
  hero.x = nx; hero.y = ny; Sound.play('step');
  onEnterCell(); endTurn();
}
function endTurn() {
  run.turn++; if (hero.safe > 0) hero.safe--;
  const died = room.type === 'normal' && !room.cleared && room.monsters && room.monsters.length ? runMonsters() : false;
  renderActors(); renderTelegraph(); saveRun();
  if (died) die('monster');
}
function runMonsters() {
  let hitBy = null;
  room.monsters.forEach(m => {
    if (m.dizzy > 0) { m.dizzy--; m.next = null; return; }
    const n = m.next; m.next = null;
    if (!n) return;
    if (n.x === hero.x && n.y === hero.y) { if (hero.safe <= 0 && !hitBy) hitBy = m; return; }
    if (monsterAt(n.x, n.y, m)) return;
    m.x = n.x; m.y = n.y;
  });
  let died = false;
  if (hitBy) {
    const m = hitBy; m.lunge = [hero.x - m.x, hero.y - m.y]; m.dizzy = 2;      // lunges in, bounces off dizzy
    died = monsterHurt();
    poofAt((m.x + hero.x) / 2, (m.y + hero.y) / 2, '💥');
    setTimeout(() => { m.lunge = null; if (room && room.monsters && room.monsters.includes(m)) renderActors(); }, 190);
  }
  planMonsters();
  return died;
}
function planMonsters() {
  if (!room || !room.monsters) return;
  const slow = run.items.includes('snail'), taken = new Set();
  room.monsters.forEach(m => {
    m.next = null;
    if (m.dizzy > 0) return;
    m.t = (m.t || 0) + 1;
    const every = m.kind === 'grumble' ? (slow ? 3 : 2) : (slow ? 2 : 1);   // grumbles rest every other step
    if (m.t % every) return;
    const ok = (x, y) => inGrid(x, y) && !monsterAt(x, y, m) && !taken.has(key(x, y));
    let step = null;
    if (m.kind === 'grumble') {
      const dx = Math.sign(hero.x - m.x), dy = Math.sign(hero.y - m.y);
      const opts = (Math.abs(hero.x - m.x) >= Math.abs(hero.y - m.y) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]]).filter(([a, b]) => a || b);
      step = opts.find(([a, b]) => ok(m.x + a, m.y + b)) || null;
    } else {
      if (!ok(m.x + m.dir[0], m.y + m.dir[1])) m.dir = [-m.dir[0], -m.dir[1]];
      if (ok(m.x + m.dir[0], m.y + m.dir[1])) step = m.dir;
    }
    if (step) { m.next = { x: m.x + step[0], y: m.y + step[1] }; taken.add(key(m.next.x, m.next.y)); }
  });
}
function monsterHurt() {
  if (run.shield) { run.shield = false; Sound.play('hit'); floatAt(hero.x, hero.y, '🫧 blocked!'); Voice.say('Bubble blocked it!'); renderHUD(); return false; }
  run.hearts = Math.max(0, run.hearts - 1); hero.safe = 3; run.lastHurt = 'monster';
  Sound.play('hurt'); heartFx(); floatAt(hero.x, hero.y, '−½ ❤️', 'bad'); Voice.say('Ouch!');
  const r = $('#room'); r.classList.remove('shake'); void r.offsetWidth; r.classList.add('shake');
  const el = actorEls.get('hero'); if (el) { el.classList.remove('hurt'); void el.offsetWidth; el.classList.add('hurt'); }
  renderHUD();
  return run.hearts <= 0;
}
function bonk(m) {
  room.monsters = room.monsters.filter(o => o !== m);
  Sound.play('hit'); poofAt(m.x, m.y, '⭐'); floatAt(m.x, m.y, 'BONK!'); Voice.say('Bonk!');
  room.pickups.push({ id: uid(), type: 'coin', x: m.x, y: m.y });
}
function die(cause) { run.over = true; run.lastHurt = cause; renderHUD(); setTimeout(() => endRun(false), 900); }
function nudgeHero(dx, dy) {
  const el = actorEls.get('hero'); if (!el) return;
  el.style.setProperty('--bx', dx * 14 + '%'); el.style.setProperty('--by', dy * 14 + '%');
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 220);
}
function nudgeLocked() {
  Sound.play('bump');
  const r = $('#rule'); r.classList.remove('wiggle'); void r.offsetWidth; r.classList.add('wiggle');
  $$('.pip:not(.on)').forEach(p => { p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); });
  if (room.rule) Voice.say(room.rule.speak);
}
function onEnterCell() {
  const i = (room.pickups || []).findIndex(p => p.x === hero.x && p.y === hero.y);
  if (i >= 0) {
    const p = room.pickups[i];
    if (p.type === 'coin') { run.coins++; room.pickups.splice(i, 1); Sound.play('coin'); floatAt(hero.x, hero.y, '+1 🪙'); }
    else if (p.type === 'heart' && run.hearts < run.maxHearts) { run.hearts = Math.min(run.maxHearts, run.hearts + 2); if (run.hearts >= run.maxHearts) run.crack = false; room.pickups.splice(i, 1); Sound.play('item'); floatAt(hero.x, hero.y, '+❤️'); }
    renderHUD();
  }
  if (hero.x === 2 && hero.y === 2) {
    if (room.type === 'treasure' && !room.taken) setTimeout(openTreasure, 160);
    if (room.type === 'shop') setTimeout(openShop, 160);
    if (room.type === 'boss' && room.cleared) setTimeout(trapdoor, 200);
  }
  if (save.settings.readTiles) { const t = tileAt(hero.x, hero.y); if (t && !t.chomped && t.kind !== 'frame') Voice.say(t.label); }
  renderPeek();
}

/* ---------- chomping ---------------------------------------------------
   Right answer: +star, the fact is read aloud, monsters get dizzy, and a
   cracked heart (from the last mistake) mends.
   Wrong answer: a picture-first coaching card, half a heart cracks, the
   mistake is saved to come back later (this run and next run).
---------------------------------------------------------------------- */
function chomp() {
  if (blocked()) return;
  tickTime(); Hint.poke(); chompAnim(); Sound.play('chomp');
  const t = tileAt(hero.x, hero.y);
  if (!t || t.chomped || room.type !== 'normal' || room.cleared) return;
  const rule = room.rule, skill = rule.skill;
  save.chompsEver = (save.chompsEver || 0) + 1;
  if (t.correct) {
    t.chomped = true; t.glow = false; record(skill, true, t);
    save.stars++; run.stars++; run.correct++; run.streak++;
    Sound.play('good'); floatAt(hero.x, hero.y, '+1 ⭐');
    mend();
    (room.monsters || []).forEach(m => { m.dizzy = Math.max(m.dizzy || 0, 3); m.next = null; });
    const k = itemKeyFor(rule, t);
    if (k && save.comeback.some(c => c.key === k)) remembered(k, rightSpeech(rule, t)); else Voice.say(rightSpeech(rule, t));
    updateCell(t); renderRule(); renderHUD(); renderPeek();
    if (run.streak && run.streak % 6 === 0) { const cheer = pick(['On fire!', 'Six in a row!', 'Chomp champ!']); toast(cheer + ' 🔥'); Voice.say(cheer, { queue: true }); }
    if (checkClear()) return;
    endTurn();
  } else {
    const first = !t.missed; t.missed = true; room.mistakes++; run.wrong++; run.streak = 0;
    record(skill, false, t); Sound.play('bad'); updateCell(t);
    if (first) noteMiss(missItem(rule, t));
    const died = first ? wrongCost() : false;
    renderHUD(); saveRun();
    if (died) { run.over = true; showCoach(rule, t, () => endRun(false)); return; }
    showCoach(rule, t);
  }
}
function rightSpeech(rule, t) {
  if (rule.kind === 'equals') return `${t.label} is ${t.value}!`;
  if (rule.kind === 'parity') return `${t.value} is ${rule.want}!`;
  return `${t.value}!`;
}
function wrongCost() {
  if (!save.settings.mistakes) return false;
  run.hearts = Math.max(0, run.hearts - 1); run.crack = true; run.lastHurt = 'wrong';
  heartFx(); renderHUD();
  return run.hearts <= 0;
}
function mend() {
  if (!run.crack) return;
  run.crack = false;
  if (run.hearts < run.maxHearts) { run.hearts++; Sound.play('item'); floatAt(hero.x, hero.y, '💖', 'heal', 1); heartFx(); Voice.say('Your heart is all better!', { queue: true }); }
  renderHUD();
}
function missItem(rule, t) {
  if (rule.kind === 'equals') return { type: 'fact', key: `f:${t.a}${t.op === '+' ? '+' : '-'}${t.b}`, a: t.a, b: t.b, op: t.op, val: t.value };
  if (rule.kind === 'parity') return { type: 'parity', key: `p:${t.value}`, n: t.value };
  if (rule.kind === 'frames') return { type: 'frame', key: `fr:${t.value}`, n: t.value, segs: t.segs, frames: t.frames };
  if (rule.kind === 'skip') return { type: 'skip', key: `s:${rule.step}:${rule.offset || 0}`, step: rule.step, offset: rule.offset || 0, level: rule.level, skill: rule.skill };
  return null;
}
function itemKeyFor(rule, t) {
  if (rule.kind === 'equals') return `f:${t.a}${t.op === '+' ? '+' : '-'}${t.b}`;
  if (rule.kind === 'parity') return `p:${t.value}`;
  if (rule.kind === 'frames') return `fr:${t.value}`;
  return null;
}
function noteMiss(item) {
  if (!item) return;
  run.misses.push(item);
  save.comeback = [item, ...save.comeback.filter(c => c.key !== item.key)].slice(0, 8);
  if (!run.comebackQueue.some(c => c.key === item.key)) run.comebackQueue.push({ ...item, after: run.roomsCleared + 2 });  // comes back 2+ rooms later
  persist();
}
function nextComeback() {
  const q = run.comebackQueue || (run.comebackQueue = []);
  const i = q.findIndex(c => (c.after || 0) <= run.roomsCleared && save.comeback.some(s => s.key === c.key));
  return i < 0 ? null : q.splice(i, 1)[0];
}
function remembered(key, said) {
  const i = save.comeback.findIndex(c => c.key === key); if (i < 0) return;
  save.comeback.splice(i, 1); save.remembered = (save.remembered || 0) + 1;
  save.stars += 3; run.stars += 3; run.justRemembered = Date.now(); persist();
  Sound.play('item'); banner('🧠', 'You remembered!', strip(said)); floatAt(hero.x, hero.y, '+3 ⭐', '', 1);
  Voice.say(`You remembered! ${said}`);
}
function record(skill, ok, t) {
  const s = sk(skill); s.tries++; if (ok) s.correct++; s.recent.push(ok ? 1 : 0); if (s.recent.length > 20) s.recent.shift();
  if (t && t.kind === 'fact') { const k = factKey(t), f = save.facts[k] = save.facts[k] || { b: 2, r: 0, w: 0 }; if (ok) { f.r++; f.b = Math.min(5, f.b + 1); } else { f.w++; f.b = 1; } }
  const d = save.days[today()] = save.days[today()] || { ms: 0, c: 0, w: 0 }; ok ? d.c++ : d.w++;
  const b = run.bySkill[skill] = run.bySkill[skill] || { c: 0, w: 0 }; ok ? b.c++ : b.w++;
  persist();
}
function maybeLevel(id) {
  const s = sk(id), max = SKILLS[id].max;
  if (s.recent.length >= 15 && mean(s.recent.slice(-15)) >= .9 && s.level < max) { s.level++; s.recent = []; toast(`⬆️ ${SKILLS[id].short} is now level ${s.level}! Your brain is growing!`); Voice.say('Level up! Your brain is growing!', { queue: true }); }
  else if (s.recent.length >= 10 && mean(s.recent.slice(-10)) < .6 && s.level > 1) { s.level--; s.recent = []; }
}
const PRAISE_CLEAN = ['You checked every tile!', 'Sharp eyes!', 'Careful chomping!', 'Perfect room!', 'Great thinking!'];
const PRAISE_FIX = ['You fixed your mistakes. That is how brains grow!', 'You kept trying. Nice!', 'Mistakes help us learn. Room cleared!', 'You figured it out!'];
function checkClear() {
  if (!room.tiles.every(t => !t.correct || t.chomped)) return false;
  room.cleared = true; run.roomsCleared++; run.floorRoomsCleared++; save.roomsEver = (save.roomsEver || 0) + 1;
  save.stars += 3; run.stars += 3;
  (room.monsters || []).forEach(m => poofAt(m.x, m.y)); room.monsters = [];
  dropLoot(); if (room.special !== 'lesson') maybeLevel(room.rule.skill);
  Sound.play('clear');
  if (room.rule.kind === 'skip' && !room.mistakes) { const k = `s:${room.rule.step}:${room.rule.offset || 0}`; if (save.comeback.some(c => c.key === k)) remembered(k, itemCard({ type: 'skip', step: room.rule.step, offset: room.rule.offset }).say); }
  const msg = pick(room.mistakes ? PRAISE_FIX : PRAISE_CLEAN);
  toast(`${msg} +3 ⭐`);
  if (!(run.justRemembered > Date.now() - 1500)) Voice.say(`${msg} Nice one!`);
  checkUnlocks(); renderAll(); saveRun();
  $$('.door.open').forEach(d => { d.classList.add('burst'); setTimeout(() => d.classList.remove('burst'), 1600); });
  return true;
}
function dropLoot() {
  const free = []; for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { const t = tileAt(x, y); if ((!t || t.chomped) && !(x === hero.x && y === hero.y)) free.push({ x, y }); }
  shuffle(free).sort((a, b) => (Math.abs(a.x - 2) + Math.abs(a.y - 2)) - (Math.abs(b.x - 2) + Math.abs(b.y - 2)));
  const heartChance = run.hearts <= 2 ? 1 : run.hearts < run.maxHearts ? .3 : 0;
  if (Math.random() < heartChance && free.length) room.pickups.push({ id: uid(), type: 'heart', ...free.shift() });
  const coins = rnd(1, 2) + (run.items.includes('clover') ? 1 : 0);
  for (let i = 0; i < coins && free.length; i++) room.pickups.push({ id: uid(), type: 'coin', ...free.shift() });
}
function useGlow() {
  if (blocked() || run.glow <= 0 || room.type !== 'normal' || room.cleared) return;
  const left = room.tiles.filter(t => t.correct && !t.chomped && !t.glow); if (!left.length) return;
  const t = pick(left); t.glow = true; run.glow--; Sound.play('item'); updateCell(t); renderHUD(); saveRun();
}

/* ---------- treasure / shop ---------- */
function openTreasure() {
  if (!room.offers) room.offers = pickItemOffers(2);
  openOverlay(`<h2>👑 Treasure!</h2><p>Pick <b>one</b> prize:</p><div class="offers">${room.offers.map(id => `<button class="offer" data-act="take" data-id="${id}"><div class="ic">${ITEMS[id].icon}</div><b>${ITEMS[id].name}</b><span>${ITEMS[id].desc}</span></button>`).join('')}</div><button class="btn ghost" data-close>Not now</button>`,
    { actions: { take: el => takeItem(el.dataset.id) } });
  Voice.say('Treasure! Pick one prize.');
}
function takeItem(id) {
  run.items.push(id); room.taken = true; applyItem(id); Sound.play('item'); closeOverlay();
  banner(ITEMS[id].icon, ITEMS[id].name, ITEMS[id].desc); Voice.say(ITEMS[id].say);
  renderAll(); saveRun();
}
function openShop() {
  if (!room.stock) {
    const it = pickItemOffers(1)[0];
    room.stock = [{ id: 'refill', icon: '❤️', name: 'Heart', desc: 'Heals one heart', price: 3 }, { id: 'flashlight', icon: '🔦', name: 'Flashlight', desc: 'Lights up a right answer', price: 4 }];
    if (it) room.stock.push({ id: it, icon: ITEMS[it].icon, name: ITEMS[it].name, desc: ITEMS[it].desc, price: 10, item: true });
  }
  const can = s => run.coins >= s.price && !s.sold && !(s.id === 'refill' && run.hearts >= run.maxHearts);
  openOverlay(`<h2>🦉 Hoot's Shop</h2><p>You have <b>${run.coins} 🪙</b></p><div class="offers">${room.stock.map((s, i) => `<button class="offer" data-act="buy" data-i="${i}" ${can(s) ? '' : 'disabled'}><div class="ic">${s.icon}</div><b>${s.name}</b><span>${s.desc}</span><div class="price">${s.sold ? 'Sold!' : s.price + ' 🪙'}</div></button>`).join('')}</div><button class="btn mint" data-close>Done shopping</button>`,
    { actions: { buy: el => buy(+el.dataset.i) } });
  if (!room.shopSpoke) { room.shopSpoke = true; Voice.say(`Welcome to Hoot's shop! You have ${run.coins} coins.`); }
}
function buy(i) {
  const s = room.stock[i], before = run.coins; run.coins -= s.price; Sound.play('coin');
  if (s.id === 'refill') run.hearts = Math.min(run.maxHearts, run.hearts + 2);
  else if (s.id === 'flashlight') run.glow++;
  else { run.items.push(s.id); applyItem(s.id); s.sold = true; }
  renderHUD(); saveRun();
  coinQuestion(before, s.price);
}
function coinQuestion(before, price) {
  const ans = before - price, set = new Set([ans]);
  shuffle([ans + 1, ans - 1, ans + 2, ans - 2].filter(v => v >= 0)).forEach(v => { if (set.size < 3) set.add(v); });
  const ch = shuffle([...set]);
  const ask = () => openOverlay(`<h2>Bonus question! 🪙</h2><p>You had <b>${before}</b> coins.<br>You spent <b>${price}</b>.</p><p>How many coins are left?</p><div class="choices">${ch.map(v => `<button class="ch" data-act="pick" data-v="${v}">${v}</button>`).join('')}</div>`,
    { actions: { pick: el => {
      if (+el.dataset.v === ans) { run.coins++; Sound.play('good'); toast('Math bonus! +1 🪙'); Voice.say('Math bonus! One more coin!'); renderHUD(); saveRun(); openShop(); }
      else { Sound.play('bad'); const st = before <= 20 ? subStrategy(before, price) : { name: 'Count back', text: `Count back ${price} from ${before}.` };
        openOverlay(`<h2>Let's see!</h2><p><b>${before} − ${price} = ${ans}</b></p><p><span class="strat">${st.name}</span> ${st.text}</p><button class="btn mint big" data-act="back">Back to shop</button>`, { actions: { back: openShop } });
        Voice.say(`${before} minus ${price} equals ${ans}. ${st.text}`); }
    } } });
  ask(); Voice.say(`Bonus question! You had ${before} coins. You spent ${price}. How many coins are left?`);
}

/* ---------- boss: number-rack take-away ---------- */
function startBoss() {
  if (run.boss && run.boss.floor === run.floor) { renderBoss(); return; }
  const hp = run.floor === 1 ? rnd(12, 15) : run.floor === 2 ? rnd(14, 18) : rnd(17, 20);
  run.boss = { floor: run.floor, hp, step: 'intro', wrong: [] };
  Sound.play('boss'); renderBoss(); saveRun();
  Voice.say(`${BOSSES[run.floor - 1].name} appears! Shrink its health to zero with your number powers!`);
}
function bossMoves(hp) {
  const c = [];
  if (hp > 10) c.push({ id: 'ten', icon: '💥', name: 'Ten Smash', k: 10 });
  if (hp > 10 && hp % 10) c.push({ id: 'ones', icon: '✂️', name: 'Snip', k: hp % 10 });
  if (hp % 2 === 0 && hp >= 4) c.push({ id: 'half', icon: '🌗', name: 'Half Chomp', k: hp / 2 });
  if (hp <= 5) c.push({ id: 'final', icon: '⭐', name: 'Final Chomp', k: hp });
  if (hp > 3) c.push({ id: 'zap', icon: '⚡', name: 'Zap', k: rnd(2, Math.min(4, hp - 1)) });
  if (hp >= 11 && run.floor >= 2 && hp - 9 <= 9) c.push({ id: 'boom', icon: '💣', name: 'Big Boom', k: rnd(hp - 9, 9) });
  const out = []; for (const m of shuffle(c)) { if (!out.some(o => o.k === m.k)) out.push(m); if (out.length === 2) break; }
  return out;
}
function bossHint(hp, m) {
  const r = hp - m.k;
  if (m.id === 'ten') return `Slide away the top row of ten. ${hp} is 10 and ${hp - 10}. ${r} left.`;
  if (m.id === 'ones') return 'Slide away the beads on the bottom row. The full ten is left!';
  if (m.id === 'half') return `Half of ${hp}: ${m.k} + ${m.k} = ${hp}. So ${hp} − ${m.k} = ${m.k}.`;
  if (m.id === 'final') return 'Take them all away. Zero left!';
  return subStrategy(hp, m.k).text;
}
function renderBoss() {
  const b = run.boss, B = BOSSES[run.floor - 1];
  let body = '';
  if (b.step === 'intro') body = `<p><b>${B.name}</b> blocks the way!</p><p class="sub">Shrink its health to 0 with take-away powers.</p><button class="btn red big" data-act="go">Fight!</button>`;
  else if (b.step === 'choose') body = `<p>Pick an attack!</p><div class="attacks">${b.moves.map((m, i) => `<button class="atk" data-act="atk" data-i="${i}"><span class="ai">${m.icon}</span><b>${m.name}</b><span class="ak">−${m.k}</span></button>`).join('')}</div>`;
  else if (b.step === 'answer') body = `<p class="boss-q">${b.hp} − ${b.move.k} = <span class="qmark">?</span></p><div class="choices">${b.choices.map(v => `<button class="ch" data-act="ans" data-v="${v}" ${b.wrong.includes(v) ? 'disabled' : ''}>${v}</button>`).join('')}</div>${b.hint ? `<p class="hint">💡 ${b.hint}</p>` : ''}`;
  else if (b.step === 'win') body = `<p><b>You beat ${B.name}!</b> 🎉</p><p>+10 ⭐ &nbsp; +5 🪙</p><button class="btn gold big" data-act="trap">${run.floor < 3 ? 'Jump down the trapdoor ⬇️' : 'Claim your trophy 🏆'}</button>`;
  const hearts = heartsHTML();
  openOverlay(`<div class="boss-wrap ${b.step === 'win' ? 'won' : ''}"><div class="boss-hearts">${hearts}${run.shield ? '<span class="shield">🫧</span>' : ''}</div><div class="boss-spr ${b.flash ? 'flash' : ''}">${bossSVG(run.floor)}</div><div class="boss-name">${B.name}</div><div class="boss-hp"><span>Health</span><b>${b.hp}</b></div><div class="rack">${rackSVG(b.hp, b.gone || 0)}</div>${body}</div>`,
    { cls: 'boss-card', actions: {
      go: () => { b.step = 'choose'; b.moves = bossMoves(b.hp); renderBoss(); Voice.say('Pick an attack!'); saveRun(); },
      atk: el => bossPick(+el.dataset.i), ans: el => bossAnswer(+el.dataset.v),
      trap: () => { closeOverlay(); trapdoor(); } } });
  b.flash = false; b.gone = 0;
}
function bossPick(i) {
  const b = run.boss, m = b.moves[i]; tickTime();
  b.move = m; b.ans = b.hp - m.k; b.wrong = []; b.hint = null;
  const set = new Set([b.ans]);
  shuffle([b.ans + 1, b.ans - 1, b.ans + 2, b.ans - 2, m.id === 'ten' ? b.ans + 10 : -1].filter(v => v >= 0 && v <= 20)).forEach(v => { if (set.size < 3) set.add(v); });
  b.choices = shuffle([...set]); b.step = 'answer';
  renderBoss(); saveRun(); Voice.say(`${b.hp} minus ${m.k} equals what?`);
}
function bossAnswer(v) {
  const b = run.boss; tickTime();
  if (v === b.ans) {
    record('rack', true); save.stars++; run.stars++; run.correct++; mend();
    b.gone = b.move.k; b.hp = b.ans; b.flash = true; Sound.play('hit');
    if (b.hp === 0) return bossWin();
    b.step = 'choose'; b.moves = bossMoves(b.hp); renderBoss(); saveRun(); Voice.say(`Hit! ${b.hp} left.`);
  } else {
    record('rack', false); run.wrong++; b.wrong.push(v); b.hint = bossHint(b.hp, b.move); Sound.play('bad');
    if (b.hp <= 20 && b.move.k <= 10) noteMiss({ type: 'fact', key: `f:${b.hp}-${b.move.k}`, a: b.hp, b: b.move.k, op: '−', val: b.hp - b.move.k });
    const died = wrongCost();
    renderBoss(); const c = $('#ov-card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
    Voice.say(b.hint);
    if (died) { run.over = true; setTimeout(() => endRun(false), 2600); }
    saveRun();
  }
}
function bossWin() {
  const b = run.boss; room.cleared = true; save.stars += 10; run.stars += 10; run.coins += 5;
  b.step = 'win'; Sound.play('win'); confetti(); renderBoss(); renderAll(); checkUnlocks(); saveRun();
  Voice.say(`You beat ${BOSSES[run.floor - 1].name}! Amazing!`);
}
function trapdoor() {
  if (run.over) return;
  if (run.floor >= 3) return endRun(true);
  run.floor++; run.floorRoomsCleared = 0; run.boss = null;
  run.map = genFloor(run.floor); hero.x = 2; hero.y = 2; hero.safe = 0;
  run.hearts = Math.min(run.maxHearts, run.hearts + 2);
  $('#scr-game').dataset.floor = run.floor; Sound.play('door');
  enterRoom(run.map.rooms['0,0']);
  banner('⬇️', `Floor ${run.floor}`, FLOOR_NAMES[run.floor - 1]);
  Voice.say(`Floor ${run.floor}. ${FLOOR_NAMES[run.floor - 1]}.`);
}

/* ---------- end of run: every failure hands her one thing to remember ---------- */
function endRun(won) {
  if (!run) return; tickTime();
  const r = run; r.over = true;
  if (won) { save.stars += 25; r.stars += 25; save.best.wins = (save.best.wins || 0) + 1; confetti(); Sound.play('win'); }
  save.best.floor = Math.max(save.best.floor || 0, r.floor); save.runsPlayed++;
  save.run = null; checkUnlocks(true); persist();
  const newU = unlocksBetween(r.startStars, save.stars);
  const miss = [...(r.misses || [])].reverse().find(m => save.comeback.some(c => c.key === m.key));
  const card = miss ? itemCard(miss) : null;
  const monsterTip = !won && r.lastHurt === 'monster';
  openOverlay(`${won ? '<div class="trophy">🏆</div><h2>Dungeon Champion!</h2>' : `<div class="name-hero">${heroSVG()}</div><h2>Run over!</h2>`}
    <div class="sumgrid"><div><b>${r.floor}</b><span>floor</span></div><div><b>${r.roomsCleared}</b><span>rooms</span></div><div><b>${r.correct}</b><span>right</span></div><div><b>+${r.stars}</b><span>⭐ kept</span></div></div>
    ${card ? `<div class="remember"><div class="remember-h">🧠 Remember for next time</div><div class="paper">${card.model}</div><div class="remember-t${card.title.length > 14 ? ' long' : ''}">${card.title}</div><div class="sub">🔁 You'll see it again next run!</div></div>` : ''}
    ${monsterTip ? `<div class="tipline"><span class="tp">${pawSVG('#d9c8ff')}</span><span>Monsters step on the footprints!</span></div>` : ''}
    ${newU.length ? `<p class="sub">🎁 New in the Closet: <b>${newU.join(', ')}</b></p>` : ''}
    <div class="stack"><button class="btn mint big" data-act="again">Play again</button><button class="btn" data-act="home">Home</button></div>`,
    { actions: { again: () => { closeOverlay(); newRun(); }, home: () => { closeOverlay(); showTitle(); } } });
  Voice.say(won ? 'You are the Dungeon Champion!' : card ? `Remember: ${card.say}. You'll see it again next run!` : monsterTip ? 'Watch the footprints! Monsters step where the footprints are.' : 'Run over! Great try!');
}
function unlocksBetween(a, b) {
  const out = [];
  Object.values(COLORS).forEach(c => { if (c.need > a && c.need <= b) out.push(c.name + ' color'); });
  Object.values(HATS).forEach(h => { if (h.need > a && h.need <= b) out.push(h.name); });
  return out;
}
function checkUnlocks(silent) {
  [...Object.entries(COLORS).map(([k, c]) => ['c:' + k, c.need, c.name + ' color']), ...Object.entries(HATS).map(([k, h]) => ['h:' + k, h.need, h.name])]
    .forEach(([id, need, name]) => { if (need && save.stars >= need && !save.unlocks.includes(id)) { save.unlocks.push(id); if (!silent) { toast(`🎁 New in the Closet: ${name}!`); Voice.say('Something new in the closet!', { queue: true }); } } });
}
