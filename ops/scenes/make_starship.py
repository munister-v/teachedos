"""Picture Studio · The Starship Bridge — the command deck of a spaceship: a
huge viewscreen full of stars and a ringed planet, the captain's chair, the
pilot at the navigation console, a hologram star map, the engineer at the
engine panel and a little robot.
Inspired by space operas - an original drawing, no film stills.
Writes data/scenes/starship.json.

    python3 ops/scenes/make_starship.py
"""
import math
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob
from common import words, finish

S = Scene("starship", 1400, 800)
G = 690
TOP = 132

# ── hull: ceiling, walls, floor ───────────────────────────────────────────
S.at(0)
S.fill(rect(0, 0, 1400, 800), "deep")
S.fill(rect(0, TOP, 1400, G - TOP), "steel")
S.soft("".join(line(x, TOP, x, G) for x in range(100, 1400, 140)) + line(0, 470, 1400, 470))
S.fill(rect(0, 470, 1400, G - 470), "slate")
S.soft("".join(line(x, 470, x, G) for x in range(100, 1400, 140)))
S.fill(rect(0, G, 1400, 110), "navy")
S.soft("".join(line(700 + (x - 700) * 0.4, G, x, 800) for x in range(-300, 1800, 120)) + line(0, 740, 1400, 740))
S.M(line(0, G, 1400, G), step=0)
S.M(rect(0, TOP - 22, 1400, 22), "slate", step=30)
S.fill("".join(rect(x, TOP - 14, 60, 6, 3) for x in range(40, 1400, 160)), "screen")
# warning light
S.M("M680 132Q680 106 700 106Q720 106 720 132Z", "red", step=40)
S.soft(wave(668, 104, 646, 90, 1, 3) + wave(732, 104, 754, 90, 1, 3) + line(700, 100, 700, 84))

# ── the viewscreen ────────────────────────────────────────────────────────
S.at(150)
VIEW = "M260 452L292 170Q700 140 1108 170L1140 452Z"
S.M(VIEW, "deep", step=80)
import random
rnd = random.Random(7)
S.fill("".join(circle(rnd.uniform(300, 1100), rnd.uniform(180, 440), rnd.uniform(0.8, 2.2)) for _ in range(70)), "paper")
# a spiral galaxy
S.fill(ellipse(470, 262, 70, 26), "night")
S.D(wave(410, 262, 530, 262, 4, 10), "violet")
S.D("M470 262m-40 0a40 16 0 1 0 80 0a40 16 0 1 0 -80 0", None)
S.fill(ellipse(470, 262, 12, 6), "candle")
# a ringed planet
S.M(circle(900, 320, 62), "rust", step=60)
S.fill(ellipse(900, 330, 62, 10) + ellipse(912, 300, 50, 8), "dune")
S.soft(ellipse(900, 330, 62, 10) + ellipse(912, 300, 50, 8))
S.D("M796 316Q900 364 1004 322", None)
S.M("M790 318Q900 380 1010 322Q1020 314 1000 312Q900 350 800 310Q782 310 790 318Z", "gold")   # the ring in front
# a small moon and a comet
S.D(circle(1030, 230, 16), "stone")
S.soft(circle(1026, 226, 3) + circle(1036, 236, 4))
S.D(circle(640, 214, 6), "candle")
S.D("M634 210L560 190M636 216L566 214M638 220L574 234", "cyan")
# another ship far away
S.D("M700 396L740 386L760 396L740 404Z", "stone")
S.fill(circle(700, 396, 3), "cyan")
S.M(VIEW, None)
S.M("M246 466L280 158Q700 126 1120 158L1154 466Z", None)                   # frame
S.D(rect(250, 452, 900, 14, 4), "slate")
# shield status bar on the screen
S.D(rect(310, 420, 150, 16, 4), "night")
S.fill(rect(314, 424, 112, 8, 3), "cyan")

