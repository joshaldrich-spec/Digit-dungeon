'use strict';
/* Digit Dungeon · ui.js: Overlays, coaching card, title, closet, grown-ups panel, input, start-up. */

/* ---------- overlays, toasts, banners ---------- */
function openOverlay(html, o = {}) {
  const card = $('#ov-card'); card.className = 'card ' + (o.cls || ''); card.innerHTML = html; card.scrollTop = 0;
  $('#ov').classList.add('show'); ovState = o;
  $('#banner').classList.remove('show');
}
function closeOverlay() { $('#ov').classList.remove('show'); const cb = ovState && ovState.onClose; ovState = null; if (run) run.tick = Date.now(); if (cb) cb(); }
const toasts = []; let toasting = false;
function toast(m) { toasts.push(m); if (!toasting) nextToast(); }
function nextToast() {
  const m = toasts.shift(); if (!m) { toasting = false; return; }
  toasting = true; const el = $('#toast'); el.textContent = m; el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); setTimeout(nextToast, 260); }, 1900);
}
let bannerT = null;
function banner(icon, title, sub) {
  const b = $('#banner'); b.innerHTML = `<div class="bx"><div class="bi">${icon}</div><div class="bt">${esc(title)}</div><div class="bs">${esc(sub || '')}</div></div>`;
  b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), 1700);
}
function confetti() {
  const fx = $('#fx'), bits = ['⭐', '✨', '🎉', '🪙', '💖'];
  for (let i = 0; i < 36; i++) { const s = document.createElement('span'); s.className = 'conf'; s.textContent = pick(bits); s.style.left = Math.random() * 100 + 'vw'; s.style.animationDuration = (1.6 + Math.random() * 1.6) + 's'; s.style.animationDelay = Math.random() * .6 + 's'; fx.appendChild(s); setTimeout(() => s.remove(), 4000); }
}
function showCoach(rule, t, after) {
  const c = coachContent(rule, t);
  openOverlay(`<div class="coach-head"><button class="say" data-act="say" aria-label="Hear it again">🔊</button><h2 class="coach-title">${c.title}</h2></div>
    <div class="model"><div class="paper">${c.model}</div></div>
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
    <button class="btn" data-act="home">💾 Save &amp; go home</button></div>`,
    { actions: { voice: () => { save.settings.voice = !save.settings.voice; persist(); openPause(); }, sound: () => { save.settings.sound = !save.settings.sound; persist(); openPause(); },
      home: () => { saveRun(); closeOverlay(); showTitle(); } } });
}

