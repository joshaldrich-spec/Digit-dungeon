'use strict';
/* Digit Dungeon · ui.js: Overlays, coaching card, title, closet, grown-ups panel, input, start-up. */

/* ---------- overlays, toasts, banners ---------- */
function openOverlay(html, o = {}) {
  if (typeof stopWalk === 'function') stopWalk();
  const card = $('#ov-card'); card.className = 'card ' + (o.cls || ''); card.innerHTML = artify(html); card.scrollTop = 0;
  $('#ov').classList.add('show'); ovState = o;
  $('#banner').classList.remove('show');
}
function closeOverlay() { $('#ov').classList.remove('show'); const cb = ovState && ovState.onClose; ovState = null; if (run) run.tick = Date.now(); if (cb) cb(); }
const toasts = []; let toasting = false;
function toast(m) { toasts.push(m); if (!toasting) nextToast(); }
function nextToast() {
  const m = toasts.shift(); if (!m) { toasting = false; return; }
  toasting = true; const el = $('#toast'); el.innerHTML = artify(esc(m)); el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); setTimeout(nextToast, 260); }, 1900);
}
let bannerT = null;
function banner(icon, title, sub) {
  const b = $('#banner'); b.innerHTML = artify(`<div class="bx"><div class="bi">${icon}</div><div class="bt">${esc(title)}</div><div class="bs">${esc(sub || '')}</div></div>`);
  // long titles shrink so the ribbon (which grows with the words) still fits on a phone
  const bt = b.querySelector('.bt'), room = Math.min(window.innerWidth * .88, 560) - 64;
  for (let fs = parseFloat(getComputedStyle(bt).fontSize); bt.offsetWidth > room && fs > 14; ) bt.style.fontSize = --fs + 'px';
  b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), 1700);
}
function confetti() {
  const fx = $('#fx'), bits = ['⭐', '✨', '🎉', '🪙', '💖'];
  for (let i = 0; i < 36; i++) { const s = document.createElement('span'); s.className = 'conf'; s.textContent = pick(bits); s.style.left = Math.random() * 100 + 'vw'; s.style.animationDuration = (1.6 + Math.random() * 1.6) + 's'; s.style.animationDelay = Math.random() * .6 + 's'; fx.appendChild(s); setTimeout(() => s.remove(), 4000); }
}
function showCoach(rule, t, after) {
  const c = coachContent(rule, t);
  openOverlay(`<div class="coach-head"><button class="say" data-act="say" aria-label="Hear it again">🔊</button><h2 class="coach-title">${c.title}</h2></div>
    <div class="model"><div class="paper">${c.model}</div>${c.model2 ? `<div class="paper nline">${c.model2}</div>` : ''}</div>
    <p class="coach-line">${c.strat ? `<span class="strat">${c.strat}</span> ` : ''}${c.line}</p>
    <div class="need-chip">🎯 ${esc(rule.title)}</div><br>
    <button class="btn mint big" data-close>OK!</button>`,
    { actions: { say: () => Voice.say(c.say) }, onClose: after });
  Voice.say(c.say);
}
function openPause() {
  tickTime();
  openOverlay(`<h2>Paused</h2><div class="stack">
    <button class="btn mint big" data-close>Keep playing</button>
    <button class="btn" data-act="voice">${save.settings.voice ? '🔊 Read aloud: on' : '🔇 Read aloud: off'}</button>
    <button class="btn" data-act="sound">${save.settings.sound ? '🎵 Sounds: on' : '🔕 Sounds: off'}</button>
    <button class="btn" data-act="music">${save.settings.music ? '🎶 Music: on' : '🔕 Music: off'}</button>
    <button class="btn" data-act="home">💾 Save &amp; go home</button></div>`,
    { actions: { voice: () => { save.settings.voice = !save.settings.voice; persist(); openPause(); }, sound: () => { save.settings.sound = !save.settings.sound; persist(); openPause(); }, music: () => { Music.toggle(!save.settings.music); openPause(); },
      home: () => { saveRun(); closeOverlay(); showTitle(); } } });
}

