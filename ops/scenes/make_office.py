"""Picture Studio · The Coworking Office — a modern shared office: big windows
over the city, hot desks, a whiteboard brainstorm with sticky notes, a coffee
corner and a glass meeting room with a video call on the screen.
Writes data/scenes/office.json.

    python3 ops/scenes/make_office.py
"""
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob
from common import words, finish

S = Scene("office", 1400, 800)
G = 690
TOP = 120

# ── room ──────────────────────────────────────────────────────────────────
S.at(0)
S.fill(rect(0, 0, 1400, 800), "tint")
S.wallpaper((0, TOP, 1400, G - TOP), "wall", None)
S.fill(rect(0, G, 1400, 110), "wood")
S.soft("".join(line(0, y, 1400, y) for y in range(G + 14, 800, 16)))
S.M(line(0, G, 1400, G), step=0)
S.fill("".join(rect(x, TOP, 120, 8, 3) for x in (140, 500, 860, 1220)), "paper")   # ceiling lights
S.soft("".join(line(x + 60, TOP + 8, x + 60, TOP + 20) for x in (140, 500, 860, 1220)))

# ── big windows over the city ────────────────────────────────────────────
S.at(150)
S.M(rect(60, 160, 540, 300, 4), "skyg", step=60)
S.fill("M60 460V360H110V320H160V380H210V290H270V350H330V260H380V340H440V300H500V370H560V330H600V460Z", "sky2")
S.fill("".join(rect(x, y, 8, 10) for x in range(222, 262, 14) for y in range(304, 350, 18)), "paper")
S.fill("".join(rect(x, y, 8, 10) for x in range(340, 372, 14) for y in range(276, 336, 18)), "paper")
S.M(rect(60, 160, 540, 300, 4), None)
S.D(line(240, 160, 240, 460) + line(420, 160, 420, 460), "paper")
S.M(rect(52, 460, 556, 12, 3), "paper")
S.fill(circle(520, 210, 20), "sun")

# ── calendar and clock ───────────────────────────────────────────────────
S.at(300)
S.D(rect(640, 176, 70, 80, 3), "paper")
S.fill(rect(640, 176, 70, 16), "red")
S.soft("".join(line(646, y, 704, y) for y in (206, 220, 234, 248)) + "".join(line(x, 196, x, 252) for x in (660, 674, 688)))
S.D(circle(681, 227, 8), None)                                                  # the deadline circled
S.D(circle(980, 206, 26), "paper")
S.D(line(980, 206, 980, 190) + line(980, 206, 992, 212))
S.fill(circle(980, 206, 2.4), "ink")

# ── meeting room with a video call (right) ──────────────────────────────
S.at(400)
S.M(rect(1060, 180, 330, 510, 2), "glassa", step=60)
S.D(line(1060, 180, 1390, 180) + line(1225, 180, 1225, 690), "slate")
S.D(rect(1090, 230, 190, 116, 6), "ink")                                        # screen
for i, (x, y, f) in enumerate(((1098, 238, "sky2"), (1188, 238, "blush2"), (1098, 292, "lav2"), (1188, 292, "mint2"))):
    S.fill(rect(x, y, 84, 48, 3), f)
    S.fill(circle(x + 42, y + 20, 9), ("skin1", "skin2", "skin3", "wood")[i])
    S.fill(f"M{x + 26} {y + 48}Q{x + 42} {y + 30} {x + 58} {y + 48}Z", ("navy", "red", "leaf2", "gold")[i])
S.D(rect(1170, 346, 30, 10), "slate")
S.M(ellipse(1210, 560, 120, 20), "paper", step=40)                               # meeting table
S.D(rect(1204, 580, 12, 110), "slate")
S.D(rect(1110, 520, 30, 40, 8) + rect(1290, 520, 30, 40, 8), "cyan")            # chairs
S.D(rect(1236, 540, 30, 14, 3), "slate")                                          # a laptop on the table
S.D(rect(1300, 420, 70, 24, 4), "paper")                                          # door sign
S.fill(rect(1306, 428, 40, 8), "leaf2")

