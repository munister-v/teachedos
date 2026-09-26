"""Picture Studio · The Restaurant — an open kitchen, two tables and the
bar, close up, with the people who work and eat there. Writes
data/scenes/restaurant.json.

    python3 ops/scenes/make_restaurant.py
"""
import os
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob

ROOT = os.path.dirname(os.path.abspath(__file__))
S = Scene("restaurant", 1400, 800)
G = 740
CEIL = 250
K = 1.25


def table(x0, x1, top=640, cloth="paper"):
    S.shadow((x0 + x1) / 2, G, (x1 - x0) / 2, 4)
    S.D(line(x0 + 14, top, x0 + 12, G) + line(x1 - 14, top, x1 - 12, G), "wood")
    S.M(f"M{x0} {top}H{x1}L{x1 + 4} {top + 44}Q{(x0 + x1) / 2} {top + 54} {x0 - 4} {top + 44}Z", cloth, step=60)
    S.soft("".join(line(x, top + 2, x + 1, top + 46) for x in range(int(x0) + 16, int(x1), 22)))


def chair(x, facing):
    """A chair; facing 1 = the sitter looks right (back on the left)."""
    bx = x - 20 if facing == 1 else x + 16
    S.D(rect(x - 18, 668, 38, 6, 2) + line(x - 14, 674, x - 16, G) + line(x + 16, 674, x + 18, G), "wood")
    S.M(rect(bx, 592, 7, 82, 3), "wood")


def plate(x, y=638, food="sun"):
    S.D(ellipse(x, y, 22, 5), "paper")
    S.D(f"M{x - 12} {y - 1}Q{x} {y - 12} {x + 12} {y - 1}Z", food)


def glass(x, y=638, fill="glass"):
    S.D(f"M{x - 6} {y}L{x - 7} {y - 24}H{x + 7}L{x + 6} {y}Z", fill)


# ── the room ──────────────────────────────────────────────────────────────
S.at(0)
S.fill(rect(0, 200, 1400, CEIL - 200), "paper")
S.wallpaper((0, CEIL, 440, G - CEIL), "mint", "tiles")
S.wallpaper((440, CEIL, 590, G - CEIL), "blush", "dots", dado=90)
S.wallpaper((1030, CEIL, 370, G - CEIL), "sand", "planks", dado=90)
S.M(line(0, CEIL, 1400, CEIL), step=0)
S.fill(rect(0, G, 1400, 60), "wood")
S.soft("".join(line(0, y, 1400, y) for y in (752, 768, 790)) + "".join(line(x, G, x - 30, 800) for x in range(30, 1450, 90)))
S.M(line(0, G, 1400, G), step=0)
S.M(rect(430, CEIL, 12, 250, 2), "ink")                                    # kitchen wall end

# ── open kitchen ──────────────────────────────────────────────────────────
S.at(200)
S.M(pts([(170, 330), (330, 330), (310, 290), (190, 290)], True), "steel")   # hood
S.M(rect(228, CEIL, 44, 40), "steel")
S.D(rect(44, 356, 100, 5, 2), "steel")                                     # pan rack
for x, r in ((62, 12), (94, 16), (126, 11)):
    S.D(line(x, 361, x, 374))
    S.D(circle(x, 374 + r, r), "steel")
S.D(line(80, 361, 80, 420) + ellipse(80, 426, 9, 6), "steel")               # ladle
S.standing(210, 640, coat="paper", d=1, arms=[(262, 548), (236, 560)], legs="ink", k=K, cap="paper")   # chef (behind the pass)
S.M("M199 497Q188 452 212 450Q236 452 226 497Z", "paper")                  # tall chef's hat
S.D(line(262, 548, 286, 540))                                              # frying pan
S.M("M284 536H340Q338 552 326 554H298Q286 552 284 536Z", "ink")
S.fill("M296 534Q300 500 312 514Q316 488 324 510Q334 496 330 534Z", "sun")  # flames
S.fill("M304 534Q308 516 314 524Q320 508 322 534Z", "lime")
S.M(rect(30, 600, 400, 12, 2), "steel", step=60)                           # the pass (counter)
S.M(rect(36, 612, 388, 128), "steel")
S.D(line(36, 650, 424, 650) + rect(60, 666, 120, 60, 3) + rect(200, 666, 120, 60, 3))
S.D(rect(100, 690, 40, 4, 2) + rect(240, 690, 40, 4, 2), "ink")
for x, f in ((300, "sun"), (352, "red")):                                  # dishes ready
    plate(x, 598, f)
