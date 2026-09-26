"""Picture Studio · The Hospital — a three-storey hospital cut open: A&E,
reception and the waiting room downstairs, a ward and the operating theatre
above, X-rays, the doctor's room and the pharmacy at the top, a helipad on
the roof and an ambulance at the door. Writes data/scenes/hospital.json.

    python3 ops/scenes/make_hospital.py
"""
import os
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob

ROOT = os.path.dirname(os.path.abspath(__file__))
S = Scene("hospital", 1400, 800)
G = 760
F1, F1s = 548, 560       # first floor surface / underside of its slab
F2, F2s = 336, 348
RF, RFs = 124, 136       # roof
XL, XR, XT = 200, 1200, 1270


# ── people (kit: Scene.standing / Scene.bust) ──────────────────────────────
standing, bust = S.standing, S.bust


# ── sky and ground ────────────────────────────────────────────────────────
S.at(0)
S.sky(sun=(110, 250))
S.fill(rect(0, G, 1400, 40), "earth")
S.M(line(0, G, 1400, G), step=0)
for x in range(6, 1400, 14):
    S.H(line(x, G + 6, x + 10, G + 16))
S.H(wave(80, 140, 170, 140, 3, 5) + wave(96, 128, 150, 128, 2, 4))
S.H(wave(1290, 190, 1370, 190, 3, 4) + wave(1304, 179, 1350, 179, 2, 3))

# ── the building ──────────────────────────────────────────────────────────
S.at(150)
S.fill(rect(XL, RFs, XT - XL, G - RFs), "wall")
S.wallpaper((212, F1s, 258, G - F1s), "sand", "stripes", dado=40)        # reception
S.wallpaper((478, F1s, 282, G - F1s), "mint", None, dado=40)             # waiting room
S.wallpaper((768, F1s, 420, G - F1s), "blush", "tiles")                  # A&E
S.wallpaper((212, F2s, 508, F1 - F2s), "sky", "dots", dado=36)          # ward
S.wallpaper((728, F2s, 460, F1 - F2s), "mint", "tiles")                  # theatre
S.wallpaper((212, RFs, 348, F2 - RFs), "lav", None)                      # X-ray
S.wallpaper((568, RFs, 312, F2 - RFs), "sage", "stripes", dado=36)       # consulting room
S.wallpaper((888, RFs, 300, F2 - RFs), "sand", "planks")                 # pharmacy
S.wallpaper((1200, RFs, 58, G - RFs), "steel", None)                     # lift shaft
S.lawn(0, 200, G)
S.lawn(1270, 1400, G)
S.M(rect(XL, RFs, 12, 640 - RFs), "ink", step=40)                    # left wall (door below)
S.M(rect(1188, RFs, 12, G - RFs), "ink", step=40)                    # right wall / lift shaft
S.M(rect(1258, 96, 12, G - 96), "ink", step=40)                      # lift tower
S.M(rect(1200, 96, 70, 12), "ink")
S.M(rect(190, RF, 1010, 12), "ink", step=40)                         # roof
S.M(rect(212, F2, 976, 12), "ink", step=40)
S.M(rect(212, F1, 976, 12), "ink", step=40)
for x, y0, y1 in ((470, F1s, 640), (760, F1s, 640), (720, F2s, 440), (560, RFs, 228), (880, RFs, 228)):
    S.M(rect(x, y0, 8, y1 - y0), "ink")
    S.D(rect(x - 3, y1, 14, 4))
for a, b, y in ((212, 470, G), (478, 760, G), (768, 1188, G), (212, 720, F1), (728, 1188, F1),
                (212, 560, F2), (568, 880, F2), (888, 1188, F2)):
    S.H(line(a, y - 5, b, y - 5))
S.D(rect(1200, F1, 58, 4) + rect(1200, F2, 58, 4) + rect(1200, G - 4, 58, 4))   # lift landings
# lift car and cables
S.at(500)
S.M(rect(1206, 446, 46, 102, 2), "paper")
S.D(line(1229, 450, 1229, 544))
S.H(line(1218, 108, 1218, 446) + line(1240, 108, 1240, 446))
S.D(rect(1210, 452, 38, 4), "lime")

# helipad and windsock on the roof
S.at(650)
S.M(rect(640, 108, 380, 16, 2), "tint", step=60)
for x in range(660, 1010, 44):
    S.D(circle(x, 106, 3), "lime")
