/* ════════════════════════════════════════════════════════════════
   game-builder-app.js — TeachEd Game Builder page logic
   Extracted from the inline <script> block for HTTP/SW cacheability
   (loads after app-core.js + vocab-loader.js, same as before)
   ════════════════════════════════════════════════════════════════ */
const PRESETS = {
  pairs: [
    {name:'Food & Drinks',level:'A1',tags:['vocabulary','food'],data:[
      {a:'apple',b:'яблуко'},{a:'bread',b:'хліб'},{a:'milk',b:'молоко'},{a:'cheese',b:'сир'},{a:'water',b:'вода'},
      {a:'coffee',b:'кава'},{a:'tea',b:'чай'},{a:'juice',b:'сік'},{a:'sugar',b:'цукор'},{a:'butter',b:'масло'}]},
    {name:'Animals',level:'A1',tags:['vocabulary','animals'],data:[
      {a:'cat',b:'кіт'},{a:'dog',b:'собака'},{a:'bird',b:'птах'},{a:'fish',b:'риба'},{a:'horse',b:'кінь'},
      {a:'cow',b:'корова'},{a:'pig',b:'свиня'},{a:'sheep',b:'вівця'},{a:'rabbit',b:'кролик'},{a:'mouse',b:'миша'}]},
    {name:'Body Parts',level:'A1',tags:['vocabulary','body'],data:[
      {a:'head',b:'голова'},{a:'hand',b:'рука'},{a:'eye',b:'око'},{a:'ear',b:'вухо'},{a:'nose',b:'ніс'},
      {a:'mouth',b:'рот'},{a:'leg',b:'нога'},{a:'foot',b:'ступня'},{a:'arm',b:'рука'},{a:'finger',b:'палець'}]},
    {name:'Clothes',level:'A1',tags:['vocabulary','clothes'],data:[
      {a:'shirt',b:'сорочка'},{a:'shoes',b:'взуття'},{a:'hat',b:'капелюх'},{a:'dress',b:'сукня'},{a:'jacket',b:'куртка'},
      {a:'trousers',b:'штани'},{a:'socks',b:'шкарпетки'},{a:'skirt',b:'спідниця'},{a:'coat',b:'пальто'},{a:'gloves',b:'рукавички'}]},
    {name:'Family',level:'A1',tags:['vocabulary','family'],data:[
      {a:'mother',b:'мати'},{a:'father',b:'батько'},{a:'sister',b:'сестра'},{a:'brother',b:'брат'},{a:'grandmother',b:'бабуся'},
      {a:'grandfather',b:'дідусь'},{a:'son',b:'син'},{a:'daughter',b:'дочка'},{a:'uncle',b:'дядько'},{a:'aunt',b:'тітка'}]},
    {name:'Weather',level:'A2',tags:['vocabulary','weather'],data:[
      {a:'sunny',b:'сонячно'},{a:'rainy',b:'дощовий'},{a:'cloudy',b:'хмарно'},{a:'windy',b:'вітряно'},{a:'snowy',b:'сніжний'},
      {a:'foggy',b:'туманний'},{a:'stormy',b:'штормовий'},{a:'hot',b:'спекотний'},{a:'cold',b:'холодний'},{a:'warm',b:'теплий'}]},
    {name:'Travel',level:'A2',tags:['vocabulary','travel'],data:[
      {a:'airport',b:'аеропорт'},{a:'hotel',b:'готель'},{a:'ticket',b:'квиток'},{a:'passport',b:'паспорт'},{a:'luggage',b:'багаж'},
      {a:'map',b:'карта'},{a:'bus',b:'автобус'},{a:'train',b:'потяг'},{a:'flight',b:'рейс'},{a:'reservation',b:'бронювання'}]},
    {name:'Emotions',level:'A2',tags:['vocabulary','emotions'],data:[
      {a:'happy',b:'щасливий'},{a:'sad',b:'сумний'},{a:'angry',b:'злий'},{a:'scared',b:'наляканий'},{a:'surprised',b:'здивований'},
      {a:'tired',b:'втомлений'},{a:'excited',b:'схвильований'},{a:'bored',b:'знуджений'},{a:'nervous',b:'нервовий'},{a:'proud',b:'гордий'}]},
    {name:'House & Rooms',level:'A2',tags:['vocabulary','house'],data:[
      {a:'kitchen',b:'кухня'},{a:'bedroom',b:'спальня'},{a:'bathroom',b:'ванна'},{a:'living room',b:'вітальня'},{a:'garden',b:'сад'},
      {a:'garage',b:'гараж'},{a:'roof',b:'дах'},{a:'door',b:'двері'},{a:'window',b:'вікно'},{a:'stairs',b:'сходи'}]},
    {name:'Phrasal Verbs',level:'B1',tags:['grammar','phrasal-verbs'],data:[
      {a:'give up',b:'здаватися'},{a:'look after',b:'доглядати'},{a:'turn off',b:'вимикати'},{a:'put on',b:'одягати'},{a:'take off',b:'знімати'},
      {a:'get along',b:'ладнати'},{a:'break down',b:'зламатися'},{a:'come across',b:'натрапити'},{a:'figure out',b:'розібратися'},{a:'run out of',b:'вичерпати'}]},
    {name:'Collocations',level:'B2',tags:['vocabulary','collocations'],data:[
      {a:'make a decision',b:'прийняти рішення'},{a:'do homework',b:'робити домашку'},{a:'take a break',b:'зробити перерву'},{a:'pay attention',b:'звернути увагу'},{a:'catch a cold',b:'застудитися'},
      {a:'keep a promise',b:'дотримати обіцянку'},{a:'raise awareness',b:'підвищити обізнаність'},{a:'draw a conclusion',b:'зробити висновок'},{a:'meet a deadline',b:'встигнути в термін'},{a:'set a goal',b:'поставити мету'}]},
    {name:'Academic Vocabulary',level:'C1',tags:['vocabulary','academic'],data:[
      {a:'hypothesis',b:'гіпотеза'},{a:'methodology',b:'методологія'},{a:'phenomenon',b:'явище'},{a:'paradigm',b:'парадигма'},{a:'ambiguity',b:'неоднозначність'},
      {a:'implications',b:'наслідки'},{a:'framework',b:'структура'},{a:'coherent',b:'послідовний'},{a:'substantiate',b:'обґрунтувати'},{a:'scrutinize',b:'ретельно вивчити'}]},
    {name:'Idioms',level:'C1',tags:['vocabulary','idioms'],data:[
      {a:'break the ice',b:'розрядити обстановку'},{a:'hit the nail on the head',b:'влучити в точку'},{a:'once in a blue moon',b:'дуже рідко'},{a:'piece of cake',b:'простіше простого'},{a:'spill the beans',b:'розкрити секрет'},
      {a:'cost an arm and a leg',b:'коштувати дуже дорого'},{a:'bite the bullet',b:'зібратися з духом'},{a:'under the weather',b:'погано себе почувати'},{a:'the ball is in your court',b:'тепер твоя черга діяти'},{a:'burn the midnight oil',b:'працювати допізна'}]},
  ],
  words: [
    {name:'School Subjects',level:'A1',tags:['vocabulary','school'],data:['mathematics','history','biology','geography','physics','chemistry','art','music','literature','english']},
    {name:'Colors & Shapes',level:'A1',tags:['vocabulary','colors'],data:['red','blue','green','yellow','purple','orange','circle','square','triangle','rectangle']},
    {name:'Furniture',level:'A1',tags:['vocabulary','furniture'],data:['table','chair','bed','sofa','wardrobe','shelf','desk','lamp','mirror','curtain']},
    {name:'Days & Months',level:'A1',tags:['vocabulary','time'],data:['Monday','Tuesday','Wednesday','Thursday','Friday','January','February','March','April','December']},
    {name:'Professions',level:'A2',tags:['vocabulary','jobs'],data:['doctor','teacher','engineer','lawyer','nurse','pilot','chef','architect','journalist','programmer']},
    {name:'Sports',level:'A2',tags:['vocabulary','sports'],data:['football','basketball','tennis','swimming','volleyball','running','cycling','boxing','skiing','gymnastics']},
    {name:'Musical Instruments',level:'A2',tags:['vocabulary','music'],data:['piano','guitar','violin','drums','flute','trumpet','saxophone','cello','harmonica','accordion']},
    {name:'Environment',level:'B1',tags:['vocabulary','environment'],data:['pollution','recycling','deforestation','endangered','sustainable','ecosystem','biodiversity','conservation','emissions','renewable']},
    {name:'Technology',level:'B1',tags:['vocabulary','technology'],data:['algorithm','database','encryption','bandwidth','interface','firmware','prototype','debugging','repository','middleware']},
    {name:'Business English',level:'B2',tags:['vocabulary','business'],data:['stakeholder','acquisition','revenue','benchmark','outsourcing','leverage','synergy','compliance','turnover','franchise']},
    {name:'Psychology Terms',level:'C1',tags:['vocabulary','psychology'],data:['cognition','perception','reinforcement','conditioning','subliminal','introspection','extraversion','resilience','neurotransmitter','psychosomatic']},
    {name:'Literature Terms',level:'C1',tags:['vocabulary','literature'],data:['metaphor','allegory','protagonist','narrative','symbolism','irony','foreshadowing','juxtaposition','soliloquy','denouement']},
  ],
  sentences: [
    {name:'Present Simple',level:'A1',tags:['grammar','present-simple'],data:[
      'She ___ (go) to school every day.','They ___ (play) football on Saturdays.',
      'He ___ (not/like) spicy food.','___ you ___ (speak) English?',
      'The sun ___ (rise) in the east.','My mother ___ (work) in a hospital.',
      'We ___ (not/have) a car.','___ she ___ (live) in London?']},
    {name:'Past Simple',level:'A2',tags:['grammar','past-simple'],data:[
      'I ___ (visit) Paris last summer.','She ___ (not/go) to the party yesterday.',
      '___ you ___ (see) that movie?','They ___ (buy) a new house in 2020.',
      'He ___ (break) his leg last week.','We ___ (meet) at university.',
      'The train ___ (arrive) late.','She ___ (write) a letter to her friend.']},
    {name:'Present Perfect',level:'B1',tags:['grammar','present-perfect'],data:[
      'I ___ (never/be) to Japan.','She ___ (already/finish) her homework.',
      'They ___ (live) here since 2010.','___ you ___ (ever/try) sushi?',
      'He ___ (just/arrive) home.','We ___ (not/see) that film yet.',
      'She ___ (work) here for five years.','The price ___ (go) up recently.']},
    {name:'Conditionals',level:'B1',tags:['grammar','conditionals'],data:[
      'If it ___ (rain), we will stay home.','If I ___ (be) you, I would study harder.',
      'If she ___ (have) more time, she would travel.','If they ___ (not/hurry), they will miss the bus.',
      'If I ___ (know) the answer, I would tell you.','If we ___ (win) the lottery, we would buy a house.',
      'If he ___ (study) harder, he will pass.','If it ___ (be) sunny, we will go to the beach.']},
    {name:'Passive Voice',level:'B2',tags:['grammar','passive'],data:[
      'The cake ___ (make) by my grandmother.','English ___ (speak) in many countries.',
      'The letter ___ (write) yesterday.','The new bridge ___ (build) next year.',
      'The homework ___ (not/finish) yet.','The meeting ___ (cancel) due to weather.',
      'The song ___ (perform) by a famous artist.','The results ___ (announce) tomorrow.']},
    {name:'Reported Speech',level:'B2',tags:['grammar','reported-speech'],data:[
      'She said she ___ (be) tired.','He told me he ___ (can/not) come.',
      'They said they ___ (go) to the cinema.','She asked if I ___ (want) some coffee.',
      'He said he ___ (finish) the project.','She told me she ___ (be) leaving.',
      'They asked where I ___ (live).','He mentioned that he ___ (see) the film.']},
    {name:'Subjunctive & Inversion',level:'C1',tags:['grammar','advanced'],data:[
      'It is essential that she ___ (be) present.','Had I ___ (know), I would have helped.',
      'Not only ___ (do) he sing, but he also dances.','Rarely ___ (have) I seen such talent.',
      'Were she ___ (arrive) earlier, we could have met.','It is vital that he ___ (submit) the form.',
      'Seldom ___ (do) we encounter such problems.','Should you ___ (need) help, call me.']},
    {name:'Articles',level:'B1',tags:['grammar','articles'],data:[
      'She plays ___ piano very well.','I saw ___ interesting film yesterday.',
      '___ sun is shining brightly today.','He is ___ best student in the class.',
      'I need ___ umbrella, it is raining.','She works as ___ engineer.',
      'We visited ___ United Kingdom last year.','Life is ___ gift.']},
  ],
  statements: [
    {name:'Grammar Rules',level:'A2',tags:['grammar','rules'],data:[
      {text:'We use "a" before words starting with a consonant sound.',answer:true},
      {text:'The past simple of "go" is "goed".',answer:false},
      {text:'Adverbs usually modify verbs, adjectives, or other adverbs.',answer:true},
      {text:'You can use "much" with countable nouns.',answer:false},
      {text:'The present perfect is formed with have/has + past participle.',answer:true},
      {text:'"Fewer" is used with uncountable nouns.',answer:false},
      {text:'Modal verbs do not change form for third person singular.',answer:true},
      {text:'A gerund always functions as a verb.',answer:false}]},
    {name:'UK Culture Facts',level:'B1',tags:['culture','uk'],data:[
      {text:'London is the capital of England.',answer:true},
      {text:'The UK has a written constitution.',answer:false},
      {text:'Tea is the most popular hot drink in the UK.',answer:true},
      {text:'The UK drives on the right side of the road.',answer:false},
      {text:'The British pound is the official currency.',answer:true},
      {text:'Scotland is not part of the UK.',answer:false},
      {text:'Big Ben is actually the name of the bell, not the tower.',answer:true},
      {text:'The UK monarch has unlimited political power.',answer:false}]},
    {name:'Science Facts',level:'B1',tags:['science','facts'],data:[
      {text:'Water boils at 100 degrees Celsius at sea level.',answer:true},
      {text:'Sound travels faster than light.',answer:false},
      {text:'The Earth revolves around the Sun.',answer:true},
      {text:'Diamonds are made of iron.',answer:false},
      {text:'Human body is approximately 60% water.',answer:true},
      {text:'There are 5 oceans on Earth.',answer:true},
      {text:'Lightning never strikes the same place twice.',answer:false},
      {text:'Antibiotics can treat viral infections.',answer:false}]},
    {name:'US Culture Facts',level:'B1',tags:['culture','usa'],data:[
      {text:'Washington D.C. is the capital of the USA.',answer:true},
      {text:'The USA has 52 states.',answer:false},
      {text:'The Statue of Liberty was a gift from France.',answer:true},
      {text:'The American flag has 13 stripes.',answer:true},
      {text:'Thanksgiving is celebrated in September.',answer:false},
      {text:'The bald eagle is the national bird.',answer:true},
      {text:'The US president serves 6-year terms.',answer:false},
      {text:'The first man on the moon was American.',answer:true}]},
    {name:'Environment Facts',level:'B2',tags:['environment','facts'],data:[
      {text:'The Amazon rainforest produces 20% of the world oxygen.',answer:false},
      {text:'Plastic takes hundreds of years to decompose.',answer:true},
      {text:'Solar energy is a renewable resource.',answer:true},
      {text:'Deforestation has no effect on climate change.',answer:false},
      {text:'The ozone layer protects us from UV radiation.',answer:true},
      {text:'Coral reefs are not affected by ocean warming.',answer:false},
      {text:'Electric cars produce zero direct emissions.',answer:true},
      {text:'Recycling aluminum saves 95% of the energy.',answer:true}]},
  ],
  mcq: [
    {name:'Verb Tenses',level:'A2',tags:['grammar','tenses'],data:[
      {q:'She ___ to school every day.',opts:['go','goes','going','gone'],correct:1},
      {q:'They ___ football yesterday.',opts:['play','plays','played','playing'],correct:2},
      {q:'I ___ already eaten lunch.',opts:['has','have','had','having'],correct:1},
      {q:'He ___ TV when I called.',opts:['watches','watched','was watching','has watched'],correct:2},
      {q:'We ___ to Paris next summer.',opts:['go','went','will go','have gone'],correct:2}]},
    {name:'Prepositions',level:'A2',tags:['grammar','prepositions'],data:[
      {q:'She arrived ___ Monday.',opts:['in','on','at','by'],correct:1},
      {q:'The book is ___ the table.',opts:['in','at','on','by'],correct:2},
      {q:'I am interested ___ music.',opts:['on','in','at','for'],correct:1},
      {q:'He lives ___ London.',opts:['on','at','in','to'],correct:2},
      {q:'We are waiting ___ the bus.',opts:['to','on','at','for'],correct:3}]},
    {name:'Confusing Words',level:'B1',tags:['vocabulary','confusing'],data:[
      {q:'I need your ___ on this matter.',opts:['advice','advise','adviced','advising'],correct:0},
      {q:'The weather had a big ___ on the game.',opts:['affect','effect','affection','effective'],correct:1},
      {q:'She ___ her keys on the table.',opts:['lay','laid','lied','lain'],correct:1},
      {q:'There are ___ students than last year.',opts:['less','fewer','lesser','least'],correct:1},
      {q:'The company will ___ new employees.',opts:['hire','higher','hier','hyre'],correct:0}]},
    {name:'Word Formation',level:'B2',tags:['vocabulary','word-formation'],data:[
      {q:'The ___ of the project was impressive. (achieve)',opts:['achievement','achievable','achiever','achieving'],correct:0},
      {q:'She spoke with great ___ . (confident)',opts:['confidently','confidence','confiding','confidential'],correct:1},
      {q:'The film was very ___ . (entertain)',opts:['entertainment','entertained','entertaining','entertainer'],correct:2},
      {q:'We need to ___ the process. (simple)',opts:['simply','simplify','simplicity','simplistic'],correct:1},
      {q:'It was an ___ experience. (forget)',opts:['unforgettable','forgetful','forgettable','forgotten'],correct:0}]},
    {name:'Modals',level:'B1',tags:['grammar','modals'],data:[
      {q:'You ___ wear a seatbelt. It is the law.',opts:['should','must','can','might'],correct:1},
      {q:'___ I use your phone, please?',opts:['Must','Should','May','Will'],correct:2},
      {q:'She ___ be at home. Her car is there.',opts:['can','must','should','would'],correct:1},
      {q:'You ___ eat so much sugar. It is bad.',opts:['should not','must not','cannot','will not'],correct:0},
      {q:'He ___ swim when he was five.',opts:['can','could','may','must'],correct:1}]},
  ],
  categories: [
    {name:'Parts of Speech',level:'A2',tags:['grammar','parts-of-speech'],data:[
      {name:'Nouns',words:['table','happiness','dog','city','freedom']},
      {name:'Verbs',words:['run','think','create','become','understand']},
      {name:'Adjectives',words:['beautiful','quick','enormous','clever','ancient']},
      {name:'Adverbs',words:['quickly','never','very','always','carefully']}]},
    {name:'Food Groups',level:'A1',tags:['vocabulary','food'],data:[
      {name:'Fruits',words:['apple','banana','orange','grape','strawberry']},
      {name:'Vegetables',words:['carrot','potato','tomato','onion','broccoli']},
      {name:'Dairy',words:['milk','cheese','yogurt','butter','cream']},
      {name:'Grains',words:['bread','rice','pasta','oats','cereal']}]},
    {name:'Word Families',level:'B1',tags:['vocabulary','word-families'],data:[
      {name:'-tion words',words:['education','information','celebration','creation','motivation']},
      {name:'-ness words',words:['happiness','darkness','kindness','weakness','sadness']},
      {name:'-ful words',words:['beautiful','wonderful','powerful','grateful','cheerful']},
      {name:'-less words',words:['hopeless','careless','useless','endless','fearless']}]},
    {name:'Formal vs Informal',level:'B2',tags:['vocabulary','register'],data:[
      {name:'Formal',words:['commence','purchase','enquire','residence','sufficient']},
      {name:'Informal',words:['start','buy','ask','home','enough']},
      {name:'Slang',words:['cool','awesome','gonna','wanna','chill']},
      {name:'Academic',words:['analyze','hypothesis','methodology','paradigm','synthesize']}]},
    {name:'British vs American',level:'B2',tags:['vocabulary','varieties'],data:[
      {name:'British',words:['flat','lorry','biscuit','lift','petrol']},
      {name:'American',words:['apartment','truck','cookie','elevator','gasoline']},
      {name:'Both use',words:['computer','telephone','internet','music','book']}]},
  ],
};

