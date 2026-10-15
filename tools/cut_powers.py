"""Cut the round-5 sheet (math power icons, squash splat, surprise burst, peek eyes) into game art.

    python3 tools/cut_powers.py UPLOAD_DIR

The two ten-frame icons are built from the game's own board and counters instead: Gemini drew 3 rows of 5
(a ten-frame has 2), and its white sparkles/flash vanish when the white background is removed.
  Ten-Friend Blast = 6 red + 4 blue (a ten-friends pair) with a heart; Flash Frame = 7 red with sparkles.
"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_ui import grid_cells, sprite, fit, save, ART

SHEET = '89f37b00-image.jpg'
NAMES = ['double', None, None, 'parity', 'hop', 'fact', 'splat', 'surprise', 'peek']   # cells 2 + 3 are rebuilt below
BOARD = dict(x0=.0725, x1=.925, y0=.1298, y1=.7981)                                    # same as js/art.js BOARD

def ten_frame(fill, deco, deco_w):
    """fill: 10 entries of 'r', 'b' or '' in ten-frame order (top row first)"""
    board = Image.open(os.path.join(ART, 'math/board.webp')).convert('RGBA'); W, H = board.size
    c = Image.new('RGBA', (W + 80, H + 90)); ox, oy = 20, 60; c.alpha_composite(board, (ox, oy))
    cw, rh = (BOARD['x1'] - BOARD['x0']) * W / 5, (BOARD['y1'] - BOARD['y0']) * H / 2; d = int(min(cw, rh) * .8)
    chip = {k: Image.open(os.path.join(ART, f'math/counter-{v}.webp')).convert('RGBA').resize((d, d), Image.LANCZOS) for k, v in (('r', 'red'), ('b', 'blue'))}
    for i, f in enumerate(fill):
        if not f: continue
        row, col = divmod(i, 5); cx = ox + BOARD['x0'] * W + (col + .5) * cw; cy = oy + BOARD['y0'] * H + (row + .5) * rh
        c.alpha_composite(chip[f], (int(cx - d / 2), int(cy - d / 2)))
    dd = Image.open(os.path.join(ART, deco)).convert('RGBA'); s = deco_w / dd.width
    dd = dd.resize((int(dd.width * s), int(dd.height * s)), Image.LANCZOS)
    c.alpha_composite(dd, (int(W + ox - 12 - dd.width / 2), int(oy - dd.height / 2)))
    return c.crop(c.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())

def run(U):
    p = os.path.join(U, SHEET); cells = grid_cells(np.asarray(Image.open(p).convert('RGB')), strong=225, gap=30)
    assert len(cells) == 9, len(cells)
    out = []
    for c, n in zip(cells, NAMES):
        if not n: continue
        img = sprite(p, c, strong=225, keep_frac=0.002)
        out.append(save(fit(img, 200), f'{"powers" if n in ("double", "parity", "hop", "fact") else "fx"}/{n}.webp'))
    out.append(save(fit(ten_frame(list('rrrrrr') + list('bbbb'), 'math/heart.webp', 96), 200), 'powers/friends.webp'))
    out.append(save(fit(ten_frame(list('rrrrrrr') + [''] * 3, 'fx/sparkles.webp', 130), 200), 'powers/flash.webp'))
    print(len(out), 'pieces:', ', '.join(out))

if __name__ == '__main__':
    run(sys.argv[1])
