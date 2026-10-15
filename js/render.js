'use strict';
/* Digit Dungeon · render.js: Drawing the room, HUD, actors, footprints, peek panel, minimap. */

/* =====================================================================
   RENDERING
   ===================================================================== */
function showScreen(n) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('#scr-' + n).classList.add('active');
  if (n === 'game') requestAnimationFrame(fit);
}
function fit() {
  const st = $('#stage'); if (!st || !st.clientWidth) return;
  const c = Math.floor(clamp(Math.min(st.clientWidth / 5.84, st.clientHeight / 5.84), 36, 128));
  document.documentElement.style.setProperty('--cell', c + 'px');
}
function renderAll() { renderHUD(); renderRule(); renderGrid(); renderDoors(); renderRoomMsg(); renderActors(true); renderTelegraph(); renderPeek(); renderMap(); }
function heartsHTML() {
  let h = ''; const crackAt = run.crack ? run.hearts : -1;   // the half-heart a mistake cracked (mends on the next right answer)
  for (let i = 0; i < run.maxHearts / 2; i++) h += heartSVG(clamp(run.hearts - i * 2, 0, 2), crackAt >= i * 2 && crackAt < i * 2 + 2 ? (crackAt % 2 ? 'R' : 'L') : null);
  return h;
}
function heartFx() { const h = $('#hearts'); h.classList.remove('thump'); void h.offsetWidth; h.classList.add('thump'); }
function renderHUD() {
  $('#hearts').innerHTML = heartsHTML() + (run.shield ? '<span class="shield">🫧</span>' : '');
  $('#coins').textContent = `🪙 ${run.coins}`;
  $('#stars').textContent = `⭐ ${save.stars}`;
  $('#items').innerHTML = run.items.map(id => `<span title="${esc(ITEMS[id].name)}">${ITEMS[id].icon}</span>`).join('');
  const g = $('#btn-glow'); g.hidden = !(run.glow > 0 && room && room.type === 'normal' && !room.cleared); g.innerHTML = `🔦<small>×${run.glow}</small>`;
}
function ruleInfo() {
  const r = room;
  if (r.type === 'normal' && r.rule) return r.cleared ? { small: 'Room cleared!', title: 'Pick a door ➜', say: 'Room cleared! Pick a door.' }
    : { small: r.special === 'lesson' ? 'Chomp' : r.rule.comeback ? '🔁 Comeback' : `Chomp <span class="lv">${SKILLS[r.rule.skill].short} · Lv ${r.rule.level}</span>`, title: r.rule.title, say: r.rule.speak };
  if (r.type === 'start') return { small: `Floor ${run.floor} · ${FLOOR_NAMES[run.floor - 1]}`, title: 'Pick a door ➜', say: 'Pick a door!' };
  if (r.type === 'treasure') return { small: 'Treasure room', title: r.taken ? 'Pick a door ➜' : 'Step on the chest!', say: r.taken ? 'Pick a door.' : 'Step on the treasure chest!' };
  if (r.type === 'shop') return { small: 'Shop', title: 'Step on Hoot to shop', say: 'Step on Hoot the owl to shop.' };
  if (r.type === 'boss') return r.cleared ? { small: 'Boss beaten!', title: 'Step on the trapdoor!', say: 'Step on the trapdoor!' } : { small: 'Boss', title: BOSSES[run.floor - 1].name, say: BOSSES[run.floor - 1].name };
  return { small: '', title: '', say: '' };
}
function renderRule() {
  const i = ruleInfo();
  $('#rule-small').innerHTML = i.small; $('#rule-title').textContent = i.title;
  $('#pips').innerHTML = room.type === 'normal' && room.tiles ? room.tiles.filter(t => t.correct).map(t => `<span class="pip ${t.chomped ? 'on' : ''}"></span>`).join('') : '';
}
function tileHTML(t) {
  if (t.chomped) return '<div class="crumbs"></div>';
  let cls = 'tile', inner;
  if (t.kind === 'frame') { cls += ' frame'; inner = framesSVG(t.segs, { cell: 10, frames: t.frames }); }
  else { const n = t.label.replace(/ /g, '').length; cls += n >= 5 ? ' e5' : n === 4 ? ' e4' : n === 3 && t.kind === 'fact' ? ' e3' : ''; inner = show(t.label); }
  if (t.missed) { cls += ' missed'; inner += `<span class="rv">${t.kind === 'num' ? '' : '=' + t.value}</span>`; }
  if (t.glow) cls += ' glow';
  if (room.cleared && !t.correct) cls += ' faded';
  return `<div class="${cls}">${inner}</div>`;
}
function renderGrid() {
  let h = '';
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { const t = tileAt(x, y); h += `<div class="cell" data-x="${x}" data-y="${y}">${t ? tileHTML(t) : ''}</div>`; }
  $('#grid').innerHTML = h;
}
function updateCell(t) { const c = $(`#grid .cell[data-x="${t.x}"][data-y="${t.y}"]`); if (c) c.innerHTML = tileHTML(t); }
function renderDoors() {
  ['n', 'e', 's', 'w'].forEach(d => {
    const el = $('#door-' + d);
    if (!room.doors[d]) { el.className = `door ${d} none`; el.innerHTML = ''; return; }
    const nb = neighbor(room, d);
    const icon = nb.type === 'treasure' ? '👑' : nb.type === 'shop' ? '🛒' : nb.type === 'boss' ? '⚔️' : '';
    el.className = `door ${d} ${room.cleared ? 'open' : 'closed'} ${nb.type}`;
    el.innerHTML = icon;
  });
}
function renderRoomMsg() { $('#room-msg').innerHTML = ''; }
const actorEls = new Map();
function clearActors() { actorEls.forEach(el => el.remove()); actorEls.clear(); }
function renderActors(instant) {
  const layer = $('#actors'), want = [];
  if (room.type === 'treasure' && !room.taken) want.push({ id: 'chest', x: 2, y: 2, cls: 'prop', html: chestSVG });
  if (room.type === 'shop') want.push({ id: 'owl', x: 2, y: 2, cls: 'prop', html: owlSVG });
  if (room.type === 'boss' && room.cleared) want.push({ id: 'trap', x: 2, y: 2, cls: 'prop trap', html: trapSVG });
  (room.pickups || []).forEach(p => { const t = tileAt(p.x, p.y); want.push({ id: 'p' + p.id, x: p.x, y: p.y, cls: 'pickup' + (t && !t.chomped ? ' corner' : ''), html: p.type === 'coin' ? coinSVG : heartPickupSVG }); });
  (room.monsters || []).forEach(m => want.push({ id: m.id, x: m.x + (m.lunge ? m.lunge[0] * .45 : 0), y: m.y + (m.lunge ? m.lunge[1] * .45 : 0),
    cls: `monster ${m.kind}${m.dizzy > 0 ? ' dizzy' : ''}${m.kind === 'wisp' && m.dir && m.dir[0] < 0 ? ' left' : ''}`, html: m.kind === 'wisp' ? wispSVG : grumbleSVG }));
  want.push({ id: 'hero', x: hero.x, y: hero.y, cls: 'hero' + (hero.safe > 0 ? ' safe' : '') + (hero.face === 'left' ? ' left' : ''), html: () => heroSVG() });
  for (const [id, el] of actorEls) if (!want.some(w => w.id === id)) { el.remove(); actorEls.delete(id); }
  want.forEach(w => {
    let el = actorEls.get(w.id), fresh = false;
    if (!el) { el = document.createElement('div'); el.innerHTML = `<div class="spr">${w.html()}</div>`; layer.appendChild(el); actorEls.set(w.id, el); fresh = true; }
    const keep = ['hurt', 'chomping', 'bump', 'warn'].filter(c => el.classList.contains(c));
    el.className = ['actor', w.cls, ...keep].join(' ');
    if (instant || fresh) el.style.transition = 'none';
    el.style.transform = `translate(${w.x * 100}%,${w.y * 100}%)`;
    if (instant || fresh) { void el.offsetWidth; el.style.transition = ''; }
  });
}
function chompAnim() {
  const el = actorEls.get('hero'); if (!el) return;
  const spr = el.querySelector('.spr'); spr.innerHTML = heroSVG(undefined, undefined, true);
  el.classList.remove('chomping'); void el.offsetWidth; el.classList.add('chomping');
  setTimeout(() => { spr.innerHTML = heroSVG(); el.classList.remove('chomping'); }, 240);
}
function floatAt(x, y, text, cls = '', dy = 0) {
  const f = document.createElement('div'); f.className = 'float ' + cls; f.textContent = text;
  f.style.left = `calc(var(--cell) * ${x + .5})`; f.style.top = `calc(var(--cell) * ${y - dy * .4})`;
  $('#actors').appendChild(f); setTimeout(() => f.remove(), 950);
}
function poofAt(x, y, ch = '💨') {
  const f = document.createElement('div'); f.className = 'poof'; f.textContent = ch;
  f.style.left = `calc(var(--cell) * ${x})`; f.style.top = `calc(var(--cell) * ${y})`;
  $('#actors').appendChild(f); setTimeout(() => f.remove(), 550);
}
function pawSVG(c) {
  const paw = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})" fill="${c}"><ellipse rx="9" ry="10.5"/><circle cx="-10" cy="-13" r="4"/><circle cx="-3.5" cy="-18.5" r="4"/><circle cx="3.5" cy="-18.5" r="4"/><circle cx="10" cy="-13" r="4"/></g>`;
  return `<svg viewBox="0 0 100 100">${paw(33, 70, -8)}${paw(67, 40, 8)}</svg>`;
}
/* footprints: exactly where each monster steps when she next walks */
function renderTelegraph() {
  const layer = $('#marks'); if (!layer || !room) return;
  let h = '';
  if (room.type === 'normal' && !room.cleared) (room.monsters || []).forEach(m => {
    if (!m.next) return;
    const dx = m.next.x - m.x, dy = m.next.y - m.y, ang = dx > 0 ? 90 : dx < 0 ? -90 : dy > 0 ? 180 : 0;
    const danger = Math.abs(m.next.x - hero.x) + Math.abs(m.next.y - hero.y) === 1;   // she could step here next
    const t = tileAt(m.next.x, m.next.y), onTile = t && !t.chomped;
    h += `<div class="mark ${m.kind}${danger ? ' danger' : ''}${onTile ? ' on-tile' : ''}" style="transform:translate(${m.next.x * 100}%,${m.next.y * 100}%)"><div class="ring"></div><div class="paw" style="transform:rotate(${ang}deg)">${pawSVG(danger ? '#ff5a6e' : m.kind === 'wisp' ? '#d9c8ff' : '#ffb08a')}</div></div>`;
  });
  layer.innerHTML = h;
}
function renderPeek() {
  const p = $('#peek'), t = tileAt(hero.x, hero.y);
  if (room.type !== 'normal' || !room.rule || room.cleared) { p.innerHTML = `<div class="peek-icon">${room.type === 'shop' ? '🦉' : room.type === 'treasure' ? '👑' : room.type === 'boss' ? '⚔️' : '🚪'}</div>`; return; }
  if (!t || t.chomped) { p.innerHTML = `<div class="peek-goal">🎯 ${esc(room.rule.title)}</div>`; return; }
  const item = PEEK_ITEM[room.rule.skill], has = run.items.includes(item);
  const label = t.kind === 'frame' ? framesSVG(t.segs, { cell: 10, frames: t.frames }) : show(t.label);
  const model = has ? `<div class="paper">${modelFor(room.rule, t, false)}</div>` : `<div class="peek-lock">🔒 ${ITEMS[item].icon}</div>`;
  p.innerHTML = `${t.kind === 'frame' ? '' : `<button class="peek-say" data-say="1" aria-label="Read tile">🔊</button>`}<div class="peek-label">${label}</div><div class="peek-model">${model}</div>`;
}
function renderMap() {
  const rooms = Object.values(run.map.rooms).filter(r => r.known || r.visited);
  const xs = rooms.map(r => r.x), ys = rooms.map(r => r.y), minX = Math.min(...xs), minY = Math.min(...ys);
  const S = 16, W = (Math.max(...xs) - minX + 1) * S, H = (Math.max(...ys) - minY + 1) * S;
  const box = $('#minimap'), bw = box.clientWidth - 14, bh = box.clientHeight - 14;
  const sc = bw > 0 && bh > 0 ? clamp(Math.min(bw / W, bh / H), .4, 1.8) : 1;
  box.innerHTML = `<div class="mm" style="width:${W}px;height:${H}px;transform:scale(${sc})">${rooms.map(r => {
    const cur = r === room, ic = r.type === 'treasure' ? '👑' : r.type === 'shop' ? '🛒' : r.type === 'boss' ? '⚔️' : '';
    return `<div class="mmr ${cur ? 'cur' : r.visited ? 'vis' : 'kn'}" style="left:${(r.x - minX) * S}px;top:${(r.y - minY) * S}px;width:${S - 3}px;height:${S - 3}px">${ic && !cur ? `<i>${ic}</i>` : ''}</div>`;
  }).join('')}</div>`;
}
