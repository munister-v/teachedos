/* ════════════════════════════════════════════════════════════════
   TeachEd · board.html — teacher tools, seed content and lesson
   pack data. Extracted to its own file so the main board.html
   stays editable. Loaded synchronously from board.html before the
   inline script, so the constants are accessible as bare names.
   Total ~60 KB of pure data — no behaviour, safe to cache long.
═══════════════════════════════════════════════════════════════ */
(function() {

/* ─── BOARD_TEACHER_TOOLS ─── */
const BOARD_TEACHER_TOOLS = [
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
  {id:'listening-dictation',cat:'listening',title:'Dictation / Shadowing Task',desc:'Short dictation, chunking and pronunciation practice flow.',kind:'Pronunciation'}
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
      'Student A — Goal: convince B to choose your plan. Constraint: must use one polite request.',
      'Student B — Goal: protect your time. Constraint: must give one reason and one compromise.',
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
      '1. The text says X happens every day. (T / F — paragraph 1)',
      '2. The author personally agrees with Y. (T / F — last paragraph)',
      '3. Z is the main reason mentioned. (T / F — paragraph 3)',
      '4. The text gives a clear solution. (T / F — paragraph 4)',
      '5. The example is from a real study. (T / F — paragraph 2)'
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
    samples: ['word — short student-friendly definition + 1 example', 'collocation — common partner words', 'phrasal — verb + particle meaning', 'idiom — figurative meaning + register', 'word family — noun / verb / adj. / adv.'],
    language: ['means', 'can be replaced by', 'collocates with', 'is used to', 'is the opposite of']
  },
  'essential-vocab': {
    samples: [
      'core noun — definition + example sentence',
      'core verb — definition + collocation + example',
      'core adjective — definition + opposite',
      'useful phrase — definition + when to use it',
      'connector — purpose + example'
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
      'Detail 1: write the exact word / number you hear at 00:00–00:30.',
      'Detail 2: who says X and why?',
      'Inference: what does the speaker probably feel? Quote the line that shows it.',
      'Language: pick one chunk you want to start using.'
    ],
    language: ['I (don\'t) think so because…', 'At one point they said…', 'The speaker probably means…', 'A useful chunk is…']
  },
  'warmup-listening': {
    samples: [
      'Predict: read the title — what 5 words will you hear?',
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
    samples: ['word — short definition + 1 collocation', 'word — antonym + register note', 'word — example sentence + your own example', 'phrase — when we use it', 'word family — derived forms'],
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
      'Error repair: 5 typical mistakes — find and correct.',
      'Free use: 1 personal sentence using the structure correctly.'
    ],
    language: ['form', 'meaning', 'use', 'register', 'common mistake']
  },
  listening: {
    samples: [
      'Before: predict 5 words you expect to hear from the title.',
      'First listen: gist only — one-sentence summary.',
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

/* ─── LESSON_PACKS ─── */
const LESSON_PACKS = [
  {
    id: 'lp-travel-b1',
    title: 'Travel & Holidays',
    level: 'B1', duration: '45 min', skill: 'Speaking + Vocab',
    icon: '✈️', color: '#0EA5A4', bg: 'rgba(14,165,164,.12)',
    summary: 'Lead-in → travel vocab → short reading → pair planning → reflection.',
    stages: [
      { title:'🌟 Warm-up · 5 min', color:'#FFE566', text:
`Quick speak (60s each, swap partner):

• The last trip you took — where, who with, what surprised you?
• A place you have always wanted to visit and why.
• Beach holiday or city break? Defend your choice.
• A trip that went wrong — what happened?
• Cheap-and-rough or comfortable-and-quiet?

Teacher: monitor for *because*, *I would*, *I have been to*.` },
      { title:'📚 Input — Vocab · 12 min', color:'#AFF4C6', text:
`Match the 10 travel verbs to definitions:

• check in / check out
• board (a plane)
• depart / arrive
• catch a connection
• upgrade
• miss the flight
• be overbooked
• in transit
• reclaim luggage
• go through customs

After matching → write 1 personal sentence per pair (5 sentences total).

🗣 Useful language:
"My flight was delayed/cancelled."
"I had to run to catch the connection."
"We were upgraded to business."` },
      { title:'💪 Practice — Reading · 10 min', color:'#CFE2FF', text:
`Read the 80-word post and answer 4 questions:

"Last summer I missed my connection in Istanbul. I'd booked a tight 50-minute transfer, the first flight was delayed by 40 minutes, and by the time I reclaimed my luggage and ran to the gate, the doors were closed. The airline rebooked me, but I had to sleep in the terminal. Now I always leave at least 2 hours between flights — and travel insurance is non-negotiable."

1. Why did the author miss the flight? (gist)
2. Find 3 travel verbs from your vocab in the text. (detail)
3. What's the author's main lesson? (inference)
4. Have you ever had a similar story? (transfer)` },
      { title:'🎤 Production — Pair task · 12 min', color:'#FFB8D9', text:
`Plan a 3-day trip for your partner.

Step 1 — interview (2 min):
"What do you usually look for in a trip?"
"Comfort or adventure?"
"Cities or nature?"
"How much can you spend?"

Step 2 — present your plan (2 min):
"On day 1 you will… Day 2 we'll… The reason I chose this is…"

Step 3 — react (1 min):
"That sounds great because…"
"I'd swap day 2 for…"

Step 4 — swap roles.` },
      { title:'🏠 Homework + Wrap · 6 min', color:'#CDB4F6', text:
`Wrap (in class, 3 min):
Each student says 1 new word they will use this week and where.

Homework:
Write a 100-word post about a real or imagined trip using:
- at least 5 new vocab items
- one present perfect sentence ("I have been to…")
- one past simple story sentence
- one piece of advice

Send to teacher by Friday. Mark with: ✓ ✓ ✗.` }
    ]
  },

  {
    id: 'lp-job-interview-b2',
    title: 'Job Interview',
    level: 'B2', duration: '50 min', skill: 'Speaking + Writing',
    icon: '💼', color: '#4262FF', bg: 'rgba(66,98,255,.12)',
    summary: 'CV vocabulary → STAR technique → mock interview → feedback round.',
    stages: [
      { title:'🌟 Warm-up · 5 min', color:'#FFE566', text:
`Discuss in pairs:

• When was your last "interview" (job, university, even an apartment viewing)?
• What's the WORST interview question you've heard?
• Skills that look great on a CV vs skills that actually matter — same or different?
• If you were the hiring manager, what would you ask first?

Teacher elicit: tell me about a time when…, my biggest strength is…, I'd say my weakness is… but…` },
      { title:'📚 Input — Vocab · 10 min', color:'#AFF4C6', text:
`Pre-teach these CV/interview chunks:

Strengths:
- a strong communicator / a team player
- detail-oriented / results-driven
- comfortable with ambiguity

Weaknesses (safe to admit):
- I struggle to delegate
- I can be too perfectionist
- I'm working on giving clearer feedback

Situational verbs:
- handle / manage / oversee
- coordinate / lead / mentor
- deliver / launch / improve

Check: students cover the list and read each phrase aloud from memory.` },
      { title:'💪 Practice — STAR · 10 min', color:'#CFE2FF', text:
`STAR technique for behavioural questions:

S — Situation (1 sentence: where + when)
T — Task (1 sentence: your responsibility)
A — Action (3 sentences: what YOU did, not the team)
R — Result (1 sentence + 1 number if possible)

Practice prompt:
"Tell me about a time you handled a difficult colleague."

Students write a 5-sentence STAR answer (4 min), then swap and tighten each other's answer (3 min).` },
      { title:'🎤 Production — Mock interview · 15 min', color:'#FFB8D9', text:
`Pair A = interviewer · Pair B = candidate.

Interviewer asks 4 from this set:
1. Walk me through your CV in 90 seconds.
2. Why this role specifically?
3. Tell me about a time you failed.
4. Where do you see yourself in 3 years?
5. What questions do you have for us?

Candidate gives STAR answers. Interviewer writes:
✓ one strong line
✗ one filler word ("kind of", "like", "you know")
⚙️ one structural suggestion

Swap roles after 7 minutes.` },
      { title:'🏠 Homework + Wrap · 5 min', color:'#CDB4F6', text:
`Wrap (in class):
Each student shares the strongest line their partner said. Teacher writes them on the board.

Homework:
- Record yourself answering "Tell me about yourself" in 90 seconds (use voice memo).
- Listen back. Count filler words.
- Write a 60-word self-pitch, no fillers, send to teacher.

Optional: send a real job ad you want to apply for + we'll do a tailored mock next class.` }
    ]
  },

  {
    id: 'lp-daily-routine-a2',
    title: 'Daily Routines & Habits',
    level: 'A2 → B1', duration: '40 min', skill: 'Vocab + Present Simple',
    icon: '🌅', color: '#FF7A1A', bg: 'rgba(255,122,26,.14)',
    summary: 'Quick survey → time vocabulary → present simple drill → personal video script.',
    stages: [
      { title:'🌟 Warm-up · 5 min', color:'#FFE566', text:
`Class survey — "How many of us…"

Raise your hand if you:
• …get up before 7 a.m.
• …drink coffee before breakfast
• …go to bed after midnight
• …check your phone in bed
• …exercise more than once a week
• …cook your own dinner

Teacher counts. Pairs predict which habit is the most/least popular before counting.` },
      { title:'📚 Input — Time vocab · 10 min', color:'#AFF4C6', text:
`Time markers:

Frequency: always / usually / often / sometimes / rarely / never
Position: at + clock time, in + part of day, on + day, every + period

Daily verbs (full sentences):
- I get up at 7.
- I have breakfast around 7:30.
- I leave for work / school at 8.
- I have lunch in the afternoon.
- I do exercise twice a week.
- I go to bed at midnight.

Drill: students change the times to be true for them.` },
      { title:'💪 Practice — Present Simple · 10 min', color:'#CFE2FF', text:
`Gap-fill (write -s if needed):

1. She _____ (get) up at 6 every morning.
2. I usually _____ (drink) tea, not coffee.
3. My brother never _____ (cook) at home.
4. We _____ (have) dinner together on Sundays.
5. They _____ (not / like) early starts.
6. _____ you _____ (work) from home? — Yes, I _____.
7. He _____ (go) to the gym twice a week.

Answers: gets · drink · cooks · have · don't like · Do, work, do · goes` },
      { title:'🎤 Production — Day script · 10 min', color:'#FFB8D9', text:
`Write your "Day in 90 seconds" script.

Structure (~80 words):
- 1 morning routine
- 1 thing that happens at work / school
- 1 lunch / afternoon habit
- 1 evening routine
- 1 thing you do "twice a week" or "on Sundays"

Then in pairs:
- Read your script aloud.
- Partner counts how many frequency adverbs you used.
- Partner asks 2 follow-up questions.

Teacher: monitor *-s* on 3rd person.` },
      { title:'🏠 Homework + Wrap · 5 min', color:'#CDB4F6', text:
`Wrap:
Pairs nominate the most interesting habit they heard. Share with the class.

Homework:
Record a 60-second audio describing your typical Wednesday.
Constraints:
- Use 4 frequency adverbs (always, usually, sometimes, rarely / never)
- Use 1 negative sentence
- Use 1 question to the listener at the end

Send the audio to your teacher.` }
    ]
  },

  {
    id: 'lp-environment-b2',
    title: 'Climate & Environment',
    level: 'B2', duration: '50 min', skill: 'Reading + Discussion',
    icon: '🌍', color: '#22c55e', bg: 'rgba(34,197,94,.12)',
    summary: 'Statistics shock → reading → debate cards → action plan.',
    stages: [
      { title:'🌟 Warm-up · 5 min', color:'#FFE566', text:
`Predict before reading:

What % of plastic ever produced has been recycled?
What % of food in your country is wasted at home?
Which uses more water — 1 kg of beef or 1 pair of jeans?

After predictions, reveal:
• Recycled plastic: ~9%
• Household food waste: 30-40% (most countries)
• 1 kg of beef ≈ 15,000 L water; jeans ≈ 7,500 L

Question: which number surprised you most and why?` },
      { title:'📚 Input — Reading · 12 min', color:'#AFF4C6', text:
`Read 150 words and find evidence for 3 claims.

"Climate scientists agree that the next decade is decisive. Reducing meat consumption by half could save more emissions than switching every car to electric. Yet households focus on plastic straws and ignore the kitchen — where the biggest individual impact lives. The honest answer isn't 'recycle more'; it's 'consume differently'. The data is clear, the political will is not, and the responsibility — uncomfortable as it sounds — sits with consumers who keep voting with their wallet."

Claims:
1. Diet > cars for emissions.
2. People focus on the wrong solutions.
3. Consumers, not policy, drive the problem.

Find the line. Mark it. Compare with a partner.` },
      { title:'💪 Practice — Vocab + collocations · 10 min', color:'#CFE2FF', text:
`Useful chunks from the text:

• the next decade is decisive
• reduce X by half
• drive the problem
• vote with one's wallet
• political will
• meaningful change
• carbon footprint
• throw-away culture

Sentence transformations:
1. "We can reduce emissions" → using *cut*: ____________
2. "The decade is important" → using *decisive*: ____________
3. "Consumers cause it" → using *drive*: ____________

Then build 1 personal sentence with 2 chunks.` },
      { title:'🎤 Production — Debate · 15 min', color:'#FFB8D9', text:
`Debate cards (groups of 4 — 2 vs 2).

CLAIM A: "Climate change is mainly the responsibility of individuals."
CLAIM B: "Climate change is mainly the responsibility of governments and corporations."

Each side gets:
- 3 minutes to prepare 3 arguments + 1 example
- 90 seconds opening statement
- 60 seconds rebuttal each
- 60 seconds closing

Useful rebuttal language:
"That may be true, however…"
"The evidence actually shows…"
"If we follow that logic…"

Listeners vote on the most persuasive side and explain why in 1 sentence.` },
      { title:'🏠 Homework + Wrap · 8 min', color:'#CDB4F6', text:
`Wrap:
Each student writes one realistic action they will take this week.
Share in pairs.

Homework (120 words):
"One change I made and what happened."
Use: at first, gradually, however, in the end.
Include 1 sentence with 'used to'.

Optional: bring a photo of one wasteful habit you'd like to stop.` }
    ]
  },

  {
    id: 'lp-tech-social-b1',
    title: 'Technology & Social Media',
    level: 'B1 → B2', duration: '45 min', skill: 'Discussion',
    icon: '📱', color: '#7C3AED', bg: 'rgba(124,58,237,.12)',
    summary: 'Screen-time stats → useful chunks → opinion gradient → debate snapshot.',
    stages: [
      { title:'🌟 Warm-up · 6 min', color:'#FFE566', text:
`Check + share (open phone Settings → Screen Time):

• Average daily screen time?
• Most-used app?
• How many times you picked up the phone yesterday?

In pairs: predict the class average for each.

Discuss:
- Is the number higher or lower than you expected?
- Which app would you delete tomorrow if you HAD to?
- Which app would you keep if you could only have ONE?` },
      { title:'📚 Input — Language · 8 min', color:'#AFF4C6', text:
`Hedging + opinion bank:

Soft opinions:
- I would say…
- I'm inclined to think…
- It seems to me that…
- From what I've seen…

Stronger:
- I'm convinced that…
- There's no doubt that…
- The reality is that…

Concessions:
- I see your point, but…
- That's fair, however…
- I'd agree if it weren't for…

Drill: students rephrase 3 strong opinions with hedges.` },
      { title:'💪 Practice — Opinion gradient · 8 min', color:'#CFE2FF', text:
`Place yourself on the line:

Strongly agree ←────────────────→ Strongly disagree

Statements (one at a time):
1. Phones should be banned in school.
2. TikTok is making people stupid.
3. Social media has made us lonelier.
4. Influencers are a legitimate profession.
5. We need a "right to disconnect" law for work hours.

After each statement: ONE student from the strongest agreement and ONE from the strongest disagreement explain in 30 seconds.` },
      { title:'🎤 Production — Debate snapshot · 15 min', color:'#FFB8D9', text:
`Mini-debate (groups of 3): one moderator, two debaters.

Motion: "Children under 14 should not have social media accounts."

Roles:
- Debater A (3 min prep) — 90s opening
- Debater B (3 min prep) — 90s opening
- Moderator: ask ONE sharp follow-up to each side
- 60-second closing each
- Moderator scores: clarity, evidence, language

Targets to use:
✓ at least 1 hedging phrase
✓ at least 1 concession
✓ at least 1 evidence "for example" / "research shows"
✓ no filler "like / kind of / sort of" repeated` },
      { title:'🏠 Homework + Wrap · 8 min', color:'#CDB4F6', text:
`Wrap:
Moderators announce the winning debater in their group + reason.

Homework (130 words):
"My honest relationship with my phone."
Use: I tend to / I find myself / I keep -ing / I've started to / I should…

Include:
- one specific number (minutes, times, hours)
- one habit you want to keep
- one habit you want to change

Send by next class.` }
    ]
  },

  {
    id: 'lp-food-restaurant-b1',
    title: 'Food & Restaurants',
    level: 'B1', duration: '45 min', skill: 'Vocab + Speaking',
    icon: '🍔', color: '#EC2D8C', bg: 'rgba(236,45,140,.12)',
    summary: 'Food preferences → menu vocabulary → restaurant role-play → review writing.',
    stages: [
      { title:'🌟 Warm-up · 5 min', color:'#FFE566', text:
`Food this and that:

In pairs answer in turn (45s each):
• Sweet or savoury for breakfast?
• Eat alone or with people?
• Restaurant you'd never go back to and why?
• Best meal you've had in the last month?
• Food you used to hate as a kid but love now?

Teacher elicit: I can't stand…, I'm not a fan of…, I'm crazy about…` },
      { title:'📚 Input — Menu vocab · 10 min', color:'#AFF4C6', text:
`Cooking methods (verb + ed):
- grilled, roasted, baked, fried, boiled, steamed, stewed, smoked, marinated, glazed

Textures + flavours:
- crispy, creamy, fluffy, tender, chewy, juicy
- spicy, savoury, tangy, sweet, salty, bitter, sour

Dietary notes:
- vegan / vegetarian / gluten-free / dairy-free / nut allergy

Mini-task: write a 1-line description of a dish you love using 2 cooking methods + 2 flavour words. Example: "Slow-roasted lamb with a tangy yogurt sauce, crispy onions on top."` },
      { title:'💪 Practice — Restaurant phrases · 10 min', color:'#CFE2FF', text:
`Match phrases to moments:

ARRIVING:
- "A table for two, please."
- "We have a reservation under [name]."

ORDERING:
- "Could I have the…?"
- "What would you recommend?"
- "Is the X spicy / vegetarian?"
- "Could we have it without…?"

DURING:
- "Excuse me, this isn't what I ordered."
- "Could we have some more bread?"

PAYING:
- "Could we have the bill, please?"
- "Is service included?"
- "Could we split the bill?"

Pairs: say each phrase, then partner gives the next likely line.` },
      { title:'🎤 Production — Role-play · 12 min', color:'#FFB8D9', text:
`3-person scene (rotate every 4 min):

Server · Customer A · Customer B

Scenario:
- B has a nut allergy.
- A is in a rush and wants something fast.
- The kitchen is out of one dish.

Each round:
1. Order something different.
2. Use 2 menu vocab words from the input.
3. Server must recommend something AND warn about allergens.
4. Customers must ask 1 question and react.

Teacher: feed cards with surprise twists ("Server: cash only", "Customer A: spills the drink").` },
      { title:'🏠 Homework + Wrap · 8 min', color:'#CDB4F6', text:
`Wrap (3 min):
Each table votes the most natural server / most demanding customer.

Homework — Restaurant review (140 words):
Title: "A meal I won't forget — for the right or wrong reason."
Include:
- the dish (with cooking method + flavour)
- the service (1 specific moment)
- the price/value
- a final verdict and a star rating /5

Post in class chat for peer reading.` }
    ]
  },

  {
    id: 'lp-future-plans-b1',
    title: 'Future Plans & Goals',
    level: 'B1', duration: '45 min', skill: 'Speaking + Grammar (will / going to)',
    icon: '🎯', color: '#0891B2', bg: 'rgba(8,145,178,.12)',
    summary: 'Picture predictions → will vs going to → bucket-list pair task → manifesto.',
    stages: [
      { title:'🌟 Warm-up · 5 min', color:'#FFE566', text:
`Picture predictions (teacher shows 3 images):

For each image, students predict in pairs:
"I think it's going to…"
"It probably will…"
"It might…"

After predictions, reveal the actual outcome.

Question to reflect:
- Which prediction was the most confident?
- Did anyone predict the right thing for the right reason?` },
      { title:'📚 Input — will vs going to · 10 min', color:'#AFF4C6', text:
`Rules in one line each:

going to → plan / intention decided BEFORE now
"I'm going to learn Spanish this year."

will → spontaneous decision, prediction, promise
"OK, I'll help you with that." / "It'll probably rain."

might / may → less sure
"I might move next year."

Likely to / unlikely to → for predictions
"They're likely to win." / "He's unlikely to call."

Pairs: turn each example into a personal sentence about next month.` },
      { title:'💪 Practice — Pick the form · 10 min', color:'#CFE2FF', text:
`Choose will / going to / might / be likely to:

1. The phone's ringing — I _____ get it.
2. I _____ change jobs in March (decided last week).
3. The sky's dark, it _____ rain.
4. I'm not sure — I _____ come, depends on time.
5. By 2030 most people _____ work from home (prediction).
6. — "I'm hungry." — "I _____ make you a sandwich."
7. I've signed up for the course — I _____ study every weekend.

Answers: 'll · 'm going to · might/'s going to · might · are likely to · 'll · 'm going to` },
      { title:'🎤 Production — Bucket list · 12 min', color:'#FFB8D9', text:
`Pair task — bucket list interview (5 min each side):

Ask your partner:
"Three things you're going to do this year?"
"One thing you might try if you had courage?"
"What will you definitely never do?"
"Where will you probably be in 5 years?"

Note partner's answers in 1-line bullets.

Then introduce them to the class:
"This is Anna. She's going to… She might… She definitely won't…"

Teacher: count correct uses of going to / will / might per student.` },
      { title:'🏠 Homework + Wrap · 8 min', color:'#CDB4F6', text:
`Wrap (3 min):
Each student writes ONE goal for the next month and gives it to the teacher (sealed).

Homework — "My one-year manifesto" (130 words):
3 goals using going to (decided)
2 predictions using will (probable)
2 maybes using might

End with one promise sentence: "By next December, I'll have…"

Send as a voice note OR text — student's choice.` }
    ]
  },

  {
    id: 'lp-health-fitness-b1',
    title: 'Health & Fitness',
    level: 'B1', duration: '45 min', skill: 'Vocab + Speaking',
    icon: '💪', color: '#10b981', bg: 'rgba(16,185,129,.12)',
    summary: 'Self-check survey → health vocab → habit-change interview → action contract.',
    stages: [
      { title:'🌟 Warm-up · 5 min', color:'#FFE566', text:
`Quick self-check (raise 1 finger per yes):

✓ Slept ≥ 7 hours last night?
✓ Drank water this morning?
✓ Moved for 30 min yesterday?
✓ Ate vegetables yesterday?
✓ Had screen-free time before bed?
✓ Talked to a friend yesterday?

Discuss in pairs:
- Easiest habit on this list for you?
- Which finger went down first?
- Which habit gives the biggest payback for least effort?` },
      { title:'📚 Input — Health vocab · 10 min', color:'#AFF4C6', text:
`Verbs + nouns to mix and match:

Verbs:
- build (a habit), break (a habit), kick (a habit)
- stick to (a routine), cut down on, cut out
- work out, warm up, cool down
- skip (a meal / workout)

Nouns + adjectives:
- a balanced diet
- a sedentary lifestyle
- stress levels / energy levels
- a sound sleep
- a guilty pleasure
- moderation > deprivation

Mini-drill: make a sentence with each pair (verb + suitable noun).
Example: "I'm trying to break the habit of skipping breakfast."` },
      { title:'💪 Practice — Habit interview · 10 min', color:'#CFE2FF', text:
`Interview chain (3-min turns):

Ask your partner:
1. A habit you've built that you're proud of?
2. A habit you've tried to break and failed?
3. A "guilty pleasure" you refuse to give up?
4. Sleep, food, or exercise — which is your weakest right now?
5. One thing you used to do that you've stopped doing?

Use: I've been -ing / I used to / I gave up -ing / I'm trying to cut down on…

Note one phrase your partner used that you'd like to steal.` },
      { title:'🎤 Production — 7-day contract · 12 min', color:'#FFB8D9', text:
`Design a 7-day habit contract for a partner:

Step 1 (3 min): interview partner about their goal.
"What's one habit you want to build OR break this week?"

Step 2 (4 min): write a contract for them with:
- the ONE habit (specific)
- when + where it'll happen
- a tiny version (e.g. "2 push-ups counts")
- a friction reduction ("water bottle next to bed")
- the success rule ("4 out of 7 days = win")

Step 3 (3 min): present the contract back to them. They commit or amend.

Teacher: collect contracts → return next class for follow-up.` },
      { title:'🏠 Homework + Wrap · 8 min', color:'#CDB4F6', text:
`Wrap (3 min):
Pairs share the most surprising contract clause they wrote.

Homework:
- Live by the contract for 7 days.
- Log each day with 1 line: did it / didn't / partial.
- At the end, write a 100-word review.

"What worked: ____.
What got in the way: ____.
What I'd change for week 2: ____."

Send to teacher with the original contract.` }
    ]
  },

  {
    id: 'lp-money-shopping-b1',
    title: 'Money & Shopping',
    level: 'B1', duration: '45 min', skill: 'Vocab + Functional',
    icon: '🛍️', color: '#FFB000', bg: 'rgba(255,176,0,.14)',
    summary: 'Spending styles → finance chunks → complaint role-play → budget reflection.',
    stages: [
      { title:'🌟 Warm-up · 5 min', color:'#FFE566', text:
`Spending personality:

In pairs (45s each):
• Saver or spender — be honest.
• Last "I shouldn't have" purchase?
• Best-value thing you ever bought?
• Worst-value thing you ever bought?
• Cash or card — and why?

Then: rank in the class — who's the biggest saver? Biggest spender? Vote without talking.` },
      { title:'📚 Input — Money chunks · 10 min', color:'#AFF4C6', text:
`Useful money + shopping chunks:

Spending:
- splurge on (something nice)
- splash out on
- be a bargain / a rip-off
- worth every penny / a waste of money

Saving:
- put aside / set aside money for…
- live on a tight budget
- live within / beyond your means
- pinch pennies

Shopping problems:
- a refund / an exchange
- be entitled to a refund
- it's faulty / defective
- it doesn't fit / suit me
- the size was wrong
- the colour faded after one wash` },
      { title:'💪 Practice — Complaint phrases · 10 min', color:'#CFE2FF', text:
`Match the customer line to the right verb:

1. Complain about a product
2. Explain the problem
3. Say what you want
4. Push back politely

Example bank:
A. "I'd like to return this, please."
B. "I'm afraid I'm not happy with…"
C. "It's not what I was expecting because…"
D. "I appreciate that, but the policy says…"
E. "I think I'm entitled to a full refund."
F. "Could you check with your manager?"

Pairs say each line out loud, then build a 4-line mini-dialogue using one from each category.` },
      { title:'🎤 Production — Shop role-play · 12 min', color:'#FFB8D9', text:
`Pairs — assign roles, swap after 5 min.

CUSTOMER:
- Bought item online, arrived wrong colour + 1 size too small.
- Receipt: 2 weeks ago.
- Wants: full refund, not exchange.

SHOP ASSISTANT:
- Store policy: exchange within 30 days, refund only with original packaging.
- Customer lost the packaging.

Use:
✓ at least 3 complaint phrases
✓ at least 2 "polite push-back" phrases
✓ at least 1 compromise: "What if we…?"

End either with a refund, an exchange, or "speak to manager".

Teacher: feed twists ("Card limit reached", "Sales item — no refund").` },
      { title:'🏠 Homework + Wrap · 8 min', color:'#CDB4F6', text:
`Wrap (3 min):
Each pair shares one "killer line" their role-play used.

Homework — "My last 5 purchases" (120 words):
List them with:
- price
- worth-every-penny / waste-of-money?
- one you'd un-buy if you could

End with one habit you want to change about your spending.

Optional: bring a real receipt + complaint phrase you'd love to be able to say.` }
    ]
  },

  {
    id: 'lp-news-current-b2',
    title: 'News & Current Events',
    level: 'B2', duration: '50 min', skill: 'Reading + Speaking',
    icon: '📰', color: '#3A3A40', bg: 'rgba(58,58,64,.10)',
    summary: 'Headline-only predictions → reading → bias detection → news round-up.',
    stages: [
      { title:'🌟 Warm-up · 5 min', color:'#FFE566', text:
`Headline detective (project 3 real headlines, no source):

For each headline in pairs (60s each):
• Which country / outlet is it from?
• Who's the headline written for?
• What words are emotional / loaded?
• What would a NEUTRAL version of the headline look like?

Then reveal sources and check predictions.

Teacher elicit: it suggests, it implies, it sounds biased, the word "X" is loaded.` },
      { title:'📚 Input — Reading + chunks · 12 min', color:'#AFF4C6', text:
`Read the 130-word neutral article + spot the chunks.

Useful news + opinion chunks:
- according to / sources claim / it has emerged that
- spark debate / fuel speculation / raise concerns
- amid (growing tensions / criticism)
- in the wake of
- to back down / step down / press ahead
- a watershed moment
- a knee-jerk reaction
- to take with a grain of salt

After reading:
Highlight 5 chunks you'd actually use. Build 1 sentence with each that applies to your country / city / industry.` },
      { title:'💪 Practice — Bias spotting · 10 min', color:'#CFE2FF', text:
`Rewriting drill:

Take these biased lines and make them NEUTRAL:

1. "Activists swarmed the building, causing chaos."
2. "The brave protesters stood up against a corrupt regime."
3. "Migrants flooded into the country."
4. "The minister bravely admitted his mistake."
5. "A leaked report exposes the truth about the deal."

Then take ONE neutral line and rewrite it:
a) in a sympathetic style
b) in a hostile style

Discuss: how easy was the manipulation?` },
      { title:'🎤 Production — News round-up · 15 min', color:'#FFB8D9', text:
`Each student brings 1 news story they care about (max 30s of background).

Round-table format (5 students per group):
1. Present your story in 60s (with at least 2 chunks from input)
2. Group asks 2 sharp questions
3. You give a 30s reaction

After all 5:
- Vote on the most important story
- Vote on the most well-presented story
- Group writes a 1-sentence headline for each story (their best attempt)

Teacher: monitor for hedging, evidence and reaction language.` },
      { title:'🏠 Homework + Wrap · 8 min', color:'#CDB4F6', text:
`Wrap (3 min):
Each group reads aloud their best headline. Class votes most professional one.

Homework (150 words):
Take a story you DISAGREE with and write a fair-minded "steel-manned" summary:
- summarise the OPPOSITE position in its strongest form
- include 2 chunks from input
- end with: "Even though I disagree, the strongest point of this view is…"

Send to teacher. (Optional: bring back to class next week.)` }
    ]
  },

  {
    id: 'lp-relationships-b1',
    title: 'Friendship & Relationships',
    level: 'B1 → B2', duration: '45 min', skill: 'Speaking',
    icon: '👫', color: '#FF6B9D', bg: 'rgba(255,107,157,.14)',
    summary: 'Friendship maps → relationship vocab → advice column → personal manifesto.',
    stages: [
      { title:'🌟 Warm-up · 5 min', color:'#FFE566', text:
`Friendship map:

On a piece of paper, draw concentric circles (inner / middle / outer):
- INNER: 3 people you'd call at 2 a.m.
- MIDDLE: 8 people you'd invite to a birthday.
- OUTER: 20 people you're glad to see at a wedding.

Pairs (60s each):
• Who recently moved between circles?
• Which circle do you wish was bigger?
• Is "online friends" a real circle or a different category?

Teacher elicit: we drifted apart, we grew closer, we lost touch, we reconnected.` },
      { title:'📚 Input — Relationship verbs · 10 min', color:'#AFF4C6', text:
`Relationship verbs (with collocations):

Getting closer:
- click with someone
- hit it off
- grow close to / closer to
- have a soft spot for
- look up to

Drifting apart:
- drift apart
- grow apart / out of (a friendship)
- lose touch
- have a falling out
- ghost someone

Repairing:
- patch things up
- reconnect with
- clear the air
- bury the hatchet

Build 1 personal sentence per group (3 sentences total).` },
      { title:'💪 Practice — Advice column · 10 min', color:'#CFE2FF', text:
`Read this micro-letter:

"Dear X,
My best friend of 10 years has stopped replying to my messages since I told her I'm moving abroad. I think she's hurt but won't admit it. I'm leaving in 6 weeks. Should I confront her or just give her space?
— Caught in between"

In pairs draft a 3-paragraph reply (~80 words) using:
- 1 empathy line ("It sounds like…")
- 1 advice with "if I were you, I'd…"
- 1 concrete next step within 6 weeks
- 1 honest warning ("but be prepared for…")

Read aloud. Class votes the warmest + the wisest reply.` },
      { title:'🎤 Production — Hot seat · 12 min', color:'#FFB8D9', text:
`Hot seat — 1 in the chair, 3 ask.

The chair-holder picks a card:
A. "Forgive a friend who lied to you."
B. "End a long friendship that drains you."
C. "Tell a friend they have a problem they refuse to see."
D. "Ask a friend for a big favour."

The 3 askers grill with:
"Why now?" / "What if it backfires?" / "What's the worst case?" / "What would you say in 1 sentence?"

Chair must use:
✓ at least 3 verbs from input
✓ at least 1 conditional ("If I told her, she'd…")

Rotate every 3 min.` },
      { title:'🏠 Homework + Wrap · 8 min', color:'#CDB4F6', text:
`Wrap (3 min):
Each student names ONE concrete thing they'll do this week for someone in their inner circle.

Homework (130 words):
"My friendship manifesto."
3 sentences about friends you keep close.
3 sentences about friends you've let go.
2 promises about how you want to show up for the inner circle.

End with: "The friend I want to be in 5 years is one who…"
Send to teacher.` }
    ]
  },

  {
    id: 'lp-movies-reviews-b2',
    title: 'Movies, Series & Reviews',
    level: 'B2', duration: '45 min', skill: 'Writing + Vocab',
    icon: '🎬', color: '#A78BFA', bg: 'rgba(167,139,250,.14)',
    summary: 'Pitch-it game → review chunks → 90-word review draft → peer edit.',
    stages: [
      { title:'🌟 Warm-up · 5 min', color:'#FFE566', text:
`Pitch-it game (45s pitches):

Pitch a movie/series to someone who hasn't seen it. Constraints:
• No spoilers.
• Mention 1 character and 1 conflict.
• End with one reason to watch it tonight.

Pairs swap. After 5 pitches, vote on the most convincing.

Teacher elicit: it follows…, it's set in…, it explores…, what hooked me was…` },
      { title:'📚 Input — Review chunks · 10 min', color:'#AFF4C6', text:
`Review vocabulary:

Praise:
- gripping / compelling / pulls you in
- nuanced / layered / understated
- a tour-de-force performance
- a slow burn
- a satisfying payoff
- the writing crackles

Criticism:
- predictable / paint-by-numbers
- wooden acting / clunky dialogue
- a missed opportunity
- the pacing drags
- the ending falls flat
- style over substance

Hedges:
- it's not for everyone
- if you can stomach the pacing
- depending on your tolerance for…

Drill: rewrite 1 movie review in your phone using 4 chunks.` },
      { title:'💪 Practice — Sentence patterns · 10 min', color:'#CFE2FF', text:
`Build with these patterns:

1. Set-up + verb:
"Set in 1920s Berlin, the series follows / explores / centres on…"

2. Strength + reason:
"What the show does best is…"
"The writing crackles because…"

3. Honest critique:
"It loses momentum when…"
"It could have done without…"

4. Verdict:
"A confident debut, despite…"
"Worth watching, especially if you…"
"Skip it unless you really love…"

Students draft 4 sentences about a real show using each pattern.` },
      { title:'🎤 Production — 90-word review · 12 min', color:'#FFB8D9', text:
`Write a 90-word review of any film / series.

Structure:
- 1-line hook (no spoilers)
- 2 lines setup (genre, setting, premise)
- 1 strength (with a chunk)
- 1 weakness (with a chunk)
- 1 honest verdict + star rating

Peer edit (5 min):
Swap with a partner. Mark:
✓ 1 strongest line
⚙️ 1 line that could be sharper
❓ 1 chunk that doesn't fit

Revise.` },
      { title:'🏠 Homework + Wrap · 8 min', color:'#CDB4F6', text:
`Wrap (3 min):
Read aloud the partner's strongest line. Vote for "best opener" + "harshest but fair critique".

Homework — Full review (180 words):
Use the same structure, expanded:
- 2-line setup
- 1 paragraph strength (with example)
- 1 paragraph weakness (with example)
- 1 sentence verdict

Post in class chat. Read 2 classmates' reviews and leave 1 specific comment each.` }
    ]
  }
];

/* ─── TOOL_FLOW_TEMPLATES ─── */
const TOOL_FLOW_TEMPLATES = {
  reading: [
    '1️⃣ Lead-in\nPredict the topic from the title or first sentence.',
    '2️⃣ Gist\nChoose the best summary in 60 seconds.',
    '3️⃣ Detail\nAnswer 4–6 questions with evidence from the text.',
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
  { icon:'🗂️', title:'Flashcards',        tag:'Vocabulary', desc:'Flip cards to test yourself — Got it / Again tracking',    src:'games/flashcards.html',            w:460, h:560 },
  { icon:'✍️', title:'Fill in the Blank', tag:'Grammar',    desc:'Type the missing word to complete each sentence',          src:'games/fill-blank.html',            w:460, h:560 },
  { icon:'🔍', title:'Word Search',        tag:'Spelling',   desc:'Find hidden words in a 12×12 letter grid',                src:'games/word-search.html',           w:520, h:620 },
  { icon:'⚡', title:'Speed Quiz',         tag:'Speed',      desc:'4-option MCQ with 6-second countdown — how fast are you?', src:'games/speed-quiz.html',            w:480, h:560 },
  { icon:'🎡', title:'Spin the Wheel',     tag:'Speaking',   desc:'Editable word wheel — great for hot-seat vocabulary drills', src:'games/spin-wheel.html',          w:460, h:560 },
  { icon:'🃏', title:'Find the Match',     tag:'Vocabulary', desc:'Tap matching word + translation tiles before time runs out', src:'games/find-match.html',          w:560, h:600 },
  { icon:'❓', title:'Vocabulary Quiz',    tag:'Vocabulary', desc:'Multiple-choice quiz built from your word pairs',         src:'games/vocab-quiz.html',            w:480, h:560 },
  { icon:'🧩', title:'Crossword',          tag:'Vocabulary', desc:'Auto-generated crossword — your words, your clues',        src:'games/crossword.html',             w:600, h:620 },
  { icon:'🗃️', title:'Group Sort',         tag:'Vocabulary', desc:'Drag words into the correct category bins',                src:'games/group-sort.html',            w:600, h:560 },
  { icon:'👾', title:'Maze Chase',         tag:'Vocabulary', desc:'Run the maze and grab only the target-category words',    src:'games/maze-chase.html',            w:520, h:600 },
  { icon:'🔨', title:'Whack-a-Mole',       tag:'Vocabulary', desc:'Whack only the words from the target category',           src:'games/whack-a-mole.html',          w:560, h:560 },
  { icon:'🖼️', title:'Photo Match',        tag:'Vocabulary', desc:'Match each word to its photo — images fetched automatically', src:'games/word-image-match.html',      w:560, h:620 },
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

/* ─── STICKER_KEYWORDS — maps English words → emoji glyphs ─── */
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
window.BOARD_TEACHER_TOOLS = BOARD_TEACHER_TOOLS;
window.STICKER_KEYWORDS     = STICKER_KEYWORDS;
window.TOOL_SEED_CONTENT   = TOOL_SEED_CONTENT;
window.TOOL_SEED_FALLBACKS = TOOL_SEED_FALLBACKS;
window.LESSON_PACKS        = LESSON_PACKS;
window.TOOL_FLOW_TEMPLATES = TOOL_FLOW_TEMPLATES;
window.GAMES               = GAMES;
window.STICKER_CATEGORIES  = STICKER_CATEGORIES;
})();
