"""Picture Studio · The Frontier Town — the main street of a small town in the
desert: the sheriff's office and jail, the saloon, the general store, a horse
at the hitching post, a stagecoach, a water tower and cactuses.
Inspired by classic Westerns - an original drawing, no film stills.
Writes data/scenes/frontier.json.

    python3 ops/scenes/make_frontier.py
"""
import math
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob
from common import words, finish

S = Scene("frontier", 1400, 800)
G = 700          # front of the street
WALK = 600       # boardwalk in front of the buildings


def cowboy_hat(hx, hy, fill="bark"):
    S.D(f"M{hx - 22} {hy - 6}Q{hx} {hy} {hx + 22} {hy - 6}Q{hx + 24} {hy - 12} {hx + 18} {hy - 10}Q{hx} {hy - 6} {hx - 18} {hy - 10}Q{hx - 24} {hy - 12} {hx - 22} {hy - 6}Z", fill)
    S.D(f"M{hx - 12} {hy - 8}Q{hx - 12} {hy - 26} {hx - 4} {hy - 24}Q{hx} {hy - 20} {hx + 4} {hy - 24}Q{hx + 12} {hy - 26} {hx + 12} {hy - 8}Z", fill)


def wheel(cx, cy, r):
    S.D(circle(cx, cy, r), "wood")
    S.D(circle(cx, cy, r - 5), None)
    S.D("".join(line(cx, cy, cx + (r - 5) * math.cos(math.radians(a)), cy + (r - 5) * math.sin(math.radians(a))) for a in range(0, 360, 30)))
    S.D(circle(cx, cy, 5), "ink")


# ── sky, desert, mesas ────────────────────────────────────────────────────
S.at(0)
S.sky(sun=(1220, 170))
S.fill("M0 500V440L60 440L80 400H200L230 450H420L440 420H520L540 460H900L930 390H1080L1110 440H1400V500Z", "rust")
S.soft(line(80, 420, 200, 420) + line(930, 410, 1080, 410))
S.fill(rect(0, 480, 1400, 320), "dune")
S.soft("".join(ellipse(x, y, 3, 1) for x, y in ((140, 740), (330, 760), (610, 750), (910, 770), (1200, 752), (760, 736))))
S.M(line(0, 480, 1400, 480), step=0)
S.soft(wave(0, 650, 1400, 660, 10, 4) + wave(0, 720, 1400, 730, 12, 3))    # wheel ruts

# ── water tower (far left) ────────────────────────────────────────────────
S.at(150)
S.D(line(56, 600, 76, 330) + line(146, 600, 126, 330) + line(60, 540, 142, 470) + line(142, 540, 60, 470), "bark")
S.M(rect(50, 250, 102, 90, 6), "wood", step=60)
S.soft("".join(line(50, y, 152, y) for y in (270, 290, 310)))
S.D(pts([(44, 252), (101, 214), (158, 252)], True), "bark")

# ── the sheriff's office and jail ────────────────────────────────────────
S.at(300)
S.M("M180 600V300H220V270H400V300H440V600Z", "sand2", step=60)             # false front
S.soft("".join(line(180, y, 440, y) for y in range(320, 600, 18)))
S.D(rect(230, 282, 160, 30, 3), "paper")
S.fill(rect(250, 292, 120, 10), "ink")                                         # "SHERIFF"
S.D(pts([(310, 340), (318, 356), (336, 358), (322, 370), (326, 388), (310, 378), (294, 388), (298, 370), (284, 358), (302, 356)], True), "gold")   # star
S.M(rect(210, 470, 60, 130, 3), "bark")                                        # door
S.D(circle(260, 540, 3), "gold")
S.M(rect(320, 430, 90, 80, 3), "night")                                        # jail window
S.D("".join(line(x, 430, x, 510) for x in range(334, 410, 14)), "slate")
S.fill(circle(368, 464, 8), "skin2")                                           # someone behind bars
S.D(rect(290, 400, 26, 34, 2), "paper")                                        # wanted poster
S.fill(circle(303, 414, 6), "stone2")
S.fill(rect(294, 424, 18, 3), "ink")
S.D(line(180, 520, 440, 520) + rect(176, 518, 268, 8), "wood")               # porch roof beam
S.D(line(196, 526, 196, 600) + line(424, 526, 424, 600), "wood")
S.D(line(240, 526, 240, 540) + "M232 540H248L246 560H234Z", "gold")          # lantern
S.fill(rect(236, 544, 8, 12), "candle")
# rocking chair on the porch
S.D("M282 596Q308 606 334 596" + line(290, 566, 294, 598) + line(324, 566, 320, 598) + rect(288, 556, 40, 8, 2) + line(292, 556, 296, 520) + line(322, 556, 318, 520) + rect(294, 516, 26, 8, 2), "bark")

