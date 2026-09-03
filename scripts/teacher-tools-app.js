/* ════════════════════════════════════════════════════════════════
   teacher-tools-app.js - TeachEd Teacher Tools page logic
   Extracted from the inline <script> block for HTTP/SW cacheability
   (perf: 163KB out of the HTML payload, cached across visits)
   ════════════════════════════════════════════════════════════════ */
const TOOL_STORE = 'teachedos_teacher_tools_library';
const FAV_STORE = 'teachedos_teacher_tools_favorites';
const DRAFT_STORE = 'teachedos_teacher_tools_drafts';
const RECENT_TOOL_STORE = 'teachedos_teacher_tools_recent';
const KNOWLEDGE_BASE_STORE = 'teachedos_teacher_knowledge_bases';
const TOOLS = [
  {id:'lesson-pack',cat:'utility',badge:'New',icon:'PLAN',title:'Complete Lesson Pack Builder',desc:'Create a warm-up, presentation, practice, production and homework plan from one topic.',mode:'lesson-pack'},
  {id:'worksheet-builder',cat:'utility',badge:'New',icon:'PDF',title:'ESL Worksheet Builder',desc:'Turn a topic or text into a printable worksheet with teacher notes and answer key.',mode:'worksheet'},
  {id:'homework-set',cat:'utility',icon:'HW',title:'Homework Assignment Builder',desc:'Create clear homework instructions, tasks, deadlines and success criteria.',mode:'homework'},
  {id:'vocab-workout',cat:'vocabulary',badge:'New',icon:'SET',title:'Vocabulary Workout',desc:'Paste one word list and build a whole practice set: tick the activities you need, edit each one, send them to the board together.',mode:'vocab-workout'},
  {id:'word-image-match',cat:'vocabulary',badge:'New',icon:'IMG',title:'Word-Image Matching',desc:'Create a visual matching exercise with uploadable images and target words.',mode:'images',game:'memory-match'},
  {id:'word-definition-match',cat:'vocabulary',icon:'DEF',title:'Word-Definition Matching',desc:'Turn vocabulary into matching pairs for cards, worksheets or memory games.',mode:'pairs',game:'memory-match'},
  {id:'word-translation-match',cat:'vocabulary',badge:'New',icon:'WT',title:'Word-Translation Matching',desc:'Translate target words and build matching pairs for bilingual vocabulary practice.',mode:'translation-match',game:'memory-match'},
  {id:'extract-vocab',cat:'vocabulary',badge:'New',icon:'KEY',title:'Extract Vocabulary From a Text',desc:'Pull useful keywords from a text and create a study list.',mode:'text-vocab',game:'flashcards'},
  {id:'essential-vocab',cat:'vocabulary',icon:'A-Z',title:'Essential Vocabulary on a Topic',desc:'Generate a practical topic vocabulary set with teacher-friendly definitions.',mode:'topic-vocab',game:'flashcards'},
  {id:'odd-one-out',cat:'vocabulary',badge:'New',icon:'ODD',title:'Odd One Out',desc:'Create groups where students identify the word that does not belong.',mode:'odd',game:'speed-quiz'},
  {id:'word-sorting',cat:'vocabulary',badge:'New',icon:'SORT',title:'Words Sorting',desc:'Group vocabulary into categories for drag-and-drop sorting practice.',mode:'sorting',game:'word-categories'},
  {id:'sentences-vocab',cat:'vocabulary',badge:'Pro',icon:'SNT',title:'Create Sentences with Vocabulary',desc:'Produce example sentences for each target word.',mode:'sentences-vocab',game:'fill-blank'},
  {id:'text-topic-vocab',cat:'reading',icon:'TXT',title:'Create a Text with Your Vocabulary',desc:'Write a short leveled reading text that uses selected target vocabulary.',mode:'text-with-vocab'},
  {id:'abcd-text',cat:'reading',icon:'ABCD',title:'Create ABCD Questions for a Text',desc:'Generate multiple-choice comprehension questions from a source text.',mode:'abcd',game:'speed-quiz'},
  {id:'open-questions',cat:'reading',icon:'Q?',title:'Create Open Questions for a Text',desc:'Generate open-ended questions for comprehension and discussion.',mode:'open-questions'},
  {id:'true-false',cat:'reading',badge:'Pro',icon:'T/F',title:'Create True/False Statements',desc:'Create true and false statements from a text for quick reading checks.',mode:'true-false',game:'true-false'},
  {id:'three-titles',cat:'reading',icon:'3T',title:'Create Three Titles for a Text',desc:'Make one correct title and two plausible distractors.',mode:'three-titles',game:'speed-quiz'},
  {id:'cefr',cat:'utility',badge:'Pro',icon:'CEFR',title:'CEFR Level Checker',desc:'Estimate text difficulty and receive simplification tips.',mode:'cefr'},
  {id:'link-words',cat:'writing',icon:'LINK',title:'Link Words into Sentences',desc:'Ask students to connect target words into meaningful sentences.',mode:'link-words'},
  {id:'creative-writing',cat:'writing',icon:'WRITE',title:'Creative Writing with Target Vocabulary',desc:'Generate writing prompts that require using a vocabulary set.',mode:'creative-writing'},
  {id:'sentence-translation',cat:'writing',badge:'New',icon:'TR',title:'Sentence Translation Exercises',desc:'Create translation prompts around target vocabulary or grammar.',mode:'translation'},
  {id:'word-order',cat:'grammar',badge:'New',icon:'↕',title:'Word Order / Unscramble',desc:'Shuffle sentence words for students to put back in the correct order.',mode:'word-order',game:'fill-blank'},
  {id:'matching-halves',cat:'grammar',badge:'New',icon:'½+½',title:'Matching Halves',desc:'Split collocations or sentences into two halves for students to match.',mode:'matching-halves',game:'memory-match'},
  {id:'rewrite',cat:'grammar',badge:'Pro',icon:'RE',title:'Rewrite the Sentence',desc:'Rewrite prompts focused on a grammar structure.',mode:'rewrite'},
  {id:'gap',cat:'grammar',icon:'GAP',title:'Fill in the Gap',desc:'Replace target words with blanks and provide the answer key.',mode:'gap',game:'fill-blank'},
  {id:'gaps-abcd',cat:'grammar',badge:'Pro',icon:'A/B',title:'Gaps with ABCD',desc:'Create multiple-choice gap-fill grammar tasks.',mode:'gaps-abcd',game:'speed-quiz'},
  {id:'two-options',cat:'grammar',badge:'Pro',icon:'/',title:'Two Options with a Slash',desc:'Create choose-the-correct-option sentence pairs.',mode:'two-options'},
  {id:'error-correction',cat:'grammar',badge:'Pro',icon:'ERR',title:'Error Correction Exercise',desc:'Create sentences with mistakes for students to correct.',mode:'error-correction'},
  {id:'grammar-rules',cat:'grammar',badge:'Pro',icon:'RULE',title:'Grammar Rules',desc:'Generate concise rules, examples and practice prompts.',mode:'grammar-rules'},
  {id:'discussion',cat:'speaking',icon:'CHAT',title:'Find Discussion Questions',desc:'Create warm-up, deeper and follow-up questions for a topic.',mode:'discussion'},
  {id:'dialogue',cat:'speaking',icon:'DIA',title:'Create a Dialogue on Any Topic',desc:'Build a role-play dialogue with target vocabulary.',mode:'dialogue'},
  {id:'warmup-listening',cat:'speaking',icon:'WARM',title:'Warm-Up Before Listening',desc:'Prepare prediction questions before an audio or video lesson.',mode:'warmup'},
  {id:'audio-video-questions',cat:'listening',badge:'Pro',icon:'A/V',title:'Audio & Video Question Creator',desc:'Use a transcript or notes to create listening questions.',mode:'media-questions'},
  {id:'transcript-helper',cat:'listening',badge:'Pro',icon:'SUB',title:'Convert Audio/Video Notes to Text Task',desc:'Paste or type a transcript, then turn it into classroom tasks.',mode:'transcript'},
  {id:'add-text',cat:'utility',icon:'TXT+',title:'Add Your Text',desc:'Create a clean text block for a lesson or worksheet.',mode:'add-text'},
  {id:'add-images',cat:'utility',icon:'IMG+',title:'Add Your Images',desc:'Upload classroom images and attach teaching notes.',mode:'add-images'},
  {id:'add-video',cat:'utility',icon:'VID',title:'Add Your Video',desc:'Attach a video link and create viewing tasks around it.',mode:'add-video'},
  {id:'simplify-text',cat:'reading',badge:'New',icon:'≈',title:'Simplify / Upgrade Text',desc:'Rewrite a text at an easier or a more advanced level.',mode:'simplify'},
  {id:'reading-bits',cat:'reading',badge:'New',icon:'BITS',title:'Reading Bits and Pieces',desc:'Split a text into jumbled pieces for students to reorder.',mode:'reading-bits',game:'fill-blank'},
  {id:'comm-situations',cat:'vocabulary',badge:'New',icon:'SIT',title:'Communicative Situations',desc:'Generate role-play situation cards that use the target vocabulary.',mode:'comm-situations'},
  {id:'rephrase-word',cat:'vocabulary',badge:'New',icon:'RPH',title:'Rephrase Using Word Given',desc:'Rewrite sentences keeping the meaning, using a given key word.',mode:'rephrase-word'},
  {id:'four-opinions',cat:'writing',badge:'New',icon:'4OP',title:'Four Opinions',desc:'Present four contrasting opinions on a topic for response writing.',mode:'four-opinions'},
  {id:'find-quotes',cat:'writing',badge:'New',icon:'❝❞',title:'Find Quotes',desc:'Collect relevant quotes about a topic for discussion and writing.',mode:'find-quotes'},
  {id:'essay-topics',cat:'writing',badge:'New',icon:'ESS',title:'Essay Topics',desc:'Generate essay prompts and questions on any topic.',mode:'essay-topics'},
  {id:'lead-in',cat:'speaking',badge:'New',icon:'LEAD',title:'Lead-in Activities',desc:'Create quick warm-up activities to introduce a topic.',mode:'lead-in'},
  {id:'interesting-facts',cat:'speaking',badge:'New',icon:'FACT',title:'Interesting Facts',desc:'Generate fact-based discussion starters about a topic.',mode:'facts'},
  {id:'pros-cons',cat:'speaking',badge:'New',icon:'+/−',title:'Pros and Cons',desc:'List arguments for and against a topic for debate practice.',mode:'pros-cons'},
  {id:'type-gap',cat:'grammar',badge:'New',icon:'TYP',title:'Type Anything into Gap',desc:'Create open cloze gaps where students type a suitable word.',mode:'type-gap',game:'fill-blank'},
  {id:'gaps-brackets',cat:'grammar',badge:'New',icon:'( )',title:'Gaps with Brackets',desc:'Gap-fill with the base word in brackets for students to transform.',mode:'gaps-brackets',game:'fill-blank'},
  {id:'word-bank',cat:'grammar',badge:'New',icon:'BANK',title:'Fill from Word Bank',desc:'Gap-fill where students choose answers from a provided word bank.',mode:'word-bank',game:'fill-blank'},
  {id:'summary-gapfill',cat:'listening',badge:'New',icon:'SUM',title:'Summary GapFill',desc:'Create a gapped summary of a transcript for listening practice.',mode:'summary-gapfill',game:'fill-blank'},
  {id:'choose-summary',cat:'listening',badge:'New',icon:'CHS',title:'Choose Right Summary',desc:'Offer several summaries so students pick the correct one.',mode:'choose-summary',game:'speed-quiz'}
];
const PRESET_PACKS = [
  {
    title: "A2 Travel Lesson",
    sub: "airport, hotel, directions",
    tool: "lesson-pack",
    level: "A2",
    topic: "Travel problems",
    vocab: "airport - a place where planes arrive and leave\nhotel - a place to stay when travelling\nticket - proof that you paid for a journey\nluggage - bags you take on a trip\ndirections - instructions for finding a place",
    source: "A tourist arrives in a new city. The hotel reservation is correct, but the taxi driver does not understand the address. The tourist asks for help and tries to explain the problem politely."
  },
  {
    title: "B1 Job Interview",
    sub: "speaking + useful phrases",
    tool: "dialogue",
    level: "B1",
    topic: "Job interview",
    vocab: "experience - work you have done before\nstrength - something you do well\nresponsibility - something you must do\nachievement - something successful you did\nchallenge - a difficult task",
    source: "A candidate is preparing for a job interview. They need to explain their experience, describe a strength, and give an example of a challenge they solved."
  },
  {
    title: "B2 Environment",
    sub: "reading + discussion",
    tool: "worksheet-builder",
    level: "B2",
    topic: "Sustainable cities",
    vocab: "sustainable - able to continue without damage\nemissions - gases released into the air\npublic transport - buses, trains and trams\nwaste - things people throw away\nrenewable - energy that can be replaced naturally",
    source: "Many cities are trying to reduce emissions by improving public transport, creating bike lanes, and using renewable energy. However, these changes require money, planning, and public support."
  },
  {
    title: "Grammar: Present Perfect",
    sub: "rules + practice",
    tool: "grammar-rules",
    level: "B1",
    topic: "Present perfect for experience",
    vocab: "already - before now\never - at any time in your life\nnever - not at any time\nyet - until now\njust - a short time ago",
    source: "Students often confuse past simple and present perfect when they talk about life experience, recent news, and unfinished time periods."
  },
  {
    title: "A1 Daily Routine",
    sub: "morning, work, evening",
    tool: "lesson-pack",
    level: "A1",
    topic: "Daily routine",
    vocab: "wake up - stop sleeping\nhave breakfast - eat in the morning\ngo to work - travel to your job\ncome home - return to your house\ngo to bed - start sleeping",
    source: "Anna wakes up at seven o clock. She has breakfast, goes to work, comes home in the evening, and goes to bed at ten."
  },
  {
    title: "A1 Food Cafe",
    sub: "ordering politely",
    tool: "dialogue",
    level: "A1",
    topic: "Ordering food in a cafe",
    vocab: "menu - a list of food and drinks\ncoffee - a hot drink\nsandwich - bread with food inside\nbill - the money you must pay\nplease - a polite word",
    source: "A customer wants to order a sandwich and a coffee. The waiter asks a few simple questions and brings the bill."
  },
  {
    title: "A2 Doctor Visit",
    sub: "symptoms + advice",
    tool: "worksheet-builder",
    level: "A2",
    topic: "At the doctor",
    vocab: "headache - pain in your head\ncough - air comes from your throat suddenly\nfever - high body temperature\nmedicine - something you take to feel better\nappointment - a planned meeting with a doctor",
    source: "Marta does not feel well. She has a headache and a fever, so she makes an appointment with a doctor. The doctor asks questions and gives advice."
  },
  {
    title: "A2 Shopping Return",
    sub: "store phrases",
    tool: "dialogue",
    level: "A2",
    topic: "Returning an item to a shop",
    vocab: "receipt - paper that shows what you bought\nsize - how big or small clothes are\nrefund - money you get back\nexchange - change one item for another\nfaulty - not working correctly",
    source: "A customer bought a jacket, but the size is wrong. They go back to the shop with the receipt and ask for an exchange."
  },
  {
    title: "B1 City Life",
    sub: "pros, cons, opinions",
    tool: "discussion",
    level: "B1",
    topic: "Living in a big city",
    vocab: "crowded - full of people\nconvenient - easy and useful\ntraffic - cars and buses on roads\nopportunity - a good chance to do something\nnoise - loud or unpleasant sound",
    source: "Big cities offer jobs, transport, restaurants, and entertainment. At the same time, they can be noisy, crowded, expensive, and stressful."
  },
  {
    title: "B1 Social Media",
    sub: "reading + debate",
    tool: "worksheet-builder",
    level: "B1",
    topic: "Social media habits",
    vocab: "scroll - move down a screen\nnotification - a message alert\nprivacy - control over personal information\ncompare - look for similarities and differences\nhabit - something you do regularly",
    source: "Many teenagers and adults check social media several times a day. It helps people stay connected, but it can also affect sleep, attention, and confidence."
  },
  {
    title: "B1 Past Storytelling",
    sub: "narrative tenses",
    tool: "creative-writing",
    level: "B1",
    topic: "Telling a story in the past",
    vocab: "suddenly - quickly and unexpectedly\nwhile - during the time that\nrealise - understand something\ndecide - choose what to do\nfinally - at the end",
    source: "Students practise telling a short story using past simple, past continuous, and useful sequencing words."
  },
  {
    title: "B2 Remote Work",
    sub: "business discussion",
    tool: "discussion",
    level: "B2",
    topic: "Remote work and productivity",
    vocab: "flexibility - ability to change easily\nproductivity - how much useful work is done\ncommute - travel to work\ncollaboration - working together\nboundary - a limit between two things",
    source: "Remote work gives employees more flexibility and saves commuting time, but some teams find communication, motivation, and boundaries more difficult."
  },
  {
    title: "B2 Customer Complaint",
    sub: "business role-play",
    tool: "dialogue",
    level: "B2",
    topic: "Handling a customer complaint",
    vocab: "complaint - a statement that something is wrong\nresolve - find a solution\napologise - say sorry\ncompensation - something given after a problem\npolicy - official rule or plan",
    source: "A customer contacts a company because a delivery arrived late and one item was damaged. The support agent needs to apologise and offer a solution."
  },
  {
    title: "B2 News Article",
    sub: "headlines + comprehension",
    tool: "three-titles",
    level: "B2",
    topic: "Understanding a news article",
    vocab: "headline - title of a news story\nsource - where information comes from\nevidence - facts that support an idea\nclaim - something someone says is true\nbias - unfair preference for one side",
    source: "A local newspaper reports that public transport use has increased after the city introduced cheaper monthly passes and more reliable evening buses."
  },
  {
    title: "C1 Academic Debate",
    sub: "argument + nuance",
    tool: "discussion",
    level: "C1",
    topic: "Should universities allow writing assistants?",
    vocab: "ethical - connected with right and wrong\naccountability - responsibility for decisions\nplagiarism - using someone else s work as your own\ncritical thinking - careful independent judgement\nimplementation - putting a plan into action",
    source: "Universities are debating how writing assistants should be used in academic work. Some teachers see them as useful support, while others worry about plagiarism and shallow thinking."
  },
  {
    title: "C1 Climate Policy",
    sub: "advanced vocabulary",
    tool: "essential-vocab",
    level: "C1",
    topic: "Climate policy and economics",
    vocab: "incentive - something that encourages action\nregulation - official rule\ntransition - change from one system to another\nsubsidy - money from government to support something\ntrade-off - balance between two competing things",
    source: "Climate policy often involves trade-offs between economic growth, energy security, and environmental protection. Governments use regulations, subsidies, and incentives to influence behaviour."
  },
  {
    title: "IELTS Speaking Part 2",
    sub: "cue card builder",
    tool: "creative-writing",
    level: "B2",
    topic: "Describe a memorable journey",
    vocab: "memorable - easy to remember\ndestination - place you travel to\nunexpected - not planned\nimpression - feeling or opinion\nrecommend - say something is good",
    source: "Students prepare a two-minute IELTS-style answer with a clear beginning, details, personal feelings, and a short conclusion."
  },
  {
    title: "TOEFL Campus Listening",
    sub: "notes + questions",
    tool: "media-questions",
    level: "B2",
    topic: "Campus announcement and student conversation",
    vocab: "deadline - final time to do something\nregister - officially sign up\nrequirement - something necessary\noption - choice\nconfirm - check that something is true",
    source: "Student A: Did you hear that the registration deadline changed? Student B: No, what happened? Student A: The department extended it until Friday because the online system was down."
  },
  {
    title: "Kids: Animals",
    sub: "games + matching",
    tool: "word-image-match",
    level: "A1",
    topic: "Animals and actions",
    vocab: "cat - small pet animal\ndog - friendly pet animal\nbird - animal that can fly\nfish - animal that lives in water\nrabbit - small animal with long ears",
    source: "Children learn animal names and simple actions: run, jump, swim, fly, sleep."
  },

  // ═══════════════════════════════════════════════════════════════════
  // EXPANDED PRESET LIBRARY - 60+ ready topics across A1-C1 + exams
  // ═══════════════════════════════════════════════════════════════════

  // ─── A1 BEGINNER ───────────────────────────────────────────────────
  {
    title: "A1 Family Members", sub: "describe your family", tool: "essential-vocab", level: "A1",
    topic: "Family members",
    vocab: "mother - female parent\nfather - male parent\nbrother - male sibling\nsister - female sibling\ngrandmother - mother of your parent\ngrandfather - father of your parent\nson - male child\ndaughter - female child\naunt - sister of your parent\nuncle - brother of your parent\ncousin - child of your aunt or uncle",
    source: "Students introduce their family. \"This is my mother. She is a teacher. I have one brother and two sisters. My grandparents live in another city.\""
  },
  {
    title: "A1 Colors & Shapes", sub: "visual basics", tool: "word-image-match", level: "A1",
    topic: "Colors and basic shapes",
    vocab: "red - the color of a tomato\nblue - the color of the sea\nyellow - the color of the sun\ngreen - the color of grass\nblack - the darkest color\nwhite - the brightest color\ncircle - a round shape\nsquare - a shape with four equal sides\ntriangle - a shape with three sides\nstar - a shape with five points",
    source: "Students point at classroom objects and say the color and shape. \"The book is red. The window is a square. The clock is a circle.\""
  },
  {
    title: "A1 Body Parts", sub: "head to toe", tool: "word-image-match", level: "A1",
    topic: "Parts of the body",
    vocab: "head - top of the body\nface - front of the head\neye - you see with it\nnose - you smell with it\nmouth - you eat with it\near - you hear with it\nhand - end of your arm\nfoot - end of your leg\nfinger - one of five on a hand\nstomach - inside your belly",
    source: "Simon says game. \"Simon says: touch your nose. Simon says: clap your hands. Touch your ear. - Wait, Simon didn't say!\""
  },
  {
    title: "A1 House & Rooms", sub: "where things are", tool: "essential-vocab", level: "A1",
    topic: "Rooms and furniture at home",
    vocab: "kitchen - where you cook\nbedroom - where you sleep\nbathroom - where you wash\nliving room - where the family relaxes\ngarden - outside, with plants\ntable - flat top, four legs\nchair - you sit on it\nbed - you sleep on it\nsofa - long soft seat\nfridge - cold box for food",
    source: "A short tour: \"This is the kitchen. The fridge is next to the window. The living room has a big sofa and a TV. My bedroom is upstairs.\""
  },
  {
    title: "A1 Weather Today", sub: "small talk basics", tool: "dialogue", level: "A1",
    topic: "Talking about the weather",
    vocab: "sunny - lots of sun\nrainy - water falls from the sky\ncloudy - lots of clouds in the sky\nwindy - the air moves fast\nhot - high temperature\ncold - low temperature\nwarm - a little hot, comfortable\ncool - a little cold, comfortable\nsnow - white frozen rain\nfog - thick white air, hard to see",
    source: "Two friends meet on the street. \"Hi! How's the weather today?\" \"It's cold and cloudy. I think it will rain later.\" \"Yes, bring an umbrella!\""
  },
  {
    title: "A1 Clothes & Dressing", sub: "what to wear", tool: "essential-vocab", level: "A1",
    topic: "Clothes for every day and weather",
    vocab: "t-shirt - light top with short sleeves\njeans - blue trousers, casual\njacket - light coat\nshoes - you wear on your feet\nsocks - between foot and shoe\nhat - on your head\nscarf - around your neck for warmth\ngloves - on your hands for cold weather\ndress - one piece of clothing for women\nuniform - special clothes for work or school",
    source: "\"It's cold today. I'm wearing jeans, a warm jacket, a scarf and gloves. My friend is wearing a dress and a coat. We forgot our hats!\""
  },
  {
    title: "A1 Numbers & Prices", sub: "shopping basics", tool: "dialogue", level: "A1",
    topic: "Numbers and prices in a shop",
    vocab: "one - 1\nfive - 5\nten - 10\ntwenty - 20\nfifty - 50\nhundred - 100\nprice - how much something costs\ncheap - not expensive\nexpensive - costs a lot\ndiscount - lower price",
    source: "At a shop: \"How much is this apple?\" \"Fifty cents.\" \"And the bread?\" \"Two euros.\" \"OK, I will take three apples and one bread. That is three euros fifty.\""
  },
  {
    title: "A1 Time & Daily Times", sub: "telling the time", tool: "essential-vocab", level: "A1",
    topic: "Time of day and clock",
    vocab: "morning - the first part of the day\nafternoon - after lunch\nevening - end of the day, before night\nnight - dark time, time to sleep\no'clock - exact hour\nhalf past - thirty minutes after the hour\nquarter past - fifteen minutes after\nquarter to - fifteen minutes before\nminute - sixty seconds\nhour - sixty minutes",
    source: "\"What time is it?\" \"It's half past seven in the morning.\" \"And what time is the class?\" \"Quarter past nine.\""
  },
  {
    title: "A1 School Subjects", sub: "what we study", tool: "essential-vocab", level: "A1",
    topic: "School subjects and timetable",
    vocab: "maths - numbers and calculations\nEnglish - the language of England and the US\nhistory - what happened in the past\nscience - study of the natural world\nart - drawing and painting\nmusic - songs and sounds\nP.E. - sports at school\nfavorite - the one you like the most\nlesson - one class period\nbreak - time between lessons",
    source: "\"My favorite subject is art. I have art on Monday and Friday. I don't like maths very much, but I'm good at English. My P.E. lesson is in the afternoon.\""
  },
  {
    title: "A1 Asking Directions", sub: "left, right, straight", tool: "dialogue", level: "A1",
    topic: "Asking and giving simple directions",
    vocab: "left - opposite of right\nright - opposite of left\nstraight - not turning\ncorner - where two streets meet\nnext to - very close to, beside\nopposite - on the other side\nbetween - in the middle of two things\nhere - this place\nthere - that place\nmap - a drawing of a place",
    source: "\"Excuse me, where is the bank?\" \"Go straight, then turn left at the corner. The bank is next to the supermarket, opposite the post office.\" \"Thank you!\""
  },
  {
    title: "A1 Hobbies & Free Time", sub: "what I like to do", tool: "discussion", level: "A1",
    topic: "Hobbies and free time",
    vocab: "read books - look at words on pages\nplay football - kick a ball with friends\nwatch TV - look at the television\nlisten to music - hear songs\ngo swimming - move in water\ncook - prepare food\ndance - move to music\nride a bike - travel on two wheels\npaint - make pictures with colors\nplay games - have fun with rules",
    source: "\"What do you do in your free time?\" \"I like to read books and listen to music. On weekends I play football with my friends. I don't like cooking, but I love dancing.\""
  },

  // ─── A2 ELEMENTARY ─────────────────────────────────────────────────
  {
    title: "A2 Birthday Party", sub: "invitations + gifts", tool: "dialogue", level: "A2",
    topic: "Planning and attending a birthday party",
    vocab: "invitation - a written message asking someone to come\nguest - a person who is invited\npresent - a gift you give someone\ncandle - small wax stick with fire\ncake - sweet food for celebrations\ndecoration - things that make a room beautiful\nballoon - thin rubber bag filled with air\nplaylist - list of songs to play\ncelebrate - do something fun on a special day\nblow out - push air to stop a flame",
    source: "Maya is turning twelve. She is making invitations for ten guests, decorating the room with balloons, and asking her mum to bake a chocolate cake with twelve candles."
  },
  {
    title: "A2 Public Transport", sub: "bus, train, metro", tool: "dialogue", level: "A2",
    topic: "Using public transport in a city",
    vocab: "platform - where you wait for a train\nticket - paper to pay for a journey\nschedule - list of times\ndelay - when something is late\ntransfer - change to a different line\nrush hour - the time when many people travel\nfare - cost of a journey\nmetro - underground train\ntram - city train on the road\ndriver - person who drives the bus or train",
    source: "Lucas is late for school. He missed his usual bus, so he runs to the metro, transfers at Central Station, and finally takes a tram. The fare costs more, but he arrives only ten minutes late."
  },
  {
    title: "A2 At the Post Office", sub: "letters + parcels", tool: "dialogue", level: "A2",
    topic: "Sending a letter and a package",
    vocab: "envelope - paper cover for a letter\nstamp - small paper you put on a letter to pay\nparcel - a box you send by post\naddress - where someone lives\npostcode - numbers and letters for the address\nweigh - measure how heavy something is\nfragile - easily broken\ndeliver - bring something to a person\nsign - write your name to confirm\nabroad - in another country",
    source: "Marie wants to send a small parcel to her grandmother who lives abroad. She fills in the address, the postcode, and writes \"fragile\" because there is a glass inside. The clerk weighs the parcel and tells her the price."
  },
  {
    title: "A2 Phone Call English", sub: "useful expressions", tool: "dialogue", level: "A2",
    topic: "Making and answering phone calls",
    vocab: "hold on - wait, please\nspeaking - I am the person you want\nmessage - words to give to someone later\ncall back - phone again later\nwrong number - you reached the wrong person\nleave a message - say something for them to hear later\nappointment - planned meeting\nconfirm - say it is correct\ncancel - say it will not happen\nreschedule - move to another time",
    source: "\"Hello, can I speak to Mr Brown?\" \"Speaking. Who's calling?\" \"This is Anna from the dentist. I'm calling to confirm your appointment for tomorrow at ten.\" \"Actually, can I reschedule it?\""
  },
  {
    title: "A2 At the Airport", sub: "check-in + security", tool: "lesson-pack", level: "A2",
    topic: "Travelling through an airport",
    vocab: "boarding pass - the ticket you show to enter the plane\nsecurity - the people who check you and your bag\ngate - the door where you enter the plane\nluggage - bags and suitcases\nhand luggage - small bag you take on the plane\ncarry on - take with you on the plane\ndeparture - leaving\narrival - reaching a place\ndelay - being late\nimmigration - the place where they check passports",
    source: "Sam is travelling to London. He checks his big suitcase, keeps his hand luggage, and goes through security. He buys water at the gate. His flight is delayed by 20 minutes, but he relaxes with a book."
  },
  {
    title: "A2 Pets & Animals", sub: "describing pets", tool: "essential-vocab", level: "A2",
    topic: "Pets, vets and animal care",
    vocab: "puppy - young dog\nkitten - young cat\nvet - animal doctor\nfeed - give food to\nleash - rope or strap for a dog\nfur - the soft hair on an animal\ntame - friendly with people\nstray - lost, no owner\nadopt - take an animal home as a new owner\nshelter - safe home for stray animals",
    source: "Ben and his sister visit a shelter to adopt a kitten. The volunteer explains how to feed the kitten, how often to visit the vet, and what toys are safe for young cats."
  },
  {
    title: "A2 Weather Report", sub: "describing the day", tool: "dialogue", level: "A2",
    topic: "Listening to a weather report",
    vocab: "forecast - what they say the weather will be\ntemperature - how hot or cold it is\ndegree - unit of temperature\nshower - short rain\nthunderstorm - rain with thunder and lightning\nhumid - the air feels wet\nfreezing - very cold, water becomes ice\nmild - not too hot and not too cold\nbreezy - a light wind\nclear - no clouds",
    source: "\"Good morning, here is the weather forecast. Today will be mild and breezy with a temperature of fifteen degrees. There will be a few showers in the afternoon, but the evening will be clear.\""
  },
  {
    title: "A2 Hotel Check-In", sub: "reservations + rooms", tool: "dialogue", level: "A2",
    topic: "Checking into a hotel",
    vocab: "reservation - a room kept for you\nreceptionist - person at the front desk\nkey card - a card that opens the door\nfloor - level of a building\ncheckout - time you must leave\namenities - extras in the hotel\nWi-Fi - wireless internet\nbreakfast - the first meal of the day\nupgrade - move to a better room\ncomplaint - when something is wrong",
    source: "\"Good evening, I have a reservation for two nights under Garcia.\" \"Welcome! Here is your key card, room 312, third floor. Breakfast is from seven to ten. Wi-Fi is free.\""
  },
  {
    title: "A2 Sports & Activities", sub: "play, do, go", tool: "essential-vocab", level: "A2",
    topic: "Sports and active hobbies",
    vocab: "play tennis - hit a ball with a racket\ngo swimming - move in water\ndo yoga - body and mind exercise\ngo jogging - run slowly for exercise\nplay basketball - throw a ball into a net\ndo gymnastics - move in beautiful shapes\ngo cycling - travel on a bike\nplay volleyball - hit a ball over a net\nteam - group of players\ntrainer - person who teaches you to do sport",
    source: "\"What sports do you play?\" \"I play basketball on Wednesdays and go cycling at the weekend. My sister does gymnastics - her trainer is very strict but kind.\""
  },

  // ─── B1 INTERMEDIATE ──────────────────────────────────────────────
  {
    title: "B1 Online Shopping", sub: "reviews + returns", tool: "worksheet-builder", level: "B1",
    topic: "Online shopping, deliveries and returns",
    vocab: "checkout - the final page where you pay\ncart - your selected items\ntracking - following your delivery\nreview - what other customers say\nrating - score out of five stars\nrefund - money back\nfit - the right size for you\ndefective - broken or not working\nout of stock - not available right now\nestimated delivery - when it should arrive",
    source: "Online reviews can be very useful, but they can also be misleading. Some shoppers leave five-star ratings for free products, while others write angry one-star reviews after a small delay. Reading several reviews carefully is more reliable than trusting only the average rating."
  },
  {
    title: "B1 Apartment Hunting", sub: "renting in a city", tool: "dialogue", level: "B1",
    topic: "Looking for a flat to rent",
    vocab: "rent - monthly payment for a flat\ndeposit - money you pay first as security\nlandlord - the owner of the flat\nfurnished - already has furniture\nutilities - electricity, water, internet\nlease - the rental contract\ntenant - the person who rents\nviewing - going to see the flat\nfacilities - extra features in the building\nneighbourhood - the area around your flat",
    source: "\"I'm looking for a one-bedroom flat in the city centre. My budget is about 700 euros, utilities included. I'd prefer a furnished place and I can sign a lease for a year. When can I arrange a viewing?\""
  },
  {
    title: "B1 Cooking & Recipes", sub: "step-by-step instructions", tool: "worksheet-builder", level: "B1",
    topic: "Following and writing a recipe",
    vocab: "ingredients - the food items you need\ntablespoon - large spoon for measuring\nteaspoon - small spoon for measuring\nchop - cut into small pieces\nstir - mix with a spoon\nboil - heat liquid until it bubbles\nbake - cook in an oven\nseason - add salt, pepper or herbs\nserve - put on the plate ready to eat\ngarnish - decorate the dish",
    source: "Mushroom risotto recipe. First, chop one onion finely and stir-fry it in olive oil for two minutes. Add 250 grams of rice and stir. Slowly add hot broth, one ladle at a time. After 18 minutes, the rice should be creamy. Season with parmesan, salt and pepper. Serve hot, garnished with parsley."
  },
  {
    title: "B1 Movies & Series", sub: "what to watch", tool: "discussion", level: "B1",
    topic: "Talking about films and TV series",
    vocab: "plot - the story\ncharacter - a person in the film\nactor / actress - the performer\ndirector - the person who makes the film\nsoundtrack - music in the film\nspoiler - information that ruins the ending\nbinge-watch - watch many episodes in a row\nepisode - one part of a series\nrecommend - say something is good to try\noverrated - not as good as people say",
    source: "\"Have you seen anything good lately?\" \"Yes, I binge-watched a Spanish series at the weekend. The plot is clever and the soundtrack is amazing. I really recommend it, but don't read reviews - too many spoilers!\""
  },
  {
    title: "B1 Healthy Lifestyle", sub: "habits, sleep, stress", tool: "discussion", level: "B1",
    topic: "Building a healthier daily routine",
    vocab: "habit - something you do regularly\nroutine - your usual order of activities\nbalanced diet - eating different healthy foods\nworkout - exercise session\nhydrated - having enough water\nscreen time - hours looking at a phone or computer\nburnout - feeling exhausted from work or stress\nmindfulness - paying attention to the present moment\nwell-being - feeling good in body and mind\nrecovery - resting and getting better",
    source: "Small changes can have a big impact. Going for a 20-minute walk in the morning, drinking water with each meal, and reducing screen time before bed are simple habits that improve sleep, mood and energy levels."
  },
  {
    title: "B1 Money & Budgeting", sub: "saving tips", tool: "discussion", level: "B1",
    topic: "Managing personal finance",
    vocab: "budget - a plan for your money\nincome - money you earn\nexpenses - money you spend\nsavings - money you keep for later\ninvestment - putting money into something to grow it\ndebt - money you owe\nemergency fund - savings for unexpected costs\nimpulse buy - buying without thinking\nsubscription - regular small payments\nfinancial goal - what you want to achieve with money",
    source: "Many young adults find it difficult to save. Experts recommend the 50-30-20 rule: 50% of your income for needs, 30% for wants and 20% for savings. Cancelling unused subscriptions and avoiding impulse buys can free up surprising amounts of money each month."
  },
  {
    title: "B1 Customer Service", sub: "handling complaints", tool: "dialogue", level: "B1",
    topic: "Asking for help and making a complaint",
    vocab: "issue - a problem\nresolve - find a solution\nescalate - move to a higher level\ncompensation - something offered after a problem\npolicy - official rule\nunder warranty - still covered for free repair\nticket number - reference for your request\non hold - waiting on the phone\npatience - being calm while waiting\napologise - say sorry",
    source: "\"Hi, I have an issue with my order. The package arrived two weeks late and one item is missing.\" \"I'm really sorry. Let me check your ticket number… Yes, we'll send the missing item by express and offer 15% off your next purchase. Will that resolve the issue for you?\""
  },
  {
    title: "B1 Music & Concerts", sub: "live shows + festivals", tool: "discussion", level: "B1",
    topic: "Concerts, festivals and music taste",
    vocab: "gig - a small or informal concert\nfestival - a big multi-band music event\nencore - extra song after the main show\nline-up - the list of artists\nheadliner - the most famous act\nlive - performed in person, not recorded\nvenue - the place where a concert happens\nplaylist - a chosen list of songs\nguilty pleasure - song you love but feel shy about\ngenre - type of music",
    source: "\"What was the best gig you've ever been to?\" \"I saw my favourite band at a small venue last summer. The atmosphere was unforgettable, the encore lasted thirty minutes, and I made friends with strangers in the front row. Festivals are fun, but small concerts are the magic.\""
  },
  {
    title: "B1 Family Conflict", sub: "polite disagreement", tool: "dialogue", level: "B1",
    topic: "Disagreeing politely with family",
    vocab: "see eye to eye - agree completely\ntake offence - feel hurt\noverreact - respond too strongly\ncompromise - both sides give a little\nset boundaries - decide what is okay\nbring up - mention something\nlet go of - stop holding on to\nbottle up - keep feelings inside\nclear the air - solve a small conflict\nfamily dynamic - the way the family behaves together",
    source: "Even the closest families don't see eye to eye on everything. The healthiest families don't avoid conflict - they handle it. They talk early, listen carefully, and find a compromise without anyone losing face."
  },
  {
    title: "B1 City vs Countryside", sub: "lifestyle comparison", tool: "discussion", level: "B1",
    topic: "Living in the city vs the countryside",
    vocab: "pace - the speed of life\ncommute - daily travel to work\nfresh air - clean outdoor air\nopen space - empty land or parks\nentertainment - things to do for fun\nstress - feeling worried or pressured\nopportunity - chance to do something good\nisolation - being far from people\nair quality - how clean the air is\nself-sufficient - able to live without much help",
    source: "City life offers career opportunities, entertainment and convenience, but at the cost of stress, expensive rent and poor air quality. The countryside is slower, cheaper and healthier, but jobs are limited and isolation is real, especially in winter. The right choice depends on your life stage."
  },
  {
    title: "B1 Past Travel Stories", sub: "narrative tenses", tool: "creative-writing", level: "B1",
    topic: "Telling a past travel story",
    vocab: "set off - start a journey\nget lost - not know where you are\nrun into - meet by chance\nfigure out - solve a problem\nturn out - happen in the end\nlook back on - remember\nbreathtaking - very impressive\nexhausted - very tired\nunforgettable - you will always remember it\nworth it - the reward was bigger than the cost",
    source: "Write a 150-word story about a real or imagined trip. Use the past simple for main events, past continuous for background, and past perfect for things that happened earlier. Try to include at least five chunks from the vocabulary list."
  },
  {
    title: "B1 Job Hunting Online", sub: "CV + LinkedIn", tool: "worksheet-builder", level: "B1",
    topic: "Looking for jobs on online platforms",
    vocab: "CV / résumé - one-page work history\ncover letter - letter explaining why you want the job\nposting - the job advertisement\nrecruiter - person who finds candidates\nnetwork - your professional connections\nendorsement - someone recommending you\nremote-friendly - the job allows working from home\nsoft skills - communication, teamwork, problem-solving\nrelevant experience - work that fits the job\napplicant - person applying",
    source: "Recruiters often spend less than 30 seconds on each CV. The most effective applications include clear job titles, measurable results and relevant skills. A short cover letter that mentions the company by name and explains your real motivation can move you from the maybe pile to the interview list."
  },
  {
    title: "B1 Social Media Habits", sub: "screen time + sleep", tool: "discussion", level: "B1",
    topic: "Your relationship with social media",
    vocab: "scroll - move down a screen with your thumb\nnotification - an alert from an app\ndoomscrolling - scrolling through bad news\ncompare yourself - measure yourself against others\ncurated - carefully chosen to look good\ndetox - take a break from\nattention span - how long you can focus\nfeed - the stream of posts you see\nmute - turn off notifications\nunfollow - stop seeing someone's posts",
    source: "Many people pick up their phone within minutes of waking up. The first hour is spent scrolling, comparing, and reacting. Even short, curated feeds can make us feel behind. Try a one-week detox: keep the phone in another room overnight, mute non-essential notifications, and notice the change."
  },
  {
    title: "B1 Volunteering Story", sub: "giving back", tool: "creative-writing", level: "B1",
    topic: "Volunteering and giving back",
    vocab: "volunteer - work without pay to help others\ncause - the issue you support\ncharity - an organization that helps others\nfundraise - collect money for a cause\nimpact - the effect of your actions\nlocal community - the people around you\nrewarding - giving you a good feeling\nteam up - work together\nawareness - making people understand an issue\ngive back - help your community in return",
    source: "Write 140 words about a time you helped someone or volunteered for a cause. Include: why you chose this cause, what you actually did, one surprising moment, what you learned, and one piece of advice for someone thinking of doing the same."
  },

  // ─── B2 UPPER INTERMEDIATE ────────────────────────────────────────
  {
    title: "B2 Future of Work", sub: "automation debate", tool: "discussion", level: "B2",
    topic: "How automation will change work",
    vocab: "automation - machines doing human jobs\ndisplaced - replaced or pushed out\nupskilling - learning new skills\nrepetitive - the same again and again\nproductivity boost - getting more done\noversight - human supervision\nhybrid role - a job that combines human and AI\nhallucinate - when AI invents wrong information\nbias - unfair preference in decisions\nstreamline - make a process simpler",
    source: "Most economists agree that automation will not eliminate work entirely; it will reshape it. The jobs at greatest risk are not low-skilled but repetitive. Many roles will become hybrid, where humans focus on judgment, creativity and ethics while software handles routine analysis. Upskilling will matter more than job title."
  },
  {
    title: "B2 Mental Health Talk", sub: "stress + support", tool: "discussion", level: "B2",
    topic: "Talking openly about mental health",
    vocab: "burnout - exhaustion from chronic stress\nanxiety - constant worry\nresilience - ability to recover\ncoping strategy - way of dealing with stress\nseek help - look for support\nstigma - shame attached to a topic\ncheck in on - ask how someone is\nset boundaries - protect your time and energy\nself-care - looking after your well-being\nreach out - contact someone for help",
    source: "Mental health is finally part of the workplace conversation. Companies that talk openly about stress and burnout, train managers to spot warning signs and make it easy to seek help see lower turnover and stronger teams. The biggest barrier is no longer access - it's stigma."
  },
  {
    title: "B2 Climate Action", sub: "personal vs systemic", tool: "discussion", level: "B2",
    topic: "What individuals and governments can do",
    vocab: "carbon footprint - your personal CO2 emissions\noffset - balance out emissions by doing something else\nrenewable - energy that doesn't run out\nphase out - gradually stop using\nincentivise - give a reason to act\nlegislation - laws\ngreenwashing - false eco-friendly claims\ntransition - the process of changing\nbottom-up - led by citizens\ntop-down - led by governments",
    source: "Two camps dominate the climate conversation. One says individuals should change their daily habits - diet, travel, consumption. The other argues that without legislation and corporate accountability, individual change is too slow. The honest answer is both: bottom-up pressure makes top-down policy possible."
  },
  {
    title: "B2 Remote vs Office Work", sub: "hybrid debate", tool: "discussion", level: "B2",
    topic: "Where should work happen",
    vocab: "collaboration - working together\nasync - not at the same time\npresenteeism - being seen at the desk to look busy\nhot-desking - sharing desks\nwork-life balance - time for work and life\nflexibility - freedom to choose how and when\ncommute - travel to work\nbelonging - feeling part of a team\nhybrid - a mix of home and office\nproductivity - how much useful work you do",
    source: "Studies on remote work give mixed results. Productivity often goes up, but innovation and onboarding suffer. Hybrid models try to keep the best of both, but require strong async habits and trust. The future is less about location and more about clear outcomes."
  },
  {
    title: "B2 Generation Gap", sub: "Gen Z vs millennials", tool: "discussion", level: "B2",
    topic: "Generations at work and at home",
    vocab: "generational divide - clear differences between age groups\nvalue - what is important to a person\nwork ethic - attitude towards work\nentitled - feeling you deserve special treatment\nside hustle - a small job alongside the main job\nfinancial security - feeling safe about money\nstability - a steady, predictable life\nhustle culture - the belief that you should always work hard\nauthenticity - being yourself, not pretending\nmeaningful work - work that has purpose",
    source: "Each generation defines work success differently. Millennials grew up valuing stability and salary; Gen Z places equal weight on meaning, mental health and flexibility. Calling either generation \"lazy\" or \"entitled\" misses the point - they're responding to different economic realities."
  },
  {
    title: "B2 Travel & Culture Shock", sub: "abroad adjustments", tool: "creative-writing", level: "B2",
    topic: "Experiencing culture shock",
    vocab: "culture shock - feeling lost in a new culture\nadjust - get used to something new\nhomesick - missing your home\noverwhelmed - too much to handle\nblend in - look like a local\nstand out - look different\nexpat - a person living in another country\nunwritten rule - cultural norm not spoken aloud\ndive in - start fully\nopen-minded - ready to accept new ideas",
    source: "Write a 180-word reflection on a real or imagined experience of culture shock. Cover: the honeymoon phase, the frustration phase, what you adjusted to, what you couldn't, and one thing the new culture taught you about your own."
  },
  {
    title: "B2 Smart Cities", sub: "tech + urban life", tool: "worksheet-builder", level: "B2",
    topic: "How technology is changing cities",
    vocab: "infrastructure - the basic systems of a city\nsensor - device that detects something\nreal-time - happening right now\ndata-driven - based on data\ncongestion - too much traffic\nsmart grid - flexible electricity network\nsustainable - able to last without harming the environment\nautonomous - self-driving\ninclusive - fair for everyone\nresilient - able to recover from problems",
    source: "Smart cities use sensors and real-time data to manage traffic, energy and waste. The promise is huge: less congestion, lower emissions, faster emergency response. The risk is also real: who owns the data, who decides what's optimized, and how do we keep cities inclusive rather than profitable?"
  },
  {
    title: "B2 Privacy Online", sub: "data + tracking", tool: "discussion", level: "B2",
    topic: "Online privacy and personal data",
    vocab: "tracking - following your online activity\ndata harvest - collecting personal information\nopt out - choose to stop\nthird party - someone outside the main service\nencrypted - secured so others cannot read\nconsent - permission you give\nfingerprint - unique identification\nbreach - when data is stolen\nanonymous - without your name\ntargeted ad - advertising chosen for you specifically",
    source: "Every time you click \"Accept all\", you trade comfort for data. Tech companies argue this powers personalised, useful services. Critics point out the asymmetry: users can't fully understand what they consent to, and breaches expose data they never knew was collected. The middle ground is informed consent - but it's still rare."
  },
  {
    title: "B2 Influencer Culture", sub: "fame + ethics", tool: "discussion", level: "B2",
    topic: "The world of online influencers",
    vocab: "follower - person who subscribes to a feed\nengagement - likes, comments and shares\nsponsored - paid by a brand\ndisclose - admit publicly\nauthenticity - being genuine\nparasocial - one-sided relationship\nbranding - building a personal image\nclickbait - sensational title to attract clicks\nmonetize - turn something into money\nshelf life - how long fame lasts",
    source: "Influencers can build careers from nothing, but the system rewards constant content, controversy and curation over depth. Sponsored posts must be disclosed, but laws differ. The most successful influencers treat their audience as readers, not metrics - and protect their off-screen life."
  },
  {
    title: "B2 Tourism Impact", sub: "overtourism debate", tool: "discussion", level: "B2",
    topic: "Tourism, locals and the environment",
    vocab: "overtourism - too many tourists in one place\nlocal economy - businesses owned by residents\ncultural erosion - losing original culture\nshort-term rental - apartments rented to tourists\nfootfall - number of visitors\nseasonal - happening in certain months\nresponsible travel - travelling without harm\nauthentic - real, not made for tourists\nrevenue - money earned\ncarrying capacity - how many visitors a place can handle",
    source: "Popular cities are starting to push back against tourism. Locals lose flats to short-term rentals, businesses adapt to visitors instead of residents, and famous sites are overcrowded. Some cities cap visitor numbers; others charge tourist taxes. The goal isn't fewer travelers - it's better ones."
  },
  {
    title: "B2 Vegan Diet Debate", sub: "ethics + nutrition", tool: "discussion", level: "B2",
    topic: "Is going vegan the answer",
    vocab: "plant-based - made from plants\nethics - ideas about right and wrong\nfactory farming - large-scale industrial farming\nnutrient - vitamin or mineral\nsupplement - extra vitamin in pill form\nflexitarian - mostly plants but sometimes meat\nemissions - polluting gases\ndairy - milk products\nlocal produce - food grown nearby\nfood system - how food gets from farm to plate",
    source: "Plant-based diets cut emissions and animal suffering, but \"vegan\" doesn't automatically mean ethical or healthy. Importing avocados across the world has its own footprint. A flexitarian approach - mostly plants, occasional ethically-sourced meat or dairy - may be more realistic than full veganism for many."
  },

  // ─── C1 ADVANCED ──────────────────────────────────────────────────
  {
    title: "C1 Tech Ethics", sub: "bias + accountability", tool: "essential-vocab", level: "C1",
    topic: "Technology ethics and bias",
    vocab: "algorithmic bias - unfair patterns in AI decisions\naccountability - clear responsibility\nopacity - lack of transparency\nblack box - system whose decisions can't be inspected\nfair use - balanced and just\ndata provenance - where data came from\ndue diligence - careful checking\nautomated decision - choice made without humans\nstakeholder - person affected by decisions\nregulatory framework - the system of rules",
    source: "AI systems trained on biased data inherit and amplify that bias. Even when models are technically accurate, automated decisions can cause real harm in hiring, lending and criminal justice. Calls for regulation are rising, but enforcement is hard when the systems themselves are opaque."
  },
  {
    title: "C1 Cancel Culture", sub: "speech + accountability", tool: "discussion", level: "C1",
    topic: "Accountability, free speech and online justice",
    vocab: "cancel - publicly reject a person or brand\ncall out - publicly point out wrong behaviour\nproportionate - matching the seriousness\nmob mentality - acting as part of an angry crowd\nlive in receipts - bring up old evidence\nstatute of limitations - time limit\nplatform - the audience or place where you speak\nde-platform - remove someone's voice\npublic apology - saying sorry publicly\nredemption - earning back trust",
    source: "Calling out harmful behaviour is not new, but the speed and scale of online accountability are. Critics see a culture that punishes rather than corrects, with little room for proportionate response or genuine redemption. Defenders see a long-overdue rebalance of power. Both sides agree the conversation about consequences is here to stay."
  },
  {
    title: "C1 Universal Basic Income", sub: "economic policy", tool: "discussion", level: "C1",
    topic: "UBI as a policy tool",
    vocab: "universal - given to everyone\nmeans-tested - given only to those below a threshold\ndisincentive - reason not to do something\nlabour market - the world of jobs\nfiscal cost - cost to public budgets\ninflation - rising prices\npilot - small test of a policy\nautomation - machines replacing workers\nsafety net - support for people in need\nstipend - regular payment",
    source: "Universal Basic Income would give every adult a regular stipend regardless of work. Supporters argue it cushions the labour market against automation and reduces poverty. Critics warn of inflation, fiscal cost and disincentives to work. Pilots in Finland, Kenya and the US show that the effects depend more on amount and duration than ideology."
  },
  {
    title: "C1 Misinformation", sub: "media literacy", tool: "essential-vocab", level: "C1",
    topic: "Misinformation, disinformation and trust",
    vocab: "misinformation - wrong information shared by mistake\ndisinformation - wrong information shared on purpose\nverify - check that something is true\nfact-check - investigate a claim\nsource - where information came from\ncross-reference - check multiple sources\ndeepfake - realistic fake video or audio\ngaslighting - making someone doubt their reality\nepistemic bubble - only hearing similar views\ncredibility - trustworthiness",
    source: "Distinguishing misinformation from disinformation matters: one is human error, the other is strategic. Deepfakes and AI-generated text mean we can no longer trust what we see. Media literacy - verifying sources, cross-referencing, and noticing emotional triggers - is becoming as essential as basic reading."
  },
  {
    title: "C1 Soft Power", sub: "diplomacy + culture", tool: "essential-vocab", level: "C1",
    topic: "Soft power in international relations",
    vocab: "soft power - influence through culture and values\nhard power - influence through force or money\ndiplomacy - managing relations between countries\nbilateral - between two countries\nmultilateral - among many countries\nsanction - economic punishment\ncultural export - films, music, food\npublic perception - how people see a country\ninfluence - power to affect others\nleverage - advantage you can use",
    source: "Soft power describes a country's ability to attract rather than coerce. Cultural exports, education systems, foreign aid and diaspora communities all contribute. Soft power can't be bought quickly, but once eroded - by hypocrisy, broken promises or scandal - it's the hardest form of influence to rebuild."
  },
  {
    title: "C1 Cryptocurrency", sub: "value + risk", tool: "discussion", level: "C1",
    topic: "Cryptocurrency, blockchain and value",
    vocab: "decentralised - not controlled by one organisation\nblockchain - shared digital ledger\nvolatile - changing price quickly\nspeculation - buying for future profit\nfiat currency - traditional government money\nregulation - government rules\nwallet - place to keep crypto\nmining - validating transactions\ntoken - a unit of crypto\nstore of value - something that keeps its worth",
    source: "Cryptocurrency promised decentralised money, fast transactions and freedom from central banks. The reality has been more volatile: massive speculation, headline frauds and unclear regulation. Whether crypto becomes everyday infrastructure or a niche store of value depends less on technology and more on trust and law."
  },
  {
    title: "C1 Workplace Equality", sub: "DEI in practice", tool: "discussion", level: "C1",
    topic: "Diversity, equity and inclusion at work",
    vocab: "diversity - different backgrounds and identities\nequity - giving each person what they need\ninclusion - making everyone feel they belong\nrepresentation - who you see in roles\nglass ceiling - invisible barrier to promotion\nallyship - support across differences\nmicroaggression - small recurring slight\ntokenism - hiring one person to look diverse\nstructural - built into the system\nmeritocracy - the belief that effort always wins",
    source: "DEI work shifts from headcount to systems: how decisions are made, who gets feedback, who is mentored. Tokenism - hiring one person and considering the work done - backfires. The most effective programs combine clear data, structural reviews of promotions, and personal accountability from senior leaders."
  },
  {
    title: "C1 Bioethics & Editing", sub: "CRISPR + limits", tool: "essential-vocab", level: "C1",
    topic: "Bioethics in the age of gene editing",
    vocab: "germline - genes passed to children\nsomatic - genes only in one body\nconsent - informed agreement\nslippery slope - one change leads to others\nclinical trial - careful medical test\nunintended consequence - unexpected effect\nmoratorium - temporary stop\nenhancement - making someone above average\nheritable - passed to descendants\nprecautionary principle - act carefully when risk is uncertain",
    source: "Gene editing has gone from theoretical to routine in less than a decade. Treating genetic diseases is broadly welcomed. Editing embryos to enhance traits is not. The line between treatment and enhancement is blurry, the consequences are heritable, and the conversation about who decides has barely begun."
  },

  // ─── EXAM PREP ────────────────────────────────────────────────────
  {
    title: "IELTS Writing Task 1", sub: "chart description", tool: "worksheet-builder", level: "B2",
    topic: "Describing a bar chart in 150 words",
    vocab: "overall - in general\ntrend - direction of change\nfluctuate - go up and down\npeak - the highest point\ndip - small decrease\nplateau - period of no change\ngradual - slow and steady\nsharp - sudden and big\nrespectively - in the same order\nin contrast - showing a difference",
    source: "Describe a bar chart showing the percentage of households with broadband internet in three countries between 2010 and 2024. Cover: overall trend, the country with the highest and lowest figures, one sharp increase, one comparison, and a closing summary sentence."
  },
  {
    title: "IELTS Writing Task 2", sub: "opinion essay", tool: "creative-writing", level: "B2",
    topic: "Should governments tax sugary drinks",
    vocab: "argue - say with reason\ndeterrent - something that stops behaviour\ninfringe - limit a right\nproportional - matching the size\ndisproportionate - too large\nincentive - reason to act\nimpose - force a rule\npublic health - the population's health\nmoderation - not too much\noverreach - going too far",
    source: "Write a 250-word essay. Some governments tax sugary drinks to reduce health problems. To what extent do you agree? Discuss both arguments, include one real-world example, and give a clear final opinion supported by reasons."
  },
  {
    title: "IELTS Speaking Part 3", sub: "follow-up discussion", tool: "discussion", level: "B2",
    topic: "Education in the future",
    vocab: "hands-on - involving real practice\nlife-long learning - learning all your life\ncredential - official qualification\nupskill - learn new work skills\nself-paced - at your own speed\ncritical thinking - careful independent judgement\nrelevant - useful for the situation\nadapt - change to fit\ngap year - one year between studies\nschool of thought - way of thinking",
    source: "Examiner questions: Do you think traditional schools will still exist in 30 years? Should children learn coding from primary school? Is it better to specialise early or stay broad? Practise giving 30-second answers with examples and personal experience."
  },
  {
    title: "TOEFL Integrated", sub: "read + listen + write", tool: "worksheet-builder", level: "B2",
    topic: "Comparing a reading and a lecture",
    vocab: "main idea - central point\nsupporting detail - evidence\nrefute - disprove\ndemonstrate - clearly show\nillustrate - give an example of\nperspective - point of view\nfindings - what was discovered\nreliable - trustworthy\nflaw - weakness\nimplication - what something suggests",
    source: "Reading passage: Researchers in California believe humans can hibernate like bears. Lecture: A biologist argues this misunderstands hibernation entirely - humans can lower body temperature briefly, but not metabolism. The student must summarise how the lecture casts doubt on the reading."
  },
  {
    title: "Cambridge B2 First", sub: "reading + use of english", tool: "abcd-text", level: "B2",
    topic: "Reading Part 5 - multiple choice",
    vocab: "imply - hint at without saying directly\ninfer - deduce from clues\nstance - position or attitude\nconvey - communicate a feeling\nstandpoint - point of view\nundermine - weaken\noverstate - exaggerate\nemphasise - make important\nperspective - the writer's viewpoint\ntone - the feeling of the text",
    source: "A short article (250 words) about the rise of paper books despite the digital era. Students answer six four-option questions covering the writer's tone, an inference, a vocabulary in context, the main idea of paragraph two, the writer's attitude, and a paraphrase."
  },
  {
    title: "Cambridge C1 Advanced", sub: "writing review", tool: "creative-writing", level: "C1",
    topic: "Writing a 220-280 word review",
    vocab: "compelling - holds attention strongly\nstand-out - particularly impressive\nnuanced - subtle and complex\nrefreshing - pleasantly new\noverhyped - praised more than it deserves\nuneven - inconsistent\nresonate - feel meaningful\nset apart - make distinct\nfall short of - not reach\nworth a watch / read - deserves your time",
    source: "Write a 220-280 word review of a recent book or series for a student magazine. Include: a brief description without spoilers, what makes it stand out, a balanced critique with at least one weakness, and a clear recommendation with a target audience."
  },
  {
    title: "TOEFL Independent Writing", sub: "personal opinion", tool: "creative-writing", level: "B2",
    topic: "Is it better to study alone or in a group",
    vocab: "concentration - ability to focus\nstimulating - making you think\ndistraction - something that takes attention away\naccountability - being responsible to others\nperspective - different point of view\nautonomy - independence\nshared knowledge - knowledge from a group\nintroverted - prefers being alone\nextroverted - prefers being with people\nhybrid - both styles",
    source: "Write a 300-word essay. Do you prefer studying alone or in a group? Take a clear position, support it with two examples (one personal, one general), acknowledge the other view briefly, and end with a strong restatement."
  },

  // ─── BUSINESS ENGLISH ─────────────────────────────────────────────
  {
    title: "Biz: Standup Meeting", sub: "daily team updates", tool: "dialogue", level: "B1",
    topic: "Running a daily standup",
    vocab: "blocker - something stopping progress\nyesterday - day before\nstandup - short daily meeting\nupdate - news about progress\non track - going as planned\nbehind schedule - later than planned\nbandwidth - capacity to do work\nfollow up - check again later\nloop in - include in a conversation\nsync - meet to align",
    source: "Standups should last 15 minutes. Each person answers three questions: what I did yesterday, what I'll do today, what blockers I have. Avoid long discussions - log them for after the standup. The goal is alignment, not deep problem-solving."
  },
  {
    title: "Biz: Email Etiquette", sub: "tone + formality", tool: "worksheet-builder", level: "B1",
    topic: "Writing professional emails",
    vocab: "subject line - the title of the email\nsalutation - the opening greeting\nbody - the main content\nclosing - the ending\nattach - send a file with the email\nfollow up - send a reminder\nlooping in - adding someone to the conversation\nfor your reference - so you know\nlooking forward to - waiting eagerly\nbest regards - polite closing",
    source: "A good professional email has a clear subject line, a one-line opening that respects the reader's time, a body of two-three short paragraphs, and a single clear request or next step. Tone should match the relationship - formal with new clients, friendly with regular colleagues."
  },
  {
    title: "Biz: Negotiation", sub: "asking for a deal", tool: "dialogue", level: "B2",
    topic: "Negotiating a deal politely",
    vocab: "negotiate - discuss to reach an agreement\nleverage - advantage in a deal\ncompromise - both sides give something\nwalk away - leave the deal\nbottom line - the lowest you accept\nwin-win - both sides happy\nput on the table - propose\nground - position\nconcession - thing you give up\nleeway - flexibility to move",
    source: "\"We'd like to extend our contract, but the current price is hard to justify this year.\" \"I appreciate the honesty. We can offer a 7% discount on a two-year commitment. Where's your bottom line?\" \"We were hoping for 12%. Could we meet at 10% with flexible payment terms?\""
  },
  {
    title: "Biz: Presentation Skills", sub: "structure + delivery", tool: "worksheet-builder", level: "B2",
    topic: "Giving a clear business presentation",
    vocab: "audience - the people listening\nhook - opening that grabs attention\nagenda - the plan of the talk\ntakeaway - main message\nvisual - chart or image\nbullet point - short item\nfiller word - um, like, you know\npacing - speed of speech\nQ&A - questions and answers\nstrong close - powerful ending",
    source: "Strong presentations open with a hook, name a clear takeaway in the first minute, use a maximum of three points, support each with one visual or example, and end with a strong close. Filler words are the silent killer - replacing them with pauses builds authority."
  },
  {
    title: "Biz: Project Update", sub: "status report", tool: "worksheet-builder", level: "B2",
    topic: "Sharing a clear project update",
    vocab: "status - the current state\nmilestone - important point reached\ndeliverable - expected result\nstakeholder - person involved\nrisk - possible problem\nmitigation - plan to reduce risk\nat risk - in danger\non track - going to plan\nscope - what is included\nscope creep - work growing without planning",
    source: "Effective project updates use four sections: what was completed, what's next, what's at risk, and where help is needed. Avoid burying problems - surfacing risks early gives stakeholders time to react. End with one clear ask, not five vague ones."
  },

  // ─── PHRASAL VERBS & IDIOMS ──────────────────────────────────────
  {
    title: "Phrasal Verbs: Travel", sub: "set off, check in...", tool: "essential-vocab", level: "B1",
    topic: "Phrasal verbs for travelling",
    vocab: "set off - start a journey\ncheck in - register at a hotel or airport\ndrop off - leave someone or something\npick up - collect someone\nstop over - break a journey\nget around - travel within a place\nrun late - be later than planned\nput up at - stay at a hotel\ntake off - leave the ground (plane)\nstop by - visit briefly",
    source: "Write five sentences about a recent trip using at least five phrasal verbs from the list. Try to use them naturally, not in a list. Example: \"We set off at six, checked in at the hotel by ten, and then stopped by my aunt's place before dinner.\""
  },
  {
    title: "Phrasal Verbs: Work", sub: "carry out, follow up...", tool: "essential-vocab", level: "B1",
    topic: "Phrasal verbs for work and projects",
    vocab: "carry out - perform a task\nfollow up - check again later\ncatch up - reach the same level\nfall behind - be slower than expected\ntake over - start managing\nput off - postpone\nbring up - mention something\nfigure out - solve\nrun into - meet a problem\nset up - prepare or organise",
    source: "Pairs interview each other: When did you last carry out a difficult task? Have you ever fallen behind on a project? What helped you catch up? Use at least four phrasal verbs naturally in each answer."
  },
  {
    title: "Idioms: Money", sub: "common expressions", tool: "essential-vocab", level: "B2",
    topic: "Idioms about money",
    vocab: "tighten your belt - spend less\nlive paycheck to paycheck - earn just enough\nbreak the bank - cost a lot\ncost a small fortune - very expensive\non a shoestring - on a very small budget\ncut corners - save money in a careless way\nrolling in money - very rich\nin the red - in debt\nin the black - having profit\nbring home the bacon - earn the main income",
    source: "Useful when discussing personal finance or business. Practice: rephrase the following plain sentences using an idiom. 1) \"They have a lot of debt.\" 2) \"We have to spend less this year.\" 3) \"The trip won't be expensive.\" 4) \"She earns a great salary.\""
  },
  {
    title: "Idioms: Body Parts", sub: "high-frequency", tool: "essential-vocab", level: "B1",
    topic: "Idioms using parts of the body",
    vocab: "pull your leg - joke with you\nkeep an eye on - watch carefully\ncost an arm and a leg - very expensive\nrack your brains - think hard\nface the music - accept consequences\nlend a hand - help\ngive someone the cold shoulder - ignore them\nlose your head - panic\nbite your tongue - stop yourself from speaking\nput your foot in it - say the wrong thing",
    source: "Create a short funny story (80 words) about a difficult day using at least five idioms from the list. Read it to a partner. Partner should identify which idioms you used and what they mean in context."
  },

  // ─── KIDS / YOUNG LEARNERS ───────────────────────────────────────
  {
    title: "Kids: My Family Tree", sub: "family + simple sentences", tool: "essential-vocab", level: "A1",
    topic: "Drawing a family tree",
    vocab: "tree - drawing of family connections\nmum - mother\ndad - father\nbrother - boy with same parents\nsister - girl with same parents\ngrandma - mother of mum or dad\ngrandpa - father of mum or dad\nbaby - very young child\nfamily - all the people related to you\nphoto - picture",
    source: "Kids draw their family tree on paper. They label each person with a name and one adjective: \"My mum is kind. My dad is funny. My little sister is loud. My grandma is wise.\""
  },
  {
    title: "Kids: Toys & Colors", sub: "what's your favourite", tool: "word-image-match", level: "A1",
    topic: "Toys and favourite colours",
    vocab: "doll - a toy person\nball - round toy\nteddy bear - soft toy bear\nrobot - mechanical toy\npuzzle - many pieces you join\ncar - small toy vehicle\nbike - two wheels\nkite - toy you fly\nfavourite - the one you love most\nplay with - have fun with a toy",
    source: "\"What's your favourite toy?\" \"My favourite toy is my red robot.\" \"Mine is a blue bike.\" \"I have a yellow kite and a purple puzzle.\" Class makes a chart of favourites."
  },
  {
    title: "Kids: Can / Can't", sub: "abilities", tool: "essential-vocab", level: "A1",
    topic: "What I can and can't do",
    vocab: "swim - move in water\nrun fast - go quickly on legs\nride a bike - travel on two wheels\nclimb a tree - go up a tree\nsing - make music with your voice\ndance - move to music\ncount - say numbers in order\nspell - say letters in a word\ntie shoelaces - join shoe strings\nride a horse - sit on a horse and travel",
    source: "Mini-survey. Each child asks 5 classmates: \"Can you swim?\" \"Can you climb a tree?\" \"Can you tie your shoelaces?\" Then makes a tiny chart with names and ticks/crosses."
  },
  {
    title: "Teens: Smartphones at School", sub: "for vs against", tool: "discussion", level: "B1",
    topic: "Should phones be allowed in class",
    vocab: "ban - not allow\nstrict - serious about rules\nresearch - careful study\nrelevant - useful for the situation\ndistracted - paying attention to something else\nresponsibility - what you should do\ncheat - act unfairly\nlooking up - searching for information\nrule - what you must follow\nenforce - make sure the rule is followed",
    source: "Some schools ban smartphones completely. Others let students use them for research and notes. Argue for both sides. Use sentence starters: \"On one hand…\", \"On the other hand…\", \"In my opinion…\", \"That's a fair point but…\""
  },
  {
    title: "Teens: Social Media Pressure", sub: "comparison + identity", tool: "creative-writing", level: "B1",
    topic: "How social media affects teens",
    vocab: "compare - look at yourself vs others\nfilter - tool to change a photo\nlikes - approval clicks\ninfluence - power to change behaviour\nfake - not real\nidentity - who you are\npressure - feeling pushed\nbody image - how you see your body\ntrend - popular thing right now\nauthentic - true to yourself",
    source: "Write 120 words about how social media affects how you and your friends feel about yourselves. Cover one positive, one negative, and one tip you would give a younger sibling about using social media."
  }
]

