/* TeachEd — lazy loader for the heavy vocabulary library (~81 KB).
 * The vocabulary dictionaries are only needed when a teacher actually uses
 * "Generate / Load from topic", so we defer the download until first use
 * instead of blocking initial page paint.
 *
 * Usage:  ensureVocab().then(VOCAB => { ... use window.TEACHEDOS_VOCAB ... });
 * Idempotent: the script is fetched at most once per page. */
window.ensureVocab = (function () {
  let pending = null;
  return function ensureVocab() {
    if (window.TEACHEDOS_VOCAB) return Promise.resolve(window.TEACHEDOS_VOCAB);
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'scripts/vocabulary.js';
      s.async = true;
      s.onload = () => resolve(window.TEACHEDOS_VOCAB);
      s.onerror = () => { pending = null; reject(new Error('Failed to load vocabulary library')); };
      document.head.appendChild(s);
    });
    return pending;
  };
})();
