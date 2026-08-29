'use strict';

const sanitizeHtml = require('sanitize-html');

const RICH_TEXT_OPTIONS = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'span', 'div',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
    'code', 'pre', 'a', 'mark', 'small', 'sub', 'sup', 'table', 'thead',
    'tbody', 'tr', 'th', 'td', 'hr', 'img',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
        target: attribs.target === '_blank' ? '_blank' : undefined,
      },
    }),
  },
};

function sanitizeRichHtml(value) {
  return sanitizeHtml(String(value || ''), RICH_TEXT_OPTIONS);
}

function sanitizeCard(card) {
  if (!card || typeof card !== 'object' || !card.data || typeof card.data !== 'object') return card;
  // Interactive worksheets execute in an opaque-origin sandboxed iframe.
  // Their scripts are part of the exercise and cannot access the parent app.
  if (card.data.interactive === true) return card;
  if (typeof card.data.html !== 'string') return card;
  return { ...card, data: { ...card.data, html: sanitizeRichHtml(card.data.html) } };
}

function sanitizeBoardData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.cards)) return data;
  return { ...data, cards: data.cards.map(sanitizeCard) };
}

module.exports = { sanitizeBoardData, sanitizeRichHtml };