S.H(line(700, 116, 980, 116))
S.D(line(1080, RF, 1080, 62))
S.M(pts([(1080, 64), (1122, 70), (1120, 78), (1080, 80)], True), "lime")
S.H(line(1094, 66, 1094, 79) + line(1108, 68, 1108, 78))

# ── outside: ambulance and entrance canopy ────────────────────────────────
S.at(900)
S.M(rect(100, 606, 100, 10, 2), "wood")
S.D(rect(104, 616, 6, G - 616), "paper")
S.M(rect(14, 640, 128, 98, 6), "paper", step=60)                     # ambulance
S.M(pts([(142, 664), (172, 664), (192, 700), (194, 738), (142, 738)], True), "paper")
S.D(pts([(148, 670), (168, 670), (184, 698), (148, 698)], True), "glass")
S.D(rect(14, 708, 180, 9), "lime")
S.D("M72 668H84V656H96V668H108V680H96V692H84V680H72Z", "sky2")       # the cross
S.D(rect(128, 630, 20, 10, 3), "lime")                               # lights / siren
S.H(line(122, 626, 116, 618) + line(138, 626, 138, 616) + line(154, 626, 160, 618))
S.D(line(142, 700, 142, 738) + rect(150, 712, 12, 4, 2))
for cx in (48, 162):
    S.M(circle(cx, 744, 15), "ink")
    S.D(circle(cx, 744, 6), "paper")

# ── ground floor ──────────────────────────────────────────────────────────
S.at(1300)
# reception: sliding doors, desk, receptionist, computer
S.M(rect(222, 640, 76, 120), "glass")
S.D(line(260, 640, 260, G) + rect(222, 632, 76, 8))
S.H(line(232, 660, 246, 674) + line(270, 660, 284, 674))
bust(392, 690, d=-1, coat="lav2")
S.M(rect(326, 684, 128, 6, 2), "wood")
S.M(rect(330, 690, 120, 70), "wood")
S.H(line(330, 720, 450, 720))
S.D(rect(412, 652, 34, 24, 2), "ink")
S.D(rect(416, 656, 26, 16, 1), "glass")
S.D(rect(426, 676, 6, 8), "ink")
# waiting room: chairs, a patient with a sling, noticeboard
S.at(1800)
for cx in (500, 560, 620, 680):
    S.D(rect(cx, 676, 6, 40, 2), "wood")
    S.D(rect(cx, 712, 42, 7, 2), "wood")
    S.D(line(cx + 4, 719, cx + 4, G) + line(cx + 38, 719, cx + 38, G))
# seated patient on the second chair, facing right
x, ys = 572, 664
S.D(rect(x + 14, 712, 30, 8, 3) + rect(x + 36, 716, 8, 42, 3), "sky2")      # thigh and shin
S.D(ellipse(x + 44, G - 2, 8, 3), "ink")
S.M(f"M{x - 2} 714L{x} {ys}Q{x + 12} {ys - 6} {x + 24} {ys}L{x + 26} 714Z", "sand2")
S.D(rect(x + 9, ys - 8, 6, 8), "wood")
S.M(circle(x + 13, ys - 17, 9), "wood")
S.D(f"M{x + 4} {ys - 20}Q{x + 12} {ys - 30} {x + 22} {ys - 21}Q{x + 12} {ys - 24} {x + 4} {ys - 20}Z", "ink")
S.D(pts([(x + 4, ys + 6), (x + 30, ys + 34), (x + 6, ys + 40)], True), "lime")   # sling
S.D(rect(x + 18, ys + 30, 16, 7, 3), "paper")
S.M(rect(690, 596, 60, 44, 2), "wood")                               # noticeboard
S.D(rect(696, 602, 18, 14) + rect(720, 604, 22, 12) + rect(700, 622, 26, 12), "paper")
S.D(rect(732, 620, 12, 14), "lime")
# A&E: stretcher, paramedic, wheelchair, crutches, first aid kit
S.at(2300)
S.M(rect(796, 688, 150, 12, 4), "paper")
S.D(rect(800, 680, 34, 10, 5), "tint")
S.D(rect(806, 700, 134, 5) + line(816, 705, 816, 744) + line(926, 705, 926, 744) + line(812, 744, 930, 744))
S.D(circle(816, 752, 7) + circle(926, 752, 7), "ink")
S.D(line(946, 690, 958, 676))
S.shadow(986, G - 1, 22)
standing(986, G, coat="lime", d=-1, arms=[(958, 678)], legs="sage2")
S.M(circle(1044, 732, 27), None)                                    # wheelchair
S.D(circle(1044, 732, 4), "ink")
S.D(circle(1080, 752, 7), "paper")
S.D("M1026 712H1072L1080 745M1030 712L1024 664H1016" + line(1072, 712, 1078, 690))
S.D(rect(1028, 706, 48, 6, 2), "sky2")
S.D(line(1150, G, 1172, 610) + line(1162, G, 1180, 612))            # crutches
S.D(rect(1164, 604, 20, 6, 2) + rect(1172, 604, 20, 6, 2), "tint")
S.D(line(1156, 700, 1170, 702) + line(1166, 700, 1178, 702))
S.M(rect(1090, 596, 44, 34, 4), "lime")                              # first aid kit
S.D("M1106 604H1118V608H1122V618H1118V622H1106V618H1102V608H1106Z", "paper")
S.D(rect(1104, 590, 16, 6, 2))

