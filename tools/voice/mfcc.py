import json, numpy as np
from scipy.io import wavfile
from scipy.fft import dct
S = '/tmp/claude-0/-home-claude-digit-dungeon/ea0c0165-9178-50a7-bb2e-cd230b08d9e6/scratchpad/voice'
sr, X = wavfile.read(f'{S}/full.wav'); X = X.astype(np.float32) / 32768
segs = json.load(open(f'{S}/fine.json'))

def mel_fb(n_fft, n_mels=26, fmin=80, fmax=7600):
    m = lambda f: 2595 * np.log10(1 + f / 700); im = lambda m_: 700 * (10 ** (m_ / 2595) - 1)
    pts = im(np.linspace(m(fmin), m(fmax), n_mels + 2)); bins = np.floor((n_fft + 1) * pts / sr).astype(int)
    fb = np.zeros((n_mels, n_fft // 2 + 1))
    for i in range(1, n_mels + 1):
        a, b, c = bins[i - 1], bins[i], bins[i + 1]
        fb[i - 1, a:b] = (np.arange(a, b) - a) / max(1, b - a); fb[i - 1, b:c] = (c - np.arange(b, c)) / max(1, c - b)
    return fb
FB = mel_fb(1024)
def mfcc(a, b):   # frame indices (10 ms) inclusive
    x = X[a * 240:(b + 1) * 240]; x = np.r_[x[0], x[1:] - .97 * x[:-1]]
    win, hop = 600, 240; n = max(1, 1 + (len(x) - win) // hop)
    fr = np.stack([x[i * hop:i * hop + win] * np.hamming(win) for i in range(n)])
    P = np.abs(np.fft.rfft(fr, 1024)) ** 2
    M = np.log(P @ FB.T + 1e-8); C = dct(M, type=2, axis=1, norm='ortho')[:, 1:13]
    return (C - C.mean(0)) / (C.std(0) + 1e-6)
def subdtw(q, r):
    d = np.sqrt(((q[:, None, :] - r[None, :, :]) ** 2).sum(-1))
    n, m = d.shape; D = np.full((n, m), np.inf); D[0] = d[0]
    for i in range(1, n):
        D[i, 0] = D[i - 1, 0] + d[i, 0]
        for j in range(1, m): D[i, j] = d[i, j] + min(D[i - 1, j], D[i - 1, j - 1], D[i, j - 1])
    return D[-1].min() / n
