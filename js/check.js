/* TT Pipe Bonk: the headless check of the brief's rules, on the real rules in js/sim.js (no drawing).
   Runs in node (node tools/check.js) and in the page (game.check()).
   - bumpFlips: a bump from below flips the critter standing over that spot, on every floor, for every kind (a crab on
     NORMAL needs two bumps); one 2.6 m away stays upright; a jump with no slab overhead bumps nothing.
   - kickAndBonk: a flipped critter can be kicked off (it tumbles into a bottom pipe, waves, goes, +800, a coin rolls
     out); an upright one bumps you (a life, then a cloud at the top).
   - recoverTimer: a flipped critter flips back when its timer runs out (longer on EASY), faster and redder.
   - boingThree: the BOING block flips every critter on the floor, 3 times, then it's gone.
   - phaseEnds: a phase ends when every critter is gone (not while one is still waving or still to come); the bonus
     stage ends when every coin is grabbed or the time runs out.
   - wraps: brothers and critters walking off one side come in on the other, on the floor they were on.
   - plus the companion (unlimited, free BOING, protects you), 2 players (bumping your brother pops him up), and the
     autopilot clearing all 9 phases on EASY and NORMAL.
   fail() turns on one sabotage at a time (w.sab in js/sim.js) and each must be caught by its check. */
