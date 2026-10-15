'use strict';
/* Digit Dungeon · art.js: Sprite files, built-in fallback drawings, and the exact math pictures (ten-frames, pairs, paths, rack). */

/* ---------- ART ----------------------------------------------------
   Sprites live in art/ as .webp files with backgrounds removed.
   Any file that is missing or fails to load falls back to the built-in
   drawing below. hero / heroChomp have one image per Closet color.
---------------------------------------------------------------------- */
const HERO_COLORS = ['mint', 'sky', 'peach', 'grape', 'pink', 'gold'];
const ART = {
  hero: Object.fromEntries(HERO_COLORS.map(c => [c, `art/hero/${c}.webp`])),
  heroChomp: Object.fromEntries(HERO_COLORS.map(c => [c, `art/hero/${c}-chomp.webp`])),
  heroOuch: Object.fromEntries(HERO_COLORS.map(c => [c, `art/hero/${c}-ouch.webp`])),
  heroCheer: Object.fromEntries(HERO_COLORS.map(c => [c, `art/hero/${c}-cheer.webp`])),
  heroSad: Object.fromEntries(HERO_COLORS.map(c => [c, `art/hero/${c}-sad.webp`])),
  chestOpen: 'art/chest-open.webp',
  items: Object.fromEntries(['specs', 'socks', 'frog', 'heart', 'clover', 'snail', 'bubble', 'flashlight'].map(k => [k, `art/items/${k}.webp`])),
  hats: Object.fromEntries(['bow', 'party', 'crown', 'wizard', 'viking'].map(k => [k, `art/hats/${k}.webp`])),
  ui: { star: 'art/ui/star.webp', trophy: 'art/ui/trophy.webp', brain: 'art/ui/brain.webp', tile: 'art/ui/tile.webp' },
  dungeon: { floor1: 'art/dungeon/floor-1.webp', floor2: 'art/dungeon/floor-2.webp', floor3: 'art/dungeon/floor-3.webp',
             doorClosed: 'art/dungeon/door-closed.webp', doorOpen: 'art/dungeon/door-open.webp' },
  wisp: 'art/wisp.webp', grumble: 'art/grumble.webp',
  boss1: 'art/boss1.webp', boss2: 'art/boss2.webp', boss3: 'art/boss3.webp',
  coin: 'art/coin.webp', heart: 'art/heart.webp', chest: 'art/chest.webp',
  shopkeeper: 'art/shopkeeper.webp', trapdoor: 'art/trapdoor.webp',
  title: 'art/title.webp',   // title screen picture (shown by index.html + css; listed here so it preloads)
  icons: files('icons', ['speaker', 'mute', 'pause', 'music', 'music-off', 'home', 'lock', 'target', 'arrow', 'swords', 'bag', 'gift', 'shirt', 'bulb', 'comeback', 'gear']),
  fx: files('fx', ['flame', 'popper', 'sparkles', 'zap', 'snip', 'moon', 'bomb', 'burst', 'smoke', 'dizzy', 'up', 'down', 'candle', 'paws', 'gem-empty', 'gem']),
  math: files('math', ['heart', 'heart-empty', 'heart-crack', 'counter-red', 'counter-blue', 'board', 'bead-red', 'bead-cream', 'rack']),
  props: files('props', ['pillar', 'torch', 'barrel', 'heap', 'coins', 'boulder', 'rocks', 'grass', 'arch', 'slab']),
  // used only by css/skin.css (listed so they preload; the skin switches on when they all load)
  skin: Object.assign(files('bg', ['wall', 'room', 'brick', 'cobble']), files('panels', ['tablet', 'sign', 'frame', 'plaque', 'bubble', 'ribbon', 'parchment', 'card', 'ring']),
                      files('buttons', ['chomp', 'dpad', 'square', 'gold', 'green', 'purple'])),
};
ART.ui.logo = 'art/ui/logo.webp?' + BUILD;   // versioned so iPads drop the old cut
function files(dir, names) { return Object.fromEntries(names.map(n => [dir + ':' + n, `art/${dir}/${n}.webp`]).map(([k, v]) => [k.split(':')[1].replace(/-(\w)/g, (_, c) => c.toUpperCase()), v])); }
/* geometry measured from the art by tools/cut_ui.py (art/math/layout.json) */
const BOARD = { x0: 0.0725, x1: 0.925, y0: 0.1298, y1: 0.7981, aspect: 1.9231 };
const RACK = { rods: [0.218, 0.743] };   // rod heights inside the rack's opening
/* emoji in any message become the matching art (falls back to the emoji if that art is missing) */
const EMOJI_ART = () => {
  const I = ART.icons || {}, F = ART.fx || {}, U = ART.ui || {}, T = ART.items || {}, M = ART.math || {};
  return { '⭐': U.star, '🪙': ART.coin, '🔊': I.speaker, '🔇': I.mute, '⏸': I.pause, '🎵': I.music, '🎶': I.music, '🔕': I.musicOff, '💾': I.home, '🏠': I.home,
    '🔒': I.lock, '🎯': I.target, '➜': I.arrow, '▶': I.arrow, '⚔': I.swords, '🛒': I.bag, '🎁': I.gift, '👕': I.shirt, '💡': I.bulb, '🔁': I.comeback, '⚙': I.gear,
    '🔥': F.flame, '🎉': F.popper, '✨': F.sparkles, '⚡': F.zap, '✂': F.snip, '🌗': F.moon, '💣': F.bomb, '💥': F.burst, '💨': F.smoke, '💫': F.dizzy,
    '⬆': F.up, '⬇': F.down, '🕯': F.candle, '❤': M.heart, '💖': T.heart, '🧠': U.brain, '🏆': U.trophy, '🏅': U.star, '👑': ART.chest, '🦉': ART.shopkeeper,
    '🫧': T.bubble, '🔦': T.flashlight, '🥽': T.specs, '🧦': T.socks, '🐸': T.frog, '🍀': T.clover, '🐌': T.snail, '🚪': ART.props && ART.props.arch };
};
const EMOJI_RE = /(⭐|🪙|🔊|🔇|⏸|🎵|🎶|🔕|💾|🏠|🔒|🎯|➜|▶|⚔|🛒|🎁|👕|💡|🔁|⚙|🔥|🎉|✨|⚡|✂|🌗|💣|💥|💨|💫|⬆|⬇|🕯|❤|💖|🧠|🏆|🏅|👑|🦉|🫧|🔦|🥽|🧦|🐸|🍀|🐌|🚪)️?/gu;
function artify(html) {
  if (typeof html !== 'string') return html;
  const map = EMOJI_ART();
  return html.replace(EMOJI_RE, (m, e) => (map[e] ? `<img class="ei" src="${map[e]}" alt="" draggable="false">` : m));
}
/* preload every sprite; forget any that fail so the drawing is used instead */
function loadArt() {
  const jobs = [];
  const check = (obj, k) => jobs.push(new Promise(res => { const im = new Image(); im.onload = res; im.onerror = () => { delete obj[k]; res(); }; im.src = obj[k]; }));
  for (const k of Object.keys(ART)) { if (typeof ART[k] === 'string') check(ART, k); else for (const c of Object.keys(ART[k])) check(ART[k], c); }
  return Promise.all(jobs).then(() => { Object.keys(ART).forEach(k => { if (typeof ART[k] === 'object' && !Object.keys(ART[k]).length) delete ART[k]; }); applyArt(); });
}
/* textures (tablets, floors, doors) are CSS backgrounds: switch them on only for files that loaded */
function applyArt() {
  const root = document.documentElement.style, b = document.body.classList, abs = p => `url("${new URL(p, document.baseURI).href}")`;
  const D = ART.dungeon || {}, U = ART.ui || {};
  if (U.tile) { root.setProperty('--tile-img', abs(U.tile)); b.add('has-tile'); }
  if (D.floor1 && D.floor2 && D.floor3) { [1, 2, 3].forEach(i => root.setProperty(`--floor${i}`, abs(D['floor' + i]))); b.add('has-floor'); }
  if (D.doorClosed && D.doorOpen) { root.setProperty('--door-closed', abs(D.doorClosed)); root.setProperty('--door-open', abs(D.doorOpen)); b.add('has-doors'); }
  if (ART.skin && Object.keys(ART.skin).length === 19) b.add('skin');
  if (U.logo) $$('.logo').forEach(l => { l.innerHTML = `<img class="logo-img" src="${U.logo}" alt="Digit Dungeon" draggable="false">`; });
  ['#btn-pause', '#btn-say', '#btn-closet', '#btn-grownups', '#btn-chomp'].forEach(s => { const e = $(s); if (e && !e.dataset.art) { e.dataset.art = 1; e.innerHTML = artify(e.innerHTML); } });
}
const icon = (src, emoji, cls = 'ico') => (src ? `<img class="${cls}" src="${src}" alt="" draggable="false">` : emoji);
const itemIcon = (id, cls) => icon(ART.items && ART.items[id], ITEMS[id] ? ITEMS[id].icon : '', cls);
/* where each hat sits on the hero (percent of the hero box): width, centre x, bottom y, tilt */
const HAT_FIT = { bow: { w: 34, x: 68, y: 31, r: 16 }, party: { w: 30, x: 50, y: 27, r: 0 }, crown: { w: 40, x: 50, y: 28, r: 0 },
                  wizard: { w: 58, x: 50, y: 29, r: -4 }, viking: { w: 66, x: 50, y: 34, r: 0 } };
