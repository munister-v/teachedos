'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { captionSegments, readableTranscript } = require('../lib/transcript');

test('captions in format 3 (<p t d>, milliseconds) become timed segments', () => {
  const xml = `<?xml version="1.0" encoding="utf-8" ?><timedtext format="3"><body>
<p t="12645" d="1370">So in college,</p>
<p t="15349" d="1564">I was a government &amp;#39;major&amp;#39;,</p>
<p t="16937" d="2462"><s>which</s><s> means</s></p>
</body></timedtext>`;
  const segs = captionSegments(xml);
  assert.equal(segs.length, 3);
  assert.deepEqual(segs[0], { start: 12.645, dur: 1.37, text: 'So in college,' });
  assert.equal(segs[1].text, "I was a government 'major',");
  assert.equal(segs[2].text, 'which means');
});

test('the old <text start dur> format still parses', () => {
  const segs = captionSegments('<transcript><text start="1.5" dur="2">Hello &amp; welcome</text></transcript>');
  assert.deepEqual(segs, [{ start: 1.5, dur: 2, text: 'Hello & welcome' }]);
});

test('a long talk becomes paragraphs, not one line', () => {
  const segs = [];
  let t = 0;
  for (let i = 0; i < 80; i++) {
    segs.push({ start: t, dur: 2, text: (i === 0 ? '[Music] ' : '') + `this is line ${i} of the talk` + (i % 10 === 9 ? '.' : '') });
    t += i % 15 === 14 ? 4 : 2;
  }
  const paras = readableTranscript(segs);
  assert.ok(paras.length >= 4, `expected paragraphs, got ${paras.length}`);
  paras.forEach(p => assert.ok(p.split(/\s+/).length <= 130));
  assert.match(paras[0], /^This is line 0/);
  assert.doesNotMatch(paras.join(' '), /\[Music\]/);
});
