#!/usr/bin/env python3
"""Verify batch-1 gens in remaster/assets/gen/: distinct sha256, dims, alpha-bbox vs procedural ref.

For alpha assets, compares the gen's alpha-bbox (center + size, normalized) against the ref's
non-green bbox (the ref is exported on #00ff00). The engine re-normalizes parts at load, so this is
a sanity gate (subject present, silhouette honored), not a pixel gate.
"""
import hashlib, os, sys, colorsys, statistics
from PIL import Image

GEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'gen')
REFS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'refs')

def bbox_alpha(im):
    a = im.getchannel('A')
    return a.point(lambda v: 255 if v > 30 else 0).getbbox()

def bbox_nongreen(im):
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if not (g > 180 and r < 120 and b < 120):
                minx, miny, maxx, maxy = min(minx, x), min(miny, y), max(maxx, x), max(maxy, y)
    return None if maxx < 0 else (minx, miny, maxx + 1, maxy + 1)

def norm(b, size):
    w, h = size
    return ((b[0] + b[2]) / 2 / w, (b[1] + b[3]) / 2 / h, (b[2] - b[0]) / w, (b[3] - b[1]) / h)

def med_hue(im, smin=0.15):
    im = im.convert('RGBA')
    hs = []
    for r, g, b, a in im.getdata():
        if a > 200:
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > smin:
                hs.append(hh * 360)
    return statistics.median(hs) if hs else None

def green_fringe(im):
    """fraction of semi-transparent edge px that are distinctly green (chroma residue)."""
    im = im.convert('RGBA')
    edge = grn = 0
    for r, g, b, a in im.getdata():
        if 30 < a < 220:
            edge += 1
            if g > r + 40 and g > b + 40:
                grn += 1
    return (grn / edge if edge else 0.0), edge

names = sys.argv[1:] or sorted(n[:-4] for n in os.listdir(GEN) if n.endswith('.png'))
hashes = {}
print(f"{'name':30} {'dims':9} {'KB':>5} {'sha8':8} {'bbox(gen)':26} {'bbox(ref)':26} fringe")
for n in names:
    p = os.path.join(GEN, n + '.png')
    if not os.path.exists(p):
        print(f"{n:30} MISSING"); continue
    data = open(p, 'rb').read()
    sha = hashlib.sha256(data).hexdigest()[:8]
    hashes.setdefault(sha, []).append(n)
    im = Image.open(p).convert('RGBA')
    gb = bbox_alpha(im)
    gstr = 'EMPTY' if gb is None else 'c=%.2f,%.2f w=%.2f h=%.2f' % norm(gb, im.size)
    rp = os.path.join(REFS, (('player_free' if n == 'player_free' else 'player_focus') if n.startswith('player') else n.split('.styleB')[0]) + '.ref.png')
    rstr = '-'
    if os.path.exists(rp) and n not in ('title', 'scenery_spring_ground', 'scenery_spring_ground.styleB'):
        rim = Image.open(rp)
        rb = bbox_nongreen(rim)
        if rb: rstr = 'c=%.2f,%.2f w=%.2f h=%.2f' % norm(rb, rim.size)
    fr, edge = green_fringe(im)
    print(f"{n:30} {im.size[0]}x{im.size[1]:<5} {len(data)//1024:>5} {sha:8} {gstr:26} {rstr:26} {fr:.2%}/{edge}")
dups = {k: v for k, v in hashes.items() if len(v) > 1}
print('\nsha256 distinct:', 'OK (%d unique)' % len(hashes) if not dups else 'DUPLICATES: %s' % dups)
for n, want in (('enemy_body', 200), ('boss_twin_body', 265)):
    p = os.path.join(GEN, n + '.png')
    if os.path.exists(p):
        h = med_hue(Image.open(p))
        print(f"hue check {n}: median {h and round(h,1)} (target ~{want})")
