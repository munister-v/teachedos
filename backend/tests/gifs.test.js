const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');

// The picker's server side: KLIPY behind our own route. The route file builds its limiter at
// require time; auth is replaced by a stub and KLIPY by a local server, so nothing leaves the machine.
const KEY = 'k_test_secret_123';
let upstream, upstreamPort;
const seen = [];                      // every request our route made to "KLIPY"
let reply = () => ({ result: true, data: { data: [], current_page: 1, has_next: false } });

process.env.KLIPY_API_BASE = 'http://127.0.0.1:0/api/v1';   // replaced below, before the route is required
const authPath = require.resolve('../middleware/auth');
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { requireAuth: (req, res, next) => { req.user = { id: 'teacher-uuid-1' }; next(); } } };

let server, base, _test;

test.before(async () => {
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, body });
      const out = reply(req);
      res.writeHead(out.status || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out.json || out));
    });
  });
  await new Promise(r => upstream.listen(0, '127.0.0.1', r));
  upstreamPort = upstream.address().port;
  process.env.KLIPY_API_BASE = `http://127.0.0.1:${upstreamPort}/api/v1`;
  process.env.KLIPY_API_KEY = KEY;
  const router = require('../routes/gifs');
  _test = router._test;
  const app = express();
  app.use(express.json());
  app.use('/api/gifs', router);
  server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server && server.close(); upstream && upstream.close(); });
test.beforeEach(() => { seen.length = 0; process.env.KLIPY_API_KEY = KEY; });

const fileSet = (o) => ({ gif: { url: o.gif, width: 480, height: 270 }, webp: { url: o.webp, width: 480, height: 270 }, mp4: { url: o.mp4, width: 480, height: 270 } });
const item = (n, extra = {}) => Object.assign({ id: n, slug: `cat-${n}`, title: `Cat ${n}`, type: 'gif', file: {
  md: fileSet({ gif: `https://cdn.klipy.test/${n}/md.gif`, webp: `https://cdn.klipy.test/${n}/md.webp`, mp4: `https://cdn.klipy.test/${n}/md.mp4` }),
  sm: fileSet({ gif: `https://cdn.klipy.test/${n}/sm.gif`, webp: `https://cdn.klipy.test/${n}/sm.webp`, mp4: `https://cdn.klipy.test/${n}/sm.mp4` }),
} }, extra);

test('gifs: a GIF lands as the medium GIF, the grid shows the light WebP, not the original', () => {
  const { results, has_next, page } = _test.normalize('gifs', { result: true, data: { data: [item(1)], current_page: 2, has_next: true } });
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].url, 'https://cdn.klipy.test/1/md.gif');
  assert.strictEqual(results[0].preview, 'https://cdn.klipy.test/1/sm.webp');
  assert.strictEqual(results[0].previewKind, 'img');
  assert.strictEqual(results[0].kind, 'gif');
  assert.strictEqual(results[0].slug, 'cat-1');
  assert.deepStrictEqual(results[0].dims, [480, 270]);
  assert.strictEqual(has_next, true);
  assert.strictEqual(page, 2);
});

test('gifs: items marked as ads never reach the board', () => {
  const { results } = _test.normalize('gifs', { data: { data: [item(1), item(2, { type: 'ad' }), item(3, { type: 'AD' }), item(4, { is_ad: true }), item(5)] } });
  assert.deepStrictEqual(results.map(r => r.id), ['1', '5']);
});

test('gifs: a rating above PG is dropped even if the upstream filter missed it', () => {
  const { results } = _test.normalize('gifs', { data: { data: [item(1, { rating: 'g' }), item(2, { rating: 'PG' }), item(3, { rating: 'pg-13' }), item(4, { rating: 'r' })] } });
  assert.deepStrictEqual(results.map(r => r.id), ['1', '2']);
});

