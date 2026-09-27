"""Picture Studio · The Hero Lab — an inventor's workshop: a robot suit in its
charging pod, a workbench covered in gadgets, big screens with a threat alert
and an upgrade bar, a robotic arm and a containment cell with a glowing
crystal. Inspired by superhero films - an original drawing, no costumes or
characters from any film. Writes data/scenes/herolab.json.

    python3 ops/scenes/make_herolab.py
"""
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob
from common import words, finish

S = Scene("herolab", 1400, 800)
G = 690
TOP = 130

# ── room ──────────────────────────────────────────────────────────────────
S.at(0)
S.fill(rect(0, 0, 1400, 800), "night2")
S.wallpaper((0, TOP, 1400, G - TOP), "steel", "tiles")
S.fill(rect(0, TOP, 1400, 10), "cyan")                                       # light strip
S.fill(rect(0, G, 1400, 110), "slate")
S.soft("".join(line(x, G, x + (x - 700) * 0.3, 800) for x in range(0, 1500, 100)) + line(0, 744, 1400, 744))
S.M(line(0, G, 1400, G), step=0)

# ── charging pod with the robot suit (left) ──────────────────────────────
S.at(150)
S.M(rect(50, 640, 190, 50, 6), "night", step=40)                             # base
S.fill(rect(60, 652, 170, 8), "cyan")
S.M(rect(60, 200, 170, 440, 80), "glassa", step=60)                          # the glass pod
S.soft(line(84, 260, 84, 580) + line(96, 240, 96, 300))
# the suit
S.at(300)
S.D(rect(118, 520, 22, 116, 8) + rect(150, 520, 22, 116, 8), "slate")        # legs
S.D(rect(114, 628, 30, 12, 4) + rect(146, 628, 30, 12, 4), "night")
S.M("M108 370Q108 350 145 346Q182 350 182 370L178 520H112Z", "slate", step=60)   # body
S.D(circle(145, 410, 14), "cyan")
S.D(circle(145, 410, 7), "paper")
S.D("M120 470H170M124 494H166", None)
S.D(rect(86, 372, 20, 120, 8) + rect(184, 372, 20, 120, 8), "slate")          # arms
S.D(circle(96, 500, 11) + circle(194, 500, 11), "night")
S.M("M122 344Q118 296 145 292Q172 296 168 344Z", "slate")                    # helmet
S.D("M128 318H162L158 332H132Z", "cyan")                                     # visor
S.D(line(145, 640, 145, 690) + "M120 690Q110 720 60 730" + "M170 690Q190 716 240 724", "night")   # cables

# ── cape on a hook ────────────────────────────────────────────────────────
S.at(500)
S.D(circle(280, 250, 5), "night")
S.M("M262 256Q280 248 298 256L318 460Q296 476 280 462Q262 476 242 460Z", "red", step=50)
S.soft("M272 262L262 450M288 262L298 452")

# ── big screens (centre) ─────────────────────────────────────────────────
S.at(600)
S.M(rect(620, 170, 420, 250, 8), "night", step=60)
S.D(rect(632, 182, 260, 226, 4), "deep")                                     # city map
S.soft("".join(line(632, y, 892, y) for y in range(200, 408, 26)) + "".join(line(x, 182, x, 408) for x in range(650, 892, 30)))
S.fill(rect(680, 250, 50, 36) + rect(760, 300, 40, 60) + rect(820, 220, 44, 40), "navy")
S.D(pts([(790, 238), (812, 276), (768, 276)], True), "red")                  # threat alert on the map
S.fill(rect(788, 250, 4, 14) + circle(790, 270, 2.4), "paper")
S.soft(circle(790, 262, 34) + circle(790, 262, 50))
S.D(rect(904, 182, 124, 110, 4), "deep")                                     # AI assistant
S.D(circle(966, 232, 30), "cyan")
S.fill(circle(956, 226, 4) + circle(976, 226, 4), "deep")
S.D("M954 242Q966 250 978 242", None)
S.soft(circle(966, 232, 40))
S.D(rect(904, 300, 124, 108, 4), "deep")                                     # upgrade bar + DNA
S.D(rect(916, 380, 100, 14, 4), "night")
S.fill(rect(918, 382, 70, 10, 3), "lime")
S.D(wave(940, 312, 940, 368, 4, 10) + wave(990, 312, 990, 368, 4, -10), "neon")
S.D(line(830, 420, 830, 440) + rect(790, 440, 80, 12, 3), "night")          # stand

