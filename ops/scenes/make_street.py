"""Picture Studio · The High Street — a row of shops with flats above, the
pavement, a zebra crossing and a bus stop. Writes data/scenes/street.json.

    python3 ops/scenes/make_street.py
"""
import math
import os
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob

ROOT = os.path.dirname(os.path.abspath(__file__))
S = Scene("street", 1400, 800)
B = 690          # foot of the buildings
KERB = 716       # edge of the pavement
SHOP_TOP = 530   # top of the shop fronts


def facade(x0, x1, top, wall, roof="flat", floors=2, pattern="bricks"):
    """A building: upper floors with windows over a shop front."""
    S.M(rect(x0, top, x1 - x0, B - top), wall, step=40)
    S.wallpaper((x0 + 1, top + 1, x1 - x0 - 2, SHOP_TOP - top - 2), wall, pattern)
    if roof == "pitched":
        S.M(pts([(x0 - 6, top), ((x0 + x1) / 2, top - 70), (x1 + 6, top)], True), "brick")
        S.D(rect(x1 - 48, top - 58, 18, 40), "brick")
        S.D(rect(x1 - 51, top - 62, 24, 6), "steel")
    elif roof == "gable":
        S.M(pts([(x0, top), (x0, top - 20), ((x0 + x1) / 2, top - 62), (x1, top - 20), (x1, top)], True), wall)
        S.D(circle((x0 + x1) / 2, top - 22, 10), "glass")
    else:
        S.M(rect(x0 - 4, top - 12, x1 - x0 + 8, 14, 2), "steel")
    h = (SHOP_TOP - top - 20) / floors
    for f in range(floors):
        y = top + 16 + f * h
        n = 2 if x1 - x0 < 170 else 3
        w = (x1 - x0 - 30) / n
        for i in range(n):
            wx = x0 + 15 + i * w + 8
            S.D(rect(wx, y, w - 16, h - 22, 2), "glass")
            S.D(line(wx + (w - 16) / 2, y, wx + (w - 16) / 2, y + h - 22))
            S.D(rect(wx - 4, y + h - 22, w - 8, 5, 1), "paper")


def shopfront(x0, x1, fascia, door_right=True, awning=None):
    S.M(rect(x0, SHOP_TOP, x1 - x0, 34, 2), fascia)                           # fascia (sign board)
    dw = 40
    dx = x1 - dw - 10 if door_right else x0 + 10
    wx0, wx1 = (x0 + 10, dx - 8) if door_right else (dx + dw + 8, x1 - 10)
    S.M(rect(wx0, SHOP_TOP + 46, wx1 - wx0, B - SHOP_TOP - 64, 2), "glass")  # shop window
    S.D(rect(wx0 - 4, B - 18, wx1 - wx0 + 8, 18, 1), fascia)
    S.M(rect(dx, SHOP_TOP + 46, dw, B - SHOP_TOP - 46, 2), "wood")           # door
    S.D(rect(dx + 6, SHOP_TOP + 54, dw - 12, 50, 2), "glass")
    S.D(circle(dx + (6 if door_right else dw - 6), 628, 2.5), "ink")
    if awning:
        stripes = int((x1 - x0) / 20)
        for i in range(stripes):
            a = x0 - 4 + i * (x1 - x0 + 8) / stripes
            b = x0 - 4 + (i + 1) * (x1 - x0 + 8) / stripes
            S.D(pts([(a, SHOP_TOP + 36), (b, SHOP_TOP + 36), (b + 6, SHOP_TOP + 66), (a + 6, SHOP_TOP + 66)], True),
                awning if i % 2 == 0 else "paper")
        S.D(wave(x0 + 2, SHOP_TOP + 66, x1 + 10, SHOP_TOP + 66, stripes, 3))
    return wx0, wx1


