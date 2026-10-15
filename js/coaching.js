'use strict';
/* Digit Dungeon · coaching.js: Strategy coaching (Bridges strategies), mistake cards, remember cards. */

/* --- strategy coaching: named Bridges strategies, short enough to hear in one breath --- */
const countList = (from, n, dir) => Array.from({ length: n }, (_, i) => from + dir * (i + 1)).join(', ');
function addStrategy(a, b) {
  const s = a + b, big = Math.max(a, b), small = Math.min(a, b);
  if (small === 0) return { name: 'Zero', text: `Plus 0 stays the same: ${s}.` };
  if (a === b) return { name: 'Doubles', text: `Double ${a} is ${s}!` };
  if (s === 10) return { name: 'Make ten', text: `${a} and ${b} are ten-friends!` };
  if (big === 10) return { name: 'Add ten', text: `10 and ${small} more is ${s}.` };
  if (Math.abs(a - b) === 1) return { name: 'Near double', text: `${small} + ${small} = ${2 * small}. One more is ${s}.` };
  if (small <= 2) return { name: 'Count on', text: `Start at ${big}. Count on: ${countList(big, small, 1)}.` };
  if (s > 10) { const need = 10 - big; return { name: 'Make ten', text: `${big} + ${need} makes 10. ${small - need} more is ${s}.` }; }
  return { name: 'Count on', text: `Start at ${big}. Count on: ${countList(big, small, 1)}.` };
}
function subStrategy(a, b) {
  const r = a - b;
  if (b === 0) return { name: 'Zero', text: `Take away 0. Still ${a}.` };
  if (r === 0) return { name: 'All gone', text: 'Take them all away. 0 left!' };
  if (a === 2 * b) return { name: 'Doubles', text: `${b} + ${b} = ${a}, so ${a} − ${b} = ${b}.` };
  if (a > 10 && a <= 20 && b === 10) return { name: 'Take ten', text: `${a} is 10 and ${a - 10}. Take the 10: ${r} left.` };
  if (a > 10 && a <= 20 && b === a - 10) return { name: 'Back to ten', text: `${a} is 10 and ${b}. Take the ${b}: 10 left.` };
  if (b <= 3) return { name: 'Count back', text: `Start at ${a}. Count back: ${countList(a, b, -1)}.` };
  if (a > 10 && a <= 20 && b > a - 10) { const first = a - 10, rest = b - first; return { name: 'Down to ten', text: `Take ${first} to get to 10. Take ${rest} more: ${r}.` }; }
  return { name: 'Think addition', text: `${b} + ${r} = ${a}, so ${a} − ${b} = ${r}.` };
}
function describeFrame(n) {
  if (n === 10) return 'One full ten.';
  if (n > 10) return `A full ten and ${n - 10} more.`;
  if (n === 5) return 'One full row of 5.';
  if (n > 5) return `A row of 5 and ${n - 5} more.`;
  return `${n} dot${n === 1 ? '' : 's'}.`;
}
function modelFor(rule, t, big) {
  const cell = big ? 24 : 12;
  switch (rule.kind) {
    case 'equals': return t.op === '+' ? framesSVG([{ n: t.a, cls: 'a' }, { n: t.b, cls: 'b' }], { cell, frames: t.a + t.b > 10 ? 2 : 1 })
                                       : framesSVG([{ n: t.a - t.b, cls: 'a' }, { n: t.b, cls: 'x' }], { cell, frames: t.a > 10 ? 2 : 1 });
    case 'parity': return t.value <= 20 ? pairsSVG(t.value, big ? 18 : 10) : onesSVG(t.value, big);
    case 'skip': return pathSVG(rule.step, rule.start, t.value);
    case 'frames': return framesSVG(t.segs, { cell, frames: t.frames });
  }
  return '';
}
function coachContent(rule, t) {
  const model = modelFor(rule, t, true);
  if (rule.kind === 'equals') {
    const st = t.op === '+' ? addStrategy(t.a, t.b) : subStrategy(t.a, t.b);
    return { title: `${show(t.label)} = ${t.value}`, model, strat: st.name, line: st.text, say: `${t.label} is ${t.value}. ${st.text}` };
  }
  if (rule.kind === 'parity') {
    const n = t.value, word = n % 2 ? 'odd' : 'even';
    const line = n <= 20 ? (n % 2 ? 'One is left over.' : 'Every dot has a partner.') : `It ends in ${n % 10}.`;
    return { title: `${n} is ${word}`, model, line, say: `${n} is ${word}. ${line}` };
  }
  if (rule.kind === 'skip') {
    const n = t.value, from = rule.offset ? ` from ${rule.offset}` : '';
    if (n < rule.start) return { title: `We start at ${rule.start}`, model, line: `${n} comes before ${rule.start}.`, say: `Counting by ${rule.step}s${from}, we start at ${rule.start}.` };
    const k = Math.floor((n - rule.start) / rule.step), prev = rule.start + k * rule.step, next = prev + rule.step;
    return { title: `We skip ${n}`, model, line: `By ${rule.step}s: ${prev}, ${next}…`, say: `Counting by ${rule.step}s we say ${prev}, ${next}. We skip ${n}.` };
  }
  const line = describeFrame(t.value);
  return { title: `This is ${t.value}`, model, line, say: `This ten frame shows ${t.value}. ${line}` };
}
/* a picture + sentence for one remembered mistake (run-over card, grown-ups list) */
function itemCard(item) {
  if (item.type === 'fact') {
    const plus = item.op === '+';
    return { title: `${item.a} ${item.op} ${item.b} = ${item.val}`, say: `${item.a} ${plus ? 'plus' : 'minus'} ${item.b} is ${item.val}`,
      model: plus ? framesSVG([{ n: item.a, cls: 'a' }, { n: item.b, cls: 'b' }], { cell: 20, frames: item.val > 10 ? 2 : 1 })
                  : framesSVG([{ n: item.val, cls: 'a' }, { n: item.b, cls: 'x' }], { cell: 20, frames: item.a > 10 ? 2 : 1 }) };
  }
  if (item.type === 'parity') { const w = item.n % 2 ? 'odd' : 'even'; return { title: `${item.n} is ${w}`, say: `${item.n} is ${w}`, model: item.n <= 20 ? pairsSVG(item.n, 16) : onesSVG(item.n) }; }
  if (item.type === 'frame') return { title: `This is ${item.n}`, say: `This ten frame shows ${item.n}`, model: framesSVG(item.segs || [{ n: item.n, cls: 'a' }], { cell: 20, frames: item.frames || (item.n > 10 ? 2 : 1) }) };
  const start = item.offset || item.step, seq = [0, 1, 2, 3].map(i => start + i * item.step);
  return { title: `By ${item.step}s: ${seq.join(', ')}…`, say: `Counting by ${item.step}s: ${seq.join(', ')}`, model: pathSVG(item.step, start, start + 2 * item.step) };
}