const THEME_DICTIONARIES = [
  {id:'daily-routine-a1',icon:'🌅',name:'Daily Routine',level:'A1',topic:'Daily Life',tags:['routine','verbs','beginner'],pairs:[
    ['wake up','просыпаться'],['brush teeth','чистить зубы'],['have breakfast','завтракать'],['go to work','идти на работу'],
    ['study','учиться'],['have lunch','обедать'],['come home','приходить домой'],['do homework','делать домашку'],
    ['take a shower','принимать душ'],['go to bed','ложиться спать'],['get dressed','одеваться'],['relax','отдыхать']
  ]},
  {id:'classroom-a1',icon:'🎒',name:'Classroom Objects',level:'A1',topic:'Daily Life',tags:['school','objects','kids'],pairs:[
    ['pen','ручка'],['pencil','карандаш'],['notebook','тетрадь'],['textbook','учебник'],['rubber','ластик'],['ruler','линейка'],
    ['whiteboard','доска'],['marker','маркер'],['desk','парта'],['chair','стул'],['folder','папка'],['backpack','рюкзак']
  ]},
  {id:'city-places-a2',icon:'🏙️',name:'City Places',level:'A2',topic:'Travel',tags:['city','directions','places'],pairs:[
    ['pharmacy','аптека'],['bakery','пекарня'],['post office','почта'],['train station','вокзал'],['bus stop','остановка'],
    ['crossroads','перекресток'],['traffic lights','светофор'],['square','площадь'],['museum','музей'],['town hall','мэрия'],
    ['subway','метро'],['pedestrian crossing','пешеходный переход']
  ]},
  {id:'restaurant-a2',icon:'🍽️',name:'Restaurant English',level:'A2',topic:'Travel',tags:['food','restaurant','speaking'],pairs:[
    ['menu','меню'],['starter','закуска'],['main course','основное блюдо'],['dessert','десерт'],['bill','счет'],['tip','чаевые'],
    ['waiter','официант'],['reservation','бронь'],['table for two','столик на двоих'],['still water','негазированная вода'],
    ['takeaway','еда с собой'],['allergy','аллергия']
  ]},
  {id:'small-talk-b1',icon:'💬',name:'Small Talk Starters',level:'B1',topic:'Speaking',tags:['speaking','conversation','phrases'],pairs:[
    ['How is it going?','Как дела?'],['What do you do?','Чем вы занимаетесь?'],['That sounds interesting.','Звучит интересно.'],
    ['Do you come here often?','Вы часто сюда приходите?'],['How was your weekend?','Как прошли выходные?'],
    ['I have heard a lot about it.','Я много об этом слышал(а).'],['What are you into?','Чем увлекаешься?'],
    ['No way!','Не может быть!'],['I totally agree.','Полностью согласен/согласна.'],['It depends.','Зависит от ситуации.'],
    ['Fair enough.','Справедливо.'],['Tell me more.','Расскажи подробнее.']
  ]},
  {id:'health-b1',icon:'🩺',name:'Health & Symptoms',level:'B1',topic:'Daily Life',tags:['health','doctor','symptoms'],pairs:[
    ['headache','головная боль'],['sore throat','боль в горле'],['cough','кашель'],['fever','температура'],['dizzy','головокружение'],
    ['appointment','прием'],['prescription','рецепт'],['painkiller','обезболивающее'],['recover','выздоравливать'],
    ['injury','травма'],['blood pressure','давление'],['swollen','опухший']
  ]},
  {id:'business-meetings-b2',icon:'🤝',name:'Business Meetings',level:'B2',topic:'Business',tags:['business','meetings','work'],pairs:[
    ['agenda','повестка'],['minutes','протокол встречи'],['deadline','дедлайн'],['follow-up','последующее действие'],
    ['stakeholder','заинтересованная сторона'],['briefing','инструктаж'],['takeaway','ключевой вывод'],['action point','задача после встречи'],
    ['align','согласовать'],['postpone','отложить'],['wrap up','завершить'],['raise a concern','поднять проблему']
  ]},
  {id:'marketing-b2',icon:'📣',name:'Marketing & Sales',level:'B2',topic:'Business',tags:['marketing','sales','business'],pairs:[
    ['target audience','целевая аудитория'],['brand awareness','узнаваемость бренда'],['lead','потенциальный клиент'],
    ['conversion rate','коэффициент конверсии'],['campaign','кампания'],['launch','запуск'],['pitch','презентация идеи'],
    ['retention','удержание'],['upsell','допродажа'],['customer journey','путь клиента'],['value proposition','ценностное предложение'],
    ['competitor','конкурент']
  ]},
  {id:'ielts-education-b2',icon:'🎓',name:'IELTS Education',level:'B2',topic:'Exam',tags:['ielts','education','essay'],pairs:[
    ['curriculum','учебная программа'],['assessment','оценивание'],['tuition fees','плата за обучение'],['vocational training','профобучение'],
    ['academic performance','успеваемость'],['discipline','дисциплина'],['lifelong learning','обучение всю жизнь'],
    ['critical thinking','критическое мышление'],['peer pressure','давление сверстников'],['dropout rate','процент отчисления'],
    ['scholarship','стипендия'],['compulsory education','обязательное образование']
  ]},
  {id:'ielts-environment-b2',icon:'🌍',name:'IELTS Environment',level:'B2',topic:'Exam',tags:['ielts','environment','essay'],pairs:[
    ['carbon footprint','углеродный след'],['renewable energy','возобновляемая энергия'],['fossil fuels','ископаемое топливо'],
    ['waste disposal','утилизация отходов'],['single-use plastic','одноразовый пластик'],['climate change','изменение климата'],
    ['deforestation','вырубка лесов'],['biodiversity','биоразнообразие'],['sustainable lifestyle','устойчивый образ жизни'],
    ['public transport','общественный транспорт'],['emissions','выбросы'],['conservation','сохранение природы']
  ]},
  {id:'academic-linkers-c1',icon:'🧠',name:'Academic Linkers',level:'C1',topic:'Academic',tags:['writing','linkers','academic'],pairs:[
    ['moreover','более того'],['nevertheless','тем не менее'],['therefore','следовательно'],['whereas','тогда как'],
    ['provided that','при условии что'],['in contrast','в отличие от'],['consequently','в результате'],['namely','а именно'],
    ['to some extent','в некоторой степени'],['by contrast','напротив'],['notwithstanding','несмотря на'],['in light of','с учетом']
  ]},
  {id:'advanced-feelings-c1',icon:'🎭',name:'Nuanced Feelings',level:'C1',topic:'Speaking',tags:['emotions','advanced','speaking'],pairs:[
    ['overwhelmed','перегруженный'],['relieved','испытавший облегчение'],['resentful','обиженный'],['apprehensive','тревожный'],
    ['thrilled','в восторге'],['devastated','опустошенный'],['indifferent','равнодушный'],['bewildered','сбитый с толку'],
    ['content','довольный'],['uneasy','не по себе'],['nostalgic','ностальгирующий'],['self-conscious','смущенный/скованный']
  ]},
  {id:'numbers-time-a1',icon:'🔢',name:'Numbers & Time',level:'A1',topic:'Daily Life',tags:['numbers','time','beginner'],pairs:[
    ['one hundred','сто'],['quarter past','пятнадцать минут после'],['half past','половина после'],['quarter to','без пятнадцати'],['midnight','полночь'],['noon','полдень'],['early','рано'],['late','поздно'],['weekday','будний день'],['weekend','выходные'],['calendar','календарь'],['schedule','расписание']
  ]},
  {id:'toys-kids-a1',icon:'🧸',name:'Toys & Kids',level:'A1',topic:'Kids',tags:['kids','toys','young learners'],pairs:[
    ['teddy bear','плюшевый мишка'],['doll','кукла'],['blocks','кубики'],['ball','мяч'],['kite','воздушный змей'],['puzzle','пазл'],['robot','робот'],['train set','железная дорога'],['crayons','мелки'],['stickers','наклейки'],['jump rope','скакалка'],['board game','настольная игра']
  ]},
  {id:'animals-advanced-b1',icon:'🦊',name:'Wild Animals',level:'B1',topic:'Daily Life',tags:['animals','nature','description'],pairs:[
    ['fox','лиса'],['deer','олень'],['wolf','волк'],['squirrel','белка'],['eagle','орел'],['owl','сова'],['whale','кит'],['shark','акула'],['turtle','черепаха'],['lizard','ящерица'],['beetle','жук'],['butterfly','бабочка']
  ]},
  {id:'shopping-a2',icon:'🛍️',name:'Shopping & Money',level:'A2',topic:'Daily Life',tags:['shopping','money','speaking'],pairs:[
    ['receipt','чек'],['discount','скидка'],['refund','возврат денег'],['cashier','кассир'],['fitting room','примерочная'],['size','размер'],['bargain','выгодная покупка'],['price tag','ценник'],['cash','наличные'],['card payment','оплата картой'],['out of stock','нет в наличии'],['exchange','обменять']
  ]},
  {id:'directions-a2',icon:'🧭',name:'Directions & Transport',level:'A2',topic:'Travel',tags:['directions','transport','city'],pairs:[
    ['turn left','поверните налево'],['turn right','поверните направо'],['go straight','идите прямо'],['opposite','напротив'],['next to','рядом с'],['behind','за'],['platform','платформа'],['fare','стоимость проезда'],['single ticket','билет в одну сторону'],['return ticket','билет туда-обратно'],['traffic jam','пробка'],['timetable','расписание']
  ]},
  {id:'hotel-travel-b1',icon:'🏨',name:'Hotel Problems',level:'B1',topic:'Travel',tags:['hotel','complaints','roleplay'],pairs:[
    ['room key','ключ от номера'],['reception','ресепшен'],['check out','выселиться'],['noisy neighbours','шумные соседи'],['air conditioning','кондиционер'],['towels','полотенца'],['housekeeping','уборка номера'],['deposit','залог'],['double room','двухместный номер'],['sea view','вид на море'],['complaint','жалоба'],['upgrade','повышение класса номера']
  ]},
  {id:'airport-b1',icon:'🛫',name:'Airport & Flights',level:'B1',topic:'Travel',tags:['airport','travel','speaking'],pairs:[
    ['departure gate','выход на посадку'],['boarding pass','посадочный талон'],['carry-on luggage','ручная кладь'],['checked baggage','зарегистрированный багаж'],['security check','контроль безопасности'],['customs','таможня'],['delayed flight','задержанный рейс'],['cancelled flight','отмененный рейс'],['baggage claim','выдача багажа'],['overbooked','сверх брони'],['aisle seat','место у прохода'],['window seat','место у окна']
  ]},
  {id:'home-chores-a2',icon:'🧹',name:'Home & Chores',level:'A2',topic:'Daily Life',tags:['home','chores','verbs'],pairs:[
    ['do the laundry','стирать'],['wash the dishes','мыть посуду'],['vacuum','пылесосить'],['mop the floor','мыть пол'],['take out the rubbish','выносить мусор'],['make the bed','заправлять кровать'],['dust the shelves','вытирать пыль'],['iron clothes','гладить одежду'],['feed the pet','кормить питомца'],['water the plants','поливать растения'],['tidy up','убираться'],['fix a leak','чинить протечку']
  ]},
  {id:'relationships-b1',icon:'🫶',name:'Relationships',level:'B1',topic:'Speaking',tags:['relationships','people','speaking'],pairs:[
    ['get on well','хорошо ладить'],['fall out','поссориться'],['make up','помириться'],['trust','доверять'],['supportive','поддерживающий'],['reliable','надежный'],['jealous','ревнивый'],['honest','честный'],['keep in touch','поддерживать связь'],['lose touch','потерять связь'],['close friend','близкий друг'],['mutual respect','взаимное уважение']
  ]},
  {id:'workplace-b1',icon:'🏢',name:'Workplace Basics',level:'B1',topic:'Business',tags:['work','office','career'],pairs:[
    ['colleague','коллега'],['manager','менеджер'],['salary','зарплата'],['shift','смена'],['overtime','сверхурочные'],['sick leave','больничный'],['promotion','повышение'],['resign','уволиться'],['apply for a job','подать заявку на работу'],['job interview','собеседование'],['remote work','удаленная работа'],['teamwork','командная работа']
  ]},
  {id:'customer-service-b2',icon:'🎧',name:'Customer Service',level:'B2',topic:'Business',tags:['support','service','business'],pairs:[
    ['resolve an issue','решить проблему'],['escalate a ticket','передать заявку выше'],['refund request','запрос на возврат'],['customer satisfaction','удовлетворенность клиента'],['response time','время ответа'],['service outage','сбой сервиса'],['workaround','обходное решение'],['follow up','связаться повторно'],['apologise for inconvenience','извиниться за неудобства'],['terms and conditions','условия использования'],['loyal customer','постоянный клиент'],['complaint handling','обработка жалоб']
  ]},
  {id:'startup-b2',icon:'🚀',name:'Startup Vocabulary',level:'B2',topic:'Business',tags:['startup','product','business'],pairs:[
    ['founder','основатель'],['funding round','раунд финансирования'],['pitch deck','презентация для инвесторов'],['market fit','соответствие рынку'],['early adopter','ранний пользователь'],['runway','запас времени до конца денег'],['burn rate','скорость сжигания денег'],['scale up','масштабироваться'],['pivot','изменить направление'],['traction','первые результаты/рост'],['equity','доля в компании'],['valuation','оценка стоимости']
  ]},
  {id:'it-support-b1',icon:'🖥️',name:'IT Support',level:'B1',topic:'Tech',tags:['tech','support','problems'],pairs:[
    ['restart','перезагрузить'],['update','обновление'],['password reset','сброс пароля'],['login issue','проблема со входом'],['screen freezes','экран зависает'],['backup','резервная копия'],['settings','настройки'],['device','устройство'],['connection','соединение'],['install','установить'],['uninstall','удалить программу'],['error message','сообщение об ошибке']
  ]},
  {id:'ai-tech-c1',icon:'🤖',name:'AI & Digital Society',level:'C1',topic:'Tech',tags:['ai','technology','discussion'],pairs:[
    ['automation','автоматизация'],['bias','предвзятость'],['data privacy','конфиденциальность данных'],['surveillance','наблюдение'],['machine learning','машинное обучение'],['prompt engineering','инжиниринг запросов'],['hallucination','галлюцинация ИИ'],['synthetic media','синтетические медиа'],['digital literacy','цифровая грамотность'],['regulation','регулирование'],['ethical concern','этическая проблема'],['human oversight','человеческий контроль']
  ]},
  {id:'cybersecurity-c1',icon:'🔐',name:'Cybersecurity',level:'C1',topic:'Tech',tags:['security','tech','business'],pairs:[
    ['data breach','утечка данных'],['two-factor authentication','двухфакторная аутентификация'],['malware','вредоносное ПО'],['ransomware','программа-вымогатель'],['vulnerability','уязвимость'],['patch','исправление/патч'],['credentials','учетные данные'],['phishing attempt','попытка фишинга'],['secure connection','безопасное соединение'],['access rights','права доступа'],['incident response','реакция на инцидент'],['audit trail','журнал действий']
  ]},
  {id:'movies-culture-b1',icon:'🎬',name:'Movies & Series',level:'B1',topic:'Culture',tags:['movies','culture','opinions'],pairs:[
    ['plot','сюжет'],['cast','актерский состав'],['scene','сцена'],['soundtrack','саундтрек'],['subtitle','субтитры'],['season finale','финал сезона'],['cliffhanger','открытый напряженный финал'],['review','рецензия'],['genre','жанр'],['character development','развитие персонажа'],['twist ending','неожиданная концовка'],['binge-watch','смотреть запоем']
  ]},
  {id:'music-culture-b1',icon:'🎧',name:'Music & Festivals',level:'B1',topic:'Culture',tags:['music','culture','speaking'],pairs:[
    ['lyrics','текст песни'],['beat','ритм'],['chorus','припев'],['verse','куплет'],['live performance','живое выступление'],['venue','площадка'],['headline act','главный артист'],['support act','разогрев'],['playlist','плейлист'],['album release','релиз альбома'],['crowd','толпа'],['encore','выход на бис']
  ]},
  {id:'news-media-b2',icon:'📰',name:'News & Media',level:'B2',topic:'Culture',tags:['media','news','critical thinking'],pairs:[
    ['headline','заголовок'],['source','источник'],['coverage','освещение'],['breaking news','срочные новости'],['misleading','вводящий в заблуждение'],['fact-check','проверка фактов'],['bias','предвзятость'],['editorial','редакционная статья'],['public opinion','общественное мнение'],['viral story','вирусная история'],['reliable outlet','надежное издание'],['media literacy','медиаграмотность']
  ]},
  {id:'ielts-health-b2',icon:'🏥',name:'IELTS Health',level:'B2',topic:'Exam',tags:['ielts','health','essay'],pairs:[
    ['public healthcare','государственное здравоохранение'],['preventive medicine','профилактическая медицина'],['sedentary lifestyle','малоподвижный образ жизни'],['balanced diet','сбалансированное питание'],['life expectancy','ожидаемая продолжительность жизни'],['mental wellbeing','психическое благополучие'],['health insurance','медицинская страховка'],['chronic disease','хроническое заболевание'],['medical treatment','лечение'],['obesity rate','уровень ожирения'],['health awareness','осведомленность о здоровье'],['patient care','уход за пациентом']
  ]},
  {id:'ielts-crime-b2',icon:'⚖️',name:'IELTS Crime & Law',level:'B2',topic:'Exam',tags:['ielts','crime','law'],pairs:[
    ['law-abiding citizen','законопослушный гражданин'],['commit a crime','совершить преступление'],['deterrent','сдерживающий фактор'],['rehabilitation','реабилитация'],['reoffend','совершить преступление повторно'],['community service','общественные работы'],['prison sentence','тюремный срок'],['juvenile crime','подростковая преступность'],['law enforcement','правоохранительные органы'],['victim','жертва'],['evidence','доказательство'],['trial','судебный процесс']
  ]},
  {id:'ielts-technology-b2',icon:'📱',name:'IELTS Technology',level:'B2',topic:'Exam',tags:['ielts','technology','essay'],pairs:[
    ['screen time','время перед экраном'],['digital divide','цифровое неравенство'],['online privacy','приватность онлайн'],['remote learning','дистанционное обучение'],['social isolation','социальная изоляция'],['technological progress','технологический прогресс'],['user-friendly','удобный для пользователя'],['replace human labour','заменять человеческий труд'],['artificial intelligence','искусственный интеллект'],['data protection','защита данных'],['online addiction','зависимость от интернета'],['digital skills','цифровые навыки']
  ]},
  {id:'cambridge-b2-phrasals',icon:'🧩',name:'B2 Phrasal Verb Set',level:'B2',topic:'Grammar',tags:['phrasal verbs','cambridge','b2'],pairs:[
    ['bring up','поднять тему/воспитать'],['come up with','придумать'],['carry out','проводить/выполнять'],['look into','расследовать'],['put off','отложить'],['take over','взять контроль'],['turn down','отклонить'],['work out','разобраться/получиться'],['set up','создать/настроить'],['run into','случайно встретить/столкнуться'],['get away with','избежать наказания'],['come across as','производить впечатление']
  ]},
  {id:'c1-discourse-markers',icon:'🔗',name:'C1 Discourse Markers',level:'C1',topic:'Academic',tags:['speaking','writing','cohesion'],pairs:[
    ['having said that','тем не менее'],['as far as I am concerned','насколько я считаю'],['to put it another way','иначе говоря'],['what is more','более того'],['in the long run','в долгосрочной перспективе'],['on balance','взвесив все'],['needless to say','само собой разумеется'],['for the most part','по большей части'],['broadly speaking','в целом'],['in practical terms','на практике'],['that being said','при этом'],['if anything','если уж на то пошло']
  ]},
  {id:'c2-precision-vocab',icon:'💎',name:'C2 Precision Vocabulary',level:'C2',topic:'Academic',tags:['advanced','precision','writing'],pairs:[
    ['meticulous','скрупулезный'],['tenuous','слабый/неубедительный'],['ubiquitous','повсеместный'],['convoluted','запутанный'],['plausible','правдоподобный'],['discrepancy','несоответствие'],['detrimental','вредный'],['subtle','тонкий/едва заметный'],['robust','надежный'],['redundant','избыточный'],['ambiguous','двусмысленный'],['comprehensive','всеобъемлющий']
  ]}
];