# ── the saloon ───────────────────────────────────────────────────────────
S.at(600)
S.M("M470 600V250H500V220H770V250H800V600Z", "brick", step=60)
S.soft("".join(line(470, y, 800, y) for y in range(270, 600, 18)))
S.D(rect(520, 232, 230, 36, 3), "paper")
S.fill(rect(544, 244, 182, 12), "red")                                         # "SALOON"
S.M(rect(470, 390, 330, 12, 2), "wood")                                        # balcony
S.D("".join(line(x, 360, x, 390) for x in range(478, 800, 16)) + line(470, 360, 800, 360), "wood")
S.D(rect(500, 290, 50, 60, 3) + rect(590, 290, 50, 60, 3) + rect(680, 290, 50, 60, 3), "glass")
S.D(line(525, 290, 525, 350) + line(615, 290, 615, 350) + line(705, 290, 705, 350))
S.M(rect(590, 470, 90, 130, 2), "night")                                       # doorway
S.D("M596 500H632V570H596Z" + "M638 500H674V570H638Z", "wood")               # swinging doors
S.soft(line(600, 520, 628, 520) + line(642, 520, 670, 520) + line(600, 546, 628, 546) + line(642, 546, 670, 546))
S.D(rect(496, 470, 60, 70, 3) + rect(714, 470, 60, 70, 3), "glass")
S.D(line(470, 520, 800, 520) + rect(466, 518, 338, 8), "wood")

# ── the general store ────────────────────────────────────────────────────
S.at(900)
S.M("M840 600V290H870V260H1090V290H1120V600Z", "sage", step=60)
S.soft("".join(line(840, y, 1120, y) for y in range(310, 600, 18)))
S.D(rect(880, 272, 200, 32, 3), "paper")
S.fill(rect(900, 282, 160, 10), "leaf2")
S.D(rect(870, 420, 100, 90, 3), "glass")                                        # shop window with goods
S.fill(rect(882, 470, 16, 30) + rect(906, 476, 22, 24) + rect(936, 466, 14, 34), "rust")
S.M(rect(1000, 450, 70, 150, 3), "bark")
S.D(circle(1060, 530, 3), "gold")
S.D(line(840, 520, 1120, 520) + rect(836, 518, 288, 8), "wood")
for x in (850, 890):                                                           # barrels
    S.M(f"M{x} 600Q{x - 6} 572 {x} 546H{x + 34}Q{x + 40} 572 {x + 34} 600Z", "wood", step=30)
    S.D(line(x - 3, 560, x + 37, 560) + line(x - 3, 586, x + 37, 586), "bark")
S.D("M1076 600Q1070 572 1086 566Q1102 572 1098 600Z", "sand2")                # sacks
S.D("M1094 600Q1090 580 1104 576Q1118 580 1114 600Z", "sand2")
S.D("M1084 566L1088 558M1100 576L1104 568")

# ── boardwalk ────────────────────────────────────────────────────────────
S.at(1100)
S.M(rect(170, WALK, 960, 14, 1), "wood", step=40)
S.soft("".join(line(x, WALK, x, WALK + 14) for x in range(190, 1130, 24)))
S.D("".join(rect(x, WALK + 14, 8, 20) for x in (180, 460, 820, 1110)), "wood")

