const test = require('node:test');
const assert = require('node:assert/strict');
const seo = require('../lib/seoPages');

test('slugs: english kebab-case, Cyrillic transliterated, never empty', () => {
  assert.equal(seo.slugify('B1 Travel: Speaking & Role-play!'), 'b1-travel-speaking-and-role-play');
  assert.equal(seo.slugify('Вокзал: словник'), 'vokzal-slovnyk');
  assert.equal(seo.slugify('😀😀'), 'resource');
  assert.ok(seo.slugify('x'.repeat(200)).length <= 60);
});

test('author slug carries the id prefix and survives a rename', () => {
  const id = 'b9e666f5-b38b-43fa-a877-84c7c48e907a';
  assert.equal(seo.authorSlug('Kristina Local', id), 'kristina-local-b9e666f5');
  assert.match(seo.authorSlug('Нова Назва', id), /-b9e666f5$/);
});

const base = {
  id: '779c6648-7ba9-453d-b4f8-ae10b58fa357', slug: 'a-b', kind: 'lesson', authorId: 'u1', title: 'Hello <script>alert(1)</script>',
  description: 'A description that is long enough to index, with "quotes" & <b>tags</b>.',
  author: { name: 'Ann <b>', slug: 'ann-12345678' }, cefr: 'B1', skill: 'Speaking', section: 'Lessons & Spaces', type: 'Lesson',
  published: '2026-10-01T00:00:00Z', updated: null, hasImage: false, inside: { cards: 3, types: [{ type: 'text', count: 3 }] }, duration: null,
  stats: { copies: 0, likes: 0, saves: 1, used: 0, rating: null, remixes: 0, isNew: false }, paid: false, allowCopy: true, indexable: true,
};

test('the page escapes everything and says only what is known', () => {
  const html = seo.renderResource(base, []);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('Ann <b>'));
  assert.match(html, /<title>Hello .* — B1 Speaking Teaching Resource \| TeachEd<\/title>/);
  assert.match(html, /Not taught in a tracked lesson yet/);
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.match(html, /rel="canonical" href="https:\/\/teached\.tech\/community\/resources\/a-b\/"/);
});

test('no level, no skill: the title and tags leave them out; thin pages are noindex', () => {
  const html = seo.renderResource({ ...base, cefr: null, skill: null, indexable: false }, []);
  assert.match(html, /— Teaching Resource \| TeachEd/);
  assert.ok(!html.includes('CEFR'));
  assert.match(html, /name="robots" content="noindex, follow"/);
});

test('classroom feedback shows a share only from 5 answers, and never as stars', () => {
  const few = seo.renderResource({ ...base, stats: { ...base.stats, used: 3 } }, []);
  assert.match(few, /Taught in 3 lessons/);
  assert.match(few, /Not enough classroom feedback yet/);
  const many = seo.renderResource({ ...base, stats: { ...base.stats, used: 8, rating: { pct: 94, n: 8 } } }, []);
  assert.match(many, /94% of teachers who taught this lesson said it worked well/);
  assert.ok(!many.includes('AggregateRating'));
});