const TEMPLATES = [
  {id:'t1',icon:'\ud83c\udf4e',title:'A1 Food & Drinks Flashcards',type:'flashcards',level:'A1',topic:'Vocabulary',desc:'10 basic food words with Ukrainian translations.',tags:['vocabulary','food','beginner'],presetKey:'pairs',presetIdx:0},
  {id:'t2',icon:'\ud83d\udc3e',title:'A1 Animals Memory Match',type:'memory-match',level:'A1',topic:'Vocabulary',desc:'Match 10 animal names with translations.',tags:['vocabulary','animals'],presetKey:'pairs',presetIdx:1},
  {id:'t3',icon:'\ud83e\uddd1',title:'A1 Body Parts Flashcards',type:'flashcards',level:'A1',topic:'Vocabulary',desc:'Learn body parts with flip cards.',tags:['vocabulary','body'],presetKey:'pairs',presetIdx:2},
  {id:'t4',icon:'\ud83d\udc57',title:'A1 Clothes Memory Match',type:'memory-match',level:'A1',topic:'Vocabulary',desc:'Match clothing items with translations.',tags:['vocabulary','clothes'],presetKey:'pairs',presetIdx:3},
  {id:'t5',icon:'\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66',title:'A1 Family Flashcards',type:'flashcards',level:'A1',topic:'Vocabulary',desc:'Family members vocabulary cards.',tags:['vocabulary','family'],presetKey:'pairs',presetIdx:4},
  {id:'t6',icon:'\ud83d\udcda',title:'A1 School Subjects Scramble',type:'word-scramble',level:'A1',topic:'Vocabulary',desc:'Unscramble school subject names.',tags:['vocabulary','school'],presetKey:'words',presetIdx:0},
  {id:'t7',icon:'\ud83c\udfa8',title:'A1 Colors & Shapes Hangman',type:'hangman',level:'A1',topic:'Vocabulary',desc:'Guess color and shape words.',tags:['vocabulary','colors'],presetKey:'words',presetIdx:1},
  {id:'t8',icon:'\ud83e\ude91',title:'A1 Furniture Word Scramble',type:'word-scramble',level:'A1',topic:'Vocabulary',desc:'Unscramble furniture vocabulary.',tags:['vocabulary','furniture'],presetKey:'words',presetIdx:2},
  {id:'t9',icon:'\ud83d\udcc5',title:'A1 Days & Months Spin Wheel',type:'spin-wheel',level:'A1',topic:'Vocabulary',desc:'Spin to practice days and months.',tags:['vocabulary','time'],presetKey:'words',presetIdx:3},
  {id:'t10',icon:'\u2600\ufe0f',title:'A1 Present Simple Fill-in',type:'fill-blank',level:'A1',topic:'Grammar',desc:'Complete sentences in Present Simple.',tags:['grammar','present-simple'],presetKey:'sentences',presetIdx:0},
  {id:'t11',icon:'\ud83c\udf26\ufe0f',title:'A2 Weather Flashcards',type:'flashcards',level:'A2',topic:'Vocabulary',desc:'Weather vocabulary with translations.',tags:['vocabulary','weather'],presetKey:'pairs',presetIdx:5},
  {id:'t12',icon:'\u2708\ufe0f',title:'A2 Travel Memory Match',type:'memory-match',level:'A2',topic:'Vocabulary',desc:'Match travel words and translations.',tags:['vocabulary','travel'],presetKey:'pairs',presetIdx:6},
  {id:'t13',icon:'\ud83d\ude0a',title:'A2 Emotions Flashcards',type:'flashcards',level:'A2',topic:'Vocabulary',desc:'Learn emotion vocabulary.',tags:['vocabulary','emotions'],presetKey:'pairs',presetIdx:7},
  {id:'t14',icon:'\ud83c\udfe0',title:'A2 House & Rooms Memory',type:'memory-match',level:'A2',topic:'Vocabulary',desc:'Match rooms and household items.',tags:['vocabulary','house'],presetKey:'pairs',presetIdx:8},
  {id:'t15',icon:'\ud83d\udc77',title:'A2 Professions Scramble',type:'word-scramble',level:'A2',topic:'Vocabulary',desc:'Unscramble profession names.',tags:['vocabulary','jobs'],presetKey:'words',presetIdx:4},
  {id:'t16',icon:'\u26bd',title:'A2 Sports Hangman',type:'hangman',level:'A2',topic:'Vocabulary',desc:'Guess the sport.',tags:['vocabulary','sports'],presetKey:'words',presetIdx:5},
  {id:'t17',icon:'\ud83c\udfb5',title:'A2 Musical Instruments Wheel',type:'spin-wheel',level:'A2',topic:'Vocabulary',desc:'Spin and name the instrument.',tags:['vocabulary','music'],presetKey:'words',presetIdx:6},
  {id:'t18',icon:'\ud83d\udcdd',title:'A2 Past Simple Fill-in',type:'fill-blank',level:'A2',topic:'Grammar',desc:'Past Simple gap-fill exercises.',tags:['grammar','past-simple'],presetKey:'sentences',presetIdx:1},
  {id:'t19',icon:'\u26a1',title:'A2 Verb Tenses Speed Quiz',type:'speed-quiz',level:'A2',topic:'Grammar',desc:'Quick-fire verb tense questions.',tags:['grammar','tenses'],presetKey:'mcq',presetIdx:0},
  {id:'t20',icon:'\ud83d\udccd',title:'A2 Prepositions Speed Quiz',type:'speed-quiz',level:'A2',topic:'Grammar',desc:'Test preposition knowledge.',tags:['grammar','prepositions'],presetKey:'mcq',presetIdx:1},
  {id:'t21',icon:'\u2705',title:'A2 Grammar Rules True/False',type:'true-false',level:'A2',topic:'Grammar',desc:'Test basic grammar knowledge.',tags:['grammar','rules'],presetKey:'statements',presetIdx:0},
  {id:'t22',icon:'\ud83d\udcda',title:'A2 Parts of Speech Sort',type:'word-categories',level:'A2',topic:'Grammar',desc:'Sort words into parts of speech.',tags:['grammar','parts-of-speech'],presetKey:'categories',presetIdx:0},
  {id:'t23',icon:'\ud83c\udf4e',title:'A1 Food Groups Sort',type:'word-categories',level:'A1',topic:'Vocabulary',desc:'Sort foods into groups.',tags:['vocabulary','food'],presetKey:'categories',presetIdx:1},
  {id:'t24',icon:'\ud83d\udcd6',title:'B1 Present Perfect Fill-in',type:'fill-blank',level:'B1',topic:'Grammar',desc:'Present Perfect practice sentences.',tags:['grammar','present-perfect'],presetKey:'sentences',presetIdx:2},
  {id:'t25',icon:'\ud83e\udd14',title:'B1 Conditionals Fill-in',type:'fill-blank',level:'B1',topic:'Grammar',desc:'If-clauses gap-fill practice.',tags:['grammar','conditionals'],presetKey:'sentences',presetIdx:3},
  {id:'t26',icon:'\ud83d\udca1',title:'B1 Phrasal Verbs Flashcards',type:'flashcards',level:'B1',topic:'Vocabulary',desc:'Essential phrasal verbs with translations.',tags:['vocabulary','phrasal-verbs'],presetKey:'pairs',presetIdx:9},
  {id:'t27',icon:'\ud83c\udf0d',title:'B1 Environment Scramble',type:'word-scramble',level:'B1',topic:'Vocabulary',desc:'Unscramble environment terms.',tags:['vocabulary','environment'],presetKey:'words',presetIdx:7},
  {id:'t28',icon:'\ud83d\udcbb',title:'B1 Technology Hangman',type:'hangman',level:'B1',topic:'Vocabulary',desc:'Guess technology vocabulary.',tags:['vocabulary','technology'],presetKey:'words',presetIdx:8},
  {id:'t29',icon:'\u2753',title:'B1 Confusing Words Quiz',type:'speed-quiz',level:'B1',topic:'Vocabulary',desc:'Choose the right confusing word.',tags:['vocabulary','confusing'],presetKey:'mcq',presetIdx:2},
  {id:'t30',icon:'\ud83c\udde6\ud83c\uddf7',title:'B1 Modals Speed Quiz',type:'speed-quiz',level:'B1',topic:'Grammar',desc:'Test your modal verbs.',tags:['grammar','modals'],presetKey:'mcq',presetIdx:4},
  {id:'t31',icon:'\ud83c\uddec\ud83c\udde7',title:'B1 UK Culture True/False',type:'true-false',level:'B1',topic:'Culture',desc:'Facts about British culture.',tags:['culture','uk'],presetKey:'statements',presetIdx:1},
  {id:'t32',icon:'\ud83e\uddea',title:'B1 Science Facts True/False',type:'true-false',level:'B1',topic:'Science',desc:'Test your science knowledge.',tags:['science','facts'],presetKey:'statements',presetIdx:2},
  {id:'t33',icon:'\ud83c\uddfa\ud83c\uddf8',title:'B1 US Culture True/False',type:'true-false',level:'B1',topic:'Culture',desc:'Facts about American culture.',tags:['culture','usa'],presetKey:'statements',presetIdx:3},
  {id:'t34',icon:'\ud83d\udcdd',title:'B1 Articles Fill-in',type:'fill-blank',level:'B1',topic:'Grammar',desc:'Practice a/an/the usage.',tags:['grammar','articles'],presetKey:'sentences',presetIdx:7},
  {id:'t35',icon:'\ud83d\udcc1',title:'B1 Word Families Sort',type:'word-categories',level:'B1',topic:'Vocabulary',desc:'Sort words by suffix families.',tags:['vocabulary','word-families'],presetKey:'categories',presetIdx:2},
  {id:'t36',icon:'\ud83d\udd04',title:'B2 Passive Voice Fill-in',type:'fill-blank',level:'B2',topic:'Grammar',desc:'Passive voice gap-fill.',tags:['grammar','passive'],presetKey:'sentences',presetIdx:4},
  {id:'t37',icon:'\ud83d\udde3\ufe0f',title:'B2 Reported Speech Fill-in',type:'fill-blank',level:'B2',topic:'Grammar',desc:'Reported speech practice.',tags:['grammar','reported-speech'],presetKey:'sentences',presetIdx:5},
  {id:'t38',icon:'\ud83e\udd1d',title:'B2 Collocations Flashcards',type:'flashcards',level:'B2',topic:'Vocabulary',desc:'Common English collocations.',tags:['vocabulary','collocations'],presetKey:'pairs',presetIdx:10},
  {id:'t39',icon:'\ud83d\udcbc',title:'B2 Business English Scramble',type:'word-scramble',level:'B2',topic:'Vocabulary',desc:'Unscramble business terms.',tags:['vocabulary','business'],presetKey:'words',presetIdx:9},
  {id:'t40',icon:'\ud83d\udcca',title:'B2 Word Formation Quiz',type:'speed-quiz',level:'B2',topic:'Vocabulary',desc:'Choose correct word forms.',tags:['vocabulary','word-formation'],presetKey:'mcq',presetIdx:3},
  {id:'t41',icon:'\ud83c\udf0d',title:'B2 Environment True/False',type:'true-false',level:'B2',topic:'Environment',desc:'Environment facts quiz.',tags:['environment','facts'],presetKey:'statements',presetIdx:4},
  {id:'t42',icon:'\ud83d\udd00',title:'B2 Formal vs Informal Sort',type:'word-categories',level:'B2',topic:'Vocabulary',desc:'Sort words by register.',tags:['vocabulary','register'],presetKey:'categories',presetIdx:3},
  {id:'t43',icon:'\ud83c\uddec\ud83c\udde7\ud83c\uddfa\ud83c\uddf8',title:'B2 British vs American Sort',type:'word-categories',level:'B2',topic:'Vocabulary',desc:'British or American English?',tags:['vocabulary','varieties'],presetKey:'categories',presetIdx:4},
  {id:'t44',icon:'\ud83c\udf93',title:'C1 Academic Vocabulary Flash',type:'flashcards',level:'C1',topic:'Vocabulary',desc:'Advanced academic words.',tags:['vocabulary','academic'],presetKey:'pairs',presetIdx:11},
  {id:'t45',icon:'\ud83d\udca1',title:'C1 Idioms Flashcards',type:'flashcards',level:'C1',topic:'Vocabulary',desc:'English idioms with meanings.',tags:['vocabulary','idioms'],presetKey:'pairs',presetIdx:12},
  {id:'t46',icon:'\ud83e\udde0',title:'C1 Psychology Scramble',type:'word-scramble',level:'C1',topic:'Vocabulary',desc:'Unscramble psychology terms.',tags:['vocabulary','psychology'],presetKey:'words',presetIdx:10},
  {id:'t47',icon:'\ud83d\udcd6',title:'C1 Literature Terms Hangman',type:'hangman',level:'C1',topic:'Vocabulary',desc:'Guess literary terminology.',tags:['vocabulary','literature'],presetKey:'words',presetIdx:11},
  {id:'t48',icon:'\ud83d\udd00',title:'C1 Subjunctive Fill-in',type:'fill-blank',level:'C1',topic:'Grammar',desc:'Advanced grammar structures.',tags:['grammar','advanced'],presetKey:'sentences',presetIdx:6},
  {id:'t49',icon:'\ud83c\udfb0',title:'C1 Idioms Spin Wheel',type:'spin-wheel',level:'C1',topic:'Vocabulary',desc:'Spin and explain the idiom.',tags:['vocabulary','idioms'],customWords:['break the ice','hit the nail on the head','once in a blue moon','piece of cake','spill the beans','cost an arm and a leg','bite the bullet','under the weather','the ball is in your court','burn the midnight oil']},
  {id:'t50',icon:'\ud83c\udf93',title:'C1 Academic Vocabulary Wheel',type:'spin-wheel',level:'C1',topic:'Vocabulary',desc:'Spin and define the academic term.',tags:['vocabulary','academic'],customWords:['hypothesis','methodology','phenomenon','paradigm','ambiguity','implications','framework','coherent','substantiate','scrutinize']},
];

