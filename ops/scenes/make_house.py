"""Picture Studio · The House — a two-storey house cut open like a doll's
house, with its garden and garage. Writes data/scenes/house.json and a
preview SVG in ops/scenes/out/.

    python3 ops/scenes/make_house.py
"""
import os
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob

ROOT = os.path.dirname(os.path.abspath(__file__))
S = Scene("house", 1400, 800)

G = 760              # ground
FF, FFs = 548, 560   # first floor surface, underside of its slab
AT, ATs = 336, 348   # attic floor, underside
XL, XR = 250, 1010   # outer faces of the house walls
WT = 12              # wall thickness

# roof: outer line eave → ridge → eave, inner line 18 px lower
RO = [(214, 352), (630, 120), (1046, 352)]
k = (352 - 120) / (630 - 214)


def roof_out(x):
    return 120 + abs(x - 630) * k


def roof_in(x):
    return 138 + abs(x - 630) * k


# ── sky and ground ────────────────────────────────────────────────────────
S.at(0)
S.sky(sun=(1260, 120))
S.fill(rect(0, G, 1400, 40), "earth")
S.M(line(0, G, 1400, G), step=0)
for x in range(6, 1400, 14):
    S.H(line(x, G + 6, x + 10, G + 16))
S.H(wave(1120, 70, 1210, 70, 3, 5) + wave(1135, 58, 1190, 58, 2, 4))
S.H(wave(90, 110, 170, 110, 3, 4) + wave(104, 99, 150, 99, 2, 3))

# ── the house shell ───────────────────────────────────────────────────────
S.at(150)
S.fill(rect(XL, ATs, XR - XL, G - ATs), "wall")                     # back walls
S.wallpaper((262, FFs, 208, G - FFs), "sand", "stripes", dado=46)          # hall
S.wallpaper((478, FFs, 312, G - FFs), "blush", "dots")                     # living room
S.wallpaper((798, FFs, 200, G - FFs), "mint", "tiles")                     # kitchen
S.wallpaper((262, ATs, 258, FF - ATs), "lav", "stripes")                   # landing
S.wallpaper((528, ATs, 212, FF - ATs), "sky", "tiles")                     # bathroom
S.wallpaper((748, ATs, 250, FF - ATs), "sage", "dots", dado=40)            # bedroom
S.fill(pts([(262, AT), (272, AT), (630, 138), (988, AT), (998, AT)], True), "sand")  # attic back
S.soft("".join(line(x, AT, x, 138 + abs(x - 630) * k) for x in range(300, 980, 34)))
S.M(rect(XL, ATs, WT, 620 - ATs), "ink", step=40)                    # left wall, above the door
S.M(rect(XR - WT, ATs, WT, G - ATs), "ink", step=40)                 # right wall
S.M(rect(262, AT, 736, 12), "ink", step=40)                          # attic floor
S.M(rect(462, FF, 536, 12), "ink", step=40)                          # first floor (stairwell open)
S.M(rect(262, FF, 20, 12), "ink")
S.M(rect(470, FFs, 8, 640 - FFs), "ink")                             # hall | living
S.M(rect(790, FFs, 8, 640 - FFs), "ink")                             # living | kitchen
S.M(rect(520, ATs, 8, 440 - ATs), "ink")                             # landing | bathroom
S.M(rect(740, ATs, 8, FF - ATs), "ink")                              # bathroom | bedroom
for x, y0 in ((470, 640), (790, 640), (520, 440)):                   # door frames
    S.D(rect(x - 3, y0, 14, 4))
# skirting boards
for a, b, y in ((262, 470, G), (478, 790, G), (798, 998, G), (462, 520, FF), (528, 740, FF), (748, 998, FF)):
    S.H(line(a, y - 5, b, y - 5))

# roof
roof = pts([(214, 352), (630, 120), (1046, 352), (1040, 360), (630, 138), (220, 360)], True)
S.M(roof, "brick", step=80)
for x in list(range(236, 624, 13)) + list(range(642, 1030, 13)):
    y1, y2 = roof_out(x), roof_in(x)
    S.H(line(x, y1 + 1.5, x + (-4 if x < 630 else 4), y2 - 1))
S.D(rect(204, 352, 16, 9, 4))                                        # gutters
S.D(rect(1040, 352, 16, 9, 4))

# chimney
S.at(700)
ch = pts([(740, roof_out(740)), (740, 92), (780, 92), (780, roof_out(780))])
S.M(ch + "Z", "brick")
S.M(rect(734, 84, 52, 8), "paper")
S.M(rect(750, 64, 16, 20), "paper")
S.D(rect(747, 62, 22, 4))
for i, y in enumerate(range(101, 200, 9)):
    top = y
    if top > roof_out(780):
        break
    S.H(line(740, y, 780, y))
    for x in range(746 + (i % 2) * 8, 780, 16):
        if y + 9 < roof_out(x):
            S.H(line(x, y, x, y + 9))
S.H(wave(758, 58, 790, 22, 3, 6) + wave(790, 22, 830, 6, 2, 5))
S.H(wave(766, 52, 812, 30, 3, 5))

