"""Cut a Gemini sprite sheet (objects on white) into separate transparent sprites.

    python3 tools/cut_sheet.py SHEET.jpg OUT_DIR name1 name2 ... [--size 256] [--fill .9]

Objects are found as connected shapes, ordered row by row (top to bottom, left to right) and
named in that order. Small bits (sparkles, dots) join the nearest object.
"""
import argparse, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from process_art import cutout

def find_objects(rgba, count):
    a = np.asarray(rgba)[:, :, 3] > 25
    lab, n = ndimage.label(a, structure=np.ones((3, 3)))
    objs = ndimage.find_objects(lab); areas = ndimage.sum(a, lab, range(1, n + 1))
    H, W = a.shape; big_min = H * W * 0.002
    boxes = [[s[0].start, s[1].start, s[0].stop, s[1].stop, [i + 1]] for i, s in enumerate(objs) if areas[i] >= big_min]
    small = [(s, i + 1) for i, s in enumerate(objs) if 20 <= areas[i] < big_min]
    def dist(b, c): return max(0, max(b[0], c[0]) - min(b[2], c[2])) + max(0, max(b[1], c[1]) - min(b[3], c[3]))
    while len(boxes) > count:                                   # merge the two closest pieces
        best = min(((dist(boxes[i], boxes[j]), i, j) for i in range(len(boxes)) for j in range(i + 1, len(boxes))))
        _, i, j = best; b, c = boxes[i], boxes[j]
        boxes[i] = [min(b[0], c[0]), min(b[1], c[1]), max(b[2], c[2]), max(b[3], c[3]), b[4] + c[4]]; del boxes[j]
    if len(boxes) != count: raise SystemExit(f'found {len(boxes)} objects, expected {count}')
    for s, lid in small:                                        # sparkles join the nearest object if close
        sb = [s[0].start, s[1].start, s[0].stop, s[1].stop]
        d, k = min((dist(sb, b), k) for k, b in enumerate(boxes))
        if d < 70:
            b = boxes[k]; boxes[k] = [min(b[0], sb[0]), min(b[1], sb[1]), max(b[2], sb[2]), max(b[3], sb[3]), b[4] + [lid]]
    boxes.sort(key=lambda b: (b[0] + b[2]) / 2)                 # rows: break where the centre jumps
    rows, cur = [], [boxes[0]]
    for b in boxes[1:]:
        if (b[0] + b[2]) / 2 - (cur[-1][0] + cur[-1][2]) / 2 > H * 0.12: rows.append(cur); cur = [b]
        else: cur.append(b)
    rows.append(cur)
    ordered = [b for r in rows for b in sorted(r, key=lambda b: b[1])]
    return ordered, lab

def crop_object(rgba, lab, b):
    arr = np.asarray(rgba).copy(); keep = np.isin(lab, b[4])
    arr[:, :, 3] = np.where(keep, arr[:, :, 3], 0)
    return Image.fromarray(arr, 'RGBA').crop((b[1], b[0], b[3], b[2]))

def fit_square(im, size, fill, anchor='center'):
    w, h = im.size; sc = size * fill / max(w, h); nw, nh = max(1, round(w * sc)), max(1, round(h * sc))
    im = im.convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    y = size - nh - round(size * .03) if anchor == 'bottom' else (size - nh) // 2
    out.alpha_composite(im, ((size - nw) // 2, y)); return out

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('sheet'); ap.add_argument('out'); ap.add_argument('names', nargs='+')
    ap.add_argument('--size', type=int, default=256); ap.add_argument('--fill', type=float, default=.9)
    o = ap.parse_args(); os.makedirs(o.out, exist_ok=True)
    rgba = cutout(o.sheet); boxes, lab = find_objects(rgba, len(o.names))
    for name, b in zip(o.names, boxes):
        fit_square(crop_object(rgba, lab, b), o.size, o.fill).save(f'{o.out}/{name}.webp', 'WEBP', quality=90, method=6, alpha_quality=100)
        print('wrote', f'{o.out}/{name}.webp')
