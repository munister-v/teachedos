"""Picture Studio · The Gym — a busy gym: lockers and a water fountain, a
treadmill with a runner, a weights bench, the dumbbell rack in front of the
mirrors, a yoga mat, an exercise bike, a punch bag and a personal trainer.
Writes data/scenes/gym.json.

    python3 ops/scenes/make_gym.py
"""
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob
from common import words, finish

S = Scene("gym", 1400, 800)
G = 690
TOP = 120


def dumbbell(cx, cy, w=36, r=8, f="night"):
    S.D(rect(cx - w / 2, cy - 2, w, 4, 2), "slate")
    S.D(rect(cx - w / 2 - 4, cy - r, 8, r * 2, 3) + rect(cx + w / 2 - 4, cy - r, 8, r * 2, 3), f)


# ── room ──────────────────────────────────────────────────────────────────
S.at(0)
S.fill(rect(0, 0, 1400, 800), "tint")
S.wallpaper((0, TOP, 1400, G - TOP), "mint", "stripes", dado=90)
S.fill(rect(0, G, 1400, 110), "slate")
S.soft("".join(line(x, G, x, 800) for x in range(0, 1400, 100)) + line(0, 744, 1400, 744))
S.M(line(0, G, 1400, G), step=0)
S.fill("".join(rect(x, TOP, 140, 8, 3) for x in (160, 560, 960)), "paper")

# ── lockers and a water fountain (left) ──────────────────────────────────
S.at(150)
S.M(rect(30, 300, 150, 390, 3), "sky2", step=60)
for i in range(3):
    x = 30 + i * 50
    S.D(rect(x + 4, 306, 42, 186, 2) + rect(x + 4, 498, 42, 186, 2), "sky2")
    S.soft("".join(line(x + 12, y, x + 38, y) for y in (318, 324, 510, 516)))
    S.D(circle(x + 38, 400, 3) + circle(x + 38, 590, 3), "ink")
S.D(rect(64, 280, 40, 20, 5), "red")                                            # gym bag on top
S.D("M72 280Q84 266 96 280", None)
S.D(rect(196, 520, 40, 60, 6), "paper")                                          # water fountain
S.D(rect(200, 580, 32, 110), "steel")
S.D("M206 526Q216 516 226 526", "sky2")
S.soft(wave(214, 512, 222, 500, 1, 3))

# ── mirrors and the TV timer ─────────────────────────────────────────────
S.at(300)
S.M(rect(300, 180, 800, 330, 3), "glass", step=60)
S.soft("".join(line(x, 190, x - 60, 500) for x in (380, 400, 700, 720, 1000, 1020)))
S.D(line(566, 180, 566, 510) + line(833, 180, 833, 510), "paper")
S.M(rect(1150, 190, 190, 110, 6), "ink", step=40)
S.D(rect(1160, 200, 170, 90, 3), "deep")
S.fill(rect(1178, 228, 20, 34) + rect(1206, 228, 20, 34) + rect(1250, 228, 20, 34) + rect(1278, 228, 20, 34), "lime")
S.fill(circle(1238, 236, 3) + circle(1238, 254, 3), "lime")
S.D(rect(1170, 330, 150, 110, 4), "sun")                                         # poster
S.D(pts([(1200, 420), (1240, 350), (1280, 420)], True), "leaf2")
S.fill(rect(1190, 344, 60, 8), "red")

# ── the treadmill and the runner ─────────────────────────────────────────
S.at(500)
S.shadow(360, G + 30, 120, 5)
S.M("M250 716L470 716L476 690H256Z", "night", step=40)                         # deck
S.fill(rect(262, 694, 206, 12), "slate")
S.soft("".join(line(x, 694, x - 4, 706) for x in range(270, 468, 14)))
S.D(line(454, 690, 440, 560) + line(470, 690, 452, 560), "slate")             # upright
S.D(rect(420, 540, 60, 26, 5), "ink")                                            # console
S.D(rect(428, 546, 44, 12, 2), "screen")
S.D(line(420, 580, 370, 590) + line(420, 596, 370, 604), "slate")              # handrails
run = S.standing(350, 694, coat="red", d=1, arms=[(380, 610), (326, 626)], legs="ink", k=1.5, hair="bun", hairc="hairy")
S.D(rect(run["head"][0] - 13, run["head"][1] - 8, 26, 5, 2), "cyan")            # headband
S.fill("".join(f"M{x} {y}Q{x - 3} {y + 5} {x} {y + 7}Q{x + 3} {y + 5} {x} {y}Z" for x, y in ((320, 548), (312, 566))), "sky2")   # sweat drops

