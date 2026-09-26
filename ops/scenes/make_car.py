"""Picture Studio · The Car — a hatchback drawn in x-ray side view with its
bonnet open, between a petrol station and the traffic lights. Writes
data/scenes/car.json and a preview SVG in ops/scenes/out/.

    python3 ops/scenes/make_car.py
"""
import math
import os
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob

ROOT = os.path.dirname(os.path.abspath(__file__))
S = Scene("car", 1400, 800)
G = 760
RW, FW, WR = (470, 702), (910, 702), 58      # wheel centres, tyre radius


def tilted_ellipse(cx, cy, rx, ry, deg, n=36):
    a = math.radians(deg)
    ps = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x, y = rx * math.cos(t), ry * math.sin(t)
        ps.append((cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)))
    return pts(ps, True)


# ── sky, road, pavement ───────────────────────────────────────────────────
S.at(0)
S.fill(rect(0, G, 1400, 40), "earth")
S.M(line(0, G, 1400, G), step=0)
for x in range(20, 1400, 70):
    S.H(line(x, 781, x + 34, 781) + line(x, 783, x + 34, 783))
S.H(wave(520, 330, 620, 330, 3, 5) + wave(540, 318, 600, 318, 2, 4))
S.H(wave(930, 300, 1010, 300, 3, 4) + wave(944, 289, 990, 289, 2, 3))
S.M(pts([(1090, G), (1090, 748), (1400, 748), (1400, G)], True), "tint")
S.D(line(1090, 748, 1098, 748) + line(1098, 748, 1098, G))
for x in range(1130, 1400, 46):
    S.H(line(x, 748, x, G))

# ── petrol station ────────────────────────────────────────────────────────
S.at(200)
S.M(rect(10, 396, 300, 26, 2), "wood", step=60)                      # canopy
S.D(rect(10, 422, 300, 8), "lime")
S.M(rect(40, 430, 12, G - 430), "paper")
S.M(rect(268, 430, 12, G - 430), "paper")
S.D(rect(96, 746, 100, 14, 2), "tint")                               # island
S.M(rect(110, 560, 72, 186, 8), "paper")                             # pump
S.D(rect(122, 578, 48, 34, 3), "glass")
S.H(line(128, 588, 150, 588) + line(128, 596, 162, 596) + line(128, 604, 146, 604))
S.D(rect(122, 624, 48, 40, 3))
for i in range(3):
    S.D(rect(128 + i * 14, 632, 10, 24, 2), "wood")
S.D(rect(122, 676, 48, 6, 2), "ink")
S.D(rect(182, 632, 10, 30, 2), "tint")                               # holster
S.D("M182 600Q236 610 226 690Q220 736 196 712Q186 696 188 664")     # hose
S.M(pts([(184, 640), (204, 636), (212, 652), (204, 656), (196, 648), (188, 652)], True), "lime")

# ── the car: body ─────────────────────────────────────────────────────────
S.at(900)
arch_r = 68
dx = math.sqrt(arch_r ** 2 - 14 ** 2)
body = (f"M346 688L338 640L342 596L360 570L392 562L460 448Q600 426 760 446L866 560L1030 584"
        f"L1056 600L1062 640L1058 688L{FW[0] + dx:.1f} 688A68 68 0 0 0 {FW[0] - dx:.1f} 688"
        f"L{RW[0] + dx:.1f} 688A68 68 0 0 0 {RW[0] - dx:.1f} 688Z")
S.M(body, "paper", step=160)
# glass: rear quarter, rear door, front door, windscreen
S.D(pts([(400, 556), (466, 458), (500, 454), (500, 556)], True), "glass")
S.D(pts([(512, 453), (632, 446), (632, 556), (512, 556)], True), "glass")
S.D(pts([(648, 446), (752, 452), (850, 556), (648, 556)], True), "glass")
S.D(line(762, 450, 862, 556))
S.H(line(540, 470, 520, 500) + line(700, 466, 680, 492) + line(720, 470, 704, 490))
S.D(line(380, 562, 866, 562))                                        # waistline

