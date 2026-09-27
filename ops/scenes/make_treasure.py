"""Picture Studio · The Treasure Cave — explorers inside an old cave: the
jungle at the entrance, a rope down from a hole in the roof, a spike trap,
carvings on the wall, a golden statue and a chest of treasure.
Inspired by adventure films - an original drawing, no film stills.
Writes data/scenes/treasure.json.

    python3 ops/scenes/make_treasure.py
"""
import random
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob
from common import words, finish

S = Scene("treasure", 1400, 800)
G = 700


def hat(hx, hy, fill="bark"):
    S.D(ellipse(hx, hy - 5, 19, 5), fill)
    S.D(f"M{hx - 11} {hy - 6}Q{hx - 11} {hy - 22} {hx} {hy - 22}Q{hx + 11} {hy - 22} {hx + 11} {hy - 6}Z", fill)
    S.D(rect(hx - 11, hy - 10, 22, 4), "ink")


# ── the cave ──────────────────────────────────────────────────────────────
S.at(0)
S.fill(rect(0, 0, 1400, 800), "night2")
S.fill(rect(0, 100, 1400, 700), "stone2")
S.fill("M0 100H1400V250Q1200 200 1000 240Q800 210 600 244Q400 200 220 250Q100 230 0 260Z", "night")
S.M("M0 260Q100 230 220 250Q400 200 600 244Q800 210 1000 240Q1200 200 1400 250", step=40)
S.fill(rect(0, G, 1400, 100), "dune")
S.soft("".join(ellipse(x, y, 2, 1) for x, y in ((random.Random(i).uniform(0, 1400), random.Random(i + 99).uniform(G + 6, 796)) for i in range(60))))
S.M("M0 700Q200 690 420 702Q700 690 1000 702Q1200 694 1400 700", step=40)
# rock bulges on the walls
for cx, cy, rx, ry, sd in ((380, 420, 120, 80, 3), (1020, 460, 140, 90, 5), (1320, 380, 90, 120, 7), (700, 330, 110, 60, 9)):
    S.fill(blob(cx, cy, rx, ry, 10, 0.12, seed=sd), "stone")
    S.soft(blob(cx, cy, rx, ry, 10, 0.12, seed=sd))
# stalactites and stalagmites
S.at(200)
for x, h in ((300, 70), (340, 40), (520, 90), (560, 50), (880, 80), (930, 44), (1100, 70), (1250, 60)):
    y0 = 240
    S.D(pts([(x - 12, y0 - 6), (x + 12, y0 - 6), (x, y0 + h)], True), "night")
for x, h in ((460, 40), (800, 56), (1060, 36)):
    S.D(pts([(x - 16, G + 2), (x + 16, G + 2), (x, G - h)], True), "stone")

# ── the entrance and the jungle outside ──────────────────────────────────
S.at(400)
MOUTH = "M0 700V300Q60 250 140 290Q210 330 220 440Q236 560 200 700Z"
S.M(MOUTH, "skyg", step=60)
S.fill("M0 560Q60 520 120 540Q170 520 214 560V700H0Z", "grass")
S.fill(blob(60, 460, 70, 60, 9, 0.2, seed=11), "leaf")
S.fill(blob(170, 520, 50, 44, 9, 0.2, seed=12), "leaf2")
S.fill(blob(40, 610, 60, 40, 9, 0.2, seed=13), "leaf2")
S.H(blob(60, 460, 70, 60, 9, 0.2, seed=11) + blob(170, 520, 50, 44, 9, 0.2, seed=12))
S.fill(circle(120, 360, 26), "sun")
S.M(MOUTH, None)
for x in (40, 90, 150, 196):                                                 # vines
    S.D(wave(x, 280 + (x % 30), x + 6, 420 + (x % 50), 4, 5), "leaf2")
    S.fill("".join(ellipse(x + 3, y, 5, 3) for y in range(300, 420, 30)), "leaf")