# ── sky, pavement, road ───────────────────────────────────────────────────
S.at(0)
S.sky(sun=(1300, 300))
S.H(wave(250, 290, 330, 290, 3, 4) + wave(264, 279, 310, 279, 2, 3))
S.fill(rect(0, B, 1400, KERB - B), "sand2")                                 # pavement
S.soft("".join(line(x, B, x - 6, KERB) for x in range(20, 1400, 40)))
S.fill(rect(0, KERB, 1400, 800 - KERB), "asphalt")                          # road
S.D(rect(0, KERB, 1400, 5), "steel")                                        # kerb
for x in range(0, 1400, 80):
    if not 620 <= x <= 800:
        S.fill(rect(x, 772, 40, 5), "paper")
for i in range(7):                                                          # zebra crossing
    x = 640 + i * 20
    S.fill(pts([(x, 721), (x + 11, 721), (x + 17, 800), (x + 6, 800)], True), "paper")
S.M(line(0, B, 1400, B), step=0)

# ── buildings and shops ───────────────────────────────────────────────────
S.at(200)
facade(0, 160, 330, "sand", roof="pitched")
facade(160, 310, 360, "mint", roof="flat", pattern="stripes")
facade(310, 470, 310, "brick", roof="gable")
facade(470, 650, 300, "steel", roof="flat", floors=2, pattern="planks")
facade(650, 840, 340, "sky", roof="pitched")
facade(840, 1000, 320, "lav", roof="gable", pattern="stripes")
facade(1000, 1180, 350, "blush", roof="flat")

S.at(900)
# bakery
wx0, wx1 = shopfront(0, 160, "sand2", awning="blush2")
S.D(rect(wx0 + 4, 640, wx1 - wx0 - 8, 4), "wood")
for x in range(int(wx0) + 6, int(wx1) - 20, 26):
    S.D(f"M{x} 640Q{x} 624 {x + 11} 624Q{x + 22} 624 {x + 22} 640Z", "sand2")
    S.D(f"M{x + 2} 610V600Q{x + 10} 594 {x + 18} 600V610Z", "blush2")
S.D(rect(wx0 + 4, 610, wx1 - wx0 - 8, 3), "wood")
S.D("M60 556Q60 540 74 540Q88 540 88 556Z", "wood")                          # bread icon
# pharmacy
wx0, wx1 = shopfront(160, 310, "leaf", door_right=False)
S.D("M196 540H206V532H214V540H222V548H214V556H206V548H196Z", "lime")        # green cross
S.D(rect(236, 540, 60, 6, 2) + rect(236, 552, 44, 4, 2), "paper")
for x in range(int(wx0) + 6, int(wx1) - 10, 14):
    S.D(rect(x, 626, 10, 20, 2), "paper")
    S.D(rect(x + 2, 622, 6, 4), "lime")
S.D(rect(wx0 + 4, 646, wx1 - wx0 - 8, 3), "wood")
# post office
wx0, wx1 = shopfront(310, 470, "red")
S.D(rect(368, 538, 40, 22, 2) + "M368 538L388 552L408 538", "paper")        # envelope icon
S.D(rect(wx0 + 8, 600, 60, 44, 2), "paper")
S.soft("".join(line(wx0 + 12, y, wx0 + 64, y) for y in range(608, 642, 7)))
# bank
S.M(rect(470, SHOP_TOP - 6, 180, 40, 2), "steel")
S.M(pts([(478, SHOP_TOP - 6), (560, SHOP_TOP - 34), (642, SHOP_TOP - 6)], True), "steel")
for x in (486, 526, 594, 634):                                              # columns
    S.M(rect(x - 8, SHOP_TOP + 34, 16, B - SHOP_TOP - 34), "paper")
    S.soft(line(x - 4, SHOP_TOP + 36, x - 4, B) + line(x + 4, SHOP_TOP + 36, x + 4, B))
