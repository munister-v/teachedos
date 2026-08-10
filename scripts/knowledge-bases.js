/*
 * TeachEd local knowledge bases.
 *
 * These are deliberately plain data: no API key, no network request and no
 * hidden prompt. A base can feed any teacher tool, be exported as JSON, or be
 * extended in this browser. Keep the entries concise enough to ship offline
 * and rich enough to produce a useful first draft.
 */
window.TEACHEDOS_KNOWLEDGE_BASES = [
  {
    id: 'travel-survival-a2',
    title: 'Travel Survival',
    subtitle: 'airport, hotel and polite problem-solving',
    level: 'A2',
    domain: 'Everyday English',
    icon: 'TR',
    accent: '#0891b2',
    defaultTool: 'lesson-pack',
    tags: ['travel', 'speaking', 'survival'],
    entries: [
      { term: 'boarding pass', definition: 'a document that lets you get on a plane', translation: 'посадочный талон', example: 'Could you check my boarding pass, please?' },
      { term: 'luggage', definition: 'bags and suitcases you take on a trip', translation: 'багаж', example: 'My luggage is too heavy.' },
      { term: 'reservation', definition: 'an arrangement to keep a room or seat for you', translation: 'бронирование', example: 'I have a reservation under the name Lee.' },
      { term: 'directions', definition: 'instructions that show how to get somewhere', translation: 'направления', example: 'Could you give me directions to the station?' },
      { term: 'delayed', definition: 'arriving or happening later than planned', translation: 'задержанный', example: 'The flight is delayed by two hours.' },
      { term: 'refund', definition: 'money returned to you after a cancellation or problem', translation: 'возврат денег', example: 'Can I get a refund for this ticket?' },
      { term: 'platform', definition: 'the raised area where you wait for a train', translation: 'платформа', example: 'The train leaves from platform four.' },
      { term: 'exchange', definition: 'to change one thing for another', translation: 'обменять', example: 'Can I exchange this room?' }
    ],
    grammar: 'Polite requests: Could I...? / Could you...? / I would like to... / Is it possible to...?',
    prompts: ['A flight is delayed and the passenger needs a new connection.', 'The hotel room is different from the reservation.', 'A tourist asks a stranger for directions.'],
    facts: ['Travel problems are useful because students can practise clarification, requests and calm problem-solving.', 'Role-play becomes more communicative when each person has a different goal.'],
    sourceText: 'A traveller arrives in a new city. Their flight is delayed, their luggage is missing, and the hotel address is difficult to find. They need to ask for help politely and explain the problem clearly.'
  },
  {
    id: 'job-interview-b1',
    title: 'Job Interview',
    subtitle: 'experience, strengths and confident answers',
    level: 'B1',
    domain: 'Work & Business',
    icon: 'JOB',
    accent: '#7c3aed',
    defaultTool: 'dialogue',
    tags: ['work', 'speaking', 'interview'],
    entries: [
      { term: 'experience', definition: 'knowledge or skill gained by doing a job or activity', translation: 'опыт', example: 'I have experience working with international clients.' },
      { term: 'strength', definition: 'a quality or skill that you do well', translation: 'сильная сторона', example: 'One of my strengths is clear communication.' },
      { term: 'achievement', definition: 'something successful that you have done', translation: 'достижение', example: 'My biggest achievement was leading a small project.' },
      { term: 'responsibility', definition: 'a duty that you are expected to manage', translation: 'обязанность', example: 'My main responsibility was supporting new customers.' },
      { term: 'deadline', definition: 'the latest time by which something must be finished', translation: 'крайний срок', example: 'We finished the campaign before the deadline.' },
      { term: 'reliable', definition: 'someone who can be trusted to do what they promise', translation: 'надёжный', example: 'My colleagues describe me as reliable.' },
      { term: 'adapt', definition: 'to change your behaviour for a new situation', translation: 'адаптироваться', example: 'I adapt quickly when priorities change.' },
      { term: 'feedback', definition: 'advice or information about how well you are doing', translation: 'обратная связь', example: 'I ask for feedback after important tasks.' }
    ],
    grammar: 'Answer structure: situation → action → result. Use past simple for the example and present simple for your general strengths.',
    prompts: ['Tell me about a difficult task you completed.', 'What is one strength you bring to a team?', 'Describe a time you received useful feedback.'],
    facts: ['The STAR structure (Situation, Task, Action, Result) helps learners give specific answers instead of general claims.', 'A good interview answer includes evidence, not only adjectives.'],
    sourceText: 'A candidate is preparing for an interview at an international company. They need to explain their experience, describe a strength, give an example of a challenge they solved, and ask one thoughtful question at the end.'
  },
  {
    id: 'present-perfect-b1',
    title: 'Present Perfect in Real Life',
    subtitle: 'life experience, recent news and unfinished time',
    level: 'B1',
    domain: 'Grammar',
    icon: 'PP',
    accent: '#2563eb',
    defaultTool: 'grammar-rules',
    tags: ['grammar', 'present-perfect', 'speaking'],
    entries: [
      { term: 'ever', definition: 'at any time in your life or before now', translation: 'когда-либо', example: 'Have you ever worked abroad?' },
      { term: 'never', definition: 'not at any time', translation: 'никогда', example: 'I have never tried surfing.' },
      { term: 'already', definition: 'before now or earlier than expected', translation: 'уже', example: 'She has already sent the email.' },
      { term: 'yet', definition: 'until now, usually in questions or negatives', translation: 'ещё', example: 'Have you finished the report yet?' },
      { term: 'just', definition: 'a very short time ago', translation: 'только что', example: 'They have just arrived.' },
      { term: 'for', definition: 'used with a period of time', translation: 'в течение', example: 'I have lived here for three years.' },
      { term: 'since', definition: 'used with the starting point of a period', translation: 'с', example: 'He has worked here since May.' },
      { term: 'recently', definition: 'not long ago', translation: 'недавно', example: 'We have recently changed the plan.' }
    ],
    grammar: 'Form: have/has + past participle. Use it for life experience, recent results and unfinished time. Use past simple with a finished past time.',
    prompts: ['Find someone who has tried something new this year.', 'Share three things you have done recently.', 'Correct the tense in short news updates.'],
    facts: ['Present perfect connects a past event to the present moment.', 'Finished time expressions such as yesterday and last year normally take the past simple.'],
    sourceText: 'A group of colleagues are sharing recent news and life experiences. They compare things they have done, things they have not done yet, and events that happened at a finished time last year.'
  },
  {
    id: 'sustainable-cities-b2',
    title: 'Sustainable Cities',
    subtitle: 'transport, energy and trade-offs',
    level: 'B2',
    domain: 'Society & Environment',
    icon: 'CITY',
    accent: '#16a34a',
    defaultTool: 'worksheet-builder',
    tags: ['environment', 'reading', 'debate'],
    entries: [
      { term: 'sustainable', definition: 'able to continue without causing serious damage', translation: 'устойчивый', example: 'The city needs a more sustainable transport system.' },
      { term: 'emissions', definition: 'gases released into the air', translation: 'выбросы', example: 'The policy aims to reduce carbon emissions.' },
      { term: 'renewable', definition: 'able to be replaced naturally', translation: 'возобновляемый', example: 'Wind is a renewable source of energy.' },
      { term: 'infrastructure', definition: 'the basic systems and structures a city needs', translation: 'инфраструктура', example: 'The city is investing in cycling infrastructure.' },
      { term: 'congestion', definition: 'a situation with too much traffic', translation: 'заторы', example: 'Congestion makes buses slower during rush hour.' },
      { term: 'incentive', definition: 'something that encourages people to act', translation: 'стимул', example: 'Free parking is a weak incentive to use public transport.' },
      { term: 'trade-off', definition: 'a balance between two benefits or problems', translation: 'компромисс', example: 'The policy involves a trade-off between cost and speed.' },
      { term: 'implement', definition: 'to put a plan or decision into action', translation: 'реализовать', example: 'The council will implement the plan next year.' }
    ],
    grammar: 'Argument language: The main benefit is... / However... / This would lead to... / A possible drawback is... / In the long term...',
    prompts: ['Design a low-emission neighbourhood.', 'Rank three transport policies and defend the order.', 'Write a balanced paragraph about one urban trade-off.'],
    facts: ['Sustainability discussions work best when students compare costs, benefits and unintended effects.', 'A strong argument separates evidence, prediction and personal preference.'],
    sourceText: 'Many cities are trying to reduce emissions by improving public transport, creating safe cycle lanes and using renewable energy. These changes can improve health and quality of life, but they require money, planning and public support.'
  },
  {
    id: 'food-health-a2',
    title: 'Food & Healthy Habits',
    subtitle: 'meals, routines and simple advice',
    level: 'A2',
    domain: 'Everyday English',
    icon: 'FOOD',
    accent: '#ea580c',
    defaultTool: 'essential-vocab',
    tags: ['food', 'health', 'kids-friendly'],
    entries: [
      { term: 'ingredient', definition: 'one of the foods used to make a dish', translation: 'ингредиент', example: 'The main ingredient is fresh tomato.' },
      { term: 'recipe', definition: 'instructions for cooking a dish', translation: 'рецепт', example: 'This recipe takes twenty minutes.' },
      { term: 'balanced', definition: 'including a healthy variety of things', translation: 'сбалансированный', example: 'Try to eat a balanced breakfast.' },
      { term: 'portion', definition: 'an amount of food for one person', translation: 'порция', example: 'The portions are quite large.' },
      { term: 'thirsty', definition: 'needing or wanting a drink', translation: 'испытывающий жажду', example: 'Drink water when you feel thirsty.' },
      { term: 'habit', definition: 'something you do regularly', translation: 'привычка', example: 'A short walk can become a healthy habit.' },
      { term: 'avoid', definition: 'to stay away from something', translation: 'избегать', example: 'Try to avoid skipping breakfast.' },
      { term: 'recommend', definition: 'to say that something is a good idea', translation: 'рекомендовать', example: 'I recommend adding more vegetables.' }
    ],
    grammar: 'Advice: You should... / You could... / Try to... / It is a good idea to... / You should avoid...',
    prompts: ['Plan a healthy lunch with five ingredients.', 'Give a friend three realistic habit suggestions.', 'Compare a quick meal with a balanced meal.'],
    facts: ['Advice is more useful when it is specific and realistic.', 'Students can practise countable and uncountable food nouns while planning meals.'],
    sourceText: 'A healthy routine does not need to be complicated. People can start with a balanced breakfast, drink enough water, add more vegetables and choose one small habit they can repeat every day.'
  },
  {
    id: 'daily-routines-a1',
    title: 'Daily Routines',
    subtitle: 'morning, work and evening habits',
    level: 'A1',
    domain: 'Everyday English',
    icon: 'DAY',
    accent: '#0891b2',
    defaultTool: 'lesson-pack',
    tags: ['daily life', 'speaking', 'beginner'],
    entries: [
      { term: 'wake up', definition: 'to stop sleeping', translation: 'просыпаться', example: 'I wake up at seven.' },
      { term: 'get dressed', definition: 'to put on your clothes', translation: 'одеваться', example: 'She gets dressed quickly.' },
      { term: 'have breakfast', definition: 'to eat the first meal of the day', translation: 'завтракать', example: 'We have breakfast at home.' },
      { term: 'go to work', definition: 'to travel to your place of work', translation: 'идти на работу', example: 'He goes to work by bus.' },
      { term: 'finish', definition: 'to complete something', translation: 'заканчивать', example: 'I finish work at five.' },
      { term: 'come home', definition: 'to return to your home', translation: 'приходить домой', example: 'They come home in the evening.' },
      { term: 'relax', definition: 'to rest and do something enjoyable', translation: 'отдыхать', example: 'I relax with music.' },
      { term: 'go to bed', definition: 'to go to your bed to sleep', translation: 'ложиться спать', example: 'The children go to bed at nine.' }
    ],
    grammar: 'Present simple: I/you/we/they work; he/she works. Use do/does for simple questions.',
    prompts: ['Put six routine actions in time order.', 'Interview a partner about their weekday.', 'Find one routine that is the same and one that is different.'],
    facts: ['Predictable routines give beginners repeated practice with present simple verbs.', 'Time phrases such as at seven and in the evening make short sentences clearer.'],
    sourceText: 'Anna wakes up at seven, gets dressed and has breakfast. She goes to work by bus. In the evening she comes home, relaxes with music and goes to bed at ten.'
  },
  {
    id: 'cafe-conversations-a2',
    title: 'Cafe Conversations',
    subtitle: 'ordering, preferences and paying politely',
    level: 'A2',
    domain: 'Everyday English',
    icon: 'CAFE',
    accent: '#ea580c',
    defaultTool: 'dialogue',
    tags: ['food', 'dialogue', 'politeness'],
    entries: [
      { term: 'menu', definition: 'a list of food and drinks', translation: 'меню', example: 'Could we see the menu, please?' },
      { term: 'order', definition: 'to ask for food or drink', translation: 'заказывать', example: 'Are you ready to order?' },
      { term: 'still or sparkling', definition: 'two ways to describe bottled water', translation: 'без газа или с газом', example: 'Would you like still or sparkling water?' },
      { term: 'allergic', definition: 'having a harmful reaction to a food', translation: 'имеющий аллергию', example: 'I am allergic to nuts.' },
      { term: 'side dish', definition: 'a smaller food served with the main dish', translation: 'гарнир', example: 'Can I have salad as a side dish?' },
      { term: 'bill', definition: 'the amount of money you need to pay', translation: 'счёт', example: 'Could we have the bill, please?' },
      { term: 'service charge', definition: 'an extra amount added for service', translation: 'сервисный сбор', example: 'Is the service charge included?' },
      { term: 'receipt', definition: 'a paper showing what you paid for', translation: 'чек', example: 'Could I have a receipt?' }
    ],
    grammar: 'Polite requests: Could I have...? / I would like... / Would you mind...? / Can we get...?',
    prompts: ['Role-play a customer with a food allergy.', 'Change an order politely after a mistake.', 'Compare ordering at a cafe and ordering online.'],
    facts: ['Role cards give each speaker a reason to continue the conversation.', 'Polite request frames are more useful when students personalise the item and problem.'],
    sourceText: 'Two friends visit a busy cafe. One wants a vegetarian meal and asks about nuts. They order drinks, check whether service is included and ask for the bill when they finish.'
  },
  {
    id: 'city-life-b1',
    title: 'City Life',
    subtitle: 'neighbourhoods, transport and quality of life',
    level: 'B1',
    domain: 'Society',
    icon: 'CITY',
    accent: '#2563eb',
    defaultTool: 'discussion',
    tags: ['city', 'speaking', 'opinions'],
    entries: [
      { term: 'neighbourhood', definition: 'an area where people live', translation: 'район', example: 'My neighbourhood has a small park.' },
      { term: 'convenient', definition: 'easy to use or reach', translation: 'удобный', example: 'The metro is convenient for commuters.' },
      { term: 'crowded', definition: 'full of people or traffic', translation: 'переполненный', example: 'The buses are crowded at eight.' },
      { term: 'rent', definition: 'money paid regularly to live in a property', translation: 'арендная плата', example: 'Rent is higher near the centre.' },
      { term: 'green space', definition: 'a park or area with plants in a city', translation: 'зелёная зона', example: 'Residents want more green space.' },
      { term: 'commute', definition: 'to travel regularly between home and work', translation: 'ездить на работу', example: 'I commute for forty minutes.' },
      { term: 'facility', definition: 'a building or service provided for a purpose', translation: 'объект инфраструктуры', example: 'The sports facility is open late.' },
      { term: 'quality of life', definition: 'how comfortable and healthy daily life is', translation: 'качество жизни', example: 'Clean air improves quality of life.' }
    ],
    grammar: 'Comparisons: more convenient than... / the most crowded... / not as expensive as... / would be better if...',
    prompts: ['Design the best neighbourhood for families.', 'Rank transport problems by urgency.', 'Defend one change that would improve your city.'],
    facts: ['Opinion tasks become stronger when students must rank options and explain the criteria.', 'City vocabulary naturally supports comparisons and cause-and-effect language.'],
    sourceText: 'Big cities offer jobs, transport and entertainment, but housing can be expensive and streets can be crowded. Many residents want safer cycling routes, more green space and reliable public services.'
  },
  {
    id: 'digital-wellbeing-b1',
    title: 'Digital Wellbeing',
    subtitle: 'screen habits, focus and healthy boundaries',
    level: 'B1',
    domain: 'Modern Life',
    icon: 'DIGI',
    accent: '#7c3aed',
    defaultTool: 'worksheet-builder',
    tags: ['technology', 'health', 'reading'],
    entries: [
      { term: 'notification', definition: 'an alert that tells you about a message or event', translation: 'уведомление', example: 'I turned off most notifications.' },
      { term: 'distraction', definition: 'something that takes your attention away', translation: 'отвлечение', example: 'A phone can be a serious distraction.' },
      { term: 'focus', definition: 'to give all your attention to something', translation: 'сосредоточиться', example: 'I focus better without alerts.' },
      { term: 'screen time', definition: 'time spent using a phone, computer or tablet', translation: 'экранное время', example: 'My screen time increased last week.' },
      { term: 'boundary', definition: 'a limit that protects your time or attention', translation: 'граница', example: 'No messages after nine is my boundary.' },
      { term: 'scroll', definition: 'to move through content on a screen', translation: 'листать', example: 'I sometimes scroll without a clear goal.' },
      { term: 'mindful', definition: 'paying careful attention to the present moment', translation: 'осознанный', example: 'Try to be mindful when you check your phone.' },
      { term: 'unplug', definition: 'to stop using digital devices for a while', translation: 'отключиться', example: 'We unplug at weekends.' }
    ],
    grammar: 'Cause and advice: If you mute alerts, you may focus better. You could set a boundary before bedtime.',
    prompts: ['Audit one day of screen habits.', 'Create a realistic phone-free routine.', 'Debate whether schools should teach digital wellbeing.'],
    facts: ['Students can discuss habits without sharing private data by using fictional profiles.', 'Small changes are easier to evaluate than vague advice to use technology less.'],
    sourceText: 'Digital tools help people work and stay connected, but constant notifications can interrupt focus. A simple plan may include turning off non-essential alerts, creating phone-free periods and keeping devices away from the bed.'
  },
  {
    id: 'remote-work-b2',
    title: 'Remote Work',
    subtitle: 'flexibility, collaboration and professional boundaries',
    level: 'B2',
    domain: 'Work & Business',
    icon: 'WORK',
    accent: '#0f766e',
    defaultTool: 'discussion',
    tags: ['business', 'work', 'debate'],
    entries: [
      { term: 'flexibility', definition: 'the ability to change or adapt easily', translation: 'гибкость', example: 'Flexibility is a major benefit of remote work.' },
      { term: 'productivity', definition: 'the amount of useful work completed', translation: 'продуктивность', example: 'The team measured productivity by outcomes.' },
      { term: 'collaboration', definition: 'working with others to achieve a result', translation: 'сотрудничество', example: 'Good collaboration needs clear tools.' },
      { term: 'asynchronous', definition: 'not happening at the same time', translation: 'асинхронный', example: 'Asynchronous updates reduce unnecessary meetings.' },
      { term: 'overlap', definition: 'a period when two schedules share the same time', translation: 'пересечение', example: 'We need two hours of time-zone overlap.' },
      { term: 'burnout', definition: 'extreme tiredness caused by prolonged stress', translation: 'выгорание', example: 'Clear boundaries can help prevent burnout.' },
      { term: 'accountability', definition: 'responsibility for completing an action', translation: 'ответственность', example: 'Each project needs clear accountability.' },
      { term: 'hybrid', definition: 'combining remote and in-person work', translation: 'гибридный', example: 'Our company uses a hybrid model.' }
    ],
    grammar: 'Nuanced discussion: Although... / Whereas... / This may be effective provided that... / The drawback is...',
    prompts: ['Build a fair remote-work policy.', 'Compare synchronous and asynchronous collaboration.', 'Respond to a colleague who feels isolated.'],
    facts: ['Remote-work discussions improve when students separate personal preference from measurable team outcomes.', 'Boundary language is useful in both business role-plays and real classroom communication.'],
    sourceText: 'Remote work can save commuting time and give employees more flexibility. However, teams must design clear communication routines, protect personal boundaries and make sure that remote colleagues are included in important decisions.'
  },
  {
    id: 'news-literacy-b2',
    title: 'News Literacy',
    subtitle: 'headlines, sources, evidence and bias',
    level: 'B2',
    domain: 'Media & Society',
    icon: 'NEWS',
    accent: '#be123c',
    defaultTool: 'worksheet-builder',
    tags: ['media', 'reading', 'critical thinking'],
    entries: [
      { term: 'headline', definition: 'the title of a news report', translation: 'заголовок', example: 'The headline leaves out important context.' },
      { term: 'source', definition: 'a person, document or place information comes from', translation: 'источник', example: 'Always check the original source.' },
      { term: 'claim', definition: 'a statement presented as true', translation: 'утверждение', example: 'The claim needs independent evidence.' },
      { term: 'evidence', definition: 'facts that support or challenge an idea', translation: 'доказательства', example: 'The article provides little evidence.' },
      { term: 'bias', definition: 'an unfair preference for one side', translation: 'предвзятость', example: 'The wording may reveal bias.' },
      { term: 'context', definition: 'information needed to understand a situation', translation: 'контекст', example: 'The quote changes meaning without context.' },
      { term: 'verify', definition: 'to check that something is accurate', translation: 'проверять', example: 'Readers should verify the image date.' },
      { term: 'misleading', definition: 'giving the wrong idea or impression', translation: 'вводящий в заблуждение', example: 'The graph is technically true but misleading.' }
    ],
    grammar: 'Reporting and caution: The article states... / It appears that... / This may suggest... / There is no clear evidence that...',
    prompts: ['Rewrite a dramatic headline neutrally.', 'Trace a claim back to its original source.', 'Compare two reports of the same event.'],
    facts: ['A source can be real but still incomplete or biased.', 'Separating observation, interpretation and judgement makes media analysis clearer.'],
    sourceText: 'A local report says that public transport use has increased after cheaper monthly passes were introduced. Before sharing the story, a careful reader checks the date, the data source, the comparison period and the wording of the headline.'
  },
  {
    id: 'climate-policy-c1',
    title: 'Climate Policy & Economics',
    subtitle: 'regulation, incentives and difficult trade-offs',
    level: 'C1',
    domain: 'Policy & Society',
    icon: 'CLIM',
    accent: '#15803d',
    defaultTool: 'discussion',
    tags: ['climate', 'policy', 'academic'],
    entries: [
      { term: 'regulation', definition: 'an official rule controlling an activity', translation: 'регулирование', example: 'The regulation limits industrial emissions.' },
      { term: 'incentive', definition: 'something that encourages a particular action', translation: 'стимул', example: 'A tax credit is an incentive for renovation.' },
      { term: 'subsidy', definition: 'government money supporting a service or industry', translation: 'субсидия', example: 'The subsidy made solar panels cheaper.' },
      { term: 'transition', definition: 'a change from one system to another', translation: 'переход', example: 'The energy transition will take decades.' },
      { term: 'resilience', definition: 'the ability to recover from difficulty', translation: 'устойчивость', example: 'Cities need resilience against extreme heat.' },
      { term: 'externality', definition: 'a wider cost or benefit not included in a price', translation: 'внешний эффект', example: 'Pollution is a negative externality.' },
      { term: 'feasible', definition: 'possible and realistic to achieve', translation: 'осуществимый', example: 'The proposal is ambitious but feasible.' },
      { term: 'equitable', definition: 'fair and reasonable for different groups', translation: 'справедливый', example: 'A policy should be effective and equitable.' }
    ],
    grammar: 'Policy stance: It is essential that... / The policy would be viable provided that... / This raises the question of whether...',
    prompts: ['Design a policy with one benefit and one cost.', 'Explain who gains and who pays for a transition.', 'Challenge an argument using evidence rather than an absolute claim.'],
    facts: ['Policy choices often involve distribution: the total benefit can rise while some groups still lose.', 'A useful debate distinguishes short-term cost from long-term impact.'],
    sourceText: 'Climate policy often involves trade-offs between economic growth, energy security and environmental protection. Governments use standards, subsidies, carbon pricing and public investment, but every instrument creates winners, costs and implementation questions.'
  },
  {
    id: 'ielts-speaking-b2',
    title: 'IELTS Speaking: Memorable Journey',
    subtitle: 'cue cards, follow-up questions and fluency',
    level: 'B2',
    domain: 'Exam Practice',
    icon: 'IELTS',
    accent: '#c026d3',
    defaultTool: 'creative-writing',
    tags: ['ielts', 'exam', 'speaking'],
    entries: [
      { term: 'destination', definition: 'the place you are travelling to', translation: 'место назначения', example: 'The destination was a small island.' },
      { term: 'memorable', definition: 'easy to remember because it was special', translation: 'запоминающийся', example: 'It was a memorable journey.' },
      { term: 'unexpected', definition: 'not planned or predicted', translation: 'неожиданный', example: 'An unexpected delay changed the plan.' },
      { term: 'landmark', definition: 'a well-known place or building', translation: 'достопримечательность', example: 'We visited a famous landmark.' },
      { term: 'atmosphere', definition: 'the feeling or mood of a place', translation: 'атмосфера', example: 'The old town had a relaxed atmosphere.' },
      { term: 'impression', definition: 'an idea or feeling formed about something', translation: 'впечатление', example: 'My first impression was very positive.' },
      { term: 'recommend', definition: 'to say that someone should try something', translation: 'рекомендовать', example: 'I would recommend visiting in spring.' },
      { term: 'whereas', definition: 'used to contrast two facts or ideas', translation: 'тогда как', example: 'The city was busy, whereas the village was quiet.' }
    ],
    grammar: 'Fluency frames: What stands out is... / One reason I remember it is... / Looking back... / If I had the chance...',
    prompts: ['Speak for two minutes about a journey.', 'Ask three natural follow-up questions.', 'Upgrade a basic answer with reasons, contrast and a reflection.'],
    facts: ['A clear answer usually has a beginning, two or three details and a brief reflection.', 'Fluency improves when learners practise connecting ideas instead of memorising isolated phrases.'],
    sourceText: 'Describe a memorable journey. Say where you went, who you travelled with, what happened and why the experience stayed in your memory. Add one recommendation for someone planning a similar trip.'
  },
  {
    id: 'kids-animals-a1',
    title: 'Kids: Animals & Actions',
    subtitle: 'simple nouns, verbs and classroom games',
    level: 'A1',
    domain: 'Young Learners',
    icon: 'KIDS',
    accent: '#f59e0b',
    defaultTool: 'word-image-match',
    tags: ['kids', 'animals', 'games'],
    entries: [
      { term: 'cat', definition: 'a small animal that says meow', translation: 'кошка', example: 'The cat is sleeping.' },
      { term: 'dog', definition: 'a friendly animal that can bark', translation: 'собака', example: 'The dog can run fast.' },
      { term: 'bird', definition: 'an animal with wings and feathers', translation: 'птица', example: 'The bird can fly.' },
      { term: 'fish', definition: 'an animal that lives in water', translation: 'рыба', example: 'The fish can swim.' },
      { term: 'rabbit', definition: 'a small animal with long ears', translation: 'кролик', example: 'The rabbit can jump.' },
      { term: 'lion', definition: 'a large wild cat', translation: 'лев', example: 'The lion is strong.' },
      { term: 'fly', definition: 'to move through the air with wings', translation: 'летать', example: 'Birds fly in the sky.' },
      { term: 'crawl', definition: 'to move slowly close to the ground', translation: 'ползать', example: 'The baby turtle can crawl.' }
    ],
    grammar: 'Can: A bird can fly. A fish cannot fly. Can a rabbit jump? Yes, it can.',
    prompts: ['Play animal charades.', 'Sort animals by can fly, swim, jump or crawl.', 'Make a class animal sound guessing game.'],
    facts: ['Movement verbs make vocabulary practice physical and memorable.', 'Young learners benefit from repeating the same language in a new game.'],
    sourceText: 'Animals can move in different ways. A bird can fly, a fish can swim, a rabbit can jump and a turtle can crawl. Children match each animal to an action.'
  },
  {
    id: 'academic-writing-c1',
    title: 'Academic Writing Foundations',
    subtitle: 'thesis statements, cohesion and precise style',
    level: 'C1',
    domain: 'Academic English',
    icon: 'ESSAY',
    accent: '#4f46e5',
    defaultTool: 'essay-topics',
    tags: ['academic', 'writing', 'essay'],
    entries: [
      { term: 'thesis', definition: 'the central argument of an academic text', translation: 'тезис', example: 'The thesis should answer the essay question.' },
      { term: 'cohesion', definition: 'the way ideas and sentences connect', translation: 'связность', example: 'Reference words improve cohesion.' },
      { term: 'coherent', definition: 'logical and easy to follow', translation: 'связный', example: 'The paragraph is coherent and focused.' },
      { term: 'substantiate', definition: 'to support a claim with evidence', translation: 'подкрепить', example: 'The writer must substantiate the claim.' },
      { term: 'synthesize', definition: 'to combine ideas from different sources', translation: 'синтезировать', example: 'The conclusion synthesizes the main findings.' },
      { term: 'qualify', definition: 'to make a statement less absolute or more precise', translation: 'уточнять', example: 'Use may to qualify a prediction.' },
      { term: 'concise', definition: 'clear and brief without unnecessary words', translation: 'лаконичный', example: 'A concise topic sentence helps the reader.' },
      { term: 'citation', definition: 'a reference to a source used in writing', translation: 'ссылка', example: 'Add a citation after the statistic.' }
    ],
    grammar: 'Academic structure: Although X, this essay argues that Y because A and B. Use hedging such as may, tends to and appears to.',
    prompts: ['Turn a broad topic into a precise thesis.', 'Combine two sources into one coherent paragraph.', 'Edit a paragraph for cohesion and concision.'],
    facts: ['A strong thesis narrows the question and gives the reader a map of the argument.', 'Hedging is not weakness: it shows that a claim matches the strength of its evidence.'],
    sourceText: 'Academic writing asks the reader to follow a clear argument. A strong paragraph usually has a focused topic sentence, evidence, explanation and a link back to the thesis. Precise language is more valuable than unnecessarily complex vocabulary.'
  },
  {
    id: 'academic-debate-c1',
    title: 'Academic Debate',
    subtitle: 'claims, evidence and respectful disagreement',
    level: 'C1',
    domain: 'Academic English',
    icon: 'C1',
    accent: '#db2777',
    defaultTool: 'discussion',
    tags: ['academic', 'debate', 'writing'],
    entries: [
      { term: 'claim', definition: 'a statement that someone says is true', translation: 'утверждение', example: 'The article makes a strong claim about access.' },
      { term: 'evidence', definition: 'facts or information that support an idea', translation: 'доказательства', example: 'The argument needs more evidence.' },
      { term: 'counterargument', definition: 'an argument against another argument', translation: 'контраргумент', example: 'A good essay acknowledges a counterargument.' },
      { term: 'implication', definition: 'a possible result or meaning', translation: 'следствие', example: 'The policy has serious implications for schools.' },
      { term: 'bias', definition: 'an unfair preference for one side', translation: 'предвзятость', example: 'Readers should check the source for bias.' },
      { term: 'nuance', definition: 'a small but important difference in meaning', translation: 'нюанс', example: 'The conclusion needs more nuance.' },
      { term: 'justify', definition: 'to give a good reason for something', translation: 'обосновать', example: 'Can you justify your recommendation?' },
      { term: 'concede', definition: 'to admit that something is true, often before disagreeing', translation: 'признать', example: 'The writer concedes that the reform is expensive.' }
    ],
    grammar: 'Academic stance: It could be argued that... / The evidence suggests... / This view overlooks... / Nevertheless... / A possible implication is...',
    prompts: ['Build a claim and support it with two kinds of evidence.', 'Respond to a counterargument without dismissing it.', 'Rewrite an absolute opinion with more academic nuance.'],
    facts: ['Strong academic discussion distinguishes a claim from the evidence used to support it.', 'Respectful disagreement often makes reasoning clearer than simple agreement.'],
    sourceText: 'Universities are debating how writing assistants should be used in academic work. Some teachers see them as useful support, while others worry about plagiarism, shallow thinking and unclear responsibility for the final text.'
  },
  {
    id: 'past-storytelling-b1', title: 'Past Storytelling', subtitle: 'sequencing, detail and memorable moments', level: 'B1', domain: 'Speaking & Writing', icon: 'STORY', accent: '#2563eb', defaultTool: 'creative-writing', tags: ['story', 'past tenses', 'speaking'],
    grammar: 'Past simple for events, past continuous for background and when / while for sequence.',
    sourceText: 'On the way home, a student noticed a wallet on the pavement. While they were looking for its owner, a cyclist returned and explained what had happened.',
    prompts: ['Tell a story from four picture cards.', 'Add a surprising problem to a familiar story.', 'Retell the same event from another person viewpoint.'],
    facts: ['Story frames help learners use narrative tenses for meaning instead of isolated grammar drills.', 'Changing viewpoint encourages pronouns, reporting verbs and empathy.'],
    words: ['suddenly|quickly and unexpectedly|внезапно|Suddenly, the lights went out.','while|during the time that something happens|пока|While I was walking, I saw a fox.','notice|to see or realise something|заметить|She noticed a wallet on the ground.','realise|to understand something clearly|понять|I realised that I was lost.','escape|to get away from a place or danger|сбежать|The dog escaped from the garden.','promise|to say that you will do something|обещать|He promised to call later.','eventually|in the end, after some time|в конце концов|Eventually, they found the owner.','memory|something remembered from the past|воспоминание|It became a funny memory.']
  },
  {
    id: 'future-plans-b1', title: 'Future Plans', subtitle: 'intentions, predictions and decisions', level: 'B1', domain: 'Everyday English', icon: 'FUTURE', accent: '#7c3aed', defaultTool: 'discussion', tags: ['future', 'plans', 'speaking'],
    grammar: 'Going to for intentions, will for decisions and predictions, present continuous for fixed arrangements.',
    sourceText: 'A group is planning the next year. They discuss a course, a possible move, a holiday and one habit they will start this month.',
    prompts: ['Make a realistic twelve-month plan.', 'Respond to a last-minute change.', 'Separate a plan, a prediction and a spontaneous decision.'],
    facts: ['Future forms become clearer when the situation explains whether a decision is planned or immediate.', 'Personal plans can be fictional so learners are not required to share private goals.'],
    words: ['intention|a plan or purpose to do something|намерение|My intention is to study more.','arrange|to organise something in advance|организовать|We arranged a meeting for Friday.','predict|to say what may happen|предсказывать|Can you predict the result?','deadline|the latest time for completing something|крайний срок|The deadline is next Monday.','option|one possible choice|вариант|Moving is one option.','likely|probable or expected|вероятный|Rain is likely tomorrow.','resolution|a promise to make a change|решение|Her resolution is to read daily.','postpone|to move something to a later time|отложить|We had to postpone the trip.']
  },
  {
    id: 'relationships-b1', title: 'Relationships & Communication', subtitle: 'trust, boundaries and resolving conflict', level: 'B1', domain: 'Society', icon: 'REL', accent: '#db2777', defaultTool: 'discussion', tags: ['relationships', 'communication', 'wellbeing'],
    grammar: 'Agreeing and disagreeing politely: I see your point, but... / I would rather... / We could...',
    sourceText: 'Two friends disagree about a shared project. They explain their needs, listen to each other and agree on a small change that feels fair.',
    prompts: ['Practise a calm disagreement.', 'Create a list of healthy boundaries.', 'Repair a conversation after a misunderstanding.'],
    facts: ['Conflict tasks should give both sides a legitimate goal, not a single correct answer.', 'Useful communication includes listening, clarification and a concrete next step.'],
    words: ['trust|belief that someone is honest and reliable|доверие|Trust takes time to build.','boundary|a limit on acceptable behaviour|граница|That is an important boundary.','misunderstanding|a failure to understand correctly|недоразумение|The conflict began with a misunderstanding.','compromise|an agreement where both sides change something|компромисс|They reached a compromise.','respect|careful and polite treatment of someone|уважение|Respect makes disagreement safer.','reliable|able to be trusted to do what you promise|надёжный|She is reliable in a crisis.','apologise|to say that you are sorry|извиняться|He apologised for the delay.','clarify|to make an idea or situation clearer|прояснить|Could you clarify your point?']
  },
  {
    id: 'social-media-b1', title: 'Social Media Habits', subtitle: 'connection, comparison and digital choices', level: 'B1', domain: 'Modern Life', icon: 'SOCIAL', accent: '#c026d3', defaultTool: 'worksheet-builder', tags: ['technology', 'media', 'debate'],
    grammar: 'Used to for past habits, present simple for routines and may / can for possible effects.',
    sourceText: 'Social media helps people stay connected, but constant comparison can affect confidence and attention. A class considers healthy ways to use online platforms.',
    prompts: ['Compare two fictional profiles.', 'Design a healthier feed.', 'Debate one school rule about phones and social media.'],
    facts: ['Fictional profiles make digital discussions safer and more analytical.', 'A balanced task includes benefits, risks and a practical suggestion.'],
    words: ['profile|a page with information about a person online|профиль|She updated her profile.','feed|a stream of posts or updates|лента|My feed is full of travel photos.','compare|to look at similarities and differences|сравнивать|Do not compare your life with a highlight reel.','influence|the power to affect someone or something|влияние|Friends can influence our choices.','privacy|control over personal information|конфиденциальность|Check your privacy settings.','authentic|real and not pretending|подлинный|The post felt authentic.','trend|a popular idea or activity|тренд|The sound became a trend.','mute|to stop notifications or sound|отключить звук|I mute work chats at night.']
  },
  {
    id: 'money-budget-b1', title: 'Money & Personal Budget', subtitle: 'spending, saving and everyday choices', level: 'B1', domain: 'Life Skills', icon: 'MONEY', accent: '#16a34a', defaultTool: 'worksheet-builder', tags: ['money', 'life skills', 'numbers'],
    grammar: 'Quantifiers and conditionals: If I save..., I can... / too much, enough, less than and more than.',
    sourceText: 'A student wants to save for a course. They list regular costs, compare needs with wants and choose one realistic change for the next month.',
    prompts: ['Build a weekly budget with fictional numbers.', 'Decide which expenses are flexible.', 'Explain one saving goal without giving personal details.'],
    facts: ['Fictional budgets teach useful language without asking students to disclose finances.', 'Comparing fixed and flexible costs supports both vocabulary and reasoning.'],
    words: ['budget|a plan for how to spend money|бюджет|I made a monthly budget.','income|money that you receive from work or other sources|доход|Her income changes each month.','expense|money spent on something|расход|Rent is our biggest expense.','afford|to have enough money for something|позволить себе|We cannot afford a new laptop yet.','save|to keep money for later|экономить|I save a little every week.','spend|to use money to buy something|тратить|Try not to spend everything today.','discount|a reduction in price|скидка|Students get a discount.','priority|the thing that is most important|приоритет|Food is a higher priority than decorations.']
  },
  {
    id: 'learning-strategies-b1', title: 'Learning Strategies', subtitle: 'memory, practice and independent progress', level: 'B1', domain: 'Education', icon: 'LEARN', accent: '#4f46e5', defaultTool: 'lesson-pack', tags: ['learning', 'study skills', 'metacognition'],
    grammar: 'Giving advice: It helps to... / You might find it useful to... / The more..., the easier...',
    sourceText: 'A learner wants to remember vocabulary for longer. They compare spaced practice, retrieval, examples and short reflection after each study session.',
    prompts: ['Build a seven-day study plan.', 'Explain a strategy to a younger learner.', 'Compare rereading with active recall.'],
    facts: ['Learning strategies become meaningful when students try one and reflect on the result.', 'Short, repeated retrieval is often more useful than one long review session.'],
    words: ['strategy|a plan for achieving a goal|стратегия|Choose a strategy that fits your time.','retrieve|to bring information back from memory|извлекать|Try to retrieve the word before checking.','review|to study something again|повторять|Review the list tomorrow.','spaced|spread over periods of time|распределённый|Spaced practice supports memory.','accurate|correct and without mistakes|точный|Write an accurate example.','reflect|to think carefully about an experience|анализировать|Reflect on what helped you.','progress|improvement over time|прогресс|I can see progress this month.','independent|able to work without constant help|самостоятельный|The goal is independent learning.']
  },
  {
    id: 'music-film-b1', title: 'Music & Film Reviews', subtitle: 'preferences, description and recommendations', level: 'B1', domain: 'Culture', icon: 'MEDIA', accent: '#9333ea', defaultTool: 'creative-writing', tags: ['culture', 'reviews', 'opinions'],
    grammar: 'Opinion frames: In my view... / What I liked most was... / It would appeal to people who...',
    sourceText: 'A class compares a film and a live concert. They describe atmosphere, performances and the emotions each experience creates before writing a short review.',
    prompts: ['Write a spoiler-free review.', 'Recommend a film for a specific audience.', 'Compare a live and recorded performance.'],
    facts: ['Reviews combine descriptive language with reasons, making them good B1 writing tasks.', 'A spoiler-free rule gives students a clear communicative purpose.'],
    words: ['plot|the story of a film or book|сюжет|The plot was easy to follow.','performance|an act of presenting music or drama|выступление|The performance was energetic.','atmosphere|the feeling of a place or work|атмосфера|The film creates a tense atmosphere.','character|a person in a story|персонаж|The main character changes.','soundtrack|music used in a film|саундтрек|The soundtrack matched the mood.','audience|people watching or listening|аудитория|The audience clapped loudly.','recommend|to suggest something as good|рекомендовать|I recommend this film to families.','disappointing|not as good as expected|разочаровывающий|The ending was disappointing.']
  },
  {
    id: 'tourism-impact-b1', title: 'Tourism & Local Life', subtitle: 'benefits, problems and responsible travel', level: 'B1', domain: 'Travel & Society', icon: 'TOUR', accent: '#0891b2', defaultTool: 'pros-cons', tags: ['tourism', 'society', 'debate'],
    grammar: 'Pros and cons: Tourism can create jobs, but it may also increase prices and waste.',
    sourceText: 'A popular coastal town welcomes visitors every summer. Tourism supports local businesses, but residents worry about crowded streets, rising rents and pressure on nature.',
    prompts: ['Create a responsible visitor code.', 'Debate one tourism policy.', 'Balance a local business and resident perspective.'],
    facts: ['Responsible tourism debates are stronger when students identify who benefits and who carries a cost.', 'Cause-and-effect language helps learners move beyond simple positive and negative lists.'],
    words: ['visitor|a person who comes to a place for a short time|посетитель|Every visitor receives a map.','resident|a person who lives in a place|житель|Residents want quieter streets.','local business|a company serving people in an area|местный бизнес|Tourists support local businesses.','crowding|a situation with too many people|переполненность|Crowding is worst in August.','heritage|history and culture passed to later generations|наследие|The town protects its heritage.','waste|unwanted material that people throw away|отходы|Tourism can increase waste.','responsible|showing care for people and places|ответственный|Choose responsible travel options.','impact|a strong effect on something|влияние|What is the impact on residents?']
  },
  {
    id: 'work-meetings-b1', title: 'Work Meetings', subtitle: 'agendas, updates and clear next steps', level: 'B1', domain: 'Work & Business', icon: 'MEET', accent: '#0f766e', defaultTool: 'dialogue', tags: ['business', 'meetings', 'communication'],
    grammar: 'Meeting language: Shall we...? / Could we return to...? / I suggest... / Let us agree on...',
    sourceText: 'A small team meets to plan a product launch. They share updates, ask for clarification, make one decision and assign the next actions.',
    prompts: ['Chair a five-minute project meeting.', 'Interrupt politely and return to the agenda.', 'Turn a discussion into three action points.'],
    facts: ['Meeting role cards distribute useful speaking functions across the group.', 'A visible action list makes the final output concrete and easy to assess.'],
    words: ['agenda|a list of topics for a meeting|повестка|The first item is on the agenda.','update|new information about progress|обновление|Can you give us an update?','deadline|the final date for completing work|срок|We need to meet the deadline.','assign|to give a task to someone|назначить|I will assign the research task.','clarify|to make something easier to understand|уточнить|Could you clarify the budget?','action point|a task agreed during a meeting|пункт действия|Our action point is to call the client.','priority|the most important task or issue|приоритет|Safety is our first priority.','minutes|a written record of a meeting|протокол|I will send the minutes later.']
  },
  {
    id: 'health-lifestyle-b1', title: 'Healthy Lifestyle', subtitle: 'habits, balance and realistic change', level: 'B1', domain: 'Health & Wellbeing', icon: 'LIFE', accent: '#16a34a', defaultTool: 'worksheet-builder', tags: ['health', 'habits', 'reading'],
    grammar: 'Frequency and advice: usually, rarely, should, could, and if... then...',
    sourceText: 'A wellbeing coach helps a busy worker choose small changes: regular sleep, movement breaks, balanced meals and time away from screens.',
    prompts: ['Create a realistic habit experiment.', 'Compare motivation with environment.', 'Write advice that avoids extreme promises.'],
    facts: ['Small experiments are easier to discuss than perfect lifestyle plans.', 'Health language should distinguish general wellbeing advice from professional medical guidance.'],
    words: ['routine|a regular pattern of activity|распорядок|A morning routine saves time.','balanced|including different healthy parts|сбалансированный|Aim for a balanced meal.','sedentary|involving a lot of sitting|малоподвижный|A sedentary day needs movement breaks.','hydration|having enough water in the body|гидратация|Hydration is important in hot weather.','moderation|avoiding too much of something|умеренность|Enjoy treats in moderation.','consistency|doing something regularly over time|последовательность|Consistency matters more than intensity.','sleep|the natural rest when you are not awake|сон|Good sleep supports concentration.','wellbeing|general health and happiness|благополучие|Workload affects wellbeing.']
  },
  {
    id: 'problem-solving-b1', title: 'Problem Solving', subtitle: 'causes, options and practical solutions', level: 'B1', domain: 'Communication', icon: 'SOLVE', accent: '#ea580c', defaultTool: 'discussion', tags: ['solutions', 'speaking', 'teamwork'],
    grammar: 'Problem frames: The issue is... / One possible solution would be... / If we..., we could...',
    sourceText: 'A community centre has fewer visitors than before. A small team identifies possible causes, compares solutions and chooses a first step to test.',
    prompts: ['Use a cause-and-effect map.', 'Rank three solutions by cost and impact.', 'Present a solution and respond to one objection.'],
    facts: ['Good problem-solving tasks distinguish a cause, a symptom and a proposed solution.', 'A ranking criterion helps groups make decisions instead of listing ideas forever.'],
    words: ['issue|an important problem or topic|проблема|The main issue is access.','cause|the reason something happens|причина|What caused the delay?','effect|a result of an action or event|эффект|The effect was easy to see.','option|one possible choice|вариант|We have three options.','solution|an answer to a problem|решение|The team found a simple solution.','obstacle|something that makes progress difficult|препятствие|Cost is the biggest obstacle.','evaluate|to judge the quality or value of something|оценивать|We need to evaluate the pilot.','implement|to put a plan into action|реализовать|They will implement the change next week.']
  },
  {
    id: 'cultural-traditions-b1', title: 'Cultural Traditions', subtitle: 'customs, change and respectful comparison', level: 'B1', domain: 'Culture & Society', icon: 'CULT', accent: '#b45309', defaultTool: 'discussion', tags: ['culture', 'traditions', 'speaking'],
    grammar: 'Used to for past customs; passive forms for how traditions are practised; respectful comparison language.',
    sourceText: 'A family describes a yearly celebration. Some parts of the tradition have stayed the same, while younger people have adapted other parts for modern life.',
    prompts: ['Describe a fictional celebration.', 'Compare two ways a tradition can change.', 'Create questions that show curiosity rather than judgement.'],
    facts: ['Cultural comparison works best when students avoid presenting one experience as universal.', 'Asking where, when and for whom a tradition is practised adds useful nuance.'],
    words: ['custom|a traditional way of behaving|обычай|Sharing food is a local custom.','celebration|a special event for a happy occasion|празднование|The celebration lasts two days.','generation|people born around the same time|поколение|Each generation adds something new.','symbol|an object or action with a special meaning|символ|The colour is a symbol of hope.','community|people living or working together|сообщество|The whole community joins in.','preserve|to protect something from change or damage|сохранять|The museum preserves the craft.','adapt|to change something for a new situation|адаптировать|Families adapt traditions over time.','respectful|showing care for other people and cultures|уважительный|Ask respectful questions.']
  },
  {
    id: 'customer-service-b2', title: 'Customer Service', subtitle: 'complaints, empathy and effective resolution', level: 'B2', domain: 'Work & Business', icon: 'CARE', accent: '#be123c', defaultTool: 'dialogue', tags: ['business', 'role-play', 'service'],
    grammar: 'Apologising and resolving: I am sorry that... / What I can offer is... / If you send..., we will...',
    sourceText: 'A customer received a late and damaged delivery. The support agent acknowledges the problem, asks for details and offers two possible solutions.',
    prompts: ['Role-play a complaint with a hidden policy.', 'Rewrite a defensive reply to sound helpful.', 'Create a service recovery checklist.'],
    facts: ['Empathy and a clear next step are more useful than a long apology with no action.', 'Role cards can include limits so learners practise negotiating within a policy.'],
    words: ['complaint|a statement that something is wrong|жалоба|The company received a complaint.','resolve|to solve a problem|решить|We will resolve the issue today.','refund|money returned after a problem|возврат денег|The customer requested a refund.','replacement|a new item given instead of a faulty one|замена|We can send a replacement.','compensation|something given to make up for a problem|компенсация|They offered compensation for the delay.','escalate|to pass a problem to someone with more authority|передать выше|I will escalate this case.','apologise|to say sorry for a problem|извиниться|We apologise for the inconvenience.','satisfaction|the feeling that a service met expectations|удовлетворённость|Customer satisfaction improved.']
  },
  {
    id: 'project-management-b2', title: 'Project Management', subtitle: 'scope, risks, milestones and delivery', level: 'B2', domain: 'Work & Business', icon: 'PM', accent: '#4f46e5', defaultTool: 'worksheet-builder', tags: ['business', 'projects', 'planning'],
    grammar: 'Passive and future forms for deliverables: The report will be reviewed by Friday.',
    sourceText: 'A team is preparing a small product launch. They define the scope, identify risks, set milestones and agree how progress will be reported.',
    prompts: ['Turn a goal into three milestones.', 'Run a risk review meeting.', 'Write a concise status update for a manager.'],
    facts: ['Project vocabulary is easier to retain when a class follows one fictional project from idea to delivery.', 'A milestone should describe a visible result, not just activity.'],
    words: ['scope|the work and limits included in a project|объём работ|The scope excludes mobile support.','milestone|an important stage or result|этап|We reached the first milestone.','deliverable|a result that must be produced|результат|The final deliverable is a report.','stakeholder|a person affected by or interested in a project|заинтересованная сторона|We need stakeholder feedback.','risk|a possible problem or danger|риск|The main risk is delay.','dependency|something that must happen first|зависимость|Testing has a dependency on design.','resource|a person, tool or material available for work|ресурс|We need more design resources.','status|the current condition or progress|статус|Send a weekly status update.']
  },
  {
    id: 'entrepreneurship-b2', title: 'Entrepreneurship', subtitle: 'problems, customers and sustainable ideas', level: 'B2', domain: 'Work & Business', icon: 'START', accent: '#ea580c', defaultTool: 'creative-writing', tags: ['business', 'innovation', 'pitch'],
    grammar: 'Pitching: Our product helps... by... / Unlike..., we... / The main value is...',
    sourceText: 'A small team notices that local teachers lose time preparing repetitive materials. They design a simple service, test it with users and adjust the idea after feedback.',
    prompts: ['Find a problem worth solving.', 'Deliver a ninety-second pitch.', 'Challenge a business idea with customer questions.'],
    facts: ['A pitch is stronger when it starts with a specific user problem rather than a feature list.', 'Testing assumptions early can prevent expensive work later.'],
    words: ['entrepreneur|a person who starts and runs a business|предприниматель|The entrepreneur tested the idea first.','customer|a person who buys a product or service|клиент|We interviewed ten customers.','value|the benefit something provides|ценность|What value does the service offer?','revenue|money earned from sales|выручка|Revenue grew in the second month.','launch|to introduce a product or service|запускать|They will launch a pilot.','feedback|information about how well something works|обратная связь|Customer feedback changed the design.','competitor|a company offering a similar product|конкурент|A competitor already serves schools.','iterate|to improve something through repeated tests|повторять цикл улучшения|The team iterated after each test.']
  },
  {
    id: 'psychology-habits-b2', title: 'Psychology of Habits', subtitle: 'cues, routines, rewards and behaviour change', level: 'B2', domain: 'Psychology', icon: 'MIND', accent: '#7c3aed', defaultTool: 'worksheet-builder', tags: ['psychology', 'habits', 'reading'],
    grammar: 'Cause and condition: When a cue appears, people tend to... / If the reward changes, the routine may...',
    sourceText: 'A behaviour researcher explains how a cue can trigger a routine and a reward can make it repeat. Students analyse one fictional habit and design a small experiment.',
    prompts: ['Map a fictional habit loop.', 'Change the environment instead of relying on willpower.', 'Evaluate whether a habit experiment was fair.'],
    facts: ['Habit analysis is not diagnosis; it is a way to describe repeated behaviour and context.', 'Small environmental changes can be easier to test than broad motivational promises.'],
    words: ['cue|a signal that starts an action|сигнал|A phone notification can be a cue.','routine|a repeated pattern of behaviour|распорядок|The routine starts after lunch.','reward|something that encourages repetition|награда|The reward is a short break.','trigger|something that causes a reaction|триггер|Stress can trigger the habit.','automatic|happening without conscious thought|автоматический|The movement became automatic.','environment|the surroundings where something happens|окружение|Change the environment around the habit.','willpower|mental strength used to control actions|сила воли|Willpower is not the only factor.','experiment|a planned test of an idea|эксперимент|Run a small experiment for a week.']
  },
  {
    id: 'science-innovation-b2', title: 'Science & Innovation', subtitle: 'hypotheses, evidence and useful discoveries', level: 'B2', domain: 'Science', icon: 'SCI', accent: '#0284c7', defaultTool: 'worksheet-builder', tags: ['science', 'innovation', 'reading'],
    grammar: 'Scientific caution: The results suggest... / This may indicate... / Further research is needed to...',
    sourceText: 'A research team tests a low-cost water filter. They compare samples, record results and explain why one experiment cannot prove that the design works everywhere.',
    prompts: ['Turn a question into a hypothesis.', 'Separate evidence from a conclusion.', 'Explain a discovery to a non-specialist.'],
    facts: ['A hypothesis is testable, while a broad hope is not.', 'Good science communication makes uncertainty visible instead of hiding it.'],
    words: ['hypothesis|an idea that can be tested|гипотеза|The team proposed a hypothesis.','sample|a small amount used for study|образец|They tested a water sample.','method|the way a study or experiment is done|метод|The method was described clearly.','result|what happens after a test|результат|The result was surprising.','evidence|information supporting an idea|доказательства|The evidence is limited.','reliable|likely to be accurate and consistent|надёжный|We need reliable measurements.','innovation|a new idea or method|инновация|The innovation reduces energy use.','replicate|to repeat a study or result|воспроизвести|Other teams should replicate the test.']
  },
  {
    id: 'ethics-ai-b2', title: 'Ethics of AI', subtitle: 'benefits, risks, responsibility and design choices', level: 'B2', domain: 'Technology & Society', icon: 'AI', accent: '#9333ea', defaultTool: 'discussion', tags: ['technology', 'ethics', 'debate'],
    grammar: 'Balanced claims: Although AI can..., it may also... / Responsibility should be shared between...',
    sourceText: 'A school is considering an AI writing assistant. Teachers see possible benefits for feedback, while students and families ask about privacy, fairness and responsibility.',
    prompts: ['Build a classroom AI policy.', 'Rank risks by likelihood and impact.', 'Hold a hearing with different stakeholders.'],
    facts: ['Ethical discussion is clearer when a specific use case is defined.', 'A useful policy explains what is allowed, what must be disclosed and who checks the result.'],
    words: ['bias|an unfair preference in data or decisions|предвзятость|The model may reproduce bias.','privacy|control over personal information|конфиденциальность|Students need privacy protections.','transparency|being open about how something works|прозрачность|The system needs more transparency.','accountability|responsibility for a decision or result|ответственность|Who has accountability for the output?','consent|permission given after understanding a use|согласие|The project requires informed consent.','generate|to produce something new|создавать|The tool can generate a draft.','verify|to check information or a result|проверять|Users must verify important claims.','equity|fair access and treatment for different groups|равенство|Equity should guide the design.']
  },
  {
    id: 'education-reform-b2', title: 'Education Reform', subtitle: 'assessment, access and what schools should change', level: 'B2', domain: 'Education Policy', icon: 'EDU', accent: '#16a34a', defaultTool: 'pros-cons', tags: ['education', 'policy', 'debate'],
    grammar: 'Policy proposals: Schools should... / A reform would be effective if... / One concern is that...',
    sourceText: 'A city is reviewing its schools. Families ask for practical skills and better support, while teachers need time, resources and a realistic assessment system.',
    prompts: ['Write a three-point reform proposal.', 'Debate exams versus project assessment.', 'Explain how a reform could affect different learners.'],
    facts: ['Education policy involves trade-offs between consistency, flexibility and workload.', 'A reform is easier to evaluate when it has a clear success indicator.'],
    words: ['curriculum|the subjects and content taught in a course|учебная программа|The curriculum includes media literacy.','assessment|the process of judging learning|оценивание|Assessment should support learning.','access|the ability to use or reach something|доступ|Every learner needs access to support.','equity|fairness for people with different needs|справедливость|Equity is not always identical treatment.','workload|the amount of work someone must do|нагрузка|Teacher workload is a concern.','outcome|a result of an action or process|результат|The reform has a clear outcome.','implement|to put a plan into action|реализовать|The policy is difficult to implement.','stakeholder|a person affected by a decision|заинтересованная сторона|Parents are important stakeholders.']
  },
  {
    id: 'globalisation-b2', title: 'Globalisation & Work', subtitle: 'trade, culture, supply chains and mobility', level: 'B2', domain: 'Society & Economics', icon: 'GLOB', accent: '#0f766e', defaultTool: 'discussion', tags: ['globalisation', 'business', 'society'],
    grammar: 'Contrast and consequence: Whereas... / This has led to... / As a result... / On the other hand...',
    sourceText: 'A product may be designed in one country, made in another and sold around the world. This creates opportunities, but also questions about labour, transport and local identity.',
    prompts: ['Map a product supply chain.', 'Debate one benefit and one cost of global trade.', 'Compare local and international brands.'],
    facts: ['Globalisation is not one process: trade, migration, technology and culture can change at different speeds.', 'Supply-chain maps make abstract economic language visible.'],
    words: ['trade|buying and selling between people or countries|торговля|International trade connects markets.','supply chain|the stages from production to customer|цепочка поставок|The supply chain is complex.','mobility|the ability to move or work in different places|мобильность|Digital work increases mobility.','outsourcing|using another company to do part of the work|аутсорсинг|Outsourcing can reduce costs.','inequality|an unfair difference in income or opportunity|неравенство|Global growth may not reduce inequality.','local identity|the shared character of a place|местная идентичность|Tourism can change local identity.','interdependent|depending on each other|взаимозависимый|Modern economies are interdependent.','regulate|to control an activity with rules|регулировать|Governments regulate labour conditions.']
  },
  {
    id: 'architecture-design-b2', title: 'Architecture & Design', subtitle: 'space, function, materials and human experience', level: 'B2', domain: 'Design & Culture', icon: 'ARCH', accent: '#b45309', defaultTool: 'creative-writing', tags: ['design', 'architecture', 'visual'],
    grammar: 'Describing purpose: It is designed to... / The layout allows... / The material makes the space feel...',
    sourceText: 'A community plans a new learning space. The design team considers light, movement, noise, accessibility and how different people will use the rooms.',
    prompts: ['Sketch and pitch a public space.', 'Critique a layout using evidence from the brief.', 'Redesign one room for accessibility.'],
    facts: ['Design critique is more useful when learners refer to a brief or user need.', 'A space can be beautiful and still fail if it excludes or confuses its users.'],
    words: ['layout|the way parts of a space are arranged|планировка|The open layout encourages movement.','function|the purpose something serves|функция|Form should support function.','material|what something is made from|материал|Wood is a warm material.','accessible|easy for people with different needs to use|доступный|The entrance is accessible.','sustainable|able to continue without serious harm|устойчивый|They chose sustainable materials.','proportion|the relationship between sizes|пропорция|The window has a balanced proportion.','texture|the way a surface feels or looks|текстура|The wall has a rough texture.','brief|a clear description of a design task|техническое задание|Read the client brief first.']
  },
  {
    id: 'food-systems-b2', title: 'Food Systems', subtitle: 'production, waste, health and choices', level: 'B2', domain: 'Environment & Society', icon: 'FOOD2', accent: '#65a30d', defaultTool: 'worksheet-builder', tags: ['food', 'environment', 'reading'],
    grammar: 'Passive voice and cause: Food is produced... / This can lead to... / If waste were reduced...',
    sourceText: 'The food system connects farms, factories, shops and homes. A class examines how production, packaging and food waste affect health, cost and the environment.',
    prompts: ['Trace a meal from farm to plate.', 'Design a lower-waste cafeteria.', 'Compare individual and policy solutions.'],
    facts: ['Food systems connect personal choices to infrastructure and policy.', 'A systems map prevents the discussion from blaming one actor for every problem.'],
    words: ['production|the process of making or growing something|производство|Food production uses land and water.','distribution|the process of moving goods to people|распределение|Distribution adds to the final cost.','packaging|materials used to protect a product|упаковка|Packaging can reduce damage.','waste|materials thrown away after use|отходы|Food waste is a global issue.','seasonal|available at a particular time of year|сезонный|Seasonal food may travel less.','processed|changed from its natural form|обработанный|Highly processed food is convenient.','consumer|a person who buys or uses something|потребитель|Consumers make different choices.','supply|the amount available for use or sale|предложение|Supply can change after a drought.']
  },
  {
    id: 'law-justice-c1', title: 'Law & Justice', subtitle: 'rights, evidence, procedure and fair decisions', level: 'C1', domain: 'Law & Society', icon: 'LAW', accent: '#334155', defaultTool: 'discussion', tags: ['law', 'society', 'academic'],
    grammar: 'Formal reporting: It is alleged that... / The evidence was admitted... / The court ruled that...',
    sourceText: 'A fictional case asks whether a public rule was applied fairly. Students examine evidence, procedure and competing arguments before writing a balanced judgement.',
    prompts: ['Hold a structured mock hearing.', 'Separate fact, allegation and opinion.', 'Explain a decision in plain language.'],
    facts: ['Fictional cases make legal language analytical without giving personal legal advice.', 'A fair hearing requires students to represent more than one perspective.'],
    words: ['legislation|a group of laws made by a government|законодательство|The legislation changed last year.','allegation|a claim that someone did something wrong|обвинение|The allegation was investigated.','evidence|information used to support a decision|доказательства|The evidence was incomplete.','procedure|an official way of doing something|процедура|The procedure must be followed.','verdict|the decision reached in a court case|вердикт|The jury delivered a verdict.','precedent|an earlier decision used as a guide|прецедент|The judge considered a legal precedent.','jurisdiction|the authority to make legal decisions|юрисдикция|The case is outside this jurisdiction.','remedy|a legal way to correct a wrong|средство защиты|The court ordered an appropriate remedy.']
  },
  {
    id: 'sociology-inequality-c1', title: 'Sociology of Inequality', subtitle: 'opportunity, institutions and social mobility', level: 'C1', domain: 'Social Sciences', icon: 'SOC', accent: '#be123c', defaultTool: 'discussion', tags: ['sociology', 'inequality', 'academic'],
    grammar: 'Academic qualification: While X is often explained by..., this view overlooks... / The data may indicate...',
    sourceText: 'Researchers compare access to education, housing and healthcare in different communities. They ask how institutions and personal choices interact in shaping opportunity.',
    prompts: ['Interpret a fictional data table.', 'Compare individual and structural explanations.', 'Write a cautious claim supported by two observations.'],
    facts: ['Social research should distinguish correlation from causation.', 'A respectful classroom discussion can examine systems without assigning labels to classmates.'],
    words: ['inequality|an unfair difference in resources or opportunity|неравенство|The report examines income inequality.','mobility|movement between social or economic positions|мобильность|Education can affect social mobility.','institution|an established organisation or system|институт|Institutions shape access to services.','discrimination|unfair treatment based on identity|дискриминация|The policy aims to reduce discrimination.','privilege|an unearned advantage available to some people|привилегия|The study discusses social privilege.','barrier|something that prevents progress or access|барьер|Cost is a barrier to study.','distribution|the way resources are shared|распределение|The distribution of housing is uneven.','structural|connected to systems rather than one person|структурный|The issue has structural causes.']
  },
  {
    id: 'philosophy-ethics-c1', title: 'Philosophy & Ethics', subtitle: 'principles, dilemmas and reasoned judgement', level: 'C1', domain: 'Humanities', icon: 'PHIL', accent: '#7c3aed', defaultTool: 'discussion', tags: ['philosophy', 'ethics', 'debate'],
    grammar: 'Argument structure: If we accept..., it follows that... / A possible objection is... / This principle conflicts with...',
    sourceText: 'A fictional committee must choose between two imperfect options. Students identify principles, test consequences and explain which trade-off they consider most defensible.',
    prompts: ['Analyse a dilemma from two ethical frameworks.', 'Distinguish a reason from a consequence.', 'Write a measured conclusion rather than a slogan.'],
    facts: ['Ethical reasoning benefits from separating what is true, what is valuable and what should be done.', 'A dilemma can have several defensible answers if the reasoning is explicit.'],
    words: ['principle|a basic belief or rule guiding action|принцип|The policy follows a principle of fairness.','dilemma|a difficult choice between options|дилемма|The committee faced an ethical dilemma.','consequence|a result of an action|последствие|Consider the long-term consequence.','autonomy|the ability to make your own decisions|автономия|Respect for autonomy matters here.','justice|fair treatment according to rights or rules|справедливость|The proposal raises questions of justice.','virtue|a good quality of character|добродетель|Patience is a useful virtue.','obligation|a duty to do something|обязанность|Do we have an obligation to help?','justify|to give reasons for a choice|обосновать|How would you justify the decision?']
  },
  {
    id: 'research-methods-c1', title: 'Research Methods', subtitle: 'questions, samples, validity and interpretation', level: 'C1', domain: 'Academic English', icon: 'METH', accent: '#0284c7', defaultTool: 'worksheet-builder', tags: ['research', 'academic', 'critical thinking'],
    grammar: 'Method language: The study aims to... / Participants were selected... / The findings should be interpreted with caution.',
    sourceText: 'A student designs a small survey about study habits. They define a question, choose a sample, consider bias and explain what the results can and cannot show.',
    prompts: ['Improve a weak research question.', 'Choose a suitable sample for a fictional study.', 'Write limitations for a result.'],
    facts: ['A method section explains how a result was produced, not just what the result says.', 'Limitations make an academic claim more credible when they are specific.'],
    words: ['variable|a factor that can change or be measured|переменная|Sleep is one variable in the study.','sample|a group selected to represent a larger population|выборка|The sample included 200 participants.','survey|a set of questions used to collect information|опрос|We designed a short survey.','validity|how well a method measures what it should|достоверность|The study has limited validity.','reliability|how consistent a measurement is|надёжность|The test showed good reliability.','bias|a systematic influence that affects results|предвзятость|Selection bias may affect the sample.','correlation|a relationship between two changing factors|корреляция|The data shows a weak correlation.','limitation|a factor that reduces what a study can prove|ограничение|The small sample is a limitation.']
  },
  {
    id: 'rhetoric-persuasion-c1', title: 'Rhetoric & Persuasion', subtitle: 'audience, framing, evidence and memorable language', level: 'C1', domain: 'Communication', icon: 'RHET', accent: '#db2777', defaultTool: 'creative-writing', tags: ['rhetoric', 'writing', 'speaking'],
    grammar: 'Persuasive structure: By framing X as..., the speaker... / This appeal is effective because...',
    sourceText: 'A public campaign uses stories, statistics and a memorable phrase to persuade an audience. Students identify the choices and adapt the message for a different audience.',
    prompts: ['Rewrite one message for three audiences.', 'Identify emotional and logical appeals.', 'Build a claim that acknowledges an objection.'],
    facts: ['Persuasion is more than confidence: audience, evidence and framing all shape how a message works.', 'Analysing a technique does not require agreeing with the message.'],
    words: ['rhetoric|the art of effective speaking or writing|риторика|The speech uses powerful rhetoric.','audience|the people a message is intended for|аудитория|Consider your audience first.','framing|the way an issue is presented|фрейминг|The framing changes how readers react.','appeal|a persuasive request or feature|обращение|The campaign uses an emotional appeal.','credibility|the quality of being trusted|достоверность|Evidence increases credibility.','counterclaim|an opposing claim that must be answered|контраргумент|The essay includes a counterclaim.','emphasis|special importance given to something|акцент|Repetition adds emphasis.','nuanced|showing small but important differences|нюансированный|The conclusion is nuanced.']
  },
  {
    id: 'literature-analysis-c1', title: 'Literature Analysis', subtitle: 'voice, imagery, structure and interpretation', level: 'C1', domain: 'Literature', icon: 'LIT', accent: '#9333ea', defaultTool: 'essay-topics', tags: ['literature', 'analysis', 'writing'],
    grammar: 'Analysis frames: The image suggests... / The narrator may be unreliable because... / This contrast highlights...',
    sourceText: 'A short fictional passage describes a train station at night. Students examine imagery, point of view and repeated details before writing an interpretation supported by quotations.',
    prompts: ['Annotate a paragraph for imagery.', 'Compare two interpretations of one detail.', 'Write a paragraph with claim, quotation and analysis.'],
    facts: ['Literary analysis should explain how a detail creates meaning, not only identify a technique.', 'Multiple interpretations can be valid when they are grounded in the text.'],
    words: ['narrator|the voice telling a story|рассказчик|The narrator hides important information.','imagery|language that creates a picture or sensory idea|образность|The imagery makes the room feel cold.','metaphor|a comparison that says one thing is another|метафора|The city becomes a metaphor for memory.','symbol|a detail representing a wider idea|символ|The locked door is a symbol.','tone|the attitude or feeling of a text|тон|The tone becomes more anxious.','perspective|the point of view from which something is seen|перспектива|The story changes perspective.','ambiguous|open to more than one interpretation|неоднозначный|The ending is deliberately ambiguous.','motif|a repeated image, idea or feature|мотив|Water is a recurring motif.']
  },
  {
    id: 'economics-policy-c1', title: 'Economics & Public Policy', subtitle: 'markets, incentives, distribution and trade-offs', level: 'C1', domain: 'Economics', icon: 'ECON', accent: '#15803d', defaultTool: 'discussion', tags: ['economics', 'policy', 'academic'],
    grammar: 'Cautious policy analysis: A rise in X may lead to... / This measure is likely to affect... / The trade-off involves...',
    sourceText: 'A city wants to reduce traffic without making travel unaffordable. Policymakers compare pricing, public transport investment and support for low-income residents.',
    prompts: ['Build a policy with a target and a safeguard.', 'Explain a trade-off to a non-specialist.', 'Interpret a fictional supply-and-demand chart.'],
    facts: ['Policy analysis asks not only whether a measure works, but for whom and at what cost.', 'A safeguard can reduce unintended effects without removing the main goal.'],
    words: ['market|a system where goods or services are exchanged|рынок|The market responds to demand.','demand|the amount people want to buy|спрос|Demand rose after the price fell.','supply|the amount available to buy|предложение|Supply is limited this month.','incentive|something encouraging a behaviour|стимул|A tax credit is an incentive.','subsidy|government money supporting an activity|субсидия|The subsidy supports public transport.','taxation|the system of collecting taxes|налогообложение|Taxation funds public services.','distribution|how income or resources are shared|распределение|The policy changes distribution.','trade-off|a balance between competing outcomes|компромисс|Every option has a trade-off.']
  },
  {
    id: 'advanced-technology-c1', title: 'Advanced Technology', subtitle: 'systems, adoption, security and unintended effects', level: 'C1', domain: 'Technology', icon: 'TECH', accent: '#0f766e', defaultTool: 'discussion', tags: ['technology', 'systems', 'academic'],
    grammar: 'Technical explanation: The system is designed to... / This depends on whether... / It remains unclear how...',
    sourceText: 'A city considers introducing a connected transport system. The technology could improve journeys, but planners must address security, access and the consequences of system failure.',
    prompts: ['Explain a technical system to two audiences.', 'Create a risk register for a new product.', 'Debate convenience versus control.'],
    facts: ['Technology choices include social and organisational effects, not only technical performance.', 'A risk register makes vague concern more specific and actionable.'],
    words: ['infrastructure|basic systems needed for a society or service|инфраструктура|Digital infrastructure needs maintenance.','algorithm|a set of rules used to solve a problem|алгоритм|The algorithm ranks the results.','deploy|to put a system into use|развернуть|The team will deploy the update.','interoperable|able to work with another system|совместимый|The tools must be interoperable.','scalable|able to grow without losing performance|масштабируемый|The service needs a scalable design.','vulnerability|a weakness that can be attacked or harmed|уязвимость|The audit found a security vulnerability.','adoption|the process of starting to use something|внедрение|User adoption was slower than expected.','unintended|not planned or expected|непреднамеренный|The update had unintended effects.']
  }
];

