"""Picture Studio · The Potions Classroom — a stone classroom in a school of
magic: floating candles, shelves of jars, a recipe on the blackboard, a big
bubbling cauldron, a teacher with a wand and students brewing and writing.
Inspired by fantasy classics - an original drawing, no film stills.
Writes data/scenes/potions.json.

    python3 ops/scenes/make_potions.py
"""
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob
from common import words, finish

S = Scene("potions", 1400, 800)
G = 690
TOP = 120


def candle(x, y, h=34):
    S.D(rect(x - 5, y, 10, h, 2), "paper")
    S.D(f"M{x} {y - 2}Q{x - 5} {y - 10} {x} {y - 18}Q{x + 5} {y - 10} {x} {y - 2}Z", "candle")
    S.soft(circle(x, y - 9, 14))


def hat(hx, hy, fill="plum"):
    S.D(ellipse(hx, hy - 7, 20, 5), fill)
    S.D(f"M{hx - 13} {hy - 8}Q{hx - 2} {hy - 30} {hx + 8} {hy - 52}Q{hx + 8} {hy - 26} {hx + 13} {hy - 8}Z", fill)
    S.fill("".join(circle(hx + dx, hy + dy, 1.6) for dx, dy in ((-2, -18), (4, -30), (-4, -12))), "gold")


# ── walls and floor ───────────────────────────────────────────────────────
S.at(0)
S.fill(rect(0, 0, 1400, 800), "night2")
S.wallpaper((0, TOP, 1400, G - TOP), "stone", "bricks", dado=60)
S.fill(rect(0, G, 1400, 110), "stone2")
S.soft("".join(line(x, G, x - 30, 800) for x in range(40, 1440, 70)) + line(0, G + 40, 1400, G + 40))
S.M(line(0, G, 1400, G), step=0)
for x in (0, 700, 1400):                                                     # stone arches along the ceiling
    S.M(f"M{x - 350} {TOP + 60}Q{x - 175} {TOP - 40} {x} {TOP + 60}", step=20)

# ── arched window ─────────────────────────────────────────────────────────
S.at(150)
S.M("M60 440V260Q60 190 130 176Q200 190 200 260V440Z", "sky2", step=60)
S.soft(line(130, 180, 130, 440) + "".join(line(60, y, 200, y) for y in (250, 310, 370)) + line(95, 190, 95, 440) + line(165, 190, 165, 440))
S.M("M60 440V260Q60 190 130 176Q200 190 200 260V440Z", None)
S.M(rect(48, 440, 164, 14, 3), "stone2")
S.fill(circle(96, 230, 12), "sun")

# ── shelves of jars and bottles ───────────────────────────────────────────
S.at(300)
for y in (250, 330, 410):
    S.M(rect(240, y, 250, 10, 2), "wood", step=30)
    S.D(pts([(252, y + 10), (262, y + 10), (252, y + 26)], True) + pts([(478, y + 10), (468, y + 10), (478, y + 26)], True), "wood")
jars = [(262, 250, 22, 34, "moss"), (296, 250, 18, 26, "plum"), (326, 250, 26, 40, "cyan"), (366, 250, 16, 24, "red"),
        (396, 250, 22, 30, "gold"), (434, 250, 30, 44, "violet"),
        (262, 330, 30, 40, "gold"), (304, 330, 18, 30, "moss"), (336, 330, 22, 22, "red"), (374, 330, 24, 36, "plum"),
        (412, 330, 18, 28, "cyan"), (444, 330, 26, 34, "leaf2"),
        (262, 410, 20, 24, "violet"), (296, 410, 28, 38, "red"), (338, 410, 18, 28, "cyan"), (370, 410, 30, 34, "moss")]
for x, yb, w, h, f in jars:
    S.D(rect(x, yb - h, w, h, 5), f)
    S.D(rect(x + 3, yb - h - 6, w - 6, 7, 2), "bark")
    S.soft(line(x + 4, yb - h + 6, x + 4, yb - 6))
# potion bottles (narrow necks)
for x, f in ((420, "neon"), (446, "cyan"), (468, "gold")):
    S.D(f"M{x - 8} 410V388Q{x - 8} 380 {x - 3} 376V364H{x + 3}V376Q{x + 8} 380 {x + 8} 388V410Z", f)
    S.D(rect(x - 3, 358, 6, 7, 2), "bark")