const GAME_TYPES = [
  {id:'flashcards',icon:'\ud83d\uddc2',name:'Flashcards',desc:'Word + translation/definition flip cards with Got it / Again tracking',tag:'Vocabulary',fields:'pairs',pairLabels:['Word','Translation / Definition'],gameSrc:'games/flashcards.html',w:460,h:560},
  {id:'memory-match',icon:'\ud83e\udde0',name:'Memory Match',desc:'Flip cards to match word-definition pairs from memory',tag:'Vocabulary',fields:'pairs',pairLabels:['Term','Definition'],gameSrc:'games/memory-match.html',w:520,h:600},
  {id:'word-scramble',icon:'\ud83d\udd00',name:'Word Scramble',desc:'Unscramble letters to form the correct word',tag:'Vocabulary',fields:'words',gameSrc:'games/word-scramble.html',w:460,h:520},
  {id:'fill-blank',icon:'\u270d',name:'Fill in the Blank',desc:'Type the missing word to complete each sentence',tag:'Grammar',fields:'sentences',gameSrc:'games/fill-blank.html',w:460,h:560},
  {id:'true-false',icon:'\u2705',name:'True or False',desc:'Rapid-fire statements \u2014 decide if each is true or false',tag:'Grammar',fields:'statements',gameSrc:'games/true-false.html',w:460,h:520},
  {id:'speed-quiz',icon:'\u26a1',name:'Speed Quiz',desc:'4-option MCQ with countdown timer',tag:'Speed',fields:'mcq',gameSrc:'games/speed-quiz.html',w:480,h:560},
  {id:'word-categories',icon:'\ud83d\uddc2',name:'Word Categories',desc:'Sort words into the correct topic groups',tag:'Vocabulary',fields:'categories',gameSrc:'games/word-categories.html',w:560,h:640},
  {id:'spin-wheel',icon:'\ud83c\udfa1',name:'Spin the Wheel',desc:'Editable word wheel \u2014 great for hot-seat vocabulary drills',tag:'Speaking',fields:'words',gameSrc:'games/spin-wheel.html',w:460,h:560},
  {id:'hangman',icon:'\ud83c\udfaf',name:'Hangman',desc:'Guess the hidden word letter by letter',tag:'Spelling',fields:'words',gameSrc:'games/hangman.html',w:460,h:560},
];

const STORAGE_KEY = 'teachedos_custom_games';
let selectedType = null;
let editingId = null;
let activeFilter = 'All';
let activeTplLevel = 'All';
let bulkMode = false;

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ---- INIT ---- */
function init() {
  setNavUser();
  renderTypeGrid();
  renderFilterTabs();
  renderMyGames();
  renderTplLevelTabs();
  renderTemplates();
  renderDictionaryLibrary();
  document.getElementById('dict-count').textContent = THEME_DICTIONARIES.length;
  document.getElementById('my-count').textContent = readGames().length;
  setTimeout(importTeacherToolPayload, 0);
}

