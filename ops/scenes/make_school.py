"""Picture Studio · The School — a school cut open: a classroom and the
library upstairs, the corridor, the canteen and the gym downstairs, and the
school bus outside. Writes data/scenes/school.json.

    python3 ops/scenes/make_school.py
"""
import os
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob

ROOT = os.path.dirname(os.path.abspath(__file__))
S = Scene("school", 1400, 800)
G = 760
UF, UFs = 548, 560
RF, RFs = 336, 348
XL, XR = 20, 1100

# ── sky and ground ────────────────────────────────────────────────────────
S.at(0)
S.sky(sun=(1260, 170))
S.fill(rect(0, G, 1400, 40), "earth")
S.M(line(0, G, 1400, G), step=0)
for x in range(6, 1400, 14):
    S.H(line(x, G + 6, x + 10, G + 16))
S.lawn(XR, 1400, G)
S.H(wave(120, 220, 210, 220, 3, 5) + wave(136, 208, 190, 208, 2, 4))
S.H(wave(800, 180, 880, 180, 3, 4) + wave(814, 169, 860, 169, 2, 3))

# ── the building ──────────────────────────────────────────────────────────
S.at(150)
S.fill(rect(XL, RFs, XR - XL, G - RFs), "wall")
S.wallpaper((32, RFs, 588, UF - RFs), "sky", None, dado=40)                 # classroom
S.wallpaper((628, RFs, 460, UF - RFs), "sand", "planks")                   # library
S.wallpaper((32, UFs, 268, G - UFs), "mint", None, dado=44)                # corridor
S.wallpaper((308, UFs, 332, G - UFs), "blush", "tiles")                    # canteen
S.wallpaper((648, UFs, 440, G - UFs), "sand", "planks", dado=60)           # gym
S.M(rect(XL, RFs, 12, G - RFs), "ink", step=40)
S.M(rect(XR - 12, RFs, 12, G - RFs), "ink", step=40)
S.M(rect(XL - 8, RF, XR - XL + 16, 12), "ink", step=40)                    # roof
S.M(rect(32, UF, 1056, 12), "ink", step=40)
for x, y0, y1 in ((620, RFs, 440), (300, UFs, 640), (640, UFs, 640)):
    S.M(rect(x, y0, 8, y1 - y0), "ink")
    S.D(rect(x - 3, y1, 14, 4))
for a, b, y in ((32, 620, UF), (628, 1088, UF), (32, 300, G), (308, 640, G), (648, 1088, G)):
    S.H(line(a, y - 5, b, y - 5))
# bell tower on the roof
S.M(rect(548, 296, 44, 40), "brick")
S.D("M556 336V316Q570 300 584 316V336Z", "paper")
S.M("M562 322Q562 308 570 306Q578 308 578 322Z", "sun")
S.D(circle(570, 324, 2.5), "ink")
S.M(pts([(540, 298), (570, 272), (600, 298)], True), "red")

# ── classroom ─────────────────────────────────────────────────────────────
S.at(500)
S.M(circle(70, 384, 16), "paper")                                          # clock
S.D(line(70, 384, 70, 374) + line(70, 384, 78, 388))
S.M(rect(100, 372, 200, 80, 3), "paper")                                   # whiteboard
S.D(rect(96, 368, 208, 88, 4), None)
S.D(rect(110, 452, 180, 5, 2), "steel")
S.D(rect(130, 446, 16, 5, 2) + rect(152, 446, 16, 5, 2), "sky2")
S.D("M120 420L128 396L136 420M123 410H133"                               # A
    "M144 396V420M144 396Q160 398 152 407Q162 412 152 420H144M144 407H152"   # B
    "M184 400Q170 392 168 408Q170 424 184 418")                              # C