# ── blackboard with the recipe ────────────────────────────────────────────
S.at(500)
S.M(rect(600, 190, 320, 200, 4), "bark", step=40)
S.D(rect(612, 202, 296, 176, 2), "night")
S.fill(rect(632, 218, 150, 8), "paper")                                      # "Potion No. 7"
S.fill("".join(circle(640, y, 3) for y in (250, 278, 306, 334)), "paper")
S.fill("".join(rect(652, y - 3, w, 5) for y, w in ((250, 200), (278, 170), (306, 214), (334, 150))), "paper")
S.D("M830 330Q850 300 870 330Q850 360 830 330Z", "candle")                  # a doodle of a flame
S.D(rect(700, 390, 120, 10, 2), "wood")
S.D(rect(716, 384, 20, 7, 2) + rect(744, 384, 14, 7, 2), "paper")          # chalk

# ── floating candles ─────────────────────────────────────────────────────
S.at(700)
for x, y in ((300, 168), (520, 186), (980, 170), (1120, 196), (1270, 172), (180, 150)):
    candle(x, y)

# ── owl on a perch ───────────────────────────────────────────────────────
S.at(800)
S.D(line(1240, 300, 1330, 300) + line(1285, 300, 1285, 460) + line(1260, 460, 1310, 460), "bark")
S.M("M1268 298Q1262 262 1285 254Q1308 262 1302 298Z", "rust", step=50)
S.D(circle(1277, 270, 6) + circle(1293, 270, 6), "paper")
S.fill(circle(1277, 270, 2.6) + circle(1293, 270, 2.6), "ink")
S.D("M1282 280L1285 286L1288 280Z", "gold")
S.D("M1270 258L1266 248L1276 254M1300 258L1304 248L1294 254", "rust")
S.soft("M1276 290Q1285 294 1294 290")

# ── broom leaning on the wall ─────────────────────────────────────────────
S.at(900)
S.D(line(1372, 380, 1346, 640), "bark")
S.M("M1336 620L1356 624L1368 690L1316 686Z", "dune", step=40)
S.soft("".join(line(1340 + i * 6, 628, 1322 + i * 8, 686) for i in range(6)))
S.D(rect(1338, 616, 20, 8, 2), "rust")

# ── the lectern with the spell book ───────────────────────────────────────
S.at(1000)
S.shadow(170, G, 50, 4)
S.M("M150 690L160 590H180L190 690Z", "bark", step=40)
S.M("M104 596L236 572L240 590L108 614Z", "bark")
S.M("M112 590Q140 560 172 580Q200 556 232 572L236 584Q204 572 172 594Q142 576 114 604Z", "paper")
S.D(line(172, 580, 172, 594))
S.soft(line(124, 586, 162, 578) + line(126, 592, 160, 586) + line(184, 580, 222, 572) + line(186, 586, 222, 580))
S.D("M208 560L206 590", "red")                                                # ribbon bookmark

# ── the big cauldron over a fire ─────────────────────────────────────────
S.at(1200)
S.shadow(660, G + 42, 130, 6)
S.M("M548 600Q540 700 600 724H720Q780 700 772 600Z", "ink", step=80)
for x in (586, 624, 662, 700, 738):                                         # flames under it
    S.D(f"M{x} 758Q{x - 16} 736 {x} 708Q{x + 16} 736 {x} 758Z", "candle")
    S.D(f"M{x} 758Q{x - 8} 744 {x} 728Q{x + 8} 744 {x} 758Z", "rust")