S.M(rect(540, SHOP_TOP + 50, 40, B - SHOP_TOP - 50, 2), "wood")
S.D(rect(546, SHOP_TOP + 58, 28, 50, 2), "glass")
S.D("M548 518L560 510L572 518Z" + rect(550, 520, 20, 4) + line(553, 524, 553, 534) + line(560, 524, 560, 534) + line(567, 524, 567, 534), "paper")
S.M(rect(602, 590, 22, 46, 3), "ink")                                       # cash machine
S.D(rect(605, 594, 16, 12, 1), "glass")
S.D(rect(605, 612, 16, 12, 1), "steel")
S.D(rect(606, 628, 14, 3), "lime")
# café
wx0, wx1 = shopfront(650, 840, "sky2", awning="lime")
S.D("M724 540H744V552Q744 560 734 560Q724 560 724 552Z" + "M744 544Q752 544 750 552", "paper")   # cup icon
S.D(rect(wx0 + 6, 640, wx1 - wx0 - 12, 3), "wood")
for x in range(int(wx0) + 10, int(wx1) - 20, 30):
    S.D(f"M{x} 640V628H{x + 12}V640Z", "paper")
# bookshop
wx0, wx1 = shopfront(840, 1000, "lav2")
S.D("M890 538L906 544L922 538V558L906 562L890 558Z" + line(906, 544, 906, 562), "paper")   # book icon
import random
rnd = random.Random(3)
for y in (606, 640):
    S.D(rect(wx0 + 4, y + 2, wx1 - wx0 - 8, 3), "wood")
    x = wx0 + 6
    while x < wx1 - 12:
        w = rnd.choice((5, 6, 8))
        h = rnd.choice((20, 24, 28))
        S.D(rect(x, y + 2 - h, w, h, 1), rnd.choice(("red", "sky2", "lime", "sun", "leaf", "blush2")))
        x += w + 1
# clothes shop
wx0, wx1 = shopfront(1000, 1180, "blush2", door_right=False)
S.D("M1110 538L1118 534L1126 538L1138 534L1146 540L1140 546L1136 544V562H1116V544L1112 546L1106 540Z", "paper")   # T-shirt icon
for mx, f in ((1086, "red"), (1126, "sky2")):                               # mannequins
    S.D(circle(mx, 596, 6), "paper")
    S.D(f"M{mx - 10} 606H{mx + 10}L{mx + 14} 646H{mx - 14}Z", f)
    S.D(line(mx, 646, mx, 666) + line(mx - 8, 666, mx + 8, 666))
S.D(pts([(1150, 612), (1166, 612), (1170, 650), (1146, 650)], True), "lime")

# ── pavement things ───────────────────────────────────────────────────────
S.at(1800)
for lx in (300, 990):                                                        # lamp posts
    S.D(rect(lx - 3, 470, 6, B - 470), "ink")
    S.D(f"M{lx} 474Q{lx} 456 {lx + 22} 456", None)
    S.M(pts([(lx + 14, 452), (lx + 36, 452), (lx + 32, 462), (lx + 18, 462)], True), "ink")
    S.D(ellipse(lx + 25, 463, 8, 2), "sun")
S.D(rect(290, 668, 20, 24, 3), "leaf")                                       # bin
S.D(rect(288, 664, 24, 5, 2), "ink")
S.M(rect(436, 634, 26, 56, 8), "red")                                       # post box
S.D(rect(432, 628, 34, 10, 5) + rect(442, 652, 14, 3), "ink")
S.D(rect(442, 660, 14, 10, 1), "paper")
for bx in (636, 800):                                                        # Belisha beacons
    S.D(rect(bx - 2, 606, 4, 110), "ink")
    S.soft("".join(line(bx - 2, y, bx + 2, y) for y in range(612, 714, 12)))
    S.M(circle(bx, 598, 9), "sun")
# café tables outside
S.D(line(724, 612, 724, B))
S.M("M680 614Q724 590 768 614Z", "lime")                                     # parasol
S.M(rect(704, 660, 40, 5, 2), "paper")
S.D(line(724, 665, 724, B) + line(714, B, 734, B))
S.D(rect(688, 670, 12, 20, 2) + rect(748, 670, 12, 20, 2), "paper")
S.D(rect(698, 654, 8, 6, 2) + rect(740, 652, 8, 8, 2), "sky2")
S.M(pts([(812, 646), (832, 646), (838, B), (806, B)], True), "ink")          # menu board
S.fill(rect(816, 654, 16, 3) + rect(816, 662, 14, 3) + rect(816, 670, 16, 3), "paper")
# tree in a pit
S.tree(1199, B, 520, 38, 46, seed=13)
S.D(rect(1182, 686, 36, 5, 2), "ink")