# ── coffee corner ────────────────────────────────────────────────────────
S.at(600)
S.M(rect(850, 520, 190, 170, 4), "paper", step=50)
S.D(rect(850, 520, 190, 12, 3), "wood")
S.D(line(945, 532, 945, 690) + circle(935, 610, 3) + circle(955, 610, 3))
S.M(rect(870, 430, 64, 90, 6), "slate", step=40)                                  # coffee machine
S.D(rect(880, 442, 44, 22, 3), "screen")
S.D(rect(892, 474, 20, 10, 2) + rect(896, 498, 12, 16, 2), "ink")
S.fill(rect(898, 500, 8, 12), "paper")
S.D(rect(960, 470, 60, 50, 4), "stone")                                           # printer
S.D(rect(968, 460, 44, 12, 2) + rect(972, 506, 36, 6, 2), "paper")
S.fill(circle(1010, 482, 3), "lime")
S.D("M1020 690V600Q1020 588 1030 588H1046Q1056 588 1056 600V690Z", "paper")       # water cooler
S.D(rect(1026, 540, 24, 48, 10), "sky2")
S.D(rect(1044, 616, 8, 6, 2), "ink")
# a woman with a mug
S.shadow(820, G + 58, 24)
S.standing(820, G + 58, coat="leaf2", d=1, arms=[(850, 610)], legs="navy", k=1.55, hair="bun", hairc="hairb")
S.D(rect(846, 598, 14, 18, 3), "red")

# ── whiteboard brainstorm ────────────────────────────────────────────────
S.at(800)
S.D(line(620, 560, 610, 680) + line(800, 560, 810, 680), "slate")
S.D(circle(610, 684, 6) + circle(810, 684, 6), "ink")
S.M(rect(600, 290, 220, 270, 4), "paper", step=60)
S.D(rect(600, 290, 220, 270, 4), None)
S.D(ellipse(710, 400, 36, 18), "lime")                                          # central idea
S.soft(line(640, 440, 700, 400))
S.D("M676 392L620 330M744 392L792 330M690 418L640 480M734 416L790 480", None)
for x, y, f in ((614, 316, "sun"), (770, 310, "blush2"), (612, 470, "sky2"), (772, 468, "sun"), (690, 500, "lav2")):
    S.D(rect(x, y, 34, 30, 2), f)
    S.soft(line(x + 5, y + 10, x + 28, y + 10) + line(x + 5, y + 18, x + 22, y + 18))
S.D(rect(700, 548, 60, 8, 2), "slate")                                           # marker tray
# a man brainstorming with a marker
S.shadow(572, G + 8, 24)
S.standing(572, G + 8, coat="sky2", d=1, arms=[(614, 486), (556, 600)], legs="ink", k=1.55, hair="short", hairc="ink")
S.D(line(614, 486, 626, 472), "red")

# ── hot desks (left) ─────────────────────────────────────────────────────
S.at(1000)
S.fill(blob(40, 560, 40, 70, 9, 0.2, seed=3), "leaf2")                           # big plant in the corner
S.H(blob(40, 560, 40, 70, 9, 0.2, seed=3))
S.D(rect(18, 610, 46, 80, 6), "stone")
S.M(rect(90, 560, 420, 14, 3), "paper", step=40)                                  # the long desk
S.D(rect(100, 574, 10, 116) + rect(490, 574, 10, 116), "slate")
S.D(rect(370, 470, 100, 66, 4), "ink")                                            # monitor
S.D(rect(376, 476, 88, 54, 2), "screen")
S.soft(line(384, 490, 440, 490) + line(384, 500, 430, 500) + line(384, 510, 450, 510))
S.D(rect(412, 536, 16, 18) + rect(400, 552, 40, 8, 2), "slate")
S.D(rect(370, 548, 24, 10, 2), "stone")                                            # keyboard on the right? a phone
S.D("M300 560L316 520H352", "slate")                                               # desk lamp
S.D("M346 514L366 520L360 534Z", "sun")
S.D(rect(470, 540, 14, 20, 3), "sky2")                                             # a mug
# the remote worker with headphones
S.D(rect(148, 610, 54, 10, 4) + rect(170, 620, 10, 70) + rect(146, 540, 10, 80, 4), "cyan")
S.sitting(176, 610, G, coat="red", legs="navy", d=1, arms=[(236, 552)], k=1.5, hair="long", hairc="ink")
S.D("M160 512Q176 484 194 512", "ink")                                              # headphones band
S.D(rect(158, 508, 10, 18, 4) + rect(186, 508, 10, 18, 4), "ink")
S.D("M216 560L226 530H286L292 560Z", "slate")                                      # laptop
S.D("M230 534H282L286 556H226Z", "screen")

# ── the beanbag ──────────────────────────────────────────────────────────
S.at(1200)
S.M("M620 760Q600 720 640 700Q700 690 720 720Q740 760 700 770H640Q622 770 620 760Z", "neon", step=40)
S.soft("M640 712Q670 730 704 716")