S.D(rect(560, 756, 200, 10, 4) + rect(574, 764, 170, 9, 4), "bark")          # logs
S.M(ellipse(660, 600, 116, 22), "night")
S.fill(ellipse(660, 602, 100, 16), "moss")                                  # the green potion
S.fill("".join(circle(x, y, r) for x, y, r in ((620, 598, 7), (660, 604, 9), (700, 596, 6), (636, 606, 4), (686, 606, 5))), "leaf3")
S.soft("".join(circle(x, y, r) for x, y, r in ((620, 598, 7), (660, 604, 9), (700, 596, 6))))
S.D(wave(624, 580, 600, 480, 4, 10) + wave(660, 578, 680, 460, 4, 12) + wave(700, 582, 720, 500, 3, 9))   # smoke
S.fill("".join(circle(x, y, r) for x, y, r in ((600, 470, 16), (626, 452, 20), (676, 440, 24), (716, 470, 18), (650, 470, 16))), "mint")
S.soft("".join(circle(x, y, r) for x, y, r in ((600, 470, 16), (626, 452, 20), (676, 440, 24), (716, 470, 18))))
S.D(rect(544, 610, 16, 10, 4) + rect(760, 610, 16, 10, 4), "ink")            # handles
# a student stirring with a long spoon
S.at(1400)
S.shadow(470, G + 60, 26)
st = S.standing(470, G + 60, coat="plum", d=1, arms=[(560, 600), (536, 620)], legs="ink", k=1.5, hair="curly", hairc="hairb")
S.D(line(560, 600, 640, 590) + ellipse(648, 590, 12, 5), "wood")             # the spoon in the pot
S.D(f"M{st['neck'][0] - 12} {st['ys'] + 8}L{st['neck'][0] - 2} {st['ys'] + 30}M{st['neck'][0] + 12} {st['ys'] + 8}L{st['neck'][0] + 2} {st['ys'] + 30}", "gold")  # scarf
# ── the teacher at the board, wand up ─────────────────────────────────────
S.at(1600)
S.shadow(990, G + 20, 28)
t = S.standing(990, G + 20, coat="deep", d=-1, arms=[(946, 492), (1008, 566)], legs="ink", k=1.6, hair="long", hairc="stone2")
S.M(f"M{990 - 30} {t['yh'] - 4}L{990 - 38} {G + 12}H{990 + 38}L{990 + 30} {t['yh'] - 4}Z", "deep")   # long robe
S.D(line(946, 492, 920, 446), "bark")                                           # wand
S.fill("".join(pts([(x, y - 6), (x + 2, y - 2), (x + 6, y), (x + 2, y + 2), (x, y + 6), (x - 2, y + 2), (x - 6, y), (x - 2, y - 2)], True)
               for x, y in ((912, 434), (894, 424), (900, 450))), "gold")
hat(t["head"][0], t["head"][1] - 6, "deep")

# ── the desk on the right: quill, ink, scales, mortar, hourglass ─────────
S.at(1800)
S.M(rect(1060, 560, 260, 14, 3), "wood", step=40)
S.D(rect(1068, 574, 14, 116) + rect(1298, 574, 14, 116), "wood")
S.D("M1080 560Q1102 546 1124 556Q1146 546 1168 560Z", "paper")              # open book
S.D(line(1124, 556, 1124, 560))
S.D(rect(1192, 540, 18, 20, 4), "ink")                                       # ink pot
S.D("M1202 540Q1216 500 1238 486Q1224 512 1206 540Z", "paper")              # quill
S.D(line(1206, 540, 1232, 494))
S.D(line(1284, 560, 1284, 520) + line(1266, 522, 1302, 522), "gold")        # balance scales
S.D("M1260 522Q1266 536 1272 522Z" + "M1296 522Q1302 536 1308 522Z", "gold")
S.D("M1218 540Q1218 560 1234 560Q1250 560 1250 540Z", "stone2")             # mortar
S.D(line(1240, 544, 1254, 520), "stone2")                                    # pestle
S.D("M170 404H196M170 440H196M173 404Q183 422 173 440M193 404Q183 422 193 440", "wood")   # hourglass on the sill
S.fill("M175 410Q183 416 191 410Z M176 438Q183 430 190 438Z", "dune")
# a student writing at the desk
S.D(rect(1146, 610, 52, 8, 3) + rect(1150, 618, 6, 72) + rect(1188, 618, 6, 72), "wood")
S.sitting(1172, 610, G, coat="plum", legs="ink", d=-1, arms=[(1130, 554)], k=1.5, hair="short", hairc="hairy")
S.D(line(1130, 554, 1138, 536), "paper")

# ── words ─────────────────────────────────────────────────────────────────
R, P = words(S)
R("classroom", "classroom", (0, 110, 1400, 690), (20, 470), "A1", "ˈklɑːsruːm",
  "A room where lessons happen.", "The potions classroom is under the old tower.")
S.meta["zones"] = [
    dict(id="shelvesz", chip="Shelves and window", box=[40, 140, 470, 330]),
    dict(id="cauldronz", chip="The cauldron", box=[420, 420, 420, 380]),
    dict(id="deskz", chip="The desk", box=[1040, 470, 300, 230]),
]
S.meta["groups"] = {"room": "The classroom", "brewing": "Brewing", "desk": "On the desk", "people": "People"}