# skylight in the right slope
sk = [(850, roof_out(850) - 1), (900, roof_out(900) - 1), (900, roof_in(900) + 1), (850, roof_in(850) + 1)]
S.M(pts(sk, True), "glass")
S.H(line(866, roof_out(866) + 2, 858, roof_in(858) - 2) + line(886, roof_out(886) + 2, 878, roof_in(878) - 2))

# drainpipe from the right gutter to the garage roof
S.D(rect(1046, 360, 7, FF - 360), "paper")
S.D(rect(1044, 360, 11, 6) + rect(1044, 530, 11, 6))
S.D(pts([(1046, FF), (1046, FF - 8), (1040, FF - 4)]))

# ── garden, left ──────────────────────────────────────────────────────────
S.at(1100)
S.tree(112, G, 528, 92, 78, seed=4)
S.lawn(0, 250, G)
S.lawn(1232, 1400, G)
# fence and gate
S.at(1400)
for x in range(20, 176, 16):
    S.D(pts([(x, G), (x, 706), (x + 5, 698), (x + 10, 706), (x + 10, G)], True), "paper")
S.D(rect(18, 716, 160, 5) + rect(18, 742, 160, 5))
S.D(rect(180, 704, 40, 56), "paper")                                 # gate
S.D(line(182, 758, 218, 706) + rect(180, 716, 40, 4) + rect(180, 742, 40, 4))
S.H(line(176, 700, 176, G) + line(224, 700, 224, G))
# flowers
for x, h in ((36, 680), (54, 672), (72, 684), (92, 676), (112, 686), (132, 678)):
    S.D(line(x, G - 2, x, h + 6) + wave(x, G - 18, x - 7, G - 26, 1, 2))
    S.D(pts([(x - 6, h), (x - 3, h + 8), (x + 3, h + 8), (x + 6, h), (x + 3, h + 4), (x, h - 2), (x - 3, h + 4)], True), "lime" if x % 36 else "red")

# porch canopy, doorstep, doorbell
S.at(1700)
S.M(pts([(XL, 604), (204, 618), (204, 624), (XL, 612)], True), "wood")
S.D(line(XL, 640, 212, 622) + line(212, 622, 212, 626))
S.D(rect(226, 752, 36, 8), "tint")
S.D(rect(242, 690, 8, 14, 2), "paper")
S.D(circle(246, 697, 2.2), "ink")
S.D(rect(XL, 616, WT, 6), "ink")                                      # lintel

# ── hall ──────────────────────────────────────────────────────────────────
S.at(1900)
# front door, opened into the hall
leaf = [(262, 622), (298, 632), (298, 756), (262, 760)]
S.M(pts(leaf, True), "red")
S.H(pts([(268, 636), (292, 642), (292, 686), (268, 684)], True) + pts([(268, 702), (292, 704), (292, 746), (268, 750)], True))
S.D(pts([(270, 652), (288, 657), (288, 660), (270, 655)], True), "ink")   # letterbox
S.D(circle(292, 694, 2.5), "ink")
S.D(pts([(266, 755), (322, 755), (326, G), (262, G)], True), "tint")      # doormat
S.H(line(270, 757.5, 318, 757.5))
# stairs rising to the right
n = 11
x0, x1 = 300, 462
r, tr = (G - FF) / n, (x1 - x0) / n
steps = [(x0, G)]
for i in range(n):
    x, y = x0 + tr * i, G - r * i
    steps += [(x, y - r), (x + tr, y - r)]
stair = pts(steps + [(x1, FFs), (x0 + 30, G)], True)
S.M(stair, "wood", step=60)
S.H(line(x0 + 30, G, x1, FFs + 2))
for i in range(0, n, 1):
    x, y = x0 + tr * i, G - r * (i + 1)
    S.H(line(x + 2, y + 2, x + tr - 1, y + 2))
# banister: newel posts, handrail, spindles
S.D(rect(x0 - 4, G - 58, 8, 58), "wood")
S.D(circle(x0, G - 62, 5), "wood")
S.D(rect(x1 - 4, FF - 52, 8, 52), "wood")
S.D(circle(x1, FF - 56, 5), "wood")
S.D(pts([(x0, G - 54), (x1, FF - 48)]))
for i in range(1, n):
    x = x0 + tr * i + tr / 2
    ytop = (G - 54) + (FF - 48 - (G - 54)) * (x - x0) / (x1 - x0)
    S.H(line(x, ytop, x, G - r * (i + 1)))

