"""Cut the round-2/3 Gemini sheets (UI, icons, effects, math pieces, props, backgrounds) into game art.

    python3 tools/cut_ui.py UPLOAD_DIR

Sheets are split into grid cells (row bands, then items within each row). Within a cell, only strongly
drawn shapes are kept (faint smudges are dropped), small bits like sparkles stay with their cell, and
frames with see-through middles get their enclosed white removed.
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_art import cutout

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); ART = os.path.join(REPO, 'art')
def save(img, rel, q=88):
    p = os.path.join(ART, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    img.save(p, 'WEBP', quality=q, method=6, alpha_quality=100); return rel

def bands(mask, axis, gap):
    prof = mask.any(axis=axis); out, start, run = [], None, 0
    for i, v in enumerate(prof):
        if v:
            if start is None: start = i
            run = 0; last = i
        elif start is not None:
            run += 1
            if run >= gap: out.append((start, last + 1)); start = None
    if start is not None: out.append((start, last + 1))
    return out

def grid_cells(rgb, strong=200, gap=40, uniform=None):
    """reading-order list of (x0, y0, x1, y1) cell boxes"""
    H, W = rgb.shape[:2]
    if uniform:
        r, c = uniform; return [(int(j * W / c), int(i * H / r), int((j + 1) * W / c), int((i + 1) * H / r)) for i in range(r) for j in range(c)]
    m = rgb.min(axis=2) < strong; m = ndimage.binary_opening(m, iterations=1)
    out = []
    for y0, y1 in bands(m, 1, gap):
        for x0, x1 in bands(m[y0:y1], 0, gap): out.append((x0, y0, x1, y1))
    return out

def sprite(path, box, strong=200, pad=30, holes=False, keep_frac=0.004):
    im = Image.open(path).convert('RGB'); W, H = im.size
    x0, y0, x1, y1 = box; bx = (max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad))
    crop = im.crop(bx); tmp = '/tmp/_cut_cell.png'; crop.save(tmp)
    rgba = np.asarray(cutout(tmp)).copy(); rgb = np.asarray(crop).astype(np.int32)
    s = rgb.min(axis=2) < strong
    lab, n = ndimage.label(s, structure=np.ones((3, 3)))
    if n:
        areas = ndimage.sum(s, lab, range(1, n + 1)); keep = [i + 1 for i, a in enumerate(areas) if a >= max(25, keep_frac * areas.max())]
        mask = ndimage.binary_fill_holes(ndimage.binary_dilation(np.isin(lab, keep), iterations=6))
        rgba[:, :, 3] = np.where(mask, rgba[:, :, 3], 0)
    if holes:   # enclosed near-white areas (the middle of a frame) become see-through
        white = (rgb.min(axis=2) >= 225) & (rgba[:, :, 3] > 0)
        hl, hn = ndimage.label(white); big = rgba.shape[0] * rgba.shape[1] * 0.01
        cy, cx = rgba.shape[0] // 2, rgba.shape[1] // 2
        for i in range(1, hn + 1):
            reg = hl == i
            if reg.sum() >= big and (holes == 'all' or reg[cy - 3:cy + 4, cx - 3:cx + 4].any()):
                edge = ndimage.binary_dilation(reg, iterations=3) & ~reg
                rgba[:, :, 3][reg] = 0
                a = (255 - rgb[edge].max(axis=1)).clip(0, 255) / 255.0
                rgba[:, :, 3][edge] = np.minimum(rgba[:, :, 3][edge], (np.clip(a / 0.8, 0, 1) * 255).astype(np.uint8))
    a = rgba[:, :, 3] > 20; ys, xs = np.where(a)
    return Image.fromarray(rgba).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

def fit(img, side):
    s = side / max(img.size)
    return img if s >= 1 else img.convert('RGBa').resize((round(img.width * s), round(img.height * s)), Image.LANCZOS).convert('RGBA')

def run(U):
    f = lambda name: os.path.join(U, name)
    out = {}
    # ---- logo: everything (letters + sparkles)
    lp = f('ee07283d-image.jpg'); rgb = np.asarray(Image.open(lp).convert('RGB'))
    b = grid_cells(rgb, strong=235, gap=400); x0 = min(c[0] for c in b); y0 = min(c[1] for c in b); x1 = max(c[2] for c in b); y1 = max(c[3] for c in b)
    out['logo'] = save(fit(sprite(lp, (x0, y0, x1, y1), strong=235, keep_frac=0.0002), 900), 'ui/logo.webp')
    # ---- screen background (seamless-ish): mirror tile 2x2 so edges always match
    wl = Image.open(f('4bd0d689-image.jpg')).convert('RGB').resize((384, 384), Image.LANCZOS)
    tile = Image.new('RGB', (768, 768)); tile.paste(wl, (0, 0)); tile.paste(wl.transpose(Image.FLIP_LEFT_RIGHT), (384, 0))
    tile.paste(wl.transpose(Image.FLIP_TOP_BOTTOM), (0, 384)); tile.paste(wl.transpose(Image.ROTATE_180), (384, 384))
    out['wall'] = save(tile, 'bg/wall.webp', q=72)
    # ---- empty room backdrop (boss fight, end screens)
    out['room'] = save(Image.open(f('73c13a6a-image.jpg')).convert('RGB').resize((1024, 1024), Image.LANCZOS), 'bg/room.webp', q=74)
    # ---- hearts + math pieces (3x3)
    mp = f('c5981c16-image.jpg'); cells = grid_cells(np.asarray(Image.open(mp).convert('RGB')))
    names = ['heart', 'heart-empty', 'heart-crack', 'counter-red', 'counter-blue', 'board', 'bead-red', 'bead-cream', 'rack']
    assert len(cells) == 9, len(cells)
    pieces = {}
    for c, n in zip(cells, names):
        pieces[n] = sprite(mp, c, holes='all' if n == 'rack' else 'center' if n in ('heart-empty', 'bead-red', 'bead-cream') else False)
        out[n] = save(fit(pieces[n], 400 if n in ('board', 'rack') else 160), f'math/{n}.webp')
    # ten-frame board: grid of 2x5 boxes (find the box outlines inside the wooden border)
    bd = np.asarray(fit(pieces['board'], 400)); h, w = bd.shape[:2]
    dark = (bd[:, :, :3].max(axis=2) < 140) & (bd[:, :, 3] > 200)
    inner = np.zeros_like(dark); inner[int(h * .08):int(h * .92), int(w * .04):int(w * .96)] = True
    ys, xs = np.where(dark & inner)
    layout = {'board': {'x0': xs.min() / w, 'x1': (xs.max() + 1) / w, 'y0': ys.min() / h, 'y1': (ys.max() + 1) / h, 'aspect': w / h}}
    # bead rack: the two rods (opaque rows inside the see-through opening)
    rk = np.asarray(fit(pieces['rack'], 400)); h, w = rk.shape[:2]; a = rk[:, :, 3] > 128
    col = a[:, int(w * .45):int(w * .55)].mean(axis=1)
    open_rows = np.array([r for r in np.where(col < .5)[0] if .05 * h < r < .95 * h]); oy0, oy1 = open_rows.min(), open_rows.max()
    rods = [r for r in range(oy0, oy1) if col[r] >= .5]
    groups = np.split(np.array(rods), np.where(np.diff(rods) > 2)[0] + 1) if rods else []
    mid = int(oy0 + 2); row_open = np.array([x for x in np.where(a[mid] == 0)[0] if .05 * w < x < .95 * w])
    print('rack opening rows', oy0, oy1, 'of', h, '| rods at', [int(g.mean()) for g in groups])
    layout['rack'] = {'rods': [float(g.mean() / h) for g in groups if len(g)], 'x0': row_open.min() / w, 'x1': (row_open.max() + 1) / w,
                      'y0': oy0 / h, 'y1': oy1 / h, 'aspect': w / h}
    json.dump(layout, open(os.path.join(ART, 'math', 'layout.json'), 'w'), indent=1)
    # ---- panels (3x3)
    pp = f('d48bfd17-image.jpg'); cells = grid_cells(np.asarray(Image.open(pp).convert('RGB')))
    assert len(cells) == 9, len(cells)
    for c, n in zip(cells, ['tablet', 'sign', 'frame', 'plaque', 'bubble', 'ribbon', 'parchment', 'card', 'ring']):
        out[n] = save(fit(sprite(pp, c, holes='all' if n in ('frame', 'ring') else False), 512), f'panels/{n}.webp')
    # ---- interface icons (rows of 5, 5, 4, 4)
    ip = f('6fd3204b-image.jpg'); cells = grid_cells(np.asarray(Image.open(ip).convert('RGB')), gap=30)
    names = ['speaker', 'mute', 'pause', 'music', 'music-off', 'home', 'lock', 'target', 'arrow', 'swords',
             'bag', 'gift', 'shirt', 'bulb', None, 'comeback', None, 'gear']
    assert len(cells) == 18, len(cells)
    for c, n in zip(cells, names):
        if n: out[n] = save(fit(sprite(ip, c), 128), f'icons/{n}.webp')
    # ---- effects (4x4; faint glows kept)
    ep = f('be0592d2-image.jpg'); rgb = np.asarray(Image.open(ep).convert('RGB')); cells = grid_cells(rgb, strong=225, gap=30)
    names = ['flame', 'popper', 'sparkles', 'zap', 'snip', 'moon', 'bomb', 'burst', 'smoke', 'dizzy', 'up', 'down', 'candle', 'paws', 'gem-empty', 'gem']
    assert len(cells) == 16, len(cells)
    for c, n in zip(cells, names): out[n] = save(fit(sprite(ep, c, strong=225, keep_frac=0.002, holes='all' if n == 'dizzy' else False), 160), f'fx/{n}.webp')
    # ---- buttons (3 + 3)
    bp = f('67ea46a7-image.jpg'); cells = grid_cells(np.asarray(Image.open(bp).convert('RGB')))
    assert len(cells) == 6, len(cells)
    for c, n in zip(cells, ['chomp', 'dpad', 'square', 'gold', 'green', 'purple']): out[n] = save(fit(sprite(bp, c), 320), f'buttons/{n}.webp')
    # ---- doorway + stone (2x2): two full-bleed textures, arch, slab
    dp = f('ed3a0580-image.jpg'); cells = grid_cells(np.asarray(Image.open(dp).convert('RGB')), strong=235)
    assert len(cells) == 4, len(cells)
    src = Image.open(dp).convert('RGB')
    for c, n in zip(cells[:2], ['brick', 'cobble']):
        x0, y0, x1, y1 = c; inset = 6
        out[n] = save(src.crop((x0 + inset, y0 + inset, x1 - inset, y1 - inset)).resize((256, 256), Image.LANCZOS), f'bg/{n}.webp', q=78)
    out['arch'] = save(fit(sprite(dp, cells[2], strong=235, keep_frac=0.001), 320), 'props/arch.webp')
    out['slab'] = save(fit(sprite(dp, cells[3]), 256), 'props/slab.webp')
    # ---- props (uniform 3x3; the middle cell is a smudge and is skipped)
    rp = f('966267ef-image.jpg')
    names = ['pillar', 'torch', 'barrel', 'heap', None, 'coins', 'boulder', 'rocks', 'grass']
    W, H = Image.open(rp).size
    for c, n in zip([(int(j * W / 3), int(i * H / 3), int((j + 1) * W / 3), int((i + 1) * H / 3)) for i in range(3) for j in range(3)], names):
        if n: out[n] = save(fit(sprite(rp, c, strong=190, pad=0, keep_frac=0.12), 256), f'props/{n}.webp')
    print(len(out), 'pieces written'); return out

if __name__ == '__main__':
    run(sys.argv[1])