P("window", "window", "A1", "room", (130, 330), (58, 174, 144, 268), "ˈwɪndəʊ", "noun",
  "An opening in a wall with glass in it.", "The window has lots of small glass diamonds.")
P("candles", "floating candles", "B1", "room", (520, 190), (160, 128, 1130, 110), "ˌfləʊtɪŋ ˈkændlz", "noun",
  "Candles that stay in the air by magic.", "Floating candles light the classroom.")
P("shelves", "shelves", "A2", "room", (470, 340), (238, 246, 256, 176), "ʃelvz", "noun",
  "Flat boards on a wall for keeping things on.", "The shelves are full of jars.")
P("jars", "jars", "A2", "room", (300, 380), (258, 206, 214, 206), "dʒɑːz", "noun",
  "Glass containers with lids.", "Each jar has a different ingredient in it.")
P("bottles", "potion bottles", "B1", "room", (446, 390), (408, 354, 72, 58), "ˈpəʊʃn ˌbɒtlz", "noun",
  "Small bottles for keeping potions in.", "Three potion bottles stand at the end of the shelf.")
P("blackboard", "blackboard", "A2", "room", (880, 240), (600, 190, 320, 200), "ˈblækbɔːd", "noun",
  "A dark board that you write on with chalk.", "The recipe is written on the blackboard.", "chalkboard")
P("recipe", "recipe", "B1", "room", (720, 280), (628, 212, 240, 132), "ˈresəpi", "noun",
  "Instructions for making something, step by step.", "Follow the recipe exactly or the potion won't work.")
P("chalk", "chalk", "A2", "room", (726, 388), (700, 382, 64, 18), "tʃɔːk", "noun",
  "A small white stick for writing on a blackboard.", "She picked up the chalk and wrote the steps.")
P("owl", "owl", "A2", "room", (1285, 276), (1260, 244, 50, 58), "aʊl", "noun",
  "A bird with big eyes that is awake at night.", "The owl carries letters to the students.")
P("perch", "perch", "B1", "room", (1300, 400), (1236, 296, 98, 168), "pɜːtʃ", "noun",
  "A pole where a bird sits.", "The owl sleeps on its perch.")
P("broom", "broom", "A2", "room", (1350, 660), (1312, 376, 64, 316), "bruːm", "noun",
  "A brush with a long handle for sweeping - or flying!", "Someone left a broom by the wall.", "broomstick")
P("lectern", "lectern", "B1", "room", (170, 650), (100, 556, 144, 136), "ˈlektən", "noun",
  "A stand with a sloping top for holding a big book.", "The spell book lies open on the lectern.")
P("spellbook", "spell book", "B1", "room", (140, 584), (108, 556, 132, 50), "ˈspel bʊk", "noun",
  "A book of magic words and spells.", "Don't read the spell book out loud!")

P("cauldron", "cauldron", "B1", "brewing", (600, 680), (540, 578, 240, 150), "ˈkɔːldrən", "noun",
  "A big round metal pot for cooking over a fire.", "The cauldron is bubbling.")
P("potion", "potion", "B1", "brewing", (690, 604), (560, 586, 200, 30), "ˈpəʊʃn", "noun",
  "A magic drink.", "The potion turned bright green.")
P("bubbles", "bubbles", "A2", "brewing", (660, 604), (608, 590, 104, 24), "ˈbʌblz", "noun",
  "Balls of air in a liquid.", "Bubbles rise to the top of the pot.")
P("smoke", "smoke", "A2", "brewing", (676, 448), (580, 420, 160, 160), "sməʊk", "noun",
  "The grey or coloured cloud that comes from something burning.", "Green smoke rises from the cauldron.")
P("fire", "fire", "A1", "brewing", (650, 740), (566, 704, 188, 70), "ˈfaɪə", "noun",
  "The flames and heat from something burning.", "A small fire keeps the cauldron hot.")
P("spoon", "long spoon", "A2", "brewing", (600, 596), (556, 580, 106, 22), "lɒŋ spuːn", "noun",
  "A spoon with a long handle for stirring.", "Stir it slowly with the long spoon.")

P("book", "book", "A1", "desk", (1100, 552), (1078, 542, 92, 22), "bʊk", "noun",
  "A set of printed pages to read.", "Her book is open at the right page.")
P("quill", "quill", "B1", "desk", (1224, 504), (1198, 482, 44, 62), "kwɪl", "noun",
  "A pen made from a long feather.", "She writes her notes with a quill.")
