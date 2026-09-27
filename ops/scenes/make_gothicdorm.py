"""Picture Studio · The Gothic Dorm — a room in an old academy, split down the
middle: a gloomy, bookish side (typewriter, candles, a cello, a hidden
passage behind the bookcase) and a roommate's bright side (fairy lights,
posters, a rainbow rug). A gargoyle sits outside the pointed window.
Inspired by gothic mystery classics - an original drawing, no film stills.
Writes data/scenes/gothicdorm.json.

    python3 ops/scenes/make_gothicdorm.py
"""
from scene import Scene, pts, line, rect, circle, ellipse, wave, blob
from common import words, finish

S = Scene("gothicdorm", 1400, 800)
G = 700          # floor line
TOP = 130        # ceiling

# ── night sky behind the window ───────────────────────────────────────────
S.at(0)
S.fill(rect(0, 0, 1400, 800), "night2")
# ── walls ─────────────────────────────────────────────────────────────────
S.wallpaper((0, TOP, 700, G - TOP), "lav2", "bricks", dado=70)          # her side: grey-violet stone
S.wallpaper((700, TOP, 700, G - TOP), "blush", "dots", dado=70)         # the roommate's side
S.fill(rect(0, G, 1400, 100), "wood")
S.soft("".join(line(0, y, 1400, y) for y in range(G + 14, 800, 16)))
S.M(line(0, G, 1400, G), step=0)
S.M(rect(0, TOP - 16, 1400, 16), "bark", step=40)                        # ceiling beam
for x in (180, 520, 880, 1220):
    S.D(pts([(x - 10, TOP), (x + 10, TOP), (x + 4, TOP + 20), (x - 4, TOP + 20)], True), "bark")

# ── the pointed window, moon and gargoyle ────────────────────────────────
S.at(200)
ARCH = "M590 540V330Q590 220 700 196Q810 220 810 330V540Z"
S.M(ARCH, "deep", step=80)
S.fill(circle(760, 290, 34), "candle")                                    # moon
S.fill(circle(772, 282, 30), "deep")                                      # crescent bite
S.fill("".join(circle(x, y, 1.6) for x, y in ((620, 260), (650, 330), (700, 250), (640, 410), (790, 400), (730, 360))), "paper")
S.fill("M590 540V470Q640 440 700 458Q760 436 810 466V540Z", "night")     # towers far away
S.D(rect(612, 432, 18, 40) + rect(668, 420, 22, 44) + rect(760, 440, 16, 30), "night")
S.fill(rect(618, 440, 5, 7) + rect(676, 430, 6, 8) + rect(764, 448, 5, 6), "candle")
S.M(ARCH, None)
S.D(line(700, 196, 700, 540) + line(590, 380, 810, 380) + line(590, 460, 810, 460))   # lead lines
S.D(circle(700, 268, 26))                                                  # tracery rose
S.D(line(674, 268, 726, 268) + line(700, 242, 700, 294))
S.M(rect(584, 540, 236, 16, 3), "stone")                                   # sill
# gargoyle crouching on the outer sill (seen through the lower panes)
S.M("M742 540Q736 510 748 494Q744 476 756 470L760 458L766 472Q780 470 786 484Q800 490 798 512Q806 522 800 540Z", "stone2", step=60)
S.D("M756 470L752 456L762 466M774 470L780 456L782 472", "stone2")          # horns
S.D("M786 494Q812 474 820 500Q806 498 798 510", "stone2")                 # wing
S.fill(circle(760, 484, 2) + circle(772, 484, 2), "ink")
S.D("M758 494Q766 500 774 494")

# ── HER SIDE (left) ───────────────────────────────────────────────────────
S.at(600)
# cobweb in the corner
S.D("M0 146L110 146M0 146L0 250M0 146L90 226M0 146L50 246M0 146L100 190"
    "M0 176Q20 176 26 146M0 206Q40 206 52 146M0 236Q66 230 80 146")
