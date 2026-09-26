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
    lav2="#D8CFEA", mint2="#BFE2D1", asphalt="#CFCBC3", shadow="rgba(36,40,44,.12)", skyg="url(#scsky)", glassa="rgba(196,222,236,.42)",
    skin1="#F3D5B5", skin2="#DDAA80", skin3="#A87550", hairb="#6B4A34", hairy="#E2BC62",
    leaf2="#A6C882", leaf3="#D6E8BD", bark="#B08A62", shade="rgba(36,40,44,.07)",
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
        # soft shade where the wall meets the floor and the ceiling: depth
        for i, hh in enumerate((14, 7, 3)):
            self.fill(rect(x, y + h - hh, w, hh), "shade")
        for hh in (8, 3):
            self.fill(rect(x, y, w, hh), "shade")
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
    # ── people ────────────────────────────────────────────────────────────
    SKINS = ("wood", "skin1", "skin2", "skin3")
    HAIRS = ("short", "long", "bun", "curly", "short", "long")
    HAIRC = ("ink", "hairb", "hairy", "hairb", "ink", "brick")

    def _pick(self, seed, opts):
        return opts[int(abs(seed)) % len(opts)]

    def limb(self, x1, y1, x2, y2, w, fill, cap=True):
        """An arm or a leg: a rounded band from (x1, y1) to (x2, y2)."""
        L = math.hypot(x2 - x1, y2 - y1) or 1
        nx, ny = -(y2 - y1) / L * w / 2, (x2 - x1) / L * w / 2
        r = w / 2
        f = lambda v: F(v)
        d = (f"M{f(x1 + nx)} {f(y1 + ny)}L{f(x2 + nx)} {f(y2 + ny)}"
             f"A{f(r)} {f(r)} 0 0 1 {f(x2 - nx)} {f(y2 - ny)}L{f(x1 - nx)} {f(y1 - ny)}"
             + (f"A{f(r)} {f(r)} 0 0 1 {f(x1 + nx)} {f(y1 + ny)}Z" if cap else "Z"))
        self.D(d, fill)

    def head(self, hx, hy, r, d, skin, hair, hairc, cap=None, mask=False):
        """A friendly head: hair, face, eyes and a small smile."""
        n = lambda v: round(v, 1)
        if cap:
            hair = "none"
        if hair == "long":
            self.D(f"M{n(hx - r * 1.08)} {n(hy)}Q{n(hx)} {n(hy - r * 1.9)} {n(hx + r * 1.08)} {n(hy)}"
                   f"L{n(hx + r * 1.12)} {n(hy + r * 1.35)}Q{n(hx)} {n(hy + r * 1.55)} {n(hx - r * 1.12)} {n(hy + r * 1.35)}Z", hairc)
        if hair == "bun":
            self.D(circle(n(hx - d * r * 0.55), n(hy - r * 1.05), n(r * 0.48)), hairc)
        self.M(circle(n(hx), n(hy), n(r)), skin)
        if hair in ("short", "long", "bun"):
            self.D(f"M{n(hx - r * 1.02)} {n(hy - r * 0.05)}Q{n(hx - r * 0.2)} {n(hy - r * 1.55)} {n(hx + r * 1.02)} {n(hy - r * 0.2)}"
                   f"Q{n(hx + d * r * 0.1)} {n(hy - r * 0.55)} {n(hx - r * 1.02)} {n(hy - r * 0.05)}Z", hairc)
        elif hair == "curly":
            self.D("".join(circle(n(hx + r * math.cos(a) * 0.82), n(hy - r * 0.35 + r * math.sin(a) * 0.62), n(r * 0.38))
                           for a in [math.radians(t) for t in (-180, -145, -110, -70, -35, 0)]), hairc)
        if cap:
            self.D(f"M{n(hx - r * 1.15)} {n(hy - r * 0.2)}Q{n(hx)} {n(hy - r * 1.85)} {n(hx + r * 1.15)} {n(hy - r * 0.2)}Z", cap)
        ex = hx + d * r * 0.18
        self.fill(circle(n(ex - r * 0.3), n(hy + r * 0.05), n(max(0.9, r * 0.1))) + circle(n(ex + r * 0.3), n(hy + r * 0.05), n(max(0.9, r * 0.1))), "ink")
        if mask:
            self.D(rect(n(hx - r * 0.85), n(hy + r * 0.2), n(r * 1.7), n(r * 0.65), 2), "lime")
        else:
            self.D(f"M{n(ex - r * 0.28)} {n(hy + r * 0.42)}Q{n(ex)} {n(hy + r * 0.62)} {n(ex + r * 0.28)} {n(hy + r * 0.42)}")

    def standing(self, x, yf, coat="paper", h=None, d=1, arms=None, cap=None, mask=False, legs="tint", k=1.0,
                 skin=None, hair=None, hairc=None):
        """A standing figure, feet at (x, yf), facing d (1 right, -1 left), k = scale.
        arms: None (hanging) or [(hx, hy)] hand points for the arm nearer the viewer;
        with two points, the second is the far arm."""
        n = lambda v: round(v, 1)
        seed = x * 7 + yf
        skin = skin or self._pick(seed, self.SKINS)
        hair = hair or self._pick(seed / 3, self.HAIRS)
        hairc = hairc or self._pick(seed / 5, self.HAIRC)
        h = h or 118 * k
        s = h / (118 * k)                     # a shorter figure (a child) keeps its width
        ht = yf - h
        ys, yh = ht + 22 * k * s, yf - 46 * k * s
        near = (arms or [None])[0] or (x + 16 * d * k, ys + 44 * k * s)
        far = arms[1] if arms and len(arms) > 1 else (x - 10 * d * k, ys + 44 * k * s)
        # far arm, behind the body
        self.limb(n(x - 9 * d * k), n(ys + 5 * k), n(far[0]), n(far[1]), n(6.5 * k), coat)
        self.D(circle(n(far[0]), n(far[1]), n(3.4 * k)), skin)
        # legs and shoes
        for lx in (x - 5.5 * k, x + 5.5 * k):
            self.limb(n(lx), n(yh - 6 * k), n(lx + d * 0.5 * k), n(yf - 4 * k), n(7.5 * k), legs, cap=False)
            self.D(f"M{n(lx - 4 * k)} {n(yf)}V{n(yf - 5 * k)}Q{n(lx)} {n(yf - 8 * k)} {n(lx + d * 9 * k)} {n(yf - 3 * k)}V{n(yf)}Z", "ink")
        # body
        self.M(f"M{n(x - 13 * k)} {n(ys + 3 * k)}Q{n(x - 15 * k)} {n(ys)} {n(x - 10 * k)} {n(ys)}H{n(x + 10 * k)}Q{n(x + 15 * k)} {n(ys)} {n(x + 13 * k)} {n(ys + 3 * k)}"
               f"L{n(x + 17 * k)} {n(yh)}H{n(x - 17 * k)}Z", coat)
        self.D(f"M{n(x - 5 * k)} {n(ys)}L{n(x)} {n(ys + 7 * k)}L{n(x + 5 * k)} {n(ys)}", "paper")     # collar
        # near arm
        self.limb(n(x + 11 * d * k), n(ys + 5 * k), n(near[0]), n(near[1]), n(6.5 * k), coat)
        self.D(circle(n(near[0]), n(near[1]), n(3.4 * k)), skin)
        # neck and head
        self.D(rect(n(x - 3 * k), n(ys - 6 * k), n(6 * k), n(7 * k)), skin)
        hx, hy = n(x + 2 * d * k), n(ht + 9 * k)
        self.head(hx, hy, 9 * k, d, skin, hair, hairc, cap=cap, mask=mask)
        return dict(head=(hx, hy), neck=(x, ys), ys=ys, yh=yh)

    def bust(self, x, y_counter, d=1, coat="paper", k=1.0, skin=None, hair=None, hairc=None):
        """Head and shoulders of someone standing behind a counter."""
        n = lambda v: round(v, 1)
        seed = x * 5 + y_counter
        skin = skin or self._pick(seed, self.SKINS)
        hair = hair or self._pick(seed / 3, self.HAIRS)
        hairc = hairc or self._pick(seed / 5, self.HAIRC)
        y = y_counter
        self.M(f"M{n(x - 18 * k)} {y}L{n(x - 16 * k)} {n(y - 26 * k)}Q{x} {n(y - 32 * k)} {n(x + 16 * k)} {n(y - 26 * k)}L{n(x + 18 * k)} {y}Z", coat)
        self.D(f"M{n(x - 5 * k)} {n(y - 30 * k)}L{x} {n(y - 23 * k)}L{n(x + 5 * k)} {n(y - 30 * k)}", "paper")
        self.D(rect(n(x - 3 * k), n(y - 36 * k), n(6 * k), n(8 * k)), skin)
        self.head(n(x + d * k), n(y - 44 * k), 9 * k, d, skin, hair, hairc)

    def sitting(self, x, ys, yf, coat="paper", legs="tint", d=-1, arms=None, k=1.0, skin=None, hair=None, hairc=None):
        """A seated figure: hips at (x, ys) on the seat, feet on the floor at yf,
        facing d (-1 left, 1 right). arms: hand points for the near arm."""
        n = lambda v: round(v, 1)
        seed = x * 3 + ys
        skin = skin or self._pick(seed, self.SKINS)
        hair = hair or self._pick(seed / 3, self.HAIRS)
        hairc = hairc or self._pick(seed / 5, self.HAIRC)
        t = 50 * k
        top = ys - t
        kx = x + d * 30 * k
        self.limb(n(x), n(ys - 4 * k), n(kx), n(ys - 4 * k), n(9 * k), legs)          # thigh
        self.limb(n(kx), n(ys - 4 * k), n(kx), n(yf - 4 * k), n(7.5 * k), legs, cap=False)   # shin
        self.D(f"M{n(kx - 4 * k)} {n(yf)}V{n(yf - 5 * k)}Q{n(kx)} {n(yf - 8 * k)} {n(kx + d * 9 * k)} {n(yf - 3 * k)}V{n(yf)}Z", "ink")
        self.M(f"M{n(x - 12 * k)} {ys}L{n(x - 11 * k)} {n(top + 4)}Q{x} {n(top - 3)} {n(x + 11 * k)} {n(top + 4)}L{n(x + 12 * k)} {ys}Z", coat)
        self.D(f"M{n(x - 5 * k)} {n(top)}L{x} {n(top + 7 * k)}L{n(x + 5 * k)} {n(top)}", "paper")
        hand = (arms or [(x + d * 24 * k, ys - 14 * k)])[0]
        self.limb(n(x + d * 6 * k), n(top + 6 * k), n(hand[0]), n(hand[1]), n(6.5 * k), coat)
        self.D(circle(n(hand[0]), n(hand[1]), n(3.2 * k)), skin)
        self.D(rect(n(x - 3), n(top - 6), 6, 7), skin)
        hx, hy = n(x + 2 * d), n(top - 15 * k)
        self.head(hx, hy, 9 * k, d, skin, hair, hairc)
        return dict(head=(hx, hy), top=top)

    def tree(self, x, yg, cy, rx, ry, seed=1):
        """A tree: a bark trunk with two branches and a crown in three greens."""
        self.shadow(x, yg, rx * 0.7, 4)
        self.M(f"M{x - 7} {yg}Q{x - 4} {cy + ry * 0.5} {x - 5} {cy}H{x + 5}Q{x + 4} {cy + ry * 0.5} {x + 7} {yg}Z", "bark")
        self.D(f"M{x} {cy + ry * 0.6}L{x - rx * 0.35} {cy + ry * 0.1}M{x + 1} {cy + ry * 0.45}L{x + rx * 0.3} {cy}")
        self.M(blob(x, cy, rx, ry, 11, 0.2, seed=seed), "leaf")
        self.fill(blob(x + rx * 0.18, cy + ry * 0.3, rx * 0.72, ry * 0.52, 9, 0.2, seed=seed + 1), "leaf2")
        self.fill(blob(x - rx * 0.3, cy - ry * 0.35, rx * 0.42, ry * 0.3, 7, 0.2, seed=seed + 2), "leaf3")
        self.H(blob(x + rx * 0.05, cy + ry * 0.3, rx * 0.72, ry * 0.52, 9, 0.2, seed=seed + 1))

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