# ── living room ───────────────────────────────────────────────────────────
S.at(2600)
# window with curtains
S.M(rect(540, 598, 100, 64), "glass")
S.D(line(590, 598, 590, 662) + line(540, 630, 640, 630))
S.D(rect(534, 662, 112, 5), "paper")
S.H(line(548, 606, 562, 620) + line(600, 606, 616, 622))
S.D(line(522, 592, 658, 592))
S.D(pts([(524, 594), (548, 594), (544, 640), (548, 692), (526, 692), (530, 640)], True), "sky2")
S.D(pts([(632, 594), (656, 594), (652, 640), (656, 692), (634, 692), (638, 640)], True), "sky2")
S.H(wave(534, 598, 536, 688, 4, 2) + wave(644, 598, 646, 688, 4, 2))
# floor lamp
S.D(ellipse(500, 757, 11, 3), "ink")
S.D(line(500, 756, 500, 624))
S.M(pts([(490, 598), (510, 598), (518, 624), (482, 624)], True), "lime")
# sofa
S.shadow(595, 759, 80)
S.M(rect(536, 676, 118, 42, 8), "sage2")
S.M(rect(526, 716, 138, 34, 5), "sage2")
S.D(rect(540, 706, 56, 16, 5) + rect(596, 706, 54, 16, 5), "sage")
S.M(rect(516, 700, 24, 50, 8), "sage2")
S.M(rect(650, 700, 24, 50, 8), "sage2")
S.D(rect(530, 750, 6, 10) + rect(654, 750, 6, 10), "ink")
S.D(pts([(548, 704), (552, 686), (574, 684), (576, 704)], True), "lime")  # cushion
S.H(line(556, 694, 570, 693))
# rug, coffee table, plant
S.D(pts([(538, 756), (708, 756), (714, 761), (532, 761)], True), "red")
S.H(line(528, 756, 524, 761) + line(712, 756, 718, 761))
S.M(rect(562, 732, 82, 6, 2), "wood")
S.D(rect(568, 738, 5, 18) + rect(633, 738, 5, 18), "wood")
S.D(pts([(674, 738), (694, 738), (690, 756), (678, 756)], True), "brick")
for a, b, c in ((684, 738, 668), (684, 738, 700), (684, 738, 686)):
    S.D(f"M{a} {b}Q{(a + c) / 2 - 6} {b - 30} {c} {b - 40}Q{c + 4} {b - 20} {a} {b}Z", "leaf")
# fireplace, fire, mantel clock
S.M(rect(696, 662, 88, 94), "paper")
S.soft("".join(line(696, j, 784, j) for j in range(672, 756, 10)))
S.M(rect(690, 654, 100, 8, 2), "wood")
S.D(f"M714 756V700A26 26 0 0 1 766 700V756Z", "ink")
S.D("M724 756Q726 734 734 728Q732 742 740 736Q742 720 750 716Q748 736 756 740Q760 748 758 756Z", "lime")
S.D(rect(720, 748, 40, 6, 3), "wood")
S.D(rect(690, 756, 100, 4), "tint")
S.H(line(700, 670, 700, 752) + line(780, 670, 780, 752))
S.M(rect(724, 624, 28, 30, 6), "wood")
S.D(circle(738, 639, 9), "paper")
S.H(line(738, 639, 738, 633) + line(738, 639, 743, 641))
# picture on the wall is on the landing; the wall itself is pinned

# ── kitchen ───────────────────────────────────────────────────────────────
S.at(3300)
S.shadow(900, 759, 100)
S.M(rect(806, 620, 46, 140, 4), "paper")                             # fridge
S.D(line(806, 664, 852, 664))
S.D(rect(844, 632, 3, 20, 1.5) + rect(844, 672, 3, 30, 1.5), "ink")
S.D(rect(815, 628, 16, 10, 2))                                       # a note on the door
S.M(rect(854, 708, 138, 44), "paper")                                # base units
S.M(rect(852, 702, 142, 7, 1), "wood")                               # worktop
S.D(rect(854, 752, 138, 8), "tint")
S.D(line(898, 708, 898, 752) + line(948, 708, 948, 752))
S.D(rect(906, 722, 36, 24, 3), "glass")                              # oven door
S.D(line(906, 716, 942, 716))
for x in (910, 920, 930, 940):
    S.D(circle(x, 712, 1.6), "ink")
S.D(circle(892, 730, 1.8) + circle(954, 730, 1.8), "ink")
S.D(ellipse(914, 701, 9, 1.5) + ellipse(934, 701, 9, 1.5))           # hob rings
S.M("M866 702L864 684Q874 676 884 684L882 702Z", "paper")            # kettle
S.D("M884 688Q892 688 890 698M864 688L858 682")
S.D(rect(871, 677, 6, 4, 2), "ink")
S.D(pts([(952, 702), (986, 702), (982, 712), (956, 712)]))           # sink
S.D("M978 702V686Q978 680 972 680Q966 680 966 688")                  # tap
S.M(rect(940, 612, 50, 58), "glass")                                 # window
S.D(line(965, 612, 965, 670) + rect(936, 670, 58, 4))
S.H(line(946, 620, 958, 632))
S.M(rect(858, 590, 74, 50, 2), "sand2")                              # wall cupboards
S.D(line(895, 590, 895, 640) + circle(889, 628, 1.8) + circle(901, 628, 1.8))

# ── landing ───────────────────────────────────────────────────────────────
S.at(3900)
S.M(rect(330, 412, 72, 56, 2), "wood")                               # picture
S.D(rect(338, 420, 56, 40), "paper")
S.H("M340 456L356 436L368 450L378 440L392 456" + circle(382, 430, 4))
S.D(line(366, 404, 346, 412) + line(366, 404, 386, 412))

# ── bathroom ──────────────────────────────────────────────────────────────
S.at(4100)
S.D(line(534, 404, 648, 404))                                        # curtain rail
S.D("M548 506V424Q548 414 558 414H566", None)                        # shower pipe
S.D(pts([(564, 412), (578, 418), (576, 424), (562, 418)], True), "ink")
for i in range(5):
    S.H(line(570 + i * 2, 424, 566 + i * 7, 468))