# ── spacesuit on its rack (far left) ─────────────────────────────────────
S.at(600)
S.D(line(40, 300, 150, 300) + line(95, 300, 95, 290), "slate")
S.M("M70 330Q66 312 95 310Q124 312 120 330L132 440L118 444L112 400H78L72 444L58 440Z", "paper", step=60)
S.D(rect(76, 440, 16, 110, 5) + rect(98, 440, 16, 110, 5), "paper")
S.D(rect(72, 548, 24, 14, 4) + rect(94, 548, 24, 14, 4), "slate")
S.D(rect(84, 340, 22, 26, 3), "cyan")
S.fill(circle(90, 350, 3) + circle(100, 350, 3), "red")
S.M(circle(95, 272, 26), "paper")                                          # helmet
S.D(ellipse(95, 276, 18, 13), "deep")
S.soft("M84 268Q90 262 98 264")

# ── navigation console and the pilot ─────────────────────────────────────
S.at(900)
S.M("M160 690V600L190 560H420L430 600V690Z", "slate", step=60)             # console body
S.M("M180 572L196 540H414L424 572Z", "steel")                               # sloping top
S.fill("".join(circle(x, 556, 5) for x in range(214, 300, 16)), "lime")
S.fill("".join(circle(x, 556, 5) for x in (312, 328)), "red")
S.fill(rect(350, 548, 50, 14, 3), "cyan")
S.soft("".join(line(360 + i * 8, 550, 360 + i * 8, 560) for i in range(5)))
S.D(rect(200, 460, 110, 70, 6), "deep")                                     # screen with the star map
S.D(line(210, 510, 300, 480), "cyan")
S.fill(circle(216, 508, 3) + circle(258, 494, 3) + circle(296, 482, 4), "cyan")
S.D(rect(250, 530, 10, 12), "slate")
S.D(rect(320, 474, 70, 56, 6), "deep")                                      # radar
S.D(circle(355, 502, 22), "night")
S.soft(circle(355, 502, 12) + line(333, 502, 377, 502) + line(355, 480, 355, 524))
S.D(line(355, 502, 372, 488), "lime")
S.fill(circle(344, 494, 2.4) + circle(366, 512, 2.4), "lime")
S.D(line(405, 548, 398, 520) + circle(397, 516, 6), "red")                  # control stick
# the pilot
S.D(rect(446, 610, 56, 10, 4) + rect(468, 620, 10, 70) + rect(496, 540, 10, 80, 4), "slate")
S.sitting(476, 610, G, coat="cyan", legs="navy", d=-1, arms=[(404, 522)], k=1.5, hair="short", hairc="ink")
S.D("M462 512Q476 488 490 512", "ink")                                       # headset band
S.D(circle(488, 516, 5), "ink")
S.D("M486 520Q480 534 468 534", "ink")

# ── the little robot ─────────────────────────────────────────────────────
S.at(1100)
S.shadow(570, 716, 30, 4)
S.M("M544 710V660Q544 640 570 640Q596 640 596 660V710Z", "paper", step=40)
S.M("M548 640Q548 612 570 612Q592 612 592 640Z", "stone")
S.D(rect(556, 622, 28, 12, 5), "deep")
S.fill(circle(564, 628, 2.6) + circle(576, 628, 2.6), "cyan")
S.D(line(570, 612, 570, 598) + circle(570, 594, 4), "red")
S.D(rect(556, 664, 28, 16, 3), "cyan")
S.D(ellipse(556, 714, 10, 5) + ellipse(584, 714, 10, 5), "slate")
S.D(line(544, 670, 530, 686) + line(596, 670, 610, 660), "slate")

