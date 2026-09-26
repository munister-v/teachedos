"""Picture Studio · The Park — a sunny park: the playground, a pond with a
bridge and ducks, a picnic on the grass, an ice cream van and people doing
things. Writes data/scenes/park.json.

    python3 ops/scenes/make_park.py
"""
import math
import os
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob

ROOT = os.path.dirname(os.path.abspath(__file__))
S = Scene("park", 1400, 800)
G = 740          # ground line (the grass in front goes down to the bottom)


def duck(x, y, d=1, k=1.0):
    S.D(f"M{x - 12 * k * d} {y}Q{x - 14 * k * d} {y - 10 * k} {x} {y - 9 * k}Q{x + 8 * k * d} {y - 9 * k} {x + 10 * k * d} {y - 3 * k}"
        f"Q{x + 12 * k * d} {y + 2 * k} {x} {y + 3 * k}Q{x - 10 * k * d} {y + 3 * k} {x - 12 * k * d} {y}Z", "paper")
    S.D(circle(x + 9 * k * d, y - 12 * k, 5 * k), "leaf2")
    S.D(pts([(x + 13 * k * d, y - 12 * k), (x + 19 * k * d, y - 10 * k), (x + 13 * k * d, y - 9 * k)], True), "sun")
    S.fill(circle(x + 10 * k * d, y - 13 * k, 1), "ink")


# ── sky, hills, grass ─────────────────────────────────────────────────────
S.at(0)
S.sky(sun=(1180, 300))
S.H(wave(200, 290, 300, 290, 3, 5) + wave(216, 278, 270, 278, 2, 4))
S.H(wave(760, 262, 840, 262, 3, 4))
S.fill("M0 520Q300 440 620 500Q940 430 1400 500V800H0Z", "leaf3")            # distant hills
S.fill("M0 600Q400 560 800 590Q1100 560 1400 590V800H0Z", "grass")
S.soft(wave(0, 600, 1400, 590, 8, 6))
# kite
S.M(pts([(420, 262), (446, 292), (420, 332), (394, 292)], True), "red")
S.D(line(420, 262, 420, 332) + line(394, 292, 446, 292))
S.D("M420 332Q440 380 430 420Q420 470 470 520")
for y in (350, 374, 398):
    S.D(pts([(420, y), (428, y + 6), (420, y + 10), (412, y + 6)], True), "lime")

# ── trees at the back ─────────────────────────────────────────────────────
S.at(300)
S.tree(90, 610, 470, 70, 80, seed=21)
S.tree(1320, 610, 460, 80, 90, seed=24)
S.tree(640, 590, 470, 50, 60, seed=27)

# ── path ──────────────────────────────────────────────────────────────────
S.fill("M560 800Q600 700 720 660Q860 620 1000 640L1030 660Q880 650 760 690Q650 730 640 800Z", "sand2")
S.soft(wave(600, 790, 760, 680, 4, 3))

# ── playground (left) ─────────────────────────────────────────────────────
S.at(600)
S.M(rect(30, 700, 220, 40, 6), "sun")                                           # sandpit
S.D(rect(30, 700, 220, 8, 3), "wood")
S.soft("".join(circle(x, 724, 1) for x in range(50, 240, 12)))
S.D(rect(60, 686, 20, 16, 2), "red")                                            # bucket
S.D(pts([(84, 700), (100, 690), (104, 694), (90, 704)], True), "sky2")          # spade
# swings
S.M(pts([(60, G), (90, 520), (96, 520), (70, G)], True), "red")
S.M(pts([(240, G), (210, 520), (204, 520), (230, G)], True), "red")
S.M(rect(84, 512, 132, 10, 4), "red")
for sx in (120, 180):
    S.D(line(sx - 10, 522, sx - 10, 610) + line(sx + 10, 522, sx + 10, 610))
    S.D(rect(sx - 14, 610, 28, 6, 2), "ink")
S.sitting(120, 610, 640, coat="lime", legs="sky2", d=1, arms=[(112, 574)], k=0.75)   # a child on a swing
# slide
S.at(900)
S.M(pts([(280, G), (290, 560), (298, 560), (290, G)], True), "sky2")            # ladder
for y in range(580, G, 22):
    S.D(line(284, y, 300, y))
