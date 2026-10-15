"""Align the Gemini recording to the voice script without speech recognition.
Numbers region is fixed by count; the phrase region uses DP over segment durations and pauses."""
import json, re, numpy as np
S = '/tmp/claude-0/-home-claude-digit-dungeon/ea0c0165-9178-50a7-bb2e-cd230b08d9e6/scratchpad/voice'
segs = json.load(open(f'{S}/fine.json'))                      # 10 ms frames, inclusive ends
lines = json.load(open('/home/claude/digit-dungeon/audio/voice-lines.json'))

# expected sequence: preamble (17 segs) | Part one | 0..55 | Part two | 56..110 | Part three | part3 | Part four | part4 | Part five | part5
seq = [{'id': '_part1', 'text': 'Part one.'}]
for p in range(1, 6):
    if p > 1: seq.append({'id': f'_part{p}', 'text': f'Part {["", "one", "two", "three", "four", "five"][p]}.'})
    seq += [l for l in lines if l['part'] == p]

def syl(t):
    t = t.lower().replace('-', ' ')
    return sum(max(1, len(re.findall(r'[aeiouy]+', w)) - (1 if w.endswith('e') and len(re.findall(r'[aeiouy]+', w)) > 1 else 0)) for w in re.findall(r"[a-z']+", t))
def breaks(t): return len(re.findall(r'[.!?:,](?=\s+\S)', t))

PRE = 17                                    # segments 0..16 are the read-aloud directions
num_lines = 1 + 56 + 1 + 55                 # Part one, 0..55, Part two, 56..110
assign = {}
for i in range(num_lines): assign[seq[i]['id']] = (PRE + i, PRE + i)
j0 = PRE + num_lines                        # first phrase-region segment ("Part three.")
L = seq[num_lines:]; G = segs[j0:]
st = np.array([a for a, b in G]) * .01; en = np.array([b for a, b in G]) * .01
gap_before = np.r_[9, st[1:] - en[:-1]]

def run(r, p):
    n, m = len(L), len(G); INF = 1e18
    f = np.full((n + 1, m + 1), INF); back = {}
    f[0][0] = 0
    for i in range(1, n + 1):
        pred = r * syl(L[i - 1]['text']) + p * breaks(L[i - 1]['text'])
        for k in range(1, m + 1):
            for c in range(1, 5):
                j = k - c
                if j < 0 or f[i - 1][j] >= INF: continue
                span = en[k - 1] - st[j]
                cost = ((span - pred) / (0.22 + 0.12 * pred)) ** 2
                inner = gap_before[j + 1:k]
                cost += sum(6 if g > 0.56 else (1.5 if g > 0.45 else 0.3) for g in inner)
                if i > 1 and gap_before[j] < 0.45: cost += 5
                v = f[i - 1][j] + cost
                if v < f[i][k]: f[i][k] = v; back[(i, k)] = j
    if f[n][m] >= INF: return None
    out, k = [], m
    for i in range(n, 0, -1): j = back[(i, k)]; out.append((j, k - 1)); k = j
    return out[::-1], f[n][m]

r, p = 0.17, 0.3
for it in range(4):
    al, cost = run(r, p)
    X = np.array([[syl(l['text']), breaks(l['text'])] for l in L]); y = np.array([en[b] - st[a] for a, b in al])
    r, p = np.clip(np.linalg.lstsq(X, y, rcond=None)[0], [0.08, 0], [0.4, 1.2])
    print(f'iter {it}: cost {cost:.1f}  rate {r:.3f}s/syl  pause {p:.2f}s')
for (a, b), l in zip(al, L):
    pred = r * syl(l['text']) + p * breaks(l['text']); span = en[b] - st[a]
    flag = '  <-- check' if abs(span - pred) > 0.35 + 0.25 * pred else ''
    print(f"{j0 + a:3d}-{j0 + b:3d} {span:4.2f}s pred {pred:4.2f}  {l['id']:14s} {l['text']}{flag}")
    assign[l['id']] = (j0 + a, j0 + b)
json.dump({k: [segs[a][0], segs[b][1]] for k, (a, b) in assign.items()}, open(f'{S}/assign.json', 'w'))