# ── weights bench with someone lifting ───────────────────────────────────
S.at(700)
S.D(rect(530, 640, 170, 16, 5), "red")
S.D(rect(546, 656, 10, 34) + rect(676, 656, 10, 34), "slate")
S.sitting(600, 640, G, coat="navy", legs="stone2", d=1, arms=[(636, 566)], k=1.5, hair="short", hairc="ink")
dumbbell(638, 560, 30, 8)
S.D(rect(648, 626, 16, 14, 3), "sky2")                                          # water bottle on the bench
S.D(rect(652, 618, 8, 8, 2), "ink")
S.D("M680 640Q690 624 700 640Z", "paper")                                        # towel

# ── the dumbbell rack and kettlebells ────────────────────────────────────
S.at(900)
S.M(rect(740, 520, 230, 14, 3), "slate", step=40)
S.M(rect(740, 600, 230, 14, 3), "slate")
S.D(rect(746, 534, 10, 156) + rect(954, 534, 10, 156), "slate")
for i, x in enumerate(range(770, 960, 46)):
    dumbbell(x, 510, 26, 6 + i, ("night", "red", "sky2", "night")[i % 4])
    dumbbell(x, 590, 26, 8 + i, ("night", "night", "red", "night")[i % 4])
for x, f, r in ((770, "night", 14), (812, "red", 18), (860, "night", 22)):       # kettlebells
    S.D(circle(x, G - r, r), f)
    S.D(f"M{x - r * 0.6} {G - r * 1.6}Q{x} {G - r * 2.6} {x + r * 0.6} {G - r * 1.6}", None)

# ── yoga mat with someone stretching ─────────────────────────────────────
S.at(1100)
S.M("M990 736L1180 736L1170 716H1000Z", "lav2", step=40)
S.D(ellipse(1186, 726, 8, 12), "lav2")                                          # rolled end
S.sitting(1040, 722, 728, coat="leaf2", legs="navy", d=1, arms=[(1102, 712)], k=1.35, hair="long", hairc="ink")
S.D(wave(1094, 712, 1140, 720, 3, 3), "neon")                                    # resistance band round her feet
S.D(circle(1350, 664, 26), "cyan")                                                # exercise ball

# ── exercise bike and the trainer ────────────────────────────────────────
S.at(1300)
S.D(ellipse(1260, 684, 70, 10), "slate")
S.M("M1220 684L1240 600L1300 600L1310 684Z", "night", step=40)
S.D(circle(1300, 640, 26), "slate")
S.D(line(1240, 600, 1232, 560) + rect(1216, 552, 34, 10, 4), "ink")             # seat
S.D(line(1300, 600, 1316, 540) + line(1308, 540, 1330, 536), "ink")             # handlebars
S.D(rect(1310, 552, 20, 14, 3), "screen")
# the personal trainer
S.shadow(980, G + 56, 24)
tr = S.standing(980, G + 56, coat="lime", d=1, arms=[(1006, 626), (962, 644)], legs="ink", k=1.55, hair="short", hairc="hairb")
S.D(rect(1000, 606, 26, 34, 3), "wood")                                           # clipboard
S.D(rect(1004, 614, 18, 22, 2), "paper")
S.D(circle(960, 650, 8), "paper")                                                 # stopwatch
S.D(line(960, 650, 960, 644) + rect(957, 638, 6, 4, 1), "ink")

# ── punch bag ────────────────────────────────────────────────────────────
S.at(1500)
S.D(line(1370, TOP, 1370, 400), "slate")
S.M(rect(1344, 400, 52, 170, 22), "red", step=50)
S.D(rect(1344, 430, 52, 8) + rect(1344, 530, 52, 8), "night")