S.M(rect(290, 552, 40, 10, 3), "sky2")
S.M("M320 552Q360 560 380 640Q396 700 440 736H460L456 726Q420 712 402 646Q384 570 332 552Z", "lime")   # slide
S.D(line(326, 562, 326, G) + line(446, 726, 446, G))
# see-saw
S.M(pts([(470, G), (486, 712), (502, G)], True), "wood")
S.M(pts([(430, 690), (546, 730), (544, 736), (428, 696)], True), "red")
S.D(rect(440, 682, 6, 12, 2) + rect(530, 720, 6, 12, 2), "ink")

# ── pond, bridge, ducks, boat ─────────────────────────────────────────────
S.at(1300)
S.M(ellipse(850, 740, 190, 36), "sky2", step=60)
S.soft(wave(700, 740, 820, 740, 3, 2) + wave(860, 750, 980, 748, 3, 2))
S.fill(ellipse(850, 740, 190, 36), "glassa")
for x, y in ((700, 730), (990, 736)):                                           # reeds
    S.D("".join(line(x + i * 5, y, x + i * 5 + (i - 2) * 2, y - 26 - (i % 2) * 8) for i in range(5)), None)
S.M("M720 720Q850 640 980 720L968 724Q850 656 732 724Z", "wood")                # bridge
S.D("M730 700Q850 624 970 700" + "".join(line(x, 720 - 60 * (1 - ((x - 850) / 130) ** 2), x, 700 - 70 * (1 - ((x - 850) / 130) ** 2)) for x in range(750, 960, 20)))
duck(790, 752, d=1)
duck(826, 758, d=1, k=0.7)
duck(912, 748, d=-1)
S.M("M930 770H990L982 780H938Z", "red")                                          # toy boat
S.D(line(958, 770, 958, 744) + pts([(958, 746), (976, 766), (958, 766)], True), "paper")

# ── fountain ──────────────────────────────────────────────────────────────
S.at(1700)
S.M(ellipse(1180, 700, 70, 14), "steel")
S.M(rect(1110, 686, 140, 16, 6), "steel")
S.fill(ellipse(1180, 688, 62, 8), "sky2")
S.D(rect(1172, 630, 16, 58, 3), "steel")
S.M(ellipse(1180, 630, 28, 6), "steel")
S.D("M1180 624Q1160 590 1150 628M1180 624Q1200 590 1210 628M1180 624V580", "sky2")
S.soft(wave(1180, 580, 1150, 630, 2, 3) + wave(1180, 580, 1210, 630, 2, 3))

# ── picnic ────────────────────────────────────────────────────────────────
S.at(2000)
S.fill(pts([(430, 790), (580, 790), (600, 766), (450, 766)], True), "red")      # blanket
S.soft("".join(line(x, 766, x - 20, 790) for x in range(470, 600, 20)) + line(440, 778, 590, 778))
S.D("M470 770V752Q470 744 480 744H512Q522 744 522 752V770Z", "wood")          # picnic basket
S.D("M478 744Q496 726 514 744")
S.D(rect(534, 764, 20, 6, 2) + circle(544, 760, 6), "paper")                   # sandwich, plate
S.D(circle(572, 764, 6), "red")
S.sitting(588, 776, 796, coat="sky2", legs="ink", d=-1, arms=[(560, 758)], k=0.85)