# ── workbench with gadgets and the inventor ──────────────────────────────
S.at(900)
inv = S.standing(470, G - 2, coat="paper", d=1, arms=[(528, 552), (440, 556)], legs="navy", k=1.6, hair="curly", hairc="ink")
hx, hy = inv["head"]
S.D(rect(hx - 16, hy - 16, 32, 10, 5), "cyan")                              # goggles pushed up
S.fill(circle(hx - 7, hy - 11, 3) + circle(hx + 7, hy - 11, 3), "screen")
S.at(1100)
S.M(rect(290, 560, 350, 16, 3), "night", step=40)
S.D(rect(300, 576, 14, 114) + rect(616, 576, 14, 114) + rect(300, 640, 330, 8), "night")
S.D("M322 546H392V556H322Z", "slate")                                       # drone body
S.D(line(322, 546, 306, 536) + line(392, 546, 408, 536), "slate")
S.D(ellipse(302, 534, 14, 3) + ellipse(412, 534, 14, 3), "cyan")
S.fill(circle(357, 551, 3), "red")
S.D("M540 560L548 530H598L604 560Z", "slate")                              # laptop
S.D("M552 534H594L598 556H548Z", "screen")
S.D(rect(420, 548, 90, 12, 2), "sky2")                                       # blueprint
S.soft(line(428, 552, 500, 552) + line(428, 556, 480, 556) + rect(486, 550, 16, 8))
S.D(line(512, 552, 536, 540) + rect(508, 550, 8, 6, 2), "red")               # screwdriver
S.D(rect(612, 530, 22, 30, 3), "night")                                      # test tubes rack
S.D(rect(614, 516, 5, 30, 2) + rect(621, 512, 5, 34, 2) + rect(628, 520, 5, 26, 2), "glassa")
S.fill(rect(614, 532, 5, 14) + rect(621, 528, 5, 18) + rect(628, 534, 5, 12), "lime")
S.D("M302 548Q314 536 326 548V556H302Z", "night")                           # a mask on the bench
S.fill(ellipse(308, 548, 3, 2) + ellipse(320, 548, 3, 2), "paper")

# ── robotic arm holding a battery ─────────────────────────────────────────
S.at(1300)
S.M(rect(990, 666, 70, 24, 6), "night", step=30)
S.limb(1025, 666, 1010, 560, 22, "gold")
S.D(circle(1010, 560, 13), "night")
S.limb(1010, 560, 1080, 500, 18, "gold")
S.D(circle(1080, 500, 10), "night")
S.D("M1086 494L1104 484M1086 506L1104 514", "night")
S.D(rect(1098, 482, 18, 34, 4), "lime")                                      # battery
S.D(rect(1102, 476, 10, 6, 2) + "M1104 494L1110 498L1104 502", "night")

# ── containment cell with the crystal ────────────────────────────────────
S.at(1500)
S.M(ellipse(1210, 650, 90, 18), "night", step=40)
S.fill("".join(pts([(x, 640), (x + 16, 640), (x + 6, 666), (x - 10, 666)], True) for x in range(1130, 1290, 32)), "gold")
S.M(rect(1130, 290, 160, 356, 10), "glassa", step=60)
S.M(ellipse(1210, 290, 80, 16), "night")
S.fill("M1210 430L1236 480L1224 560H1196L1184 480Z", "neon")               # crystal
S.D("M1210 430L1236 480L1224 560H1196L1184 480Z" + line(1210, 430, 1210, 560) + line(1184, 480, 1236, 480))
S.soft(circle(1210, 500, 60) + circle(1210, 500, 84))
S.fill(rect(1196, 560, 28, 20), "night")
S.D(pts([(1210, 204), (1238, 252), (1182, 252)], True), "gold")              # warning sign
S.fill(rect(1208, 220, 4, 18) + circle(1210, 244, 2.4), "ink")
# safety corner
S.D(rect(1318, 360, 56, 44, 6), "paper")                                     # first aid kit
S.fill(rect(1340, 368, 12, 28) + rect(1332, 376, 28, 12), "red")
S.D(circle(1346, 470, 16), "red")                                            # emergency button
S.D(rect(1326, 450, 40, 40, 4))
S.fill(rect(1330, 498, 32, 6), "gold")
S.D("M1334 690V598Q1334 584 1348 584Q1362 584 1362 598V690Z", "red")        # fire extinguisher
S.D(rect(1342, 572, 12, 12, 2) + "M1354 576Q1370 576 1372 600", "night")

# ── words ─────────────────────────────────────────────────────────────────
R, P = words(S)
R("lab", "lab", (0, 120, 1400, 680), (20, 480), "A2", "læb",
  "A room where scientists do experiments.", "Her lab is full of inventions.", "laboratory")