const CATS = ['all','favorites','reading','vocabulary','writing','speaking','grammar','listening','utility'];
const CAT_NAMES = {all:'All',favorites:'Favorites',reading:'Reading',vocabulary:'Vocabulary',writing:'Writing',speaking:'Speaking',grammar:'Grammar',listening:'Listening',utility:'Utility'};
// Same palette as the desktop "Teaching Tools" preview window's TAG_COLORS -
// kept in sync on purpose so a card looks the same whichever surface it's on.
/* Цвета подбирались под белую карточку. Фон приложения стал песочным
   (тема из макета), тинт чипа полупрозрачный - и текст сел до 2.1-3.8:1.
   Тон оставлен прежним, светлота опущена до >=4.5:1 на песке. */
const CAT_TAG_COLORS = {
  reading:    { bg:'rgba(96,165,250,.12)',  color:'#225399' },
  writing:    { bg:'rgba(110,201,138,.14)', color:'#275E3D' },
  listening:  { bg:'rgba(245,158,11,.14)',  color:'#764A07' },
  speaking:   { bg:'rgba(167,139,250,.14)', color:'#5932C8' },
  vocabulary: { bg:'rgba(200,230,50,.20)',  color:'#4F5E00' },
  grammar:    { bg:'rgba(248,113,113,.14)', color:'#932F2F' },
  utility:    { bg:'rgba(24,24,24,.08)',    color:'#4A4B55' },
};
let currentCat = 'all';
let activeTool = null;
let lastOutput = null;
let imageRows = [];
/* Стан студії «Vocabulary Workout» стоїть тут, поруч з рештою стану сторінки:
   selectTool() скидає його при зміні інструмента, а сама студія оголошена в
   кінці файла - звідти оголошення не встигло б до першого виклику. */
