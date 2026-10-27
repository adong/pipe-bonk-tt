/* TT Pipe Bonk: the page. The Three.js scene with a fixed arcade camera, the HUD and screens, keys and touch, the
   brother who pops in to bump the BOING block, the celebrations, and the window.game test hooks.
   The rules are js/sim.js (fixed 1/60 s steps); the 3D things are js/art.js; sounds are js/sfx.js. */
(function () {
  'use strict';
  const T = THREE, S = PB.sim, A = PB.art, SFX = PB.sfx, LV = PB.levels;
  const $ = (id) => document.getElementById(id);
  const PI = Math.PI, DT = S.DT;
  const KEY = 'pipeBonkTT.v1';
  const NAME = (id) => (Kit.roster.get(id) || { name: id.toUpperCase() }).name;
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const SCALE = 0.65; // the kit's people are 2 m tall; brothers here are 1.3 m (their bump box)
  const FRIENDS = { easy: [['foxy', 6000], ['froggy', 3000]], normal: [['foxy', 12000], ['froggy', 7000]] };

  const store = {
    d: {},
    load() {
      try { this.d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { this.d = {}; }
      this.d.top = this.d.top || {};
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* private mode: fine */ } },
    table(level) {
      const t = (this.d.top[level] || []).slice();
      for (const [who, score] of FRIENDS[level]) if (!t.some((r) => r.who === who && r.cpu)) t.push({ who, score, cpu: true });
      return t.sort((a, b) => b.score - a.score).slice(0, 6);
    },
    add(level, who, score) {
      if (!score) return null;
      const row = { who, score, at: Date.now() + Math.random() };
      const mine = (this.d.top[level] || []).concat([row]).sort((a, b) => b.score - a.score).slice(0, 5);
      this.d.top[level] = mine;
      this.save();
      return mine.includes(row) ? row : null;
    },
  };

  const G = {
    screen: 'loading', w: null, demo: false, paused: false, hold: false, autoPause: true,
    keys: {}, taps: [{}, {}], touch: [{ l: 0, r: 0 }, { l: 0, r: 0 }], jumpBuf: [0, 0], acc: 0, time: 0,
    players: 1, who: 'teddy', level: 'easy', sab: null, botInp: null, botK: 0,
    bumps: [], scene2: null, overT: 0, newRows: [], frame: 0, k: 1, tickT: 0,
  };
  let renderer, scene, cam, confetti, floors, block, cloud, treat, last = 0;
  const people = {};
  let portraits = {};
  const pools = { beetle: [], crab: [], fly: [], coin: [] };
  const live = new Map(); // id → mesh for critters ('c' + id) and coins ('k' + id)
  const props = {}; // per brother: stars, ball, peace, glow, bubble
  const hands = [];
  const v3 = new T.Vector3();

  // ---------- start-up ----------
  function boot() {
    renderer = new T.WebGLRenderer({ canvas: $('game'), antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(2, Math.max(1, devicePixelRatio || 1)));
    scene = new T.Scene();
    scene.background = new T.Color('#9fe3f0');
    cam = new T.PerspectiveCamera(30, 1, 1, 400);
    scene.add(new T.HemisphereLight('#ffffff', '#b9a6e8', 0.85));
    const sun = new T.DirectionalLight('#fff4dd', 0.75);
    sun.position.set(-8, 20, 30);
    scene.add(sun);
    A.backdrop(scene);
    floors = A.floors(scene);
    A.pipes(scene);
    block = A.block();
    scene.add(block);
    cloud = A.cloud();
    cloud.visible = false;
    scene.add(cloud);
    confetti = A.confetti(scene, 700);
    for (const id of ['teddy', 'tommy', 'foxy', 'froggy']) {
      const r = Kit.roster.get(id);
      const p = Kit.people.build(r.look);
      p.root.scale.setScalar(SCALE * (id === 'foxy' || id === 'froggy' ? 0.9 : 1));
      p.root.visible = false;
      scene.add(p.root);
      people[id] = p;
    }
    for (const id of ['teddy', 'tommy']) {
      const o = (props[id] = {});
      o.stars = A.stars();
      o.ball = A.emoji('🏀', 0.4);
      o.peace = A.emoji('✌️', 0.45);
      o.glow = new T.Sprite(new T.SpriteMaterial({ map: Kit.gfx.glowTexture(), color: '#fff2a8', transparent: true, opacity: 0.55, depthWrite: false }));
      o.glow.scale.set(2.2, 2.6, 1);
      o.bubble = new T.Mesh(new T.SphereGeometry(1, 20, 14), new T.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.2, depthWrite: false }));
      o.bubble.scale.setScalar(1.05);
      o.mini = A.cloud();
      o.mini.scale.setScalar(0.55);
      for (const k of ['stars', 'ball', 'peace', 'glow', 'bubble', 'mini']) { o[k].visible = false; scene.add(o[k]); }
    }
    treat = A.emoji('🍦', 0.5);
    treat.visible = false;
    scene.add(treat);
    portraits = Kit.portraits(['teddy', 'tommy', 'foxy', 'froggy'].map((id) => Kit.roster.get(id)), { size: 128 });
    store.load();
    const o = store.d.opts || {};
    if (o.players === 2) G.players = 2;
    if (o.who === 'tommy') G.who = 'tommy';
    if (o.level === 'normal') G.level = 'normal';
    setupUI();
    addEventListener('resize', fit);
    showTitle();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ---------- the fixed arcade camera: the whole screen of floors fits the free part of the page ----------
  const BOX = { x0: -10.6, x1: 10.6, y0: -0.9, y1: 12.7 };
  function fit() {
    const W = innerWidth, H = innerHeight;
    renderer.setSize(W, H, false);
    const short = H <= 460, narrow = W <= 520;
    const top = short ? 48 : narrow ? 56 : 66;
    const bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0;
    const kOf = (m) => Math.min(Math.max(50, W - m[0] - m[1]) / bw, Math.max(50, H - m[2] - m[3]) / bh);
    let m = [58, 10, top, 6];
    if (document.body.classList.contains('touch') && G.screen === 'play') {
      // the pads sit in the bottom corners: keep the floors beside them or above them, whichever is bigger
      const lp = document.querySelector('.lpad').getBoundingClientRect(), rp = document.querySelector('.rpad').getBoundingClientRect();
      const side = [Math.max(58, lp.right + 8), Math.max(10, W - rp.left + 8), top, 6];
      const below = [58, 10, top, Math.max(H - lp.top, H - rp.top) + 8];
      m = kOf(side) >= kOf(below) ? side : below;
    }
    const k = kOf(m);
    const sw = W - m[0] - m[1], sh = H - m[2] - m[3];
    const viewH = H / k;
    const D = viewH / 2 / Math.tan((cam.fov * PI) / 360);
    const offX = m[0] + sw / 2 - W / 2, offY = m[2] + sh / 2 - H / 2;
    const cx = (BOX.x0 + BOX.x1) / 2 - offX / k, cy = (BOX.y0 + BOX.y1) / 2 + offY / k;
    cam.aspect = W / H;
    cam.position.set(cx, cy, D);
    cam.near = Math.max(1, D * 0.4);
    cam.far = D + 120;
    cam.lookAt(cx, cy, 0);
    cam.updateProjectionMatrix();
    G.k = k;
    G.margins = m;
  }
  function toScreen(x, y, z) {
    v3.set(x, y, z || 0).project(cam);
    return [(v3.x * 0.5 + 0.5) * innerWidth, (-v3.y * 0.5 + 0.5) * innerHeight];
  }

  // ---------- games ----------
  function newWorld(demo) {
    const who = demo ? ['teddy'] : G.players === 2 ? ['teddy', 'tommy'] : [G.who];
    const w = S.create({ level: demo ? 'easy' : G.level, players: who, seed: (Math.random() * 1e9) | 0, buddyFor: (id) => Kit.roster.buddyFor(id) });
    if (demo) w.players[0].safe = true;
    return w;
  }
  function play() {
    Kit.sound.init();
    store.d.opts = { players: G.players, who: G.who, level: G.level };
    store.save();
    G.w = newWorld(false);
    G.demo = false;
    G.paused = false;
    G.overT = 0;
    G.scene2 = null;
    resetInput();
    G.acc = 0;
    G.bumps = [];
    confetti.clear();
    clearPops();
    document.body.classList.toggle('two', G.w.two);
    showScreen('play');
    setupBud();
    big(phaseName(), G.w.kind === 'bonus' ? 'GRAB THE COINS!' : 'READY?');
    Kit.sound.music('play');
  }
  function resetInput() {
    G.keys = {};
    G.taps = [{}, {}];
    G.touch = [{ l: 0, r: 0 }, { l: 0, r: 0 }];
    G.jumpBuf = [0, 0];
    document.querySelectorAll('#touch .down').forEach((b) => b.classList.remove('down'));
  }
  function setupBud() {
    const w = G.w;
    const who = w.two ? null : Kit.roster.buddyFor(w.players[0].who);
    const img = w.two ? portraits.tommy : portraits[who];
    $('budBtn').querySelector('img').src = img || '';
    document.querySelector('.tb.call img').src = img || '';
    setText($('budLbl'), w.two ? 'HIGH FIVE' : `CALL ${NAME(who)}`);
    setText(document.querySelector('.tb.call small'), w.two ? 'HIGH FIVE' : 'CALL');
  }
  function call() {
    if (!G.w || G.demo || G.screen !== 'play' || G.paused) return false;
    const ok = S.call(G.w);
    if (ok) handleEvents(G.w.events.splice(0));
    return ok;
  }
  const phaseName = () => (G.w ? `PHASE ${G.w.pi + 1}` : '');
  const phaseLine = () => (G.w ? (G.w.kind === 'bonus' ? `PHASE ${G.w.pi + 1} · BONUS STAGE` : `PHASE ${G.w.pi + 1}`) : '');

  // ---------- screens ----------
  function showScreen(id) {
    G.screen = id;
    for (const s of ['title', 'pause', 'results']) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', id === 'title' || id === 'results');
    $('touch').classList.toggle('hidden', id !== 'play');
    $('menuMute').classList.toggle('hidden', id === 'play' || id === 'pause');
    document.body.classList.toggle('title', id === 'title');
    if (id !== 'play' && id !== 'pause') { $('bigmsg').classList.remove('show'); $('toast').classList.remove('show'); clearPops(); }
    fit();
  }
  function showTitle() {
    G.w = newWorld(true);
    G.demo = true;
    G.paused = false;
    G.scene2 = null;
    G.bumps = [];
    confetti.clear();
    clearPops();
    document.body.classList.remove('two');
    showScreen('title');
    refreshTitle();
    Kit.sound.music('title');
  }
  function refreshTitle() {
    document.querySelectorAll('[data-players]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.players === G.players)));
    document.querySelectorAll('[data-who]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.who === G.who)));
    document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === G.level)));
    $('whoRow').classList.toggle('off', G.players === 2);
    const top = store.table(G.level)[0];
    setText($('titleHi'), `HI-SCORE ${fmt(top.score)} · ${NAME(top.who)}`);
  }
  function setOpt(k, v) {
    G[k] = v;
    SFX.click();
    refreshTitle();
  }
  function pause() {
    if (G.screen !== 'play' || G.paused) return;
    G.paused = true;
    showScreen('pause');
    Kit.sound.music('pause');
  }
  function resume() {
    if (!G.paused) return;
    G.paused = false;
    resetInput();
    showScreen('play');
    Kit.sound.music('play');
  }
  function showResults() {
    const w = G.w;
    const ps = w.players;
    const bestScore = Math.max(...ps.map((p) => p.score));
    G.newRows = ps.map((p) => store.add(w.level, p.who, p.score)).filter(Boolean);
    const title = $('resTitle');
    setText(title, ps.length === 2 ? 'GREAT TEAMWORK!' : 'GREAT BONKING!');
    const pl = ps[0];
    setText($('resSub'), ps.length === 2 ? `${NAME(ps[0].who)} ${fmt(ps[0].score)} · ${NAME(ps[1].who)} ${fmt(ps[1].score)}` : `${fmt(pl.score)} points · phase ${w.pi + 1}`);
    const rows = store.table(w.level);
    const tb = $('resTable');
    tb.innerHTML = '';
    const cap = document.createElement('caption');
    cap.textContent = w.level === 'easy' ? '🐣 TOP BONKERS' : '🔥 TOP BONKERS';
    tb.appendChild(cap);
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (G.newRows.some((n) => n.at === r.at && n.who === r.who && n.score === r.score)) tr.className = 'me';
      tr.innerHTML = `<td class="rk">${i + 1}</td><td class="who"><img alt="" src="${portraits[r.who] || ''}"><span>${NAME(r.who)}</span></td><td class="pts">${fmt(r.score)}</td>`;
      tb.appendChild(tr);
    });
    const best = $('resBest');
    const isTop = G.newRows.some((n) => rows[0] && n.score === rows[0].score && n.who === rows[0].who && n.at === rows[0].at);
    setText(best, isTop ? '⭐ NEW HI-SCORE!' : G.newRows.length ? '⭐ ON THE BOARD!' : '');
    best.classList.toggle('new', G.newRows.length > 0);
    // co-op: both brothers celebrate, the top scorer in the middle
    const order = ps.slice().sort((a, b) => b.score - a.score).map((p) => p.who);
    G.scene2 = { kind: 'win', who: order, t: 0, best: bestScore };
    showScreen('results');
    Kit.sound.music('over');
  }

  // ---------- keys and touch ----------
  // 1 player: every walk and jump key moves him. 2 players: Teddy A D W, Tommy ← → ↑.
  const ONE = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  const JUMP1 = ['Space', 'ArrowUp', 'KeyW', 'KeyJ', 'KeyK', 'KeyX'];
  const TWO = { KeyA: [0, 'l'], KeyD: [0, 'r'], ArrowLeft: [1, 'l'], ArrowRight: [1, 'r'] };
  const JUMP2 = { KeyW: 0, Space: 0, KeyF: 0, ArrowUp: 1, KeyL: 1, Slash: 1 };
  function held(i, d) {
    const two = G.w && G.w.two;
    for (const c in G.keys) {
      if (!G.keys[c]) continue;
      if (two ? TWO[c] && TWO[c][0] === i && TWO[c][1] === d : i === 0 && ONE[c] === d) return true;
    }
    return !!(G.touch[i][d] || G.taps[i][d]);
  }
  function readInput() {
    const w = G.w;
    const out = [0, 1].map((i) => {
      let lr = (held(i, 'r') ? 1 : 0) - (held(i, 'l') ? 1 : 0);
      if (G.sab === 'mirror') lr = -lr; // the play check's own sabotages
      let jump = G.jumpBuf[i] > 0;
      const p = w.players[i];
      if (G.sab === 'stuckCloud' && p && p.sup && p.sup.cloud) { lr = 0; jump = false; }
      return { lr, jump };
    });
    G.taps = [{}, {}];
    return out;
  }
  function jumpKey(c) {
    if (G.w && G.w.two) return c in JUMP2 ? JUMP2[c] : -1;
    return JUMP1.includes(c) ? 0 : -1;
  }
  function setupUI() {
    const logo = () => {
      const zh = Kit.lang.is('zh');
      $('logoText').textContent = zh ? PB.ZH : PB.TITLE;
      $('logoSub').textContent = zh ? PB.TITLE : '';
    };
    $('tagline').textContent = PB.TAGLINE;
    logo();
    Kit.lang.onChange(logo);
    document.querySelectorAll('[data-who] img').forEach((im) => (im.src = portraits[im.parentNode.dataset.who] || ''));
    document.querySelectorAll('[data-players]').forEach((b) => b.addEventListener('click', () => setOpt('players', +b.dataset.players)));
    document.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => setOpt('who', b.dataset.who)));
    document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => setOpt('level', b.dataset.level)));
    $('startBtn').addEventListener('click', play);
    $('pauseBtn').addEventListener('click', pause);
    $('resumeBtn').addEventListener('click', resume);
    $('quitBtn').addEventListener('click', showTitle);
    $('againBtn').addEventListener('click', play);
    $('menuBtn').addEventListener('click', showTitle);
    $('budBtn').addEventListener('click', call);
    const syncMute = () => document.querySelectorAll('.muteBtn').forEach((b) => (b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊'));
    document.querySelectorAll('.muteBtn').forEach((b) => b.addEventListener('click', () => { Kit.sound.init(); Kit.sound.toggleMute(); syncMute(); }));
    Kit.sound.onMute(syncMute);
    syncMute();

    addEventListener('pointerdown', (e) => {
      Kit.sound.init();
      if (e.pointerType === 'touch' && !document.body.classList.contains('touch')) {
        document.body.classList.add('touch');
        fit();
      }
    }, true);
    if (matchMedia('(hover: none) and (pointer: coarse)').matches || /[?&]touch=1/.test(location.search)) document.body.classList.add('touch');

    addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      Kit.sound.init();
      const c = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
      if (c === 'KeyM' && !e.repeat) { Kit.sound.toggleMute(); syncMute(); return; }
      if (G.screen === 'title') {
        if (e.repeat) return;
        if (c === 'Digit1') setOpt('players', 1);
        else if (c === 'Digit2') setOpt('players', 2);
        else if (c === 'KeyE') setOpt('level', 'easy');
        else if (c === 'KeyN') setOpt('level', 'normal');
        else if ((c === 'KeyC' || c === 'ArrowLeft' || c === 'ArrowRight') && G.players === 1) setOpt('who', G.who === 'teddy' ? 'tommy' : 'teddy');
        else if (c === 'Enter' || c === 'Space') play();
        return;
      }
      if (G.screen === 'results') {
        if (e.repeat) return;
        if (c === 'Enter' || c === 'Space') play();
        else if (c === 'Escape' || c === 'KeyQ') showTitle();
        return;
      }
      if (G.paused) {
        if (e.repeat) return;
        if (c === 'KeyP' || c === 'Escape' || c === 'Space' || c === 'Enter') resume();
        else if (c === 'KeyQ') showTitle();
        return;
      }
      if (G.screen === 'play') {
        if ((c === 'KeyP' || c === 'Escape') && !e.repeat) return pause();
        if ((c === 'KeyT' || (c === 'Enter' && !G.w.two) || c === 'NumpadEnter') && !e.repeat) { call(); return; }
        const j = jumpKey(c);
        if (j >= 0) { if (!e.repeat) G.jumpBuf[j] = 0.15; G.keys[c] = true; return; }
        G.keys[c] = true;
        // a tap shorter than a frame still moves
        if (G.w.two) { if (TWO[c]) G.taps[TWO[c][0]][TWO[c][1]] = true; } else if (ONE[c]) G.taps[0][ONE[c]] = true;
      }
    });
    addEventListener('keyup', (e) => { G.keys[e.code] = false; });
    addEventListener('blur', () => { G.keys = {}; G.touch = [{ l: 0, r: 0 }, { l: 0, r: 0 }]; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && G.autoPause && G.screen === 'play' && !G.paused) pause();
      if (document.hidden) Kit.sound.suspend();
      else Kit.sound.resume();
    });

    // touch: ◀ ▶ ⤴️ for each brother, and the brother's face
    const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* a test's pointer: fine */ } };
    document.querySelectorAll('#touch [data-a]').forEach((b) => {
      const a = b.dataset.a, i = +(b.dataset.p || 0);
      const on = (v) => {
        b.classList.toggle('down', v);
        if (a === 'call') { if (v) call(); return; }
        if (a === 'j') { if (v) G.jumpBuf[i] = 0.15; return; }
        G.touch[i][a] = v ? 1 : 0;
        if (v) G.taps[i][a] = true;
      };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); capture(b, e); on(true); });
      b.addEventListener('pointerup', () => on(false));
      b.addEventListener('pointercancel', () => on(false));
      b.addEventListener('lostpointercapture', () => on(false));
    });
  }

  // ---------- each frame ----------
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - (last || now)) / 1000));
    last = now;
    if (!G.hold) advance(dt);
    draw();
  }
  function advance(dt) {
    G.time += dt;
    G.frame++;
    const w = G.w;
    if (!w) return;
    const frozen = G.paused || G.screen === 'pause';
    if (!frozen) {
      G.acc = Math.min(G.acc + dt, 0.25);
      while (G.acc >= DT - 1e-9) {
        G.acc -= DT;
        tick();
      }
      visuals(dt);
    }
  }
  function tick() {
    const w = G.w;
    let inp;
    if (G.demo) {
      if (G.botK++ % 3 === 0 || !G.botInp) G.botInp = PB.bot.decide(w, 0);
      else G.botInp = { lr: G.botInp.lr, jump: false };
      inp = [G.botInp];
    } else if (G.screen === 'play') inp = readInput();
    else inp = null;
    S.step(w, inp);
    for (let i = 0; i < 2; i++) {
      if (w.events.some((e) => e.type === 'jump' && e.i === i)) G.jumpBuf[i] = 0;
      else G.jumpBuf[i] = Math.max(0, G.jumpBuf[i] - DT);
    }
    handleEvents(w.events);
    if (G.demo) {
      if (w.phase === 'over' || w.t > 240) G.w = newWorld(true);
    } else if (w.phase === 'over' && G.screen === 'play') {
      G.overT += DT;
      if (G.overT > 2.2) showResults();
    }
    if (!G.demo && w.phase === 'play' && w.kind === 'bonus' && w.bonusT < 5.05) {
      const s = Math.ceil(w.bonusT);
      if (s !== G.tickT) { G.tickT = s; SFX.tick(); }
    }
  }

  // ---------- what the rules said happened ----------
  function handleEvents(evs) {
    const w = G.w;
    const loud = !G.demo;
    const snd = (f, ...a) => { if (loud) f(...a); };
    const P = (i) => w.players[i] || w.players[0];
    for (const e of evs) {
      switch (e.type) {
        case 'go': snd(SFX.go); big(w.kind === 'bonus' ? 'BONUS STAGE!' : 'GO!', w.kind === 'bonus' ? 'GRAB THE COINS!' : ''); break;
        case 'phase': big(phaseName(), w.kind === 'bonus' ? 'GRAB THE COINS!' : 'READY?'); break;
        case 'jump': snd(SFX.jump); break;
        case 'land': if (e.fall > 9) snd(SFX.land); break;
        case 'bump': G.bumps.push({ f: e.f, x: e.x, t: 0 }); snd(SFX.bump); break;
        case 'flip': snd(SFX.flip); pop(e.x, e.y + 1.0, 'FLIP!'); break;
        case 'angry': snd(SFX.angry); pop(e.x, e.y + 1.1, 'HMPH! GRUMPY!', 'ouch'); break;
        case 'recover': snd(SFX.recover); pop(e.x, e.y + 1.0, 'UPSY-DAISY!', 'ouch'); break;
        case 'kick': snd(SFX.kick); pop(e.x, e.y + 1.1, '+800', 'big'); confetti.burst(e.x, e.y + 0.4, 0.4, 26, 4); cheer(); break;
        case 'bye': snd(SFX.bye); pop(e.x - Math.sign(e.x) * 0.8, 1.8, 'BYE BYE!', 'cool'); break;
        case 'coin': snd(SFX.coin, 3); pop(e.x, e.y + 0.6, '+800'); confetti.burst(e.x, e.y, 0.4, 10, 2.5, ['#ffd400', '#fff3a0']); break;
        case 'coinOut': snd(SFX.coinOut); break;
        case 'spawn': snd(SFX.spawn); break;
        case 'hit': snd(SFX.hit); pop(e.x, e.y + 1.6, 'OOPSIE!', 'ouch'); break;
        case 'respawn': snd(SFX.respawn); break;
        case 'boing': {
          snd(SFX.boing);
          const B = LV.BLOCK;
          pop(0, B.yt + 0.6, e.left ? 'BOING!' : 'BOING! ALL GONE!', 'big');
          confetti.burst(0, B.yt, 0.5, e.left ? 24 : 50, 4, ['#ff5fb0', '#ffd400', '#ffffff']);
          break;
        }
        case 'buddyIn': snd(SFX.buddy); confetti.burst(P(0).x - P(0).face, P(0).y + 1, 0.6, 16, 2.5, ['#ffffff', '#bff3ff']); break;
        case 'buddyMore': pop(0, LV.BLOCK.yt + 1.4, 'ONE MORE BOING!', 'cool'); break;
        case 'treat': snd(SFX.treat); pop(P(0).x, P(0).y + 1.7, `${e.e} +100`); break;
        case 'buddyBoing':
          snd(SFX.boing);
          toast(`${NAME(e.who)} SAYS: BOING!`);
          confetti.burst(0, LV.BLOCK.yt, 0.5, 30, 4, ['#ff5fb0', '#ffd400', '#ffffff']);
          break;
        case 'hi5': snd(SFX.hi5); pop((P(0).x + P(1).x) / 2, Math.max(P(0).y, P(1).y) + 1.9, 'HIGH FIVE! ✋ +50', 'big'); confetti.burst(P(0).x, P(0).y + 1.2, 0.6, 20, 3.5); confetti.burst(P(1).x, P(1).y + 1.2, 0.6, 20, 3.5); break;
        case 'popBrother': snd(SFX.pop); pop(e.x, e.y + 1.7, 'BOING! HOP!', 'cool'); break;
        case 'extraLife': snd(SFX.life); pop(P(e.i).x, P(e.i).y + 1.8, 'EXTRA LIFE!', 'big'); break;
        case 'clear':
          if (w.kind === 'bonus') break; // bonusEnd or perfect says it
          snd(SFX.clear);
          big('PHASE CLEAR!', 'GREAT BONKING!');
          for (const p of w.players) if (!p.out) confetti.burst(p.x, p.y + 1.2, 0.6, 40, 5);
          break;
        case 'perfect': snd(SFX.perfect); big('PERFECT!', `+${fmt(S.SCORE.perfect)}`); confetti.rain(-9, 9, 13, 80); break;
        case 'bonusEnd': snd(SFX.clear); big('TIME UP!', `${e.got} OF ${e.all} COINS`); break;
        case 'out': if (w.two) toast(`${NAME(e.who)} IS OUT OF LIVES`); break;
        case 'over': snd(SFX.gameOver); big('GAME OVER'); break;
      }
    }
  }
  function cheer() { G.cheerT = 1.4; }

  // ---------- pops, toasts, big words (page text, so 中文 works by itself) ----------
  function pop(x, y, text, cls) {
    if (G.demo) return;
    const [sx, sy] = toScreen(x, y, 0.5);
    const d = document.createElement('div');
    d.className = 'pop' + (cls ? ' ' + cls : '');
    d.textContent = text;
    d.style.left = Math.max(40, Math.min(innerWidth - 40, sx)) + 'px';
    d.style.top = Math.max(60, sy) + 'px';
    $('pops').appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }
  function clearPops() { $('pops').innerHTML = ''; }
  let toastTimer = 0;
  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  let bigTimer = 0;
  function big(text, small) {
    if (G.demo) return;
    const b = $('bigmsg');
    b.innerHTML = '';
    b.appendChild(document.createTextNode(text));
    if (small) { const s = document.createElement('small'); s.textContent = small; b.appendChild(s); }
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(bigTimer);
    bigTimer = setTimeout(() => b.classList.remove('show'), 1400);
  }
  function setText(el, s) {
    if (!el || el._t === s) return;
    el._t = s;
    el.textContent = s;
  }

  // ---------- drawing the world ----------
  const FACE_R = -1.95, FACE_L = 1.95; // side-on, a little toward the camera
  const turn = (cur, want, k) => cur + (((want - cur + PI * 3) % (PI * 2)) - PI) * k;
  function signature(who, n) {
    const sig = (Kit.roster.get(who) || {}).signature || ['wave'];
    return sig[(n || 0) % sig.length];
  }
  function visuals(dt) {
    const w = G.w;
    const k = 1 - Math.exp(-16 * dt);
    for (const b of A.bubbles) { b.position.y += b.userData.v * dt; b.position.x += Math.sin(G.time + b.userData.p) * 0.1 * dt; if (b.position.y > 17) b.position.y = -2; }
    for (const u of G.bumps) u.t += dt;
    G.bumps = G.bumps.filter((u) => u.t < 0.3);
    floors.update(G.bumps);
    // the BOING block: squash and wobble when bumped, gone when used up
    block.visible = w.block.left > 0;
    if (block.userData.left !== w.block.left) { block.userData.left = w.block.left; block.userData.draw(Math.max(0, w.block.left)); }
    const ht = w.block.hitT;
    const sq = ht < 0.45 ? Math.sin((ht / 0.45) * PI * 2.5) * (1 - ht / 0.45) : 0;
    block.scale.set(1 + sq * 0.22, 1 - sq * 0.3, 1 + sq * 0.1);
    G.cheerT = Math.max(0, (G.cheerT || 0) - dt);
    if (G.scene2) G.scene2.t += dt;
    critters(dt, k);
    coins(dt);
    brothers(dt, k);
    buddy(dt, k);
    spectators(dt, k);
    respawnCloud(dt);
    confetti.update(dt);
    const sc = G.scene2;
    if (sc && sc.kind === 'win' && Math.floor(sc.t * 2) !== Math.floor((sc.t - dt) * 2)) confetti.rain(-7, 7, 13, 30);
    hud();
  }

  function meshFor(key, kind) {
    let m = live.get(key);
    if (!m) {
      m = pools[kind].pop() || (kind === 'coin' ? A.coin() : A.critter(kind));
      if (!m.parent) scene.add(m);
      m.visible = true;
      m.userData.seen = 0;
      live.set(key, m);
    }
    m.userData.seen = G.frame;
    return m;
  }
  function sweep(prefix) {
    for (const [key, m] of live) {
      if (key[0] !== prefix || m.userData.seen === G.frame) continue;
      m.visible = false;
      live.delete(key);
      pools[m.userData.kind || 'coin'].push(m);
    }
  }
  function critters(dt, k) {
    const w = G.w;
    hands.forEach((h) => (h.visible = false));
    let hi = 0;
    for (const c of w.critters) {
      if (c.st === 'gone' || c.st === 'pipe') continue;
      const m = meshFor('c' + c.id, c.kind);
      const u = m.userData;
      A.tintCritter(m, c.lvl, c.angry);
      const t = G.time + c.id;
      let x = c.x, y = c.y, rz = 0, s = 1;
      const walking = c.st === 'walk' || c.st === 'out';
      // facing: crabs face us and scuttle sideways; beetles and flies look where they go
      const want = c.kind === 'crab' ? 0 : c.dir > 0 ? -0.45 : PI + 0.45;
      m.rotation.y = c.st === 'kicked' || c.st === 'bye' ? m.rotation.y : turn(m.rotation.y, want, Math.min(1, k * 1.5));
      if (c.st === 'flip') {
        rz = PI;
        if (c.flipT < 1.6) rz += Math.sin(t * 40) * 0.25; // about to flip back
        u.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 30 + i) * 0.8));
      } else if (walking) {
        const sp = S.speed(w, c);
        u.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 6 * sp + i * 1.7) * 0.5));
        if (c.kind === 'crab') { y += Math.abs(Math.sin(t * 7)) * 0.14; u.claws.forEach((a, i) => (a.rotation.z = Math.sin(t * (c.angry ? 18 : 6) + i * PI) * 0.4)); }
        if (u.key) u.key.rotation.y += dt * 5 * sp;
      }
      if (u.wings.length) {
        const fast = c.st === 'walk' && c.air;
        u.wings.forEach((wg, i) => (wg.rotation.x = (i ? 1 : -1) * (0.3 + Math.sin(t * (fast ? 50 : 14)) * (fast ? 0.7 : 0.25))));
      }
      if (c.st === 'kicked') { rz = (u.spin = (u.spin || 0) + dt * 16); }
      else u.spin = 0;
      if (c.st === 'bye') {
        // in the bottom pipe's mouth, waving goodbye, then gone
        const e = c.t2 / S.BYE_T;
        x = Math.sign(c.x) * (LV.PIPE_X + 0.15);
        y = 0.2;
        rz = 0;
        m.rotation.y = c.x > 0 ? -0.8 : PI + 0.8;
        s = e > 0.75 ? Math.max(0.05, 1 - (e - 0.75) / 0.25) : 1;
        const h = hands[hi] || (hands[hi] = A.emoji('👋', 0.5));
        if (!h.parent) scene.add(h);
        h.visible = true;
        h.position.set(x - Math.sign(c.x) * 0.55, 1.15 + Math.sin(G.time * 10) * 0.08, 0.6);
        h.material.rotation = Math.sin(G.time * 12) * 0.5;
        hi++;
      }
      u.flip.rotation.z = c.st === 'flip' ? u.flip.rotation.z + (rz - u.flip.rotation.z) * Math.min(1, k * 1.6) : rz;
      m.position.set(x, y, 0);
      m.scale.setScalar(s);
    }
    sweep('c');
  }
  function coins(dt) {
    const w = G.w;
    for (const kq of w.coins) {
      if (kq.st === 'gone' || kq.st === 'pipe') continue;
      const m = meshFor('k' + kq.id, 'coin');
      m.position.set(kq.x, kq.y + (kq.walk ? 0.35 : Math.sin(G.time * 3 + kq.id) * 0.08), 0);
      m.rotation.y += dt * (kq.walk ? 6 : 3);
    }
    sweep('k');
  }

  function brothers(dt, k) {
    const w = G.w, sc = G.scene2;
    const shown = new Set();
    for (const id of ['teddy', 'tommy']) for (const kk of ['stars', 'ball', 'peace', 'glow', 'bubble', 'mini']) props[id][kk].visible = false;
    if (sc && sc.kind === 'win') return winPose(sc, dt, k);
    for (const p of w.players) {
      if (p.out) continue;
      const P = people[p.who], o = props[p.who];
      shown.add(p.who);
      P.root.visible = true;
      let x = p.x, y = p.y, mode = 'stand', ph = 0, want = p.face > 0 ? FACE_R : FACE_L;
      const cheering = w.phase === 'clear' && (w.kind !== 'bonus' || w.bonusGot >= w.bonusAll);
      if (p.mode === 'ground') {
        if (Math.abs(p.vx) > 0.1 && w.phase === 'play') { mode = 'run'; ph = p.walkT * 11; }
      } else if (p.mode === 'air') mode = p.vy > 0 ? 'jumpshot' : 'jump';
      if (cheering && p.mode === 'ground') { mode = signature(p.who, w.pi); ph = G.time * 8; want = PI; }
      if (G.w.buddy && G.w.buddy.kind === 'hi5' && G.w.buddy.t < 0.9) { mode = 'give'; want = p.i ? FACE_L : FACE_R; }
      if (p.mode === 'bonked') {
        // dizzy for a moment, then a soap bubble floats him up to the cloud at the top
        const e = p.t;
        want = PI + e * 14;
        mode = 'fall';
        if (e > 0.55) {
          const u = Math.min(1, (e - 0.55) / (S.BONK_T - 0.55)), tx = w.two ? (p.i ? 0.6 : -0.6) : 0;
          x = p.x + (tx - p.x) * u;
          y = p.y + (LV.FLOOR_Y[3] - p.y) * u + Math.sin(u * PI) * 0.6;
          o.bubble.visible = true;
          o.bubble.position.set(x, y + 0.7, 0.55);
        } else {
          o.stars.visible = true;
          P.head.getWorldPosition(v3);
          o.stars.position.set(v3.x, v3.y + 0.3, v3.z);
          o.stars.userData.spin(G.time);
        }
      }
      P.root.position.set(x, y, 0.55);
      P.root.scale.setScalar(SCALE);
      P.root.rotation.y = p.mode === 'bonked' ? want : turn(P.root.rotation.y, want, Math.min(1, k * 1.5));
      Kit.people.pose(P, ph, mode, k);
      P.rig.position.y = 0;
      if (p.mode === 'air' && p.vy > 0) { P.armL.rotation.x = P.armR.rotation.x = PI * 0.95; } // fists up: bonk the floor
      if (cheering && (mode === 'jumpshot' || mode === 'peace')) sigProps(P, o, mode);
      if (p.inv > 0 && p.mode !== 'bonked') { o.glow.visible = true; o.glow.position.set(x, y + 0.7, 0.3); o.glow.material.opacity = 0.35 + Math.sin(G.time * 10) * 0.15; }
    }
    for (const id of ['teddy', 'tommy']) if (!shown.has(id) && !(w.buddy && w.buddy.who === id)) people[id].root.visible = false;
  }
  function sigProps(P, o, mode) {
    if (mode === 'jumpshot') {
      P.root.position.y += Math.abs(Math.sin(G.time * 4)) * 0.4;
      o.ball.visible = true;
      Kit.people.handWorld(P, 1, v3);
      o.ball.position.set(v3.x, v3.y + 0.25 + Math.max(0, Math.sin(G.time * 4)) * 0.8, v3.z + 0.2);
    } else if (mode === 'peace') {
      o.peace.visible = true;
      P.head.getWorldPosition(v3);
      o.peace.position.set(v3.x + 0.45, v3.y + 0.3 + Math.sin(G.time * 5) * 0.06, v3.z + 0.3);
    }
  }
  function winPose(sc, dt, k) {
    // the brothers on the ground floor doing their signature moves, the top scorer in the middle
    const ids = sc.who;
    ids.forEach((id, i) => {
      const P = people[id];
      P.root.visible = true;
      P.root.position.set(ids.length === 2 ? (i ? 1.6 : -0.4) : 0, 0, 1.2);
      P.root.scale.setScalar(SCALE * (i ? 1 : 1.15));
      P.root.rotation.y = PI;
      const mode = signature(id, Math.floor(sc.t / 2.5));
      Kit.people.pose(P, G.time * 8, mode, k);
      P.rig.position.y = 0;
      sigProps(P, props[id], mode);
    });
    for (const id of ['teddy', 'tommy']) if (!ids.includes(id)) people[id].root.visible = false;
  }

  function buddy(dt, k) {
    const w = G.w, bd = w.buddy;
    treat.visible = false;
    if (!bd || bd.kind !== 'boing' || (G.scene2 && G.scene2.kind === 'win')) return;
    const p = w.players[0];
    const B = people[bd.who], o = props[bd.who];
    const r = Kit.roster.get(bd.who) || {};
    const s = SCALE * (r.buddyScale || 0.8);
    const t = bd.t;
    B.root.visible = true;
    const side = -(p.face || 1);
    const hx = S.wrap(p.x + side * 1.0), hy = p.y + 0.35;
    const yHit = LV.BLOCK.yb - 2 * s; // his head under the block
    let x, y, mode, want = PI, grow = 1, onCloud = true;
    if (t < S.B_GO && bd.done === 0) {
      x = hx; y = hy + Math.sin(G.time * 3) * 0.06;
      grow = Math.min(1, t * 5);
      mode = t < 0.55 ? signature(bd.who, bd.n) : 'give';
    } else if (t < 1.5) {
      // flies on his little cloud to the middle, under the BOING block
      const u = (t - S.B_GO) / (1.5 - S.B_GO);
      const fx = bd.done ? 0 : hx, fy = bd.done ? 0 : hy;
      x = fx + (0 - fx) * u;
      y = fy + (0 - fy) * u + Math.sin(u * PI) * 1.2;
      mode = 'jump';
      want = x < 0 ? FACE_R : FACE_L;
    } else if (t < S.B_BOING) {
      const u = (t - 1.5) / (S.B_BOING - 1.5);
      x = 0; y = yHit * Math.sin((u * PI) / 2);
      mode = 'jumpshot'; onCloud = false;
    } else if (t < 2.05) {
      const u = (t - S.B_BOING) / (2.05 - S.B_BOING);
      x = 0; y = yHit * (1 - u * u);
      mode = 'jumpshot'; onCloud = false;
    } else {
      x = 0; y = 0;
      mode = 'wave';
      onCloud = false;
      if (t > S.B_END - 0.25 && !bd.more) grow = Math.max(0.01, (S.B_END - t) / 0.25);
    }
    B.root.scale.setScalar(Math.max(0.01, s * grow));
    B.root.position.set(x, y, 0.75);
    B.root.rotation.y = turn(B.root.rotation.y, want, Math.min(1, k * 1.5));
    Kit.people.pose(B, G.time * 8, mode, k);
    B.rig.position.y = 0;
    if (mode === 'jumpshot' && !onCloud) { B.armL.rotation.x = B.armR.rotation.x = PI; }
    if (t < 0.55 && bd.done === 0) sigProps(B, o, mode);
    if (onCloud) { o.mini.visible = true; o.mini.position.set(x, y + 0.1, 0.75); }
    if (t >= 0.55 && t < 0.9 && bd.done === 0) {
      const u = (t - 0.55) / 0.35;
      treat.visible = true;
      A.setEmoji(treat, bd.treat);
      treat.position.set(hx + (p.x - hx) * u, hy + 1 + Math.sin(u * PI) * 0.8 + (p.y + 0.9 - hy - 1) * u, 0.9);
    }
  }

  function spectators(dt, k) {
    const w = G.w;
    const happy = G.cheerT > 0 || w.phase === 'clear' || (G.scene2 && G.scene2.kind === 'win');
    [['foxy', -10.25], ['froggy', 10.25]].forEach(([id, x], i) => {
      const P = people[id];
      P.root.visible = true;
      const y = LV.FLOOR_Y[3] + 1.22;
      P.root.position.set(x, y + (happy ? Math.abs(Math.sin(G.time * 7 + i)) * 0.25 : 0), -0.1);
      P.root.rotation.y = PI + (x < 0 ? -0.5 : 0.5);
      Kit.people.pose(P, G.time * 7, happy ? 'wave' : 'stand', k);
      P.rig.position.y = 0;
    });
  }
  function respawnCloud(dt) {
    const w = G.w;
    const on = w.players.filter((p) => p.cloudT > 0 && !p.out);
    cloud.visible = on.length > 0;
    if (!on.length) return;
    const left = Math.max(...on.map((p) => p.cloudT));
    cloud.position.set(0, LV.CLOUD.y, 0.2);
    const s = Math.min(1, left / 0.6);
    cloud.scale.set(1.25 * s, 1.1 * s, 1);
  }

  // ---------- HUD ----------
  function hud() {
    const w = G.w;
    if (!w || G.demo) return;
    const top = store.table(w.level)[0].score;
    for (let i = 0; i < 2; i++) {
      const box = $('hudP' + i);
      const pl = w.players[i];
      box.style.display = pl ? '' : 'none';
      if (!pl) continue;
      setText(box.querySelector('.lbl'), NAME(pl.who));
      setText(box.querySelector('.sc'), fmt(pl.score));
      setText(box.querySelector('.lives'), pl.out ? '—' : pl.lives > 6 ? `❤️ ×${pl.lives}` : '❤️'.repeat(Math.max(0, pl.lives)));
    }
    setText($('hudHi'), fmt(Math.max(top, ...w.players.map((p) => p.score))));
    setText($('hudStage'), phaseLine());
    const bonus = w.kind === 'bonus' && w.phase !== 'clear';
    $('hudTimer').classList.toggle('off', !bonus);
    if (bonus) {
      setText($('hudTime'), String(Math.ceil(w.bonusT)));
      $('hudTime').classList.toggle('low', w.bonusT < 5);
    }
    const on = !!w.buddy;
    $('budBtn').classList.toggle('on', on);
    document.querySelector('.tb.call').classList.toggle('on', on);
  }

  function draw() {
    renderer.render(scene, cam);
  }

  // ---------- test hooks ----------
  function state() {
    const w = G.w;
    if (!w) return { screen: G.screen };
    const ps = w.players.map((p) => {
      const [sx, sy] = toScreen(p.x, p.y + 0.65, 0.55);
      return { who: p.who, x: +p.x.toFixed(3), y: +p.y.toFixed(3), mode: p.mode, f: p.sup ? p.sup.f : -1, cloud: !!(p.sup && p.sup.cloud), block: !!(p.sup && p.sup.block), face: p.face, sx: Math.round(sx), sy: Math.round(sy), score: p.score, lives: p.lives, out: p.out, inv: +p.inv.toFixed(2) };
    });
    return {
      screen: G.screen, paused: G.paused, demo: G.demo, phase: w.phase, pi: w.pi, kind: w.kind, level: w.level, two: w.two,
      p: ps[0], players: ps, critters: w.critters.map((c) => ({ id: c.id, kind: c.kind, st: c.st, f: c.f, x: +c.x.toFixed(2), lvl: c.lvl })),
      coins: w.coins.length, block: w.block.left, buddy: w.buddy && { kind: w.buddy.kind, who: w.buddy.who, t: +w.buddy.t.toFixed(2), more: w.buddy.more },
      muted: Kit.sound.isMuted(), sfx: Object.assign({}, SFX.log), lang: Kit.lang.get(), touch: document.body.classList.contains('touch'),
    };
  }
  window.game = {
    start(o) {
      o = o || {};
      if (o.players) G.players = o.players;
      if (o.who) G.who = o.who;
      if (o.level) G.level = o.level;
      play();
      if (o.phase != null) { G.w.pi = o.phase; S.loadPhase(G.w); G.w.events = []; }
      if (o.go) { G.w.phase = 'play'; G.w.phaseT = 0; }
      return state();
    },
    step(secs, o) {
      const n = Math.max(1, Math.round((secs || DT) / DT));
      for (let i = 0; i < n; i++) advance(DT);
      if (!o || o.draw !== false) draw();
      return state();
    },
    state,
    hold(v) { G.hold = v !== false; return G.hold; },
    call,
    pause, resume, showTitle, showResults,
    check: (only) => PB.check.run(only),
    checkFail: () => PB.check.fail(),
    // stand brother i on floor f at x (tests): the rules stay the real ones
    put(i, f, x) { S.put(G.w, i, f, x); return state(); },
    // no critters and none to come (tests that only look at moving); the phase stays on
    quiet() { G.w.critters = []; G.w.coins = []; G.w.queue = ['hold']; G.w.spawnT = 1e9; return state(); },
    critter(kind, f, x, dir) { return S.addCritter(G.w, kind, f, x, dir || 1); },
    sabotage(s) { G.sab = s || null; return G.sab; },
    toScreen,
    world: () => G.w,
    G,
    info() { draw(); const r = renderer.info.render; let meshes = 0; scene.traverseVisible((ob) => { if (ob.isMesh || ob.isSprite) meshes++; }); return { calls: r.calls, triangles: r.triangles, meshes, pixelRatio: renderer.getPixelRatio() }; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