# ── the captain's chair on its platform ───────────────────────────────────
S.at(1300)
S.fill(ellipse(730, 640, 140, 20), "steel")
S.M("M590 640Q590 660 730 660Q870 660 870 640", "slate", step=30)
S.soft(ellipse(730, 640, 140, 20))
S.M(rect(730, 448, 66, 150, 18), "red", step=60)                            # chair back
S.D(rect(716, 600, 90, 14, 5), "red")
S.D(rect(754, 614, 14, 26), "slate")
S.D(rect(708, 560, 18, 40, 5) + rect(796, 560, 18, 40, 5), "slate")         # armrests
S.fill(circle(716, 566, 3) + circle(804, 566, 3), "lime")
S.sitting(754, 600, 640, coat="gold", legs="navy", d=-1, arms=[(718, 562)], k=1.5, hair="bun", hairc="ink")
S.D(circle(752, 548, 5), "gold")                                              # badge
S.fill(circle(752, 548, 2), "red")

# ── hologram table with a star map ────────────────────────────────────────
S.at(1500)
S.shadow(930, G + 16, 70, 4)
S.M("M880 700L900 646H960L980 700Z", "slate", step=40)
S.M(ellipse(930, 646, 70, 12), "steel")
S.fill(ellipse(930, 646, 44, 7), "cyan")
S.fill("M890 644L870 520H990L970 644Z", "glassa")                             # light beam
S.soft(line(890, 644, 870, 520) + line(970, 644, 990, 520))
S.D(circle(930, 520, 54), "glassa")
S.soft(ellipse(930, 520, 54, 16) + ellipse(930, 520, 20, 54) + line(876, 520, 984, 520))
S.fill(circle(914, 506, 4) + circle(946, 530, 3) + circle(930, 490, 3), "cyan")
S.D(circle(946, 530, 8), None)

# ── engineering panel and the engineer ───────────────────────────────────
S.at(1700)
S.M(rect(1130, 380, 220, 310, 6), "slate", step=60)
S.D(rect(1146, 396, 188, 70, 4), "deep")                                    # screen with a wave
S.D(wave(1156, 432, 1324, 432, 6, 14), "lime")
for i, x in enumerate((1156, 1206, 1256, 1306)):                            # gauges
    S.D(circle(x + 14, 500, 16), "paper")
    a = math.radians(200 + i * 35)
    S.D(line(x + 14, 500, x + 14 + 11 * math.cos(a), 500 + 11 * math.sin(a)), "ink")
for i, x in enumerate((1166, 1204, 1242, 1280, 1318)):                      # levers
    S.D(rect(x - 3, 540, 6, 60, 2), "night")
    yk = 548 + (i * 13) % 40
    S.D(rect(x - 10, yk, 20, 12, 4), ("red", "lime", "cyan", "gold", "lime")[i])
S.D(rect(1146, 616, 188, 56, 4), "night")
S.fill("".join(rect(1156 + i * 22, 628, 14, 8, 2) for i in range(8)), "screen")
S.fill("".join(rect(1156 + i * 22, 646, 14, 8, 2) for i in range(8)), "neon")
S.shadow(1086, G + 40, 26)
S.standing(1086, G + 40, coat="red", d=1, arms=[(1160, 560), (1100, 610)], legs="navy", k=1.55, hair="long", hairc="hairb")

# ── words ─────────────────────────────────────────────────────────────────
R, P = words(S)
R("bridge", "bridge", (0, 110, 1400, 690), (20, 480), "B1", "brɪdʒ",
  "The room on a ship where the captain controls it.", "The captain is on the bridge.")
S.meta["zones"] = [
    dict(id="screenz", chip="The viewscreen", box=[240, 120, 920, 360]),
    dict(id="navz", chip="Navigation", box=[140, 440, 400, 280]),
    dict(id="engz", chip="Engineering", box=[1000, 360, 390, 380]),
]
S.meta["groups"] = {"space": "Out in space", "nav": "Navigation", "command": "Command", "eng": "Engineering", "people": "The crew"}

P("screen", "viewscreen", "B1", "space", (700, 180), (260, 158, 880, 300), "ˈvjuːskriːn", "noun",
  "A very big screen that shows what is outside.", "A planet appeared on the viewscreen.")