S.D(pts([(536, 406), (556, 406), (552, 460), (558, 500), (538, 500)], True), "lav2")
S.H(wave(544, 408, 546, 496, 4, 2))
S.shadow(590, 547, 56)
S.M("M532 504H646Q644 544 616 546H564Q536 544 532 504Z", "paper")    # bath
S.D(line(538, 512, 640, 512))
S.D(rect(548, 544, 8, 4) + rect(620, 544, 8, 4), "ink")
S.M(rect(656, 406, 36, 52, 12), "glass")                             # mirror
S.H(line(664, 420, 676, 408) + line(664, 436, 686, 414))
S.M("M654 484H694Q694 500 680 502H668Q654 500 654 484Z", "paper")    # washbasin
S.D(rect(668, 502, 12, 46), "paper")
S.D("M674 484V476H682")
S.M(rect(704, 452, 30, 32, 3), "paper")                              # toilet cistern
S.D(rect(716, 446, 8, 4), "ink")
S.D(line(718, 484, 718, 496))
S.M("M700 500H738Q738 520 724 526L726 548H710L712 526Q700 520 700 500Z", "paper")
S.D(rect(698, 496, 42, 5, 2), "tint")
S.D(line(700, 402, 736, 402))                                        # towel rail
S.M(pts([(704, 402), (732, 402), (730, 440), (706, 440)], True), "lime")
S.H(line(705, 428, 731, 428) + line(705, 432, 731, 432))

# ── bedroom ───────────────────────────────────────────────────────────────
S.at(4700)
S.shadow(880, 547, 80)
S.M(rect(756, 396, 50, 152, 3), "wood")                              # wardrobe
S.D(line(781, 404, 781, 544) + rect(752, 390, 58, 6, 1))
S.D(circle(777, 470, 1.8) + circle(785, 470, 1.8), "ink")
S.M(rect(832, 398, 76, 60), "glass")                                 # window
S.D(line(870, 398, 870, 458) + rect(828, 458, 84, 4))
S.D(pts([(822, 392), (838, 392), (836, 430), (840, 470), (822, 470)], True), "blush2")
S.D(pts([(902, 392), (918, 392), (918, 470), (900, 470), (904, 430)], True), "blush2")
S.D(line(818, 390, 922, 390))
S.M(rect(946, 468, 12, 80, 3), "wood")                               # headboard
S.M(rect(812, 500, 10, 48, 2), "wood")                               # footboard
S.M(rect(820, 508, 128, 18), "paper")                                # mattress
S.D(rect(822, 526, 124, 6), "wood")
S.M(rect(906, 490, 40, 18, 8), "paper")                              # pillow
S.M("M820 504Q860 496 902 500Q912 506 910 524Q870 530 820 528Z", "sky2")  # duvet
S.H(wave(840, 504, 846, 524, 2, 2) + wave(872, 502, 878, 524, 2, 2))
S.D(rect(830, 532, 5, 16) + rect(936, 532, 5, 16), "ink")
S.M(rect(962, 510, 30, 38, 2), "wood")                               # bedside table
S.D(line(962, 524, 992, 524) + circle(977, 517, 1.6))
S.D(rect(974, 496, 6, 14), "ink")
S.D(pts([(968, 480), (986, 480), (990, 496), (964, 496)], True), "lime")

# ── attic ─────────────────────────────────────────────────────────────────
S.at(5300)
S.M(rect(470, 290, 62, 46, 2), "wood")                               # boxes
S.M(rect(482, 256, 40, 34, 2), "wood")
S.M(rect(534, 306, 36, 30, 2), "wood")
S.D(line(470, 300, 532, 300) + line(482, 266, 522, 266) + line(552, 306, 552, 336))
S.M(rect(700, 306, 70, 30, 6), "red")                                # suitcase
S.D("M724 306V300H746V306" + line(700, 316, 770, 316))
S.D(rect(710, 316, 4, 20) + rect(756, 316, 4, 20))
S.D(line(596, roof_in(596), 596, 206))                               # light bulb
S.D(rect(592, 206, 8, 6), "ink")
S.M(circle(596, 220, 8), "lime")
S.H(circle(596, 220, 14) + circle(596, 220, 20))
# cobweb under the ridge
cx, cy = 630, 142
for a, b in ((604, 156), (612, 172), (630, 180), (648, 172), (656, 156)):
    S.H(line(cx, cy, a, b))
S.H("M611 152Q622 156 624 166Q630 160 636 166Q638 156 649 152" + "M618 162Q626 170 630 174Q634 170 642 162")

# ── garage ────────────────────────────────────────────────────────────────
S.at(5800)
S.wallpaper((XR, FFs, 210, G - FFs), "steel", "bricks")
S.M(rect(XR, FF, 230, 12), "ink", step=40)                           # garage roof
S.M(rect(1220, FFs, 12, G - FFs), "ink", step=40)
S.H(line(XR, G - 5, 1220, G - 5))
# shelf with paint tins
S.D(rect(1076, 612, 130, 5), "wood")
S.D(line(1086, 617, 1094, 630) + line(1196, 617, 1188, 630))
for x in (1100, 1124):
    S.D(rect(x, 592, 18, 20, 2), "paper")
