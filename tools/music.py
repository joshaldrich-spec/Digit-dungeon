"""Compose and render the Digit Dungeon background loop: creepy-cute lo-fi in A minor.

    python3 tools/music.py          # writes audio/music.mp3 and prints the loop length

Layers: soft electric-piano chords (Am9 - Fmaj7 - Dm9 - E7b9), sine bass, brushed lo-fi drums,
a music-box melody, an occasional theremin glide, vinyl crackle + hiss, tape wobble, small room reverb.
The file holds one 16-bar loop plus a 3 s tail; the game starts a new copy every LOOP seconds so the
tail rings into the next pass (seamless, no click).
"""
import os, subprocess, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 32000
BPM = 70; BEAT = 60 / BPM; BAR = 4 * BEAT; BARS = 16
LOOP = BARS * BAR; TAIL = 3.0
N = int((LOOP + TAIL) * SR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR
mix = np.zeros(N)
wow = 1 + 0.0035 * np.sin(2 * np.pi * 0.37 * t_all) + 0.0015 * np.sin(2 * np.pi * 5.1 * t_all)   # tape wow + flutter

def hz(m): return 440 * 2 ** ((m - 69) / 12)
def add(sig, start, gain=1.0):
    i = int(start * SR); j = min(N, i + len(sig))
    if i < N: mix[i:j] += gain * sig[:j - i]
def osc(freq, dur, start, partials, decay, attack=0.006):
    n = int(dur * SR); t = np.arange(n) / SR; w = wow[int(start * SR):int(start * SR) + n]
    if len(w) < n: w = np.pad(w, (0, n - len(w)), constant_values=1)
    phase = 2 * np.pi * freq * np.cumsum(w) / SR
    s = sum(a * np.sin(k * phase) * np.exp(-t / (decay * d)) for k, a, d in partials)
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / 0.05).clip(0, 1)
    return s * env

# ---- chords
CHORDS = [  # bass, voicing
    (45, [60, 64, 67, 71]),   # Am9
    (41, [57, 60, 64, 67]),   # Fmaj7(9)
    (38, [53, 57, 60, 64]),   # Dm9
    (40, [56, 59, 62, 65]),   # E7b9
]
EP = [(1, 1.0, 1.0), (2, 0.28, 0.6), (3, 0.06, 0.35), (7, 0.05, 0.08)]          # electric piano: warm + small tine
for bar in range(BARS):
    bass, notes = CHORDS[bar % 4]; t0 = bar * BAR
    for beat_at, vel, dur in [(0, 0.9, 2.2), (1.5, 0.55, 1.2), (3.0 + (0.5 if bar % 2 else 0), 0.35, 0.9)]:
        for k, m in enumerate(notes):
            jitter = rng.uniform(0, 0.018) + k * 0.012                                    # a little strum, human timing
            s = osc(hz(m), dur, t0 + beat_at * BEAT + jitter, EP, 1.1)
            trem = 1 - 0.18 * (0.5 + 0.5 * np.sin(2 * np.pi * 4.2 * np.arange(len(s)) / SR))
            add(s * trem, t0 + beat_at * BEAT + jitter, 0.09 * vel)
    for beat_at, m, dur in [(0, bass, 1.6), (2, bass + (7 if bar % 4 != 3 else 12), 1.4)]:
        add(np.tanh(1.6 * osc(hz(m), dur, t0 + beat_at * BEAT, [(1, 1, 1.0), (2, 0.15, 0.5)], 0.9, 0.012)), t0 + beat_at * BEAT, 0.20)

# ---- drums (soft, lo-fi)
def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR; f = 48 + 70 * np.exp(-t / 0.035)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
def snare():
    n = int(0.3 * SR); t = np.arange(n) / SR
    noise = sosfilt(butter(2, [900, 4200], 'bandpass', fs=SR, output='sos'), rng.standard_normal(n))
    return 0.6 * noise * np.exp(-t / 0.07) + 0.4 * np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05)
def hat():
    n = int(0.08 * SR); t = np.arange(n) / SR
    return sosfilt(butter(2, 6500, 'highpass', fs=SR, output='sos'), rng.standard_normal(n)) * np.exp(-t / 0.018)
K, S = kick(), snare()
for bar in range(BARS):
    if bar < 2: continue                                     # drums enter on bar 3
    t0 = bar * BAR
    for b in (0, 2.5): add(K, t0 + b * BEAT, 0.42)
    for b in (1, 3): add(S, t0 + b * BEAT + 0.012, 0.13)
    for e in range(8):
        sw = 0.08 * BEAT if e % 2 else 0                      # swing
        add(hat(), t0 + e * BEAT / 2 + sw, 0.035 if e % 2 else 0.05)

# ---- music box melody (eighth-note grid, None = rest)
BOX = [(1, 0.9, 0.9), (2.76, 0.35, 0.28), (5.4, 0.18, 0.12), (8.93, 0.08, 0.06)]
A1 = ['A5', None, 'E5', None, 'C5', None, 'B4', None,   'C5', None, 'A4', None, None, None, None, None,
      'D5', None, 'F5', None, 'E5', None, 'D5', None,   'C5', None, 'B4', None, 'G#4', None, None, None]