S.fill(circle(62, 214, 3.2), "ink")
S.D(line(62, 146, 62, 210))
# portrait in a gilt frame
S.M(rect(90, 196, 110, 140, 4), "gold")
S.D(rect(100, 206, 90, 120, 3), "night")
S.D(ellipse(145, 262, 22, 28), "stone2")                                  # a stern face
S.D(f"M122 326Q145 290 168 326Z", "ink")
S.fill(circle(137, 258, 2) + circle(153, 258, 2), "ink")
S.D("M137 274H153")
# bed with a tall spiky headboard
S.shadow(130, G, 110, 5)
S.M("M24 700V300L40 276L56 300V420H204V360L220 336L236 360V700Z", "night", step=60)
S.D("M40 276V250M220 336V310", "night")
S.fill(circle(40, 246, 5) + circle(220, 306, 5), "night")
S.M(rect(40, 560, 192, 60, 8), "paper")                                    # mattress + sheet
S.M("M44 580H228V660Q136 676 44 660Z", "night2")                          # dark bedspread
S.soft("".join(line(x, 584, x - 10, 660) for x in range(70, 228, 28)))
S.D(rect(56, 530, 70, 36, 12), "stone")                                    # pillow
S.D(rect(40, 660, 192, 12, 3) + rect(40, 672, 10, 28) + rect(222, 672, 10, 28), "night")
# a black cat asleep on the bed
S.D("M160 580Q160 560 184 560Q208 560 208 580Z", "ink")
S.D("M170 562L166 550L176 558M190 558L198 548L198 562", "ink")
S.D("M208 578Q222 576 218 562", None)
# trunk at the foot of the bed with an old key and a magnifying glass
S.at(900)
S.shadow(160, 790, 90, 4)
S.M(rect(80, 716, 160, 70, 6), "rust", step=60)
S.M("M80 734Q80 704 160 704Q240 704 240 734Z", "rust")
S.D(line(80, 734, 240, 734) + rect(110, 704, 10, 82) + rect(200, 704, 10, 82), "ink")
S.D(rect(152, 728, 16, 18, 3), "gold")
S.fill(circle(160, 735, 2.2), "ink")
S.D(circle(212, 760, 7) + line(219, 760, 244, 760) + line(236, 760, 236, 767) + line(242, 760, 242, 766), "gold")   # key
S.D(circle(132, 700, 8) + line(138, 706, 148, 714), "glassa")               # magnifying glass
# bookcase + hidden passage behind it
S.at(1100)
S.M("M560 330L592 322V700L560 700Z", "night2", step=60)                    # the open gap - a dark passage
for i, y in enumerate(range(620, 700, 16)):
    S.D(f"M{562 + i * 3} {y + 14}H{590 - i}V{y + 16}H{562 + i * 3}Z", "stone2")   # stone steps going down
S.M(rect(444, 300, 122, 20, 3), "bark")
S.M(rect(450, 318, 110, 230, 2), "bark", step=40)
S.M(rect(450, 548, 110, 152, 2), "bark", step=20)
for y in (318, 376, 434, 492):
    S.D(rect(456, y + 6, 98, 52, 1), "wood")
    x = 460
    for j, w in enumerate((10, 14, 8, 12, 16, 9, 12, 10, 14, 11)):
        if x + w > 550:
            break
        f = ("night", "red", "stone2", "moss", "plum", "slate")[(j + y) % 6]
        S.fill(rect(x, y + 18 + (j % 3) * 3, w, 40 - (j % 3) * 3), f)
        S.soft(rect(x, y + 18 + (j % 3) * 3, w, 40 - (j % 3) * 3))
        x += w + 1
S.D(rect(456, 560, 98, 130, 2) + circle(542, 626, 3), "wood")              # cupboard below
# a raven on top of the bookcase
S.M("M470 300Q466 284 478 278Q484 266 496 270Q504 272 506 280L516 282L506 286Q510 296 500 300Z", "ink", step=50)
S.fill(circle(496, 277, 1.6), "paper")
S.D("M478 300L470 306M488 300L486 308", "ink")
# cello leaning against the bookcase
S.at(1300)
C = 169
S.M(f"M{300 + C} 560Q{286 + C} 572 {292 + C} 600Q{280 + C} 618 {290 + C} 644Q{300 + C} 690 {336 + C} 690Q{372 + C} 690 {382 + C} 644"
    f"Q{392 + C} 618 {380 + C} 600Q{386 + C} 572 {372 + C} 560Q{352 + C} 548 {336 + C} 552Q{320 + C} 548 {300 + C} 560Z", "rust", step=60)