# ── people on the path and on the grass ───────────────────────────────────
S.at(2400)
S.shadow(700, 720, 18)
S.standing(700, 720, coat="lime", d=1, arms=[(716, 670), (684, 690)], legs="ink", k=0.95)   # jogger
S.D(rect(690, 658, 20, 3, 1), "sky2")
S.shadow(1030, 700, 18)
S.standing(1030, 700, coat="lav2", d=-1, arms=[(1008, 660)], legs="ink", k=0.95)            # dog walker
S.D("M1008 660Q990 680 984 694")
S.D("M960 694Q962 680 976 682L990 684Q996 678 1000 684Q1002 694 994 696V700H990V696H968V700H964V696Q958 698 960 694Z", "hairb")   # dog
S.fill(circle(998, 686, 1), "ink")
S.shadow(1290, 700, 18)
S.standing(1290, 700, coat="blush2", d=1, arms=[(1312, 640)], legs="sky2", k=0.95)          # eating ice cream
S.M(pts([(1308, 640), (1316, 640), (1312, 656)], True), "sand2")
S.D(circle(1312, 634, 6), "blush2")
# bench and bin
S.M(rect(1080, 632, 80, 6, 2), "wood")
S.D(rect(1080, 614, 80, 5, 2) + rect(1080, 622, 80, 5, 2) + line(1086, 638, 1086, 662) + line(1154, 638, 1154, 662), "wood")
S.D(rect(1164, 636, 18, 26, 3) + rect(1162, 632, 22, 5, 2), "leaf")
# lamp post
S.D(rect(1052, 480, 5, 180), "ink")
S.M(pts([(1044, 470), (1066, 470), (1062, 486), (1048, 486)], True), "ink")
S.D(ellipse(1055, 486, 6, 2), "sun")
# flower bed
S.fill(ellipse(300, 780, 90, 14), "brick")
for i, x in enumerate(range(222, 380, 14)):
    S.D(line(x, 780, x, 764) + circle(x, 760, 5), ("red", "sun", "lime", "blush2")[i % 4])
# ice cream van
S.at(2800)
S.shadow(1340, 612, 60, 4)
S.M("M1270 610V560Q1270 540 1290 540H1380Q1392 540 1396 556L1400 580V610Z", "blush2", step=60)
S.D(rect(1292, 552, 50, 30, 3), "glass")
S.D(rect(1288, 580, 58, 4), "paper")
S.M(pts([(1312, 540), (1316, 516), (1326, 516), (1322, 540)], True), "sand2")   # giant cone on the roof
S.D(circle(1320, 512, 8), "sun")
S.D(circle(1296, 612, 9) + circle(1380, 612, 9), "ink")

# ── words ─────────────────────────────────────────────────────────────────
def R(rid, word, box, label, level, ipa, d, ex, us=None):
    card = dict(level=level, ipa=ipa, pos="noun", def_=d, ex=ex)
    if us:
        card["us"] = us
    S.room(rid, word, box, label, **card)


R("park", "park", (0, 240, 1400, 560), (20, 264), "A1", "pɑːk",
  "A big public garden where people go to walk, play and relax.", "Let's go to the park on Sunday.")
R("playground", "playground", (20, 500, 540, 250), (30, 490), "A2", "ˈpleɪɡraʊnd",
  "A place in a park with things for children to play on.", "The kids are playing in the playground.")
R("pond", "pond", (660, 700, 380, 80), (870, 706), "A2", "pɒnd",
  "A small area of water.", "There are ducks on the pond.")
S.meta["zones"] = [
    dict(id="playz", chip="Playground", box=[20, 480, 560, 300]),
    dict(id="pondz", chip="Pond & picnic", box=[420, 620, 620, 180]),
    dict(id="rightz", chip="Fountain & van", box=[980, 440, 420, 360]),
    dict(id="skyz", chip="Up in the sky", box=[160, 240, 1100, 200]),
]
S.meta["groups"] = {"play": "Playground", "water": "Pond", "picnic": "Picnic", "people": "People", "park": "In the park"}


def P(pid, word, level, room, pin, box, ipa, pos, d, ex, us=None):
    card = dict(level=level, room=room, ipa=ipa, pos=pos, def_=d, ex=ex)
    if us:
        card["us"] = us
    S.part(pid, word, pin, box, **card)


P("swings", "swings", "A2", "play", (180, 612), (56, 506, 190, 234), "swɪŋz", "noun",
  "Seats hanging on chains or ropes that go backwards and forwards.", "Push me higher on the swings!")
P("slide", "slide", "A2", "play", (400, 660), (280, 546, 182, 194), "slaɪd", "noun",
  "A smooth slope that children slide down.", "She went down the slide ten times.")