S.D(rect(1156, 596, 36, 16, 2), "lime")                              # toolbox
S.D("M1166 596V590H1182V596")
# ladder leaning on the house wall
for (a, b), (c, d) in (((1052, G), (1024, 584)), ((1070, G), (1040, 588))):
    S.D(line(a, b, c, d))
for i in range(1, 9):
    t = i / 9
    S.D(line(1052 + (1024 - 1052) * t, G - (G - 584) * t, 1070 + (1040 - 1070) * t, G - (G - 588) * t))
# bike
S.M(circle(1098, 736, 22), None)
S.M(circle(1166, 736, 22), None)
S.D(circle(1098, 736, 3) + circle(1166, 736, 3), "ink")
S.D(pts([(1098, 736), (1126, 736), (1116, 694), (1098, 736)]) + pts([(1116, 694), (1152, 694), (1166, 736)]) + line(1126, 736, 1156, 708))
S.D(pts([(1106, 690), (1124, 690)]) + pts([(1150, 694), (1148, 682), (1158, 680)]))
S.D(circle(1126, 736, 5))
# lawnmower
S.M(pts([(1180, 732), (1214, 732), (1216, 750), (1178, 750)], True), "lime")
S.D(circle(1184, 752, 6) + circle(1210, 752, 6), "paper")
S.D(pts([(1196, 732), (1206, 690), (1216, 690)]))

# ── right garden: hedge and bin ───────────────────────────────────────────
S.at(6400)
S.M(blob(1290, 724, 44, 36, 9, 0.22, seed=12) , "leaf")
S.fill(blob(1296, 736, 34, 20, 8, 0.2, seed=13), "leaf2")
S.fill(blob(1276, 708, 16, 10, 6, 0.2, seed=14), "leaf3")
S.H(blob(1276, 722, 14, 10, 5, 0.2, 2) + blob(1304, 734, 12, 9, 5, 0.2, 5))
S.fill(rect(1250, 750, 80, 10), "leaf")
S.M(pts([(1346, 710), (1382, 710), (1378, 758), (1350, 758)], True), "tint")
S.D(rect(1342, 702, 44, 8, 2), "ink")
S.D(circle(1376, 755, 5), "paper")
S.D(line(1356, 722, 1372, 722))

# ── rooms ─────────────────────────────────────────────────────────────────
R = dict
S.room("hall", "hall", (262, FFs, 208, G - FFs), (330, 592), level="A2", ipa="hɔːl", pos="noun",
       def_="The room just inside the front door. The stairs and the doors to other rooms start here.",
       ex="Leave your shoes in the hall, please.", us="hallway")
S.room("living", "living room", (478, FFs, 312, G - FFs), (488, 582), level="A1", ipa="ˈlɪvɪŋ ruːm", pos="noun",
       def_="The room where you sit, relax, talk and watch TV.",
       ex="We watch films in the living room on Friday night.", us="living room")
S.room("kitchen", "kitchen", (798, FFs, 200, G - FFs), (808, 582), level="A1", ipa="ˈkɪtʃɪn", pos="noun",
       def_="The room where you cook and keep food.", ex="Dad is making breakfast in the kitchen.")
S.room("landing", "landing", (262, ATs, 258, FF - ATs), (272, 370), level="B1", ipa="ˈlændɪŋ", pos="noun",
       def_="The space at the top of the stairs, with doors to the rooms upstairs.",
       ex="The bathroom is at the end of the landing.")
S.room("bathroom", "bathroom", (528, ATs, 212, FF - ATs), (538, 370), level="A1", ipa="ˈbɑːθruːm", pos="noun",
       def_="The room with a bath or shower, where you wash.", ex="Someone's in the bathroom - wait a minute!")
S.room("bedroom", "bedroom", (748, ATs, 250, FF - ATs), (758, 370), level="A1", ipa="ˈbedruːm", pos="noun",
       def_="The room where you sleep.", ex="My bedroom is small but it's got a big window.")
S.room("attic", "attic", (272, 138, 716, AT - 138), (360, 326), level="A2", ipa="ˈætɪk", pos="noun",
       def_="The space under the roof, often used to keep old things.", ex="Grandma's old photos are in a box in the attic.", us="attic")
S.room("garage", "garage", (XR, FFs, 210, G - FFs), (1020, 582), level="A1", ipa="ˈɡærɑːʒ", pos="noun",
       def_="A building or room where you keep a car or a bike.", ex="Put your bike in the garage when it rains.")
S.room("garden", "garden", (0, 440, 204, G - 440), (20, 460), level="A1", ipa="ˈɡɑːdn", pos="noun",
       def_="The land next to a house, with grass, flowers or trees.", ex="The children are playing in the garden.", us="yard")


def P(pid, word, level, room, pin, box, ipa, pos, d, ex, us=None):
    card = dict(level=level, room=room, ipa=ipa, pos=pos, def_=d, ex=ex)
    if us:
        card["us"] = us
    S.part(pid, word, pin, box, **card)


# outside
P("roof", "roof", "A1", "outside", (330, 296), (214, 120, 832, 242), "ruːf", "noun",
  "The top cover of a building.", "There's a cat on the roof!")
