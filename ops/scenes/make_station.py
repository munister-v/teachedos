"""Picture Studio · The Train Station — the ticket hall and a platform with
a train waiting under the canopy. Writes data/scenes/station.json.

    python3 ops/scenes/make_station.py
"""
import os
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob

ROOT = os.path.dirname(os.path.abspath(__file__))
S = Scene("station", 1400, 800)
G = 760
PL = 716         # platform surface
HALL = (20, 420)

# ── sky and ground ────────────────────────────────────────────────────────
S.at(0)
S.sky(sun=(1300, 180))
S.H(wave(700, 200, 790, 200, 3, 5) + wave(716, 188, 770, 188, 2, 4))
S.fill(rect(0, G, 1400, 40), "earth")
S.M(line(0, G, 1400, G), step=0)

# ── ticket hall ───────────────────────────────────────────────────────────
S.at(150)
S.wallpaper((32, 360, 388, G - 360), "sand", "bricks", dado=50)
S.M(rect(20, 360, 12, G - 360), "ink", step=40)
S.M(rect(408, 360, 12, 190), "ink", step=40)
S.M(pts([(8, 362), (214, 270), (432, 362)], True), "brick", step=60)            # gable roof
S.M(pts([(8, 362), (432, 362), (432, 372), (8, 372)], True), "ink")
S.M(circle(214, 318, 22), "paper")                                              # station clock
S.D(circle(214, 318, 18))
S.D(line(214, 318, 214, 304) + line(214, 318, 224, 322))
S.D(circle(214, 318, 2.2), "ink")
S.M(rect(44, 420, 60, 100, 30), "glass")                                        # arched windows
S.M(rect(324, 420, 60, 100, 30), "glass")
S.D(line(74, 420, 74, 520) + line(354, 420, 354, 520))
# ticket office
S.M(rect(120, 440, 170, 140, 3), "wood")
S.D(rect(132, 452, 146, 20, 2), "ink")
S.fill(rect(140, 458, 80, 6) + rect(228, 458, 40, 6), "sun")
S.bust(206, 560, d=-1, coat="sky2")
S.D(rect(136, 480, 140, 80, 2), "glassa")
S.D(line(206, 480, 206, 560))
S.M(rect(118, 580, 174, 8, 2), "wood")
S.M(rect(122, 588, 166, 172, 2), "wood")
S.D(rect(190, 566, 32, 14, 2), "ink")                                          # speaking grille
S.soft("".join(line(194, y, 218, y) for y in (570, 574)))
# ticket machine
S.shadow(342, G, 26, 3)
S.M(rect(316, 600, 52, 160, 6), "steel")
S.D(rect(324, 612, 36, 30, 3), "lime")
S.soft(line(328, 620, 354, 620) + line(328, 628, 350, 628))
S.D(rect(326, 652, 32, 22, 2), "paper")
S.D(rect(334, 690, 18, 5, 2) + rect(330, 706, 26, 8, 2), "ink")
# passenger buying a ticket
S.shadow(284, G - 1, 20)
S.standing(284, G, coat="sky2", d=1, arms=[(318, 680)], legs="ink")
S.M(rect(250, 718, 30, 42, 5), "red")                                           # suitcase
S.D("M258 718V710H272V718")
S.D(rect(254, 758, 4, 3) + rect(272, 758, 4, 3), "ink")
# departures board
S.D(line(120, 372, 120, 382) + line(260, 372, 260, 382))
S.M(rect(90, 382, 200, 34, 3), "ink")
for i, y in enumerate((388, 398, 406)):
    S.fill(rect(98, y, 28, 4), "sun")
    S.fill(rect(132, y, 100, 4), "paper")
    S.fill(rect(238, y, 44, 4), "lime" if i != 1 else "red")

# ── the platform ──────────────────────────────────────────────────────────
S.at(900)
# overhead wire and gantry
S.D(line(420, 470, 1400, 470) + line(420, 476, 1400, 476))
for x in (560, 900, 1240):
    S.D(line(x, 476, x, 486))