# ── words ─────────────────────────────────────────────────────────────────
R, P = words(S)
R("gym", "gym", (0, 110, 1400, 690), (24, 740), "A1", "dʒɪm",
  "A place with machines and equipment for exercise.", "I go to the gym three times a week.")
S.meta["zones"] = [
    dict(id="cardioz", chip="Cardio", box=[180, 420, 380, 360]),
    dict(id="weightsz", chip="Weights", box=[500, 420, 500, 360]),
    dict(id="stretchz", chip="Stretching", box=[960, 480, 440, 300]),
]
S.meta["groups"] = {"room": "The gym", "cardio": "Cardio", "weights": "Weights", "stretch": "Stretching", "people": "People"}

P("lockers", "lockers", "A2", "room", (80, 420), (28, 298, 154, 392), "ˈlɒkəz", "noun",
  "Small cupboards where you can lock your things.", "Leave your bag in the lockers.")
P("bag", "gym bag", "A1", "room", (84, 290), (60, 262, 48, 40), "ˈdʒɪm bæɡ", "noun",
  "A bag for your sports clothes.", "My gym bag is on top of the lockers.")
P("fountain", "water fountain", "B1", "room", (216, 540), (194, 498, 44, 192), "ˈwɔːtə ˌfaʊntɪn", "noun",
  "A machine that gives you water to drink.", "Have a drink at the water fountain.")
P("mirrors", "mirrors", "A1", "room", (700, 250), (298, 178, 804, 334), "ˈmɪrəz", "noun",
  "Glass that shows your reflection.", "The whole wall is covered in mirrors.")
P("timer", "timer", "B1", "room", (1238, 246), (1148, 188, 194, 114), "ˈtaɪmə", "noun",
  "A screen or clock that counts time.", "The timer shows forty-five seconds.")
P("poster", "poster", "A2", "room", (1245, 380), (1168, 328, 154, 114), "ˈpəʊstə", "noun",
  "A big picture on a wall.", "The poster says 'Never give up'.")

P("treadmill", "treadmill", "A2", "cardio", (300, 700), (248, 536, 234, 184), "ˈtredmɪl", "noun",
  "A running machine with a moving belt.", "She runs five kilometres on the treadmill.")
P("console", "screen", "A1", "cardio", (450, 552), (418, 538, 64, 30), "skriːn", "noun",
  "The part of a machine that shows information.", "The screen shows her speed.")
P("runner", "runner", "A2", "people", (350, 640), (316, 510, 72, 186), "ˈrʌnə", "noun",
  "A person who runs.", "The runner is sweating.")
P("headband", "headband", "B1", "people", (run["head"][0], run["head"][1] - 6), (run["head"][0] - 15, run["head"][1] - 10, 30, 9), "ˈhedbænd", "noun",
  "A band you wear round your head.", "Her headband stops sweat running into her eyes.", "sweatband")
P("bike", "exercise bike", "A2", "cardio", (1270, 640), (1210, 530, 124, 164), "ˈeksəsaɪz baɪk", "noun",
  "A bike that stays in one place, for exercise.", "Warm up on the exercise bike for ten minutes.", "stationary bike")
P("punchbag", "punchbag", "B1", "cardio", (1370, 486), (1340, 396, 60, 178), "ˈpʌntʃbæɡ", "noun",
  "A heavy bag that you hit for exercise.", "Hitting the punchbag is great exercise.", "punching bag")

P("bench", "weights bench", "B1", "weights", (560, 648), (528, 636, 174, 54), "ˈweɪts bentʃ", "noun",
  "A narrow bench for doing exercises with weights.", "He's sitting on the weights bench.")
P("dumbbell", "dumbbell", "A2", "weights", (638, 560), (618, 548, 42, 24), "ˈdʌmbel", "noun",
  "A short bar with a weight at each end.", "He's lifting a dumbbell with his right arm.")
P("rack", "weights rack", "B1", "weights", (860, 560), (738, 494, 234, 196), "ˈweɪts ræk", "noun",
  "A stand that holds weights.", "Put the weights back on the rack.")
