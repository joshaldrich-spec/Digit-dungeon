"""Turn a Gemini image (white background) into a game sprite.

    python3 tools/process_art.py IN.png art/item-specs.webp                 # 256px, centered
    python3 tools/process_art.py IN.png art/boss4.webp --size 384 --anchor bottom
    python3 tools/process_art.py IN.png art/hero/NAME.webp --hero           # also writes every Closet color
    python3 tools/process_art.py IN.png art/floor-cellar.webp --keep-bg    # full-square textures

Hero sprites keep 14% headroom on top so hats sit on the head.
"""
import argparse, colorsys, os
import numpy as np
from PIL import Image
from scipy import ndimage

HERO_COLORS = {'sky': '#79c6ff', 'peach': '#ffab7a', 'grape': '#b48cff', 'pink': '#ff8fc7', 'gold': '#ffd54a'}

def cutout(path):
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    near_white = rgb.min(axis=2) >= 228
    lab, _ = ndimage.label(near_white)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    band = ndimage.binary_dilation(bg, iterations=4) & ~bg
    a_raw = (255 - rgb).max(axis=2) / 255.0
    alpha = np.ones(bg.shape, np.float32); alpha[bg] = 0
    a_b = a_raw[band]; alpha[band] = np.clip(a_b / 0.8, 0, 1)
    col = rgb.copy(); ab = np.maximum(a_b, 0.02)[:, None]
    col[band] = np.clip((rgb[band] - 255 * (1 - ab)) / ab, 0, 255)       # un-blend the white fringe
    solid = alpha > 0.05; l2, n2 = ndimage.label(solid)
    for i, s in enumerate(ndimage.sum(solid, l2, range(1, n2 + 1)), 1):
        if s < 40: alpha[l2 == i] = 0                                     # drop specks
    return Image.fromarray(np.dstack([col, alpha * 255]).astype(np.uint8), 'RGBA')

def place(im, size, frac, anchor, head):
    a = np.asarray(im)[:, :, 3] > 20; ys, xs = np.where(a)
    crop = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)); w, h = crop.size
    scale = min(size * frac / w, size * (frac - head) / h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    crop = crop.convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    y = size - nh - round(size * .03) if anchor == 'bottom' else (size - nh) // 2
    out.alpha_composite(crop, ((size - nw) // 2, y)); return out

def recolor(im, target_hex):
    arr = np.asarray(im).astype(np.float32) / 255; rgb, a = arr[:, :, :3], arr[:, :, 3]
    mx, mn = rgb.max(2), rgb.min(2); d = mx - mn; s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0); v = mx
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]; m = d > 1e-6; dd = np.maximum(d, 1e-6)
    h = np.zeros_like(mx); h = np.where(m & (mx == r), ((g - b) / dd) % 6, h); h = np.where(m & (mx == g), (b - r) / dd + 2, h); h = np.where(m & (mx == b), (r - g) / dd + 4, h); h *= 60
    green = a > 0
    ref = colorsys.rgb_to_hsv(*np.median(rgb[(a > .9) & (g > r + .15)], axis=0))
    sel = (h >= 95) & (h <= 190) & (s > .12) & (v > .12) & green
    th, ts, tv = colorsys.rgb_to_hsv(*[int(target_hex[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    ns = np.clip(s * ts / ref[1], 0, 1); nv = np.clip(v * tv / ref[2], 0, 1)
    hh = np.full_like(h, th * 6); i = np.floor(hh).astype(int) % 6; f = hh - np.floor(hh)
    p, q, t = nv * (1 - ns), nv * (1 - ns * f), nv * (1 - ns * (1 - f))
    conv = np.select([np.dstack([i == k] * 3) for k in range(6)], [np.dstack(c) for c in [(nv, t, p), (q, nv, p), (p, nv, t), (p, q, nv), (t, p, nv), (nv, p, q)]])
    out = rgb.copy(); out[sel] = conv[sel]
    return Image.fromarray((np.dstack([out, a]).clip(0, 1) * 255).astype(np.uint8), 'RGBA')

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dest')
    ap.add_argument('--size', type=int, default=256); ap.add_argument('--fill', type=float, default=.9)
    ap.add_argument('--anchor', choices=['center', 'bottom'], default='center')
    ap.add_argument('--hero', action='store_true'); ap.add_argument('--keep-bg', action='store_true')
    o = ap.parse_args()
    os.makedirs(os.path.dirname(o.dest) or '.', exist_ok=True)
    if o.keep_bg:
        Image.open(o.src).convert('RGB').resize((o.size, o.size), Image.LANCZOS).save(o.dest, 'WEBP', quality=86); print('wrote', o.dest)
    else:
        img = place(cutout(o.src), o.size, .92 if o.hero else o.fill, 'bottom' if o.hero else o.anchor, .14 if o.hero else 0)
        img.save(o.dest, 'WEBP', quality=90, method=6, alpha_quality=100); print('wrote', o.dest)
        if o.hero:   # art/hero/NAME.webp -> art/hero/NAME.webp is mint; other colors replace the leading "mint" if present
            base, name = os.path.split(o.dest)
            for c, hexc in HERO_COLORS.items():
                p = os.path.join(base, name.replace('mint', c) if 'mint' in name else f'{c}-{name}')
                recolor(img, hexc).save(p, 'WEBP', quality=90, method=6, alpha_quality=100); print('wrote', p)