S.D("M398 598Q398 582 410 582Q422 582 422 598Z" + rect(396, 596, 28, 4, 1), "sun")   # service bell
S.D(rect(408, 576, 4, 6), "ink")

# ── dining room ───────────────────────────────────────────────────────────
S.at(700)
for px, f in ((520, "sky2"), (800, "leaf3")):                             # pictures
    S.M(rect(px, 320, 90, 70, 2), "wood")
    S.D(rect(px + 8, 328, 74, 54), f)
    S.soft(wave(px + 10, 368, px + 80, 360, 3, 5))
for lx in (650, 900):                                                      # pendant lamps
    S.D(line(lx, CEIL, lx, 440))
    S.M(pts([(lx - 18, 440), (lx + 18, 440), (lx + 28, 466), (lx - 28, 466)], True), "lime")
    S.fill(pts([(lx - 26, 468), (lx + 26, 468), (lx + 70, 600), (lx - 70, 600)], True), "shade")
# the waiter with a tray of drinks
S.shadow(476, G, 26)
S.standing(476, G, coat="ink", d=1, arms=[(506, 572)], legs="ink", k=K)
S.M(ellipse(512, 568, 28, 4), "steel")                                     # tray
glass(500, 564, "sun")
glass(520, 564, "red")
S.D(rect(468, 590, 16, 26, 2), "paper")                                    # apron pocket towel
# table A: two people having dinner
S.at(1100)
chair(560, 1)
chair(760, -1)
S.sitting(566, 668, G, coat="red", legs="ink", d=1, arms=[(604, 632)], k=K)
S.sitting(754, 668, G, coat="lav2", legs="sky2", d=-1, arms=[(716, 630)], k=K)
table(590, 730)
plate(612)
glass(636)
S.D(rect(656, 610, 10, 28, 2), "paper")                                    # candle
S.fill("M661 610Q654 598 661 588Q668 598 661 610Z", "sun")
S.D(pts([(674, 638), (686, 638), (688, 620), (672, 620)], True), "glass")   # vase and a rose
S.D(line(680, 620, 680, 604) + circle(680, 600, 5), "red")
glass(698)
plate(716)
S.D(line(596, 636, 594, 626) + line(730, 636, 732, 626), "steel")         # fork, knife
# table B: a family ordering
S.at(1600)
chair(806, 1)
S.sitting(812, 668, G, coat="sky2", legs="ink", d=1, arms=[(846, 612)], k=K)
S.M(pts([(840, 596), (866, 590), (870, 628), (844, 632)], True), "red")    # menu
S.soft(line(846, 604, 862, 600) + line(846, 612, 864, 608) + line(846, 620, 860, 616))
S.shadow(924, G, 26)
S.standing(924, G, coat="blush2", d=-1, arms=[(900, 580), (912, 590)], legs="ink", k=K)   # waitress
S.M(rect(888, 572, 20, 26, 2), "lime")                                     # notepad
S.soft(line(891, 580, 905, 580) + line(891, 586, 903, 586))
S.D(line(912, 590, 906, 574), "ink")                                       # pen
table(840, 980, cloth="paper")
S.D(rect(876, 626, 8, 14, 3) + rect(888, 628, 8, 12, 3), "paper")          # salt and pepper
S.fill(rect(876, 624, 8, 3) + rect(888, 626, 8, 3), "ink")
S.D(pts([(912, 640), (932, 640), (922, 624)], True), "sky2")               # napkin
S.D(pts([(944, 640), (972, 640), (968, 628), (948, 628)], True), "wood")   # bread basket
S.D(ellipse(952, 626, 6, 4) + ellipse(964, 626, 6, 4), "sand2")
# high chair with a baby
S.D(line(994, 620, 986, G) + line(1024, 620, 1032, G) + rect(988, 612, 40, 6, 2), "red")
S.M(rect(1018, 560, 8, 58, 3), "red")
S.sitting(1010, 612, 640, coat="sun", legs="sun", d=-1, arms=[(994, 598)], k=0.62)
S.D(rect(978, 600, 22, 4, 1), "red")                                       # tray of the high chair