# ── interior (seen through the body) ──────────────────────────────────────
S.at(1500)
S.H(line(404, 672, 860, 672))
S.M(rect(352, 594, 72, 46, 6), "tint")                               # suitcase in the boot
S.D("M376 594V586H400V594" + line(352, 610, 424, 610))
S.M(pts([(434, 614), (454, 506), (482, 508), (466, 614)], True), "tint")   # back seat
S.M(rect(432, 610, 110, 28, 7), "tint")
S.D(rect(446, 482, 30, 22, 7), "tint")
S.D(line(460, 504, 460, 510))
S.M(pts([(608, 608), (630, 500), (658, 502), (640, 608)], True), "tint")   # front seat
S.M(rect(604, 604, 98, 28, 7), "tint")
S.D(rect(622, 474, 32, 24, 8), "tint")                               # headrest
S.D(line(638, 498, 638, 504))
S.D(pts([(650, 512), (655, 510), (694, 624), (689, 626)], True), "lime")   # seat belt
S.D(rect(686, 622, 12, 8, 2), "ink")
S.D(pts([(700, 664), (692, 644), (686, 644), (682, 638), (690, 634), (700, 644), (708, 664)], True), "ink")  # handbrake
S.D(line(724, 664, 716, 626) + rect(716, 656, 16, 10, 3))           # gear stick
S.D(circle(715, 622, 6), "lime")
S.M(pts([(742, 562), (848, 558), (862, 574), (860, 602), (772, 606), (752, 592)], True), "wood")  # dashboard
S.D(rect(812, 580, 36, 16, 3), "tint")                               # glovebox
S.D(line(824, 584, 836, 584))
S.D(line(770, 584, 734, 552))                                        # steering column
S.M(tilted_ellipse(726, 530, 5, 34, -22), "paper")                   # steering wheel
S.D(circle(726, 530, 5), "ink")
for x in (812, 832):                                                 # pedals
    S.D(line(x - 6, 604, x + 2, 652) + rect(x - 4, 652, 14, 6, 2), None)
S.D(line(776, 452, 776, 460) + rect(764, 460, 26, 9, 3), "ink")      # rear-view mirror

# ── outside details ───────────────────────────────────────────────────────
S.at(2400)
S.H(line(640, 446, 640, 688) + line(800, 562, 796, 686))             # door seams
S.H("M536 562V626Q536 640 540 648" + line(508, 446, 506, 562))
S.D(rect(700, 576, 26, 7, 3), "ink")                                 # door handles
S.D(rect(560, 576, 26, 7, 3), "ink")
S.M(pts([(788, 556), (806, 540), (826, 542), (824, 558), (800, 562)], True), "paper")  # wing mirror
S.D(line(846, 556, 820, 526) + line(820, 526, 824, 524))             # wiper
S.D(pts([(1024, 586), (1052, 596), (1056, 612), (1026, 610)], True), "glass")   # headlight
S.H(line(1032, 594, 1048, 604))
S.D(rect(1052, 618, 8, 10, 2), "lime")                               # indicator
S.D(pts([(340, 598), (358, 598), (358, 630), (339, 630)], True), "wood")         # rear light
S.H(line(340, 606, 358, 606) + line(340, 614, 358, 614) + line(340, 622, 358, 622))
S.M(pts([(1040, 640), (1063, 640), (1060, 688), (1036, 688)], True), "tint")     # bumpers
S.M(pts([(336, 640), (356, 640), (356, 688), (346, 688)], True), "tint")
S.D(circle(402, 600, 9), "paper")                                    # petrol cap
S.D(circle(402, 600, 4))
S.M(rect(316, 688, 40, 8, 3), "paper")                               # exhaust pipe
S.H(wave(312, 692, 272, 676, 3, 4) + wave(300, 700, 262, 700, 3, 3))

