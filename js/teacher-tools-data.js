/* ════════════════════════════════════════════════════════════════
   TeachEd · board.html - teacher tools, seed content and lesson
   pack data. Extracted to its own file so the main board.html
   stays editable. Loaded synchronously from board.html before the
   inline script, so the constants are accessible as bare names.
   Total ~60 KB of pure data - no behaviour, safe to cache long.
═══════════════════════════════════════════════════════════════ */
(function() {

/* ─── BOARD_TEACHER_TOOLS ─── */
const BOARD_TEACHER_TOOLS = [
  /* Студия «Vocabulary Workout» живёт в хабе, а не здесь: её конвейер
     (ttEngineOutput, requestServerHubAI, aiResultToOutput) объявлен в
     scripts/teacher-tools-app.js, который доска не грузит. Поэтому карточка
     `studio:true` помечает инструмент, который строит НАБОР материалов, а не
     один: панель показывает ему чек-лист активностей вместо полей одиночного
     движка, а перетаскивание отключено - у набора нет Frame-шаблона.

     Сами активности лежат ниже, в BOARD_WORKOUT_ACTIVITIES. */
  {id:'vocab-workout',cat:'vocabulary',title:'Vocabulary Workout',desc:'One word list becomes a whole practice set: tick the activities you need and they all land on the board.',kind:'Activity set',studio:true},
  {id:'lesson-pack',cat:'utility',title:'Complete Lesson Pack Builder',desc:'Warm-up, input, practice, production, homework and teacher notes from one topic.',kind:'Lesson Flow'},
  {id:'worksheet-builder',cat:'utility',title:'ESL Worksheet Builder',desc:'Printable worksheet with tasks, answer key and teacher notes.',kind:'Worksheet'},
  {id:'homework-set',cat:'utility',title:'Homework Assignment Builder',desc:'Trackable homework brief, success criteria and self-check.',kind:'Homework'},
  {id:'cefr-checker',cat:'utility',title:'CEFR Level Checker',desc:'Estimate text level and suggest simplification or upgrade moves.',kind:'Analyzer'},
  {id:'rubric-maker',cat:'utility',title:'Rubric & Success Criteria',desc:'Create clear criteria for speaking, writing, project or homework assessment.',kind:'Rubric'},
  {id:'answer-key',cat:'utility',title:'Answer Key Generator',desc:'Teacher answer key, distractor notes and common error watch-list.',kind:'Teacher Aid'},
  {id:'add-text',cat:'utility',title:'Add Your Text',desc:'Clean classroom text block with pre/post reading activities.',kind:'Content'},
  {id:'add-images',cat:'utility',title:'Add Your Images',desc:'Image description, prediction and comparison task scaffold.',kind:'Media'},
  {id:'add-video',cat:'utility',title:'Add Your Video',desc:'Viewing focus, gist/detail questions and follow-up speaking task.',kind:'Media'},

  {id:'text-topic-vocab',cat:'reading',title:'Create a Text with Your Vocabulary',desc:'Leveled reading text that naturally includes target vocabulary.',kind:'Reading Text'},
  {id:'abcd-text',cat:'reading',title:'Create ABCD Questions for a Text',desc:'Multiple-choice comprehension questions with one correct answer.',kind:'MCQ'},
  {id:'open-questions',cat:'reading',title:'Create Open Questions for a Text',desc:'Open-ended comprehension and discussion questions.',kind:'Questions'},
  {id:'true-false',cat:'reading',title:'Create True/False Statements',desc:'Fast reading check with true and false statements.',kind:'Check'},
  {id:'three-titles',cat:'reading',title:'Create Three Titles for a Text',desc:'One correct title and two plausible distractors.',kind:'Titles'},
  {id:'summary-task',cat:'reading',title:'Summarize a Text',desc:'Main idea, key details and short student summary prompt.',kind:'Summary'},
  {id:'simplify-text',cat:'reading',title:'Simplify / Upgrade a Text',desc:'Adapt source text up or down by CEFR level.',kind:'Adaptation'},
  {id:'gist-detail',cat:'reading',title:'Gist + Detail Reading Tasks',desc:'Prediction, gist scan, detail questions and transfer speaking.',kind:'Reading Flow'},
  {id:'generate-text',cat:'reading',title:'Generate a Text on a Topic',desc:'A ready-to-use leveled reading text with pre- and post-reading tasks.',kind:'Reading Text'},
  {id:'tf-not-given',cat:'reading',title:'True / False / Not Given',desc:'Exam-style statements: true, false, or not mentioned in the text.',kind:'Check'},
  {id:'vocab-in-context',cat:'reading',title:'Vocabulary in Context',desc:'Multiple-choice questions on what words mean as used in the text.',kind:'MCQ'},
  {id:'reference-questions',cat:'reading',title:'Reference Questions',desc:'What do "it / this / they / these" refer to in the text?',kind:'Questions'},
  {id:'match-headings',cat:'reading',title:'Match Headings to Paragraphs',desc:'Students match a heading to each paragraph of the text.',kind:'Matching'},
  {id:'sentence-insertion',cat:'reading',title:'Sentence Insertion',desc:'Where does the removed sentence best fit back into the text?',kind:'MCQ'},
  {id:'reading-bits',cat:'reading',title:'Reading: Bits and Pieces',desc:'Split a text into jumbled pieces for students to reorder.',kind:'Reorder'},

  {id:'word-image-match',cat:'vocabulary',title:'Word-Image Matching',desc:'Visual matching exercise for words and image prompts.',kind:'Matching'},
  {id:'word-definition-match',cat:'vocabulary',title:'Word-Definition Matching',desc:'Vocabulary pairs ready for cards, memory match or worksheet.',kind:'Matching'},
  {id:'extract-vocab',cat:'vocabulary',title:'Extract Vocabulary From a Text',desc:'Pull useful words and phrases from source text.',kind:'Extraction'},
  {id:'essential-vocab',cat:'vocabulary',title:'Essential Vocabulary on a Topic',desc:'Topic vocabulary with definitions, examples and checking questions.',kind:'Vocab Set'},
  {id:'odd-one-out',cat:'vocabulary',title:'Odd One Out',desc:'Groups where students identify the item that does not belong.',kind:'Sorting'},
  {id:'word-sorting',cat:'vocabulary',title:'Words Sorting',desc:'Categorise words for drag-and-drop or board sorting tasks.',kind:'Sorting'},
  {id:'sentences-vocab',cat:'vocabulary',title:'Create Sentences with Vocabulary',desc:'Example sentences and student sentence prompts for target words.',kind:'Sentence Set'},
  {id:'collocations',cat:'vocabulary',title:'Collocation Builder',desc:'Natural word partnerships and mini practice tasks.',kind:'Collocations'},
  {id:'word-families',cat:'vocabulary',title:'Word Families',desc:'Noun, verb, adjective and adverb forms with examples.',kind:'Word Forms'},
  {id:'flashcards',cat:'vocabulary',title:'Flashcard Set',desc:'Front/back vocabulary cards with retrieval prompts.',kind:'Flashcards'},
  {id:'synonyms-antonyms',cat:'vocabulary',title:'Synonyms & Antonyms',desc:'Synonyms and antonyms for each word with an example sentence.',kind:'Word Bank'},
  {id:'phrasal-verbs',cat:'vocabulary',title:'Phrasal Verbs',desc:'Topic phrasal verbs with meaning and a natural example.',kind:'Phrasal Verbs'},
  {id:'idioms',cat:'vocabulary',title:'Idioms & Expressions',desc:'Useful idioms with plain meaning and an example in context.',kind:'Idioms'},

  {id:'link-words',cat:'writing',title:'Link Words into Sentences',desc:'Students connect target words into meaningful sentence chains.',kind:'Writing'},
  {id:'creative-writing',cat:'writing',title:'Creative Writing with Target Vocabulary',desc:'Prompt, constraints and checklist for using target vocabulary.',kind:'Prompt'},
  {id:'sentence-translation',cat:'writing',title:'Sentence Translation Exercises',desc:'Translation prompts around vocabulary or grammar focus.',kind:'Translation'},
  {id:'essay-outline',cat:'writing',title:'Essay Outline Builder',desc:'Thesis, body paragraph plan, evidence and conclusion scaffold.',kind:'Essay'},
  {id:'email-reply',cat:'writing',title:'Email Reply Builder',desc:'Functional email task with tone, useful phrases and checklist.',kind:'Email'},
  {id:'rewrite-style',cat:'writing',title:'Rewrite for Tone / Style',desc:'Rewrite sentences to be more formal, friendly, concise or academic.',kind:'Rewrite'},

  {id:'gap',cat:'grammar',title:'Fill in the Gap',desc:'Gap-fill grammar or vocabulary exercise with answer key.',kind:'Gap Fill'},
  {id:'gaps-abcd',cat:'grammar',title:'Gaps with ABCD',desc:'Multiple-choice gap-fill grammar task.',kind:'MCQ'},
  {id:'gaps-brackets',cat:'grammar',title:'Gaps with Brackets',desc:'Students transform bracketed words into the correct form.',kind:'Word Form'},
  {id:'two-options',cat:'grammar',title:'Two Options with a Slash',desc:'Choose the correct option in context.',kind:'Choice'},
  {id:'rewrite',cat:'grammar',title:'Rewrite the Sentence',desc:'Sentence transformation focused on one grammar structure.',kind:'Transformation'},
  {id:'error-correction',cat:'grammar',title:'Error Correction Exercise',desc:'Mistake spotting and correction with explanation prompt.',kind:'Correction'},
  {id:'grammar-rules',cat:'grammar',title:'Grammar Rules',desc:'Concise rule, examples, common mistakes and practice.',kind:'Rule'},
  {id:'tense-contrast',cat:'grammar',title:'Tense Contrast Trainer',desc:'Compare two tenses/functions with timeline and examples.',kind:'Tenses'},

  {id:'discussion',cat:'speaking',title:'Find Discussion Questions',desc:'Warm-up, deeper and follow-up questions for a topic.',kind:'Discussion'},
  {id:'dialogue',cat:'speaking',title:'Create a Dialogue on Any Topic',desc:'Role-play dialogue with target vocabulary and extension.',kind:'Dialogue'},
  {id:'roleplay-cards',cat:'speaking',title:'Role-Play Cards',desc:'Student A/B role cards with goal, phrases and challenge.',kind:'Role Play'},
  {id:'debate-cards',cat:'speaking',title:'Debate Cards',desc:'For/against claims, evidence prompts and rebuttal language.',kind:'Debate'},
  {id:'question-ladder',cat:'speaking',title:'Question Ladder',desc:'Simple-to-advanced question sequence for fluency growth.',kind:'Fluency'},
  {id:'conversation-starters',cat:'speaking',title:'Conversation Starters',desc:'Fun "would you rather", openers and personal questions to get students talking.',kind:'Warm-up'},

  {id:'audio-video-questions',cat:'listening',title:'Audio & Video Question Creator',desc:'Question set from transcript, video notes or listening focus.',kind:'Listening'},
  {id:'transcript-helper',cat:'listening',title:'Transcript to Lesson Tasks',desc:'Turn transcript into gist, detail, vocab and speaking tasks.',kind:'Transcript'},
  {id:'warmup-listening',cat:'listening',title:'Warm-Up Before Listening',desc:'Prediction questions and vocabulary preparation before media.',kind:'Warm-up'},
  {id:'listening-dictation',cat:'listening',title:'Dictation / Shadowing Task',desc:'Short dictation, chunking and pronunciation practice flow.',kind:'Pronunciation'},

  /* Перенесено из реестра хаба (scripts/teacher-tools-app.js): эти
     инструменты были доступны ТОЛЬКО со страницы Teacher Tools, хотя доска
     умеет их выполнять - генераторы для всех пятнадцати уже лежат в
     scripts/board-gen.js, не хватало лишь записи в этом списке. Шаг к тому,
     чтобы всё работало с доски; сами хабы пока на месте. */
  {id:'word-translation-match',cat:'vocabulary',title:'Word-Translation Matching',desc:'Translate target words and build matching pairs for bilingual vocabulary practice.',kind:'Matching'},
  {id:'word-order',cat:'grammar',title:'Word Order / Unscramble',desc:'Shuffle sentence words for students to put back in the correct order.',kind:'Reorder'},
  {id:'matching-halves',cat:'grammar',title:'Matching Halves',desc:'Split collocations or sentences into two halves for students to match.',kind:'Matching'},
  {id:'comm-situations',cat:'vocabulary',title:'Communicative Situations',desc:'Generate role-play situation cards that use the target vocabulary.',kind:'Role Play'},
  {id:'rephrase-word',cat:'vocabulary',title:'Rephrase Using Word Given',desc:'Rewrite sentences keeping the meaning, using a given key word.',kind:'Transformation'},
  {id:'four-opinions',cat:'writing',title:'Four Opinions',desc:'Present four contrasting opinions on a topic for response writing.',kind:'Discussion'},
  {id:'find-quotes',cat:'writing',title:'Find Quotes',desc:'Collect relevant quotes about a topic for discussion and writing.',kind:'Extraction'},
  {id:'essay-topics',cat:'writing',title:'Essay Topics',desc:'Generate essay prompts and questions on any topic.',kind:'Prompt'},
  {id:'lead-in',cat:'speaking',title:'Lead-in Activities',desc:'Create quick warm-up activities to introduce a topic.',kind:'Warm-up'},
  {id:'interesting-facts',cat:'speaking',title:'Interesting Facts',desc:'Generate fact-based discussion starters about a topic.',kind:'Content'},
  {id:'pros-cons',cat:'speaking',title:'Pros and Cons',desc:'List arguments for and against a topic for debate practice.',kind:'Discussion'},
  {id:'type-gap',cat:'grammar',title:'Type Anything into Gap',desc:'Create open cloze gaps where students type a suitable word.',kind:'Gap Fill'},
  {id:'word-bank',cat:'grammar',title:'Fill from Word Bank',desc:'Gap-fill where students choose answers from a provided word bank.',kind:'Word Bank'},
  {id:'summary-gapfill',cat:'listening',title:'Summary GapFill',desc:'Create a gapped summary of a transcript for listening practice.',kind:'Summary'},
  {id:'choose-summary',cat:'listening',title:'Choose Right Summary',desc:'Offer several summaries so students pick the correct one.',kind:'Choice'}
];

/* ─── TOOL_SEED_CONTENT ─── */
const TOOL_SEED_CONTENT = {
  // Speaking
  'discussion': {
    samples: [
      'How often do you discuss this with friends and why?',
      'What changed your opinion about this most recently?',
      'Is there a country or culture where this looks completely different?',
      'If you had to convince a sceptic in 30 seconds, what would you say?',
      'Which question here is the hardest to answer honestly?'
    ],
    language: ['I would say… because…', 'It depends on…', 'On the other hand…', 'Personally, I tend to…', 'Have you ever thought about…?']
  },
  'dialogue': {
    samples: [
      'A: Excuse me, could I ask you something?',
      'B: Sure, what do you need?',
      'A: I was wondering if… (state your request).',
      'B: That sounds… (positive / hesitant / interested).',
      'A: Right, so… (suggest a next step or compromise).'
    ],
    language: ['Could I…?', 'Would you mind…?', 'I was wondering if…', 'That sounds great.', 'Let me think about it.']
  },
  'roleplay-cards': {
    samples: [
      'Student A - Goal: convince B to choose your plan. Constraint: must use one polite request.',
      'Student B - Goal: protect your time. Constraint: must give one reason and one compromise.',
      'Phrases A: "What if we…", "How about…", "I really think…"',
      'Phrases B: "I see your point, but…", "I would prefer…", "Could we agree on…?"',
      'Challenge: switch roles after 2 minutes and try again with new phrases.'
    ],
    language: ['What if we…', 'I see your point, but…', 'Could we agree on…?', 'I would prefer…', 'How about…?']
  },
  'debate-cards': {
    samples: [
      'Claim FOR: This is the best option because it solves the main problem.',
      'Evidence FOR: A real example or statistic that supports the claim.',
      'Claim AGAINST: This causes more problems than it solves.',
      'Evidence AGAINST: A different example or downside.',
      'Rebuttal language: "That may be true, however…", "The evidence actually shows…"'
    ],
    language: ['That may be true, however…', 'The evidence shows…', 'I disagree because…', 'A stronger argument is…', 'In contrast…']
  },
  'question-ladder': {
    samples: [
      'Level 1 (factual): What is it?',
      'Level 2 (descriptive): What is it like?',
      'Level 3 (analytical): Why does it work that way?',
      'Level 4 (evaluative): Is it better or worse than the alternative?',
      'Level 5 (personal): How does it affect you?'
    ],
    language: ['What…?', 'Why…?', 'How…?', 'Is it better or worse than…?', 'How does this affect you?']
  },
  // Reading
  'abcd-text': {
    samples: [
      '1. The main idea of the text is…  A) … B) … C) … D) ✓',
      '2. According to paragraph 2…  A) ✓ B) … C) … D) …',
      '3. The author probably believes…  A) … B) ✓ C) … D) …',
      '4. The word X in line 7 means…  A) … B) … C) ✓ D) …',
      '5. We can infer that…  A) … B) … C) … D) ✓'
    ],
    language: ['According to the text…', 'The author implies…', 'It can be inferred…', 'The word X means…', 'The main idea is…']
  },
  'true-false': {
    samples: [
      '1. The text says X happens every day. (T / F - paragraph 1)',
      '2. The author personally agrees with Y. (T / F - last paragraph)',
      '3. Z is the main reason mentioned. (T / F - paragraph 3)',
      '4. The text gives a clear solution. (T / F - paragraph 4)',
      '5. The example is from a real study. (T / F - paragraph 2)'
    ],
    language: ['according to', 'the text states', 'the author mentions', 'it suggests that', 'we can conclude']
  },
  'open-questions': {
    samples: [
      'Why do you think the author chose this title?',
      'Which part surprised you the most and why?',
      'How would the text change if it was written for children?',
      'Do you agree with the main idea? Give a personal example.',
      'What question would you ask the author?'
    ],
    language: ['I think the author…', 'The part that surprised me…', 'In my experience…', 'A question I would ask is…']
  },
  // Vocabulary
  'extract-vocab': {
    samples: ['word - short student-friendly definition + 1 example', 'collocation - common partner words', 'phrasal - verb + particle meaning', 'idiom - figurative meaning + register', 'word family - noun / verb / adj. / adv.'],
    language: ['means', 'can be replaced by', 'collocates with', 'is used to', 'is the opposite of']
  },
  'essential-vocab': {
    samples: [
      'core noun - definition + example sentence',
      'core verb - definition + collocation + example',
      'core adjective - definition + opposite',
      'useful phrase - definition + when to use it',
      'connector - purpose + example'
    ],
    language: ['It means…', 'For example…', 'The opposite is…', 'It collocates with…', 'We use this when…']
  },
  'word-image-match': {
    samples: ['Image A ↔ word ____', 'Image B ↔ word ____', 'Image C ↔ word ____', 'Image D ↔ word ____', 'Image E ↔ word ____'],
    language: ['This shows…', 'It looks like…', 'I think this is…']
  },
  'collocations': {
    samples: ['make a decision / *do a decision', 'take a break / *make a break', 'strong coffee / *powerful coffee', 'heavy traffic / *strong traffic', 'do homework / *make homework'],
    language: ['Verb + noun', 'Adjective + noun', 'Adverb + adjective']
  },
  'flashcards': {
    samples: ['Front: word    Back: definition + example sentence', 'Front: definition   Back: word', 'Front: phrase   Back: meaning + register', 'Front: image   Back: word + collocations', 'Front: word   Back: synonym / opposite'],
    language: ['Got it', 'Almost', 'Again', 'Easy', 'Hard']
  },
  // Grammar
  'gap': {
    samples: [
      '1. She _____ (live) in Berlin since 2019.',
      '2. By next month, we _____ (finish) the project.',
      '3. If I _____ (be) you, I would speak to him.',
      '4. The report _____ (write) by the new team.',
      '5. I wish I _____ (know) about this earlier.'
    ],
    language: ['present perfect', 'future perfect', 'second conditional', 'passive voice', 'wish + past simple']
  },
  'gaps-abcd': {
    samples: [
      '1. I _____ here for three years.  A) live  B) am living  C) have lived ✓  D) had lived',
      '2. By 2030 we _____ to Mars.  A) will travel  B) will have travelled ✓  C) travel  D) are travelling',
      '3. If she _____ earlier, she would have caught the train.  A) left  B) had left ✓  C) would leave  D) leaves',
      '4. The window _____ by the storm.  A) broke  B) is broken  C) was broken ✓  D) breaks',
      '5. I wish I _____ more time.  A) have  B) had ✓  C) had had  D) would have'
    ],
    language: ['present perfect', 'future perfect', 'third conditional', 'passive', 'wish']
  },
  'rewrite': {
    samples: [
      'Original: She built the house.  →  Rewrite (passive): The house ____ ____ ____ her.',
      'Original: He arrived too late.  →  Rewrite (with "so"): He arrived ____ ____ ____ catch the bus.',
      'Original: I don\'t have time.  →  Rewrite (wish): I wish I ____ more time.',
      'Original: She must finish it.  →  Rewrite (have to): She ____ ____ ____ ____.',
      'Original: They could leave early.  →  Rewrite (be allowed to): They ____ ____ ____ ____ early.'
    ],
    language: ['was/were built by', 'so + adjective + that', 'wish + past simple', 'has/have to', 'is/are allowed to']
  },
  'error-correction': {
    samples: [
      '✗ I am living here since 2019.  ✓ I have lived here since 2019.',
      '✗ She don\'t like coffee.  ✓ She doesn\'t like coffee.',
      '✗ He suggested me to go.  ✓ He suggested that I (should) go.',
      '✗ Despite of the rain…  ✓ Despite the rain…',
      '✗ I look forward to hear from you.  ✓ I look forward to hearing from you.'
    ],
    language: ['since + present perfect', '3rd person -s', 'suggest + that-clause', 'despite + noun', 'look forward to + -ing']
  },
  // Writing
  'creative-writing': {
    samples: [
      'Setting: where + when + atmosphere in one sentence.',
      'Character: name + one specific desire + one specific fear.',
      'Inciting event: what disrupts the normal life on day 1?',
      'Turning point: a choice that makes return impossible.',
      'Ending: one image or line of dialogue, not an explanation.'
    ],
    language: ['suddenly', 'for the first time', 'in spite of', 'as soon as', 'by the time']
  },
  'essay-outline': {
    samples: [
      'Thesis: one sentence stating your position.',
      'Body 1: claim + evidence + analysis.',
      'Body 2: counter-argument + your reply.',
      'Body 3: strongest argument + concrete example.',
      'Conclusion: restate position + broader implication, no new info.'
    ],
    language: ['It can be argued that…', 'Furthermore…', 'However…', 'To illustrate…', 'In conclusion…']
  },
  'email-reply': {
    samples: [
      'Greeting: match the register of the original.',
      'Opening: thank / acknowledge in one line.',
      'Main point: answer the question or make the request clearly.',
      'Supporting: 1-2 sentences with context, no rambling.',
      'Close: clear next step + sign-off.'
    ],
    language: ['Thanks for your message.', 'Just to confirm…', 'Could you please…?', 'Let me know if…', 'Best regards,']
  },
  // Listening
  'audio-video-questions': {
    samples: [
      'Gist: in one sentence, what is the clip about?',
      'Detail 1: write the exact word / number you hear at 00:00-00:30.',
      'Detail 2: who says X and why?',
      'Inference: what does the speaker probably feel? Quote the line that shows it.',
      'Language: pick one chunk you want to start using.'
    ],
    language: ['I (don\'t) think so because…', 'At one point they said…', 'The speaker probably means…', 'A useful chunk is…']
  },
  'warmup-listening': {
    samples: [
      'Predict: read the title - what 5 words will you hear?',
      'Vocabulary: pre-teach 3 essential terms with definitions + a check question.',
      'Visualise: describe the setting in one sentence.',
      'Personalise: what do you already know about the topic?',
      'Question to track: write one question you want the clip to answer.'
    ],
    language: ['I expect to hear…', 'It probably means…', 'I already know that…', 'My question is…']
  },
};

/* ─── TOOL_SEED_FALLBACKS ─── */
const TOOL_SEED_FALLBACKS = {
  reading: {
    samples: [
      'Gist: choose the best one-sentence summary in under a minute.',
      'Detail Q1: scan for a date / number / name and quote the line.',
      'Detail Q2: explain a sentence in your own words.',
      'Inference: what does the author probably believe? Underline the proof.',
      'Reaction: would you share this text? With whom?'
    ],
    language: ['According to the text…', 'In paragraph X…', 'The author implies…', 'I would (not) share this because…']
  },
  vocabulary: {
    samples: ['word - short definition + 1 collocation', 'word - antonym + register note', 'word - example sentence + your own example', 'phrase - when we use it', 'word family - derived forms'],
    language: ['means', 'collocates with', 'is the opposite of', 'is more formal than', 'is used to']
  },
  writing: {
    samples: ['Plan: 3-bullet outline before writing.', 'Draft 1: under 80 words, no editing.', 'Upgrade: replace 2 weak verbs and 1 vague noun.', 'Link: add 2 connectors between paragraphs.', 'Final check: one sentence you are proud of, one you would still change.'],
    language: ['Firstly…', 'Furthermore…', 'However…', 'In contrast…', 'To conclude…']
  },
  speaking: {
    samples: [
      'Warm-up: 1 personal question students answer in 30 seconds.',
      'Useful language: 4 phrases for hedging, agreeing, asking back.',
      'Pair task: A and B have a clear role and a 90-second goal.',
      'Upgrade: each pair adds 1 follow-up question and 1 reaction phrase.',
      'Share: each pair reports the best line they heard.'
    ],
    language: ['I would say…', 'It depends on…', 'Have you ever…?', 'That reminds me of…', 'On the other hand…']
  },
  grammar: {
    samples: [
      'Notice: highlight the target structure in 2 example sentences.',
      'Rule: students complete a one-line rule with you.',
      'Controlled: 5 gap-fill or transformation items.',
      'Error repair: 5 typical mistakes - find and correct.',
      'Free use: 1 personal sentence using the structure correctly.'
    ],
    language: ['form', 'meaning', 'use', 'register', 'common mistake']
  },
  listening: {
    samples: [
      'Before: predict 5 words you expect to hear from the title.',
      'First listen: gist only - one-sentence summary.',
      'Second listen: detail / number / name questions.',
      'Language mine: write 5 useful chunks from the transcript.',
      'After: 2-minute speaking transfer using the chunks.'
    ],
    language: ['I expected to hear…', 'I actually heard…', 'A useful chunk is…', 'I would use this when…']
  },
  utility: {
    samples: [
      'Goal: one sentence describing what students will do.',
      'Input: source text / vocabulary / media link.',
      'Tasks: 3-5 steps from notice → practice → produce.',
      'Output: visible student product (text, list, recording).',
      'Check: success criteria you can mark in 60 seconds.'
    ],
    language: ['By the end of this task, students can…', 'Input:', 'Output:', 'Success criteria:']
  },
};

/* ─── TOOL_FLOW_TEMPLATES ─── */
const TOOL_FLOW_TEMPLATES = {
  reading: [
    '1️⃣ Lead-in\nPredict the topic from the title or first sentence.',
    '2️⃣ Gist\nChoose the best summary in 60 seconds.',
    '3️⃣ Detail\nAnswer 4-6 questions with evidence from the text.',
    '4️⃣ Language\nCollect useful phrases and build new examples.',
    '5️⃣ Transfer\nDiscuss or write a personal response.'
  ],
  vocabulary: [
    '1️⃣ Meaning\nMatch word, definition and example.',
    '2️⃣ Form\nPart of speech, collocation, word family.',
    '3️⃣ Retrieval\nRecall the word from the definition.',
    '4️⃣ Use\nWrite one personal sentence.',
    '5️⃣ Game\nFlashcards, memory match, sorting, odd-one-out.'
  ],
  writing: [
    '1️⃣ Model\nShow an example and highlight structure.',
    '2️⃣ Plan\nBrainstorm content + useful language.',
    '3️⃣ Draft\nWrite a controlled first version.',
    '4️⃣ Upgrade\nFix accuracy, style and linking.',
    '5️⃣ Reflect\nKeep one strong line, rewrite one.'
  ],
  speaking: [
    '1️⃣ Warm-up\nAnswer a safe personal question (30s each).',
    '2️⃣ Language bank\nAdd 4 useful phrases to recycle.',
    '3️⃣ Pair task\nClear role + 90-second goal.',
    '4️⃣ Upgrade\nFollow-up questions and reactions.',
    '5️⃣ Feedback\n1 strong phrase + 1 correction.'
  ],
  grammar: [
    '1️⃣ Notice\nFind the target structure in context.',
    '2️⃣ Rule\nBuild a one-line rule with students.',
    '3️⃣ Controlled\nComplete or transform sentences.',
    '4️⃣ Error repair\nSpot and correct common mistakes.',
    '5️⃣ Free use\nUse the structure in a real task.'
  ],
  listening: [
    '1️⃣ Before\nPredict content + pre-teach key phrases.',
    '2️⃣ First listen\nGist only, no pausing.',
    '3️⃣ Second listen\nDetail / note-taking.',
    '4️⃣ Mine language\nUseful chunks from the transcript.',
    '5️⃣ After\nSpeaking transfer or short written summary.'
  ],
  utility: [
    '1️⃣ Goal\nWhat will students DO?',
    '2️⃣ Input\nSource text / vocabulary / media.',
    '3️⃣ Generate\nProduce teacher-ready instructions.',
    '4️⃣ Answer key\nCriteria + sample answers.',
    '5️⃣ Send\nBoard / lesson builder / game builder.'
  ]
};

// non-module <script>) can resolve them as bare identifiers.

/* ─── GAMES ─── */
const GAMES = [
  { icon:'🔀', title:'Word Scramble',    tag:'Vocabulary', desc:'Unscramble the letters to form the correct word',         src:'games/word-scramble.html',         w:460, h:520 },
  { icon:'🎯', title:'Hangman',           tag:'Spelling',   desc:'Guess the hidden word letter by letter',                  src:'games/hangman.html',               w:460, h:560 },
  { icon:'⚡', title:'Article Rush',      tag:'Grammar',    desc:'Pick a / an / the / ∅ as fast as you can',                src:'games/article-rush.html',          w:460, h:520 },
  { icon:'🧠', title:'Memory Match',      tag:'Vocabulary', desc:'Flip cards to match words with their definitions',       src:'games/memory-match.html',          w:520, h:600 },
  { icon:'🧩', title:'Sentence Builder',  tag:'Grammar',    desc:'Arrange shuffled words into correct sentences',           src:'games/sentence-builder.html',      w:520, h:560 },
  { icon:'🌧️', title:'Typing Rain',       tag:'Speed',      desc:'Type falling words before they hit the ground',           src:'games/typing-rain.html',           w:560, h:560 },
  { icon:'✅', title:'True or False',     tag:'Grammar',    desc:'Rapid-fire grammar and vocabulary statements',            src:'games/true-false.html',            w:460, h:520 },
  { icon:'🔗', title:'Phrasal Verbs',     tag:'Vocabulary', desc:'Complete phrasal verbs with the right particle',          src:'games/phrasal-verbs.html',         w:460, h:520 },
  { icon:'🪤', title:'False Friends',     tag:'Vocabulary', desc:'Identify tricky false cognates from RU/UA/PL',            src:'games/false-friends.html',         w:460, h:580 },
  { icon:'📍', title:'Prepositions',      tag:'Grammar',    desc:'Fill in at / in / on / by in context',                    src:'games/prepositions.html',          w:460, h:520 },
  { icon:'🔧', title:'Grammar Fix',       tag:'Grammar',    desc:'Spot and correct the error in each sentence',             src:'games/grammar-fix.html',           w:500, h:560 },
  { icon:'⏱️', title:'Tense Picker',      tag:'Grammar',    desc:'Choose the correct verb tense form',                      src:'games/tense-picker.html',          w:480, h:580 },
  { icon:'🔄', title:'Synonym Snap',      tag:'Vocabulary', desc:'Match synonym pairs before time runs out',                src:'games/synonym-snap.html',          w:520, h:560 },
  { icon:'🐝', title:'Spelling Bee',      tag:'Spelling',   desc:'Type the word from its definition clue',                  src:'games/spelling-bee.html',          w:460, h:560 },
  { icon:'🗂️', title:'Word Categories',   tag:'Vocabulary', desc:'Sort words into the correct topic groups',                src:'games/word-categories.html',       w:560, h:640 },
  { icon:'🃏', title:'Definition Match',  tag:'Vocabulary', desc:'Match words to their definitions',                        src:'games/word-definition-match.html', w:520, h:580 },
  { icon:'🗂️', title:'Flashcards',        tag:'Vocabulary', desc:'Flip cards to test yourself - Got it / Again tracking',    src:'games/flashcards.html',            w:460, h:560 },
  { icon:'✍️', title:'Fill in the Blank', tag:'Grammar',    desc:'Type the missing word to complete each sentence',          src:'games/fill-blank.html',            w:460, h:560 },
  { icon:'🔍', title:'Word Search',        tag:'Spelling',   desc:'Find hidden words in a 12×12 letter grid',                src:'games/word-search.html',           w:520, h:620 },
  { icon:'⚡', title:'Speed Quiz',         tag:'Speed',      desc:'4-option MCQ with 6-second countdown - how fast are you?', src:'games/speed-quiz.html',            w:480, h:560 },
  { icon:'🎡', title:'Spin the Wheel',     tag:'Speaking',   desc:'Editable word wheel - great for hot-seat vocabulary drills', src:'games/spin-wheel.html',          w:460, h:560 },
  { icon:'🃏', title:'Find the Match',     tag:'Vocabulary', desc:'Tap matching word + translation tiles before time runs out', src:'games/find-match.html',          w:560, h:600 },
  { icon:'❓', title:'Vocabulary Quiz',    tag:'Vocabulary', desc:'Multiple-choice quiz built from your word pairs',         src:'games/vocab-quiz.html',            w:480, h:560 },
  { icon:'🧩', title:'Crossword',          tag:'Vocabulary', desc:'Auto-generated crossword - your words, your clues',        src:'games/crossword.html',             w:600, h:620 },
  { icon:'🗃️', title:'Group Sort',         tag:'Vocabulary', desc:'Drag words into the correct category bins',                src:'games/group-sort.html',            w:600, h:560 },
  { icon:'👾', title:'Maze Chase',         tag:'Vocabulary', desc:'Run the maze and grab only the target-category words',    src:'games/maze-chase.html',            w:520, h:600 },
  { icon:'🔨', title:'Whack-a-Mole',       tag:'Vocabulary', desc:'Whack only the words from the target category',           src:'games/whack-a-mole.html',          w:560, h:560 },
  { icon:'🖼️', title:'Photo Match',        tag:'Vocabulary', desc:'Match each word to its photo - images fetched automatically', src:'games/word-image-match.html',      w:560, h:620 },

  /* Три игры были доступны только из хаба игр, хотя доска умеет ставить
     любую игру по src. Размеры сняты замером натуральной раскладки, а не
     угаданы. Ещё два файла в папке games намеренно НЕ добавлены: create
     («Create a Word Set») и twee-module-studio - это авторские студии для
     учителя, а не активность для ученика; на доске они были бы встроенным
     редактором. Они остаются в хабе игр. */
  { icon:'⚖️', title:'Four Opinions',     tag:'Speaking',   desc:'Four contrasting opinions on a topic to react to',        src:'games/four-opinions-uk.html',      w:600, h:620 },
  { icon:'🖼', title:'Image Quiz',        tag:'Vocabulary', desc:'Pick the word that matches the picture',                  src:'games/image-quiz.html',            w:460, h:520 },
  { icon:'🧭', title:'LinguaQuiz',        tag:'Grammar',    desc:'Cloze quiz over a text with instant checking',            src:'games/linguaquiz-ai-uk.html',      w:600, h:640 },
];

/* ─── STICKER_CATEGORIES ─── */
const STICKER_CATEGORIES = {
  'Smileys':['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','🤗','🤩','🤔','🙃','😴','😇','🥳','🥺','😢','😭','😡','🤯','😱','🤓','🤠','😈','👻','💀','☠️','🤡','👽','👾','🤖','💩'],
  'Hands':['👍','👎','👏','🙌','👐','🤝','🤲','🙏','✊','👊','🤘','🤙','👌','✌️','🤞','🤟','🖖','👋','🤚','✋','🖐️','👆','👇','👈','👉','☝️'],
  'Hearts':['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💖','💗','💓','💞','💕','💘','💝','💟','♥️','💔','❣️'],
  'School':['✏️','📝','📚','📖','📓','📒','📕','📗','📘','📙','🎓','🏫','📐','📏','🖊️','🖋️','✒️','🖌️','🖍️','📌','📍','📎','🖇️','🗂️','📁','📂','🗒️','🗓️','📅','📆','⏰','⏱️','⌛','💡','🔍','🔎','🧮','🎒','🍎'],
  'Stars':['⭐','🌟','✨','💫','🌈','🔥','💥','💯','✅','❌','⚠️','❗','❓','💬','💭','💤','🎉','🎊','🎁','🎈','🎯','🏆','🥇','🥈','🥉','🏅','👑','🌹','🌸','🌼','🌺','🌻','🌷','🍀'],
  'Animals':['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐢','🐍','🦖','🐙','🦑','🦀','🐠','🐟','🐬','🐳','🦓'],
  'Food':['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍆','🥔','🥕','🌽','🌶️','🥒','🥬','🥦','🍞','🥐','🥖','🧀','🥚','🍳','🥞','🧇','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥗','🍝','🍜','🍣','🍱','🥟','🍤','🍦','🍩','🍪','🎂','🍰','🍫','🍬','🍭','🍯','☕','🍵','🥤','🍺','🍷','🥂'],
};

/* ─── STICKER_KEYWORDS - maps English words → emoji glyphs ─── */
const STICKER_KEYWORDS = {
  heart:   ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💖','💗','💓','💞','💕','💘','💝','💟','♥️','💔','❣️'],
  love:    ['❤️','💕','💖','🥰','😍','💘'],
  smile:   ['😀','😁','😊','😄','😃','😆'],
  happy:   ['😀','😁','😊','😄','🥳','🎉'],
  sad:     ['😢','😭','😔'],
  cry:     ['😢','😭'],
  angry:   ['😡','🤯'],
  cool:    ['😎','🤩'],
  wow:     ['😱','🤯','😲'],
  laugh:   ['😂','🤣'],
  sleepy:  ['😴','💤'],
  think:   ['🤔','💭','💡'],
  idea:    ['💡'],
  star:    ['⭐','🌟','✨','💫'],
  fire:    ['🔥'],
  check:   ['✅'],
  yes:     ['✅','👍'],
  no:      ['❌','👎'],
  ok:      ['👌','✅','💯'],
  good:    ['👍','✅','⭐','💯'],
  bad:     ['👎','❌'],
  great:   ['💯','🌟','⭐','🏆','👑'],
  trophy:  ['🏆','🥇','🥈','🥉'],
  crown:   ['👑'],
  party:   ['🎉','🎊','🎈','🥳'],
  book:    ['📚','📖','📓','📒','📕','📗','📘','📙'],
  school:  ['🏫','🎓','📐','📏','✏️','📝','📚'],
  pencil:  ['✏️','🖊️','🖋️','📝'],
  write:   ['✏️','📝','🖊️','🖋️','✒️'],
  read:    ['📚','📖'],
  time:    ['⏰','⏱️','⌛'],
  hand:    ['👋','✋','🖐️','👏','🙌','👐'],
  wave:    ['👋'],
  clap:    ['👏','🙌'],
  thumbs:  ['👍','👎'],
  strong:  ['💪'],
  flower:  ['🌹','🌸','🌼','🌺','🌻','🌷'],
  rainbow: ['🌈'],
  sun:     ['☀️','🌟'],
  animal:  ['🐶','🐱','🐭','🐰','🦊','🐻','🐼','🦁','🐮','🐷','🐸'],
  cat:     ['🐱'],
  dog:     ['🐶'],
  bear:    ['🐻','🐼'],
  lion:    ['🦁'],
  bunny:   ['🐰'],
  rabbit:  ['🐰'],
  fox:     ['🦊'],
  bird:    ['🐦','🐤','🦆','🦉'],
  apple:   ['🍎','🍏'],
  pizza:   ['🍕'],
  food:    ['🍎','🍕','🍔','🍟','🌮','🍜','🍝'],
  burger:  ['🍔'],
  robot:   ['🤖'],
  alien:   ['👽'],
  ghost:   ['👻'],
  skull:   ['💀','☠️'],
  devil:   ['😈'],
  clown:   ['🤡'],
  music:   ['🎵','🎶'],
  question:['❓','🤔','💭'],
  brain:   ['🧠'],
};

// Expose each on `window`.
/* ── Vocabulary Workout: активности, которые доска умеет сама ─────────────
   Все 11 активностей студии, как в хабе.

   `needsLang:true` - активности нужен язык перевода: офлайновый генератор без
   него выдаёт «Journey → a long trip», то есть слово к английскому
   определению, а не перевод. Поэтому она помечена ai:true и идёт через
   сервер, а язык панель отдаёт в input.extra - тот же канал «teacher note»,
   который читает промт на бекенде.

   Остальные проверены прогоном: у каждой на доске есть настоящий генератор
   (scripts/board-gen.js) и осмысленный результат.

   Поле `tool` - это id инструмента В РЕЕСТРЕ ДОСКИ: студия просто прогоняет
   тот же конвейер, которым панель строит одиночный инструмент, по одному
   разу на каждую отмеченную активность. `ai:true` означает, что офлайнового
   генератора у неё нет и нужен сервер.

   `game` - в какую игру активность ложится естественнее всего. Доска умеет
   класть результат инструмента играбельной карточкой, и для этих пяти игра
   и есть нормальная форма: пары слово-значение это Memory Match, предложения
   с пропуском - Fill the Blank, категории - Word Categories. У остальных
   игры нет, они ложатся стилизованным листом. */
const BOARD_WORKOUT_ACTIVITIES = [
  {key:'match',      tool:'word-definition-match', title:'Match word to meaning',      hint:'Pairs for matching, cards or a memory game.', game:'memory-match'},
  {key:'flashcards', tool:'flashcards',            title:'Flashcards',                 hint:'Word on one side, meaning and an example on the other.', game:'flashcards'},
  {key:'sentences',  tool:'sentences-vocab',       title:'Example sentences',          hint:'One sentence per word, gap ready for practice.', game:'fill-blank'},
  {key:'link',       tool:'link-words',            title:'Link words into sentences',  hint:'Students connect two or three items in one sentence.'},
  {key:'halves',     tool:'matching-halves',       title:'Matching halves',            hint:'Phrases split in two for students to rejoin; single words pair with their meaning.', game:'memory-match'},
  {key:'situations', tool:'comm-situations',       title:'Speaking situations',        hint:'Paired role-play scenarios that force the words into a real conversation.'},
  {key:'odd',        tool:'odd-one-out',           title:'Odd one out',                hint:'Groups where one word does not belong.',        ai:true, game:'speed-quiz'},
  {key:'sorting',    tool:'word-sorting',          title:'Word sorting',               hint:'Categories for drag-and-drop sorting.',         ai:true, game:'word-categories'},
  /* Только серверной: офлайновый генератор без языка выдаёт слово к
     английскому определению, а не перевод. Язык едет в поле «teacher note»
     (input.extra) - тот же канал, который читает промт на бекенде. */
  {key:'translate',  tool:'word-translation-match',title:'Word-translation pairs',     hint:'Bilingual pairs for matching. Pick the language below.', ai:true, game:'memory-match', needsLang:true},
  {key:'writing',    tool:'creative-writing',      title:'Creative writing task',      hint:'A short writing prompt built around the words.', ai:true},
  {key:'discussion', tool:'discussion',            title:'Discussion questions',       hint:'Speaking prompts that force the words out.',     ai:true},
];
window.BOARD_WORKOUT_ACTIVITIES = BOARD_WORKOUT_ACTIVITIES;

window.BOARD_TEACHER_TOOLS = BOARD_TEACHER_TOOLS;
window.STICKER_KEYWORDS     = STICKER_KEYWORDS;
window.TOOL_SEED_CONTENT   = TOOL_SEED_CONTENT;
window.TOOL_SEED_FALLBACKS = TOOL_SEED_FALLBACKS;
window.TOOL_FLOW_TEMPLATES = TOOL_FLOW_TEMPLATES;
window.GAMES               = GAMES;
window.STICKER_CATEGORIES  = STICKER_CATEGORIES;
})();