# footprints into the cave
S.soft("".join(ellipse(x, y, 6, 3) for x, y in ((230, 740), (260, 750), (292, 738), (326, 748), (360, 736), (392, 746))))

# ── spider web ───────────────────────────────────────────────────────────
S.D("M236 262L330 262M236 262L236 360M236 262L310 336M236 262L280 350M236 262L320 300"
    "M236 290Q256 290 262 262M236 318Q280 314 290 262M236 346Q304 336 316 262")

# ── hole in the roof, light and a rope ───────────────────────────────────
S.at(600)
S.M(ellipse(640, 226, 40, 12), "sky2", step=40)
S.soft(line(604, 232, 540, 690) + line(676, 232, 740, 690) + line(620, 232, 580, 690) + line(660, 232, 700, 690))
S.D(line(646, 222, 650, 590), "dune")
S.D(line(634, 222, 638, 590), None)
S.soft("".join(line(634, y, 650, y + 6) for y in range(240, 590, 18)))
S.D(circle(644, 596, 10), "dune")
# a climber coming down the rope
S.at(800)
S.D(rect(664, 456, 18, 36, 5), "rust")                                        # small backpack
cl = S.standing(652, 566, coat="cyan", d=-1, arms=[(643, 420), (648, 446)], legs="bark", k=1.4, hair="long", hairc="hairb")
S.D(line(642, 540, 648, 566), "dune")                                         # rope between her feet

# ── the spike trap ───────────────────────────────────────────────────────
S.at(1000)
S.M(ellipse(640, 740, 110, 24), "night2", step=40)
S.fill("".join(pts([(x - 8, 752), (x + 8, 752), (x, 726)], True) for x in range(560, 730, 22)), "stone")
S.soft("".join(pts([(x - 8, 752), (x + 8, 752), (x, 726)], True) for x in range(560, 730, 22)))
S.D(ellipse(640, 740, 110, 24), None)

# ── the explorer with a map and a compass ────────────────────────────────
S.at(1200)
S.shadow(390, 758, 26)
ex = S.standing(390, 758, coat="dune", d=1, arms=[(440, 612), (372, 628)], legs="bark", k=1.6, hair="short", hairc="hairb")
hat(ex["head"][0], ex["head"][1] - 8)
S.D("M420 590L468 584L472 624L424 630Z", "sand")                            # old map
S.soft(wave(430, 600, 462, 596, 3, 3) + line(432, 612, 460, 608))
S.D("M450 604L456 610M456 604L450 610", "red")
S.D(circle(374, 632, 9), "gold")                                              # compass
S.D(line(374, 626, 374, 638), "red")
S.D("M378 590L404 680", "bark")                                               # satchel strap
S.D(rect(396, 664, 26, 22, 5), "bark")

# ── carvings and a torch on the wall ─────────────────────────────────────
S.at(1400)
S.D(rect(760, 290, 250, 120, 8), "stone")
for i, x in enumerate(range(784, 1000, 44)):
    sym = i % 4
    if sym == 0:
        S.D(circle(x, 330, 12) + "".join(line(x + 16 * c, 330 + 16 * s_, x + 20 * c, 330 + 20 * s_) for c, s_ in ((1, 0), (-1, 0), (0, 1), (0, -1))))
    elif sym == 1:
        S.D(pts([(x - 12, 344), (x - 6, 316), (x, 344), (x + 6, 316), (x + 12, 344)]))
    elif sym == 2:
        S.D(f"M{x - 10} 340Q{x} 310 {x + 10} 340Q{x} 350 {x - 10} 340Z" + circle(x, 332, 3))
    else:
        S.D(pts([(x, 314), (x + 12, 344), (x - 12, 344)], True))
S.soft("".join(line(772, y, 998, y) for y in (366, 386)))
S.fill("".join(rect(x, 372, 12, 8, 2) for x in range(780, 1000, 26)), "stone2")
S.D(rect(716, 430, 12, 30, 2) + line(722, 460, 722, 480), "bark")            # torch
S.D("M722 430Q708 408 720 386Q722 400 730 404Q736 414 722 430Z", "candle")
S.soft(circle(722, 412, 34))

