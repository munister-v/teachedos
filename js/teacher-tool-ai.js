/* TeachEd in-browser AI for Teacher Tools.
   Lazy-loads WebLLM only when a pilot tool asks for generation and
   exposes the generator as window._ttAI for the board builder. */

const MODEL_ID = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
let _engine = null, _enginePromise = null;

async function _loadEngine(onProgress) {
  if (_engine) return _engine;
  if (_enginePromise) { _engine = await _enginePromise; return _engine; }
  const { CreateMLCEngine } = await import(
    'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm'
  );
  _enginePromise = CreateMLCEngine(MODEL_ID, {
    initProgressCallback: p => onProgress?.(p.text, p.progress ?? 0),
  });
  _engine = await _enginePromise;
  return _engine;
}

const _PROMPTS = {
  'abcd-text': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} multiple-choice comprehension questions at ${i.level} level from the text. Each question has 4 options (A B C D) and one correct answer. Topic: ${i.topic}.\nReturn ONLY a JSON array — no extra text:\n[{"text":"question","options":["option A","option B","option C","option D"],"answer":"correct option text"}]\n\nText:\n"""${i.source}"""`,
  'true-false': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} True/False statements at ${i.level} level based on the text. Alternate true and false. For false statements make one factual change. Topic: ${i.topic}.\nReturn ONLY a JSON array:\n[{"text":"statement","answer":true}]\n\nText:\n"""${i.source}"""`,
  'extract-vocab': (i) =>
    `You are an EFL teacher. Extract exactly ${i.count} key vocabulary items at ${i.level} level from the text. For each: the word, a one-sentence student-friendly definition, and a short example from the text. Topic: ${i.topic}.\nReturn ONLY a JSON array:\n[{"word":"word","definition":"short definition","example":"example sentence"}]\n\nText:\n"""${i.source}"""`,
  'gap': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} gap-fill sentences at ${i.level} level from the text. Use "_____" for the missing word. Provide the exact missing word as answer. Topic: ${i.topic}.\nReturn ONLY a JSON array:\n[{"text":"sentence with _____","answer":"missing word"}]\n\nText:\n"""${i.source}"""`,
  'open-questions': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} open-ended discussion questions at ${i.level} level for the text. Questions should encourage critical thinking and personal response. Topic: ${i.topic}.\nReturn ONLY a JSON array:\n[{"text":"question?"}]\n\nText:\n"""${i.source}"""`,
  'gaps-abcd': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} multiple-choice gap-fill sentences at ${i.level} level from the text. Each has one blank and 4 options, one correct. Topic: ${i.topic}.\nReturn ONLY a JSON array:\n[{"text":"sentence with _____","options":["A","B","C","D"],"answer":"correct option text"}]\n\nText:\n"""${i.source}"""`,
  'word-definition-match': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} word-definition pairs at ${i.level} level from the text. Right side: a short student-friendly definition (max 15 words). Topic: ${i.topic}.\nReturn ONLY a JSON array:\n[{"word":"word","definition":"short definition"}]\n\nText:\n"""${i.source}"""`,
  'error-correction': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} error-correction sentences at ${i.level} level based on the text. Each has one grammar or vocabulary mistake. Topic: ${i.topic}.\nReturn ONLY a JSON array:\n[{"text":"Find and correct the mistake: \\"sentence with error\\"","answer":"corrected sentence"}]\n\nText:\n"""${i.source}"""`,
  'three-titles': (i) =>
    `You are an EFL teacher. Suggest exactly 3 engaging titles for a reading text about "${i.topic}" at ${i.level} level. Titles should be catchy, different in style.\nReturn ONLY a JSON array:\n[{"title":"Title text"}]`,
  'summary-task': (i) =>
    `You are an EFL teacher. Write a clear ${i.level}-level summary of the text in 3-4 sentences. Topic: ${i.topic}.\nReturn ONLY a JSON array with one item:\n[{"text":"summary"}]\n\nText:\n"""${i.source}"""`,
  'dialogue': (i) =>
    `You are an EFL teacher. Write a short natural dialogue between two people (Speaker A and B) about "${i.topic}" at ${i.level} level. ${Math.max(4,i.count)} turns total. Target vocab: ${i.vocab||'none'}.\nReturn ONLY a JSON array:\n[{"speaker":"A","line":"..."},{"speaker":"B","line":"..."}]`,
  'essential-vocab': (i) =>
    `You are an EFL teacher. List exactly ${i.count} essential vocabulary items for ${i.level} students learning about "${i.topic}". For each give the word, a clear one-sentence definition, and a natural example sentence.\nReturn ONLY a JSON array:\n[{"word":"word","definition":"one sentence","example":"example sentence"}]`,
  'flashcards': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} flashcard entries for ${i.level} students on the topic "${i.topic}". Each card: front=word, back=definition + example.\nReturn ONLY a JSON array:\n[{"word":"word","definition":"definition","example":"example"}]`,
  'sentences-vocab': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} sentence-completion prompts at ${i.level} level using these words: ${i.vocab||i.topic}. Students must write a full sentence.\nReturn ONLY a JSON array:\n[{"text":"Write a sentence using: \\"word\\""}]`,
  'odd-one-out': (i) =>
    `You are an EFL teacher. Create exactly ${Math.ceil(i.count/1)} odd-one-out groups at ${i.level} level about "${i.topic}". Each group has 4 words, one doesn't fit. Explain why.\nReturn ONLY a JSON array:\n[{"words":["A","B","C","D"],"odd":"D","reason":"because..."}]`,
  'word-sorting': (i) =>
    `You are an EFL teacher. Create a word-sorting task at ${i.level} level for "${i.topic}". Provide ${i.count} words and 2-3 category names. Students decide which word goes where.\nReturn ONLY a JSON array of words with categories:\n[{"word":"word","category":"Category A"}]`,
  'gaps-brackets': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} gap-fill sentences at ${i.level} level where the student must use the word in brackets in the correct grammatical form. Topic: ${i.topic}.\nReturn ONLY a JSON array:\n[{"text":"sentence with _____  (WORD)","answer":"correct form"}]\n\nText:\n"""${i.source}"""`,
  'two-options': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} two-option grammar sentences at ${i.level} level. Each has a blank and exactly 2 options (A or B). Topic: ${i.topic}.\nReturn ONLY a JSON array:\n[{"text":"sentence with _____","options":["A","B"],"answer":"A"}]\n\nText:\n"""${i.source}"""`,
  'gist-detail': (i) =>
    `You are an EFL teacher. Create one gist question (MCQ, 4 options) and ${i.count-1} detail questions (open) at ${i.level} level for the text. Topic: ${i.topic}.\nReturn ONLY a JSON array with mixed types:\n[{"type":"mcq","text":"...","options":["A","B","C","D"],"answer":"A"},{"type":"open","text":"..."}]\n\nText:\n"""${i.source}"""`,
  'discussion': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} discussion questions at ${i.level} level for speaking practice. Questions should encourage personal opinions and real-life connections. Topic: ${i.topic}.\nReturn ONLY a JSON array:\n[{"text":"question?"}]`,
  'question-ladder': (i) =>
    `You are an EFL teacher. Create a question ladder with ${i.count} questions about "${i.topic}" at ${i.level} level. Progress from factual (level 1) to evaluative/personal (level 5). Label each level.\nReturn ONLY a JSON array:\n[{"level":1,"text":"Factual question?"}]`,
  'roleplay-cards': (i) =>
    `You are an EFL teacher. Create a role-play task at ${i.level} level about "${i.topic}". Provide Role A instructions, Role B instructions, and useful language phrases. Vocab: ${i.vocab||'any'}.\nReturn ONLY a JSON array:\n[{"speaker":"Role A","line":"instructions..."},{"speaker":"Role B","line":"instructions..."},{"speaker":"Useful language","line":"phrases..."}]`,
  'debate-cards': (i) =>
    `You are an EFL teacher. Create debate argument cards at ${i.level} level for the topic "${i.topic}". Provide 3 FOR arguments, 3 AGAINST arguments, and a discussion question.\nReturn ONLY a JSON array:\n[{"side":"FOR","point":"argument"},{"side":"AGAINST","point":"argument"},{"side":"Discussion","point":"question?"}]`,
  'simplify-text': (i) =>
    `You are an EFL teacher. Rewrite the text below at ${i.level} level. Use simpler vocabulary and shorter sentences. Keep the main ideas. Topic: ${i.topic}.\nReturn ONLY a JSON array with one item:\n[{"text":"simplified text here"}]\n\nText:\n"""${i.source}"""`,
  'text-topic-vocab': (i) =>
    `You are an EFL teacher. Write a short reading text at ${i.level} level about "${i.topic}" that uses these vocabulary items naturally: ${i.vocab||i.topic}. 4-6 sentences.\nReturn ONLY a JSON array with one item:\n[{"text":"the generated text"}]`,
  'collocations': (i) =>
    `You are an EFL teacher. List exactly ${i.count} strong collocations related to "${i.topic}" at ${i.level} level. Each: the collocation and a natural example sentence.\nReturn ONLY a JSON array:\n[{"collocation":"verb + noun","example":"example sentence"}]`,
  'word-families': (i) =>
    `You are an EFL teacher. Give word families for ${i.count} key words related to "${i.topic}" at ${i.level} level. For each word give noun, verb, adjective, adverb forms.\nReturn ONLY a JSON array:\n[{"base":"word","noun":"...","verb":"...","adjective":"...","adverb":"..."}]`,
  'grammar-rules': (i) =>
    `You are an EFL teacher. Explain the grammar rule for "${i.topic}" clearly for ${i.level} students. Include the rule, 3 examples, and 2 common mistakes.\nReturn ONLY a JSON array:\n[{"section":"Rule","text":"..."},{"section":"Examples","text":"1.\\n2.\\n3."},{"section":"Common mistakes","text":"..."}]`,
  'tense-contrast': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} tense-contrast sentences at ${i.level} level about "${i.topic}". Students choose or transform the correct tense.\nReturn ONLY a JSON array:\n[{"text":"sentence with _____","options":["tense A form","tense B form"],"answer":"correct form"}]`,
  'essay-outline': (i) =>
    `You are an EFL teacher. Create an essay outline at ${i.level} level for the topic "${i.topic}". Include introduction, 3 body paragraph points, and conclusion.\nReturn ONLY a JSON array:\n[{"section":"Introduction","text":"Hook + thesis idea"},{"section":"Body 1","text":"..."},{"section":"Body 2","text":"..."},{"section":"Body 3","text":"..."},{"section":"Conclusion","text":"..."}]`,
  'creative-writing': (i) =>
    `You are an EFL teacher. Create a creative writing prompt and a model answer at ${i.level} level about "${i.topic}". Use vocab: ${i.vocab||'general'}.\nReturn ONLY a JSON array:\n[{"title":"Prompt","text":"writing prompt here"},{"title":"Model answer","text":"short model text"}]`,
  'sentence-translation': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} translation sentences at ${i.level} level about "${i.topic}". Provide sentences in the target language and the English answer.\nReturn ONLY a JSON array:\n[{"text":"Translate into English: \\"sentence\\"","answer":"English translation"}]`,
  'rewrite': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} sentence transformation exercises at ${i.level} level about "${i.topic}". Each: original sentence + instruction + model answer.\nReturn ONLY a JSON array:\n[{"text":"Rewrite using \\"word\\": \\"original sentence\\"","answer":"transformed sentence"}]`,
  'transcript-helper': (i) =>
    `You are an EFL teacher. Create a listening lesson task at ${i.level} level for a transcript about "${i.topic}". Include before/during/after tasks.\nReturn ONLY a JSON array:\n[{"stage":"Before listening","task":"..."},{"stage":"While listening","task":"..."},{"stage":"After listening","task":"..."}]`,
  'listening-dictation': (i) =>
    `You are an EFL teacher. Create exactly ${i.count} dictation sentences at ${i.level} level related to "${i.topic}". Each should practise a key sound or structure.\nReturn ONLY a JSON array:\n[{"text":"sentence with _____","answer":"missing word"}]`,
  'lesson-pack': (i) =>
    `You are an EFL teacher. Create a complete lesson plan at ${i.level} level for "${i.topic}". Include warmer, main tasks, and homework.\nReturn ONLY a JSON array of lesson stages:\n[{"stage":"Warmer (5 min)","task":"..."},{"stage":"Main task (20 min)","task":"..."},{"stage":"Production (10 min)","task":"..."},{"stage":"Homework","task":"..."}]`,
  'rubric-maker': (i) =>
    `You are an EFL teacher. Create a marking rubric at ${i.level} level for a ${i.topic} task. Include 4-5 criteria with descriptors for excellent/good/needs work.\nReturn ONLY a JSON array:\n[{"criterion":"Vocabulary","excellent":"...","good":"...","needs_work":"..."}]`,
  'essay-outline': (i) =>
    `You are an EFL teacher. Create an essay outline at ${i.level} level for "${i.topic}" with introduction, 3 body points, conclusion.\nReturn ONLY a JSON array:\n[{"section":"Introduction","text":"hook + thesis"},{"section":"Body 1","text":"..."},{"section":"Body 2","text":"..."},{"section":"Body 3","text":"..."},{"section":"Conclusion","text":"..."}]`,
  'warmup-listening': (i) =>
    `You are an EFL teacher. Create a warm-up activity before listening at ${i.level} level for "${i.topic}". Include a prediction task and 2-3 pre-teaching questions.\nReturn ONLY a JSON array:\n[{"task":"Prediction","text":"..."},{"task":"Pre-teach","text":"key words: ..."},{"task":"Discussion","text":"..."}]`,
};

function _parseJSON(raw) {
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

window._ttAI = {
  supported: () => !!navigator.gpu,
  generate: async function(toolId, input, onProgress) {
    const engine = await _loadEngine(onProgress);
    const mkPrompt = _PROMPTS[toolId];
    if (!mkPrompt) return null;
    const resp = await engine.chat.completions.create({
      messages: [{ role: 'user', content: mkPrompt(input) }],
      temperature: 0.35,
      max_tokens: 1400,
    });
    return _parseJSON(resp.choices[0].message.content);
  },
};
