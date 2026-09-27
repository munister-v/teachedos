/* ═══ ЗВУКИ ТЕМ: АТМОСФЕРА И ОТВЕТЫ ═════════════════════════════════════════
   Всё синтезируется в браузере (Web Audio) - ни одного звукового файла, ни
   одной чужой записи: музыка и звуки из фильмов охраняются, свои - нет.

   Pumpkin Night: ветер в пустом доме, изредка ворона и скрип двери.
   New Year: тихие колокольчики музыкальной шкатулки и бубенцы саней.
   Для каждой темы - свой звук правильного ответа, ошибки и конца игры.

   По умолчанию звук ВЫКЛЮЧЕН (класс, урок, соседи) - включает кнопка 🔊,
   выбор запоминается в этом браузере. Браузер всё равно не даст звучать до
   первого нажатия, поэтому включение всегда идёт от клика. */
(function () {
  'use strict';
  const KEY = 'teached_sound';
  let ctx = null, master = null, noiseBuf = null;
  let amb = null;            // { theme, stop() }
  const HAS_AMBIENT = { halloween: 1, winter: 1, pixel: 1 };

  const enabled = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const now = () => ctx.currentTime;
  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(freq, t, dur, type = 'sine', peak = 0.2, dest = master) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    env(g, t, 0.01, peak, dur);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function noise(t, dur, filterType, freq, q, peak, dest = master) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, 0.01, peak, dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
    return { s, f, g };
  }

  /* ── голоса ── */
  function crow(t) {
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.38;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(520, s); o.frequency.exponentialRampToValueAtTime(310, s + 0.26);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 3;
      const g = ctx.createGain(); env(g, s, 0.02, 0.12, 0.26);
      o.connect(f).connect(g).connect(master); o.start(s); o.stop(s + 0.35);
      noise(s, 0.24, 'bandpass', 1800, 2, 0.05);
    }
  }
  function creak(t) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(150, t + 1.1);
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 22;
    const lg = ctx.createGain(); lg.gain.value = 30; lfo.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 9;
    const g = ctx.createGain(); env(g, t, 0.15, 0.09, 1.0);
    o.connect(f).connect(g).connect(master);
    o.start(t); lfo.start(t); o.stop(t + 1.3); lfo.stop(t + 1.3);
  }
  function bell(freq, t, peak = 0.12) {
    tone(freq, t, 1.6, 'sine', peak);
    tone(freq * 2.01, t, 0.9, 'sine', peak * 0.4);
    tone(freq * 3.02, t, 0.5, 'triangle', peak * 0.15);
  }
  function sleigh(t) {
    for (let i = 0; i < 14; i++) {
      const s = t + i * 0.085 + Math.random() * 0.02;
      noise(s, 0.07, 'bandpass', 7500, 4, 0.06);
      tone(2600 + Math.random() * 700, s, 0.08, 'sine', 0.025);
    }
  }

  /* ── атмосфера ── */
  function startAmbient(theme) {
    const timers = [];
    const nodes = [];
    const every = (min, max, fn) => {
      const go = () => { if (!amb || amb.theme !== theme) return; fn(now() + 0.05); timers.push(setTimeout(go, (min + Math.random() * (max - min)) * 1000)); };
      timers.push(setTimeout(go, (min / 2 + Math.random() * min / 2) * 1000));
    };
    if (theme === 'halloween') {
      // ветер: шум через полосовой фильтр, который медленно «дышит»
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.8;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
      const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg).connect(f.frequency);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(0.07, now() + 2);
      s.connect(f).connect(g).connect(master); s.start(); lfo.start();
      nodes.push(s, lfo, g);
      every(12, 26, t => (Math.random() < 0.6 ? crow : creak)(t));
    } else if (theme === 'pixel') {
      // тихий чиптюн: короткие арпеджио квадратной волной и редкие «блипы»
      const chords = [[261.63, 329.63, 392, 523.25], [220, 261.63, 329.63, 440], [174.61, 220, 261.63, 349.23], [196, 246.94, 293.66, 392]];
      let ci = 0;
      every(3.2, 4.4, t => { chords[ci++ % chords.length].forEach((f, i) => tone(f * 2, t + i * 0.11, 0.09, 'square', 0.018)); });
      every(6, 12, t => { const f = 1046.5 + Math.random() * 520; tone(f, t, 0.05, 'square', 0.02); tone(f * 1.5, t + 0.06, 0.05, 'square', 0.016); });
    } else if (theme === 'winter') {
      const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];   // пентатоника
      every(1.4, 3.4, t => { bell(scale[Math.floor(Math.random() * scale.length)], t, 0.05); if (Math.random() < 0.3) bell(scale[Math.floor(Math.random() * scale.length)], t + 0.35, 0.035); });
      every(14, 26, t => sleigh(t));
    }
    return () => {
      timers.forEach(clearTimeout);
      nodes.forEach(n => { try { if (n.gain) { n.gain.cancelScheduledValues(now()); n.gain.setValueAtTime(n.gain.value, now()); n.gain.exponentialRampToValueAtTime(0.0001, now() + 0.6); } else n.stop(now() + 0.7); } catch {} });
    };
  }
  function ambient(theme) {
    const want = theme && HAS_AMBIENT[theme] && enabled() ? theme : null;
    if (amb && amb.theme === want) return;
    if (amb) { amb.stop(); amb = null; }
    if (!want || !audio()) return;
    amb = { theme: want, stop: () => {} };
    amb.stop = startAmbient(want);
  }

  /* ── ответы ── */
  let lastFx = {};
  function fx(kind, theme) {
    if (!enabled() || !audio()) return;
    const t0 = performance.now();
    if (lastFx[kind] && t0 - lastFx[kind] < 280) return;   // одно событие - один звук
    lastFx[kind] = t0;
    const t = now() + 0.01;
    if (theme === 'halloween') {
      if (kind === 'correct') { tone(659, t, 0.35, 'sine', 0.16); const o = tone(988, t + 0.12, 0.5, 'sine', 0.14); o.frequency.linearRampToValueAtTime(1040, t + 0.6); }
      else if (kind === 'wrong') { const o = tone(220, t, 0.45, 'sawtooth', 0.09); o.frequency.exponentialRampToValueAtTime(90, t + 0.45); }
      else { [440, 523, 622, 740, 880].forEach((f, i) => tone(f, t + i * 0.12, 0.5, 'triangle', 0.12)); crow(t + 0.8); }
    } else if (theme === 'winter') {
      if (kind === 'correct') bell(1318.5, t, 0.16);
      else if (kind === 'wrong') { tone(196, t, 0.3, 'triangle', 0.12); noise(t, 0.12, 'lowpass', 500, 1, 0.08); }
      else { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, t + i * 0.16, 0.13)); sleigh(t + 0.7); }
    } else if (theme === 'pixel') {
      // 8-bit: square waves, like an arcade "coin", "bonk" and level-up
      if (kind === 'correct') { tone(988, t, 0.07, 'square', 0.06); tone(1319, t + 0.07, 0.22, 'square', 0.06); }
      else if (kind === 'wrong') { const o = tone(330, t, 0.28, 'square', 0.06); o.frequency.setValueAtTime(247, t + 0.1); o.frequency.setValueAtTime(165, t + 0.18); }
      else [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, t + i * 0.09, i === 4 ? 0.45 : 0.1, 'square', 0.055));
    } else {
      if (kind === 'correct') { tone(880, t, 0.25, 'sine', 0.14); tone(1320, t + 0.08, 0.3, 'sine', 0.1); }
      else if (kind === 'wrong') { const o = tone(240, t, 0.3, 'square', 0.05); o.frequency.exponentialRampToValueAtTime(140, t + 0.3); }
      else [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.13, 0.4, 'triangle', 0.12));
    }
  }

  /* ── кнопка ── */
  const btnHtml = cls => `<button type="button" class="${cls || ''} lt-sound${enabled() ? ' on' : ''}" title="Sound on / off" aria-pressed="${enabled()}">${enabled() ? '🔊' : '🔇'}</button>`;
  function toggle(theme) {
    const on = !enabled();
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {}
    if (on) { audio(); fx('correct', theme); }
    ambient(on ? theme : null);
    document.querySelectorAll('.lt-sound').forEach(b => { b.classList.toggle('on', on); b.textContent = on ? '🔊' : '🔇'; b.setAttribute('aria-pressed', String(on)); });
    return on;
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && amb) { amb.stop(); amb._paused = amb.theme; amb = null; } });

  window.TeachedSounds = { enabled, ambient, fx, toggle, btnHtml, hasAmbient: t => !!HAS_AMBIENT[t] };
})();
