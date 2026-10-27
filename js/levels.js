/* TT Pipe Bonk: the one screen of floors and the list of phases. Shared by the rules (js/sim.js), the art (js/art.js),
   the autopilot (js/bot.js) and the checks. Units are metres; x runs -10..10 and wraps, y is up, the ground is y = 0.
   - Each floor is one or more slabs. A slab that touches the edge carries on across the wrap on the other side.
   - Pipes sit at the top corners (critters and coins come out) and the bottom corners (they go home).
   - The BOING block hangs in the middle gap over the ground. */
(function (root) {
  'use strict';
  const PB = (root.PB = root.PB || {});
  const FLOOR_Y = [0, 3.4, 6.8, 10.2];
  const SEGS = [
    { f: 0, y: FLOOR_Y[0], x0: -10, x1: 10 },
    { f: 1, y: FLOOR_Y[1], x0: -10, x1: -3.2 },
    { f: 1, y: FLOOR_Y[1], x0: 3.2, x1: 10 },
    { f: 2, y: FLOOR_Y[2], x0: -6.5, x1: 6.5 },
    { f: 3, y: FLOOR_Y[3], x0: -10, x1: -2.4 },
    { f: 3, y: FLOOR_Y[3], x0: 2.4, x1: 10 },
  ];
  SEGS.forEach((s, i) => (s.i = i));
  // the bonus stage's coins: [floor, x, height over that floor]; the last one hangs over the top gap (jump from the middle floor)
  const BONUS = [[3, -6.5, 0.75], [3, 6.5, 0.75], [2, -4, 0.75], [2, 0, 0.75], [2, 4, 0.75], [1, -7.5, 0.75], [1, 7.5, 0.75], [0, -5.5, 0.75], [0, 5.5, 0.75], [2, 0, 4.4]];
  const PHASES = [
    { crit: ['beetle', 'beetle', 'beetle'] },
    { crit: ['beetle', 'beetle', 'beetle', 'beetle'] },
    { bonus: true },
    { crit: ['crab', 'crab', 'crab'] },
    { crit: ['beetle', 'crab', 'beetle', 'crab'] },
    { bonus: true },
    { crit: ['fly', 'fly', 'fly'] },
    { crit: ['beetle', 'fly', 'crab', 'fly', 'beetle'] },
    { bonus: true },
  ];
  PB.levels = {
    HALF: 10,
    WIDE: 20,
    TH: 0.45, // slab thickness: a slab's underside is TH below its top
    FLOOR_Y,
    SEGS,
    BLOCK: { x0: -0.75, x1: 0.75, yb: 2.3, yt: 3.3 },
    CLOUD: { x0: -1.2, x1: 1.2, y: FLOOR_Y[3] },
    PIPE_X: 9.3, // the pipes' mouths: critters come out of the top ones and go into the bottom ones here
    BONUS,
    PHASES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