let workoutBlocks = [];
let workoutBusy = false;
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}}
function writeJson(key,val){localStorage.setItem(key,JSON.stringify(val));}

// ── Local knowledge bases ──────────────────────────────────────────────────
// Built-in bases live in scripts/knowledge-bases.js. Imported bases are
// stored separately so a future app release can update the curated catalog
// without overwriting a teacher's own additions.
let activeKnowledgeBaseId = '';
let activeKnowledgeBaseLevel = 'All';
function trimKb(value,max=900){return String(value==null?'':value).trim().slice(0,max)}
function normaliseKnowledgeBase(raw, local=true){
  if(!raw||typeof raw!=='object')return null;
  const title=trimKb(raw.title,120); if(!title)return null;
  const rawId=trimKb(raw.id,80).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'');
  const titleId=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const id=rawId||titleId||`kb-${Date.now().toString(36)}`;
  const entries=Array.isArray(raw.entries)?raw.entries.slice(0,80).map(item=>({
    term:trimKb(item?.term,120),definition:trimKb(item?.definition,280),translation:trimKb(item?.translation,120),example:trimKb(item?.example,280)
  })).filter(item=>item.term):[];
  return {
    id,title,subtitle:trimKb(raw.subtitle,180),level:trimKb(raw.level,20)||'Mixed',domain:trimKb(raw.domain,60),icon:trimKb(raw.icon,8)||'KB',accent:/^#[0-9a-f]{6}$/i.test(raw.accent||'')?raw.accent:'#5b6cff',defaultTool:TOOLS.some(tool=>tool.id===raw.defaultTool)?raw.defaultTool:'lesson-pack',tags:Array.isArray(raw.tags)?raw.tags.map(tag=>trimKb(tag,32)).filter(Boolean).slice(0,10):[],entries,grammar:trimKb(raw.grammar,900),prompts:Array.isArray(raw.prompts)?raw.prompts.map(item=>trimKb(item,300)).filter(Boolean).slice(0,12):[],facts:Array.isArray(raw.facts)?raw.facts.map(item=>trimKb(item,300)).filter(Boolean).slice(0,12):[],sourceText:trimKb(raw.sourceText,2200),local:Boolean(local),updatedAt:raw.updatedAt||new Date().toISOString()
  };
}
function builtInKnowledgeBases(){return (Array.isArray(window.TEACHEDOS_KNOWLEDGE_BASES)?window.TEACHEDOS_KNOWLEDGE_BASES:[]).map(item=>normaliseKnowledgeBase(item,false)).filter(Boolean)}
function customKnowledgeBases(){const stored=readJson(KNOWLEDGE_BASE_STORE,[]);return (Array.isArray(stored)?stored:[]).map(item=>normaliseKnowledgeBase(item,true)).filter(Boolean)}
function allKnowledgeBases(){
  const map=new Map(builtInKnowledgeBases().map(item=>[item.id,item]));
  customKnowledgeBases().forEach(item=>map.set(item.id,item));
  return [...map.values()];
}
function activeKnowledgeBase(){return activeKnowledgeBaseId?allKnowledgeBases().find(item=>item.id===activeKnowledgeBaseId)||null:null}
function knowledgeBaseMeta(){const base=activeKnowledgeBase();return base?{knowledgeBaseId:base.id,knowledgeBaseTitle:base.title}:{}
}
function kbVocabText(base){return base.entries.map(item=>`${item.term} - ${item.definition}${item.translation?` / ${item.translation}`:''}${item.example?`\n  Example: ${item.example}`:''}`).join('\n')}
function kbSourceText(base){
  const parts=[base.sourceText,base.grammar?`Language focus: ${base.grammar}`:'',base.prompts.length?`Classroom prompts:\n${base.prompts.map((item,index)=>`${index+1}. ${item}`).join('\n')}`:'',base.facts.length?`Teacher notes:\n${base.facts.map((item,index)=>`${index+1}. ${item}`).join('\n')}`:''].filter(Boolean);
  return parts.join('\n\n');
}
function renderKnowledgeBaseLevels(){
  const el=document.getElementById('knowledge-base-levels');if(!el)return;
  const levels=['All','A1','A2','B1','B2','C1','Exam','Kids'];
  el.innerHTML=levels.map(level=>`<button class="kb-level ${activeKnowledgeBaseLevel===level?'active':''}" type="button" onclick="setKnowledgeBaseLevel('${level}')">${level}</button>`).join('');
}
function setKnowledgeBaseLevel(level){activeKnowledgeBaseLevel=level;renderKnowledgeBaseLevels();renderKnowledgeBases()}
function kbMatchesLevel(base,level){
  if(level==='All')return true;
  if(level==='Exam')return /ielts|toefl|exam|cambridge/i.test(`${base.title} ${base.tags.join(' ')}`);
  if(level==='Kids')return /kids|children|young/i.test(`${base.title} ${base.tags.join(' ')}`);
  return String(base.level||'').toUpperCase().startsWith(level);
}
function renderKnowledgeBases(){
  const grid=document.getElementById('knowledge-bases-grid');if(!grid)return;
  const query=(document.getElementById('knowledge-base-search')?.value||'').toLowerCase().trim();
  const list=allKnowledgeBases().filter(base=>kbMatchesLevel(base,activeKnowledgeBaseLevel)).filter(base=>{
    if(!query)return true;
    const hay=[base.title,base.subtitle,base.level,base.domain,...base.tags,...base.entries.map(item=>`${item.term} ${item.definition}`)].join(' ').toLowerCase();
    return hay.includes(query);
  });
  const countEl=document.getElementById('knowledge-base-count');
  const terms=list.reduce((total,base)=>total+base.entries.length,0);
  if(countEl)countEl.textContent=list.length?`${list.length} packs · ${terms} terms available offline`:'No packs match this filter';
  /* Секція згорнута, тож лічильник дублюється в підпис: інакше згортання
     читається як «паків більше немає». */
  const hintEl=document.getElementById('knowledge-base-summary-hint');
  if(hintEl)hintEl.innerHTML=list.length
    ? `<span class="kb-summary-count">${list.length} packs · ${terms} terms</span> reusable offline packs - load one into any tool`
    : 'No packs match this filter';
  if(!list.length){grid.innerHTML='<div class="kb-empty">No knowledge bases match this search. Import a JSON pack or clear the filter.</div>';return}
  grid.innerHTML=list.map(base=>{
    const entryCount=base.entries.length;
    const tags=base.tags.slice(0,3).map(tag=>`<span>${esc(tag)}</span>`).join('');
    const localLabel=base.local?'Local':'Built-in';
    return `<article class="kb-card" style="--kb-accent:${esc(base.accent)}"><div class="kb-card-top"><div class="kb-card-icon" aria-hidden="true">${esc(base.icon)}</div><div><h3>${esc(base.title)}</h3><span class="kb-card-level">${esc(base.level)} · ${esc(base.domain||'TeachEd')}</span></div></div><p>${esc(base.subtitle||'Vocabulary, language focus and classroom prompts.')}</p><div class="kb-card-tags">${tags}</div><div class="kb-card-footer"><button class="btn sm lime" type="button" data-kb-action="use" data-kb-id="${esc(base.id)}">Use in tool</button>${base.local?'<button class="btn sm ghost" type="button" data-kb-action="remove" data-kb-id="'+esc(base.id)+'">Remove</button>':''}<span class="kb-card-source">${localLabel} · ${entryCount} terms</span></div></article>`;
  }).join('');
  grid.querySelectorAll('[data-kb-action]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.getAttribute('data-kb-id');
    if(button.getAttribute('data-kb-action')==='remove')removeKnowledgeBase(id);else applyKnowledgeBase(id);
  }));
}
function applyKnowledgeBase(id){
  const base=allKnowledgeBases().find(item=>item.id===id);if(!base)return;
  activeKnowledgeBaseId=base.id;
  selectTool(base.defaultTool||'lesson-pack');
  setTimeout(()=>{
    const levelEl=document.getElementById('level'),topicEl=document.getElementById('topic'),vocabEl=document.getElementById('vocab'),sourceEl=document.getElementById('source');
    if(levelEl&&[...levelEl.options].some(option=>option.value===base.level))levelEl.value=base.level;
    if(topicEl)topicEl.value=base.title;
    if(vocabEl)vocabEl.value=kbVocabText(base);
    if(sourceEl)sourceEl.value=kbSourceText(base);
    saveActiveDraft();
    toast(`Knowledge base loaded: ${base.title}`);
  },60);
}
function saveCurrentKnowledgeBase(){
  if(!activeTool){toast('Choose a tool and fill its inputs first');return}
  const suggested=(get('topic')||activeTool.title||'Local knowledge base').trim();
  const title=window.prompt('Name this local knowledge base',suggested);
  if(title===null)return;
  const cleanTitle=title.trim();if(!cleanTitle){toast('Add a name for the knowledge base');return}
  const vocabLines=lines(get('vocab')).filter(line=>!/^example\s*:/i.test(line));
  const entries=vocabItems(vocabLines.join('\n')).slice(0,80).map(item=>({term:item.word,definition:item.def,translation:'',example:''}));
  const tags=[activeTool.cat,...suggested.toLowerCase().split(/[^a-z0-9]+/).filter(word=>word.length>3).slice(0,5)];
  const base=normaliseKnowledgeBase({id:`local-${Date.now().toString(36)}`,title:cleanTitle,subtitle:`${level()} · ${activeTool.title}`,level:level(),domain:'Teacher custom',icon:'LOCAL',accent:'#5b6cff',defaultTool:activeTool.id,tags,entries,grammar:'',prompts:[],facts:[],sourceText:get('source')},true);
  if(!base){toast('Could not create this knowledge base');return}
  const map=new Map(customKnowledgeBases().map(item=>[item.id,item]));map.set(base.id,base);writeJson(KNOWLEDGE_BASE_STORE,[...map.values()].slice(0,80));activeKnowledgeBaseId=base.id;renderKnowledgeBases();toast(`Saved local knowledge base: ${base.title}`);
}
function exportKnowledgeBases(){
  const payload={format:'teached-knowledge-bases',version:1,exportedAt:new Date().toISOString(),bases:customKnowledgeBases()};
  downloadText('teached-knowledge-bases.json',JSON.stringify(payload,null,2));
  toast(customKnowledgeBases().length?'Custom knowledge bases exported':'No custom bases to export');
}
function importKnowledgeBases(event){
  const file=event.target.files&&event.target.files[0];if(!file)return;
  const reader=new FileReader();reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);const incoming=Array.isArray(parsed)?parsed:parsed?.bases;
      if(!Array.isArray(incoming))throw new Error('bad format');
      const clean=incoming.map(item=>normaliseKnowledgeBase(item,true)).filter(Boolean).slice(0,80);
      if(!clean.length)throw new Error('empty');
      const map=new Map(customKnowledgeBases().map(item=>[item.id,item]));clean.forEach(item=>map.set(item.id,item));
      writeJson(KNOWLEDGE_BASE_STORE,[...map.values()].slice(0,80));renderKnowledgeBaseLevels();renderKnowledgeBases();toast(`Imported ${clean.length} knowledge base${clean.length===1?'':'s'}`);
    }catch{toast('Could not import this knowledge base file')}
    event.target.value='';
  };reader.readAsText(file);
}
function removeKnowledgeBase(id){
  if(!confirm('Remove this local knowledge base?'))return;
  writeJson(KNOWLEDGE_BASE_STORE,customKnowledgeBases().filter(item=>item.id!==id));
  if(activeKnowledgeBaseId===id)activeKnowledgeBaseId='';
  renderKnowledgeBases();toast('Knowledge base removed');
}

// ── Perf: in-memory favorites Set - avoids 51× localStorage reads per renderTools ──
let _favSet = new Set(readJson(FAV_STORE, []));
function favs(){return [..._favSet];}
function isFav(id){return _favSet.has(id);}
function _syncFavs(){writeJson(FAV_STORE,[..._favSet]);}

// ── Perf: toolPreview cache - deterministic per tool, compute once ──
const _toolPreviewCache = new Map();
const _toolPreviewOrig = typeof toolPreview === 'function' ? toolPreview : null;

function toggleSide(){document.getElementById('side').classList.toggle('open')}
function setCategory(cat,el){currentCat=cat;document.querySelectorAll('.side-btn').forEach(b=>b.classList.remove('active'));if(el)el.classList.add('active');document.getElementById('side').classList.remove('open');renderChips();renderTools()}
function toggleFav(id,e){
  e.stopPropagation();
  const adding=!_favSet.has(id);
  if(adding) _favSet.add(id); else _favSet.delete(id);
  _syncFavs();
  // Update just the star button, not the whole grid
  const btn=document.querySelector(`.tool[data-id="${id}"] .star`);
  if(btn) btn.classList.toggle('on',adding);
  renderCounts();
  if(currentCat==='favorites') renderTools(); // need full re-render only in favorites view
  toast(adding?'Added to favorites':'Removed from favorites');
}
function renderCounts(){const counts={all:TOOLS.length,favorites:_favSet.size};TOOLS.forEach(t=>counts[t.cat]=(counts[t.cat]||0)+1);document.querySelectorAll('[data-count]').forEach(el=>el.textContent=counts[el.dataset.count]||0);document.getElementById('tool-count-pill').textContent=TOOLS.length}
function renderChips(){document.getElementById('top-chips').innerHTML=CATS.map(c=>`<button class="chip ${c===currentCat?'active':''}" type="button" onclick="setCategory('${c}', document.querySelector('[data-count=${c}]').closest('.side-btn'))">${CAT_NAMES[c]}</button>`).join('')}
function readRecentTools(){return readJson(RECENT_TOOL_STORE,[]).filter(id=>TOOLS.some(t=>t.id===id)).slice(0,6)}
function rememberRecentTool(id){
  const next=[id,...readRecentTools().filter(x=>x!==id)].slice(0,6);
  writeJson(RECENT_TOOL_STORE,next);
  renderRecentTools();
}
function renderRecentTools(){
  const wrap=document.getElementById('recent-tools-strip');
  const section=document.getElementById('recent-tools-section');
  if(!wrap||!section)return;
  const ids=readRecentTools();
  section.style.display=ids.length?'block':'none';
  wrap.innerHTML=ids.map(id=>{
    const t=TOOLS.find(x=>x.id===id);
    if(!t)return '';
    /* Плитка была одна лаймовая заливка на всё, вне зависимости от предмета -
       ряд из шести карточек читался как один нерасчленённый блок и не был
       похож на карточки основной сетки чуть ниже, у которых своя заливка на
       категорию. Берём ТУ ЖЕ палитру CAT_TAG_COLORS, которой уже покрашены
       категорийные чипы под названием: недавние инструменты визуально
       привязываются к своим карточкам в сетке, а не выглядят отдельным,
       недоделанным виджетом. */
    const c=CAT_TAG_COLORS[t.cat]||{};
    return `<button class="recent-tool" type="button" onclick="selectTool('${t.id}')"><span style="background:${c.bg||''};color:${c.color||''}">${esc(t.icon)}</span><b>${esc(t.title)}</b><small>${esc(CAT_NAMES[t.cat])}</small></button>`;
  }).join('');
}
let activePresetLevel = 'All';
const PRESET_LEVELS = ['All','A1','A2','B1','B2','C1','Exam','Biz','Kids'];
function presetMatchesLevel(p,filter){
  if(filter==='All') return true;
  if(filter==='Exam') return /^(IELTS|TOEFL|Cambridge)/.test(p.title||'');
  if(filter==='Biz')  return /^Biz/i.test(p.title||'');
  if(filter==='Kids') return /^(Kids|Teens)/i.test(p.title||'');
  return (p.level||'').toUpperCase().startsWith(filter);
}
function renderPresetLevelChips(){
  const el=document.getElementById('preset-level-chips'); if(!el) return;
  el.innerHTML=PRESET_LEVELS.map(lv=>{
    const n=lv==='All'?PRESET_PACKS.length:PRESET_PACKS.filter(p=>presetMatchesLevel(p,lv)).length;
    return `<button class="chip ${lv===activePresetLevel?'active':''}" style="min-height:30px;padding:0 10px;font-size:11.5px;" type="button" onclick="setPresetLevel('${lv}')">${lv}<span style="margin-left:6px;font-size:9px;opacity:.7;font-family:var(--mono);">${n}</span></button>`;
  }).join('');
}
function setPresetLevel(lv){
  activePresetLevel=lv;
  renderPresetLevelChips();
  renderPresetPacks();
}
function renderPresetPacks(){
  const wrap=document.getElementById('preset-strip');
  if(!wrap) return;
  const list=PRESET_PACKS.map((p,i)=>({p,i})).filter(({p})=>presetMatchesLevel(p,activePresetLevel));
  const countEl=document.getElementById('preset-count');
  if(countEl) countEl.textContent=list.length;
  /* Блок згорнутий, тож кількість дублюється в підпис - інакше згортання
     виглядає так, ніби пресетів немає. */
  const sumEl=document.getElementById('preset-summary-count');
  if(sumEl) sumEl.textContent=list.length+' presets';
  if(!list.length){
    wrap.innerHTML=`<div style="padding:18px;color:var(--muted);font-size:13px;text-align:center;width:100%;border:1px dashed rgba(24,24,24,.12);border-radius:14px;">No presets at this level yet.</div>`;
    return;
  }
  // Sort by level then title for consistent groups
  const levelOrder={A1:1,A2:2,B1:3,B2:4,C1:5};
  list.sort((a,b)=>(levelOrder[a.p.level]||9)-(levelOrder[b.p.level]||9) || a.p.title.localeCompare(b.p.title));
  wrap.innerHTML=list.map(({p,i})=>{
    const lv=(p.level||'').toUpperCase();
    /* Тот же тон, но читаемый на песке: чип красится этим цветом и своим
       же тинтом 13%, на белом фоне цвета давали 2.9-3.3:1. */
    const lvColor={A1:'#0A5429',A2:'#054E61',B1:'#0E0E10',B2:'#5311C3',C1:'#890E51'}[lv]||'#0E0E10';
    return `<button class="preset-card" type="button" onclick="applyPresetPack(${i})" style="border-left:3px solid ${lvColor};padding:11px 14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
        <span style="font:900 9px var(--mono);letter-spacing:.06em;background:${lvColor}22;color:${lvColor};padding:2px 7px;border-radius:5px;">${esc(p.level||'')}</span>
        <b>${esc(p.title)}</b>
      </div>
      <span>${esc(p.sub)}</span>
    </button>`;
  }).join('');
}
function applyPresetPack(i){const p=PRESET_PACKS[i];if(!p)return;selectTool(p.tool);setTimeout(()=>{const lvl=document.getElementById('level');const top=document.getElementById('topic');const voc=document.getElementById('vocab');const src=document.getElementById('source');if(lvl)lvl.value=p.level;if(top)top.value=p.topic;if(voc)voc.value=p.vocab;if(src)src.value=p.source||src.value;saveActiveDraft();toast('Preset loaded: '+p.title)},40)}
// ── Perf: search debounce ──
let _searchTimer = null;
function scheduleSearch(){clearTimeout(_searchTimer);_searchTimer=setTimeout(renderTools,150);}

function getVisibleTools(){
  const q=(document.getElementById('search').value||'').toLowerCase().trim();
  let list=TOOLS;
  if(currentCat==='favorites') list=list.filter(t=>_favSet.has(t.id));
  else if(currentCat!=='all')  list=list.filter(t=>t.cat===currentCat);
  if(q) list=list.filter(t=>(t.title+' '+t.desc+' '+t.cat+' '+(t.badge||'')).toLowerCase().includes(q));
  return list;
}

function _cachedToolPreview(t){
  if(!_toolPreviewCache.has(t.id)) _toolPreviewCache.set(t.id, toolPreview(t));
  return _toolPreviewCache.get(t.id);
}

function renderTools(){
  const grid=document.getElementById('tools-grid');
  const list=getVisibleTools();
  if(!list.length){grid.innerHTML='<div class="panel" style="grid-column:1/-1;padding:30px;text-align:center;color:var(--muted);">No tools match this filter.</div>';return;}
  // Use DocumentFragment to batch DOM insertion - avoids per-card reflow
  const frag=document.createDocumentFragment();
  list.forEach(t=>{
    const div=document.createElement('div');
    div.className='tool'+(activeTool&&activeTool.id===t.id?' active':'');
    div.setAttribute('role','button');
    div.setAttribute('tabindex','0');
    div.dataset.id=t.id;
    div.dataset.catkey=t.cat;
    div.setAttribute('aria-label', `${t.title}. ${t.desc}`);
    /* badge:'New'/'Pro' сидело в данных 30+ инструментов с самого начала - .tag.new
       и .tag.pro уже были готовы в CSS - но карточка их никогда не выводила. Учитель
       не мог узнать, какой инструмент свежий, а какой требует платного плана, кроме
       как открыв его и упершись в замок. Значок ничего не блокирует - это чистая
       видимость, доступ к инструментам не менялся. */
    const badgeHtml = t.badge ? `<span class="tag ${t.badge.toLowerCase()}" aria-label="${esc(t.badge)} tool">${esc(t.badge)}</span>` : '';
    const catColor = CAT_TAG_COLORS[t.cat] || {};
    const catTagHtml = `<span class="tag cat" style="background:${catColor.bg};color:${catColor.color};" aria-hidden="true">${esc(CAT_NAMES[t.cat]||t.cat)}</span>`;
    div.innerHTML=`<button class="star ${_favSet.has(t.id)?'on':''}" type="button" onclick="toggleFav('${t.id}',event)" aria-label="Favorite ${esc(t.title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.7-5 2.7.9-5.5-4-3.9 5.6-.8Z"/></svg></button><div class="tool-visual" aria-hidden="true">${esc(t.icon)}</div><div class="tool-copy"><h3>${esc(t.title)}</h3><div class="tool-tags">${catTagHtml}${badgeHtml}</div><p>${esc(t.desc)}</p><span class="tool-use">Use tool →</span></div>`;
    div.addEventListener('click',()=>selectTool(t.id));
    div.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')selectTool(t.id);});
    frag.appendChild(div);
  });
  grid.innerHTML='';
  grid.appendChild(frag);
}

function openFirstTool(){selectTool((getVisibleTools()[0]||TOOLS[0]).id);}

function selectTool(id){
  const prev=activeTool;
  activeTool=TOOLS.find(t=>t.id===id);
  if(!activeTool) return;
  ttPrefetchEngine();
  rememberRecentTool(id);
  lastOutput=null; imageRows=[]; workoutBlocks=[];
  // Perf: swap .active class on existing cards without rebuilding the grid
  if(prev&&prev.id!==id){
    const oldEl=document.querySelector(`.tool[data-id="${prev.id}"]`);
    const newEl=document.querySelector(`.tool[data-id="${id}"]`);
    if(oldEl&&newEl){oldEl.classList.remove('active');newEl.classList.add('active');}
    else renderTools(); // grid has changed (different category) - full rebuild needed
  } else if(!prev){
    renderTools();
  }
  renderForm();
  document.getElementById('workspace').classList.add('show');
  document.getElementById('active-icon').textContent=activeTool.icon;
  document.getElementById('active-title').textContent=activeTool.title;
  document.getElementById('active-desc').textContent=activeTool.desc;
  document.getElementById('result-body').innerHTML='<div class="result-empty"><div><b>Ready when you are</b><span>Fill the fields and generate the task.</span></div></div>';
  document.body.classList.remove('tt-browsing');
  document.getElementById('workspace').scrollIntoView({behavior:'smooth',block:'start'});
}
/* Phone-only: the catalog and the open tool share one column, so the back
   link just flips which of the two is on screen. It is a class on <body> and
   not a state reset on purpose - the form keeps everything typed into it. */
function backToCatalog(){
  document.body.classList.add('tt-browsing');
  const el=activeTool&&document.querySelector(`.tool[data-id="${activeTool.id}"]`);
  if(el)el.scrollIntoView({block:'center'});
}
function baseFields(extra=''){return `<div class="form-grid"><div class="field"><label class="label" for="level">Level</label><select id="level"><option>A1</option><option>A2</option><option selected>B1</option><option>B2</option><option>C1</option><option>C2</option><option>Mixed</option></select></div><div class="field"><label class="label" for="count">How many items</label><input id="count" type="number" min="3" max="50" value="12"><div class="hint">Between 3 and 50.</div></div><div class="field full"><label class="label" for="topic">Topic / grammar focus</label><input id="topic" placeholder="e.g. travel problems, present perfect, job interview"></div>${extra}</div>`}
function textArea(id,label,value='',help='',placeholder=''){return `<div class="field full"><label class="label" for="${id}">${label}</label><textarea id="${id}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>${help?`<div class="hint">${help}</div>`:''}</div>`}
function readDrafts(){return readJson(DRAFT_STORE,{})||{}}
function saveActiveDraft(){
  if(!activeTool)return;
  const form=document.getElementById('tool-form');
  if(!form)return;
  const data={updatedAt:new Date().toISOString(),fields:{}};
  form.querySelectorAll('input, textarea, select').forEach(el=>{
    if(!el.id||el.type==='file')return;
    data.fields[el.id]=el.value;
  });
  const drafts=readDrafts();
  drafts[activeTool.id]=data;
  writeJson(DRAFT_STORE,drafts);
}
let _draftTimer=null;
function scheduleDraftSave(){
  clearTimeout(_draftTimer);
  _draftTimer=setTimeout(saveActiveDraft,220);
}
function restoreToolDraft(){
  if(!activeTool)return;
  const draft=readDrafts()[activeTool.id];
  if(!draft||!draft.fields)return;
  Object.entries(draft.fields).forEach(([id,value])=>{
    const el=document.getElementById(id);
    if(el&&el.type!=='file')el.value=value;
  });
  const hint=document.createElement('div');
  hint.className='hint tt-draft-note';
  hint.textContent='Draft restored from this browser.';
  const form=document.getElementById('tool-form');
  if(form&&!form.querySelector('.tt-draft-note'))form.prepend(hint);
}
function bindToolDraftAutosave(){
  const form=document.getElementById('tool-form');
  if(!form)return;
  form.addEventListener('input',scheduleDraftSave);
  form.addEventListener('change',scheduleDraftSave);
  form.addEventListener('input',clearToolInputError);
  form.addEventListener('change',clearToolInputError);
}
function renderForm(){
  const m=activeTool.mode;
  let html='';
  if(m==='images'){
    html=`<div class="hint" style="margin-bottom:14px;background:#fff2d6;border:1px solid #ffd891;padding:12px;border-radius:16px;">Add an image and its target word for every matching pair.</div>${baseFields('')}<div class="field full"><label class="label">Image + word rows</label><div class="rows" id="image-rows"></div><button class="btn sm ghost" type="button" onclick="addImageRow()">+ Add image row</button></div>`;
  }else if(m==='pairs'){
    html=baseFields(textArea('vocab','Vocabulary pairs','','Use one pair per line: word - definition / translation.','e.g. routine - a regular way of doing things'));
  }else if(m==='translation-match'){
    html=baseFields(`<div class="field"><label class="label" for="target-lang">Translate into</label><select id="target-lang"><option>Ukrainian</option><option>Russian</option><option>Spanish</option><option>French</option><option>German</option><option>Polish</option><option>Italian</option><option>Turkish</option><option>Portuguese</option><option>Arabic</option><option>Chinese</option><option>Japanese</option><option>Korean</option><option>Other</option></select></div>${textArea('vocab','Target words','','One word per line. Add a translation after a hyphen if you need it.','e.g. apple\nbook\nhouse')}`);
  }else if(m==='error-correction'){
    html=baseFields(textArea('source','Sentences to proofread','','Paste the exact sentences students should correct. The AI keeps their context and returns a correction key.','e.g. She go to school every day.\nI have saw this film.'));
  }else if(['text-vocab','abcd','open-questions','true-false','three-titles','cefr','gap','gaps-abcd','two-options','simplify','reading-bits','type-gap','summary-gapfill','choose-summary'].includes(m)){
    html=baseFields(textArea('source','Source text','','Paste the text you want to transform.','Paste your text here...'));
  }else if(['lesson-pack','worksheet','homework'].includes(m)){
    html=baseFields(`${textArea('source','Source text / lesson brief','','Paste a text, a class goal, or a short idea.','e.g. A2 travel lesson about checking into a hotel')}${textArea('vocab','Target vocabulary','','One per line. Add a definition after a hyphen if you need it.','e.g. reservation - a booking made in advance')}`);
  }else if(m==='four-opinions'){
    html=baseFields(textArea('vocab','Lesson context and boundaries','','Describe the class, situation and desired angle. The AI uses this to make four genuinely different perspectives.','e.g. B1 teens, pair discussion about the school phone policy. Include one practical compromise.'));
  }else if(['topic-vocab','discussion','dialogue','warmup','grammar-rules','rewrite','translation','creative-writing','link-words','sentences-vocab','text-with-vocab','comm-situations','rephrase-word','find-quotes','essay-topics','lead-in','facts','pros-cons','gaps-brackets','word-bank'].includes(m)){
    html=baseFields(textArea('vocab','Target vocabulary','','One per line. Add a meaning after a hyphen if you need it.','e.g. delay - a period of waiting\nreservation - a booking'));
  }else if(m==='vocab-workout'){
    html=baseFields(
      /* Список наперед заповнювати нема чим - у вчителя вже може лежати
         збережений набір (з ігор або з попередньої студії), і передруковувати
         його заново безглуздо. Список зʼявляється лише коли є що показати:
         порожня випадайка - зайвий шум у формі. */
      workoutSavedSetsHtml()
      +textArea('vocab','Your word list','','One item per line. A meaning after a hyphen makes every activity sharper: `journey - a long trip`.','journey - a long trip\nto hoard - to keep far more than you need\nvicious cycle - a bad situation that keeps repeating')
      /* Обгортка НЕ .field навмисно: у спільному шарі стилів живе правило
         `.field label` з !important, яке робить будь-який <label> усередині
         поля мікропідписом - моно, капсом, 10px. Рядки активностей самі є
         <label> (щоб клік по тексту перемикав галочку), і всередині .field
         вони перетворювалися на нечитабельний капс. */
      +'<div class="wk-section"><span class="label">Activities</span><div class="hint">Tick everything you want built from this list. You can edit or drop any of them afterwards.</div>'
      +vocabWorkoutPickerHtml()
      /* Мова перекладу ховається за галочкою «Word-translation pairs», а не
         займає місце завжди: вона потрібна лише одній активності з дванадцяти,
         і показувати її постійно означало б поле, яке 11 разів із 12 нікому не
         потрібне. */
      +workoutTranslateLangHtml()
      +'</div>'
    );
  }else if(m==='word-order'){
    html=baseFields(textArea('source','Sentences to scramble','','Paste sentences, one per line, or a full text.','e.g. Students practise useful phrases every day.'));
  }else if(m==='matching-halves'){
    html=baseFields(textArea('vocab','Collocations or sentences','','One collocation or sentence per line. The tool splits each item into two halves.','e.g. make a decision\ntake an exam'));
  }else if(['sorting','odd'].includes(m)){
    html=baseFields(textArea('vocab','Word groups','','Use Category: word, word, word.','e.g. Food: apple, bread, cheese\nTravel: airport, ticket, luggage'));
  }else if(['media-questions','transcript'].includes(m)){
    html=baseFields(`<div class="field full"><label class="label" for="yt-link">YouTube link</label><div style="display:flex;gap:8px;flex-wrap:wrap;"><input id="yt-link" placeholder="https://www.youtube.com/watch?v=..." style="flex:1;min-width:200px;"><button class="btn sm ghost" type="button" onclick="fetchYouTube()">Fetch transcript</button></div><div class="hint" id="yt-status">Paste a YouTube link and the transcript will appear below.</div></div><div class="field full"><label class="label" for="media-file">Or upload audio/video</label><input id="media-file" type="file" accept="audio/*,video/*" onchange="transcribeUpload(this)"><div class="hint" id="stt-status">Upload a file and its transcript will appear below. Nothing leaves your device.</div></div>${textArea('source','Transcript / notes','','Paste a transcript or use one of the options above.','Paste the transcript or notes here...')}`);
  }else if(m==='add-images'){
    html=baseFields(`<div class="field full"><label class="label" for="media-file">Images</label><input id="media-file" type="file" accept="image/*" multiple></div>${textArea('source','Teaching notes','','Describe the task students should do with these images.','e.g. Students describe what they see, then compare answers in pairs.')}`);
  }else if(m==='add-video'){
    html=baseFields(`<div class="field full"><label class="label" for="video-link">Video link</label><input id="video-link" placeholder="https://..."></div>${textArea('source','Viewing focus','','Add the learning goal or viewing task.','e.g. Watch once for gist, then note three useful expressions.')}`);
  }else{
    html=baseFields(textArea('source','Text block','','Add the classroom text you want to place on the lesson or worksheet.','Paste your classroom text here...'));
  }
  const actions=(m==='vocab-workout')
    ?`<div class="hero-actions"><button class="btn lime" type="button" onclick="buildVocabWorkout()">Build the set</button><button class="btn ghost" type="button" onclick="saveWorkoutWordSet()">Save word set for games</button></div>`
    :`<div class="hero-actions"><button class="btn lime" type="button" onclick="generateSmart()">Create draft</button><button class="btn ghost" type="button" onclick="copyInputs()">Copy inputs</button></div>`;
  document.getElementById('tool-form').innerHTML=html+actions;
  if(m==='images'){addImageRow();addImageRow();addImageRow()}
  if(m==='vocab-workout')workoutSyncTranslateLang();
  restoreToolDraft();
  bindToolDraftAutosave();
}
/* Large materials benefit from a short route before the generator starts.
   It keeps the teacher in charge of the lesson arc, while the later AI request
   receives the same route as an explicit instruction. Small one-shot tools
   stay direct: adding a planning screen to a vocab list would only slow work. */
let activeLessonRoute=null;
function needsLessonRoute(){return ['lesson-pack','worksheet','homework'].includes(activeTool?.mode)}
function lessonRouteFromInputs(){
  const source=get('source');
  const words=lines(get('vocab')).map(row=>row.split(/\s[-:]\s/)[0].trim()).filter(Boolean).slice(0,5);
  const subject=topic();
  const inputStep=source.length>80
    ? 'Use the supplied source for gist, detail and language noticing.'
    : 'Model the target language with a short teacher example.';
  const vocabStep=words.length
    ? 'Recycle '+words.join(', ')+'.'
    : 'Elicit and clarify the core language for '+subject+'.';
  const steps=[
    {time:'5 min',title:'Open',text:'Activate prior knowledge and set a clear question about '+subject+'.'},
    {time:'10 min',title:'Notice',text:inputStep},
    {time:'12 min',title:'Practise',text:vocabStep},
    {time:'13 min',title:'Use it',text:'Students produce a short spoken or written response for a real audience.'},
    {time:'5 min',title:'Check',text:'Finish with one observable success check and a next step.'}
  ];
  return {topic:subject,level:level(),steps,text:steps.map(step=>`${step.time} ${step.title}: ${step.text}`).join('\n')};
}
function lessonRouteContext(){return activeLessonRoute?`Lesson route to follow:\n${activeLessonRoute.text}`:''}
function renderLessonRoute(){
  const form=document.getElementById('tool-form');
  const actions=form?.querySelector('.hero-actions');
  if(!form||!actions||!activeLessonRoute)return;
  document.getElementById('tt-lesson-route')?.remove();
  const route=document.createElement('section');
  route.id='tt-lesson-route';route.className='lesson-route';route.setAttribute('aria-label','Lesson route');
  route.innerHTML=`<div class="lesson-route-head"><div><div class="lesson-route-title">Lesson route for ${esc(activeLessonRoute.topic)}</div><div class="lesson-route-sub">${esc(activeLessonRoute.level)} level, 45 minutes. This route guides the full draft.</div></div><span class="lesson-route-badge">Ready</span></div><div class="lesson-route-steps">${activeLessonRoute.steps.map(step=>`<div class="lesson-route-step"><span class="lesson-route-time">${esc(step.time)}</span><div><b>${esc(step.title)}</b>${esc(step.text)}</div></div>`).join('')}</div>`;
  actions.before(route);
}
function prepareLessonRoute(){
  if(!validateToolInput())return;
  if(!needsLessonRoute())return generateSmart();
  activeLessonRoute=lessonRouteFromInputs();
  renderLessonRoute();
  const primary=document.querySelector('#tool-form .hero-actions .btn.lime');
  if(primary){primary.textContent='Create full draft';primary.setAttribute('onclick','generateSmart()');}
  const secondary=document.querySelector('#tool-form .hero-actions .btn.ghost');
  if(secondary){secondary.textContent='Update route';secondary.setAttribute('onclick','prepareLessonRoute()');}
  saveActiveDraft();
  toast('Route ready. Review it, then create the full draft.');
}
const renderFormBase=renderForm;
renderForm=function(){
  renderFormBase();
  activeLessonRoute=null;
  if(!needsLessonRoute())return;
  const primary=document.querySelector('#tool-form .hero-actions .btn.lime');
  if(primary){primary.textContent='Plan lesson';primary.setAttribute('onclick','prepareLessonRoute()');}
  const secondary=document.querySelector('#tool-form .hero-actions .btn.ghost');
  if(secondary){secondary.textContent='Create without plan';secondary.setAttribute('onclick','generateSmart(true)');}
};
function get(id){return document.getElementById(id)?.value?.trim()||''}
const TEXT_REQUIRED_MODES=new Set(['text-vocab','abcd','open-questions','true-false','three-titles','cefr','gap','gaps-abcd','two-options','simplify','reading-bits','type-gap','summary-gapfill','choose-summary','word-order','add-text','error-correction']);
const VOCAB_REQUIRED_MODES=new Set(['pairs','translation-match','odd','sorting','matching-halves','sentences-vocab','text-with-vocab','link-words','creative-writing','translation','comm-situations','rephrase-word','word-bank','vocab-workout']);