/* ---------- intro video ----------
   On app open: a Play screen over a still from the intro. Her tap starts it with sound (iPads only allow sound after
   a tap), Skip is always there, and the title fades in when it ends. MP4 for iPads, WebM for other browsers. */
const Intro = {
  playing: false,
  show() {
    if (save.settings.intro === false || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const v = $('#intro-video');
    v.innerHTML = `<source src="media/intro.mp4?${BUILD}" type="video/mp4"><source src="media/intro.webm?${BUILD}" type="video/webm">`;
    v.load(); showScreen('intro'); return true;
  },
  play() {
    const v = $('#intro-video'); this.playing = true;
    $('#intro-play').hidden = true; $('#intro-skip').hidden = false; $('#scr-intro').classList.add('rolling');
    try { v.currentTime = 0; const p = v.play(); if (p && p.catch) p.catch(() => this.done()); } catch (e) { this.done(); }
  },
  done() {
    const scr = $('#scr-intro'); if (!scr.classList.contains('active') || scr.classList.contains('leaving')) return;
    this.playing = false; try { $('#intro-video').pause(); } catch (e) {}
    scr.classList.add('leaving');
    setTimeout(() => { scr.classList.remove('leaving', 'rolling'); if (!scr.classList.contains('active')) return;
      showTitle(); $('#scr-title').classList.add('from-intro'); setTimeout(() => $('#scr-title').classList.remove('from-intro'), 900); Music.start(); }, 450);
  },
};
$('#intro-play').addEventListener('click', () => Intro.play());
$('#intro-skip').addEventListener('click', () => Intro.done());
$('#intro-video').addEventListener('ended', () => Intro.done());

/* ---------- title, name, closet ---------- */
function showTitle() {
  Voice.stop(); run = null; showScreen('title');
  $('#title-hero').innerHTML = heroSVG();
  $('#title-name').textContent = save.name ? `${save.name}'s adventure` : '';
  const bits = [`⭐ ${save.stars} stars`]; if (save.best.floor) bits.push(`best: floor ${save.best.floor}`); if (save.best.wins) bits.push(`🏆 ×${save.best.wins}`);
  $('#title-stats').innerHTML = artify(esc(bits.join(' · ')));
  closetBadge();
  $('#btn-continue').hidden = !save.run; if (save.run) $('#btn-continue').innerHTML = artify(`▶ Continue (floor ${save.run.floor})`);
}
function askName(then) {
  openOverlay(`<h2>Name your hero!</h2><div class="name-hero">${heroSVG()}</div><input class="name-in" id="name-in" maxlength="14" placeholder="Hero name" autocomplete="off" autocapitalize="words" value="${esc(save.name)}"><br><button class="btn mint big" data-act="ok">Let's go!</button>`,
    { actions: { ok: () => { save.name = ($('#name-in').value.trim() || 'Hero').slice(0, 14); persist(); closeOverlay(); then && then(); } } });
  Voice.say('Name your hero!');
  setTimeout(() => { const i = $('#name-in'); if (i) i.focus(); }, 120);
}
/* Closet: tabs for Colors, Hats, Tops and Shoes. Locked things show what's coming and how many stars it takes.
   NEW marks anything unlocked she hasn't looked at yet (and the title's Closet button counts them). */
let closetTab = 'hat';
function swatchArt(slot, k) {
  if (k === 'none') return '<svg viewBox="16 -2 68 38"><text x="50" y="26" text-anchor="middle" font-size="22" fill="#bfaed8">—</text></svg>';
  if (slot === 'color') return `<span class="dot" style="background:${COLORS[k].c}"></span>`;
  if (slot === 'hat') return ART.hats && ART.hats[k] ? `<img class="swh" src="${ART.hats[k]}" alt="">` : `<svg viewBox="16 -2 68 38">${hatSVG(k)}</svg>`;
  const src = slot === 'top' ? ART.topIcons && ART.topIcons[k] : ART.shoeIcons && ART.shoeIcons[k];
  return src ? `<img class="swh" src="${src}" alt="">` : '<span class="dot"></span>';
}
function tabIcon(slot) {
  const pic = { hat: ART.hats && ART.hats.crown, top: ART.topIcons && ART.topIcons.sailor, shoes: ART.shoeIcons && ART.shoeIcons.hightops }[slot];
  return slot === 'color' || !pic ? '<span class="dot sm"></span>' : `<img src="${pic}" alt="">`;
}
function closetBadge() { const b = $('#closet-badge'); if (!b) return; const n = newCount(); b.hidden = !n; b.textContent = n; }
function openCloset(tab = closetTab) {
  closetTab = tab; if (!save.seen) save.seen = [...save.unlocks];
  const sh = SHELVES.find(x => x.slot === tab), items = Object.entries(sh.list()).sort((a, b) => a[1].need - b[1].need);
  const grid = items.map(([k, it]) => { const lock = save.stars < it.need, fresh = isNewItem(sh.pre + k, it.need);
    return `<button class="sw ${save.cosmetics[tab] === k ? 'sel' : ''}" data-act="wear" data-k="${k}" ${lock ? 'disabled' : ''}>${fresh ? '<span class="newtag">NEW</span>' : ''}${swatchArt(tab, k)}${lock ? `<span class="lk">🔒 ${it.need}⭐</span>` : `<span class="nm">${esc(it.name)}</span>`}</button>`; }).join('');
  const tabs = SHELVES.map(x => { const n = x.slot === tab ? 0 : newCount(x.slot);
    return `<button class="ctab ${x.slot === tab ? 'sel' : ''}" data-act="tab" data-k="${x.slot}">${tabIcon(x.slot)}<span>${x.label}</span>${n ? `<span class="newdot">${n}</span>` : ''}</button>`; }).join('');
  items.forEach(([k, it]) => { if (isNewItem(sh.pre + k, it.need)) save.seen.push(sh.pre + k); }); persist();   // seen now
  let cheer = null;
  openOverlay(`<h2>👕 Closet</h2><div class="closet-hero">${heroSVG()}</div><p class="sub">⭐ ${save.stars} stars · earn more by chomping!</p><div class="ctabs">${tabs}</div><div class="swatches">${grid}</div><div class="stack"><button class="btn mint" data-close>Done</button></div>`,
    { actions: {
        tab: el => openCloset(el.dataset.k),
        wear: el => {        // put it on right here (no re-draw, so the list doesn't jump back to the top)
          save.cosmetics[tab] = el.dataset.k; persist();
          $$('#ov-card .sw').forEach(b => b.classList.toggle('sel', b === el));
          const hero = $('#ov-card .closet-hero'); hero.innerHTML = heroSVG(undefined, undefined, false, 'cheer');
          clearTimeout(cheer); cheer = setTimeout(() => { if (hero.isConnected) hero.innerHTML = heroSVG(); }, 900);
        } },
      onClose: () => { $('#title-hero').innerHTML = heroSVG(); closetBadge(); } });
}

/* ---------- grown-ups panel ---------- */
function openGrownups() {
  const rows = [...Object.keys(SKILLS), 'rack'].map(id => {
    const s = sk(id), r = s.recent, acc = r.length ? Math.round(mean(r) * 100) : null;
    const on = id === 'rack' || save.settings.skills[id] !== false, gated = SKILLS[id] && SKILLS[id].gate && !SKILLS[id].gate();
    const name = id === 'rack' ? 'Boss take-away (number rack)' : SKILLS[id].name;
    const lvl = id === 'rack' ? '—' : `${s.level}/${SKILLS[id].max}`;
    const note = id === 'rack' ? '' : `<br><small style="color:var(--muted)">${!on ? 'off' : gated ? SKILLS[id].gateText : LEVEL_NOTES[id][s.level - 1]}</small>`;
    return `<tr><td>${name}${note}</td><td class="n">${lvl}</td><td class="n ${acc === null ? '' : acc >= 85 ? 'acc-hi' : acc >= 65 ? 'acc-mid' : 'acc-lo'}">${acc === null ? '—' : acc + '%'}</td><td class="n">${s.tries}</td></tr>`;
  }).join('');
  const tricky = Object.entries(save.facts).filter(([, f]) => f.w > 0 && f.b <= 2).sort((a, b) => b[1].w - a[1].w).slice(0, 12)
    .map(([k, f]) => `<span class="chip">${k.replace('+', ' + ').replace('-', ' − ')} <small style="color:var(--muted)">missed ${f.w}</small></span>`).join('');
  const days = Object.entries(save.days).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7).map(([d, v]) => {
    const t = v.c + v.w, dt = new Date(d + 'T12:00:00');
    return `<div class="sess">${dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${Math.max(1, Math.round(v.ms / 60000))} min · ${v.c} right / ${v.w} oops${t ? ` (${Math.round(100 * v.c / t)}%)` : ''}</div>`;
  }).join('');
  const tg = (k, label, sub) => `<label class="tg"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" data-set="${k}" ${save.settings[k] ? 'checked' : ''}></label>`;
  const stg = id => `<label class="tg"><span>${SKILLS[id].name}${SKILLS[id].gate ? `<small>${SKILLS[id].gateText}</small>` : ''}</span><input type="checkbox" data-skill="${id}" ${save.settings.skills[id] !== false ? 'checked' : ''}></label>`;
  openOverlay(`<div class="gu"><h2 style="text-align:center">Grown-ups</h2><p class="sub" style="text-align:center">Bridges Grade 2 · Unit 1 "Figuring the Facts" · build ${BUILD}</p>
    <h3>How it's going</h3><table><tr><th>Skill</th><th class="n">Level</th><th class="n">Last 20</th><th class="n">Tries</th></tr>${rows}</table>
    <h3>Coming back next run</h3><div class="chips">${save.comeback.length ? save.comeback.map(c => `<span class="chip">${esc(itemCard(c).title)}</span>`).join('') : '<span class="sub">Nothing yet. Her mistakes show up here and return in her next run.</span>'}</div>
    <p class="sub" style="text-align:left">🧠 Remembered later: ${save.remembered || 0}</p>
    <h3>Tricky facts</h3><div class="chips">${tricky || '<span class="sub">None yet. Missed facts show up here and come back more often.</span>'}</div>
    <h3>Recent days</h3>${days || '<p class="sub">No play yet.</p>'}
    <h3>Settings</h3>
    ${tg('voice', 'Read aloud', 'Rules, coaching and questions are spoken')}
    ${tg('sound', 'Sound effects')}
    ${tg('music', 'Background music', 'Spooky lo-fi loop, quieter while the voice talks')}
    ${tg('intro', 'Intro video', 'Plays when the game opens (she can skip it)')}
    ${tg('mistakes', 'Mistakes cost ½ heart', 'Off = gentle mode: wrong answers only coach')}
    ${tg('monsters', 'Monsters', 'Off = calm rooms with no wandering monsters')}
    ${tg('readTiles', 'Read each tile when stepped on', 'Extra support for early readers')}
    <h3>This week</h3>
    ${tg('focus', `Focus: ${FOCUS.name}`, 'Number-rack quick looks, even/odd beads, how many more, story problems, number cards, sums and differences to 20')}
    <h3>Skills in the mix</h3>${Object.keys(SKILLS).map(stg).join('')}
    <h3>How it teaches</h3><ul>
      <li>Uses Bridges' own models: ten-frames, the number rack, pairs, and number paths.</li>
      <li>No reading to get started: the first room is three easy matches, and rules, facts and coaching are all read aloud.</li>
      <li>Every mistake gets a picture and a named strategy (doubles, make ten, count on, think addition). It cracks half a heart, and her next right answer mends it.</li>
      <li>Mistakes come back: one is shown on the run-over screen, the next run starts with a room built around it, and getting it right is celebrated.</li>
      <li>No timers. Monsters only move when she walks, footprints show exactly where they'll step, and right answers make them dizzy. Running into one starts a one-question "squash" fight.</li>
      <li>Boss fights and squash fights mix problem types: take-away on the number rack, doubles, ten-friends, ten-frame quick looks, even/odd and skip counting.</li>
      <li>Adapts: a skill levels up at 90%+ and eases off below 60%. Rooms mix skills and favor her weaker ones.</li>
      <li>Stars are always kept, even when a run ends.</li></ul>
    <div class="stack"><button class="btn mint" data-close>Done</button><button class="btn small ghost" data-act="reset">Reset all progress</button></div></div>`,
    { actions: { reset: el => { if (!el.dataset.armed) { el.dataset.armed = 1; el.textContent = 'Tap again to erase everything'; el.style.color = 'var(--red)'; return; }
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {} save = defaultSave(); persist(); closeOverlay(); showTitle(); } },
      onChange: inp => { if (inp.dataset.set === 'music') Music.toggle(inp.checked); else if (inp.dataset.set) save.settings[inp.dataset.set] = inp.checked; if (inp.dataset.skill) save.settings.skills[inp.dataset.skill] = inp.checked; persist(); } });
}