# bonnet, opened
S.at(2900)
S.M(pts([(866, 560), (1008, 458), (1016, 466), (872, 568)], True), "paper", step=60)
S.D(line(996, 590, 986, 474))                                        # prop rod
# engine bay
S.M(rect(1016, 596, 14, 76, 2), "paper")                             # radiator
for y in range(602, 670, 6):
    S.H(line(1018, y, 1028, y))
S.M(rect(900, 600, 96, 68, 5), "wood")                               # engine
for x in range(912, 992, 12):
    S.H(line(x, 612, x, 656))
S.D(rect(906, 592, 82, 10, 3), "tint")
S.D(circle(924, 590, 5), "lime")                                     # oil cap
S.M(rect(866, 608, 28, 28, 3), "paper")                              # battery
S.D(rect(870, 603, 6, 5) + rect(884, 603, 6, 5), "ink")
S.H(line(872, 618, 888, 618))

# wheels
S.at(3300)
for (cx, cy) in (RW, FW):
    S.M(circle(cx, cy, WR), "ink", step=60)
    S.M(circle(cx, cy, 36), "paper")
    S.D(circle(cx, cy, 8), "tint")
    for k in range(5):
        a = math.radians(-90 + 72 * k)
        S.D(line(cx + 10 * math.cos(a), cy + 10 * math.sin(a), cx + 32 * math.cos(a), cy + 32 * math.sin(a)))

# ── traffic lights, street light, road sign ───────────────────────────────
S.at(3800)
S.M(rect(1156, 470, 8, 278), "paper")
S.M(rect(1138, 376, 44, 96, 8), "ink", step=60)
S.D(circle(1160, 398, 11), "paper")
S.D(circle(1160, 424, 11), "paper")
S.D(circle(1160, 450, 11), "lime")
S.H(circle(1160, 450, 17))
S.M(rect(1272, 316, 8, 432), "paper")                                # street light
S.M("M1276 322Q1276 300 1250 300L1226 300", None)
S.M(pts([(1206, 298), (1240, 298), (1236, 310), (1210, 310)], True), "wood")
S.D(ellipse(1223, 312, 12, 3), "lime")
S.H(line(1212, 318, 1204, 336) + line(1223, 318, 1223, 340) + line(1234, 318, 1242, 336))
S.M(rect(1348, 560, 6, 188), "paper")                                # road sign
S.M(circle(1351, 530, 30), "paper")
S.D(circle(1351, 530, 24))
S.D("M1336 519Q1340 513 1345 514Q1350 516 1349 522Q1348 528 1342 529Q1350 530 1350 537Q1349 545 1342 546Q1337 546 1335 541")  # 3
S.D(ellipse(1360, 530, 6, 12))                                                          # 0

# ── rooms (word areas) and zones (zoom only) ──────────────────────────────
S.room("station", "petrol station", (0, 390, 318, G - 390), (18, 380), level="A2", ipa="ˈpetrəl ˌsteɪʃn", pos="noun",
       def_="A place where you buy fuel for your car.", ex="We need to stop at the next petrol station.", us="gas station")
S.room("road", "road", (0, G, 1400, 40), (600, 790), level="A1", ipa="rəʊd", pos="noun",
       def_="A hard way for cars and other vehicles to drive on.", ex="Look both ways before you cross the road.")
S.meta["zones"] = [
    dict(id="car", chip="The car", box=[300, 420, 780, 350]),
    dict(id="inside", chip="Inside the car", box=[340, 440, 530, 240]),
    dict(id="engine", chip="Under the bonnet", box=[850, 450, 220, 250]),
    dict(id="street", chip="The street", box=[1086, 280, 314, 490]),
]
S.meta["groups"] = {"outside": "Outside the car", "inside": "Inside the car", "engine": "Under the bonnet",
                    "street": "The street", "station": "Petrol station"}


