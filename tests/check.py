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
VOICE = r"""() => {
  const missing = new Set(), texts = [];
  const add = t => { texts.push(t); if (!Clips.ids(t)) missing.add(t); };
  run = { lastSkill: null, lastTarget: null, items: [], floor: 1, roomsCleared: 0, comebackQueue: [] };
  for (const [skill, maxL] of [['add', 4], ['sub', 3], ['evenOdd', 3], ['skip10', 2], ['skip5', 2], ['skip2', 3], ['frames', 3]])
    for (let lv = 1; lv <= maxL; lv++) for (let i = 0; i < 60; i++) {
      const m = makeRule(skill, lv, 5, 13); add(m.rule.speak); add('Comeback room! ' + m.rule.speak);
      m.tiles.forEach(t => { if (t.correct) add(rightSpeech(m.rule, t)); else add(coachContent(m.rule, t).say); if (t.kind !== 'frame') add(t.label); });
    }
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) { add(addStrategy(a, b).text); add(itemCard({ type: 'fact', a, b, op: '+', val: a + b }).say); }
  for (let a = 0; a <= 20; a++) for (let b = 0; b <= Math.min(a, 10); b++) { add(subStrategy(a, b).text); add(itemCard({ type: 'fact', a, b, op: '−', val: a - b }).say); }
  for (let f = 1; f <= 3; f++) { run.floor = f; for (let hp = 1; hp <= 20; hp++) for (let i = 0; i < 20; i++) bossMoves(hp).forEach(m => { add(bossHint(hp, m)); add(`${hp} minus ${m.k} equals what?`); add(`Hit! ${hp - m.k} left.`); }); }
  [[2, 0], [2, 1], [5, 0], [10, 0], [10, 7]].forEach(([step, offset]) => add(itemCard({ type: 'skip', step, offset }).say));
  for (let n = 1; n <= 40; n++) add(itemCard({ type: 'parity', n }).say);
  for (let n = 1; n <= 20; n++) add(itemCard({ type: 'frame', n }).say);
  Object.values(ITEMS).forEach(it => add(it.say));
  return { checked: texts.length, missing: [...missing].slice(0, 12) };
}"""

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
      tryMove(dx, dy);
      if (target && !(snap.find(s => s.m === target).dizzy > 0)) continue;
      const lost = 6 - run.hearts, threat = snap.filter(s => !s.dizzy && s.next && s.next.x === hero.x && s.next.y === hero.y && room.monsters.includes(s.m));
      if (lost) hits++;
      if (lost && !threat.length) problems.push('hurt without footprints');
      if (!lost && threat.length && safe0 <= 1) problems.push('footprints but no hit');
      for (const s of snap) { if (!room.monsters.includes(s.m)) continue; const m = s.m;
        if (s.dizzy || !s.next || (s.next.x === hero.x && s.next.y === hero.y)) { if (m.x !== s.x || m.y !== s.y) problems.push('moved off-plan'); }
        else if (m.x !== s.next.x || m.y !== s.next.y) problems.push('ignored its footprints'); }
    }
  }
  return { hits, problems: [...new Set(problems)] };
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

async def main():
    t0 = time.time()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await (await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)).new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(URL); await page.wait_for_timeout(500)

        await page.evaluate("Voice.log = []")
        v = await page.evaluate(VOICE); report(f"every generated sentence has recorded clips ({v['checked']} checked)", not v['missing'], ' | '.join(v['missing']))
        art = await page.evaluate("loadArt().then(() => ({ sprites: Object.keys(ART).length, heroes: Object.keys(ART.hero || {}).length + Object.keys(ART.heroChomp || {}).length }))")
        report('art files all load', art['sprites'] == 12 and art['heroes'] == 12, json.dumps(art))
        m = await page.evaluate(MATH); report(f"math is true in {m['rooms']} generated rooms", not m['problems'], '; '.join(m['problems']))
        h = await page.evaluate(HONEST); report(f"footprints predict every monster step ({h['hits']} hits, all on footprints)", not h['problems'], '; '.join(h['problems']))
        lp = await page.evaluate(LOOP)
        for k, v in lp.items(): report(k.replace('_', ' '), v)
        trophy, log = await smoke(page)
        said = await page.evaluate("[...new Set(Voice.log)].filter(t => !Clips.ids(t))")
        report('everything said in a full run uses recorded clips', not said, ' | '.join(said[:8]))
        played = await page.evaluate("""new Promise(res => { Sound.init(); Clips.decode(); const t0 = Date.now();
            (function wait() { if (Clips.buf) { save.settings.voice = true; Voice.say('Double 6 is 12!'); res({ dur: Clips.buf.duration, scheduled: Clips.nodes.length }); }
              else if (Date.now() - t0 > 8000) res(null); else setTimeout(wait, 100); })(); })""")
        report('voice recording decodes and plays', bool(played) and played['scheduled'] == 4, json.dumps(played))
        report('full run: 3 floors, treasure, shop, bosses, trophy', trophy, '' if trophy else ' > '.join(log[-8:]))

        for (w, hgt, name) in [(390, 844, 'phone'), (375, 667, 'small-phone'), (820, 1180, 'ipad'), (1180, 820, 'ipad-landscape')]:
            pg = await (await b.new_context(viewport={'width': w, 'height': hgt}, has_touch=True)).new_page()
            pg.on('pageerror', lambda e, n=name: errors.append(f'{n}: {e}'))
            await pg.goto(URL); await pg.wait_for_timeout(300)
            if WANT_SHOTS: os.makedirs(SHOTS, exist_ok=True); await pg.screenshot(path=f'{SHOTS}/{name}-title.png')
            await pg.evaluate(FRESH + r""" save.roomsEver = 9; newRun(); closeOverlay(); run.floorRoomsCleared = 2;
              const r = Object.values(run.map.rooms).find(x => x.type === 'normal' && !x.gen); hero.x = 2; hero.y = 0; enterRoom(r, { x: 2, y: 0 });""")
            await pg.wait_for_timeout(2000)
            lay = await pg.evaluate(LAYOUT)
            report(f'layout fits on {name} ({w}x{hgt})', not lay['hscroll'] and lay['grid_in_view'] and lay['chomp_in_view'], json.dumps(lay))
            if WANT_SHOTS: await pg.screenshot(path=f'{SHOTS}/{name}-room.png')
            await pg.context.close()
        await b.close()
    report('no JavaScript errors', not errors, '; '.join(errors[:3]))
    bad = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed in {time.time() - t0:.0f}s" + (f" | FAILED: {', '.join(bad)}" if bad else ''))
    sys.exit(1 if bad else 0)

asyncio.run(main())