S.H(wave(200, 400, 280, 400, 4, 3) + wave(200, 414, 262, 414, 3, 3) + wave(120, 436, 240, 436, 5, 2))
S.M(rect(470, 372, 130, 60, 2), "paper")                                   # map
S.fill(blob(500, 396, 18, 12, 6, 0.2, 2) + blob(538, 408, 12, 16, 6, 0.2, 5) + blob(574, 392, 18, 11, 6, 0.2, 8), "leaf")
S.D(rect(470, 372, 130, 60, 2), None)
S.shadow(318, UF - 1, 20)
S.standing(318, UF, coat="lav2", d=1, arms=[(346, 470)], legs="ink")       # teacher
S.D(rect(344, 466, 12, 4, 2), "sky2")                                      # marker
for dx0, dx1 in ((360, 440), (490, 570)):                                  # desks
    S.M(rect(dx0, 500, dx1 - dx0, 7, 2), "wood")
    S.D(line(dx0 + 6, 507, dx0 + 6, UF) + line(dx1 - 6, 507, dx1 - 6, UF))
for cx, bx in ((452, 480), (584, 612)):                                    # chairs, facing left
    S.D(rect(cx, 516, 30, 6, 2), "red")
    S.D(rect(bx - 2, 470, 6, 52, 2), "red")
    S.D(line(cx + 4, 522, cx + 4, UF) + line(cx + 26, 522, cx + 26, UF))
S.sitting(468, 516, UF, coat="sun", legs="sky2", d=-1, arms=[(426, 494)], k=0.9)
S.sitting(598, 516, UF, coat="leaf", legs="ink", d=-1, arms=[(556, 494)], k=0.9)
S.D("M366 500L382 492L398 500Z", "blush2")                                 # open book
S.D(line(382, 492, 382, 500))
S.D(rect(404, 486, 14, 14, 2), "steel")                                    # calculator
S.soft(line(406, 492, 416, 492) + line(406, 496, 416, 496))
S.D(rect(494, 495, 28, 5, 1), "sky2")                                      # notebook
S.D(rect(526, 490, 24, 10, 4), "lime")                                     # pencil case
S.D(rect(552, 496, 18, 4, 1), "sun")                                       # ruler
S.M("M552 548V528Q552 518 566 518Q580 518 580 528V548Z", "lime")           # schoolbag
S.D(rect(558, 530, 16, 8, 2))

# ── library ───────────────────────────────────────────────────────────────
S.at(1300)
S.M(rect(900, 380, 160, 70), "glass")
S.D(line(980, 380, 980, 450) + rect(896, 450, 168, 4))
S.H(line(914, 392, 932, 410) + line(994, 392, 1012, 410))
import random
rnd = random.Random(11)
for x0 in (650, 770):                                                      # bookshelves
    S.M(rect(x0, 380, 110, 168, 2), "wood")
    for y in (420, 460, 500, 540):
        S.D(rect(x0 + 4, y, 102, 4), "sand2")
        x = x0 + 6
        while x < x0 + 100:
            w = rnd.choice((6, 7, 8, 10))
            h = rnd.choice((26, 30, 32, 34))
            S.D(rect(x, y - h, w, h, 1), rnd.choice(("red", "sky2", "lime", "sun", "lav2", "leaf", "blush2")))
            x += w + 1
S.D(line(705, 380, 705, 374) + rect(695, 372, 20, 4, 1), "wood")            # globe
S.M(circle(705, 358, 14), "sky2")
S.fill(blob(700, 354, 6, 5, 5, 0.2, 3) + blob(711, 364, 4, 4, 5, 0.2, 4), "leaf")
S.D(circle(705, 358, 14))
S.M(rect(928, 500, 132, 7, 2), "wood")                                     # table
S.D(line(936, 507, 936, UF) + line(1052, 507, 1052, UF))
S.D(rect(944, 466, 36, 26, 2), "ink")                                      # computer
S.D(rect(948, 470, 28, 18, 1), "glass")
S.D(rect(958, 492, 8, 8) + rect(944, 496, 40, 4, 1), "steel")
S.D(rect(1062, 516, 26, 6, 2) + rect(1082, 470, 6, 52, 2), "red")         # chair
S.sitting(1074, 516, UF, coat="blush2", legs="sky2", d=-1, arms=[(1036, 480)], k=0.9)
S.D("M1024 486L1036 476L1048 486L1036 492Z", "sky2")                       # book in hand