S.M(rect(331 + C, 400, 10, 160, 3), "ink")
S.D(f"M{328 + C} 400Q{336 + C} 386 {344 + C} 400", "ink")
S.D(f"M{318 + C} 620Q{316 + C} 606 {322 + C} 596M{354 + C} 596Q{360 + C} 606 {354 + C} 620")
S.D(line(336 + C, 690, 336 + C, 700))
# desk with typewriter, candelabra and a sealed letter
S.at(1500)
S.M(rect(290, 560, 156, 14, 3), "night", step=40)
S.D(rect(298, 574, 12, 126) + rect(426, 574, 12, 126), "night")
S.M(rect(300, 520, 80, 40, 6), "ink")                                       # typewriter
S.D(rect(308, 496, 64, 26, 3), "paper")                                     # paper in it
S.soft(line(314, 504, 364, 504) + line(314, 510, 356, 510))
S.soft("".join(circle(x, 544, 3) for x in range(312, 372, 10)))
S.D(rect(300, 518, 80, 6, 2), "slate")
S.D("M430 560V520M414 520Q430 530 446 520M414 520V508M446 520V508", "gold")
S.D(rect(411, 488, 6, 20) + rect(427, 478, 6, 30) + rect(443, 488, 6, 20), "paper")
for x, y in ((414, 486), (430, 476), (446, 486)):
    S.D(f"M{x} {y}Q{x - 4} {y - 8} {x} {y - 14}Q{x + 4} {y - 8} {x} {y}Z", "candle")
S.D(rect(418, 556, 24, 4, 2), "gold")
S.D(rect(384, 544, 22, 16, 1), "paper")                                     # sealed letter
S.fill(circle(395, 552, 3.6), "red")                                         # wax seal
# the student at the typewriter
S.at(1700)
S.D(rect(228, 610, 52, 8, 3) + rect(232, 618, 6, 82) + rect(272, 618, 6, 82) + rect(226, 520, 8, 92, 3), "night")
S.sitting(262, 610, G, coat="ink", legs="ink", d=1, arms=[(318, 546)], k=1.5, skin="skin1", hair="long", hairc="ink")
S.D("M256 518L247 556M272 518L279 556", "ink")                              # two plaits
S.D("M255 536L270 536L262 546Z", "paper")                                    # white collar

