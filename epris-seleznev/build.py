#!/usr/bin/env python3
"""EPRIS: Yaroslav Seleznev interview. Builds article JSON (RU + EN) and a local HTML preview."""
import json, html, os, sys, re

HERE = os.path.dirname(os.path.abspath(__file__))
UP = "https://api.eprisjournal.com/uploads/"
IMG = lambda n: f"yaroslav-seleznev-{n:02d}.webp"

# ---- images: number -> (RU caption, EN caption) --------------------------------
CAP = {
 3: ("<i>Ugly beauty</i>, 2023. Холст, акрил, 80×60 см.", "<i>Ugly beauty</i>, 2023. Acrylic on canvas, 80 × 60 cm."),
 5: ("Ярослав Селезнёв. Париж, 2026. Фото: Лиза Хлебникова.", "Yaroslav Seleznev. Paris, 2026. Photo: Liza Khlebnikova."),
 22: ("<i>Memories of the Future</i>, 2026. Холст, акрил, 100×60 см.", "<i>Memories of the Future</i>, 2026. Acrylic on canvas, 100 × 60 cm."),
 18: ("<i>Хор</i>, 2026. Бумага, темпера, 20×30 см.", "<i>Choir</i>, 2026. Tempera on paper, 20 × 30 cm."),
 19: ("<i>Восточный танец</i>, 2026. Холст, акрил, 100×60 см.", "<i>Oriental Dance</i>, 2026. Acrylic on canvas, 100 × 60 cm."),
 21: ("<i>Solitary</i>, 2026. Бумага, темпера, 30×20 см.", "<i>Solitary</i>, 2026. Tempera on paper, 30 × 20 cm."),
 13: ("<i>Dish</i>, 2024. Керамика, эмаль, диаметр 23 см.", "<i>Dish</i>, 2024. Enamel on ceramic, diameter 23 cm."),
 14: ("<i>Metal gear</i>, 2023. Медь, латунь, 100×50×50 см.", "<i>Metal gear</i>, 2023. Copper and brass, 100 × 50 × 50 cm."),
 9: ("Выставка Deux Paris, графика, 2025. Фото: Ярослав Селезнёв.", "Deux Paris exhibition, works on paper, 2025. Photo: Yaroslav Seleznev."),
 12: ("<i>Avalon</i>, 2022, на выставке «Сад», 2025. Холст, акрил, 120×80 см. Фото: Ольга Гилева.", "<i>Avalon</i>, 2022, at the exhibition <i>Garden</i>, 2025. Acrylic on canvas, 120 × 80 cm. Photo: Olga Gileva."),
 6: ("Art3f Paris, фронтальная стена стенда, 2026. Фото: Александр Плотников.", "Art3f Paris, the front wall of the stand, 2026. Photo: Alexander Plotnikov."),
 11: ("Art3f Paris, графика, 2026. Фото: Александр Плотников.", "Art3f Paris, works on paper, 2026. Photo: Alexander Plotnikov."),
 28: ("<i>Spark</i>, 2026. Холст, акрил, 100×60 см.", "<i>Spark</i>, 2026. Acrylic on canvas, 100 × 60 cm."),
 26: ("<i>Лёгкое касание I</i>, 2025. Холст, акрил, 60×40 см.", "<i>Light Touch I</i>, 2025. Acrylic on canvas, 60 × 40 cm."),
 27: ("<i>Лёгкое касание II</i>, 2025. Холст, акрил, 60×40 см.", "<i>Light Touch II</i>, 2025. Acrylic on canvas, 60 × 40 cm."),
 29: ("<i>Pale fire</i>, 2025. Холст, акрил, 100×80 см.", "<i>Pale fire</i>, 2025. Acrylic on canvas, 100 × 80 cm."),
 4: ("<i>Avalon</i>, 2022. Холст, акрил, 120×80 см.", "<i>Avalon</i>, 2022. Acrylic on canvas, 120 × 80 cm."),
}
# The RU captions above that say "Холст, акрил" etc. come from the artist's list; see QUERIES.

def img(n): return {"type": "image", "content": UP + IMG(n), "align": "center", "width": 100, "_n": n}
def pair(a, b): return [img(a), img(b)]

# ---- content: list of ("h", ru, en) | ("p", ru, en) | ("q", ru, en answer) | ("i", n) | ("quote", ru, en) | ("note", ru, en)
C = []
def h(ru, en): C.append(("h", ru, en))
def p(ru, en): C.append(("p", ru, en))
def qa(qru, aru, qen, aen): C.append(("qa", qru, aru, qen, aen))
def i(n): C.append(("i", n))
LEAD = {
 "01": ("Первый блок — о том, с чем человек, воспитанный на академическом реализме, приходит в абстракцию, о границе между «всем» и «ничем» и о названии, которое, как выясняется, мешает.",
        "The first section is about what a person raised on academic realism brings to abstraction, about the line between “everything” and “nothing”, and about a title that, it turns out, gets in the way."),
 "02": ("Второй блок — о сдержанности, о руке и случайности и о том, может ли картина без сюжета быть свидетельством.",
        "The second section is about restraint, the hand and chance, and whether a painting without a subject can be a witness."),
 "03": ("Третий — о наследстве авангарда, о сообществах, которые художник выбирает или отвергает, и о стене, на которой картина становится частью чужой композиции.",
        "The third is about the legacy of the avant-garde, the communities an artist chooses or rejects, and the wall on which a painting becomes part of someone else’s composition."),
 "04": ("Четвёртый — о ярмарке, цене и экране телефона, а также о том, как понять, что стиль умер раньше, чем об этом скажет рынок.",
        "The fourth is about the fair, the price and the phone screen, and how to tell that a style has died before the market says so."),
 "05": ("И последний — о словах, которые лучше не произносить, и о том, что останется, когда не останется автора.",
        "And the last is about words that are better left unsaid, and about what remains when the author does not."),
}
CLOSE = ("Последний вопрос Ярослав вернул нам сам: может ли красота как таковая существовать в искусстве сегодня или её вытеснила «художественная правда»? Отвечать за него мы не станем. Оставляем вопрос читателям.",
         "Yaroslav handed the last question back to us: can beauty as such still exist in art today, or has it been displaced by “artistic truth”? We will not answer it for him. We leave it to our readers.")