# ── first floor: ward ─────────────────────────────────────────────────────
S.at(2800)
S.M(rect(290, 380, 90, 58), "glass")
S.D(line(335, 380, 335, 438) + rect(286, 438, 98, 4))
S.H(line(300, 390, 314, 404) + line(346, 390, 360, 404))


def bed(x0, x1, head_x, bandage=False):
    S.M(rect(x0, 468, 8, 80, 3), "wood")                              # headboard
    S.M(rect(x0 + 8, 494, x1 - x0 - 8, 14, 2), "paper")               # mattress
    S.D(rect(x0 + 8, 508, x1 - x0 - 8, 6), "tint")
    S.D(line(x0 + 20, 514, x0 + 20, 540) + line(x1 - 12, 514, x1 - 12, 540))
    S.D(circle(x0 + 20, 543, 5) + circle(x1 - 12, 543, 5), "ink")
    S.D(rect(x0 + 10, 484, 34, 12, 6), "paper")                      # pillow
    S.M(circle(head_x, 478, 9), "wood")
    if bandage:
        S.D(f"M{head_x - 9} 474Q{head_x} 466 {head_x + 9} 474L{head_x + 9} 479Q{head_x} 471 {head_x - 9} 479Z", "paper")
    else:
        S.D(f"M{head_x - 9} 476Q{head_x - 4} 466 {head_x + 6} 469Q{head_x} 472 {head_x - 9} 476Z", "ink")
    S.shadow((x0 + x1) / 2, F1 - 1, (x1 - x0) / 2)
    S.M(f"M{head_x + 8} 494Q{head_x + 10} 480 {head_x + 30} 478Q{x1 - 40} 474 {x1 - 18} 482Q{x1 - 4} 486 {x1 - 2} 494Z", "sky2")
    S.H(wave(head_x + 30, 482, x1 - 30, 482, 3, 2))


bed(226, 378, 250, bandage=True)
S.M(rect(386, 506, 30, 42, 2), "wood")                               # locker + flowers
S.D(pts([(394, 506), (408, 506), (410, 484), (392, 484)], True), "glass")
for fx, fy in ((392, 468), (401, 462), (410, 468)):
    S.D(line(401, 486, fx, fy + 4))
    S.D(circle(fx, fy, 4), "lime")
S.D(line(420, 364, 468, 364))                                        # curtain
S.D(pts([(424, 366), (446, 366), (442, 450), (448, 536), (426, 536), (430, 450)], True), "blush2")
S.H(wave(434, 370, 436, 532, 5, 2))
bed(452, 600, 476)
S.D(line(612, F1, 612, 402) + line(604, F1, 620, F1) + line(604, 402, 620, 402))   # drip stand
S.M(rect(598, 404, 16, 28, 4), "glass")
S.D("M606 432Q604 470 560 492")
S.shadow(668, F1 - 1, 22)
standing(668, F1, coat="sky2", d=-1, arms=[(640, 476)], legs="sky2")   # nurse
S.D(pts([(628, 460), (644, 458), (646, 484), (630, 486)], True), "paper")   # clipboard
S.H(line(632, 468, 642, 467) + line(632, 474, 642, 473))