/* =====================================================================
   INPUT
   ===================================================================== */
/* Hints only ever point at CONTROLS (never at answers): d-pad, CHOMP, open doors. */
const Hint = {
  last: Date.now(),
  poke() { this.last = Date.now(); $$('.nudge').forEach(e => e.classList.remove('nudge')); },
  tick() {
    if (!run || run.over || !room || blocked() || !$('#scr-game').classList.contains('active')) return;
    const idle = Date.now() - this.last, newbie = (save.roomsEver || 0) < 3, t = tileAt(hero.x, hero.y);
    if (room.type === 'normal' && !room.cleared && t && !t.chomped) { if (idle > (newbie ? 2500 : 8000)) $('#btn-chomp').classList.add('nudge'); }
    else if (idle > (newbie ? 3500 : 9000)) (room.cleared ? $$('.door.open') : $$('.dbtn')).forEach(e => e.classList.add('nudge'));
  }
};
setInterval(() => Hint.tick(), 500);
$('#ov-card').addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-close]'); if (!el || el.disabled) return;
  Sound.play('tap');
  if (el.hasAttribute('data-close')) return closeOverlay();
  const fn = ovState && ovState.actions && ovState.actions[el.dataset.act]; if (fn) fn(el);
});
$('#ov-card').addEventListener('change', e => { if (ovState && ovState.onChange) ovState.onChange(e.target); });
$('#ov-card').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'name-in' && ovState && ovState.actions.ok) ovState.actions.ok(); });

