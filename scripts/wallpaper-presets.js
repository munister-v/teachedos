/* Пресеты фона: общие для рабочего стола учителя (desktop-extras.js) и
   кабинета ученика (student-wallpaper.js). Ключи совпадают с WALL_PRESETS в
   backend/routes/users.js. */
(function () {
  'use strict';
  if (window.TeachedWall) return;
  const WALL_PRESETS = [
    /* Стандартный фон - небо из макета «Главная стр» (Figma): серые облака
       сверху, бирюза снизу. На нём окна становятся стеклом (glass). Прежний
       ровный светлый остался пресетом 'plain'. */
    { key: null,       group: 'colour', title: 'TeachEd sky', glass: true, css: 'radial-gradient(55% 38% at 28% 16%, rgba(255,255,255,.38) 0%, transparent 70%), radial-gradient(45% 30% at 78% 26%, rgba(255,255,255,.24) 0%, transparent 70%), radial-gradient(70% 45% at 60% 100%, rgba(62,150,150,.55) 0%, transparent 70%), linear-gradient(180deg, #8C9194 0%, #A3A9AB 36%, #9DB6B5 64%, #6AA8A6 100%)' },
    { key: 'plain',    group: 'colour', title: 'Plain',    css: '#F6F6EF' },
    { key: 'mist',     group: 'colour', title: 'Mist',     css: 'radial-gradient(120% 90% at 15% 10%, #FFFFFF 0%, transparent 55%), linear-gradient(160deg, #E9ECF2 0%, #DCE1EA 100%)' },
    { key: 'dawn',     group: 'colour', title: 'Lime dawn', css: 'radial-gradient(90% 70% at 85% 0%, rgba(205,242,79,.55) 0%, transparent 60%), linear-gradient(170deg, #F6F8EE 0%, #E7EAE3 100%)' },
    { key: 'meadow',   group: 'colour', title: 'Meadow',   css: 'radial-gradient(80% 60% at 10% 90%, rgba(168,208,43,.35) 0%, transparent 60%), radial-gradient(70% 60% at 90% 20%, rgba(124,138,123,.25) 0%, transparent 60%), #E8ECE4' },
    { key: 'lavender', group: 'colour', title: 'Lavender', css: 'radial-gradient(90% 80% at 80% 15%, #F6F2FF 0%, transparent 55%), linear-gradient(165deg, #EEE8FF 0%, #DCD3F5 100%)' },
    { key: 'dusk',     group: 'colour', title: 'Dusk',     css: 'radial-gradient(90% 70% at 20% 0%, rgba(205,242,79,.18) 0%, transparent 55%), linear-gradient(170deg, #2A2A33 0%, #16161B 100%)', dark: true },
    { key: 'graphite', group: 'colour', title: 'Graphite', css: 'linear-gradient(165deg, #B9BBC3 0%, #8E9099 100%)', dark: true },
    /* Узоры - тоже чистый CSS, в цветах TeachEd. */
    { key: 'dots',     group: 'pattern', title: 'Dot grid',   css: 'radial-gradient(circle, rgba(22,22,22,.16) 1.2px, transparent 1.6px) 0 0 / 22px 22px, #F2F2F5' },
    { key: 'paper',    group: 'pattern', title: 'Grid paper', css: 'linear-gradient(rgba(92,92,102,.09) 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(90deg, rgba(92,92,102,.09) 1px, transparent 1px) 0 0 / 28px 28px, #F7F7F9' },
    { key: 'lime-dots', group: 'pattern', title: 'Lime dots', css: 'radial-gradient(circle, rgba(168,194,31,.55) 2px, transparent 2.6px) 0 0 / 30px 30px, linear-gradient(170deg, #F7F9EF 0%, #ECEFE4 100%)' },
    { key: 'stripes',  group: 'pattern', title: 'Lavender stripes', css: 'repeating-linear-gradient(135deg, rgba(255,255,255,.5) 0 14px, transparent 14px 28px), linear-gradient(160deg, #ECE6FF 0%, #DDD5F6 100%)' },
    { key: 'night-grid', group: 'pattern', title: 'Night grid', css: 'linear-gradient(rgba(205,242,79,.07) 1px, transparent 1px) 0 0 / 32px 32px, linear-gradient(90deg, rgba(205,242,79,.07) 1px, transparent 1px) 0 0 / 32px 32px, radial-gradient(80% 60% at 50% 0%, #2E2E3A 0%, #15151B 100%)', dark: true },
    /* Фото - «избранные изображения» Wikimedia Commons, свободные лицензии.
       CC BY / BY-SA требуют автора, лицензию и ссылку: они в подсказке плитки
       и в подписи в углу стола, пока фон выбран. Файлы - img/wallpapers,
       2560px WebP, превью 360px рядом (-thumb). */
    { key: 'carpathians', group: 'photo', title: 'Carpathians', credit: 'Rbrechko', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:21-224-5054_NNP_Synevyr_RB_18.jpg' },
    { key: 'fjord', group: 'photo', title: 'Fjord', credit: 'Ximonic (Simo Räsänen)', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Afternoon_at_Tennfjorden,_Raftsundet,_Hinn%C3%B8ya,_Norway,_2015_September.jpg' },
    { key: 'lake', group: 'photo', title: 'Mountain lake', credit: 'Myrabella', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Gentau_Pic_du_Midi_Ossau.jpg' },
    { key: 'laurel', group: 'photo', title: 'Misty laurels', credit: 'Dietmar Rabich', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Fanal_(Madeira,_Portugal),_Lorbeerwald_--_2025_--_1532.jpg' },
    { key: 'fog', group: 'photo', title: 'Fog', credit: 'W.carter', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Forested_hills_in_Lysekil_in_fog_-_B%26W.jpg' },
    { key: 'hills', group: 'photo', title: 'Green hills', credit: 'Kreuzschnabel', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:2015_Swaledale_from_Kisdon_Hill.jpg' },
    { key: 'moss', group: 'photo', title: 'Moss', credit: 'W.carter', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Bilberry_bush_and_moss_in_Gullmarsskogen_ravine.jpg' },
    { key: 'alley', group: 'photo', title: 'Forest path', credit: 'Dietmar Rabich', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:D%C3%BClmen,_B%C3%B6rnste,_Waldweg_--_2015_--_4649.jpg' },
    { key: 'frost', group: 'photo', title: 'Frosty dawn', credit: 'Amadvr', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Karula_vaade.jpg' },
    { key: 'sunset', group: 'photo', title: 'Sunset trees', credit: 'Dietmar Rabich', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:D%C3%BClmen,_Umland_--_2014_--_7056.jpg' },
    { key: 'harbour', group: 'photo', title: 'Harbour', credit: 'Moahim', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:2018_-_Nyhavn_on_sunset.jpg' },
    { key: 'canals', group: 'photo', title: 'Canals', credit: 'Diliff', license: 'CC BY 2.5', source: 'https://commons.wikimedia.org/wiki/File:Amsterdam_Canals_-_July_2006.jpg' },
    { key: 'river-night', group: 'photo', title: 'River at night', credit: 'Max Dawncat', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:2018_-_May_-_Salzach_River_at_night_in_Salzburg.jpg', dark: true },
    /* Города - тоже избранные снимки Wikimedia Commons. */
    { key: 'kyiv', group: 'city', title: 'Kyiv', credit: 'Moahim', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:2017_-_%D0%9A%D0%B8%D1%97%D0%B2_-_%D0%A1%D0%B2%D1%96%D1%82%D0%B0%D0%BD%D0%BE%D0%BA_%D0%BD%D0%B0%D0%B4_%D0%94%D0%BD%D1%96%D0%BF%D1%80%D0%BE%D0%BC.jpg' },
    { key: 'new-york', group: 'city', title: 'New York', credit: 'Superbass', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:2024-11-17-Lower_Manhattan-0593.jpg', dark: true },
    { key: 'chicago', group: 'city', title: 'Chicago', credit: 'Diego Delso', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Skyline_de_Chicago_desde_el_centro,_Illinois,_Estados_Unidos,_2012-10-20,_DD_06.jpg' },
    { key: 'london', group: 'city', title: 'London', credit: 'Colin and Kim Hansen', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:City_of_London_skyline_from_London_City_Hall_-_Sept_2015_-_Crop_Aligned.jpg' },
    { key: 'paris', group: 'city', title: 'Paris', credit: 'DXR', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Notre-Dame_de_Paris_and_%C3%8Ele_de_la_Cit%C3%A9_at_dusk_140516_1.jpg', dark: true },
    { key: 'rome', group: 'city', title: 'Rome', credit: 'Jebulon', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Castel_Sant%27Angelo_at_dusk,_Rome,_Italy.jpg', dark: true },
    { key: 'tokyo', group: 'city', title: 'Tokyo', credit: 'Basile Morin', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Shinjuku_Gyoen_National_Garden_and_NTT_DoCoMo_Yoyogi_Building,_Tokyo,_Japan.jpg' },
  ];
  /* Путь абсолютный: фон ставится через CSS-переменную, а относительный
     url() в ней считается от файла стилей (styles/), а не от страницы. */
  WALL_PRESETS.forEach(p => {
    if (p.group !== 'photo' && p.group !== 'city') return;
    const at = f => new URL(`img/wallpapers/${f}`, document.baseURI).href;
    p.css = `url("${at(p.key + '.webp')}") center / cover no-repeat, #6B6F78`;
    p.thumb = `url("${at(p.key + '-thumb.webp')}") center / cover no-repeat, #D5D7DC`;
  });
  /* Фон по умолчанию (key: null) - снимок Карпат, а не ровный цвет: так
     попросили, чтобы у всех с первого входа был красивый стол. Кто хочет
     светлый - выбирает «Plain». */
  const DEFAULT_PHOTO = WALL_PRESETS.find(p => p.key === 'carpathians');
  const DEFAULT = WALL_PRESETS.find(p => p.key === null);
  if (DEFAULT && DEFAULT_PHOTO) Object.assign(DEFAULT, { title: 'TeachEd default', css: DEFAULT_PHOTO.css, thumb: DEFAULT_PHOTO.thumb, credit: DEFAULT_PHOTO.credit, license: DEFAULT_PHOTO.license, source: DEFAULT_PHOTO.source, glass: true });
  const WALL_GROUPS = [
    { key: 'colour', title: 'Colours' },
    { key: 'photo', title: 'Photos' },
    { key: 'city', title: 'Cities' },
    { key: 'pattern', title: 'Patterns' },
  ];
  window.TeachedWall = { presets: WALL_PRESETS, groups: WALL_GROUPS };
})();
