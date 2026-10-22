/* The sound card (ТЗ §20 / D4): how one sound is made, in plain words, and three minimal pairs. It is a hint for
   practice - never a score. Keyed by IPA; an unknown symbol gets the generic card (listen, repeat slowly). */
const CARDS = {
  'θ': { how: 'Put the tip of your tongue between your teeth and blow air softly. No voice.', pairs: [['think', 'sink'], ['three', 'free'], ['thank', 'tank']] },
  'ð': { how: 'Tongue between your teeth, and use your voice - you should feel a buzz.', pairs: [['this', 'dis'], ['then', 'den'], ['breathe', 'breeze']] },
  'ʃ': { how: 'Round your lips a little, tongue back, and let the air flow smoothly: shhh.', pairs: [['ship', 'sheep'], ['shy', 'sigh'], ['wash', 'watch']] },
  'ʒ': { how: 'Like the sound in "vision": the same shape as shhh, but with your voice on.', pairs: [['vision', 'fission'], ['measure', 'major'], ['beige', 'bait']] },
  'tʃ': { how: 'A tiny stop and then shhh: the tongue touches the roof of the mouth and lets go.', pairs: [['chip', 'ship'], ['cheap', 'sheep'], ['watch', 'wash']] },
  'dʒ': { how: 'The same as the "ch" sound, but with your voice on.', pairs: [['jam', 'sham'], ['joke', 'choke'], ['edge', 'etch']] },
  'v': { how: 'Top teeth touch the lower lip, and use your voice. Not "w".', pairs: [['very', 'berry'], ['vest', 'west'], ['van', 'ban']] },
  'w': { how: 'Round your lips like for "oo", then open them quickly. Teeth do not touch.', pairs: [['west', 'vest'], ['wine', 'vine'], ['wiper', 'viper']] },
  'ɪ': { how: 'A short, relaxed sound - lips not spread. Quick, like "sit".', pairs: [['ship', 'sheep'], ['sit', 'seat'], ['live', 'leave']] },
  'iː': { how: 'A long sound with your lips spread, like a small smile: "eee".', pairs: [['sheep', 'ship'], ['seat', 'sit'], ['leave', 'live']] },
  'æ': { how: 'Open your mouth wide, jaw down, tongue low and flat - the sound in "cat".', pairs: [['cat', 'cut'], ['bad', 'bed'], ['man', 'men']] },
  'ʌ': { how: 'Mouth half open and relaxed, a short "uh": "cup".', pairs: [['cup', 'cap'], ['luck', 'lack'], ['run', 'ran']] },
  'ʊ': { how: 'Short and relaxed, lips a little rounded: "book".', pairs: [['full', 'fool'], ['pull', 'pool'], ['look', 'Luke']] },
  'uː': { how: 'Lips tightly rounded and the sound long: "oooo".', pairs: [['fool', 'full'], ['pool', 'pull'], ['Luke', 'look']] },
  'ŋ': { how: 'The back of your tongue touches the soft part of the roof; the air goes through your nose. No "g" at the end.', pairs: [['sing', 'sin'], ['thing', 'thin'], ['wing', 'win']] },
  'h': { how: 'Just a breath from the throat, nothing in the mouth: "hhh".', pairs: [['hat', 'at'], ['hair', 'air'], ['hear', 'ear']] },
  'l': { how: 'The tip of the tongue touches the ridge behind your top teeth, and the air goes round the sides.', pairs: [['light', 'right'], ['lock', 'rock'], ['glass', 'grass']] },
  'r': { how: 'Curl the tongue back a little, do not touch the roof, lips slightly rounded.', pairs: [['right', 'light'], ['rock', 'lock'], ['grass', 'glass']] },
  'ɹ': { how: 'Curl the tongue back a little, do not touch the roof, lips slightly rounded.', pairs: [['right', 'light'], ['rock', 'lock'], ['grass', 'glass']] },
  'ə': { how: 'The lazy sound: relax everything and say a very short "uh" in the unstressed part of the word.', pairs: [['about', 'a-bout'], ['teacher', 'teach-er'], ['banana', 'ba-na-na']] },
  'ɒ': { how: 'Mouth open and round, a short sound from the back: "hot" (British).', pairs: [['hot', 'hat'], ['cot', 'cat'], ['not', 'nut']] },
};
const ACCENT_TIP = {
  'en-US': { r: 'In American English the "r" is always pronounced, also at the end of words: "car".', t: 'Between vowels American "t" is soft, like a quick "d": "water".' },
  'en-GB': { r: 'In British English the "r" is silent at the end of a word, unless a vowel follows: "car".', t: 'In some British accents the "t" in the middle can be a tiny stop in the throat: "bottle".' },
};
const norm = s => String(s || '').replace(/[\/\[\]ˈˌ.]/g, '').trim();

function soundCard(word, ipa, accent = 'en-US') {
  const key = norm(ipa);
  const c = CARDS[key] || CARDS[key.replace('ː', '')] || null;
  const tip = (key === 'r' || key === 'ɹ') ? ACCENT_TIP[accent].r : key === 't' ? ACCENT_TIP[accent].t : '';
  return {
    word: String(word || '').slice(0, 40), sound: key, found: !!c,
    how: c ? c.how : 'Listen to the word once more and say it slowly, one sound at a time.',
    tip, pairs: c ? c.pairs.map(([a, b]) => ({ a, b })) : [],
  };
}
module.exports = { soundCard, CARDS };
