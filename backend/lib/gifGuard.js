/* Is this GIF search, or this GIF, fit for a class?  (used by routes/gifs.js)

   KLIPY's own content filter is the first gate; this is the second, and it is ours:
     * a SEARCH that asks for sexual, abusive or violent material is not sent anywhere - the picker
       answers "nothing" and the teacher sees that the word is not available here;
     * a RESULT whose title, slug or tags carry such a word is dropped, whatever the search was
       (a harmless query can still surface an unlucky item; trending can too).
   English, Ukrainian and Russian - the languages the teachers and students here type in.

   Words are matched as whole words, so "class", "Essex", "cocktail" or "мандарин" pass; spellings
   that dodge a filter ("p0rn", "s3x", "sh1t") and accents/full-width letters are folded first.
   It errs towards blocking: a teacher can always paste a link, and a missed word costs more than
   a blocked one (the list is meant to be extended - add a stem to LATIN or CYRILLIC). */

const L = '(?<![\\p{L}])';   // not inside a longer word (digits do not protect: "sex69")
const R = '(?![\\p{L}])';

// whole words (the endings in the groups are the only ones allowed)
const LATIN = [
  // sexual
  'sex(?:y|ier|iest|ual\\w*|ting|t)?', 'porn\\w*', 'xxx+', 'nsfw', 'nud(?:e|es|ity)', 'naked', 'topless', 'strip(?:per|pers|tease|clubs?)',
  'lingerie', 'thongs?', 'erotic\\w*', 'hentai', 'orgasm\\w*', 'masturbat\\w*', 'dildos?', 'vibrators?', 'blowjobs?', 'handjobs?',
  'cum(?:ming|shots?)?', 'creampie', 'boobs?', 'boobies', 'tits?', 'titt(?:y|ies)', 'nipples?', 'nipslip', 'ass(?:es|hole|holes)?', 'booty',
  'twerk\\w*', 'dicks?', 'cocks?(?!\\s*(?:a\\s*)?doodle)', 'penis(?:es)?', 'vagina\\w*', 'pussy|pussies', 'anal', 'fetish\\w*', 'bdsm',
  'horny', 'sluts?', 'whores?', 'prostitut\\w*', 'rap(?:e|ed|es|ist|ists)', 'molest\\w*', 'incest', 'onlyfans', 'playboy', 'milfs?',
  'gangbang\\w*', 'orgy|orgies', 'threesome', 'boner', 'erection', 'upskirt', 'camgirls?', 'fap(?:ping)?',
  // abuse
  'fuck\\w*', 'motherfuck\\w*', 'shit(?:ty|s|head)?', 'bullshit', 'bitch\\w*', 'cunts?',
  'nigg(?:er|a)s?', 'fag(?:got)?s?', 'retard(?:ed)?s?', 'chinks?', 'spics?', 'kikes?', 'trann(?:y|ies)',
  // violence, self-harm, drugs, hate symbols
  'gore', 'gory', 'behead\\w*', 'decapitat\\w*', 'murder\\w*', 'suicid\\w*', 'self\\s*harm\\w*', 'kys', 'kill\\s+(?:your|him|her|them)self',
  'cocaine', 'heroin', 'meth', 'marijuana', 'cannabis', 'bongs?', 'overdos\\w*', 'nazis?', 'swastikas?', 'hitler', 'sieg\\s+heil',
];

