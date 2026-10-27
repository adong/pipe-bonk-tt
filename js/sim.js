/* TT Pipe Bonk: the rules, with no drawing, in fixed 1/60 s steps (the page, the autopilot and the checks all run these).
   - Brothers walk, jump and wrap around the screen. A jump under a slab bumps it: the critter standing over that spot
     flips onto its back (a crab on NORMAL needs two bumps). Run into a flipped critter to kick it: it tumbles into a
     bottom pipe and waves goodbye, and a coin rolls out of a top pipe. Touching an upright critter bonks you (a life).
   - A flipped critter flips back after a while, faster and redder. The BOING block flips every critter on the floor,
     3 times. A phase ends when every critter is gone. Every third phase is a bonus stage: grab the coins.
   - 2 players play together; bumping your brother from below just pops him up. In 1 player the other brother can be
     called any time: he bumps the BOING block for you (free), and nothing can bonk you while he's here.
   w.sab (the check's sabotages) breaks one rule on purpose so js/check.js can prove it notices. */
(function (root) {
  'use strict';
  const PB = (root.PB = root.PB || {});
  const LV = PB.levels;
  const { HALF, WIDE, TH, FLOOR_Y, SEGS, BLOCK, CLOUD, PIPE_X } = LV;
  const DT = 1 / 60;
  const PH = 1.3, PW = 0.36; // a brother's height and half width
  const GRAV = 32, JV = 16.2; // the jump tops out about 4.1 m up: over the next floor (3.4 m) with room to land
  const AIR_ACC = 34, JUMP_BUF = 0.13, COYOTE = 0.08;
  const HEAD_IN = 0.1, FOOT_OUT = 0.32; // a head bumps a slab only 0.1 m inside it; feet stand 0.32 m past its end
  const CW = 0.42, CH = 0.72; // a critter's half width and height
  const CRIT_G = 26, FLY_G = 14, FLY_V = 5.6;
  const BUMP_R = 1.05; // a bump flips critters this close to the spot
  const READY = 1.4, CLEAR_T = 2.8, BONK_T = 1.5, CLOUD_T = 4, KICK_T = 0.95, BYE_T = 1.3, PIPE_T = 1.1;
  const B_TREAT = 0.6, B_GO = 1.0, B_BOING = 1.75, B_END = 2.6; // the brother's visit
  const TREATS = ['🍦', '💧', '🧃', '🍪', '🍉', '🍌'];
  const SPEED = { beetle: 1.7, crab: 2.0, fly: 1.9, coin: 2.6 };
  const SCORE = { flip: 10, kick: 800, coin: 800, perfect: 3000, treat: 100, hi5: 50 };
  const CFG = {
    easy: { lives: 5, walk: 4.6, speed: 0.7, speedUp: 0.25, flip: 9, spawn: 3.6, bonusTime: 30, crabHits: 1, refillEvery: 1 },
    normal: { lives: 3, walk: 5, speed: 1, speedUp: 0.35, flip: 5.5, spawn: 2.6, bonusTime: 20, crabHits: 2, refillEvery: 3 },
  };

  const wrap = (x) => ((((x + HALF) % WIDE) + WIDE) % WIDE) - HALF;
  const wdx = (a, b) => wrap(a - b); // a - b the short way round
  const wdist = (a, b) => Math.abs(wdx(a, b));
  // is x on slab s (with margin m; a slab touching the edge carries on across the wrap)
  function inSeg(x, s, m) {
    for (const xx of [x, x + WIDE, x - WIDE]) if (xx >= s.x0 - m && xx <= s.x1 + m) return true;
    return false;
  }
  const onFloor = (f, x, m) => SEGS.some((s) => s.f === f && inSeg(x, s, m || 0));
  const ev = (w, type, o) => w.events.push(Object.assign({ type }, o));

  function create(o) {
    o = o || {};
    const level = o.level === 'normal' ? 'normal' : 'easy';
    const cfg = CFG[level];
    const who = o.players || ['teddy'];
    const w = {
      level, cfg, two: who.length === 2, t: 0, phase: 'ready', phaseT: 0, pi: o.phase || 0, round: 1, kind: 'critters',
      players: who.map((id, i) => newPlayer(id, i, cfg.lives)), critters: [], coins: [], queue: [], cid: 0, coinId: 0,
      spawnT: 0, spawnSide: 1, coinSide: -1, block: { left: 3, hitT: 9 }, bonusT: 0, bonusGot: 0, bonusAll: 0,
      buddy: null, calls: 0, buddyFor: o.buddyFor || ((id) => (id === 'tommy' ? 'teddy' : 'tommy')), events: [], sab: o.sabotage || null,
      seed: o.seed || 1,
    };
    loadPhase(w, true);
    w.spawnSide = w.seed % 2 ? 1 : -1;
    if (o.go) { w.phase = 'play'; w.phaseT = 0; }
    w.events = [];
    return w;
  }
  function newPlayer(who, i, lives) {
    return { i, who, score: 0, lives, out: false, extra: false, x: 0, y: 0, vx: 0, vy: 0, face: 1, mode: 'ground', sup: SEGS[0], jb: 0, coyote: 0, inv: 0, t: 0, cloudT: 0, walkT: 0, kicks: 0, safe: false };
  }
  function startX(w, p) { return w.two ? (p.i ? 2.5 : -2.5) : -2.5; }

  function loadPhase(w, first) {
    const P = LV.PHASES[w.pi % LV.PHASES.length];
    w.round = Math.floor(w.pi / LV.PHASES.length) + 1;
    w.kind = P.bonus ? 'bonus' : 'critters';
    w.queue = P.bonus ? [] : P.crit.slice();
    w.critters = [];
    w.coins = [];
    w.spawnT = 0.6;
    w.spawnSide = 1;
    if (P.bonus) {
      w.coins = LV.BONUS.map(([f, x, h]) => ({ id: ++w.coinId, walk: false, f, x, y: FLOOR_Y[f] + h, st: 'still' }));
      w.bonusT = w.cfg.bonusTime;
      w.bonusGot = 0;
      w.bonusAll = w.coins.length;
    }
    if (first || w.pi % w.cfg.refillEvery === 0) w.block.left = 3;
    for (const p of w.players) {
      if (p.mode === 'bonked') loseLife(w, p);
      if (p.out) continue;
      p.x = startX(w, p); p.y = 0; p.vx = p.vy = 0; p.mode = 'ground'; p.sup = SEGS[0]; p.cloudT = 0; p.jb = 0; p.face = p.x < 0 ? 1 : -1;
    }
    w.phase = 'ready';
    w.phaseT = 0;
    if (!first) ev(w, 'phase', { pi: w.pi, kind: w.kind });
  }

  // ---------- one step ----------
  function step(w, inputs) {
    w.events = [];
    w.t += DT;
    w.phaseT += DT;
    w.block.hitT += DT;
    if (w.buddy) stepBuddy(w);
    if (w.phase === 'ready' && w.phaseT >= READY) { w.phase = 'play'; w.phaseT = 0; ev(w, 'go', { kind: w.kind }); }
    if (w.phase === 'play') {
      if (w.kind === 'bonus') {
        w.bonusT -= DT;
        if (w.bonusT <= 0) { w.bonusT = 0; ev(w, 'bonusEnd', { got: w.bonusGot, all: w.bonusAll }); clear(w); }
      } else spawn(w);
    }
    const live = w.phase === 'play' || w.phase === 'ready';
    w.players.forEach((p, i) => stepPlayer(w, p, w.phase === 'play' && inputs ? (Array.isArray(inputs) ? inputs[i] : i === 0 ? inputs : null) : null, live));
    for (const c of w.critters) stepCritter(w, c);
    for (const k of w.coins) if (k.walk) stepCoin(w, k);
    contacts(w);
    w.critters = w.critters.filter((c) => c.st !== 'gone');
    w.coins = w.coins.filter((k) => k.st !== 'gone');
    if (w.phase === 'play' && w.kind === 'critters' && !w.queue.length && !w.critters.length && w.sab !== 'neverClear') clear(w);
    if (w.phase === 'clear' && w.phaseT >= CLEAR_T) { w.pi++; loadPhase(w); }
    if (w.phase !== 'over' && w.players.every((p) => p.out)) { w.phase = 'over'; w.phaseT = 0; ev(w, 'over'); }
  }
  function clear(w) {
    w.phase = 'clear';
    w.phaseT = 0;
    for (const k of w.coins) k.st = 'gone';
    ev(w, 'clear', { pi: w.pi, kind: w.kind });
  }

  function spawn(w) {
    if (!w.queue.length) return;
    w.spawnT -= DT;
    if (w.spawnT > 0) return;
    w.spawnT = w.cfg.spawn;
    const side = w.spawnSide;
    w.spawnSide = -side;
    addCritter(w, w.queue.shift(), 3, side * (PIPE_X + 1), -side, 'out');
    ev(w, 'spawn', { side });
  }
  function addCritter(w, kind, f, x, dir, st) {
    const c = { id: ++w.cid, kind, st: st || 'walk', f, x, y: FLOOR_Y[f], dir: dir || 1, vx: 0, vy: 0, air: false, lvl: 0, angry: false, flipT: 0, t: 0, t2: 0, hopT: 0.4, turnT: 0, k0x: 0, k0y: 0, kx: 0, side: 1 };
    w.critters.push(c);
    return c;
  }
  const speed = (w, c) => SPEED[c.kind] * w.cfg.speed * (1 + w.cfg.speedUp * c.lvl) * (1 + 0.12 * (w.round - 1)) * (c.angry ? 1.45 : 1);

  // ---------- brothers ----------
  function surfaces(w, p) {
    const out = SEGS.slice();
    if (w.block.left > 0) out.push({ f: 1, y: BLOCK.yt, x0: BLOCK.x0, x1: BLOCK.x1, block: true });
    if (p.cloudT > 0) out.push({ f: 3, y: CLOUD.y, x0: CLOUD.x0, x1: CLOUD.x1, cloud: true });
    return out;
  }
  function stepPlayer(w, p, inp, live) {
    if (p.out) return;
    p.t += DT;
    p.inv = Math.max(0, p.inv - DT);
    if (p.mode === 'bonked') {
      if (p.t >= BONK_T) { loseLife(w, p); if (!p.out) respawn(w, p); }
      return;
    }
    let lr = inp ? Math.sign(inp.lr || 0) : 0;
    if (inp && inp.jump) p.jb = JUMP_BUF;
    else p.jb = Math.max(0, p.jb - DT);
    if (!live) { lr = 0; p.jb = 0; }
    const sp = w.cfg.walk;
    if (lr) p.face = lr;
    if (p.cloudT > 0) {
      p.cloudT -= DT;
      if (p.cloudT <= 0 || !(p.sup && p.sup.cloud) || (p.mode !== 'ground')) leaveCloud(p);
    }
    if (p.mode === 'ground') {
      p.vx = lr * sp;
      p.walkT += lr ? DT : 0;
      p.coyote = COYOTE;
      if (p.jb > 0) jump(w, p);
    } else {
      const want = lr * sp;
      p.vx += Math.max(-AIR_ACC * DT, Math.min(AIR_ACC * DT, want - p.vx));
      p.coyote -= DT;
      if (p.coyote > 0 && p.jb > 0 && p.vy <= 0) jump(w, p);
    }
    const py = p.y;
    if (p.mode === 'air') { p.vy = Math.max(p.vy - GRAV * DT, -22); p.y += p.vy * DT; }
    p.x = w.sab === 'noWrap' ? Math.max(-HALF, Math.min(HALF - 1e-6, p.x + p.vx * DT)) : wrap(p.x + p.vx * DT);
    if (p.mode === 'air') {
      if (p.vy > 0) headCheck(w, p, py);
      else landCheck(w, p, py);
    } else if (!supported(w, p)) {
      p.mode = 'air';
      p.vy = 0;
      if (p.sup && p.sup.cloud) leaveCloud(p);
    }
  }
  function jump(w, p) {
    p.vy = JV;
    p.mode = 'air';
    p.jb = 0;
    p.coyote = 0;
    if (p.sup && p.sup.cloud) leaveCloud(p);
    ev(w, 'jump', { i: p.i });
  }
  function leaveCloud(p) {
    if (p.cloudT > 0 || p.inv > 2) { p.cloudT = 0; p.inv = 2; }
  }
  function supported(w, p) {
    const s = p.sup;
    if (!s) return false;
    if (s.block && w.block.left <= 0) return false;
    if (s.cloud && p.cloudT <= 0) return false;
    return inSeg(p.x, s, FOOT_OUT);
  }
  function headCheck(w, p, py) {
    let best = null;
    for (const s of SEGS) {
      const u = s.y - TH;
      if (py + PH <= u + 1e-6 && p.y + PH > u && inSeg(p.x, s, -HEAD_IN) && (!best || u < best.u)) best = { u, s };
    }
    if (w.block.left > 0) {
      const u = BLOCK.yb;
      if (py + PH <= u + 1e-6 && p.y + PH > u && p.x >= BLOCK.x0 - 0.15 && p.x <= BLOCK.x1 + 0.15 && (!best || u < best.u)) best = { u, block: true };
    }
    if (!best) return;
    p.y = best.u - PH;
    p.vy = -1;
    if (best.block) boing(w, p);
    else bump(w, best.s.f, p.x, p);
  }
  function landCheck(w, p, py) {
    let best = null;
    for (const s of surfaces(w, p)) if (py >= s.y - 1e-6 && p.y <= s.y && inSeg(p.x, s, FOOT_OUT) && (!best || s.y > best.y)) best = s;
    if (!best && p.y < 0) best = SEGS[0];
    if (!best) return;
    const fall = Math.max(0, -p.vy);
    p.y = best.y;
    p.vy = 0;
    p.vx = 0;
    p.mode = 'ground';
    p.sup = best;
    ev(w, 'land', { i: p.i, fall });
  }
  function bonk(w, p, c) {
    p.mode = 'bonked';
    p.t = 0;
    p.vx = p.vy = 0;
    p.cloudT = 0;
    c.dir = -c.dir;
    c.turnT = 0.6;
    ev(w, 'hit', { i: p.i, x: p.x, y: p.y, kind: c.kind });
  }
  function loseLife(w, p) {
    p.lives--;
    p.mode = 'ground';
    if (p.lives <= 0) { p.lives = 0; p.out = true; p.mode = 'out'; ev(w, 'out', { i: p.i, who: p.who }); }
  }
  function respawn(w, p) {
    p.mode = 'ground';
    p.x = w.two ? (p.i ? 0.6 : -0.6) : 0;
    p.y = CLOUD.y;
    p.vx = p.vy = 0;
    p.cloudT = CLOUD_T;
    p.sup = surfaces(w, p).find((s) => s.cloud);
    p.inv = CLOUD_T + 2;
    p.t = 0;
    ev(w, 'respawn', { i: p.i });
  }
  function addScore(w, p, n) {
    p.score += n;
    if (!p.extra && p.score >= 20000) { p.extra = true; p.lives++; ev(w, 'extraLife', { i: p.i }); }
  }

  // a head hit the underside of floor f at x: flip what stands over that spot, pop up a brother standing there
  function bump(w, f, x, p) {
    ev(w, 'bump', { f, x, i: p.i });
    const r = w.sab === 'wrongSpot' ? 99 : BUMP_R;
    for (const c of w.critters) {
      if (c.f !== f || !isOnFloor(c) || wdist(c.x, x) > r) continue;
      if (w.sab === 'noFlip') continue;
      hitCritter(w, c, p, false);
    }
    for (const k of w.coins) if (k.walk && k.f === f && !k.air && k.st === 'walk' && wdist(k.x, x) < r) collect(w, k, p);
    for (const q of w.players) {
      if (q === p || q.out || q.mode !== 'ground' || !q.sup || q.sup.f !== f || q.sup.block || wdist(q.x, x) > 0.9) continue;
      q.mode = 'air';
      q.vy = 9;
      ev(w, 'popBrother', { i: q.i, by: p.i, x: q.x, y: q.y });
    }
  }
  // on a floor (a fly just lifting off or landing, under 0.6 m up, still counts: kinder to small jumpers)
  const isOnFloor = (c) => (!c.air || (c.kind === 'fly' && c.st === 'walk' && c.y - FLOOR_Y[c.f] < 0.6)) && (c.st === 'walk' || c.st === 'flip' || c.st === 'out');
  function hitCritter(w, c, p, force) {
    if (c.st === 'flip') { c.flipT = w.cfg.flip; ev(w, 'reflip', { id: c.id, x: c.x, y: c.y }); return; }
    if (c.kind === 'crab' && !force && w.cfg.crabHits > 1 && !c.angry) { c.angry = true; ev(w, 'angry', { id: c.id, x: c.x, y: c.y }); return; }
    c.st = 'flip';
    c.flipT = w.cfg.flip;
    c.angry = false;
    c.vx = 0;
    c.air = true; // a little pop up off the floor, then down on its back
    c.vy = 4.5;
    if (p) addScore(w, p, SCORE.flip);
    ev(w, 'flip', { id: c.id, x: c.x, y: c.y, kind: c.kind });
  }
  // the BOING block: every critter on the floor flips (flies in mid-hop too); 3 bumps and it's used up
  function boing(w, p) {
    if (w.sab !== 'boingForever') w.block.left--;
    if (w.sab === 'boingNone') { w.block.left = Math.max(0, w.block.left); ev(w, 'boing', { left: w.block.left, n: 0, i: p.i }); return; }
    w.block.hitT = 0;
    const n = flipAll(w, p);
    ev(w, 'boing', { left: w.block.left, n, i: p.i });
  }
  function flipAll(w, p) {
    let n = 0;
    for (const c of w.critters) {
      if (c.st === 'flip') { c.flipT = w.cfg.flip; n++; continue; }
      if (c.st !== 'walk' && c.st !== 'out') continue;
      if (c.air && c.kind !== 'fly') continue; // dropping off a ledge: not on a floor
      hitCritter(w, c, p, true);
      n++;
    }
    return n;
  }

  // ---------- critters and rolling coins ----------
  function stepCritter(w, c) {
    c.t += DT;
    c.turnT = Math.max(0, c.turnT - DT);
    switch (c.st) {
      case 'out': // coming out of a top pipe
        c.x += c.dir * Math.max(1, speed(w, c)) * DT;
        if (Math.abs(c.x) <= PIPE_X) c.st = 'walk';
        break;
      case 'walk': walk(w, c, speed(w, c)); break;
      case 'flip':
        if (c.air) airStep(c, CRIT_G);
        if (w.sab !== 'noRecover') c.flipT -= DT;
        if (c.flipT <= 0 && !c.air) {
          c.st = 'walk';
          c.lvl = Math.min(2, c.lvl + 1);
          c.hopT = 0.3;
          ev(w, 'recover', { id: c.id, x: c.x, y: c.y, lvl: c.lvl });
        }
        break;
      case 'kicked': { // tumbling across to a bottom pipe
        c.t2 += DT;
        const u = Math.min(1, c.t2 / KICK_T);
        c.x = c.k0x + (c.kx - c.k0x) * u;
        c.y = c.k0y + (0.15 - c.k0y) * u + Math.sin(u * Math.PI) * 2.6;
        if (c.t2 >= KICK_T) { c.st = 'bye'; c.t2 = 0; c.x = c.kx; c.y = 0.15; ev(w, 'bye', { id: c.id, x: c.x, y: c.y }); }
        break;
      }
      case 'bye': c.t2 += DT; if (c.t2 >= BYE_T) c.st = 'gone'; break;
      case 'pipe': // walked into a bottom pipe: back out of the top pipe on that side
        c.t2 += DT;
        if (c.t2 >= PIPE_T) { c.st = 'out'; c.f = 3; c.y = FLOOR_Y[3]; c.x = c.side * (PIPE_X + 1); c.dir = -c.side; c.air = false; c.vy = 0; }
        break;
    }
  }
  function walk(w, o, sp) {
    if (!o.air) {
      if (o.kind === 'fly') {
        o.hopT -= DT;
        if (o.hopT <= 0) { o.air = true; o.vy = FLY_V; o.vx = o.dir * sp * 1.3; }
      } else {
        o.x = wrap(o.x + o.dir * sp * DT);
        if (!onFloor(o.f, o.x)) { o.air = true; o.vy = 0; o.vx = o.dir * 0.6; }
      }
    } else airStep(o, o.kind === 'fly' ? FLY_G : CRIT_G);
    if (o.f === 0 && !o.air && ((o.dir > 0 && o.x > PIPE_X) || (o.dir < 0 && o.x < -PIPE_X))) {
      o.st = 'pipe';
      o.t2 = 0;
      o.side = o.dir;
    }
  }
  function airStep(o, g) {
    const py = o.y;
    o.vy -= g * DT;
    o.y += o.vy * DT;
    o.x = wrap(o.x + o.vx * DT);
    if (o.vy > 0) return;
    let best = null;
    for (const s of SEGS) if (s.y <= py + 1e-6 && s.y >= o.y && inSeg(o.x, s, 0) && (!best || s.y > best.y)) best = s;
    if (!best && o.y < 0) best = SEGS[0];
    if (!best) return;
    o.y = best.y;
    o.f = best.f;
    o.air = false;
    o.vy = 0;
    o.vx = 0;
    o.hopT = 0.7;
  }
  function stepCoin(w, k) {
    k.t = (k.t || 0) + DT;
    if (k.st === 'out') { k.x += k.dir * SPEED.coin * DT; if (Math.abs(k.x) <= PIPE_X) k.st = 'walk'; return; }
    if (k.st === 'walk') walk(w, k, SPEED.coin);
    if (k.st === 'pipe') k.st = 'gone'; // home it goes
  }
  function rollCoin(w) {
    const side = w.coinSide;
    w.coinSide = -side;
    w.coins.push({ id: ++w.coinId, walk: true, kind: 'coin', st: 'out', f: 3, x: side * (PIPE_X + 1), y: FLOOR_Y[3], dir: -side, vx: 0, vy: 0, air: false });
    ev(w, 'coinOut', { side });
  }
  function collect(w, k, p) {
    k.st = 'gone';
    addScore(w, p, SCORE.coin);
    ev(w, 'coin', { i: p.i, x: k.x, y: k.y + (k.walk ? 0.35 : 0) });
    if (!k.walk && w.kind === 'bonus') {
      w.bonusGot++;
      if (w.bonusGot >= w.bonusAll && w.phase === 'play') {
        for (const q of w.players) if (!q.out) addScore(w, q, SCORE.perfect);
        ev(w, 'perfect', { got: w.bonusGot });
        clear(w);
      }
    }
  }
  function kick(w, c, p) {
    const d = wdx(c.x, p.x);
    const dir = Math.abs(d) > 0.05 ? Math.sign(d) : p.face;
    c.st = 'kicked';
    c.t2 = 0;
    c.k0x = c.x;
    c.k0y = c.y;
    c.kx = dir * (PIPE_X + 0.3);
    c.dir = dir;
    p.kicks++;
    addScore(w, p, SCORE.kick);
    ev(w, 'kick', { id: c.id, x: c.x, y: c.y, i: p.i, dir });
    rollCoin(w);
  }

  // ---------- who touches what ----------
  const shield = (w) => !!(w.buddy && w.buddy.kind === 'boing');
  function contacts(w) {
    // critters bump into each other and turn round
    const walkers = w.critters.filter((c) => c.st === 'walk' && !c.air);
    for (let a = 0; a < walkers.length; a++) {
      for (let b = a + 1; b < walkers.length; b++) {
        const A = walkers[a], B = walkers[b];
        if (A.f !== B.f || wdist(A.x, B.x) > CW * 1.8 || A.turnT > 0 || B.turnT > 0) continue;
        const d = wdx(B.x, A.x);
        if (A.dir * d > 0 && B.dir * d < 0) { A.dir = -A.dir; B.dir = -B.dir; A.turnT = B.turnT = 0.5; }
      }
    }
    for (const p of w.players) {
      if (p.out || p.mode === 'bonked') continue;
      for (const c of w.critters) {
        if (wdist(p.x, c.x) >= PW + CW || p.y >= c.y + CH || c.y >= p.y + PH) continue;
        if (c.st === 'flip') { if (w.sab !== 'noKick') kick(w, c, p); continue; }
        if (c.st !== 'walk' && (c.st !== 'out' || Math.abs(c.x) > PIPE_X + 0.2)) continue;
        if (p.inv > 0 || p.safe || shield(w) || w.sab === 'harmless' || w.phase !== 'play') continue;
        bonk(w, p, c);
        break;
      }
      if (p.mode === 'bonked') continue;
      for (const k of w.coins) {
        if (k.st === 'gone' || k.st === 'out') continue;
        const ky = k.y + (k.walk ? 0.35 : 0);
        if (wdist(p.x, k.x) < PW + 0.35 && ky > p.y - 0.35 && ky < p.y + PH + 0.35) collect(w, k, p);
      }
    }
  }

  // ---------- the brother (1 player) or a high five (2 players) ----------
  function call(w) {
    if (w.phase === 'over') return false;
    if (w.two) {
      if (w.buddy) return false;
      w.buddy = { kind: 'hi5', t: 0 };
      for (const p of w.players) if (!p.out) addScore(w, p, SCORE.hi5);
      ev(w, 'hi5');
      return true;
    }
    if (w.buddy) { w.buddy.more++; ev(w, 'buddyMore', { who: w.buddy.who }); return true; }
    const n = w.calls++;
    w.buddy = { kind: 'boing', who: w.buddyFor(w.players[0].who), t: 0, n, treat: TREATS[n % TREATS.length], more: 0, done: 0 };
    ev(w, 'buddyIn', { who: w.buddy.who });
    return true;
  }
  function stepBuddy(w) {
    const bd = w.buddy;
    const t0 = bd.t;
    bd.t += DT;
    const crossed = (at) => t0 < at && bd.t >= at;
    if (bd.kind === 'hi5') { if (bd.t >= 1.4) w.buddy = null; return; }
    if (crossed(B_TREAT)) { addScore(w, w.players[0], SCORE.treat); ev(w, 'treat', { e: bd.treat, who: bd.who }); }
    if (crossed(B_BOING)) {
      bd.done++;
      w.block.hitT = 0;
      const n = w.sab === 'lazyBuddy' ? 0 : flipAll(w, null);
      ev(w, 'buddyBoing', { who: bd.who, n });
    }
    if (bd.t >= B_END) {
      if (bd.more > 0) { bd.more--; bd.t = B_GO; }
      else { w.buddy = null; ev(w, 'buddyOut', { who: bd.who }); }
    }
  }

  // tests: stand brother i on floor f at x
  function put(w, i, f, x) {
    const p = w.players[i || 0];
    p.x = x; p.y = FLOOR_Y[f]; p.vx = p.vy = 0; p.mode = 'ground'; p.sup = SEGS.find((s) => s.f === f && inSeg(x, s, FOOT_OUT)) || SEGS[0]; p.cloudT = 0; p.inv = 0; p.jb = 0; p.t = 0;
    return p;
  }

  PB.sim = {
    DT, PH, PW, CW, CH, GRAV, JV, HEAD_IN, FOOT_OUT, BUMP_R, READY, CLEAR_T, BONK_T, CLOUD_T, KICK_T, BYE_T, B_TREAT, B_GO, B_BOING, B_END, SCORE, CFG, SPEED, TREATS,
    create, step, call, loadPhase, addCritter, put, speed, wrap, wdx, wdist, inSeg, onFloor, isOnFloor, surfaces, kick, flipAll, rollCoin,
    floorOf(p) { return p.sup ? p.sup.f : 0; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
