"""Picture Studio · The Supermarket — one long supermarket wall, close up:
fruit and vegetables, the bakery, the dairy fridge, the freezer, a shelf of
groceries and the checkout. Writes data/scenes/supermarket.json.

    python3 ops/scenes/make_supermarket.py
"""
import math
import os
import random
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob

ROOT = os.path.dirname(os.path.abspath(__file__))
S = Scene("supermarket", 1400, 800)
G = 740
CEIL = 340
K = 1.6            # people are drawn at 1.6x: this picture is a close-up
rnd = random.Random(21)


def mound(x0, x1, y, fill, r, rows=2, shape="circle"):
    """Fruit piled in a crate: rows of small shapes along the crate top."""
    d = ""
    for row in range(rows):
        yy = y - row * r * 1.5
        start = x0 + r + (r if row % 2 else 0)
        end = x1 - r - row * r
        x = start
        while x <= end:
            if shape == "circle":
                d += circle(x + rnd.uniform(-1, 1), yy + rnd.uniform(-1, 1), r)
            elif shape == "carrot":
                d += pts([(x - r * 0.7, yy - r), (x + r * 0.7, yy - r), (x, yy + r * 1.6)], True)
            x += r * 2
    S.D(d, fill)


def sign(x0, x1, y0, fill):
    S.D(line(x0 + 10, CEIL, x0 + 10, y0) + line(x1 - 10, CEIL, x1 - 10, y0))
    S.M(rect(x0, y0, x1 - x0, 40, 4), fill)


# ── the room ──────────────────────────────────────────────────────────────
S.at(0)
S.fill(rect(0, 300, 1400, CEIL - 300), "paper")
S.wallpaper((0, CEIL, 1400, G - CEIL), "sand", None, dado=70)
S.fill(rect(0, 470, 1400, 8), "lime")
S.M(line(0, CEIL, 1400, CEIL), step=0)
for x in range(60, 1400, 200):                                              # strip lights
    S.D(rect(x, CEIL, 90, 6, 3), "sun")
S.fill(rect(0, G, 1400, 60), "tint")
S.soft("".join(line(0, y, 1400, y) for y in (752, 770, 796)) + "".join(line(x, G, x - 40, 800) for x in range(40, 1460, 64)))
S.M(line(0, G, 1400, G), step=0)

# ── entrance ──────────────────────────────────────────────────────────────
S.at(200)
S.M(rect(14, 516, 92, 224, 2), "glassa")
S.D(line(60, 516, 60, G) + rect(10, 508, 100, 10, 2))
S.D(rect(10, 508, 100, 10, 2), "steel")
S.H(line(24, 540, 44, 560) + line(70, 540, 90, 560))
S.D(rect(20, 520, 12, 8, 2) + rect(88, 520, 12, 8, 2), "lime")
for i in range(4):                                                          # stack of baskets
    y = 736 - i * 10
    S.M(pts([(112, y - 14), (158, y - 14), (154, y), (116, y)], True), "red")
S.D("M120 702Q135 684 150 702", None)

# ── fruit and vegetables ──────────────────────────────────────────────────
S.at(500)
sign(230, 350, 400, "lime")
S.D(circle(280, 420, 9), "red")
S.D("M280 411Q286 404 292 406Q286 412 280 411Z", "leaf")
S.fill(rect(296, 416, 40, 4), "ink")
tiers = [
    (190, 390, 640, [("apples", "red", "circle", 6), ("oranges", "sun", "circle", 6), ("lemons", "lime", "circle", 5)]),
    (180, 400, 690, [("tomatoes", "red", "circle", 5), ("lettuce", "leaf", "circle", 8), ("carrots", "brick", "carrot", 5)]),
    (170, 410, G, [("bananas", "sun", "banana", 0), ("potatoes", "sand2", "circle", 7), ("grapes", "lav2", "circle", 4)]),
]
crates = {}
for x0, x1, ybot, goods in tiers:
    w = (x1 - x0) / 3
    for i, (name, f, shape, r) in enumerate(goods):
        a, b = x0 + i * w + 2, x0 + (i + 1) * w - 2
        top = ybot - 50
        if shape == "banana":
            for j in range(4):
                bx = a + 6 + j * 18
                S.D(f"M{bx} {top + 2}Q{bx + 8} {top - 16} {bx + 22} {top - 10}Q{bx + 10} {top - 8} {bx + 4} {top + 4}Z", f)
        else:
            mound(a, b, top - r + 1, f, r, rows=2, shape=shape)
        S.M(rect(a, top, b - a, 50, 2), "wood")
        S.soft(line(a, top + 16, b, top + 16) + line(a, top + 33, b, top + 33))
        S.D(rect(a + 8, top + 34, 22, 12, 1), "paper")                      # price tag
        S.D(line(a + 11, top + 40, a + 26, top + 40))
        crates[name] = (a, top, b - a)
