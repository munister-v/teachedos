"""Picture Studio · The Airport — a terminal cut open: check-in, security
and the gate upstairs, baggage reclaim and arrivals below, and a plane at
the jet bridge outside. Writes data/scenes/airport.json.

    python3 ops/scenes/make_airport.py
"""
import math
import os
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob

ROOT = os.path.dirname(os.path.abspath(__file__))
S = Scene("airport", 1400, 800)
G = 760
UF, UFs = 548, 560        # upper floor surface / underside
XL, XR = 20, 868          # terminal walls (the right one is glass)


def thick(points, w=3.2):
    """A polyline as filled quads, for light-coloured lines on dark screens."""
    d = ""
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        L = math.hypot(x2 - x1, y2 - y1) or 1
        nx, ny = -(y2 - y1) / L * w / 2, (x2 - x1) / L * w / 2
        d += pts([(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)], True)
    return d


def roof_y(x):
    """The arched roof, outer line: 300 at the walls, 206 in the middle."""
    t = (x - XL) / (XR - XL)
    return 300 - 376 * t * (1 - t)


# ── sky, apron ────────────────────────────────────────────────────────────
S.at(0)
S.sky(sun=(1180, 120))
S.fill(rect(0, G, 1400, 40), "asphalt")
S.M(line(0, G, 1400, G), step=0)
for x in range(900, 1400, 60):
    S.fill(rect(x, 776, 30, 4), "sun")
S.H(wave(930, 210, 1010, 210, 3, 4) + wave(944, 199, 990, 199, 2, 3))
# a plane taking off, far away
S.D("M1040 300L1120 270L1128 272L1124 280L1048 306Z" + "M1080 286L1060 300L1068 300L1094 284Z" + "M1116 272L1124 256L1130 258L1126 274Z", "paper")

# ── control tower (behind the plane) ──────────────────────────────────────
S.at(200)
S.M(pts([(1332, G), (1338, 190), (1362, 190), (1368, G)], True), "paper", step=60)
S.M(pts([(1316, 168), (1384, 168), (1392, 132), (1308, 132)], True), "glass")
S.D(rect(1304, 124, 92, 10, 3) + rect(1310, 168, 80, 22, 2), "steel")
S.D(line(1350, 124, 1350, 96) + circle(1350, 94, 3))
S.H(line(1320, 136, 1326, 164) + line(1340, 136, 1342, 164) + line(1360, 136, 1358, 164) + line(1380, 136, 1374, 164))

# ── the terminal shell ────────────────────────────────────────────────────
S.at(400)
top = [(x, roof_y(x)) for x in range(XL, XR + 1, 16)]
S.fill(pts([(XL, G)] + top + [(XR, G)], True), "wall")
S.wallpaper((32, 330, 218, UF - 330), "sand", None)                          # check-in
S.wallpaper((250, 330, 226, UF - 330), "lav", None)                          # security
S.wallpaper((654, 330, 202, UF - 330), "sky", None)                          # gate
S.wallpaper((32, UFs, 440, G - UFs), "mint", "tiles")                        # baggage reclaim
S.wallpaper((472, UFs, 384, G - UFs), "sand", "stripes", dado=40)           # arrivals hall
S.fill(pts(top + [(XR, 330), (XL, 330)], True), "paper")
S.soft("".join(line(x, roof_y(x) + 14, x, 330) for x in range(60, 860, 40)))
roof = pts(top + [(p[0], p[1] + 14) for p in reversed(top)], True)
S.M(roof, "steel", step=80)
S.M(rect(XL, roof_y(XL), 12, G - roof_y(XL)), "ink", step=40)
S.M(rect(32, UF, 444, 12), "ink", step=40)                                   # upper floor (open over the escalator)
S.M(rect(652, UF, 216, 12), "ink", step=40)
S.M(rect(XR - 12, 300, 12, 170), "ink")                                     # glass wall frame, top
S.D(rect(XR - 8, 470, 4, 78) + rect(XR - 8, 560, 4, 200), "steel")
S.fill(rect(XR - 6, 560, 6, 200), "glass")
for x0, x1, y in ((32, 476, UF), (652, 856, UF), (32, 856, G)):
    S.H(line(x0, y - 5, x1, y - 5))