def quote(ru, en): C.append(("quote", ru, en))

TITLE = ("Ничто, кроме всего: Ярослав Селезнёв об абстракции без имени",
         "Nothing but Everything: Yaroslav Seleznev on Abstraction Without a Name")
EXCERPT = (
 "Ярослав Селезнёв о переходе от академического реализма к абстракции, названии «Композиция №», границе между минимализмом и пустотой, "
 "ярмарках, экране и о том, что останется от картины, когда не останется художника.",
 "Painter Yaroslav Seleznev on moving from academic realism to abstraction, why a title can get in the way, where minimalism turns into emptiness, "
 "and what is left of a painting when the artist is gone.")
TAGS = (["Интервью", "живопись", "абстракция", "Париж", "Ярослав Селезнёв"],
        ["Interview", "painting", "abstraction", "Paris", "Yaroslav Seleznev"])

p("«It’s nothing but everything…» — эту строчку Ярослав Селезнёв поставил в своём Instagram с тремя точками в конце. Она работает сразу в нескольких регистрах: как шутка, как манифест и как парадокс, который можно разбирать часами. Для художника, чья живопись и графика держатся на минимуме средств, это почти технический паспорт: широкий мазок кисти, графический материал, сдержанная палитра, где красный, синий или оранжевый возникают как событие, а не как норма.",
  "“It’s nothing but everything…”: Yaroslav Seleznev put this line in his Instagram, with three dots at the end. It works in several registers at once: as a joke, as a manifesto, and as a paradox one could unpack for hours. For an artist whose painting and drawing rest on a minimum of means, it is almost a technical passport: a broad brushstroke, a graphic material, a restrained palette in which red, blue or orange arrive as an event rather than a rule.")
p("Путь к этому языку был не прямым. Селезнёв окончил художественную школу, входившую в академическую систему, а в студию мастера при Академии художеств пришёл уже взрослым, в тридцать два года, и учился там академическому реализму XVIII–XIX веков. Позже он сознательно отказался от узнаваемых предметов. Сам он описывает это как слом и выход в неизвестность: «разрушение представлений об умении рисовать и построение языка с нуля». Название его персональной выставки в галерее «Арт-Лига» — «Композиция №», знак номера, за которым может стоять любое число — довёл этот отказ до формулы.",
  "The road to this language was not a straight one. Seleznev graduated from an art school that was part of the academic system, and came to a master’s studio linked to the Academy of Arts as an adult, at thirty-two, where he studied the academic realism of the eighteenth and nineteenth centuries. Later he deliberately gave up recognisable subjects. He describes it himself as a break and a step into the unknown: “the destruction of my idea of being able to draw, and the building of a language from zero.” The title of his solo exhibition at the Art-Liga gallery, <i>Composition No.</i>, a number sign that could be followed by any number, took that refusal to its formula.")
p("Сегодня его работы показывают в Париже: на выставке Deux Paris (2025) и на ярмарке Art3f (2026), а также на выставке «Сад» (2025). Рядом с холстами и бумагой в его практике есть керамика и медь, и мотив широкого мазка переходит на блюдо и в объект.",
  "Today his work is shown in Paris, at the Deux Paris exhibition (2025) and at the Art3f fair (2026), as well as at the exhibition <i>Garden</i> (2025). Alongside canvas and paper his practice includes ceramics and copper, and the motif of the broad stroke carries over onto a dish and into an object.")
p("Мы отправили Ярославу длинные, местами неудобные вопросы: об академическом глазе и названии, о цене и экране, о паразитизме в искусстве и о том, что остаётся от картины без автора. Он ответил коротко и точно. В этих ответах мало слов, которые можно убрать, и ещё меньше извинений: Селезнёв говорит о красоте как об инстанции-абсолюте и не прячется за иронию, хотя иронии у него тоже хватает.",
  "We sent Yaroslav long and sometimes uncomfortable questions: about the academic eye and the title, price and the screen, parasitism in art, and what remains of a painting without its author. He answered briefly and precisely. There are few words in these answers that could be removed, and even fewer apologies: Seleznev speaks of beauty as an absolute and does not hide behind irony, although he has no shortage of irony either.")
i(3)

