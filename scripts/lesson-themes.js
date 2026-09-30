/* ═══ THEMATIC UI SKINS: ТЕМЫ ОФОРМЛЕНИЯ УРОКА ═════════════════════════════
   ТЗ «Thematic UI Skins». Тема - только внешний вид: логика упражнений её не
   видит. Учитель выбирает тему в конструкторе (превью пути), на карточке пути
   (🎨) или для всей карты урока; она лежит в _wfPath.theme / _wfFlow.theme.

   Одна тема = один набор токенов (THEMES ниже). Из него собираются три
   таблицы стилей:
     - для самой доски: студии (путь, Listening/Reading/Grammar Studio,
       Vocabulary Studio, Speaking Studio, Picture Studio, журнал) и карта
       урока - корень получает класс .lt-<id>, и правила под ним
       переопределяют фон, панели, рамки, акцент и шрифт заголовков;
     - для листов в iframe (worksheet-play.js): переменные :root самого листа;
     - для игр (games/*.html, тот же источник): вставляется <style> в документ.

   Читаемость: тёмным бывает только фон ВОКРУГ панелей. Сами панели, карточки
   слов и игровые поля остаются светлыми (пергамент, «капсула», бумага), текст
   на них - тёмные чернила темы, контраст не хуже 7:1. Названия тем - свои:
   «вдохновлено», без чужих товарных знаков. */