# ── bar and door ──────────────────────────────────────────────────────────
S.at(2100)
S.M(rect(1070, 320, 110, 76, 3), "ink")                                    # specials board
S.fill(rect(1080, 334, 60, 4) + rect(1080, 348, 80, 4) + rect(1080, 362, 50, 4) + rect(1080, 376, 70, 4), "paper")
S.fill(rect(1146, 334, 24, 4) + rect(1150, 362, 20, 4), "lime")
S.M(rect(1200, 400, 110, 6, 1), "wood")                                    # shelf with bottles
for i, x in enumerate(range(1206, 1300, 14)):
    S.D(f"M{x} 400V380Q{x} 374 {x + 4} 372V364H{x + 8}V372Q{x + 12} 374 {x + 12} 380V400Z", ("glass", "sun", "leaf", "red")[i % 4])
S.bust(1262, 600, d=-1, coat="ink", k=K)                                   # barista
S.M(rect(1060, 594, 250, 10, 2), "wood", step=60)                          # bar counter
S.M(rect(1066, 604, 238, 136), "wood")
S.soft("".join(line(x, 604, x, G) for x in range(1086, 1300, 24)))
S.M(rect(1072, 536, 64, 58, 4), "steel")                                   # coffee machine
S.D(rect(1080, 544, 48, 12, 2), "ink")
S.D(rect(1090, 560, 8, 12) + rect(1110, 560, 8, 12), "ink")
S.D(rect(1086, 578, 14, 14, 2) + rect(1106, 578, 14, 14, 2), "paper")
S.M(ellipse(1178, 594, 32, 4), "paper")                                    # cake stand
S.D(rect(1154, 568, 48, 24, 3), "blush2")
S.D(rect(1154, 566, 48, 5, 2), "paper")
S.fill("M1150 594V566Q1150 530 1178 530Q1206 530 1206 566V594Z", "glassa")
S.D("M1150 594V566Q1150 530 1178 530Q1206 530 1206 566V594" + circle(1178, 526, 4))
S.D(pts([(1222, 594), (1242, 594), (1244, 568), (1220, 568)], True), "glassa")   # tip jar
S.fill(circle(1228, 588, 3) + circle(1236, 590, 3) + circle(1232, 583, 3), "sun")
S.M(rect(1326, 470, 64, 270, 3), "wood")                                   # door
S.D(rect(1336, 484, 44, 90, 3), "glass")
S.D(circle(1334, 620, 3), "ink")
S.D(line(1346, 494, 1358, 484) + line(1370, 490, 1380, 480), None)
S.M(rect(1338, 510, 40, 18, 3), "lime")                                    # OPEN sign
S.D("M1342 519Q1342 513 1346 513Q1350 513 1350 519Q1350 525 1346 525Q1342 525 1342 519Z" + "M1354 525V513H1358Q1361 513 1361 516Q1361 519 1358 519H1354" + "M1370 513H1364V525H1370M1364 519H1368" + "M1373 525V513L1378 525V513", None)

# ── words ─────────────────────────────────────────────────────────────────
def R(rid, word, box, label, level, ipa, d, ex, us=None):
    card = dict(level=level, ipa=ipa, pos="noun", def_=d, ex=ex)
    if us:
        card["us"] = us
    S.room(rid, word, box, label, **card)


