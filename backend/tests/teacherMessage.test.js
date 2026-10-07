'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { teacherMessageEmail } = require('../lib/email');

test('teacher message email greets by first name, escapes HTML and keeps line breaks', () => {
  const m = teacherMessageEmail({ studentName: 'Tinka Test', teacherName: 'Slava', title: 'Message from Slava', text: 'See you <b>soon</b>\nBring the book', link: 'https://teached.tech/student.html' });
  assert.equal(m.subject, 'Message from Slava');
  assert.match(m.text, /^Message from Slava/);
  assert.match(m.text, /Hi Tinka,/);
  assert.doesNotMatch(m.html, /<b>soon<\/b>/);
  assert.match(m.html, /See you &lt;b&gt;soon&lt;\/b&gt;<br>Bring the book/);
  assert.match(m.html, /Open my cabinet/);
});

test('teacher message email without a link has no button', () => {
  const m = teacherMessageEmail({ studentName: '', teacherName: '', title: 'Hello', text: 'Hi' });
  assert.match(m.text, /Hi there,/);
  assert.doesNotMatch(m.html, /Open my cabinet/);
});