function clearToolInputError(){
  document.getElementById('tool-input-error')?.remove();
  document.querySelectorAll('#tool-form [aria-invalid="true"]').forEach(el=>el.removeAttribute('aria-invalid'));
}
function showToolInputError(targetId,message){
  clearToolInputError();
  const target=document.getElementById(targetId);
  const form=document.getElementById('tool-form');
  if(!form)return false;
  const note=document.createElement('div');
  note.id='tool-input-error';
  note.className='hint tt-input-error';
  note.setAttribute('role','alert');
  note.textContent=message;
  const field=target?.closest('.field');
  if(field)field.appendChild(note);else form.prepend(note);
  if(target){
    target.setAttribute('aria-invalid','true');
    target.focus({preventScroll:false});
  }
  return false;
}
function validateToolInput(){
  if(!activeTool)return false;
  const m=activeTool.mode;
  const source=get('source');
  const vocab=get('vocab');
  const topicValue=get('topic');
  const hasFile=id=>Boolean(document.getElementById(id)?.files?.length);
  if(m==='images'){
    const complete=imageRows.some(row=>row.word.trim()&&row.image);
    return complete||showToolInputError('image-rows','Add at least one image and its target word before creating a draft.');
  }
  if(['media-questions','transcript'].includes(m)){
    return source||showToolInputError('source','Fetch or paste the transcript before creating tasks from it.');
  }
  if(m==='add-images'){
    return hasFile('media-file')||showToolInputError('media-file','Choose at least one image to add.');
  }
  if(m==='add-video'){
    return get('video-link')||showToolInputError('video-link','Paste a video link before creating viewing tasks.');
  }
  if(TEXT_REQUIRED_MODES.has(m)){
    return source||showToolInputError('source','Paste the source text you want this tool to transform.');
  }
  if(VOCAB_REQUIRED_MODES.has(m)){
    return vocab||showToolInputError('vocab','Add the vocabulary or sentence material you want to use.');
  }
  if(m==='topic-vocab'){
    return topicValue||showToolInputError('topic','Add a topic before creating a vocabulary set.');
  }
  return (topicValue||source||vocab)||showToolInputError('topic','Add a topic, source text, or target vocabulary to create your draft.');
}
function lines(text){return String(text||'').split(/\n+/).map(s=>s.trim()).filter(Boolean)}
function vocabItems(text){return lines(text).flatMap(line=>line.split(/[,;]/).map(s=>s.trim()).filter(Boolean)).map(raw=>{const parts=raw.split(/\s[-:]\s/);return {word:(parts[0]||raw).trim(),def:(parts[1]||'teacher definition / translation').trim()}}).filter(x=>x.word)}
function wordsOnly(text){return vocabItems(text).map(x=>x.word)}
const MINI_DICT={
apple:{Ukrainian:'яблуко',Russian:'яблоко',Spanish:'manzana',French:'pomme',German:'Apfel',Polish:'jabłko'},
book:{Ukrainian:'книга',Russian:'книга',Spanish:'libro',French:'livre',German:'Buch',Polish:'książka'},
house:{Ukrainian:'будинок',Russian:'дом',Spanish:'casa',French:'maison',German:'Haus',Polish:'dom'},
friend:{Ukrainian:'друг',Russian:'друг',Spanish:'amigo',French:'ami',German:'Freund',Polish:'przyjaciel'},
water:{Ukrainian:'вода',Russian:'вода',Spanish:'agua',French:'eau',German:'Wasser',Polish:'woda'},
school:{Ukrainian:'школа',Russian:'школа',Spanish:'escuela',French:'école',German:'Schule',Polish:'szkoła'},
happy:{Ukrainian:'щасливий',Russian:'счастливый',Spanish:'feliz',French:'heureux',German:'glücklich',Polish:'szczęśliwy'},
work:{Ukrainian:'робота',Russian:'работа',Spanish:'trabajo',French:'travail',German:'Arbeit',Polish:'praca'},
food:{Ukrainian:'їжа',Russian:'еда',Spanish:'comida',French:'nourriture',German:'Essen',Polish:'jedzenie'},
family:{Ukrainian:'сім’я',Russian:'семья',Spanish:'familia',French:'famille',German:'Familie',Polish:'rodzina'},
time:{Ukrainian:'час',Russian:'время',Spanish:'tiempo',French:'temps',German:'Zeit',Polish:'czas'},
day:{Ukrainian:'день',Russian:'день',Spanish:'día',French:'jour',German:'Tag',Polish:'dzień'},
city:{Ukrainian:'місто',Russian:'город',Spanish:'ciudad',French:'ville',German:'Stadt',Polish:'miasto'},
money:{Ukrainian:'гроші',Russian:'деньги',Spanish:'dinero',French:'argent',German:'Geld',Polish:'pieniądze'},
teacher:{Ukrainian:'вчитель',Russian:'учитель',Spanish:'profesor',French:'professeur',German:'Lehrer',Polish:'nauczyciel'},
student:{Ukrainian:'учень',Russian:'ученик',Spanish:'estudiante',French:'étudiant',German:'Schüler',Polish:'uczeń'},
car:{Ukrainian:'машина',Russian:'машина',Spanish:'coche',French:'voiture',German:'Auto',Polish:'samochód'},
travel:{Ukrainian:'подорож',Russian:'путешествие',Spanish:'viaje',French:'voyage',German:'Reise',Polish:'podróż'},
weather:{Ukrainian:'погода',Russian:'погода',Spanish:'tiempo',French:'météo',German:'Wetter',Polish:'pogoda'},
health:{Ukrainian:'здоров’я',Russian:'здоровье',Spanish:'salud',French:'santé',German:'Gesundheit',Polish:'zdrowie'}
};
function translateWord(word,lang){const w=String(word||'').toLowerCase().trim();const e=MINI_DICT[w];return e&&e[lang]?e[lang]:''}
/* ── Topical vocabulary banks (real words + student-friendly definitions, no LLM) ── */
const TOPIC_BANK={
 travel:{keys:['travel','trip','holiday','vacation','tourist','airport','flight','journey'],words:[['airport','a place where planes take off and land'],['passport','an official document you need to travel abroad'],['luggage','the bags you take on a trip'],['ticket','proof that you paid for a journey'],['delay','when something happens later than planned'],['destination','the place you are travelling to'],['booking','an arrangement you make in advance'],['departure','the time or act of leaving'],['customs','where officials check your bags at a border'],['souvenir','an object you keep to remember a place']]},
 food:{keys:['food','eat','cook','cooking','restaurant','meal','cuisine','kitchen'],words:[['recipe','instructions for cooking a dish'],['ingredient','one of the foods used in a dish'],['vegetable','a plant grown to be eaten'],['dessert','sweet food eaten after a meal'],['flavour','the taste of food'],['boil','to cook in very hot water'],['fresh','recently made or picked, not old'],['meal','the food eaten at one time'],['snack','a small amount of food between meals'],['menu','a list of dishes in a restaurant']]},
 work:{keys:['work','job','career','office','business','employ','interview'],words:[['salary','money you are paid for your job'],['colleague','a person you work with'],['deadline','the time by which work must be finished'],['meeting','when people gather to discuss work'],['interview','a formal talk to get a job'],['skill','an ability you have learned'],['employer','a person or company that pays you to work'],['task','a piece of work to do'],['promotion','a move to a higher job position'],['schedule','a plan of when things happen']]},
 health:{keys:['health','medical','doctor','illness','fitness','body','hospital','disease'],words:[['exercise','physical activity to stay fit'],['symptom','a sign that you are ill'],['medicine','something you take to feel better'],['patient','a person who receives medical care'],['diet','the food a person usually eats'],['recover','to get better after illness'],['appointment','an arranged time to see a doctor'],['healthy','good for your body'],['injury','damage to your body'],['stress','a feeling of worry or pressure']]},
 environment:{keys:['environment','nature','pollution','climate','ecology','green','planet'],words:[['pollution','harmful substances in air, water or soil'],['recycle','to use materials again instead of throwing them away'],['climate','the usual weather of an area'],['waste','things thrown away as useless'],['energy','power used to make things work'],['protect','to keep safe from harm'],['sustainable','able to continue without harming nature'],['species','a type of animal or plant'],['reduce','to make smaller in amount'],['planet','a large body in space, like Earth']]},
 technology:{keys:['technology','tech','computer','internet','digital','software','online','gadget','phone'],words:[['device','a piece of electronic equipment'],['software','programs that run on a computer'],['screen','the flat surface that shows images'],['download','to copy data from the internet'],['password','a secret word that gives access'],['update','a newer version of software'],['network','computers connected together'],['data','information stored or sent'],['wireless','connecting without cables'],['application','a program for a particular task']]},
 education:{keys:['education','school','study','learn','classroom','university','exam','student'],words:[['lesson','a period of teaching'],['subject','an area of study, like maths'],['homework','school work done at home'],['exam','a formal test of knowledge'],['knowledge','the information and skills you have'],['grade','a mark showing how well you did'],['library','a place with books you can use'],['revise','to study again before a test'],['deadline','the time by which work must be finished'],['progress','improvement over time']]},
 family:{keys:['family','parent','child','relative','home','marriage'],words:[['relative','a member of your family'],['parent','a mother or father'],['sibling','a brother or sister'],['married','having a husband or wife'],['childhood','the time when you are a child'],['generation','people born around the same time'],['household','the people living in one home'],['responsibility','a duty you must take care of'],['support','to help someone'],['tradition','a custom passed down in a family']]},
 money:{keys:['money','finance','shopping','buy','budget','bank','price','cost','economy'],words:[['budget','a plan for spending money'],['save','to keep money for later'],['spend','to use money to buy things'],['expensive','costing a lot of money'],['cheap','costing little money'],['afford','to have enough money for something'],['discount','a reduction in price'],['borrow','to take money you will return'],['bill','a paper showing money you must pay'],['income','the money you earn']]},
 hobbies:{keys:['hobby','hobbies','free time','leisure','sport','music','art','game','pastime'],words:[['hobby','an activity you do for fun'],['collect','to gather things of one kind'],['painting','creating pictures with paint'],['gardening','growing plants as a hobby'],['photography','taking photos as a hobby'],['instrument','an object used to play music'],['relax','to rest and enjoy yourself'],['creative','good at making new things'],['outdoor','happening outside'],['talent','a natural ability to do something well']]},
 weather:{keys:['weather','rain','sun','temperature','forecast','season','snow'],words:[['forecast','a report of future weather'],['temperature','how hot or cold it is'],['storm','strong wind with rain'],['humid','having a lot of moisture in the air'],['freezing','very cold'],['sunny','with bright sun'],['cloudy','covered with clouds'],['season','one of the four parts of the year'],['rainfall','the amount of rain that falls'],['breeze','a gentle wind']]},
 city:{keys:['city','town','urban','street','transport','traffic','directions','neighbourhood'],words:[['traffic','vehicles moving on the roads'],['neighbourhood','an area where people live'],['pavement','the path beside a road for walking'],['crowded','full of people'],['district','a part of a city'],['transport','ways of moving people, like buses'],['building','a structure with walls and a roof'],['directions','instructions for finding a place'],['suburb','an area at the edge of a city'],['facility','a place built for a purpose']]},
 science:{keys:['science','biology','chemistry','physics','experiment','laboratory','research','scientific'],words:[['experiment','a test done to discover something new'],['theory','an idea that explains how something works'],['evidence','information that proves something is true'],['research','a careful study to find new information'],['laboratory','a room where scientific experiments take place'],['observation','watching carefully to learn from what you see'],['hypothesis','an idea you test in an experiment'],['result','the information you get from a test or study'],['discovery','finding something new for the first time'],['evolution','the gradual change of living things over time']]},
 sport:{keys:['sport','sports','football','basketball','tennis','athlete','training','competition','fitness','exercise'],words:[['athlete','a person who trains and competes in sport'],['compete','to take part in a game or contest'],['victory','winning a competition'],['champion','the best player or team in a competition'],['fitness','being physically strong and healthy'],['training','regular practice to improve at a sport'],['equipment','objects needed to play a sport'],['referee','the person who makes sure the rules are followed'],['tournament','a series of games to find the best'],['coach','a person who trains and guides others in sport']]},
 culture:{keys:['culture','art','music','tradition','festival','heritage','museum','gallery','ceremony','diversity'],words:[['tradition','a custom passed down through generations'],['heritage','the history and culture passed to us from the past'],['festival','a public celebration of something special'],['gallery','a place where art is shown to the public'],['sculpture','art made by shaping a material such as stone or clay'],['ceremony','a formal event with special actions and meaning'],['diversity','a wide variety of different people, ideas or things'],['symbol','an image or object that represents something else'],['literature','written works, especially creative writing'],['performance','a live show in front of an audience']]},
 business:{keys:['business','company','market','trade','startup','entrepreneur','profit','economy','investment','finance'],words:[['profit','money made after all costs are paid'],['client','a customer who uses a professional service'],['negotiate','to discuss terms until both sides agree'],['contract','a legal written agreement between two parties'],['strategy','a plan designed to achieve a specific goal'],['invest','to put money into something expecting a future return'],['entrepreneur','a person who starts and runs a new business'],['revenue','the total money a business earns from sales'],['brand','the name, image and values that identify a company'],['launch','to introduce a new product or service to the market']]},
 relationships:{keys:['relationship','friendship','love','partner','family','society','community','communication','trust'],words:[['trust','a belief that someone is honest and reliable'],['communicate','to share information or feelings with others'],['conflict','a serious disagreement between people'],['loyalty','staying faithful and supportive to someone'],['boundary','a limit on what is acceptable behaviour'],['compromise','when both sides give something up to reach agreement'],['empathy','understanding and sharing another person\'s feelings'],['forgive','to stop feeling angry about what someone did'],['bond','a close emotional connection between people'],['respect','treating someone with care and consideration']]},
 emotions:{keys:['emotion','feelings','mental','mood','anxiety','stress','wellbeing','psychology','mindset'],words:[['anxious','feeling worried or nervous about what might happen'],['frustrated','feeling annoyed when you cannot achieve something'],['confidence','a strong belief in your own ability'],['overwhelmed','having too much to cope with at one time'],['inspire','to make someone feel motivated and creative'],['grateful','feeling thankful for something positive in your life'],['embarrassed','feeling uncomfortable or ashamed about something'],['curious','wanting to know more or learn about something'],['disappointed','feeling sad because something was not as hoped'],['proud','feeling pleased about an achievement of yours or others']]}
};
const WORD_DEFS={};Object.values(TOPIC_BANK).forEach(t=>t.words.forEach(([w,d])=>{WORD_DEFS[w]=d}));
const STOPSET=new Set('the a an and or but if then with from into about this that these those many often they their your have has had can could would should are was were been being for not you she he it its our his her them student students teacher english good short daily will would your you a in on at to of is be as by we they i my me do does did so such more most very then than once about over under between'.split(' '));
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function capitalize(s){return String(s||'').charAt(0).toUpperCase()+String(s||'').slice(1)}
const _previewCache={};
function toolPreview(tool){
  if(_previewCache[tool.id])return _previewCache[tool.id];
  const m=tool.mode;
  const ex=TOPIC_BANK.travel.words.slice(0,4).map(([w,d])=>({word:w,def:d}));
  const src='Travelling abroad requires careful planning. A valid passport is essential. Many people book flights online.';
  let s='';
  if(['pairs','topic-vocab','text-vocab'].includes(m)||m==='translation-match')
    s=ex.slice(0,3).map((x,i)=>`${i+1}. ${x.word} - ${x.def}`).join('\n');
  else if(m==='gap')
    s=ex.slice(0,2).map((x,i)=>{const f=[`One of the most important aspects of travel is ${x.word}.`,`Teachers often explain ${x.word} when introducing this topic.`][i];return `${i+1}. ${f.replace(new RegExp('\\b'+x.word+'\\b','gi'),'_____')}\n   Answer: ${x.word}`;}).join('\n');
  else if(m==='abcd'||m==='gaps-abcd')
    s=`1. Many people book their _____ online.\n   A) passport  B) luggage  C) souvenir  D) delay\n   Answer: A`;
  else if(m==='true-false')
    s=`1. A passport lets you enter foreign countries. - True\n2. You book flights after you arrive. - False`;
  else if(m==='open-questions')
    s=`1. What does the text say about "passport"?\n2. Why do people book flights in advance?\n3. What is the writer's main message?`;
  else if(m==='discussion')
    s=`1. What does "destination" mean to you personally?\n2. How does booking affect your travel experience?\n3. What is the biggest advantage of planning ahead?`;
  else if(m==='sentences-vocab')
    s=`1. Write a sentence using "passport" (an official travel document).\n2. How does destination connect to travel?\n3. Complete: "In travel, _____ is important because _____." (use: booking)`;
  else if(m==='pros-cons')
    s=`PROS:\n+ Developing passport skills builds confidence.\n+ Good destination knowledge opens opportunities.\nCONS:\n- Building booking fluency takes sustained effort.`;
  else if(m==='word-order')
    s=`1. online / book / many / flights / people\n   Answer: Many people book flights online.`;
  else if(m==='matching-halves')
    s=`Column A: 1. check  2. book  3. miss\nColumn B: A. a flight  B. in  C. a hotel\nKey: 1-B  2-C  3-A`;
  else if(m==='dialogue')
    s=`A: I need advice about planning a trip.\nB: Sure - what is your destination?\nA: I haven't booked anything yet.\nB: Start with your passport and then a ticket.`;
  else if(m==='rewrite')
    s=`1. Rewrite using present perfect: "She booked a flight last week."\n2. Rewrite using passive: "The agent issued the passport."`;
  else if(m==='error-correction')
    s=`1. She go to the airport every Monday. → She goes…\n2. I have book my ticket. → I have booked…`;
  else if(m==='translation')
    s=`1. Translate and use "passport" in your own sentence.\n2. Translate and use "destination" in your own sentence.`;
  else if(m==='summary-gapfill')
    s=`Listen and fill: Travelling abroad needs _____. A _____ is essential. Many book flights online.\nWord bank: planning · passport`;
  else if(m==='choose-summary')
    s=`Which summary best fits the text?\nA) Tips for cooking abroad\nB) How to plan international travel ✓\nC) The history of airports`;
  else s=tool.desc;
  _previewCache[tool.id]=s;
  return s;
}
function detectTopicKey(text){const t=String(text||'').toLowerCase();for(const k in TOPIC_BANK){if(TOPIC_BANK[k].keys.some(kw=>t.includes(kw)))return k}return null}
function topicBankItems(){const k=detectTopicKey(topic());return k?TOPIC_BANK[k].words.map(([w,d])=>({word:w,def:d})):[]}
function defFor(w){return WORD_DEFS[String(w||'').toLowerCase()]||`a useful ${level()} word connected to ${topic().toLowerCase()}`}
function makeDistractors(correct,pool,n){const c=String(correct||'').toLowerCase();const seen=new Set([c]);const out=[];for(const w of shuffle(pool)){const lw=String(w||'').toLowerCase();if(lw&&lw!==c&&!seen.has(lw)&&lw.length>2){seen.add(lw);out.push(w);if(out.length>=n)break}}while(out.length<n){out.push((correct||'word').split('').reverse().join(''))}return out}
function falsify(sent){const negs=[[/\bare\b/,'are not'],[/\bis\b/,'is not'],[/\bwas\b/,'was not'],[/\bwere\b/,'were not'],[/\bcan\b/,'cannot'],[/\bwill\b/,'will not'],[/\bhave\b/,'do not have'],[/\bhas\b/,'does not have']];for(const [re,rep] of negs){if(re.test(sent))return sent.replace(re,rep)}if(/\d+/.test(sent))return sent.replace(/\d+/,m=>String(Number(m)+(Number(m)%2?2:3)));const words=sent.split(/\s+/);const idxs=words.map((w,i)=>({w:w.replace(/[^A-Za-z]/g,''),i})).filter(o=>o.w.length>4&&!STOPSET.has(o.w.toLowerCase()));if(idxs.length){const o=idxs[idxs.length-1];const alt=makeDistractors(o.w,[...topicBankItems().map(x=>x.word),...TOPIC_SEED_WORDS],1)[0]||'something';words[o.i]=words[o.i].replace(o.w,alt);return words.join(' ')}return 'It is not true that '+sent.charAt(0).toLowerCase()+sent.slice(1)}
const TOPIC_SEED_WORDS=['goal','challenge','solution','example','reason','result','choice','plan','mistake','advice','question','answer','detail','opinion','evidence','comparison','cause','effect','benefit','risk','routine','schedule','booking','delay','request','complaint','support','feedback','deadline','priority','budget','quality','service','teamwork','progress','confidence','practice','revision','context','summary','prediction','argument','contrast','agreement','disagreement','permission','suggestion','experience','achievement','reflection','strategy','resource','process','outcome','decision','connection','keyword','phrase','task','roleplay','dialogue','presentation'];
function topicSeeds(text,n=50){const bank=detectTopicKey(text||topic())?TOPIC_BANK[detectTopicKey(text||topic())].words.map(w=>w[0]):[];const topical=(String(text||topic()||'lesson').toLowerCase().match(/[a-z][a-z'-]{3,}/g)||[]).filter(w=>!STOPSET.has(w));const pool=[...new Set([...bank,...topical,...TOPIC_SEED_WORDS])];return Array.from({length:n},(_,i)=>pool[i%pool.length]||`item ${i+1}`)}
function wordsForCount(text,n){const base=wordsOnly(text);return [...new Set([...base,...topicSeeds(topic(),n)])].slice(0,n)}
function itemsForCount(text,n){const base=vocabItems(text);const words=wordsForCount(text,n);return words.map(w=>base.find(x=>x.word.toLowerCase()===w.toLowerCase())||{word:w,def:defFor(w)})}
function sentenceParts(text){return String(text||'').replace(/\s+/g,' ').split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean)}
function repeatToCount(arr,n){return Array.from({length:n},(_,i)=>arr[i%arr.length])}
function sentencesForCount(text,n){const base=sentenceParts(text);const fallback=topicSeeds(topic(),n).map(w=>`Students discuss ${w} in the context of ${topic().toLowerCase()}.`);return [...base,...fallback].slice(0,n)}
function pick(arr,n){return [...arr].sort(()=>Math.random()-.5).slice(0,n)}
function count(){return Math.max(3,Math.min(50,parseInt(get('count')||'12',10)||12))}
function topic(){
  const explicit=get('topic');
  if(explicit)return explicit;
  const source=get('source').replace(/\s+/g,' ').trim();
  if(source)return source.slice(0,80);
  return lines(get('vocab')).slice(0,3).map(row=>row.split(/\s[-:]\s/)[0].trim()).filter(Boolean).join(', ');
}
function level(){return get('level')||'B1'}
function makeDefinitions(items){return items.map(x=>({a:x.word,b:(x.def&&x.def!=='teacher definition / translation')?x.def:defFor(x.word)}))}
function extractKeywords(text,n){const stop=new Set('the a an and or but if then with from into about this that these those many often they their your have has had can could would should are was were been being for not you she he it its our his her them student students teacher english good short daily includes includes'.split(' '));const freq={};String(text||'').toLowerCase().match(/[a-z][a-z'-]{3,}/g)?.forEach(w=>{if(!stop.has(w))freq[w]=(freq[w]||0)+1});return Object.entries(freq).sort((a,b)=>b[1]-a[1]||b[0].length-a[0].length).slice(0,n).map(([w])=>w)}
const WORD_LEVELS=[['substantial','big'],['delighted','happy'],['stated','said'],['crucial','important'],['excellent','good'],['poor','bad'],['extremely','very'],['however','but'],['therefore','so'],['furthermore','also'],['believe','think'],['obtain','get'],['assist','help'],['commence','start'],['conclude','end'],['demonstrate','show'],['utilise','use'],['numerous','many'],['challenging','hard'],['purchase','buy'],['require','need'],['sufficient','enough'],['rapidly','fast'],['previously','before']];
function applyMap(text,from,to){let out=String(text||'');WORD_LEVELS.forEach(([adv,simp])=>{const a=from==='adv'?adv:simp,b=to==='adv'?adv:simp;out=out.replace(new RegExp('\\b'+a+'\\b','gi'),m=>m[0]===m[0].toUpperCase()?b[0].toUpperCase()+b.slice(1):b)});return out}
function simplifyText(text){let out=applyMap(text,'adv','simp');out=out.replace(/,\s+(which|who|that)\b/gi,'. It ').replace(/\s+;\s+/g,'. ');return out}
function upgradeText(text){let out=applyMap(text,'simp','adv');const starters=['In addition, ','Moreover, ','As a result, ','Interestingly, '];const parts=sentenceParts(out);return parts.map((s,i)=>i>0&&i%2===0?starters[(i/2)%starters.length]+s[0].toLowerCase()+s.slice(1):s).join(' ')}
const QUOTE_BANK=[{q:'The only way to do great work is to love what you do.',a:'Steve Jobs'},{q:'Education is the most powerful weapon which you can use to change the world.',a:'Nelson Mandela'},{q:'Tell me and I forget, teach me and I may remember, involve me and I learn.',a:'Benjamin Franklin'},{q:'The future belongs to those who believe in the beauty of their dreams.',a:'Eleanor Roosevelt'},{q:'Success is not final, failure is not fatal: it is the courage to continue that counts.',a:'Winston Churchill'},{q:'A person who never made a mistake never tried anything new.',a:'Albert Einstein'},{q:'It always seems impossible until it is done.',a:'Nelson Mandela'},{q:'The beautiful thing about learning is that no one can take it away from you.',a:'B.B. King'},{q:'Do what you can, with what you have, where you are.',a:'Theodore Roosevelt'},{q:'Change is the end result of all true learning.',a:'Leo Buscaglia'}];
// Primary "Generate" button: signed-in teachers receive a server-built result.
// Offline mode remains available only for deterministic transformations of the
// text or vocabulary the teacher actually supplied. It must never invent a
// presentable lesson from a generic template.
let ttGenerating=false;
function setToolBusy(on,label){
  ttGenerating=!!on;
  document.querySelectorAll('#tool-form button').forEach(btn=>{
    if(btn.textContent&&/Generate|Create|Draft/i.test(btn.textContent)){
      btn.disabled=!!on;
      btn.dataset.idleText=btn.dataset.idleText||btn.textContent;
      btn.textContent=on?(label||'Preparing draft…'):btn.dataset.idleText;
    }
  });
}
async function generateSmart(skipLessonRoute=false){
  if(ttGenerating){toast('Already preparing this draft…');return;}
  if(!validateToolInput())return;
  if(needsLessonRoute()&&!activeLessonRoute&&!skipLessonRoute){prepareLessonRoute();return;}
  setToolBusy(true,localStorage.getItem('teachedos_token')?'Creating material…':'Creating exercise…');
  try{
    if(localStorage.getItem('teachedos_token')) return await generateWithAI();
    const shared=await ttTryEngine();
    if(shared){lastOutput=shared;renderResult(shared);return;}
    showHubGenerationState(
      'This activity needs AI',
      'Sign in to create material from this topic. Offline tools can only transform text or vocabulary that you provide.'
    );
    toast('Add source material or sign in to use AI');
  }finally{
    setToolBusy(false);
  }
}
/* ── Один каталог замість двох ──────────────────────────────────────────────

   У проєкті два генератори однакових вправ: цей хаб і `board-gen.js`, який
   ліниво вантажить дошка. Двадцять вправ написано двічі, і поки це так, будь-яка
   правка робиться в двох місцях, а розходження - питання часу.

   Тут не переписування, а перемикання точки виклику: якщо спільний рушій
   покриває інструмент - беремо його результат, ні - лишається гілка хаба.
   Побічний виграш більший за економію рядків: рушій завжди повертає СТРУКТУРУ
   (boardKind/questions/items/cards), тож інструменти, що досі віддавали плоский
   текст, тепер їдуть на дошку нормальною worksheet-карткою.

   Рушій вантажиться на першу генерацію (92 КБ), а не в парсі сторінки. Якщо
   він не приїхав - мовчки працює стара гілка, тому мережевий збій нічого не
   ламає. */
/* Прогрів кешу, не виконання. `rel=prefetch` кладе board-gen.js у кеш браузера
   без парсу, тож коли ttEnsureEngine справді впорсне <script>, той приїде з
   кешу. Дошка робить так само на INIT. Без цього перша генерація чекала б
   92 КБ по мережі, і «миттєва чернетка» переставала б бути миттєвою. */
let _ttEnginePrefetched=false;
function ttPrefetchEngine(){
  if(_ttEnginePrefetched||typeof generateTeacherToolLocal==='function')return;
  _ttEnginePrefetched=true;
  const go=()=>{
    const l=document.createElement('link');
    l.rel='prefetch';l.as='script';l.href='scripts/board-gen.js?v=614';
    document.head.appendChild(l);
  };
  if(typeof requestIdleCallback==='function')requestIdleCallback(go,{timeout:3000});
  else setTimeout(go,1200);
}
let _ttEnginePromise=null;
function ttEnsureEngine(){
  if(typeof generateTeacherToolLocal==='function')return Promise.resolve(true);
  if(_ttEnginePromise)return _ttEnginePromise;
  _ttEnginePromise=new Promise(resolve=>{
    const el=document.createElement('script');
    el.src='scripts/board-gen.js?v=614';
    el.onload=()=>resolve(typeof generateTeacherToolLocal==='function');
    el.onerror=()=>{_ttEnginePromise=null;resolve(false);};
    document.head.appendChild(el);
  });
  return _ttEnginePromise;
}

/* Результат рушія → форма, якою живе хаб (renderResult, експорти, «на дошку»).
   Текст збираємо тим самим ttOutputPlainText, тож ключ відповідей і тут
   лишається властивістю, а не запеченим рядком. */
/* Struct рушія → вміст практичної гри.

   `gameContent` тут стояв `null`, і поки рушій діставався лише гостям це нічого
   не важило. Щойно він став основним для всіх, 19 інструментів з грою почали
   віддавати share-посилання без інтерактиву: `share.html` перевіряє саме
   `gameContent` і, не знайшовши, мовчки малює простиню тексту замість квізу.
   Деградація тиха, тому й не впадала в око.

   Форми взяті з того, що читає `share.html`, а не з голови: пропуск у нього
   рівно `___` (три), розділювач `|`; у рушія пропуск `_____` (пʼять).
   Де зібрати нічого - чесно повертаємо null, і сторінка так само чесно падає
   на текст. */
function ttGameContentFromStruct(gameType,struct){
  if(!gameType||!struct)return null;
  const qs=Array.isArray(struct.questions)?struct.questions:[];
  const items=Array.isArray(struct.items)?struct.items:[];
  const matchPairs=()=>{
    const out=[];
    qs.forEach(q=>{
      if(!q||q.type!=='match'||!Array.isArray(q.pairs))return;
      q.pairs.forEach(p=>{
        const a=String(p&&p.left||'').trim(),b=String(p&&p.right||'').trim();
        if(a&&b)out.push({a,b});
      });
    });
    return out;
  };
  if(gameType==='memory-match'||gameType==='flashcards'){
    /* Рушій кладе визначення в `definition`, а тут читалося лише `def` - поля
       з такою назвою в його items немає взагалі. Через це набір слів із
       поясненнями вчителя не давав вмісту для гри: зворот пари був порожній і
       пара відсіювалась. Порядок - визначення, потім приклад: на картці
       потрібне значення, а речення лише ілюструє. */
    const pairs=[...matchPairs(),...items.map(i=>({a:String(i&&i.word||'').trim(),b:String(i&&(i.definition||i.def||i.example)||'').trim()})).filter(p=>p.a&&p.b)];
    return pairs.length?{pairs}:null;
  }
  if(gameType==='speed-quiz'){
    const questions=qs.filter(q=>q&&q.type==='mcq'&&Array.isArray(q.options)&&q.options.length).map(q=>{
      const opts=q.options.map(String);
      return {q:String(q.text||''),opts,correct:Math.max(0,opts.indexOf(String(q.answer)))};
    });
    return questions.length?{questions}:null;
  }
  if(gameType==='true-false'){
    const statements=qs.filter(q=>q&&q.type==='truefalse').map(q=>({text:String(q.text||''),answer:q.answer===true||String(q.answer).toLowerCase()==='true'}));
    return statements.length?{statements}:null;
  }
  if(gameType==='fill-blank'){
    const sentences=qs.filter(q=>q&&q.type==='gap-fill'&&q.answer).map(q=>`${String(q.text||'').replace(/_{3,}/g,'___')}|${String(q.answer)}`);
    return sentences.length?{sentences}:null;
  }
  if(gameType==='word-categories'){
    const byCat={};
    qs.forEach(q=>{
      if(!q||q.type!=='match'||!Array.isArray(q.pairs))return;
      q.pairs.forEach(p=>{
        const name=String(p&&p.right||'').trim(),w=String(p&&p.left||'').trim();
        if(name&&w)(byCat[name]=byCat[name]||[]).push(w);
      });
    });
    const categories=Object.keys(byCat).map(name=>({name,words:byCat[name]}));
    return categories.length?{categories}:null;
  }
  return null;
}

function ttEngineOutput(tool,res){
  if(!res)return null;
  const out={
    title:res.title||tool.title,
    type:tool.mode,
    text:'',
    cards:[],
    gameType:tool.game||null,
    gameContent:null,
    level:res.level||level(),
    topic:res.topic||topic(),
    kind:res.kind||'',
    cat:res.cat||tool.cat||'',
    tags:[tool.cat,topic()],
    struct:{boardKind:res.boardKind||'quiz',questions:res.questions||null,items:res.items||null,cards:res.cards||null},
    ...knowledgeBaseMeta(),
  };
  // Only the shared generator's own structured result may be sent to a game.
  // The retired hub generator contained generic scaffolds, so using it merely
  // to fill a missing game payload could quietly reintroduce fake material.
  out.gameContent=ttGameContentFromStruct(out.gameType,out.struct);
  out.text=ttOutputPlainText(out);
  return out.text||out.struct.questions||out.struct.items||out.struct.cards?out:null;
}

function ttEngineInput(){
  return {
    tool:{id:TT_ENGINE_ID_MAP[activeTool.id]||activeTool.id},
    source:get('source'),
    vocab:get('vocab'),
    topic:topic(),
    level:level(),
    count:count(),
  };
}

/* A synchronous draft is allowed only for reviewed mechanical generators.
   These generators can derive their result directly from the teacher's source
   text or vocabulary and never need a generic topic scaffold. */
function ttEngineDraftSync(){
  if(!ttCanGenerateLocal()||typeof generateTeacherToolLocal!=='function')return null;
  try{
    const out=ttEngineOutput(activeTool,generateTeacherToolLocal(ttEngineInput()));
    const st=out&&out.struct;
    return st&&(st.questions||st.items||st.cards)?out:null;
  }catch(err){
    console.warn('[tools] local generator failed',err);
    return null;
  }
}

/* Render a local draft only when it is a direct transformation of user input. */
function ttLocalDraft(){
  const shared=ttEngineDraftSync();
  if(shared){lastOutput=shared;renderResult(shared);return true;}
  return false;
}

async function ttTryEngine(){
  if(!ttCanGenerateLocal())return null;
  if(!await ttEnsureEngine())return null;
  try{
    return ttEngineOutput(activeTool,generateTeacherToolLocal(ttEngineInput()));
  }catch(err){
    console.warn('[tools] local generator failed',err);
    return null;
  }
}

/* Retired hub generator. It remains in the source temporarily to keep older
   saved drafts readable, but no production action may call it: it contains
   generic teaching scaffolds that are not trustworthy material. */
function buildHubOutput(){if(!activeTool)return null;const m=activeTool.mode;const n=count();const src=get('source');const voc=get('vocab');const items=itemsForCount(voc,n);let out={title:activeTool.title,type:m,text:'',cards:[],gameType:activeTool.game||null,gameContent:null,level:level(),tags:[activeTool.cat,topic()],...knowledgeBaseMeta()};
  if(m==='images'){const cards=imageRows.filter(r=>r.word||r.image).map((r,i)=>({word:r.word||`word ${i+1}`,image:r.image||'',note:r.note||''}));out.cards=cards;out.text=cards.map((c,i)=>`${i+1}. ${c.word} -> ${c.image?'image attached':'image needed'}`).join('\n');out.gameType='memory-match';out.gameContent={pairs:cards.map(c=>({a:c.word,b:c.note||'match the picture'}))};}
  else if(m==='lesson-pack'){const ws=wordsForCount(voc,n);const t=topic()||'Everyday English';const lv=level()||'B1';const tl=t.toLowerCase();const stageCards=[{title:'🎯 Lesson aims & objectives',text:'Topic: '+t+' · Level: '+lv+'\nEstimated duration: 60 min\n\nBy the end of this lesson, SWBAT:\n• Recognise and use the target vocabulary naturally in context\n• Identify gist, main ideas and specific details in the input\n• Complete controlled practice accurately (80%+ score target)\n• Communicate ideas on "'+tl+'" fluently for 2+ minutes\n\n📌 Key vocabulary: '+(ws.slice(0,6).join(', ')||'see vocab list')+'\n📌 Target structure / skill: ________________________________\n📌 Materials needed: ________________________________'},{title:'🔥 Warm-up & lead-in (7 min)',text:'Option A - Word association (3 min)\nWrite "'+t+'" on the board. Students brainstorm 8 connected words in pairs, then share. Teach 2-3 unknown words from their lists.\n\nOption B - Two Truths and a Lie (4 min)\nSay 3 statements about '+tl+'  - students guess which is false. Then students do the same in pairs.\n\nOption C - Picture / image prompt (3 min)\nShow an image related to '+tl+'. Students describe what they see and predict the lesson topic.\n\n💡 Aim: activate prior knowledge + create curiosity.'},{title:'📖 Vocabulary presentation (8 min)',text:'Target words: '+(ws.slice(0,8).join(' · ')||'target vocabulary')+'.\n\nStep-by-step procedure:\n1. Context - show each word in a sentence (not isolated)\n2. Meaning - elicit, then confirm with a clear definition\n3. CCQ - ask 1-2 concept check questions per word\n4. Pronunciation - model → choral drill → individual drill\n5. Record - students write in vocab notebook: word / definition / example\n\n⏱ Timing: ~1 min per word. Don\'t rush - quality over quantity.\n💡 Use the Flashcards tool to create a drill activity.'},{title:'📄 Input & reading/listening (12 min)',text:'Procedure:\n\n1. PRE-TASK (2 min): Set gist question - "What is the main idea?"\n2. FIRST READ/LISTEN (3 min): Students find the answer to the gist question only.\n3. FEEDBACK (1 min): Quick whole-class check.\n4. SECOND READ/LISTEN (4 min): Detail questions -\n   a) Find three specific facts about '+tl+'.\n   b) Find how target vocabulary is used in context.\n   c) Identify the writer\'s/speaker\'s opinion.\n5. PEER CHECK (2 min): Compare answers in pairs before whole-class.\n\n💡 Differentiation: stronger students write a 2-sentence summary after step 4.'},{title:'✏️ Controlled practice (10 min)',text:'Activity type: gap-fill / matching / MCQ / error correction (choose one).\n\nProcedure:\n1. Demo one example together as a class.\n2. Students work individually (5 min). Remind them to use context clues.\n3. Peer check in pairs (2 min) - discuss any differences.\n4. Whole-class feedback (3 min) - address common errors.\n\nMonitoring tips:\n• Circulate - do NOT sit at your desk.\n• Note 2-3 errors anonymously for feedback stage.\n• Give quiet support to students who are stuck; avoid giving answers directly.\n\n✦ Fast finishers: write one more gap-fill sentence for a partner.'},{title:'🗣 Freer practice & production (12 min)',text:'Communicative task: "Discuss with your partner - '+['what do you personally think about','how has','what is your experience with','would you recommend'][Math.floor(Math.random()*4)]+' '+tl+'?"\n\nStructure the task:\n• 30 sec: individual think time (write 3 bullet points)\n• 3 min: pair discussion (both speak roughly equally)\n• 1 min: report back - "My partner said that…"\n\nExpect students to use at least 4 target words. Monitor and note:\n✅ 2 strong examples of language to praise\n❌ 2-3 errors to work on in feedback\n\n💡 If a pair finishes early: "Now disagree with each other - argue the opposite point."'},{title:'📋 Feedback & delayed error correction (5 min)',text:'Structure:\n1. PRAISE (1 min) - write 2 strong examples from student output on the board. Ask the class what is good about them.\n2. ERRORS (2 min) - write 2-3 anonymous errors. Students identify and correct as a class.\n3. LANGUAGE FOCUS (2 min) - clarify any remaining confusion about today\'s target language.\n\nAnonymous error board template:\n   ✗ "_______________"\n   ✓ "_______________" - because _______________\n\n📌 Note errors you heard - revisit them at the start of the NEXT lesson (great for recycling).'},{title:'📚 Homework (set in final 2 min)',text:'TASK: Write 80-100 words on the topic "'+t+'".\nUse at least 5 target words naturally.\n\nTopic prompt: Describe your own experience with '+tl+', your opinion, and one recommendation for others.\n\nDifferentiation:\n✦ Support (weaker): Use these starters -\n   "In my experience, '+tl+' is…"\n   "One thing I have noticed is…"\n   "I would suggest that…"\n✦ Extension (stronger): Add a counter-argument and respond to it.\n\nDeadline: _______________\nSelf-check before submitting: vocabulary ☐ · opinion ☐ · spelling ☐'},{title:'🔄 Fast finishers & extension tasks',text:'If students finish early at any stage:\n\n📖 After vocabulary stage:\n→ Write a short paragraph using 5 target words. Make it surprising or funny.\n\n✏️ After controlled practice:\n→ Write 3 new gap-fill sentences for a partner to solve.\n\n🗣 After freer practice:\n→ "Now teach your partner - explain the key ideas as if they missed the lesson."\n\n🏆 Challenge task (top students):\n→ Find one real-world example of '+tl+' (news, video, website) and present it in 60 seconds at the start of the next lesson.\n\n📌 Extension tasks keep faster students engaged without disrupting the main pace.'},{title:'📊 Assessment & success criteria',text:'How will you know the lesson was successful?\n\n✅ Vocabulary: students can define/use '+Math.min(ws.length,5)+' target words without prompting.\n✅ Comprehension: students answer gist + 2 detail questions correctly.\n✅ Practice: 80% accuracy on the controlled exercise.\n✅ Production: students use target language for 90+ seconds in the speaking task.\n\nObservation checklist (teacher):\n☐ All students participated in the warm-up.\n☐ Vocabulary was drilled enough (3+ exposures).\n☐ Errors were corrected anonymously and constructively.\n☐ Homework was set with clear instructions and a deadline.\n\nNext lesson: revisit errors from the board + 5-min vocabulary quiz.'},{title:'🗒 Teacher notes & differentiation',text:'📌 TIMING ADJUSTMENTS:\n• Short class (45 min): cut freer practice to 8 min, skip extension.\n• Long class (90 min): double controlled practice + add a writing task.\n\n📌 DIFFERENTIATION:\n• Lower level: pre-teach vocabulary before class; provide sentence starters throughout.\n• Higher level: remove scaffolding, require longer production, add research task.\n• Mixed level: pair stronger + weaker for the speaking task; give different roles.\n\n📌 ADAPTING THE INPUT:\n• No text available? Use a short audio clip, image set, or infographic.\n• Text too hard? Simplify with the TeachEd Simplify tool first.\n\n📌 NEXT STEPS: revisit weak vocabulary → error correction board → homework feedback.'}];out.text=stageCards.map((c,i)=>`${i+1}. ${c.title}\n${c.text}`).join('\n\n');out.struct={boardKind:'cards',cards:stageCards,items:null,questions:null};}
  else if(m==='worksheet'){const ws=wordsForCount(voc,n);const t=topic()||'English';const lv=level()||'B1';const tl=t.toLowerCase();const defs=makeDefinitions(items).slice(0,Math.min(ws.length,8));const shuffledWs=[...ws.slice(0,6)].sort(()=>Math.random()-.5);const wsCards=[{title:'📝 Student information',text:'Student name: ____________________   Date: __________\nClass: ____________________   Teacher: __________\nLevel: '+lv+'   Topic: '+t+'\n\n📌 Read all instructions carefully before you start.\n📌 Check your work when you finish each section.'},{title:'A. Vocabulary - match & define',text:'Part 1: Match each word with its meaning.\n\n'+ws.slice(0,6).map((w,i)=>`${i+1}. ${w}  → ___________________________`).join('\n')+'\n\nWord bank: '+shuffledWs.join(' · ')+'\n\nPart 2: Choose 2 words from above. Write your own sentence for each.\na) _______________________________________________\nb) _______________________________________________'},{title:'B. Vocabulary in context - gap fill',text:'Fill the gaps with the correct form of a word from section A.\n\n'+ws.slice(0,5).map((w,i)=>`${i+1}. Without a good understanding of _____, it is hard to make progress in ${tl}.`).join('\n')+'\n\n★ Challenge: Which sentence is closest to your own experience? Underline it and explain why.'},{title:'C. Reading comprehension',text:'Read the text carefully. Answer in full sentences where possible.\n\n1. Main idea: What is the text mainly about?\n   → ____________________________________________\n\n2. Detail A: Give one specific fact or statistic from the text.\n   → ____________________________________________\n\n3. Detail B: Give one example the writer uses.\n   → ____________________________________________\n\n4. Inference: What does the writer think about '+tl+'? How do you know?\n   → ____________________________________________\n\n5. Vocabulary: Find a word in the text that means "important" or "difficult".\n   → The word is: ___________  (line/paragraph: ___)'},{title:'D. Grammar in context',text:'Look at the target language in the text. Complete the tasks:\n\nTask 1: Find one example of the target grammar structure and write it here:\n   → ____________________________________________\n\nTask 2: Write two more examples using the same structure:\n   a) ____________________________________________\n   b) ____________________________________________\n\nTask 3: Write one INCORRECT version of your sentence b) - swap with a partner to correct each other\'s mistake:\n   ✗ ____________________________________________'},{title:'E. Speaking / discussion task',text:'Work with a partner. You have 5 minutes.\n\n🗣 Question 1: How does '+tl+' affect everyday life? Give a real example.\n🗣 Question 2: Do you think '+tl+' is important for your future? Why / why not?\n🗣 Question 3: What is one thing you would like to know more about '+tl+'?\n\nTry to use at least 3 words from Section A.\n\nUseful phrases:\n• "In my experience…"\n• "I think this is important because…"\n• "On the other hand…"'},{title:'F. Writing task',text:'Write 80-100 words on ONE of these prompts:\n\n✍️ Option 1 (opinion): "Is '+tl+' important in today\'s world? Give your opinion with at least 2 reasons."\n\n✍️ Option 2 (narrative): "Describe a time when '+tl+' made a difference to you or someone you know."\n\nChecklist before you finish:\n☐ I used at least 4 words from Section A.\n☐ My sentences are complete (subject + verb + idea).\n☐ I included my own opinion.\n☐ I checked my spelling and punctuation.'},{title:'G. Reflection - how did I do?',text:'Rate yourself honestly (✗ / ✦ / ✅):\n\nVocabulary: I can explain 4+ words without looking.           ___\nReading: I found the main idea and 2 details.                 ___\nGrammar: I formed the structure correctly.                    ___\nSpeaking: I spoke for 2+ minutes without stopping.           ___\nWriting: My paragraph is clear and uses target language.      ___\n\nMy strongest skill today: ________________________________\nWhat I need more practice with: ________________________________\nOne word I will definitely use this week: ________________________________'},{title:'🔑 Answer key & teacher notes',text:'Vocabulary:\n'+defs.map((p,i)=>`${i+1}. ${p.a} - ${p.b}`).join('\n')+'\n\n📌 Timing guide:\n  A (Vocabulary) ......... 8 min\n  B (Gap fill) ........... 8 min\n  C (Comprehension) ...... 12 min\n  D (Grammar) ............ 8 min\n  E (Speaking) ........... 6 min\n  F (Writing) ............ 12 min\n  G (Reflection) ......... 3 min\n  Total .................. ~57 min\n\n📌 Differentiation:\n  ✦ Weaker: give sentence starters for F; allow dictionary for A.\n  ✦ Stronger: write a paragraph response to Section E questions.'}];out.text=wsCards.map(c=>c.title+'\n'+c.text).join('\n\n');out.struct={boardKind:'cards',cards:wsCards,items:null,questions:null};}
  else if(m==='homework'){const ws=wordsForCount(voc,n);const t=topic()||'English';const lv=level()||'B1';const tl=t.toLowerCase();const hwCards=[{title:'📚 Homework brief',text:'Topic: '+t+' · Level: '+lv+'\nEstimated time: 30-40 minutes\nDue date: ____________________\n\n📌 Complete all 5 tasks in order.\n📌 Quality is more important than length.\n📌 If you are stuck, re-read your class notes before asking for help.'},{title:'Task 1 - Vocabulary review (8 min)',text:'Target words: '+(ws.slice(0,8).join(', ')||'target vocabulary')+'.\n\n① Write one genuine, personal sentence for each word. Make it true about your life.\n② Circle the 2 words you found most difficult to remember. Write an extra sentence for those.\n③ Write one question using a word from the list - bring it to class to ask your partner.\n\n💡 Tip: read your sentences aloud. If it sounds natural, it probably is.'},{title:'Task 2 - Reading / listening review (8 min)',text:'Go back to today\'s text or audio.\n\n① Write 5 key ideas in YOUR OWN WORDS (do not copy from the text).\n   1. _______________  2. _______________  3. _______________\n   4. _______________  5. _______________\n\n② Underline 3 phrases you want to use yourself. Write them here:\n   • _______________\n   • _______________\n   • _______________\n\n③ Write one thing you are STILL UNSURE about after the lesson:\n   → _______________'},{title:'Task 3 - Grammar consolidation (7 min)',text:'Focus on today\'s target structure.\n\n① Write 5 original sentences using the structure (not examples from class).\n   1. _______________  2. _______________  3. _______________\n   4. _______________  5. _______________\n\n② Look at your sentences. Can you spot any errors? Correct them now.\n\n③ Write ONE sentence that combines today\'s grammar with today\'s vocabulary:\n   → _______________\n\n💡 Tip: mixing grammar + vocabulary in one sentence is excellent practice.'},{title:'Task 4 - Speaking preparation (7 min)',text:'Prepare a 60-90 second spoken answer to this question:\n\n"What is your opinion about '+tl+' - is it important, and why?"\n\nStructure your answer:\n📌 Point: "I think / believe / feel that…"\n📌 Reason: "This is because…"\n📌 Example: "For example, in my experience…"\n📌 Conclusion: "Overall, I would say…"\n\n★ Record yourself on your phone. Listen back. Improve one sentence. Record again.\n★ Target: speak for 60+ seconds without reading from notes.'},{title:'Task 5 - Writing task (10 min)',text:'Write 80-100 words on the topic "'+t+'".\n\nChoose a prompt:\n   ✍️ Opinion: "Is '+tl+' important today? Give your opinion with 2 reasons and an example."\n   ✍️ Personal: "Describe your own experience with '+tl+'. What have you learned?"\n\nRequirements:\n☐ Use at least 5 words from Task 1.\n☐ Use today\'s grammar structure at least once.\n☐ Include your personal opinion.\n☐ Write in paragraphs (not bullet points).\n☐ Check spelling and punctuation before finishing.'},{title:'🏆 Challenge extension (optional, +5 min)',text:'For students who finish early or want extra practice:\n\n① Find a short news article, video or podcast about '+tl+' in English.\n   Prepare to summarise it in 3 sentences at the start of next class.\n\n② Write 5 questions you would ask an expert on '+tl+'.\n   Use a variety: What…? Why…? How…? Do you think…? What if…?\n\n③ Teach a family member one new word from today\'s lesson.\n   Write down what questions they asked you.\n\n📌 Bonus: Share your Task 4 recording in the class chat and invite feedback.'},{title:'✅ Self-check before submitting',text:'Tick each box honestly:\n\n☐ Task 1: I wrote personal sentences (not definitions).\n☐ Task 2: I used my own words, not copied from the text.\n☐ Task 3: My grammar sentences are correct.\n☐ Task 4: I recorded myself and listened back.\n☐ Task 5: My writing is 80-100 words with vocabulary and grammar.\n\nMy strongest moment today: ________________________________\nOne thing I need to practise more: ________________________________\nA word I want to use more often: ________________________________\n\n📌 Bring this sheet to class - we will review it together at the start of the lesson.'}];out.text=hwCards.map(c=>c.title+'\n'+c.text).join('\n\n');out.struct={boardKind:'cards',cards:hwCards,items:null,questions:null};}
  else if(m==='pairs'){const pairs=makeDefinitions(items).slice(0,n);out.cards=pairs;out.text=pairs.map((p,i)=>`${i+1}. ${p.a} - ${p.b}`).join('\n');out.gameContent={pairs};}
  else if(m==='translation-match'){const lang=get('target-lang')||'Ukrainian';const userPairs=vocabItems(voc);const ws=wordsForCount(voc,n);const pairs=ws.map(w=>{const u=userPairs.find(x=>x.word.toLowerCase()===w.toLowerCase());const given=(u&&u.def&&u.def!=='teacher definition / translation')?u.def:'';const tr=given||translateWord(w,lang)||`(${lang} translation)`;return {a:w,b:tr};});out.cards=pairs;out.text=`Word-Translation Matching - English ↔ ${lang} (${level()})\n\n`+pairs.map((p,i)=>`${i+1}. ${p.a} - ${p.b}`).join('\n')+`\n\nTeacher note: edit any "(${lang} translation)" placeholders for words not in the built-in dictionary.`;out.gameContent={pairs};out.tags=[activeTool.cat,lang,topic()];}
  else if(m==='text-vocab'){const kws=[...new Set([...extractKeywords(src,n),...topicSeeds(topic(),n)])].slice(0,n);const pairs=kws.map(w=>({a:w,b:defFor(w)}));out.cards=pairs;out.text=pairs.map((p,i)=>`${i+1}. ${p.a} - ${p.b}`).join('\n');out.gameContent={pairs};}
  else if(m==='topic-vocab'){const typed=get('vocab').trim();const bi=topicBankItems();const items=typed?itemsForCount(typed,n):(bi.length?Array.from({length:n},(_,i)=>bi[i%bi.length]):[]);const pairs=items.map(x=>({a:x.word,b:(x.def&&x.def!=='teacher definition / translation')?x.def:defFor(x.word)}));out.cards=pairs;out.text=pairs.map((p,i)=>`${i+1}. ${p.a} - ${p.b}`).join('\n');out.gameContent={pairs};}
  else if(m==='odd'){const groups=parseGroups(voc);out.text=groups.slice(0,n).map((g,i)=>`${i+1}. ${pick(g.words,3).join(', ')}, ${g.odd||'different word'}\nAnswer: ${g.odd||'different word'}`).join('\n\n');out.gameType='speed-quiz';out.gameContent={questions:groups.slice(0,n).map(g=>({q:`Which word is the odd one out: ${pick(g.words,3).concat(g.odd||'umbrella').join(', ')}?`,opts:pick(g.words,3).concat(g.odd||'umbrella'),correct:3}))};}
  else if(m==='sorting'){const groups=parseGroups(voc);out.cards=groups;out.text=groups.map(g=>`${g.name}: ${g.words.join(', ')}`).join('\n');out.gameType='word-categories';out.gameContent={categories:groups.map(g=>({name:g.name,words:g.words}))};}
  else if(m==='sentences-vocab'){const items=itemsForCount(voc,n);const t=topic().toLowerCase();const frames=[(w,d)=>`Write a sentence using "${w}" (meaning: ${d}).`,(w,d)=>`How does ${w} connect to the topic of ${t}? Use it in one sentence.`,(w,d)=>`Complete: "In ${t}, _____ is important because _____ ." (use: ${w})`,(w,d)=>`Translate this idea into your own words: "${w} matters in ${t}." `,(w,d)=>`Challenge: use "${w}" and one other word from today's list in one sentence.`,(w,d)=>`Give a real-life example of ${w} - one sentence is enough.`,(w,d)=>`How would you explain "${w}" to a friend who has never studied ${t}?`,(w,d)=>`Write a question using the word "${w}".`];out.text=items.map((x,i)=>`${i+1}. ${frames[i%frames.length](x.word,defFor(x.word))}`).join('\n\n');out.gameType='fill-blank';out.gameContent={sentences:items.map(x=>`In ${t}, _____ plays an important role.|${x.word}`)};}
  else if(m==='text-with-vocab'){const ws=wordsForCount(voc,n).join(', ');out.text=`${level()} reading text: ${topic()}\n\nLast week, my student and I discussed ${topic().toLowerCase()}. We focused on these words: ${ws || 'useful vocabulary'}. The lesson started with a short prediction task, then we read a text, checked meaning from context, and finished with a speaking challenge. By the end, the student could explain the topic more clearly and use the new words in personal examples.\n\nPost-reading task: underline the target words and write one personal sentence with each word.`;}
  else if(m==='abcd'||m==='gaps-abcd'){const s=sentencesForCount(src,n);const pool=[...new Set([...extractKeywords(src,40),...topicSeeds(topic(),40),...topicBankItems().map(x=>x.word)])].filter(w=>w.length>3&&!STOPSET.has(w));const qs=s.map(sent=>{const words=sent.split(/\s+/);const cand=words.map((w,i)=>({w:w.replace(/[^A-Za-z]/g,''),i})).filter(o=>o.w.length>3&&!STOPSET.has(o.w.toLowerCase()));const p=cand.length?cand[Math.floor(Math.random()*cand.length)]:null;const answer=p?p.w:'';const q=p?words.map((w,i)=>i===p.i?'_____':w).join(' '):sent;const opts=shuffle([answer||'word',...makeDistractors(answer,pool,3)]);return {q,opts,correct:Math.max(0,opts.indexOf(answer||'word'))};});out.text=qs.map((x,i)=>`${i+1}. ${x.q}\n`+x.opts.map((o,j)=>`   ${String.fromCharCode(65+j)}) ${o}`).join('\n')+`\nAnswer: ${String.fromCharCode(65+x.correct)}`).join('\n\n');out.gameType='speed-quiz';out.gameContent={questions:qs};}
  else if(m==='open-questions'){const sents=sentencesForCount(src,n);const kws=extractKeywords(src,20);const t=topic().toLowerCase();const qs=sents.map((s,i)=>{const kw=kws[i]||kws[0]||t;if(kw&&s.toLowerCase().includes(kw))return `What does the text say about "${kw}"? Explain in your own words.`;if(/why|because|reason/i.test(s))return `According to the text, why does this happen? "${s.slice(0,70)}…"`;if(/\d+|percent|million|year/i.test(s))return `What do the numbers in this sentence tell us? "${s.slice(0,70)}…"`;return `What is the writer's main point in this sentence? "${s.slice(0,70)}${s.length>70?'…':''}"`});const extra=[`What is the overall message of this text about ${t}?`,`Which idea do you agree with most, and why?`,`What question would you ask the writer if you could?`,`How does this text connect to your own experience with ${t}?`,`What would you research further after reading this?`];const combined=[...qs,...extra].slice(0,n);out.text=combined.map((q,i)=>`${i+1}. ${q}`).join('\n\n');}
  else if(m==='true-false'){const s=sentencesForCount(src,n);const stmts=s.map((x,i)=>i%2===0?{text:x,answer:true}:{text:falsify(x),answer:false});out.text=stmts.map((x,i)=>`${i+1}. ${x.text}`).join('\n')+`\n\nAnswer key: ${stmts.map((x,i)=>`${i+1}-${x.answer?'T':'F'}`).join(', ')}`;out.gameType='true-false';out.gameContent={statements:stmts};}
  else if(m==='three-titles'){out.text=`Choose the best title for the text:\nA) Daily Practice Makes English Easier\nB) The History of Online Banking\nC) How to Repair a Bicycle\n\nAnswer: A` ;out.gameType='speed-quiz';out.gameContent={questions:[{q:'Choose the best title for the text',opts:['Daily Practice Makes English Easier','The History of Online Banking','How to Repair a Bicycle','A Recipe for Soup'],correct:0}]};}
  else if(m==='cefr'){const words=String(src).match(/\S+/g)||[];const avg=words.reduce((a,w)=>a+w.length,0)/Math.max(1,words.length);const lvl=avg>7.2?'C1':avg>6.2?'B2':avg>5.2?'B1':avg>4.4?'A2':'A1';out.text=`Estimated level: ${lvl}\nWords: ${words.length}\nAverage word length: ${avg.toFixed(1)}\n\nTeacher notes:\n- Shorten long sentences for lower levels.\n- Pre-teach 5-7 key words.\n- Add comprehension questions before production tasks.`;}
  else if(m==='gap'){const items=itemsForCount(voc,n);const t=topic().toLowerCase();const sentFrames=[w=>`One of the most important aspects of ${t} is ${w}.`,w=>`Teachers often explain ${w} when introducing this topic.`,w=>`Without a good understanding of ${w}, it is hard to make progress.`,w=>`${capitalize(w)} plays a key role in ${t} at all levels.`,w=>`Many learners find ${w} challenging at first, but practice helps.`,w=>`Experts suggest focusing on ${w} before moving to more advanced areas.`,w=>`A strong grasp of ${w} makes communication much more effective.`,w=>`Good ${w} is what separates beginners from more advanced students.`,w=>`In most courses, ${w} is introduced early because it forms the foundation.`,w=>`The ability to use ${w} correctly shows a high level of understanding.`];const pairs=items.map((x,i)=>{const frame=sentFrames[i%sentFrames.length];const full=frame(x.word);const gapped=full.replace(new RegExp('\\b'+x.word+'\\b','gi'),'_____');return{q:gapped,a:x.word,def:defFor(x.word)};});out.text=pairs.map((p,i)=>`${i+1}. ${p.q}\n   Answer: ${p.a}  [${p.def}]`).join('\n\n');out.gameType='fill-blank';out.gameContent={sentences:pairs.map(p=>`${p.q.replace('_____','___')}|${p.a}`)};}
  else if(m==='word-order'){const sentences=sentencesForCount(src,n);const scrambled=sentences.map(s=>{const words=s.trim().split(/\s+/);const shuffled=[...words].sort(()=>Math.random()-.5);return{original:s,shuffled:shuffled.join(' / ')};});out.text=scrambled.map((x,i)=>`${i+1}. ${x.shuffled}\nAnswer: ${x.original}`).join('\n\n');out.gameType='fill-blank';out.gameContent={sentences:scrambled.map(x=>`${x.shuffled}|${x.original}`)};}
  else if(m==='matching-halves'){const items=vocabItems(voc);const pairs=items.slice(0,n).map(x=>{const words=x.word.trim().split(/\s+/);const mid=Math.ceil(words.length/2);return{a:words.slice(0,mid).join(' '),b:words.slice(mid).join(' ')||x.def};});out.cards=pairs;out.text=`Match the halves:\n\nColumn A:\n${pairs.map((p,i)=>`${i+1}. ${p.a}`).join('\n')}\n\nColumn B:\n${[...pairs].sort(()=>Math.random()-.5).map((p,i)=>`${String.fromCharCode(65+i)}. ${p.b}`).join('\n')}\n\nAnswer key: ${pairs.map((p,i)=>`${i+1}→${p.a} ${p.b}`).join(', ')}`;out.gameType='memory-match';out.gameContent={pairs};}
  else if(m==='two-options'){const ws=wordsForCount(voc,n);const pool=[...topicBankItems().map(x=>x.word),...TOPIC_SEED_WORDS];out.text=ws.map((w,i)=>{const d=makeDistractors(w,pool,1)[0];const opts=Math.random()<0.5?[w,d]:[d,w];return `${i+1}. I think we should focus on ${opts[0]} / ${opts[1]} in this lesson.\nAnswer: ${w}`;}).join('\n\n');}
  else if(m==='grammar-rules'){const t=topic()||'Grammar point';const lv=level()||'B1';const tl=t.toLowerCase();const grCards=[{title:'📏 Grammar focus: '+t,text:'Level: '+lv+'\n\n📌 FORM\nAffirmative: Subject + [verb form] + ...\nNegative:     Subject + [aux] not + [base] + ...\nQuestion:     [Aux] + Subject + [base] + ...?\nShort answer: Yes, Subject + [aux]. / No, Subject + [aux] + not.\n\n📌 SIGNAL WORDS & TRIGGERS\nWe typically see '+tl+' when the sentence contains: already / yet / just / since / for / when / if / ...\n\n📌 MEANING & USE\nWe use '+tl+' to express:\n• Action/state in situation A: ...\n• Action/state in situation B: ...\n• Key distinction from similar structures: ...'},{title:'✅ Correct examples - study carefully',text:'1. ✅ ...\n2. ✅ ...\n3. ✅ ...\n4. ✅ ...\n5. ✅ ...\n\n💡 What do all these sentences have in common?\n   → ________________________________\n\n💡 Which word/phrase is the clue that '+tl+' is needed?\n   → ________________________________'},{title:'🔀 Contrast: '+t+' vs other structures',text:'Compare these pairs - what changes?\n\n'+tl.charAt(0).toUpperCase()+tl.slice(1)+' ↔ Alternative\n\n1a. ✅ ...\n1b. ✅ ...\n💬 Difference: ________________________________\n\n2a. ✅ ...\n2b. ✅ ...\n💬 Difference: ________________________________\n\n📌 KEY RULE: choose '+tl+' when ________________________________.'},{title:'❌ Common mistakes to avoid',text:'These errors appear in real student work at '+lv+' level:\n\n1. ✗ Wrong: ________________________________\n   ✓ Right: ________________________________\n   Why: ________________________________\n\n2. ✗ Wrong: ________________________________\n   ✓ Right: ________________________________\n   Why: ________________________________\n\n3. ✗ Wrong: ________________________________\n   ✓ Right: ________________________________\n   Why: ________________________________\n\n⚠️ Most common error type: ________________________________'},{title:'✏️ Practice A - controlled (form)',text:'Put the verb in brackets into the correct form.\n\n1. She _____ (never / visit) Paris before.\n2. They _____ (finish) the project last week.\n3. By 2030, we _____ (live) here for a decade.\n4. I _____ (not / see) him since Monday.\n5. _____ you _____ (ever / try) something like this?\n\nAnswer key:\n1. _____ 2. _____ 3. _____ 4. _____ 5. _____'},{title:'✏️ Practice B - personalised (meaning)',text:'Write your own sentences. Be creative and personal!\n\n1. Write one sentence that is 100% true about your life using '+tl+'.\n   → ________________________________\n\n2. Write one sentence about someone you know.\n   → ________________________________\n\n3. Write one sentence about the future or a plan.\n   → ________________________________\n\n★ Challenge: Write a short paragraph (4-5 sentences) on the topic "'+topic()+'" using '+tl+' at least twice.'},{title:'🗣 Speaking & communication task',text:'Work in pairs. You have 4 minutes total.\n\nRound 1 (1 min each): Tell your partner about a real experience using '+tl+'.\n\nRound 2 (1 min): Your partner asks 2 follow-up questions. You answer - both try to use '+tl+' naturally.\n\nRound 3 (1 min): Swap roles.\n\n💬 Useful starters:\n• "Actually, I have/had/will…"\n• "The last time I…"\n• "I have never… but I would like to…"\n• "By the time… I will have…"'},{title:'📊 Self-assessment & review',text:'Rate your confidence with '+tl+' (circle):\n\n I can RECOGNISE it in a text:     😕  😐  😊  ✅\n I can FORM it correctly:           😕  😐  😊  ✅\n I can USE it in my own speech:     😕  😐  😊  ✅\n I understand WHEN to use it:       😕  😐  😊  ✅\n\nMy main difficulty: ________________________________\nOne sentence I want to remember: ________________________________\n\n📌 Study tip: Write 5 personal examples tonight - grammar sticks when it is connected to your life.'}];out.text=grCards.map(c=>c.title+'\n'+c.text).join('\n\n');out.struct={boardKind:'cards',cards:grCards,items:null,questions:null};}
  else if(m==='error-correction'){out.text=repeatToCount([`She go to school every day. -> She goes to school every day.`,`I have saw this film. -> I have seen this film.`,`There is many people here. -> There are many people here.`,`He don't like coffee. -> He doesn't like coffee.`,`I am agree with you. -> I agree with you.`],n).map((x,i)=>`${i+1}. ${x}`).join('\n');}
  else if(m==='rewrite'){out.text=repeatToCount([`Rewrite using ${topic()}: I started learning English in 2022.`,`Rewrite using ${topic()}: She finished the task before lunch.`,`Rewrite using ${topic()}: They visited Madrid last year.`],n).map((x,i)=>`${i+1}. ${x}`).join('\n');}
  else if(m==='translation'){out.text=wordsForCount(voc,n).map((w,i)=>`${i+1}. Translate and use "${w}" in your own sentence.`).join('\n');}
  else if(m==='creative-writing'){out.text=`Writing task (${level()}): Write a short story about ${topic().toLowerCase()}. You must use these words: ${wordsForCount(voc,n).join(', ')}.\n\nChecklist: clear beginning, one problem, one solution, at least two connectors.`;}
  else if(m==='link-words'){out.text=`Use these words in connected sentences:\n${wordsForCount(voc,n).map((w,i)=>`${i+1}. ${w}`).join('\n')}\n\nChallenge: Every sentence should connect logically to the previous one.`;}
  else if(m==='discussion'){const items=itemsForCount(voc,Math.max(n,8));const t=topic().toLowerCase();const wordQs=items.slice(0,4).map(x=>[`What does "${x.word}" mean to you personally? Give a real example.`,`How does ${x.word} affect people in the context of ${t}?`,`Can you think of a situation where ${x.word} is especially important?`,`Do you think ${x.word} is easy or difficult to develop? Why?`]).flat();const topicQs=[`What do most people get wrong about ${t}?`,`How has ${t} changed in the last 10-20 years?`,`What is the biggest advantage of focusing on ${t}?`,`What challenges do people face when dealing with ${t}?`,`How could ${t} be improved or made more accessible?`,`What advice would you give a beginner in ${t}?`,`Compare ${t} in different countries or cultures you know.`,`If you could change one thing about ${t}, what would it be?`];const all=shuffle([...wordQs,...topicQs]);const qs=all.slice(0,n);out.text=qs.map((q,i)=>`${i+1}. ${q}`).join('\n\n');out.struct={boardKind:'quiz',questions:qs.map(q=>({type:'open',text:q,answer:'',points:1})),items:null,cards:null};}
  else if(m==='dialogue'){const tp=topic();const tl=tp.toLowerCase();const lv=level()||'B1';const ws=wordsForCount(voc,6);const wsStr=ws.join(', ')||'target words';const dlgCards=[{title:'🎭 Role-play context & scenario',text:'Topic: '+tp+' · Level: '+lv+'\n\nSCENARIO: Two people meet to discuss a problem connected to '+tl+'.\n\nCHARACTER A: A student / junior colleague who needs advice.\nCHARACTER B: A teacher / mentor who has experience with '+tl+'.\n\nSITUATION: A has been struggling with '+tl+' and asks B for practical help. The conversation should feel natural, not scripted.\n\n📌 Before you start: spend 1 minute thinking about what A\'s problem might be and what advice B could give.'},{title:'📖 Starter dialogue - read & analyse',text:'A: I\'ve been really struggling with '+tl+' lately. I don\'t know where to start.\nB: That\'s completely normal at this level. What exactly is the problem?\nA: I think I understand the theory, but I can\'t use it naturally in conversation.\nB: OK, let\'s break it down. Can you give me a specific example?\nA: Well, when I try to use '+tl+' in speaking, I either forget the rules or I overthink it.\nB: Right. The key is to practise in small steps. Let\'s make a plan together.\n\n💬 Discussion: What advice would you give A? What would be the most useful next step?'},{title:'✏️ Task A - continue the dialogue',text:'Continue the conversation for 8 more lines. Person B gives practical advice.\nInclude at least 3 of these words naturally: '+wsStr+'.\n\nA: _______________________________________________\nB: _______________________________________________\nA: _______________________________________________\nB: _______________________________________________\nA: _______________________________________________\nB: _______________________________________________\nA: _______________________________________________\nB: _______________________________________________\n\n⭐ Make it feel like a REAL conversation - use contractions, natural responses, follow-up questions.'},{title:'✏️ Task B - alternative scenario',text:'Now role-play a DIFFERENT version. Same characters, different situation.\n\nNew scenario: A wants to improve '+tl+' but has very little time. B helps them find a realistic plan.\n\nWrite 6 lines:\nA: _______________________________________________\nB: _______________________________________________\nA: _______________________________________________\nB: _______________________________________________\nA: _______________________________________________\nB: _______________________________________________\n\n🔄 Swap roles with your partner and do it again - is the dialogue different?'},{title:'🔑 Useful language bank',text:'ASKING FOR ADVICE:\n• "I\'m not sure how to…"\n• "Could you explain how I should…?"\n• "What would you do if you were me?"\n• "Do you think it\'s better to…?"\n\nGIVING ADVICE:\n• "Have you tried…?"\n• "One thing that really helps is…"\n• "I\'d strongly recommend…"\n• "What I usually do is…"\n• "It might be worth…"\n\nRESPONDING NATURALLY:\n• "That makes sense."\n• "I hadn\'t thought of it that way."\n• "I\'m not sure about that - could you explain?"\n• "That\'s exactly my problem!"\n\nFOLLOW-UP QUESTIONS:\n• "And what happens after that?"\n• "But what if…?"\n• "How long did it take you?"'},{title:'📊 Performance self-assessment',text:'After the role-play, rate yourself honestly:\n\n💬 Fluency - I spoke without long pauses:            ⬜ 1  ⬜ 2  ⬜ 3  ⬜ 4  ⬜ 5\n📚 Vocabulary - I used target words naturally:       ⬜ 1  ⬜ 2  ⬜ 3  ⬜ 4  ⬜ 5\n🔊 Pronunciation - my partner understood me clearly: ⬜ 1  ⬜ 2  ⬜ 3  ⬜ 4  ⬜ 5\n🔄 Interaction - I listened and responded well:      ⬜ 1  ⬜ 2  ⬜ 3  ⬜ 4  ⬜ 5\n📝 Accuracy - I used grammar correctly:              ⬜ 1  ⬜ 2  ⬜ 3  ⬜ 4  ⬜ 5\n\nWhat I did well: ________________________________\nWhat I want to improve: ________________________________\nOne phrase I want to remember: ________________________________'}];out.text=dlgCards.map(c=>c.title+'\n'+c.text).join('\n\n');out.struct={boardKind:'cards',cards:dlgCards,items:null,questions:null};}
  else if(m==='warmup'){out.text=repeatToCount(['Look at the title. What do you think the audio/video is about?','Which words do you expect to hear?','What do you already know about this topic?','What question do you want the speaker to answer?','Predict three details before listening.'],n).map((q,i)=>`${i+1}. ${q}`).join('\n');}
  else if(m==='media-questions'||m==='transcript'){const s=sentencesForCount(src,n);out.text=s.map((x,i)=>`${i+1}. Listening check: What does the speaker mean by: "${x.slice(0,90)}"?`).join('\n');}
  else if(m==='add-video'){out.text=`Video link: ${get('video-link')||'Add link'}\n\nTasks:\n${src}`;}
  else if(m==='simplify'){const sents=sentenceParts(src);const simpler=sents.map(simplifyText).join(' ');const upgraded=sents.map(upgradeText).join(' ');out.text=`Simplify / Upgrade Text (${level()})\n\n- SIMPLIFIED (easier) -\n${simpler}\n\n- UPGRADED (more advanced) -\n${upgraded}\n\nTeacher notes:\n- Compare both versions and ask which words changed and why.\n- Have students underline the linking words in the upgraded text.`;}
  else if(m==='reading-bits'){const labeled=sentenceParts(src).map((s,i)=>({n:i+1,s}));const shuffled=[...labeled].sort(()=>Math.random()-.5);out.text=`Reading: Bits and Pieces (${level()})\n\nPut the pieces in the correct order:\n\n${shuffled.map((x,i)=>`${String.fromCharCode(65+i)}. ${x.s}`).join('\n')}\n\nAnswer key (correct order): ${labeled.map(x=>String.fromCharCode(65+shuffled.findIndex(y=>y.n===x.n))).join(' → ')}`;out.gameType='fill-blank';out.gameContent={sentences:labeled.map((x,i)=>`Piece ${i+1}|${x.s}`)};}
  else if(m==='comm-situations'){const ws=wordsForCount(voc,n);const templates=['You are at a place connected to {t}. Start a conversation and use the word "{w}".','Imagine a problem related to {t}. Explain it to a partner using "{w}".','Ask your partner for advice about {t}. Try to use "{w}".','Role-play: one of you is a customer, the other works in {t}. Use "{w}".','You disagree with your partner about {t}. Politely argue your point using "{w}".','Make plans with your partner about {t}. Include the word "{w}".'];out.text=`Communicative Situations: ${topic()} (${level()})\n\n`+ws.map((w,i)=>`${i+1}. ${templates[i%templates.length].replace(/{t}/g,topic().toLowerCase()).replace(/{w}/g,w)}`).join('\n');}
  else if(m==='rephrase-word'){const ws=wordsForCount(voc,n);const bases=['The film was very interesting.','She is good at maths.','I couldn\'t sleep because of the noise.','They decided to leave early.','It is necessary to book in advance.','He didn\'t come because he was ill.','This is the best coffee I have ever had.','You should ask the teacher for help.'];out.text=`Rephrase Using the Word Given (${level()})\n\nRewrite each sentence so the meaning stays the same. You must use the word in CAPITALS.\n\n`+ws.map((w,i)=>`${i+1}. ${bases[i%bases.length]}\n   ${w.toUpperCase()}\n   ____________________________________`).join('\n\n');}
  else if(m==='four-opinions'){const tp=topic();const t=tp.toLowerCase();const lv=level()||'B1';const people=['Anna','Ben','Carla','David'];const tags=['(strongly agrees)','(partly agrees)','(disagrees)','(not sure / neutral)'];const stances=[`thinks ${t} is clearly beneficial and gives one strong reason why it matters.`,`sees clear benefits of ${t} but also points out one significant limitation.`,`believes ${t} causes more problems than it solves and gives two reasons.`,`cannot make up their mind and raises two important questions about ${t}.`];const voices=[`"${tp} is absolutely essential in today's world - without it, progress is simply impossible."`,'`"I can see why people value '+t+', but we also need to be realistic about its limitations."`',`"People overestimate the value of ${t} - there are real costs that most people ignore."`,`"I genuinely don't know what to think about ${t}. There are so many factors to consider."`];const foCards=[...people.map((p,i)=>({title:'💬 '+p+' '+tags[i],text:p+' '+stances[i]+'\n\n'+voices[i]+'\n\nTask: Write '+p+'\'s opinion in your own words (2-3 sentences). Add one reason they might give.\n\n"_______________\n_______________\n_______________"'})),{title:'🤔 Comprehension & analysis',text:'Answer these questions about the four opinions:\n\n1. Which opinion is the MOST optimistic about '+t+'? Why?\n   → _______________\n\n2. Which opinion is the MOST critical? What is the main argument?\n   → _______________\n\n3. Do Anna and Carla agree on anything? What?\n   → _______________\n\n4. What does David need to know before forming an opinion?\n   → _______________'},{title:'✍️ Your written response',text:'Whose opinion is closest to yours and why?\n\nWrite 100-130 words. Use this structure:\n\n📌 Paragraph 1 (agree with someone):\n"I most agree with [Name] because…"\n\n📌 Paragraph 2 (partly disagree with someone):\n"However, I think [Name] goes too far when they say… because…"\n\n📌 Paragraph 3 (your overall view):\n"Overall, I believe that '+t+' is… because…"\n\nUseful phrases:\n• "I think / believe / feel that…"\n• "On the other hand…"\n• "To some extent… but…"\n• "In my opinion, the most important point is…"\n\nMy response:\n________________________________________________\n________________________________________________\n________________________________________________'},{title:'🔥 Debate task',text:'Class debate - 8 minutes total:\n\n👥 Split into two groups:\n  Group A - argues FOR '+t+' (use Anna\'s and Ben\'s ideas)\n  Group B - argues AGAINST '+t+' (use Carla\'s and David\'s ideas)\n\n⏱ Timing:\n  • 2 min: Each group prepares 3 arguments\n  • 3 min: Group A presents → Group B responds (alternate turns)\n  • 3 min: Group B presents → Group A responds\n\nRules:\n✦ Listen carefully before responding.\n✦ Use phrases like "That\'s a fair point, but…" and "I\'d add that…"\n✦ No interrupting - wait for the speaker to finish.\n\nAfter the debate: which group was more persuasive? Why?'},{title:'📊 Language for expressing opinions',text:'AGREEING STRONGLY:\n• "I completely agree because…"\n• "Absolutely - and another reason is…"\n• "This is clearly the case because…"\n\nAGREEING PARTLY:\n• "That\'s a fair point, but I also think…"\n• "To some extent, yes - however…"\n• "I see where you\'re coming from, but…"\n\nDISAGREEING POLITELY:\n• "I\'m not sure I agree - in my experience…"\n• "Actually, I think the opposite is true because…"\n• "That might be the case, but it\'s also worth considering…"\n\nASKING FOR CLARIFICATION:\n• "What exactly do you mean by…?"\n• "Could you give an example of…?"\n• "Do you mean that… or that…?"\n\n⭐ Aim: use at least 3 different expressions in today\'s discussion.'}];out.text=`Four Opinions: ${tp} (${lv})\n\n`+people.map((p,i)=>`${p} ${tags[i]}: ${stances[i]}`).join('\n\n')+`\n\nWriting task: Whose opinion is closest to yours? Write 100-130 words.`;out.struct={boardKind:'cards',cards:foCards,items:null,questions:null};}
  else if(m==='find-quotes'){const chosen=pick(QUOTE_BANK,Math.min(n,QUOTE_BANK.length));out.text=`Quotes for Discussion: ${topic()} (${level()})\n\n`+chosen.map((qt,i)=>`${i+1}. "${qt.q}" - ${qt.a}`).join('\n\n')+`\n\nTasks:\n- Which quote fits the topic "${topic()}" best? Explain why.\n- Rewrite one quote in your own words.\n- Do you agree or disagree with quote 1? Discuss in pairs.`;}
  else if(m==='essay-topics'){const tp=topic();const t=tp.toLowerCase();const lv=level()||'B1';const frames=[`To what extent do you agree that ${t} improves our lives? Give reasons and examples.`,`Discuss the advantages and disadvantages of ${t}. Which outweigh the other?`,`Some people think ${t} is overrated. Others disagree. Discuss both views and give your opinion.`,`How has ${t} changed in the last 20 years? What are the effects of this change?`,`Should ${t} be encouraged at school? Give your opinion with reasons and examples.`,`"${tp} is more of a problem than a solution." To what extent do you agree?`,`What are the most important effects of ${t} on society today?`,`Compare two different approaches to ${t}. Which is more effective and why?`];const qs=repeatToCount(frames,Math.max(n,4));const esCards=[{title:'✍️ Essay topics - choose one',text:qs.slice(0,Math.min(n,8)).map((q,i)=>`${i+1}. ${q}`).join('\n\n')},{title:'📐 Essay structure guide',text:'INTRODUCTION (30-40 words):\n• Open with a general statement about '+t+'.\n• Define the key terms.\n• State your thesis: "This essay will argue that…"\n\nBODY PARAGRAPH 1 - PROS / SIDE A (50-70 words):\n• Topic sentence: "One key advantage / argument is…"\n• Evidence or example: "For instance…"\n• Comment: "This shows that…"\n\nBODY PARAGRAPH 2 - CONS / SIDE B (50-70 words):\n• Concession: "However, critics argue that…"\n• Counter-argument: "While this is true, it is important to note that…"\n• Evidence: "For example…"\n\nCONCLUSION (30-40 words):\n• Restate thesis in new words.\n• Summarise main points.\n• Final thought or recommendation: "Overall, I believe that…"'},{title:'📚 Useful academic phrases',text:'INTRODUCING IDEAS:\n• "It is widely accepted that…"\n• "There is considerable debate about…"\n• "Many people believe that…"\n\nGIVING EVIDENCE:\n• "Research suggests that…"\n• "For example, in many countries…"\n• "A good illustration of this is…"\n\nCONTRASTING:\n• "However, it could be argued that…"\n• "On the other hand…"\n• "Despite this…"\n• "Whereas some people believe… others argue…"\n\nCONCLUDING:\n• "In conclusion, it is clear that…"\n• "To sum up, the evidence suggests…"\n• "On balance, I would argue that…"\n\nEMPHASISING:\n• "It is particularly important to note that…"\n• "Above all…"\n• "The most significant point is…"'},{title:'📊 Scoring criteria ('+lv+')',text:'CONTENT & IDEAS (25%):\n☐ Answers the question directly\n☐ Includes relevant, specific examples\n☐ Shows a clear personal opinion\n\nSTRUCTURE & COHESION (25%):\n☐ Has a clear introduction, body and conclusion\n☐ Uses linking words effectively\n☐ Each paragraph has one main idea\n\nVOCABULARY (25%):\n☐ Uses a range of topic vocabulary\n☐ Avoids repetition of basic words\n☐ Attempts advanced or precise language\n\nGRAMMAR & ACCURACY (25%):\n☐ Sentences are varied in length and structure\n☐ Tenses are used correctly\n☐ Errors do not impede communication\n\n📌 Target word count: 180-250 words'},{title:'✅ Self-editing checklist',text:'Before submitting your essay, check:\n\n📌 CONTENT:\n☐ I answered the specific question (not a different one).\n☐ I gave at least 2 different arguments or perspectives.\n☐ I used at least 2 concrete examples.\n☐ My opinion is clearly stated.\n\n📌 STRUCTURE:\n☐ My introduction sets up the topic and states my thesis.\n☐ Each body paragraph starts with a clear topic sentence.\n☐ My conclusion restates the main argument in different words.\n\n📌 LANGUAGE:\n☐ I used at least 5 topic vocabulary words.\n☐ I varied my sentence structure (short + long).\n☐ I used at least 3 linking phrases.\n☐ I checked for spelling errors.\n☐ I checked for subject-verb agreement.\n\n📌 WORD COUNT: _______ words (target: 180-250)'}];out.text=`Essay Topics: ${tp} (${lv})\n\n`+qs.slice(0,n).map((q,i)=>`${i+1}. ${q}`).join('\n')+`\n\nEach essay: 4 paragraphs, 180-250 words, with a clear thesis and examples.`;out.struct={boardKind:'cards',cards:esCards,items:null,questions:null};}
  else if(m==='lead-in'){const tp=topic();const t=tp.toLowerCase();const lv=level()||'B1';const ws=wordsForCount(voc,4);const liCards=[{title:'🔥 Prediction & curiosity (2-3 min)',text:'Choose ONE activity to open the lesson:\n\n🎯 Activity 1 - Word reveal\nWrite just the word "'+tp+'" on the board. Students brainstorm 8 connected words in 60 seconds. Which words appear most often?\n\n🎯 Activity 2 - Three clues\nGive three clues about '+t+' - from abstract to specific. Students guess the topic after each clue.\nClue 1: "This affects almost everyone…"\nClue 2: "It is connected to communication and progress…"\nClue 3: "Today we are studying '+t+'…"\n\n🎯 Activity 3 - Image / quote\nShow an image or quote connected to '+t+'. Students describe what they see and predict the lesson focus.'},{title:'👥 Personal connection (3-4 min)',text:'Pair talk - choose one question:\n\n💬 Question 1: "What do you already know about '+t+'? Rate your knowledge 1-5."\n\n💬 Question 2: "Have you ever had a personal experience with '+t+'? Tell your partner."\n\n💬 Question 3: "What is your first reaction when you hear the word \''+tp+'\'? Positive? Negative? Neutral?"\n\n💬 Question 4: "Do you think '+t+' is important in everyday life? When? Where?"\n\n📌 After pair talk: 2-3 students share with the class. Record interesting ideas on the board.'},{title:'📖 Vocabulary activation (3-4 min)',text:'Quick vocabulary warm-up before the main lesson:\n\n★ How many of these words do you know?\n'+(ws.length?ws.map((w,i)=>`   ${i+1}. ${w}  →  confident / uncertain / unknown`).join('\n'):'   Add vocabulary to activate vocabulary prediction.')+'\n\nTask:\n① With a partner, try to explain each word WITHOUT using the word itself.\n② Predict: which words will appear in today\'s lesson?\n③ After the lesson: were your predictions correct?\n\n💡 This is called "vocabulary pre-loading" - it helps new words stick faster.'},{title:'🎲 Engaging warm-up games (4-5 min)',text:'For high-energy openings - choose one:\n\n🎮 Two Truths and a Lie (about '+t+')\nTeacher says 3 statements - students vote on which is false. Then students create their own in pairs.\n\n🎮 Quick poll - stand up / sit down\n"Stand up if you think '+t+' is important. Stay standing if you use it daily. Sit if you\'ve ever had a problem with it."\n→ Great for energy and quick class survey data!\n\n🎮 Hot seat\nOne student sits facing away from the board. You write a word from '+t+' behind them. The class gives clues without saying the word. 2 minutes - how many can they guess?\n\n🎮 Fast five\nIn pairs: name 5 things related to '+t+' in 30 seconds. Ready? Go!'},{title:'📋 Teacher notes & timing guide',text:'RECOMMENDED SEQUENCE:\n① Choose 1 activity from Card 1 (prediction)   → 2-3 min\n② Run 1 activity from Card 2 (personal)        → 3-4 min\n③ Run vocabulary activation from Card 3        → 3-4 min\n\nTotal lead-in: approximately 8-10 minutes.\n\n📌 WHAT TO DO WITH STUDENT IDEAS:\n• Write key vocabulary on the board as students mention it.\n• Note interesting / surprising responses to use in the lesson.\n• If students already know a lot → adjust lesson to be more challenging.\n• If students know very little → do more pre-teaching before the input.\n\n📌 COMMON MISTAKES TO AVOID:\n✗ Don\'t turn lead-in into a test - it should feel low-stakes and curious.\n✗ Don\'t let one student dominate - use pair work and then feedback.\n✗ Don\'t rush - a good lead-in saves time later (engaged students learn faster).'}];out.text=`Lead-in Activities: ${tp} (${lv})\n\n`+liCards.map((c,i)=>`${i+1}. ${c.title}`).join('\n');out.struct={boardKind:'cards',cards:liCards,items:null,questions:null};}
  else if(m==='facts'){const tp=topic();const t=tp.toLowerCase();const lv=level()||'B1';const frames=[`Did you know that ${t} affects millions of people every day in ways most people never notice?`,`Many researchers suggest that ${t} has changed more in the last 20 years than in the previous century.`,`There is a surprising connection between ${t} and the way we communicate in everyday life.`,`The concept of "${tp}" exists in almost every culture, though people understand it differently.`,`Studies suggest that small, consistent changes related to ${t} can have a dramatic long-term impact.`,`${tp} has a history that goes back much further than most people realise.`,`Experts often disagree about the best approach to ${t} - there is no single "right" answer.`,`The way young people think about ${t} is very different from how older generations did.`];const fs=repeatToCount(frames,Math.max(n,5));const factCards=[{title:'💡 Interesting facts - true or false?',text:'Read each statement. Decide: could this be TRUE or is it probably FALSE? Discuss with a partner before reading further.\n\n'+fs.slice(0,Math.min(n,6)).map((f,i)=>`${i+1}. ${f}\n   My verdict: ☐ Probably true  ☐ Probably false  ☐ Not sure`).join('\n\n')},{title:'💬 Discussion questions',text:'After reading the facts, discuss these questions with a partner:\n\n1. Which fact surprised you the most? Why?\n2. Which fact do you find hardest to believe?\n3. Have you personally experienced anything related to these facts?\n4. If fact 1 is true - what are the implications for everyday life?\n5. Do you think things will change in the next 20 years? How?\n6. What question would you want to research further after reading this?\n\n📌 Try to give a reason for every answer - not just "yes" or "no".'},{title:'🔍 Fact-check research task',text:'Choose ONE fact from the list and research it:\n\n📌 YOUR CHOSEN FACT:\n"_______________"\n\nStep 1: Find one reliable source (article, video, report).\n   Source: _______________\n\nStep 2: Is the fact accurate, partly accurate, or inaccurate?\n   Verdict: _______________\n   Evidence: _______________\n\nStep 3: Find ONE additional fact about '+t+' that surprised you.\n   Your fact: "_______________"\n   Source: _______________\n\n📌 Bring your findings to the next class - share in 60 seconds.'},{title:'✍️ Writing & speaking tasks',text:'Choose ONE task:\n\n✍️ WRITING (80-100 words):\n"Write a short article about '+t+' for a student magazine. Include one surprising fact and your opinion. Start with a hook - a question, statistic, or bold statement."\n\n🗣 SPEAKING (2-3 min):\n"Give a mini-presentation: What I know about '+t+' and what I found out today. Include one fact that surprised you and explain why."\n\n🎯 CHALLENGE:\n"Create your own \'interesting facts\' card about '+t+'. Write 3 facts - one TRUE, one FALSE, one UNCERTAIN. Swap with a partner to test them."\n\n📌 Checklist:\n☐ I used topic vocabulary.\n☐ I included my opinion.\n☐ I referenced at least one specific detail.'},{title:'📋 Teacher notes',text:'HOW TO USE THIS MATERIAL:\n\n① Prediction stage (5 min)\nStudents read facts silently and predict true/false individually before discussing.\n\n② Pair discussion (5 min)\nPairs compare verdicts - encourage disagreement! "Why do you think that?"\n\n③ Whole-class share (3 min)\nAsk: which fact was most debated? Which had the most surprising verdict?\n\n④ Extension: research task (homework)\nSend students away to verify one fact and find a new one.\n\n📌 IMPORTANT: these facts are discussion starters, not verified data. Encourage students to be sceptical and curious - that is the real skill being practised.\n\n📌 LANGUAGE FOCUS: expressions of probability:\n• "That could be true because…"\n• "That seems unlikely - I\'d expect…"\n• "I\'m not sure - it depends on…"'}];out.text=`Interesting Facts: ${tp} (${lv})\n\n`+fs.slice(0,n).map((f,i)=>`${i+1}. ${f}`).join('\n')+`\n\nTeacher note: discussion starters - students check and find one real fact for homework.`;out.struct={boardKind:'cards',cards:factCards,items:null,questions:null};}
  else if(m==='pros-cons'){const tp=topic();const items=itemsForCount(voc,8);const t=tp.toLowerCase();const lv=level()||'B1';const k=Math.min(Math.max(4,Math.ceil(n/2)),6);const proFrames=[w=>`Developing ${w} significantly improves overall outcomes in ${t}.`,w=>`Good ${w} helps learners communicate more confidently and accurately.`,w=>`${capitalize(w)} creates genuine opportunities for measurable growth in ${t}.`,w=>`Practising ${w} consistently leads to faster and deeper progress.`,w=>`Understanding ${w} gives students a clear advantage at higher levels.`,w=>`${capitalize(w)} makes learning ${t} more engaging, motivating and effective.`];const conFrames=[w=>`Building strong ${w} takes considerable time and sustained daily effort.`,w=>`Without expert guidance, developing ${w} can be frustrating and slow.`,w=>`Overemphasis on ${w} may cause other equally important skills to be neglected.`,w=>`${capitalize(w)} levels vary widely between learners and are difficult to assess fairly.`,w=>`Not all learners find ${w} easy to acquire - it may depend on learning style.`,w=>`Testing ${w} in formal exams can create unnecessary pressure and anxiety.`];const pros=items.slice(0,k).map((x,i)=>proFrames[i%proFrames.length](x.word));const cons=items.slice(0,k).map((x,i)=>conFrames[i%conFrames.length](x.word));const counters_pro=pros.map(p=>'However, it is important to acknowledge that this requires significant resources and sustained motivation.');const counters_con=cons.map(c=>'On the other hand, with the right approach and support, this challenge can be overcome.');out.text=`Pros and Cons: ${tp} (${lv})\n\nPROS:\n${pros.map(p=>`+ ${p}`).join('\n')}\n\nCONS:\n${cons.map(c=>`- ${c}`).join('\n')}\n\nSpeaking task: pick the strongest pro and the strongest con. Debate in pairs: is ${t} worth the time investment?`;const pcCards=[{title:'✅ Pros - arguments FOR '+tp,text:pros.map((p,i)=>`${i+1}. + ${p}`).join('\n')+'\n\n💡 Which pro is the MOST convincing? Star it and explain why.\n\n★ Most convincing: _______________\n   Because: _______________'},{title:'❌ Cons - arguments AGAINST '+tp,text:cons.map((c,i)=>`${i+1}. - ${c}`).join('\n')+'\n\n💡 Which con is the MOST serious? Star it and explain why.\n\n★ Most serious: _______________\n   Because: _______________'},{title:'⚖️ Counter-arguments - responding to the other side',text:'For each strong con, write a counter-argument:\n\n'+cons.slice(0,3).map((c,i)=>`Con ${i+1}: "${c}"\nCounter: "That\'s true, however… _______________"\n`).join('\n')+'For each strong pro, write a limitation:\n\n'+pros.slice(0,2).map((p,i)=>`Pro ${i+1}: "${p}"\nLimitation: "While this is often true, we should also consider… _______________"\n`).join('\n')},{title:'📝 Write a balanced paragraph',text:'Write a balanced opinion paragraph (100-130 words).\n\nStructure:\n📌 TOPIC SENTENCE: "There are both advantages and disadvantages to '+t+'."\n📌 PROS (2 sentences): "One major benefit is… Furthermore…"\n📌 CONS (2 sentences): "However, one significant drawback is… In addition…"\n📌 CONCLUSION (1-2 sentences): "On balance, I believe that '+t+' is… because…"\n\nRequirements:\n☐ Use linking words: however / furthermore / on the other hand / despite this\n☐ Include your own view in the conclusion\n☐ Use at least 3 words from the vocabulary list\n\nMy paragraph:\n________________________________________________'},{title:'🗣 Speaking debate task',text:'Structure a mini-debate with your partner - 6 minutes total:\n\n⏱ 1 min: Each person reads the pros and cons silently, picks their side.\n⏱ 2 min: PERSON A argues FOR '+t+' - uses at least 3 pros.\n⏱ 2 min: PERSON B argues AGAINST '+t+' - uses at least 3 cons + counter-arguments.\n⏱ 1 min: Together - what is the MOST BALANCED conclusion?\n\nUseful phrases:\n• "The strongest argument in favour is…"\n• "I would counter that by saying…"\n• "On balance, the evidence suggests that…"\n• "While [Name] is right that… I still believe…"\n\n⭐ After the debate: who made the most convincing case? Why?'}];out.struct={boardKind:'cards',cards:pcCards,items:null,questions:null};}
  else if(m==='type-gap'){const sents=sentencesForCount(src,n);const made=sents.map(s=>{const words=s.split(/\s+/);const idx=words.findIndex(w=>/^[a-zA-Z]{4,}$/.test(w));const ans=idx>=0?words[idx].replace(/[^a-zA-Z]/g,''):'';if(idx>=0)words[idx]='_____';return{q:words.join(' '),a:ans||'(any suitable word)'};});out.text=`Type a Word into the Gap (${level()})\n\nFill each gap with a suitable word.\n\n`+made.map((x,i)=>`${i+1}. ${x.q}`).join('\n')+`\n\nSuggested answers:\n`+made.map((x,i)=>`${i+1}. ${x.a}`).join('\n');out.gameType='fill-blank';out.gameContent={sentences:made.map(x=>`${x.q.replace('_____','___')}|${x.a}`)};}
  else if(m==='gaps-brackets'){const bases=['She _____ (go) to work by bus every morning.','They _____ (finish) the project last week.','By next year he _____ (live) here for a decade.','I _____ (never / see) such a beautiful place.','We _____ (wait) for an hour when the bus finally came.','If it rains, we _____ (stay) at home.'];const answers=['goes','finished','will have lived','have never seen','had been waiting','will stay'];const B=repeatToCount(bases,n),A=repeatToCount(answers,n);out.text=`Gaps with Brackets (${level()})\n\nPut the verb in brackets into the correct form.\n\n`+B.map((b,i)=>`${i+1}. ${b}`).join('\n')+`\n\nAnswer key:\n`+A.map((a,i)=>`${i+1}. ${a}`).join('\n');out.gameType='fill-blank';out.gameContent={sentences:B.map((b,i)=>`${b.replace('_____','___')}|${A[i]}`)};}
  else if(m==='word-bank'){const ws=wordsForCount(voc,n);const bank=[...ws].sort(()=>Math.random()-.5);out.text=`Fill in from the Word Bank (${level()})\n\nWord bank: ${bank.join(' · ')}\n\n`+ws.map((w,i)=>`${i+1}. I often think about _____ when I study ${topic().toLowerCase()}.`).join('\n')+`\n\nAnswer key:\n`+ws.map((w,i)=>`${i+1}. ${w}`).join('\n');out.gameType='fill-blank';out.gameContent={sentences:ws.map(w=>`I often think about ___ when I study ${topic().toLowerCase()}.|${w}`)};}
  else if(m==='summary-gapfill'){const text=sentenceParts(src).slice(0,Math.max(3,Math.ceil(n/2))).join(' ');const keys=extractKeywords(text,Math.min(n,8));let gapped=text;keys.forEach(k=>{gapped=gapped.replace(new RegExp('\\b'+k+'\\b','i'),'_____')});out.text=`Listening: Summary Gap-Fill (${level()})\n\nListen and complete the summary. Word bank: ${[...keys].sort(()=>Math.random()-.5).join(' · ')||'(add key words)'}\n\n${gapped}\n\nAnswer key: ${keys.join(', ')}`;out.gameType='fill-blank';out.gameContent={sentences:keys.map(k=>`... ${k} ...|${k}`)};}
  else if(m==='choose-summary'){const correct=`The text is mainly about ${topic().toLowerCase()} and its key points.`;out.text=`Choose the Right Summary (${level()})\n\nWhich summary best matches what you heard/read?\n\nA) ${correct}\nB) The text only gives instructions on how to repair a machine.\nC) The text is a personal letter to a friend about a holiday.\n\nAnswer: A`;out.gameType='speed-quiz';out.gameContent={questions:[{q:'Choose the best summary',opts:[correct,'The text only gives instructions on how to repair a machine.','The text is a personal letter about a holiday.','The text is a list of shopping items.'],correct:0}]};}
  else {out.text=src;}
  return out;}
function generate(){
  showHubGenerationState(
    'This legacy generator is unavailable',
    'Use AI, or provide text or vocabulary for a supported offline transformation.'
  );
  return null;
}
function parseGroups(text){return lines(text).map((line,i)=>{const [name,rest]=line.includes(':')?line.split(/:(.+)/):[`Group ${i+1}`,line];const words=(rest||'').split(',').map(s=>s.trim()).filter(Boolean);return {name:name.trim(),words:words.slice(0,8),odd:['umbrella','banana','airport','winter','keyboard'][i%5]}}).filter(g=>g.words.length)}
// True when the structured result has answers worth hiding for a student copy.
function ttHubHasKey(out){const s=out&&out.struct;if(!s||!Array.isArray(s.questions))return false;return s.questions.some(q=>q.type==='mcq'||q.type==='truefalse'||(q.type==='gap-fill'&&q.answer));}
// Styled, structured worksheet for the hub - mirrors the board's worksheet card
// (numbered questions, MCQ options with the correct one highlighted, T/F, gaps,
// matching, vocab). `showAns` toggles the answer key for student hand-outs.
// Inner list HTML for a structured result - shared by the on-page card and the
// A4 print document so both look identical. `showAns` toggles the answer key.
function ttStructListHtml(s,showAns){
  if(Array.isArray(s.questions)&&s.questions.length){
    return s.questions.map((q,i)=>{let a='';
      if(q.type==='mcq'&&Array.isArray(q.options)){a=`<div class="tt-ws-opts">${q.options.map(o=>{const ok=showAns&&o===q.answer;return `<div class="tt-ws-opt${ok?' correct':''}"><span class="tt-ws-mark">${ok?'✓':'○'}</span><span>${esc(o)}</span></div>`}).join('')}</div>`}
      else if(q.type==='truefalse'){a=`<div class="tt-ws-tf"><span class="tt-ws-tf-b${showAns&&q.answer?' on':''}">✅ True</span><span class="tt-ws-tf-b${showAns&&!q.answer?' on':''}">❌ False</span></div>`}
      else if(q.type==='gap-fill'){a=(showAns&&q.answer)?`<div class="tt-ws-ans">Answer: <b>${esc(q.answer)}</b></div>`:''}
      else if(q.type==='match'&&Array.isArray(q.pairs)){a=`<div class="tt-ws-match">${q.pairs.map(p=>`<span class="tt-ws-l">${esc(p.left)}</span><span class="tt-ws-r">${esc(p.right||'')}</span>`).join('')}</div>`}
      else if(q.type==='open'){a='<div class="tt-ws-open">______________________________</div>'}
      return `<div class="tt-ws-q"><div class="tt-ws-qh"><span class="tt-ws-num">${i+1}.</span>${esc(q.text||'')}</div>${a}</div>`}).join('');
  }
  if(Array.isArray(s.items)&&s.items.length){
    return s.items.map((it,i)=>{const d=it.example||it.definition||'';return `<div class="tt-ws-q"><div class="tt-ws-qh"><span class="tt-ws-num">${i+1}.</span><b>${esc(it.word||'')}</b></div>${(showAns&&d)?`<div class="tt-ws-ans">${esc(d)}</div>`:'<div class="tt-ws-open">______________________________</div>'}</div>`}).join('');
  }
  if(Array.isArray(s.cards)&&s.cards.length){
    // Universal section-color mapper (works for all tool types)
    function _hubSectionColor(title){
      const t=(title||'').toLowerCase();
      if(/aim|objective|goal|brief|focus|overview/.test(t))return'#0E0E10';
      if(/warm|starter|lead.in|hook|predict|curiosit/.test(t))return'#F59E0B';
      if(/vocab|word|term|glossar|activat/.test(t))return'#EC4899';
      if(/read|input|text|listen|present|comprehens|fact/.test(t))return'#10B981';
      if(/control|practice|exercise|gap|task [a-c]|[a-c]\.|drill|gap.fill|bracket|personalised/.test(t))return'#8B5CF6';
      if(/free|produc|speak|discuss|communicat|debate|role.play|scenario|dialogue/.test(t))return'#EF4444';
      if(/feed|error|correct|self.check|self.assess|success|reflect|how did/.test(t))return'#6366F1';
      if(/home|assign|submitt|research|fact.check/.test(t))return'#0EA5E9';
      if(/rule|grammar|structur|form|contrast|compare|signal/.test(t))return'#059669';
      if(/example|right|correct|starter.dialogue/.test(t))return'#16A34A';
      if(/mistake|wrong|common|avoid|error/.test(t))return'#DC2626';
      if(/pro|advantage|benefit/.test(t))return'#16A34A';
      if(/con |cons|disad|challenge|limit/.test(t))return'#DC2626';
      if(/counter|balance|both|weigh/.test(t))return'#0891B2';
      if(/write|writ|essay|creat|paragraph|topic/.test(t))return'#8B5CF6';
      if(/key|answer|note|teacher|timing|differentiat/.test(t))return'#6B7280';
      if(/student|name|date|info/.test(t))return'#9CA3AF';
      if(/personal|connect|experienc/.test(t))return'#F59E0B';
      if(/game|engaging|warm.up.game|fun|quiz/.test(t))return'#F59E0B';
      if(/fast.finish|extension|challenge|🏆/.test(t))return'#7C3AED';
      if(/assessment|scoring|criteria|success/.test(t))return'#0891B2';
      if(/checklist|submit|before/.test(t))return'#059669';
      if(/opinion|view|four|anna|ben|carla|david|agree|disagree/.test(t))return'#EF4444';
      if(/useful.language|language.bank|phrase/.test(t))return'#EC4899';
      if(/structure.*guide|structure|format/.test(t))return'#0E0E10';
      if(/academ|phrase|linking/.test(t))return'#8B5CF6';
      return'#0E0E10';
    }
    return s.cards.map(c=>{
      const col=_hubSectionColor(c.title||'');
      const body=esc(c.text||'').replace(/\n/g,'<br>').replace(/✅/g,'<span style="color:#16a34a">✅</span>').replace(/✦/g,'<span style="color:#f59e0b">✦</span>').replace(/❌/g,'<span style="color:#dc2626">❌</span>').replace(/☐/g,'<span style="color:#9CA3AF">☐</span>').replace(/★/g,'<span style="color:#F59E0B">★</span>').replace(/📌|💡|🗣|✍️|🔑|📝|📏|🎯|🔥|📖|📄|✏️|📋|📚|➡️/gu,s=>`<span>${s}</span>`);
      return `<div class="tt-ws-stage" style="border-left:4px solid ${col}"><div class="tt-ws-stage-head" style="color:${col}">${esc(c.title||'')}</div><div class="tt-ws-stage-body">${body}</div></div>`;
    }).join('');
  }
  return '';
}
function richWorksheetHtml(out,showAns){
  const s=out.struct,meta=`${out.level||'Mixed'} / ${(out.tags||[]).filter(Boolean).join(' / ')}`;
  const list=ttStructListHtml(s,showAns);
  if(!list)return worksheetHtml(out);
  return `<article class="worksheet"><header class="worksheet-head"><div><div class="worksheet-title">${esc(out.title||'TeachEd Worksheet')}</div><div class="worksheet-meta">${esc(meta)}${ttHubHasKey(out)?` · ${showAns?'Answer key':'Student copy'}`:''}</div></div><div class="tag">TeachEd</div></header><div class="tt-ws-list">${list}</div></article>`;
}
function toggleHubAnswers(){if(!lastOutput)return;lastOutput.showAnswers=lastOutput.showAnswers===false?true:false;renderResult(lastOutput);}
function worksheetHtml(out){const meta=`${out.level||'Mixed'} / ${(out.tags||[]).filter(Boolean).join(' / ')}`;const cardHtml=(out.cards&&out.cards.length&&!out.edited)?`<div class="worksheet-list">${out.cards.slice(0,60).map(c=>`<div class="worksheet-task"><b>${esc(c.a||c.word||c.name||'Item')}</b><br><span>${esc(c.b||c.def||c.note||(c.words?c.words.join(', '):''))}</span></div>`).join('')}</div>`:`<div class="worksheet-body">${esc(out.text||'')}</div>`;return `<article class="worksheet"><header class="worksheet-head"><div><div class="worksheet-title">${esc(out.title||'TeachEd Worksheet')}</div><div class="worksheet-meta">${esc(meta)}</div></div><div class="tag">TeachEd</div></header>${cardHtml}</article>`}
function editOutput(){if(!lastOutput){toast('Generate something first');return;}const current=lastOutput.text||((lastOutput.cards||[]).map(c=>`${c.a||c.word||c.name||''} - ${c.b||c.def||c.note||''}`).join('\n'));const body=document.getElementById('result-body');const strip=body.querySelector('.action-strip');const ws=body.querySelector('.worksheet');if(ws)ws.remove();const existing=document.getElementById('tt-editor');if(existing)existing.remove();const editor=document.createElement('div');editor.id='tt-editor';editor.innerHTML=`<textarea id="tt-edit-area" style="width:100%;min-height:340px;padding:16px;border:1.5px solid var(--line,#ddd);border-radius:16px;font:inherit;font-size:.95rem;line-height:1.6;resize:vertical;box-sizing:border-box;">${esc(current)}</textarea><div class="hero-actions" style="margin-top:10px;"><button class="btn lime" type="button" onclick="saveEdit()">Save changes</button><button class="btn ghost" type="button" onclick="renderResult(lastOutput)">Cancel</button></div>`;body.appendChild(editor);document.getElementById('tt-edit-area').focus();}
function saveEdit(){const ta=document.getElementById('tt-edit-area');if(!ta||!lastOutput)return;lastOutput.text=ta.value;lastOutput.edited=true;renderResult(lastOutput);toast('Changes saved - export or assign the edited version');}
function copyOutput(){if(!lastOutput)return;navigator.clipboard?.writeText(lastOutput.text).then(()=>toast('Copied'))}
function printOutput(){
  if(!lastOutput){toast('Generate something first');return}
  const out=lastOutput;
  const showAns=out.showAnswers!==false;
  // Structured results render as a styled worksheet; plain-text / card results
  // fall back to the same export HTML so Print and PDF always open a clean,
  // self-contained popup (never the whole page).
  const list=(out.struct&&ttStructListHtml(out.struct,showAns))||htmlForExport(out);
  const metaLine=[(out.tags||[]).filter(Boolean).join(' · '),out.level,ttHubHasKey(out)?(showAns?'Answer key':'Student copy'):''].filter(Boolean).join(' · ');
  const css=`*{box-sizing:border-box}body{font:14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#171420;margin:0;padding:32px 36px;background:#fff}
    h1{font-size:22px;margin:0 0 2px;letter-spacing:-.02em}.meta{font:600 11px ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;color:#7b7282;margin-bottom:18px}
    .tt-ws-q{border:1px solid #e6e7ee;border-radius:10px;padding:11px 13px;margin-bottom:10px;page-break-inside:avoid}
    .tt-ws-qh{font-size:14px;font-weight:600;line-height:1.45}.tt-ws-num{font-weight:650;margin-right:6px}
    .tt-ws-opts{display:flex;flex-direction:column;gap:4px;margin-top:8px}
    .tt-ws-opt{display:flex;align-items:center;gap:8px;font-size:13px;color:#444;padding:4px 9px;border-radius:7px;background:#f5f6fa}
    .tt-ws-opt.correct{background:#dcfce7;color:#15803d;font-weight:600}.tt-ws-mark{width:14px;text-align:center;opacity:.6}.tt-ws-opt.correct .tt-ws-mark{opacity:1}
    .tt-ws-tf{display:flex;gap:10px;margin-top:8px}.tt-ws-tf-b{font-size:12px;font-weight:600;padding:4px 12px;border-radius:7px;background:#f0f1f4;color:#9ca3af}.tt-ws-tf-b.on{background:#dcfce7;color:#15803d}
    .tt-ws-ans{font-size:13px;margin-top:7px;color:#15803d}.tt-ws-ans b{color:#15803d}.tt-ws-open{margin-top:9px;color:#c0c2cc;letter-spacing:1px}
    .tt-ws-match{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;margin-top:8px}.tt-ws-l{font-weight:600;color:#0E0E10}.tt-ws-card-txt{font-size:13px;line-height:1.55;color:#444;margin-top:6px}
    .tt-ws-stage{border-radius:12px;padding:13px 16px;margin-bottom:11px;page-break-inside:avoid;background:#fff;border:1.5px solid currentColor;border-left-width:4px;}
    .tt-ws-stage-head{font-size:14px;font-weight:700;letter-spacing:-.01em;margin-bottom:8px;}
    .tt-ws-stage-body{font-size:12.5px;line-height:1.65;color:#2d2e38;white-space:pre-wrap;}
    .task{border:1px solid #e6e7ee;border-radius:10px;padding:11px 13px;margin-bottom:10px;page-break-inside:avoid;font-size:13.5px;line-height:1.55}
    pre{white-space:pre-wrap;font:14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0}
    @media print{body{padding:0}@page{margin:1.6cm;size:A4}.tt-ws-stage,.tt-ws-q,.task{page-break-inside:avoid;}}`;
  const doc=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(out.title||'Worksheet')}</title><style>${css}</style></head><body><h1>${esc(out.title||'Worksheet')}</h1><div class="meta">${esc(metaLine)}</div>${list}</body></html>`;
  const w=window.open('','_blank');
  if(!w){toast('Allow pop-ups to print the worksheet');return}
  w.document.open();w.document.write(doc);w.document.close();w.focus();
  setTimeout(()=>{try{w.print()}catch(e){}},350);
}
function downloadOutput(){if(!lastOutput)return downloadText(`${slug(lastOutput.title)}.txt`, lastOutput.text)}
function downloadHtmlOutput(){if(!lastOutput)return;const doc=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(lastOutput.title)}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:820px;margin:40px auto;padding:0 22px;color:#181818;line-height:1.6}.sheet{border:1px solid #ddd;border-radius:20px;padding:28px}h1{letter-spacing:-.04em}.meta{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#777;margin-bottom:18px}pre{white-space:pre-wrap;font:inherit}.task{border:1px solid #eee;border-radius:14px;padding:12px 14px;margin:10px 0}@media print{body{margin:0;max-width:none}.sheet{border:0}}</style></head><body><main class="sheet"><h1>${esc(lastOutput.title)}</h1><div class="meta">TeachEd / ${esc(lastOutput.level||'Mixed')}</div>${htmlForExport(lastOutput)}</main></body></html>`;downloadText(`${slug(lastOutput.title)}.html`,doc)}
function htmlForExport(out){if(out.cards&&out.cards.length){return out.cards.map(c=>`<div class="task"><b>${esc(c.a||c.word||c.name||'Item')}</b><br>${esc(c.b||c.def||c.note||(c.words?c.words.join(', '):''))}</div>`).join('')}return `<pre>${esc(out.text||'')}</pre>`}
function downloadText(name,text){const blob=new Blob([text||''],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),400)}
function slug(s){return String(s||'teachedos-material').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'teachedos-material'}
function copyInputs(){const text=[get('topic'),get('source'),get('vocab')].filter(Boolean).join('\n\n');navigator.clipboard?.writeText(text).then(()=>toast('Inputs copied'))}


function practiceGameUrl(type){
  const map={
    'memory-match':'games/memory-match.html',
    'fill-blank':'games/fill-blank.html',
    'speed-quiz':'games/speed-quiz.html',
    'true-false':'games/true-false.html',
    'word-categories':'games/word-categories.html',
    'flashcards':'games/flashcards.html'
  };
  return map[type]||'games/index.html';
}
function openPracticeGame(){
  if(!lastOutput||!lastOutput.gameType){toast('This draft does not have a linked game yet');return;}
  sessionStorage.setItem('teachedos_pending_game_material',JSON.stringify({
    title:lastOutput.title,
    gameType:lastOutput.gameType,
    gameContent:lastOutput.gameContent,
    level:lastOutput.level,
    tags:lastOutput.tags,
    knowledgeBaseId:lastOutput.knowledgeBaseId||null,
    knowledgeBaseTitle:lastOutput.knowledgeBaseTitle||'',
    createdAt:new Date().toISOString()
  }));
  location.href=practiceGameUrl(lastOutput.gameType)+'?from=tools';
}

/* Матеріал на дошку їде СТРУКТУРОЮ, а не плоским текстом.
   
   Раніше сюди клалися лише title/text/level/tags, а out.struct - типізовані
   питання, пари й картки - викидався. Дошка через це робила один текстовий
   прямокутник 520x420 на будь-яку вправу: матчинг, ABCD і gap-fill ставали
   стіною тексту, і дошка навіть не знала, що їй дали вправу. Поля struct
   (boardKind/questions/items/cards) називаються рівно так само, як їх чекає
   worksheet-картка дошки, тож достатньо їх не втратити.
   
   showAnswers їде ОКРЕМИМ полем, а не запеченим у текст: у дошки є свій
   перемикач ключа на картці, і поки відповіді були частиною тексту, вчитель
   не міг їх сховати - а дошку показують класу з проєктора. */
/* Стабільний ідентифікатор матеріалу.

   Потрібен для двостороннього звʼязку: дошка запамʼятовує, з чого зроблена
   картка, і при повторній відправці не плодить копію. Для збереженого в
   бібліотеці беремо його власний id; для щойно згенерованого - id інструмента
   плюс відбиток вмісту, щоб та сама вправа мала той самий ключ, а
   перегенерована - новий. */
function ttMaterialKey(out){
  if (out && out.id) return out.id;
  const tool = (typeof activeTool !== 'undefined' && activeTool && activeTool.id) || out.kind || 'tool';
  const body = String(out && (out.text || '')).slice(0, 400);
  let h = 0;
  for (let i = 0; i < body.length; i++) { h = ((h << 5) - h + body.charCodeAt(i)) | 0; }
  return tool + ':' + (h >>> 0).toString(36);
}

function ttBoardPayload(out){
  return {
    materialKey: ttMaterialKey(out),
    toolId: (typeof activeTool !== 'undefined' && activeTool && activeTool.id) || '',
    toolTitle: (typeof activeTool !== 'undefined' && activeTool && activeTool.title) || '',
    title: out.title,
    /* Якщо вчитель ВИМКНУВ ключ у студії, текст має поїхати без відповідей.
       out.text у більшості інструментів зібраний один раз при генерації і
       перемикача не знає, а ttOutputPlainText його поважає - тож для вимкненого
       ключа беремо саме його. Інакше вчитель ховає відповіді, натискає «на
       дошку» і бачить їх там знову. */
    text: (out.showAnswers === false) ? ttOutputPlainText(out) : (out.text || ttOutputPlainText(out)),
    level: out.level,
    tags: out.tags,
    topic: out.topic || '',
    kind: out.kind || '',
    cat: out.cat || '',
    /* Текст, з якого зроблено завдання, їде разом із ним на дошку. Без нього
       картка на дошці знає СВОЇ питання, але не знає матеріалу - а отже її не
       можна перебрати на інший рівень CEFR, не вигадавши зміст наново. Обрізаємо:
       на дошці зберігається весь стан, і тягнути туди повний транскрипт кожної
       вправи немає потреби - для перегенерації вистачає цього шматка. */
    source: String((typeof get === 'function' && get('source')) || '').slice(0, 6000),
    struct: out.struct || null,
    showAnswers: out.showAnswers !== false,
    knowledgeBaseId: out.knowledgeBaseId || null,
    knowledgeBaseTitle: out.knowledgeBaseTitle || '',
    createdAt: new Date().toISOString(),
  };
}

function sendToBoard(){if(!lastOutput){toast('Generate something first');return}const payload=ttBoardPayload(lastOutput);if(!payload.text&&!payload.struct){toast('Nothing to add - generate content first');return}sessionStorage.setItem('teachedos_pending_tool_material',JSON.stringify(payload));location.href='board.html?addToolMaterial=1'}
function renderLibrary(){const grid=document.getElementById('library-grid');const q=(document.getElementById('library-search')?.value||'').toLowerCase().trim();const lib=readJson(TOOL_STORE,[]);const filtered=q?lib.filter(item=>`${item.title||''} ${item.text||''} ${(item.tags||[]).join(' ')}`.toLowerCase().includes(q)):lib;if(!lib.length){grid.innerHTML='<div class="panel" style="grid-column:1/-1;padding:24px;text-align:center;color:var(--muted);">No saved materials yet. Create a draft and press Save.</div>';return}if(!filtered.length){grid.innerHTML='<div class="panel" style="grid-column:1/-1;padding:24px;text-align:center;color:var(--muted);">No saved materials match this search.</div>';return}/* Пять одинаковых кнопок в ряд читались как один серый забор: глаз не за что
   зацепить, а «Delete» весил ровно столько же, сколько «View». Теперь у
   карточки есть порядок: открыть — главное действие, повторно использовать —
   рядом, копирование и выгрузка тише, удаление ушло крестиком в угол.
   Метка сверху — тем же моно-шрифтом, что кикер на бланке. */
grid.innerHTML=filtered.slice(0,32).map(item=>`<div class="library-item"><span class="library-kicker">${esc(String(item.level||'').trim()||'Material')}</span><button class="library-del" type="button" title="Delete" aria-label="Delete this material" onclick="deleteSaved('${item.id}')">×</button><h4>${esc(item.title)}</h4><p>${esc((item.text||'').slice(0,170))}${(item.text||'').length>170?'...':''}</p><footer><button class="btn sm" type="button" onclick="viewSaved('${item.id}')">View</button><button class="btn sm ghost" type="button" onclick="reuseSaved('${item.id}')">Use again</button><button class="library-mini" type="button" onclick="copySaved('${item.id}')">Copy</button><button class="library-mini" type="button" onclick="downloadSaved('${item.id}')">TXT</button></footer></div>`).join('')}
function copySaved(id){const item=readJson(TOOL_STORE,[]).find(x=>x.id===id);if(item)navigator.clipboard?.writeText(item.text||'').then(()=>toast('Copied'))}
function reuseSaved(id){const item=readJson(TOOL_STORE,[]).find(x=>x.id===id);if(!item)return;if(item.knowledgeBaseId)activeKnowledgeBaseId=item.knowledgeBaseId;if(item.toolId)selectTool(item.toolId);setTimeout(()=>{const lvl=document.getElementById('level');const top=document.getElementById('topic');if(lvl&&item.level)lvl.value=item.level;if(top&&item.tags&&item.tags[1])top.value=item.tags[1];saveActiveDraft();toast('Loaded saved material setup')},40)}
function downloadSaved(id){const item=readJson(TOOL_STORE,[]).find(x=>x.id===id);if(item)downloadText(`${slug(item.title)}.txt`,item.text||'')}
function deleteSaved(id){writeJson(TOOL_STORE,readJson(TOOL_STORE,[]).filter(x=>x.id!==id));renderLibrary();toast('Deleted')}
function sendSavedToBoard(id){const item=readJson(TOOL_STORE,[]).find(x=>x.id===id);if(!item)return;
  /* saveOutput кладе {...lastOutput}, тож у бібліотеці struct уже лежить -
     збережений матеріал їде на дошку тим самим шляхом, що й свіжий. */
  const payload=ttBoardPayload(item);
  if(!payload.toolId&&item.toolId)payload.toolId=item.toolId;
  sessionStorage.setItem('teachedos_pending_tool_material',JSON.stringify(payload));location.href='board.html?addToolMaterial=1'}
function exportLibrary(){const lib=readJson(TOOL_STORE,[]);downloadText('teachedos-teacher-tools-library.json',JSON.stringify(lib,null,2))}
function importLibrary(event){const file=event.target.files&&event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const incoming=JSON.parse(reader.result);if(!Array.isArray(incoming))throw new Error('bad');const current=readJson(TOOL_STORE,[]);writeJson(TOOL_STORE,[...incoming,...current].slice(0,160));renderLibrary();toast('Library imported')}catch{toast('Could not import this file')}event.target.value=''};reader.readAsText(file)}
function clearLibrary(){if(!confirm('Clear saved tool materials?'))return;writeJson(TOOL_STORE,[]);renderLibrary();toast('Library cleared')}
function scrollToLibrary(){document.getElementById('library-section').scrollIntoView({behavior:'smooth'})}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),1800)}
function addImageRow(){const id='img-'+Date.now()+'-'+Math.random().toString(36).slice(2,5);imageRows.push({id,word:'',image:'',note:''});renderImageRows()}
function removeImageRow(id){imageRows=imageRows.filter(r=>r.id!==id);renderImageRows()}
function updateImageRow(id,key,val){const r=imageRows.find(x=>x.id===id);if(r)r[key]=val}
function handleImageFile(id,input){const file=input.files&&input.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{updateImageRow(id,'image',reader.result);clearToolInputError();renderImageRows()};reader.readAsDataURL(file)}
function renderImageRows(){const wrap=document.getElementById('image-rows');if(!wrap)return;wrap.innerHTML=imageRows.map((r,i)=>`<div class="img-row"><label class="thumb" for="file-${r.id}">${r.image?`<img src="${esc(r.image)}" alt="${esc(r.word||'uploaded image')}">`:'Upload image'}<input class="sr-only" id="file-${r.id}" type="file" accept="image/*" onchange="handleImageFile('${r.id}',this)"></label><div style="display:grid;gap:8px"><input placeholder="Word" value="${esc(r.word)}" oninput="updateImageRow('${r.id}','word',this.value)"><input placeholder="Image URL or note" value="${esc(r.note)}" oninput="updateImageRow('${r.id}','note',this.value)"></div><button class="mini" type="button" onclick="removeImageRow('${r.id}')">×</button></div>`).join('')}
/* ════════════ Twee-style mechanics: AI engine, YouTube, export, assign ════════════ */
const TT_API_BASE = (window.TEACHED_API_BASE || ((location.hostname==='localhost'||location.hostname==='127.0.0.1')?'http://localhost:4000':((location.hostname==='teached.tech'||location.hostname.endsWith('.teached.tech'))?location.origin:'https://teached.tech')));