# ── words ─────────────────────────────────────────────────────────────────
R, P = words(S)
R("office", "office", (0, 110, 1400, 690), (20, 500), "A1", "ˈɒfɪs",
  "A room or building where people work at desks.", "Our office is on the tenth floor.")
R("meeting", "meeting room", (1060, 180, 330, 510), (1080, 480), "B1", "ˈmiːtɪŋ ruːm",
  "A room for meetings.", "The team is in the meeting room.")
S.meta["zones"] = [
    dict(id="deskz", chip="Hot desks", box=[0, 400, 520, 360]),
    dict(id="boardz", chip="The brainstorm", box=[480, 260, 360, 500]),
    dict(id="coffeez", chip="Coffee corner", box=[760, 380, 320, 400]),
]
S.meta["groups"] = {"room": "The room", "desk": "At the desks", "ideas": "Ideas", "coffee": "Coffee corner", "meeting": "Meeting room", "people": "People"}

P("window", "window", "A1", "room", (150, 200), (58, 158, 544, 304), "ˈwɪndəʊ", "noun",
  "An opening in a wall with glass in it.", "The big windows look over the city.")
P("skyline", "city skyline", "B1", "room", (300, 400), (60, 250, 540, 210), "ˌsɪti ˈskaɪlaɪn", "noun",
  "The shape of a city's buildings against the sky.", "The city skyline looks amazing at night.")
P("plant", "plant", "A1", "room", (40, 560), (0, 486, 80, 204), "plɑːnt", "noun",
  "A green living thing that grows in a pot.", "A big plant stands in the corner.")
P("clock", "clock", "A1", "room", (980, 206), (952, 178, 56, 56), "klɒk", "noun",
  "A thing that shows the time.", "It's already ten past four.")
P("calendar", "calendar", "A2", "room", (656, 200), (638, 174, 74, 84), "ˈkælɪndə", "noun",
  "A page that shows the days, weeks and months.", "The calendar is on the wall.")
P("deadline", "deadline", "B1", "room", (681, 227), (670, 216, 22, 22), "ˈdedlaɪn", "noun",
  "The day or time when work must be finished.", "The deadline is circled in red - it's Thursday!")
P("beanbag", "beanbag", "B1", "room", (670, 740), (598, 692, 144, 80), "ˈbiːnbæɡ", "noun",
  "A big soft bag you sit on.", "You can relax on the beanbag.")
P("lights", "ceiling lights", "A2", "room", (560, 124), (130, 116, 1220, 20), "ˈsiːlɪŋ laɪts", "noun",
  "Lights on the ceiling.", "The ceiling lights turn on automatically.")

P("desk", "desk", "A1", "desk", (140, 566), (88, 556, 424, 134), "desk", "noun",
  "A table where you work.", "Anyone can sit at these hot desks.", "hot desk")
P("laptop", "laptop", "A1", "desk", (254, 546), (214, 526, 80, 36), "ˈlæptɒp", "noun",
  "A small computer you can carry.", "She works on her laptop all day.")
P("headphones", "headphones", "A2", "desk", (178, 500), (154, 482, 46, 46), "ˈhedfəʊnz", "noun",
  "Things you wear over your ears to listen to sound.", "She wears headphones to concentrate.")
P("monitor", "monitor", "A2", "desk", (420, 500), (366, 466, 108, 96), "ˈmɒnɪtə", "noun",
  "A computer screen.", "There's a big monitor on the desk.", "screen")
P("lamp", "desk lamp", "A2", "desk", (340, 520), (296, 510, 72, 52), "ˈdesk læmp", "noun",
  "A small light on a desk.", "Turn on the desk lamp.")
P("mug", "mug", "A1", "desk", (477, 550), (466, 536, 22, 26), "mʌɡ", "noun",
  "A big cup with a handle.", "Her mug says 'World's best boss'.")
P("chair", "office chair", "A2", "desk", (152, 580), (142, 536, 64, 154), "ˈɒfɪs tʃeə", "noun",
  "A chair with wheels for working at a desk.", "Her office chair is blue.")
P("remote", "remote worker", "B1", "people", (176, 560), (140, 480, 100, 210), "rɪˌməʊt ˈwɜːkə", "noun",
  "A person who works away from the main office.", "She's a remote worker - her company is in Berlin.")

P("whiteboard", "whiteboard", "A2", "ideas", (780, 420), (598, 288, 224, 274), "ˈwaɪtbɔːd", "noun",
  "A white board you write on with special pens.", "Write your ideas on the whiteboard.")