# ── the shopkeeper at the store door ─────────────────────────────────────
S.at(1200)
sk = S.standing(1032, WALK + 2, coat="sky2", d=-1, arms=[(1010, 560), (1046, 560)], legs="bark", k=1.3, hair="short", hairc="hairb")
S.D(f"M{1032 - 13} {sk['ys'] + 16}H{1032 + 13}L{1032 + 16} {sk['yh'] + 8}H{1032 - 16}Z", "paper")   # apron

# ── hitching post, horse and a water trough ──────────────────────────────
S.at(1300)
S.D(rect(506, 604, 8, 60) + rect(706, 604, 8, 60) + rect(500, 604, 220, 8, 2), "bark")   # hitching post
S.M(rect(730, 640, 90, 30, 4), "wood", step=30)                                        # water trough
S.fill(rect(736, 644, 78, 8), "sky2")
S.shadow(610, 704, 90, 5)
S.D(rect(556, 620, 12, 80, 4) + rect(574, 622, 12, 78, 4) + rect(636, 620, 12, 80, 4) + rect(654, 622, 12, 78, 4), "rust")   # legs
S.M("M548 580Q548 548 600 546Q664 546 672 580Q674 622 640 626H570Q548 622 548 580Z", "rust", step=60)   # body
S.M("M650 560Q668 520 690 496L712 504Q708 520 696 540Q686 566 672 584Z", "rust")      # neck
S.M("M688 492Q696 478 712 480L736 496Q742 504 736 512L716 514Q700 508 688 492Z", "rust")   # head
S.D("M700 484L704 470L710 482", "rust")
S.fill(circle(716, 494, 2), "ink")
S.D("M690 494Q676 520 664 548Q680 522 694 504Z", "ink")                        # mane
S.D("M550 576Q526 590 530 634Q540 606 552 600Z", "ink")                        # tail
S.D("M586 546Q600 538 626 546L630 576H584Z", "red")                            # saddle
S.D(line(608, 576, 608, 600) + rect(602, 600, 12, 6, 2), "ink")                # stirrup
S.D(line(730, 506, 700, 606), None)                                             # reins to the post
S.D(rect(552, 694, 18, 6, 2) + rect(634, 694, 18, 6, 2), "ink")

# ── the sheriff in the street ────────────────────────────────────────────
S.at(1500)
S.shadow(380, 766, 26)
sh = S.standing(380, 766, coat="sand", d=1, arms=[(404, 690), (362, 690)], legs="navy", k=1.6, hair="short", hairc="hairb")
cowboy_hat(sh["head"][0], sh["head"][1] - 8)
S.D(f"M{380 - 16} {sh['ys'] + 4}L{380 - 12} {sh['yh'] - 4}H{380 - 3}V{sh['ys'] + 4}Z" + f"M{380 + 16} {sh['ys'] + 4}L{380 + 12} {sh['yh'] - 4}H{380 + 3}V{sh['ys'] + 4}Z", "bark")   # vest
S.D(pts([(371, 648), (374, 654), (381, 655), (376, 660), (377, 667), (371, 663), (365, 667), (366, 660), (361, 655), (368, 654)], True), "gold")   # badge
S.D(rect(362, 744, 14, 16, 3) + rect(384, 744, 14, 16, 3), "bark")            # boots