/* ── AI generation (optional, in-browser WebLLM - local, no API key) ── */
// Call the TeachEd cloud engine (Groq) for a real, tool-specific result. Returns
// the assembled envelope (boardKind + questions/items/cards) or null when the
// teacher isn't signed in / the engine is unavailable - same AI-first contract
// the board uses, so the hub no longer relies on local templates for quality.
// A couple of hub tool IDs differ from the server's catalog IDs.
// The original hub predates the board catalog, so a few display IDs need an
// explicit translation before they reach the strict server endpoint.
const TT_SERVER_ID_MAP={
  cefr:'cefr-checker',
  pairs:'word-definition-match',
  'translation-match':'word-translation-match',
  'text-vocab':'extract-vocab',
  'text-with-vocab':'text-topic-vocab',
  translation:'sentence-translation',
  warmup:'warmup-listening',
  'media-questions':'audio-video-questions',
  transcript:'transcript-helper',
  simplify:'simplify-text',
};
const TT_ENGINE_ID_MAP={
  pairs:'word-definition-match',
  'translation-match':'word-translation-match',
  'text-vocab':'extract-vocab',
  'text-with-vocab':'text-topic-vocab',
  translation:'sentence-translation',
  warmup:'warmup-listening',
  'media-questions':'audio-video-questions',
  transcript:'transcript-helper',
  simplify:'simplify-text',
};
// These paths are mechanical transformations. Every item comes from the text
// or vocabulary currently in the form, so no topic-only template is allowed.
const TT_LOCAL_TRANSFORM_TOOLS=new Set([
  'extract-vocab','word-definition-match','flashcards','sentences-vocab',
  'gap','word-order','matching-halves','word-bank','reading-bits',
  'summary-gapfill','type-gap','abcd-text','true-false','open-questions',
  'gaps-abcd','link-words',
]);
function ttCanGenerateLocal(){
  if(!activeTool)return false;
  const toolId=TT_ENGINE_ID_MAP[activeTool.id]||activeTool.id;
  if(!TT_LOCAL_TRANSFORM_TOOLS.has(toolId))return false;
  return Boolean(get('source')||get('vocab'));
}
function renderHubAiQuota(quota){
  const el=document.getElementById('tt-ai-quota');
  if(!el||!quota)return;
  el.style.display='';
  el.textContent=`AI allowance: ${quota.requests_remaining} requests left this month`;
}
async function loadHubAiQuota(){
  const token=localStorage.getItem('teachedos_token');
  if(!token)return;
  try{
    const r=await fetch(`${TT_API_BASE}/api/ai/quota`,{headers:{Authorization:'Bearer '+token}});
    const d=await r.json().catch(()=>null);
    if(r.ok&&d?.quota)renderHubAiQuota(d.quota);
  }catch(_){ }
}
loadHubAiQuota();
/* Виклик приймає інструмент і поля явно, бо студія «Vocabulary Workout» шле
   кілька різних інструментів з ОДНІЄЇ форми: activeTool там один на весь набір
   і сказати за конкретну вправу не може. Без аргументів усе працює як раніше -
   значення беруться з форми. */