# bus stop
S.at(2300)
S.M(rect(1230, 580, 110, 8, 2), "steel")                                     # shelter roof
S.fill(rect(1234, 588, 100, 100), "glassa")
S.D(rect(1234, 588, 100, 100), None)
S.D(line(1234, 588, 1234, B) + line(1334, 588, 1334, B), "steel")
S.D(rect(1244, 600, 30, 40, 2), "paper")                                     # timetable
S.soft("".join(line(1248, y, 1270, y) for y in range(606, 636, 5)))
S.D(rect(1250, 660, 70, 5, 2) + line(1256, 665, 1256, B) + line(1314, 665, 1314, B), "wood")   # bench
S.D(rect(1366, 560, 4, 130), "ink")                                          # bus stop sign
S.M(circle(1368, 556, 16), "lime")
S.D(rect(1358, 549, 20, 12, 3), "ink")
S.fill(rect(1360, 551, 7, 5) + rect(1369, 551, 7, 5), "glass")
S.D(circle(1362, 562, 2) + circle(1374, 562, 2), "ink")
S.sitting(1296, 660, B, coat="sky2", legs="ink", d=-1, k=0.9)                # someone waiting

# ── people and traffic ────────────────────────────────────────────────────
S.at(2700)
S.shadow(540, B + 4, 16)
S.standing(540, B + 4, coat="lav2", d=1, arms=[(560, 650)], legs="ink", h=104)   # shopper
S.M("M556 670V648H572V670Z", "sand2")
S.D("M558 648Q564 638 570 648")
S.shadow(700, 760, 16)
S.standing(700, 760, coat="red", d=1, legs="sky2", h=104)                    # crossing the road
S.shadow(1110, B + 4, 16)
S.standing(1110, B + 4, coat="sun", d=-1, legs="ink", h=104, arms=[(1090, 606)])   # umbrella
S.D(line(1090, 606, 1090, 562))
S.M("M1062 566Q1090 540 1118 566Z", "sky2")
# car
S.shadow(150, 796, 110, 4)
S.M("M40 790V760Q40 744 60 742L92 740L116 716H200L230 740L252 744Q262 748 262 762V790Z", "red", step=60)
S.D(pts([(100, 740), (120, 722), (156, 722), (156, 740)], True) + pts([(162, 740), (162, 722), (196, 722), (218, 740)], True), "glass")
for cx in (84, 216):
    S.M(circle(cx, 790, 16), "ink")
    S.D(circle(cx, 790, 6), "paper")
S.D(rect(250, 752, 12, 8, 2), "sun")
# cyclist
S.M(circle(900, 770, 18), None)
S.M(circle(962, 770, 18), None)
S.D(pts([(900, 770), (926, 770), (918, 740), (900, 770)]) + pts([(918, 740), (950, 740), (962, 770)]) + line(926, 770, 950, 748))
S.D(line(906, 736, 928, 736) + pts([(948, 740), (946, 728), (956, 726)]))
S.M(f"M912 736L920 700Q928 694 936 700L932 736Z", "lime")                    # rider
S.D(line(924, 736, 928, 768) + line(924, 736, 940, 756), None)
S.M(circle(928, 686, 8), "wood")
S.D("M918 684Q928 670 940 682Z", "red")                                      # helmet
S.D(line(932, 704, 952, 726))

# ── words ─────────────────────────────────────────────────────────────────
def R(rid, word, box, label, level, ipa, d, ex, us=None):
    card = dict(level=level, ipa=ipa, pos="noun", def_=d, ex=ex)
    if us:
        card["us"] = us
    S.room(rid, word, box, label, **card)