P("stars", "stars", "A1", "space", (360, 360), (300, 180, 800, 260), "stɑːz", "noun",
  "Small bright lights in the night sky - suns far away.", "Millions of stars shine outside.")
P("planet", "planet", "A1", "space", (890, 300), (788, 256, 226, 128), "ˈplænɪt", "noun",
  "A big round world that goes round a star.", "The planet has golden rings.")
P("rings", "rings", "A2", "space", (1000, 322), (788, 306, 226, 50), "rɪŋz", "noun",
  "Circles of ice and rock round a planet.", "You can see its rings clearly.")
P("moon", "moon", "A1", "space", (1030, 230), (1012, 212, 36, 36), "muːn", "noun",
  "A round world that goes round a planet.", "The planet has a small grey moon.")
P("galaxy", "galaxy", "B1", "space", (470, 262), (398, 234, 144, 56), "ˈɡæləksi", "noun",
  "A huge group of millions of stars.", "Our galaxy is called the Milky Way.")
P("comet", "comet", "B1", "space", (640, 214), (556, 186, 94, 52), "ˈkɒmɪt", "noun",
  "A ball of ice and dust with a bright tail.", "A comet flew past the ship.")
P("ship", "spaceship", "A2", "space", (730, 395), (694, 380, 70, 30), "ˈspeɪsʃɪp", "noun",
  "A vehicle that travels in space.", "Another spaceship is coming towards us.", "spacecraft")
P("shields", "shield level", "B2", "space", (360, 428), (308, 418, 154, 20), "ˈʃiːld ˌlevl", "noun",
  "How strong the ship's protection is.", "The shield level is at eighty per cent.")

P("console", "control panel", "A2", "nav", (300, 620), (158, 538, 274, 152), "kənˈtrəʊl ˌpænl", "noun",
  "A surface with buttons and switches that controls a machine.", "The pilot checks the control panel.", "console")
P("buttons", "buttons", "A1", "nav", (250, 556), (206, 548, 132, 18), "ˈbʌtnz", "noun",
  "Small things you press to make a machine work.", "Don't press the red buttons!")
P("stick", "control stick", "B1", "nav", (398, 520), (388, 506, 24, 46), "kənˈtrəʊl stɪk", "noun",
  "A handle you move to steer.", "She pushed the control stick forward.", "joystick")
P("map", "star map", "A2", "nav", (256, 494), (198, 458, 114, 74), "ˈstɑː mæp", "noun",
  "A map that shows where the stars and planets are.", "The route is on the star map.")
P("radar", "radar", "B1", "nav", (355, 502), (318, 472, 74, 60), "ˈreɪdɑː", "noun",
  "A screen that shows things that are far away.", "Two ships are on the radar.")
P("pilot", "pilot", "A2", "people", (476, 560), (436, 480, 80, 210), "ˈpaɪlət", "noun",
  "The person who flies a ship or plane.", "The pilot is steering the ship.")
P("headset", "headset", "B1", "people", (488, 512), (458, 482, 40, 58), "ˈhedset", "noun",
  "Headphones with a microphone.", "The pilot talks to base on her headset.")

P("chair", "captain's chair", "B1", "command", (780, 470), (704, 444, 112, 172), "ˌkæptɪnz ˈtʃeə", "noun",
  "The special seat where the captain sits.", "Nobody else may sit in the captain's chair.")
P("platform", "platform", "B1", "command", (640, 648), (588, 618, 284, 44), "ˈplætfɔːm", "noun",
  "A raised flat area.", "The captain's chair stands on a platform.")
P("captain", "captain", "A2", "people", (752, 560), (712, 480, 80, 160), "ˈkæptɪn", "noun",
  "The person in charge of a ship.", "The captain gives the orders.")
P("badge", "badge", "B1", "people", (752, 548), (744, 540, 16, 16), "bædʒ", "noun",
  "A small metal sign you wear to show who you are.", "Her badge shows she is the captain.")
