/**
 * POST /api/google-forms/create
 *
 * Creates a Google Form from a teacher-tools generated output object.
 * Requires the user to supply an OAuth access_token with scope:
 *   https://www.googleapis.com/auth/forms.body
 *
 * Body: { access_token, output }
 *   output — the lastOutput object from teacher-tools.html
 *
 * Returns: { formId, editUrl, respondentUrl }
 */

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

// ── Helpers ──────────────────────────────────────────────────────────────────

function safe(s, max = 500) {
  return String(s || '').slice(0, max);
}

/**
 * Build Google Forms API batchUpdate requests from teacher-tools output.
 * Maps game types to appropriate question types.
 */
function buildFormRequests(output) {
  const requests = [];
  let index = 0;

  const gc  = output.gameContent || {};
  const gt  = output.gameType;
  const lv  = output.level || 'Mixed';
  const tags = (output.tags || []).filter(Boolean).join(' · ');

  // Description header: level + topic tags
  if (tags) {
    requests.push({
      createItem: {
        item: {
          title: `${lv} · ${tags}`,
          textItem: {}
        },
        location: { index: index++ }
      }
    });
  }

  // ── Multiple-choice (ABCD / speed-quiz) ──────────────────────────────────
  if (gt === 'speed-quiz' && gc.questions?.length) {
    gc.questions.forEach((q, i) => {
      const opts = (q.opts || ['A', 'B', 'C', 'D']).map(o => ({ value: safe(o, 200) }));
      requests.push({
        createItem: {
          item: {
            title: safe(q.q || `Question ${i + 1}`, 500),
            questionItem: {
              question: {
                required: false,
                choiceQuestion: { type: 'RADIO', options: opts, shuffle: false }
              }
            }
          },
          location: { index: index++ }
        }
      });
    });

  // ── True / False ────────────────────────────────────────────────────────
  } else if (gt === 'true-false' && gc.statements?.length) {
    gc.statements.forEach((s, i) => {
      requests.push({
        createItem: {
          item: {
            title: safe(s.text || `Statement ${i + 1}`, 500),
            questionItem: {
              question: {
                required: false,
                choiceQuestion: {
                  type: 'RADIO',
                  options: [{ value: 'True' }, { value: 'False' }],
                  shuffle: false
                }
              }
            }
          },
          location: { index: index++ }
        }
      });
    });

  // ── Fill in the blank ───────────────────────────────────────────────────
  } else if (gt === 'fill-blank' && gc.sentences?.length) {
    gc.sentences.forEach((s, i) => {
      const question = String(s).split('|')[0].replace(/\b___\b/g, '_____').trim();
      requests.push({
        createItem: {
          item: {
            title: safe(question || `Question ${i + 1}`, 500),
            questionItem: {
              question: {
                required: false,
                textQuestion: { paragraph: false }
              }
            }
          },
          location: { index: index++ }
        }
      });
    });

  // ── Matching pairs ──────────────────────────────────────────────────────
  } else if (gt === 'memory-match' && gc.pairs?.length) {
    gc.pairs.forEach((p, i) => {
      const word = safe(p.a || p.word || `Item ${i + 1}`, 200);
      requests.push({
        createItem: {
          item: {
            title: `What does "${word}" mean?`,
            questionItem: {
              question: {
                required: false,
                textQuestion: { paragraph: false }
              }
            }
          },
          location: { index: index++ }
        }
      });
    });

  // ── Word categories ─────────────────────────────────────────────────────
  } else if (gt === 'word-categories' && gc.categories?.length) {
    requests.push({
      createItem: {
        item: {
          title: 'Sort the words into the correct categories.',
          textItem: {}
        },
        location: { index: index++ }
      }
    });
    gc.categories.forEach((cat, i) => {
      (cat.words || []).forEach((word, j) => {
        requests.push({
          createItem: {
            item: {
              title: `Which category does "${safe(word, 100)}" belong to?`,
              questionItem: {
                question: {
                  required: false,
                  choiceQuestion: {
                    type: 'RADIO',
                    options: gc.categories.map(c => ({ value: safe(c.name, 100) })),
                    shuffle: true
                  }
                }
              }
            },
            location: { index: index++ }
          }
        });
      });
    });

  // ── Fallback: numbered lines from text ──────────────────────────────────
  } else if (output.text) {
    const lines = String(output.text).split('\n')
      .filter(l => /^\d+[.)]\s/.test(l.trim()))
      .slice(0, 25);

    if (lines.length) {
      lines.forEach((line, i) => {
        const q = line.replace(/^\d+[.)]\s*/, '').split('\n')[0].trim();
        if (!q) return;
        requests.push({
          createItem: {
            item: {
              title: safe(q, 500),
              questionItem: {
                question: {
                  required: false,
                  textQuestion: { paragraph: q.length > 120 }
                }
              }
            },
            location: { index: index++ }
          }
        });
      });
    } else {
      // Pure text — add as a description block + one open paragraph
      requests.push({
        createItem: {
          item: {
            title: safe(String(output.text).slice(0, 500), 500),
            textItem: {}
          },
          location: { index: index++ }
        }
      });
      requests.push({
        createItem: {
          item: {
            title: 'Your answer:',
            questionItem: {
              question: { required: false, textQuestion: { paragraph: true } }
            }
          },
          location: { index: index++ }
        }
      });
    }
  }

  return requests;
}

// ── Route ────────────────────────────────────────────────────────────────────

router.post('/create', requireAuth, async (req, res) => {
  const { access_token, output } = req.body;
  if (!access_token) return res.status(400).json({ error: 'access_token is required.' });
  if (!output)       return res.status(400).json({ error: 'output is required.' });

  const authHeader = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };

  try {
    // 1. Create the form (title only)
    const title = String(output.title || 'TeachEd Exercise').slice(0, 140);
    const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
      method:  'POST',
      headers: authHeader,
      body:    JSON.stringify({ info: { title } })
    });
    const form = await createRes.json();
    if (!createRes.ok) {
      throw Object.assign(new Error(form.error?.message || 'Could not create form'), { status: 400 });
    }

    const formId = form.formId;

    // 2. Add questions via batchUpdate
    const requests = buildFormRequests(output);
    if (requests.length > 0) {
      const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
        method:  'POST',
        headers: authHeader,
        body:    JSON.stringify({ includeFormInResponse: false, requests })
      });
      if (!updateRes.ok) {
        const err = await updateRes.json();
        console.warn('[google-forms] batchUpdate warning:', err.error?.message);
        // Non-fatal — form still created, just without all questions
      }
    }

    console.log(`[google-forms] Created form ${formId} with ${requests.length} items for user ${req.user.id}`);

    res.json({
      formId,
      editUrl:        `https://docs.google.com/forms/d/${formId}/edit`,
      respondentUrl:  form.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`
    });

  } catch (err) {
    console.error('[google-forms/create]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