S.D(line(412, G, 412, 600) + rect(396, 588, 32, 12, 2), "steel")            # scales
S.M(rect(398, 574, 28, 14, 2), "paper")
S.D(circle(412, 581, 4))

# ── bakery ────────────────────────────────────────────────────────────────
S.at(1000)
sign(460, 560, 400, "sand2")
S.D("M494 432Q494 410 512 410Q530 410 530 432Z", "wood")
S.M(rect(440, 560, 142, 180, 2), "wood", step=60)
for y in (600, 650, 700):
    S.D(rect(444, y, 134, 4), "sand2")
S.D(rect(444, 560, 134, 4), "sand2")
for x in range(450, 570, 30):                                              # cakes, top
    S.D(f"M{x} 600V586Q{x + 12} 578 {x + 24} 586V600Z", "blush2")
    S.D(rect(x + 10, 574, 4, 6, 1), "red")
for x in range(448, 572, 22):                                              # croissants
    S.D(f"M{x} 650Q{x + 10} 634 {x + 20} 650Q{x + 10} 644 {x} 650Z", "sun")
for x in range(448, 572, 32):                                              # loaves
    S.D(f"M{x} 700Q{x} 680 {x + 14} 680Q{x + 28} 680 {x + 28} 700Z", "sand2")
    S.soft(line(x + 8, 684, x + 6, 698) + line(x + 16, 682, x + 14, 698))
S.M(pts([(462, 740), (560, 740), (566, 712), (456, 712)], True), "wood")   # basket of baguettes
for i in range(6):
    bx = 470 + i * 15
    S.D(pts([(bx, 712), (bx + 6, 712), (bx + 16, 660), (bx + 10, 660)], True), "sand2")

# ── dairy fridge ──────────────────────────────────────────────────────────
S.at(1500)
sign(640, 760, 400, "sky2")
S.D(pts([(692, 436), (692, 414), (700, 406), (708, 414), (708, 436)], True), "paper")
S.shadow(695, G, 100, 4)
S.M(rect(600, 500, 190, 240, 4), "steel", step=60)
S.fill(rect(608, 516, 174, 214), "paper")
for y in (572, 628, 684):
    S.D(rect(608, y, 174, 4), "steel")
for x in range(614, 780, 18):                                              # milk
    S.D(pts([(x, 572), (x, 540), (x + 7, 530), (x + 14, 540), (x + 14, 572)], True), "paper")
    S.D(rect(x + 4, 526, 6, 5, 1), "sky2")
    S.D(rect(x, 552, 14, 8), "sky2")
for x in range(614, 700, 20):                                              # cheese
    S.D(pts([(x, 628), (x + 18, 628), (x + 18, 610)], True), "sun")
for x in range(704, 780, 14):                                              # butter
    S.D(rect(x, 616, 12, 12, 1), "sun")
for i, x in enumerate(range(614, 694, 14)):                                # yoghurt
    S.D(pts([(x, 684), (x + 12, 684), (x + 11, 664), (x + 1, 664)], True), ("blush2", "lav2", "paper")[i % 3])
    S.D(rect(x, 662, 12, 3), "red")
for x in (704, 742):                                                       # eggs
    S.D(rect(x, 668, 34, 16, 2), "sand2")
    S.D(ellipse(x + 8, 666, 5, 4) + ellipse(x + 17, 666, 5, 4) + ellipse(x + 26, 666, 5, 4), "paper")