R("restaurant", "restaurant", (0, CEIL, 1400, G - CEIL), (456, 276), "A1", "ˈrestrɒnt",
  "A place where you pay to sit and eat a meal.", "We're going to a restaurant for Mum's birthday.")
R("kitchen", "kitchen", (0, CEIL, 440, G - CEIL), (16, 276), "A1", "ˈkɪtʃɪn",
  "The room where food is cooked.", "The kitchen is open, so you can watch the chef.")
R("bar", "bar", (1040, CEIL, 290, G - CEIL), (1200, 276), "A2", "bɑː",
  "A counter where drinks are made and served.", "Can we sit at the bar?", "counter")
S.meta["zones"] = [
    dict(id="kitchenz", chip="The chef", box=[0, 250, 440, 490]),
    dict(id="tablea", chip="Table for two", box=[440, 420, 320, 320]),
    dict(id="tableb", chip="Ordering", box=[780, 420, 280, 320]),
    dict(id="barz", chip="The bar", box=[1040, 300, 360, 440]),
]
S.meta["groups"] = {"kitchen": "The kitchen", "table": "On the tables", "people": "People", "bar": "The bar"}


def P(pid, word, level, room, pin, box, ipa, pos, d, ex, us=None):
    card = dict(level=level, room=room, ipa=ipa, pos=pos, def_=d, ex=ex)
    if us:
        card["us"] = us
    S.part(pid, word, pin, box, **card)


P("chef", "chef", "A2", "kitchen", (212, 560), (180, 446, 64, 160), "ʃef", "noun",
  "A person whose job is to cook in a restaurant.", "The chef is cooking steak.")
P("hat", "chef's hat", "B1", "kitchen", (212, 468), (186, 446, 50, 52), "ˌʃefs ˈhæt", "noun",
  "A tall white hat that chefs wear.", "The chef's hat is tall and white.", "toque")
P("fryingpan", "frying pan", "A2", "kitchen", (314, 545), (282, 534, 60, 22), "ˈfraɪɪŋ pæn", "noun",
  "A flat pan with a long handle for frying.", "He's cooking in a frying pan.", "skillet")
P("flames", "flames", "B1", "kitchen", (314, 514), (294, 488, 40, 46), "fleɪmz", "noun",
  "The bright moving parts of a fire.", "Flames shot up from the pan!")
P("pans", "pots and pans", "A2", "kitchen", (94, 390), (40, 352, 108, 80), "ˌpɒts ən ˈpænz", "noun",
  "Metal containers for cooking.", "The pots and pans hang above the counter.")
P("hood", "extractor hood", "B1", "kitchen", (250, 312), (168, 250, 164, 82), "ɪkˈstræktə hʊd", "noun",
  "A metal hood that takes away smoke from the cooker.", "The extractor hood is very loud.", "range hood")
P("dishes", "dishes", "A2", "kitchen", (326, 598), (274, 582, 104, 22), "ˈdɪʃɪz", "noun",
  "Plates of food, ready to take to the tables.", "Two dishes are ready for table four.")
P("bell", "service bell", "B1", "kitchen", (410, 590), (394, 574, 32, 28), "ˈsɜːvɪs bel", "noun",
  "A small bell the chef rings when food is ready.", "Ding! The chef rang the service bell.")

P("waiter", "waiter", "A2", "people", (476, 640), (452, 574, 52, 166), "ˈweɪtə", "noun",
  "A man who brings food and drinks to your table.", "The waiter brought us some water.", "server")
P("tray", "tray", "A2", "people", (512, 568), (482, 540, 60, 34), "treɪ", "noun",
  "A flat board for carrying food and drinks.", "He carried the drinks on a tray.")
P("waitress", "waitress", "A2", "people", (924, 640), (900, 574, 52, 166), "ˈweɪtrəs", "noun",
  "A woman who brings food and drinks to your table.", "The waitress is taking their order.", "server")
P("notepad", "notepad", "B1", "people", (898, 585), (886, 570, 24, 30), "ˈnəʊtpæd", "noun",
  "A small book of paper for writing notes.", "She wrote our order on her notepad.")
