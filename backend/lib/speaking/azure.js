/* Azure AI Speech behind the platform's own adapters (ТЗ §22): pronunciation assessment of the shadowing repeat and
   the neural voice for Tich's questions and etalons. The key lives on the backend only. With no key, or when Azure
   answers with an error, both return null - the session goes on and the student sees no failure (§8). */

const keyOf = () => ({ key: process.env.AZURE_SPEECH_KEY || '', region: process.env.AZURE_SPEECH_REGION || '' });
const enabled = () => { const c = keyOf(); return !!(c.key && c.region); };
const VOICES = { 'en-US': process.env.SPEAKING_VOICE_US || 'en-US-AndrewNeural', 'en-GB': process.env.SPEAKING_VOICE_GB || 'en-GB-RyanNeural' };
let fetchImpl = null;                      // tests swap it
const doFetch = (...a) => (fetchImpl || fetch)(...a);
const setFetch = f => { fetchImpl = f; };

const b64 = s => Buffer.from(s, 'ascii').toString('base64');
const xmlEsc = t => String(t).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const TIMEOUT_MS = 8000;
const withTimeout = async (url, opts) => {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try { return await doFetch(url, { ...opts, signal: ctrl.signal }); } finally { clearTimeout(t); }
};

/* assess(wavBuffer, referenceText, locale) -> { accuracy, fluency, prosody?, issues[] } | null  (16 kHz mono PCM WAV) */
async function assess(audio, referenceText, locale = 'en-US') {
  const c = keyOf();
  if (!enabled() || !audio || !audio.length || !referenceText) return null;
  const params = { ReferenceText: referenceText, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive',
    EnableMiscue: true, EnableProsodyAssessment: locale === 'en-US', PhonemeAlphabet: 'IPA' };
  try {
    const res = await withTimeout(`https://${c.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${locale}&format=detailed`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': c.key, 'Pronunciation-Assessment': b64(JSON.stringify(params)),
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', Accept: 'application/json' },
      body: audio,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const best = json.NBest && json.NBest[0];
    if (!best) return null;
    const issues = [];
    for (const w of best.Words || []) for (const p of w.Phonemes || []) {
      const score = p.PronunciationAssessment && p.PronunciationAssessment.AccuracyScore;
      if (score !== undefined && score < 60) issues.push({ word: w.Word, phoneme: p.Phoneme, score, errorType: (w.PronunciationAssessment && w.PronunciationAssessment.ErrorType) || 'Mispronunciation' });
    }
    issues.sort((a, b) => a.score - b.score);                    // the weakest first: the student sees exactly ONE
    const pa = best.PronunciationAssessment || {};
    return { accuracy: pa.AccuracyScore || 0, fluency: pa.FluencyScore || 0, prosody: locale === 'en-US' ? pa.ProsodyScore : undefined, issues };
  } catch (_) { return null; }
}

/* speak(text, locale) -> { mime, buffer } | null - a neural voice; the browser's own synthesis is not used anywhere */
async function speak(text, locale = 'en-US') {
  const c = keyOf();
  if (!enabled() || !text) return null;
  const voice = VOICES[locale] || VOICES['en-US'];
  const ssml = `<speak version="1.0" xml:lang="${locale}"><voice name="${voice}"><prosody rate="-5%">${xmlEsc(String(text).slice(0, 600))}</prosody></voice></speak>`;
  try {
    const res = await withTimeout(`https://${c.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': c.key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'TeachEd' },
      body: ssml,
    });
    if (!res.ok) return null;
    return { mime: 'audio/mpeg', buffer: Buffer.from(await res.arrayBuffer()) };
  } catch (_) { return null; }
}

const weakestSound = r => (r && r.issues && r.issues[0]) || null;

module.exports = { enabled, assess, speak, weakestSound, setFetch, VOICES };