# ── THE ROOMMATE'S SIDE (right) ───────────────────────────────────────────
S.at(2000)
# fairy lights along the wall
S.D(wave(820, 176, 1390, 176, 10, 12))
S.fill("".join(circle(820 + i * 28.5, 176 + (12 if i % 2 else -12) * 0.62, 5) for i in range(21)), "candle")
S.soft("".join(circle(820 + i * 28.5, 176 + (12 if i % 2 else -12) * 0.62, 9) for i in range(0, 21, 2)))
# posters
S.M(rect(880, 220, 96, 130, 3), "neon")
S.D(circle(928, 270, 24), "candle")
S.fill(rect(896, 316, 64, 8) + rect(906, 330, 44, 6), "paper")
S.M(rect(994, 240, 84, 100, 3), "cyan")
S.D("M1006 324L1030 280L1048 308L1060 290L1070 324Z", "leaf2")
S.D(circle(1054, 264, 8), "sun")
# wardrobe with a mirror
S.at(2200)
S.shadow(1150, G, 70, 4)
S.M(rect(1090, 400, 130, 300, 6), "paper", step=60)
S.D(line(1155, 400, 1155, 700))
S.D(rect(1100, 420, 46, 150, 20), "glass")                                   # mirror
S.soft(line(1108, 440, 1130, 460) + line(1108, 456, 1122, 470))
S.D(circle(1148, 590, 3) + circle(1162, 590, 3), "gold")
# the roommate's bed - colourful
S.M(rect(1238, 540, 150, 160, 8), "lav", step=60)
S.M(rect(1232, 470, 14, 230, 4), "neon")
S.M("M1242 580H1388V660Q1320 676 1242 660Z", "sun")
S.soft("".join(line(x, 584, x, 660) for x in range(1256, 1388, 16)))
S.D(rect(1252, 534, 46, 30, 12) + rect(1296, 540, 42, 28, 12), "neon")
S.D(rect(1340, 536, 40, 30, 12), "cyan")
S.D("M1300 560Q1296 548 1308 546Q1320 548 1318 560Q1308 572 1300 560Z", "red")  # a heart cushion
S.D(rect(1242, 660, 146, 12, 3) + rect(1242, 672, 10, 28) + rect(1378, 672, 10, 28), "neon")
# plant
S.D(rect(840, 640, 36, 60, 5), "rust")
S.fill(blob(858, 610, 30, 34, 9, 0.22, seed=5), "leaf2")
S.H(blob(858, 610, 30, 34, 9, 0.22, seed=5))
# rug
S.at(2400)
S.fill(ellipse(990, 750, 170, 32), "sun")
S.fill(ellipse(990, 750, 130, 24), "neon")
S.fill(ellipse(990, 750, 88, 16), "cyan")
S.soft(ellipse(990, 750, 170, 32) + ellipse(990, 750, 130, 24))
# desk with laptop
S.M(rect(900, 540, 150, 12, 3), "paper", step=40)
S.D(rect(908, 552, 10, 148) + rect(1032, 552, 10, 148), "paper")
S.M("M930 540L940 494H1010L1016 540Z", "slate")
S.D("M944 500H1006L1010 532H938Z", "screen")
S.D(rect(1020, 516, 14, 24, 3), "cyan")                                      # a mug
# the roommate, waving
S.shadow(1010, 766, 30)
S.standing(1010, 766, coat="neon", d=-1, arms=[(1044, 592), (990, 690)], legs="cyan", k=1.6, hair="bun", hairc="hairy")

# ── words ─────────────────────────────────────────────────────────────────
R, P = words(S)
R("dorm", "dorm room", (0, 114, 1400, 686), (20, 420), "A2", "ˈdɔːm ruːm",
  "A bedroom in a school or college where students live.", "Her dorm room is on the top floor.", "dorm")
S.meta["zones"] = [
    dict(id="herz", chip="Her side", box=[0, 120, 700, 680]),
    dict(id="roomz", chip="Her roommate's side", box=[700, 120, 700, 680]),
    dict(id="windowz", chip="The window", box=[560, 180, 290, 380]),
]
S.meta["groups"] = {"her": "Her side", "window": "The window", "roommate": "Her roommate's side", "people": "People"}

P("window", "window", "A1", "window", (650, 420), (590, 196, 220, 344), "ˈwɪndəʊ", "noun",
  "An opening in a wall with glass in it.", "The window looks out over the dark towers.")
P("moon", "moon", "A1", "window", (752, 292), (724, 256, 70, 70), "muːn", "noun",
  "The round thing that shines in the sky at night.", "There's a thin moon tonight.")
P("stars", "stars", "A1", "window", (650, 330), (612, 244, 190, 176), "stɑːz", "noun",
  "Small bright lights in the night sky.", "You can see the stars from her window.")
P("gargoyle", "gargoyle", "B1", "window", (770, 512), (736, 454, 86, 88), "ˈɡɑːɡɔɪl", "noun",
  "A stone creature on an old building, often ugly or frightening.", "A gargoyle watches the courtyard from the roof.")
P("sill", "windowsill", "B1", "window", (620, 548), (584, 540, 236, 16), "ˈwɪndəʊsɪl", "noun",
  "The flat shelf at the bottom of a window.", "She keeps a candle on the windowsill.")
P("towers", "towers", "A2", "window", (680, 446), (596, 416, 210, 60), "ˈtaʊəz", "noun",
  "Tall narrow buildings or parts of a building.", "The academy has four old towers.")

P("bed", "bed", "A1", "her", (100, 620), (24, 244, 212, 456), "bed", "noun",
  "The furniture you sleep on.", "Her bed has a tall black headboard.")