# ── first floor: operating theatre ────────────────────────────────────────
S.at(3500)
S.D(line(952, F1s - 212, 952, 386))
S.M("M906 386H998Q996 404 952 406Q908 404 906 386Z", "lime")
S.H(line(930, 410, 918, 434) + line(952, 410, 952 , 438) + line(974, 410, 986, 434))
S.M(rect(880, 470, 150, 9, 3), "paper")                              # operating table
S.D(rect(946, 479, 18, 60) + rect(926, 538, 58, 10, 2), "tint")
S.M(circle(894, 460, 8), "wood")
S.D(f"M886 457Q894 449 902 457Z", "glass")
S.M("M904 470Q912 452 940 452Q990 448 1024 462L1028 470Z", "mint2")
S.shadow(1072, F1 - 1, 22)
standing(1072, F1, coat="mint2", d=-1, cap="mint2", mask=True, arms=[(1034, 462)], legs="mint2")   # surgeon
S.M(rect(778, 396, 70, 48, 4), "ink")                                # heart monitor
ecg = [(784, 424), (798, 424), (802, 410), (808, 436), (812, 420), (818, 424), (842, 424)]
S.fill(pts(ecg + [(x, y + 2.4) for x, y in reversed(ecg)], True), "lime")
S.D(line(812, 444, 812, F1 - 8) + line(796, F1 - 4, 828, F1 - 4))
S.D(circle(796, F1 - 3, 3) + circle(828, F1 - 3, 3), "ink")

# ── second floor: X-ray ───────────────────────────────────────────────────
S.at(4000)
S.M(rect(230, 168, 68, 76, 3), "ink")                                # lightbox with an X-ray
for i, (fx, top) in enumerate(((246, 186), (256, 180), (266, 182), (276, 190))):
    S.D(rect(fx - 2, top, 5, 28, 2) + rect(fx - 2, top + 30, 5, 18, 2), "paper")
S.D(pts([(242, 226), (282, 226), (278, 240), (246, 240)], True), "paper")
S.D(pts([(284, 212), (292, 206), (294, 212), (286, 226)], True), "paper")
S.M(rect(330, 268, 170, 10, 3), "paper")                             # X-ray machine: table
S.D(rect(404, 278, 20, 50) + rect(386, 326, 56, 10, 2), "tint")
S.D(rect(516, 148, 10, 70), "tint")                                  # ceiling column + arm
S.D(rect(420, 214, 106, 8, 2), "tint")
S.M(rect(398, 222, 52, 30, 4), "paper")
S.D(pts([(404, 252), (444, 252), (436, 262), (412, 262)], True), "lime")

# ── second floor: the doctor's room ───────────────────────────────────────
S.at(4400)
S.M(rect(588, 164, 44, 66, 2), "paper")                              # eye chart
for i, w in enumerate((18, 14, 11, 8, 6, 4)):
    S.D(line(610 - w, 172 + i * 9, 610 + w, 172 + i * 9)) if i == 0 else S.H(line(610 - w, 172 + i * 9, 610 + w, 172 + i * 9))
S.M(rect(716, 168, 80, 56), "glass")
S.D(line(756, 168, 756, 224) + rect(712, 224, 88, 4))
S.shadow(672, F2 - 1, 22)
doc = standing(672, F2, coat="paper", d=1, arms=[(694, 262)], legs="steel")
nx, ny = doc["neck"]
S.D(f"M{nx - 7} {ny}Q{nx - 10} {ny + 24} {nx - 2} {ny + 30}Q{nx + 8} {ny + 30} {nx + 6} {ny + 16}", None)
S.D(circle(nx + 6, ny + 14, 3.5), "lime")
S.M(rect(720, 282, 110, 7, 2), "wood")                               # desk
S.D(rect(726, 289, 6, 47) + rect(818, 289, 6, 47), "wood")
S.D(pts([(744, 276), (770, 274), (772, 282), (742, 282)], True), "paper")   # prescription
S.H(line(750, 278, 766, 277))
S.D(rect(790, 258, 24, 18, 2), "ink")
S.D(rect(799, 276, 6, 6), "ink")
S.M(rect(838, 322, 34, 10, 3), "paper")                              # scales
S.D(circle(855, 312, 8), "paper")
S.D(line(855, 312, 859, 307))