R("highstreet", "high street", (0, 230, 1400, 570), (20, 256), "B1", "ˈhaɪ striːt",
  "The main street of a town, with most of the shops.", "There's a new café on the high street.", "main street")
R("bakery", "bakery", (0, 260, 160, 430), (14, 572), "A2", "ˈbeɪkəri",
  "A shop that makes and sells bread and cakes.", "I buy fresh bread from the bakery every morning.")
R("pharmacy", "chemist's", (160, 360, 150, 330), (174, 572), "A2", "ˈkemɪsts",
  "A shop that sells medicine, soap and make-up.", "Can you get me some plasters at the chemist's?", "drugstore")
R("postoffice", "post office", (310, 248, 160, 442), (322, 572), "A2", "ˈpəʊst ˌɒfɪs",
  "The place where you send letters and parcels.", "I need to post this parcel at the post office.")
R("bank", "bank", (470, 260, 180, 430), (484, 572), "A1", "bæŋk",
  "A place that keeps your money safe.", "The bank opens at nine.")
R("cafe", "café", (650, 270, 190, 420), (664, 572), "A1", "ˈkæfeɪ",
  "A small restaurant for drinks and light meals.", "Let's meet at the café for a coffee.", "coffee shop")
R("bookshop", "bookshop", (840, 258, 160, 432), (854, 572), "A2", "ˈbʊkʃɒp",
  "A shop that sells books.", "The bookshop has a sale this week.", "bookstore")
R("clothes", "clothes shop", (1000, 350, 180, 340), (1014, 572), "A2", "ˈkləʊðz ʃɒp",
  "A shop that sells clothes.", "I bought this jacket in the clothes shop.", "clothing store")
R("busstop", "bus stop", (1224, 530, 176, 160), (1240, 572), "A2", "ˈbʌs stɒp",
  "A place where the bus stops for people to get on and off.", "Wait for me at the bus stop.")
S.meta["zones"] = [
    dict(id="left", chip="Left", box=[0, 430, 480, 370]),
    dict(id="middle", chip="Middle", box=[460, 430, 560, 370]),
    dict(id="right", chip="Right", box=[980, 430, 420, 370]),
]
S.meta["groups"] = {"shops": "Shops", "street": "On the street", "traffic": "On the road", "people": "People",
                    "buildings": "Buildings"}


def P(pid, word, level, room, pin, box, ipa, pos, d, ex, us=None):
    card = dict(level=level, room=room, ipa=ipa, pos=pos, def_=d, ex=ex)
    if us:
        card["us"] = us
    S.part(pid, word, pin, box, **card)


P("shopwindow", "shop window", "B1", "shops", (60, 660), (8, 574, 106, 116), "ˌʃɒp ˈwɪndəʊ", "noun",
  "The big window at the front of a shop, where things are shown.", "The cakes in the shop window look amazing.", "store window")
P("awning", "awning", "B1", "shops", (40, 584), (-4, 564, 176, 36), "ˈɔːnɪŋ", "noun",
  "A piece of cloth over a shop window, to keep off the sun and rain.", "We stood under the awning until the rain stopped.")
P("sign", "sign", "A2", "shops", (260, 546), (160, 530, 150, 34), "saɪn", "noun",
  "A board with a name or a picture on it.", "The chemist's has a green cross on its sign.")
P("door", "door", "A1", "shops", (142, 640), (110, 576, 44, 114), "dɔː", "noun",
  "The part you open to go into a building.", "The shop door is open.")
P("cashmachine", "cash machine", "B1", "street", (613, 600), (600, 586, 26, 52), "ˈkæʃ məˌʃiːn", "noun",
  "A machine in a wall where you get money with your bank card.", "Is there a cash machine near here?", "ATM")
P("postbox", "post box", "B1", "street", (449, 646), (430, 626, 38, 64), "ˈpəʊst bɒks", "noun",
  "A red box in the street where you post letters.", "Can you put this letter in the post box?", "mailbox")