# 01
h("01 · Глаз, ничто и имя", "01 · The Eye, the Nothing and the Name")
qa("Вы учились в студии мастера из Академии художеств, где глаз воспитывают узнавать форму, вес, свет и тон. Абстракция для вас — радикализация академического зрения или его предательство? И не становится ли она просто другим, более скрытым академизмом, где узнают уже собственный «почерк»?",
   "Хотя я окончил художественную школу, которая была частью академической системы, в студию мастера пришёл уже в осознанном возрасте, в тридцать два года. Муштры и насаждения канона не было, задачи ставились широкие. Целью был не постсезаннизм и соцарт, а академический реализм XVIII–XIX веков. Поэтому не то чтобы переход к абстракции был лёгким, но всегда сохранялась широта взглядов, возможность иметь альтернативные интересы.<br><br>"
   "В момент формирования своего языка я искал что-то радикально другое, направление, где можно создать вещи актуальные и новаторские, выразить именно своё и реализоваться. Это был слом, выход в неизвестность, на свободу, на другой уровень. Можно сказать, разрушение представлений об умении рисовать и построение языка с нуля.<br><br>"
   "В какой-то момент начинаешь видеть общее, соотношение пятен, пренебрегая предметами. Думаю, это не новый академизм, а другой взгляд. Но ценности неизменны: баланс композиции, гармония, вкус и, как итог, «странная», «новая» красота.",
   "You studied in a master’s studio linked to the Academy of Arts, where the eye is trained to recognise form, weight, light and tone. Is abstraction for you a radicalisation of academic vision or a betrayal of it? And is it not simply another, better hidden academism, in which what one recognises is one’s own “handwriting”?",
   "Although I graduated from an art school that was part of the academic system, I came to the master’s studio at a conscious age, thirty-two. There was no drilling and no canon imposed; the tasks were broad. The aim was not post-Cézannism or Soviet pop art, but the academic realism of the eighteenth and nineteenth centuries. So it is not that the move to abstraction was easy, but there was always breadth of view, room for alternative interests.<br><br>"
   "When I was forming my own language I was looking for something radically different, a direction in which I could make things that were current and new, express what was truly mine, and realise myself. It was a break, a step into the unknown, into freedom, onto another level. You could say it was the destruction of my idea of being able to draw, and the building of a language from zero.<br><br>"
   "At some point you begin to see the whole, the relation of patches, ignoring objects. I think it is not a new academism but a different way of looking. The values, though, do not change: the balance of the composition, harmony, taste and, as a result, a “strange”, “new” beauty.")
qa("Был ли момент, когда вы увидели, что ваша точная рука — главная помеха?",
   "Стиль — и помеха, и нет. В какой-то момент он был найден как личная художественная правда, и эта правда не изменилась. Но делать одно и то же бесконечно невозможно, чувствуешь рутинизацию, опустошённость. Поэтому непреднамеренность, ошибка, случайность — то, что обновляет и даёт исключительные ощущения. Точная рука — помеха. Чрезмерный контроль — это неживое, но полное отсутствие порядка — хаос. Поэтому важен баланс: как будто нерукотворно, но автор присутствует.",
   "Was there a moment when you saw that your precise hand was the main obstacle?",
   "Style is both an obstacle and not. At a certain moment it was found, as a personal artistic truth, and that truth has not changed. But you cannot do the same thing for ever; you feel routine, a kind of emptiness. That is why the unintended, the mistake, chance, are what renew it and give exceptional sensations. The precise hand is an obstacle. Excessive control is lifeless, but a complete absence of order is chaos. So balance matters: as if it were not made by hand, yet the author is present.")
i(22)
qa("«It’s nothing but everything…»: что отличает вашу картину и от пустоты, и от хаоса? Где проходит граница, не дающая «всему» растечься в «ничто»? И почему точек именно три?",
   "Вы удивительно проницательны). Это ничто, но всё. Это ничто иное, как всё, и так далее.<br><br>"
   "Для меня абстракция — это степень обобщения, дистанция от смыслов и конкретного, это уровень эмоционального и интуитивного. Формулировать идею значит быть пригвождённым ею.<br><br>"
   "Произведение — это организация пространства таким образом, что появляется сообщение о личной красоте, о художественной правде. Она основана на ощущении, ценностях и вере. Граница — субъективное мнение автора, чувство законченности, достаточности, но не чрезмерности. Мнение зрителя — полностью на его стороне. Многоточие — потому что система открытая, понятия общие, каждый увидит своё.",
   "“It’s nothing but everything…”: what separates your painting from both emptiness and chaos? Where is the line that keeps “everything” from dissolving into “nothing”? And why exactly three dots?",
   "You are remarkably perceptive). It is nothing, but it is everything. It is nothing other than everything, and so on.<br><br>"
   "For me abstraction is a degree of generalisation, a distance from meanings and from the concrete; it is a level of the emotional and the intuitive. To formulate an idea is to be pinned down by it.<br><br>"
   "A work is an organisation of space in such a way that a message appears about personal beauty, about artistic truth. It rests on feeling, values and faith. The boundary is the author’s subjective opinion, a sense of being finished, of enough, but not of too much. The viewer’s opinion is entirely on the viewer’s side. The ellipsis is there because the system is open, the concepts are general, and everyone will see their own.")