# the train, behind the platform edge
S.at(1100)
S.shadow(820, PL, 400, 3)
for x0 in (440, 700, 960):                                                      # carriages
    S.M(rect(x0, 540, 252, 176, 12), "paper", step=60)
    S.fill(rect(x0, 640, 252, 14), "red")
    S.D(rect(x0, 640, 252, 14))
    S.D(rect(x0 + 110, 566, 36, 150, 3), "lime")                                 # doors
    S.D(line(x0 + 128, 566, x0 + 128, 716))
    S.D(rect(x0 + 114, 580, 12, 26, 2) + rect(x0 + 130, 580, 12, 26, 2), "glass")
    for wx in (x0 + 16, x0 + 60, x0 + 160, x0 + 204):
        S.D(rect(wx, 566, 34, 34, 6), "glass")
S.D(line(692, 600, 700, 600) + line(952, 600, 960, 600))
for x in (478, 598, 740, 860, 998, 1118):                                       # passengers inside
    S.D(circle(x + 13, 588, 7), ("wood", "skin2", "skin1", "skin3")[x % 4])
S.M("M1212 716V560Q1212 540 1232 540H1300Q1360 548 1392 640L1400 716Z", "paper", step=80)   # locomotive nose
S.fill("M1212 640H1368L1376 654H1212Z", "red")
S.D("M1300 552Q1350 560 1376 624H1312Q1300 590 1300 552Z", "glass")             # windscreen
S.bust(1330, 612, d=1, coat="sky2", k=0.8)                                       # driver
S.D("M1300 552Q1350 560 1376 624H1312Q1300 590 1300 552Z", None)
S.D(rect(1370, 672, 16, 10, 3), "sun")                                           # headlight
S.D(rect(1240, 566, 40, 40, 6), "glass")
S.D("M1250 540L1262 500H1300L1310 540" + line(1262, 500, 1300, 476))             # pantograph
# the platform itself
S.M(rect(420, PL, 980, G - PL, 1), "tint", step=60)
S.fill(rect(420, PL, 980, 7), "sun")                                             # yellow line
S.soft("".join(line(x, PL + 7, x - 6, G) for x in range(440, 1400, 60)))
# canopy on columns
S.at(1700)
S.M(pts([(420, 440), (1400, 440), (1400, 456), (420, 456)], True), "steel", step=80)
S.soft("".join(line(x, 440, x + 20, 456) for x in range(430, 1400, 30)))
for x in (520, 860, 1180):
    S.M(rect(x - 5, 456, 10, PL - 456), "red")
    S.D(rect(x - 12, PL - 8, 24, 8, 2), "ink")
S.D(line(640, 456, 640, 470) + line(740, 456, 740, 470))                         # platform sign
S.M(rect(624, 470, 132, 28, 4), "sky2")
S.D(circle(646, 484, 9), "paper")
S.fill(rect(644, 478, 4, 12), "ink")
S.fill(rect(664, 482, 80, 4), "paper")
S.M(rect(1010, 470, 60, 30, 4), "paper")                                         # platform clock
S.D(circle(1040, 485, 11))
S.D(line(1040, 485, 1040, 477) + line(1040, 485, 1046, 488))
S.D(rect(1096, 470, 8, 20, 2) + "M1092 490L1108 490L1112 504L1088 504Z", "steel")   # loudspeaker
S.soft(wave(1114, 494, 1128, 488, 1, 3) + wave(1116, 500, 1134, 498, 1, 3))

