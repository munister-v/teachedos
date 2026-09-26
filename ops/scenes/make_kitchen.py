"""Picture Studio · The Kitchen — one kitchen, close up: the fridge, the
cooker and the sink along the wall, utensils on a rail, and the table laid
for breakfast. Writes data/scenes/kitchen.json.

    python3 ops/scenes/make_kitchen.py
"""
import os
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob

ROOT = os.path.dirname(os.path.abspath(__file__))
S = Scene("kitchen", 1400, 800)
G = 740          # floor line
WT = 552         # worktop surface
CEIL = 100

# ── the room ──────────────────────────────────────────────────────────────
S.at(0)
S.fill(rect(0, 0, 1400, CEIL), "paper")
S.wallpaper((0, CEIL, 820, G - CEIL), "sand", None)
S.wallpaper((820, CEIL, 580, G - CEIL), "sage", "stripes", dado=150)
S.wallpaper((164, 440, 612, WT - 440), "sky", None)                  # splashback
S.soft("".join(line(164, y, 776, y) for y in range(452, WT, 14))
       + "".join(line(x + (7 if ((y - 440) // 14) % 2 else 0), y, x + (7 if ((y - 440) // 14) % 2 else 0), y + 14)
                 for y in range(440, WT - 4, 14) for x in range(178, 770, 14)))
S.M(line(0, CEIL, 1400, CEIL), step=0)
S.D(rect(0, CEIL, 1400, 6), "tint")
S.fill(rect(0, G, 1400, 60), "tint")                                  # floor tiles
for i, y in enumerate((748, 760, 776, 798)):
    S.soft(line(0, y, 1400, y))
S.soft("".join(line(x, G, x - 40, 800) for x in range(40, 1460, 60)))
S.M(line(0, G, 1400, G), step=0)
S.H(line(0, G - 8, 1400, G - 8))

# ── fridge-freezer ────────────────────────────────────────────────────────
S.at(150)
S.shadow(95, G, 70, 4)
S.M(rect(30, 230, 130, 510, 10), "paper", step=80)
S.D(line(30, 520, 160, 520) + line(30, 632, 160, 632))
S.D(rect(146, 360, 5, 110, 2.5), "steel")
S.D(rect(60, 538, 70, 5, 2.5) + rect(60, 650, 70, 5, 2.5), "steel")
S.D(circle(64, 262, 7), "red")
S.D(circle(140, 282, 6), "lime")
S.D(rect(48, 290, 46, 54, 2), "paper")                               # a child's drawing
S.H("M54 336Q62 312 70 330Q78 300 88 334" + circle(80, 304, 5))
S.D(rect(64, 286, 14, 6, 1), "lime")

# ── wall cupboards, window, hood, shelves ─────────────────────────────────
S.at(500)
S.M(rect(170, 240, 152, 160, 3), "sand2", step=60)                   # cupboard body
S.fill(rect(174, 244, 70, 152), "paper")                              # inside, left half
S.D(rect(174, 296, 70, 4) + rect(174, 348, 70, 4), "wood")            # shelves
for x in (182, 204, 226):                                            # cups
    S.D(f"M{x} 276H{x + 14}L{x + 12} 296H{x + 2}Z", "sky2")
    S.D(f"M{x + 14} 280Q{x + 20} 282 {x + 13} 290")
for i in range(5):                                                   # plates
    S.D(ellipse(208, 344 - i * 4, 26, 3), "paper")
S.D(rect(182, 360, 16, 36, 2) + rect(204, 364, 16, 32, 2) + rect(226, 360, 14, 36, 2), "glass")  # glasses
S.M(pts([(170, 240), (146, 250), (146, 390), (170, 400)], True), "sand2")   # open door
S.D(circle(152, 320, 2.5), "ink")
S.M(rect(244, 244, 74, 152, 2), "sand2")                             # closed door
S.D(rect(252, 252, 58, 136, 2))
S.D(circle(254, 360, 2.5), "ink")
S.M(rect(340, 240, 130, 200), "glass")                               # window
S.D(line(405, 240, 405, 440) + line(340, 340, 470, 340))
S.H(line(354, 356, 380, 382) + line(418, 356, 446, 384))
S.D(rect(340, 240, 130, 60), "lav2")                                 # blind
S.D(rect(338, 296, 134, 6, 2), "lav2")
S.D(line(462, 302, 462, 336) + circle(462, 339, 3))
S.D(rect(334, 440, 142, 7, 1), "paper")                              # sill + flowers
S.D(pts([(442, 440), (462, 440), (459, 416), (445, 416)], True), "glass")
for fx, fy in ((444, 398), (452, 392), (460, 400)):
    S.D(line(452, 418, fx, fy + 4))
    S.D(circle(fx, fy, 4.5), "red" if fx == 452 else "lime")
S.M(rect(516, CEIL, 40, 280), "steel", step=40)                      # hood duct
S.M(pts([(478, 380), (594, 380), (612, 412), (460, 412)], True), "steel")
S.D(rect(470, 408, 132, 4) + ellipse(496, 396, 4, 2) + ellipse(516, 396, 4, 2), "ink")
for y in (300, 380):                                                 # shelves
    S.M(rect(626, y, 148, 7, 1), "wood")
    S.D(line(640, y + 7, 648, y + 20) + line(760, y + 7, 752, y + 20))
S.D(rect(632, 250, 14, 50, 1) + rect(648, 244, 12, 56, 1), "red")    # cookbooks
S.D(rect(662, 256, 16, 44, 1), "sky2")
S.D(rect(680, 262, 12, 38, 1), "lime")
S.M("M712 300Q706 272 732 268Q758 272 752 300Z", "blush2")           # teapot
S.D("M752 282Q766 278 768 266M712 280Q700 286 710 296" + rect(726, 260, 12, 8, 3))
for i, x in enumerate(range(634, 770, 22)):                          # spice jars
    S.D(rect(x, 350, 16, 30, 3), "glass")
    S.D(rect(x - 1, 346, 18, 6, 2), ("red", "lime", "wood", "sky2", "lav2", "red", "lime")[i % 7])
    S.D(rect(x + 2, 364, 12, 16, 1), ("wood", "red", "sand2", "sage2", "brick", "wood", "sand2")[i % 7])

# ── utensil rail ──────────────────────────────────────────────────────────
S.at(1100)
S.D(rect(638, 456, 136, 4, 2), "steel")
S.D(line(656, 460, 656, 500) + ellipse(656, 506, 10, 7), "steel")                # ladle
S.D(f"M690 460V476" + "".join(f"M690 476Q{690 + dx} 496 690 516" for dx in (-12, -6, 0, 6, 12)), None)  # whisk
S.D(line(722, 460, 722, 500) + ellipse(722, 506, 6, 10), "wood")                  # wooden spoon
S.D(line(752, 460, 752, 470) + circle(752, 486, 14), "paper")                     # sieve
S.soft("".join(line(740 + i * 4, 474, 740 + i * 4, 498) for i in range(7)))

# ── worktop and base units ────────────────────────────────────────────────
S.at(1400)
S.shadow(470, G, 320, 4)
S.M(rect(170, 564, 600, 166), "paper", step=80)
S.D(rect(170, 730, 600, 10), "tint")
for y in (604, 648, 692):                                            # drawers
    S.D(line(170, y, 250, y))
for y in (584, 626, 670, 712):
    S.D(rect(196, y, 28, 4, 2), "steel")
S.D(line(250, 564, 250, 730) + line(350, 564, 350, 730) + line(470, 564, 470, 730) + line(600, 564, 600, 730) + line(685, 564, 685, 730))
S.D(rect(254, 568, 92, 12, 2), "steel")                              # dishwasher
S.D(circle(334, 574, 2.5), "lime")
S.D(rect(270, 590, 60, 5, 2.5), "steel")
S.D(circle(400, 584, 2.5) + circle(420, 584, 2.5), "ink")            # sink cupboard
S.D(line(410, 564, 410, 730))
S.M(rect(474, 580, 122, 140, 4), "steel")                            # oven
S.D(rect(488, 618, 94, 70, 4), "ink")
S.D(rect(494, 624, 82, 58, 3), "glass")
S.D(rect(484, 596, 102, 6, 3), "paper")                              # oven rail
for x in (492, 512, 532, 552, 572):
    S.D(circle(x, 572, 3.5), "ink")
S.M(pts([(518, 598), (548, 598), (550, 636), (516, 636)], True), "lime")   # tea towel
S.H(line(517, 622, 549, 622) + line(517, 626, 549, 626))
S.D(circle(644, 646, 2.5) + circle(726, 646, 2.5), "ink")            # cupboards
S.M(rect(164, WT, 612, 12, 2), "wood", step=60)                      # worktop
S.D(pts([(352, WT), (458, WT), (452, WT + 8), (358, WT + 8)], True), "steel")  # sink
S.D("M398 552V510Q398 496 412 496Q426 496 426 510V518" + rect(390, 546, 16, 6, 2), "steel")  # tap
S.D(ellipse(500, WT - 1, 16, 2) + ellipse(538, WT - 1, 16, 2) + ellipse(576, WT - 1, 16, 2), "ink")  # hob rings

# on the worktop
S.at(1900)
S.M(rect(178, 498, 76, 54, 5), "paper")                              # microwave
S.D(rect(186, 506, 44, 38, 3), "ink")
S.D(rect(236, 506, 12, 38, 2), "tint")
S.H(line(238, 512, 246, 512) + line(238, 518, 246, 518) + line(238, 524, 246, 524))
S.M(rect(258, 520, 44, 32, 8), "red")                                # toaster
S.D(rect(266, 516, 10, 6, 1) + rect(284, 516, 10, 6, 1), "sand2")
S.D(rect(298, 530, 6, 8, 2), "ink")
S.M("M308 552L306 522Q322 510 338 522L336 552Z", "paper")            # kettle
S.D("M338 526Q350 526 346 546M308 526L300 516" + rect(316, 510, 12, 4, 2))
S.M(rect(484, 518, 36, 34, 3), "steel")                              # saucepan
S.D(rect(482, 512, 40, 6, 3), "steel")
S.D(rect(498, 506, 8, 6, 2), "ink")
S.D(line(484, 528, 458, 522))
S.H(wave(494, 504, 500, 486, 2, 3) + wave(508, 504, 514, 488, 2, 3))
S.M("M552 540H600Q598 552 590 552H562Q554 552 552 540Z", "ink")      # frying pan
S.D(rect(600, 541, 30, 4, 2), "ink")
S.D(pts([(642, 546), (716, 546), (716, 552), (642, 552)], True), "wood")  # chopping board
S.M("M650 546Q650 522 674 522Q700 522 700 546Z", "sand2")            # bread
S.H(line(664, 528, 660, 544) + line(676, 526, 672, 544) + line(688, 528, 684, 544))
S.D(pts([(702, 544), (734, 540), (736, 543), (704, 546)], True), "steel")  # bread knife

# bin
S.shadow(804, G, 26, 3)
S.M(pts([(784, 684), (824, 684), (820, G), (788, G)], True), "steel")
S.D(rect(782, 678, 44, 8, 3), "steel")
S.D(rect(790, 734, 14, 4, 2), "ink")

# ── the table ─────────────────────────────────────────────────────────────
S.at(2400)
S.D(line(1050, CEIL, 1050, 400))                                     # pendant lamp
S.M(pts([(1030, 400), (1070, 400), (1084, 430), (1016, 430)], True), "lime")
S.fill(pts([(1018, 432), (1082, 432), (1120, 540), (980, 540)], True), "sun")
S.shadow(1050, G, 180, 5)
for x0, back in ((842, 842), (1212, 1256)):                          # chairs
    S.D(rect(x0, 640, 50, 8, 2), "wood")
    S.M(rect(back - 2 if back == 842 else back - 6, 530, 8, 116, 3), "wood")
    S.D(line(x0 + 6, 648, x0 + 4, G) + line(x0 + 44, 648, x0 + 46, G))
S.D(line(912, 640, 908, G) + line(1188, 640, 1192, G) + line(1000, 640, 1000, G - 10))   # table legs
S.M(pts([(920, 572), (1180, 572), (1204, 606), (896, 606)], True), "wood", step=60)
S.M("M896 606H1204L1208 650Q1150 660 1110 648Q1050 660 990 648Q940 660 892 650Z", "sky2")   # tablecloth
S.soft("".join(line(x, 606, x + 2, 650) for x in range(910, 1200, 18)))
S.D(ellipse(955, 594, 26, 7) + ellipse(955, 594, 16, 4), "paper")   # plate
S.D(pts([(990, 586), (994, 586), (996, 602), (990, 602)], True), "steel")   # knife
S.D(line(920, 586, 918, 602) + line(916, 584, 916, 590) + line(920, 584, 920, 590) + line(924, 584, 924, 590))  # fork
S.M(rect(1000, 560, 16, 32, 2), "glass")                             # glass
S.H(line(1002, 572, 1014, 572))
S.M("M1022 594L1020 560Q1022 548 1036 546L1050 546Q1052 556 1046 562L1046 594Z", "glass")   # jug
S.D("M1046 566Q1060 570 1048 588")
S.M("M1056 584Q1058 598 1082 598Q1106 598 1108 584Z", "blush2")    # fruit bowl
S.M(circle(1070, 576, 9), "red")
S.M(circle(1086, 578, 8), "leaf")
S.D(line(1070, 567, 1072, 562))
S.M("M1082 570Q1096 552 1112 566Q1098 562 1086 574Z", "sun")       # banana
S.M(rect(1140, 566, 22, 26, 3), "lime")                              # mug
S.D("M1162 572Q1172 576 1162 586")
S.H(wave(1146, 562, 1150, 548, 2, 2))

# ── on the wall, right ────────────────────────────────────────────────────
S.at(2900)
S.M(circle(1330, 190, 34), "paper")                                  # clock
S.D(circle(1330, 190, 28))
for a in range(12):
    import math
    r = math.radians(a * 30)
    S.H(line(1330 + 24 * math.cos(r), 190 + 24 * math.sin(r), 1330 + 28 * math.cos(r), 190 + 28 * math.sin(r)))
S.D(line(1330, 190, 1330, 170) + line(1330, 190, 1344, 196))
S.D(circle(1330, 190, 2.5), "ink")
S.M(rect(1290, 250, 80, 100, 2), "paper")                            # calendar
S.D(rect(1290, 250, 80, 22, 2), "red")
S.soft("".join(line(1290, y, 1370, y) for y in range(284, 350, 13)) + "".join(line(x, 272, x, 350) for x in range(1302, 1370, 11)))
S.D(circle(1330, 314, 5))
S.D(circle(1328, 380, 3), "ink")                                     # apron on a hook
S.M("M1316 386Q1328 380 1340 386L1342 412Q1356 414 1356 424L1350 516H1306L1300 424Q1300 414 1314 412Z", "lime")
S.D(rect(1316, 452, 24, 18, 2), "paper")
S.D("M1316 412Q1296 430 1302 446M1342 412Q1362 430 1356 446")

# ── words ─────────────────────────────────────────────────────────────────
S.room("kitchen", "kitchen", (0, CEIL, 1400, G - CEIL), (20, 176), level="A1", ipa="ˈkɪtʃɪn", pos="noun",
       def_="The room where you cook and keep food.", ex="We have breakfast in the kitchen.")
S.meta["zones"] = [
    dict(id="cook", chip="The cooker", box=[450, 360, 200, 380]),
    dict(id="sinkz", chip="The sink", box=[160, 236, 330, 504]),
    dict(id="wall", chip="Shelves & rail", box=[620, 236, 170, 330]),
    dict(id="table", chip="The table", box=[830, 380, 440, 360]),
]
S.meta["groups"] = {"appliances": "Machines", "cupboards": "Cupboards & shelves", "cooking": "Cooking",
                    "table": "On the table", "room": "The room"}


def P(pid, word, level, room, pin, box, ipa, pos, d, ex, us=None):
    card = dict(level=level, room=room, ipa=ipa, pos=pos, def_=d, ex=ex)
    if us:
        card["us"] = us
    S.part(pid, word, pin, box, **card)


# machines
P("fridge", "fridge", "A1", "appliances", (100, 420), (30, 230, 130, 290), "frɪdʒ", "noun",
  "A tall cold cupboard that keeps food fresh.", "Put the milk back in the fridge.", "refrigerator")
P("freezer", "freezer", "A2", "appliances", (95, 590), (30, 520, 130, 220), "ˈfriːzə", "noun",
  "A very cold cupboard that keeps food frozen.", "There's ice cream in the freezer.")
P("magnet", "fridge magnet", "B1", "appliances", (64, 262), (54, 252, 20, 20), "ˈfrɪdʒ ˌmæɡnət", "noun",
  "A small magnet for sticking notes and pictures on the fridge.", "She stuck the photo on the fridge with a magnet.")
P("microwave", "microwave", "A2", "appliances", (208, 525), (176, 496, 80, 58), "ˈmaɪkrəweɪv", "noun",
  "A small oven that heats food very quickly.", "Heat the soup in the microwave for two minutes.")
P("toaster", "toaster", "A2", "appliances", (280, 538), (256, 512, 50, 42), "ˈtəʊstə", "noun",
  "A machine that makes bread brown and crisp.", "Put two slices of bread in the toaster.")
P("kettle", "kettle", "A2", "appliances", (322, 534), (298, 508, 52, 46), "ˈketl", "noun",
  "A pot for boiling water, with a spout and a handle.", "Put the kettle on - let's have tea.")
P("dishwasher", "dishwasher", "A2", "appliances", (300, 650), (250, 564, 100, 166), "ˈdɪʃwɒʃə", "noun",
  "A machine that washes plates, cups and pans.", "Can you empty the dishwasher, please?")
P("oven", "oven", "A2", "appliances", (560, 680), (472, 578, 126, 144), "ˈʌvn", "noun",
  "The hot box in a cooker for baking and roasting.", "The cake has been in the oven for 40 minutes.")
P("hob", "hob", "B1", "cooking", (538, 557), (476, 546, 118, 12), "hɒb", "noun",
  "The flat top of a cooker where you put pans.", "Don't touch the hob - it's still hot.", "stovetop")
P("cookerhood", "cooker hood", "B1", "cooking", (536, 396), (458, 100, 156, 314), "ˈkʊkə hʊd", "noun",
  "A metal hood over the cooker that takes away the smoke and smells.", "Turn on the cooker hood when you fry fish.", "range hood")

# cupboards and shelves
P("cupboard", "cupboard", "A2", "cupboards", (286, 320), (244, 240, 78, 160), "ˈkʌbəd", "noun",
  "A piece of furniture with a door and shelves inside.", "The glasses are in the cupboard on the left.", "cabinet")
P("cups", "cups", "A1", "cupboards", (210, 286), (178, 272, 66, 26), "kʌps", "noun",
  "Small bowls with a handle, for hot drinks.", "There are four cups on the top shelf.")
P("plates", "plates", "A1", "cupboards", (208, 332), (180, 324, 56, 24), "pleɪts", "noun",
  "Flat round dishes that you eat food from.", "Can you put the plates on the table?")
P("glasses", "glasses", "A1", "cupboards", (211, 380), (178, 358, 66, 40), "ˈɡlɑːsɪz", "noun",
  "Containers made of glass, for cold drinks.", "The clean glasses are in the cupboard.")
P("drawer", "drawer", "A2", "cupboards", (210, 626), (170, 604, 80, 44), "drɔː", "noun",
  "A box in a piece of furniture that slides in and out.", "The knives and forks are in the top drawer.")
P("shelf", "shelf", "A2", "cupboards", (700, 304), (624, 298, 152, 12), "ʃelf", "noun",
  "A flat board on a wall for putting things on.", "The cookbooks are on the top shelf.")
P("cookbooks", "cookbooks", "B1", "cupboards", (656, 272), (628, 240, 66, 60), "ˈkʊkbʊks", "noun",
  "Books with recipes in them.", "Grandma has hundreds of cookbooks.")
P("teapot", "teapot", "A2", "cupboards", (732, 286), (704, 256, 66, 44), "ˈtiːpɒt", "noun",
  "A pot with a spout for making and pouring tea.", "Warm the teapot before you make the tea.")
P("jars", "jars", "A2", "cupboards", (700, 366), (630, 342, 140, 40), "dʒɑːz", "noun",
  "Glass containers with lids, for spices, jam or honey.", "The spices are in the little jars.")
P("worktop", "worktop", "B1", "cupboards", (770, 558), (164, 550, 612, 14), "ˈwɜːktɒp", "noun",
  "The flat surface along the kitchen where you prepare food.", "Keep the worktop clean.", "countertop")
P("tiles", "tiles", "B1", "room", (476, 470), (164, 440, 612, 112), "taɪlz", "noun",
  "Flat squares on a wall or floor, often easy to clean.", "We put new tiles behind the sink.")

# the sink and the window
P("window", "window", "A1", "room", (372, 380), (340, 240, 130, 200), "ˈwɪndəʊ", "noun",
  "An opening in a wall with glass, to let in light.", "Open the window - it smells of fish!")
P("blind", "blind", "B1", "room", (380, 268), (338, 240, 134, 62), "blaɪnd", "noun",
  "A piece of cloth you pull down to cover a window.", "Pull the blind down - the sun's in my eyes.", "shade")
P("flowers", "flowers", "A1", "room", (452, 408), (438, 388, 30, 52), "ˈflaʊəz", "noun",
  "The coloured part of a plant.", "There are fresh flowers on the windowsill.")
P("sink", "sink", "A2", "cooking", (380, 556), (350, 548, 110, 14), "sɪŋk", "noun",
  "A bowl with taps where you wash dishes.", "Leave the dirty cups in the sink.")
P("tap", "tap", "A2", "cooking", (426, 516), (388, 492, 42, 60), "tæp", "noun",
  "The thing you turn to make water come out.", "Turn off the tap!", "faucet")

# cooking
P("saucepan", "saucepan", "A2", "cooking", (500, 534), (456, 504, 68, 50), "ˈsɔːspən", "noun",
  "A deep round pan with a handle and a lid.", "Boil the pasta in a big saucepan.", "pot")
P("fryingpan", "frying pan", "A2", "cooking", (612, 543), (550, 536, 82, 18), "ˈfraɪɪŋ pæn", "noun",
  "A flat pan for frying food.", "Fry the eggs in the frying pan.", "skillet")
P("teatowel", "tea towel", "B1", "cooking", (533, 612), (514, 594, 38, 44), "ˈtiː ˌtaʊəl", "noun",
  "A cloth for drying plates and cups.", "Pass me the tea towel and I'll dry.", "dish towel")
P("ladle", "ladle", "B1", "cooking", (656, 506), (644, 454, 24, 64), "ˈleɪdl", "noun",
  "A big deep spoon for serving soup.", "Use the ladle to serve the soup.")
P("whisk", "whisk", "B1", "cooking", (690, 500), (676, 454, 28, 64), "wɪsk", "noun",
  "A tool made of wire loops for beating eggs or cream.", "Beat the eggs with a whisk.")
P("woodenspoon", "wooden spoon", "B1", "cooking", (722, 506), (714, 454, 18, 64), "ˌwʊdn ˈspuːn", "noun",
  "A big spoon made of wood, for stirring food as it cooks.", "Stir the sauce with a wooden spoon.")
P("sieve", "sieve", "B1", "cooking", (752, 486), (736, 456, 32, 46), "sɪv", "noun",
  "A bowl with small holes, for separating liquid from food.", "Pour the rice through a sieve.", "strainer")
P("choppingboard", "chopping board", "B1", "cooking", (648, 549), (640, 542, 80, 12), "ˈtʃɒpɪŋ bɔːd", "noun",
  "A board you cut food on.", "Cut the onions on the chopping board.", "cutting board")
P("bread", "bread", "A1", "cooking", (675, 532), (648, 518, 54, 30), "bred", "noun",
  "A food made from flour, water and yeast, baked in an oven.", "Can you cut some bread, please?")
P("bin", "bin", "A2", "room", (804, 712), (780, 676, 48, 64), "bɪn", "noun",
  "A container for rubbish.", "Throw it in the bin.", "trash can")

# the table
P("table", "table", "A1", "table", (1052, 624), (894, 570, 314, 170), "ˈteɪbl", "noun",
  "A piece of furniture with a flat top on legs.", "Breakfast is on the table!")
P("chair", "chair", "A1", "table", (866, 600), (838, 526, 60, 214), "tʃeə", "noun",
  "A seat for one person, with a back.", "Pull up a chair and sit down.")
P("tablecloth", "tablecloth", "A2", "table", (1182, 630), (892, 604, 318, 58), "ˈteɪblklɒθ", "noun",
  "A cloth that covers a table.", "Mum put a clean tablecloth on the table.")
P("plate", "plate", "A1", "table", (955, 596), (926, 584, 58, 18), "pleɪt", "noun",
  "A flat round dish that you eat food from.", "Your plate is empty - would you like some more?")
P("knife", "knife", "A1", "table", (993, 592), (986, 582, 14, 22), "naɪf", "noun",
  "A tool with a sharp edge for cutting.", "Use a knife and fork.")
P("fork", "fork", "A1", "table", (920, 594), (912, 580, 16, 24), "fɔːk", "noun",
  "A tool with points for picking up food.", "Hold your fork in your left hand.")
P("glass", "glass", "A1", "table", (1008, 574), (998, 556, 20, 38), "ɡlɑːs", "noun",
  "A container made of glass for drinking from.", "Would you like a glass of water?")
P("jug", "jug", "B1", "table", (1034, 572), (1016, 542, 46, 54), "dʒʌɡ", "noun",
  "A container with a handle and a spout, for pouring.", "There's a jug of orange juice on the table.", "pitcher")
P("fruitbowl", "fruit bowl", "A2", "table", (1082, 592), (1054, 584, 56, 16), "ˈfruːt bəʊl", "noun",
  "A bowl for keeping fruit in.", "Take an apple from the fruit bowl.")
P("apple", "apple", "A1", "table", (1070, 576), (1060, 566, 20, 20), "ˈæpl", "noun",
  "A round fruit with red, yellow or green skin.", "An apple a day keeps the doctor away.")
P("banana", "banana", "A1", "table", (1100, 562), (1082, 552, 32, 22), "bəˈnɑːnə", "noun",
  "A long curved yellow fruit.", "I have a banana for breakfast.")
P("mug", "mug", "A2", "table", (1151, 580), (1138, 560, 36, 32), "mʌɡ", "noun",
  "A big cup with straight sides.", "He drinks his coffee from a huge mug.")
P("lamp", "lamp", "A1", "table", (1050, 415), (1014, 100, 72, 332), "læmp", "noun",
  "A light. This one hangs from the ceiling over the table.", "Turn on the lamp - it's getting dark.")

# the wall
P("clock", "clock", "A1", "room", (1330, 190), (1294, 154, 72, 72), "klɒk", "noun",
  "A thing on the wall that shows the time.", "Look at the clock - we're late!")
P("calendar", "calendar", "A1", "room", (1344, 300), (1288, 248, 84, 104), "ˈkælɪndə", "noun",
  "A page for each month with all its days, where you write what you are doing.", "Grandma's birthday is on the calendar.")
P("apron", "apron", "B1", "room", (1328, 470), (1296, 376, 64, 144), "ˈeɪprən", "noun",
  "Something you wear over your clothes to keep them clean when you cook.", "Put an apron on - the sauce splashes.")
P("floor", "floor", "A1", "room", (620, 770), (0, 740, 1400, 60), "flɔː", "noun",
  "The surface you walk on inside a room.", "Don't drop food on the floor.")


S.meta.update(
    view=[0, 150, 1400, 650],
    roomsTitle="The room",
    title="The Kitchen",
    kicker="Picture Studio · Food & home",
    dek="One kitchen, close up: machines, cupboards, cooking tools and a table laid for breakfast.",
    frames=["There is a … on the …", "There are some … in the …", "The … is next to / above / below the …",
            "You use a … to …", "First, … Then, …", "Can you pass me the …, please?"],
)
TF = [
    ("The fridge is next to the window.", False, "A1"),
    ("There are two apples and a banana in the fruit bowl.", True, "A1"),
    ("The clock is on the wall.", True, "A1"),
    ("There is a knife next to the plate.", True, "A1"),
    ("The kettle is in the fridge.", False, "A1"),
    ("The microwave is on the worktop.", True, "A2"),
    ("The saucepan is on the hob.", True, "A2"),
    ("The cupboard door on the left is open.", True, "A2"),
    ("The teapot is on the table.", False, "A2"),
    ("The tea towel is hanging on the oven door.", True, "A2"),
    ("There is a mug of something hot on the table.", True, "A2"),
    ("The whisk is between the ladle and the wooden spoon.", True, "B1"),
    ("The bread is on the chopping board.", True, "B1"),
    ("The blind is pulled all the way down.", False, "B1"),
    ("The cooker hood is above the sink.", False, "B1"),
    ("The spice jars are on the lower shelf.", True, "B1"),
    ("The apron is hanging on a hook near the calendar.", True, "B1"),
]
PROMPTS = {
    "A1": ["What is on the table? Write five sentences.",
           "What do you have for breakfast? Where do you eat it?",
           "What colour is your kitchen? What is in it?"],
    "A2": ["Explain how to make a cup of tea, step by step.",
           "Who does the cooking and the washing-up in your family?",
           "Compare this kitchen with yours. What is the same? What is different?"],
    "B1": ["Write your favourite recipe. Use the words from the picture.",
           "Which kitchen machine could you not live without? Why?",
           "You are sharing a flat. Write kitchen rules for your flatmates."],
}

for coll in (S.rooms, S.parts):
    for c in coll:
        c["def"] = c.pop("def_")

os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
out = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "scenes"))
S.save(os.path.join(out, "kitchen.json"), truefalse=[dict(s=s, a=a, level=l) for s, a, l in TF], prompts=PROMPTS)
S.svg(os.path.join(ROOT, "out", "kitchen.svg"))
lv = {}
for p in S.parts + S.rooms:
    lv[p["level"]] = lv.get(p["level"], 0) + 1
print(f"kitchen: {len(S.items)} items, {len(S.parts)} parts + {len(S.rooms)} rooms, levels {lv}, "
      f"{os.path.getsize(os.path.join(out, 'kitchen.json')) // 1024} KB")