# ── corridor ──────────────────────────────────────────────────────────────
S.at(1900)
for i in range(5):                                                         # lockers
    x = 60 + i * 32
    if i == 2:
        S.M(rect(x, 600, 32, 160), "paper")
        S.D(rect(x + 4, 606, 24, 70), "lime")
        S.D(rect(x + 2, 690, 28, 3), "steel")
        S.M(pts([(x, 600), (x - 14, 606), (x - 14, 754), (x, 760)], True), "steel")
    else:
        S.M(rect(x, 600, 32, 160), "steel")
        S.soft("".join(line(x + 8, y, x + 24, y) for y in (612, 616, 620)))
        S.D(rect(x + 24, 660, 3, 14, 1), "ink")
S.M(rect(232, 590, 60, 50, 2), "sand2")                                    # noticeboard
S.D(rect(238, 596, 20, 16) + rect(262, 598, 24, 14) + rect(242, 618, 28, 16), "paper")
S.D(circle(248, 596, 2) + circle(274, 598, 2), "red")
S.M(rect(240, 694, 18, 50, 7), "red")                                      # fire extinguisher
S.D("M244 694V686H254V694M254 688Q266 690 262 704" + rect(236, 744, 26, 4))
S.D(rect(242, 708, 14, 14, 2), "paper")

# ── canteen ───────────────────────────────────────────────────────────────
S.at(2300)
S.M(rect(500, 588, 104, 54, 3), "ink")                                     # menu board
for i, y in enumerate(range(600, 636, 10)):
    S.fill(rect(508, y, 60, 3), "paper")
    S.fill(rect(576, y, 18, 3), "lime")
S.bust(396, 680, d=1, coat="paper")                                        # the cook
S.M("M384 626Q382 606 396 606Q410 606 408 626Z", "paper")                  # chef's hat
S.M(rect(318, 680, 156, 80, 3), "steel")                                   # counter
S.D(rect(316, 674, 160, 7, 2), "steel")
S.D(pts([(322, 646), (470, 646), (474, 652), (318, 652)], True), "glass")
for x, f in ((328, "sun"), (360, "leaf"), (392, "red"), (424, "sand2")):
    S.D(rect(x, 668, 28, 8, 2), f)
S.D(rect(454, 650, 18, 24, 1) + line(454, 656, 472, 656) + line(454, 662, 472, 662), "sky2")   # trays
S.M(rect(500, 700, 104, 7, 2), "wood")                                     # table
S.D(line(508, 707, 508, G) + line(596, 707, 596, G))
S.D(rect(610, 716, 28, 6, 2) + rect(632, 670, 6, 52, 2), "sky2")          # chair
S.sitting(622, 716, G, coat="red", legs="ink", d=-1, arms=[(582, 694)], k=0.9)
S.D(rect(518, 692, 70, 8, 2), "sky2")                                      # tray with lunch
S.D(ellipse(540, 692, 14, 3), "paper")
S.D(circle(566, 688, 5), "red")
S.D(rect(574, 680, 10, 12, 1), "lime")