# ── tumbleweed and cactuses ──────────────────────────────────────────────
S.at(1700)
S.D(circle(840, 700, 22), "dune")
S.soft("".join(wave(822, 700 + dy, 858, 700 - dy, 3, 5) for dy in (-12, 0, 12)) + circle(840, 700, 14))
S.soft(line(800, 716, 812, 716) + line(790, 708, 806, 708))
for x, h, k in ((1210, 150, 1.0), (1340, 110, 0.8)):
    S.M(f"M{x - 12} 600V{600 - h + 12}Q{x - 12} {600 - h} {x} {600 - h}Q{x + 12} {600 - h} {x + 12} {600 - h + 12}V600Z", "cactus", step=40)
    S.D(f"M{x - 12} {600 - h * 0.5}H{x - 30 * k}V{600 - h * 0.78}Q{x - 30 * k} {600 - h * 0.86} {x - 22 * k} {600 - h * 0.86}Q{x - 16 * k} {600 - h * 0.86} {x - 16 * k} {600 - h * 0.78}V{600 - h * 0.6}H{x - 12}", "cactus")
    S.D(f"M{x + 12} {600 - h * 0.62}H{x + 28 * k}V{600 - h * 0.9}Q{x + 28 * k} {600 - h * 0.98} {x + 20 * k} {600 - h * 0.98}Q{x + 14 * k} {600 - h * 0.98} {x + 14 * k} {600 - h * 0.9}V{600 - h * 0.72}H{x + 12}", "cactus")

# ── the stagecoach ───────────────────────────────────────────────────────
S.at(1900)
S.shadow(1190, 764, 150, 6)
S.M("M1080 690V610Q1080 590 1100 590H1290Q1310 590 1310 610V690Z", "red", step=60)
S.D(rect(1110, 606, 60, 44, 4) + rect(1200, 606, 60, 44, 4), "glass")
S.D(rect(1170, 606, 28, 84, 2), "red")
S.D(circle(1192, 650, 2.4), "gold")
S.D(rect(1100, 570, 160, 20, 4), "wood")                                         # luggage on the roof
S.D(rect(1116, 556, 40, 16, 3) + rect(1170, 552, 50, 20, 3), "bark")
S.D(rect(1300, 620, 50, 10, 3) + line(1344, 620, 1352, 596), "wood")             # driver's seat
wheel(1116, 718, 34)
wheel(1276, 718, 34)
S.D(line(1080, 690, 1310, 690), "ink")

# ── words ─────────────────────────────────────────────────────────────────
R, P = words(S)
R("street", "main street", (0, 480, 1400, 320), (24, 780), "A2", "ˌmeɪn ˈstriːt",
  "The most important street in a town.", "Everything happens on the main street.")
R("town", "town", (0, 200, 1400, 600), (24, 222), "A1", "taʊn",
  "A place with houses and shops, smaller than a city.", "It's a small town in the desert.")
S.meta["zones"] = [
    dict(id="sheriffz", chip="The sheriff's office", box=[160, 250, 300, 530]),
    dict(id="saloonz", chip="The saloon", box=[460, 200, 380, 520]),
    dict(id="storez", chip="The general store", box=[820, 240, 580, 540]),
]
S.meta["groups"] = {"land": "The land", "sheriff": "The sheriff's office", "saloon": "The saloon", "store": "The store", "people": "People and animals"}

P("sun", "sun", "A1", "land", (1220, 170), (1170, 120, 100, 100), "sʌn", "noun",
  "The star that gives us light and heat.", "The sun is hot in the desert.")
P("desert", "desert", "A2", "land", (1280, 530), (1120, 480, 280, 110), "ˈdezət", "noun",
  "A large dry area with very little rain.", "The town is in the middle of the desert.")
P("mesas", "rocky hills", "B1", "land", (140, 420), (60, 390, 1060, 70), "ˌrɒki ˈhɪlz", "noun",
  "Hills made of rock with flat tops.", "Red rocky hills rise behind the town.", "mesas")
P("cactus", "cactus", "A2", "land", (1210, 520), (1170, 440, 200, 162), "ˈkæktəs", "noun",
  "A desert plant with spines instead of leaves.", "A tall cactus grows next to the store.")
P("tumbleweed", "tumbleweed", "B2", "land", (840, 700), (788, 676, 76, 48), "ˈtʌmblwiːd", "noun",
  "A dry plant that rolls across the ground in the wind.", "A tumbleweed rolled down the empty street.")
P("road", "dusty road", "A2", "land", (700, 760), (0, 620, 1400, 180), "ˌdʌsti ˈrəʊd", "noun",
  "A road made of dry earth.", "The stagecoach came down the dusty road.")