qa("Ваша выставка в «Арт-Лиге» называлась «Композиция №». Отказ от названия — самый честный жест или способ спрятаться от ответственности за содержание?",
   "И то и другое: и честный жест, и прятки. Название незамедлительно конкретизирует абстракцию. «Композиция №» — самое честное для произведения. И одновременно это возможность спрятать не столько неумение или отсутствие наполнения, сколько однозначность и защититься от обесценивания.<br><br>"
   "Сегодня слова часто сопряжены с маркетингом, а нет ничего более несовместимого с действительной ценностью, чем личный интерес. Он может оказаться в названиях. В то же время название — это диалог со зрителем на доступном языке. Давая номер, ты рискуешь не просто быть непонятым, а получить изначальный отказ в коммуникации.<br><br>"
   "Мне названия мешают: они вызывают слишком буквальные ассоциации или воспоминания. Если возможно остаться на уровне формы, ценность сохраняется.",
   "Your exhibition at Art-Liga was called <i>Composition No.</i> Is refusing a title the most honest gesture, or a way of hiding from responsibility for the content?",
   "Both: an honest gesture and hide-and-seek. A title immediately makes an abstraction concrete. “Composition No.” is the most honest thing for a work. At the same time it is a way to hide, not so much a lack of skill or substance, as unambiguity, and to protect oneself from being devalued.<br><br>"
   "Today words are often tied to marketing, and nothing is more incompatible with real value than personal interest. It can end up in titles. At the same time a title is a dialogue with the viewer in an accessible language. By giving a number you risk not just being misunderstood but being refused communication from the start.<br><br>"
   "Titles get in my way: they provoke associations or memories that are too literal. If it is possible to stay at the level of form, the value is preserved.")

# 02
h("02 · Рука, отказ, мир", "02 · The Hand, the Refusal, the World")
qa("О вашей практике пишут как о цветовом минимализме. Но не является ли сдержанность формой привилегии? Где граница, за которой «меньше» перестаёт быть чистотой и становится пустотой? Были ли работы, где вы позволили себе избыток?",
   "Да, были работы с детализацией, текстурами и широкой палитрой. Но возникало впечатление, что за изобилием теряется внятность, а форма переходит в декоративность. Граница находится на уровне ощущений. Пустота — это отсутствие законченной фразы, а чрезмерное самоограничение сразу оборачивается скукой, чувством потери связи со своим языком и безысходности.",
   "Your practice is described as colour minimalism. But is restraint not a form of privilege? Where is the line beyond which “less” stops being purity and becomes emptiness? Were there works in which you allowed yourself excess?",
   "Yes, there were works with detail, textures and a wide palette. But I had the impression that clarity gets lost in abundance and form slides into decoration. The boundary lies at the level of feeling. Emptiness is the absence of a finished phrase, and excessive self-limitation immediately turns into boredom, a sense of losing contact with one’s own language, and hopelessness.")
pair_ = None
i(19); i(21)
qa("Кто в картине автор: вы, материал, случай или зритель? Можно ли изображать случайность? Как вы отличаете в собственной руке живое движение от отработанного?",
   "Случайность и рука сосуществуют. Работа одновременно создана природой, но в ней присутствует автор. Художник организует случайности. Зритель включается, когда работа уже завершена.<br><br>"
   "Изобразить случайность для зрителя можно, но автор знает, что это неслучайность, и тогда для него теряются интерес и ценность. С жестом бывает момент исчерпанности; в таком случае помогает элемент новизны: другой инструмент, материал, краска, изменение движения.<br><br>"
   "На мой взгляд, вопрос не в самом изображении, а в цели, в личностном вложении. Натюрморт может быть ученическим, из-под палки, а может нести в себе ценности автора, жизнь: динамику, твёрдость руки, вкус, чувство цвета. Да, в абстракции нет критерия, это даёт свободу, но и вседоступность, и неопределимость ценности. Теста или специального человека нет; есть необходимая доля неожиданности, случайность и отсутствие натруженности, задуманности.",
   "Who is the author of a painting: you, the material, chance, or the viewer? Can chance be depicted? How do you tell a living movement of your own hand from a rehearsed one?",
   "Chance and the hand coexist. The work is made, at once, by nature, and yet the author is present in it. The artist organises chance. The viewer comes in when the work is already finished.<br><br>"
   "You can depict chance for a viewer, but the author knows that it is not chance, and then interest and value are lost for them. With a gesture there is a moment of exhaustion; in that case an element of novelty helps: another tool, a material, a paint, a change of movement.<br><br>"
   "In my view the question is not the image itself but the purpose, the personal investment. A still life can be a student’s, done under duress, or it can carry the author’s values, life: dynamics, a firm hand, taste, a feeling for colour. Yes, abstraction has no criterion; that gives freedom, but also free-for-all access and an undefinable value. There is no test and no special person; what is needed is a measure of surprise, chance, and the absence of labour or contrivance.")
i(13); i(14)
qa("Может ли картина без сюжета быть свидетелем? Если ваша работа не зависит от того, что происходит в мире, не значит ли это, что она за него не отвечает?",
   "Именно! Не обвинить, не оправдать, не обесценить. Дистанция от повесток. Попытка найти универсальные ценности, которые останутся неизменными в любых перипетиях. Автор неизбежно находится в диалоге с реальностью, прошлым, историей искусства. Это вопрос точки зрения; есть мнение, что чем жёстче время, тем абстрактнее искусство.<br><br>"
   "С другой стороны, я отчётливо понимаю, что в поисках языка отталкивался от конкретных желаний и установок. Большое искусство вне политики, на расстоянии от повесток; искусство, не про «понравиться»; вне сюжетов и смыслов, которые локализуют и обнаруживают личные пределы. Это было и оппозицией изобилию, перепроизводству образов и информации.",
   "Can a painting without a subject be a witness? If your work does not depend on what happens in the world, does that mean it bears no responsibility for it?",
   "Exactly! Not to accuse, not to justify, not to devalue. A distance from agendas. An attempt to find universal values that will stay unchanged through any upheaval. The author is inevitably in dialogue with reality, with the past, with the history of art. It is a question of point of view; there is an opinion that the harsher the time, the more abstract the art.<br><br>"
   "On the other hand, I clearly understand that in searching for a language I started from specific wishes and positions. Great art stands outside politics, at a distance from agendas; art that is not about being liked; outside subjects and meanings that localise and expose one’s personal limits. It was also an opposition to abundance, to the overproduction of images and information.")