# ── the statue on its pedestal ───────────────────────────────────────────
S.at(1600)
S.M(rect(880, 600, 100, 100, 3), "stone", step=40)
S.D(rect(870, 590, 120, 14, 3), "stone")
S.soft(line(880, 640, 980, 640) + line(880, 670, 980, 670))
S.M("M912 590V560Q904 548 910 530Q904 512 914 500Q920 486 930 486Q940 486 946 500Q956 512 950 530Q956 548 948 560V590Z", "gold", step=60)
S.fill(circle(924, 504, 2.4) + circle(936, 504, 2.4), "ink")
S.D("M920 540H940M924 556H936", None)

# ── bats ─────────────────────────────────────────────────────────────────
S.at(1700)
for x, y in ((1150, 238), (1188, 232), (1226, 240)):
    S.D(f"M{x} {y}V{y + 6}", None)
    S.D(f"M{x - 10} {y + 10}Q{x - 6} {y + 4} {x} {y + 6}Q{x + 6} {y + 4} {x + 10} {y + 10}Q{x + 6} {y + 24} {x} {y + 26}Q{x - 6} {y + 24} {x - 10} {y + 10}Z", "ink")

# ── the treasure chest ───────────────────────────────────────────────────
S.at(1800)
S.shadow(1200, 764, 120, 6)
S.M("M1090 640L1102 580H1298L1310 640Z", "rust", step=40)                    # open lid (back)
S.D(line(1102, 580, 1298, 580) + rect(1190, 588, 20, 22, 3), "gold")
rnd = random.Random(4)
coins = "".join(circle(rnd.uniform(1100, 1300), rnd.uniform(630, 668), rnd.uniform(6, 10)) for _ in range(34))
S.fill(coins, "gold")
S.soft(coins)
S.M(rect(1090, 660, 220, 100, 6), "rust", step=60)                          # chest body
S.D(rect(1090, 660, 220, 12, 3) + rect(1120, 660, 12, 100) + rect(1268, 660, 12, 100), "gold")
S.D(rect(1188, 690, 24, 26, 4), "gold")
S.fill(circle(1200, 702, 3), "ink")
S.D("M1150 616L1164 600L1178 616L1164 632Z", "red")                          # jewels
S.D("M1236 620L1248 606L1260 620L1248 634Z", "cyan")
S.D("M1110 630L1116 606L1128 620L1140 602L1152 620L1164 606L1170 630Z", "gold")   # crown
S.fill(circle(1140, 612, 3), "red")
S.D("".join(circle(1300 + i * 8, 700 + (i % 2) * 6, 4) for i in range(8)), "paper")   # pearl necklace
S.fill("".join(circle(x, 760, 6) for x in (1330, 1346, 1360)), "gold")       # spilled coins
S.soft("".join(circle(x, 760, 6) for x in (1330, 1346, 1360)))

# ── words ─────────────────────────────────────────────────────────────────
R, P = words(S)
R("cave", "cave", (0, 100, 1400, 700), (260, 470), "A1", "keɪv",
  "A big hole in the side of a hill or under the ground.", "They found the treasure deep in the cave.")
S.meta["zones"] = [
    dict(id="mouthz", chip="The entrance", box=[0, 240, 360, 540]),
    dict(id="middlez", chip="The rope and the trap", box=[480, 200, 400, 580]),
    dict(id="treasurez", chip="The treasure", box=[840, 280, 560, 500]),
]
S.meta["groups"] = {"cave": "The cave", "people": "The explorers", "danger": "Danger", "treasure": "The treasure"}

P("entrance", "cave entrance", "A2", "cave", (100, 420), (0, 244, 224, 456), "keɪv ˈentrəns", "noun",
  "The opening where you go into a cave.", "Light comes in through the cave entrance.")