# ── departures: check-in ──────────────────────────────────────────────────
S.at(900)
S.M(rect(58, 336, 176, 58, 4), "ink")                                        # departures board
for i, y in enumerate(range(348, 390, 10)):
    S.fill(rect(66, y, 44, 4), "sun")
    S.fill(rect(116, y, 70, 4), "paper")
    S.fill(rect(194, y, 30, 4), "lime" if i % 2 else "red")
S.D(rect(40, 532, 50, 16, 2), "steel")                                       # scales + belt
S.D(rect(46, 544, 38, 4), "ink")
S.M(rect(48, 496, 36, 36, 5), "red")                                         # suitcase
S.D("M58 496V490H74V496" + line(48, 510, 84, 510))
S.bust(150, 492, d=1, coat="sky2")                                           # check-in agent
S.M(rect(92, 488, 118, 60, 3), "wood")                                       # desk
S.D(rect(88, 484, 126, 6, 2), "paper")
S.D(rect(104, 500, 94, 20, 2), "sand2")
S.shadow(224, UF - 1, 20)
S.standing(224, UF, coat="blush2", d=-1, arms=[(204, 470)], legs="steel")    # passenger
S.D(rect(196, 462, 12, 15, 2), "lime")                                       # passport

# security
S.at(1400)
S.M(circle(456, 350, 16), "paper")                                          # clock
S.D(line(456, 350, 456, 340) + line(456, 350, 464, 353))
S.shadow(272, UF - 1, 20)
S.standing(272, UF, coat="ink", d=1, legs="ink")                             # officer
S.D(rect(264, 454, 10, 6, 1), "sun")
S.M(rect(298, 438, 10, 110, 2) + rect(334, 438, 10, 110, 2), "steel")         # metal detector
S.M(rect(298, 430, 46, 12, 3), "steel")
S.D(circle(321, 436, 2.5), "lime")
S.M(rect(348, 520, 124, 8, 2), "steel")                                      # scanner belt
S.D(line(356, 528, 356, UF) + line(464, 528, 464, UF))
S.M(rect(378, 466, 68, 56, 6), "paper")
S.D(rect(386, 490, 52, 30, 3), "ink")
S.soft("".join(line(388 + i * 5, 490, 388 + i * 5, 520) for i in range(10)))
S.D(pts([(350, 512), (376, 512), (374, 520), (352, 520)], True), "steel")   # tray
S.D(rect(354, 500, 16, 12, 3), "lime")

# escalator from arrivals up to departures
S.at(1800)
ex0, ex1 = 480, 650                                                          # bottom, top
S.M(pts([(ex0 - 20, G), (ex0, G - 14), (ex1, UF - 14), (ex1 + 16, UF), (ex1, UF + 18), (ex0, G - 4)], True), "steel", step=60)
S.soft("".join(line(ex0 + (ex1 - ex0) * t, (G - 14) - (G - UF) * t, ex0 + (ex1 - ex0) * t - 8, (G - 14) - (G - UF) * t + 12)
               for t in [i / 16 for i in range(1, 16)]))
S.D(pts([(ex0 - 16, G - 46), (ex1 + 12, UF - 50)]))                          # handrail
S.D(pts([(ex0 - 16, G - 46), (ex0 - 24, G - 40), (ex0 - 20, G - 10)]))
S.D(line(ex0 - 8, G - 44, ex0 - 4, G - 16) + line(ex1 + 4, UF - 48, ex1 + 6, UF - 16), "ink")