function setNavUser() {
  try {
    const user = JSON.parse(localStorage.getItem('teachedos_user') || 'null') || {};
    const name = user.name || 'Teacher';
    document.getElementById('nav-name').textContent = name.split(/\s+/)[0] || 'Teacher';
    document.getElementById('nav-avatar').textContent = (user.avatar && user.avatar !== '\ud83e\uddd1\u200d\ud83c\udfeb') ? user.avatar : (name[0]||'T').toUpperCase();
  } catch {}
}

function importTeacherToolPayload() {
  const raw = sessionStorage.getItem('teachedos_tools_to_game');
  if (!raw) return;
  sessionStorage.removeItem('teachedos_tools_to_game');
  let payload = null;
  try { payload = JSON.parse(raw); } catch { return; }
  if (!payload || !payload.gameType || !payload.content) return;
  selectedType = GAME_TYPES.find(t => t.id === payload.gameType);
  if (!selectedType) return;
  editingId = null;
  renderTypeGrid();
  openBuilder();
  document.getElementById('game-title').value = payload.title || ('Tool import: ' + selectedType.name);
  document.getElementById('game-level').value = payload.level || 'B1';
  document.getElementById('game-tags').value = (payload.tags || ['teacher-tools']).join(', ');
  populateContent({ content: payload.content });
  updateItemCounter();
  renderGameQuality();
  document.getElementById('smart-row').style.display = 'flex';
  toast('Imported from Teacher Tools');
}

/* ---- TEMPLATE GALLERY ---- */
function renderTplLevelTabs() {
  const levels = ['All','A1','A2','B1','B2','C1','C2'];
  document.getElementById('tpl-level-tabs').innerHTML = levels.map(l =>
    `<div class="tab${l===activeTplLevel?' active':''}" onclick="filterTplLevel('${l}')">${l}</div>`
  ).join('');
}

function filterTplLevel(level) {
  activeTplLevel = level;
  renderTplLevelTabs();
  renderTemplates();
}

function renderTemplates() {
  const search = (document.getElementById('tpl-search').value || '').toLowerCase();
  let tpls = TEMPLATES;
  if (activeTplLevel !== 'All') tpls = tpls.filter(t => t.level === activeTplLevel);
  if (search) tpls = tpls.filter(t => (t.title+' '+t.topic+' '+t.desc+' '+t.tags.join(' ')+' '+t.type+' '+t.level).toLowerCase().includes(search));
  const grid = document.getElementById('tpl-grid');
  if (!tpls.length) { grid.innerHTML = '<div class="empty">No templates match your search.</div>'; return; }
  grid.innerHTML = tpls.map(t => `
    <div class="tpl-card" data-level="${esc(t.level)}" onclick="useTemplate('${t.id}')">
      <div class="tpl-icon">${t.icon}</div>
      <div class="tpl-title">${esc(t.title)}</div>
      <div class="tpl-meta">${esc(t.type)} &middot; ${esc(t.level)} &middot; ${esc(t.topic)}</div>
      <div class="tpl-meta">${esc(t.desc)}</div>
      <div class="tpl-bottom">
        ${t.tags.slice(0,3).map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}
      </div>
    </div>`).join('');
}

function getTemplateContent(tpl) {
  if (tpl.customWords) return { words: tpl.customWords };
  const preset = PRESETS[tpl.presetKey][tpl.presetIdx];
  if (!preset) return null;
  const type = GAME_TYPES.find(t => t.id === tpl.type);
  if (!type) return null;
  switch (type.fields) {
    case 'pairs': return { pairs: preset.data.map(d => ({a:d.a,b:d.b})) };
    case 'words': return { words: [...preset.data] };
    case 'sentences': return { sentences: [...preset.data] };
    case 'statements': return { statements: preset.data.map(d => ({text:d.text,answer:d.answer})) };
    case 'mcq': return { questions: preset.data.map(d => ({q:d.q,opts:[...d.opts],correct:d.correct})) };
    case 'categories': return { categories: preset.data.map(d => ({name:d.name,words:[...d.words]})) };
  }
  return null;
}