/* One press = one step, however long the button is held (holding used to repeat and overshoot onto the next tile). */
$$('.dbtn').forEach(b => {
  const [dx, dy] = b.dataset.move.split(',').map(Number);
  b.addEventListener('pointerdown', e => { e.preventDefault(); stopWalk(); b.classList.add('pressed'); tryMove(dx, dy); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => b.classList.remove('pressed')));
});
/* Tap a tile: the hero walks all the way to it (stopping short of monsters and footprints). Tap the hero: chomp. */
let walkTimer = null;
function stopWalk() { clearTimeout(walkTimer); walkTimer = null; showGoal(null); }
/* a glowing square on the tile she tapped, until the hero gets there (or stops) */
function showGoal(x, y) {
  const g = $('#goal'); if (!g) return;
  if (x == null) { g.hidden = true; return; }
  g.style.transform = `translate(${x * 100}%,${y * 100}%)`; g.hidden = false;
}
function dangerAt(x, y) { return (room.monsters || []).some(m => !(m.dizzy > 0) && ((m.x === x && m.y === y) || (m.next && m.next.x === x && m.next.y === y))); }
function pathTo(gx, gy) {
  const prev = { [key(hero.x, hero.y)]: null }, q = [[hero.x, hero.y]];
  while (q.length) {
    const [x, y] = q.shift(); if (x === gx && y === gy) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      const mm = inGrid(nx, ny) && monsterAt(nx, ny);
      if (!inGrid(nx, ny) || k in prev || (mm && !(nx === gx && ny === gy))) continue;   // a monster she tapped: walk up to it (bonk or squash)
      prev[k] = [x, y]; q.push([nx, ny]);
    }
  }
  if (!(key(gx, gy) in prev)) return null;
  const path = []; let c = [gx, gy];
  while (prev[key(...c)]) { path.unshift(c); c = prev[key(...c)]; }
  return path;
}
function walkTo(gx, gy) {
  stopWalk();
  const step = () => {
    walkTimer = null;
    if (blocked() || (hero.x === gx && hero.y === gy)) return showGoal(null);
    const path = pathTo(gx, gy);
    if (!path || !path.length) { Sound.play('bump'); return showGoal(null); }
    const [nx, ny] = path[0];
    const fightIt = nx === gx && ny === gy && monsterAt(nx, ny);                      // the monster she tapped: walk into it
    if (dangerAt(nx, ny) && !fightIt) { nudgeHero(nx - hero.x, ny - hero.y); Sound.play('bump'); return showGoal(null); }   // never walk into danger on its own
    if (path.length > 1) showGoal(gx, gy);
    const from = key(hero.x, hero.y); tryMove(nx - hero.x, ny - hero.y);
    if (key(hero.x, hero.y) !== from && (hero.x !== gx || hero.y !== gy)) walkTimer = setTimeout(step, 170); else showGoal(null);
  };
  step();
}
const cb = $('#btn-chomp');
cb.addEventListener('pointerdown', e => { e.preventDefault(); stopWalk(); cb.classList.add('pressed'); chomp(); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => cb.addEventListener(ev, () => cb.classList.remove('pressed')));
$('#btn-glow').addEventListener('click', useGlow);
$('#btn-say').addEventListener('click', () => Voice.say(ruleInfo().say));
$('#btn-pause').addEventListener('click', () => { if (!overlayOpen() && run && !run.over) openPause(); });
$('#peek').addEventListener('click', e => { if (e.target.closest('[data-say]')) { const t = tileAt(hero.x, hero.y); if (t) Voice.say(t.label); } });
$$('.door').forEach(d => d.addEventListener('click', () => {
  if (blocked() || !room.doors[d.dataset.dir]) return;
  if (room.cleared) goThrough(d.dataset.dir); else nudgeLocked();
}));
let ptr = null;
$('#stage').addEventListener('pointerdown', e => { ptr = e.target.closest('.door') ? null : { x: e.clientX, y: e.clientY }; });
$('#stage').addEventListener('pointerup', e => {
  if (!ptr || blocked()) { ptr = null; return; }
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y, p = ptr; ptr = null;
  if (Math.hypot(dx, dy) > 30) { stopWalk(); Math.abs(dx) > Math.abs(dy) ? tryMove(Math.sign(dx), 0) : tryMove(0, Math.sign(dy)); return; }
  const r = $('#grid').getBoundingClientRect(), c = r.width / 5;
  const cx = Math.floor((p.x - r.left) / c), cy = Math.floor((p.y - r.top) / c);
  if (cx < 0 || cy < 0 || cx > 4 || cy > 4) return;
  if (cx === hero.x && cy === hero.y) { stopWalk(); return chomp(); }
  walkTo(cx, cy);
});
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (!$('#scr-game').classList.contains('active')) return;
  if (overlayOpen()) { if (e.key === 'Escape' && ovState && !ovState.cls) { /* keep explicit */ } return; }
  const k = e.key, mv = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] }[k];
  if (mv) { e.preventDefault(); tryMove(...mv); }
  else if (k === ' ' || k === 'Enter') { e.preventDefault(); chomp(); }
  else if (k === 'f') useGlow();
  else if (k === 'Escape') openPause();
});
$('#btn-play').addEventListener('click', () => {
  const go = () => save.name ? newRun() : askName(newRun);
  if (save.run) openOverlay(`<h2>Start a new run?</h2><p>Your saved run on floor ${save.run.floor} will end. Your stars stay.</p><div class="stack"><button class="btn mint big" data-act="yes">New run</button><button class="btn" data-close>Keep my run</button></div>`, { actions: { yes: () => { closeOverlay(); save.run = null; persist(); go(); } } });
  else go();
});
$('#btn-continue').addEventListener('click', () => { if (save.run) continueRun(); });
$('#btn-closet').addEventListener('click', () => openCloset());
(() => {
  const b = $('#btn-grownups'); let t = null;
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('holding'); t = setTimeout(() => { b.classList.remove('holding'); openGrownups(); }, 1400); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { clearTimeout(t); b.classList.remove('holding'); }));
})();
window.addEventListener('resize', () => { fit(); if (run && room) renderMap(); });
if (window.ResizeObserver) new ResizeObserver(() => fit()).observe($('#stage'));
document.addEventListener('visibilitychange', () => { if (document.hidden && Intro.playing) Intro.done();   // leaving mid-intro: come back to the title
  if (document.hidden) { tickTime(); Voice.stop(); saveRun(); persist(); Sound.pause(); } else { if (Sound.ctx) Sound.wake(false); if (run) run.tick = Date.now(); } });

