"""Cut the round-4 closet sheets (hats, tops, shoes) into game art.

    python3 tools/cut_closet.py UPLOAD_DIR

Hats are cut like any sprite (art/hats/ID.webp) and placed on the hero by HAT_FIT in js/art.js.
Tops and shoes are pre-fitted: each art/tops/ID.webp and art/shoes/ID.webp is a 256x256 layer that lines up with
the 256x256 hero sprites, so the game just stacks them. Every hero color and mood has the same body outline.
  - tops: the little feet Gemini drew under each top are dropped, tan or white "body" showing through is made
    see-through (so the hero's own color shows), then the top is squashed into the belly (under the cheeks, above
    the feet) and trimmed to the body outline, keeping the hero's dark edge.
  - shoes: each pair overlaps, so the front shoe is separated from the back one (the back one is the same shoe
    shifted), and that shoe goes on the right foot and its mirror image on the left.
  - art/hero/face/COLOR-MOOD.webp: the mouth and cheeks for moods whose open mouth reaches below the collar
    (chomp, cheer, ouch), drawn on top of a top.
Closet buttons use ID-icon.webp (the top unsquashed, the shoe pair as drawn).
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_ui import grid_cells, sprite, fit, save, ART

SHEETS = {   # upload file -> names in reading order
    'hats1': ('c96a6d01-image.jpg', ['sunhat', 'apple', 'frog', 'flowers', 'bucket', 'mushroom', 'melon', 'blossom', 'bunny']),
    'hats2': ('c4de407e-image.jpg', ['cap', 'dragon', 'egg', 'sprout', 'zap', 'drop', 'tiara', 'gat', 'tiger']),
    'tops1': ('a5764fc7-image.jpg', ['island', 'sweater', 'overalls', 'sailor', 'apron', 'raincoat', 'bee', 'pajamas', 'robe']),
    'tops2': ('470e386a-image.jpg', ['vest', 'flame', 'bolt', 'dragon', 'stage', 'hanbok', 'holo', 'hunter', 'tiger']),
    'shoes': ('86cce1ff-image.jpg', ['frogboots', 'clogs', 'bunny', 'hightops', 'dragon', 'hiking', 'stage', 'wings', 'flower']),
}
SKIN = {'vest': 'white', 'stage': 'white', 'holo': 'white', 'sailor': 'tan', 'apron': 'tan', 'bee': 'tan'}
COLORS = ['mint', 'sky', 'peach', 'grape', 'pink', 'gold']
TOP_Y0, TOP_Y1, TOP_W = 150, 244, 214          # belly box on the 256 hero: under the cheeks down to the feet
FEET_X, SHOE_BOTTOM, SHOE_MAX_W, SHOE_MAX_H = (79, 177), 252, 58, 50

def hero_alpha(mood=''):
    return np.asarray(Image.open(os.path.join(ART, 'hero', f'mint{mood}.webp')).convert('RGBA'))[:, :, 3] > 128

def body_mask():
    b = hero_alpha(); b[238:] = False                       # body without the two feet
    return ndimage.binary_erosion(b, iterations=4)          # keep the hero's dark edge visible

# ---------- tops ----------
def hem_crop(a):
    """drop the feet under the hem: lowest row where the middle of the garment is still solid"""
    h, w = a.shape[:2]; al = a[:, :, 3] > 128
    rows = [y for y in range(h) if al[y, int(w * .42):int(w * .58)].all()]
    return a[:max(rows) + 3].copy()

def key_skin(a, kind):
    rgb = a[:, :, :3].astype(int); al = a[:, :, 3] > 128; h = al.shape[0]
    mx, mn = rgb.max(2), rgb.min(2); s = (mx - mn) / np.maximum(mx, 1); d = np.maximum(mx - mn, 1)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    cand = ((mn >= 228) & (s < .06) if kind == 'white' else (hue > 15) & (hue < 42) & (s > .15) & (s < .58) & (mx > 200)) & al
    lab, _ = ndimage.label(cand); out = a.copy(); tot = al.sum()
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        reg = lab == i
        if reg.sum() < tot * .006: continue
        if kind == 'white' and np.where(reg)[0].max() < h * .7: continue   # only the white body peeking out at the bottom
        out[:, :, 3][ndimage.binary_dilation(reg, iterations=3) & ~(mx < 110)] = 0
    return out

def worn_top(img, body):
    t = img.convert('RGBa').resize((TOP_W, TOP_Y1 - TOP_Y0), Image.LANCZOS).convert('RGBA')
    layer = Image.new('RGBA', (256, 256)); layer.alpha_composite(t, ((256 - TOP_W) // 2, TOP_Y0))
    la = np.asarray(layer).copy(); la[:, :, 3] = np.where(body, la[:, :, 3], 0)
    return Image.fromarray(la)

def face_layers():
    for mood in ['chomp', 'cheer', 'ouch']:
        a = np.asarray(Image.open(os.path.join(ART, 'hero', f'mint-{mood}.webp')).convert('RGBA')).astype(int)
        green = (a[:, :, 1] - np.maximum(a[:, :, 0], a[:, :, 2])) > 8        # body is easy to tell on the mint hero
        inner = ndimage.binary_erosion(a[:, :, 3] > 128, iterations=10)
        box = np.zeros(green.shape, bool); box[136:200, 40:216] = True
        m = ndimage.binary_dilation(box & inner & ~green, iterations=1) & (a[:, :, 3] > 128)
        for c in COLORS:                                                       # recoloring never moves the face
            h = np.asarray(Image.open(os.path.join(ART, 'hero', f'{c}-{mood}.webp')).convert('RGBA')).copy()
            h[:, :, 3] = np.where(m, h[:, :, 3], 0); save(Image.fromarray(h), f'hero/face/{c}-{mood}.webp')

# ---------- shoes ----------
def shift(m, dx, dy):
    out = np.zeros_like(m); h, w = m.shape
    out[max(0, dy):min(h, h + dy), max(0, dx):min(w, w + dx)] = m[max(0, -dy):min(h, h - dy), max(0, -dx):min(w, w - dx)]
    return out

def front_shoe(sp):
    """The back shoe is the front shoe moved left/up. Find that move, then the front shoe is every pixel that is
    still covered when the pair is moved back right/down."""
    a = np.asarray(sp).copy(); A = a[:, :, 3] > 100; sm = A[::4, ::4]; best = None
    for dx in range(int(sm.shape[1] * .25), int(sm.shape[1] * .75)):
        for dy in range(-int(sm.shape[0] * .2), int(sm.shape[0] * .2) + 1):
            u = sm & shift(sm, dx, dy); r = u | shift(u, -dx, -dy)
            iou = (r & sm).sum() / max(1, (r | sm).sum())
            if best is None or iou > best[0]: best = (iou, dx * 4, dy * 4)
    _, dx, dy = best
    u = ndimage.binary_opening(A & shift(A, dx, dy), iterations=2)
    lab, n = ndimage.label(u); u = ndimage.binary_fill_holes(lab == (np.argmax(ndimage.sum(u, lab, range(1, n + 1))) + 1))
    a[:, :, 3] = np.where(u, a[:, :, 3], 0); ys, xs = np.where(a[:, :, 3] > 20)
    return Image.fromarray(a).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

def worn_shoes(shoe):
    s = min(SHOE_MAX_W / shoe.width, SHOE_MAX_H / shoe.height); w, h = round(shoe.width * s), round(shoe.height * s)
    sh = shoe.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')
    layer = Image.new('RGBA', (256, 256))
    layer.alpha_composite(sh.transpose(Image.FLIP_LEFT_RIGHT), (FEET_X[0] - w // 2, SHOE_BOTTOM - h))
    layer.alpha_composite(sh, (FEET_X[1] - w // 2, SHOE_BOTTOM - h))
    return layer

def cells(path):
    c = grid_cells(np.asarray(Image.open(path).convert('RGB')), gap=30); assert len(c) == 9, (path, len(c)); return c

def run(U):
    out = []
    for key in ('hats1', 'hats2'):
        f, names = SHEETS[key]; p = os.path.join(U, f)
        for c, n in zip(cells(p), names):
            sp = sprite(p, c)
            if n == 'egg': sp = sp.transpose(Image.FLIP_TOP_BOTTOM)   # drawn as a cup; worn as the top half of the shell
            out.append(save(fit(sp, 256), f'hats/{n}.webp'))
    body = body_mask()
    for key in ('tops1', 'tops2'):
        f, names = SHEETS[key]; p = os.path.join(U, f)
        for c, n in zip(cells(p), names):
            a = hem_crop(np.asarray(sprite(p, c)).copy())
            if n in SKIN: a = key_skin(a, SKIN[n])
            img = Image.fromarray(a)
            out.append(save(worn_top(img, body), f'tops/{n}.webp')); out.append(save(fit(img, 160), f'tops/{n}-icon.webp'))
    f, names = SHEETS['shoes']; p = os.path.join(U, f)
    for c, n in zip(cells(p), names):
        sp = sprite(p, c)
        out.append(save(worn_shoes(front_shoe(sp)), f'shoes/{n}.webp')); out.append(save(fit(sp, 160), f'shoes/{n}-icon.webp'))
    face_layers()
    print(len(out), 'closet pieces + 18 face layers written')

if __name__ == '__main__':
    run(sys.argv[1])