P("jungle", "jungle", "A2", "cave", (60, 470), (0, 400, 220, 300), "ˈdʒʌŋɡl", "noun",
  "A thick forest in a hot country.", "Outside the cave there is thick jungle.")
P("vines", "vines", "B1", "cave", (93, 360), (36, 280, 170, 146), "vaɪnz", "noun",
  "Long climbing plants that hang down.", "Vines hang over the entrance.")
P("rocks", "rocks", "A1", "cave", (380, 420), (260, 340, 240, 160), "rɒks", "noun",
  "Big pieces of stone.", "The walls are made of rough rocks.")
P("stalactites", "stalactites", "B1", "cave", (520, 280), (286, 232, 980, 102), "ˈstæləktaɪts", "noun",
  "Pointed stones that hang down from the roof of a cave.", "Stalactites hang from the roof like icicles.")
P("web", "spider web", "A2", "cave", (270, 300), (234, 260, 98, 102), "ˈspaɪdə web", "noun",
  "A net that a spider makes.", "An old spider web hangs in the corner.", "cobweb")
P("hole", "hole in the roof", "A2", "cave", (640, 226), (598, 212, 84, 28), "ˌhəʊl ɪn ðə ˈruːf", "noun",
  "An opening in the top of the cave.", "They climbed in through a hole in the roof.")
P("sunlight", "sunlight", "A2", "cave", (590, 420), (540, 240, 200, 440), "ˈsʌnlaɪt", "noun",
  "The light from the sun.", "A beam of sunlight shines into the cave.")
P("footprints", "footprints", "A2", "cave", (310, 744), (222, 730, 180, 26), "ˈfʊtprɪnts", "noun",
  "Marks that feet leave on the ground.", "There are footprints in the sand.")
P("bats", "bats", "A1", "cave", (1188, 250), (1136, 228, 104, 42), "bæts", "noun",
  "Small flying animals that hang upside down and come out at night.", "Bats are sleeping on the roof.")
P("carvings", "carvings", "B1", "cave", (870, 330), (758, 288, 254, 124), "ˈkɑːvɪŋz", "noun",
  "Pictures or signs cut into stone.", "Ancient carvings cover the wall.")
P("torch", "torch", "A2", "cave", (722, 420), (700, 380, 44, 102), "tɔːtʃ", "noun",
  "A stick with fire at the end, for light.", "A torch is burning on the wall.")

P("explorer", "explorer", "A2", "people", (390, 700), (352, 560, 90, 200), "ɪkˈsplɔːrə", "noun",
  "A person who travels to find out about new places.", "The explorer is reading an old map.")
P("hat", "hat", "A1", "people", (398, 594), (374, 568, 44, 32), "hæt", "noun",
  "Something you wear on your head.", "He's wearing a brown hat.")
P("map", "map", "A1", "people", (446, 606), (418, 582, 58, 50), "mæp", "noun",
  "A drawing that shows where places are.", "The map shows where the treasure is.")
P("compass", "compass", "A2", "people", (374, 632), (362, 620, 24, 24), "ˈkʌmpəs", "noun",
  "A small tool with a needle that points north.", "He checks the compass.")
P("satchel", "bag", "A1", "people", (409, 675), (394, 660, 30, 28), "bæɡ", "noun",
  "A thing for carrying your things.", "He keeps his notebook in his bag.", "satchel")
P("rope", "rope", "A2", "people", (642, 330), (628, 220, 28, 390), "rəʊp", "noun",
  "Strong thick string.", "She's climbing down the rope.")
P("climber", "climber", "B1", "people", (654, 500), (620, 404, 76, 164), "ˈklaɪmə", "noun",
  "A person who climbs.", "The climber is almost at the bottom.")

P("trap", "trap", "B1", "danger", (700, 736), (528, 714, 224, 52), "træp", "noun",
  "Something made to catch or hurt people or animals.", "Watch out for the trap in the floor!")