P("inkpot", "ink pot", "B1", "desk", (1201, 552), (1188, 536, 26, 26), "ˈɪŋk pɒt", "noun",
  "A small pot of ink.", "Dip the quill in the ink pot.")
P("scales", "scales", "B1", "desk", (1284, 540), (1256, 516, 56, 46), "skeɪlz", "noun",
  "A machine for weighing things.", "Weigh the dragon scales on the scales - no, really!")
P("mortar", "mortar and pestle", "B1", "desk", (1234, 552), (1214, 516, 44, 46), "ˌmɔːtər ən ˈpesl", "noun",
  "A bowl and a heavy stick for crushing things into powder.", "Crush the leaves with the mortar and pestle.")
P("hourglass", "hourglass", "B1", "room", (183, 422), (166, 400, 34, 42), "ˈaʊəɡlɑːs", "noun",
  "Glass with sand that runs through it to measure time.", "Turn the hourglass and wait.", "sand timer")
P("desk", "desk", "A1", "desk", (1200, 600), (1060, 556, 260, 134), "desk", "noun",
  "A table where you study or work.", "The desk is covered with tools.")

P("teacher", "teacher", "A1", "people", (1000, 580), (940, 460, 100, 252), "ˈtiːtʃə", "noun",
  "A person whose job is to teach.", "The teacher points at the board with her wand.")
P("wand", "wand", "A2", "people", (930, 466), (888, 418, 64, 80), "wɒnd", "noun",
  "A thin stick that a witch or wizard uses to do magic.", "She waved her wand and the candles lit up.")
P("hat", "pointed hat", "A2", "people", (994, 500), (966, 462, 56, 68), "ˌpɔɪntɪd ˈhæt", "noun",
  "A tall hat with a point at the top.", "The teacher always wears a pointed hat.")
P("robe", "robe", "B1", "people", (986, 670), (950, 610, 80, 104), "rəʊb", "noun",
  "A long loose piece of clothing.", "Her long dark robe touches the floor.")
P("student", "students", "A1", "people", (470, 640), (430, 540, 1200 - 430, 212), "ˈstjuːdnts", "noun",
  "People who study at a school.", "Two students are working in the lesson.")
P("scarf", "scarf", "A1", "people", (468, 600), (452, 580, 34, 50), "skɑːf", "noun",
  "A long piece of cloth you wear round your neck.", "He's wearing a yellow scarf.")

S.meta.update(
    view=[0, 110, 1400, 690],
    roomsTitle="The room",
    title="The Potions Classroom",
    kicker="Picture Studio · Magic & Fantasy",
    dek="A stone classroom in a school of magic: floating candles, a bubbling cauldron and a recipe on the board.",
    inspired="Inspired by fantasy classics",
    frames=["First, … . Then … . Finally … .", "Add … drops of … to the …", "Don't … the potion!",
            "Stir it … times clockwise.", "If you … , the potion will …", "The teacher is …ing."],
)
TF = [
    ("There are candles in the air.", True, "A1"),
    ("The owl is on the blackboard.", False, "A1"),
    ("The potion in the cauldron is green.", True, "A1"),
    ("The teacher has got a wand.", True, "A1"),
    ("A student is stirring the cauldron.", True, "A2"),
    ("The broom is next to the window.", False, "A2"),
    ("There is a spell book on the lectern.", True, "A2"),
    ("The teacher is wearing a pointed hat.", True, "A2"),
    ("The student at the desk is writing with a quill.", True, "B1"),
    ("There is an hourglass on the shelf.", False, "B1"),
    ("The recipe is written on the blackboard.", True, "B1"),
    ("Smoke is rising from the cauldron.", True, "B1"),
]
PROMPTS = {
    "A1": ["What can you see in the classroom? Write six things.",
           "What colour is the potion? What colour is the smoke?",
           "What is the teacher doing? What are the students doing?"],
    "A2": ["Write a recipe for a potion. Use: first, then, next, finally.",
           "Imagine your first day at a school of magic. What happens?",
           "What would you like to learn at a school of magic? Why?"],
    "B1": ["Write the instructions for a potion that makes people brave. Use imperatives.",
           "Something went wrong with the potion. Tell the story.",
           "Should magic be taught at school? Write a funny opinion essay."],
}
finish(S, TF, PROMPTS)
