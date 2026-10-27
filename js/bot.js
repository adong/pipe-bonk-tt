/* TT Pipe Bonk: the autopilot. It plays the title-screen demo and the checks' "every phase can be cleared" soak.
   It picks a target (a flipped critter to kick, a coin, or a spot under an upright critter to bump), walks there
   the way the floor goes (round the wrap when the floor carries on across it), and changes floors at fixed spots:
   it jumps up where there is no slab overhead, and walks off a slab's end to go down. It never reads keys. */
(function (root) {
  'use strict';
  const PB = (root.PB = root.PB || {});
  const S = () => PB.sim;
  const FY = PB.levels.FLOOR_Y;
  // jump up from floor f to f + 1: stand at x and jump pressing dir (no slab overhead there)
  const UP = [
    [{ x: -2.3, dir: -1 }, { x: 2.3, dir: 1 }],
    [{ x: -7.6, dir: 1 }, { x: 7.6, dir: -1 }],
    [{ x: -1.3, dir: -1 }, { x: 1.3, dir: 1 }],
  ];
  // go down from floor f: walk to x, keep pressing dir and drop off the end
  const DOWN = [null,
    [{ x: -3.4, dir: 1 }, { x: 3.4, dir: -1 }],
    [{ x: -6.3, dir: -1 }, { x: 6.3, dir: 1 }],
    [{ x: -2.6, dir: 1 }, { x: 2.6, dir: -1 }],
  ];
  const mems = new WeakMap();
  function mem(w, i) {
    let m = mems.get(w);
    if (!m) mems.set(w, (m = [{ airLr: 0 }, { airLr: 0 }]));
    return m[i];
  }
  function pathOk(f, x, d) {
    const n = Math.ceil(Math.abs(d) / 0.4);
    for (let k = 1; k < n; k++) if (!S().onFloor(f, S().wrap(x + (d * k) / n), 0.25)) return false;
    return true;
  }
  // which way to walk along floor f from x to tx, staying on the floor (null if there's no way)
  function pathDx(f, x, tx) {
    const d1 = S().wdx(tx, x);
    const d2 = d1 - Math.sign(d1 || 1) * 20;
    for (const d of Math.abs(d1) <= Math.abs(d2) ? [d1, d2] : [d2, d1]) if (pathOk(f, x, d)) return d;
    return null;
  }
  const cost = (f, x, tf, tx) => {
    if (tf === f) { const d = pathDx(f, x, tx); return d === null ? 40 : Math.abs(d); }
    return Math.abs(tf - f) * 7 + Math.abs(S().wdx(tx, x)) * 0.5;
  };

  function targets(w, p, f) {
    const out = [];
    const sim = S();
    for (const c of w.critters) {
      if (c.st === 'flip') out.push({ f: c.f, x: c.x, act: 'kick', c, w: -3 });
      else if (c.st === 'walk' && !c.air && c.f >= 1) {
        const x = sim.wrap(c.x + c.dir * sim.speed(w, c) * 0.12);
        const above = PB.levels.SEGS.some((s) => s.f === c.f && sim.inSeg(x, s, -sim.HEAD_IN - 0.15));
        if (above && sim.onFloor(c.f - 1, x, 0)) out.push({ f: c.f - 1, x, act: 'bump', c, w: 0 });
      }
    }
    for (const k of w.coins) {
      if (k.st === 'gone' || k.st === 'out' || k.air) continue;
      const high = k.y - FY[k.f] > 1.5;
      out.push({ f: k.f, x: k.x, act: high ? 'jumpAt' : 'walk', w: -1 });
    }
    const ground = w.critters.filter((c) => c.st === 'walk' && c.f === 0 && !c.air).length;
    const upright = w.critters.filter((c) => c.st === 'walk' || c.st === 'out').length;
    if (w.block.left > 0 && (ground >= 2 || upright >= 4)) out.push({ f: 0, x: 0, act: 'bump', boing: true, w: -2 });
    let best = null, bc = 1e9;
    for (const t of out) {
      const k = cost(f, p.x, t.f, t.x) + t.w;
      if (k < bc) { bc = k; best = t; }
    }
    if (!best && ground && w.block.left > 0) best = { f: 0, x: 0, act: 'bump', boing: true };
    return best || { f: 1, x: p.x < 0 ? -5 : 5, act: 'wait' };
  }

  function decide(w, i) {
    i = i || 0;
    const p = w.players[i];
    const m = mem(w, i);
    const none = { lr: 0, jump: false };
    if (!p || p.out || p.mode === 'bonked' || w.phase !== 'play') return none;
    if (p.mode !== 'ground') return { lr: m.airLr, jump: false };
    if (p.sup.block) { m.airLr = p.x >= 0 ? 1 : -1; return { lr: m.airLr, jump: false }; }
    if (p.sup.cloud) { m.airLr = p.x >= 0 ? 1 : -1; return { lr: m.airLr, jump: false }; }
    const f = p.sup.f;
    const t = targets(w, p, f);
    m.target = t;
    if (t.f === f) {
      const d = pathDx(f, p.x, t.x);
      const dir = d === null ? Math.sign(S().wdx(t.x, p.x)) : Math.sign(d);
      if (t.act === 'bump' || t.act === 'jumpAt') {
        if (Math.abs(d === null ? 9 : d) < 0.35) { m.airLr = 0; return { lr: 0, jump: true }; }
        m.airLr = 0;
        return { lr: dir, jump: false };
      }
      if (t.act === 'wait') return Math.abs(d || 0) < 0.4 ? none : { lr: dir, jump: false };
      m.airLr = dir;
      return { lr: dir || p.face, jump: false };
    }
    const spots = t.f > f ? UP[f] : DOWN[f];
    let s = spots[0], sd = pathDx(f, p.x, spots[0].x);
    const d2 = pathDx(f, p.x, spots[1].x);
    if (sd === null || (d2 !== null && Math.abs(d2) < Math.abs(sd))) { s = spots[1]; sd = d2; }
    if (sd === null) return { lr: p.face, jump: false };
    if (t.f > f) {
      if (Math.abs(sd) < 0.2) { m.airLr = s.dir; return { lr: s.dir, jump: true }; }
      m.airLr = 0;
      return { lr: Math.sign(sd), jump: false };
    }
    m.airLr = s.dir;
    if (Math.abs(sd) < 0.3 || (Math.sign(sd) === -s.dir && Math.abs(sd) < 1.2)) return { lr: s.dir, jump: false }; // there, or past it: keep going off the end
    return { lr: Math.sign(sd), jump: false };
  }

  PB.bot = { decide, pathDx, UP, DOWN, mem };
})(typeof window !== 'undefined' ? window : globalThis);
