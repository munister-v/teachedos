'use strict';

/* Субтитры YouTube → текст для урока. Отдельно от маршрута, чтобы разбор
   проверялся тестом (tests/transcript.test.js): формат субтитров YouTube
   уже раз поменялся молча, и транскрипт склеивался в одну строку. */

function decodeEntities(t) {
  return String(t)
    .replace(/&amp;#39;|&#39;/g, "'").replace(/&amp;quot;|&quot;/g, '"')
    .replace(/&amp;amp;|&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    /* Шестнадцатеричные мнемоники - половина живых страниц пишет апостроф
       именно так, и без этой строки он доезжал до учителя как «&#x27;»
       прямо в тексте урока. */
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
/* Два формата субтитров. Старый: <text start="12.6" dur="1.3">…</text> (секунды).
   Нынешний, который отдаёт клиент ANDROID: <timedtext format="3"> с
   <p t="12645" d="1370">…</p> в миллисекундах, а у автоматических дорожек -
   ещё и слова в <s>. Разбор знал только старый: сегментов не находилось, и
   транскрипт склеивался из голого XML в одну строку, а выбор отрезка видео
   (start/end) молча отдавал всё видео целиком. */
function captionSegments(xml) {
  const out = [];
  const src = String(xml || '');
  const push = (start, dur, raw) => {
    const text = decodeEntities(String(raw).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (text && Number.isFinite(start)) out.push({ start, dur: Number.isFinite(dur) ? dur : 0, text });
  };
  let match;
  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  while ((match = re.exec(src))) {
    push(Number((match[1].match(/\bstart="([\d.]+)"/) || [])[1]), Number((match[1].match(/\bdur="([\d.]+)"/) || [])[1] || 0), match[2]);
  }
  if (out.length) return out;
  const re3 = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
  while ((match = re3.exec(src))) {
    const t = Number((match[1].match(/\bt="(\d+)"/) || [])[1]);
    const d = Number((match[1].match(/\bd="(\d+)"/) || [])[1] || 0);
    push(t / 1000, d / 1000, match[2]);
  }
  return out;
}
/* Читаемый транскрипт. Субтитры приходят сотнями строк по 2-3 секунды, а
   автоматические - ещё и без знаков препинания; склеенные пробелом, они
   давали в урок один абзац на несколько тысяч слов. Абзац закрываем на
   паузе в речи (или на конце предложения), когда он уже набрал длину, и
   принудительно - когда стал слишком длинным. Служебные метки «[Music]»
   убираем, первую букву абзаца делаем заглавной. */
function readableTranscript(segments) {
  const paras = [];
  let cur = [], words = 0;
  const flush = () => {
    let t = cur.join(' ').replace(/\s+/g, ' ').trim();
    if (t) paras.push(t.charAt(0).toUpperCase() + t.slice(1));
    cur = []; words = 0;
  };
  segments.forEach((seg, i) => {
    const text = String(seg.text || '').replace(/[\[(](?:music|applause|laughter|inaudible|cheering|__)[\])]/gi, ' ').replace(/^>>\s*/, '').trim();
    if (!text) return;
    cur.push(text);
    words += text.split(/\s+/).length;
    const next = segments[i + 1];
    const gap = next ? next.start - (seg.start + (seg.dur || 0)) : 0;
    const sentenceEnd = /[.!?]["')\]]?$/.test(text);
    const speakerChange = next && /^>>/.test(String(next.text || ''));
    if (words >= 120 || (words >= 45 && (gap > 1.2 || sentenceEnd || speakerChange)) || (words >= 25 && gap > 2.5)) flush();
  });
  flush();
  return paras;
}

module.exports = { decodeEntities, captionSegments, readableTranscript };