# ── second floor: pharmacy ────────────────────────────────────────────────
S.at(4900)
for y in (190, 232):
    S.M(rect(900, y, 276, 5), "wood")
import random
rnd = random.Random(5)
for y in (190, 232):
    x = 906
    while x < 1164:
        w = rnd.choice((10, 12, 16, 20))
        h = rnd.choice((14, 18, 22))
        f = rnd.choice(("paper", "sky2", "blush2", "lime", "paper", "lav2", "mint2"))
        if rnd.random() < 0.35:
            S.D(rect(x, y - h, 10, h, 3) + rect(x + 2, y - h - 4, 6, 4), f)
            x += 14
        else:
            S.D(rect(x, y - h, w, h, 1), f)
            x += w + 3
bust(1036, 290, d=-1, coat="paper")
S.M(rect(930, 284, 200, 6, 2), "wood")                               # counter
S.M(rect(934, 290, 192, 46), "wood")
S.D(rect(1084, 266, 14, 18, 3), "paper")                             # pills
S.D(rect(1082, 262, 18, 6, 2), "lime")
S.D(pts([(952, 284), (982, 284), (980, 270), (954, 270)], True), "paper")   # plasters box
S.H(line(958, 277, 976, 277))

# outside, right
S.at(5300)
S.D(line(1330, G, 1334, 640) + line(1344, G, 1340, 640), "wood")
S.M(blob(1338, 596, 50, 50, 9, 0.2, seed=3), "leaf")
S.H(blob(1324, 590, 16, 12, 5, 0.2, 4) + blob(1352, 608, 14, 10, 5, 0.2, 6))

# ── rooms ─────────────────────────────────────────────────────────────────
def R(rid, word, box, label, level, ipa, d, ex, us=None):
    card = dict(level=level, ipa=ipa, pos="noun", def_=d, ex=ex)
    if us:
        card["us"] = us
    S.room(rid, word, box, label, **card)


R("hospital", "hospital", (190, 60, 1080, 700), (212, 104), "A1", "ˈhɒspɪtl",
  "A building where sick or hurt people are looked after by doctors and nurses.", "My grandad is in hospital with a broken leg.")
R("reception", "reception", (212, F1s, 258, G - F1s), (222, 582), "A2", "rɪˈsepʃn",
  "The place near the entrance where you say who you are and why you have come.", "Please go to reception and give your name.")
R("waiting", "waiting room", (478, F1s, 282, G - F1s), (488, 582), "A2", "ˈweɪtɪŋ ruːm",
  "A room where you sit until it is your turn.", "We sat in the waiting room for an hour.")
R("ae", "A&E", (768, F1s, 420, G - F1s), (778, 582), "B1", "ˌeɪ ənd ˈiː",
  "Accident and Emergency: the part of a hospital for people who are badly hurt or suddenly very ill.", "He cut his hand and went to A&E.", "emergency room (ER)")
R("ward", "ward", (212, F2s, 508, F1 - F2s), (222, 370), "B1", "wɔːd",
  "A big room in a hospital with beds for patients.", "She's on the children's ward.")
R("theatre", "operating theatre", (728, F2s, 460, F1 - F2s), (738, 370), "B1", "ˈɒpəreɪtɪŋ ˌθɪətə",
  "The room where doctors do operations.", "The patient is in the operating theatre now.", "operating room (OR)")
R("xraydept", "X-ray department", (212, RFs, 348, F2 - RFs), (310, 158), "B1", "ˈeks reɪ dɪˌpɑːtmənt",
  "The part of a hospital where they take X-rays.", "Take this form to the X-ray department on the second floor.", "radiology")
R("surgery", "consulting room", (568, RFs, 312, F2 - RFs), (640, 158), "B1", "kənˈsʌltɪŋ ruːm",
  "The room where a doctor talks to you and examines you.", "The doctor will see you in the consulting room.", "exam room")
R("pharmacy", "pharmacy", (888, RFs, 300, F2 - RFs), (898, 158), "A2", "ˈfɑːməsi",
  "The place where you get medicine.", "You can collect your medicine from the pharmacy.", "drugstore")