# 03
h("03 · Наследие, хозяин, пространство", "03 · Heritage, Host, Space")
qa("Малевич, Родченко и Кандинский верили, что форма меняет жизнь. Во что верите вы? И что для вас значит членство в профессиональных объединениях?",
   "Верю в красоту как таковую, как инстанцию-абсолют, свидетельством взаимодействия с которой является конкретная работа (или не является). Объединения, в том числе Союз абстракционистов России и Союз художников России, — это попытка найти круг единомышленников и своё место в профессиональном сообществе, в институциональной среде. Вступать было не нужно; или нужно — для самоопределения от обратного.<br><br>"
   "На мой взгляд, абстракция даёт свободу для поиска своего языка; это единственное направление сегодня, связанное с традицией, но дающее поле для новаторства. Абстракция — разная. Американский минимализм прошлого века не такой, как современный. Послевоенный абстрактный экспрессионизм в США отличается от японского, и так далее. Личный авторский язык — это возможность выразить себя и самореализоваться. Индивидуальность невоспроизводима и не повторяется в истории.",
   "Malevich, Rodchenko and Kandinsky believed that form changes life. What do you believe in? And what does membership in professional associations mean to you?",
   "I believe in beauty as such, an instance, an absolute, and a particular work is evidence of interaction with it (or is not). The associations, including the Union of Abstractionists of Russia and the Union of Artists of Russia, are an attempt to find a circle of like-minded people and my own place in the professional community, in the institutional environment. There was no need to join; or the need was for self-definition by contrast.<br><br>"
   "In my view abstraction gives freedom to search for one’s own language; it is the only direction today that is tied to tradition yet leaves room for innovation. Abstraction is varied. American minimalism of the last century is not the same as the contemporary kind. Post-war abstract expressionism in the US differs from the Japanese, and so on. A personal authorial language is a chance to express oneself and to realise oneself. Individuality cannot be reproduced and is not repeated in history.")
qa("В вашем Instagram есть подборки «Parazit» и «Borey». Кого или что вы «кормите» и чем питаетесь сами? Может ли художник быть свободным, завися от того, кто покупает и выставляет?",
   "Всё более прозаично. «Паразит» — это сообщество, наследующее ленинградский нонконформизм и arte povera, антитеза союзу художников. Можно сказать, что произведения участников находятся по ту сторону красоты, или это другая красота, с элементами маргинальности и андеграунда. Художник должен быть один, так как сообщество нивелирует индивидуальность. И меня не привлекает юмор в искусстве: попытки рассмешить или обесценить иногда выглядят ширмой и тщетным поиском неуязвимости.<br><br>"
   "Возможно, паразит меняет поведение хозяина, но главное в паразитировании в искусстве, на мой взгляд, это оппонирование официальному, конвенциональному, коммерчески успешному. А в отсутствие хозяина остаются только маргинальность и голый бунт. Я за содержательность помимо этого. Художник утверждает собственные ценности. Думаю, имеет значение поддержание автономности, изолированности собственной кухни от рынка.",
   "Your Instagram has collections called “Parazit” and “Borey”. Whom or what do you “feed”, and what do you feed on? Can an artist be free while depending on those who buy and exhibit?",
   "It is more prosaic. “Parazit” is a community that inherits Leningrad nonconformism and arte povera, an antithesis to the artists’ union. You could say that its members’ works lie on the other side of beauty, or that it is a different beauty, with elements of the marginal and the underground. An artist should be alone, because a community levels individuality. And humour in art does not attract me: attempts to make people laugh or to devalue sometimes look like a screen and a futile search for invulnerability.<br><br>"
   "Perhaps a parasite changes its host’s behaviour, but the main thing in parasitism in art, in my view, is opposition to the official, the conventional, the commercially successful. And without a host, only marginality and bare rebellion remain. I am for substance beyond that. The artist asserts their own values. I think it matters to keep one’s autonomy, to keep one’s own kitchen isolated from the market.")
i(9)
qa("Для какого времени вы работаете: для секунд, которые есть, или для лет, которых никто не даст? И насколько вы готовы отдавать авторство над картиной выставке, куратору, стене?",
   "Думаю, абстракция принимается зрителем, который хочет или готов её принимать. Время не имеет значения. Это может быть долго, если есть потенциал для погружения, или секунды. Мы бессознательно воспринимаем другого за мгновение и фактически решаем, нравится или не нравится, выбираем, общаться или нет.<br><br>"
   "В «Арт-Лиге» мы размещали работы совместно, согласованно. Для меня важна чистота пространства, его способность быть фоном. Кураторам на откуп отдавать не готов, и чужой взгляд, как правило, чужд. На выставке работа раскрывается шире, цикл подходит к завершению, взгляд встречается со взглядом.",
   "Whom do you work for: the seconds that exist, or the years nobody will give? And how far are you willing to hand authorship of a painting to the exhibition, the curator, the wall?",
   "I think abstraction is accepted by a viewer who wants to or is ready to accept it. Time does not matter. It can be long, if there is potential for immersion, or it can be seconds. We perceive another person unconsciously in an instant and in effect decide whether we like them or not, whether to engage or not.<br><br>"
   "At Art-Liga we hung the works together, by agreement. The cleanness of the space matters to me, its ability to be a background. I am not ready to leave it to curators, and another person’s eye is, as a rule, foreign. At an exhibition a work opens up more widely, a cycle comes to completion, one gaze meets another.")