# ── gym ───────────────────────────────────────────────────────────────────
S.at(2800)
S.D(line(662, 590, 662, G) + line(700, 590, 700, G), "wood")               # wall bars
S.D("".join(rect(662, y, 38, 3) for y in range(600, G, 14)), "wood")
S.D(line(722, UFs, 722, 590) + wave(722, 590, 724, 740, 6, 3))             # climbing rope
S.D(rect(716, 738, 12, 8, 3), "wood")
S.M(rect(820, 590, 84, 52, 3), "paper")                                    # basketball hoop
S.D(rect(846, 612, 32, 22, 1))
S.D(line(862, 642, 862, 648))
S.M(ellipse(862, 652, 20, 5), "red")
S.D("M844 654L850 684M856 656L858 686M868 656L866 686M880 654L874 684" + line(850, 684, 874, 684))
S.M(circle(880, 740, 18), "red")                                           # ball
S.D(line(862, 740, 898, 740) + "M880 722Q870 740 880 758M880 722Q890 740 880 758")
S.M(rect(938, 744, 124, 16, 4), "sky2")                                    # mat
S.soft(line(980, 744, 980, 760) + line(1020, 744, 1020, 760))
S.shadow(780, G - 1, 20)
pe = S.standing(780, G, coat="sky2", d=1, arms=[(800, 700)], legs="sky2")  # PE teacher
nx, ny = pe["neck"]
S.D(f"M{nx - 6} {ny}Q{nx} {ny + 16} {nx + 6} {ny}")
S.D(rect(nx - 4, ny + 12, 9, 5, 2), "lime")                                # whistle
S.shadow(1000, 743, 16)
S.standing(1000, 744, coat="sun", d=-1, h=92, arms=[(986, 648), (1016, 648)], legs="ink")   # a pupil jumping

# ── outside: school bus, bench, tree ──────────────────────────────────────
S.at(3300)
S.shadow(1210, G, 100, 5)
S.M("M1112 740V650Q1112 630 1132 630H1286Q1304 630 1308 650L1310 690H1300V740Z", "sun", step=80)   # bus
for x in range(1124, 1260, 30):
    S.D(rect(x, 644, 24, 26, 3), "glass")
S.D(rect(1268, 644, 30, 26, 3), "glass")
S.D(rect(1266, 680, 22, 56, 2), "glass")
S.D(line(1277, 680, 1277, 736))
S.D(rect(1112, 694, 188, 6), "ink")
S.D(rect(1296, 700, 12, 8, 2), "paper")
for cx in (1150, 1262):
    S.M(circle(cx, 744, 15), "ink")
    S.D(circle(cx, 744, 6), "paper")
S.tree(1363, G, 612, 34, 44, seed=6)                                         # tree
S.M(rect(1318, 726, 70, 6, 2), "wood")                                     # bench
S.D(rect(1318, 708, 70, 5, 2) + line(1324, 732, 1324, G) + line(1382, 732, 1382, G), "wood")

# ── words ─────────────────────────────────────────────────────────────────
def R(rid, word, box, label, level, ipa, d, ex, us=None):
    card = dict(level=level, ipa=ipa, pos="noun", def_=d, ex=ex)
    if us:
        card["us"] = us
    S.room(rid, word, box, label, **card)


R("school", "school", (XL, 260, XR - XL, G - 260), (40, 324), "A1", "skuːl",
  "A place where children go to learn.", "I go to school by bus.")
R("classroom", "classroom", (32, RFs, 588, UF - RFs), (42, 364), "A1", "ˈklɑːsruːm",
  "A room where lessons happen.", "Our classroom is on the first floor.")
R("library", "library", (628, RFs, 460, UF - RFs), (638, 364), "A2", "ˈlaɪbrəri",
  "A room with lots of books that you can read or borrow.", "Be quiet in the library!")
R("corridor", "corridor", (32, UFs, 268, G - UFs), (42, 578), "B1", "ˈkɒrɪdɔː",
  "A long passage in a building with doors to rooms.", "Don't run in the corridor!", "hallway")
R("canteen", "canteen", (308, UFs, 332, G - UFs), (318, 578), "B1", "kænˈtiːn",
  "The room where you have lunch at school.", "We eat lunch in the canteen at half past twelve.", "cafeteria")
R("gym", "gym", (648, UFs, 440, G - UFs), (738, 578), "A2", "dʒɪm",
  "A big room for sport and exercise.", "We have PE in the gym on Tuesdays.", "gymnasium")
R("playground", "playground", (XR, 560, 300, 200), (1112, 600), "A2", "ˈpleɪɡraʊnd",
  "The place outside a school where children play.", "The children are playing football in the playground.", "schoolyard")