def P(pid, word, level, room, pin, box, ipa, pos, d, ex, us=None):
    card = dict(level=level, room=room, ipa=ipa, pos=pos, def_=d, ex=ex)
    if us:
        card["us"] = us
    S.part(pid, word, pin, box, **card)


# outside
P("ambulance", "ambulance", "A2", "outside", (60, 700), (10, 626, 188, 134), "ˈæmbjələns", "noun",
  "A vehicle that takes ill or hurt people to hospital.", "Call an ambulance - quickly!")
P("siren", "siren", "B1", "outside", (138, 632), (116, 614, 46, 28), "ˈsaɪrən", "noun",
  "The loud sound and flashing lights on an ambulance or police car.", "We heard the siren and moved to the side of the road.")
P("entrance", "entrance", "A2", "reception", (241, 700), (218, 628, 84, 132), "ˈentrəns", "noun",
  "The door or way into a building.", "Meet me at the main entrance.")
P("helipad", "helipad", "B1", "outside", (830, 112), (636, 96, 388, 30), "ˈhelipæd", "noun",
  "A flat place where a helicopter can land.", "The air ambulance landed on the helipad on the roof.")
P("lift", "lift", "A2", "outside", (1229, 490), (1200, 440, 58, 112), "lɪft", "noun",
  "A small room that carries people up and down in a building.", "Take the lift to the second floor.", "elevator")

# ground floor
P("receptionist", "receptionist", "B1", "reception", (392, 646), (370, 630, 44, 60), "rɪˈsepʃənɪst", "noun",
  "The person at reception who welcomes visitors and answers questions.", "The receptionist asked for my name and date of birth.")
P("computer", "computer", "A1", "reception", (429, 664), (410, 650, 38, 34), "kəmˈpjuːtə", "noun",
  "An electronic machine for storing information and working with it.", "Your details are on the computer.")
P("chairs", "chairs", "A1", "waiting", (660, 716), (496, 672, 230, 88), "tʃeəz", "noun",
  "Seats for one person, with a back.", "There are no free chairs in the waiting room.")
P("patient", "patient", "A2", "waiting", (586, 666), (566, 624, 50, 136), "ˈpeɪʃnt", "noun",
  "A person who is ill or hurt and is being looked after by a doctor.", "The patient is waiting to see the doctor.")
P("sling", "sling", "B1", "waiting", (588, 690), (574, 650, 34, 40), "slɪŋ", "noun",
  "A piece of cloth around your neck that holds a hurt arm.", "She had her arm in a sling for three weeks.")
P("noticeboard", "noticeboard", "B1", "waiting", (710, 618), (688, 594, 64, 48), "ˈnəʊtɪsbɔːd", "noun",
  "A board on a wall where people put up information.", "The visiting times are on the noticeboard.", "bulletin board")
P("stretcher", "stretcher", "B1", "ae", (870, 694), (794, 676, 154, 84), "ˈstretʃə", "noun",
  "A bed on wheels for moving people who cannot walk.", "They carried him out on a stretcher.", "gurney")
P("paramedic", "paramedic", "B1", "ae", (986, 690), (964, 638, 44, 122), "ˌpærəˈmedɪk", "noun",
  "A person who works on an ambulance and helps people in an emergency.", "The paramedics arrived in five minutes.", "EMT")
P("wheelchair", "wheelchair", "A2", "ae", (1050, 716), (1012, 660, 76, 100), "ˈwiːltʃeə", "noun",
  "A chair with wheels for people who cannot walk.", "The nurse brought a wheelchair to the door.")
P("crutches", "crutches", "B1", "ae", (1168, 660), (1146, 600, 44, 160), "ˈkrʌtʃɪz", "noun",
  "Two sticks that help you walk when you have hurt your leg.", "He'll need crutches for a month.")
P("firstaid", "first aid kit", "B1", "ae", (1112, 612), (1086, 588, 52, 44), "ˌfɜːst ˈeɪd kɪt", "noun",
  "A box with bandages, plasters and things to help someone who is hurt.", "There's a first aid kit in every classroom.")

# ward
P("bed", "bed", "A1", "ward", (330, 504), (224, 466, 156, 82), "bed", "noun",
  "A piece of furniture that you sleep on.", "The patient has to stay in bed today.")