P("customers", "customers", "A2", "people", (566, 640), (540, 580, 60, 160), "ˈkʌstəməz", "noun",
  "People who buy something in a shop or restaurant.", "The customers are enjoying their dinner.", "diners")
P("baby", "baby", "A1", "people", (1010, 588), (996, 566, 30, 50), "ˈbeɪbi", "noun",
  "A very young child.", "The baby is sitting in a high chair.")
P("highchair", "high chair", "B1", "people", (1030, 690), (984, 556, 52, 184), "ˈhaɪ tʃeə", "noun",
  "A tall chair for a baby, with a small table.", "Could we have a high chair, please?")
P("menu", "menu", "A2", "table", (856, 612), (838, 588, 34, 46), "ˈmenjuː", "noun",
  "A list of the food and drinks you can order.", "Could we see the menu, please?")

P("table", "table", "A1", "table", (660, 668), (586, 636, 148, 104), "ˈteɪbl", "noun",
  "A piece of furniture with a flat top on legs.", "A table for two, please.")
P("chair", "chair", "A1", "table", (548, 690), (536, 590, 46, 150), "tʃeə", "noun",
  "A seat for one person, with a back.", "Pull up a chair.")
P("tablecloth", "tablecloth", "A2", "table", (960, 670), (836, 638, 148, 58), "ˈteɪblklɒθ", "noun",
  "A cloth that covers a table.", "The tablecloths are white.")
P("plate", "plate", "A1", "table", (612, 638), (588, 626, 46, 18), "pleɪt", "noun",
  "A flat round dish for food.", "My plate is empty - that was delicious!")
P("glass", "glass", "A1", "table", (636, 626), (628, 612, 16, 28), "ɡlɑːs", "noun",
  "A container made of glass for drinking.", "Could I have a glass of water?")
P("candle", "candle", "A2", "table", (661, 620), (652, 586, 18, 54), "ˈkændl", "noun",
  "A stick of wax with a string that you burn for light.", "There's a candle on every table.")
P("vase", "vase", "A2", "table", (680, 630), (670, 594, 20, 46), "vɑːz", "noun",
  "A container for flowers.", "There's a red rose in the vase.")
P("cutlery", "knife and fork", "A1", "table", (731, 630), (724, 622, 12, 18), "ˌnaɪf ən ˈfɔːk", "noun",
  "The tools you eat with.", "Hold the knife in your right hand.", "silverware")
P("saltpepper", "salt and pepper", "A2", "table", (886, 632), (872, 620, 28, 22), "ˌsɔːlt ən ˈpepə", "noun",
  "Two things you add to food to give it more taste.", "Could you pass the salt and pepper?")
P("napkin", "napkin", "B1", "table", (922, 634), (910, 622, 24, 20), "ˈnæpkɪn", "noun",
  "A piece of cloth or paper for wiping your mouth.", "Put your napkin on your lap.", "serviette")
P("breadbasket", "bread basket", "B1", "table", (958, 634), (942, 620, 32, 22), "ˈbred ˌbɑːskɪt", "noun",
  "A small basket of bread for the table.", "The waiter brought a bread basket.")
P("pictures", "pictures", "A1", "table", (565, 355), (518, 318, 94, 74), "ˈpɪktʃəz", "noun",
  "Paintings or photos in frames on a wall.", "There are pictures of the sea on the walls.")
P("lamp", "lamp", "A1", "table", (650, 454), (620, 250, 60, 218), "læmp", "noun",
  "A light. These hang from the ceiling over the tables.", "The lamps make the room warm and cosy.")

P("coffee", "coffee machine", "A2", "bar", (1104, 550), (1070, 534, 68, 62), "ˈkɒfi məˌʃiːn", "noun",
  "A machine that makes coffee.", "The coffee machine is making a cappuccino.")
P("cake", "cake stand", "B1", "bar", (1178, 580), (1146, 520, 64, 80), "ˈkeɪk stænd", "noun",
  "A plate on a stand for showing cakes, often with a glass cover.", "The chocolate cake on the cake stand looks delicious.")