i(12)

# 04
h("04 · Цена, копия, произношение", "04 · Price, Copy, Pronunciation")
qa("Абстрактная картина — почти идеальный товар. Как не стать декоративным? Меняет ли вас присутствие рынка, когда вы выставляетесь на ярмарках вроде Art3f Paris?",
   "Ярмарки — это всегда воодушевляющее живое общение, большое количество новых зрителей, внимания, ещё одна возможность произвести первое впечатление.<br><br>"
   "Мне кажется, есть достаточно понятная граница декоративности. Это про желание понравиться. Оно выражается в сделанности, лоске, изобильности, нарочитой дружелюбности. Если сохранять собственную цель и оставаться в рамках вкуса, это позволяет избежать декора.<br><br>"
   "Рынок меняет. На протяжении нескольких лет я слышу, что нужен цвет, что монохром скучен, уныл, траурен, угрюм. Поэтому в цвет выхожу аккуратно. Но, честно, как говорил Тарковский, цвет мешает сфокусированности сообщения.",
   "An abstract painting is almost the perfect commodity. How do you avoid becoming decorative? Does the presence of the market change you, when you show at fairs such as Art3f Paris?",
   "Fairs are always inspiring, lively contact, a great number of new viewers, attention, one more chance to make a first impression.<br><br>"
   "It seems to me that the line of the decorative is fairly clear. It is about the wish to please. It shows in polish, gloss, abundance, ostentatious friendliness. If you keep your own purpose and stay within the bounds of taste, you can avoid decor.<br><br>"
   "The market does change me. For several years I have been hearing that colour is needed, that monochrome is boring, dreary, funereal, gloomy. So I step into colour carefully. But honestly, as Tarkovsky said, colour gets in the way of the message’s focus.")
i(6); i(11)
qa("Ваши работы видят в ленте тысячи людей, оригинал — десятки. Какая из этих встреч — «работа»? Менялась ли картина, когда вы думали о том, как она будет выглядеть на экране?",
   "Работая в мастерской, я действую так, как считаю необходимым вживую, на медийное пространство не оглядываюсь. Некоторые работы смотрятся на экране менее выразительно; стараюсь публиковать те, которые впечатляют. Думаю, меняется контекст и мерность восприятия, сама работа неизменна. Соцсети воспринимаю как необходимость для целей самопрезентации. Но обязанность постпродакшна и публикации — это работа, не удовольствие.",
   "Thousands of people see your painting in a feed; only dozens see the original. Which of those encounters is “the work”? Did a painting change when you thought about how it would look on screen?",
   "Working in the studio, I act as I think necessary in person; I do not look over my shoulder at the media space. Some works look less expressive on screen; I try to publish the ones that make an impression. I think the context and the dimensionality of perception change; the work itself does not. I regard social media as a necessity for self-presentation. But the duty of post-production and publishing is work, not pleasure.")
i(28)
qa("Каков признак мёртвого стиля — и как вы поймёте, что ваш уже умер? Что заставило бы вас остановиться?",
   "Живое в стиле — это (n+1)×¿, где последнее — случайность, непреднамеренность, непредсказуемость. Стиль мёртв, когда мёртв автор и не может живо, в формате общения, поделиться собственными целями и ценностями. Однако искусствоведы, исследователи и дилеры успешно бальзамируют произведения и обеспечивают их циркуляцию веками.<br><br>"
   "Я делал и авторские повторы работ, и близкое к ожиданиям, но это было в формате заказа, я воспринимал это как коммерческое. В мастерской ориентируюсь только на свои предпочтения. Брак есть, но он скорее связан с хождением по краю эстетичного. Есть мнение, что фрустрация — путь субъективации. Наверное, в длинной перспективе это так, но каждый провал может быть последним.<br><br>"
   "Не могу представить ситуацию, когда дальше уже нельзя. Из принципа — да, когда видишь, что приём заюзали и превратили в китч (не как художественный приём). Вероятно, может остановить изобилие, когда незачем работать: это точно может изменить внутреннюю интенцию. Но предполагаю, что продолжу работать для себя, в стол.",
   "What is the sign of a dead style, and how will you know yours has died? What would make you stop?",
   "What is alive in a style is (n+1)×¿, where the last term is chance, the unintended, the unpredictable. A style is dead when the author is dead and cannot share their own aims and values in a living, conversational form. Yet art historians, researchers and dealers successfully embalm works and keep them in circulation for centuries.<br><br>"
   "I have also made authorial repeats of works, and work close to expectations, but that was on commission, and I regarded it as commercial. In the studio I am guided only by my own preferences. There are failures, but they are mostly connected with walking along the edge of the aesthetic. There is an opinion that frustration is the path to subjectivation. In the long run that is probably so, but every failure may be the last.<br><br>"
   "I cannot imagine a situation in which it is no longer possible to go on. On principle, yes: when you see that a device has been overused and turned into kitsch (not as an artistic device). Abundance, when there is no reason to work, could probably stop me; it could certainly change one’s inner intention. But I assume I will keep working for myself, for the drawer.")