P("bandage", "bandage", "A2", "ward", (250, 470), (238, 462, 24, 20), "ˈbændɪdʒ", "noun",
  "A long piece of cloth that you put around a hurt part of the body.", "The nurse put a clean bandage on his head.")
P("flowers", "flowers", "A1", "ward", (401, 466), (386, 456, 30, 50), "ˈflaʊəz", "noun",
  "The coloured part of a plant; people bring them to someone in hospital.", "We brought Mum some flowers.")
P("curtain", "curtain", "A2", "ward", (436, 420), (420, 360, 30, 178), "ˈkɜːtn", "noun",
  "A piece of cloth you pull around a bed so the patient is not seen.", "The nurse closed the curtain around the bed.")
P("drip", "drip", "B1", "ward", (606, 418), (594, 398, 30, 150), "drɪp", "noun",
  "A bag of liquid that goes slowly into a patient's arm through a tube.", "She was on a drip for two days.", "IV")
P("nurse", "nurse", "A1", "ward", (668, 470), (646, 426, 44, 122), "nɜːs", "noun",
  "A person who looks after people in hospital.", "The nurse checks on the patients every hour.")
P("clipboard", "clipboard", "B1", "ward", (637, 472), (626, 456, 22, 32), "ˈklɪpbɔːd", "noun",
  "A board that holds papers, so you can write while you stand.", "The nurse wrote the temperature on her clipboard.")

# theatre
P("surgeon", "surgeon", "B1", "theatre", (1072, 480), (1050, 426, 44, 122), "ˈsɜːdʒən", "noun",
  "A doctor who does operations.", "The surgeon has done hundreds of operations like this.")
P("mask", "mask", "A2", "theatre", (1068, 451), (1060, 444, 16, 14), "mɑːsk", "noun",
  "A thing you wear over your mouth and nose to stop germs.", "Everyone in the theatre wears a mask.")
P("operatingtable", "operating table", "B1", "theatre", (956, 510), (878, 448, 154, 100), "ˈɒpəreɪtɪŋ ˌteɪbl", "noun",
  "The table a patient lies on during an operation.", "The patient was lifted onto the operating table.")
P("lamp", "lamp", "A1", "theatre", (952, 396), (904, 380, 96, 30), "læmp", "noun",
  "A light. In an operating theatre it is very bright.", "The surgeon moved the lamp closer.")
P("monitor", "heart monitor", "B1", "theatre", (812, 420), (776, 394, 74, 154), "ˈhɑːt ˌmɒnɪtə", "noun",
  "A screen that shows how a patient's heart is beating.", "The heart monitor started beeping.")

# X-ray
P("xray", "X-ray", "A2", "xray", (264, 214), (228, 166, 72, 80), "ˈeks reɪ", "noun",
  "A photo of the inside of your body, showing the bones.", "The X-ray shows that her finger is broken.")
P("xraymachine", "X-ray machine", "B1", "xray", (424, 236), (326, 146, 204, 190), "ˈeks reɪ məˌʃiːn", "noun",
  "The machine that takes X-rays.", "Lie still on the table under the X-ray machine.")

# doctor's room
P("doctor", "doctor", "A1", "surgery", (670, 280), (650, 214, 46, 122), "ˈdɒktə", "noun",
  "A person whose job is to help ill people get better.", "You should see a doctor about that cough.")
P("stethoscope", "stethoscope", "B1", "surgery", (678, 252), (660, 236, 26, 34), "ˈsteθəskəʊp", "noun",
  "The thing a doctor uses to listen to your heart and breathing.", "The doctor listened to my chest with a stethoscope.")
P("eyechart", "eye chart", "B1", "surgery", (610, 196), (586, 162, 48, 70), "ˈaɪ tʃɑːt", "noun",
  "A board with letters that get smaller, for testing your eyes.", "Read the fourth line of the eye chart, please.")
P("desk", "desk", "A1", "surgery", (800, 296), (718, 256, 114, 80), "desk", "noun",
  "A table you work at.", "The doctor sat down at her desk.")
P("prescription", "prescription", "B1", "surgery", (756, 278), (740, 270, 34, 14), "prɪˈskrɪpʃn", "noun",
  "A paper from a doctor that says what medicine you need.", "Take this prescription to the pharmacy.")
