(function () {
  var isMobile = window.matchMedia && window.matchMedia('(max-width: 860px)').matches;
  if (!isMobile) return;

  // Avoid a global non-passive touchend listener: on iPhone it can delay tap
  // feedback and make scroll feel sticky. touch-action: manipulation is applied
  // by mobile-perf.js; this guard only blocks browser-level zoom gestures.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (name) {
    document.addEventListener(name, function (event) {
      event.preventDefault();
    }, { passive: false });
  });

  document.addEventListener('wheel', function (event) {
    if (event.ctrlKey) event.preventDefault();
  }, { passive: false });
})();