P("tower", "water tower", "B1", "land", (101, 300), (44, 212, 116, 390), "ˈwɔːtə ˌtaʊə", "noun",
  "A tall tank that stores water for a town.", "The water tower is the tallest thing in town.")

P("office", "sheriff's office", "B1", "sheriff", (300, 320), (180, 270, 260, 330), "ˈʃerɪfs ˌɒfɪs", "noun",
  "The building where the sheriff works.", "Meet me at the sheriff's office at noon.")
P("jail", "jail", "B1", "sheriff", (365, 470), (320, 430, 90, 80), "dʒeɪl", "noun",
  "A place where people are kept as a punishment.", "The thief is in jail.", "prison")
P("bars", "bars", "B1", "sheriff", (390, 490), (330, 430, 80, 80), "bɑːz", "noun",
  "Metal rods over a window.", "He's looking out through the bars.")
P("poster", "wanted poster", "B1", "sheriff", (303, 416), (288, 398, 30, 38), "ˈwɒntɪd ˌpəʊstə", "noun",
  "A notice with a picture of someone the police are looking for.", "There's a wanted poster on the wall.")
P("lantern", "lantern", "B1", "sheriff", (240, 550), (228, 526, 24, 36), "ˈlæntən", "noun",
  "A lamp in a metal and glass case.", "A lantern hangs over the porch.")
P("chair", "rocking chair", "B1", "sheriff", (308, 576), (280, 512, 58, 96), "ˈrɒkɪŋ tʃeə", "noun",
  "A chair that moves backwards and forwards.", "The old rocking chair is empty.")
P("porch", "porch", "B1", "sheriff", (200, 560), (176, 516, 268, 84), "pɔːtʃ", "noun",
  "A covered area in front of the door of a building.", "The sheriff sits on the porch in the evening.")

P("saloon", "saloon", "B1", "saloon", (560, 440), (470, 218, 330, 382), "səˈluːn", "noun",
  "A bar in the Old West.", "The saloon has a piano and a long bar inside.")
P("doors", "swinging doors", "B1", "saloon", (616, 530), (594, 498, 82, 74), "ˌswɪŋɪŋ ˈdɔːz", "noun",
  "Short doors that swing open both ways.", "He pushed through the swinging doors.")
P("balcony", "balcony", "A2", "saloon", (760, 380), (468, 358, 334, 46), "ˈbælkəni", "noun",
  "A small platform outside an upstairs window.", "Someone is waving from the balcony.")
P("sign", "sign", "A1", "saloon", (635, 250), (518, 230, 234, 40), "saɪn", "noun",
  "A board with words that tells you what a place is.", "The sign says SALOON.")
P("windows", "windows", "A1", "saloon", (525, 320), (498, 288, 234, 64), "ˈwɪndəʊz", "noun",
  "Openings in a wall with glass in them.", "The saloon has three windows upstairs.")

P("store", "general store", "B1", "store", (980, 340), (840, 258, 280, 342), "ˌdʒenrəl ˈstɔː", "noun",
  "A shop that sells a little of everything.", "You can buy flour and boots at the general store.")
P("barrels", "barrels", "B1", "store", (867, 575), (844, 544, 86, 58), "ˈbærəlz", "noun",
  "Big round wooden containers.", "The barrels are full of apples.")
P("sacks", "sacks", "B1", "store", (1094, 588), (1070, 556, 50, 46), "sæks", "noun",
  "Big bags made of rough cloth.", "Sacks of flour stand by the door.")
P("shopkeeper", "shopkeeper", "B1", "people", (1032, 540), (1000, 440, 64, 164), "ˈʃɒpkiːpə", "noun",
  "A person who owns a shop.", "The shopkeeper is waiting for customers.", "storekeeper")
P("apron", "apron", "A2", "people", (1032, 560), (1014, 520, 36, 60), "ˈeɪprən", "noun",
  "Clothes you wear over your clothes to keep them clean.", "The shopkeeper is wearing a white apron.")