P("lamppost", "lamp post", "B1", "street", (300, 560), (294, 450, 44, 240), "ˈlæmp pəʊst", "noun",
  "A tall post in the street with a light at the top.", "I'll meet you by the lamp post.", "streetlight")
P("bin", "bin", "A2", "street", (300, 678), (286, 662, 28, 30), "bɪn", "noun",
  "A container in the street for rubbish.", "Put your rubbish in the bin.", "trash can")
P("parasol", "parasol", "B1", "street", (704, 604), (678, 588, 92, 30), "ˈpærəsɒl", "noun",
  "A big umbrella over a table, to keep off the sun.", "Let's sit under the parasol.", "umbrella")
P("table", "table", "A1", "street", (740, 664), (686, 654, 76, 36), "ˈteɪbl", "noun",
  "A piece of furniture with a flat top on legs.", "There's a free table outside the café.")
P("menuboard", "menu board", "B1", "street", (822, 664), (804, 644, 36, 46), "ˈmenjuː bɔːd", "noun",
  "A small board outside a café with the food and prices.", "The menu board says soup of the day is tomato.")
P("tree", "tree", "A1", "street", (1199, 540), (1158, 470, 82, 222), "triː", "noun",
  "A tall plant with a trunk, branches and leaves.", "There's a tree in front of the clothes shop.")
P("shelter", "bus shelter", "B1", "street", (1300, 610), (1228, 576, 110, 114), "ˈbʌs ˌʃeltə", "noun",
  "A small building with a roof at a bus stop.", "We waited in the bus shelter out of the rain.")
P("timetable", "timetable", "B1", "street", (1259, 620), (1242, 598, 34, 44), "ˈtaɪmteɪbl", "noun",
  "A list of the times when buses come.", "Check the timetable - the next bus is at ten past.", "schedule")
P("bench", "bench", "A2", "street", (1264, 662), (1248, 656, 74, 34), "bentʃ", "noun",
  "A long seat for two or more people.", "An old man is sitting on the bench.")
P("pavement", "pavement", "B1", "street", (500, 706), (0, 690, 1400, 26), "ˈpeɪvmənt", "noun",
  "The path at the side of a road for people to walk on.", "Walk on the pavement, not in the road!", "sidewalk")
P("flats", "flats", "A2", "buildings", (80, 440), (4, 334, 150, 190), "flæts", "noun",
  "Homes on one floor of a bigger building.", "People live in the flats above the shops.", "apartments")
P("roof", "roof", "A1", "buildings", (932, 272), (840, 256, 160, 64), "ruːf", "noun",
  "The top cover of a building.", "There's a round window in the roof.")
P("chimney", "chimney", "A2", "buildings", (121, 290), (106, 264, 30, 44), "ˈtʃɪmni", "noun",
  "A pipe on a roof that takes smoke away.", "Smoke is coming out of the chimney.")
P("windows", "windows", "A1", "buildings", (560, 380), (482, 312, 156, 190), "ˈwɪndəʊz", "noun",
  "Openings in a wall with glass.", "All the windows of the bank are closed.")

# traffic
P("zebra", "zebra crossing", "B1", "traffic", (720, 740), (636, 716, 170, 84), "ˌzebrə ˈkrɒsɪŋ", "noun",
  "Black and white lines across a road where people can cross.", "Always cross at the zebra crossing.", "crosswalk")
P("beacon", "Belisha beacon", "B1", "traffic", (636, 598), (626, 588, 20, 128), "bəˌliːʃə ˈbiːkən", "noun",
  "A yellow light on a black and white pole that shows a zebra crossing (in Britain).", "The beacons flash so drivers see the crossing.")
P("road", "road", "A1", "traffic", (400, 760), (0, 716, 1400, 84), "rəʊd", "noun",
  "A hard way for cars to drive on.", "Look both ways before you cross the road.", "street")
P("car", "car", "A1", "traffic", (150, 760), (38, 714, 226, 86), "kɑː", "noun",
  "A road vehicle with four wheels and an engine.", "A red car is driving along the high street.")