P("scales", "scales", "A2", "surgery", (855, 318), (836, 302, 38, 34), "skeɪlz", "noun",
  "A machine that shows how heavy you are.", "Stand on the scales, please.", "scale")

# pharmacy
P("pharmacist", "pharmacist", "B1", "pharmacy", (1036, 250), (1014, 234, 44, 56), "ˈfɑːməsɪst", "noun",
  "A person whose job is to prepare and sell medicine.", "Ask the pharmacist how often to take it.")
P("medicine", "medicine", "A1", "pharmacy", (960, 216), (898, 160, 280, 80), "ˈmedsn", "noun",
  "Something you take to get better when you are ill.", "Take this medicine three times a day.")
P("pills", "pills", "A2", "pharmacy", (1091, 272), (1080, 260, 22, 26), "pɪlz", "noun",
  "Small round pieces of medicine that you swallow.", "Take two pills after breakfast.", "tablets")
P("plasters", "plasters", "B1", "pharmacy", (966, 276), (950, 268, 34, 18), "ˈplɑːstəz", "noun",
  "Small sticky pieces of cloth for covering a small cut.", "Have you got a plaster? I've cut my finger.", "Band-Aids")


S.meta.update(
    view=[0, 50, 1400, 750],
    roomsTitle="Places in the hospital",
    title="The Hospital",
    kicker="Picture Studio · Health",
    dek="A hospital cut open from the helipad to A&E: the people, the rooms and what happens in them.",
    frames=["The … is on the ground / first / second floor.", "There is a … in the …",
            "The nurse is …ing", "You go to the … when you …", "I've got a …", "You should …"],
    groups={"outside": "Outside", "reception": "Reception", "waiting": "Waiting room", "ae": "A&E",
            "ward": "The ward", "theatre": "Operating theatre", "xray": "X-ray department",
            "surgery": "Consulting room", "pharmacy": "Pharmacy"},
)
TF = [
    ("The ambulance is outside the hospital.", True, "A1"),
    ("The doctor has got a stethoscope.", True, "A1"),
    ("There are two beds in the ward.", True, "A1"),
    ("The pharmacy is on the ground floor.", False, "A1"),
    ("There is a computer at reception.", True, "A1"),
    ("The patient in the waiting room has got his arm in a sling.", True, "A2"),
    ("The nurse is holding a clipboard.", True, "A2"),
    ("The wheelchair is in the ward.", False, "A2"),
    ("There are some flowers next to a bed.", True, "A2"),
    ("The X-ray shows a foot.", False, "A2"),
    ("The lift is between the first and second floors.", False, "A2"),
    ("The surgeon is wearing a mask.", True, "B1"),
    ("The patient on the drip is next to the window.", False, "B1"),
    ("The operating theatre is above A&E.", True, "B1"),
    ("The paramedic is pushing a wheelchair.", False, "B1"),
    ("The helipad is on the roof.", True, "B1"),
    ("The prescription is on the doctor's desk.", True, "B1"),
    ("The first aid kit is in the pharmacy.", False, "B1"),
]
PROMPTS = {
    "A1": ["Who works in a hospital? What do they do?",
           "Look at the ward. Write five sentences: There is… There are…",
           "When did you last see a doctor? Why?"],
    "A2": ["You are at reception. Write a dialogue: say who you are and what's wrong.",
           "Describe what is happening on each floor of the hospital. Use the present continuous.",
           "Your friend has broken a leg. Write a get-well-soon message."],
    "B1": ["Would you like to work in a hospital? Which job, and why?",
           "Explain what happens when someone arrives in A&E, step by step.",
           "Should hospital car parks be free for patients and visitors? Give your reasons."],
}

for coll in (S.rooms, S.parts):
    for c in coll:
        c["def"] = c.pop("def_")

os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
out = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "scenes"))
S.save(os.path.join(out, "hospital.json"), truefalse=[dict(s=s, a=a, level=l) for s, a, l in TF], prompts=PROMPTS)
S.svg(os.path.join(ROOT, "out", "hospital.svg"))
lv = {}
for p in S.parts + S.rooms:
    lv[p["level"]] = lv.get(p["level"], 0) + 1
print(f"hospital: {len(S.items)} items, {len(S.parts)} parts + {len(S.rooms)} rooms, levels {lv}, "
      f"{os.path.getsize(os.path.join(out, 'hospital.json')) // 1024} KB")