async function requestServerHubAI(toolIdOverride,inputOverride){
  const token=localStorage.getItem('teachedos_token');
  if(!token)throw new Error('Sign in to create AI material.');
  const baseId=toolIdOverride||(activeTool&&activeTool.id);
  const serverId=TT_SERVER_ID_MAP[baseId]||baseId;
  const inp=inputOverride||null;
  let timer;
  try{
    const ctrl=new AbortController();timer=setTimeout(()=>ctrl.abort(),20000);
    const r=await fetch(`${TT_API_BASE}/api/ai/teacher-tool`,{method:'POST',signal:ctrl.signal,
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
      body:JSON.stringify({toolId:serverId,input:{
        level:(inp&&inp.level)||level(),
        count:(inp&&inp.count)||count(),
        topic:(inp&&inp.topic)||topic(),
        action:get('action'),
        source:inp?(inp.source||''):get('source'),
        vocab:inp?(inp.vocab||''):get('vocab'),
        extra:inp?(inp.extra||''):[get('extra'),lessonRouteContext()].filter(Boolean).join('\n\n')}})});
    const d=await r.json().catch(()=>null);
    if(!r.ok)throw new Error(d?.error||'AI could not create this material right now.');
    if(d?.quota)renderHubAiQuota(d.quota);
    if(!d?.output)throw new Error('AI returned no usable material.');
    return d.output;
  }finally{
    clearTimeout(timer);
  }
}

