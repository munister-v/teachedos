/* Tools of the board assistant that live on the server: two reads (how the
   board's students are doing, an encyclopedia search) and one student-facing
   write (words into the student's Word Bank). The model asks for a read with
   {"read":[{"tool":"results"}|{"tool":"web","q":"..."}]}; the route runs it
   and shows the answer to the model before it plans. Nothing here trusts the
   model: ownership of the board is checked, queries and words are bounded. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cut = (s, n) => { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const LANGS = ['en', 'uk', 'ru'];

/* The students of a board the teacher owns. */
async function boardStudents(db, teacherId, boardId) {
  if (!UUID.test(String(boardId || ''))) return [];
  const { rows } = await db.query(
    `SELECT bc.user_id, u.name FROM boards b
       JOIN board_collaborators bc ON bc.board_id = b.id
       JOIN users u ON u.id = bc.user_id AND u.role = 'student'
      WHERE b.id = $1 AND b.user_id = $2`, [boardId, teacherId]);
  return rows;
}

/* How the students of this board did: lesson steps and homework. First names only. */
async function readResults(db, teacherId, boardId) {
  const students = await boardStudents(db, teacherId, boardId);
  if (!students.length) return 'Results: this board has no students.';
  const lines = [];
  for (const s of students.slice(0, 8)) {
    const first = cut(String(s.name || 'Student').split(' ')[0], 20);
    const { rows: hw } = await db.query(
      `SELECT h.title, a.status, a.final_score FROM homework_assignment a JOIN homework h ON h.id = a.homework_id
        WHERE a.student_id = $1 AND h.board_id = $2 AND h.user_id = $3 ORDER BY a.assigned_at DESC LIMIT 6`,
      [s.user_id, boardId, teacherId]).catch(() => ({ rows: [] }));
    const { rows: pr } = await db.query(
      'SELECT status, COUNT(*)::int AS n FROM student_progress WHERE board_id = $1 AND user_id = $2 GROUP BY status',
      [boardId, s.user_id]).catch(() => ({ rows: [] }));
    const parts = [];
    if (pr.length) parts.push('lessons on the board: ' + pr.map(r => `${r.n} ${r.status}`).join(', '));
    hw.forEach(h => parts.push(`homework “${cut(h.title, 40)}” ${h.status}${h.final_score != null ? ` ${h.final_score}%` : ''}`));
    lines.push(`${first}: ${parts.length ? parts.join('; ') : 'nothing done on this board yet'}`);
  }
  return 'Results of this board\'s students (from the platform): ' + lines.join(' | ');
}

/* How each student did in ONE card (a quiz or exercise card of this board). */
async function readCard(db, teacherId, boardId, cardId) {
  const students = await boardStudents(db, teacherId, boardId);
  const id = cut(cardId, 24);
  if (!students.length) return 'Card results: this board has no students.';
  const { rows } = await db.query(
    `SELECT u.name, qr.score, qr.max_score, qr.pct, qr.submitted_at FROM quiz_results qr JOIN users u ON u.id = qr.user_id
      WHERE qr.board_id::text = $1 AND qr.card_id = $2 AND qr.user_id = ANY($3::uuid[]) ORDER BY qr.submitted_at DESC LIMIT 12`,
    [boardId, id, students.map(s => s.user_id)]).catch(() => ({ rows: [] }));
  if (!rows.length) return `Card ${id}: nobody has handed in a result yet.`;
  return `Card ${id} results: ` + rows.map(r => `${cut(String(r.name || 'Student').split(' ')[0], 20)} ${r.score}/${r.max_score} (${r.pct}%)`).join('; ');
}

/* Encyclopedia search (Wikipedia, no key): the top pages with their opening lines. */
async function webSearch(query, lang) {
  const q = cut(query, 100).replace(/[^\p{L}\p{N} '’-]/gu, ' ').trim();
  if (q.length < 2) return 'Web search: empty query.';
  const host = LANGS.includes(lang) ? lang : 'en';
  try {
    const sig = AbortSignal.timeout(6000);
    const url = `https://${host}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=3&prop=extracts&exintro=1&explaintext=1&exchars=500&format=json&origin=*`;
    const r = await fetch(url, { signal: sig, headers: { 'User-Agent': 'TeachEd-board-assistant/1.0' } });
    if (!r.ok) return `Web search for “${q}”: the search service did not answer.`;
    const d = await r.json();
    const pages = Object.values((d.query && d.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0)).slice(0, 3);
    if (!pages.length) return `Web search for “${q}”: nothing found.`;
    return `Web search for “${q}” (Wikipedia ${host}): ` + pages.map(p => `${cut(p.title, 80)} - ${cut(p.extract, 450)} [https://${host}.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, '_'))}]`).join(' | ');
  } catch (e) {
    return `Web search for “${q}”: the search service did not answer.`;
  }
}

/* The reads the model asked for -> one block of text for its next look. */
async function runReads(db, teacherId, boardId, reads) {
  const out = [];
  for (const r of (Array.isArray(reads) ? reads : []).slice(0, 3)) {
    const tool = r && r.tool;
    if (tool === 'results') out.push(await readResults(db, teacherId, boardId).catch(() => 'Results: could not be read.'));
    else if (tool === 'card') out.push(await readCard(db, teacherId, boardId, r.id).catch(() => 'Card results: could not be read.'));
    else if (tool === 'web') out.push(await webSearch(r.q, r.lang));
  }
  return out.join('\n');
}

/* Words into the Word Bank of the board's one student. Duplicates are skipped. */
async function addWords(db, teacherId, boardId, words) {
  const students = await boardStudents(db, teacherId, boardId);
  if (students.length !== 1) return { ok: false, why: students.length ? 'this board has several students' : 'this board has no student yet' };
  const list = [];
  const seen = new Set();
  for (const w of Array.isArray(words) ? words : []) {
    const m = cut(w, 300).split(/\s+[-–—:]\s+/);
    const word = cut(m[0], 80);
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    list.push({ word, meaning: cut(m.slice(1).join(' - '), 255) });
    if (list.length >= 30) break;
  }
  if (!list.length) return { ok: false, why: 'there are no words to send' };
  const sid = students[0].user_id;
  let added = 0;
  for (const w of list) {
    const dup = await db.query("SELECT 1 FROM vocabulary WHERE user_id=$1 AND kind='word' AND lower(word)=lower($2) LIMIT 1", [sid, w.word]);
    if (dup.rows[0]) continue;
    await db.query(
      `INSERT INTO vocabulary (user_id, word, translation, kind, source_board_id, source_title, sent_by, source_type)
       VALUES ($1,$2,$3,'word',$4,'Board assistant',$5,'LESSON_BOARD')`, [sid, w.word, w.meaning, boardId, teacherId]);
    added++;
  }
  return { ok: true, added, skipped: list.length - added };
}

module.exports = { boardStudents, readResults, readCard, webSearch, runReads, addWords };