test('gifs: items without a usable https file, and junk shapes, are dropped without a throw', () => {
  const noFile = { id: 9, slug: 'none', type: 'gif', file: {} };
  const http1 = item(8); http1.file.md.gif.url = 'http://insecure.test/x.gif'; http1.file.md.webp.url = 'http://insecure.test/x.webp'; http1.file.sm.gif.url = 'http://insecure.test/s.gif'; http1.file.sm.webp.url = 'http://insecure.test/s.webp';
  assert.deepStrictEqual(_test.normalize('gifs', { data: { data: [noFile, http1, null, 'x'] } }).results, []);
  assert.deepStrictEqual(_test.normalize('gifs', null).results, []);
  assert.deepStrictEqual(_test.normalize('gifs', { data: 'nope' }).results, []);
  assert.deepStrictEqual(_test.normalize('gifs', { data: { data: 'nope' } }).results, []);
});

test('gifs: format-then-size nesting and "files" are read too', () => {
  const alt = { id: 'x1', slug: 'x1', files: { gif: { md: { url: 'https://cdn.klipy.test/x1.gif', width: 300, height: 200 } }, webp: { sm: { url: 'https://cdn.klipy.test/x1s.webp' } } } };
  const [g] = _test.normalize('gifs', { data: { data: [alt] } }).results;
  assert.strictEqual(g.url, 'https://cdn.klipy.test/x1.gif');
  assert.strictEqual(g.preview, 'https://cdn.klipy.test/x1s.webp');
});

test('stickers keep their transparency (webp/png), clips come as muted video files', () => {
  const st = _test.normalize('stickers', { data: { data: [item(1)] } }).results[0];
  assert.strictEqual(st.kind, 'sticker');
  assert.strictEqual(st.url, 'https://cdn.klipy.test/1/md.webp');
  const cl = _test.normalize('clips', { data: { data: [item(2)] } }).results[0];
  assert.strictEqual(cl.kind, 'clip');
  assert.strictEqual(cl.url, 'https://cdn.klipy.test/2/md.mp4');
  assert.strictEqual(cl.preview, 'https://cdn.klipy.test/2/sm.webp');
  // a clip with only a video file previews as a video
  const only = { id: 'v', slug: 'v', file: { sm: { mp4: { url: 'https://cdn.klipy.test/v.mp4' } } } };
  const v = _test.normalize('clips', { data: { data: [only] } }).results[0];
  assert.strictEqual(v.previewKind, 'video');
});

test('locale: interface language becomes a KLIPY locale, English when unknown', () => {
  assert.strictEqual(_test.localeOf('en'), 'en_US');
  assert.strictEqual(_test.localeOf('uk'), 'uk_UK');
  assert.strictEqual(_test.localeOf('pt-br'), 'pt_BR');
  assert.strictEqual(_test.localeOf('en_GB'), 'en_GB');
  assert.strictEqual(_test.localeOf(''), 'en_US');
  assert.strictEqual(_test.localeOf('x'.repeat(40)), 'en_US');
  assert.strictEqual(_test.localeOf('../../etc'), 'en_US');
});

test('route: search goes to KLIPY with our filter, our key in the path only, and no ads or key back', async () => {
  reply = () => ({ result: true, data: { data: [item(1), item(2, { type: 'ad' })], current_page: 1, has_next: true } });
  // the browser tries to lower the filter and choose its own customer id: both are ignored
  const r = await fetch(`${base}/api/gifs/search?type=stickers&q=thumbs%20up&page=2&contentfilter=off&rating=r&customer_id=attacker&locale=uk`);
  assert.strictEqual(r.status, 200);
  const text = await r.text();
  assert.ok(!text.includes(KEY), 'the API key must not be in the response');
  const body = JSON.parse(text);
  assert.strictEqual(body.source, 'klipy');
  assert.strictEqual(body.type, 'stickers');
  assert.strictEqual(body.has_next, true);
  assert.deepStrictEqual(body.results.map(g => g.id), ['1']);
  assert.strictEqual(seen.length, 1);
  const u = new URL(seen[0].url, 'http://x');
  assert.strictEqual(u.pathname, `/api/v1/${KEY}/stickers/search`);
  assert.strictEqual(u.searchParams.get('contentfilter'), 'high');
  assert.strictEqual(u.searchParams.get('rating'), 'pg');
  assert.strictEqual(u.searchParams.get('customer_id'), 'teacher-uuid-1');
  assert.strictEqual(u.searchParams.get('q'), 'thumbs up');
  assert.strictEqual(u.searchParams.get('per_page'), '24');
  assert.strictEqual(u.searchParams.get('page'), '2');
  assert.strictEqual(u.searchParams.get('locale'), 'uk_UK');
  assert.deepStrictEqual(u.searchParams.getAll('contentfilter'), ['high']);
});