def P(pid, word, level, room, pin, box, ipa, pos, d, ex, us=None):
    card = dict(level=level, room=room, ipa=ipa, pos=pos, def_=d, ex=ex)
    if us:
        card["us"] = us
    S.part(pid, word, pin, box, **card)


# outside the car
P("car", "car", "A1", "outside", (600, 438), (336, 426, 728, 276), "kɑː", "noun",
  "A road vehicle with an engine and four wheels, for a few people.", "My mum drives her car to work.")
P("door", "door", "A1", "outside", (740, 640), (640, 560, 160, 128), "dɔː", "noun",
  "The part of a car that opens so you can get in and out.", "Close the car door, please.")
P("window", "window", "A1", "outside", (700, 500), (648, 446, 204, 110), "ˈwɪndəʊ", "noun",
  "The glass in the door that you can open and close.", "Can you open the window a little?")
P("wheel", "wheel", "A1", "outside", (910, 702), (852, 644, 116, 116), "wiːl", "noun",
  "One of the round things under a car that turn when it moves.", "A car has four wheels.")
P("tyre", "tyre", "A2", "outside", (470, 654), (412, 644, 116, 116), "ˈtaɪə", "noun",
  "The thick rubber ring around a wheel.", "We had a flat tyre on the way home.", "tire")
P("headlights", "headlights", "A2", "outside", (1040, 601), (1022, 584, 38, 30), "ˈhedlaɪts", "noun",
  "The big lights at the front of a car.", "Turn on your headlights - it's getting dark.")
P("indicator", "indicator", "B1", "outside", (1056, 623), (1048, 614, 16, 18), "ˈɪndɪkeɪtə", "noun",
  "A small flashing light that shows which way a car is going to turn.", "He turned left without using his indicator.", "turn signal")
P("bumper", "bumper", "A2", "outside", (1050, 666), (1034, 638, 32, 52), "ˈbʌmpə", "noun",
  "A bar at the front and back of a car that protects it in a small crash.", "Someone drove into our back bumper.", "fender")
P("bonnet", "bonnet", "A2", "outside", (944, 512), (862, 454, 158, 116), "ˈbɒnɪt", "noun",
  "The cover over the engine at the front of a car.", "Open the bonnet and check the oil.", "hood")
P("boot", "boot", "A2", "outside", (388, 574), (336, 562, 92, 126), "buːt", "noun",
  "The space at the back of a car for bags and suitcases.", "Put the shopping in the boot.", "trunk")
P("windscreen", "windscreen", "B1", "outside", (806, 498), (756, 444, 110, 116), "ˈwɪndskriːn", "noun",
  "The big window at the front of a car.", "A stone hit the windscreen and cracked it.", "windshield")
P("wipers", "windscreen wipers", "B1", "outside", (836, 540), (816, 520, 34, 40), "ˈwɪndskriːn ˌwaɪpəz", "noun",
  "Thin arms that move across the windscreen to clean off rain.", "It's raining - switch on the wipers.", "windshield wipers")
P("wingmirror", "wing mirror", "B1", "outside", (806, 552), (784, 536, 44, 28), "ˈwɪŋ ˌmɪrə", "noun",
  "A mirror on the side of a car, for seeing the cars behind you.", "Check your wing mirror before you change lanes.", "side mirror")
P("doorhandle", "door handle", "A2", "outside", (713, 580), (696, 572, 34, 16), "ˈdɔː ˌhændl", "noun",
  "The part you pull to open a door.", "The door handle is broken - open it from the inside.")
P("rearlight", "rear light", "B1", "outside", (348, 614), (336, 594, 26, 40), "ˈrɪə laɪt", "noun",
  "A red light at the back of a car.", "One of your rear lights isn't working.", "taillight")
P("exhaust", "exhaust pipe", "B1", "outside", (330, 692), (312, 684, 48, 16), "ɪɡˈzɔːst paɪp", "noun",
  "The pipe at the back of a car where the smoke from the engine comes out.", "Smoke was coming out of the exhaust pipe.", "tailpipe")
