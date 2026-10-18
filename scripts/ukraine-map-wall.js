/* Map of Ukraine as a live desktop background (Kristina 18.10.2026).
 *
 * The interactive map from Meet Ukraine (meet-ukraine/map-of-ukraine.html,
 * opened with ?wall=1 so its "← Meet Ukraine" link steps aside) sits at the
 * back of #desktop, under the windows and widgets. The empty desk is the map:
 * tap a city or a landmark there to open what it is famous for; its own
 * day / dusk toggle works too. It loads lazily and is removed, not just
 * hidden, when another background is chosen. TeachedUaMap.mount(desk) /
 * .unmount().
 */
(function () {
  'use strict';
  if (window.TeachedUaMap) return;
  let frame = null, host = null;
  function mount(el) {
    if (!el) return;
    if (frame && host === el) return;
    unmount();
    host = el;
    frame = document.createElement('iframe');
    frame.className = 'ua-map-wall';
    frame.title = 'Map of Ukraine - interactive background';
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('tabindex', '-1');
    frame.src = new URL('meet-ukraine/map-of-ukraine.html?wall=1', document.baseURI).href;
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;z-index:0;display:block;background:#173E7C;color-scheme:light';
    host.prepend(frame);
  }
  function unmount() {
    frame?.remove();
    frame = null; host = null;
  }
  window.TeachedUaMap = { mount, unmount };
})();