i(26); i(27)

# 05
h("05 · Слова, время, остаток", "05 · Words, Time, What Remains")
qa("Об абстракции пишут либо пусто, либо слишком поясняюще. Какое одно слово или фразу вы позволили бы нам поставить рядом с вашей картиной?",
   "Действительно, лучше бы без слов. Но «Nothing but everything» подойдёт). Критик и зритель существуют в другой плоскости. Для меня абстракция — это непосредственное восприятие и степень обобщения. Интерпретации и ассоциации — необходимые элементы коммуникации, существования арт-мира. Мне кажется, любую работу можно истолковать, и не единственным образом. Это инструмент культурного маркетинга.",
   "Abstraction is written about either emptily or with too much explanation. What single word or phrase would you allow us to place next to your painting?",
   "Really, it would be better without words. But “Nothing but everything” will do). The critic and the viewer exist in another plane. For me abstraction is direct perception and a degree of generalisation. Interpretations and associations are necessary elements of communication, of the existence of the art world. It seems to me that any work can be interpreted, and not in only one way. It is an instrument of cultural marketing.")
qa("Что от вашей работы останется, когда не останется вас, ваших объяснений и имени? Если бы вы могли оставить только одну работу — какой бы она была? И какой вопрос без ответа вы оставили бы читателям?",
   "Останутся композиция, мастерство и вкус, недосказанность и внутренняя динамика. Если это захотят увидеть. Истории и легенды более увлекательны).<br><br>"
   "Я бы оставил <i>Ugly beauty</i>, 2023 года. «Ужасно прекрасное» или «уродливая красота»). Это работа, в которой я сформулировал цель: самыми простыми средствами — о максимуме.<br><br>"
   "А вопрос такой: есть ли место слову «красота» в искусстве сегодня, или оно вытеснено понятием «художественная правда»? Может ли существовать красота как таковая, как инстанция, идеал?",
   "What will remain of your work when you, your explanations and your name are gone? If you could keep only one work, which would it be? And what unanswered question would you leave to our readers?",
   "What will remain is the composition, craft and taste, the unsaid and the inner dynamic. If anyone wants to see it. Stories and legends are more entertaining).<br><br>"
   "I would keep <i>Ugly beauty</i>, from 2023. “Terribly beautiful” or “ugly beauty”). It is the work in which I formulated the aim: with the simplest means, to speak about the maximum.<br><br>"
   "And the question is this: is there a place for the word “beauty” in art today, or has it been displaced by the notion of “artistic truth”? Can beauty exist as such, as an instance, an ideal?")
quote("Художник организует случайности.", "The artist organises chance.")
i(29)
i(5)
NOTE = ("Интервью: Viacheslav Munister. Ответы: Ярослав Селезнёв, с небольшой редактурой для ясности и пунктуации. Вопросы сокращены. Все работы и фотографии публикуются по инициативе художника.",
        "Interview by Viacheslav Munister. Answers by Yaroslav Seleznev, lightly edited for clarity and punctuation. Questions have been shortened. All artworks and photographs courtesy of the artist.")


def blocks(lang):
    k = 0 if lang == "ru" else 1
    out = []
    for it in C:
        t = it[0]
        if t == "h":
            out.append({"type": "header", "content": it[1 + k], "level": 2})
            out.append({"type": "text", "content": "<i>" + LEAD[it[1][:2]][k] + "</i>"})
        elif t == "p": out.append({"type": "text", "content": it[1 + k]})
        elif t == "qa":
            q = it[1] if k == 0 else it[3]; a = it[2] if k == 0 else it[4]
            out.append({"type": "text", "content": f"<b>VM:</b> {q}"})
            out.append({"type": "text", "content": f"<b>YS:</b> {a}"})
        elif t == "i":
            b = img(it[1]); b["caption"] = re.sub(r"</?i>", "", CAP[it[1]][k]); out.append(b)
        elif t == "quote": out.append({"type": "quote", "content": it[1 + k]})
    out.append({"type": "text", "content": CLOSE[k]})
    out.append({"type": "note", "content": NOTE[k]})
    # first speaker labels in full, as in other interviews
    first = True
    for b in out:
        if b["type"] == "text" and b["content"].startswith("<b>VM:</b>") and first:
            b["content"] = b["content"].replace("<b>VM:</b>", "<b>Viacheslav Munister [VM]:</b>", 1)
        if b["type"] == "text" and b["content"].startswith("<b>YS:</b>") and not first is False:
            pass
        if b["type"] == "text" and b["content"].startswith("<b>YS:</b>") and first:
            b["content"] = b["content"].replace("<b>YS:</b>", "<b>Yaroslav Seleznev [YS]:</b>", 1); first = False
    for b in out: b.pop("_n", None)
    if True:
        O = json.load(open(os.path.join(HERE, f"{lang}_plain.json")))
        for i, v in O.items(): out[int(i)]["content"] = v
    return out


