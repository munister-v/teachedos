/* ═══════════════════════════════════════════════════════════════════════════
   WRITING GENRES - requirements and phrase banks per genre.

   The school's own guide (not model output): what each genre must do and the
   phrases that carry it, grouped by where they go in the text. One file for
   both sides:
     - the browser: the Genre guide step of a writing path and the "Genre
       guide" panel in the Writing Studio (click a phrase → into the draft);
     - the server (backend/lib/aiEngine.js): the requirements and phrases go
       into every prompt of a writing lesson, so the model, the phrases and
       the criteria follow the same rules.
   Keys match the Genre select in the lesson builder.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const GENRES = {
    complaint: {
      label: 'Letter / email of complaint',
      register: 'formal',
      registerLabel: 'Formal',
      tone: 'Strictly formal. Polite but firm and demanding.',
      requirements: [
        'Say clearly why you are complaining in the first paragraph.',
        'Give the facts and details of the problem - no extra emotion.',
        'Ask clearly for compensation or action (a call to action).',
      ],
      phrases: {
        Opening: ['I am writing to express my strong dissatisfaction with…', 'I am writing to complain about a product / service purchased on…'],
        Body: ['To make matters worse,…', 'Consequently,…', 'I expected a much higher standard…'],
        'Closing / demand': ['I insist on a full refund / replacement.', 'I look forward to receiving your prompt response.'],
        'Sign-off': ['Yours faithfully, (no name)', 'Yours sincerely, (name known)'],
      },
    },
    inquiry: {
      label: 'Letter / email of inquiry',
      register: 'formal',
      registerLabel: 'Formal or semi-formal',
      tone: 'Formal or semi-formal, depending on who you write to.',
      requirements: [
        'Introduce yourself briefly.',
        'Ask your questions or requests in a clear, structured list.',
        'Thank the reader for their time.',
      ],
      phrases: {
        Opening: ['I am writing to inquire about…', 'I would be grateful if you could provide me with some information regarding…'],
        Body: ['Could you please clarify whether…?', 'I would also like to know…'],
        Closing: ['Thank you in advance for your assistance.', 'I look forward to hearing from you.'],
        'Sign-off': ['Best regards,', 'Yours sincerely,'],
      },
    },
    'business-email': {
      label: 'Professional / business email',
      register: 'formal',
      registerLabel: 'Semi-formal / formal',
      tone: 'Professional and concise.',
      requirements: [
        'Write an informative subject line.',
        'Get to the point in the first lines - no long introduction.',
        'Give clear deadlines and next steps.',
      ],
      phrases: {
        Opening: ['I am writing to update you on…', 'Following our meeting yesterday,…'],
        Body: ['Please find attached…', 'Could you please review this by [date]?', 'Let me know if you have any questions.'],
        Closing: ['Best regards,', 'Kind regards,'],
      },
    },
    'personal-email': {
      label: 'Email / letter to a friend',
      register: 'informal',
      registerLabel: 'Informal / casual',
      tone: 'Friendly and emotional, like talking to a friend.',
      requirements: [
        'Use a friendly, emotional tone.',
        'Use contractions, conversational phrases and idioms.',
        'No stiff, official vocabulary.',
      ],
      phrases: {
        Opening: ['Hi [Name]!', 'It was so great to hear from you!', "Sorry I haven't written in a while."],
        Body: ['By the way, guess what happened?', "You won't believe it, but…", "Anyway, I was wondering if you'd like to…"],
        Closing: ['Give my best to…', "Let's catch up soon!", 'Write back soon.'],
        'Sign-off': ['Best,', 'Love,', 'Cheers,'],
      },
    },
    'opinion-essay': {
      label: 'Opinion / discursive essay',
      register: 'academic',
      registerLabel: 'Academic / formal',
      tone: 'Academic and objective.',
      requirements: [
        'Clear structure: introduction (thesis) → body (arguments for and against, or your view) → conclusion.',
        'Prefer impersonal constructions to strong personal statements.',
        'Use complex structures and academic linking words.',
      ],
      phrases: {
        Introduction: ['It is often argued that…', 'Opinions are divided on whether…'],
        'Body / linking': ['On the one hand… On the other hand…', 'Furthermore, / Moreover,', 'In addition to this,…', 'Contrary to popular belief,…'],
        Conclusion: ['To sum up,', 'Taking everything into consideration,', 'In conclusion, I believe that…'],
      },
    },
    report: {
      label: 'Professional / academic report',
      register: 'formal',
      registerLabel: 'Formal',
      tone: 'Formal, informative and structured.',
      requirements: [
        'Use headings for the sections.',
        'Describe facts, findings or results of a study or inspection.',
        'Finish with recommendations.',
      ],
      phrases: {
        Opening: ['The purpose of this report is to examine / evaluate…', 'This report outlines the findings of…'],
        Body: ['As shown in the chart,…', 'It was observed that…', 'The majority of participants…'],
        Recommendations: ['It is recommended that…', 'To improve the situation, the following steps should be taken:'],
      },
    },
  };

  /* Values of the builder's Genre select → a guide. Genres without a guide
     (story, blog, dialogue…) simply have none. */
  const ALIAS = { 'formal-letter': 'inquiry', inquiry: 'inquiry', complaint: 'complaint', 'business-email': 'business-email',
    'personal-email': 'personal-email', email: 'personal-email', 'opinion-essay': 'opinion-essay', report: 'report' };

  function guideFor(genre) {
    const key = ALIAS[String(genre || '').toLowerCase()];
    return key ? { key, ...GENRES[key] } : null;
  }

  /* One paragraph for a prompt. */
  function promptText(genre) {
    const g = guideFor(genre);
    if (!g) return '';
    const phr = Object.entries(g.phrases).map(([k, v]) => `${k}: ${v.join(' / ')}`).join('; ');
    return ` GENRE GUIDE (${g.label}, ${g.registerLabel}): ${g.tone} Requirements: ${g.requirements.join(' ')} Key phrases the school teaches for it - prefer these where they fit: ${phr}.`;
  }

  const api = { GENRES, guideFor, promptText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TeachEdWritingGenres = api;
})(typeof window !== 'undefined' ? window : globalThis);