P("hologram", "hologram", "B1", "command", (930, 540), (866, 464, 128, 184), "ˈhɒləɡræm", "noun",
  "A 3D picture made of light.", "A hologram of the galaxy floats above the table.")
P("robot", "robot", "A1", "command", (570, 670), (526, 588, 88, 130), "ˈrəʊbɒt", "noun",
  "A machine that can move and do jobs.", "The little robot beeps when it's happy.")
P("light", "warning light", "B1", "command", (700, 120), (676, 104, 48, 30), "ˈwɔːnɪŋ laɪt", "noun",
  "A light that comes on when there is danger.", "The warning light is flashing red!")

P("panel", "engine panel", "B1", "eng", (1330, 470), (1128, 378, 224, 314), "ˈendʒɪn ˌpænl", "noun",
  "The controls for the ship's engines.", "The engineer is checking the engine panel.")
P("levers", "levers", "B1", "eng", (1242, 560), (1154, 538, 176, 66), "ˈliːvəz", "noun",
  "Handles you push or pull to control a machine.", "Pull the green lever for more power.")
P("gauges", "gauges", "B1", "eng", (1220, 500), (1152, 482, 184, 36), "ˈɡeɪdʒɪz", "noun",
  "Instruments that measure things like speed or fuel.", "All the gauges are in the green.")
P("engineer", "engineer", "A2", "people", (1086, 620), (1046, 530, 90, 204), "ˌendʒɪˈnɪə", "noun",
  "A person who builds or repairs machines.", "The engineer can fix anything.")
P("spacesuit", "spacesuit", "A2", "command", (95, 400), (54, 300, 82, 264), "ˈspeɪssuːt", "noun",
  "Special clothes you wear to go outside in space.", "Put on your spacesuit before you open the door.")
P("helmet", "helmet", "A1", "command", (95, 272), (68, 244, 54, 56), "ˈhelmɪt", "noun",
  "A hard hat that protects your head.", "The helmet has a gold visor.")

S.meta.update(
    view=[0, 100, 1400, 700],
    roomsTitle="The ship",
    title="The Starship Bridge",
    kicker="Picture Studio · Sci-Fi & Tech",
    dek="The command deck of a spaceship: a viewscreen full of stars, the captain, the pilot, the engineer and a little robot.",
    inspired="Inspired by space operas",
    frames=["Captain, there's a … on the screen!", "Set a course for …", "If we …, the ship will …",
            "I think the planet might be …", "The … is broken - we need to …", "Engage the …!"],
)
TF = [
    ("There is a planet with rings on the screen.", True, "A1"),
    ("The robot is next to the captain's chair.", False, "A1"),
    ("The captain's chair is red.", True, "A1"),
    ("There are three people on the bridge.", True, "A1"),
    ("The pilot is wearing a headset.", True, "A2"),
    ("The spacesuit is next to the engine panel.", False, "A2"),
    ("A comet is flying past the ship.", True, "A2"),
    ("The warning light is on the ceiling.", True, "A2"),
    ("The hologram shows a star map.", True, "B1"),
    ("The engineer is sitting down.", False, "B1"),
    ("The pilot's hand is on the control stick.", True, "B1"),
    ("The shield level is full.", False, "B1"),
]
PROMPTS = {
    "A1": ["Who is on the bridge? What are they doing?",
           "What can you see on the big screen? Write five sentences.",
           "Would you like to travel in space? Why?"],
    "A2": ["Write the captain's log for one day on the ship.",
           "Describe the planet on the screen. What do you think lives there?",
           "Which job on the ship would you like: captain, pilot or engineer? Why?"],
    "B1": ["The warning light starts flashing. What happens next? Use the past continuous.",
           "Make a hypothesis: what might be on the planet? Use might, could, must.",
           "Should we spend money on space travel or on problems on Earth? Discuss."],
}
finish(S, TF, PROMPTS)