S.meta["zones"] = [
    dict(id="suitz", chip="The suit", box=[30, 180, 310, 560]),
    dict(id="benchz", chip="The workbench", box=[280, 440, 380, 320]),
    dict(id="cellz", chip="The containment cell", box=[960, 180, 440, 530]),
]
S.meta["groups"] = {"suit": "The suit", "bench": "The workbench", "screens": "The screens", "danger": "Danger and safety", "people": "People"}

P("suit", "robot suit", "B1", "suit", (145, 440), (84, 290, 122, 350), "ˈrəʊbɒt suːt", "noun",
  "A metal suit with machines inside that makes you stronger.", "The robot suit can fly.")
P("pod", "charging pod", "B1", "suit", (70, 560), (50, 198, 192, 492), "ˈtʃɑːdʒɪŋ pɒd", "noun",
  "A glass case where something gets electricity.", "The suit stays in its charging pod at night.")
P("visor", "visor", "B1", "suit", (145, 325), (126, 316, 38, 18), "ˈvaɪzə", "noun",
  "The clear part of a helmet you look through.", "The visor shows a map inside.")
P("cables", "cables", "A2", "suit", (220, 720), (56, 690, 190, 44), "ˈkeɪblz", "noun",
  "Thick wires that carry electricity.", "Careful - don't trip over the cables.")
P("cape", "cape", "A1", "suit", (282, 380), (240, 244, 80, 234), "keɪp", "noun",
  "A long piece of cloth that hangs from your shoulders.", "A red cape hangs on the wall.")

P("bench", "workbench", "B1", "bench", (360, 610), (288, 556, 354, 134), "ˈwɜːkbentʃ", "noun",
  "A strong table for making and fixing things.", "Her workbench is covered in gadgets.")
P("drone", "drone", "B1", "bench", (357, 550), (298, 528, 118, 30), "drəʊn", "noun",
  "A small flying machine with no pilot.", "Her drone can fly over the whole city.")
P("laptop", "laptop", "A1", "bench", (574, 545), (538, 526, 70, 36), "ˈlæptɒp", "noun",
  "A small computer you can carry.", "The laptop is running a test.")
P("blueprint", "blueprint", "B1", "bench", (446, 554), (418, 546, 94, 16), "ˈbluːprɪnt", "noun",
  "A drawing that shows how to build something.", "The blueprint shows the new gadget.")
P("screwdriver", "screwdriver", "B1", "bench", (524, 546), (506, 536, 34, 22), "ˈskruːdraɪvə", "noun",
  "A tool for turning screws.", "Pass me the screwdriver, please.")
P("tubes", "test tubes", "B1", "bench", (622, 530), (610, 510, 26, 52), "ˈtest tjuːbz", "noun",
  "Small glass tubes for experiments.", "The test tubes are full of green liquid.")
P("mask", "mask", "A1", "bench", (314, 550), (300, 536, 28, 22), "mɑːsk", "noun",
  "Something you wear over your face.", "A black mask lies on the bench.")
P("inventor", "inventor", "B1", "people", (470, 530), (428, 470, 96, 90), "ɪnˈventə", "noun",
  "A person who creates new machines or ideas.", "The inventor is working on a new gadget.")
P("goggles", "goggles", "B1", "people", (hx, hy - 11), (hx - 18, hy - 18, 36, 14), "ˈɡɒɡlz", "noun",
  "Special glasses that protect your eyes.", "She pushed her goggles up onto her head.")
P("labcoat", "lab coat", "A2", "people", (478, 548), (450, 530, 46, 28), "ˈlæb kəʊt", "noun",
  "A white coat you wear in a laboratory.", "She wears a lab coat to keep her clothes clean.")

P("screens", "big screen", "A2", "screens", (660, 400), (620, 168, 424, 256), "ˌbɪɡ ˈskriːn", "noun",
  "A very large computer screen.", "Everything appears on the big screen.")
P("map", "city map", "A2", "screens", (700, 350), (632, 182, 260, 226), "ˌsɪti ˈmæp", "noun",
  "A plan that shows the streets of a city.", "The city map shows where the danger is.")
P("threat", "threat alert", "B2", "screens", (790, 262), (756, 228, 68, 56), "ˈθret əˌlɜːt", "noun",
  "A warning that something dangerous is happening.", "A threat alert is flashing in the city centre.")
P("ai", "AI assistant", "B2", "screens", (966, 232), (904, 182, 124, 110), "ˌeɪ ˈaɪ əˌsɪstənt", "noun",
  "A computer program that talks and helps you (AI = artificial intelligence).", "Her AI assistant answers her questions.")