P("bike", "bike", "A1", "traffic", (931, 772), (880, 740, 102, 52), "baɪk", "noun",
  "A bicycle: two wheels that you ride.", "I ride my bike to the shops.")
P("cyclist", "cyclist", "A2", "traffic", (926, 712), (910, 676, 36, 64), "ˈsaɪklɪst", "noun",
  "A person riding a bike.", "The cyclist is wearing a helmet.")
P("helmet", "helmet", "A2", "traffic", (928, 679), (916, 670, 26, 16), "ˈhelmɪt", "noun",
  "A hard hat that protects your head.", "Always wear a helmet on your bike.")

# people
P("shopper", "shopper", "B1", "people", (540, 640), (518, 586, 58, 108), "ˈʃɒpə", "noun",
  "A person who is shopping.", "The high street is full of shoppers on Saturday.")
P("pedestrian", "pedestrian", "B1", "people", (700, 700), (680, 652, 42, 108), "pəˈdestriən", "noun",
  "A person who is walking in the street.", "Cars must stop for pedestrians at the crossing.")
P("umbrella", "umbrella", "A1", "people", (1090, 558), (1060, 540, 60, 30), "ʌmˈbrelə", "noun",
  "A thing you hold over your head when it rains.", "Take an umbrella - it might rain.")


S.meta.update(
    view=[0, 230, 1400, 570],
    roomsTitle="Shops and places",
    title="The High Street",
    kicker="Picture Studio · Town",
    dek="A high street with shops below and flats above, a zebra crossing, a café and a bus stop.",
    frames=["The … is next to / between / opposite the …", "Go past the … and turn left.",
            "You can buy … at the …", "Excuse me, is there a … near here?", "It's on the left / right.", "I need to go to the … to …"],
)
TF = [
    ("There is a red car on the road.", True, "A1"),
    ("The café is next to the bank.", True, "A1"),
    ("There are three people at the bus stop.", False, "A1"),
    ("The cyclist is wearing a helmet.", True, "A1"),
    ("The bookshop is between the café and the clothes shop.", True, "A2"),
    ("The post box is outside the bakery.", False, "A2"),
    ("You can get money from the cash machine at the bank.", True, "A2"),
    ("Someone is crossing the road at the zebra crossing.", True, "A2"),
    ("The chemist's has a green cross on its sign.", True, "A2"),
    ("There are two mannequins in the window of the clothes shop.", True, "B1"),
    ("The menu board is outside the bookshop.", False, "B1"),
    ("The bus shelter has a timetable in it.", True, "B1"),
    ("There are flats above the shops.", True, "B1"),
    ("The lamp post is in front of the post office.", False, "B1"),
    ("Someone is holding an umbrella outside the clothes shop.", True, "B1"),
]
PROMPTS = {
    "A1": ["What shops are there on your street?",
           "Look at the picture. What can you buy in each shop?",
           "Write five sentences with next to and between."],
    "A2": ["Give directions from the bus stop to the post office.",
           "Plan a Saturday morning on this high street: where do you go and why?",
           "Describe the high street in your town. What's good? What's missing?"],
    "B1": ["Are high street shops dying because of online shopping? Give your view.",
           "Write a review of the café for a local website.",
           "What would make this street better for pedestrians and cyclists?"],
}

for coll in (S.rooms, S.parts):
    for c in coll:
        c["def"] = c.pop("def_")

os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
out = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "scenes"))
S.save(os.path.join(out, "street.json"), truefalse=[dict(s=s, a=a, level=l) for s, a, l in TF], prompts=PROMPTS)
S.svg(os.path.join(ROOT, "out", "street.svg"))
lv = {}
for p in S.parts + S.rooms:
    lv[p["level"]] = lv.get(p["level"], 0) + 1
print(f"street: {len(S.items)} items, {len(S.parts)} parts + {len(S.rooms)} rooms, levels {lv}, "
      f"{os.path.getsize(os.path.join(out, 'street.json')) // 1024} KB")
