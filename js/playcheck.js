/* TT Pipe Bonk: the play check with real keys and taps, in the page: game.playCheck().
   Everything here presses keys with real keydown/keyup events on window and taps the touch buttons with pointer
   events, so it goes through the same input code a kid's fingers do (never the autopilot). Time moves with
   game.step, which runs the same frame code as the browser's own frames. Positions are read on the screen.
   - direction: → moves right and ← moves left on screen, on all 9 phases and all 4 floors, for Teddy, Tommy and both
     brothers in 2 players (each with his own keys, and only his), with keys and with the touch buttons; jump goes
     up the screen and lands back.
   - the game itself with real keys: a jump under a critter flips it, walking into it kicks it, the edge wraps.
   - nothing leaves him stuck: the respawn cloud (walk, jump or wait), a key held through pause, a lost window, a
     cancelled touch, being popped by his brother, a used-up BOING block under his feet, the brother's visit, the
     next phase and the bonus stage, and a "keyboard kid" mashing keys on every phase.
   game.playCheck('mirror') and game.playCheck('stuckCloud') prove the check fails when the controls are wrong. */
(function () {
  'use strict';
  const NAMES = { ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', Space: ' ', KeyT: 't', KeyP: 'p', KeyA: 'a', KeyD: 'd', KeyW: 'w', KeyS: 's', KeyF: 'f', KeyM: 'm' };
  const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: NAMES[code] || code, bubbles: true, cancelable: true }));
  const step = (s) => game.step(s, { draw: false });
  const st = () => game.state();
  const pl = (i) => st().players[i || 0];
  function press(code, secs) {
    key(code, true);
    step(secs);
    key(code, false);
    step(1 / 60);
  }
  const button = (p, a) => [...document.querySelectorAll(`#touch [data-a="${a}"]`)].find((b) => (a === 'call' || +b.dataset.p === p) && b.offsetParent);
  function tap(p, a, secs, cancel) {
    const el = button(p, a);
    if (!el) return false;
    const o = { pointerId: 20 + p * 3 + 'lrj'.indexOf(a), bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: p === 0 };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    step(secs);
    el.dispatchEvent(new PointerEvent(cancel ? 'pointercancel' : 'pointerup', o));
    step(1 / 60);
    return true;
  }
  function fresh(phase, o) {
    game.start(Object.assign({ phase, go: true, level: 'easy', players: 1, who: 'teddy' }, o || {}));
    game.quiet();
    return st();
  }
  // a roomy spot on each floor: room both ways, no slab end or edge close by
  const SPOT = [[0, -5.5], [1, -6.6], [2, 0.4], [3, 6.2]];

  function run(sab) {
    const results = [];
    const ok = (name, pass, info) => results.push({ name, ok: !!pass, info });
    const wasHold = game.G.hold;
    game.hold(true);
    const hadTouch = document.body.classList.contains('touch');
    game.sabotage(sab || null);
    try {
      // ---------- direction on every phase and floor, each brother, keys and touch ----------
      const setups = [['teddy', 1, 0, ['ArrowRight', 'ArrowLeft', 'Space']], ['teddy', 1, 0, ['KeyD', 'KeyA', 'KeyW']], ['tommy', 1, 0, ['ArrowRight', 'ArrowLeft', 'ArrowUp']],
        ['teddy', 2, 0, ['KeyD', 'KeyA', 'KeyW']], ['teddy', 2, 1, ['ArrowRight', 'ArrowLeft', 'ArrowUp']]];
      for (let phase = 0; phase < 9; phase++) {
        for (const [who, players, i, keys] of setups) {
          for (const how of ['keys', 'touch']) {
            if (how === 'touch' && keys[0] === 'KeyD' && players === 1) continue;
            document.body.classList.toggle('touch', how === 'touch');
            fresh(phase, { who, players });
            const tag = `${players === 2 ? '2P ' + pl(i).who : who} phase ${phase + 1} ${how}${how === 'keys' ? ' ' + keys[0] : ''}`;
            const bad = [];
            for (const [f, x] of SPOT) {
              game.put(i, f, x);
              if (players === 2) game.put(1 - i, f === 0 ? 1 : 0, f === 0 ? 7.5 : 5);
              step(0.05);
              let a = pl(i), o0 = players === 2 ? pl(1 - i) : null;
              if (how === 'keys') press(keys[0], 0.4); else tap(i, 'r', 0.4);
              let b = pl(i);
              const right = b.sx - a.sx > 25 && b.x > a.x;
              const otherStill = !o0 || Math.abs(pl(1 - i).x - o0.x) < 0.01;
              game.put(i, f, x);
              step(0.05);
              a = pl(i);
              if (how === 'keys') press(keys[1], 0.4); else tap(i, 'l', 0.4);
              b = pl(i);
              const left = b.sx - a.sx < -25 && b.x < a.x;
              if (!right || !left || !otherStill) bad.push(`floor ${f}: → ${right ? 'right' : 'WRONG'}, ← ${left ? 'left' : 'WRONG'}${otherStill ? '' : ', moved his brother too'}`);
            }
            ok(`dir ${tag}`, !bad.length, bad.length ? bad.join('; ') : '→ right and ← left on all 4 floors');
            // jump: up the screen, then back down on the floor (in the middle gap, nothing overhead)
            game.put(i, 0, 1.8);
            step(0.05);
            const j0 = pl(i);
            if (how === 'keys') press(keys[2], 0.05); else tap(i, 'j', 0.05);
            step(0.2);
            const j1 = pl(i);
            step(1.3);
            const j2 = pl(i);
            ok(`jump ${tag}`, j1.sy < j0.sy - 20 && j2.mode === 'ground' && Math.abs(j2.sy - j0.sy) < 4, `${j0.sy}→${j1.sy}→${j2.sy} px`);
          }
        }
      }
      document.body.classList.toggle('touch', hadTouch);

      // ---------- the game itself with real keys: bump, kick, wrap ----------
      for (const level of ['easy', 'normal']) {
        fresh(0, { level });
        const c = game.critter('beetle', 1, -6.6, 1);
        game.world().cfg = Object.assign({}, game.world().cfg, { speed: 0 });
        game.put(0, 0, -6.6);
        press('Space', 0.05);
        step(0.6);
        const flipped = c.st === 'flip';
        c.st = 'flip'; c.f = 0; c.x = -3.6; c.y = 0; c.air = false; c.flipT = 99;
        game.put(0, 0, -5.2);
        press('ArrowRight', 0.5);
        const kicked = c.st === 'kicked' || c.st === 'bye';
        ok(`bump and kick ${level}`, flipped && kicked, `Space under it: ${flipped ? 'flipped' : 'NOT flipped'}; → into it: ${kicked ? 'kicked' : c.st}`);
      }
      for (const [f, x, k, sign] of [[0, 9.3, 'ArrowRight', 1], [0, -9.3, 'ArrowLeft', -1], [3, 9.3, 'ArrowRight', 1], [1, -9.3, 'ArrowLeft', -1]]) {
        fresh(0);
        game.put(0, f, x);
        step(0.05);
        const a = pl();
        key(k, true);
        step(0.3);
        const b = pl();
        step(0.2);
        const c2 = pl();
        key(k, false);
        step(1 / 60);
        const wrapped = Math.sign(b.x) === -sign && (sign > 0 ? b.sx < a.sx - 200 : b.sx > a.sx + 200);
        const keepsGoing = sign > 0 ? c2.sx > b.sx + 10 : c2.sx < b.sx - 10;
        ok(`wrap floor ${f} ${k}`, wrapped && keepsGoing && c2.f === f, `x ${a.x}→${b.x}→${c2.x}, screen ${a.sx}→${b.sx}→${c2.sx} px, floor ${c2.f}`);
      }

      // ---------- nothing leaves him stuck ----------
      const moves = (i, label) => {
        const P = () => pl(i || 0);
        const k = st().two ? (i ? ['ArrowRight', 'ArrowLeft'] : ['KeyD', 'KeyA']) : ['ArrowRight', 'ArrowLeft'];
        let a = P();
        press(k[0], 0.3);
        let b = P();
        const r = b.x !== a.x && b.mode !== 'bonked';
        a = P();
        press(k[1], 0.3);
        b = P();
        const l = b.x !== a.x;
        return { pass: r && l, info: `${label}: → ${r ? 'moves' : 'STUCK'}, ← ${l ? 'moves' : 'STUCK'} (${b.mode}${b.cloud ? ' on the cloud' : ''})` };
      };
      // the respawn cloud: walk off, jump off, or wait for it to go
      for (const how of ['walk', 'jump', 'wait', 'touch']) {
        document.body.classList.toggle('touch', how === 'touch');
        fresh(0);
        game.critter('beetle', 0, -1.2, -1);
        game.put(0, 0, -2.5);
        step(0.8);
        const hit = pl().mode === 'bonked';
        step(1.6);
        const onCloud = pl().cloud;
        if (how === 'walk') press('ArrowRight', 0.6);
        else if (how === 'jump') press('Space', 0.05);
        else if (how === 'touch') tap(0, 'r', 0.6);
        step(how === 'wait' ? 5 : 1.5);
        const p = pl();
        const off = !p.cloud && p.mode === 'ground' && p.f === 2;
        game.quiet();
        const m = moves(0, 'after');
        ok(`cloud ${how}`, hit && onCloud && off && m.pass, `bonked ${hit}, on the cloud ${onCloud}, then ${p.mode} on floor ${p.f}; ${m.info}`);
      }
      document.body.classList.toggle('touch', hadTouch);
      // a key held through pause stops when the game goes on, and the keys still work
      fresh(0);
      game.put(0, 0, -5.5);
      key('ArrowRight', true);
      step(0.2);
      press('KeyP', 0.05);
      const paused = st().paused;
      key('ArrowRight', false);
      press('KeyP', 0.05);
      const a0 = pl();
      step(0.4);
      const a1 = pl();
      const m1 = moves(0, 'after pause');
      ok('key held through pause', paused && Math.abs(a1.x - a0.x) < 0.01 && m1.pass, `paused ${paused}, drift after resume ${(a1.x - a0.x).toFixed(2)} m; ${m1.info}`);
      // the window loses focus with a key down
      fresh(0);
      game.put(0, 0, -5.5);
      key('ArrowRight', true);
      step(0.2);
      dispatchEvent(new Event('blur'));
      const b0 = pl();
      step(0.4);
      const b1 = pl();
      key('ArrowRight', false);
      const m2 = moves(0, 'after blur');
      ok('lost window', Math.abs(b1.x - b0.x) < 0.01 && m2.pass, `drift ${(b1.x - b0.x).toFixed(2)} m; ${m2.info}`);
      // a cancelled touch lets go
      document.body.classList.add('touch');
      fresh(0);
      game.put(0, 0, -5.5);
      tap(0, 'r', 0.2, true);
      const c0 = pl();
      step(0.4);
      const c1 = pl();
      ok('cancelled touch', Math.abs(c1.x - c0.x) < 0.01, `drift ${(c1.x - c0.x).toFixed(2)} m after pointercancel`);
      document.body.classList.toggle('touch', hadTouch);
      // 2 players: Tommy bumps the floor under Teddy: Teddy pops up, lands, and walks on
      fresh(0, { players: 2 });
      game.put(0, 1, -6.6);
      game.put(1, 0, -6.6);
      const lives0 = pl(0).lives;
      press('ArrowUp', 0.05);
      step(0.15);
      const popped = pl(0).y > 3.6;
      step(1.2);
      const m3 = moves(0, 'Teddy after the pop');
      ok('popped by his brother', popped && pl(0).mode === 'ground' && pl(0).f === 1 && m3.pass && pl(0).lives === lives0, `popped ${popped}, back on floor ${pl(0).f}; ${m3.info}`);
      // standing on the BOING block when it's used up
      fresh(0);
      game.put(0, 0, -1.4);
      key('ArrowRight', true);
      press('Space', 0.05);
      step(0.18);
      key('ArrowRight', false);
      step(0.9);
      const onBlock = pl().block;
      game.world().block.left = 1;
      game.put(0, 0, 0);
      press('Space', 0.05);
      step(1.2);
      const m4 = moves(0, 'after the last BOING');
      ok('block used up', onBlock && st().block === 0 && pl().mode === 'ground' && m4.pass, `stood on the block ${onBlock}, block left ${st().block}; ${m4.info}`);
      // the brother's visit: keys work all the way through
      fresh(0);
      game.put(0, 0, -5.5);
      press('KeyT', 0.05);
      const visiting = !!st().buddy;
      const m5 = moves(0, 'while he visits');
      step(3);
      const m6 = moves(0, 'after he goes');
      ok('companion visit', visiting && m5.pass && m6.pass, `${m5.info}; ${m6.info}`);
      // the next phase and the bonus stage
      fresh(1);
      game.world().queue = [];
      step(0.2);
      const cleared = st().phase === 'clear';
      step(4.5);
      const m7 = moves(0, `phase ${st().pi + 1}`);
      ok('next phase (bonus)', cleared && st().kind === 'bonus' && st().phase === 'play' && m7.pass, `cleared ${cleared}, now ${st().kind} ${st().phase}; ${m7.info}`);
      // the keyboard kid: mashing keys on every phase, then → and ← still work
      const KID = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyT', 'KeyJ', 'KeyX', 'KeyQ', 'KeyF'];
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let phase = 0; phase < 9; phase++) {
        for (const players of [1, 2]) {
          game.start({ phase, go: true, level: phase % 2 ? 'normal' : 'easy', players, who: phase % 3 ? 'teddy' : 'tommy' });
          game.world().players.forEach((p) => (p.lives = 99)); // he may get bonked a lot: that's play, not stuck
          const down = new Set();
          for (let s = 0; s < 240; s++) {
            const k = KID[Math.floor(rnd() * KID.length)];
            if (down.has(k)) { key(k, false); down.delete(k); } else { key(k, true); down.add(k); }
            step(0.05 + rnd() * 0.08);
          }
          for (const k of down) key(k, false);
          step(0.1);
          if (st().screen !== 'play') { ok(`keyboard kid phase ${phase + 1} ${players}P`, false, `left the game: ${st().screen}`); continue; }
          game.quiet();
          step(2);
          for (let s = 0; s < 80 && st().phase !== 'play'; s++) step(0.1); // the bonus timer may have run out: wait for the next phase
          const ws = st().players.map((p, i) => ({ i, p })).filter((o) => !o.p.out);
          const res = ws.map((o) => moves(o.i, `${o.p.who}`));
          const sane = st().players.every((p) => Number.isFinite(p.x) && p.y > -0.01 && p.y < 12.5);
          ok(`keyboard kid phase ${phase + 1} ${players}P`, res.every((r) => r.pass) && sane, res.map((r) => r.info).join('; '));
        }
      }
    } catch (e) {
      ok('no errors', false, String(e && e.stack || e));
    } finally {
      game.sabotage(null);
      document.body.classList.toggle('touch', hadTouch);
      game.showTitle();
      game.hold(wasHold);
    }
    const failed = results.filter((r) => !r.ok);
    return { ok: !failed.length, total: results.length, failed: failed.map((r) => `${r.name}: ${r.info}`), results };
  }
  game.playCheck = run;
  // both sabotages must make the play check fail
  game.playCheck.prove = () => ['mirror', 'stuckCloud'].map((s) => { const r = run(s); return { sabotage: s, caught: !r.ok, failed: r.failed.length }; });
})();
