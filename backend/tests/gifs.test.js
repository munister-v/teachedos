const test = require('node:test');
const assert = require('node:assert');

// The route file builds its limiter and auth at require time; nothing here touches the network.
const { _test } = require('../routes/gifs');

test('gifs: GIPHY rows become board GIFs, rows without a file are dropped', () => {
  const list = _test.fromGiphy({ data: [
    { id: 'a1', title: 'Well done', images: { downsized: { url: 'https://media.giphy.com/a1.gif', width: '480', height: '270' }, fixed_height_small: { url: 'https://media.giphy.com/a1s.gif' } } },
    { id: 'a2', title: 'broken', images: {} },
    { title: 'no id', images: { original: { url: 'https://media.giphy.com/x.gif' } } },
  ] });
  assert.strictEqual(list.length, 1);
  assert.deepStrictEqual(list[0].dims, [480, 270]);
  assert.strictEqual(list[0].preview, 'https://media.giphy.com/a1s.gif');
});

test('gifs: Commons keeps real GIF files over https, drops icons and huge files', () => {
  const ii = (o) => [Object.assign({ mime: 'image/gif', width: 300, height: 200, size: 50000 }, o)];
  const list = _test.fromCommons({ query: { pages: {
    2: { pageid: 2, index: 2, title: 'File:Clap.gif', imageinfo: ii({ url: 'https://upload.wikimedia.org/c.gif', thumburl: 'https://upload.wikimedia.org/thumb/c.gif' }) },
    1: { pageid: 1, index: 1, title: 'File:Party.gif', imageinfo: ii({ url: 'https://upload.wikimedia.org/p.gif' }) },
    3: { pageid: 3, index: 3, title: 'File:Photo.jpg', imageinfo: ii({ url: 'https://upload.wikimedia.org/p.jpg', mime: 'image/jpeg' }) },
    4: { pageid: 4, index: 4, title: 'File:Icon.gif', imageinfo: ii({ url: 'https://upload.wikimedia.org/i.gif', width: 19, height: 19 }) },
    5: { pageid: 5, index: 5, title: 'File:Huge.gif', imageinfo: ii({ url: 'https://upload.wikimedia.org/h.gif', size: 9e6 }) },
    6: { pageid: 6, index: 6, title: 'File:Insecure.gif', imageinfo: ii({ url: 'http://example.com/p.gif' }) },
  } } });
  assert.deepStrictEqual(list.map(g => g.title), ['Party', 'Clap']);
  assert.strictEqual(list[0].preview, 'https://upload.wikimedia.org/p.gif');
  assert.strictEqual(list[1].preview, 'https://upload.wikimedia.org/thumb/c.gif');
  assert.deepStrictEqual(list[0].dims, [300, 200]);
});

test('gifs: junk upstream shapes give an empty list, not a throw', () => {
  assert.deepStrictEqual(_test.fromGiphy(null), []);
  assert.deepStrictEqual(_test.fromCommons({ query: { pages: 'nope' } }), []);
  assert.deepStrictEqual(_test.fromCommons(null), []);
});