def article(lang):
    k = 0 if lang == "ru" else 1
    return {
        "id": 68, "draft": True, "title": TITLE[k],
        "author": "Viacheslav Munister & Yaroslav Seleznev", "role": "Автор" if k == 0 else "Author",
        "authorId": "author-1784732936927-kw554", "contributorId": "author-yaroslav-seleznev",
        "date": "13 окт. 2026" if k == 0 else "Oct 13, 2026",
        "excerpt": EXCERPT[k],
        "category": "Искусство" if k == 0 else "Art",
        "subcategory": "Интервью" if k == 0 else "Interview",
        "tags": TAGS[k], "imageSeed": "",
        "imageUrl": UP + IMG(3), "previewToken": "yaroslav-seleznev-20261013",
        "content": blocks(lang),
    }


AUTHOR = {
 "id": "author-yaroslav-seleznev", "name": "Yaroslav Seleznev",
 "role": "Painter",
 "bio": "Yaroslav Seleznev is a painter working in abstraction. He studied in a master’s studio linked to the Academy of Arts, coming to academic realism as an adult, and later gave up recognisable subjects for a language of broad brushstrokes, graphic materials and a restrained palette. His solo exhibition Composition No. was held at the Art-Liga gallery; his work has also been shown in Paris at Deux Paris (2025) and Art3f (2026), and at the exhibition Garden (2025).",
 "photoUrl": UP + IMG(5), "website": "", "instagram": "", "active": True, "showOnTeam": True, "collaborator": True, "teamOrder": 24}

def preview():
    def render(lang):
        a = article(lang); k = 0 if lang == "ru" else 1
        o = [f'<div class="lang" id="{lang}"{" hidden" if lang=="en" else ""}>',
             f'<div class="kick">{a["category"]} · {a["subcategory"]}</div><h1>{html.escape(a["title"])}</h1>',
             f'<p class="dek">{html.escape(a["excerpt"])}</p><p class="by">{a["author"]} · {a["date"]}</p>']
        for b in a["content"]:
            c = b["content"]
            if b["type"] == "header": o.append(f"<h2>{html.escape(c)}</h2>")
            elif b["type"] == "text":
                cls = "yq" if c.startswith("<b>Yaroslav") or c.startswith("<b>YS") else ("vq" if c.startswith("<b>V") else "")
                o.append(f'<p class="{cls}">{c}</p>')
            elif b["type"] == "image":
                n = int(c.rsplit("-", 1)[1].split(".")[0])
                o.append(f'<figure><img src="img/{n:02d}.webp" loading="lazy"><figcaption>{b["caption"]}</figcaption></figure>')
            elif b["type"] == "quote": o.append(f"<blockquote>{html.escape(c)}</blockquote>")
            elif b["type"] == "note": o.append(f'<p class="note">{html.escape(c)}</p>')
        o.append("</div>")
        return "\n".join(o)
    page = f"""<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EPRIS · Seleznev · draft</title><style>
body{{margin:0;background:#f4f2ee;color:#111;font:18px/1.65 Georgia,'Times New Roman',serif}}
.bar{{position:sticky;top:0;background:#111;color:#fff;padding:10px 16px;font:14px system-ui;display:flex;gap:10px;align-items:center;z-index:5}}
.bar b{{margin-right:auto;letter-spacing:.08em}} .bar button{{background:#222;color:#fff;border:1px solid #555;padding:6px 14px;cursor:pointer}} .bar button.on{{background:#fff;color:#111}}
.wrap{{max-width:760px;margin:0 auto;padding:32px 16px 80px}} h1{{font-size:40px;line-height:1.1;margin:.2em 0}} h2{{margin:2em 0 .6em;font-size:26px;border-top:2px solid #111;padding-top:.6em}}
.kick{{font:12px system-ui;letter-spacing:.14em;text-transform:uppercase}} .dek{{font-size:21px;color:#333}} .by{{font:13px system-ui;color:#666}}
.vq{{font-style:italic;color:#444;margin-top:1.6em}} .yq{{margin-top:.2em}} figure{{margin:2em 0}} img{{max-width:100%;display:block;margin:auto;max-height:80vh}} figcaption{{font:13px system-ui;color:#666;text-align:center;margin-top:8px}}
blockquote{{font-size:30px;line-height:1.25;margin:1.6em 0;padding-left:20px;border-left:4px solid #111}} .note{{font:13px system-ui;color:#666;border-top:1px solid #aaa;padding-top:12px;margin-top:3em}}
[hidden]{{display:none}}</style></head><body>
<div class="bar"><b>EPRIS · DRAFT FOR APPROVAL</b><button id="b-ru" class="on">RU</button><button id="b-en">EN</button></div>
<div class="wrap">{render("ru")}{render("en")}</div>
<script>for(const l of["ru","en"])document.getElementById("b-"+l).onclick=()=>{{for(const m of["ru","en"]){{document.getElementById(m).hidden=m!=l;document.getElementById("b-"+m).classList.toggle("on",m==l)}}scrollTo(0,0)}}</script></body></html>"""
    open(os.path.join(HERE, "preview.html"), "w").write(page)


if __name__ == "__main__":
    for lang in ("ru", "en"):
        json.dump(article(lang), open(os.path.join(HERE, f"article_{lang}.json"), "w"), ensure_ascii=False, indent=1)
    preview()
    print("ok")

if __name__ == "__main__":
    json.dump(AUTHOR, open(os.path.join(HERE, "author.json"), "w"), ensure_ascii=False, indent=1)