function hatHTML(k) {
  if (!k || k === 'none') return '';
  if (ART.hats && ART.hats[k]) { const f = HAT_FIT[k]; return `<img class="hat" src="${ART.hats[k]}" alt="" draggable="false" style="width:${f.w}%;left:${f.x}%;top:${f.y}%;transform:translate(-50%,-100%) rotate(${f.r}deg)">`; }
  return `<svg viewBox="0 0 100 100">${hatSVG(k)}</svg>`;
}


/* =====================================================================
   DRAWINGS (fallbacks if an ART_DATA image is missing)
   ===================================================================== */
const COLORS = {
  mint:  { name: 'Mint',  c: '#6fe0b0', d: '#2e9c72', need: 0 },
  sky:   { name: 'Sky',   c: '#79c6ff', d: '#2f7fc0', need: 40 },
  peach: { name: 'Peach', c: '#ffab7a', d: '#d0663a', need: 100 },
  grape: { name: 'Grape', c: '#b48cff', d: '#7448c9', need: 200 },
  pink:  { name: 'Bubblegum', c: '#ff8fc7', d: '#c94f8c', need: 320 },
  gold:  { name: 'Gold',  c: '#ffd54a', d: '#c99a12', need: 500 },
};
const HATS = {
  none:   { name: 'No hat', need: 0 },
  bow:    { name: 'Bow', need: 25 },
  party:  { name: 'Party hat', need: 75 },
  crown:  { name: 'Crown', need: 150 },
  wizard: { name: 'Wizard hat', need: 260 },
  viking: { name: 'Viking helmet', need: 420 },
};
const img = src => `<img src="${src}" alt="" draggable="false" onerror="this.style.visibility='hidden'">`;
function hatSVG(h) {
  switch (h) {
    case 'bow': return `<g transform="translate(66 24) rotate(18)"><path d="M0 0L-15-9V9Z" fill="#ff5d9e" stroke="#c22e6c" stroke-width="2.5" stroke-linejoin="round"/><path d="M0 0L15-9V9Z" fill="#ff5d9e" stroke="#c22e6c" stroke-width="2.5" stroke-linejoin="round"/><circle r="5" fill="#ff8fc0" stroke="#c22e6c" stroke-width="2.5"/></g>`;
    case 'party': return `<path d="M50 3L36 28Q50 32 64 28Z" fill="#79c6ff" stroke="#2f7fc0" stroke-width="2.5" stroke-linejoin="round"/><path d="M45 13L55 17M40 22L60 27" stroke="#ffd54a" stroke-width="3.5"/><circle cx="50" cy="4" r="5" fill="#ff5a6e"/>`;
    case 'crown': return `<path d="M33 29L35 10L43 19L50 5L57 19L65 10L67 29Z" fill="#ffd54a" stroke="#c99a12" stroke-width="2.5" stroke-linejoin="round"/><circle cx="50" cy="22" r="3" fill="#ff5a6e"/>`;
    case 'wizard': return `<path d="M54 0L34 28H68Z" fill="#5b5bd6" stroke="#3a3aa0" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="51" cy="28" rx="24" ry="5" fill="#4646b8" stroke="#3a3aa0" stroke-width="2"/><path d="M51 12l1.6 3.4 3.6.4-2.7 2.4.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.7-2.4 3.6-.4z" fill="#ffd54a"/>`;
    case 'viking': return `<path d="M31 24Q17 20 19 4Q25 17 34 18Z" fill="#fff3da" stroke="#b8a888" stroke-width="2"/><path d="M69 24Q83 20 81 4Q75 17 66 18Z" fill="#fff3da" stroke="#b8a888" stroke-width="2"/><path d="M30 31Q30 11 50 11Q70 11 70 31Z" fill="#b8c2cc" stroke="#6b7785" stroke-width="2.5"/><rect x="29" y="27" width="42" height="6" rx="2" fill="#8a96a3"/>`;
  }
  return '';
}
function heroSVG(colorKey = save.cosmetics.color, hatKey = save.cosmetics.hat, open = false, mood = null) {
  if (ART.hero) {
    const pickC = set => set && (set[colorKey] || set.mint);
    const moodSet = mood && ART['hero' + mood[0].toUpperCase() + mood.slice(1)];
    const src = (moodSet && pickC(moodSet)) || (open && pickC(ART.heroChomp)) || pickC(ART.hero);
    return `<div class="hero-art">${img(src)}${hatHTML(hatKey)}</div>`;
  }
  const col = COLORS[colorKey] || COLORS.mint;
  const mouth = open
    ? `<ellipse cx="50" cy="70" rx="14" ry="12" fill="#3a1028"/><rect x="41" y="58" width="7" height="6" rx="1.5" fill="#fff"/><rect x="52" y="58" width="7" height="6" rx="1.5" fill="#fff"/><ellipse cx="50" cy="77" rx="7" ry="4" fill="#ff7a9a"/>`
    : `<path d="M41 67Q50 75 59 67" stroke="#3a1028" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="94" rx="26" ry="4" fill="rgba(0,0,0,.3)"/>
<ellipse cx="36" cy="88" rx="9" ry="6" fill="${col.d}"/><ellipse cx="64" cy="88" rx="9" ry="6" fill="${col.d}"/>
<path d="M50 22C74 22 86 40 86 60C86 80 70 90 50 90C30 90 14 80 14 60C14 40 26 22 50 22Z" fill="${col.c}" stroke="${col.d}" stroke-width="3"/>
<ellipse cx="50" cy="72" rx="22" ry="13" fill="rgba(255,255,255,.22)"/>
<ellipse cx="38" cy="50" rx="9" ry="11" fill="#fff"/><ellipse cx="62" cy="50" rx="9" ry="11" fill="#fff"/>
<circle cx="39" cy="52" r="5" fill="#2a1638"/><circle cx="63" cy="52" r="5" fill="#2a1638"/>
<circle cx="41" cy="49" r="1.8" fill="#fff"/><circle cx="65" cy="49" r="1.8" fill="#fff"/>
<circle cx="27" cy="64" r="5" fill="#ff8fb0" opacity=".55"/><circle cx="73" cy="64" r="5" fill="#ff8fb0" opacity=".55"/>
${mouth}${hatSVG(hatKey)}</svg>`;
}
function wispSVG() {
  if (ART.wisp) return img(ART.wisp);
  return `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="94" rx="20" ry="3.5" fill="rgba(0,0,0,.25)"/><path d="M22 52C22 30 34 16 50 16C66 16 78 30 78 52V84L69 76L60 86L50 76L40 86L31 76L22 84Z" fill="#cdbbff" stroke="#8f74e0" stroke-width="3" stroke-linejoin="round"/><ellipse cx="41" cy="46" rx="6" ry="8" fill="#2a1638"/><ellipse cx="59" cy="46" rx="6" ry="8" fill="#2a1638"/><circle cx="43" cy="43" r="2" fill="#fff"/><circle cx="61" cy="43" r="2" fill="#fff"/><ellipse cx="50" cy="62" rx="4.5" ry="5.5" fill="#2a1638"/></svg>`;
}
function grumbleSVG() {
  if (ART.grumble) return img(ART.grumble);
  const pts = []; for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 30 : 39; pts.push(`${(50 + Math.cos(a) * r).toFixed(1)},${(56 + Math.sin(a) * r).toFixed(1)}`); }
  return `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="94" rx="24" ry="4" fill="rgba(0,0,0,.3)"/><polygon points="${pts.join(' ')}" fill="#ff8a5c" stroke="#c4532a" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="56" r="25" fill="#ff9d73"/><ellipse cx="40" cy="54" rx="6" ry="7" fill="#fff"/><ellipse cx="60" cy="54" rx="6" ry="7" fill="#fff"/><circle cx="41" cy="56" r="3.5" fill="#2a1638"/><circle cx="59" cy="56" r="3.5" fill="#2a1638"/><path d="M32 44L46 49M68 44L54 49" stroke="#7a2e14" stroke-width="4" stroke-linecap="round"/><path d="M40 70Q50 64 60 70" stroke="#7a2e14" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>`;
}
const BOSSES = [
  { name: 'Big Blobbo', color: '#7fd36b', dark: '#3f8f3a' },
  { name: 'Queen Grumbles', color: '#ff9a5c', dark: '#c2562a' },
  { name: 'Count Countula', color: '#b48cff', dark: '#6e45c4', cape: true },
];
function bossSVG(floor) {
  if (ART['boss' + floor]) return img(ART['boss' + floor]);
  const B = BOSSES[floor - 1];
  const cape = B.cape ? `<path d="M30 70L8 40L50 58ZM170 70L192 40L150 58Z" fill="#2a1638" stroke="#7a2e5e" stroke-width="3" stroke-linejoin="round"/>` : '';
  return `<svg viewBox="0 0 200 170">${cape}<ellipse cx="100" cy="162" rx="70" ry="7" fill="rgba(0,0,0,.35)"/>
<path d="M100 30C160 30 185 75 185 110C185 145 150 158 100 158C50 158 15 145 15 110C15 75 40 30 100 30Z" fill="${B.color}" stroke="${B.dark}" stroke-width="5"/>
<ellipse cx="100" cy="128" rx="50" ry="22" fill="rgba(255,255,255,.18)"/>
<path d="M68 36L74 8L88 26L100 2L112 26L126 8L132 36Z" fill="#ffd54a" stroke="#c99a12" stroke-width="3" stroke-linejoin="round"/>
<ellipse cx="72" cy="88" rx="17" ry="20" fill="#fff"/><ellipse cx="128" cy="88" rx="17" ry="20" fill="#fff"/>
<circle cx="75" cy="93" r="9" fill="#2a1638"/><circle cx="125" cy="93" r="9" fill="#2a1638"/><circle cx="78" cy="89" r="3" fill="#fff"/><circle cx="128" cy="89" r="3" fill="#fff"/>
<path d="M55 64L88 74M145 64L112 74" stroke="${B.dark}" stroke-width="6" stroke-linecap="round"/>
<path d="M70 122Q100 146 130 122Q100 132 70 122Z" fill="#3a1028"/><path d="M84 126L89 137L94 128ZM106 128L111 137L116 126Z" fill="#fff"/>
<circle cx="45" cy="115" r="8" fill="#ff8fb0" opacity=".5"/><circle cx="155" cy="115" r="8" fill="#ff8fb0" opacity=".5"/></svg>`;
}
const coinSVG = () => ART.coin ? img(ART.coin) : `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="90" rx="22" ry="5" fill="rgba(0,0,0,.3)"/><circle cx="50" cy="50" r="30" fill="#ffc84a" stroke="#c98f12" stroke-width="6"/><circle cx="50" cy="50" r="18" fill="none" stroke="#ffe39a" stroke-width="4"/><circle cx="40" cy="38" r="5" fill="#fff6d0"/></svg>`;
const HEART_P = 'M16 28C6 20 1.5 14 1.5 8.6 1.5 4.5 4.8 1.5 8.8 1.5c2.9 0 5.2 1.5 7.2 4 2-2.5 4.3-4 7.2-4 4 0 7.3 3 7.3 7.1C30.5 14 26 20 16 28z';
const heartPickupSVG = () => ART.heart ? img(ART.heart) : `<svg viewBox="0 0 32 30"><path d="${HEART_P}" fill="#ff5a6e" stroke="#b8293f" stroke-width="2"/><path d="M7 7c1-1.5 3-2 4.5-1.5" stroke="#ffc2cb" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`;
function heartSVG(v, crack) {
  const M = ART.math;
  if (M && M.heart && M.heartEmpty) {
    return `<span class="heart ha"><img src="${M.heartEmpty}" alt="">${v === 2 ? `<img src="${M.heart}" alt="">` : v === 1 ? `<img class="halfL" src="${M.heart}" alt="">` : ''}${crack && M.heartCrack ? `<img class="crk ${crack}" src="${M.heartCrack}" alt="">` : ''}</span>`;
  }
  const id = 'hc' + uid(), cid = 'hk' + uid();
  return `<svg viewBox="0 0 32 30" class="heart"><path d="${HEART_P}" fill="#3a2a4a"/>${crack ? `<clipPath id="${cid}"><rect x="${crack === 'R' ? 16 : 0}" width="16" height="30"/></clipPath><path d="${HEART_P}" fill="#ff5a6e" opacity=".4" clip-path="url(#${cid})"/>` : ''}${v > 0 ? `<clipPath id="${id}"><rect width="${v === 2 ? 32 : 16}" height="30"/></clipPath><path d="${HEART_P}" fill="#ff5a6e" clip-path="url(#${id})"/><path d="M7 7c1-1.5 3-2 4.5-1.5" stroke="#ffc2cb" stroke-width="2.2" fill="none" stroke-linecap="round" clip-path="url(#${id})"/>` : ''}${crack ? '<path d="M16 6 L12.5 11.5 L18 15.5 L13.5 21 L16.5 26" stroke="#fff3da" stroke-width="1.8" fill="none" stroke-linejoin="round"/>' : ''}<path d="${HEART_P}" fill="none" stroke="#140e1c" stroke-width="2"/></svg>`;
}
const chestSVG = () => ART.chest ? img(ART.chest) : `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="88" rx="34" ry="5" fill="rgba(0,0,0,.35)"/><rect x="16" y="44" width="68" height="40" rx="6" fill="#a8693a" stroke="#5e3a1e" stroke-width="3"/><path d="M16 46Q16 22 50 22Q84 22 84 46Z" fill="#c07a42" stroke="#5e3a1e" stroke-width="3"/><rect x="16" y="43" width="68" height="7" fill="#ffc84a" stroke="#c98f12" stroke-width="2"/><rect x="43" y="45" width="14" height="16" rx="3" fill="#ffd54a" stroke="#c98f12" stroke-width="2"/><circle cx="50" cy="53" r="2.5" fill="#5e3a1e"/></svg>`;
const owlSVG = () => ART.shopkeeper ? img(ART.shopkeeper) : `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="93" rx="26" ry="4" fill="rgba(0,0,0,.3)"/><path d="M50 22C74 22 82 40 82 60C82 81 68 91 50 91C32 91 18 81 18 60C18 40 26 22 50 22Z" fill="#9b6b43" stroke="#5e3a1e" stroke-width="3"/><path d="M27 24L35 36L23 37ZM73 24L65 36L77 37Z" fill="#7a5232"/><ellipse cx="50" cy="68" rx="20" ry="17" fill="#e8c9a0"/><circle cx="38" cy="48" r="12" fill="#fff"/><circle cx="62" cy="48" r="12" fill="#fff"/><circle cx="39" cy="49" r="6" fill="#2a1638"/><circle cx="61" cy="49" r="6" fill="#2a1638"/><circle cx="41" cy="47" r="2" fill="#fff"/><circle cx="63" cy="47" r="2" fill="#fff"/><path d="M46 58L50 65L54 58Z" fill="#ffb03a"/><rect x="29" y="3" width="42" height="15" rx="4" fill="#ffc84a" stroke="#c98f12" stroke-width="2"/><text x="50" y="14.5" text-anchor="middle" font-size="11" font-weight="700" fill="#5a3a06" font-family="Fredoka,sans-serif">SHOP</text></svg>`;
const trapSVG = () => ART.trapdoor ? img(ART.trapdoor) : `<svg viewBox="0 0 100 100"><rect x="12" y="12" width="76" height="76" rx="8" fill="#0b0710" stroke="#ffc84a" stroke-width="5"/><path d="M32 22V82M68 22V82M32 36H68M32 50H68M32 64H68" stroke="#7a5234" stroke-width="5"/></svg>`;