P("pillow", "pillow", "A1", "her", (90, 546), (56, 530, 70, 36), "ˈpɪləʊ", "noun",
  "A soft thing you put your head on in bed.", "The pillow is grey, like everything on her side.")
P("cat", "cat", "A1", "her", (186, 572), (158, 546, 70, 36), "kæt", "noun",
  "A small furry animal that people keep as a pet.", "A black cat is asleep on the bed.")
P("portrait", "portrait", "B1", "her", (145, 262), (90, 196, 110, 140), "ˈpɔːtrɪt", "noun",
  "A painting of a person.", "The portrait's eyes seem to follow you round the room.")
P("cobweb", "cobweb", "A2", "her", (40, 200), (0, 146, 112, 104), "ˈkɒbweb", "noun",
  "A net that a spider makes, especially an old dusty one.", "There are cobwebs in every corner.", "spiderweb")
P("trunk", "trunk", "B1", "her", (130, 750), (78, 702, 164, 86), "trʌŋk", "noun",
  "A large strong box for keeping or carrying things.", "She hides her diary in the old trunk.")
P("key", "key", "A1", "her", (212, 760), (202, 750, 44, 20), "kiː", "noun",
  "A piece of metal that opens a lock.", "Who does this old key belong to?")
P("cello", "cello", "B1", "her", (505, 630), (453, 386, 112, 314), "ˈtʃeləʊ", "noun",
  "A large string instrument that you play sitting down.", "She plays the cello when she can't sleep.")
P("desk", "desk", "A1", "her", (370, 566), (290, 556, 156, 144), "desk", "noun",
  "A table where you study or work.", "Her desk is by the bookcase.")
P("typewriter", "typewriter", "B1", "her", (340, 536), (298, 494, 84, 66), "ˈtaɪpraɪtə", "noun",
  "An old machine for writing letters by pressing keys.", "She writes her stories on a typewriter, not a laptop.")
P("candelabra", "candelabra", "B1", "her", (432, 540), (408, 460, 44, 102), "ˌkændəˈlɑːbrə", "noun",
  "A holder for several candles.", "A candelabra lights the desk.")
P("candle", "candles", "A1", "her", (428, 490), (408, 460, 44, 48), "ˈkændlz", "noun",
  "Sticks of wax that burn to give light.", "Three candles are burning on the desk.")
P("letter", "sealed letter", "B1", "her", (390, 550), (382, 542, 26, 20), "ˌsiːld ˈletə", "noun",
  "A letter closed with wax so nobody can read it.", "Who sent her a sealed letter?")
P("magnifier", "magnifying glass", "B1", "her", (132, 700), (122, 690, 30, 28), "ˈmæɡnɪfaɪɪŋ ɡlɑːs", "noun",
  "A round glass that makes small things look bigger.", "A magnifying glass lies on the old trunk.")
P("bookcase", "bookcase", "A2", "her", (520, 350), (444, 300, 122, 400), "ˈbʊkkeɪs", "noun",
  "Furniture with shelves for books.", "The bookcase is full of old books.")
P("books", "books", "A1", "her", (470, 470), (454, 320, 100, 226), "bʊks", "noun",
  "Sets of printed pages to read.", "Most of her books are about mysteries.")
P("raven", "raven", "B1", "her", (492, 286), (464, 264, 54, 44), "ˈreɪvn", "noun",
  "A large black bird.", "A raven sits on top of the bookcase.")
P("passage", "hidden passage", "B1", "her", (576, 560), (558, 318, 36, 382), "ˌhɪdn ˈpæsɪdʒ", "noun",
  "A secret way through a building that nobody can see.", "There is a hidden passage behind the bookcase!")
P("steps", "stone steps", "A2", "her", (576, 670), (560, 616, 32, 84), "ˌstəʊn ˈsteps", "noun",
  "Steps made of stone.", "Stone steps lead down into the dark.")

P("lights", "fairy lights", "B1", "roommate", (1100, 170), (812, 160, 588, 32), "ˈfeəri laɪts", "noun",
  "A string of small coloured lights for decoration.", "Her roommate put fairy lights over the bed.", "string lights")
P("poster", "posters", "A2", "roommate", (930, 280), (876, 216, 206, 138), "ˈpəʊstəz", "noun",
  "Big pictures that you put on a wall.", "Her side has bright posters on the wall.")