P("seesaw", "see-saw", "B1", "play", (488, 716), (426, 678, 124, 62), "ˈsiː sɔː", "noun",
  "A long board that goes up and down with a child on each end.", "You need two people for the see-saw.", "teeter-totter")
P("sandpit", "sandpit", "B1", "play", (180, 724), (28, 696, 224, 46), "ˈsændpɪt", "noun",
  "A place filled with sand for children to play in.", "They built a castle in the sandpit.", "sandbox")
P("bucket", "bucket and spade", "A2", "play", (70, 692), (56, 682, 52, 24), "ˈbʌkɪt ən ˈspeɪd", "noun",
  "A small container and a small shovel for playing with sand.", "Don't forget your bucket and spade!", "pail and shovel")
P("child", "child", "A1", "play", (122, 586), (102, 540, 40, 104), "tʃaɪld", "noun",
  "A young boy or girl.", "A child is playing on the swings.")
P("kite", "kite", "A2", "park", (420, 292), (390, 258, 60, 160), "kaɪt", "noun",
  "A light frame covered in cloth that flies in the wind on a long string.", "It's windy - let's fly a kite!")
P("tree", "tree", "A1", "park", (90, 470), (16, 380, 150, 230), "triː", "noun",
  "A tall plant with a trunk, branches and leaves.", "We sat in the shade of a big tree.")
P("grass", "grass", "A1", "park", (220, 640), (0, 590, 1400, 210), "ɡrɑːs", "noun",
  "The short green plant that covers the ground in parks.", "Please keep off the grass.")
P("path", "path", "A2", "park", (615, 748), (560, 630, 470, 170), "pɑːθ", "noun",
  "A narrow way for walking.", "Follow the path to the pond.")
P("flowers", "flowers", "A1", "park", (300, 764), (210, 752, 180, 42), "ˈflaʊəz", "noun",
  "The coloured part of a plant.", "Look at the lovely flowers!")
P("fountain", "fountain", "B1", "park", (1180, 660), (1108, 574, 144, 142), "ˈfaʊntɪn", "noun",
  "A structure that sends water up into the air.", "Children threw coins into the fountain.")
P("bench", "bench", "A2", "park", (1120, 626), (1078, 610, 86, 54), "bentʃ", "noun",
  "A long seat for two or more people.", "Let's sit on that bench.")
P("bin", "bin", "A2", "park", (1173, 648), (1160, 630, 26, 34), "bɪn", "noun",
  "A container for rubbish.", "Put your rubbish in the bin.", "trash can")
P("lamppost", "lamp post", "B1", "park", (1055, 520), (1040, 466, 30, 196), "ˈlæmp pəʊst", "noun",
  "A tall post with a light at the top.", "Meet me by the lamp post.", "streetlight")
P("sun", "sun", "A1", "park", (1180, 300), (1130, 250, 100, 100), "sʌn", "noun",
  "The star in the sky that gives us light and heat.", "The sun is shining today.")
P("clouds", "clouds", "A1", "park", (250, 288), (190, 266, 120, 34), "klaʊdz", "noun",
  "White or grey shapes in the sky, made of water.", "There are a few clouds in the sky.")
P("hills", "hills", "A2", "park", (300, 486), (0, 430, 1400, 90), "hɪlz", "noun",
  "Areas of high land, lower than mountains.", "You can see the hills from the park.")

P("ducks", "ducks", "A1", "water", (792, 740), (774, 734, 70, 30), "dʌks", "noun",
  "Birds that swim on water.", "We fed the ducks at the pond.")
P("bridge", "bridge", "A2", "water", (850, 650), (716, 628, 268, 100), "brɪdʒ", "noun",
  "A structure that goes over water so you can cross it.", "Walk over the bridge to the other side.")
P("boat", "toy boat", "A2", "water", (962, 774), (928, 740, 64, 42), "ˌtɔɪ ˈbəʊt", "noun",
  "A small boat for playing with on water.", "His toy boat sailed across the pond.")
P("reeds", "reeds", "B1", "water", (712, 712), (694, 696, 30, 36), "riːdz", "noun",
  "Tall thin plants that grow at the edge of water.", "A duck is hiding in the reeds.")