P("sheriff", "sheriff", "B1", "people", (380, 700), (340, 560, 90, 206), "ˈʃerɪf", "noun",
  "The officer who keeps the law in a town.", "The sheriff is standing in the middle of the street.")
P("hat", "cowboy hat", "A2", "people", (390, 578), (364, 560, 52, 32), "ˈkaʊbɔɪ hæt", "noun",
  "A hat with a wide brim.", "He never takes off his cowboy hat.")
P("badge", "badge", "B1", "people", (371, 658), (360, 646, 22, 22), "bædʒ", "noun",
  "A small metal star that shows someone's job.", "The sheriff's badge is shaped like a star.")
P("boots", "boots", "A1", "people", (390, 752), (360, 740, 40, 24), "buːts", "noun",
  "Shoes that cover your feet and ankles.", "He's wearing brown leather boots.")
P("horse", "horse", "A1", "people", (610, 590), (546, 470, 196, 232), "hɔːs", "noun",
  "A big animal that people ride.", "A horse is waiting outside the saloon.")
P("saddle", "saddle", "B1", "people", (606, 560), (584, 538, 48, 40), "ˈsædl", "noun",
  "The seat you put on a horse's back.", "The saddle is red.")
P("post", "hitching post", "B2", "people", (520, 610), (498, 602, 224, 64), "ˈhɪtʃɪŋ pəʊst", "noun",
  "A wooden rail where you tie a horse.", "Tie the horse to the hitching post.")
P("trough", "water trough", "B1", "people", (776, 656), (728, 638, 94, 34), "ˈwɔːtə trɒf", "noun",
  "A long box that holds water for animals.", "The horse is drinking from the water trough.")
P("coach", "stagecoach", "B1", "people", (1150, 640), (1078, 550, 276, 204), "ˈsteɪdʒkəʊtʃ", "noun",
  "A big carriage pulled by horses that took people between towns.", "The stagecoach arrives at three o'clock.")
P("wheel", "wheel", "A1", "people", (1276, 718), (1240, 682, 72, 72), "wiːl", "noun",
  "A round thing that turns so a vehicle can move.", "One wheel of the stagecoach is broken.")

S.meta.update(
    view=[0, 180, 1400, 620],
    roomsTitle="Places",
    title="The Frontier Town",
    kicker="Picture Studio · Adventure & Exploration",
    dek="The main street of a small desert town: the sheriff, the saloon, the general store and a stagecoach.",
    inspired="Inspired by classic Westerns",
    frames=["The … is between the … and the …", "Across the street there is a …", "In the Old West, people used to …",
            "The sheriff is looking for …", "It's so hot that …", "The stagecoach is going to …"],
)
TF = [
    ("There is a horse outside the saloon.", True, "A1"),
    ("The sheriff is wearing a hat.", True, "A1"),
    ("The stagecoach is blue.", False, "A1"),
    ("There are two cactuses in the picture.", True, "A1"),
    ("Someone is in the jail.", True, "A2"),
    ("The general store is next to the sheriff's office.", False, "A2"),
    ("There are barrels in front of the store.", True, "A2"),
    ("The water tower is on the right.", False, "A2"),
    ("The saloon has swinging doors.", True, "B1"),
    ("The horse is tied to the hitching post.", True, "B1"),
    ("The shopkeeper is standing on the boardwalk.", True, "B1"),
    ("The rocking chair is on the saloon balcony.", False, "B1"),
]
PROMPTS = {
    "A1": ["What buildings can you see? Write five sentences.",
           "Describe the sheriff: his clothes, his hat, his boots.",
           "Is it hot or cold in the town? How do you know?"],
    "A2": ["Imagine you arrive on the stagecoach. Describe the town.",
           "Life in the Old West: what did people use to do? Use used to.",
           "Write a wanted poster: who, what they did, the reward."],
    "B1": ["Tell the story of the day a stranger came to town.",
           "Would you like to have lived in the Old West? Compare it with life today.",
           "Write the sheriff's report about the prisoner in the jail."],
}
finish(S, TF, PROMPTS)