# ── on the platform ───────────────────────────────────────────────────────
S.at(2100)
S.D(rect(470, 652, 34, 64, 2), "paper")                                          # timetable poster on a post
S.soft("".join(line(474, y, 500, y) for y in range(660, 704, 6)))
S.D(line(487, 716, 487, G))
S.M(rect(560, 712, 90, 6, 2), "wood")                                            # bench
S.D(rect(560, 692, 90, 5, 2) + line(566, 718, 566, G) + line(644, 718, 644, G), "wood")
S.sitting(620, 712, G, coat="lav2", legs="ink", d=-1, arms=[(598, 694)], k=0.95)
S.D(rect(590, 686, 16, 12, 2), "paper")                                          # a newspaper
S.D(rect(670, 718, 22, 30, 3) + rect(668, 714, 26, 5, 2), "leaf")                # bin
S.shadow(790, G - 1, 20)
S.standing(790, G, coat="leaf", d=-1, arms=[(768, 690)], legs="sky2")           # passenger with a backpack
S.M("M800 648Q800 632 810 630Q820 632 820 648V686H800Z", "sun")
S.D(rect(756, 684, 16, 10, 2), "lime")                                           # ticket in hand
S.shadow(950, G - 1, 20)
S.standing(950, G, coat="ink", d=-1, arms=[(930, 660), (968, 688)], legs="ink", cap="ink")   # guard
S.D(line(930, 660, 928, 622))
S.M(pts([(928, 622), (904, 626), (906, 640), (928, 638)], True), "lime")        # flag
pos = 950
S.D(rect(pos - 4, 666, 9, 5, 2), "sun")                                          # whistle
S.shadow(1100, G - 1, 20)
S.standing(1100, G, coat="blush2", d=1, arms=[(1122, 700)], legs="sky2")        # running for the train
S.M(rect(1118, 700, 26, 20, 4), "sky2")

# ── words ─────────────────────────────────────────────────────────────────
def R(rid, word, box, label, level, ipa, d, ex, us=None):
    card = dict(level=level, ipa=ipa, pos="noun", def_=d, ex=ex)
    if us:
        card["us"] = us
    S.room(rid, word, box, label, **card)


R("station", "station", (0, 260, 1400, 500), (30, 384), "A1", "ˈsteɪʃn",
  "A place where trains stop so people can get on and off.", "Let's meet at the station at ten.", "train station")
R("tickethall", "ticket hall", (32, 360, 388, 400), (330, 400), "B1", "ˈtɪkɪt hɔːl",
  "The big room in a station where you buy tickets.", "Wait for me in the ticket hall.")
R("platform", "platform", (420, 440, 980, 320), (440, 530), "A2", "ˈplætfɔːm",
  "The raised place next to the track where you get on the train.", "The train to London leaves from platform 1.", "track")
S.meta["zones"] = [
    dict(id="hallz", chip="Ticket hall", box=[0, 260, 440, 500]),
    dict(id="trainz", chip="The train", box=[430, 460, 970, 300]),
    dict(id="peoplez", chip="People", box=[540, 600, 600, 160]),
]
S.meta["groups"] = {"hall": "Ticket hall", "train": "The train", "platform": "On the platform", "people": "People"}


def P(pid, word, level, room, pin, box, ipa, pos, d, ex, us=None):
    card = dict(level=level, room=room, ipa=ipa, pos=pos, def_=d, ex=ex)
    if us:
        card["us"] = us
    S.part(pid, word, pin, box, **card)


P("ticketoffice", "ticket office", "B1", "hall", (160, 540), (116, 438, 178, 150), "ˈtɪkɪt ˌɒfɪs", "noun",
  "The window where you buy tickets from a person.", "The ticket office opens at six.", "ticket window")
P("clerk", "ticket clerk", "B1", "hall", (206, 526), (186, 502, 42, 60), "ˈtɪkɪt klɑːk", "noun",
  "The person who sells tickets.", "The ticket clerk gave me a timetable.", "ticket agent")
P("machine", "ticket machine", "B1", "hall", (342, 664), (314, 598, 56, 162), "ˈtɪkɪt məˌʃiːn", "noun",
  "A machine where you buy tickets yourself.", "The ticket machine takes cards and coins.")
P("board", "departures board", "A2", "hall", (190, 398), (88, 380, 204, 38), "dɪˈpɑːtʃəz bɔːd", "noun",
  "A screen that shows the trains, times and platforms.", "The departures board says our train is late.")