P("kettlebells", "kettlebells", "B1", "weights", (812, 672), (754, 640, 130, 50), "ˈketlbelz", "noun",
  "Heavy iron balls with a handle.", "Swing the kettlebell between your legs.")
P("bottle", "water bottle", "A1", "weights", (656, 630), (646, 614, 20, 28), "ˈwɔːtə ˌbɒtl", "noun",
  "A bottle for carrying water.", "Always bring a water bottle to the gym.")
P("towel", "towel", "A1", "weights", (690, 634), (678, 622, 24, 20), "ˈtaʊəl", "noun",
  "A piece of cloth for drying yourself.", "He wiped his face with a towel.")
P("lifter", "man", "A1", "people", (600, 580), (566, 500, 80, 190), "mæn", "noun",
  "An adult male person.", "The man is doing arm exercises.")

P("mat", "yoga mat", "A2", "stretch", (1010, 728), (986, 714, 210, 26), "ˈjəʊɡə mæt", "noun",
  "A thin soft mat for exercises on the floor.", "Roll out your yoga mat.")
P("band", "resistance band", "B1", "stretch", (1118, 716), (1090, 704, 54, 22), "rɪˈzɪstəns bænd", "noun",
  "A stretchy band for exercise.", "She's using a resistance band to stretch.")
P("ball", "exercise ball", "A2", "stretch", (1350, 664), (1322, 636, 56, 56), "ˈeksəsaɪz bɔːl", "noun",
  "A big soft ball for exercises.", "Sit on the exercise ball to work your back.", "gym ball")
P("woman", "woman", "A1", "people", (1040, 680), (1010, 620, 90, 110), "ˈwʊmən", "noun",
  "An adult female person.", "The woman is stretching on the mat.")
P("trainer", "personal trainer", "B1", "people", (980, 660), (940, 556, 90, 194), "ˌpɜːsənl ˈtreɪnə", "noun",
  "A person whose job is to help you exercise.", "My personal trainer plans all my workouts.")
P("clipboard", "clipboard", "B1", "people", (1013, 622), (998, 604, 30, 38), "ˈklɪpbɔːd", "noun",
  "A board with a clip that holds papers.", "The trainer writes notes on her clipboard.")
P("stopwatch", "stopwatch", "B1", "people", (960, 652), (950, 634, 20, 26), "ˈstɒpwɒtʃ", "noun",
  "A watch for timing exactly how long something takes.", "She's timing the runner with a stopwatch.")

S.meta.update(
    view=[0, 110, 1400, 690],
    roomsTitle="Places",
    title="The Gym",
    kicker="Picture Studio · Health & Sport",
    dek="A busy gym: a treadmill, weights, a yoga mat, an exercise bike and a personal trainer.",
    frames=["I usually … for … minutes.", "You should … before you …", "He's been …ing for an hour.",
            "How often do you …?", "It's good for your …", "Don't forget to …!"],
)
TF = [
    ("There is a gym bag on the lockers.", True, "A1"),
    ("The runner is on the treadmill.", True, "A1"),
    ("The punchbag is blue.", False, "A1"),
    ("The man has got a dumbbell.", True, "A1"),
    ("The woman on the mat is lying down.", False, "A2"),
    ("There is a water bottle on the weights bench.", True, "A2"),
    ("The exercise bike is next to the lockers.", False, "A2"),
    ("The trainer is holding a clipboard.", True, "A2"),
    ("The timer shows 12:34.", True, "B1"),
    ("The kettlebells are on the weights rack.", False, "B1"),
    ("The runner is wearing a headband.", True, "B1"),
    ("The woman is stretching with a resistance band.", True, "B1"),
]
PROMPTS = {
    "A1": ["What can you see in the gym? Write six things.",
           "What are the people doing?",
           "Do you like sport? Which sport?"],
    "A2": ["Plan a workout for a friend: warm-up, exercises, cool-down.",
           "How often do you exercise? Write about your week.",
           "Write gym rules: what you must and mustn't do."],
    "B1": ["Is it better to exercise at the gym or outside? Give your opinion.",
           "Write a message to a personal trainer about your goals.",
           "How can people stay healthy when they are very busy?"],
}
finish(S, TF, PROMPTS)