test('route: no query means trending of the chosen tab, English by default', async () => {
  reply = () => ({ result: true, data: { data: [item(1)], current_page: 1, has_next: false } });
  for (const type of ['gifs', 'stickers', 'clips']) {
    seen.length = 0;
    const r = await fetch(`${base}/api/gifs/search?type=${type}`);
    assert.strictEqual(r.status, 200);
    const u = new URL(seen[0].url, 'http://x');
    assert.strictEqual(u.pathname, `/api/v1/${KEY}/${type}/trending`);
    assert.strictEqual(u.searchParams.get('contentfilter'), 'high');
    assert.strictEqual(u.searchParams.get('locale'), 'en_US');
    assert.strictEqual(u.searchParams.get('q'), null);
  }
});

test('route: unknown tab is a 400, a missing key is a clear 503, an upstream failure is a 502 without the key', async () => {
  assert.strictEqual((await fetch(`${base}/api/gifs/search?type=memes`)).status, 400);
  process.env.KLIPY_API_KEY = '';
  const off = await fetch(`${base}/api/gifs/search?type=gifs&q=cat`);
  assert.strictEqual(off.status, 503);
  const offBody = await off.json();
  assert.strictEqual(offBody.code, 'not_configured');
  assert.deepStrictEqual(offBody.results, []);
  assert.strictEqual(seen.length, 0, 'nothing is sent anywhere without a key');
  assert.strictEqual((await (await fetch(`${base}/api/gifs/status`)).json()).configured, false);
  process.env.KLIPY_API_KEY = KEY;
  reply = () => ({ status: 500, json: { error: 'boom' } });
  const bad = await fetch(`${base}/api/gifs/search?type=gifs&q=unique-failing-query`);
  assert.strictEqual(bad.status, 502);
  const badText = await bad.text();
  assert.ok(!badText.includes(KEY));
  assert.strictEqual((await (await fetch(`${base}/api/gifs/status`)).json()).configured, true);
});

test('route: Wikimedia Commons is not consulted any more', () => {
  const src = require('node:fs').readFileSync(require.resolve('../routes/gifs'), 'utf8');
  assert.ok(!/wikimedia|commons\.|upload\.wikimedia/i.test(src.replace(/\/\/.*$/gm, '')), 'no Commons call may remain in code');
});