/* math models (ink on paper) */
function framesSVG(segs, o = {}) {
  const M = ART.math;
  if ((o.cell || 10) >= 14 && M && M.board && M.counterRed && M.counterBlue) return framesArt(segs, o);
  const cell = o.cell || 10, list = []; segs.forEach(g => { for (let i = 0; i < g.n; i++) list.push(g.cls); });
  const nf = o.frames || Math.max(1, Math.ceil(list.length / 10)), gapF = cell * .4, W = 5 * cell, H = nf * 2 * cell + (nf - 1) * gapF, sw = Math.max(1, cell * .09);
  let s = '';
  for (let f = 0; f < nf; f++) {
    const oy = f * (2 * cell + gapF);
    s += `<rect x="${sw / 2}" y="${oy + sw / 2}" width="${W - sw}" height="${2 * cell - sw}" rx="${cell * .12}" fill="#fff" stroke="#2a1f3a" stroke-width="${sw}"/>`;
    for (let c = 1; c < 5; c++) s += `<line x1="${c * cell}" y1="${oy}" x2="${c * cell}" y2="${oy + 2 * cell}" stroke="#2a1f3a" stroke-width="${sw * .7}"/>`;
    s += `<line x1="0" y1="${oy + cell}" x2="${W}" y2="${oy + cell}" stroke="#2a1f3a" stroke-width="${sw * .7}"/>`;
    for (let k = 0; k < 10; k++) {
      const i = f * 10 + k; if (i >= list.length) break;
      const cx = (k % 5) * cell + cell / 2, cy = oy + Math.floor(k / 5) * cell + cell / 2, cls = list[i], r = cell * .34;
      s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${cls === 'b' ? '#3d8bff' : cls === 'x' ? '#ffc2ca' : '#ff5a6e'}"/>`;
      if (cls === 'x') { const d = r * .75; s += `<path d="M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}" stroke="#b8293f" stroke-width="${cell * .1}" stroke-linecap="round"/>`; }
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
function pairsSVG(n, size = 16) {
  const M = ART.math;
  if (size >= 14 && M && M.counterRed && M.counterBlue) return pairsArt(n, size);
  const cols = Math.ceil(n / 2), gap = size * 1.3, W = cols * gap + 8, H = 2 * gap + 8; let s = '';
  for (let c = 0; c < cols; c++) {
    const x = 4 + c * gap + gap / 2, full = c * 2 + 1 < n;
    if (full) s += `<rect x="${x - size * .62}" y="${4 + gap * .5 - size * .62}" width="${size * 1.24}" height="${gap + size * 1.24}" rx="${size * .62}" fill="none" stroke="#3d8bff" stroke-width="2.2"/>`;
    for (let r = 0; r < 2; r++) { if (c * 2 + r >= n) break; s += `<circle cx="${x}" cy="${4 + gap * .5 + r * gap}" r="${size * .42}" fill="${full ? '#ff5a6e' : '#ffc84a'}" ${full ? '' : 'stroke="#c98f12" stroke-width="2.5"'}/>`; }
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
function onesSVG(n) {
  const t = String(n), last = t.slice(-1), head = t.slice(0, -1);
  return `<svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg"><text x="60" y="44" text-anchor="middle" font-size="42" font-weight="700" font-family="Fredoka,sans-serif"><tspan fill="#b9a98a">${head}</tspan><tspan fill="#ff5a6e">${last}</tspan></text><path d="M${60 + (head.length ? 12 : 0)} 52h20" stroke="#ff5a6e" stroke-width="4" stroke-linecap="round"/></svg>`;
}
function pathSVG(step, start, n) {
  const k = Math.floor((n - start) / step), first = Math.max(0, k - 2), vals = [];
  for (let i = 0; i < 5; i++) vals.push(start + (first + i) * step);
  const inSeq = n >= start && (n - start) % step === 0;
  const W = 300, lo = Math.min(vals[0] - step * .45, n - step * .3), hi = Math.max(vals[4] + step * .45, n + step * .3), X = v => 14 + (v - lo) / (hi - lo) * (W - 28);
  let s = `<line x1="6" y1="62" x2="${W - 6}" y2="62" stroke="#8a7aa3" stroke-width="3" stroke-linecap="round"/>`;
  for (let i = 0; i < 4; i++) { const a = X(vals[i]), b = X(vals[i + 1]); s += `<path d="M${a} 55Q${(a + b) / 2} 16 ${b} 55" fill="none" stroke="#2e9c72" stroke-width="3"/>`; }
  vals.forEach(v => { const x = X(v), hit = inSeq && v === n; s += `<circle cx="${x}" cy="62" r="${hit ? 9 : 6}" fill="${hit ? '#ffc84a' : '#2e9c72'}" ${hit ? 'stroke="#c98f12" stroke-width="2"' : ''}/><text x="${x}" y="86" text-anchor="middle" font-size="15" font-weight="700" fill="#2a1f3a" font-family="Fredoka,sans-serif">${v}</text>`; });
  if (!inSeq) { const x = X(n); s += `<circle cx="${x}" cy="62" r="7" fill="#ff5a6e"/><text x="${x}" y="44" text-anchor="middle" font-size="16" font-weight="700" fill="#b8293f" font-family="Fredoka,sans-serif">${n}</text>`; }
  return `<svg viewBox="0 0 ${W} 94" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
function rackSVG(hp, gone = 0) {
  const r = 9, gap = 20, W = 14 + 9 * gap + 40 + 14; let s = '';
  for (let row = 0; row < 2; row++) {
    const y = 20 + row * 30;
    s += `<line x1="4" y1="${y}" x2="${W - 4}" y2="${y}" stroke="#8a7aa3" stroke-width="3"/>`;
    for (let i = 0; i < 10; i++) {
      const idx = row * 10 + i, on = idx < hp, was = idx < hp + gone, red = i < 5, x = 14 + i * gap + (on ? 0 : 40);
      s += `<circle class="${!on && was ? 'bead-gone' : ''}" cx="${x}" cy="${y}" r="${r}" fill="${red ? '#ff5a6e' : '#fff3da'}" stroke="${red ? '#b8293f' : '#b9a98a'}" stroke-width="2" opacity="${on ? 1 : .25}"/>`;
    }
  }
  return `<svg viewBox="0 0 ${W} 70" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

/* ---- math pictures drawn with the Gemini pieces (positions are still exact) ---- */
function framesArt(segs, o = {}) {
  const M = ART.math, cell = o.cell || 10, list = []; segs.forEach(g => { for (let i = 0; i < g.n; i++) list.push(g.cls); });
  const nf = o.frames || Math.max(1, Math.ceil(list.length / 10));
  const BW = 5 * cell / (BOARD.x1 - BOARD.x0), BH = BW / BOARD.aspect, gx = BOARD.x0 * BW, gy = BOARD.y0 * BH, ch = (BOARD.y1 - BOARD.y0) * BH / 2, gap = cell * .25;
  let s = '';
  for (let f = 0; f < nf; f++) {
    const oy = f * (BH + gap);
    s += `<image href="${M.board}" x="0" y="${oy}" width="${BW}" height="${BH}" preserveAspectRatio="none"/>`;
    for (let k = 0; k < 10; k++) {
      const i = f * 10 + k; if (i >= list.length) break;
      const cls = list[i], d = Math.min(cell, ch) * .82, cx = gx + (k % 5) * cell + cell / 2, cy = oy + gy + Math.floor(k / 5) * ch + ch / 2;
      s += `<image class="counter${cls === 'x' ? ' x' : ''}" href="${cls === 'b' ? M.counterBlue : M.counterRed}" x="${cx - d / 2}" y="${cy - d / 2}" width="${d}" height="${d}"${cls === 'x' ? ' opacity=".35"' : ''}/>`;
      if (cls === 'x') { const r = d * .3; s += `<path d="M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}" stroke="#b8293f" stroke-width="${cell * .12}" stroke-linecap="round"/>`; }
    }
  }
  return `<svg viewBox="0 0 ${BW} ${nf * BH + (nf - 1) * gap}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
function pairsArt(n, size) {
  const M = ART.math, cols = Math.ceil(n / 2), gap = size * 1.3, W = cols * gap + 8, H = 2 * gap + 8, d = size * .95; let s = '';
  for (let c = 0; c < cols; c++) {
    const x = 4 + c * gap + gap / 2, full = c * 2 + 1 < n;
    if (full) s += `<rect x="${x - size * .62}" y="${4 + gap * .5 - size * .62}" width="${size * 1.24}" height="${gap + size * 1.24}" rx="${size * .62}" fill="none" stroke="#ffc84a" stroke-width="2.4"/>`;
    for (let r = 0; r < 2; r++) { if (c * 2 + r >= n) break; s += `<image class="counter" href="${full ? M.counterRed : M.counterBlue}" x="${x - d / 2}" y="${4 + gap * .5 + r * gap - d / 2}" width="${d}" height="${d}"/>`; }
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
/* boss number rack: wooden frame (stretched by css) with 5 red + 5 cream beads on each rod */
function rackHTML(hp, gone = 0) {
  const M = ART.math;
  if (!(M && M.rack && M.beadRed && M.beadCream && document.body.classList.contains('skin'))) return rackSVG(hp, gone);
  let h = '';
  for (let row = 0; row < 2; row++) for (let i = 0; i < 10; i++) {
    const idx = row * 10 + i, on = idx < hp, was = idx < hp + gone;
    h += `<img class="bead${on ? '' : ' off'}${!on && was ? ' gone' : ''}" src="${i < 5 ? M.beadRed : M.beadCream}" style="left:${1 + i * 7.7 + (on ? 0 : 21)}%;top:${RACK.rods[row] * 100}%" alt="">`;
  }
  return `<div class="rackA"><div class="rods">${h}</div></div>`;
}
/* little room decorations (never in the way: corners of special rooms, a pebble or tuft elsewhere) */
const DECO_SPOTS = {
  treasure: [['heap', 0, 0], ['barrel', 4, 0], ['coins', 0, 4], ['barrel', 4, 4]],
  shop: [['barrel', 0, 0], ['coins', 4, 0], ['barrel', 0, 4], ['heap', 4, 4]],
  start: [['boulder', 0, 0], ['rocks', 4, 0], ['grass', 4, 4]],
  boss: [['grass', 0, 0], ['rocks', 4, 0], ['boulder', 0, 4]],
};
function roomDeco(r) {
  if (r.deco) return r.deco;
  if (DECO_SPOTS[r.type]) return (r.deco = DECO_SPOTS[r.type].map(([p, x, y]) => ({ p, x, y, big: true })));
  const free = []; for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (!(r.tiles || []).some(t => t.x === x && t.y === y) && !(x === 2 && (y === 0 || y === 4)) && !(y === 2 && (x === 0 || x === 4))) free.push({ x, y });
  return (r.deco = shuffle(free).slice(0, 2).map((c, i) => ({ p: i ? 'grass' : 'rocks', x: c.x, y: c.y })));
}
