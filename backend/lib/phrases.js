// Phrase of the day, chosen for the student's level. One real phrase a day,
// rotating in the student's own time zone: plain-English meaning and an
// example. Level comes from the teacher's journal, then the student's own
// profile (routes/vault.js); C2 uses the C1 set, an unknown level B1.
//
// Kept on the server so "+ Add to my words" saves exactly the phrase the
// student saw, with source_type PHRASE_OF_THE_DAY.

const PHRASES = {
  A1: [
    ['nice to meet you', 'what you say when you meet someone for the first time', 'Hi, I am Anna. Nice to meet you.'],
    ['see you later', 'goodbye - I will see you again soon', 'I have to go now. See you later!'],
    ['excuse me', 'a polite way to get attention or to say sorry', 'Excuse me, where is the station?'],
    ['how much is it?', 'a question about the price', 'I like this bag. How much is it?'],
    ["I don't understand", 'I do not know what you mean', "Sorry, I don't understand. Can you say it again?"],
    ['can you help me?', 'a polite way to ask for help', 'Can you help me? I am lost.'],
    ['what time is it?', 'a question about the time now', 'What time is it? Is the shop still open?'],
    ['have a nice day', 'a friendly way to say goodbye', 'Thank you! Have a nice day.'],
    ['no problem', 'it is okay, it was not difficult', '"Thank you for your help." "No problem!"'],
    ["let's go", 'we can start or leave now', "The bus is here. Let's go!"],
    ['good luck', 'I hope things go well for you', 'You have an exam tomorrow? Good luck!'],
    ['me too', 'the same is true for me', '"I love pizza." "Me too!"'],
    ['not yet', 'it has not happened so far', '"Are you ready?" "Not yet. Two minutes!"'],
    ['I would like', 'a polite way to say "I want"', 'I would like a cup of tea, please.'],
    ['what about you?', 'a question back to the other person', 'I am a teacher. What about you?'],
  ],
  A2: [
    ['take a photo', 'use a camera or a phone to make a picture', 'Can you take a photo of us, please?'],
    ['make a mistake', 'do or say something wrong', "Don't worry if you make a mistake. That is how we learn."],
    ['have a good time', 'enjoy yourself', 'We had a good time at the beach.'],
    ['on time', 'not late, at the right time', 'The train left on time.'],
    ['by the way', 'used to add something new to the conversation', 'By the way, did you call Mum?'],
    ['in a hurry', 'needing to do something quickly', "Sorry, I can't talk now. I'm in a hurry."],
    ['get lost', 'not know where you are', 'We got lost in the old town.'],
    ['catch a cold', 'become ill with a cold', 'Wear a coat or you will catch a cold.'],
    ['look forward to', 'feel happy about something that will happen', "I'm looking forward to the holidays."],
    ['it depends', 'the answer changes with the situation', '"Do you walk to work?" "It depends on the weather."'],
    ['take your time', 'there is no need to hurry', 'Take your time. We are not late.'],
    ['run out of', 'have no more of something', 'We ran out of milk, so I had black coffee.'],
    ['give someone a hand', 'help someone', 'Can you give me a hand with these boxes?'],
    ['make plans', 'decide what you will do', 'Have you made any plans for the weekend?'],
    ["what's up?", 'an informal "how are you?" or "what is happening?"', "Hey, what's up? You look tired."],
  ],
  B1: [
    ['heads-up', 'a short warning in advance', 'Just a heads-up: the meeting moved to 3.'],
    ['go with the flow', 'to accept things as they happen', "I don't plan much. I just go with the flow."],
    ['running late', 'arriving after the planned time', "Sorry, I'm running late. Start without me."],
    ["I'm down", "I'm happy to join or agree", "Pizza tonight? I'm down."],
    ['hard pass', 'a firm no', 'A 6 a.m. meeting? Hard pass.'],
    ['red flag', 'a warning sign in a person or a situation', "He never replies to anyone. That's a red flag."],
    ['burnt out', 'completely exhausted from too much work or stress', "I'm burnt out. I need a real break."],
    ['under the weather', 'a little ill', "I'm feeling a bit under the weather today."],
    ['on the same page', 'agreeing and understanding each other', "Let's make sure we're on the same page."],
    ['cut me some slack', 'be less strict with me', "It's my first week. Cut me some slack."],
    ['a no-brainer', 'an easy decision', 'At that price, it was a no-brainer.'],
    ['get the hang of', 'learn how to do something', "Driving is hard at first, but you'll get the hang of it."],
    ['keep in touch', 'continue to talk or write to each other', "Let's keep in touch after the course."],
    ['make up your mind', 'decide', 'Make up your mind - pizza or sushi?'],
    ['side quest', 'a small extra task or adventure away from the main plan', 'We found a bakery as a side quest.'],
  ],
  B2: [
    ['spoil the mood', 'make a happy moment unpleasant', 'The argument at dinner spoiled the mood.'],
    ['bite the bullet', 'to do something unpleasant that you have been avoiding', 'I finally bit the bullet and called the bank.'],
    ['low-key', 'slightly, or without making a big deal of it', "I'm low-key excited for the weekend."],
    ['it hits different', 'it feels special or stronger than usual', 'Coffee hits different on a rainy morning.'],
    ['live rent free', "to keep occupying someone's thoughts", 'That song lives rent free in my head.'],
    ['spill the tea', 'to share gossip', 'Come on, spill the tea. What happened?'],
    ['FOMO', 'fear of missing out', 'I went to the party out of pure FOMO.'],
    ['doomscrolling', 'reading bad news online for hours without stopping', 'I was doomscrolling until 2 a.m. again.'],
    ['ghost someone', 'to stop answering someone without any explanation', 'He ghosted me after the second date.'],
    ['green flag', 'a good sign in a person or a situation', 'She remembers little details. Total green flag.'],
    ['the bottom line', 'the most important fact', 'The bottom line is: we need more time.'],
    ['play it by ear', 'decide what to do as things happen', "I don't know when I'll finish. Let's play it by ear."],
    ['beat around the bush', 'avoid saying something directly', 'Stop beating around the bush and tell me what happened.'],
    ['call it a day', 'stop working for today', "It's late. Let's call it a day."],
    ['gatekeep', 'to stop others from enjoying something you know about', "Don't gatekeep that café. Tell us the name!"],
  ],
  C1: [
    ['a double-edged sword', 'something with both good and bad effects', 'Working from home is a double-edged sword.'],
    ['read between the lines', 'understand what is meant but not said', 'Read between the lines: he is not happy with the plan.'],
    ['be on the fence', 'not able to decide', "I'm still on the fence about the job offer."],
    ['the elephant in the room', 'an obvious problem nobody wants to talk about', 'Nobody mentioned the budget - the elephant in the room.'],
    ['a blessing in disguise', 'something that seems bad but turns out good', 'Missing that flight was a blessing in disguise.'],
    ['cut corners', 'do something badly to save time or money', "Don't cut corners on safety."],
    ['take it with a pinch of salt', 'not believe something completely', 'Take online reviews with a pinch of salt.'],
    ['a steep learning curve', 'a lot to learn in a short time', 'The new job has a steep learning curve.'],
    ['pull your weight', 'do your fair share of the work', 'Everyone in the team has to pull their weight.'],
    ['get the ball rolling', 'start something', "Let's get the ball rolling with a quick introduction."],
    ['main character energy', 'acting confident, as if your life is a film about you', 'She walked in with main character energy.'],
    ['touch grass', 'go outside and take a break from the internet', 'You have been online all day. Go touch grass.'],
    ['no cap', "no lie, I'm being honest (US slang)", 'That was the best concert I have ever seen, no cap.'],
    ['IYKYK', 'if you know, you know (an inside joke)', 'That little café on the corner. IYKYK.'],
    ['a far cry from', 'very different from', 'The new office is a far cry from the old one.'],
  ],
};

const DEFAULT_LEVEL = 'B1';

/** 'b2+' → 'B2', 'C2' → 'C1', anything else → B1. */
function normLevel(level) {
  const m = String(level || '').toUpperCase().match(/^([ABC])([12])/);
  if (!m) return DEFAULT_LEVEL;
  const l = m[1] + m[2];
  return l === 'C2' ? 'C1' : l;
}

/** The day number (days since 1970) on the student's own calendar. */
function localDay(timeZone, now = new Date()) {
  let ymd;
  try { ymd = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
  catch (_) { ymd = now.toISOString().slice(0, 10); }
  return Math.floor(Date.parse(ymd + 'T00:00:00Z') / 864e5);
}

function phraseFor(level, day) {
  const lv = normLevel(level);
  const list = PHRASES[lv];
  const [phrase, meaning, example] = list[((day % list.length) + list.length) % list.length];
  return { phrase, meaning, example, level: lv };
}

module.exports = { PHRASES, normLevel, localDay, phraseFor };