S.D(rect(608, 700, 174, 30), "tint")
S.M(rect(600, 500, 190, 16, 3), "steel")
S.fill(rect(608, 516, 174, 214), "glassa")                                  # glass doors
S.D(line(695, 516, 695, 730) + rect(686, 600, 3, 40, 1) + rect(701, 600, 3, 40, 1))
S.H(line(620, 530, 650, 560) + line(710, 530, 740, 560))

# ── freezer ───────────────────────────────────────────────────────────────
S.at(1900)
sign(830, 930, 400, "glass")
S.D(line(880, 408, 880, 432) + line(870, 414, 890, 426) + line(870, 426, 890, 414), None)
S.shadow(880, G, 76, 4)
for x, f in ((820, "blush2"), (846, "sky2"), (872, "sun")):                # ice cream tubs
    S.D(rect(x, 628, 22, 24, 3), f)
    S.D(rect(x - 1, 624, 24, 5, 2), "paper")
S.D("M902 652Q900 628 916 628Q932 628 930 652Z", "leaf")                   # frozen peas
S.D(rect(916, 636, 18, 18, 2), "red")                                     # pizza box
S.M(rect(810, 650, 140, 90, 4), "paper", step=60)
S.D(pts([(812, 650), (948, 650), (944, 618), (816, 618)], True), "glassa")  # sloped glass lid
S.D(line(880, 618, 880, 650))
S.D(rect(810, 664, 140, 4) + rect(818, 700, 124, 30, 3), "sky2")

# ── grocery shelves ───────────────────────────────────────────────────────
S.at(2300)
sign(990, 1100, 400, "blush2")
S.D(rect(1030, 410, 12, 20, 2) + rect(1048, 410, 12, 20, 2), "steel")
S.shadow(1045, G, 80, 4)
S.M(rect(970, 540, 150, 200, 2), "steel", step=60)
for y in (590, 640, 690):
    S.D(rect(974, y, 142, 4), "paper")
for i, x in enumerate(range(976, 1110, 22)):                               # cereal
    S.D(rect(x, 548, 20, 42, 1), ("red", "sun", "sky2", "lime", "blush2", "leaf")[i % 6])
    S.D(circle(x + 10, 566, 4), "paper")
for i, x in enumerate(range(976, 1044, 17)):                               # pasta
    S.D(rect(x, 612, 15, 28, 2), "sun")
    S.D(rect(x + 3, 618, 9, 10, 1), "paper")
for x in range(1048, 1112, 21):                                            # rice
    S.D(f"M{x} 640V618Q{x + 9} 612 {x + 18} 618V640Z", "paper")
    S.D(rect(x + 3, 624, 12, 6), "red")