S.meta["zones"] = [
    dict(id="upstairs", chip="Upstairs", box=[20, 260, 1080, 300]),
    dict(id="downstairs", chip="Downstairs", box=[20, 548, 1080, 212]),
    dict(id="desks", chip="The desks", box=[350, 440, 280, 110]),
]
S.meta["groups"] = {"classroom": "Classroom", "library": "Library", "corridor": "Corridor", "canteen": "Canteen",
                    "gym": "Gym", "outside": "Outside"}


def P(pid, word, level, room, pin, box, ipa, pos, d, ex, us=None):
    card = dict(level=level, room=room, ipa=ipa, pos=pos, def_=d, ex=ex)
    if us:
        card["us"] = us
    S.part(pid, word, pin, box, **card)


# classroom
P("whiteboard", "whiteboard", "A2", "classroom", (240, 430), (96, 366, 208, 94), "ˈwaɪtbɔːd", "noun",
  "A white board on the wall that the teacher writes on.", "The teacher wrote the new words on the whiteboard.")
P("teacher", "teacher", "A1", "classroom", (318, 470), (296, 426, 46, 122), "ˈtiːtʃə", "noun",
  "A person whose job is to teach.", "Our English teacher is really funny.")
P("pupil", "pupil", "A1", "classroom", (598, 486), (584, 440, 28, 108), "ˈpjuːpl", "noun",
  "A child who goes to school.", "There are 25 pupils in our class.", "student")
P("desk", "desk", "A1", "classroom", (410, 510), (358, 496, 84, 52), "desk", "noun",
  "A table you sit at to read, write or work.", "Sit down at your desk, please.")
P("chair", "chair", "A1", "classroom", (478, 530), (450, 466, 36, 82), "tʃeə", "noun",
  "A seat for one person, with a back.", "Push your chair in when you leave.")
P("book", "book", "A1", "classroom", (382, 496), (364, 486, 36, 16), "bʊk", "noun",
  "Pages with words or pictures, inside a cover.", "Open your books at page 20.")
P("calculator", "calculator", "A2", "classroom", (411, 492), (402, 484, 18, 18), "ˈkælkjuleɪtə", "noun",
  "A small machine that does sums.", "You can't use a calculator in this test.")
P("notebook", "notebook", "A2", "classroom", (506, 497), (492, 492, 32, 10), "ˈnəʊtbʊk", "noun",
  "A book with empty pages for writing in.", "Write the new words in your notebook.")
P("pencilcase", "pencil case", "A2", "classroom", (538, 494), (524, 488, 28, 14), "ˈpensl keɪs", "noun",
  "A small bag or box for pens and pencils.", "I've got two pencils and a rubber in my pencil case.")
P("ruler", "ruler", "A2", "classroom", (562, 498), (550, 494, 22, 8), "ˈruːlə", "noun",
  "A long flat piece of plastic or wood for measuring and drawing straight lines.", "Draw a line with your ruler.")
P("schoolbag", "schoolbag", "A1", "classroom", (566, 534), (550, 516, 32, 32), "ˈskuːlbæɡ", "noun",
  "A bag for carrying your books to school.", "My schoolbag is so heavy today!", "backpack")
P("map", "map", "A2", "classroom", (535, 402), (468, 370, 134, 64), "mæp", "noun",
  "A picture of the land and the sea, showing where places are.", "Can you find Australia on the map?")
P("clock", "clock", "A1", "classroom", (70, 384), (52, 366, 36, 36), "klɒk", "noun",
  "A thing on the wall that shows the time.", "Look at the clock - five minutes to the bell!")
P("marker", "marker", "B1", "classroom", (350, 468), (340, 462, 20, 10), "ˈmɑːkə", "noun",
  "A thick pen for writing on a whiteboard.", "The marker has run out - have you got another one?", "dry-erase marker")

