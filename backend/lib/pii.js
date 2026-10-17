/* Minimising personal data in what goes to an outside language model (Lesson Builder 2.0 E5 US4).

   A teacher pastes a chat, an email or a student's text as source material. What the model
   needs is the language, not who wrote it or how to reach them - so e-mail addresses, phone
   numbers, card and bank numbers and links with a personal token are replaced by a neutral
   placeholder before the request leaves. Names are left alone on purpose: they cannot be told
   from ordinary words without guessing, and a wrong guess would damage the lesson text.

   Returns the cleaned text and how many things were removed, so the route can say so. */
const RULES = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]'],
  [/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g, '[account number]'],        // IBAN
  [/\b(?:\d[ -]?){13,19}\b/g, '[card number]'],
  [/(?<![\w.])\+?\d[\d ()-]{8,}\d(?![\w])/g, '[phone]'],
  [/https?:\/\/\S*[?&](?:token|key|auth|t|sid|session)=\S+/gi, '[private link]'],
];

function redactPII(text) {
  let out = String(text == null ? '' : text);
  let removed = 0;
  for (const [re, label] of RULES) {
    out = out.replace(re, () => { removed++; return label; });
  }
  return { text: out, removed };
}

module.exports = { redactPII };
