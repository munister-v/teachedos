const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// The browser loads js/writing-genres.js, the server backend/lib/writingGenres.js
// (deploy syncs backend/ on its own). They must stay the same file.
test('writing genre guides: browser and server copies are identical', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'lib', 'writingGenres.js'), 'utf8');
  const browser = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'writing-genres.js'), 'utf8');
  assert.strictEqual(browser, server);
});

test('writing genre guides: select values map to guides', () => {
  const g = require('../lib/writingGenres');
  assert.ok(g.guideFor('complaint'));
  assert.strictEqual(g.guideFor('formal-letter').key, 'inquiry');
  assert.ok(g.promptText('opinion-essay').includes('GENRE GUIDE'));
  assert.strictEqual(g.guideFor('story'), null);
});