P("clock", "clock", "A1", "hall", (214, 318), (190, 294, 48, 48), "klɒk", "noun",
  "A thing that shows the time.", "The station clock says ten to nine.")
P("suitcase", "suitcase", "A1", "hall", (265, 740), (248, 704, 34, 56), "ˈsuːtkeɪs", "noun",
  "A case with a handle for carrying clothes when you travel.", "My suitcase has wheels.")
P("window", "window", "A1", "hall", (74, 470), (44, 420, 60, 100), "ˈwɪndəʊ", "noun",
  "An opening in a wall with glass.", "The station has tall arched windows.")

P("train", "train", "A1", "train", (820, 620), (438, 470, 962, 246), "treɪn", "noun",
  "Carriages pulled along a railway.", "The train to Manchester is on platform 1.")
P("carriage", "carriage", "B1", "train", (500, 624), (440, 540, 252, 176), "ˈkærɪdʒ", "noun",
  "One of the parts of a train where people sit.", "Our seats are in carriage C.", "car")
P("doors", "doors", "A1", "train", (838, 650), (808, 564, 42, 152), "dɔːz", "noun",
  "The parts of the train that open to let people on and off.", "Mind the doors!")
P("driver", "train driver", "A2", "train", (1331, 575), (1310, 556, 44, 58), "ˈtreɪn ˌdraɪvə", "noun",
  "The person who drives the train.", "The train driver waved at the children.", "engineer")
P("wires", "overhead wires", "B1", "train", (700, 473), (420, 466, 980, 14), "ˌəʊvəhed ˈwaɪəz", "noun",
  "The wires above the track that give electricity to the train.", "Trees fell on the overhead wires in the storm.")
P("headlight", "headlight", "A2", "train", (1378, 677), (1366, 668, 24, 18), "ˈhedlaɪt", "noun",
  "A bright light at the front of a train.", "We saw the headlight of the train in the tunnel.")

P("canopy", "canopy", "B1", "platform", (980, 448), (420, 436, 980, 22), "ˈkænəpi", "noun",
  "A roof over the platform.", "Stand under the canopy - it's raining.")
P("sign", "platform sign", "A2", "platform", (700, 484), (620, 466, 140, 34), "ˈplætfɔːm saɪn", "noun",
  "A sign with the name or number of the platform.", "The sign says platform 1.")
P("yellowline", "yellow line", "B1", "platform", (440, 719), (420, 714, 980, 10), "ˌjeləʊ ˈlaɪn", "noun",
  "The line on the edge of the platform. Stand behind it!", "Please stand behind the yellow line.")
P("bench", "bench", "A2", "platform", (646, 716), (556, 688, 98, 72), "bentʃ", "noun",
  "A long seat for two or more people.", "An old woman is reading on the bench.")
P("newspaper", "newspaper", "A2", "platform", (598, 692), (586, 682, 24, 20), "ˈnjuːzpeɪpə", "noun",
  "Printed pages of news, sold every day.", "He buys a newspaper for the journey.")
P("timetable", "timetable", "B1", "platform", (487, 680), (466, 648, 42, 70), "ˈtaɪmteɪbl", "noun",
  "A list of the times when trains leave and arrive.", "Look at the timetable - the next train is at 9.15.", "schedule")
P("bin", "bin", "A2", "platform", (681, 734), (666, 710, 30, 40), "bɪn", "noun",
  "A container for rubbish.", "Put your cup in the bin.", "trash can")
P("loudspeaker", "loudspeaker", "B1", "platform", (1100, 496), (1086, 466, 50, 42), "ˌlaʊdˈspiːkə", "noun",
  "A thing that makes announcements loud enough for everyone to hear.", "An announcement came over the loudspeaker.")
P("platclock", "platform clock", "A2", "platform", (1040, 485), (1006, 466, 68, 36), "ˈplætfɔːm klɒk", "noun",
  "A clock on the platform.", "Check the platform clock - two minutes to go!")

