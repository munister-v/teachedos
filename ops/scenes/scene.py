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
from html import escape as esc

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


# Keep in step with FILL in scripts/scene-studio.js.
PALETTE = dict(
    paper="#FFFEFA", wall="#F3F0E6", wood="#E9D8BA", glass="#DDEBF1", tint="#ECE8DC", lime="#CDF649",
    ink="#24282C", earth="#DCCFB6", sage="#E4EBDC", sky="#E3ECF2", blush="#F6E6DF", sand="#F5ECD9",
    lav="#EAE6F2", mint="#E0F0E8", steel="#DDE1E5", brick="#DDA58F", grass="#C9DFA9", leaf="#C2DAA0",
    red="#E48A70", sun="#FFF1BF", sage2="#C8D8BC", sky2="#C8DDEA", blush2="#F0CDBF", sand2="#EBD9B4",
    lav2="#D8CFEA", mint2="#BFE2D1", asphalt="#CFCBC3", shadow="rgba(36,40,44,.12)", skyg="url(#scsky)",
)
STROKE = dict(main=1.7, det=1.1, hair=0.6, soft=0.8)
SKY = '<linearGradient id="scsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCEAF3"/><stop offset="1" stop-color="#F7F4EC"/></linearGradient>'


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

    def soft(self, d):
        """Faint lines: wallpaper, tiles, floorboards."""
        return self.add(d, "soft", None)

    def shadow(self, cx, y, rx, ry=3.5):
        return self.add(ellipse(cx, y, rx, ry), None, "shadow")

    def wallpaper(self, box, fill, pattern=None, dado=None):
        """A room's back wall: a colour, a faint pattern and an optional dado rail."""
        x, y, w, h = box
        self.fill(rect(x, y, w, h), fill)
        if pattern == "stripes":
            self.soft("".join(line(i, y, i, y + h) for i in range(int(x) + 10, int(x + w), 14)))
        elif pattern == "dots":
            self.soft("".join(circle(i + (7 if (j // 16) % 2 else 0), j, 0.9)
                              for j in range(int(y) + 12, int(y + h) - 4, 16) for i in range(int(x) + 8, int(x + w) - 4, 14)))
        elif pattern == "tiles":
            top = y + h * 0.45
            self.soft("".join(line(x, j, x + w, j) for j in range(int(top), int(y + h), 12))
                      + "".join(line(i, top, i, y + h) for i in range(int(x) + 12, int(x + w), 12)))
        elif pattern == "planks":
            self.soft("".join(line(x, j, x + w, j) for j in range(int(y) + 16, int(y + h), 16)))
        elif pattern == "bricks":
            rows = range(int(y) + 10, int(y + h), 10)
            self.soft("".join(line(x, j, x + w, j) for j in rows)
                      + "".join(line(i + (10 if (j // 10) % 2 else 0), j, i + (10 if (j // 10) % 2 else 0), j + 10)
                                for j in rows for i in range(int(x), int(x + w) - 10, 20)))
        if dado:
            yd = y + h - dado
            self.fill(rect(x, yd, w, dado), fill + "2" if fill + "2" in PALETTE else "tint")
            self.soft(line(x, yd, x + w, yd) + line(x, yd + 3, x + w, yd + 3))

    def sky(self, sun=None):
        self.fill(rect(0, 0, self.w, self.h), "skyg")
        if sun:
            cx, cy = sun
            self.fill(circle(cx, cy, 46), "sun")
            self.fill(circle(cx, cy, 30), "sun")

    def lawn(self, x0, x1, y):
        self.fill(rect(x0, y - 6, x1 - x0, 6), "grass")
        import random
        rnd = random.Random(int(x0))
        self.soft("".join(line(x, y - 5, x + rnd.uniform(-3, 3), y - 5 - rnd.uniform(4, 9))
                          for x in range(int(x0) + 3, int(x1), 5)))

    def room(self, rid, word, box, label, **card):
        self.rooms.append(dict(id=rid, word=word, box=list(box), label=list(label), **card))

    def part(self, pid, word, pin, box, **card):
        self.parts.append(dict(id=pid, word=word, pin=list(pin), box=list(box), **card))

    # ── people ────────────────────────────────────────────────────────────────
    def standing(self, x, yf, coat="paper", h=118, d=1, arms=None, cap=None, mask=False, legs="tint"):
        """A standing figure, feet at (x, yf), facing d (1 right, -1 left).
        arms: None (hanging) or [(hx, hy)] hand points for the arm nearer the viewer."""
        ht = yf - h
        ys, yh = ht + 22, yf - 46
        self.D(rect(x - 10, yh - 4, 7, yf - yh, 2) + rect(x + 3, yh - 4, 7, yf - yh, 2), legs)
        self.D(ellipse(x - 6 + 3 * d, yf - 2, 7, 3) + ellipse(x + 6 + 3 * d, yf - 2, 7, 3), "ink")
        self.M(f"M{x - 13} {ys + 3}Q{x - 15} {ys} {x - 10} {ys}H{x + 10}Q{x + 15} {ys} {x + 13} {ys + 3}"
            f"L{x + 17} {yh}H{x - 17}Z", coat)
        self.D(rect(x - 3, ys - 6, 6, 7), "wood")
        self.M(circle(x + 2 * d, ht + 9, 9), "wood")
        self.D(f"M{x - 8 + 2 * d} {ht + 6}Q{x + 2 * d} {ht - 4} {x + 9 + 2 * d} {ht + 5}Q{x + 2 * d} {ht + 2} {x - 8 + 2 * d} {ht + 6}Z", "ink")
        if cap:
            self.D(f"M{x - 9 + 2 * d} {ht + 6}Q{x + 2 * d} {ht - 7} {x + 11 + 2 * d} {ht + 6}Z", cap)
        if mask:
            self.D(rect(x - 2 + 5 * d - 5, ht + 10, 12, 6, 2), "lime")
        hands = arms or [(x + 16 * d, ys + 44)]
        for hx, hy in hands:
            self.D(f"M{x + 12 * d} {ys + 4}L{hx} {hy}", None)
            self.D(circle(hx, hy, 3), "wood")
        return dict(head=(x + 2 * d, ht + 9), neck=(x, ys), ys=ys, yh=yh)


    def bust(self, x, y_counter, d=1, coat="paper"):
        """Head and shoulders of someone standing behind a counter."""
        self.M(f"M{x - 18} {y_counter}L{x - 16} {y_counter - 26}Q{x} {y_counter - 32} {x + 16} {y_counter - 26}L{x + 18} {y_counter}Z", coat)
        self.D(rect(x - 3, y_counter - 36, 6, 8), "wood")
        self.M(circle(x + d, y_counter - 44, 9), "wood")
        self.D(f"M{x - 8} {y_counter - 47}Q{x} {y_counter - 57} {x + 9} {y_counter - 48}Q{x} {y_counter - 51} {x - 8} {y_counter - 47}Z", "ink")

    def save(self, path, **extra):
        data = dict(id=self.id, w=self.w, h=self.h, **self.meta, **extra,
                    rooms=self.rooms, parts=self.parts, items=self.items)
        with open(path, "w") as fh:
            json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))

    def svg(self, path):
        """A plain preview (all layers, pins as dots) for checking the drawing."""
        col, sw = PALETTE, STROKE
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}">',
               f'<defs>{SKY}</defs>',
               f'<rect width="{self.w}" height="{self.h}" fill="#FBFAF6"/>']
        for it in self.items:
            fill = col.get(it["f"], "none") if it["f"] else "none"
            stroke = (f'stroke="#24282C" stroke-width="{sw[it["s"]]}"' + (' stroke-opacity=".16"' if it["s"] == "soft" else "")) if it["s"] else 'stroke="none"'
            out.append(f'<path d="{it["d"]}" fill="{fill}" {stroke} stroke-linejoin="round" stroke-linecap="round"/>')
        for p in self.parts:
            x, y = p["pin"]
            out.append(f'<circle cx="{x}" cy="{y}" r="6" fill="#CDF649" stroke="#24282C" stroke-width="1.5"/>')
            out.append(f'<text x="{x + 8}" y="{y - 6}" font-size="10" font-family="Helvetica" fill="#b0461f">{esc(p["word"])}</text>')
        for r in self.rooms:
            x, y = r["label"]
            out.append(f'<text x="{x}" y="{y}" font-size="11" font-weight="700" font-family="Helvetica" fill="#24282C">{esc(r["word"].upper())}</text>')
        out.append("</svg>")
        with open(path, "w") as fh:
            fh.write("\n".join(out))