P("chimney", "chimney", "A2", "outside", (760, 140), (734, 60, 52, 130), "ˈtʃɪmni", "noun",
  "A pipe on the roof that takes smoke from a fire up into the air.", "Smoke is coming out of the chimney.")
P("skylight", "skylight", "B1", "attic", (875, 258), (846, 236, 58, 44), "ˈskaɪlaɪt", "noun",
  "A window in a roof.", "The skylight lets sunlight into the attic.")
P("gutter", "gutter", "B1", "outside", (212, 356), (200, 346, 26, 20), "ˈɡʌtə", "noun",
  "An open pipe along the edge of a roof that collects rainwater.", "The gutter is full of leaves.")
P("drainpipe", "drainpipe", "B1", "outside", (1050, 454), (1040, 356, 20, 194), "ˈdreɪnpaɪp", "noun",
  "A pipe that carries rainwater from the roof down to the ground.", "Water was pouring out of the broken drainpipe.", "downspout")
P("porch", "porch", "B1", "outside", (226, 614), (200, 600, 52, 42), "pɔːtʃ", "noun",
  "A small roof or shelter over the front door.", "We waited in the porch until the rain stopped.")
P("doorbell", "doorbell", "A2", "outside", (240, 697), (236, 686, 18, 22), "ˈdɔːbel", "noun",
  "A button by the front door that rings when visitors press it.", "The doorbell rang - it was the pizza!")
P("doorstep", "doorstep", "B1", "outside", (238, 752), (224, 748, 40, 14), "ˈdɔːstep", "noun",
  "The step just outside the front door.", "The postman left the parcel on the doorstep.")
P("fence", "fence", "A2", "garden", (132, 730), (16, 696, 164, 64), "fens", "noun",
  "A wooden or metal wall around a garden.", "Our dog can jump over the fence.")
P("gate", "gate", "A2", "garden", (200, 724), (178, 700, 46, 60), "ɡeɪt", "noun",
  "A door in a fence or wall.", "Please close the gate behind you.")
P("tree", "tree", "A1", "garden", (112, 612), (18, 446, 190, 314), "triː", "noun",
  "A tall plant with a trunk, branches and leaves.", "There's an old apple tree in our garden.")
P("flowers", "flowers", "A1", "garden", (54, 672), (28, 664, 112, 96), "ˈflaʊəz", "noun",
  "The coloured part of a plant; plants grown for their colour.", "She's planting flowers in front of the fence.")
P("hedge", "hedge", "B1", "outside", (1290, 718), (1244, 686, 92, 74), "hedʒ", "noun",
  "A line of bushes growing close together, like a green wall.", "Our neighbour cuts his hedge every Sunday.")
P("bin", "bin", "A2", "outside", (1364, 732), (1340, 698, 48, 62), "bɪn", "noun",
  "A big container for rubbish, kept outside.", "It's your turn to take the bin out.", "trash can")

# hall
P("frontdoor", "front door", "A1", "hall", (282, 720), (258, 618, 44, 142), "ˌfrʌnt ˈdɔː", "noun",
  "The main door at the front of a house.", "Don't forget to lock the front door.")
P("letterbox", "letterbox", "B1", "hall", (279, 654), (266, 646, 26, 16), "ˈletəbɒks", "noun",
  "A narrow opening in a front door for letters.", "A letter fell through the letterbox.", "mail slot")
P("doormat", "doormat", "B1", "hall", (312, 757), (262, 750, 66, 12), "ˈdɔːmæt", "noun",
  "A small mat by the door for cleaning your shoes on.", "Wipe your feet on the doormat!")
P("stairs", "stairs", "A1", "hall", (380, 670), (298, 548, 166, 212), "steəz", "noun",
  "Steps that go from one floor of a house to another.", "She ran up the stairs to her room.")
P("banister", "banister", "B1", "hall", (436, 520), (294, 494, 174, 180), "ˈbænɪstə", "noun",
  "The rail at the side of the stairs that you hold on to.", "Hold on to the banister - the stairs are steep.", "railing")
P("floor", "floor", "A1", "hall", (440, 757), (262, 750, 208, 10), "flɔː", "noun",
  "The flat surface you walk on inside a room.", "The keys are on the floor.")

# living room
P("wall", "wall", "A1", "living", (690, 600), (478, 560, 312, 200), "wɔːl", "noun",
  "One of the sides of a room or a building.", "There's a clock on the wall.")
P("window", "window", "A1", "living", (590, 614), (540, 598, 100, 64), "ˈwɪndəʊ", "noun",
  "An opening in a wall with glass, to let in light.", "Can you open the window? It's hot.")
P("curtains", "curtains", "A2", "living", (534, 650), (522, 590, 138, 104), "ˈkɜːtnz", "noun",
  "Pieces of cloth that you pull across a window.", "Close the curtains - it's dark outside.", "drapes")
P("lamp", "lamp", "A1", "living", (500, 612), (480, 594, 40, 166), "læmp", "noun",
  "A light that stands on the floor or on a table.", "Turn on the lamp so you can read.")
P("sofa", "sofa", "A1", "living", (622, 690), (514, 674, 162, 86), "ˈsəʊfə", "noun",
  "A long soft seat for two or more people.", "Grandpa is asleep on the sofa.", "couch")