window.DD = { get run() { return run; }, get room() { return room; }, get hero() { return hero; }, get save() { return save; }, tryMove, chomp, goThrough, enterRoom, bossPick, bossAnswer, trapdoor, takeItem, openShop, buy, closeOverlay, newRun, endRun, planMonsters };
/* Zoom guard. A double-tap or two-finger pinch can zoom Safari in, and the game screen (which blocks browser
   gestures so taps feel instant) then can't be pinched back out. So zoom gestures are blocked while the page is at
   normal size; if it does end up zoomed, pinching is allowed again and the page snaps back to normal on its own. */
const ZoomGuard = {
  vp: null, base: '', flip: false, timer: null, tries: 0, down: 0,
  scale() { return window.visualViewport ? visualViewport.scale : 1; },
  zoomed() { return this.scale() > 1.02; },
  init() {
    this.vp = document.querySelector('meta[name=viewport]'); this.base = this.vp ? this.vp.content : '';
    const block = e => { if (!this.zoomed()) e.preventDefault(); };
    ['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, block, { passive: false }));
    document.addEventListener('touchmove', e => { if (e.touches.length > 1) block(e); }, { passive: false });
    document.addEventListener('touchstart', e => { this.down = e.touches.length; }, { passive: true, capture: true });
    ['touchend', 'touchcancel'].forEach(ev => document.addEventListener(ev, e => { this.down = e.touches.length; this.check(); }, { passive: true, capture: true }));
    if (window.visualViewport) visualViewport.addEventListener('resize', () => this.check());
  },
  check() {
    const z = this.zoomed(); document.body.classList.toggle('zoomed', z);
    clearTimeout(this.timer); this.timer = null;
    if (!z) { this.tries = 0; return; }
    if (this.tries < 3) this.timer = setTimeout(() => this.reset(), 700);
  },
  reset() {     // re-applying the viewport makes Safari drop back to normal size
    if (!this.zoomed() || !this.vp) return;
    if (this.down) { this.timer = setTimeout(() => this.reset(), 400); return; }   // wait for fingers to lift
    this.tries++; this.flip = !this.flip;
    this.vp.content = this.base + (this.flip ? ',minimum-scale=1' : '');
    window.scrollTo(0, 0);
    setTimeout(() => this.check(), 450);
  },
};
document.addEventListener('DOMContentLoaded', () => { ZoomGuard.init();
  if (!save.seen) save.seen = [...save.unlocks];   // first time with the bigger Closet: what she had before isn't NEW
  checkUnlocks(true); persist();
  Clips.init(); Music.init(); if (!Intro.show()) showTitle(); else { $('#title-hero').innerHTML = heroSVG(); } loadArt().then(() => { if ($('#scr-title').classList.contains('active')) $('#title-hero').innerHTML = heroSVG(); else if (run && room) { fit(); clearActors(); renderAll(); } }); });
