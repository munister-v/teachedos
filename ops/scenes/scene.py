"""A small kit for Picture Studio scenes (scripts/scene-studio.js).

A scene is a line drawing in px (y down) plus the words pinned on it. It is
written to data/scenes/<id>.json, which the studio draws as SVG:

    items   drawn in order, so a later item's paper fill hides what is behind
            {d, s: 'main'|'det'|'hair'|None, f: None|fill key, t: ms}
            main strokes draw on one by one (t = start), det/hair fade in
    rooms   {id, word, ...card fields, box, label: [x, y]}
    parts   {id, word, ipa, pos, level, room, def, ex, us?, pin, box}

Fill keys (the studio maps them to colours): paper, wall, wood, glass,
tint, lime, ink, earth.
"""
import json
import math

F = lambda v: f"{v:.1f}".rstrip("0").rstrip(".")


def pts(points, close=False):
    out = "".join(("M" if i == 0 else "L") + f"{F(x)} {F(y)}" for i, (x, y) in enumerate(points))
    return out + ("Z" if close else "")


def line(x1, y1, x2, y2):
    return pts([(x1, y1), (x2, y2)])


def rect(x, y, w, h, r=0):
    if not r:
        return pts([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], close=True)
    r = min(r, w / 2, h / 2)
    return (f"M{F(x + r)} {F(y)}H{F(x + w - r)}A{F(r)} {F(r)} 0 0 1 {F(x + w)} {F(y + r)}"
            f"V{F(y + h - r)}A{F(r)} {F(r)} 0 0 1 {F(x + w - r)} {F(y + h)}"
            f"H{F(x + r)}A{F(r)} {F(r)} 0 0 1 {F(x)} {F(y + h - r)}"
            f"V{F(y + r)}A{F(r)} {F(r)} 0 0 1 {F(x + r)} {F(y)}Z")


def circle(cx, cy, r):
    return f"M{F(cx - r)} {F(cy)}A{F(r)} {F(r)} 0 1 0 {F(cx + r)} {F(cy)}A{F(r)} {F(r)} 0 1 0 {F(cx - r)} {F(cy)}Z"


def ellipse(cx, cy, rx, ry):
    return f"M{F(cx - rx)} {F(cy)}A{F(rx)} {F(ry)} 0 1 0 {F(cx + rx)} {F(cy)}A{F(rx)} {F(ry)} 0 1 0 {F(cx - rx)} {F(cy)}Z"


def wave(x1, y1, x2, y2, n=4, amp=3):
    """A wavy line (curtains, smoke), as quadratic curves."""
    d = f"M{F(x1)} {F(y1)}"
    dx, dy = (x2 - x1) / n, (y2 - y1) / n
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L
    for i in range(n):
        sx, sy = x1 + dx * i, y1 + dy * i
        s = amp if i % 2 == 0 else -amp
        d += f"Q{F(sx + dx / 2 + nx * s)} {F(sy + dy / 2 + ny * s)} {F(sx + dx)} {F(sy + dy)}"
    return d


def blob(cx, cy, rx, ry, n=9, bump=0.18, seed=1):
    """A cloudy outline (tree crowns, hedges): arcs bulging outwards."""
    import random
    rnd = random.Random(seed)
    ps = []
    for i in range(n):
        a = 2 * math.pi * i / n + rnd.uniform(-0.12, 0.12)
        k = 1 + rnd.uniform(-0.06, 0.06)
        ps.append((cx + rx * k * math.cos(a), cy + ry * k * math.sin(a)))
    d = f"M{F(ps[0][0])} {F(ps[0][1])}"
    for i in range(n):
        (x1, y1), (x2, y2) = ps[i], ps[(i + 1) % n]
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        ox, oy = mx - cx, my - cy
        L = math.hypot(ox, oy) or 1
        b = bump * math.hypot(x2 - x1, y2 - y1) * 1.6
        d += f"Q{F(mx + ox / L * b)} {F(my + oy / L * b)} {F(x2)} {F(y2)}"
    return d + "Z"


class Scene:
    def __init__(self, sid, w, h):
        self.id, self.w, self.h = sid, w, h
        self.items, self.parts, self.rooms = [], [], []
        self.t = 0
        self.meta = {}

    def at(self, ms):
        self.t = ms

    def add(self, d, s="main", f=None, step=None):
        self.items.append({"d": d, "s": s, "f": f, "t": self.t})
        if s == "main":
            self.t += 28 if step is None else step
        return d

    # shorthands
    def M(self, d, f=None, step=None):
        return self.add(d, "main", f, step)

    def D(self, d, f=None):
        return self.add(d, "det", f)

    def H(self, d):
        return self.add(d, "hair", None)

    def fill(self, d, f):
        return self.add(d, None, f)

    def room(self, rid, word, box, label, **card):
        self.rooms.append(dict(id=rid, word=word, box=list(box), label=list(label), **card))

    def part(self, pid, word, pin, box, **card):
        self.parts.append(dict(id=pid, word=word, pin=list(pin), box=list(box), **card))

    def save(self, path, **extra):
        data = dict(id=self.id, w=self.w, h=self.h, **self.meta, **extra,
                    rooms=self.rooms, parts=self.parts, items=self.items)
        with open(path, "w") as fh:
            json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))

    def svg(self, path):
        """A plain preview (all layers, pins as dots) for checking the drawing."""
        col = dict(paper="#FBFAF6", wall="#F3F0E6", wood="#E8DFCB", glass="#E4ECEE", tint="#ECE8DC",
                   lime="#CDF649", ink="#24282C", earth="#E6DFD0")
        sw = dict(main=1.7, det=1.1, hair=0.6)
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}">',
               f'<rect width="{self.w}" height="{self.h}" fill="#FBFAF6"/>']
        for it in self.items:
            fill = col.get(it["f"], "none") if it["f"] else "none"
            stroke = f'stroke="#24282C" stroke-width="{sw[it["s"]]}"' if it["s"] else 'stroke="none"'
            out.append(f'<path d="{it["d"]}" fill="{fill}" {stroke} stroke-linejoin="round" stroke-linecap="round"/>')
        for p in self.parts:
            x, y = p["pin"]
            out.append(f'<circle cx="{x}" cy="{y}" r="6" fill="#CDF649" stroke="#24282C" stroke-width="1.5"/>')
            out.append(f'<text x="{x + 8}" y="{y - 6}" font-size="10" font-family="Helvetica" fill="#b0461f">{p["word"]}</text>')
        for r in self.rooms:
            x, y = r["label"]
            out.append(f'<text x="{x}" y="{y}" font-size="11" font-weight="700" font-family="Helvetica" fill="#24282C">{r["word"].upper()}</text>')
        out.append("</svg>")
        with open(path, "w") as fh:
            fh.write("\n".join(out))