for row in (0, 1):                                                         # tins
    for x in range(976, 1112, 17):
        y = 690 - row * 24
        S.D(rect(x, y - 22, 15, 22, 2), "steel")
        S.D(rect(x, y - 16, 15, 10), "red" if (x // 17) % 2 else "leaf")
for i, x in enumerate(range(976, 1112, 16)):                               # bottles
    f = "glass" if i % 2 else "sun"
    S.D(f"M{x} 736V712Q{x} 704 {x + 5} 702V694H{x + 9}V702Q{x + 14} 704 {x + 14} 712V736Z", f)
    S.D(rect(x + 4, 690, 6, 5, 1), "lime" if i % 2 else "red")
S.M("M1100 572L1106 560L1112 572L1126 568L1118 580L1128 590L1114 592L1112 606L1102 596L1090 604L1092 590L1080 584L1092 578Z", "lime")   # special offer
S.D(circle(1098, 580, 2.5) + circle(1110, 592, 2.5) + line(1112, 578, 1096, 594), None)

# ── people ────────────────────────────────────────────────────────────────
S.at(2800)
S.shadow(1066, G - 1, 30)
S.standing(1066, G, coat="leaf", d=-1, arms=[(1034, 640)], legs="ink", k=K)   # shop assistant
S.M(rect(1010, 612, 44, 36, 2), "wood")                                      # box
S.D(line(1010, 624, 1054, 624))
S.shadow(1150, G - 1, 30)
S.standing(1150, G, coat="blush2", d=1, arms=[(1180, 650)], legs="sky2", k=K)  # customer
# trolley
S.D(pts([(1176, 640), (1186, 650), (1250, 650), (1244, 700), (1190, 700)]), "steel")
S.D(pts([(1186, 650), (1250, 650), (1244, 700), (1190, 700)], True), None)
S.soft("".join(line(x, 650, x - 2, 700) for x in range(1196, 1248, 8)) + line(1188, 675, 1247, 675))
for x, w, h, f in ((1194, 16, 30, "red"), (1212, 14, 22, "paper"), (1228, 16, 28, "sun")):
    S.D(rect(x, 650 - h, w, h, 2), f)
S.D(line(1194, 700, 1196, 728) + line(1244, 700, 1240, 728) + line(1190, 728, 1246, 728), "steel")
S.D(circle(1198, 734, 6) + circle(1240, 734, 6), "ink")

# ── checkout ──────────────────────────────────────────────────────────────
S.at(3200)
sign(1270, 1390, 400, "ink")
S.fill(rect(1286, 414, 40, 12, 2) + rect(1332, 414, 40, 12, 2), "lime")
S.bust(1382, 676, d=-1, coat="sky2", k=K)                                    # cashier
S.M(rect(1262, 680, 138, 60, 2), "paper", step=60)                          # counter
S.D(rect(1262, 672, 88, 8, 3), "ink")                                        # conveyor belt
S.soft("".join(line(x, 672, x, 680) for x in range(1268, 1348, 8)))
S.D(rect(1266, 648, 14, 24, 2), "sky2")
S.D(rect(1284, 656, 22, 16, 3), "lime")
S.D(rect(1310, 640, 10, 32, 1), "red")
S.D(rect(1322, 666, 4, 6), "steel")                                          # divider
S.D(rect(1322, 662, 28, 4, 2), "steel")
S.D(line(1356, 680, 1356, 648) + rect(1340, 626, 30, 22, 2), "ink")          # till
S.D(rect(1344, 630, 22, 14, 1), "glass")
S.D(pts([(1352, 648), (1360, 648), (1362, 672), (1354, 676)], True), "paper")  # receipt
S.H(line(1354, 656, 1360, 656) + line(1354, 662, 1360, 662))
S.D(rect(1334, 666, 12, 14, 2), "ink")                                       # card machine
S.D(rect(1336, 668, 8, 4), "lime")
S.M("M1286 740V712H1318V740Z", "sand2")                                     # shopping bag
S.D("M1292 712Q1302 698 1312 712")

# ── words ─────────────────────────────────────────────────────────────────
def R(rid, word, box, label, level, ipa, d, ex, us=None):
    card = dict(level=level, ipa=ipa, pos="noun", def_=d, ex=ex)
    if us:
        card["us"] = us
    S.room(rid, word, box, label, **card)


R("supermarket", "supermarket", (0, CEIL, 1400, G - CEIL), (20, 364), "A1", "ˈsuːpəmɑːkɪt",
  "A big shop that sells food and things for the home.", "We go to the supermarket every Saturday.", "grocery store")
R("bakery", "bakery", (436, 400, 150, 340), (440, 460), "A2", "ˈbeɪkəri",
  "The part of a shop where bread and cakes are sold.", "The bread in the bakery is still warm.")
R("checkout", "checkout", (1256, 400, 144, 340), (1262, 460), "A2", "ˈtʃekaʊt",
  "The place where you pay for your shopping.", "There's a long queue at the checkout.")
S.meta["zones"] = [
    dict(id="fruitz", chip="Fruit & veg", box=[100, 390, 340, 350]),
    dict(id="coldz", chip="Fridge & freezer", box=[590, 390, 370, 350]),
    dict(id="shelvesz", chip="Shelves", box=[960, 390, 200, 350]),
    dict(id="payz", chip="Paying", box=[1100, 390, 300, 350]),
]
S.meta["groups"] = {"entrance": "Entrance", "fruit": "Fruit & vegetables", "bakery": "Bakery", "dairy": "Dairy",
                    "frozen": "Frozen food", "shelves": "Shelves", "people": "People", "checkout": "Checkout"}


def P(pid, word, level, room, pin, box, ipa, pos, d, ex, us=None):
    card = dict(level=level, room=room, ipa=ipa, pos=pos, def_=d, ex=ex)
    if us:
        card["us"] = us
    S.part(pid, word, pin, box, **card)


def crate_pin(name):
    a, top, w = crates[name]
    return (round(a + w / 2), top - 6), (round(a), top - 18, round(w), 24)


P("doors", "automatic doors", "B1", "entrance", (60, 640), (10, 506, 100, 234), "ˌɔːtəˈmætɪk ˈdɔːz", "noun",
  "Doors that open by themselves when you walk up to them.", "The automatic doors opened as we walked in.")
P("baskets", "baskets", "A2", "entrance", (136, 712), (110, 690, 50, 50), "ˈbɑːskɪts", "noun",
  "Containers with handles for carrying your shopping.", "Take a basket - we only need a few things.")
for pid, word, lvl, ipa, d, ex, us in [
    ("apples", "apples", "A1", "ˈæplz", "Round fruit with red, yellow or green skin.", "A kilo of apples, please.", None),
    ("oranges", "oranges", "A1", "ˈɒrɪndʒɪz", "Round sweet fruit with a thick orange skin.", "These oranges are really juicy.", None),
    ("lemons", "lemons", "A2", "ˈlemənz", "Sour yellow fruit.", "Can you get two lemons for the fish?", None),
    ("tomatoes", "tomatoes", "A1", "təˈmɑːtəʊz", "Soft red fruit that we eat as a vegetable.", "We need tomatoes for the salad.", None),
    ("lettuce", "lettuce", "B1", "ˈletɪs", "A green vegetable with big leaves, eaten raw.", "Wash the lettuce before you make the salad.", None),
    ("carrots", "carrots", "A2", "ˈkærəts", "Long orange vegetables.", "Rabbits love carrots.", None),
    ("bananas", "bananas", "A1", "bəˈnɑːnəz", "Long curved yellow fruit.", "Bananas are on special offer this week.", None),
    ("potatoes", "potatoes", "A1", "pəˈteɪtəʊz", "Round vegetables that grow under the ground.", "Buy a bag of potatoes for the chips.", None),
    ("grapes", "grapes", "A2", "ɡreɪps", "Small round green or purple fruit that grow in bunches.", "Do you prefer green or red grapes?", None)]:
    pin, box = crate_pin(pid)
    P(pid, word, lvl, "fruit", pin, box, ipa, "noun", d, ex, us)
P("pricetag", "price tag", "B1", "fruit", (199, 726), (186, 718, 26, 16), "ˈpraɪs tæɡ", "noun",
  "A small label that shows how much something costs.", "The price tag says £1.20 a kilo.", "price label")
P("scales", "scales", "A2", "fruit", (412, 581), (394, 570, 36, 30), "skeɪlz", "noun",
  "A machine for weighing things.", "Weigh the tomatoes on the scales.", "scale")
P("cakes", "cakes", "A1", "bakery", (462, 590), (446, 570, 132, 30), "keɪks", "noun",
  "Sweet food baked from flour, eggs and sugar.", "The cakes look delicious.")
P("croissants", "croissants", "B1", "bakery", (470, 644), (446, 632, 132, 18), "ˈkrwæsɒ̃z", "noun",
  "Soft curved pieces of pastry, eaten for breakfast.", "Let's have croissants for breakfast.")
P("bread", "bread", "A1", "bakery", (474, 692), (446, 678, 132, 24), "bred", "noun",
  "A food made from flour, water and yeast, baked in an oven.", "A loaf of brown bread, please.")
P("baguettes", "baguettes", "B1", "bakery", (520, 690), (456, 656, 112, 84), "bæˈɡets", "noun",
  "Long thin loaves of French bread.", "The baguettes are fresh this morning.")
P("fridge", "fridge", "A2", "dairy", (620, 720), (598, 498, 194, 242), "frɪdʒ", "noun",
  "A cold cupboard that keeps food fresh.", "The milk is in the big fridge at the back.", "refrigerator")
P("milk", "milk", "A1", "dairy", (662, 556), (612, 526, 170, 46), "mɪlk", "noun",
  "A white drink that comes from cows.", "Get two bottles of milk, please.")
P("cheese", "cheese", "A1", "dairy", (650, 620), (612, 608, 88, 22), "tʃiːz", "noun",
  "A food made from milk, often yellow.", "I'd like some cheese for my sandwich.")
P("butter", "butter", "A1", "dairy", (742, 622), (702, 612, 80, 18), "ˈbʌtə", "noun",
  "A soft yellow food made from cream, for bread and cooking.", "We need butter to make the cake.")
P("yoghurt", "yoghurt", "A1", "dairy", (650, 676), (612, 660, 84, 26), "ˈjɒɡət", "noun",
  "A thick food made from milk, often with fruit.", "I have a strawberry yoghurt for breakfast.", "yogurt")
P("eggs", "eggs", "A1", "dairy", (742, 676), (702, 660, 80, 26), "eɡz", "noun",
  "Oval things laid by hens, that we cook and eat.", "Half a dozen eggs, please.")
P("freezer", "freezer", "A2", "frozen", (880, 700), (808, 616, 144, 124), "ˈfriːzə", "noun",
  "A very cold cupboard that keeps food frozen.", "The ice cream is in the freezer.")
P("icecream", "ice cream", "A1", "frozen", (856, 640), (818, 622, 78, 32), "ˌaɪs ˈkriːm", "noun",
  "A sweet frozen food made from milk.", "Chocolate ice cream is my favourite.")
P("frozenfood", "frozen food", "B1", "frozen", (916, 640), (900, 624, 38, 30), "ˌfrəʊzn ˈfuːd", "noun",
  "Food that is kept very cold, like frozen peas or pizza.", "Frozen food lasts for months.")
P("cereal", "cereal", "A2", "shelves", (1010, 570), (974, 546, 142, 44), "ˈsɪəriəl", "noun",
  "Food made from grain, eaten with milk for breakfast.", "Which cereal do you want?")
P("pasta", "pasta", "A1", "shelves", (1000, 626), (974, 610, 70, 30), "ˈpæstə", "noun",
  "An Italian food made from flour and water, like spaghetti.", "We're having pasta for dinner.")
P("rice", "rice", "A1", "shelves", (1080, 630), (1046, 612, 70, 28), "raɪs", "noun",
  "Small white or brown grains that you cook in water.", "Do you want rice or chips?")
P("tins", "tins", "A2", "shelves", (1004, 676), (974, 642, 142, 48), "tɪnz", "noun",
  "Metal containers for food, like beans or soup.", "Get two tins of tomatoes.", "cans")
P("bottles", "bottles", "A2", "shelves", (1012, 720), (974, 690, 142, 48), "ˈbɒtlz", "noun",
  "Glass or plastic containers for drinks.", "A bottle of water, please.")
P("offer", "special offer", "B1", "shelves", (1104, 582), (1078, 558, 52, 50), "ˌspeʃl ˈɒfə", "noun",
  "A lower price for a short time.", "Buy one, get one free - it's a special offer!", "sale")
P("aislesign", "sign", "A2", "shelves", (1045, 420), (990, 396, 110, 44), "saɪn", "noun",
  "A board that tells you where things are.", "Follow the signs to the checkout.")

# people and paying
P("assistant", "shop assistant", "A2", "people", (1068, 660), (1030, 548, 72, 192), "ˈʃɒp əˌsɪstənt", "noun",
  "A person who works in a shop.", "Ask the shop assistant where the rice is.", "sales clerk")
P("box", "box", "A1", "people", (1030, 634), (1008, 610, 48, 40), "bɒks", "noun",
  "A container with flat sides, often made of cardboard.", "She's putting tins on the shelf from a box.")
P("customer", "customer", "A2", "people", (1150, 660), (1120, 548, 60, 192), "ˈkʌstəmə", "noun",
  "A person who buys things in a shop.", "The supermarket is full of customers on Saturdays.", "shopper")
P("trolley", "trolley", "A2", "checkout", (1222, 686), (1174, 616, 80, 124), "ˈtrɒli", "noun",
  "A big metal basket on wheels for your shopping.", "Our trolley is full!", "shopping cart")
P("cashier", "cashier", "A2", "checkout", (1382, 626), (1352, 594, 48, 82), "kæˈʃɪə", "noun",
  "The person at the checkout who takes the money.", "The cashier asked if I had a bag.")
P("belt", "conveyor belt", "B1", "checkout", (1300, 676), (1262, 668, 90, 14), "kənˈveɪə belt", "noun",
  "A moving belt where you put your shopping at the checkout.", "Put your shopping on the conveyor belt.")
P("till", "till", "B1", "checkout", (1355, 636), (1338, 622, 34, 30), "tɪl", "noun",
  "The machine at the checkout that adds up the prices and keeps the money.", "The cashier opened the till.", "cash register")
P("card", "card machine", "B1", "checkout", (1340, 674), (1332, 664, 16, 18), "ˈkɑːd məˌʃiːn", "noun",
  "A small machine you pay with your bank card on.", "You can pay by card - tap it on the card machine.", "card reader")
P("receipt", "receipt", "B1", "checkout", (1357, 664), (1350, 646, 14, 32), "rɪˈsiːt", "noun",
  "A piece of paper that shows what you bought and what you paid.", "Keep the receipt in case you need to bring it back.")
P("bag", "shopping bag", "A2", "checkout", (1302, 726), (1284, 696, 36, 44), "ˈʃɒpɪŋ bæɡ", "noun",
  "A bag for carrying your shopping home.", "Don't forget your shopping bags!", "grocery bag")


S.meta.update(
    view=[0, 320, 1400, 480],
    roomsTitle="Places in the shop",
    title="The Supermarket",
    kicker="Picture Studio · Shopping",
    dek="One long supermarket wall, close up: fresh food, the fridge and freezer, the shelves and the checkout.",
    frames=["How much is / are …?", "Can I have … please?", "There is some … / there are some …",
            "We need a … of …", "Is there any …? Are there any …?", "The … are next to the …"],
)
TF = [
    ("The bananas are in the fridge.", False, "A1"),
    ("There are eggs in the fridge.", True, "A1"),
    ("The customer has got a trolley.", True, "A1"),
    ("The cashier is standing at the entrance.", False, "A1"),
    ("There is a basket of baguettes in the bakery.", True, "A2"),
    ("The ice cream is in the freezer.", True, "A2"),
    ("The shop assistant is holding a box.", True, "A2"),
    ("The tomatoes are next to the lettuce.", True, "A2"),
    ("There isn't any milk in the fridge.", False, "A2"),
    ("The scales are next to the fruit and vegetables.", True, "A2"),
    ("The special offer is on the grocery shelves.", True, "B1"),
    ("The tins are on the top shelf.", False, "B1"),
    ("There is a receipt coming out of the till.", True, "B1"),
    ("The conveyor belt is behind the cashier.", False, "B1"),
    ("The croissants are between the cakes and the bread.", True, "B1"),
    ("The baskets are stacked by the automatic doors.", True, "B1"),
]
PROMPTS = {
    "A1": ["Write a shopping list for a birthday party.",
           "What fruit and vegetables do you like? What don't you like?",
           "Look at the fridge. Write five sentences: There is… There are…"],
    "A2": ["You are at the checkout. Write the dialogue with the cashier.",
           "Describe your family's weekly shopping: where, when and what you buy.",
           "Plan a healthy dinner for four people. What do you need to buy?"],
    "B1": ["Is it better to shop in a supermarket, at a market or online? Give your reasons.",
           "Supermarkets throw away a lot of food. What could they do about it?",
           "Write a complaint: something you bought was out of date."],
}

for coll in (S.rooms, S.parts):
    for c in coll:
        c["def"] = c.pop("def_")

os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
out = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "scenes"))
S.save(os.path.join(out, "supermarket.json"), truefalse=[dict(s=s, a=a, level=l) for s, a, l in TF], prompts=PROMPTS)
S.svg(os.path.join(ROOT, "out", "supermarket.svg"))
lv = {}
for p in S.parts + S.rooms:
    lv[p["level"]] = lv.get(p["level"], 0) + 1
print(f"supermarket: {len(S.items)} items, {len(S.parts)} parts + {len(S.rooms)} rooms, levels {lv}, "
      f"{os.path.getsize(os.path.join(out, 'supermarket.json')) // 1024} KB")