# library
P("bookshelves", "bookshelves", "A2", "library", (760, 540), (648, 376, 234, 172), "ˈbʊkʃelvz", "noun",
  "Shelves for books.", "The dictionaries are on the bookshelves by the window.")
P("books", "books", "A1", "library", (824, 440), (772, 414, 104, 44), "bʊks", "noun",
  "More than one book.", "You can borrow three books for two weeks.")
P("globe", "globe", "A2", "library", (705, 358), (688, 342, 34, 40), "ɡləʊb", "noun",
  "A ball with a map of the world on it.", "Spin the globe and find your country.")
P("computer", "computer", "A1", "library", (962, 478), (940, 462, 46, 40), "kəmˈpjuːtə", "noun",
  "An electronic machine for writing, searching and saving things.", "You can use the computers in the library after school.")
P("student", "student", "A1", "library", (1074, 486), (1060, 440, 28, 108), "ˈstjuːdnt", "noun",
  "A person who is studying.", "A student is reading in the library.")
P("window", "window", "A1", "library", (1020, 416), (900, 380, 160, 70), "ˈwɪndəʊ", "noun",
  "An opening in a wall with glass, to let in light.", "Can I open the window? It's hot in here.")

# corridor
P("lockers", "lockers", "B1", "corridor", (140, 690), (44, 598, 180, 162), "ˈlɒkəz", "noun",
  "Small metal cupboards with locks, where pupils keep their things.", "I left my PE kit in my locker.")
P("noticeboard", "noticeboard", "B1", "corridor", (262, 614), (230, 588, 64, 54), "ˈnəʊtɪsbɔːd", "noun",
  "A board on the wall where people put up information.", "The timetable is on the noticeboard.", "bulletin board")
P("extinguisher", "fire extinguisher", "B1", "corridor", (249, 724), (234, 684, 30, 66), "ˈfaɪər ɪkˌstɪŋɡwɪʃə", "noun",
  "A red metal container that sprays water or foam onto a fire.", "There's a fire extinguisher at the end of every corridor.")

# canteen
P("cook", "cook", "A2", "canteen", (396, 648), (374, 604, 46, 76), "kʊk", "noun",
  "A person who cooks food.", "The school cook makes the best pizza!", "lunch lady")
P("counter", "counter", "A2", "canteen", (440, 720), (316, 646, 160, 114), "ˈkaʊntə", "noun",
  "A long table in a shop or canteen where food is served.", "Take a tray and go along the counter.")
P("tray", "tray", "A2", "canteen", (528, 696), (516, 686, 74, 16), "treɪ", "noun",
  "A flat board with edges, for carrying food.", "Put your plate and your drink on a tray.")
P("menu", "menu", "B1", "canteen", (552, 614), (498, 586, 108, 58), "ˈmenjuː", "noun",
  "A list of the food you can have.", "What's on the menu today?")

# gym
P("rope", "climbing rope", "B1", "gym", (724, 660), (710, 560, 26, 190), "ˈklaɪmɪŋ rəʊp", "noun",
  "A thick rope hanging from the ceiling, for climbing.", "Can you climb to the top of the rope?")
P("hoop", "basketball hoop", "B1", "gym", (862, 668), (818, 588, 88, 100), "ˈbɑːskɪtbɔːl huːp", "noun",
  "A metal ring with a net that you throw the ball through.", "She threw the ball through the hoop.")
P("ball", "ball", "A1", "gym", (880, 740), (860, 720, 40, 40), "bɔːl", "noun",
  "A round thing that you throw, kick or hit in games.", "Throw the ball to me!")
P("mat", "mat", "B1", "gym", (1040, 752), (936, 742, 128, 18), "mæt", "noun",
  "A thick soft piece of material on the floor, for jumping and exercises.", "Do the exercise on the mat.")
P("peteacher", "PE teacher", "B1", "gym", (782, 700), (760, 638, 44, 122), "ˌpiː ˈiː ˌtiːtʃə", "noun",
  "The teacher who teaches sport (PE = physical education).", "Our PE teacher made us run ten laps.", "gym teacher")