# gate
S.at(2100)
S.M(rect(700, 380, 150, 90), "glass")                                       # window onto the apron
S.D(line(750, 380, 750, 470) + line(800, 380, 800, 470))
S.H(line(712, 392, 730, 410) + line(812, 392, 830, 410))
S.D(line(730, 330, 730, 340) + line(790, 330, 790, 340))                    # gate sign
S.M(rect(710, 340, 100, 28, 3), "ink")
S.fill(thick([(740, 348), (745, 345), (745, 363)]), "lime")
S.fill(thick([(752, 349), (756, 345), (763, 345), (766, 349), (765, 353), (753, 363), (767, 363)]), "lime")
S.bust(684, 492, d=1, coat="blush2")                                        # gate agent
S.M(rect(664, 490, 44, 58, 3), "sand2")                                      # podium
S.D(rect(672, 498, 28, 14, 2), "ink")
S.shadow(736, UF - 1, 20)
S.standing(736, UF, coat="sage2", d=-1, arms=[(712, 474)], legs="sky2")     # passenger
S.D(rect(700, 468, 18, 11, 2), "lime")                                       # boarding pass
for x in (768, 798, 828):                                                    # seats
    S.D(rect(x, 520, 26, 6, 2) + rect(x, 494, 6, 30, 2), "ink")
    S.D(line(x + 13, 526, x + 13, UF))
S.M("M832 518Q830 500 842 498Q852 498 852 518Z", "lime")                     # backpack
S.D(rect(836, 508, 12, 6, 2))

# ── arrivals: baggage reclaim ─────────────────────────────────────────────
S.at(2600)
S.M(rect(110, 588, 170, 32, 4), "ink")                                      # sign
S.fill(rect(122, 598, 18, 14), "sun")
S.fill(rect(148, 602, 118, 4), "paper")
S.shadow(176, G, 130, 4)
S.M(rect(52, 704, 250, 26, 13), "steel", step=60)                            # carousel
S.D(rect(60, 728, 234, 32, 2), "tint")
S.soft("".join(line(x, 706, x, 728) for x in range(70, 296, 12)))
for x, w, h, f in ((70, 42, 34, "red"), (126, 36, 30, "sky2"), (176, 46, 36, "lime"), (236, 40, 28, "lav2")):
    S.M(rect(x, 704 - h, w, h, 5), f)
    S.D(f"M{x + w / 2 - 6} {704 - h}V{700 - h}H{x + w / 2 + 6}V{704 - h}")
# a passenger with a trolley
S.D(rect(320, 700, 60, 8, 2) + line(320, 708, 326, 748) + line(376, 708, 370, 748), "steel")
S.D(circle(328, 752, 7) + circle(368, 752, 7), "ink")
S.D(line(380, 700, 392, 668))
S.M(rect(324, 664, 48, 36, 4), "sky2")
S.M(rect(330, 638, 36, 26, 4), "red")
S.shadow(410, G - 1, 20)
S.standing(410, G, coat="sand2", d=-1, arms=[(392, 670)], legs="ink")

# arrivals hall: information desk, meeting a friend, exit
S.at(3000)
S.M(circle(708, 612, 16), "lime")
S.fill(circle(708, 604, 2.4) + rect(706, 609, 4, 13, 1), "ink")
S.bust(708, 690, d=1, coat="sky2")
S.M(rect(668, 690, 84, 70, 3), "paper")
S.D(rect(664, 684, 92, 6, 2), "wood")
S.M(rect(800, 640, 60, 120), "glass")                                        # exit doors
S.D(line(830, 640, 830, G) + rect(800, 632, 60, 8))
S.M(rect(806, 612, 48, 16, 2), "lime")
S.D("M814 616H822M814 620H820M814 624H822M814 616V624" + "M826 616L834 624M834 616L826 624" + "M840 616V624M846 616H852M849 616V624", None)
S.shadow(780, G - 1, 20)
S.standing(780, G, coat="red", d=-1, arms=[(758, 690)], legs="ink")         # someone meeting a friend
S.D(rect(740, 674, 34, 24, 2), "paper")
S.H(line(746, 684, 768, 684) + line(746, 690, 762, 690))

