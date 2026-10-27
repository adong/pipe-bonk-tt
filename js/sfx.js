/* TT Pipe Bonk: sound effects, all synth through Kit.sound (so the page's one mute switch covers them).
   PB.sfx.log counts every effect played, so tests can check sound in code while muted. */
(function () {
  'use strict';
  const S = Kit.sound;
  const log = {};
  const note = (name, fn) => (...a) => { log[name] = (log[name] || 0) + 1; fn(...a); };
  const spring = (f, vol, at) => { S.tone({ type: 'sine', f, to: f * 2.6, dur: 0.12, vol, at: at || 0 }); S.tone({ type: 'sine', f: f * 2.6, to: f * 1.2, dur: 0.22, vol: vol * 0.8, at: (at || 0) + 0.12 }); };
  PB.sfx = {
    log,
    jump: note('jump', () => S.jump()),
    land: note('land', () => S.tone({ f: 170, to: 95, dur: 0.07, vol: 0.1 })),
    bump: note('bump', () => { S.tone({ type: 'square', f: 140, to: 70, dur: 0.1, vol: 0.12, lp: 900 }); S.hiss({ f: 600, to: 200, dur: 0.12, vol: 0.06 }); }),
    flip: note('flip', () => spring(330, 0.12)),
    angry: note('angry', () => { S.tone({ type: 'sawtooth', f: 180, to: 140, dur: 0.18, vol: 0.08, lp: 900 }); S.tone({ type: 'sawtooth', f: 160, to: 120, dur: 0.18, vol: 0.07, at: 0.2, lp: 800 }); }),
    recover: note('recover', () => { for (let i = 0; i < 5; i++) S.tone({ type: 'square', f: 900 + i * 60, dur: 0.03, vol: 0.05, at: i * 0.05 }); }),
    kick: note('kick', () => { S.swish(); S.tone({ type: 'triangle', f: 520, to: 1300, dur: 0.18, vol: 0.12, at: 0.03 }); }),
    bye: note('bye', () => [880, 660].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.14, vol: 0.08, at: i * 0.15 }))),
    coin: note('coin', (n) => S.coin(n || 3)),
    coinOut: note('coinOut', () => S.tone({ type: 'sine', f: 300, to: 600, dur: 0.12, vol: 0.06 })),
    spawn: note('spawn', () => { S.tone({ type: 'sine', f: 220, to: 520, dur: 0.14, vol: 0.09 }); S.tone({ type: 'sine', f: 520, to: 260, dur: 0.12, vol: 0.06, at: 0.14 }); }),
    hit: note('hit', () => { S.tone({ f: 640, to: 180, dur: 0.35, vol: 0.16, type: 'triangle' }); for (let i = 0; i < 4; i++) S.tone({ f: 900 - i * 120, to: 1000 - i * 120, dur: 0.12, vol: 0.05, at: 0.35 + i * 0.13, type: 'sine' }); }),
    respawn: note('respawn', () => [1047, 1319, 1568].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.12, vol: 0.07, at: i * 0.08 }))),
    boing: note('boing', () => { spring(160, 0.2); spring(240, 0.12, 0.25); S.bump(); }),
    clear: note('clear', () => [523, 659, 784, 1047].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.22, vol: 0.14, at: i * 0.12 }))),
    perfect: note('perfect', () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.24, vol: 0.13, at: i * 0.13 }))),
    tick: note('tick', () => S.tone({ type: 'square', f: 1200, dur: 0.04, vol: 0.05 })),
    buddy: note('buddy', () => { S.tone({ f: 400, to: 900, dur: 0.15, vol: 0.12 }); S.hiss({ f: 2000, to: 500, dur: 0.25, vol: 0.08 }); }),
    treat: note('treat', () => S.coin(4)),
    hi5: note('hi5', () => { S.hiss({ filter: 'bandpass', f: 1800, dur: 0.08, vol: 0.25, q: 1 }); S.tone({ f: 880, to: 1320, dur: 0.15, vol: 0.08, at: 0.05 }); }),
    pop: note('pop', () => S.tone({ type: 'sine', f: 600, to: 1500, dur: 0.12, vol: 0.1 })),
    life: note('life', () => [784, 988, 1175, 1568].forEach((f, i) => S.tone({ type: 'square', f, dur: 0.1, vol: 0.06, at: i * 0.09 }))),
    go: note('go', () => { S.tone({ type: 'square', f: 660, dur: 0.1, vol: 0.07 }); S.tone({ type: 'square', f: 990, dur: 0.18, vol: 0.07, at: 0.12 }); }),
    gameOver: note('gameOver', () => [523, 440, 392, 523].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.25, vol: 0.12, at: i * 0.2 }))),
    click: note('click', () => S.click()),
  };
})();