P("cushion", "cushion", "A2", "living", (562, 696), (546, 682, 32, 24), "ˈkʊʃn", "noun",
  "A soft bag of cloth that makes a seat more comfortable.", "Put a cushion behind your back.", "pillow")
P("coffeetable", "coffee table", "A2", "living", (600, 735), (560, 730, 86, 28), "ˈkɒfi ˌteɪbl", "noun",
  "A low table in front of a sofa.", "Your magazine is on the coffee table.")
P("rug", "rug", "A2", "living", (548, 759), (530, 754, 188, 8), "rʌɡ", "noun",
  "A small carpet that covers part of the floor.", "The cat sleeps on the rug by the fire.")
P("plant", "plant", "A1", "living", (684, 716), (664, 696, 40, 62), "plɑːnt", "noun",
  "A living green thing that grows in soil, often in a pot.", "Don't forget to water the plant.")
P("fireplace", "fireplace", "A2", "living", (706, 720), (688, 652, 102, 108), "ˈfaɪəpleɪs", "noun",
  "An open place in a wall where you can have a fire.", "We sat by the fireplace and drank hot chocolate.")
P("clock", "clock", "A1", "living", (738, 640), (722, 622, 32, 34), "klɒk", "noun",
  "A thing that shows the time.", "The clock on the mantelpiece is five minutes fast.")

# kitchen
P("fridge", "fridge", "A1", "kitchen", (829, 700), (804, 618, 50, 142), "frɪdʒ", "noun",
  "A cold cupboard that keeps food fresh.", "The milk is in the fridge.", "refrigerator")
P("cupboard", "cupboard", "A2", "kitchen", (876, 614), (856, 588, 78, 54), "ˈkʌbəd", "noun",
  "A piece of furniture with doors and shelves, for plates, cups or food.", "The glasses are in the cupboard above the kettle.", "cabinet")
P("cooker", "cooker", "A2", "kitchen", (924, 734), (900, 696, 48, 56), "ˈkʊkə", "noun",
  "A machine for cooking food, with an oven and rings on top.", "Be careful - the cooker is hot.", "stove")
P("kettle", "kettle", "A2", "kitchen", (874, 690), (856, 674, 36, 30), "ˈketl", "noun",
  "A pot with a spout and handle for boiling water.", "Put the kettle on and let's have some tea.")
P("sink", "sink", "A2", "kitchen", (968, 704), (950, 676, 40, 38), "sɪŋk", "noun",
  "A bowl in the kitchen with taps, where you wash dishes.", "There are dirty plates in the sink.")

# landing
P("picture", "picture", "A1", "landing", (366, 440), (328, 400, 76, 70), "ˈpɪktʃə", "noun",
  "A painting, drawing or photo, often in a frame on the wall.", "There's a picture of the sea on the landing.")

# bathroom
P("shower", "shower", "A1", "bathroom", (570, 440), (546, 408, 40, 64), "ˈʃaʊə", "noun",
  "A place where water comes down on you from above, to wash.", "I have a quick shower every morning.")
P("bath", "bath", "A1", "bathroom", (590, 526), (530, 500, 118, 48), "bɑːθ", "noun",
  "A long container that you fill with water and sit in to wash.", "The baby is in the bath.", "bathtub")
P("mirror", "mirror", "A2", "bathroom", (674, 432), (654, 404, 40, 56), "ˈmɪrə", "noun",
  "Glass in which you can see yourself.", "He looked at himself in the mirror.")
P("washbasin", "washbasin", "B1", "bathroom", (674, 490), (652, 474, 44, 74), "ˈwɒʃbeɪsn", "noun",
  "A small bowl on the wall of a bathroom, with taps, for washing your hands and face.", "Wash your hands in the washbasin.", "sink")
P("toilet", "toilet", "A1", "bathroom", (719, 514), (698, 444, 42, 104), "ˈtɔɪlət", "noun",
  "The seat with water in it that you use in the bathroom.", "Can I use your toilet, please?")
P("towel", "towel", "A1", "bathroom", (718, 420), (700, 398, 38, 44), "ˈtaʊəl", "noun",
  "A piece of soft cloth for drying yourself.", "Here's a clean towel for you.")

# bedroom
P("wardrobe", "wardrobe", "A2", "bedroom", (781, 440), (750, 388, 60, 160), "ˈwɔːdrəʊb", "noun",
  "A tall cupboard where you hang your clothes.", "Hang your coat in the wardrobe.", "closet")
P("bed", "bed", "A1", "bedroom", (816, 524), (810, 466, 150, 82), "bed", "noun",
  "A piece of furniture that you sleep on.", "It's late - time for bed!")
P("duvet", "duvet", "B1", "bedroom", (866, 510), (818, 494, 94, 36), "ˈduːveɪ", "noun",
  "A thick soft cover for a bed, filled with feathers.", "It's cold - I need a warmer duvet.", "comforter")
P("pillow", "pillow", "A2", "bedroom", (926, 496), (904, 488, 44, 22), "ˈpɪləʊ", "noun",
  "A soft thing to put your head on in bed.", "She fell asleep as soon as her head touched the pillow.")
