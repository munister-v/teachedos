/* Meet Ukraine (meet-ukraine/*.html): the series as data.
   Thirteen interactive wallpapers by TeachEd Official, each one its own page. Picture Studio
   (community.html, Vocabularies) lists them as a folder and finds them by title or by any of
   their 87 words; the desktop offers the same pictures as backgrounds (scripts/wallpaper-presets.js,
   img/wallpapers/ua-<slug>.webp). Words are copied from each page's DATA - when a scene changes, change it here too. */
(function () {
  'use strict';
  if (window.MeetUkraine) return;
  const SCENES = [
    { slug: "kitchen", title: "Ukrainian Kitchen", icon: "🇺🇦", hint: "The first scene of the series: a cozy drawn kitchen where every object teaches a word.", words: 10, terms: [["Вікно","window"],["Піч","clay stove / traditional oven"],["Писанка","painted Easter egg"],["Соняшник","sunflower"],["Борщ","borscht, beetroot soup"],["Вареники","filled dumplings"],["Паляниця","round wheat loaf"],["Калина","viburnum (guelder rose)"],["Рушник","embroidered ritual cloth"],["Кіт","cat"]] },
    { slug: "christmas-eve", title: "Christmas Eve — Sviata Vecheria", icon: "🎄", hint: "Twelve dishes, one candle, a sheaf of wheat — and nobody sits down until the first star appears.", words: 7, night: true, terms: [["Зірка","star"],["Дідух","sheaf of wheat, 'grandfather' spirit"],["Кутя","kutia, sweet wheat berry dish"],["Свічка","candle"],["Узвар","dried fruit compote"],["Колядники","carol singers"],["Вушка","little mushroom dumplings"]] },
    { slug: "easter", title: "Easter — Velykden", icon: "🐣", hint: "Blessed baskets, tall golden paska, written eggs — and a morning that starts with 'Khrystos voskres!'", words: 7, terms: [["Верба","willow (pussy willow)"],["Кошик","Easter basket"],["Паска","Easter bread"],["Писанка","written Easter egg"],["Свічка","candle"],["Церква","church"],["Дзвін","bell"]] },
    { slug: "wedding", title: "A Ukrainian Wedding", icon: "💍", hint: "A loaf as tall as a cake, dough doves on top, and a couple standing on an embroidered cloth.", words: 6, terms: [["Наречені","the engaged couple / newlyweds"],["Коровай","wedding loaf"],["Голуби","doves"],["Рушник","embroidered cloth"],["Вінок","bride's wreath"],["Букет","bouquet"]] },
    { slug: "bread-and-salt", title: "Bread and Salt — Khlib-Sil", icon: "🍞", hint: "The oldest Ukrainian welcome: a round loaf, a pinch of salt, and a guest who leaves as family.", words: 7, terms: [["Хліб","bread"],["Сіль","salt"],["Соняшник","sunflower"],["Вікно","window"],["Двері","door"],["Мальви","mallows (hollyhocks)"],["Тин","woven fence"]] },
    { slug: "vyshyvanka", title: "Vyshyvanka — The Embroidered Shirt", icon: "👕", hint: "A shirt you can read: every colour and every stitch wishes its wearer well.", words: 6, terms: [["Вишиванка","embroidered shirt"],["П'яльці","embroidery hoop"],["Нитки","threads"],["Візерунок","pattern / ornament"],["Скриня","dowry chest"],["Голка","needle"]] },
    { slug: "ivan-kupala", title: "Ivan Kupala Night", icon: "🔥", hint: "Bonfires, floating wreaths, and one magic flower that blooms only until dawn.", words: 6, night: true, terms: [["Вогнище","bonfire"],["Вінок","wreath"],["Папороть","fern"],["Пара","couple"],["Річка","river"],["Місяць","moon"]] },
    { slug: "harvest", title: "Harvest — Obzhynky", icon: "🌾", hint: "Songs, a dressed-up sheaf, and the first bread of the new grain.", words: 6, terms: [["Лелека","stork"],["Сніп","sheaf"],["Коса","scythe"],["Хліб","bread (from the new grain)"],["Сонце","sun"],["Колос","ear of wheat"]] },
    { slug: "songs-at-the-table", title: "Songs at the Table", icon: "🎶", hint: "Dinner is over. Someone starts a song — and the whole table joins in.", words: 7, terms: [["Співаки","singers"],["Бандура","bandura"],["Пісенник","songbook"],["Лампа","lamp"],["Тарілка","plate"],["Глечик","clay jug"],["Стіл","table"]] },
    { slug: "st-nicholas", title: "St Nicholas Day — Den Mykolaia", icon: "🎁", hint: "Polish your shoes, behave (mostly), and check under your pillow in the morning.", words: 6, night: true, terms: [["Святий Миколай","Saint Nicholas"],["Подарунок","gift / present"],["Подушка","pillow"],["Різка","twig / switch"],["Сніг","snow"],["Мандаринка","tangerine"]] },
    { slug: "masnytsia", title: "Masnytsia — Pancake Week", icon: "🥞", hint: "A week of pancakes: visiting, laughing, forgiving — and politely showing winter the door.", words: 6, terms: [["Млинці","pancakes / crepes"],["Сметана","sour cream"],["Марена","straw effigy of winter"],["Хоровод","round dance"],["Сніговик","snowman"],["Сонце","sun"]] },
    { slug: "petrykivka", title: "Petrykivka Painting", icon: "🎨", hint: "Flowers that never wilt, painted without a single sketch line.", words: 6, terms: [["Квітка","flower"],["Фарби","paints"],["Пензлик","brush"],["Таріль","decorative plate"],["Скриня","painted chest"],["Калина","viburnum"]] },
    { slug: "ukrainian-khata", title: "The Ukrainian Khata — Village Home", icon: "🏡", hint: "An ordinary day in a whitewashed house — the background all the traditions live on.", words: 7, terms: [["Хата","village house"],["Стріха","thatched roof"],["Мальви","mallows"],["Чорнобривці","marigolds"],["Криниця","well"],["Тин","woven fence"],["Мотанка","wound-thread doll"]] }
  ];
  const BASE = 'meet-ukraine/';
  /* meet-ukraine/index.html keeps the visited scenes under this key as 'kitchen.html'-style hrefs;
     the folder in Picture Studio reads and writes the same list, so the count agrees in both places. */
  const SEEN_KEY = 'teached_meet_ukraine_seen';
  const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const seen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]').map(h => String(h).replace(/\.html$/, ''))); } catch (_) { return new Set(); } };
  const markSeen = slug => {
    try {
      const list = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
      if (!list.includes(slug + '.html')) { list.push(slug + '.html'); localStorage.setItem(SEEN_KEY, JSON.stringify(list)); }
    } catch (_) {}
  };
  /* What a search for q finds: {scene, hits} for every scene whose title, line or words contain it.
     "ukraine", "ukrainian" and "meet" bring the whole series, like opening its folder. */
  const WHOLE = ['ukraine', 'ukrainian', 'meet ukraine', 'ukraina', 'україна', 'україн', 'wallpaper', 'tradition'];
  function find(q) {
    const t = norm(q).trim();
    if (!t) return [];
    const all = t.length >= 3 && WHOLE.some(w => norm(w).startsWith(t) || t.startsWith(norm(w)));
    return SCENES.map(scene => {
      const hits = scene.terms.filter(([ua, en]) => norm(ua).includes(t) || norm(en).includes(t)).map(([ua, en]) => ua + ' · ' + en);
      const own = norm(scene.title).includes(t) || norm(scene.hint).includes(t);
      return all || own || hits.length ? { scene, hits } : null;
    }).filter(Boolean);
  }
  window.MeetUkraine = {
    scenes: SCENES,
    total: SCENES.reduce((n, s) => n + s.words, 0),
    href: slug => BASE + slug + '.html',
    index: BASE + 'index.html',
    map: BASE + 'map-of-ukraine.html',
    glossary: BASE + 'glossary.html',
    thumb: slug => `img/wallpapers/ua-${slug}-thumb.webp`,
    seen, markSeen, find,
  };
})();