P("notes", "sticky notes", "A2", "ideas", (630, 330), (610, 306, 200, 228), "ˈstɪki nəʊts", "noun",
  "Small squares of paper that stick to things.", "Everyone added an idea on a sticky note.", "post-it notes")
P("mindmap", "mind map", "B1", "ideas", (710, 400), (620, 330, 180, 160), "ˈmaɪnd mæp", "noun",
  "A diagram with the main idea in the middle and linked ideas around it.", "They made a mind map of the new project.")
P("marker", "marker", "A2", "ideas", (620, 480), (604, 466, 30, 28), "ˈmɑːkə", "noun",
  "A thick pen for writing on boards.", "He's writing with a red marker.")
P("colleague", "colleague", "B1", "people", (572, 620), (536, 510, 90, 190), "ˈkɒliːɡ", "noun",
  "A person you work with.", "My colleague and I are planning the launch.", "co-worker")

P("coffeemachine", "coffee machine", "A2", "coffee", (902, 454), (866, 426, 72, 96), "ˈkɒfi məˌʃiːn", "noun",
  "A machine that makes coffee.", "The coffee machine makes great cappuccinos.")
P("printer", "printer", "A2", "coffee", (990, 488), (956, 456, 68, 64), "ˈprɪntə", "noun",
  "A machine that puts words and pictures on paper.", "The printer has run out of paper.")
P("cooler", "water cooler", "B1", "coffee", (1038, 620), (1016, 536, 44, 156), "ˈwɔːtə ˌkuːlə", "noun",
  "A machine that gives cold drinking water.", "People chat by the water cooler.")
P("counter", "counter", "A2", "coffee", (900, 600), (848, 518, 194, 172), "ˈkaʊntə", "noun",
  "A long flat surface in a kitchen or shop.", "The cups are on the counter.")
P("woman", "woman", "A1", "people", (820, 640), (790, 550, 76, 200), "ˈwʊmən", "noun",
  "An adult female person.", "The woman is holding a red mug.")

P("screen", "video call", "B1", "meeting", (1185, 288), (1088, 228, 194, 120), "ˈvɪdiəʊ kɔːl", "noun",
  "A call where you can see the people you talk to.", "Four people have joined the video call.")
P("table", "table", "A1", "meeting", (1150, 560), (1088, 538, 244, 152), "ˈteɪbl", "noun",
  "Furniture with a flat top and legs.", "The meeting table is round.")
P("glasswall", "glass wall", "B1", "meeting", (1375, 360), (1360, 180, 30, 510), "ˌɡlɑːs ˈwɔːl", "noun",
  "A wall made of glass.", "The meeting room has glass walls.")

S.meta.update(
    view=[0, 110, 1400, 690],
    roomsTitle="Places",
    title="The Coworking Office",
    kicker="Picture Studio · Work",
    dek="A modern shared office: hot desks, a brainstorm on the whiteboard, a coffee corner and a video call.",
    frames=["I'm working on …", "Can we schedule a meeting for …?", "The deadline is …",
            "Let's brainstorm some ideas for …", "I'll send you the … by …", "Could you print …?"],
)
TF = [
    ("There is a plant in the corner.", True, "A1"),
    ("The woman is holding a mug.", True, "A1"),
    ("The clock is on the whiteboard.", False, "A1"),
    ("There are four people on the video call.", True, "A1"),
    ("The remote worker is wearing headphones.", True, "A2"),
    ("The printer is next to the coffee machine.", True, "A2"),
    ("The man is writing on the window.", False, "A2"),
    ("The meeting room is empty.", True, "A2"),
    ("The deadline on the calendar is circled.", True, "B1"),
    ("There are sticky notes on the mind map.", True, "B1"),
    ("The water cooler is inside the meeting room.", False, "B1"),
    ("You can see the city skyline through the windows.", True, "B1"),
]
PROMPTS = {
    "A1": ["What can you see in the office? Write six things.",
           "What are the people doing?",
           "Do you like working with other people or alone?"],
    "A2": ["Describe your perfect workplace.",
           "Write an email to a colleague to arrange a meeting.",
           "What do you do on a normal working day? Use the present simple."],
    "B1": ["Is working from home better than working in an office? Discuss.",
           "Your project is late. Write an email explaining why and suggesting a new deadline.",
           "Describe a brainstorming session: the problem, the ideas and the decision."],
}
finish(S, TF, PROMPTS)