# ── the jet bridge and the plane ──────────────────────────────────────────
S.at(3400)
S.M(pts([(XR, 500), (1060, 556), (1060, 622), (XR, 560)], True), "steel", step=80)   # jet bridge
for i in range(4):
    x = 880 + i * 44
    y = 500 + (x - XR) * 56 / 192
    S.D(rect(x, y + 10, 28, 24, 3), "glass")
S.D(line(1040, 604, 1040, 736) + rect(1024, 736, 32, 10, 3), "steel")
S.D(circle(1030, 750, 8) + circle(1050, 750, 8), "ink")
S.shadow(1160, G, 260, 6)
body = "M1400 560H1010Q930 562 918 620Q920 684 990 690H1400Z"
S.M(body, "paper", step=120)
S.fill(rect(918, 664, 482, 12), "sky2")
S.D(line(990, 690, 1400, 690) + line(1010, 664, 1400, 664))
S.D("M946 592L960 580H1000L1004 596H950Z", "ink")                            # cockpit windows
S.D(line(970, 580, 968, 596) + line(986, 580, 986, 596))
S.D(circle(990, 592, 5), "wood")                                            # the pilot
S.D(rect(1082, 580, 28, 70, 5), "tint")                                     # door
S.D(rect(1098, 610, 8, 3, 1), "ink")
S.D(rect(1086, 584, 20, 64, 4), "ink")                                     # the open door and the attendant in it
S.standing(1096, 648, coat="lav2", d=-1, h=60, legs="lav2")
for x in range(1134, 1400, 24):
    S.D(rect(x, 594, 11, 15, 5), "glass")
S.M("M1236 676L1400 660V690L1260 696Z", "steel")                             # wing
S.M(rect(1238, 692, 96, 44, 18), "steel")                                   # engine
S.D(ellipse(1244, 714, 8, 20), "ink")
S.D(line(1260, 696, 1330, 696))
S.D(line(1000, 690, 1000, 742) + line(1330, 690, 1330, 742))                # landing gear
for x in (996, 1008, 1318, 1340):
    S.D(circle(x, 748, 11), "ink")
# baggage cart and a baggage handler
S.at(3900)
S.M(rect(1112, 718, 104, 26, 3), "sand2")
S.D(circle(1124, 750, 8) + circle(1204, 750, 8), "ink")
for x, f in ((1118, "red"), (1142, "lime"), (1166, "sky2"), (1190, "lav2")):
    S.D(rect(x, 698, 22, 20, 4), f)
S.D(line(1112, 730, 1096, 736))
S.shadow(1076, G - 1, 18)
S.standing(1076, G, coat="lime", d=1, arms=[(1098, 700)], legs="ink", h=108)
S.D(rect(1090, 690, 20, 16, 4), "blush2")

# ── words ─────────────────────────────────────────────────────────────────
def R(rid, word, box, label, level, ipa, d, ex, us=None):
    card = dict(level=level, ipa=ipa, pos="noun", def_=d, ex=ex)
    if us:
        card["us"] = us
    S.room(rid, word, box, label, **card)


R("airport", "airport", (0, 90, 1400, 710), (380, 262), "A1", "ˈeəpɔːt",
  "A place where planes land and take off, with buildings for passengers.", "We need to be at the airport two hours before the flight.")
R("checkin", "check-in", (32, 330, 218, 218), (42, 318), "A2", "ˈtʃek ɪn",
  "The desk where you show your ticket and leave your big bags.", "Check-in closes 45 minutes before the flight.")
R("security", "security", (250, 330, 226, 218), (300, 318), "B1", "sɪˈkjʊərəti",
  "The place where they check your bags and you walk through a scanner.", "It took twenty minutes to get through security.")