function showHubGenerationState(title,message){
  const body=document.getElementById('result-body');
  if(!body||lastOutput)return;
  body.innerHTML='';
  const state=document.createElement('div');
  state.className='result-empty';
  state.setAttribute('role','status');
  const copy=document.createElement('div');
  const heading=document.createElement('b');
  const detail=document.createElement('span');
  heading.textContent=title;
  detail.textContent=message;
  copy.append(heading,detail);
  state.appendChild(copy);
  body.appendChild(state);
}

// Reshape a server envelope into the flat item array aiResultToOutput() expects,
// so cloud results render (and yield game payloads) exactly like the WebLLM path.
function serverEnvelopeToArr(env){
  if(Array.isArray(env.items)&&env.items.length)
    return env.items.map(it=>({word:it.word,definition:it.definition||'',example:it.example||''}));
  if(Array.isArray(env.questions)&&env.questions.length){
    const qs=env.questions;
    if(qs[0]&&qs[0].type==='match'&&Array.isArray(qs[0].pairs))
      return qs[0].pairs.map(p=>({word:p.left,definition:p.right}));
    return qs.map(q=>{
      if(q.type==='mcq')return{text:q.text,options:q.options||[],answer:q.answer};
      if(q.type==='truefalse')return{text:q.text,answer:q.answer?'True':'False'};
      if(q.type==='gap-fill')return{text:q.text,answer:q.answer||''};
      return{text:q.text};
    });
  }
  if(Array.isArray(env.cards)&&env.cards.length)
    return env.cards.map(c=>({section:c.title,text:c.text}));
  return [];
}

async function generateWithAI(){
  if(!activeTool)return;
  try{
    const env=await requestServerHubAI();
    const arr=serverEnvelopeToArr(env);
    if(!arr.length)throw new Error('AI returned no usable material.');
    const input={level:env.level||level(),count:count(),topic:topic()};
    const out=aiResultToOutput(activeTool,arr,input);
    out.aiGenerated=true;if(env.title)out.title=env.title;
    out.struct={boardKind:env.boardKind,questions:env.questions||null,items:env.items||null,cards:env.cards||null};
    lastOutput=out;renderResult(out);toast('AI material ready');
  }catch(err){
    console.warn('[ai-generate]',err);
    showHubGenerationState(
      'AI could not create this material',
      'Your inputs are still here. Add more concrete source material and try again.'
    );
    toast('AI is unavailable. Your draft was not changed.');
  }
}
function aiResultToOutput(tool,arr,input){
  const out={title:tool.title,type:tool.mode,text:'',cards:[],gameType:tool.game||null,gameContent:null,level:input.level,tags:[tool.cat,input.topic],...knowledgeBaseMeta()};
  const has=k=>arr.some(x=>x&&x[k]!=null);
  if(has('options')){
    out.text=arr.map((x,i)=>`${i+1}. ${x.text||x.question||''}\n`+(x.options||[]).map((o,j)=>`   ${String.fromCharCode(65+j)}) ${o}`).join('\n')+`\nAnswer: ${x.answer!=null?x.answer:''}`).join('\n\n');
    out.gameType=tool.game||'speed-quiz';
    out.gameContent={questions:arr.map(x=>{const opts=(x.options||[]).map(String);let ci=opts.findIndex(o=>o===String(x.answer));if(ci<0)ci=0;return{q:x.text||x.question||'',opts,correct:ci};})};
  } else if(has('word')&&has('definition')){
    out.cards=arr.map(x=>({a:x.word,b:x.example?`${x.definition} (e.g. ${x.example})`:x.definition}));
    out.text=arr.map((x,i)=>`${i+1}. ${x.word} - ${x.definition}${x.example?`\n   e.g. ${x.example}`:''}`).join('\n');
    out.gameType=tool.game||'memory-match';out.gameContent={pairs:arr.map(x=>({a:x.word,b:x.definition}))};
  } else if(has('answer')&&has('text')){
    out.text=arr.map((x,i)=>`${i+1}. ${x.text}\nAnswer: ${x.answer}`).join('\n\n');
    if(arr.some(x=>String(x.text).includes('_'))){out.gameType=tool.game||'fill-blank';out.gameContent={sentences:arr.map(x=>`${String(x.text).replace(/_+/g,'___')}|${x.answer}`)};}
  } else if(has('title')){
    out.text=arr.map((x,i)=>`${i+1}. ${x.title}`).join('\n');
  } else if(has('speaker')&&has('line')){
    out.text=arr.map(x=>`${x.speaker}: ${x.line}`).join('\n');
  } else if(has('words')&&has('odd')){
    out.text=arr.map((x,i)=>`${i+1}. ${(x.words||[]).join(', ')}\nOdd one out: ${x.odd}${x.reason?` (${x.reason})`:''}`).join('\n\n');
    out.gameType='speed-quiz';out.gameContent={questions:arr.map(x=>{const opts=(x.words||[]).map(String);let ci=opts.findIndex(o=>o===String(x.odd));if(ci<0)ci=0;return{q:`Which word is the odd one out: ${opts.join(', ')}?`,opts,correct:ci};})};
  } else if(has('category')&&has('word')){
    const cats={};arr.forEach(x=>{(cats[x.category]=cats[x.category]||[]).push(x.word)});
    out.text=Object.entries(cats).map(([c,ws])=>`${c}: ${ws.join(', ')}`).join('\n');
    out.gameType='word-categories';out.gameContent={categories:Object.entries(cats).map(([name,words])=>({name,words}))};
  } else if(has('section')&&has('text')){
    out.text=arr.map(x=>`${x.section}\n${x.text}`).join('\n\n');
  } else if(has('stage')){
    out.text=arr.map(x=>`${x.stage}: ${x.task||x.text||''}`).join('\n\n');
  } else if(has('task')&&has('text')){
    out.text=arr.map(x=>`${x.task}: ${x.text}`).join('\n\n');
  } else if(has('collocation')){
    out.text=arr.map((x,i)=>`${i+1}. ${x.collocation}${x.example?` - ${x.example}`:''}`).join('\n');
  } else if(has('side')&&has('point')){
    out.text=arr.map(x=>`[${x.side}] ${x.point}`).join('\n');
  } else if(has('criterion')){
    out.text=arr.map(x=>`${x.criterion}\n  Excellent: ${x.excellent}\n  Good: ${x.good}\n  Needs work: ${x.needs_work||x.needs||''}`).join('\n\n');
  } else if(has('base')){
    out.text=arr.map(x=>`${x.base}: noun=${x.noun}, verb=${x.verb}, adj=${x.adjective}, adv=${x.adverb}`).join('\n');
  } else if(has('level')&&has('text')){
    out.text=arr.map(x=>`L${x.level}. ${x.text}`).join('\n');
  } else if(has('text')){
    out.text=arr.map((x,i)=>arr.length>1?`${i+1}. ${x.text}`:x.text).join('\n\n');
  } else { out.text=arr.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n'); }
  return out;
}

/* ── YouTube link → transcript (fills the source field) ── */
async function fetchYouTube(){
  const link=get('yt-link');const status=document.getElementById('yt-status');
  if(!link){if(status)status.textContent='Paste a YouTube link first.';return;}
  if(status)status.textContent='Fetching transcript…';
  try{
    const r=await fetch(`${TT_API_BASE}/api/ai/youtube-transcript?url=${encodeURIComponent(link)}`);
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Could not fetch transcript');
    const ta=document.getElementById('source');if(ta)ta.value=d.transcript;
    clearToolInputError();scheduleDraftSave();
    if(status)status.textContent=`Transcript loaded (${(d.transcript||'').split(/\s+/).length} words). Now choose how many items and Generate.`;
  }catch(err){if(status)status.textContent='Could not fetch transcript: '+err.message+'. You can paste it manually below.';}
}

/* ── Local speech-to-text for uploaded audio/video (Whisper in-browser) ── */
async function transcribeUpload(input){
  const file=input&&input.files&&input.files[0];const status=document.getElementById('stt-status');
  if(!file)return;
  if(!window._ttSTT||!_ttSTT.supported()){if(status)status.textContent='This browser cannot transcribe locally - use a YouTube link or paste the transcript below.';return;}
  if(status)status.textContent='Preparing transcription… (first run downloads a small model once)';
  try{
    const text=await _ttSTT.transcribe(file,(t,p)=>{if(status)status.textContent=t;});
    if(!text){if(status)status.textContent='No speech detected. Try another file or paste the transcript.';return;}
    const ta=document.getElementById('source');if(ta)ta.value=text;
    clearToolInputError();scheduleDraftSave();
    if(status)status.textContent=`Transcribed locally (${text.split(/\s+/).length} words). Now choose how many items and Generate.`;
  }catch(err){console.warn('[stt]',err);if(status)status.textContent='Could not transcribe this file: '+err.message+'. You can paste the transcript below.';}
}

/* ── Export: Word (.doc) and PDF ── */
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=()=>res();s.onerror=()=>rej(new Error('Failed to load '+src));document.head.appendChild(s);});}
function downloadWord(){
  if(!lastOutput){toast('Generate something first');return;}
  const html=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${esc(lastOutput.title)}</title></head><body style="font-family:Calibri,Arial,sans-serif;"><h1>${esc(lastOutput.title)}</h1><p style="color:#666">TeachEd / ${esc(lastOutput.level||'Mixed')}</p>${htmlForExport(lastOutput)}</body></html>`;
  const blob=new Blob(['﻿',html],{type:'application/msword'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${slug(lastOutput.title)}.doc`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),400);toast('Word document downloaded');
}
async function downloadPdf(){
  if(!lastOutput){toast('Generate something first');return;}
  // Use the rich print-window approach (same as printOutput) - much better than jsPDF plain text.
  // The user's browser saves it as PDF via the native print dialog (Cmd/Ctrl+P → Save as PDF).
  printOutput();
  toast('Use your browser\'s "Save as PDF" option in the print dialog');
}