A2 = ['A5', None, 'E5', None, 'C6', None, 'B5', None,   'A5', None, None, None, 'E5', None, None, None,
      'F5', None, 'E5', None, 'D5', None, 'C5', None,   'B4', None, 'C5', None, 'B4', None, 'G#4', None]
B1 = ['E5', None, None, None, 'C5', None, None, None,   'A4', None, None, None, None, None, None, None,
      'D5', None, None, None, 'F5', None, 'E5', None,   'D#5', None, 'E5', None, None, None, None, None]
NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
def midi(n): return 12 * (int(n[-1]) + 1) + NOTE[n[:-1]]
for cycle, mel in [(1, A1), (2, A2), (3, B1)]:
    for i, n in enumerate(mel):
        if not n: continue
        start = cycle * 4 * BAR + i * BEAT / 2 + rng.uniform(0, 0.01)
        add(osc(hz(midi(n)), 1.6, start, BOX, 0.55, 0.002), start, 0.11)

# ---- theremin glide (bars 13-16): long sine notes sliding between pitches, with vibrato
glide = [('A4', 0.0, 2.0), ('C5', 2.0, 2.0), ('B4', 4.0, 1.5), ('G#4', 5.5, 2.5)]   # beats from bar 13 x2
tg0 = 12 * BAR; seg_len = int(8 * BEAT * 2 * SR)
f = np.zeros(seg_len)
for idx, (n, b0, bl) in enumerate(glide):
    i0, i1 = int(b0 * 2 * BEAT * SR), int((b0 + bl) * 2 * BEAT * SR)
    f[i0:i1] = hz(midi(n))
f[f == 0] = hz(midi('G#4'))
f = np.convolve(f, np.ones(int(0.18 * SR)) / int(0.18 * SR), mode='same')          # portamento
t = np.arange(seg_len) / SR
f *= 1 + 0.012 * np.sin(2 * np.pi * 5.6 * t) * np.clip(t / 1.5, 0, 1)
env = np.clip(t / 1.2, 0, 1) * np.clip((t[-1] - t) / 1.5, 0, 1)
ther = (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.12 * np.sin(4 * np.pi * np.cumsum(f) / SR)) * env
add(ther[:int((4 * BAR) * SR)], tg0, 0.05)

# ---- low drone pad
pad = np.zeros(N)
for m, a in [(33, 0.5), (40, 0.35), (45, 0.25)]:
    pad += a * np.sin(2 * np.pi * hz(m) * np.cumsum(wow) / SR + rng.uniform(0, 6))
pad *= 0.5 + 0.5 * np.sin(2 * np.pi * t_all / (4 * BAR) - np.pi / 2) ** 2
pad *= np.clip(t_all / 2, 0, 1) * np.clip((LOOP + TAIL - t_all) / 2, 0, 1)
mix += 0.035 * pad

# ---- tone: low-pass, warm saturation, small dark room reverb
mix = sosfilt(butter(2, 4300, 'lowpass', fs=SR, output='sos'), mix)
mix = np.tanh(1.4 * mix) / 1.4
ir_t = np.arange(int(1.7 * SR)) / SR
ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.45); ir = sosfilt(butter(1, 2500, 'lowpass', fs=SR, output='sos'), ir); ir /= np.abs(ir).sum() ** 0.5 * 3
wet = fftconvolve(mix, ir)[:N]
mix = 0.8 * mix + 0.32 * wet

# ---- vinyl: hiss + crackle across the loop only (the tail overlaps the next pass)
loop_n = int(LOOP * SR)
hiss = sosfilt(butter(1, [300, 3500], 'bandpass', fs=SR, output='sos'), rng.standard_normal(loop_n)) * 0.006
clicks = np.zeros(loop_n); idx = rng.choice(loop_n - 50, size=int(LOOP * 7), replace=False)
clicks[idx] = rng.uniform(0.02, 0.09, len(idx)) * rng.choice([-1, 1], len(idx))
clicks = sosfilt(butter(2, 2200, 'highpass', fs=SR, output='sos'), clicks)
fade = np.minimum(1, np.minimum(np.arange(loop_n), loop_n - np.arange(loop_n)) / (0.05 * SR))
mix[:loop_n] += (hiss + clicks) * fade

mix *= 0.89 / np.abs(mix).max()
here = os.path.dirname(os.path.abspath(__file__)); repo = os.path.dirname(here)
wav = os.path.join(repo, 'audio', '_music.wav')
from scipy.io import wavfile
wavfile.write(wav, SR, (mix * 32767).astype(np.int16))
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-ar', '32000', '-c:a', 'libmp3lame', '-b:a', '64k', os.path.join(repo, 'audio', 'music.mp3')], check=True)
os.remove(wav)
print(f'LOOP = {LOOP:.4f} s  (file {LOOP + TAIL:.1f} s, {os.path.getsize(os.path.join(repo, "audio", "music.mp3")) // 1024} KB)')