R("gate", "gate", (652, 330, 204, 218), (824, 318), "A2", "ɡeɪt",
  "The door where you get on the plane.", "Flight BA216 is now boarding at gate 12.")
R("reclaim", "baggage reclaim", (32, UFs, 440, G - UFs), (42, 578), "B1", "ˈbæɡɪdʒ rɪˌkleɪm",
  "The place where you collect your bags after a flight.", "Our suitcases were the last ones in baggage reclaim.", "baggage claim")
R("arrivals", "arrivals", (472, UFs, 384, G - UFs), (560, 578), "B1", "əˈraɪvlz",
  "The part of the airport where people come out after they land.", "I'll meet you in arrivals.")
S.meta["zones"] = [
    dict(id="departures", chip="Departures", box=[20, 300, 848, 260]),
    dict(id="arrivalsz", chip="Arrivals", box=[20, 548, 848, 212]),
    dict(id="apron", chip="The plane", box=[868, 480, 532, 280]),
]
S.meta["groups"] = {"checkin": "Check-in", "security": "Security", "gate": "The gate", "reclaim": "Baggage reclaim",
                    "arrivals": "Arrivals", "plane": "The plane", "outside": "Outside"}


def P(pid, word, level, room, pin, box, ipa, pos, d, ex, us=None):
    card = dict(level=level, room=room, ipa=ipa, pos=pos, def_=d, ex=ex)
    if us:
        card["us"] = us
    S.part(pid, word, pin, box, **card)


P("board", "departures board", "A2", "checkin", (146, 364), (56, 334, 180, 62), "dɪˈpɑːtʃəz bɔːd", "noun",
  "A big screen that shows the flights, the times and the gates.", "Check the departures board for your gate.")
P("desk", "check-in desk", "A2", "checkin", (150, 526), (86, 480, 128, 68), "ˈtʃek ɪn desk", "noun",
  "The desk where you check in for your flight.", "Take your bags to the check-in desk.")
P("suitcase", "suitcase", "A1", "checkin", (66, 518), (44, 488, 44, 46), "ˈsuːtkeɪs", "noun",
  "A case with a handle for carrying clothes when you travel.", "My suitcase is too heavy - 25 kilos!")
P("passenger", "passenger", "A2", "checkin", (226, 500), (204, 426, 42, 122), "ˈpæsɪndʒə", "noun",
  "A person who travels on a plane, a train or a bus.", "All passengers must show their passports.")
P("passport", "passport", "A2", "checkin", (202, 468), (192, 458, 20, 22), "ˈpɑːspɔːt", "noun",
  "A small book that shows who you are, for travelling to other countries.", "Don't forget your passport!")
P("officer", "security officer", "B1", "security", (272, 500), (252, 426, 40, 122), "sɪˈkjʊərəti ˌɒfɪsə", "noun",
  "A person whose job is to check people and bags at the airport.", "The security officer asked me to take off my belt.")
P("detector", "metal detector", "B1", "security", (321, 480), (294, 426, 54, 122), "ˈmetl dɪˌtektə", "noun",
  "A frame you walk through that beeps if you have metal on you.", "The metal detector beeped because of my keys.")
P("scanner", "scanner", "B1", "security", (412, 480), (346, 462, 128, 86), "ˈskænə", "noun",
  "A machine that looks inside your bags.", "Put your bag and your laptop through the scanner.")
P("tray", "tray", "B1", "security", (362, 514), (348, 498, 30, 24), "treɪ", "noun",
  "A flat plastic box for your things at security.", "Put your phone and keys in the tray.")
P("clock", "clock", "A1", "security", (456, 350), (438, 332, 36, 36), "klɒk", "noun",
  "A thing on the wall that shows the time.", "Look at the clock - our flight leaves in an hour!")