(function (root) {
  'use strict';
  const PB = (root.PB = root.PB || {});
  const S = () => PB.sim;
  const FY = () => PB.levels.FLOOR_Y;

  function world(o) {
    const w = S().create(Object.assign({ level: 'easy', seed: 5, go: true }, o || {}));
    w.queue = ['hold']; // one critter still to come (it never does) so the phase doesn't end under the check
    w.spawnT = 1e9;
    return w;
  }
  function run(w, inp, n, each) {
    const evs = [];
    for (let i = 0; i < n; i++) {
      S().step(w, typeof inp === 'function' ? inp(w, i) : inp);
      evs.push(...w.events);
      if (each && each(w, i) === false) break;
    }
    return evs;
  }
  const still = (c) => { c.dir = 1; c.hold = true; return c; };
  // critters in the checks stand still unless a check wants them walking: speed 0 through a tiny shim
  function freeze(w) {
    const orig = w.cfg;
    w.cfg = Object.assign({}, orig, { speed: 0 });
    return () => (w.cfg = orig);
  }
  const jumpOnce = (w, i) => (i === 0 ? { lr: 0, jump: true } : { lr: 0, jump: false });

  const checks = {
    bumpFlips(sab) {
      const bad = [];
      let n = 0;
      // [floor under the brother, x]: the critter stands on the floor above at x
      const spots = [[0, 6], [0, -8.5], [1, 5], [1, -4.5], [2, 4], [2, -3.5]];
      for (const level of ['easy', 'normal']) {
        for (const kind of ['beetle', 'crab', 'fly']) {
          for (const [f, x] of spots) {
            const w = world({ level, sabotage: sab });
            freeze(w);
            const c = still(S().addCritter(w, kind, f + 1, x, 1));
            c.hopT = 1e9; // a fly sitting on the floor
            const far = still(S().addCritter(w, 'beetle', f + 1, S().wrap(x + (x > 0 ? -2.6 : 2.6)), 1));
            if (!S().onFloor(f + 1, far.x)) far.x = S().wrap(x + (x > 0 ? 2.6 : -2.6));
            S().put(w, 0, f, x);
            const hits = kind === 'crab' && level === 'normal' ? 2 : 1;
            let evs = [];
            for (let h = 0; h < hits; h++) evs = evs.concat(run(w, jumpOnce, 70));
            n++;
            const bumped = evs.some((e) => e.type === 'bump' && e.f === f + 1);
            if (!bumped || c.st !== 'flip' || far.st !== 'walk') bad.push(`${level} ${kind} on floor ${f + 1} at ${x}: bumped ${bumped}, critter ${c.st}, the one 2.6 m away ${far.st}`);
            if (kind === 'crab' && level === 'normal') {
              const w2 = world({ level, sabotage: sab });
              freeze(w2);
              const c2 = still(S().addCritter(w2, 'crab', f + 1, x, 1));
              S().put(w2, 0, f, x);
              run(w2, jumpOnce, 70);
              if (c2.st !== 'walk' || !c2.angry) bad.push(`normal crab took one bump: ${c2.st}, angry ${c2.angry}`);
            }
          }
        }
      }
      // a jump where there's no slab overhead bumps nothing, and lands back
      const w = world({ sabotage: sab });
      S().put(w, 0, 0, 2.0);
      const evs = run(w, jumpOnce, 80);
      if (evs.some((e) => e.type === 'bump' || e.type === 'boing')) bad.push('a jump in the open bumped something');
      return { ok: !bad.length, info: bad.length ? bad.slice(0, 4).join('; ') : `${n} bumps flipped the critter over the spot (crabs on NORMAL after two), and never one 2.6 m away; a jump in the open bumps nothing` };
    },

    kickAndBonk(sab) {
      const bad = [];
      for (const level of ['easy', 'normal']) {
        for (const kind of ['beetle', 'crab', 'fly']) {
          // a flipped critter: walk into it
          let w = world({ level, sabotage: sab });
          freeze(w);
          const c = S().addCritter(w, kind, 0, 1.6, 1);
          c.st = 'flip'; c.flipT = 99;
          S().put(w, 0, 0, 0);
          const s0 = w.players[0].score;
          const evs = run(w, { lr: 1, jump: false }, 30);
          const kicked = evs.some((e) => e.type === 'kick');
          run(w, {}, Math.ceil((S().KICK_T + 0.1) * 60));
          const waving = w.critters.find((q) => q.id === c.id);
          const byeAtPipe = waving && waving.st === 'bye' && Math.abs(waving.x) > 9;
          run(w, {}, Math.ceil((S().BYE_T + 0.1) * 60));
          const gone = !w.critters.some((q) => q.id === c.id);
          const coin = evs.some((e) => e.type === 'coinOut');
          if (!kicked || !byeAtPipe || !gone || w.players[0].score - s0 < S().SCORE.kick || !coin || w.players[0].mode === 'bonked') {
            bad.push(`${level} flipped ${kind}: kicked ${kicked}, waved at a bottom pipe ${byeAtPipe}, then gone ${gone}, score +${w.players[0].score - s0}, coin ${coin}, brother ${w.players[0].mode}`);
          }
          // an upright critter walking into a brother bumps him: a life, then a cloud at the top
          w = world({ level, sabotage: sab });
          S().addCritter(w, kind, 0, 3, -1);
          S().put(w, 0, 0, 0);
          const lives = w.players[0].lives;
          const e2 = run(w, {}, 150);
          const hit = e2.some((e) => e.type === 'hit');
          run(w, {}, Math.ceil(S().BONK_T * 60) + 5);
          const p = w.players[0];
          if (!hit || p.lives !== lives - 1 || !(p.sup && p.sup.cloud)) bad.push(`${level} upright ${kind}: hit ${hit}, lives ${lives}→${p.lives}, on the cloud ${!!(p.sup && p.sup.cloud)}`);
        }
      }
      return { ok: !bad.length, info: bad.length ? bad.slice(0, 3).join('; ') : 'flipped critters get kicked into a bottom pipe (+800, a coin rolls out); upright ones bump you (one life, then a cloud), every kind, both levels' };
    },

    recoverTimer(sab) {
      const bad = [];
      const times = {};
      for (const level of ['easy', 'normal']) {
        const w = world({ level, sabotage: sab });
        const c = S().addCritter(w, 'beetle', 2, 0, 1);
        const v0 = S().speed(w, c);
        S().flipAll(w, null);
        const T = w.cfg.flip;
        times[level] = T;
        run(w, {}, Math.round((T - 0.25) * 60));
        const midway = c.st;
        let evs = run(w, {}, Math.round(0.6 * 60));
        const v1 = S().speed(w, c);
        if (midway !== 'flip' || c.st !== 'walk' || c.lvl !== 1 || !(v1 > v0) || !evs.some((e) => e.type === 'recover')) bad.push(`${level}: before the timer ${midway}, after ${c.st}, redder level ${c.lvl}, speed ${v0.toFixed(2)}→${v1.toFixed(2)}`);
        S().flipAll(w, null);
        evs = run(w, {}, Math.round((T + 0.5) * 60));
        const v2 = S().speed(w, c);
        if (c.lvl !== 2 || !(v2 > v1)) bad.push(`${level}: second flip-back level ${c.lvl}, speed ${v1.toFixed(2)}→${v2.toFixed(2)}`);
      }
      if (!(times.easy > times.normal)) bad.push(`EASY flips last ${times.easy} s, NORMAL ${times.normal} s`);
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : `flipped critters flip back after ${times.easy} s on EASY, ${times.normal} s on NORMAL, each time faster and redder` };
    },

    boingThree(sab) {
      const bad = [];
      for (const level of ['easy', 'normal']) {
        const w = world({ level, sabotage: sab });
        freeze(w);
        const cs = [[0, 6], [1, -7], [2, 3], [3, 7], [0, -5]].map(([f, x]) => still(S().addCritter(w, 'beetle', f, x, 1)));
        const fly = S().addCritter(w, 'fly', 2, -2, 1);
        fly.air = true; fly.y = FY()[2] + 1.2; fly.vy = 2; fly.hopT = 1e9; // in mid-hop
        const used = [];
        for (let k = 0; k < 4; k++) {
          cs.concat([fly]).forEach((c) => { c.st = 'walk'; c.flipT = 0; });
          if (k === 0) { fly.air = true; fly.y = FY()[2] + 1.2; fly.vy = 2; }
          S().put(w, 0, 0, 0);
          let top = 0;
          const evs = run(w, jumpOnce, 70, (ww) => { top = Math.max(top, ww.players[0].y); });
          const b = evs.find((e) => e.type === 'boing');
          const flipped = cs.filter((c) => c.st === 'flip').length + (fly.st === 'flip' ? 1 : 0);
          used.push(`${b ? 'BOING' : 'none'}:${flipped}`);
          if (k < 3 && (!b || flipped !== cs.length + 1 || w.block.left !== 2 - k)) bad.push(`${level} bump ${k + 1}: boing ${!!b}, flipped ${flipped}/${cs.length + 1}, left ${w.block.left}`);
          if (k === 3 && (b || flipped || top < 3.6)) bad.push(`${level} 4th bump: boing ${!!b}, flipped ${flipped}, jumped to ${top.toFixed(1)} m (the block should be gone)`);
        }
        if (level === 'easy' && !bad.length) {
          // a used-up block comes back for the next phase on EASY (NORMAL: after each bonus stage)
          w.pi = 1; S().loadPhase(w);
          if (w.block.left !== 3) bad.push(`EASY next phase: block ${w.block.left}`);
        }
      }
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : 'the BOING block flips every critter on the floor (a fly in mid-hop too) 3 times, then it is gone and a 4th jump goes up through the gap' };
    },

    phaseEnds(sab) {
      const bad = [];
      for (const level of ['easy', 'normal']) {
        const w = world({ level, sabotage: sab });
        freeze(w);
        w.queue = ['beetle'];
        const a = S().addCritter(w, 'beetle', 0, 4, 1), b = S().addCritter(w, 'beetle', 2, 0, 1);
        S().kick(w, a, w.players[0]);
        S().kick(w, b, w.players[0]);
        let evs = run(w, {}, Math.round((S().KICK_T + 0.3) * 60));
        if (evs.some((e) => e.type === 'clear')) bad.push(`${level}: cleared while critters were still waving`);
        evs = run(w, {}, Math.round((S().BYE_T + 0.3) * 60));
        if (evs.some((e) => e.type === 'clear') || w.phase !== 'play') bad.push(`${level}: cleared with one critter still to come`);
        w.queue = [];
        evs = run(w, {}, 3);
        const cleared = evs.some((e) => e.type === 'clear');
        evs = run(w, {}, Math.round((S().CLEAR_T + 0.2) * 60));
        if (!cleared || w.pi !== 1 || w.phase !== 'ready') bad.push(`${level}: every critter gone → cleared ${cleared}, phase ${w.pi + 1} ${w.phase}`);
        // the bonus stage: grab every coin → PERFECT; or the time runs out
        const wb = world({ level, sabotage: sab, phase: 2 });
        if (wb.kind !== 'bonus' || wb.coins.length !== 10) bad.push(`phase 3 is ${wb.kind} with ${wb.coins.length} coins`);
        const s0 = wb.players[0].score;
        wb.coins.forEach((k) => { S().put(wb, 0, k.f, k.x); wb.players[0].y = k.y - 0.5; S().step(wb, {}); });
        if (wb.phase !== 'clear' || wb.players[0].score - s0 < 10 * S().SCORE.coin + S().SCORE.perfect) bad.push(`${level} bonus: all coins → ${wb.phase}, +${wb.players[0].score - s0}`);
        const wt = world({ level, sabotage: sab, phase: 2 });
        evs = run(wt, {}, Math.round((wt.cfg.bonusTime + 0.2) * 60));
        if (!evs.some((e) => e.type === 'bonusEnd') || wt.phase !== 'clear') bad.push(`${level} bonus: time ran out → ${wt.phase}`);
      }
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : 'a phase ends only when every critter is gone (none waving, none still to come); bonus stages end on PERFECT or when time runs out' };
    },

    wraps(sab) {
      const bad = [];
      for (const [f, x, lr] of [[0, 9.7, 1], [0, -9.7, -1], [1, 9.6, 1], [1, -9.6, -1], [3, 9.7, 1], [3, -9.7, -1]]) {
        const w = world({ sabotage: sab });
        S().put(w, 0, f, x);
        run(w, { lr, jump: false }, 12);
        const p = w.players[0];
        if (!(Math.sign(p.x) === -Math.sign(x) && Math.abs(p.x) > 8.5 && p.mode === 'ground' && p.sup.f === f)) bad.push(`brother on floor ${f} at ${x} walking ${lr > 0 ? '→' : '←'}: x ${p.x.toFixed(2)}, ${p.mode} on floor ${p.sup && p.sup.f}`);
      }
      for (const [f, x, dir] of [[1, 9.8, 1], [3, -9.8, -1]]) {
        const w = world({ sabotage: sab });
        const c = S().addCritter(w, 'beetle', f, x, dir);
        run(w, {}, 40);
        if (!(Math.sign(c.x) === -Math.sign(x) && c.f === f && !c.air)) bad.push(`critter on floor ${f} at ${x}: x ${c.x.toFixed(2)} floor ${c.f}`);
      }
      // a jump across the edge
      const w = world({ sabotage: sab });
      S().put(w, 0, 0, 9.0);
      run(w, (ww, i) => ({ lr: 1, jump: i === 0 }), 60);
      if (!(w.players[0].x < -5 && w.players[0].x > -8.5 && w.players[0].mode === 'ground')) bad.push(`jump across the edge: x ${w.players[0].x.toFixed(2)} ${w.players[0].mode}`);
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : 'brothers (walking and jumping) and critters go off one side and come in on the other, on the same floor' };
    },

    companion(sab) {
      const bad = [];
      for (const level of ['easy', 'normal']) {
        const w = world({ level, sabotage: sab });
        freeze(w);
        const cs = [[1, 6], [2, -3], [3, 5]].map(([f, x]) => S().addCritter(w, 'beetle', f, x, 1));
        const near = S().addCritter(w, 'beetle', 0, 0.6, -1); // right next to him: he's protected
        S().put(w, 0, 0, 0);
        const lives = w.players[0].lives, left = w.block.left;
        if (!S().call(w)) bad.push('call refused');
        const evs = run(w, {}, Math.round((S().B_END + 0.2) * 60));
        const boing = evs.filter((e) => e.type === 'buddyBoing').length;
        if (boing !== 1 || cs.some((c) => c.st !== 'flip') || w.block.left !== left || evs.some((e) => e.type === 'hit') || w.players[0].lives !== lives || w.buddy) {
          bad.push(`${level}: boing ${boing}, flipped ${cs.filter((c) => c.st === 'flip').length}/3, block ${left}→${w.block.left}, hit ${evs.some((e) => e.type === 'hit')}, still here ${!!w.buddy}`);
        }
        // as often as you like: five calls in a row, five BOINGs
        const w5 = world({ level, sabotage: sab });
        freeze(w5);
        let n = 0;
        for (let k = 0; k < 5; k++) { S().addCritter(w5, 'beetle', 1, -6 + k, 1); if (S().call(w5)) n++; run(w5, {}, 20); }
        const e5 = run(w5, {}, 60 * 20);
        const b5 = e5.filter((e) => e.type === 'buddyBoing').length + (w5.buddy ? 0 : 0);
        if (n !== 5 || b5 < 4) bad.push(`${level}: 5 calls → ${n} accepted, ${b5} more BOINGs`);
        void near;
      }
      // 2 players: T is a high five
      const w2 = world({ players: ['teddy', 'tommy'], sabotage: sab });
      const s0 = w2.players.map((p) => p.score);
      S().call(w2);
      run(w2, {}, 10);
      if (!w2.buddy || w2.buddy.kind !== 'hi5' || w2.players.some((p, i) => p.score - s0[i] !== S().SCORE.hi5)) bad.push('2 players: no high five');
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : 'the brother comes every time he is called, bumps the BOING block for free (every critter flips) and nothing bonks you while he is here; 2 players: a high five' };
    },

    brotherPop(sab) {
      const bad = [];
      for (const [f, x] of [[0, 6], [1, 5], [2, -4]]) {
        const w = world({ players: ['teddy', 'tommy'], sabotage: sab });
        S().put(w, 0, f, x);
        S().put(w, 1, f + 1, x + 0.3);
        const l = w.players.map((p) => p.lives);
        let up = 0;
        const evs = run(w, (ww, i) => [{ lr: 0, jump: i === 0 }, { lr: 0, jump: false }], 120, (ww) => { up = Math.max(up, ww.players[1].y - FY()[f + 1]); });
        const q = w.players[1];
        if (!evs.some((e) => e.type === 'popBrother') || up < 0.5 || q.mode !== 'ground' || q.sup.f !== f + 1 || w.players.some((p, i) => p.lives !== l[i])) bad.push(`floor ${f + 1}: popped ${up.toFixed(2)} m, back on ${q.sup && q.sup.f} (${q.mode}), lives ${l}→${w.players.map((p) => p.lives)}`);
      }
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : 'bumping your brother from below just pops him up; he lands where he was and nobody loses a life' };
    },

    notStuck(sab) {
      const bad = [];
      // off the cloud after a bonk: walking off, or the cloud goes by itself
      for (const how of ['walk', 'wait', 'jump']) {
        const w = world({ sabotage: sab });
        const p = w.players[0];
        p.mode = 'bonked'; p.t = 0;
        run(w, {}, Math.ceil(S().BONK_T * 60) + 2);
        const onCloud = p.sup && p.sup.cloud;
        run(w, (ww, i) => (how === 'walk' ? { lr: 1 } : how === 'jump' ? { jump: i === 0 } : {}), 60 * 6);
        if (!onCloud || p.mode !== 'ground' || p.sup.cloud || p.y > FY()[3] - 1) bad.push(`cloud (${how}): was on it ${!!onCloud}, now ${p.mode} at y ${p.y.toFixed(1)}`);
      }
      // standing on the BOING block when it gets used up: he drops to the ground
      const w = world({ sabotage: sab });
      w.block.left = 1;
      const p = w.players[0];
      p.x = 0; p.y = PB.levels.BLOCK.yt; p.mode = 'ground'; p.sup = S().surfaces(w, p).find((s) => s.block);
      w.block.left = 0;
      run(w, {}, 60);
      if (p.mode !== 'ground' || p.sup.f !== 0 || p.y !== 0) bad.push(`on a used-up block: ${p.mode} y ${p.y.toFixed(2)}`);
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : 'the respawn cloud always lets go (walk, jump or wait 4 s); a used-up block drops you to the ground' };
    },

    autopilot(sab) {
      const bad = [];
      const info = [];
      for (const level of ['easy', 'normal']) {
        for (const seed of [1, 2]) {
          const w = S().create({ level, seed, sabotage: sab });
          w.players[0].safe = true; // the soak checks that every phase can be cleared, not the autopilot's dodging
          let pi = 0, t0 = 0, worst = 0;
          for (let i = 0; i < 60 * 60 * 20 && w.pi < 9; i++) {
            S().step(w, [PB.bot.decide(w, 0)]);
            if (w.pi !== pi) { worst = Math.max(worst, w.t - t0); pi = w.pi; t0 = w.t; }
            if (w.t - t0 > 240) break;
          }
          if (w.pi < 9) bad.push(`${level} seed ${seed}: stuck in phase ${w.pi + 1} (${w.critters.map((c) => c.kind + ' ' + c.st).join(', ')})`);
          else info.push(`${level}/${seed} ${Math.round(w.t)} s (longest phase ${Math.round(worst)} s)`);
        }
      }
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : `the autopilot clears all 9 phases: ${info.join(', ')}` };
    },
  };

  // each sabotage must be caught by its check
  const SABOTAGE = [
    ['noFlip', 'bumpFlips', 'bumps flip nothing'],
    ['wrongSpot', 'bumpFlips', 'a bump flips the whole floor, not the spot'],
    ['noKick', 'kickAndBonk', 'flipped critters cannot be kicked'],
    ['harmless', 'kickAndBonk', 'upright critters never bump you'],
    ['noRecover', 'recoverTimer', 'flipped critters never flip back'],
    ['boingForever', 'boingThree', 'the BOING block never runs out'],
    ['boingNone', 'boingThree', 'the BOING block flips nothing'],
    ['neverClear', 'phaseEnds', 'a phase never ends'],
    ['noWrap', 'wraps', 'the screen does not wrap'],
    ['lazyBuddy', 'companion', 'the brother never bumps the block'],
  ];

  function runAll(only) {
    const results = [];
    for (const name of Object.keys(checks)) {
      if (only && !only.includes(name)) continue;
      let r;
      try { r = checks[name](null); } catch (e) { r = { ok: false, info: 'threw ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e) }; }
      results.push({ name, ok: r.ok, info: r.info });
    }
    return { ok: results.every((r) => r.ok), results, failed: results.filter((r) => !r.ok).map((r) => r.name) };
  }
  function fail() {
    const caught = SABOTAGE.map(([sab, check, what]) => {
      let r;
      try { r = checks[check](sab); } catch (e) { r = { ok: false, info: 'threw ' + e }; }
      return { sabotage: sab, what, check, caught: !r.ok, failed: [r.info] };
    });
    return { ok: caught.every((c) => c.caught), caught };
  }
  PB.check = { run: runAll, fail, checks, SABOTAGE };
})(typeof window !== 'undefined' ? window : globalThis);
