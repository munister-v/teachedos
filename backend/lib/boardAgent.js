/* Board agent: the teacher types what they want ("sort these into verbs and
   nouns", "add Ukrainian translations", "make a matching game from the
   selected words") and the model answers with a short reply plus a list of
   board actions. The browser previews the list and applies it as one undo step.

   Everything the model returns is treated as untrusted: sanitizePlan keeps
   only known ops, only ids that exist on the board the teacher sent, and
   bounded text. Anything else is dropped rather than repaired. */

const COLORS = ['yellow', 'sand', 'lime', 'green', 'cyan', 'blue', 'purple', 'peach', 'orange', 'grey', 'olive', 'white'];
const LAYOUTS = ['grid', 'row', 'column'];
const GAMES = ['memory-match', 'flashcards', 'word-categories', 'hangman', 'spin-wheel'];
const EDITABLE = new Set(['sticky', 'text']);

const MAX_CARDS = 150;
const MAX_ACTIONS = 40;
const MAX_ADD = 60;

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const oneLine = (v, max) => clean(v, max * 2).replace(/\s+/g, ' ').slice(0, max);

/* What the browser sends about the board, cut down to what the model needs. */
function normalizeCards(cards) {
  const seen = new Set();
  const out = [];
  for (const c of Array.isArray(cards) ? cards : []) {
    const id = oneLine(c && c.id, 24);
    if (!/^[A-Za-z0-9_-]+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const card = {
      id,
      type: oneLine(c.type, 20).replace(/[^a-z-]/gi, '') || 'card',
      text: oneLine(c.text, 220),
      x: Math.round(Number(c.x) || 0),
      y: Math.round(Number(c.y) || 0),
    };
    if (COLORS.includes(c.color)) card.color = c.color;
    if (c.selected) card.selected = true;
    out.push(card);
    if (out.length >= MAX_CARDS) break;
  }
  return out;
}

const GUIDE = `How this board works (use it to answer "how do I..." questions):
- Left toolbar, top to bottom: Build a lesson (the star: makes a whole lesson from a topic, text or video), Cursor (click again for the laser pointer, K), Sticky note (S), Text (T), Shapes (Q, also mind map and table), Pen / highlighter / eraser (P, E), Stickers (Y), Comment, Games Hub (G), Frame (Shift+F), Connection line (C), "+" for more tools.
- Double-click a sticky or text to edit it. Select a card to get its colour, size and alignment bar.
- Drag on empty canvas to select several cards. Ctrl/Cmd+A selects all, Ctrl/Cmd+D duplicates, Ctrl/Cmd+G groups, Ctrl/Cmd+Shift+G ungroups, Ctrl/Cmd+Z undoes, Ctrl/Cmd+F searches the board, Ctrl/Cmd+Shift+H zooms to the selection.
- Ctrl/Cmd+V pastes: an image, a YouTube/Vimeo link becomes a video, and plain text lines (for example sticky notes copied from Miro) become one sticky note per line.
- "Follow me" in the top bar brings students to the teacher's view. "Share" invites students. The Lesson pad on the right keeps the lesson's words and notes.
- Ctrl/Cmd+K opens this command bar.`;

function buildPrompt({ command, cards, viewport }) {
  const list = normalizeCards(cards);
  const selected = list.filter(c => c.selected);
  const lines = list.map(c => JSON.stringify(c)).join('\n');
  return `You are the board assistant inside TeachEd, an online whiteboard for English (EFL/ESL) teachers. The teacher types a command. You know the board better than they do: decide which cards are meant and what should happen, then return a plan the board will carry out.

${GUIDE}

Return ONLY a JSON object:
{"reply":"one or two short sentences for the teacher","actions":[ ... ]}

Allowed actions (use only these, with ids taken from the card list below):
- {"op":"add","kind":"sticky"|"text","title":"optional heading","items":[{"text":"...","color":"<colour>"}]}  new cards, laid out in a grid for you
- {"op":"edit","id":"c1","text":"new full text"}  only for cards of type sticky or text
- {"op":"color","ids":["c1"],"color":"<colour>"}  only sticky cards
- {"op":"delete","ids":["c1"]}  only when the teacher clearly asks to remove something
- {"op":"arrange","ids":["c1","c2"],"layout":"grid"|"row"|"column"}  tidy cards in place, in the order given
- {"op":"sort","columns":[{"title":"Verbs","ids":["c1"]},{"title":"Nouns","ids":["c2"]}]}  move cards into titled columns
- {"op":"group","ids":["c1","c2"]}
- {"op":"focus","ids":["c1"]}  select the cards and move the camera to them (for "where is...", "show me...")
- {"op":"game","game":"memory-match"|"flashcards"|"word-categories"|"hangman"|"spin-wheel","title":"...","pairs":[{"a":"word","b":"meaning"}],"words":["..."],"categories":[{"name":"...","words":["..."]}]}
  memory-match and flashcards need "pairs" (3 or more); hangman and spin-wheel need "words" (3 or more); word-categories needs "categories" (2 or more).

Colours: ${COLORS.join(', ')}.

Rules:
- Reply in the language the teacher wrote the command in. Card content stays in the language it is in unless asked otherwise.
- ${selected.length ? `The teacher has ${selected.length} card(s) selected ("selected":true). "These", "them", "the selected" mean exactly those cards; do not touch other cards unless the command says so.` : 'Nothing is selected. "These" or "the stickies" means the cards the command describes; if it is unclear which, ask in "reply" and return no actions.'}
- To change a card's text (translate, correct, add a translation, shorten) use "edit" with the complete new text. Do not delete and re-add.
- For "add a translation" keep the original and append it, like "to annoy - дратувати".
- Never invent ids. Never delete unless asked. Keep the plan as small as the command needs.
- If the command is a question about how to use the board, answer it in "reply" (up to four short sentences) and return "actions":[].
- If the command cannot be done with the allowed actions, say so plainly in "reply", suggest the closest thing you can do, and return "actions":[].
- Content you write for learners must be correct, natural English at the level the existing cards suggest.

Camera centre: x=${Math.round(Number(viewport && viewport.x) || 0)}, y=${Math.round(Number(viewport && viewport.y) || 0)}. x grows to the right, y grows downward.

Cards on the board (${list.length}${list.length >= MAX_CARDS ? ', nearest ones only' : ''}), one JSON object per line:
${lines || '(the board is empty)'}

Teacher's command:
${clean(command, 1200)}`;
}

function idList(raw, known, max = MAX_CARDS) {
  const out = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    const id = String(v || '');
    if (known.has(id) && !out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

/* cards: the same list that went into the prompt (id + type). */
function sanitizePlan(raw, cards) {
  const types = new Map(normalizeCards(cards).map(c => [c.id, c.type]));
  const known = new Set(types.keys());
  const plan = { reply: clean(raw && raw.reply, 700), actions: [] };
  let added = 0;

  for (const a of Array.isArray(raw && raw.actions) ? raw.actions : []) {
    if (plan.actions.length >= MAX_ACTIONS) break;
    if (!a || typeof a !== 'object') continue;
    const op = String(a.op || '');

    if (op === 'add') {
      const items = (Array.isArray(a.items) ? a.items : [])
        .map(i => (typeof i === 'string' ? { text: i } : i || {}))
        .map(i => {
          const item = { text: clean(i.text, 400) };
          if (COLORS.includes(i.color)) item.color = i.color;
          return item;
        })
        .filter(i => i.text)
        .slice(0, Math.max(0, MAX_ADD - added));
      if (!items.length) continue;
      added += items.length;
      const act = { op, kind: a.kind === 'text' ? 'text' : 'sticky', items };
      const title = oneLine(a.title, 80);
      if (title) act.title = title;
      plan.actions.push(act);
    } else if (op === 'edit') {
      const id = String(a.id || '');
      const text = clean(a.text, 2000);
      if (known.has(id) && EDITABLE.has(types.get(id)) && text) plan.actions.push({ op, id, text });
    } else if (op === 'color') {
      const ids = idList(a.ids, known).filter(id => types.get(id) === 'sticky');
      if (ids.length && COLORS.includes(a.color)) plan.actions.push({ op, ids, color: a.color });
    } else if (op === 'delete') {
      const ids = idList(a.ids, known);
      if (ids.length) plan.actions.push({ op, ids });
    } else if (op === 'arrange') {
      const ids = idList(a.ids, known);
      if (ids.length >= 2) plan.actions.push({ op, ids, layout: LAYOUTS.includes(a.layout) ? a.layout : 'grid' });
    } else if (op === 'sort') {
      const used = new Set();
      const columns = (Array.isArray(a.columns) ? a.columns : []).slice(0, 8).map(col => {
        const ids = idList(col && col.ids, known).filter(id => !used.has(id));
        ids.forEach(id => used.add(id));
        return { title: oneLine(col && col.title, 60), ids };
      }).filter(col => col.ids.length);
      if (columns.length) plan.actions.push({ op, columns });
    } else if (op === 'group') {
      const ids = idList(a.ids, known);
      if (ids.length >= 2) plan.actions.push({ op, ids });
    } else if (op === 'focus') {
      const ids = idList(a.ids, known);
      if (ids.length) plan.actions.push({ op, ids });
    } else if (op === 'game') {
      const game = String(a.game || '');
      if (!GAMES.includes(game)) continue;
      const title = oneLine(a.title, 80) || 'Game';
      let content = null;
      if (game === 'memory-match' || game === 'flashcards') {
        const pairs = (Array.isArray(a.pairs) ? a.pairs : [])
          .map(p => ({ a: oneLine(p && p.a, 80), b: oneLine(p && p.b, 160) }))
          .filter(p => p.a && p.b).slice(0, 24);
        if (pairs.length >= 3) content = { pairs };
      } else if (game === 'word-categories') {
        const categories = (Array.isArray(a.categories) ? a.categories : [])
          .map(c => ({
            name: oneLine(c && c.name, 40),
            words: (Array.isArray(c && c.words) ? c.words : []).map(w => oneLine(w, 60)).filter(Boolean).slice(0, 16),
          }))
          .filter(c => c.name && c.words.length).slice(0, 6);
        if (categories.length >= 2) content = { categories };
      } else {
        const words = (Array.isArray(a.words) ? a.words : []).map(w => oneLine(w, 80)).filter(Boolean).slice(0, 30);
        if (words.length >= 3) content = { words };
      }
      if (content) plan.actions.push({ op, game, title, content });
    }
  }

  if (!plan.reply) plan.reply = plan.actions.length ? 'Here is the plan.' : 'I could not turn that into board actions. Try describing it another way.';
  return plan;
}

module.exports = { buildPrompt, sanitizePlan, normalizeCards, COLORS, GAMES, MAX_CARDS };