function useTemplate(tplId) {
  const tpl = TEMPLATES.find(t => t.id === tplId);
  if (!tpl) return;
  selectedType = GAME_TYPES.find(t => t.id === tpl.type);
  if (!selectedType) return;
  editingId = null;
  renderTypeGrid();
  const b = document.getElementById('builder');
  b.classList.add('show');
  document.getElementById('builder-title').textContent = selectedType.icon + ' ' + selectedType.name;
  document.getElementById('builder-sub').textContent = selectedType.desc;
  document.getElementById('game-title').value = tpl.title;
  document.getElementById('game-level').value = tpl.level;
  document.getElementById('game-tags').value = tpl.tags.join(', ');
  document.getElementById('save-btn').textContent = 'Save Game to Library';
  renderPresetBar();
  renderContentFields();
  const content = getTemplateContent(tpl);
  if (content) populateContent({ content });
  updateItemCounter();
  renderGameQuality();
  document.getElementById('smart-row').style.display = 'flex';
  b.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToTemplates() {
  document.getElementById('templates-anchor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---- THEMATIC DICTIONARIES ---- */
function renderDictionaryLibrary() {
  const grid = document.getElementById('dict-grid');
  if (!grid) return;
  const search = (document.getElementById('dict-search')?.value || '').toLowerCase();
  const level = document.getElementById('dict-level')?.value || 'All';
  const topic = document.getElementById('dict-topic')?.value || 'All';
  const sort = document.getElementById('dict-sort')?.value || 'level';
  let dictionaries = [...THEME_DICTIONARIES];
  if (level !== 'All') dictionaries = dictionaries.filter(d => d.level === level);
  if (topic !== 'All') dictionaries = dictionaries.filter(d => d.topic === topic);
  if (search) {
    dictionaries = dictionaries.filter(d => (
      d.name + ' ' + d.level + ' ' + d.topic + ' ' + d.tags.join(' ') + ' ' + d.pairs.flat().join(' ')
    ).toLowerCase().includes(search));
  }
  dictionaries.sort((a,b) => {
    if (sort === 'size') return b.pairs.length - a.pairs.length || a.name.localeCompare(b.name);
    if (sort === 'az') return a.name.localeCompare(b.name);
    if (sort === 'topic') return a.topic.localeCompare(b.topic) || a.level.localeCompare(b.level) || a.name.localeCompare(b.name);
    return a.level.localeCompare(b.level) || a.topic.localeCompare(b.topic) || a.name.localeCompare(b.name);
  });
  renderDictionaryStats(dictionaries);
  if (!dictionaries.length) {
    grid.innerHTML = '<div class="empty">No dictionaries match your filters.</div>';
    return;
  }
  grid.innerHTML = dictionaries.map(d => {
    const preview = d.pairs.slice(0, 7).map(pair => `<span class="dict-word">${esc(pair[0])}</span>`).join('');
    return `
      <div class="dict-card">
        <div class="dict-head">
          <div class="dict-icon">${d.icon}</div>
          <div>
            <div class="dict-title">${esc(d.name)}</div>
            <div class="dict-meta">${esc(d.level)} · ${esc(d.topic)} · ${d.pairs.length} words</div>
          </div>
        </div>
        <div class="dict-preview">${preview}</div>
        <div class="game-tags">${d.tags.slice(0,3).map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</div>
        <div class="dict-foot"><span>${esc(d.topic)}</span><span class="dict-hot">${d.pairs.length} cards</span></div>
        <div class="dict-actions">
          <button class="btn sm lime" onclick="useDictionary('${esc(d.id)}','pairs',false)">Cards</button>
          <button class="btn sm ghost" onclick="useDictionary('${esc(d.id)}','words',false)">Words</button>
          <button class="btn sm ghost" onclick="buildDictionaryCategoryGame('${esc(d.id)}')">Sort</button>
          <button class="btn sm blue" onclick="buildDictionaryQuiz('${esc(d.id)}')">Quiz</button>
          <button class="btn sm ghost" onclick="copyDictionaryWords('${esc(d.id)}')">Copy</button>
          <button class="btn sm blue" onclick="useDictionary('${esc(d.id)}','append',true)">Append</button>
        </div>
      </div>`;
  }).join('');
}

function renderDictionaryStats(rows) {
  const el = document.getElementById('dict-mini-stats');
  if (!el) return;
  const words = rows.reduce((sum, d) => sum + d.pairs.length, 0);
  const topics = new Set(rows.map(d => d.topic)).size;
  el.innerHTML = [
    `<span class="dict-mini">${rows.length} dictionaries shown</span>`,
    `<span class="dict-mini">${words} ready cards</span>`,
    `<span class="dict-mini">${topics} topic groups</span>`,
  ].join('');
}

function dictionaryById(id) {
  return THEME_DICTIONARIES.find(d => d.id === id);
}

function dictionaryPairs(dict) {
  return dict.pairs.map(pair => ({ a: pair[0], b: pair[1] }));
}

function dictionaryWords(dict) {
  return dict.pairs.map(pair => pair[0]);
}

function dictionaryDefinitions(dict) {
  return dict.pairs.map(pair => pair[1]);
}

async function copyDictionaryWords(id) {
  const dict = dictionaryById(id);
  if (!dict) return;
  const text = dict.pairs.map(pair => pair.join('\t')).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    toast(dict.name + ' copied as spreadsheet pairs');
  } catch {
    toast('Copy failed. Open dictionary and select words manually.');
  }
}

function ensureBuilderForFields(fields, fallbackTypeId) {
  if (!selectedType || selectedType.fields !== fields) {
    selectedType = GAME_TYPES.find(t => t.id === fallbackTypeId) || GAME_TYPES.find(t => t.fields === fields);
    editingId = null;
    renderTypeGrid();
    openBuilder();
  }
}

function useDictionary(id, mode, append) {
  const dict = dictionaryById(id);
  if (!dict) return;
  if (mode === 'pairs') {
    ensureBuilderForFields('pairs', 'flashcards');
    applyDictionaryToBuilder(dict, 'pairs', append);
  } else if (mode === 'words') {
    ensureBuilderForFields('words', 'word-scramble');
    applyDictionaryToBuilder(dict, 'words', append);
  } else {
    const targetFields = selectedType?.fields || 'pairs';
    if (!selectedType) ensureBuilderForFields('pairs', 'flashcards');
    applyDictionaryToBuilder(dict, targetFields, true);
  }
  document.getElementById('game-level').value = dict.level;
  document.getElementById('game-tags').value = ['vocabulary', dict.topic.toLowerCase(), ...dict.tags].join(', ');
  if (!append || !document.getElementById('game-title').value) {
    document.getElementById('game-title').value = `${dict.level} ${dict.name} ${selectedType.name}`;
  }
  updateItemCounter();
  document.getElementById('builder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast(`${dict.name} loaded into builder`);
}

function buildDictionaryCategoryGame(id) {
  const dict = dictionaryById(id);
  if (!dict) return;
  selectedType = GAME_TYPES.find(t => t.id === 'word-categories');
  editingId = null;
  renderTypeGrid();
  openBuilder();
  document.getElementById('game-title').value = dict.level + ' ' + dict.name + ' Category Sort';
  document.getElementById('game-level').value = dict.level;
  document.getElementById('game-tags').value = ['vocabulary', dict.topic.toLowerCase(), ...dict.tags, 'sorting'].join(', ');
  const half = Math.ceil(dict.pairs.length / 2);
  populateContent({ content: { categories: [
    { name: dict.name + ' 1', words: dictionaryWords(dict).slice(0, half) },
    { name: dict.name + ' 2', words: dictionaryWords(dict).slice(half) },
  ] } });
  updateItemCounter();
  document.getElementById('builder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast('Category game created from ' + dict.name);
}

function buildDictionaryQuiz(id) {
  const dict = dictionaryById(id);
  if (!dict) return;
  selectedType = GAME_TYPES.find(t => t.id === 'speed-quiz');
  editingId = null;
  renderTypeGrid();
  openBuilder();
  document.getElementById('game-title').value = dict.level + ' ' + dict.name + ' Definition Quiz';
  document.getElementById('game-level').value = dict.level;
  document.getElementById('game-tags').value = ['vocabulary', dict.topic.toLowerCase(), ...dict.tags, 'definition quiz'].join(', ');
  const defs = dictionaryDefinitions(dict);
  const questions = dict.pairs.slice(0, 10).map(pair => {
    const distractors = defs.filter(def => def !== pair[1]).sort(() => Math.random() - .5).slice(0, 3);
    const opts = [pair[1], ...distractors].sort(() => Math.random() - .5);
    return { q: 'What does "' + pair[0] + '" mean?', opts, correct: opts.indexOf(pair[1]) };
  });
  populateContent({ content: { questions } });
  updateItemCounter();
  document.getElementById('builder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast('Quiz created from ' + dict.name);
}

function applyDictionaryToBuilder(dict, fields, append) {
  const current = append ? (collectContent(true) || {}) : {};
  if (fields === 'pairs') {
    renderContentFields();
    populateContent({ content: { pairs: [...(current.pairs || []), ...dictionaryPairs(dict)] } });
    return;
  }
  if (fields === 'words') {
    renderContentFields();
    populateContent({ content: { words: [...(current.words || []), ...dictionaryWords(dict)] } });
    return;
  }
  if (fields === 'categories') {
    renderContentFields();
    populateContent({ content: {
      categories: [...(current.categories || []), { name: `${dict.level} ${dict.name}`, words: dictionaryWords(dict) }],
    } });
    return;
  }
  ensureBuilderForFields('pairs', 'flashcards');
  renderContentFields();
  populateContent({ content: { pairs: dictionaryPairs(dict) } });
}

/* ---- TYPE GRID ---- */
function renderTypeGrid() {
  const grid = document.getElementById('type-grid');
  grid.innerHTML = GAME_TYPES.map(t => `
    <div class="type-card${selectedType && selectedType.id === t.id ? ' selected' : ''}" onclick="selectType('${t.id}')">
      <div class="type-icon">${t.icon}</div>
      <div class="type-name">${esc(t.name)}</div>
      <div class="type-desc">${esc(t.desc)}</div>
      <div class="tag lime">${esc(t.tag)}</div>
    </div>
  `).join('');
}

function selectType(id) {
  selectedType = GAME_TYPES.find(t => t.id === id);
  editingId = null;
  renderTypeGrid();
  openBuilder();
}

/* ---- BUILDER ---- */
function scrollToBuilder() {
  document.getElementById('builder-anchor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openBuilder() {
  if (!selectedType) return;
  const b = document.getElementById('builder');
  b.classList.add('show');
  document.getElementById('builder-title').textContent = selectedType.icon + ' ' + selectedType.name;
  document.getElementById('builder-sub').textContent = selectedType.desc;
  document.getElementById('game-title').value = '';
  document.getElementById('game-level').value = 'B1';
  document.getElementById('game-tags').value = selectedType.tag;
  document.getElementById('save-btn').textContent = 'Save Game to Library';
  bulkMode = false;
  renderTopicBar();
  renderPresetBar();
  renderContentFields();
  updateItemCounter();
  b.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeBuilder() {
  document.getElementById('builder').classList.remove('show');
  selectedType = null;
  editingId = null;
  bulkMode = false;
  renderTypeGrid();
}

/* ---- PRESET BAR ---- */
function renderPresetBar() {
  const bar = document.getElementById('preset-bar');
  const chips = document.getElementById('preset-chips');
  if (!selectedType) { bar.style.display = 'none'; return; }
  const fieldType = selectedType.fields;
  const presetList = PRESETS[fieldType];
  if (!presetList || !presetList.length) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  chips.innerHTML = presetList.map((p, i) =>
    `<div class="preset-chip" onclick="applyPreset(${i})">${esc(p.name)} <span style="opacity:.5;font-size:10px">${esc(p.level)}</span></div>`
  ).join('');
}

function applyPreset(idx) {
  if (!selectedType) return;
  const fieldType = selectedType.fields;
  const presetList = PRESETS[fieldType];
  if (!presetList || !presetList[idx]) return;
  const preset = presetList[idx];
  const chips = document.querySelectorAll('#preset-chips .preset-chip');
  chips.forEach((c, i) => c.classList.toggle('active', i === idx));
  document.getElementById('game-level').value = preset.level || 'B1';
  document.getElementById('game-tags').value = preset.tags ? preset.tags.join(', ') : '';
  if (!document.getElementById('game-title').value) {
    document.getElementById('game-title').value = preset.name + ' ' + selectedType.name;
  }
  let content;
  switch (fieldType) {
    case 'pairs': content = { pairs: preset.data.map(d => ({a:d.a,b:d.b})) }; break;
    case 'words': content = { words: [...preset.data] }; break;
    case 'sentences': content = { sentences: [...preset.data] }; break;
    case 'statements': content = { statements: preset.data.map(d => ({text:d.text,answer:d.answer})) }; break;
    case 'mcq': content = { questions: preset.data.map(d => ({q:d.q,opts:[...d.opts],correct:d.correct})) }; break;
    case 'categories': content = { categories: preset.data.map(d => ({name:d.name,words:[...d.words]})) }; break;
  }
  if (content) {
    renderContentFields();
    populateContent({ content });
    updateItemCounter();
  }
  toast('Preset "' + preset.name + '" applied!');
}

/* ---- TOPIC LIBRARY ---- */
const TOPIC_SUPPORTED = ['pairs','words','sentences','mcq'];

function renderTopicBar() {
  const bar = document.getElementById('topic-bar');
  if (!selectedType || !TOPIC_SUPPORTED.includes(selectedType.fields)) {
    bar.style.display = 'none';
    return;
  }
  // Vocabulary dictionaries load on demand — fetch then re-render once ready
  if (!window.TEACHEDOS_VOCAB) {
    bar.style.display = 'none';
    ensureVocab().then(renderTopicBar).catch(() => { bar.style.display = 'none'; });
    return;
  }
  bar.style.display = 'flex';
  const pick = document.getElementById('topic-pick');
  const topics = window.TEACHEDOS_VOCAB.listTopics();
  pick.innerHTML = topics.map(t =>
    `<option value="${t.id}">${t.icon} ${t.name}</option>`
  ).join('');
  const totalWords = topics.reduce((s, t) => s + Object.values(t.counts).reduce((a, b) => a + b, 0), 0);
  document.getElementById('topic-bar-meta').textContent = topics.length + ' topics · ' + totalWords + ' words';
  // Default level to current game-level if it matches
  const gameLevel = document.getElementById('game-level')?.value;
  if (['A1','A2','B1','B2','C1'].includes(gameLevel)) {
    document.getElementById('topic-level').value = gameLevel;
  }
}

function applyTopic() {
  if (!selectedType || !window.TEACHEDOS_VOCAB) return;
  const topicId = document.getElementById('topic-pick').value;
  const level   = document.getElementById('topic-level').value;
  const countV  = parseInt(document.getElementById('topic-count').value, 10);
  const count   = countV > 0 ? countV : 0;
  const topic   = window.TEACHEDOS_VOCAB.getTopic(topicId);
  if (!topic) { toast('Topic not found'); return; }
  const words = window.TEACHEDOS_VOCAB.pick(topicId, level, count || undefined);
  if (!words.length) { toast('No words for this level'); return; }

  // Auto-fill metadata
  if (!document.getElementById('game-title').value) {
    document.getElementById('game-title').value = topic.icon + ' ' + topic.name +
      (level === 'mix' ? '' : ' · ' + level);
  }
  if (level !== 'mix') document.getElementById('game-level').value = level;
  if (!document.getElementById('game-tags').value || /^[a-z\s,]+$/i.test(document.getElementById('game-tags').value)) {
    document.getElementById('game-tags').value = [topicId, level === 'mix' ? '' : level, 'vocabulary']
      .filter(Boolean).join(', ');
  }

  // Map vocabulary entries into game-type-specific content shapes
  let content;
  switch (selectedType.fields) {
    case 'pairs':
      content = { pairs: words.map(w => ({ a: w.en, b: w.uk })) };
      break;
    case 'words':
      content = { words: words.map(w => w.en) };
      break;
    case 'sentences':
      content = { sentences: words.map(w => w.ex) };
      break;
    case 'mcq':
      // Build MCQ: "What is the translation of <en>?" with 4 options
      content = { questions: words.map((w, i) => {
        const distractors = words.filter((_, j) => j !== i)
          .sort(() => Math.random() - 0.5).slice(0, 3).map(d => d.uk);
        const opts = [w.uk, ...distractors].sort(() => Math.random() - 0.5);
        return { q: 'What does "' + w.en + '" mean?', opts, correct: opts.indexOf(w.uk) };
      }) };
      break;
  }
  if (!content) return;

  renderContentFields();
  populateContent({ content });
  updateItemCounter();
  toast('Loaded ' + words.length + ' words from "' + topic.name + '"');
}

/* ---- ITEM COUNTER ---- */
function updateItemCounter() {
  const el = document.getElementById('item-counter');
  if (!selectedType) { el.style.display = 'none'; return; }
  const content = collectContent(true);
  let count = 0, min = 2;
  if (!content) { count = 0; }
  else if (content.pairs) { count = content.pairs.length; min = 2; }
  else if (content.words) { count = content.words.length; min = 3; }
  else if (content.sentences) { count = content.sentences.length; min = 2; }
  else if (content.statements) { count = content.statements.length; min = 3; }
  else if (content.questions) { count = content.questions.length; min = 2; }
  else if (content.categories) { count = content.categories.length; min = 2; }
  el.style.display = 'inline-flex';
  if (count >= min) {
    el.className = 'item-counter ok';
    el.textContent = count + ' items (ready!)';
  } else if (count > 0) {
    el.className = 'item-counter warn';
    el.textContent = count + '/' + min + ' items (need at least ' + min + ')';
  } else {
    el.className = 'item-counter err';
    el.textContent = '0 items \u2014 add content below';
  }
  renderGameQuality();
}

function getContentStats(content) {
  const count = getPreviewItemCount(content || {});
  const text = JSON.stringify(content || {});
  const avgLen = count ? Math.round(text.length / count) : 0;
  const blanks = (text.match(/___/g) || []).length;
  return { count, avgLen, blanks };
}
function gameQuality(content = collectContent(true)) {
  if (!selectedType || !content) return null;
  const stats = getContentStats(content);
  const min = selectedType.fields === 'words' ? 6 : selectedType.fields === 'mcq' ? 4 : selectedType.fields === 'categories' ? 3 : 5;
  const volume = Math.min(100, Math.round(stats.count / min * 100));
  const variety = Math.min(100, Math.max(20, 100 - Math.max(0, stats.avgLen - 140)));
  const playable = collectContent(false) ? 100 : Math.min(70, volume);
  const clarity = stats.avgLen > 180 ? 62 : stats.avgLen < 8 && stats.count ? 70 : 92;
  const warnings = [];
  if (volume < 100) warnings.push('Add more items for a smoother game round.');
  if (stats.avgLen > 180) warnings.push('Some items are long. Shorten wording for mobile and live board play.');
  if (selectedType.fields === 'mcq' && content.questions?.some(q => (q.opts || []).filter(Boolean).length < 4)) warnings.push('Some MCQ questions need four options.');
  if (selectedType.fields === 'sentences' && content.sentences?.some(x => !x.includes('___'))) warnings.push('Fill-in-the-blank works best when each sentence includes ___.');
  if (selectedType.fields === 'categories' && content.categories?.some(c => (c.words || []).length < 3)) warnings.push('Categories should have at least three words each.');
  return { volume, variety, playable, clarity, warnings };
}
function renderGameQuality() {
  const panel = document.getElementById('game-quality-panel');
  if (!panel || !selectedType) return;
  const q = gameQuality();
  if (!q) { panel.style.display = 'none'; return; }
  panel.style.display = 'grid';
  const metric = (name, value) => `<div class="quality-metric ${value>84?'good':value>64?'warn':'bad'}"><b>${value}%</b><span>${name}</span></div>`;
  panel.innerHTML = metric('volume', q.volume) + metric('clarity', q.clarity) + metric('variety', q.variety) + metric('playable', q.playable) + (q.warnings.length ? `<div class="quality-warnings">${q.warnings.map(w => `<div class="quality-warning">${esc(w)}</div>`).join('')}</div>` : '');
}

/* ---- CONTENT FIELDS ---- */
function renderContentFields() {
  const area = document.getElementById('content-area');
  if (!selectedType) { area.innerHTML = ''; return; }
  switch (selectedType.fields) {
    case 'pairs':
      area.innerHTML = `
        <div class="label" style="margin-bottom:8px;">${esc(selectedType.pairLabels[0])} \u2014 ${esc(selectedType.pairLabels[1])} pairs</div>
        <div class="bulk-toggle" onclick="toggleBulk()"><span id="bulk-icon">\u2b07</span> <span id="bulk-label">Paste from spreadsheet</span></div>
        <div class="bulk-area" id="bulk-area">
          <textarea id="bulk-input" rows="6" placeholder="word1&#9;translation1&#10;word2&#9;translation2&#10;word3&#9;translation3" oninput="updateItemCounter()"></textarea>
          <div class="bulk-help">Paste tab-separated data from Excel/Google Sheets. One pair per line: word[TAB]translation</div>
          <button class="btn sm lime" onclick="parseBulk()" style="margin-top:8px;">Apply Bulk Data</button>
        </div>
        <div class="pair-list" id="pair-list"></div>
        <button class="btn sm ghost" onclick="addPair();updateItemCounter()">+ Add pair</button>`;
      for (let i = 0; i < 5; i++) addPair();
      break;
    case 'words':
      area.innerHTML = `
        <div class="field">
          <div class="label">Words (one per line)</div>
          <textarea id="words-input" rows="8" placeholder="comfortable\nsustainable\nnegotiate\nperspective\ncoincidence" oninput="updateItemCounter()"></textarea>
        </div>`;
      break;
    case 'sentences':
      area.innerHTML = `
        <div class="field">
          <div class="label">Sentences (use ___ for the blank, one per line)</div>
          <textarea id="sentences-input" rows="8" placeholder="She ___ (go) to school every day.\nThey have ___ (live) here since 2010.\nHe ___ (not/like) spicy food." oninput="updateItemCounter()"></textarea>
        </div>`;
      break;
    case 'statements':
      area.innerHTML = `
        <div class="label" style="margin-bottom:8px;">Statements \u2014 mark each as True or False</div>
        <div class="pair-list" id="pair-list"></div>
        <button class="btn sm ghost" onclick="addStatement();updateItemCounter()">+ Add statement</button>`;
      for (let i = 0; i < 5; i++) addStatement();
      break;
    case 'mcq':
      area.innerHTML = `
        <div class="label" style="margin-bottom:8px;">Questions \u2014 4 options each, mark the correct one</div>
        <div id="mcq-list"></div>
        <button class="btn sm ghost" onclick="addMCQ();updateItemCounter()">+ Add question</button>`;
      for (let i = 0; i < 3; i++) addMCQ();
      break;
    case 'categories':
      area.innerHTML = `
        <div class="label" style="margin-bottom:8px;">Categories \u2014 name each group and list its words</div>
        <div id="cat-list"></div>
        <button class="btn sm ghost" onclick="addCategory();updateItemCounter()">+ Add category</button>`;
      for (let i = 0; i < 3; i++) addCategory();
      break;
  }
}

/* ---- BULK PASTE ---- */
function toggleBulk() {
  bulkMode = !bulkMode;
  const area = document.getElementById('bulk-area');
  area.classList.toggle('show', bulkMode);
  document.getElementById('bulk-label').textContent = bulkMode ? 'Hide bulk paste' : 'Paste from spreadsheet';
  document.getElementById('bulk-icon').textContent = bulkMode ? '\u2b06' : '\u2b07';
}

function parseBulk() {
  const text = document.getElementById('bulk-input').value.trim();
  if (!text) { toast('Paste some data first'); return; }
  const lines = text.split('\n').filter(l => l.trim());
  const list = document.getElementById('pair-list');
  list.innerHTML = '';
  let count = 0;
  lines.forEach(line => {
    const parts = line.split('\t');
    if (parts.length >= 2) {
      addPair();
      const rows = list.querySelectorAll('.pair-row');
      const last = rows[rows.length - 1];
      last.querySelector('.pair-a').value = parts[0].trim();
      last.querySelector('.pair-b').value = parts[1].trim();
      count++;
    }
  });
  updateItemCounter();
  toast(count + ' pairs imported from clipboard!');
  bulkMode = false;
  document.getElementById('bulk-area').classList.remove('show');
  document.getElementById('bulk-label').textContent = 'Paste from spreadsheet';
  document.getElementById('bulk-icon').textContent = '\u2b07';
}

/* ---- DYNAMIC CONTENT HELPERS ---- */
function addPair() {
  const list = document.getElementById('pair-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'pair-row';
  const num = list.querySelectorAll('.pair-row').length + 1;
  row.innerHTML = `
    <div class="pair-row-num">${num}</div>
    <input class="pair-a" placeholder="${esc(selectedType.pairLabels[0])}" oninput="updateItemCounter()">
    <input class="pair-b" placeholder="${esc(selectedType.pairLabels[1])}" oninput="updateItemCounter()">
    <button class="pair-remove" onclick="this.parentElement.remove();renumberRows();updateItemCounter()">x</button>`;
  list.appendChild(row);
}

function renumberRows() {
  const rows = document.querySelectorAll('#pair-list .pair-row');
  rows.forEach((r, i) => {
    const num = r.querySelector('.pair-row-num');
    if (num) num.textContent = i + 1;
  });
}

function addStatement() {
  const list = document.getElementById('pair-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'pair-row';
  const num = list.querySelectorAll('.pair-row').length + 1;
  row.innerHTML = `
    <div class="pair-row-num">${num}</div>
    <input class="pair-a" placeholder="Statement text" oninput="updateItemCounter()">
    <select class="pair-b" style="width:80px"><option value="true">True</option><option value="false">False</option></select>
    <button class="pair-remove" onclick="this.parentElement.remove();renumberRows();updateItemCounter()">x</button>`;
  list.appendChild(row);
}

function addMCQ() {
  const list = document.getElementById('mcq-list');
  if (!list) return;
  const idx = list.children.length + 1;
  const block = document.createElement('div');
  block.style.cssText = 'background:var(--bg);border-radius:14px;padding:14px;margin-bottom:10px;';
  block.innerHTML = `
    <div style="font-size:12px;font-weight:800;color:var(--text3);margin-bottom:8px;">Question ${idx}</div>
    <input class="mcq-question" placeholder="Question text" style="margin-bottom:8px;" oninput="updateItemCounter()">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <input class="mcq-opt" placeholder="Option A">
      <input class="mcq-opt" placeholder="Option B">
      <input class="mcq-opt" placeholder="Option C">
      <input class="mcq-opt" placeholder="Option D">
    </div>
    <div style="margin-top:6px;display:flex;align-items:center;gap:8px;">
      <span style="font-size:11px;color:var(--text3);">Correct:</span>
      <select class="mcq-correct"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select>
      <button class="pair-remove" onclick="this.closest('[style]').remove();updateItemCounter()" style="margin-left:auto;">x</button>
    </div>`;
  list.appendChild(block);
}

function addCategory() {
  const list = document.getElementById('cat-list');
  if (!list) return;
  const idx = list.children.length + 1;
  const block = document.createElement('div');
  block.style.cssText = 'background:var(--bg);border-radius:14px;padding:14px;margin-bottom:10px;';
  block.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
      <input class="cat-name" placeholder="Category name (e.g. Animals)" style="flex:1;" oninput="updateItemCounter()">
      <button class="pair-remove" onclick="this.closest('[style]').remove();updateItemCounter()">x</button>
    </div>
    <textarea class="cat-words" rows="3" placeholder="word1, word2, word3, ..." oninput="updateItemCounter()"></textarea>`;
  list.appendChild(block);
}

/* ---- COLLECT CONTENT ---- */
function collectContent(lenient) {
  if (!selectedType) return null;
  switch (selectedType.fields) {
    case 'pairs': {
      const rows = document.querySelectorAll('#pair-list .pair-row');
      const pairs = [];
      rows.forEach(r => {
        const a = r.querySelector('.pair-a').value.trim();
        const b = r.querySelector('.pair-b').value.trim();
        if (a && b) pairs.push({ a, b });
        else if (lenient && (a || b)) pairs.push({ a: a||'', b: b||'' });
      });
      return (lenient || pairs.length >= 2) ? { pairs } : null;
    }
    case 'words': {
      const words = document.getElementById('words-input').value.split('\n').map(w => w.trim()).filter(Boolean);
      return (lenient || words.length >= 3) ? { words } : null;
    }
    case 'sentences': {
      const sentences = document.getElementById('sentences-input').value.split('\n').map(s => s.trim()).filter(Boolean);
      return (lenient || sentences.length >= 2) ? { sentences } : null;
    }
    case 'statements': {
      const rows = document.querySelectorAll('#pair-list .pair-row');
      const statements = [];
      rows.forEach(r => {
        const text = r.querySelector('.pair-a').value.trim();
        const val = r.querySelector('.pair-b').value;
        if (text) statements.push({ text, answer: val === 'true' });
      });
      return (lenient || statements.length >= 3) ? { statements } : null;
    }
    case 'mcq': {
      const blocks = document.querySelectorAll('#mcq-list > div');
      const questions = [];
      blocks.forEach(b => {
        const q = b.querySelector('.mcq-question').value.trim();
        const opts = Array.from(b.querySelectorAll('.mcq-opt')).map(o => o.value.trim());
        const correct = parseInt(b.querySelector('.mcq-correct').value, 10);
        if (q && opts.filter(Boolean).length === 4) questions.push({ q, opts, correct });
        else if (lenient && q) questions.push({ q, opts, correct });
      });
      return (lenient || questions.length >= 2) ? { questions } : null;
    }
    case 'categories': {
      const blocks = document.querySelectorAll('#cat-list > div');
      const categories = [];
      blocks.forEach(b => {
        const name = b.querySelector('.cat-name').value.trim();
        const words = b.querySelector('.cat-words').value.split(',').map(w => w.trim()).filter(Boolean);
        if (name && words.length >= 2) categories.push({ name, words });
        else if (lenient && name) categories.push({ name, words });
      });
      return (lenient || categories.length >= 2) ? { categories } : null;
    }
  }
  return null;
}


function smartCleanContent() {
  if (!selectedType) { toast('Open a game first'); return; }
  const content = collectContent(true);
  if (!content) return;
  if (content.pairs) content.pairs = uniqueBy(content.pairs.filter(p => p.a && p.b), p => p.a.toLowerCase() + '|' + p.b.toLowerCase());
  if (content.words) content.words = uniqueBy(content.words.filter(Boolean), w => w.toLowerCase());
  if (content.sentences) content.sentences = uniqueBy(content.sentences.filter(Boolean), sentence => sentence.toLowerCase());
  if (content.statements) content.statements = uniqueBy(content.statements.filter(st => st.text), st => st.text.toLowerCase());
  if (content.questions) content.questions = uniqueBy(content.questions.filter(q => q.q), q => q.q.toLowerCase());
  if (content.categories) content.categories = content.categories.map(cat => ({ ...cat, words: uniqueBy(cat.words || [], w => w.toLowerCase()) })).filter(cat => cat.name && cat.words.length);
  renderContentFields();
  populateContent({ content });
  updateItemCounter();
  toast('Cleaned duplicates and empty rows');
}

function sortContent() {
  transformCurrentContent(content => {
    if (content.pairs) content.pairs.sort((a,b) => a.a.localeCompare(b.a));
    if (content.words) content.words.sort((a,b) => a.localeCompare(b));
    if (content.sentences) content.sentences.sort((a,b) => a.localeCompare(b));
    if (content.statements) content.statements.sort((a,b) => a.text.localeCompare(b.text));
    if (content.questions) content.questions.sort((a,b) => a.q.localeCompare(b.q));
    if (content.categories) content.categories.forEach(cat => cat.words.sort((a,b) => a.localeCompare(b)));
    return content;
  }, 'Sorted A-Z');
}

function shuffleContent() {
  transformCurrentContent(content => {
    if (content.pairs) content.pairs = shuffleArray(content.pairs);
    if (content.words) content.words = shuffleArray(content.words);
    if (content.sentences) content.sentences = shuffleArray(content.sentences);
    if (content.statements) content.statements = shuffleArray(content.statements);
    if (content.questions) content.questions = shuffleArray(content.questions);
    if (content.categories) content.categories.forEach(cat => cat.words = shuffleArray(cat.words));
    return content;
  }, 'Content shuffled');
}

function clearContent() {
  if (!selectedType) return;
  if (!confirm('Clear current builder content?')) return;
  renderContentFields();
  updateItemCounter();
  toast('Builder cleared');
}

async function copyCurrentContent() {
  const content = collectContent(true);
  if (!content) { toast('Nothing to copy'); return; }
  let text = '';
  if (content.pairs) text = content.pairs.map(p => p.a + '\t' + p.b).join('\n');
  else if (content.words) text = content.words.join('\n');
  else if (content.sentences) text = content.sentences.join('\n');
  else text = JSON.stringify(content, null, 2);
  try { await navigator.clipboard.writeText(text); toast('Current content copied'); }
  catch { toast('Copy failed'); }
}

function transformCurrentContent(mutator, message) {
  if (!selectedType) { toast('Open a game first'); return; }
  const content = collectContent(true);
  if (!content) return;
  const next = mutator(content);
  renderContentFields();
  populateContent({ content: next });
  updateItemCounter();
  toast(message);
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shuffleArray(items) {
  return [...items].sort(() => Math.random() - .5);
}

function autoFillGame() {
  if (!selectedType) { toast('Choose a game type first'); return; }
  const title = document.getElementById('game-title').value.trim() || selectedType.name;
  const topic = (document.getElementById('game-tags').value || title).split(',')[0].trim() || 'English practice';
  const words = ['challenge','solution','feedback','practice','confidence','routine','progress','mistake','example','conversation'];
  let content = null;
  if (selectedType.fields === 'pairs') content = { pairs: words.slice(0,8).map(w => ({ a:w, b:`${topic}: useful classroom meaning for ${w}` })) };
  else if (selectedType.fields === 'words') content = { words: words.slice(0,10) };
  else if (selectedType.fields === 'sentences') content = { sentences: words.slice(0,6).map(w => `Students need regular ___ to improve their ${topic.toLowerCase()}.|${w}`) };
  else if (selectedType.fields === 'statements') content = { statements: words.slice(0,6).map((w,i) => ({ text:`${w} is useful when learning ${topic.toLowerCase()}.`, answer:i % 2 === 0 })) };
  else if (selectedType.fields === 'mcq') content = { questions: words.slice(0,5).map((w,i) => ({ q:`Which word best completes the idea about ${topic.toLowerCase()}?`, opts:[w, words[(i+1)%words.length], words[(i+2)%words.length], words[(i+3)%words.length]], correct:0 })) };
  else if (selectedType.fields === 'categories') content = { categories:[{name:'Learning',words:['practice','feedback','progress','mistake']},{name:'Communication',words:['conversation','example','confidence','solution']},{name:'Mindset',words:['challenge','routine','focus','goal']}] };
  if (!content) return;
  renderContentFields(); populateContent({ content }); updateItemCounter(); toast('Smart content generated');
}
function upgradeDifficulty() {
  transformCurrentContent(content => {
    if (content.pairs) content.pairs = content.pairs.map(p => ({ a:p.a, b:p.b + ' / Use it in a precise example.' }));
    if (content.words) content.words = content.words.map(w => w + ' collocation');
    if (content.sentences) content.sentences = content.sentences.map(s => s + ' Explain your choice.');
    if (content.statements) content.statements = content.statements.map(s => ({ ...s, text:s.text + ' Give evidence.' }));
    if (content.questions) content.questions = content.questions.map(q => ({ ...q, q:q.q + ' Choose the most accurate answer.' }));
    return content;
  }, 'Difficulty upgraded');
}
function makeStudentFriendly() {
  transformCurrentContent(content => {
    const clean = s => String(s||'').replace(/utilize/gi,'use').replace(/approximately/gi,'about').replace(/demonstrate/gi,'show').replace(/s+/g,' ').trim();
    if (content.pairs) content.pairs = content.pairs.map(p => ({ a:clean(p.a), b:clean(p.b) }));
    if (content.words) content.words = content.words.map(clean);
    if (content.sentences) content.sentences = content.sentences.map(clean);
    if (content.statements) content.statements = content.statements.map(s => ({ ...s, text:clean(s.text) }));
    if (content.questions) content.questions = content.questions.map(q => ({ ...q, q:clean(q.q), opts:q.opts.map(clean) }));
    return content;
  }, 'Wording simplified');
}
function generateDistractors() {
  if (!selectedType || selectedType.fields !== 'mcq') { toast('Distractors are for MCQ games'); return; }
  transformCurrentContent(content => {
    if (!content.questions) return content;
    content.questions = content.questions.map(q => {
      const correct = q.opts[q.correct] || q.opts[0] || 'Correct answer';
      const base = String(correct).split(/\s+/)[0] || 'answer';
      return { ...q, opts:[correct, base + ' mistake', 'close but wrong', 'not mentioned'], correct:0 };
    });
    return content;
  }, 'Distractors generated');
}
function exportCurrentGameDraft() {
  if (!selectedType) return;
  const title = document.getElementById('game-title').value.trim() || selectedType.name;
  const draft = { title, typeId:selectedType.id, level:document.getElementById('game-level').value, tags:document.getElementById('game-tags').value, content:collectContent(true), exportedAt:new Date().toISOString() };
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'teachedos-game-draft-' + Date.now() + '.json'; a.click(); URL.revokeObjectURL(a.href);
}

/* ---- SAVE / LOAD ---- */
function readGames() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function writeGames(games) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  document.getElementById('my-count').textContent = games.length;
}
function makeGameObject() {
  if (!selectedType) return null;
  const title = document.getElementById('game-title').value.trim();
  if (!title) { toast('Please enter a game title'); return null; }
  const content = collectContent();
  if (!content) { toast('Not enough content. Add more items.'); return null; }
  const level = document.getElementById('game-level').value;
  const tags = document.getElementById('game-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  return {
    id: editingId || 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
    typeId: selectedType.id, icon: selectedType.icon, typeName: selectedType.name,
    gameSrc: selectedType.gameSrc, w: selectedType.w, h: selectedType.h,
    title, level, tags, content, quality: gameQuality(content), createdAt: new Date().toISOString(),
  };
}

function saveGame() {
  if (!selectedType) return;
  const game = makeGameObject();
  if (!game) return;
  const games = readGames();
  if (editingId) {
    const idx = games.findIndex(g => g.id === editingId);
    if (idx >= 0) { game.cloudId = games[idx].cloudId; games[idx] = game; } else games.unshift(game);
  } else { games.unshift(game); }
  writeGames(games);
  closeBuilder();
  renderMyGames();
  toast(editingId ? 'Game updated!' : 'Game saved to your library!');
  cloudSyncGame(game).then(a => { if (a && a.id) attachCloudId(game.id, a.id); });
}

function saveAndAddToBoard() {
  if (!selectedType) return;
  const game = makeGameObject();
  if (!game) return;
  const games = readGames();
  if (editingId) {
    const idx = games.findIndex(g => g.id === editingId);
    if (idx >= 0) games[idx] = game; else games.unshift(game);
  } else { games.unshift(game); }
  writeGames(games);
  addToBoard(game.id);
}

function deleteGame(id) {
  if (!confirm('Delete this game from your library?')) return;
  const games = readGames().filter(g => g.id !== id);
  writeGames(games);
  renderMyGames();
  toast('Game deleted');
}

function editGame(id) {
  const games = readGames();
  const game = games.find(g => g.id === id);
  if (!game) return;
  selectedType = GAME_TYPES.find(t => t.id === game.typeId);
  if (!selectedType) return;
  editingId = id;
  renderTypeGrid();
  const b = document.getElementById('builder');
  b.classList.add('show');
  document.getElementById('builder-title').textContent = selectedType.icon + ' Edit: ' + game.title;
  document.getElementById('builder-sub').textContent = selectedType.desc;
  document.getElementById('game-title').value = game.title;
  document.getElementById('game-level').value = game.level || 'B1';
  document.getElementById('game-tags').value = (game.tags || []).join(', ');
  document.getElementById('save-btn').textContent = 'Update Game';
  renderPresetBar();
  renderContentFields();
  populateContent(game);
  updateItemCounter();
  b.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function duplicateGame(id) {
  const games = readGames();
  const game = games.find(g => g.id === id);
  if (!game) return;
  const copy = JSON.parse(JSON.stringify(game));
  copy.id = 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
  copy.title = game.title + ' (copy)';
  copy.createdAt = new Date().toISOString();
  games.unshift(copy);
  writeGames(games);
  renderMyGames();
  toast('Game duplicated');
}

function populateContent(game) {
  const c = game.content;
  if (!c) return;
  switch (selectedType.fields) {
    case 'pairs': {
      const list = document.getElementById('pair-list');
      list.innerHTML = '';
      (c.pairs || []).forEach(p => {
        addPair();
        const rows = list.querySelectorAll('.pair-row');
        const last = rows[rows.length - 1];
        last.querySelector('.pair-a').value = p.a;
        last.querySelector('.pair-b').value = p.b;
      });
      break;
    }
    case 'words': document.getElementById('words-input').value = (c.words || []).join('\n'); break;
    case 'sentences': document.getElementById('sentences-input').value = (c.sentences || []).join('\n'); break;
    case 'statements': {
      const list = document.getElementById('pair-list');
      list.innerHTML = '';
      (c.statements || []).forEach(s => {
        addStatement();
        const rows = list.querySelectorAll('.pair-row');
        const last = rows[rows.length - 1];
        last.querySelector('.pair-a').value = s.text;
        last.querySelector('.pair-b').value = s.answer ? 'true' : 'false';
      });
      break;
    }
    case 'mcq': {
      const list = document.getElementById('mcq-list');
      list.innerHTML = '';
      (c.questions || []).forEach(q => {
        addMCQ();
        const blocks = list.querySelectorAll(':scope > div');
        const last = blocks[blocks.length - 1];
        last.querySelector('.mcq-question').value = q.q;
        const opts = last.querySelectorAll('.mcq-opt');
        q.opts.forEach((o, i) => { if (opts[i]) opts[i].value = o; });
        last.querySelector('.mcq-correct').value = q.correct;
      });
      break;
    }
    case 'categories': {
      const list = document.getElementById('cat-list');
      list.innerHTML = '';
      (c.categories || []).forEach(cat => {
        addCategory();
        const blocks = list.querySelectorAll(':scope > div');
        const last = blocks[blocks.length - 1];
        last.querySelector('.cat-name').value = cat.name;
        last.querySelector('.cat-words').value = cat.words.join(', ');
      });
      break;
    }
  }
}

/* ---- RENDER MY GAMES ---- */
function renderFilterTabs() {
  const allTags = ['All','Vocabulary','Grammar','Spelling','Speed','Speaking'];
  document.getElementById('filter-tabs').innerHTML = allTags.map(t =>
    `<div class="tab${t === activeFilter ? ' active' : ''}" onclick="filterGames('${t}')">${t}</div>`
  ).join('');
}

function filterGames(tag) {
  activeFilter = tag;
  renderFilterTabs();
  renderMyGames();
}

function renderMyGames() {
  const grid = document.getElementById('my-games');
  let games = readGames();
  const search = (document.getElementById('games-search').value || '').toLowerCase();
  if (activeFilter !== 'All') {
    games = games.filter(g => {
      const type = GAME_TYPES.find(t => t.id === g.typeId);
      return (type && type.tag === activeFilter) || (g.tags || []).some(t => t.toLowerCase() === activeFilter.toLowerCase());
    });
  }
  if (search) {
    games = games.filter(g => (g.title + ' ' + (g.tags||[]).join(' ') + ' ' + g.level).toLowerCase().includes(search));
  }
  if (!games.length) {
    grid.innerHTML = `<div class="empty">${activeFilter !== 'All' || search ? 'No games match.' : 'No custom games yet. Create your first one above!'}</div>`;
    return;
  }
  grid.innerHTML = games.map(g => {
    const type = GAME_TYPES.find(t => t.id === g.typeId);
    const itemCount = getItemCount(g);
    return `
    <div class="game-card">
      <div class="game-top">
        <div class="game-ic">${esc(g.icon || '\ud83c\udfae')}</div>
        <div>
          <div class="game-name">${esc(g.title)}</div>
          <div class="game-meta">${esc(type ? type.name : g.typeName)} \u00b7 ${esc(g.level || 'Mixed')} \u00b7 ${itemCount} items</div>
        </div>
      </div>
      <div class="game-tags">
        ${(g.tags || []).slice(0,4).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
      </div>
      <div class="game-actions">
        <button class="btn sm lime" onclick="addToBoard('${esc(g.id)}')">Add to Board</button>
        <button class="btn sm ghost" onclick="editGame('${esc(g.id)}')">Edit</button>
        <button class="btn sm ghost" onclick="duplicateGame('${esc(g.id)}')">Copy</button>
        <button class="btn sm ghost" onclick="exportOneGame('${esc(g.id)}')">JSON</button>
        <button class="btn sm danger" onclick="deleteGame('${esc(g.id)}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function exportOneGame(id) {
  const game = readGames().find(g => g.id === id);
  if (!game) return;
  const blob = new Blob([JSON.stringify(game, null, 2)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (game.title || 'game').toLowerCase().replace(/[^a-z0-9]+/g,'-') + '.json'; a.click(); URL.revokeObjectURL(a.href);
}

function getItemCount(game) {
  const c = game.content;
  if (!c) return 0;
  if (c.pairs) return c.pairs.length;
  if (c.words) return c.words.length;
  if (c.sentences) return c.sentences.length;
  if (c.statements) return c.statements.length;
  if (c.questions) return c.questions.length;
  if (c.categories) return c.categories.reduce((s, cat) => s + cat.words.length, 0);
  return 0;
}

/* ---- ADD TO BOARD ---- */
function addToBoard(id) {
  const games = readGames();
  const game = games.find(g => g.id === id);
  if (!game) { toast('Game not found'); return; }
  const type = GAME_TYPES.find(t => t.id === game.typeId);
  if (!type) { toast('Game type not found'); return; }
  const customData = {
    customGameId: game.id, title: game.title, src: type.gameSrc,
    customContent: game.content, level: game.level,
  };
  sessionStorage.setItem('teachedos_pending_custom_game', JSON.stringify(customData));
  window.location.href = 'board.html?addCustomGame=1';
}

/* ---- EXPORT / IMPORT ---- */
function exportAllGames() {
  const games = readGames();
  if (!games.length) { toast('No games to export'); return; }
  const blob = new Blob([JSON.stringify(games, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'teachedos-games-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast(games.length + ' games exported!');
}

function importGames(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) { toast('Invalid file format'); return; }
      const games = readGames();
      let added = 0;
      imported.forEach(g => {
        if (g.id && g.typeId && g.title && g.content) {
          g.id = 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
          games.unshift(g);
          added++;
        }
      });
      writeGames(games);
      renderMyGames();
      toast(added + ' games imported!');
    } catch { toast('Failed to parse file'); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

/* ---- PREVIEW ---- */
function previewGame() {
  const content = collectContent();
  if (!content) { toast('Not enough content to preview. Add more items.'); return; }
  const title = document.getElementById('game-title').value.trim() || 'Preview';
  const pv = document.getElementById('preview-content');
  let html = `<div style="font-size:18px;font-weight:900;margin-bottom:6px;">${selectedType.icon} ${esc(title)}</div>`;
  html += `<div style="font-size:12px;color:var(--text3);margin-bottom:16px;">${esc(selectedType.name)} \u00b7 ${getPreviewItemCount(content)} items</div>`;
  if (content.pairs) {
    html += `<table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="background:var(--bg);font-weight:800;"><td style="padding:8px 12px;border-radius:8px 0 0 0;">${esc(selectedType.pairLabels[0])}</td><td style="padding:8px 12px;border-radius:0 8px 0 0;">${esc(selectedType.pairLabels[1])}</td></tr>
      ${content.pairs.map(p => `<tr><td style="padding:6px 12px;border-bottom:1px solid var(--border);">${esc(p.a)}</td><td style="padding:6px 12px;border-bottom:1px solid var(--border);">${esc(p.b)}</td></tr>`).join('')}
    </table>`;
  } else if (content.words) {
    html += `<div style="display:flex;flex-wrap:wrap;gap:6px;">${content.words.map(w => `<span class="tag">${esc(w)}</span>`).join('')}</div>`;
  } else if (content.sentences) {
    html += content.sentences.map((s,i) => `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">${i+1}. ${esc(s)}</div>`).join('');
  } else if (content.statements) {
    html += content.statements.map(s => `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;"><span class="tag ${s.answer?'lime':''}">${s.answer?'TRUE':'FALSE'}</span><span>${esc(s.text)}</span></div>`).join('');
  } else if (content.questions) {
    html += content.questions.map((q,i) => `<div style="padding:8px 0;border-bottom:1px solid var(--border);"><div style="font-weight:800;font-size:13px;margin-bottom:4px;">${i+1}. ${esc(q.q)}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;">${q.opts.map((o,j) => `<div style="padding:4px 8px;border-radius:6px;background:${j===q.correct?'rgba(200,230,50,.2)':'var(--bg)'};${j===q.correct?'font-weight:700;':''}}">${'ABCD'[j]}. ${esc(o)}</div>`).join('')}</div></div>`).join('');
  } else if (content.categories) {
    html += content.categories.map(c => `<div style="margin-bottom:12px;"><div style="font-weight:800;font-size:13px;margin-bottom:6px;">${esc(c.name)}</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${c.words.map(w => `<span class="tag">${esc(w)}</span>`).join('')}</div></div>`).join('');
  }
  pv.innerHTML = html;
  document.getElementById('preview-overlay').classList.add('show');
}

function getPreviewItemCount(content) {
  if (content.pairs) return content.pairs.length;
  if (content.words) return content.words.length;
  if (content.sentences) return content.sentences.length;
  if (content.statements) return content.statements.length;
  if (content.questions) return content.questions.length;
  if (content.categories) return content.categories.reduce((s, c) => s + c.words.length, 0);
  return 0;
}

function closePreview() {
  document.getElementById('preview-overlay').classList.remove('show');
}

/* ---- TOAST ---- */
let toastT;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show';
  clearTimeout(toastT);
  toastT = setTimeout(() => t.className = '', 2800);
}

// ── Cloud library sync ──────────────────────────────────────────────────────
const LIB_API = (window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teachedos-api.onrender.com')));
function libToken() { return localStorage.getItem('teachedos_token') || ''; }
async function libFetch(path, opts = {}) {
  const tok = libToken();
  if (!tok) return null;
  const res = await fetch(LIB_API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok, ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
function gameToAssignment(game) {
  return {
    kind: 'game',
    title: game.title || 'Untitled game',
    description: game.typeName || '',
    level: game.level || '',
    skill: '',
    tags: game.tags || [],
    data: game,
  };
}
async function cloudSyncGame(game) {
  if (!libToken()) return null;
  try {
    const payload = gameToAssignment(game);
    let out;
    if (game.cloudId) {
      out = await libFetch('/api/library/' + game.cloudId, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      out = await libFetch('/api/library', { method: 'POST', body: JSON.stringify(payload) });
    }
    return out && out.assignment ? out.assignment : null;
  } catch (e) { console.warn('[game] cloud sync failed:', e.message); return null; }
}
// Persist the cloudId back onto the saved game in localStorage
function attachCloudId(localId, cloudId) {
  if (!cloudId) return;
  const games = readGames();
  const idx = games.findIndex(g => g.id === localId);
  if (idx >= 0) { games[idx].cloudId = cloudId; writeGames(games); }
}
async function publishGame() {
  if (!libToken()) { toast('Sign in to publish to the community'); return; }
  const game = makeGameObject();
  if (!game) return;
  // Make sure it's in the local library first
  const games = readGames();
  const idx = games.findIndex(g => g.id === game.id);
  if (idx >= 0) { game.cloudId = games[idx].cloudId; games[idx] = game; } else { games.unshift(game); }
  writeGames(games);
  const btn = document.getElementById('publish-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }
  try {
    const a = await cloudSyncGame(game);
    if (a && a.id) { game.cloudId = a.id; attachCloudId(game.id, a.id); await libFetch('/api/library/' + a.id + '/publish', { method: 'POST' }); }
    toast('🌍 Published to the community!');
  } catch (e) {
    toast('Could not publish: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🌍 Publish to Community'; }
  }
}

// One-time: push existing local games (saved before cloud sync existed) up to My Library
async function migrateLocalGames() {
  if (!libToken()) return;
  const FLAG = 'teachedos_libmig_game_v1';
  if (localStorage.getItem(FLAG)) return;
  const games = readGames();
  const pending = games.filter(g => !g.cloudId);
  if (!pending.length) { localStorage.setItem(FLAG, '1'); return; }
  let synced = 0;
  for (const g of pending) {
    const a = await cloudSyncGame(g);
    if (a && a.id) { attachCloudId(g.id, a.id); synced++; }
  }
  localStorage.setItem(FLAG, '1');
  if (synced) toast('☁️ ' + synced + ' game' + (synced > 1 ? 's' : '') + ' synced to My Library');
}

init();
setTimeout(() => migrateLocalGames().catch(() => {}), 1200);