/* Expanded offline catalog. The compact word format keeps this file easy to
   audit and edit while materialising the same rich entry shape as the core
   packs above. No network, AI call or API key is involved. */
const EXTRA_KNOWLEDGE_BASES = [
  {
    id: 'classroom-english-a1', title: 'Classroom English', subtitle: 'objects, instructions and simple requests', level: 'A1', domain: 'Young Learners', icon: 'CLASS', accent: '#0891b2', defaultTool: 'word-image-match', tags: ['kids', 'classroom', 'beginner'],
    grammar: 'Imperatives: Open your book. Listen and repeat. Can I borrow a pencil?',
    sourceText: 'In the classroom, students listen to instructions, find objects and ask for help. They can say what they have and what they need.',
    prompts: ['Play a classroom treasure hunt.', 'Give and follow three simple instructions.', 'Make a picture dictionary of classroom objects.'],
    facts: ['Instructions become memorable when learners move, point and repeat them.', 'Short classroom phrases are high-frequency language that beginners can use immediately.'],
    words: ['board|a surface where a teacher writes|доска|Write the answer on the board.','pencil|a tool for writing|карандаш|Can I borrow a pencil?','notebook|a book for writing notes|тетрадь|Open your notebook.','eraser|a thing used to remove pencil marks|ластик|Use an eraser, please.','listen|to pay attention to sound|слушать|Listen to the teacher.','repeat|to say something again|повторять|Repeat the sentence.','circle|to draw a round line around something|обвести|Circle the correct answer.','pair|two people working together|пара|Work in a pair.']
  },
  {
    id: 'home-rooms-a1', title: 'Home & Rooms', subtitle: 'furniture, places and where things are', level: 'A1', domain: 'Everyday English', icon: 'HOME', accent: '#16a34a', defaultTool: 'essential-vocab', tags: ['home', 'beginner', 'prepositions'],
    grammar: 'There is / There are. Use in, on, under, next to and between to describe a room.',
    sourceText: 'A family moves into a small flat. There is a kitchen next to the living room, two bedrooms upstairs and a bright table near the window.',
    prompts: ['Draw a room and describe it.', 'Find something that is under, on and next to another object.', 'Design a dream bedroom with a partner.'],
    facts: ['Real objects in the room make prepositions meaningful.', 'Drawing before speaking gives beginners useful thinking time.'],
    words: ['kitchen|a room where people cook|кухня|The kitchen is next to the hall.','bedroom|a room where people sleep|спальня|My bedroom is small.','window|an opening in a wall with glass|окно|The chair is near the window.','table|a piece of furniture with a flat top|стол|The keys are on the table.','shelf|a flat place for keeping things|полка|The books are on the shelf.','carpet|a thick covering for a floor|ковёр|There is a carpet under the table.','upstairs|on a higher floor|наверху|The bedrooms are upstairs.','quiet|with little noise|тихий|Our street is quiet.']
  },
  {
    id: 'clothes-weather-a1', title: 'Clothes & Weather', subtitle: 'seasons, colours and what to wear', level: 'A1', domain: 'Everyday English', icon: 'WEAR', accent: '#2563eb', defaultTool: 'word-image-match', tags: ['kids', 'weather', 'vocabulary'],
    grammar: 'Present continuous for now: I am wearing a coat. It is raining. Adjectives come before nouns.',
    sourceText: 'It is a cold morning, so Mia is wearing a warm coat, boots and a hat. Her brother is wearing a light shirt because the afternoon will be sunny.',
    prompts: ['Play a weather and clothes mime game.', 'Pack a suitcase for two different seasons.', 'Describe what three people are wearing.'],
    facts: ['Clothes and weather create a natural reason to practise adjectives and present continuous.', 'Mime lets young learners show meaning before they can explain it.'],
    words: ['coat|a warm piece of clothing for outside|пальто|Put on your coat.','boots|strong shoes that cover the feet and legs|ботинки|Her boots are waterproof.','hat|something worn on the head|шапка|He is wearing a blue hat.','shirt|a piece of clothing for the upper body|рубашка|This shirt is too big.','sunny|with a lot of bright sun|солнечный|It is sunny today.','cloudy|covered with clouds|облачный|The sky is cloudy.','windy|with a lot of wind|ветреный|It is cold and windy.','season|one of four parts of a year|время года|Spring is my favourite season.']
  },
  {
    id: 'colors-shapes-a1', title: 'Colours & Shapes', subtitle: 'visual basics for early learners', level: 'A1', domain: 'Young Learners', icon: 'SHAPE', accent: '#f59e0b', defaultTool: 'word-image-match', tags: ['kids', 'visual', 'beginner'],
    grammar: 'It is a red circle. They are blue squares. Use this and these for objects near you.',
    sourceText: 'The teacher puts colourful shapes on a table. Children name each colour, find matching shapes and make a picture from circles, triangles and squares.',
    prompts: ['Make a shape collage.', 'Find five objects with different colours.', 'Describe a picture without showing it to a partner.'],
    facts: ['Visual sorting gives learners repeated, low-pressure speaking turns.', 'Colour and shape words transfer easily to art, maths and classroom instructions.'],
    words: ['red|the colour of a tomato|красный|The apple is red.','blue|the colour of the sky|синий|I have a blue bag.','green|the colour of grass|зелёный|The leaf is green.','yellow|the colour of the sun|жёлтый|Draw a yellow star.','circle|a round shape|круг|The clock is a circle.','square|a shape with four equal sides|квадрат|The window is a square.','triangle|a shape with three sides|треугольник|Find a triangle.','star|a shape with points|звезда|The sticker is a star.']
  },
  {
    id: 'body-health-a1', title: 'Body & Simple Health', subtitle: 'body parts, feelings and basic needs', level: 'A1', domain: 'Everyday English', icon: 'BODY', accent: '#db2777', defaultTool: 'word-image-match', tags: ['kids', 'health', 'beginner'],
    grammar: 'Have got: I have got two hands. Simple feelings: I am tired. I am cold.',
    sourceText: 'After a long walk, Leo says that his feet are tired and his hands are cold. His friend offers water and asks if he feels better.',
    prompts: ['Play Simon Says with body parts.', 'Make a simple health check role-play.', 'Draw a person and label the body.'],
    facts: ['Movement games help learners remember body vocabulary.', 'Health role-plays should practise asking and responding, not medical diagnosis.'],
    words: ['head|the top part of the body|голова|Put the hat on your head.','shoulder|the body part between the neck and arm|плечо|My bag is on my shoulder.','hand|the end part of an arm|рука|Wash your hands.','finger|one of the five parts on a hand|палец|I cut my finger.','knee|the joint in the middle of a leg|колено|Bend your knee.','foot|the part at the end of a leg|ступня|My foot is cold.','tired|needing rest|уставший|I am tired after school.','thirsty|needing a drink|испытывающий жажду|Are you thirsty?']
  },
  {
    id: 'family-friends-a1', title: 'Family & Friends', subtitle: 'people, names and simple descriptions', level: 'A1', domain: 'Everyday English', icon: 'FAM', accent: '#7c3aed', defaultTool: 'lesson-pack', tags: ['kids', 'family', 'speaking'],
    grammar: 'Possessives: my, your, his, her. Be: This is my sister. She is friendly.',
    sourceText: 'Sam introduces his family and two friends. His sister likes music, his cousin plays football and his best friend has a very funny dog.',
    prompts: ['Create a family tree with fictional people.', 'Introduce a friend using three adjectives.', 'Find two things you and a partner both like.'],
    facts: ['Fictional families protect privacy while keeping the language personal.', 'Repeated introductions build confidence with be, have and possessive adjectives.'],
    words: ['parent|a mother or father|родитель|My parent works at home.','sister|a female sibling|сестра|My sister likes music.','cousin|a child of your aunt or uncle|двоюродный брат или сестра|My cousin lives nearby.','friend|a person you like and trust|друг|Alex is my best friend.','kind|friendly and helpful|добрый|She is kind to everyone.','funny|making people laugh|смешной|He tells funny stories.','share|to use or have something together|делиться|We share the same hobby.','meet|to see someone for the first time or by arrangement|встречать|I meet my friends after class.']
  },
  {
    id: 'transport-places-a1', title: 'Transport & Places', subtitle: 'getting around town with simple phrases', level: 'A1', domain: 'Everyday English', icon: 'MOVE', accent: '#0f766e', defaultTool: 'dialogue', tags: ['kids', 'town', 'speaking'],
    grammar: 'Go to / walk to / by bus. Where is...? It is next to... Use left and right for directions.',
    sourceText: 'Nina wants to get to the library. She walks to the bus stop, takes the number four bus and gets off near the park.',
    prompts: ['Build a town map on the desk.', 'Ask for and give three simple directions.', 'Choose the best transport for a short trip.'],
    facts: ['Maps make direction language concrete and collaborative.', 'Short route descriptions recycle prepositions and imperatives.'],
    words: ['bus stop|a place where a bus picks up passengers|автобусная остановка|Wait at the bus stop.','station|a place where trains or buses arrive|станция|The station is near the river.','library|a place where people borrow books|библиотека|The library is opposite the school.','park|an area with grass and trees|парк|We walk through the park.','ticket|a paper or digital pass for travel|билет|I need a ticket to town.','left|the direction opposite to right|лево|Turn left at the corner.','right|the direction opposite to left|право|The cafe is on the right.','straight|without turning|прямо|Go straight for two minutes.']
  },
  {
    id: 'toys-hobbies-a1', title: 'Toys & Hobbies', subtitle: 'play, collect, draw and make', level: 'A1', domain: 'Young Learners', icon: 'PLAY', accent: '#c026d3', defaultTool: 'word-image-match', tags: ['kids', 'hobbies', 'games'],
    grammar: 'Like + noun or -ing: I like chess. I like drawing. Can for ability: I can swim.',
    sourceText: 'After school, children choose different activities. Maya draws pictures, Tom builds models and Noor plays a board game with her brother.',
    prompts: ['Run a hobby survey.', 'Show a hobby with mime and let the class guess.', 'Design a toy and describe how to use it.'],
    facts: ['Hobbies are high-interest topics that invite real personal choices.', 'A class survey naturally practises like, can and frequency words.'],
    words: ['puzzle|a game where pieces form a picture|пазл|This puzzle has fifty pieces.','doll|a toy that looks like a person|кукла|The doll has a red dress.','ball|a round object used in games|мяч|Kick the ball carefully.','draw|to make a picture with a pencil or pen|рисовать|I like to draw animals.','build|to make something by putting parts together|строить|We build a tower.','collect|to keep many things of one type|собирать|I collect postcards.','dance|to move to music|танцевать|They dance after school.','hobby|an activity you enjoy in free time|хобби|Reading is my hobby.']
  },
  {
    id: 'doctor-visit-a2', title: 'Doctor Visit', subtitle: 'symptoms, appointments and advice', level: 'A2', domain: 'Everyday English', icon: 'DOC', accent: '#dc2626', defaultTool: 'dialogue', tags: ['health', 'role-play', 'survival'],
    grammar: 'Have got for symptoms; should and should not for advice; How long have you felt...?',
    sourceText: 'Marta has a sore throat and a cough. She books an appointment, explains when the symptoms started and listens to the doctor advice.',
    prompts: ['Role-play a patient and receptionist.', 'Sort symptoms by how they feel.', 'Give safe, general wellbeing advice using should.'],
    facts: ['Language practice should stay at the level of communication and signposting, not diagnosis.', 'Time phrases such as since Monday and for two days make symptom descriptions clearer.'],
    words: ['headache|pain in your head|головная боль|I have had a headache since morning.','cough|a sudden sound from your throat|кашель|This cough is keeping me awake.','sore throat|pain in the throat|боль в горле|I have a sore throat.','fever|a high body temperature|температура|She has a fever.','appointment|a planned meeting with a professional|приём|My appointment is at three.','symptom|a sign that you feel unwell|симптом|The main symptom is tiredness.','medicine|something used to treat an illness|лекарство|Take the medicine with water.','recover|to become well again|выздороветь|I hope you recover soon.']
  },
  {
    id: 'shopping-returns-a2', title: 'Shopping & Returns', subtitle: 'sizes, receipts and solving a problem', level: 'A2', domain: 'Everyday English', icon: 'SHOP', accent: '#ea580c', defaultTool: 'dialogue', tags: ['shopping', 'problem-solving', 'survival'],
    grammar: 'Polite complaint: I am afraid there is a problem. Could I exchange...? I would like a refund.',
    sourceText: 'A customer bought a jacket online, but the size is wrong and one button is missing. They return it with the receipt and ask about the options.',
    prompts: ['Role-play a return with different shop policies.', 'Compare refund, exchange and store credit.', 'Write a short message about a faulty item.'],
    facts: ['A role-play is more useful when the customer and assistant have different information.', 'Polite complaint language helps learners solve problems without sounding aggressive.'],
    words: ['receipt|proof of a purchase|чек|I have the receipt here.','refund|money returned after a problem|возврат денег|Can I get a refund?','exchange|to replace one item with another|обмен|I would like an exchange.','size|how big or small something is|размер|This size is too small.','faulty|not working correctly|неисправный|The zip is faulty.','refund policy|the shop rules for returning money|правила возврата|What is your refund policy?','credit|money kept for a future purchase|кредит магазина|The store offered credit.','receipt|proof of a purchase|чек|Keep your receipt.']
  },
  {
    id: 'holiday-plans-a2', title: 'Holiday Plans', subtitle: 'destinations, bookings and travel choices', level: 'A2', domain: 'Travel', icon: 'TRIP', accent: '#0284c7', defaultTool: 'lesson-pack', tags: ['travel', 'future', 'speaking'],
    grammar: 'Going to for plans; would like to for preferences; first, then and finally for sequence.',
    sourceText: 'Two friends plan a short holiday. They compare destinations, check the weather, choose a hotel and make a list of activities.',
    prompts: ['Plan a three-day trip with a fixed budget.', 'Change the plan after a flight cancellation.', 'Present a destination and persuade a partner to choose it.'],
    facts: ['Planning tasks combine practical vocabulary with negotiation and future forms.', 'A budget constraint creates a clear reason to compare options.'],
    words: ['destination|the place you travel to|место назначения|Our destination is a coastal town.','booking|an arrangement made in advance|бронирование|I made a hotel booking.','departure|the time a journey starts|отправление|The departure is at six.','sightseeing|visiting interesting places|осмотр достопримечательностей|We are going sightseeing.','luggage|bags taken on a trip|багаж|My luggage is light.','budget|a plan for how much money to spend|бюджет|We have a small budget.','local|from the area you are visiting|местный|We tried local food.','itinerary|a plan for a journey|маршрут|Here is our three-day itinerary.']
  },
  {
    id: 'housework-a2', title: 'Housework & Chores', subtitle: 'responsibilities, schedules and polite requests', level: 'A2', domain: 'Everyday English', icon: 'HOME', accent: '#65a30d', defaultTool: 'discussion', tags: ['home', 'routines', 'speaking'],
    grammar: 'Have to, need to and do not have to for responsibility. Could you...? for requests.',
    sourceText: 'Three flatmates make a weekly chore chart. They decide who will wash dishes, take out rubbish, clean the bathroom and buy supplies.',
    prompts: ['Create a fair chore chart.', 'Negotiate a change when someone is busy.', 'Discuss which chores are easy, boring or necessary.'],
    facts: ['Scheduling chores practises frequency, obligation and negotiation at the same time.', 'Fairness language helps students explain a preference instead of simply refusing.'],
    words: ['chore|a small job done regularly at home|домашняя обязанность|Washing dishes is a daily chore.','laundry|clothes that need washing or have been washed|стирка|The laundry is in the basket.','vacuum|to clean a floor with a machine|пылесосить|I vacuum on Saturdays.','rubbish|things people throw away|мусор|Take out the rubbish.','tidy|neat and organised|опрятный|The room looks tidy.','messy|not neat or organised|неопрятный|My desk is messy today.','supplies|things needed for a task|необходимые материалы|We need cleaning supplies.','share|to divide something with others|делить|We share the chores.']
  },
  {
    id: 'jobs-workplaces-a2', title: 'Jobs & Workplaces', subtitle: 'roles, duties and simple career talk', level: 'A2', domain: 'Work & Business', icon: 'JOB', accent: '#7c3aed', defaultTool: 'discussion', tags: ['jobs', 'speaking', 'vocabulary'],
    grammar: 'A/an for jobs; present simple for duties; want to and would like to for ambitions.',
    sourceText: 'A class interviews people about their jobs. A nurse helps patients, a chef prepares meals and a designer creates ideas for clients.',
    prompts: ['Guess a job from three duties.', 'Interview a partner about a dream job.', 'Match a workplace to its typical tasks.'],
    facts: ['Job descriptions give beginners a clear pattern: person, workplace and daily duty.', 'Career language can stay inclusive by using fictional roles and different pathways.'],
    words: ['nurse|a person who cares for sick people|медсестра или медбрат|The nurse checks the patient.','chef|a professional cook|повар|The chef prepares dinner.','designer|a person who plans how something looks|дизайнер|The designer draws a new logo.','mechanic|a person who repairs machines or cars|механик|The mechanic fixes the car.','office|a place where people do administrative work|офис|She works in an office.','shift|a period of time when someone works|смена|He works the night shift.','duty|a task that is part of a job|обязанность|One duty is answering calls.','career|the jobs someone has over time|карьера|She wants a career in science.']
  },
  {
    id: 'directions-city-a2', title: 'Directions in the City', subtitle: 'landmarks, routes and getting unlost', level: 'A2', domain: 'Travel', icon: 'MAP', accent: '#0369a1', defaultTool: 'dialogue', tags: ['directions', 'city', 'survival'],
    grammar: 'Turn left at the lights. Go past the bank. It is opposite the museum. How do I get to...?',
    sourceText: 'A visitor is looking for a museum in a busy city. A local explains the route using landmarks, crossings and approximate walking time.',
    prompts: ['Draw a route with five landmarks.', 'Give directions while a partner follows a map.', 'Repair a route after the visitor takes a wrong turn.'],
    facts: ['Landmark-based directions are easier to remember than a list of street names.', 'Information-gap maps ensure both partners need to speak and listen.'],
    words: ['landmark|a recognisable place used to give directions|ориентир|The tower is a useful landmark.','crossing|a place where people cross a road|переход|Use the crossing near the station.','corner|the place where two streets meet|угол|Turn left at the corner.','opposite|on the other side facing something|напротив|The cafe is opposite the bank.','nearby|not far away|поблизости|There is a pharmacy nearby.','entrance|the place where you go into a building|вход|The entrance is on the side.','block|an area between streets|квартал|Walk two blocks north.','approximately|about, not exactly|примерно|It is approximately ten minutes away.']
  },
  {
    id: 'school-life-a2', title: 'School Life', subtitle: 'subjects, schedules and classroom opinions', level: 'A2', domain: 'Education', icon: 'SCHOOL', accent: '#4f46e5', defaultTool: 'worksheet-builder', tags: ['school', 'education', 'speaking'],
    grammar: 'Have to for rules; be good at for ability; because and so for reasons.',
    sourceText: 'Students compare their school days. They talk about subjects, homework, clubs and one change that would make school more useful or enjoyable.',
    prompts: ['Build an ideal timetable.', 'Explain a school rule and suggest an improvement.', 'Hold a class vote about a new club.'],
    facts: ['School topics are familiar but still support meaningful opinions when students must propose change.', 'Timetables recycle days, times and frequency language.'],
    words: ['subject|an area of study at school|предмет|Science is my favourite subject.','timetable|a plan showing lessons and times|расписание|Check the timetable for Friday.','homework|work students do outside class|домашняя работа|I finish my homework before dinner.','break|a short rest between lessons|перемена|We have a break at eleven.','club|a group for a shared activity|кружок|She joined the drama club.','uniform|special clothes worn at school|форма|Our school uniform is blue.','rule|an instruction about what is allowed|правило|The first rule is be kind.','improve|to make something better|улучшать|We want to improve the library.']
  },
  {
    id: 'nature-weekend-a2', title: 'Nature Weekend', subtitle: 'outdoor plans, places and observations', level: 'A2', domain: 'Nature & Travel', icon: 'NATURE', accent: '#15803d', defaultTool: 'lesson-pack', tags: ['nature', 'weekend', 'speaking'],
    grammar: 'Past simple for a trip; there was / there were; comparative adjectives for places.',
    sourceText: 'A group spends a weekend near a lake. They walk through a forest, watch birds and learn how to leave the area clean for other visitors.',
    prompts: ['Plan an eco-friendly day outdoors.', 'Describe a natural place from a photograph.', 'Make a visitor checklist for a park.'],
    facts: ['Observation tasks encourage precise adjectives and past-tense storytelling.', 'Outdoor topics can include care for shared spaces without becoming a lecture.'],
    words: ['forest|a large area covered with trees|лес|We walked through the forest.','lake|a large area of water surrounded by land|озеро|The lake was calm.','trail|a path through the countryside|тропа|Follow the marked trail.','wildlife|animals and plants living in nature|дикая природа|The park protects wildlife.','camp|to stay outdoors in a tent|кемпинговать|We camped near the lake.','binoculars|a tool for seeing far-away things|бинокль|She used binoculars to watch birds.','litter|rubbish left in a public place|мусор|Please take your litter home.','shelter|a place that protects people from weather|укрытие|We waited in a shelter.']
  },
  {
    id: 'sports-fitness-a2', title: 'Sports & Fitness', subtitle: 'training, ability and healthy routines', level: 'A2', domain: 'Health & Leisure', icon: 'SPORT', accent: '#ef4444', defaultTool: 'discussion', tags: ['sport', 'health', 'habits'],
    grammar: 'Can for ability; have to for rules; adverbs of frequency for routines.',
    sourceText: 'A group chooses a simple fitness routine. They discuss warm-ups, safe goals, rest days and how to encourage a beginner without pressure.',
    prompts: ['Design a ten-minute class warm-up.', 'Interview a partner about an activity they enjoy.', 'Give supportive advice to a new player.'],
    facts: ['Fitness language works well with frequency adverbs and imperatives.', 'A supportive coaching role-play keeps the focus on communication rather than performance.'],
    words: ['warm-up|easy activity before harder exercise|разминка|Start with a short warm-up.','stretch|to make a muscle longer by moving gently|растягиваться|Stretch your legs carefully.','coach|a person who trains a team or player|тренер|The coach explains the drill.','match|a sports game between players or teams|матч|The match starts at six.','score|the number of points in a game|счёт|What was the final score?','practice|repeated training to improve|тренировка|We practice twice a week.','rest|a period without activity|отдых|Take a rest if you feel tired.','goal|something you want to achieve|цель|My goal is to run five kilometres.']
  },
  {
    id: 'feelings-advice-a2', title: 'Feelings & Advice', subtitle: 'emotions, reasons and practical support', level: 'A2', domain: 'Wellbeing', icon: 'FEEL', accent: '#db2777', defaultTool: 'dialogue', tags: ['feelings', 'advice', 'speaking'],
    grammar: 'I feel... because... You should... / You could... / Why do not you...?',
    sourceText: 'A student feels nervous about a presentation. A friend listens, asks a question and suggests a small plan for preparing and resting.',
    prompts: ['Match situations to feelings.', 'Role-play a supportive conversation.', 'Turn unhelpful advice into practical advice.'],
    facts: ['The strongest advice acknowledges a feeling before suggesting an action.', 'Fictional scenarios make emotional language safer to practise in groups.'],
    words: ['nervous|worried about something that may happen|нервный|I feel nervous before tests.','proud|pleased about something you did|гордый|She is proud of her progress.','relieved|happy because a problem is over|испытывающий облегчение|I felt relieved after the call.','lonely|sad because you are alone|одинокий|He felt lonely in a new city.','confused|unable to understand clearly|растерянный|I am confused by this instruction.','support|help or encouragement|поддержка|Thank you for your support.','prepare|to get ready for something|готовиться|I need to prepare for tomorrow.','suggest|to offer an idea|предлагать|Can I suggest a short break?']
  }
];

function materialiseExtraKnowledgeBase(base) {
  const entries = base.words.map(raw => {
    const [term, definition, translation, example] = raw.split('|');
    return { term, definition, translation, example };
  });
  const { words, ...meta } = base;
  return { ...meta, entries };
}

window.TEACHEDOS_KNOWLEDGE_BASES = window.TEACHEDOS_KNOWLEDGE_BASES.map(base => base.words ? materialiseExtraKnowledgeBase(base) : base);
window.TEACHEDOS_KNOWLEDGE_BASES.push(...EXTRA_KNOWLEDGE_BASES.map(materialiseExtraKnowledgeBase));