// stems: the word may continue ("порно" → "порнуха"); where a stem is also the start of an innocent word
// ("секст-ет", "манд-арин") it is written as a whole word with its endings instead
const CYRILLIC = [
  'секс(?:у|ом|а|е|ы|ов|и|уальн\\p{L}*|ист\\p{L}*)?', 'порн\\p{L}*', '[еэ]ротик\\p{L}*', '[еэ]ротич\\p{L}*', 'голая', 'голые', 'голую', 'голых', 'голеньк\\p{L}*',
  'обнажен\\p{L}*', 'оголен\\p{L}*', 'сиськ\\p{L}*', 'сиски', 'сись', 'титьк\\p{L}*', 'тит[ыь]', 'цицьк\\p{L}*', 'цицк\\p{L}*', 'жоп\\p{L}*', 'задниц\\p{L}*',
  'пенис\\p{L}*', 'вагин\\p{L}*', 'х[уў][йеёяюї]\\p{L}*', 'х[уў]є\\p{L}*', 'п[иі]зд\\p{L}*', '[её]б[аеиоуя]н\\p{L}*', '[её]бат\\p{L}*', '[её]бал\\p{L}*', '[её]бну\\p{L}*', '[её]бл[яюи]\\p{L}*',
  '[её]бут\\p{L}*', '[её]бучий', 'бл[яє]д\\p{L}*', 'бл[яє]т\\p{L}*', 'сука', 'суки', 'сучк\\p{L}*', 'сучар\\p{L}*', 'муда[кчл]\\p{L}*', 'п[иі]д[оа]р\\p{L}*', 'педик\\p{L}*',
  'г[оа]ндон\\p{L}*', 'шлюх\\p{L}*', 'проститут\\p{L}*', 'траха\\p{L}*', 'трахн\\p{L}*', 'м[иі]нет', 'оргазм\\p{L}*', 'мастурб\\p{L}*', 'дроч\\p{L}*', 'стриптиз\\p{L}*', 'раздет\\p{L}*', 'роздяг\\p{L}*',
  'залуп\\p{L}*', 'изнасил\\p{L}*', 'зґвалт\\p{L}*', 'згвалт\\p{L}*', 'суицид\\p{L}*', 'самогубств\\p{L}*', 'наркот\\p{L}*', 'героин\\p{L}*', 'героїн\\p{L}*', 'кокаин\\p{L}*', 'кокаїн\\p{L}*', 'марихуан\\p{L}*',
  'гитлер\\p{L}*', 'гітлер\\p{L}*', 'свастик\\p{L}*', 'нацист\\p{L}*', 'обезглавл\\p{L}*',
];

const RE = new RegExp(`${L}(?:${LATIN.join('|')}|${CYRILLIC.join('|')})${R}`, 'iu');

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

// Two readings of the same text: as written, and with the usual look-alike digits and symbols read as letters.
function forms(text) {
  const plain = String(text == null ? '' : text)
    .normalize('NFKC')                         // full-width and compatibility letters
    .replace(/[\u00c0-\u024f]/g, c => c.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''))   // Latin accents only: Cyrillic й, ё, ї must stay whole
    .toLowerCase()
    .replace(/[_\-.,;:/\\|+*"'`~^()[\]{}<>]+/g, ' ')   // slug hyphens, punctuation
    .replace(/\s+/g, ' ')
    .slice(0, 4000);
  const leet = plain.replace(/[013457@$!]/g, c => LEET[c]);
  return leet === plain ? [plain] : [plain, leet];
}

const hits = (text) => forms(text).some(f => RE.test(f));

// "dirty search": the words a teacher typed
const isBlockedQuery = (q) => !!q && hits(q);

// one KLIPY item: whatever text it carries about itself
function itemText(it) {
  if (!it || typeof it !== 'object') return '';
  const parts = [it.title, it.slug, it.description, it.alt, it.caption, it.content_description];
  for (const k of ['tags', 'keywords', 'categories']) {
    const v = it[k];
    if (Array.isArray(v)) parts.push(...v.map(x => (typeof x === 'string' ? x : x && (x.name || x.title || x.tag)) || ''));
    else if (typeof v === 'string') parts.push(v);
  }
  return parts.filter(s => typeof s === 'string' && s).join(' \n ');
}
const isBlockedItem = (it) => hits(itemText(it));

module.exports = { isBlockedQuery, isBlockedItem, hits, itemText, LATIN, CYRILLIC };
