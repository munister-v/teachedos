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

test('gifs: Openverse keeps only real GIF files over https', () => {
  const list = _test.fromOpenverse({ results: [
    { id: 'o1', title: 'Party', url: 'https://upload.wikimedia.org/p.gif', filetype: 'gif', width: 300, height: 200 },
    { id: 'o2', title: 'Photo', url: 'https://upload.wikimedia.org/p.jpg', filetype: 'jpg' },
    { id: 'o3', title: 'Insecure', url: 'http://example.com/p.gif', filetype: 'gif' },
  ] });
  assert.deepStrictEqual(list.map(g => g.id), ['o1']);
  assert.strictEqual(list[0].url, 'https://upload.wikimedia.org/p.gif');
});

test('gifs: junk upstream shapes give an empty list, not a throw', () => {
  assert.deepStrictEqual(_test.fromGiphy(null), []);
  assert.deepStrictEqual(_test.fromOpenverse({ results: 'nope' }), []);
});