test('route: share trigger is posted to KLIPY with the teacher id, and never fails the insert', async () => {
  reply = () => ({ result: true });
  const ok = await fetch(`${base}/api/gifs/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'gifs', slug: 'cat-1', q: 'cat' }) });
  assert.deepStrictEqual(await ok.json(), { ok: true });
  assert.strictEqual(seen.length, 1);
  assert.strictEqual(seen[0].method, 'POST');
  assert.strictEqual(seen[0].url, `/api/v1/${KEY}/gifs/cat-1/share`);
  assert.strictEqual(JSON.parse(seen[0].body).customer_id, 'teacher-uuid-1');
  // a bad slug or type is not forwarded
  seen.length = 0;
  const bad = await fetch(`${base}/api/gifs/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'gifs', slug: '../../x' }) });
  assert.deepStrictEqual(await bad.json(), { ok: false });
  assert.strictEqual(seen.length, 0);
  // upstream down: still a 200 answer for the picker
  reply = () => ({ status: 503, json: {} });
  const down = await fetch(`${base}/api/gifs/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'clips', slug: 'c-1' }) });
  assert.strictEqual(down.status, 200);
});

/* ── the classroom filter (lib/gifGuard.js) ─────────────────────────────────── */
const guard = require('../lib/gifGuard');

test('guard: sexual, abusive and violent searches are caught - in English, Ukrainian and Russian, spelled plainly or dodged', () => {
  for (const q of ['sex', 'sexy dance', 'naked girl', 'porn', 'p0rn', 's3x', 'nsfw', 'XXX', 'twerking', 'eat my ass', 'fuck you', 'sh1t', 'b!tch',
    'порно', 'секс', 'голая девушка', 'хуй', 'сука', 'блядь', 'пізда', 'эротика', 'стриптиз', 'ТИТЬКИ', 'kill yourself', 'hitler', 'гітлер', 'sexy-back']) {
    assert.ok(guard.isBlockedQuery(q), `should be blocked: ${q}`);
  }
});

test('guard: ordinary words that merely contain a bad one are not caught', () => {
  for (const q of ['class', 'classic', 'assistant', 'Essex', 'Sussex', 'cocktail', 'Dickens', 'bass guitar', 'pass', 'grape', 'therapist', 'analysis', 'button',
    'thumbs up', 'high five', 'happy birthday', 'good morning', 'cat', 'cock-a-doodle-doo', 'мандарин', 'секстант', 'кошка', 'школа', 'привіт', 'небо', 'сукно', 'хлеб', 'худий', 'Пасха']) {
    assert.ok(!guard.isBlockedQuery(q), `should pass: ${q}`);
  }
});

test('guard: a result is judged by its title, slug and tags, not only the search', () => {
  assert.ok(guard.isBlockedItem({ title: 'Sexy dance', slug: 'a-1' }));
  assert.ok(guard.isBlockedItem({ title: 'Cat', slug: 'naked-cat-1' }));
  assert.ok(guard.isBlockedItem({ title: 'Cat', tags: ['funny', 'nsfw'] }));
  assert.ok(guard.isBlockedItem({ title: 'Cat', tags: [{ name: 'порно' }] }));
  assert.ok(!guard.isBlockedItem({ title: 'Cat', slug: 'cat-1', tags: ['funny', 'pet'] }));
  assert.ok(!guard.isBlockedItem(null));
});

test('route: a blocked search never reaches KLIPY and the picker is told it was filtered', async () => {
  const r = await fetch(`${base}/api/gifs/search?type=gifs&q=${encodeURIComponent('sexy girls')}`);
  assert.strictEqual(r.status, 200);
  const body = await r.json();
  assert.deepStrictEqual(body.results, []);
  assert.strictEqual(body.filtered, true);
  assert.strictEqual(body.has_next, false);
  assert.strictEqual(seen.length, 0, 'nothing is sent to KLIPY for a blocked search');
});

test('route: a harmless search still drops results whose title or tags are not for a class', async () => {
  reply = () => ({ result: true, data: { data: [item(1), item(2, { title: 'Naughty and sexy' }), item(3, { tags: ['funny', 'porn']}), item(4, { slug: 'nude-beach-4' })], current_page: 1, has_next: false } });
  const r = await fetch(`${base}/api/gifs/search?type=gifs&q=beach%20day%20unique`);
  const body = await r.json();
  assert.deepStrictEqual(body.results.map(g => g.id), ['1']);
  assert.ok(!body.filtered);
});

test('route: the filter level is high by default, cannot be switched off, and a refusal of "high" falls back to medium for that request', async () => {
  const keep = process.env.KLIPY_CONTENT_FILTER;
  try {
    delete process.env.KLIPY_CONTENT_FILTER;
    assert.strictEqual(_test.filterNow(), 'high');
    process.env.KLIPY_CONTENT_FILTER = 'off';
    assert.strictEqual(_test.filterNow(), 'high');
    process.env.KLIPY_CONTENT_FILTER = 'medium';
    assert.strictEqual(_test.filterNow(), 'medium');
    delete process.env.KLIPY_CONTENT_FILTER;
    reply = (req) => (/contentfilter=high/.test(req.url)
      ? { status: 400, json: { error: 'bad filter' } }
      : { result: true, data: { data: [item(7)], current_page: 1, has_next: false } });
    seen.length = 0;
    const r = await fetch(`${base}/api/gifs/search?type=gifs&q=fallback%20unique`);
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual((await r.json()).results.map(g => g.id), ['7']);
    assert.deepStrictEqual(seen.map(x => new URL(x.url, 'http://x').searchParams.get('contentfilter')), ['high', 'medium']);
  } finally {
    if (keep === undefined) delete process.env.KLIPY_CONTENT_FILTER; else process.env.KLIPY_CONTENT_FILTER = keep;
  }
});
