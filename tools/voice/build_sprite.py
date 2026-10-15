"""Cut aligned clips out of the recording and pack them into one audio sprite + index (audio/voice.mp3, audio/voice.js)."""
import json, subprocess, numpy as np
from scipy.io import wavfile
S = '/tmp/claude-0/-home-claude-digit-dungeon/ea0c0165-9178-50a7-bb2e-cd230b08d9e6/scratchpad/voice'
REPO = '/home/claude/digit-dungeon'
sr, X = wavfile.read(f'{S}/full.wav'); X = X.astype(np.float32) / 32768
db = np.load(f'{S}/db.npy')
assign = json.load(open(f'{S}/assign.json'))
lines = json.load(open(f'{REPO}/audio/voice-lines.json'))
spans = sorted((v[0], v[1]) for v in assign.values())

def bounds(a, b):
    # neighbours (any assigned or unassigned voiced region) limit how far we extend
    prev_end = max([e for s, e in spans if e < a] + [0]); next_start = min([s for s, e in spans if s > b] + [len(db) - 1])
    lo = max(prev_end + (a - prev_end) // 2, a - 15); hi = min(b + (next_start - b) // 2, b + 25)
    s = a
    while s > lo and db[s - 1] > -62: s -= 1        # soft onsets (s, f, th)
    e = b
    while e < hi and db[e + 1] > -62: e += 1        # trailing fricatives / releases
    return max(lo, s - 4), min(hi, e + 8)            # +40 ms lead, +80 ms tail

clips, chunks, t = {}, [], 0.0
gap = np.zeros(int(sr * 0.25), np.float32)
for l in lines:
    a, b = assign[l['id']]; s, e = bounds(a, b)
    x = X[s * 240:(e + 1) * 240].copy()
    # shorten long pauses inside a clip (sentence breaks) to 0.28 s
    fdb = db[s:e + 1]; keep = np.ones(len(fdb), bool); run = 0
    for i_, v in enumerate(fdb):
        run = run + 1 if v < -55 else 0
        if run > 28: keep[i_] = False
    x = np.concatenate([x[i_ * 240:(i_ + 1) * 240] for i_ in range(len(fdb)) if keep[i_]])
    f = int(sr * 0.008); ramp = np.linspace(0, 1, f); x[:f] *= ramp; x[-f:] *= ramp[::-1]
    clips[l['id']] = [round(t, 3), round(len(x) / sr, 3), l['text']]
    chunks += [x, gap]; t += (len(x) + len(gap)) / sr
Y = np.concatenate(chunks); Y *= 0.89 / np.abs(Y).max()
wavfile.write(f'{S}/sprite.wav', sr, (Y * 32767).astype(np.int16))
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', f'{S}/sprite.wav', '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '48k', f'{REPO}/audio/voice.mp3'], check=True)
# MP3 encoders add a short delay at the start; measure it by decoding and cross-correlating the first clip
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', f'{REPO}/audio/voice.mp3', '-ar', '24000', '-ac', '1', f'{S}/decoded.wav'], check=True)
_, D = wavfile.read(f'{S}/decoded.wav'); D = D.astype(np.float32) / 32768
n = sr * 2; c = np.correlate(D[:n + 4000], Y[:n], mode='valid'); delay = int(np.argmax(c)) / sr
print('encoder delay', round(delay, 4), 's')
for k in clips: clips[k][0] = round(clips[k][0] + delay, 3)
js = '/* Voice clips cut from the Gemini recording: id -> [start s, length s, text]. Generated; do not hand-edit. */\nwindow.VOICE = ' + json.dumps({'file': 'audio/voice.mp3', 'clips': clips}, ensure_ascii=False) + ';\n'
open(f'{REPO}/audio/voice.js', 'w').write(js)
import os
print(len(clips), 'clips |', round(t, 1), 's sprite |', os.path.getsize(f'{REPO}/audio/voice.mp3') // 1024, 'KB mp3')