P("whistle", "whistle", "B1", "gym", (780, 681), (772, 674, 16, 14), "ˈwɪsl", "noun",
  "A small thing you blow to make a loud high sound.", "The game starts when the teacher blows the whistle.")

# outside
P("bell", "bell", "A2", "outside", (570, 316), (546, 296, 48, 40), "bel", "noun",
  "A metal thing that rings to show that a lesson starts or ends.", "When the bell rings, it's break time.")
P("bus", "school bus", "A1", "outside", (1200, 712), (1110, 626, 200, 134), "ˌskuːl ˈbʌs", "noun",
  "A bus that takes children to and from school.", "The school bus comes at eight o'clock.")
P("bench", "bench", "A2", "outside", (1352, 716), (1316, 704, 74, 56), "bentʃ", "noun",
  "A long seat for two or more people, often outside.", "We sat on a bench in the playground.")
P("tree", "tree", "A1", "outside", (1362, 620), (1326, 566, 72, 194), "triː", "noun",
  "A tall plant with a trunk, branches and leaves.", "There's a big tree next to the playground.")


S.meta.update(
    view=[0, 250, 1400, 550],
    roomsTitle="Places in the school",
    title="The School",
    kicker="Picture Studio · School",
    dek="A school cut open: a classroom and the library upstairs, the corridor, the canteen and the gym downstairs.",
    frames=["In the … there is / there are …", "The teacher is …ing", "My favourite subject is … because …",
            "At break time we …", "You mustn't … in the …", "I usually … after school."],
)
TF = [
    ("The clock is next to the whiteboard.", True, "A1"),
    ("There are two pupils in the classroom.", True, "A1"),
    ("The teacher is sitting down.", False, "A1"),
    ("The school bus is yellow.", True, "A1"),
    ("The ball is in the library.", False, "A1"),
    ("The library is next to the classroom.", True, "A2"),
    ("There is a globe on the bookshelves.", True, "A2"),
    ("The cook is wearing a hat.", True, "A2"),
    ("The canteen is upstairs.", False, "A2"),
    ("The schoolbag is on the desk.", False, "A2"),
    ("A student is reading a book next to the computer.", True, "A2"),
    ("One of the lockers is open.", True, "B1"),
    ("The fire extinguisher is in the gym.", False, "B1"),
    ("The PE teacher has a whistle round his neck.", True, "B1"),
    ("The climbing rope is between the wall bars and the basketball hoop.", True, "B1"),
    ("The menu is on the wall above the table in the canteen.", True, "B1"),
    ("There is a map of the world on the whiteboard.", False, "B1"),
]
PROMPTS = {
    "A1": ["What is in your classroom? Write five sentences.",
           "What is in your schoolbag today?",
           "What is your favourite room in your school? Why?"],
    "A2": ["Describe your school day, from the morning bell to the end of school.",
           "Compare this school with your school. What is the same? What is different?",
           "Write the school rules for the corridor, the canteen and the library."],
    "B1": ["Should pupils wear school uniform? Give reasons for and against.",
           "Describe your perfect school. What rooms and lessons would it have?",
           "Write an email to a new pupil telling them what they need to know about your school."],
}

for coll in (S.rooms, S.parts):
    for c in coll:
        c["def"] = c.pop("def_")

os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
out = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "scenes"))
S.save(os.path.join(out, "school.json"), truefalse=[dict(s=s, a=a, level=l) for s, a, l in TF], prompts=PROMPTS)
S.svg(os.path.join(ROOT, "out", "school.svg"))
lv = {}
for p in S.parts + S.rooms:
    lv[p["level"]] = lv.get(p["level"], 0) + 1
print(f"school: {len(S.items)} items, {len(S.parts)} parts + {len(S.rooms)} rooms, levels {lv}, "
      f"{os.path.getsize(os.path.join(out, 'school.json')) // 1024} KB")