P("passenger", "passenger", "A2", "people", (790, 700), (770, 640, 54, 120), "ˈpæsɪndʒə", "noun",
  "A person travelling on a train, bus or plane.", "The passengers are waiting on the platform.")
P("backpack", "backpack", "A1", "people", (810, 660), (798, 628, 24, 60), "ˈbækpæk", "noun",
  "A bag you carry on your back.", "She put her ticket in her backpack.", "rucksack")
P("ticket", "ticket", "A1", "people", (764, 689), (754, 682, 20, 14), "ˈtɪkɪt", "noun",
  "A piece of paper or card that shows you have paid to travel.", "Have your tickets ready, please.")
P("guard", "guard", "B1", "people", (950, 700), (928, 636, 46, 124), "ɡɑːd", "noun",
  "The person on the train who checks tickets and tells the driver when to go.", "The guard blew the whistle.", "conductor")
P("flag", "flag", "A2", "people", (916, 630), (902, 618, 30, 26), "flæɡ", "noun",
  "A piece of cloth on a stick used as a signal.", "The guard waved a green flag.")
P("whistle", "whistle", "B1", "people", (950, 668), (944, 662, 14, 12), "ˈwɪsl", "noun",
  "A small thing you blow to make a loud high sound.", "When the whistle blows, the doors close.")


S.meta.update(
    view=[0, 250, 1400, 550],
    roomsTitle="Places in the station",
    title="The Train Station",
    kicker="Picture Studio · Travel",
    dek="The ticket hall and a platform with a train waiting under the canopy.",
    frames=["A single / return ticket to …, please.", "What time does the train to … leave?",
            "Which platform does it leave from?", "The train is delayed / on time.", "You have to change at …", "Mind the …!"],
)
TF = [
    ("The train is at the platform.", True, "A1"),
    ("There is a clock on the station building.", True, "A1"),
    ("The passenger in the ticket hall has got a red suitcase.", True, "A1"),
    ("There are two people on the bench.", False, "A1"),
    ("The train has three carriages.", True, "A2"),
    ("The ticket machine is next to the ticket office.", True, "A2"),
    ("The guard is holding a flag.", True, "A2"),
    ("The platform sign says platform 2.", False, "A2"),
    ("Someone is reading a newspaper on the bench.", True, "A2"),
    ("The doors of the train are yellow.", False, "B1"),
    ("The passengers should stand behind the yellow line.", True, "B1"),
    ("The loudspeaker is hanging from the canopy.", True, "B1"),
    ("The train gets electricity from the overhead wires.", True, "B1"),
    ("The departures board is on the platform.", False, "B1"),
]
PROMPTS = {
    "A1": ["How do you travel to school or work? Do you ever take the train?",
           "Look at the platform. Write five sentences about the people.",
           "Where do you want to go by train?"],
    "A2": ["Write the dialogue at the ticket office: buy a return ticket.",
           "Describe a train journey you remember. Use the past simple.",
           "Your train is late. Write a message to the friend who is meeting you."],
    "B1": ["Is the train better than the car or the plane? Compare them.",
           "Write an announcement for a delayed train, and what passengers should do.",
           "Should public transport be free? Give your reasons."],
}

for coll in (S.rooms, S.parts):
    for c in coll:
        c["def"] = c.pop("def_")

os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
out = os.path.normpath(os.path.join(ROOT, "..", "..", "data", "scenes"))
S.save(os.path.join(out, "station.json"), truefalse=[dict(s=s, a=a, level=l) for s, a, l in TF], prompts=PROMPTS)
S.svg(os.path.join(ROOT, "out", "station.svg"))
lv = {}
for p in S.parts + S.rooms:
    lv[p["level"]] = lv.get(p["level"], 0) + 1
print(f"station: {len(S.items)} items, {len(S.parts)} parts + {len(S.rooms)} rooms, levels {lv}, "
      f"{os.path.getsize(os.path.join(out, 'station.json')) // 1024} KB")