P("petrolcap", "petrol cap", "B1", "outside", (402, 600), (390, 588, 24, 24), "ˈpetrəl kæp", "noun",
  "The small lid on the side of a car where you put in the fuel.", "Don't forget to close the petrol cap.", "gas cap")

# inside
P("seat", "seat", "A1", "inside", (636, 560), (602, 498, 102, 136), "siːt", "noun",
  "A thing you sit on. The driver sits in the front seat.", "Can I sit in the front seat?")
P("backseat", "back seat", "A2", "inside", (488, 626), (430, 480, 114, 160), "ˌbæk ˈsiːt", "noun",
  "The seat behind the driver.", "The children are asleep on the back seat.")
P("headrest", "headrest", "B1", "inside", (638, 486), (620, 472, 36, 28), "ˈhedrest", "noun",
  "The soft part at the top of a seat that supports your head.", "Adjust the headrest so it's level with your head.")
P("seatbelt", "seat belt", "A2", "inside", (674, 574), (646, 508, 54, 124), "ˈsiːt belt", "noun",
  "A belt that holds you in your seat if the car stops suddenly.", "Put your seat belt on, please.")
P("steeringwheel", "steering wheel", "A2", "inside", (732, 510), (706, 492, 40, 76), "ˈstɪərɪŋ wiːl", "noun",
  "The wheel that the driver turns to make the car go left or right.", "Keep both hands on the steering wheel.")
P("dashboard", "dashboard", "B1", "inside", (786, 590), (740, 556, 124, 52), "ˈdæʃbɔːd", "noun",
  "The part in front of the driver with the speed, the fuel and other information.", "A red light came on on the dashboard.")
P("glovebox", "glove box", "B1", "inside", (840, 588), (810, 578, 40, 20), "ˈɡlʌv bɒks", "noun",
  "A small cupboard in front of the passenger seat.", "The map is in the glove box.", "glove compartment")
P("gearstick", "gear stick", "B1", "inside", (716, 622), (706, 612, 28, 56), "ˈɡɪə stɪk", "noun",
  "The stick you move to change gear.", "Put the gear stick into first gear.", "gearshift")
P("handbrake", "handbrake", "B1", "inside", (688, 644), (678, 632, 32, 34), "ˈhændbreɪk", "noun",
  "A brake you pull with your hand to stop a parked car from moving.", "Always put the handbrake on when you park on a hill.", "parking brake")
P("pedals", "pedals", "B1", "inside", (822, 650), (800, 600, 46, 62), "ˈpedlz", "noun",
  "The parts you press with your feet to make a car go faster or stop.", "Press the brake pedal gently.")
P("rearviewmirror", "rear-view mirror", "B1", "inside", (777, 464), (760, 450, 34, 22), "ˌrɪə vjuː ˈmɪrə", "noun",
  "The mirror inside the car at the top of the windscreen.", "I saw a police car in the rear-view mirror.")

# under the bonnet
P("engine", "engine", "A2", "engine", (948, 636), (898, 588, 100, 82), "ˈendʒɪn", "noun",
  "The machine that makes a car move.", "The engine won't start - it's too cold.")
P("battery", "battery", "B1", "engine", (880, 622), (862, 600, 36, 38), "ˈbætri", "noun",
  "A box that stores electricity to start the car.", "I left the lights on all night and now the battery is flat.")
P("radiator", "radiator", "B1", "engine", (1023, 646), (1012, 594, 22, 80), "ˈreɪdieɪtə", "noun",
  "The part at the front that keeps the engine cool with water.", "The radiator needs more water.")

# the street and the petrol station
P("pump", "petrol pump", "B1", "station", (146, 640), (106, 556, 110, 204), "ˈpetrəl pʌmp", "noun",
  "The machine at a petrol station that puts fuel into your car.", "Pump number 3 is free.", "gas pump")
P("trafficlights", "traffic lights", "A2", "street", (1160, 424), (1134, 372, 52, 376), "ˈtræfɪk laɪts", "noun",
  "Red, yellow and green lights that tell cars when to stop and go.", "Turn left at the traffic lights.")