/* ---------- title, name, closet ---------- */
function showTitle() {
  Voice.stop(); run = null; showScreen('title');
  $('#title-hero').innerHTML = heroSVG();
  $('#title-name').textContent = save.name ? `${save.name}'s adventure` : '';
  const bits = [`⭐ ${save.stars} stars`]; if (save.best.floor) bits.push(`best: floor ${save.best.floor}`); if (save.best.wins) bits.push(`🏆 ×${save.best.wins}`);
  $('#title-stats').textContent = bits.join(' · ');
  $('#btn-continue').hidden = !save.run; if (save.run) $('#btn-continue').textContent = `▶ Continue (floor ${save.run.floor})`;
}
function askName(then) {
  openOverlay(`<h2>Name your hero!</h2><div class="name-hero">${heroSVG()}</div><input class="name-in" id="name-in" maxlength="14" placeholder="Hero name" autocomplete="off" autocapitalize="words" value="${esc(save.name)}"><br><button class="btn mint big" data-act="ok">Let's go!</button>`,
    { actions: { ok: () => { save.name = ($('#name-in').value.trim() || 'Hero').slice(0, 14); persist(); closeOverlay(); then && then(); } } });
  Voice.say('Name your hero!');
  setTimeout(() => { const i = $('#name-in'); if (i) i.focus(); }, 120);
}
function openCloset() {
  const sw = Object.entries(COLORS).map(([k, c]) => { const lock = save.stars < c.need;
    return `<button class="sw ${save.cosmetics.color === k ? 'sel' : ''}" data-act="color" data-k="${k}" ${lock ? 'disabled' : ''}><span class="dot" style="background:${c.c}"></span>${lock ? `🔒 ${c.need}⭐` : c.name}</button>`; }).join('');
  const hats = Object.entries(HATS).map(([k, h]) => { const lock = save.stars < h.need;
    return `<button class="sw ${save.cosmetics.hat === k ? 'sel' : ''}" data-act="hat" data-k="${k}" ${lock ? 'disabled' : ''}><svg viewBox="16 -2 68 38">${k === 'none' ? '<text x="50" y="26" text-anchor="middle" font-size="22" fill="#bfaed8">—</text>' : hatSVG(k)}</svg>${lock ? `🔒 ${h.need}⭐` : h.name}</button>`; }).join('');
  openOverlay(`<h2>👕 Closet</h2><div class="closet-hero">${heroSVG()}</div><p class="sub">⭐ ${save.stars} stars · earn more by chomping!</p><h3>Colors</h3><div class="swatches">${sw}</div><h3>Hats</h3><div class="swatches">${hats}</div><div class="stack"><button class="btn mint" data-close>Done</button></div>`,
    { actions: { color: el => { save.cosmetics.color = el.dataset.k; persist(); openCloset(); }, hat: el => { save.cosmetics.hat = el.dataset.k; persist(); openCloset(); } },
      onClose: () => $('#title-hero').innerHTML = heroSVG() });
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
    ${tg('mistakes', 'Mistakes cost ½ heart', 'Off = gentle mode: wrong answers only coach')}
    ${tg('monsters', 'Monsters', 'Off = calm rooms with no wandering monsters')}
    ${tg('readTiles', 'Read each tile when stepped on', 'Extra support for early readers')}
    <h3>Skills in the mix</h3>${Object.keys(SKILLS).map(stg).join('')}
    <h3>How it teaches</h3><ul>
      <li>Uses Bridges' own models: ten-frames, the number rack, pairs, and number paths.</li>
      <li>No reading to get started: the first room is three easy matches, and rules, facts and coaching are all read aloud.</li>
      <li>Every mistake gets a picture and a named strategy (doubles, make ten, count on, think addition). It cracks half a heart, and her next right answer mends it.</li>
      <li>Mistakes come back: one is shown on the run-over screen, the next run starts with a room built around it, and getting it right is celebrated.</li>
      <li>No timers. Monsters only move when she walks, footprints show exactly where they'll step, and right answers make them dizzy.</li>
      <li>Adapts: a skill levels up at 90%+ and eases off below 60%. Rooms mix skills and favor her weaker ones.</li>
      <li>Stars are always kept, even when a run ends.</li></ul>
    <div class="stack"><button class="btn mint" data-close>Done</button><button class="btn small ghost" data-act="reset">Reset all progress</button></div></div>`,
    { actions: { reset: el => { if (!el.dataset.armed) { el.dataset.armed = 1; el.textContent = 'Tap again to erase everything'; el.style.color = 'var(--red)'; return; }
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {} save = defaultSave(); persist(); closeOverlay(); showTitle(); } },
      onChange: inp => { if (inp.dataset.set) save.settings[inp.dataset.set] = inp.checked; if (inp.dataset.skill) save.settings.skills[inp.dataset.skill] = inp.checked; persist(); } });
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

$$('.dbtn').forEach(b => {
  let rep = null, hold = null;
  const [dx, dy] = b.dataset.move.split(',').map(Number);
  const stop = () => { clearTimeout(hold); clearInterval(rep); b.classList.remove('pressed'); };
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('pressed'); tryMove(dx, dy); hold = setTimeout(() => rep = setInterval(() => tryMove(dx, dy), 210), 380); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
});
const cb = $('#btn-chomp');
cb.addEventListener('pointerdown', e => { e.preventDefault(); cb.classList.add('pressed'); chomp(); });
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
  if (Math.hypot(dx, dy) > 30) { Math.abs(dx) > Math.abs(dy) ? tryMove(Math.sign(dx), 0) : tryMove(0, Math.sign(dy)); return; }
  const r = $('#grid').getBoundingClientRect(), c = r.width / 5;
  const cx = Math.floor((p.x - r.left) / c), cy = Math.floor((p.y - r.top) / c);
  if (cx < 0 || cy < 0 || cx > 4 || cy > 4) return;
  const ddx = cx - hero.x, ddy = cy - hero.y; if (!ddx && !ddy) return chomp();
  Math.abs(ddx) >= Math.abs(ddy) ? tryMove(Math.sign(ddx), 0) : tryMove(0, Math.sign(ddy));
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
$('#btn-closet').addEventListener('click', openCloset);
(() => {
  const b = $('#btn-grownups'); let t = null;
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('holding'); t = setTimeout(() => { b.classList.remove('holding'); openGrownups(); }, 1400); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { clearTimeout(t); b.classList.remove('holding'); }));
})();
window.addEventListener('resize', () => { fit(); if (run && room) renderMap(); });
if (window.ResizeObserver) new ResizeObserver(() => fit()).observe($('#stage'));
document.addEventListener('visibilitychange', () => { if (document.hidden) { tickTime(); Voice.stop(); saveRun(); persist(); } else if (run) run.tick = Date.now(); });

window.DD = { get run() { return run; }, get room() { return room; }, get hero() { return hero; }, get save() { return save; }, tryMove, chomp, goThrough, enterRoom, bossPick, bossAnswer, trapdoor, takeItem, openShop, buy, closeOverlay, newRun, endRun, planMonsters };
document.addEventListener('DOMContentLoaded', () => { Clips.init(); showTitle(); loadArt().then(() => { if ($('#scr-title').classList.contains('active')) $('#title-hero').innerHTML = heroSVG(); }); });
