/* TeachEd in-browser speech-to-text for Teacher Tools.
   Lazy-loads Whisper (via @xenova/transformers) only when a teacher uploads
   an audio/video file, and exposes it as window._ttSTT. Fully local — no API
   key, no upload to a server. Mirrors the WebLLM engine in teacher-tool-ai.js. */

const STT_MODEL_ID = 'Xenova/whisper-tiny.en';
let _transcriber = null, _transcriberPromise = null;

async function _loadTranscriber(onProgress) {
  if (_transcriber) return _transcriber;
  if (_transcriberPromise) { _transcriber = await _transcriberPromise; return _transcriber; }
  const { pipeline, env } = await import(
    'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'
  );
  // Use the bundled WASM/remote weights; allow remote model download once.
  env.allowLocalModels = false;
  _transcriberPromise = pipeline('automatic-speech-recognition', STT_MODEL_ID, {
    progress_callback: (p) => {
      if (!p) return;
      const pct = p.progress != null ? p.progress / 100 : 0;
      onProgress?.(p.status === 'progress' ? `Loading model… ${Math.round(p.progress || 0)}%` : (p.status || 'Loading model…'), pct);
    },
  });
  _transcriber = await _transcriberPromise;
  return _transcriber;
}

// Decode an audio/video file to mono 16 kHz Float32 samples for Whisper.
async function _fileToSamples(file) {
  const arrayBuf = await file.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  // Forcing a 16 kHz context makes decodeAudioData resample for us.
  const ctx = new Ctx({ sampleRate: 16000 });
  let audioBuf;
  try {
    audioBuf = await ctx.decodeAudioData(arrayBuf);
  } finally {
    ctx.close?.();
  }
  if (audioBuf.numberOfChannels === 1) return audioBuf.getChannelData(0);
  // Mix down to mono.
  const a = audioBuf.getChannelData(0), b = audioBuf.getChannelData(1);
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) / 2;
  return out;
}

window._ttSTT = {
  supported: () => typeof (window.AudioContext || window.webkitAudioContext) === 'function',
  transcribe: async function (file, onProgress) {
    if (!file) return null;
    onProgress?.('Reading audio…', 0);
    const samples = await _fileToSamples(file);
    const transcriber = await _loadTranscriber(onProgress);
    onProgress?.('Transcribing…', 1);
    const out = await transcriber(samples, { chunk_length_s: 30, stride_length_s: 5 });
    return (out && (Array.isArray(out) ? out.map(x => x.text).join(' ') : out.text) || '').trim();
  },
};
