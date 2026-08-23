#!/usr/bin/env python3
"""Regenerates the app icons. No dependencies - writes PNGs by hand.

    python3 tools-icon.py            # rewrites icons/icon-{180,192,512}.png

The heat ramp is read straight out of index.html, so the icon cannot drift out
of step with the colours the list actually uses.
"""
import zlib, struct, math, re, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

def ramp_from_index(path=None):
    """Pull --h0..--h6 out of index.html so there is one source of truth."""
    path = path or os.path.join(HERE, 'index.html')
    css = open(path).read()
    out = []
    for i in range(7):
        m = re.search(r'--h%d:\s*#([0-9a-fA-F]{6})' % i, css)
        if not m:
            raise SystemExit('could not find --h%d in %s' % (i, path))
        h = m.group(1)
        out.append(tuple(int(h[j:j+2], 16) for j in (0, 2, 4)))
    return out

RAMP = ramp_from_index()
BG1, BG2 = (44, 44, 48), (22, 22, 26)


class Canvas:
    def __init__(self, size, F=4):
        self.S, self.F, self.W = size, F, size * F
        self.buf = [[None] * self.W for _ in range(self.W)]
        for y in range(self.W):                       # vertical graphite wash
            t = y / (self.W - 1)
            c = tuple(int(BG1[i] + (BG2[i] - BG1[i]) * t) for i in range(3))
            for x in range(self.W):
                self.buf[y][x] = c

    def rect(self, x0, y0, x1, y1, c, r=0):
        W = self.W
        x0, y0, x1, y1, r = [int(v * W) for v in (x0, y0, x1, y1, r)]
        for y in range(max(0, y0), min(W, y1)):
            for x in range(max(0, x0), min(W, x1)):
                if r:
                    dx = min(x - x0, x1 - 1 - x)
                    dy = min(y - y0, y1 - 1 - y)
                    if dx < r and dy < r and ((r - dx) ** 2 + (r - dy) ** 2) > r * r:
                        continue
                self.buf[y][x] = c

    def save(self, path):
        S, F = self.S, self.F
        out = bytearray()
        for y in range(S):                            # box-downsample the 4x buffer
            out.append(0)
            for x in range(S):
                r = g = b = 0
                for dy in range(F):
                    for dx in range(F):
                        p = self.buf[y * F + dy][x * F + dx]
                        r += p[0]; g += p[1]; b += p[2]
                n = F * F
                out += bytes((r // n, g // n, b // n))

        def chunk(tag, data):
            return (struct.pack('>I', len(data)) + tag + data
                    + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

        with open(path, 'wb') as f:
            f.write(b'\x89PNG\r\n\x1a\n'
                    + chunk(b'IHDR', struct.pack('>IIBBBBB', S, S, 8, 2, 0, 0, 0))
                    + chunk(b'IDAT', zlib.compress(bytes(out), 9))
                    + chunk(b'IEND', b''))


def heat_bars(path, size):
    """Headline bars, each a step of the heat ramp, hottest at the top."""
    c = Canvas(size)
    widths = [.62, .54, .58, .46, .50]
    top, h, gap = .215, .088, .048
    for i, w in enumerate(widths):
        y = top + i * (h + gap)
        c.rect(.20, y, .20 + w, y + h, RAMP[i], .026)
    c.save(path)


if __name__ == '__main__':
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'icons')
    for s in (180, 192, 512):
        p = os.path.join(out_dir, 'icon-%d.png' % s)
        heat_bars(p, s)
        print('wrote', p)
    print('ramp:', ' '.join('#%02x%02x%02x' % c for c in RAMP))
