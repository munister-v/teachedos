'use strict';

/* The Azure adapter (ТЗ §22, §8): the weakest sound first, prosody only for en-US, the key on the server, and
   null - never an exception - when Azure is missing or fails. */

const test = require('node:test');
const assert = require('node:assert/strict');
const azure = require('../lib/speaking/azure');
const { soundCard } = require('../lib/speaking/sounds');

const reply = body => ({ ok: true, json: async () => body, arrayBuffer: async () => Buffer.from('mp3') });
test.afterEach(() => { azure.setFetch(null); delete process.env.AZURE_SPEECH_KEY; delete process.env.AZURE_SPEECH_REGION; });

test('without a key both calls return null and nothing is sent', async () => {
  let called = 0; azure.setFetch(async () => { called++; return reply({}); });
  assert.equal(await azure.assess(Buffer.from('x'), 'hello', 'en-US'), null);
  assert.equal(await azure.speak('hello', 'en-US'), null);
  assert.equal(called, 0);
});

test('assess: phonemes under 60 are issues, the weakest comes first, prosody only for en-US, the key is a header', async () => {
  process.env.AZURE_SPEECH_KEY = 'k'; process.env.AZURE_SPEECH_REGION = 'westeurope';
  let seen;
  azure.setFetch(async (url, o) => { seen = { url, o }; return reply({ NBest: [{ PronunciationAssessment: { AccuracyScore: 80, FluencyScore: 85, ProsodyScore: 70 },
    Words: [{ Word: 'ship', PronunciationAssessment: { ErrorType: 'Mispronunciation' }, Phonemes: [{ Phoneme: 'ʃ', PronunciationAssessment: { AccuracyScore: 40 } }, { Phoneme: 'ɪ', PronunciationAssessment: { AccuracyScore: 20 } }, { Phoneme: 'p', PronunciationAssessment: { AccuracyScore: 90 } }] }] }] }); });
  const us = await azure.assess(Buffer.from('x'), 'ship', 'en-US');
  assert.deepEqual(us.issues.map(i => i.phoneme), ['ɪ', 'ʃ']);
  assert.equal(azure.weakestSound(us).phoneme, 'ɪ'); assert.equal(us.prosody, 70);
  assert.match(seen.url, /westeurope\.stt\.speech\.microsoft\.com/); assert.equal(seen.o.headers['Ocp-Apim-Subscription-Key'], 'k');
  assert.equal(JSON.parse(Buffer.from(seen.o.headers['Pronunciation-Assessment'], 'base64').toString()).EnableProsodyAssessment, true);
  const gb = await azure.assess(Buffer.from('x'), 'ship', 'en-GB');
  assert.equal(gb.prosody, undefined, 'no invented prosody for en-GB');
});

test('an Azure error or a network failure is a null, so the session goes on', async () => {
  process.env.AZURE_SPEECH_KEY = 'k'; process.env.AZURE_SPEECH_REGION = 'westeurope';
  azure.setFetch(async () => ({ ok: false, status: 500 }));
  assert.equal(await azure.assess(Buffer.from('x'), 'a', 'en-US'), null);
  azure.setFetch(async () => { throw new Error('down'); });
  assert.equal(await azure.assess(Buffer.from('x'), 'a', 'en-US'), null);
  assert.equal(await azure.speak('a', 'en-GB'), null);
});

test('speak: a neural voice of the accent; the text is escaped in the SSML', async () => {
  process.env.AZURE_SPEECH_KEY = 'k'; process.env.AZURE_SPEECH_REGION = 'westeurope';
  let body; azure.setFetch(async (u, o) => { body = o.body; return reply({}); });
  const out = await azure.speak('Tom & "Jerry" <3', 'en-GB');
  assert.equal(out.mime, 'audio/mpeg');
  assert.match(body, /en-GB-RyanNeural/); assert.match(body, /Tom &amp; &quot;Jerry&quot; &lt;3/);
});

test('the sound card: a known sound has how and three minimal pairs; an unknown one is a plain generic card; the accent tip for r', () => {
  const c = soundCard('ship', '/ʃ/', 'en-US');
  assert.equal(c.found, true); assert.equal(c.pairs.length, 3); assert.deepEqual(c.pairs[0], { a: 'ship', b: 'sheep' });
  assert.equal(soundCard('car', 'ɹ', 'en-GB').tip.includes('silent'), true);
  assert.equal(soundCard('x', 'zz').found, false);
});