P("bedsidetable", "bedside table", "B1", "bedroom", (977, 534), (960, 508, 34, 40), "ˈbedsaɪd ˌteɪbl", "noun",
  "A small table next to a bed.", "My glasses are on the bedside table.", "nightstand")

# attic
P("boxes", "boxes", "A1", "attic", (502, 312), (468, 254, 104, 82), "ˈbɒksɪz", "noun",
  "Containers, often made of cardboard, for keeping things in.", "The Christmas decorations are in those boxes.")
P("suitcase", "suitcase", "A2", "attic", (735, 324), (698, 298, 74, 38), "ˈsuːtkeɪs", "noun",
  "A case with a handle for carrying clothes when you travel.", "Have you packed your suitcase yet?")
P("lightbulb", "light bulb", "A2", "attic", (596, 220), (582, 196, 28, 36), "ˈlaɪt bʌlb", "noun",
  "The glass part of a lamp that gives light.", "The light bulb in the attic doesn't work.")
P("cobweb", "cobweb", "B1", "attic", (630, 162), (600, 138, 60, 44), "ˈkɒbweb", "noun",
  "A net of thin threads made by a spider, often old and dusty.", "The attic is full of dust and cobwebs.")

# garage
P("bike", "bike", "A1", "garage", (1132, 716), (1074, 676, 116, 84), "baɪk", "noun",
  "A bicycle: a machine with two wheels that you ride.", "I ride my bike to school.")
P("ladder", "ladder", "A2", "garage", (1040, 670), (1018, 580, 58, 180), "ˈlædə", "noun",
  "Two long pieces joined by steps, for climbing up.", "Dad climbed the ladder to clean the gutter.")
P("shelf", "shelf", "A2", "garage", (1112, 614), (1074, 586, 134, 46), "ʃelf", "noun",
  "A flat board on a wall for putting things on.", "The paint is on the top shelf.")
P("lawnmower", "lawnmower", "B1", "garage", (1197, 740), (1176, 686, 44, 74), "ˈlɔːnməʊə", "noun",
  "A machine for cutting grass.", "The lawnmower is too loud on Sunday mornings.")


S.meta = dict(
    title="The House",
    kicker="Picture Studio · Home",
    dek="A house cut open from the roof to the garden: rooms, furniture and everything around it.",
    frames=["There is a … in the …", "There are … in the …", "The … is next to the …",
            "The … is above / under the …", "The … is in front of / behind the …", "Upstairs, there is …"],
)
TF = [
    ("The lamp is next to the sofa.", True, "A1"),
    ("The bed is in the kitchen.", False, "A1"),
    ("The bath is in the bathroom.", True, "A1"),
    ("The bike is in the garden.", False, "A1"),
    ("The tree is in the garden.", True, "A1"),
    ("There are two windows in the living room.", False, "A1"),
    ("The clock is above the fire.", True, "A1"),
    ("The fridge is in the bedroom.", False, "A1"),
    ("The mirror is above the washbasin.", True, "A2"),
    ("The kettle is on the worktop in the kitchen.", True, "A2"),
    ("The coffee table is behind the sofa.", False, "A2"),
    ("The ladder is leaning against the wall in the garage.", True, "A2"),
    ("The suitcase is in the attic.", True, "A2"),
    ("The wardrobe is next to the bed.", True, "A2"),
    ("The cupboards are under the cooker.", False, "A2"),
    ("The pillow is at the end of the bed, near the footboard.", False, "A2"),
    ("The doormat is outside the front door.", False, "B1"),
    ("A drainpipe carries rainwater down from the roof.", True, "B1"),
    ("The skylight lets light into the attic.", True, "B1"),
    ("The banister runs alongside the stairs.", True, "B1"),
    ("The hedge is on the left of the house.", False, "B1"),
    ("The lawnmower is kept in the kitchen.", False, "B1"),
]
PROMPTS = {
    "A1": ["Which room is your favourite? Why?",
           "What is in your bedroom? Use There is / There are.",
           "Look at the kitchen in the picture. Write five sentences about it."],
    "A2": ["Compare this house with your home. What is the same? What is different?",
           "Imagine you live here. Describe your morning, room by room.",
           "You want to sell this house. Write a short advert for it."],
    "B1": ["Is it better to live in a house or a flat? Give your reasons.",
           "Describe your dream home: the rooms, what is in them, and why.",
           "Some things in this house need fixing (the gutter, the cobwebs…). Write a message to a builder."],
}

# card field "def_" → "def" (def is a Python keyword)
for coll in (S.rooms, S.parts):
    for c in coll:
        c["def"] = c.pop("def_")

os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
out = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "scenes"))
os.makedirs(out, exist_ok=True)
S.save(os.path.join(out, "house.json"),
       truefalse=[dict(s=s, a=a, level=l) for s, a, l in TF], prompts=PROMPTS)
S.svg(os.path.join(ROOT, "out", "house.svg"))
lv = {}
for p in S.parts + S.rooms:
    lv[p["level"]] = lv.get(p["level"], 0) + 1
print(f"house: {len(S.items)} items, {len(S.parts)} parts + {len(S.rooms)} rooms, levels {lv}, "
      f"{os.path.getsize(os.path.join(out, 'house.json')) // 1024} KB")