P("blanket", "picnic blanket", "A2", "picnic", (452, 784), (428, 764, 174, 28), "ˈpɪknɪk ˌblæŋkɪt", "noun",
  "A blanket you sit on to eat outside.", "Spread the picnic blanket on the grass.")
P("basket", "picnic basket", "A2", "picnic", (496, 758), (468, 724, 56, 48), "ˈpɪknɪk ˌbɑːskɪt", "noun",
  "A basket for carrying food to a picnic.", "What's in the picnic basket?", "picnic hamper")
P("sandwich", "sandwich", "A1", "picnic", (544, 764), (532, 752, 26, 20), "ˈsænwɪdʒ", "noun",
  "Two pieces of bread with food between them.", "I made cheese sandwiches for the picnic.")

P("jogger", "jogger", "B1", "people", (700, 660), (678, 604, 44, 118), "ˈdʒɒɡə", "noun",
  "A person who runs slowly for exercise.", "Joggers run round the park every morning.", "runner")
P("dog", "dog", "A1", "people", (978, 688), (958, 676, 44, 26), "dɒɡ", "noun",
  "An animal that people keep as a pet.", "She walks her dog in the park every day.")
P("icecream", "ice cream", "A1", "people", (1312, 640), (1302, 624, 20, 34), "ˌaɪs ˈkriːm", "noun",
  "A sweet frozen food made from milk.", "Can I have a strawberry ice cream?")
P("van", "ice cream van", "A2", "people", (1350, 570), (1266, 504, 134, 118), "ˌaɪs ˈkriːm væn", "noun",
  "A van that sells ice cream and plays music.", "I can hear the ice cream van!", "ice cream truck")


S.meta.update(
    view=[0, 230, 1400, 570],
    roomsTitle="Places in the park",
    title="The Park",
    kicker="Picture Studio · Free time",
    dek="A sunny day in the park: the playground, the pond, a picnic and people having fun.",
    frames=["Someone is …ing", "There is a … next to the …", "On sunny days I like to …",
            "Let's … !", "Can we go on the …?", "In the park you can …"],
)
TF = [
    ("The sun is shining.", True, "A1"),
    ("There are three ducks on the pond.", True, "A1"),
    ("A child is on the slide.", False, "A1"),
    ("The kite is red.", True, "A1"),
    ("Someone is walking a dog.", True, "A2"),
    ("The picnic blanket is on the bridge.", False, "A2"),
    ("There is a bucket and spade in the sandpit.", True, "A2"),
    ("A woman is eating an ice cream near the van.", True, "A2"),
    ("The fountain is next to the playground.", False, "A2"),
    ("The jogger is running along the path.", True, "B1"),
    ("There is a toy boat on the pond.", True, "B1"),
    ("The see-saw is between the slide and the swings.", False, "B1"),
    ("The bench is next to a bin.", True, "B1"),
]
PROMPTS = {
    "A1": ["What can you do in the park? Write five sentences.",
           "What are the people in the picture doing? Use the present continuous.",
           "Is there a park near your home? What is in it?"],
    "A2": ["Plan a picnic: who is coming, what food you'll bring, what you'll do.",
           "Describe a perfect Sunday in the park.",
           "Write park rules: what you can and can't do."],
    "B1": ["Why are parks important in cities? Give three reasons.",
           "The council wants to build flats on your local park. Write a letter against it.",
           "Describe your favourite place outdoors and how it makes you feel."],
}

for coll in (S.rooms, S.parts):
    for c in coll:
        c["def"] = c.pop("def_")

os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
out = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "scenes"))
S.save(os.path.join(out, "park.json"), truefalse=[dict(s=s, a=a, level=l) for s, a, l in TF], prompts=PROMPTS)
S.svg(os.path.join(ROOT, "out", "park.svg"))
lv = {}
for p in S.parts + S.rooms:
    lv[p["level"]] = lv.get(p["level"], 0) + 1
print(f"park: {len(S.items)} items, {len(S.parts)} parts + {len(S.rooms)} rooms, levels {lv}, "
      f"{os.path.getsize(os.path.join(out, 'park.json')) // 1024} KB")