P("spikes", "spikes", "B1", "danger", (604, 740), (550, 724, 186, 30), "spaɪks", "noun",
  "Sharp pointed pieces.", "The pit is full of stone spikes.")
P("stalagmites", "stalagmites", "B2", "danger", (800, 670), (440, 640, 640, 64), "ˈstæləɡmaɪts", "noun",
  "Pointed stones that grow up from the floor of a cave.", "Don't trip over the stalagmites.")

P("statue", "golden statue", "A2", "treasure", (930, 540), (900, 484, 60, 108), "ˌɡəʊldən ˈstætʃuː", "noun",
  "A figure made of gold.", "A small golden statue stands on the pedestal.")
P("pedestal", "pedestal", "B1", "treasure", (930, 650), (868, 588, 124, 112), "ˈpedɪstl", "noun",
  "A base that a statue stands on.", "Don't touch the statue on the pedestal!")
P("chest", "treasure chest", "A2", "treasure", (1150, 720), (1088, 578, 224, 184), "ˈtreʒə tʃest", "noun",
  "A big strong box full of treasure.", "The treasure chest is full of gold.")
P("coins", "gold coins", "A1", "treasure", (1230, 650), (1096, 624, 212, 50), "ˌɡəʊld ˈkɔɪnz", "noun",
  "Round pieces of gold money.", "There are hundreds of gold coins.")
P("jewels", "jewels", "A2", "treasure", (1248, 620), (1146, 598, 118, 38), "ˈdʒuːəlz", "noun",
  "Valuable stones like diamonds and rubies.", "Red and blue jewels shine in the chest.")
P("crown", "crown", "A1", "treasure", (1140, 620), (1108, 600, 64, 32), "kraʊn", "noun",
  "A gold ring that a king or queen wears on their head.", "There's even a crown in the chest!")
P("necklace", "necklace", "A2", "treasure", (1328, 704), (1294, 694, 66, 20), "ˈnekləs", "noun",
  "Jewellery that you wear round your neck.", "A pearl necklace hangs over the side.")

S.meta.update(
    view=[0, 170, 1400, 630],
    roomsTitle="Places",
    title="The Treasure Cave",
    kicker="Picture Studio · Adventure & Exploration",
    dek="Explorers inside an ancient cave: a rope from the roof, a spike trap, carvings and a chest of gold.",
    inspired="Inspired by adventure films",
    frames=["Go past the … and turn …", "Be careful! There's a … ", "Climb down the … to the …",
            "The treasure is behind / next to the …", "If you touch the …, the trap will …", "We found … !"],
)
TF = [
    ("There are bats on the roof of the cave.", True, "A1"),
    ("The explorer has got a map.", True, "A1"),
    ("The treasure chest is closed.", False, "A1"),
    ("The statue is gold.", True, "A1"),
    ("Someone is climbing down a rope.", True, "A2"),
    ("There is a torch next to the entrance.", False, "A2"),
    ("There is a crown in the chest.", True, "A2"),
    ("The explorer is wearing a hat.", True, "A2"),
    ("The trap is under the hole in the roof.", True, "B1"),
    ("The carvings are on the treasure chest.", False, "B1"),
    ("Vines hang over the cave entrance.", True, "B1"),
    ("The explorer is holding a compass in his left hand.", True, "B1"),
]
PROMPTS = {
    "A1": ["What is in the treasure chest? Write five things.",
           "Where are the explorers? What are they doing?",
           "What would you do with the treasure?"],
    "A2": ["Give directions from the entrance to the chest. Use: go past, turn, climb.",
           "Write the explorer's diary for the day they found the cave.",
           "Write a message to a friend about your adventure."],
    "B1": ["Tell the story of how they found the treasure - and what went wrong.",
           "What do the carvings mean? Invent a legend.",
           "Should treasure found by explorers go to a museum or to the explorers? Why?"],
}
finish(S, TF, PROMPTS)