P("streetlight", "street light", "B1", "street", (1250, 318), (1200, 292, 84, 456), "ˈstriːt laɪt", "noun",
  "A tall lamp at the side of a road.", "The street lights come on when it gets dark.", "streetlight")
P("roadsign", "road sign", "A2", "street", (1351, 530), (1318, 498, 66, 250), "ˈrəʊd saɪn", "noun",
  "A sign by the road with information for drivers. This one says the speed limit is 30.", "The road sign says you can't go faster than 30.")
P("pavement", "pavement", "B1", "street", (1226, 754), (1096, 746, 304, 14), "ˈpeɪvmənt", "noun",
  "The path at the side of a road for people to walk on.", "Children must walk on the pavement, not on the road.", "sidewalk")
P("kerb", "kerb", "B1", "street", (1093, 753), (1084, 744, 18, 18), "kɜːb", "noun",
  "The edge between the pavement and the road.", "Stop at the kerb and look both ways.", "curb")


S.meta.update(
    view=[0, 250, 1400, 550],
    roomsTitle="Places",
    title="The Car",
    kicker="Picture Studio · Transport",
    dek="A car seen right through, bonnet up, between the petrol station and the traffic lights.",
    frames=["It has got …", "The … is at the front / back of the car.", "The … is inside / under the …",
            "You use the … to …", "Before you drive, you must …", "Don't forget to …"],
)
TF = [
    ("The car is on the road.", True, "A1"),
    ("There is a seat in the car.", True, "A1"),
    ("The wheels are on the roof.", False, "A1"),
    ("You can see two wheels.", True, "A1"),
    ("The traffic light is green.", True, "A1"),
    ("The bonnet is open.", True, "A2"),
    ("There is a suitcase in the boot.", True, "A2"),
    ("The engine is at the back of the car.", False, "A2"),
    ("The steering wheel is in front of the driver's seat.", True, "A2"),
    ("The petrol station is on the right.", False, "A2"),
    ("The seat belt is on the back seat.", False, "A2"),
    ("The exhaust pipe is at the front of the car.", False, "B1"),
    ("The indicator is next to the headlight.", True, "B1"),
    ("The rear-view mirror is at the top of the windscreen.", True, "B1"),
    ("The battery is under the bonnet.", True, "B1"),
    ("The street light is between the traffic lights and the road sign.", True, "B1"),
    ("The pavement is lower than the road.", False, "B1"),
    ("The wing mirror is on the boot.", False, "B1"),
]
PROMPTS = {
    "A1": ["Describe the car in the picture. Use: It has got…",
           "Has your family got a car? What is in it?",
           "How do you go to school? By car, by bus or on foot?"],
    "A2": ["You are at the petrol station. Write a short dialogue with the cashier.",
           "Explain to a friend how to start a car, step by step. Use first, then, after that.",
           "Do you want to learn to drive? Why or why not?"],
    "B1": ["Something is wrong with the car (a flat tyre, a flat battery…). Call a garage and explain the problem.",
           "Should cars be banned from city centres? Give your reasons.",
           "Describe the rules of the road in your country. Use must, mustn't and have to."],
}

for coll in (S.rooms, S.parts):
    for c in coll:
        c["def"] = c.pop("def_")

os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
out = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "scenes"))
S.save(os.path.join(out, "car.json"), truefalse=[dict(s=s, a=a, level=l) for s, a, l in TF], prompts=PROMPTS)
S.svg(os.path.join(ROOT, "out", "car.svg"))
lv = {}
for p in S.parts + S.rooms:
    lv[p["level"]] = lv.get(p["level"], 0) + 1
print(f"car: {len(S.items)} items, {len(S.parts)} parts + {len(S.rooms)} rooms, levels {lv}, "
      f"{os.path.getsize(os.path.join(out, 'car.json')) // 1024} KB")