P("tipjar", "tip jar", "B1", "bar", (1232, 584), (1218, 566, 28, 30), "ˈtɪp dʒɑː", "noun",
  "A jar for extra money you give to thank the staff.", "We put some coins in the tip jar.")
P("barista", "barista", "B1", "bar", (1262, 552), (1236, 532, 50, 68), "bəˈriːstə", "noun",
  "A person whose job is to make coffee.", "The barista made a heart in the milk.")
P("specials", "specials board", "B1", "bar", (1124, 356), (1068, 318, 114, 80), "ˈspeʃlz bɔːd", "noun",
  "A board with today's special dishes.", "What's on the specials board today?")
P("bottles", "bottles", "A2", "bar", (1256, 386), (1200, 360, 112, 46), "ˈbɒtlz", "noun",
  "Glass containers for drinks.", "There are bottles of juice on the shelf.")
P("door", "door", "A1", "bar", (1358, 640), (1324, 468, 68, 272), "dɔː", "noun",
  "The part you open to go in or out.", "Close the door - it's cold.")
P("opensign", "OPEN sign", "A2", "bar", (1358, 519), (1336, 508, 44, 22), "ˈəʊpən saɪn", "noun",
  "A sign that shows the restaurant is open.", "Turn the sign to OPEN at twelve.")


S.meta.update(
    view=[0, 230, 1400, 570],
    roomsTitle="The restaurant",
    title="The Restaurant",
    kicker="Picture Studio · Food",
    dek="An open kitchen, two tables and the bar, close up, with the people who work and eat there.",
    frames=["Could I have …, please?", "I'd like …", "Can we have the bill, please?",
            "A table for …, please.", "Is there any … on the menu?", "The … is next to the …"],
)
TF = [
    ("The chef is wearing a tall white hat.", True, "A1"),
    ("There is a baby in a high chair.", True, "A1"),
    ("The waiter is carrying a tray.", True, "A1"),
    ("There are three people at the table for two.", False, "A1"),
    ("There is a candle on the table for two.", True, "A2"),
    ("The waitress is holding a notepad.", True, "A2"),
    ("The man at the second table is reading the menu.", True, "A2"),
    ("The coffee machine is in the kitchen.", False, "A2"),
    ("The door is open.", False, "A2"),
    ("There are flames coming from the chef's frying pan.", True, "B1"),
    ("The service bell is on the bar.", False, "B1"),
    ("The cake stand is between the coffee machine and the tip jar.", True, "B1"),
    ("There is a rose in the vase.", True, "B1"),
    ("The specials board is above the bar.", True, "B1"),
]
PROMPTS = {
    "A1": ["What is your favourite food? Where do you eat it?",
           "Look at the tables. What can you see? Write five sentences.",
           "Write a menu for your own café: three things to eat and three drinks."],
    "A2": ["Write the dialogue at table two: the waitress takes the order.",
           "Describe a meal out you remember: where, who with, what you ate.",
           "Write a short review of this restaurant."],
    "B1": ["Something went wrong with your meal. Write a polite complaint.",
           "Would you like to be a chef? What are the good and bad things about the job?",
           "Is it better to eat out or cook at home? Give your reasons."],
}

for coll in (S.rooms, S.parts):
    for c in coll:
        c["def"] = c.pop("def_")

os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
out = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "scenes"))
S.save(os.path.join(out, "restaurant.json"), truefalse=[dict(s=s, a=a, level=l) for s, a, l in TF], prompts=PROMPTS)
S.svg(os.path.join(ROOT, "out", "restaurant.svg"))
lv = {}
for p in S.parts + S.rooms:
    lv[p["level"]] = lv.get(p["level"], 0) + 1
print(f"restaurant: {len(S.items)} items, {len(S.parts)} parts + {len(S.rooms)} rooms, levels {lv}, "
      f"{os.path.getsize(os.path.join(out, 'restaurant.json')) // 1024} KB")