P("upgrade", "upgrade bar", "B2", "screens", (950, 387), (914, 378, 104, 18), "ˈʌpɡreɪd bɑː", "noun",
  "A bar that shows how much of an improvement is finished.", "The upgrade is seventy per cent done.")
P("dna", "DNA", "B1", "screens", (964, 340), (926, 306, 80, 68), "ˌdiː en ˈeɪ", "noun",
  "The code inside living things that makes them what they are.", "The screen shows a spinning DNA model.")

P("arm", "robotic arm", "B1", "danger", (1030, 600), (986, 488, 100, 204), "rəʊˈbɒtɪk ɑːm", "noun",
  "A machine that moves like a human arm.", "The robotic arm lifts heavy things.")
P("battery", "battery", "A2", "danger", (1107, 500), (1094, 474, 26, 44), "ˈbætri", "noun",
  "A thing that stores electricity.", "The robotic arm is holding a huge battery.")
P("cell", "containment cell", "B2", "danger", (1150, 360), (1128, 272, 164, 396), "kənˈteɪnmənt sel", "noun",
  "A strong closed space for keeping something dangerous.", "The crystal is locked in a containment cell.")
P("crystal", "crystal", "B1", "danger", (1210, 500), (1180, 426, 60, 136), "ˈkrɪstl", "noun",
  "A hard clear stone that can shine.", "The crystal glows pink in the dark.")
P("stripes", "hazard stripes", "B1", "danger", (1180, 654), (1120, 636, 180, 34), "ˈhæzəd straɪps", "noun",
  "Yellow and black lines that mean danger.", "Don't step over the hazard stripes.")
P("sign", "warning sign", "A1", "danger", (1210, 236), (1178, 200, 64, 56), "ˈwɔːnɪŋ saɪn", "noun",
  "A sign that tells you about danger.", "The warning sign says 'Keep out'.")
P("firstaid", "first aid kit", "A2", "danger", (1346, 382), (1316, 358, 60, 48), "ˌfɜːst ˈeɪd kɪt", "noun",
  "A box of things for treating small injuries.", "Where is the first aid kit?")
P("button", "emergency button", "B1", "danger", (1346, 470), (1324, 448, 44, 58), "ɪˈmɜːdʒənsi ˌbʌtn", "noun",
  "A button you press when something goes badly wrong.", "Press the emergency button to stop everything.")
P("extinguisher", "fire extinguisher", "B1", "danger", (1348, 640), (1330, 568, 44, 124), "ˈfaɪər ɪkˌstɪŋɡwɪʃə", "noun",
  "A red metal bottle for putting out fires.", "There's a fire extinguisher by the door.")

S.meta.update(
    view=[0, 120, 1400, 680],
    roomsTitle="The lab",
    title="The Hero Lab",
    kicker="Picture Studio · Sci-Fi & Tech",
    dek="An inventor's workshop: a robot suit, gadgets on the workbench, screens, a robotic arm and a glowing crystal.",
    inspired="Inspired by superhero films",
    frames=["This gadget can …", "If the crystal …, the city will …", "You must / mustn't … in the lab.",
            "The upgrade will make the suit …", "I think the threat is …", "In case of emergency, …"],
)
TF = [
    ("There is a cape on the wall.", True, "A1"),
    ("The crystal is green.", False, "A1"),
    ("The inventor is wearing a white coat.", True, "A1"),
    ("There is a drone on the workbench.", True, "A1"),
    ("The robotic arm is holding a battery.", True, "A2"),
    ("The first aid kit is next to the pod.", False, "A2"),
    ("There is a map on the big screen.", True, "A2"),
    ("The inventor's goggles are on her eyes.", False, "A2"),
    ("The upgrade is finished.", False, "B1"),
    ("The crystal is inside a containment cell.", True, "B1"),
    ("A threat alert is showing on the city map.", True, "B1"),
    ("The fire extinguisher is under the emergency button.", True, "B1"),
]
PROMPTS = {
    "A1": ["What can you see in the lab? Write six things.",
           "What colour is the cape? The crystal? The suit?",
           "What would you invent?"],
    "A2": ["Write five lab safety rules. Use must / mustn't.",
           "Describe a gadget you would like to have and what it can do.",
           "The alarm goes off. What does the inventor do? Tell the story."],
    "B1": ["Present your own invention: what it does, how it works, who it helps.",
           "What would happen if the crystal escaped? Use the second conditional.",
           "Could artificial intelligence be dangerous? Give your opinion."],
}
finish(S, TF, PROMPTS)