P("wardrobe", "wardrobe", "A2", "roommate", (1190, 500), (1088, 398, 134, 302), "ˈwɔːdrəʊb", "noun",
  "A tall cupboard for clothes.", "The wardrobe is full of colourful clothes.", "closet")
P("mirror", "mirror", "A1", "roommate", (1122, 480), (1098, 418, 50, 154), "ˈmɪrə", "noun",
  "A glass that shows you your face.", "There is a long mirror on the wardrobe door.")
P("rbed", "bed", "A1", "roommate", (1340, 620), (1230, 468, 160, 232), "bed", "noun",
  "The furniture you sleep on.", "Her roommate's bed is pink and yellow.")
P("cushions", "cushions", "A2", "roommate", (1320, 548), (1250, 530, 132, 40), "ˈkʊʃnz", "noun",
  "Soft bags of material that you sit or lean on.", "The bed is covered in cushions.")
P("plant", "plant", "A1", "roommate", (858, 616), (826, 574, 64, 126), "plɑːnt", "noun",
  "A green living thing that grows in a pot.", "She waters her plant every day.")
P("rug", "rug", "A2", "roommate", (1100, 752), (820, 716, 340, 68), "rʌɡ", "noun",
  "A small carpet on the floor.", "A round rainbow rug covers the floor.")
P("laptop", "laptop", "A2", "roommate", (976, 516), (928, 492, 90, 50), "ˈlæptɒp", "noun",
  "A small computer you can carry.", "Her roommate watches films on her laptop.")
P("mug", "mug", "A1", "roommate", (1027, 528), (1018, 512, 20, 30), "mʌɡ", "noun",
  "A big cup with a handle.", "There's a mug of hot chocolate on the desk.")

P("student", "student", "A1", "people", (262, 560), (224, 470, 96, 230), "ˈstjuːdnt", "noun",
  "A person who studies at a school or university.", "The student is typing a mystery story.")
P("roommate", "roommate", "B1", "people", (1010, 680), (966, 570, 96, 198), "ˈruːmmeɪt", "noun",
  "A person you share a room with.", "Her roommate is friendly and chatty.")

S.meta.update(
    view=[0, 120, 1400, 680],
    roomsTitle="The room",
    title="The Gothic Dorm",
    kicker="Picture Studio · Gothic & Mystery",
    dek="An old academy dorm split down the middle - a gloomy side full of secrets and a bright, cheerful one.",
    inspired="Inspired by gothic mystery classics",
    frames=["Her side of the room is … , but her roommate's side is …", "There is a … behind the …",
            "She looks … because …", "I think the … is hiding …", "If I lived here, I would …", "It feels … at night."],
)
TF = [
    ("There is a cat on the bed.", True, "A1"),
    ("The moon is in the window.", True, "A1"),
    ("The roommate's bed is black.", False, "A1"),
    ("There are three candles on the desk.", True, "A1"),
    ("A raven is sitting on the bookcase.", True, "A2"),
    ("The student is using a laptop.", False, "A2"),
    ("There is a plant on the roommate's side.", True, "A2"),
    ("The portrait is above the bed.", True, "A2"),
    ("There are fairy lights on her side of the room.", False, "B1"),
    ("A gargoyle is sitting on the windowsill outside.", True, "B1"),
    ("The hidden passage is behind the wardrobe.", False, "B1"),
    ("Stone steps lead down from the passage.", True, "B1"),
    ("The sealed letter has a red wax seal.", True, "B1"),
]
PROMPTS = {
    "A1": ["What is on her side? What is on her roommate's side? Write five sentences.",
           "What colours can you see on each side?",
           "Describe your bedroom."],
    "A2": ["Compare the two sides of the room. Use -er / more … than.",
           "Write about the two girls: what are they like? Use adjectives.",
           "What is in the trunk, do you think? Write a short story."],
    "B1": ["Describe the room so that it sounds gloomy and mysterious.",
           "Where does the hidden passage go? Tell the story of one night.",
           "Could you share a room with someone very different from you? Why?"],
}
finish(S, TF, PROMPTS)