(function () {
  'use strict';

  // В одинарных кавычках и без сырых ' внутри: строка живёт и в CSS, и в style="…".
  const svg = s => `url('data:image/svg+xml,${encodeURIComponent(s.replace(/\s+/g, ' ')).replace(/'/g, '%27')}')`;
  const PAT = {
    stars: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><g fill='#fff'>
      <circle cx='18' cy='26' r='1.1' opacity='.8'/><circle cx='70' cy='90' r='.8' opacity='.6'/><circle cx='130' cy='20' r='1.4' opacity='.9'/>
      <circle cx='200' cy='70' r='.9' opacity='.7'/><circle cx='40' cy='170' r='1.2' opacity='.75'/><circle cx='110' cy='140' r='.7' opacity='.5'/>
      <circle cx='175' cy='190' r='1.1' opacity='.8'/><circle cx='230' cy='150' r='.8' opacity='.6'/><circle cx='90' cy='220' r='.9' opacity='.65'/>
      <path d='M160 110l1.8 5.2 5.2 1.8-5.2 1.8-1.8 5.2-1.8-5.2-5.2-1.8 5.2-1.8z' opacity='.9'/>
      <path d='M30 100l1.2 3.6 3.6 1.2-3.6 1.2-1.2 3.6-1.2-3.6-3.6-1.2 3.6-1.2z' opacity='.7'/></g></svg>`),
    brick: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='96' height='48'><g fill='none' stroke='#fff' stroke-opacity='.085'>
      <path d='M0 .5H96M0 24.5H96M48 0V24M0 24V48M96 24V48'/></g></svg>`),
    web: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><g fill='none' stroke='#fff' stroke-opacity='.12'>
      <path d='M0 0L120 120M0 60L120 120M60 0L120 120M0 120H120M120 0V120'/>
      <path d='M0 30Q30 30 30 0M0 60Q60 60 60 0M0 95Q95 95 95 0'/></g></svg>`),
    sparkle: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><g fill='#E8C15A'>
      <path d='M40 40l2 6 6 2-6 2-2 6-2-6-6-2 6-2z' opacity='.55'/><path d='M150 30l1.4 4 4 1.4-4 1.4-1.4 4-1.4-4-4-1.4 4-1.4z' opacity='.4'/>
      <path d='M120 130l2.4 7 7 2.4-7 2.4-2.4 7-2.4-7-7-2.4 7-2.4z' opacity='.5'/><circle cx='70' cy='160' r='1.3' opacity='.5'/>
      <circle cx='180' cy='100' r='1' opacity='.45'/><circle cx='20' cy='120' r='.9' opacity='.4'/></g></svg>`),
    grid: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><path d='M44 .5H.5V44' fill='none' stroke='#00E5FF' stroke-opacity='.13'/></svg>`),
    // Летучие мыши - свои; тыквы - из Halloween Pumpkin Pack (img/themes/pumpkins, см. README там).
    bats: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><g opacity='.22' fill='#fff'>
      <path d='M150 50q6-8 12-2q4-6 8 0q4-6 8 2q6-6 12 2q-10 2-14 8q-3-4-6-4q-3 0-6 4q-4-6-14-8z'/>
      <path d='M40 190q5-6 9-1q3-5 6 0q3-5 6 1q5-5 9 1q-8 2-11 6q-2-3-4-3t-4 3q-3-4-11-6z'/></g></svg>`),
    pumpkins: "url('/img/themes/pumpkins/tile.png')",
    snow: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><g stroke='#fff' stroke-linecap='round' fill='none'>
      <g transform='translate(40 50)' stroke-opacity='.45' stroke-width='1.6'><path d='M0-12V12M-10.4-6L10.4 6M-10.4 6L10.4-6M0-12l-3-3M0-12l3-3M0 12l-3 3M0 12l3 3'/></g>
      <g transform='translate(170 120) scale(.7)' stroke-opacity='.35' stroke-width='1.6'><path d='M0-12V12M-10.4-6L10.4 6M-10.4 6L10.4-6'/></g>
      <g transform='translate(90 190) scale(1.2)' stroke-opacity='.3' stroke-width='1.4'><path d='M0-12V12M-10.4-6L10.4 6M-10.4 6L10.4-6M0-12l-3-3M0-12l3-3'/></g></g>
      <g fill='#fff'><circle cx='120' cy='30' r='1.6' opacity='.6'/><circle cx='210' cy='40' r='1.2' opacity='.5'/><circle cx='20' cy='130' r='1.4' opacity='.55'/>
      <circle cx='140' cy='210' r='1.8' opacity='.5'/><circle cx='220' cy='200' r='1.2' opacity='.5'/><circle cx='70' cy='110' r='1' opacity='.5'/></g></svg>`),
    lights: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='26'><path d='M0 6Q30 20 60 6T120 6' stroke='#2A3B2A' stroke-width='1.5' fill='none'/>
      <g><ellipse cx='16' cy='14' rx='3.6' ry='5' fill='#F4C542'/><ellipse cx='44' cy='15' rx='3.6' ry='5' fill='#E23B4E'/><ellipse cx='76' cy='14' rx='3.6' ry='5' fill='#5BC0EB'/><ellipse cx='104' cy='15' rx='3.6' ry='5' fill='#7ED957'/></g></svg>`),
    // Пиксельная вечеринка (2026-09-27): свои «тетрис»-фигуры из квадратов 8px,
    // вдохновлено пиксельной айдентикой, без чужих рисунков.
    pixels: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='264' height='264' shape-rendering='crispEdges'>
      <g fill='#E6FA50' opacity='.5'><rect x='24' y='32' width='8' height='8'/><rect x='32' y='32' width='8' height='8'/><rect x='32' y='40' width='8' height='8'/><rect x='40' y='40' width='8' height='8'/></g>
      <g fill='#F062C8' opacity='.45'><rect x='176' y='24' width='8' height='8'/><rect x='184' y='24' width='8' height='8'/><rect x='192' y='24' width='8' height='8'/><rect x='184' y='32' width='8' height='8'/></g>
      <g fill='#7FD8F7' opacity='.45'><rect x='112' y='120' width='8' height='8'/><rect x='112' y='128' width='8' height='8'/><rect x='112' y='136' width='8' height='8'/><rect x='120' y='136' width='8' height='8'/></g>
      <g fill='#8C74F6' opacity='.5'><rect x='216' y='176' width='8' height='8'/><rect x='224' y='176' width='8' height='8'/><rect x='216' y='184' width='8' height='8'/><rect x='224' y='184' width='8' height='8'/></g>
      <g fill='#F062C8' opacity='.35'><rect x='48' y='208' width='8' height='8'/><rect x='56' y='200' width='8' height='8'/><rect x='56' y='208' width='8' height='8'/><rect x='64' y='208' width='8' height='8'/></g>
      <g fill='#fff' opacity='.28'><rect x='88' y='64' width='4' height='4'/><rect x='240' y='96' width='4' height='4'/><rect x='152' y='232' width='4' height='4'/><rect x='16' y='144' width='4' height='4'/></g></svg>`),
    pixstrip: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='26' viewBox='0 0 120 26' shape-rendering='crispEdges'><rect x='0' y='14' width='10' height='10' fill='#E6FA50'/><rect x='10' y='14' width='10' height='10' fill='#E6FA50'/><rect x='10' y='4' width='10' height='10' fill='#E6FA50'/><rect x='32' y='14' width='10' height='10' fill='#F062C8'/><rect x='42' y='14' width='10' height='10' fill='#F062C8'/><rect x='42' y='4' width='10' height='10' fill='#F062C8'/><rect x='52' y='14' width='10' height='10' fill='#F062C8'/><rect x='66' y='14' width='10' height='10' fill='#7FD8F7'/><rect x='76' y='14' width='10' height='10' fill='#7FD8F7'/><rect x='86' y='14' width='10' height='10' fill='#7FD8F7'/><rect x='100' y='4' width='10' height='10' fill='#8C74F6'/><rect x='100' y='14' width='10' height='10' fill='#8C74F6'/><rect x='110' y='14' width='10' height='10' fill='#8C74F6'/></svg>`),
    map: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><g fill='none' stroke='#F2B84B' stroke-opacity='.16' stroke-width='1.6'>
      <path d='M10 200Q60 150 110 170T210 90' stroke-dasharray='6 7'/><path d='M200 70l14 14M214 70l-14 14'/>
      <circle cx='60' cy='60' r='18'/><path d='M60 36v48M36 60h48M60 42l4 18-4 18-4-18z'/></g></svg>`),
  };

  // Свои рисунки для New Year: ёлка с игрушками и подарок (data-URI, без файлов).
  const PIC = {
    tree: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='100' height='110' viewBox='0 0 100 110'>
      <rect x='44' y='90' width='12' height='14' rx='2' fill='#8A5A2B'/>
      <path d='M50 8L78 44H64L86 70H68L92 94H8L32 70H14L36 44H22Z' fill='#2F8F4E' stroke='#1E5E34' stroke-width='2' stroke-linejoin='round'/>
      <path d='M24 72Q50 84 76 70M30 48Q50 58 70 46' stroke='#F4C542' stroke-width='2' fill='none'/>
      <circle cx='40' cy='60' r='4' fill='#E23B4E'/><circle cx='62' cy='80' r='4.5' fill='#5BC0EB'/><circle cx='56' cy='38' r='3.5' fill='#F4C542'/><circle cx='30' cy='84' r='4' fill='#F4C542'/><circle cx='70' cy='58' r='3.5' fill='#E23B4E'/>
      <path d='M50 0L53 7L60 7L54 11L56 18L50 14L44 18L46 11L40 7L47 7Z' fill='#F4C542' stroke='#C9981C'/></svg>`),
    // Пиксельная звезда за пройденный шаг (iconImg сам оборачивает в url()).
    pixStarRaw: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='36' height='32' viewBox='0 0 36 32' shape-rendering='crispEdges'><rect x='16' y='0' width='4' height='4' fill='#E6FA50'/><rect x='16' y='4' width='4' height='4' fill='#E6FA50'/><rect x='12' y='8' width='4' height='4' fill='#E6FA50'/><rect x='16' y='8' width='4' height='4' fill='#E6FA50'/><rect x='20' y='8' width='4' height='4' fill='#E6FA50'/><rect x='0' y='12' width='4' height='4' fill='#E6FA50'/><rect x='4' y='12' width='4' height='4' fill='#E6FA50'/><rect x='8' y='12' width='4' height='4' fill='#E6FA50'/><rect x='12' y='12' width='4' height='4' fill='#E6FA50'/><rect x='16' y='12' width='4' height='4' fill='#E6FA50'/><rect x='20' y='12' width='4' height='4' fill='#E6FA50'/><rect x='24' y='12' width='4' height='4' fill='#E6FA50'/><rect x='28' y='12' width='4' height='4' fill='#E6FA50'/><rect x='32' y='12' width='4' height='4' fill='#E6FA50'/><rect x='4' y='16' width='4' height='4' fill='#E6FA50'/><rect x='8' y='16' width='4' height='4' fill='#E6FA50'/><rect x='12' y='16' width='4' height='4' fill='#E6FA50'/><rect x='16' y='16' width='4' height='4' fill='#E6FA50'/><rect x='20' y='16' width='4' height='4' fill='#E6FA50'/><rect x='24' y='16' width='4' height='4' fill='#E6FA50'/><rect x='28' y='16' width='4' height='4' fill='#E6FA50'/><rect x='8' y='20' width='4' height='4' fill='#E6FA50'/><rect x='12' y='20' width='4' height='4' fill='#E6FA50'/><rect x='16' y='20' width='4' height='4' fill='#E6FA50'/><rect x='20' y='20' width='4' height='4' fill='#E6FA50'/><rect x='24' y='20' width='4' height='4' fill='#E6FA50'/><rect x='8' y='24' width='4' height='4' fill='#E6FA50'/><rect x='12' y='24' width='4' height='4' fill='#E6FA50'/><rect x='20' y='24' width='4' height='4' fill='#E6FA50'/><rect x='24' y='24' width='4' height='4' fill='#E6FA50'/><rect x='4' y='28' width='4' height='4' fill='#E6FA50'/><rect x='8' y='28' width='4' height='4' fill='#E6FA50'/><rect x='24' y='28' width='4' height='4' fill='#E6FA50'/><rect x='28' y='28' width='4' height='4' fill='#E6FA50'/></svg>`).replace(/'/g, '%27'),
    // Пиксельная вечеринка: свои пиксель-арт курсор и вспышка.
    pixCursor: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='56' viewBox='0 0 40 56' shape-rendering='crispEdges'><rect x='0' y='0' width='4' height='4' fill='#0B1424'/><rect x='0' y='4' width='4' height='4' fill='#0B1424'/><rect x='4' y='4' width='4' height='4' fill='#0B1424'/><rect x='0' y='8' width='4' height='4' fill='#0B1424'/><rect x='8' y='8' width='4' height='4' fill='#0B1424'/><rect x='0' y='12' width='4' height='4' fill='#0B1424'/><rect x='12' y='12' width='4' height='4' fill='#0B1424'/><rect x='0' y='16' width='4' height='4' fill='#0B1424'/><rect x='16' y='16' width='4' height='4' fill='#0B1424'/><rect x='0' y='20' width='4' height='4' fill='#0B1424'/><rect x='20' y='20' width='4' height='4' fill='#0B1424'/><rect x='0' y='24' width='4' height='4' fill='#0B1424'/><rect x='24' y='24' width='4' height='4' fill='#0B1424'/><rect x='0' y='28' width='4' height='4' fill='#0B1424'/><rect x='28' y='28' width='4' height='4' fill='#0B1424'/><rect x='0' y='32' width='4' height='4' fill='#0B1424'/><rect x='20' y='32' width='4' height='4' fill='#0B1424'/><rect x='24' y='32' width='4' height='4' fill='#0B1424'/><rect x='28' y='32' width='4' height='4' fill='#0B1424'/><rect x='32' y='32' width='4' height='4' fill='#0B1424'/><rect x='0' y='36' width='4' height='4' fill='#0B1424'/><rect x='8' y='36' width='4' height='4' fill='#0B1424'/><rect x='20' y='36' width='4' height='4' fill='#0B1424'/><rect x='0' y='40' width='4' height='4' fill='#0B1424'/><rect x='4' y='40' width='4' height='4' fill='#0B1424'/><rect x='12' y='40' width='4' height='4' fill='#0B1424'/><rect x='24' y='40' width='4' height='4' fill='#0B1424'/><rect x='0' y='44' width='4' height='4' fill='#0B1424'/><rect x='16' y='44' width='4' height='4' fill='#0B1424'/><rect x='24' y='44' width='4' height='4' fill='#0B1424'/><rect x='16' y='48' width='4' height='4' fill='#0B1424'/><rect x='28' y='48' width='4' height='4' fill='#0B1424'/><rect x='20' y='52' width='4' height='4' fill='#0B1424'/><rect x='24' y='52' width='4' height='4' fill='#0B1424'/><rect x='4' y='8' width='4' height='4' fill='#7FD8F7'/><rect x='4' y='12' width='4' height='4' fill='#7FD8F7'/><rect x='8' y='12' width='4' height='4' fill='#7FD8F7'/><rect x='4' y='16' width='4' height='4' fill='#7FD8F7'/><rect x='8' y='16' width='4' height='4' fill='#7FD8F7'/><rect x='12' y='16' width='4' height='4' fill='#7FD8F7'/><rect x='4' y='20' width='4' height='4' fill='#7FD8F7'/><rect x='8' y='20' width='4' height='4' fill='#7FD8F7'/><rect x='12' y='20' width='4' height='4' fill='#7FD8F7'/><rect x='16' y='20' width='4' height='4' fill='#7FD8F7'/><rect x='4' y='24' width='4' height='4' fill='#7FD8F7'/><rect x='8' y='24' width='4' height='4' fill='#7FD8F7'/><rect x='12' y='24' width='4' height='4' fill='#7FD8F7'/><rect x='16' y='24' width='4' height='4' fill='#7FD8F7'/><rect x='20' y='24' width='4' height='4' fill='#7FD8F7'/><rect x='4' y='28' width='4' height='4' fill='#7FD8F7'/><rect x='8' y='28' width='4' height='4' fill='#7FD8F7'/><rect x='12' y='28' width='4' height='4' fill='#7FD8F7'/><rect x='16' y='28' width='4' height='4' fill='#7FD8F7'/><rect x='20' y='28' width='4' height='4' fill='#7FD8F7'/><rect x='24' y='28' width='4' height='4' fill='#7FD8F7'/><rect x='4' y='32' width='4' height='4' fill='#7FD8F7'/><rect x='8' y='32' width='4' height='4' fill='#7FD8F7'/><rect x='12' y='32' width='4' height='4' fill='#7FD8F7'/><rect x='16' y='32' width='4' height='4' fill='#7FD8F7'/><rect x='4' y='36' width='4' height='4' fill='#7FD8F7'/><rect x='12' y='36' width='4' height='4' fill='#7FD8F7'/><rect x='16' y='36' width='4' height='4' fill='#7FD8F7'/><rect x='16' y='40' width='4' height='4' fill='#7FD8F7'/><rect x='20' y='40' width='4' height='4' fill='#7FD8F7'/><rect x='20' y='44' width='4' height='4' fill='#7FD8F7'/><rect x='20' y='48' width='4' height='4' fill='#7FD8F7'/><rect x='24' y='48' width='4' height='4' fill='#7FD8F7'/></svg>`),
    pixDecor: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96' shape-rendering='crispEdges'><g transform='translate(8 6) scale(1.6)'><rect x='16' y='0' width='4' height='4' fill='#E6FA50'/><rect x='0' y='4' width='4' height='4' fill='#E6FA50'/><rect x='16' y='4' width='4' height='4' fill='#E6FA50'/><rect x='32' y='4' width='4' height='4' fill='#E6FA50'/><rect x='4' y='8' width='4' height='4' fill='#E6FA50'/><rect x='16' y='8' width='4' height='4' fill='#E6FA50'/><rect x='28' y='8' width='4' height='4' fill='#E6FA50'/><rect x='8' y='12' width='4' height='4' fill='#E6FA50'/><rect x='16' y='12' width='4' height='4' fill='#E6FA50'/><rect x='24' y='12' width='4' height='4' fill='#E6FA50'/><rect x='12' y='16' width='4' height='4' fill='#E6FA50'/><rect x='16' y='16' width='4' height='4' fill='#E6FA50'/><rect x='20' y='16' width='4' height='4' fill='#E6FA50'/><rect x='0' y='20' width='4' height='4' fill='#E6FA50'/><rect x='4' y='20' width='4' height='4' fill='#E6FA50'/><rect x='8' y='20' width='4' height='4' fill='#E6FA50'/><rect x='12' y='20' width='4' height='4' fill='#E6FA50'/><rect x='16' y='20' width='4' height='4' fill='#E6FA50'/><rect x='20' y='20' width='4' height='4' fill='#E6FA50'/><rect x='24' y='20' width='4' height='4' fill='#E6FA50'/><rect x='28' y='20' width='4' height='4' fill='#E6FA50'/><rect x='32' y='20' width='4' height='4' fill='#E6FA50'/><rect x='12' y='24' width='4' height='4' fill='#E6FA50'/><rect x='16' y='24' width='4' height='4' fill='#E6FA50'/><rect x='20' y='24' width='4' height='4' fill='#E6FA50'/><rect x='8' y='28' width='4' height='4' fill='#E6FA50'/><rect x='16' y='28' width='4' height='4' fill='#E6FA50'/><rect x='24' y='28' width='4' height='4' fill='#E6FA50'/><rect x='4' y='32' width='4' height='4' fill='#E6FA50'/><rect x='16' y='32' width='4' height='4' fill='#E6FA50'/><rect x='28' y='32' width='4' height='4' fill='#E6FA50'/><rect x='0' y='36' width='4' height='4' fill='#E6FA50'/><rect x='16' y='36' width='4' height='4' fill='#E6FA50'/><rect x='32' y='36' width='4' height='4' fill='#E6FA50'/><rect x='16' y='40' width='4' height='4' fill='#E6FA50'/></g><g transform='translate(52 34)'><rect x='0' y='0' width='4' height='4' fill='#0B1424'/><rect x='0' y='4' width='4' height='4' fill='#0B1424'/><rect x='4' y='4' width='4' height='4' fill='#0B1424'/><rect x='0' y='8' width='4' height='4' fill='#0B1424'/><rect x='8' y='8' width='4' height='4' fill='#0B1424'/><rect x='0' y='12' width='4' height='4' fill='#0B1424'/><rect x='12' y='12' width='4' height='4' fill='#0B1424'/><rect x='0' y='16' width='4' height='4' fill='#0B1424'/><rect x='16' y='16' width='4' height='4' fill='#0B1424'/><rect x='0' y='20' width='4' height='4' fill='#0B1424'/><rect x='20' y='20' width='4' height='4' fill='#0B1424'/><rect x='0' y='24' width='4' height='4' fill='#0B1424'/><rect x='24' y='24' width='4' height='4' fill='#0B1424'/><rect x='0' y='28' width='4' height='4' fill='#0B1424'/><rect x='28' y='28' width='4' height='4' fill='#0B1424'/><rect x='0' y='32' width='4' height='4' fill='#0B1424'/><rect x='20' y='32' width='4' height='4' fill='#0B1424'/><rect x='24' y='32' width='4' height='4' fill='#0B1424'/><rect x='28' y='32' width='4' height='4' fill='#0B1424'/><rect x='32' y='32' width='4' height='4' fill='#0B1424'/><rect x='0' y='36' width='4' height='4' fill='#0B1424'/><rect x='8' y='36' width='4' height='4' fill='#0B1424'/><rect x='20' y='36' width='4' height='4' fill='#0B1424'/><rect x='0' y='40' width='4' height='4' fill='#0B1424'/><rect x='4' y='40' width='4' height='4' fill='#0B1424'/><rect x='12' y='40' width='4' height='4' fill='#0B1424'/><rect x='24' y='40' width='4' height='4' fill='#0B1424'/><rect x='0' y='44' width='4' height='4' fill='#0B1424'/><rect x='16' y='44' width='4' height='4' fill='#0B1424'/><rect x='24' y='44' width='4' height='4' fill='#0B1424'/><rect x='16' y='48' width='4' height='4' fill='#0B1424'/><rect x='28' y='48' width='4' height='4' fill='#0B1424'/><rect x='20' y='52' width='4' height='4' fill='#0B1424'/><rect x='24' y='52' width='4' height='4' fill='#0B1424'/><rect x='4' y='8' width='4' height='4' fill='#F062C8'/><rect x='4' y='12' width='4' height='4' fill='#F062C8'/><rect x='8' y='12' width='4' height='4' fill='#F062C8'/><rect x='4' y='16' width='4' height='4' fill='#F062C8'/><rect x='8' y='16' width='4' height='4' fill='#F062C8'/><rect x='12' y='16' width='4' height='4' fill='#F062C8'/><rect x='4' y='20' width='4' height='4' fill='#F062C8'/><rect x='8' y='20' width='4' height='4' fill='#F062C8'/><rect x='12' y='20' width='4' height='4' fill='#F062C8'/><rect x='16' y='20' width='4' height='4' fill='#F062C8'/><rect x='4' y='24' width='4' height='4' fill='#F062C8'/><rect x='8' y='24' width='4' height='4' fill='#F062C8'/><rect x='12' y='24' width='4' height='4' fill='#F062C8'/><rect x='16' y='24' width='4' height='4' fill='#F062C8'/><rect x='20' y='24' width='4' height='4' fill='#F062C8'/><rect x='4' y='28' width='4' height='4' fill='#F062C8'/><rect x='8' y='28' width='4' height='4' fill='#F062C8'/><rect x='12' y='28' width='4' height='4' fill='#F062C8'/><rect x='16' y='28' width='4' height='4' fill='#F062C8'/><rect x='20' y='28' width='4' height='4' fill='#F062C8'/><rect x='24' y='28' width='4' height='4' fill='#F062C8'/><rect x='4' y='32' width='4' height='4' fill='#F062C8'/><rect x='8' y='32' width='4' height='4' fill='#F062C8'/><rect x='12' y='32' width='4' height='4' fill='#F062C8'/><rect x='16' y='32' width='4' height='4' fill='#F062C8'/><rect x='4' y='36' width='4' height='4' fill='#F062C8'/><rect x='12' y='36' width='4' height='4' fill='#F062C8'/><rect x='16' y='36' width='4' height='4' fill='#F062C8'/><rect x='16' y='40' width='4' height='4' fill='#F062C8'/><rect x='20' y='40' width='4' height='4' fill='#F062C8'/><rect x='20' y='44' width='4' height='4' fill='#F062C8'/><rect x='20' y='48' width='4' height='4' fill='#F062C8'/><rect x='24' y='48' width='4' height='4' fill='#F062C8'/></g></svg>`),
    gift: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'>
      <rect x='8' y='24' width='44' height='30' rx='3' fill='#E23B4E' stroke='#A81F31' stroke-width='2'/><rect x='5' y='16' width='50' height='10' rx='2' fill='#F05A6C' stroke='#A81F31' stroke-width='2'/>
      <rect x='26' y='16' width='8' height='38' fill='#F4C542'/><path d='M30 16Q18 2 14 12Q12 18 30 16Q42 18 46 12Q42 2 30 16Z' fill='#F4C542' stroke='#C9981C'/></svg>`),
  };

  const THEMES = [
    { id: '', name: 'Standard', ic: '◻️', hint: 'The clean TeachEd look' },
    { id: 'space', name: 'Space Mission', ic: '🚀', hint: 'Deep space, glowing capsules',
      bg: `${PAT.stars}, radial-gradient(ellipse at 15% 0%, rgba(92,98,255,.45), transparent 55%), radial-gradient(ellipse at 95% 100%, rgba(150,70,255,.35), transparent 50%), #0B1030`,
      head: '#0E1440', headInk: '#EAF0FF', headMuted: '#A7B2E0', surface: '#F2F6FF', paper: '#E8EFFF',
      line: 'rgba(124,247,255,.55)', glow: '0 0 0 1px rgba(124,247,255,.28), 0 0 26px rgba(124,247,255,.2)',
      accent: '#7CF7FF', accentInk: '#06121F', ink: '#101838', muted: '#46527F',
      font: "'Oswald','Arial Narrow',sans-serif", fontCase: 'uppercase', icon: '★', ifFont: "'Arial Narrow',Arial,sans-serif" },
    { id: 'gothic', name: 'Gothic Academy', ic: '🦇', hint: 'Dark mystery, parchment and stone',
      bg: `${PAT.web}, ${PAT.brick}, linear-gradient(180deg, #241B2E, #120E17)`,
      head: '#120E17', headInk: '#EDE6F5', headMuted: '#B3A6C2', surface: '#F4EFE6', paper: '#EFE9E1',
      line: '#6B5A7B', glow: '0 0 0 1px rgba(107,90,123,.4), 0 18px 40px -18px rgba(0,0,0,.75)',
      accent: '#C8B6FF', accentInk: '#1A1422', ink: '#1E1829', muted: '#5A4E6B',
      font: "'Playfair Display',Georgia,serif", fontCase: 'none', icon: '✦', ifFont: "Georgia,'Times New Roman',serif" },
    { id: 'magic', name: 'Magic School', ic: '🪄', hint: 'Candlelight, gold and spell books',
      bg: `${PAT.sparkle}, radial-gradient(ellipse at 50% -10%, rgba(232,193,90,.28), transparent 60%), linear-gradient(180deg, #221838, #120C22)`,
      head: '#1A1230', headInk: '#F7EBD0', headMuted: '#CDBB93', surface: '#F7EFDC', paper: '#F3E9D2',
      line: '#C9A24B', glow: '0 0 0 1px rgba(201,162,75,.4), 0 16px 36px -16px rgba(0,0,0,.65)',
      accent: '#E8C15A', accentInk: '#2A1C08', ink: '#2A1C12', muted: '#6A563A',
      font: "'Fraunces',Georgia,serif", fontCase: 'none', icon: '✧', ifFont: "Georgia,serif" },
    { id: 'cyber', name: 'Neon City', ic: '🌆', hint: 'Neon glow and techno grids',
      bg: `${PAT.grid}, radial-gradient(ellipse at 0% 100%, rgba(255,62,165,.35), transparent 55%), radial-gradient(ellipse at 100% 0%, rgba(0,229,255,.3), transparent 50%), #07070F`,
      head: '#0B0B18', headInk: '#F2F0FF', headMuted: '#A7A2D6', surface: '#F4F2FF', paper: '#EEEBFF',
      line: '#FF3EA5', glow: '0 0 0 1px rgba(255,62,165,.4), 0 0 24px rgba(0,229,255,.28)',
      accent: '#FF3EA5', accentInk: '#16000C', ink: '#14122A', muted: '#4F4A82',
      font: "'JetBrains Mono',ui-monospace,monospace", fontCase: 'uppercase', icon: '⚙', ifFont: "'Courier New',ui-monospace,monospace" },
    { id: 'halloween', name: 'Pumpkin Night', ic: '🎃', hint: 'Pumpkins, bats and an orange moon',
      bg: `${PAT.bats}, ${PAT.pumpkins}, radial-gradient(circle at 85% 12%, rgba(255,176,80,.45), transparent 16%), linear-gradient(180deg, #2A1438, #140A1C)`,
      head: '#160C1F', headInk: '#FFE9CF', headMuted: '#D9AE88', surface: '#FFF4E6', paper: '#FFEBD6',
      line: '#FF8A1F', glow: '0 0 0 1px rgba(255,138,31,.4), 0 16px 36px -14px rgba(0,0,0,.7)',
      accent: '#FF8A1F', accentInk: '#1A0F24', ink: '#2A1628', muted: '#6E4436',
      font: "'Caveat','Comic Sans MS',cursive", fontCase: 'none', fontScale: 1.25, icon: '🎃', ifFont: "'Comic Sans MS','Chalkboard SE',cursive",
      iconImg: '/img/themes/pumpkins/p14.png', decor: '/img/themes/pumpkins/p01.png', navPic: '/img/themes/pumpkins/p16.png' },
    { id: 'winter', name: 'New Year', ic: '🎄', hint: 'Snowflakes, fairy lights and presents',
      bg: `${PAT.snow}, radial-gradient(ellipse at 50% -20%, rgba(244,197,66,.28), transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(226,59,78,.22), transparent 50%), linear-gradient(180deg, #123055, #0A1B33)`,
      head: '#0B1E36', headInk: '#F2F7FF', headMuted: '#A9C0DD', surface: '#F7FBFF', paper: '#EAF3FF',
      line: '#D4AF37', glow: '0 0 0 1px rgba(212,175,55,.45), 0 0 22px rgba(244,197,66,.18)',
      accent: '#F4C542', accentInk: '#1B1A10', ink: '#12223A', muted: '#4A5E7A',
      font: "'Fraunces',Georgia,serif", fontCase: 'none', icon: '❄', ifFont: "Georgia,serif",
      decor: PIC.tree, navPic: PIC.gift, headLights: PAT.lights },
    { id: 'pixel', name: 'Pixel Party', ic: '👾', hint: 'Neon pixels, arcade energy',
      bg: `${PAT.pixels}, radial-gradient(ellipse at 0% 0%, rgba(240,98,200,.28), transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(127,216,247,.24), transparent 50%), #0A1220`,
      head: '#0B1424', headInk: '#F2F6FF', headMuted: '#A9B4CC', surface: '#FFFFFF', paper: '#F2F4FA',
      line: '#F062C8', glow: '0 0 0 2px rgba(230,250,80,.55), 6px 6px 0 rgba(140,116,246,.55)',
      accent: '#E6FA50', accentInk: '#0B1424', ink: '#0F1829', muted: '#4A5670',
      font: "'Silkscreen','JetBrains Mono',ui-monospace,monospace", fontCase: 'uppercase', icon: '▣', ifFont: "'Courier New',ui-monospace,monospace",
      decor: PIC.pixDecor, navPic: PIC.pixCursor, headLights: PAT.pixstrip, iconImg: PIC.pixStarRaw,
      // Аркадные кнопки: почти квадратные углы и неоновая «ступенька» вместо тени - без чёрных обводок.
      boardExtra: T => `
${T} .wp-btn{border-radius:6px !important;box-shadow:0 3px 0 rgba(140,116,246,.55) !important}
${T} .wp-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,116,246,.55) !important}
${T} .wp-step{border-radius:6px !important}
${T} .wp-step.on{box-shadow:0 3px 0 #F062C8 !important}
${T} .wp-title{letter-spacing:.06em}`,
      gameExtra: HI => `
${HI} button:not(:disabled),${HI} .btn{border-radius:8px !important;box-shadow:0 4px 0 rgba(140,116,246,.6) !important;transition:transform .08s,box-shadow .08s}
${HI} button:not(:disabled):active,${HI} .btn:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(140,116,246,.6) !important}
${HI} .card,${HI} .word-card,${HI} .final,${HI} .win-msg{border-radius:10px !important}` },
    { id: 'adventure', name: 'Treasure Hunt', ic: '🗺️', hint: 'Old maps, jungle and treasure',
      bg: `${PAT.map}, radial-gradient(ellipse at 20% 0%, rgba(242,184,75,.22), transparent 55%), linear-gradient(180deg, #25331F, #141C11)`,
      head: '#1A2417', headInk: '#F3EBD3', headMuted: '#C2B993', surface: '#F6EEDA', paper: '#F1E6C8',
      line: '#A8823E', glow: '0 0 0 1px rgba(168,130,62,.4), 0 16px 36px -16px rgba(0,0,0,.65)',
      accent: '#F2B84B', accentInk: '#22190A', ink: '#2B2215', muted: '#665737',
      font: "'Oswald','Arial Narrow',sans-serif", fontCase: 'uppercase', icon: '◆', ifFont: "'Arial Narrow',Arial,sans-serif" },
  ];
  const byId = id => THEMES.find(t => t.id === id && t.id) || null;

  /* ── доска: студии и карта урока ── */
  const pic = v => (String(v).startsWith('url(') ? v : `url('${v}')`);
  function boardCss(t) {
    const T = `.lt-${t.id}`;
    const fs = t.fontScale || 1;
    return `
${T}{--lt-bg:${t.bg};--lt-head:${t.head};--lt-head-ink:${t.headInk};--lt-head-muted:${t.headMuted};--lt-surface:${t.surface};--lt-paper:${t.paper};
  --lt-line:${t.line};--lt-glow:${t.glow};--lt-accent:${t.accent};--lt-accent-ink:${t.accentInk};--lt-ink:${t.ink};--lt-muted:${t.muted};--lt-font:${t.font};--lt-icon:'${t.icon}'}
.wp${T}{background:${t.head};color:${t.ink}}
${T} .wp-head,${T} .wp-nav{background:var(--lt-head);color:var(--lt-head-ink);border-top-color:rgba(255,255,255,.08)}
${T} .wp-title{font-family:var(--lt-font);text-transform:${t.fontCase};letter-spacing:${t.fontCase === 'uppercase' ? '.04em' : '0'};font-size:${Math.round(17 * fs)}px}
${T} .wp-kicker{color:var(--lt-accent)}
${T} .wp-step{color:var(--lt-head-muted)}
${T} .wp-step.studio:not(.on){color:var(--lt-accent)}
${T} .wp-step.on{background:var(--lt-surface);color:var(--lt-ink)}
${T} .wp-step.on i{background:var(--lt-accent);color:var(--lt-accent-ink)}
${T} .wp-step.done i{background:transparent;color:var(--lt-accent);font-size:0}
${T} .wp-step.done i::after{content:var(--lt-icon);font-size:13px}
${T} .wp-stage,${T} .wp-game{background:var(--lt-bg);background-size:auto,auto,auto,auto}
${T} .wp-where,${T} .wp-end{color:var(--lt-head-muted)}
${T} .wp-btn{background:rgba(255,255,255,.08);color:var(--lt-head-ink);border-color:rgba(255,255,255,.18)}
${T} .wp-btn:hover:not(:disabled){border-color:var(--lt-accent)}
${T} .wp-next,${T} .wp-next.to-studio{background:var(--lt-accent);color:var(--lt-accent-ink);border-color:var(--lt-accent)}
${T} .wp-away{color:var(--lt-head-ink)}
${T} .wts,${T} .vs,${T} .wp-ss{background:transparent}
${T} .wts-mat,${T} .wts-frame,${T} .vs-side,${T} .vs-card,${T} .ss-card,${T} .ss-acc,${T} .ss-clock,${T} .wp-cl-cell{background:var(--lt-surface);border:1px solid var(--lt-line);box-shadow:var(--lt-glow);color:var(--lt-ink)}
${T} .wts-mat-head b,${T} .vs-prog,${T} .ss-acc summary{color:var(--lt-muted)}
${T} .wts-tab,${T} .wts-show,${T} .ss-chip,${T} .ss-nav,${T} .ss-recs,${T} .ss-ghost,${T} .vs-say,${T} .vs-nav{background:var(--lt-surface);border-color:var(--lt-line);color:var(--lt-ink)}
${T} .wts-tab.on,${T} .ss-go,${T} .ss-chip.used,${T} .vs-modes .on{background:var(--lt-accent);border-color:var(--lt-accent);color:var(--lt-accent-ink)}
${T} .wts-tab.on i{background:var(--lt-accent-ink);color:var(--lt-accent)}
${T} .wts-tab i{background:var(--lt-paper)}
${T} .vs-dot{background:var(--lt-line)}${T} .vs-dot.known{background:var(--lt-accent)}${T} .vs-dot.on{background:var(--lt-ink)}
${T} .vs-round i,${T} .vs-opt{background:var(--lt-surface);color:var(--lt-ink)}${T} .vs-known:hover i,${T} .vs-known.on i{background:var(--lt-accent);border-color:var(--lt-accent);color:var(--lt-accent-ink)}${T} .vs-round{color:var(--lt-muted)}${T} .vs-ctx{background:var(--lt-paper);border-color:var(--lt-line)}${T} .vs-ctx p{color:var(--lt-ink)}
${T} .vs-word,${T} .ss-card h2,${T} .ss-card h3{font-family:var(--lt-font)}
${T} .vs-reveal{background:var(--lt-paper);border-color:var(--lt-line);color:var(--lt-ink)}
${T} .vs-bar i{background:var(--lt-accent)}
${T} .sc,${T} .mg{--lime:var(--lt-accent);--paper:var(--lt-paper);--ink:var(--lt-ink)}
${T} .sc-side,${T} .mg-side{background:var(--lt-surface)}
${T} .wts-video{background:#000}
/* карта урока */
.lf${T} .lf-bg{background:var(--lt-bg)}
.lf${T} .lf-title{font-family:var(--lt-font);text-transform:${t.fontCase};font-size:${Math.round(28 * fs)}px}
.lf${T} .lf-kicker,.lf${T} .lf-foot-k{color:var(--lt-accent)}
.lf${T} .lf-go{background:var(--lt-accent);color:var(--lt-accent-ink)}
.lf${T} .lf-node{background:var(--lt-surface);color:var(--lt-ink);box-shadow:var(--lt-glow),0 14px 34px rgba(0,0,0,.3)}
.lf${T} .lf-node.is-locked{background:color-mix(in srgb,var(--lt-surface) 60%,transparent)}
.lf${T} .lf-node.is-next{box-shadow:0 0 0 4px var(--lt-accent),0 16px 40px rgba(0,0,0,.3)}
.lf${T} .lf-node.is-done .lf-num{background:var(--lt-accent);color:var(--lt-accent-ink)}
.lf${T} .lf-name{font-family:var(--lt-font);text-transform:${t.fontCase}}
.lf${T} .lf-line path.on{stroke:var(--lt-accent)}
.lf${T} .lf-w.is-known{background:var(--lt-accent);color:var(--lt-accent-ink)}` + (t.iconImg ? `
${T} .wp-step.done i::after{content:'';display:inline-block;width:20px;height:20px;background:url('${t.iconImg}') center/contain no-repeat}
.lf${T} .lf-node.is-done .lf-num{font-size:0;background:url('${t.iconImg}') center/contain no-repeat transparent}` : '') + (t.decor ? `
.lf${T}::after{content:'';position:absolute;right:22px;bottom:16px;width:96px;height:96px;background:${pic(t.decor)} center/contain no-repeat;pointer-events:none;filter:drop-shadow(0 8px 14px rgba(0,0,0,.45))}
${T} .wp-head{position:relative}
${T} .wp-head::after{content:'';position:absolute;right:22px;bottom:6px;width:40px;height:40px;background:${pic(t.decor)} center/contain no-repeat;pointer-events:none;opacity:.95}` : '') + (t.navPic ? `
${T} .wp-nav{background:${pic(t.navPic)} 122px 50%/32px no-repeat,var(--lt-head)}` : '') + (t.headLights ? `
${T} .wp-head{background:${t.headLights} 0 100%/120px 26px repeat-x,var(--lt-head);padding-bottom:22px}
.lf${T} .lf-head{background:${t.headLights} 0 0/120px 26px repeat-x;padding-top:34px}` : '') + (t.boardExtra ? t.boardExtra(T) : '');
  }
  function ensureBoardCss() {
    if (document.getElementById('lt-skins')) return;
    const st = document.createElement('style');
    st.id = 'lt-skins';
    st.textContent = THEMES.filter(t => t.id).map(boardCss).join('\n');
    document.head.appendChild(st);
  }
  // Класс темы на корень студии / карты (и снятие прежнего).
  function apply(el, id) {
    if (!el) return;
    [...el.classList].filter(c => c.startsWith('lt-')).forEach(c => el.classList.remove(c));
    const t = byId(id);
    if (!t) return;
    ensureBoardCss();
    el.classList.add('lt-' + t.id);
  }

  /* ── лист в iframe (переменные worksheet-play.js) ── */
  function iframeCss(id) {
    const t = byId(id);
    if (!t) return '';
    return `:root{--ink:${t.ink};--lime:${t.accent};--paper:${t.paper};--panel:${t.surface};--olive:${t.muted};--line:color-mix(in srgb,${t.line} 35%,transparent);--line-2:color-mix(in srgb,${t.line} 60%,transparent)}
body{background:${t.paper}}
.iw-title,.iw-read-head,h1,h2{font-family:${t.ifFont}}
.iw-title{color:${t.muted}}`;
  }

  /* ── игра (games/*.html, тот же источник): фон темы, светлое игровое поле ──
     Счёт, раунд и счётчики (.hud, .top, .count…) у игр лежат прямо на фоне,
     и их тёмные чернила на тёмной теме пропадали (найдено прогоном 31 игры
     2026-09-27) - на теме они берут светлые headInk/headMuted. */
  const HI = 'html body:not(#lt1):not(#lt2):not(#lt3)';
  function gameCss(id) {
    const t = byId(id);
    if (!t) return '';
    return `${HI}{background:${t.bg} !important;background-attachment:fixed !important;color:${t.ink}}
/* Тот же файл выше говорит правду: тёмным остаётся только фон ВОКРУГ панелей,
   сами панели и игровые поля - светлые, с тёмными чернилами темы. body{color}
   тут стоит в t.ink (тёмные чернила), а не t.headInk - именно потому, что
   почти весь документ это светлые поверхности (карточки, кнопки, меню), и
   только ДВЕ полосы (.ww-top/.ww-bottom у новых игр-шаблонов Wordwall,
   games/ww/*.html) сидят прямо на тёмном фоне без своей подложки. Было
   наоборот (body красился в headInk), и всё, что не красит себя само -
   слово на карточке, заголовок колонки Group sort, определение в Match up,
   кнопки New task/Undo/Deal - гасло почти до невидимости на своих белых
   поверхностях (прогон 30.09.2026, «Цвета не видано»). SVG-иконки той же
   ценой чинятся даром: currentColor в ww.js следует за этим же наследованием. */
${HI} .ww-timer,${HI} .ww-center,${HI} .ww-score,${HI} .ww-nav>span,${HI} .ww-lives{color:${t.headInk} !important}
${HI} > h1,${HI} > .back,${HI} > .subtitle,${HI} > p,${HI} header h1,${HI} header p{color:${t.headInk} !important;font-family:${t.font} !important;text-transform:${t.fontCase};text-shadow:0 2px 14px rgba(0,0,0,.35)}
${HI} > .subtitle,${HI} > p{color:${t.headMuted} !important;text-transform:none;font-family:inherit !important}
${HI} .card,${HI} .final,${HI} .word-card,${HI} .win-msg{background:${t.surface} !important;border:1px solid ${t.line} !important;box-shadow:${t.glow} !important;color:${t.ink}}
${HI} .choice,${HI} .opt,${HI} .key{border-color:color-mix(in srgb,${t.line} 55%,transparent)}
${HI} .choice:hover,${HI} .opt:hover,${HI} .key:hover:not(:disabled){background:color-mix(in srgb,${t.accent} 30%,#fff) !important}
:root{--lime:${t.accent} !important;--accent:${t.ink} !important}
${HI} > :is(.hud,.top,.score-label,.count,.result),${HI} > :is(.hud,.top) *{color:${t.headMuted} !important}
${HI} > :is(.hud,.top) :is(span,b,strong),${HI} > :is(.hud,.top) [id]{color:${t.headInk} !important}
${HI} .back-link,${HI} > #wordList .wtag{color:${t.headInk} !important}` + (t.decor ? `
${HI}::after{content:'';position:absolute;right:12px;top:18px;width:58px;height:58px;background:${pic(t.decor)} center/contain no-repeat;pointer-events:none;z-index:5}` : '') + (t.headLights ? `
${HI}::before{content:'' !important;display:block !important;position:fixed;left:0;right:0;top:0;height:26px;background:${t.headLights} 0 0/120px 26px repeat-x;pointer-events:none;z-index:5}` : '') + (t.gameExtra ? t.gameExtra(HI) : '');
  }
  function skinGame(iframe, id) {
    const css = gameCss(id);
    if (!iframe) return;
    const put = () => {
      let doc;
      try { doc = iframe.contentDocument; } catch { return; }
      if (!doc || !doc.head) return;
      let st = doc.getElementById('lt-skin');
      if (!css) { st && st.remove(); return; }
      if (!st) {
        st = doc.createElement('style');
        st.id = 'lt-skin';
        doc.head.appendChild(st);
        // Шрифты тем - свои, с этого же сайта (styles/cover-fonts.css).
        if (!doc.getElementById('lt-fonts')) {
          const l = doc.createElement('link');
          l.id = 'lt-fonts'; l.rel = 'stylesheet'; l.href = '/styles/cover-fonts.css';
          doc.head.appendChild(l);
        }
      }
      st.textContent = css;
    };
    iframe.addEventListener('load', () => { put(); listenGame(iframe, id); });
    put();
    listenGame(iframe, id);
  }

  /* Звуки ответов в игре (scripts/lesson-sounds.js). Очки игры приходят
     сообщениями (teachedos-score / game-progress / game-finished); ошибку
     игры не сообщают, но почти все красят её классом wrong / incorrect -
     его и слушаем, как и correct / matched. До первого нажатия в игре не
     звучит ничего: отрисовка первого вопроса - не ответ. */
  const gameFrames = new WeakMap();
  function listenGame(iframe, id) {
    if (!window.TeachedSounds) return;
    let doc;
    try { doc = iframe.contentDocument; } catch { return; }
    const rec = gameFrames.get(iframe) || { score: 0 };
    rec.theme = id;
    gameFrames.set(iframe, rec);
    if (!doc || !doc.body || doc.__ltObs || !id) return;
    doc.__ltObs = true;
    let armed = false;
    const arm = () => { armed = true; };
    doc.addEventListener('pointerdown', arm, true);
    doc.addEventListener('keydown', arm, true);
    const BAD = /(^|[\s_-])(wrong|incorrect|error|miss|bad|fail)/i, GOOD = /(^|[\s_-])(correct|right|matched|success|ok|found)(?![a-z])/i;
    new MutationObserver(list => {
      if (!armed || !rec.theme) return;
      for (const m of list) {
        if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
        const now = m.target.className && typeof m.target.className === 'string' ? m.target.className : '';
        const was = m.oldValue || '';
        if (BAD.test(now) && !BAD.test(was)) { window.TeachedSounds.fx('wrong', rec.theme); return; }
        if (GOOD.test(now) && !GOOD.test(was)) { window.TeachedSounds.fx('correct', rec.theme); return; }
      }
    }).observe(doc.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  }
  window.addEventListener('message', e => {
    const m = e.data;
    if (!m || typeof m !== 'object' || !window.TeachedSounds) return;
    const f = [...document.querySelectorAll('iframe')].find(x => x.contentWindow === e.source);
    const rec = f && gameFrames.get(f);
    if (!rec || !rec.theme) return;
    if (m.type === 'game-finished') window.TeachedSounds.fx('finish', rec.theme);
    else if ((m.type === 'teachedos-score' || m.type === 'game-progress') && typeof m.score === 'number') {
      if (m.score > rec.score) window.TeachedSounds.fx('correct', rec.theme);
      rec.score = m.score;
    }
  });

  /* ── выбор темы: всплывающее меню у кнопки ── */
  function picker(anchor, current, onPick) {
    document.getElementById('lt-pick')?.remove();
    const pop = document.createElement('div');
    pop.id = 'lt-pick';
    pop.className = 'lt-pick';
    pop.innerHTML = `<div class="lt-pick-h">Theme / Vibe <small>how the lesson looks for students</small></div>
      ${THEMES.map(t => `<button type="button" class="lt-pick-o${(current || '') === t.id ? ' on' : ''}" data-t="${t.id}">
        <span class="lt-sw" style="${t.id ? `background:${t.bg};background-size:auto` : 'background:#F6F6EF'}"><i style="background:${t.id ? t.surface : '#fff'};box-shadow:${t.id ? `0 0 0 1px ${t.line}` : '0 0 0 1px rgba(36,40,44,.12)'}"></i><b style="background:${t.id ? t.accent : '#CDF649'}"></b></span>
        <span class="lt-pick-t"><b>${t.ic} ${t.name}</b><small>${t.hint}</small></span></button>`).join('')}`;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const w = 300;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
    const h = pop.offsetHeight;
    pop.style.top = (r.bottom + 8 + h > window.innerHeight ? Math.max(8, r.top - h - 8) : r.bottom + 8) + 'px';
    const close = () => { pop.remove(); document.removeEventListener('mousedown', out, true); };
    const out = e => { if (!pop.contains(e.target) && e.target !== anchor) close(); };
    setTimeout(() => document.addEventListener('mousedown', out, true), 0);
    pop.addEventListener('mousedown', e => e.stopPropagation());
    pop.addEventListener('click', e => {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      close();
      onPick(b.dataset.t);
    });
  }
  // Небольшая сетка выбора прямо в форме (карта урока, мастер Picture Studio).
  function gridHtml(current, name) {
    return `<div class="lt-grid" data-name="${name || 'theme'}">${THEMES.map(t => `<button type="button" class="lt-grid-o${(current || '') === t.id ? ' on' : ''}" data-t="${t.id}" title="${t.hint}">
      <span class="lt-sw" style="${t.id ? `background:${t.bg};background-size:auto` : 'background:#F6F6EF'}"><i style="background:${t.id ? t.surface : '#fff'}"></i><b style="background:${t.id ? t.accent : '#CDF649'}"></b></span>
      <small>${t.ic} ${t.name}</small></button>`).join('')}</div>`;
  }
  function bindGrid(root, onPick) {
    root.querySelectorAll('.lt-grid-o').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('.lt-grid-o').forEach(x => x.classList.toggle('on', x === b));
      onPick(b.dataset.t);
    }));
  }

  window.TeachedThemes = { list: THEMES, get: byId, apply, iframeCss, gameCss, skinGame, picker, gridHtml, bindGrid, ensureBoardCss };
})();