/* ── Serialise any tool output to a complete, readable plain-text block so the
   handoff never loses the structured questions / answer key (the old code only
   passed out.text, which is empty for many AI/struct results). ── */
function ttOutputPlainText(out){
  if(!out)return '';
  const s=out.struct;const showAns=out.showAnswers!==false;
  if(s&&Array.isArray(s.questions)&&s.questions.length){
    return s.questions.map((q,i)=>{
      let line=`${i+1}. ${q.text||''}`;
      if(q.type==='mcq'&&Array.isArray(q.options)){
        line+='\n'+q.options.map((o,j)=>`   ${String.fromCharCode(65+j)}) ${o}`).join('\n');
        if(showAns&&q.answer!=null)line+=`\n   ✓ Answer: ${q.answer}`;
      } else if(q.type==='truefalse'){ if(showAns)line+=`\n   ✓ Answer: ${q.answer?'True':'False'}`; }
      else if(q.type==='gap-fill'){ if(showAns&&q.answer)line+=`\n   ✓ Answer: ${q.answer}`; }
      else if(q.type==='match'&&Array.isArray(q.pairs)){ line+='\n'+q.pairs.map(p=>`   ${p.left} - ${p.right||''}`).join('\n'); }
      else if(q.type==='open'){ line+='\n   ______________________________'; }
      return line;
    }).join('\n\n');
  }
  if(s&&Array.isArray(s.items)&&s.items.length){
    return s.items.map((it,i)=>`${i+1}. ${it.word||''}${(showAns&&(it.example||it.definition))?` - ${it.example||it.definition}`:''}`).join('\n');
  }
  if(s&&Array.isArray(s.cards)&&s.cards.length){
    return s.cards.map(c=>`${(c.title||'').toUpperCase()}\n${c.text||''}`).join('\n\n');
  }
  return out.text||'';
}

/* ── Assign generated material to students (hands off to Homework) ── */
function assignToStudents(){
  if(!lastOutput){toast('Generate something first');return;}
  sessionStorage.setItem('teachedos_tools_to_homework',JSON.stringify({title:lastOutput.title,instructions:ttOutputPlainText(lastOutput),level:lastOutput.level,tags:lastOutput.tags,knowledgeBaseId:lastOutput.knowledgeBaseId||null,knowledgeBaseTitle:lastOutput.knowledgeBaseTitle||'',createdAt:new Date().toISOString()}));
  location.href='homework.html?from=teacher-tools';
}

/* ── Share a public interactive link a student can open without an account ── */
async function shareLink(){
  if(!lastOutput){toast('Generate something first');return;}
  const token=localStorage.getItem('teachedos_token');
  if(!token){toast('Sign in as a teacher to create share links');return;}
  toast('Creating share link…');
  try{
    const r=await fetch(`${TT_API_BASE}/api/share`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({title:lastOutput.title,level:lastOutput.level,text:lastOutput.text,gameType:lastOutput.gameType,gameContent:lastOutput.gameContent,tags:lastOutput.tags,knowledgeBaseId:lastOutput.knowledgeBaseId||null,knowledgeBaseTitle:lastOutput.knowledgeBaseTitle||''})});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Failed to create link');
    const url=`${location.origin}/share.html?t=${encodeURIComponent(d.token)}`;
    navigator.clipboard?.writeText(url).catch(()=>{});
    showShareBanner(url);
  }catch(err){toast('Could not create link: '+err.message);}
}
function showShareBanner(url){
  const body=document.getElementById('result-body');if(!body)return;
  document.getElementById('tt-share-banner')?.remove();
  const div=document.createElement('div');div.id='tt-share-banner';
  div.style.cssText='margin:0 0 12px;padding:12px 14px;border:1.5px solid #C8E64A;background:rgba(200,230,74,.14);border-radius:14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
  div.innerHTML=`<b style="white-space:nowrap;">Share link ready (copied):</b><a href="${esc(url)}" target="_blank" rel="noopener" style="flex:1;min-width:160px;word-break:break-all;color:#3a5b00;">${esc(url)}</a><button class="btn sm ghost" type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(url)}');toast('Copied')">Copy</button>`;
  body.insertBefore(div,body.firstChild);
}

/* ── Quiet draft workflow ────────────────────────────────────────────────
   A generated worksheet is the important thing here. The previous result
   header put eleven equal-weight actions before it, so exporting started to
   compete with reviewing the lesson. Keep one clear next step visible and
   place the rest in an intentional overflow. Results are also saved as a
   rolling local draft - "Save" is no longer work the teacher has to remember. */
function saveOutput({silent=false}={}){
  if(!lastOutput)return false;
  const library=readJson(TOOL_STORE,[]);
  const knownId=lastOutput._libraryId||lastOutput.id||'';
  const existingIndex=knownId?library.findIndex(item=>item&&item.id===knownId):-1;
  const id=existingIndex>=0?library[existingIndex].id:(knownId||('tool-'+Date.now()));
  const now=new Date().toISOString();
  lastOutput._libraryId=id;
  const snapshot={...lastOutput,id,toolId:activeTool?.id||lastOutput.toolId||'',savedAt:existingIndex>=0?(library[existingIndex].savedAt||now):now,updatedAt:now};
  delete snapshot._libraryId;
  if(existingIndex>=0)library[existingIndex]={...library[existingIndex],...snapshot};
  else library.unshift(snapshot);
  writeJson(TOOL_STORE,library.slice(0,80));
  renderLibrary();
  if(!silent)toast('Saved to your library');
  return true;
}

function renderResult(out){
  if(!out)return;
  lastOutput=out;
  saveOutput({silent:true});
  const showAnswers=out.showAnswers!==false;
  const answerAction=ttHubHasKey(out)
    ?'<button class="result-menu-item" type="button" role="menuitem" onclick="toggleHubAnswers()">'+(showAnswers?'Hide answer key':'Show answer key')+'</button>'
    :'';
  const sourceNote=[
    out.aiGenerated?'AI-enhanced':'',
    out.knowledgeBaseTitle?'Based on '+esc(out.knowledgeBaseTitle):''
  ].filter(Boolean).join(' · ');
  const moreActions=
    '<details class="result-more-actions">'+
      '<summary class="btn sm ghost" aria-label="More draft actions">More</summary>'+
      '<div class="result-more-menu" role="menu">'+
        '<button class="result-menu-item" type="button" role="menuitem" onclick="editOutput()">Edit draft</button>'+
        '<button class="result-menu-item" type="button" role="menuitem" onclick="copyOutput()">Copy text</button>'+
        answerAction+
        (out.gameType?'<button class="result-menu-item" type="button" role="menuitem" onclick="openPracticeGame()">Open practice game</button>':'')+
        '<span class="result-menu-label">Export</span>'+
        '<button class="result-menu-item" type="button" role="menuitem" onclick="printOutput()">Print / PDF</button>'+
        '<button class="result-menu-item" type="button" role="menuitem" onclick="downloadWord()">Word document</button>'+
        '<button class="result-menu-item" type="button" role="menuitem" onclick="downloadOutput()">Text file</button>'+
        '<span class="result-menu-label">Send</span>'+
        '<button class="result-menu-item" type="button" role="menuitem" onclick="assignToStudents()">Assign to students</button>'+
        '<button class="result-menu-item" type="button" role="menuitem" onclick="shareLink()">Share link</button>'+
      '</div>'+
    '</details>';
  const actions=
    '<div class="result-actions">'+
      '<div class="result-autosave"><span aria-hidden="true"></span>Saved locally</div>'+
      '<div class="result-actions-controls">'+
        '<button class="btn sm lime result-primary" type="button" onclick="sendToBoard()">Add to board</button>'+
        moreActions+
      '</div>'+
    '</div>';
  const sheet=out.struct?richWorksheetHtml(out,showAnswers):worksheetHtml(out);
  const note=sourceNote?'<div class="result-context">'+sourceNote+'</div>':'';
  document.getElementById('result-body').innerHTML=actions+note+sheet;
}

function viewSaved(id){
  const item=readJson(TOOL_STORE,[]).find(entry=>entry.id===id);
  if(!item)return;
  lastOutput=item;
  document.body.classList.remove('tt-browsing');
  document.getElementById('workspace').classList.add('show');
  renderResult(lastOutput);
  document.getElementById('workspace').scrollIntoView({behavior:'smooth',block:'start'});
}

renderCounts();renderChips();renderPresetLevelChips();renderPresetPacks();renderRecentTools();renderTools();renderLibrary();renderKnowledgeBaseLevels();renderKnowledgeBases();

/* ?tool=<id> відкриває саме цей інструмент.

   Потрібне для зворотного ходу з дошки: картка памʼятає, яким інструментом
   зроблена, і кнопка на ній веде сюди. Без цього посилання привело б на хаб зі
   списком з 51 позиції, де потрібну довелося б шукати очима.

   Виклик стоїть тут, у кінці бутстрапу, а не в openFirstTool: та функція в
   коді визначена, але не викликається ніде - я спершу повісив приймання саме
   на неї, і воно, звісно, не спрацювало. */
(function ttOpenToolFromUrl(){
  let wanted='';
  try{ wanted=new URLSearchParams(location.search).get('tool')||''; }catch(_){ return; }
  if(!wanted) return;
  /* Let all deferred scripts finish booting before selecting the tool. Direct
     links from a board or Module Studio previously cleared the query string
     but could leave the form closed on a cold page load. */
  const openRequestedTool=()=>{
    const target=TOOLS.find(t=>t.id===wanted);
    if(!target) return;
    selectTool(target.id);
    try{
      const p=new URLSearchParams(location.search); p.delete('tool');
      const q=p.toString();
      history.replaceState({},'',location.pathname+(q?'?'+q:''));
    }catch(_){}
  };
  if(document.readyState==='complete')window.setTimeout(openRequestedTool,0);
  else window.addEventListener('load',openRequestedTool,{once:true});
})();

/* ══════════════════════════════════════════════════════════════════════════
   VOCABULARY WORKOUT - один список слів, набір вправ

   Досі кожна вправа була окремим інструментом: щоб відпрацювати список із
   уроку, вчитель відкривав «Word-Definition Matching», вставляв слова,
   генерував, відправляв на дошку - і повторював те саме шість разів, щоразу
   вставляючи той самий список наново. Тут список вставляється один раз, а
   галочки кажуть, що з нього зібрати.

   Своїх генераторів ця студія НЕ має - і не повинна мати. Кожна активність
   вказує на вже наявний інструмент, а зміст робить той самий спільний рушій
   (board-gen.js), яким живе решта хаба. Через це правило про якість лишається
   в силі: офлайн збираються тільки механічні перетворення списку (він у
   TT_LOCAL_TRANSFORM_TOOLS), а все, що вимагає вигадати зміст, іде через AI і
   без входу просто не пропонується як готове.                              */

/* engine: id для generateTeacherToolLocal (board-gen.js).
   server: id інструмента для /api/ai/teacher-tool.
   Активність або механічна (engine), або AI - третього не дано, і саме це
   визначає, чи потрібен вчителю вхід. */
const VOCAB_WORKOUT_ACTIVITIES=[
  {key:'match',      engine:'word-definition-match', title:'Match word to meaning', hint:'Pairs for matching, cards or a memory game.', game:'memory-match', cat:'vocabulary'},
  {key:'flashcards', engine:'flashcards',            title:'Flashcards',            hint:'Word on one side, meaning and an example on the other.', game:'flashcards', cat:'vocabulary'},
  {key:'sentences',  engine:'sentences-vocab',       title:'Example sentences',     hint:'One sentence per word, gap ready for practice.', game:'fill-blank', cat:'vocabulary'},
  /* «Fill from Word Bank» тут немає навмисно: його генератор без вихідного
     тексту віддає той самий список слово-значення, що й флешкартки, тільки під
     іншою назвою. Обіцяти вчителю пропуски і дати список - гірше, ніж не
     пропонувати вправу взагалі. */
  {key:'halves',     engine:'matching-halves',       title:'Matching halves',       hint:'Phrases split in two for students to rejoin; single words pair with their meaning.', game:'memory-match', cat:'grammar'},
  {key:'link',       engine:'link-words',            title:'Link words into sentences', hint:'Students connect two or three items in one sentence.', cat:'writing'},
  {key:'odd',        server:'odd-one-out',           title:'Odd one out',           hint:'Groups where one word does not belong.', game:'speed-quiz', cat:'vocabulary', ai:true},
  {key:'sorting',    server:'word-sorting',          title:'Word sorting',          hint:'Categories for drag-and-drop sorting.', game:'word-categories', cat:'vocabulary', ai:true},
  {key:'translate',  server:'word-translation-match',title:'Word-translation pairs',hint:'Bilingual pairs for matching.', game:'memory-match', cat:'vocabulary', ai:true},
  {key:'situations', server:'comm-situations',       title:'Communicative situations',hint:'Role-play cards that force the words into speech.', cat:'speaking', ai:true},
  {key:'writing',    server:'creative-writing',      title:'Writing prompt',        hint:'A task that requires the whole list.', cat:'writing', ai:true},
  {key:'discussion', server:'discussion',            title:'Discussion questions',  hint:'Questions built around the topic of the list.', cat:'speaking', ai:true},
];
const WORKOUT_PICK_STORE='teachedos_vocab_workout_picks';

function workoutSignedIn(){return Boolean(localStorage.getItem('teachedos_token'))}
function workoutActivity(key){return VOCAB_WORKOUT_ACTIVITIES.find(a=>a.key===key)||null}
function workoutSavedPicks(){
  const stored=readJson(WORKOUT_PICK_STORE,null);
  if(Array.isArray(stored)&&stored.length)return stored.filter(k=>workoutActivity(k));
  return ['match','flashcards','sentences'];
}
function vocabWorkoutPickerHtml(){
  const picked=new Set(workoutSavedPicks());
  const online=workoutSignedIn();
  const row=a=>{
    const on=picked.has(a.key)&&(!a.ai||online);
    const locked=a.ai&&!online;
    return '<label class="wk-pick'+(locked?' locked':'')+'">'
      +'<input type="checkbox" value="'+a.key+'"'+(on?' checked':'')+(locked?' disabled':'')+' onchange="rememberWorkoutPicks();workoutSyncTranslateLang()">'
      +'<span class="wk-pick-body"><b>'+esc(a.title)+'</b><span>'+esc(a.hint)+'</span></span>'
      +'<span class="wk-pick-tag">'+(a.ai?'AI':'offline')+'</span>'
      +'</label>';
  };
  const note=online?'':'<div class="hint" style="margin-top:8px;">Activities marked AI need you to be signed in - the rest are built from your list right here, offline.</div>';
  return '<div class="wk-picks" id="wk-picks">'+VOCAB_WORKOUT_ACTIVITIES.map(row).join('')+'</div>'+note;
}
function workoutSelectedKeys(){
  return [...document.querySelectorAll('#wk-picks input[type=checkbox]:checked')].map(el=>el.value);
}
function rememberWorkoutPicks(){writeJson(WORKOUT_PICK_STORE,workoutSelectedKeys())}

/* Мова перекладу для активності «Word-translation pairs». Поле сховане, доки
   активність не позначена: показувати його завжди означало б займати місце
   заради однієї галочки з дванадцяти. */
const WORKOUT_LANG_STORE='teachedos_vocab_workout_lang';
const WORKOUT_LANGS=['Ukrainian','Russian','Spanish','French','German','Polish','Italian','Turkish','Portuguese','Arabic','Chinese','Japanese','Korean'];
function workoutTranslateLangHtml(){
  const saved=readJson(WORKOUT_LANG_STORE,'Ukrainian');
  const opts=WORKOUT_LANGS.map(l=>'<option'+(l===saved?' selected':'')+'>'+esc(l)+'</option>').join('');
  return '<div class="field" id="wk-lang-field" style="display:none;margin-top:10px;"><label class="label" for="wk-lang">Translate into</label><select id="wk-lang" onchange="writeJson(\'teachedos_vocab_workout_lang\',this.value)">'+opts+'</select></div>';
}
function workoutSyncTranslateLang(){
  const field=document.getElementById('wk-lang-field');
  if(!field)return;
  field.style.display=workoutSelectedKeys().includes('translate')?'':'none';
}
function workoutTranslateLang(){return get('wk-lang')||readJson(WORKOUT_LANG_STORE,'Ukrainian')}

/* Список слів наперед заповнювати випадайкою збережених наборів - ті самі
   набори, що читають ігри за ?set=<id> (custom-sets.js). Порожній перелік
   наборів мовчить: показувати запит на порожнє сховище нема сенсу. */
function workoutSavedSetsHtml(){
  const sets=window.TEACHEDOS_CUSTOM?window.TEACHEDOS_CUSTOM.list():[];
  const kbs=allKnowledgeBases().filter(b=>b.entries&&b.entries.length);
  if(!sets.length&&!kbs.length)return '';
  const setOpts=sets.map(s=>'<option value="set:'+esc(s.id)+'">'+esc(s.icon||'📚')+' '+esc(s.name)+' ('+s.words.length+' words)</option>').join('');
  const kbOpts=kbs.map(b=>'<option value="kb:'+esc(b.id)+'">'+esc(b.icon||'KB')+' '+esc(b.title)+' ('+b.entries.length+' terms)</option>').join('');
  return '<div class="field full" style="margin-bottom:10px;"><label class="label" for="wk-load-set">Load an existing list</label><div style="display:flex;gap:8px;flex-wrap:wrap;"><select id="wk-load-set" style="flex:1;min-width:200px;"><option value="">Choose a saved set or knowledge base…</option>'+setOpts+kbOpts+'</select><button class="btn sm ghost" type="button" onclick="workoutLoadSavedSet()">Load into the list</button></div></div>';
}
function workoutLoadSavedSet(){
  const picked=get('wk-load-set');
  if(!picked)return;
  const [kind,id]=picked.split(/:(.+)/);
  const vocab=document.getElementById('vocab');
  if(!vocab)return;
  if(kind==='set'){
    const rec=window.TEACHEDOS_CUSTOM&&window.TEACHEDOS_CUSTOM.get(id);
    if(!rec){toast('Could not find that set');return}
    vocab.value=rec.words.map(w=>w.uk?(w.en+' - '+w.uk):w.en).join('\n');
    if(!get('topic'))document.getElementById('topic').value=rec.name;
    toast('Loaded "'+rec.name+'" - '+rec.words.length+' words');
  }else if(kind==='kb'){
    const base=allKnowledgeBases().find(b=>b.id===id);
    if(!base){toast('Could not find that knowledge base');return}
    /* НЕ kbVocabText(): той формат кладе приклад на власний рядок
       («  Example: …»), а рушій ділить список рядками - приклад став би
       окремим псевдословом. Тут кожен термін лишається одним рядком: переклад
       у дужках, приклад відкинуто (він живе в самій базі, не в списку слів). */
    vocab.value=base.entries.map(e=>e.term+' - '+e.definition+(e.translation?' ('+e.translation+')':'')).join('\n');
    if(!get('topic'))document.getElementById('topic').value=base.title;
    toast('Loaded "'+base.title+'" - '+base.entries.length+' terms');
  }
  scheduleDraftSave();
}

/* Метадані інструмента для ttEngineOutput/aiResultToOutput. Вони чекають на
   об'єкт із title/mode/game/cat - у каталозі TOOLS такого рядка немає, бо
   активність не є окремим інструментом хаба. */
function workoutToolMeta(a){return {id:'vocab-workout-'+a.key,title:a.title,mode:'vocab-workout',game:a.game||null,cat:a.cat||'vocabulary'}}

async function buildVocabWorkout(){
  if(workoutBusy){toast('Still building this set…');return}
  const vocab=get('vocab');
  if(!vocab){showToolInputError('vocab','Paste the word list first - every activity here is built from it.');return}
  const keys=workoutSelectedKeys();
  if(!keys.length){toast('Tick at least one activity');return}
  const activities=keys.map(workoutActivity).filter(Boolean);
  const offline=activities.filter(a=>!a.ai);
  const online=activities.filter(a=>a.ai);
  if(online.length&&!workoutSignedIn()){toast('Sign in to build the AI activities');}
  workoutBusy=true;setToolBusy(true,'Building the set…');
  workoutBlocks=[];
  const input={level:level(),count:count(),topic:topic(),vocab};
  try{
    if(offline.length&&await ttEnsureEngine()){
      offline.forEach(a=>{
        const block=workoutRunOffline(a,input);
        if(block)workoutBlocks.push(block);
      });
    }
    renderWorkout();
    /* AI-активності йдуть по одній і домальовуються по мірі готовності:
       кожна - окремий запит із власною квотою, і чекати всі мовчки означало б
       тримати вчителя перед порожнім екраном по 20 секунд на вправу. */
    if(online.length&&workoutSignedIn()){
      for(const a of online){
        renderWorkout(a.title);
        const block=await workoutRunAi(a,input);
        if(block)workoutBlocks.push(block);
        renderWorkout(a===online[online.length-1]?'':a.title);
      }
    }
  }finally{
    workoutBusy=false;setToolBusy(false);
    renderWorkout();
  }
  if(!workoutBlocks.length)toast('Nothing could be built from this list - add meanings after a hyphen and try again');
  else toast(workoutBlocks.length+' '+(workoutBlocks.length===1?'activity':'activities')+' ready');
}

function workoutRunOffline(a,input){
  try{
    const out=ttEngineOutput(workoutToolMeta(a),generateTeacherToolLocal({
      tool:{id:a.engine},source:'',vocab:input.vocab,topic:input.topic,level:input.level,count:input.count,
    }));
    if(!out)return null;
    out.title=a.title;out.workoutKey=a.key;out.showAnswers=true;
    return out;
  }catch(err){console.warn('[workout] local activity failed',a.key,err);return null}
}

async function workoutRunAi(a,input){
  try{
    /* Мова перекладу їде як «teacher note» - той самий канал, який читає
       промт на бекенді («translate into the language named in the teacher
       note»). Без цього AI-переклад завжди падав в українську за замовчуванням,
       і поле «Translate into» у формі не могло на нього вплинути. */
    const reqInput=(a.key==='translate')?{...input,extra:'Translate into '+workoutTranslateLang()+'.'}:input;
    const env=await requestServerHubAI(a.server,reqInput);
    const arr=serverEnvelopeToArr(env);
    if(!arr.length)return null;
    const out=aiResultToOutput(workoutToolMeta(a),arr,input);
    out.struct={boardKind:env.boardKind,questions:env.questions||null,items:env.items||null,cards:env.cards||null};
    out.aiGenerated=true;out.title=a.title;out.workoutKey=a.key;out.showAnswers=true;
    if(!out.gameContent)out.gameContent=ttGameContentFromStruct(out.gameType,out.struct);
    return out;
  }catch(err){
    console.warn('[workout] AI activity failed',a.key,err);
    toast('AI could not build "'+a.title+'" - the rest of the set is untouched');
    return null;
  }
}

function renderWorkout(pendingTitle){
  const body=document.getElementById('result-body');
  if(!body)return;
  if(!workoutBlocks.length&&!pendingTitle){
    /* Порожній стан теж дає «Add your own block» - набір не мусить починатися
       з тікнутих активностей: інколи вчителю потрібен лише один свій текстовий
       блок, і змушувати спершу натиснути «Build the set» без жодної галочки
       безглуздо. */
    body.innerHTML='<div class="result-empty"><div><b>Nothing built yet</b><span>Paste the list, tick the activities and press "Build the set" - or add your own block below.</span><button class="btn sm ghost" type="button" style="margin-top:14px;" onclick="workoutAddCustom()">+ Add your own block</button></div></div>';
    return;
  }
  const head='<div class="result-actions">'
    +'<div class="result-autosave"><span aria-hidden="true"></span>'+workoutBlocks.length+' in this set</div>'
    +'<div class="result-actions-controls">'
      +'<button class="btn sm lime result-primary" type="button" onclick="workoutToBoard()">Add all to board</button>'
      +'<button class="btn sm ghost" type="button" onclick="workoutAddCustom()">+ Add block</button>'
      +'<details class="result-more-actions"><summary class="btn sm ghost">More</summary><div class="result-more-menu" role="menu">'
        +'<button class="result-menu-item" type="button" onclick="workoutPrint()">Print / PDF the set</button>'
        +'<button class="result-menu-item" type="button" onclick="workoutDownloadWord()">Word document</button>'
        +'<button class="result-menu-item" type="button" onclick="workoutSaveLibrary()">Save to library</button>'
        +'<button class="result-menu-item" type="button" onclick="saveWorkoutWordSet()">Save word set for games</button>'
      +'</div></details>'
    +'</div></div>';
  const blocks=workoutBlocks.map((out,i)=>{
    const showAnswers=out.showAnswers!==false;
    const sheet=out.struct?richWorksheetHtml(out,showAnswers):worksheetHtml(out);
    const tools='<div class="wk-block-bar">'
      +'<span class="wk-block-n">'+(i+1)+'</span>'
      +'<b>'+esc(out.title||'Activity')+'</b>'
      +(out.aiGenerated?'<span class="wk-block-tag">AI</span>':'')
      +'<span style="flex:1"></span>'
      +'<button class="btn sm ghost" type="button" onclick="workoutEdit('+i+')">Edit</button>'
      +(ttHubHasKey(out)?'<button class="btn sm ghost" type="button" onclick="workoutToggleKey('+i+')">'+(showAnswers?'Hide key':'Show key')+'</button>':'')
      +(out.gameType&&out.gameContent?'<button class="btn sm ghost" type="button" onclick="workoutPlay('+i+')">Play</button>':'')
      +(workoutActivity(out.workoutKey)?'<button class="btn sm ghost" type="button" onclick="workoutRegenerate('+i+')" title="Rebuild this activity from the current word list">Refresh</button>':'')
      +'<button class="btn sm ghost" type="button" onclick="workoutMove('+i+',-1)" aria-label="Move up">↑</button>'
      +'<button class="btn sm ghost" type="button" onclick="workoutMove('+i+',1)" aria-label="Move down">↓</button>'
      +'<button class="btn sm ghost danger-text" type="button" onclick="workoutRemove('+i+')" aria-label="Remove">×</button>'
      +'</div>';
    return '<section class="wk-block" id="wk-block-'+i+'">'+tools+sheet+'</section>';
  }).join('');
  const pending=pendingTitle?'<div class="wk-pending">Building "'+esc(pendingTitle)+'" with AI…</div>':'';
  body.innerHTML=head+blocks+pending;
}

/* Набір не обмежений дванадцятьма активностями зі списку. Довільний текстовий
   блок - завдання, інструкція, посилання, що завгодно - стає карткою в тому
   самому наборі, тим самим шляхом (edit/move/remove/board/print). Це і є
   гнучкість: список активностей задає ЗВИЧНИЙ шлях, а не єдиний. */
function workoutAddCustom(){
  const title=window.prompt('Name this block','Custom task');
  if(title===null)return;
  const out={
    title:(title||'Custom task').trim()||'Custom task',
    text:'',
    workoutKey:'custom-'+Date.now().toString(36),
    level:level(),tags:['vocabulary',topic()],topic:topic(),cat:'vocabulary',
    showAnswers:true,edited:true,struct:null,gameType:null,gameContent:null,
  };
  workoutBlocks.push(out);
  renderWorkout();
  workoutEdit(workoutBlocks.length-1);
}

function workoutRemove(i){
  if(!workoutBlocks[i])return;
  workoutBlocks.splice(i,1);renderWorkout();toast('Activity removed');
}
function workoutMove(i,dir){
  const j=i+dir;
  if(!workoutBlocks[i]||!workoutBlocks[j])return;
  const t=workoutBlocks[i];workoutBlocks[i]=workoutBlocks[j];workoutBlocks[j]=t;
  renderWorkout();
}
function workoutToggleKey(i){
  const out=workoutBlocks[i];if(!out)return;
  out.showAnswers=out.showAnswers===false;renderWorkout();
}
function workoutEdit(i){
  const out=workoutBlocks[i];if(!out)return;
  const host=document.getElementById('wk-block-'+i);if(!host)return;
  const current=out.text||ttOutputPlainText(out);
  const sheet=host.querySelector('.worksheet');if(sheet)sheet.remove();
  if(host.querySelector('.wk-editor'))return;
  const editor=document.createElement('div');
  editor.className='wk-editor';
  editor.innerHTML='<textarea id="wk-edit-'+i+'" style="width:100%;min-height:240px;padding:14px;border:1.5px solid var(--line,#ddd);border-radius:16px;font:inherit;font-size:.95rem;line-height:1.6;resize:vertical;box-sizing:border-box;">'+esc(current)+'</textarea>'
    +'<div class="hero-actions" style="margin-top:10px;"><button class="btn sm lime" type="button" onclick="workoutSaveEdit('+i+')">Save changes</button><button class="btn sm ghost" type="button" onclick="renderWorkout()">Cancel</button></div>';
  host.appendChild(editor);
  const ta=document.getElementById('wk-edit-'+i);if(ta)ta.focus();
}
/* Правка тексту знімає структуру навмисно. Поки картка їде structом, на дошці
   малюються ПИТАННЯ, а не текст: збережеш правку - і вона нікуди не потрапить,
   бо дошка візьме старі questions. Відредагована вправа їде текстом - тим,
   що вчитель бачить перед собою. */
function workoutSaveEdit(i){
  const ta=document.getElementById('wk-edit-'+i);const out=workoutBlocks[i];
  if(!ta||!out)return;
  out.text=ta.value;out.edited=true;out.struct=null;out.gameContent=null;out.gameType=null;
  renderWorkout();toast('Saved - this activity now travels as your edited text');
}
/* Оновити одну картку набору, не перезбираючи весь список. Учитель часто
   править слова ПІСЛЯ першої збірки - додав приклад, прибрав зайве слово - і
   раніше єдиним способом побачити це в конкретній вправі було видалити її і
   натиснути «Build the set» заново, що перебудовує ВЕСЬ набір і губить ручні
   правки в інших блоках. Кнопка є лише там, де активність досі впізнавана
   (workoutActivity знаходить її за workoutKey) - у власного текстового блоку
   такого ключа немає, і оновлювати там нічого. */
async function workoutRegenerate(i){
  const out=workoutBlocks[i];
  const a=out&&workoutActivity(out.workoutKey);
  if(!a)return;
  if(a.ai&&!workoutSignedIn()){toast('Sign in to rebuild this activity');return}
  const vocab=get('vocab');
  if(!vocab){showToolInputError('vocab','Add the word list first');return}
  setToolBusy(true,'Rebuilding "'+a.title+'"…');
  try{
    const input={level:level(),count:count(),topic:topic(),vocab};
    const fresh=a.ai?await workoutRunAi(a,input):(await ttEnsureEngine())&&workoutRunOffline(a,input);
    if(!fresh){toast('Could not rebuild this activity');return}
    workoutBlocks[i]=fresh;
    renderWorkout();
    toast('"'+a.title+'" refreshed');
  }finally{
    setToolBusy(false);
  }
}

function workoutPlay(i){
  const out=workoutBlocks[i];
  if(!out||!out.gameType||!out.gameContent){toast('This activity has no linked game');return}
  sessionStorage.setItem('teachedos_pending_game_material',JSON.stringify({
    title:out.title,gameType:out.gameType,gameContent:out.gameContent,
    level:out.level,tags:out.tags,createdAt:new Date().toISOString(),
  }));
  location.href=practiceGameUrl(out.gameType)+'?from=tools';
}
function workoutPrint(){
  if(!workoutBlocks.length){toast('Build the set first');return}
  const title=(topic()||'Vocabulary workout');
  const parts=workoutBlocks.map((out,i)=>'<section class="task"><h2>'+(i+1)+'. '+esc(out.title||'Activity')+'</h2><pre>'+esc(out.text||ttOutputPlainText(out))+'</pre></section>').join('');
  const w=window.open('','_blank');
  if(!w){toast('Allow pop-ups to print the set');return}
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;max-width:820px;margin:36px auto;padding:0 22px;color:#181818;line-height:1.6}h1{letter-spacing:-.03em}h2{font-size:16px;margin:22px 0 8px}pre{white-space:pre-wrap;font:inherit}.task{border-top:1px solid #e6e6e6;padding-top:6px}@media print{body{margin:0}}</style></head><body><h1>'+esc(title)+'</h1>'+parts+'</body></html>');
  w.document.close();w.focus();w.print();
}
/* Той самий .doc-прийом, що й у downloadWord() для одиночного драфта, тільки
   на весь набір: кожен блок - свій заголовок і своя таблиця/список, зібрані в
   один документ замість дванадцяти окремих файлів. */
function workoutDownloadWord(){
  if(!workoutBlocks.length){toast('Build the set first');return}
  const title=topic()||'Vocabulary workout';
  const sections=workoutBlocks.map((out,i)=>`<h2>${i+1}. ${esc(out.title||'Activity')}</h2>${htmlForExport(out)}`).join('<hr style="margin:22px 0;border:none;border-top:1px solid #ddd;">');
  const html=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${esc(title)}</title></head><body style="font-family:Calibri,Arial,sans-serif;"><h1>${esc(title)}</h1><p style="color:#666">TeachEd / ${esc(level())}</p>${sections}</body></html>`;
  const blob=new Blob(['﻿',html],{type:'application/msword'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${slug(title)}.doc`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),400);toast('Word document downloaded');
}
function workoutSaveLibrary(){
  if(!workoutBlocks.length){toast('Build the set first');return}
  const lib=readJson(TOOL_STORE,[]);
  const stamp=new Date().toISOString();
  const items=workoutBlocks.map((out,i)=>({
    id:'wk-'+Date.now().toString(36)+'-'+i,
    toolId:'vocab-workout',
    title:(topic()?topic()+' · ':'')+(out.title||'Activity'),
    text:out.text||ttOutputPlainText(out),
    level:out.level,tags:out.tags,struct:out.struct||null,createdAt:stamp,
  }));
  writeJson(TOOL_STORE,[...items,...lib].slice(0,160));
  renderLibrary();
  toast('Saved '+items.length+' activities to the library');
}
/* Список як набір для ігор: усі games/*.html читають ?set=<id> з цього ж
   сховища, тож збережений набір відкривається в будь-якій грі каталогу, а не
   лише в тих, куди його передає ця студія. */
function saveWorkoutWordSet(){
  const words=vocabItems(get('vocab')).map(x=>({en:x.word,uk:(x.def&&x.def!=='teacher definition / translation')?x.def:''}));
  if(!words.length){showToolInputError('vocab','Add the word list before saving it as a set.');return}
  if(!window.TEACHEDOS_CUSTOM){toast('Word sets are unavailable on this page');return}
  const rec=window.TEACHEDOS_CUSTOM.save({name:topic()||'Word set '+new Date().toLocaleDateString(),words});
  toast('Saved as a word set - open it in any game');
  return rec;
}
/* Увесь набір їде на дошку однією посилкою. Кожна вправа лишається окремою
   карткою (дошка вміє розкладати їх сама), але переходів між сторінками рівно
   один - інакше сім вправ означали б сім разів «на дошку» і назад. */
function workoutToBoard(){
  if(!workoutBlocks.length){toast('Build the set first');return}
  const payload={
    title:(topic()||'Vocabulary workout'),
    level:level(),
    topic:topic(),
    createdAt:new Date().toISOString(),
    materials:workoutBlocks.map(out=>({
      materialKey:'workout:'+(out.workoutKey||'')+':'+ttMaterialKey(out),
      toolId:'vocab-workout',
      toolTitle:'Vocabulary Workout',
      title:out.title,
      text:(out.showAnswers===false)?ttOutputPlainText(out):(out.text||ttOutputPlainText(out)),
      level:out.level,tags:out.tags,topic:out.topic||topic(),
      kind:out.kind||'',cat:out.cat||'vocabulary',
      source:'',
      struct:out.struct||null,
      showAnswers:out.showAnswers!==false,
      createdAt:new Date().toISOString(),
    })),
  };
  sessionStorage.setItem('teachedos_pending_tool_material_set',JSON.stringify(payload));
  location.href='board.html?addToolMaterialSet=1';
}