P("escalator", "escalator", "A2", "arrivals", (565, 650), (476, 540, 200, 220), "ˈeskəleɪtə", "noun",
  "Moving stairs that carry people up or down.", "Take the escalator down to arrivals.")
P("gatesign", "gate number", "A2", "gate", (760, 354), (706, 326, 108, 44), "ˈɡeɪt ˌnʌmbə", "noun",
  "The number of the gate where your plane is waiting.", "Our gate number is 12.")
P("boardingpass", "boarding pass", "B1", "gate", (708, 474), (698, 462, 22, 20), "ˈbɔːdɪŋ pɑːs", "noun",
  "A card that lets you get on the plane. It shows your seat number.", "Please have your boarding pass ready.")
P("seats", "seats", "A1", "gate", (790, 522), (764, 490, 66, 58), "siːts", "noun",
  "Places to sit.", "There are no free seats at the gate.")
P("backpack", "backpack", "A1", "gate", (842, 508), (828, 494, 28, 26), "ˈbækpæk", "noun",
  "A bag you carry on your back.", "I only take a backpack when I fly.", "rucksack")
P("window", "window", "A1", "gate", (776, 424), (700, 380, 150, 90), "ˈwɪndəʊ", "noun",
  "An opening in a wall with glass, to let in light.", "You can see the planes from the window.")
P("carousel", "carousel", "B1", "reclaim", (150, 716), (50, 700, 254, 60), "ˌkærəˈsel", "noun",
  "The moving belt where your bags come out after the flight.", "Our bags are on carousel number 3.", "baggage carousel")
P("luggage", "luggage", "B1", "reclaim", (200, 686), (66, 666, 214, 40), "ˈlʌɡɪdʒ", "noun",
  "All the bags and suitcases you take on a journey.", "How much luggage have you got?", "baggage")
P("trolley", "trolley", "A2", "reclaim", (346, 722), (316, 634, 70, 126), "ˈtrɒli", "noun",
  "A metal basket on wheels for carrying bags.", "Put the suitcases on a trolley.", "cart")
P("infodesk", "information desk", "B1", "arrivals", (708, 724), (662, 594, 96, 166), "ˌɪnfəˈmeɪʃn desk", "noun",
  "A desk where you can ask questions.", "Ask at the information desk where the buses go from.")
P("exit", "exit", "A2", "arrivals", (830, 700), (798, 608, 66, 152), "ˈeksɪt", "noun",
  "The way out of a building.", "The exit is on the right, after the café.")
P("sign", "sign", "A2", "arrivals", (752, 690), (738, 672, 38, 28), "saɪn", "noun",
  "A board with words on it. People hold them up to find someone.", "I held up a sign with her name on it.")

# the plane and the apron
P("plane", "plane", "A1", "plane", (1200, 628), (916, 558, 484, 134), "pleɪn", "noun",
  "A vehicle with wings that flies.", "The plane lands at six o'clock.", "airplane")
P("cockpit", "cockpit", "B1", "plane", (972, 590), (944, 576, 64, 24), "ˈkɒkpɪt", "noun",
  "The front part of a plane where the pilots sit.", "Children can sometimes visit the cockpit after the flight.")
P("pilot", "pilot", "A2", "plane", (990, 592), (980, 582, 20, 20), "ˈpaɪlət", "noun",
  "The person who flies a plane.", "The pilot says we'll land in twenty minutes.")
P("wing", "wing", "A2", "plane", (1360, 676), (1234, 658, 166, 40), "wɪŋ", "noun",
  "One of the two long flat parts of a plane that help it fly.", "I had a window seat over the wing.")
P("engine", "engine", "A2", "plane", (1290, 716), (1236, 690, 100, 48), "ˈendʒɪn", "noun",
  "The machine that makes a plane move.", "A plane like this has two engines.")
P("jetbridge", "jet bridge", "B1", "plane", (900, 530), (868, 498, 196, 126), "ˈdʒet brɪdʒ", "noun",
  "A covered bridge from the gate to the plane door.", "We walked along the jet bridge onto the plane.", "jetway")
