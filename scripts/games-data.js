window.TEACHEDOS_GAME_DATA = {
  matchThemes: [
    {
      id: "science",
      name: "Наукові терміни",
      pairs: [
        { id: "s1", term: "Photosynthesis", definition: "процес, у якому рослини перетворюють світло на енергію" },
        { id: "s2", term: "Mitochondria", definition: "частина клітини, що виробляє енергію" },
        { id: "s3", term: "Gravity", definition: "сила, що притягує тіла з масою" },
        { id: "s4", term: "Velocity", definition: "швидкість із зазначеним напрямком" },
        { id: "s5", term: "Atom", definition: "найменша одиниця хімічного елемента" },
        { id: "s6", term: "Osmosis", definition: "рух води крізь напівпроникну мембрану" },
        { id: "s7", term: "Pi (π)", definition: "відношення довжини кола до його діаметра" },
        { id: "s8", term: "Haiku", definition: "японський вірш із сімнадцяти складів" }
      ]
    },
    {
      id: "geo",
      name: "Країни та столиці",
      pairs: [
        { id: "g1", term: "France", definition: "Paris" },
        { id: "g2", term: "Japan", definition: "Tokyo" },
        { id: "g3", term: "Brazil", definition: "Brasilia" },
        { id: "g4", term: "Australia", definition: "Canberra" },
        { id: "g5", term: "Egypt", definition: "Cairo" },
        { id: "g6", term: "Canada", definition: "Ottawa" },
        { id: "g7", term: "Italy", definition: "Rome" },
        { id: "g8", term: "Germany", definition: "Berlin" }
      ]
    },
    {
      id: "coding",
      name: "Основи програмування",
      pairs: [
        { id: "c1", term: "Variable", definition: "контейнер для збереження значень" },
        { id: "c2", term: "Loop", definition: "повторення одного й того самого блоку коду" },
        { id: "c3", term: "Function", definition: "блок коду, який виконує окреме завдання" },
        { id: "c4", term: "Array", definition: "структура, що містить кілька значень" },
        { id: "c5", term: "Boolean", definition: "тип даних із двома значеннями: true або false" },
        { id: "c6", term: "API", definition: "набір правил для взаємодії між програмами" },
        { id: "c7", term: "Bug", definition: "помилка або дефект у програмі" },
        { id: "c8", term: "Git", definition: "розподілена система контролю версій" }
      ]
    }
  ],
  opinionPersonas: [
    { id: "A", name: "Alex", label: "Підтримує", color: "var(--positive)", bg: "rgba(20,155,113,0.12)" },
    { id: "B", name: "Bianca", label: "Критикує", color: "var(--negative)", bg: "rgba(217,94,94,0.12)" },
    { id: "C", name: "Chris", label: "Змішана позиція", color: "var(--balanced)", bg: "rgba(154,111,241,0.12)" },
    { id: "D", name: "Dana", label: "Практичний погляд", color: "var(--practical)", bg: "rgba(59,130,246,0.12)" }
  ],
  opinionLengthConfigs: {
    short: { extra: "", tail: "" },
    medium: {
      extra: " It changes how students take part in the lesson.",
      tail: ""
    },
    long: {
      extra: " It can affect motivation, classroom atmosphere, and how confident students feel when they speak.",
      tail: " In my view, the best classroom tasks give students a reason to explain and react, not just repeat one line."
    }
  },
  opinionLevelLibrary: {
    A1: [
      "I think TOPIC is a good idea. It helps students and makes lessons easier.",
      "I do not like TOPIC. It can be stressful and not every student needs it.",
      "I can see good and bad sides. It may help some people, but it may also cause problems.",
      "For me, the main point is simple: teachers need clear rules and students need a fair system."
    ],
    A2: [
      "I think TOPIC is useful because it can make lessons more focused and more organised.",
      "I am not convinced about TOPIC because it may create pressure and reduce natural interest.",
      "There are advantages and disadvantages. It may work in one school, but not in another.",
      "In practice, success depends on the rules, the teacher, and the age of the students."
    ],
    B1: [
      "I support TOPIC because it can improve concentration and give the class a clearer structure.",
      "I disagree with TOPIC because students also need trust, choice, and a realistic learning environment.",
      "I have mixed feelings about TOPIC because the idea sounds helpful, but the results may depend on context.",
      "From a practical point of view, TOPIC only works when expectations are clear for everyone."
    ],
    B2: [
      "On the whole, I support TOPIC because it can raise academic focus and reduce unnecessary distractions.",
      "I remain critical of TOPIC because it may ignore individual needs and oversimplify a complex issue.",
      "My view is balanced: TOPIC could be effective, yet it may also produce side effects if applied too rigidly.",
      "What matters most is implementation. Even a sensible idea like TOPIC can fail without thoughtful planning."
    ],
    C1: [
      "Broadly speaking, I am in favour of TOPIC because it can reinforce purpose, clarity, and sustained attention in the classroom.",
      "I am sceptical about TOPIC since it risks treating a nuanced educational question as if one rule could solve everything.",
      "My position is ambivalent: TOPIC has merit, although its impact depends heavily on context, age group, and classroom culture.",
      "From a pragmatic perspective, the debate is less about principle and more about whether the policy is implemented intelligently."
    ]
  },
  quizFocusOptions: [
    "Main Idea",
    "Detailed Comprehension",
    "Vocabulary in Context",
    "Inference / Implication",
    "Grammar in Context",
    "Exam Style"
  ],
  quizStopwords: [
    "the", "and", "that", "with", "from", "this", "have", "were", "they", "their", "there",
    "about", "would", "could", "should", "because", "which", "while", "where", "when",
    "what", "your", "into", "been", "than", "them", "then", "also", "only", "some",
    "many", "more", "most", "such", "very", "much", "over", "after", "before", "during",
    "between", "through", "other", "these", "those", "each", "just", "like", "will",
    "students", "student", "teacher", "teachers", "lesson", "lessons", "language", "english"
  ]
};