P("attendant", "flight attendant", "B1", "plane", (1098, 610), (1084, 584, 26, 66), "ˈflaɪt əˌtendənt", "noun",
  "A person who looks after passengers on a plane.", "The flight attendant showed me to my seat.")
P("cart", "baggage cart", "B1", "plane", (1180, 732), (1094, 694, 124, 66), "ˈbæɡɪdʒ kɑːt", "noun",
  "A small trailer that carries bags to and from the plane.", "The bags go to the plane on a baggage cart.")
P("handler", "baggage handler", "B1", "plane", (1072, 712), (1056, 650, 40, 110), "ˈbæɡɪdʒ ˌhændlə", "noun",
  "A person who loads bags onto planes.", "Baggage handlers work outside in all weather.")
P("tower", "control tower", "B1", "outside", (1350, 150), (1300, 90, 100, 470), "kənˈtrəʊl ˌtaʊə", "noun",
  "A tall building where people tell the pilots when to land and take off.", "The control tower gave the plane permission to land.")


S.meta.update(
    view=[0, 80, 1400, 720],
    roomsTitle="Places in the airport",
    title="The Airport",
    kicker="Picture Studio · Travel",
    dek="A terminal cut open: check-in, security and the gate upstairs, baggage reclaim and arrivals below, and a plane at the jet bridge.",
    frames=["First you …, then you …", "You need your … to …", "The … is upstairs / downstairs.",
            "Excuse me, where is the …?", "I'm flying to … on …", "Our flight has been …"],
)
TF = [
    ("The plane is outside the airport.", True, "A1"),
    ("There is a clock on the wall.", True, "A1"),
    ("The suitcase at check-in is red.", True, "A1"),
    ("There are four seats at the gate.", False, "A1"),
    ("The departures board is above the check-in desk.", True, "A2"),
    ("The passenger at check-in is holding a passport.", True, "A2"),
    ("The escalator goes from arrivals up to departures.", True, "A2"),
    ("The backpack is on the floor.", False, "A2"),
    ("There are four bags on the carousel.", True, "A2"),
    ("The gate number is 21.", False, "A2"),
    ("The security officer is standing next to the metal detector.", True, "B1"),
    ("The jet bridge goes from the gate to the plane door.", True, "B1"),
    ("The baggage cart is empty.", False, "B1"),
    ("The engine is under the wing.", True, "B1"),
    ("The information desk is in departures.", False, "B1"),
    ("You can see a pilot through the cockpit window.", True, "B1"),
]
PROMPTS = {
    "A1": ["Where do you want to fly? Why?",
           "What is in your suitcase when you go on holiday?",
           "Look at the gate. Write five sentences about it."],
    "A2": ["Describe your journey through the airport, from check-in to the plane. Use first, then, after that.",
           "You are at the check-in desk. Write the dialogue with the agent.",
           "Tell a story about a trip that went wrong. Use the past simple."],
    "B1": ["Your bag didn't arrive. Write an email to the airline.",
           "Is flying the best way to travel? Think about time, price and the planet.",
           "Give advice to someone flying for the first time. Use should, must and don't forget to."],
}

for coll in (S.rooms, S.parts):
    for c in coll:
        c["def"] = c.pop("def_")

os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
out = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "scenes"))
S.save(os.path.join(out, "airport.json"), truefalse=[dict(s=s, a=a, level=l) for s, a, l in TF], prompts=PROMPTS)
S.svg(os.path.join(ROOT, "out", "airport.svg"))
lv = {}
for p in S.parts + S.rooms:
    lv[p["level"]] = lv.get(p["level"], 0) + 1
print(f"airport: {len(S.items)} items, {len(S.parts)} parts + {len(S.rooms)} rooms, levels {lv}, "
      f"{os.path.getsize(os.path.join(out, 'airport.json')) // 1024} KB")
