/* TT Pipe Bonk: the 3D things, chunky toy style. A giant toy bathroom (tiles, bubbles, a rubber duck), the floors as
   rows of toy bricks that pop up when bumped, the four pipes, the wobbly BOING block, the critters (wind-up beetles,
   hopping crabs, fluttering flies) that go redder as they get cross, coins, the respawn cloud, confetti and stars.
   js/game.js places and moves them. */
(function () {
  'use strict';
  const T = THREE, G = Kit.gfx, LV = PB.levels;
  const A = (PB.art = {});
  const mats = new Map();
  const mat = (color, o) => {
    const k = color + JSON.stringify(o || {});
    if (!mats.has(k)) mats.set(k, G.std(color, o));
    return mats.get(k);
  };
  A.FLOOR_COLORS = ['#ff9f1c', '#2fb5ff', '#7bd94a', '#c77dff'];
  A.KIND_COLORS = { beetle: '#3ccf6e', crab: '#ff9a3d', fly: '#8f7bff' };
  const RED = new T.Color('#ff2e3a');

  // ---------- the backdrop ----------
  function tileTex() {
    const [c, g] = G.makeCanvas(512, 512);
    g.fillStyle = '#d7f3ef';
    g.fillRect(0, 0, 512, 512);
    const cols = ['#9fe6dc', '#c9f3ec', '#a9e3ff', '#ffe7a3'];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        g.fillStyle = cols[(x + y * 3) % cols.length];
        G.roundRect(g, x * 128 + 6, y * 128 + 6, 116, 116, 16);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.55)';
        G.roundRect(g, x * 128 + 14, y * 128 + 12, 60, 14, 7);
        g.fill();
      }
    }
    return G.toTexture(c, [20, 10.6]);
  }
  A.backdrop = function (scene) {
    const wall = new T.Mesh(new T.PlaneGeometry(64, 34), new T.MeshStandardMaterial({ map: tileTex(), roughness: 0.6 }));
    wall.position.set(0, 7, -3.2);
    scene.add(wall);
    // a thick toy base under the ground floor
    const base = new T.Mesh(new T.BoxGeometry(64, 6, 4), mat('#5a3fd1', { roughness: 0.8 }));
    base.position.set(0, -3.45, -0.6);
    scene.add(base);
    const trim = new T.Mesh(new T.BoxGeometry(64, 0.25, 4.05), mat('#ffd400', { roughness: 0.6 }));
    trim.position.set(0, -0.6, -0.6);
    scene.add(trim);
    // bubbles drifting up the wall
    A.bubbles = [];
    const bm = new T.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 });
    for (let i = 0; i < 14; i++) {
      const b = new T.Mesh(new T.SphereGeometry(0.25 + (i % 4) * 0.12, 14, 10), bm);
      b.position.set(-15 + ((i * 7.3) % 30), ((i * 3.7) % 16) - 1, -2.6);
      b.userData.v = 0.25 + (i % 3) * 0.12;
      b.userData.p = i;
      scene.add(b);
      A.bubbles.push(b);
    }
    const d = duck();
    d.position.set(0, 8.7, -2.9);
    d.rotation.y = -0.5;
    d.scale.setScalar(0.45);
    scene.add(d);
  };
  // a rubber duck (on the wall, between the floors)
  function duck() {
    const g = new T.Group();
    const y = mat('#ffd60a', { roughness: 0.5 });
    const body = new T.Mesh(new T.SphereGeometry(1, 18, 12), y);
    body.scale.set(1.3, 0.85, 1);
    g.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.6, 16, 12), y);
    head.position.set(0.7, 1.0, 0);
    g.add(head);
    const beak = new T.Mesh(new T.BoxGeometry(0.5, 0.18, 0.5), mat('#ff8a1f'));
    beak.position.set(1.25, 0.95, 0);
    g.add(beak);
    for (const z of [-0.3, 0.3]) {
      const e = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), mat('#14121f'));
      e.position.set(1.0, 1.2, z);
      g.add(e);
    }
    const tail = new T.Mesh(new T.ConeGeometry(0.35, 0.6, 8), y);
    tail.position.set(-1.3, 0.35, 0);
    tail.rotation.z = 0.9;
    g.add(tail);
    return g;
  }

  // ---------- the floors: rows of toy bricks that pop when bumped ----------
  function brickTex() {
    const [c, g] = G.makeCanvas(128, 64);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = 'rgba(255,255,255,1)';
    g.fillRect(4, 4, 120, 12);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, 54, 128, 10);
    g.fillRect(122, 0, 6, 64);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.fillRect(0, 0, 4, 64);
    return G.toTexture(c);
  }
  A.floors = function (scene) {
    const blocks = [];
    for (const s of LV.SEGS) {
      const n = Math.max(1, Math.round(s.x1 - s.x0));
      const bw = (s.x1 - s.x0) / n;
      for (let k = 0; k < n; k++) blocks.push({ f: s.f, x: s.x0 + bw * (k + 0.5), y: s.y - LV.TH / 2, w: bw });
    }
    const geo = new T.BoxGeometry(1, LV.TH, 1.6);
    const m = new T.MeshStandardMaterial({ map: brickTex(), roughness: 0.55 });
    const im = new T.InstancedMesh(geo, m, blocks.length);
    const col = new T.Color(), m4 = new T.Matrix4(), q = new T.Quaternion(), s3 = new T.Vector3(), p3 = new T.Vector3();
    blocks.forEach((b, i) => im.setColorAt(i, col.set(A.FLOOR_COLORS[b.f])));
    im.instanceColor.needsUpdate = true;
    // studs on top of every brick, merged into one mesh per floor colour (still things: few draw calls)
    const studs = A.FLOOR_COLORS.map(() => []);
    for (const b of blocks) {
      for (const dz of [-0.4, 0.4]) {
        const st = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.1, 10));
        st.position.set(b.x, b.y + LV.TH / 2 + 0.05, dz);
        studs[b.f].push(st);
      }
    }
    const studMeshes = studs.map((list, f) => merge(list, mat(A.FLOOR_COLORS[f], { roughness: 0.5 })));
    const studGroup = new T.Group();
    studMeshes.forEach((sm) => studGroup.add(sm));
    scene.add(studGroup);
    scene.add(im);
    // bumps: [{ f, x, t }] → bricks near x pop up (the studs of the ground never move; the others hide under the pop)
    function update(bumps) {
      blocks.forEach((b, i) => {
        let dy = 0;
        for (const u of bumps) {
          if (u.f !== b.f || u.t > 0.24) continue;
          const d = Math.abs(PB.sim.wdx(b.x, u.x));
          if (d < 1.3) dy = Math.max(dy, 0.34 * Math.sin((Math.PI * u.t) / 0.24) * (1 - d / 1.3));
        }
        m4.compose(p3.set(b.x, b.y + dy, 0), q, s3.set(b.w * 0.98, 1, 1));
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
    }
    update([]);
    return { im, blocks, update };
  };

  // many still meshes with one material drawn as one (from TT Barrel Climb)
  function merge(meshes, material) {
    const parts = meshes.map((m) => {
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrix);
      return g;
    });
    const cat = (name, n) => {
      const out = new Float32Array(parts.reduce((a, g) => a + g.attributes.position.count * n, 0));
      let o = 0;
      for (const g of parts) { out.set(g.attributes[name].array, o); o += g.attributes.position.count * n; }
      return new T.BufferAttribute(out, n);
    };
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', cat('position', 3));
    geo.setAttribute('normal', cat('normal', 3));
    if (parts.every((g) => g.attributes.uv)) geo.setAttribute('uv', cat('uv', 2));
    parts.forEach((g) => g.dispose());
    return new T.Mesh(geo, material);
  }

  // ---------- pipes: two at the top corners (critters come out), two at the bottom (they go home) ----------
  A.pipes = function (scene) {
    const body = mat('#16c2b0', { roughness: 0.35, metalness: 0.1 }), rim = mat('#ffd400', { roughness: 0.4 }), dark = mat('#0b3b36', { roughness: 0.9 });
    const R = 0.62;
    const out = [];
    for (const y of [LV.FLOOR_Y[3], 0]) {
      for (const sx of [-1, 1]) {
        const g = new T.Group();
        const len = 5;
        const tube = new T.Mesh(new T.CylinderGeometry(R, R, len, 20), body);
        tube.rotation.z = Math.PI / 2;
        tube.position.x = sx * (LV.PIPE_X + 0.35 + len / 2);
        g.add(tube);
        const lip = new T.Mesh(new T.CylinderGeometry(R + 0.16, R + 0.16, 0.42, 20), rim);
        lip.rotation.z = Math.PI / 2;
        lip.position.x = sx * (LV.PIPE_X + 0.2);
        g.add(lip);
        const hole = new T.Mesh(new T.CircleGeometry(R - 0.04, 20), dark);
        hole.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
        hole.position.x = sx * (LV.PIPE_X - 0.02);
        g.add(hole);
        // a bolt ring and a shine stripe
        const band = new T.Mesh(new T.CylinderGeometry(R + 0.06, R + 0.06, 0.2, 20), mat('#0e9e8f'));
        band.rotation.z = Math.PI / 2;
        band.position.x = sx * (LV.PIPE_X + 1.6);
        g.add(band);
        g.position.set(0, y + R - 0.02, -0.15);
        scene.add(g);
        out.push(g);
      }
    }
    return out;
  };

  // ---------- the BOING block: a wobbly jelly with BOING on it and a dot per bump left ----------
  A.block = function () {
    const [c, g] = G.makeCanvas(256, 176);
    const tex = G.toTexture(c);
    const draw = (left) => {
      g.clearRect(0, 0, 256, 176);
      const gr = g.createLinearGradient(0, 0, 0, 176);
      gr.addColorStop(0, '#ff8fd0');
      gr.addColorStop(1, '#ff3d9a');
      g.fillStyle = gr;
      G.roundRect(g, 0, 0, 256, 176, 30);
      g.fill();
      g.lineWidth = 10;
      g.strokeStyle = '#ffffff';
      G.roundRect(g, 8, 8, 240, 160, 24);
      g.stroke();
      const word = Kit.lang.t('BOING');
      g.font = `${word.length > 3 ? 64 : 84}px ${G.FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 12;
      g.strokeStyle = '#14121f';
      g.strokeText(word, 128, 74);
      g.fillStyle = '#ffd400';
      g.fillText(word, 128, 74);
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(88 + k * 40, 140, 13, 0, Math.PI * 2);
        g.fillStyle = k < left ? '#ffffff' : 'rgba(20,18,31,0.35)';
        g.fill();
      }
      tex.needsUpdate = true;
    };
    const B = LV.BLOCK;
    const w = B.x1 - B.x0, h = B.yt - B.yb;
    const side = new T.MeshStandardMaterial({ color: '#ff5fb0', roughness: 0.3, emissive: '#5a0030', emissiveIntensity: 0.25 });
    const face = new T.MeshStandardMaterial({ map: tex, roughness: 0.3, emissive: '#330018', emissiveIntensity: 0.2 });
    const box = new T.Mesh(new T.BoxGeometry(w, h, 1.4), [side, side, side, side, face, side]);
    box.position.y = h / 2;
    const grp = new T.Group();
    grp.add(box);
    grp.position.set((B.x0 + B.x1) / 2, B.yb, 0);
    grp.userData = { draw, left: -1, box, h };
    draw(3);
    grp.userData.left = 3;
    Kit.lang.onChange(() => draw(grp.userData.left));
    return grp;
  };

  // ---------- critters ----------
  function eyes(parent, x, y, z, r, gap) {
    const white = mat('#ffffff', { roughness: 0.3 }), pupil = mat('#14121f', { roughness: 0.3 });
    const out = [];
    for (const s of [-1, 1]) {
      const e = new T.Mesh(new T.SphereGeometry(r, 12, 10), white);
      e.position.set(x, y, z + s * gap);
      parent.add(e);
      const p = new T.Mesh(new T.SphereGeometry(r * 0.5, 10, 8), pupil);
      p.position.set(x + r * 0.62, y, z + s * gap);
      parent.add(p);
      out.push(p);
    }
    return out;
  }
  A.critter = function (kind) {
    const root = new T.Group();
    const flip = new T.Group(); // pivots at the middle so it can roll onto its back
    flip.position.y = 0.36;
    root.add(flip);
    const inner = new T.Group();
    inner.position.y = -0.36;
    flip.add(inner);
    const tint = new T.MeshStandardMaterial({ color: A.KIND_COLORS[kind], roughness: 0.4 });
    const legs = [], wings = [], claws = [];
    const legMat = mat('#2a1f3d', { roughness: 0.7 });
    let key = null;
    if (kind === 'beetle') {
      const shell = new T.Mesh(new T.SphereGeometry(0.44, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), tint);
      shell.scale.set(1.15, 0.95, 0.95);
      shell.position.y = 0.16;
      inner.add(shell);
      const under = new T.Mesh(new T.CylinderGeometry(0.46, 0.46, 0.12, 18), mat('#2a1f3d'));
      under.scale.set(1.12, 1, 0.92);
      under.position.y = 0.16;
      inner.add(under);
      for (const [x, z] of [[-0.12, 0.2], [0.14, -0.18], [0.0, 0.0]]) {
        const spot = new T.Mesh(new T.SphereGeometry(0.08, 10, 8), mat('#fff6c9'));
        spot.scale.set(1, 0.5, 1);
        spot.position.set(x, 0.53, z);
        inner.add(spot);
      }
      const head = new T.Mesh(new T.SphereGeometry(0.2, 14, 10), mat('#2a1f3d'));
      head.position.set(0.48, 0.26, 0);
      inner.add(head);
      eyes(inner, 0.6, 0.36, 0, 0.09, 0.1);
      for (const z of [-0.07, 0.07]) {
        const ant = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.3, 5), legMat);
        ant.position.set(0.6, 0.55, z);
        ant.rotation.z = -0.6;
        inner.add(ant);
      }
      key = new T.Group();
      const stem = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.22, 6), mat('#ffd400', { metalness: 0.4, roughness: 0.3 }));
      stem.position.y = 0.1;
      key.add(stem);
      for (const s of [-1, 1]) {
        const loop = new T.Mesh(new T.TorusGeometry(0.1, 0.035, 6, 14), mat('#ffd400', { metalness: 0.4, roughness: 0.3 }));
        loop.position.set(s * 0.11, 0.24, 0);
        key.add(loop);
      }
      key.position.set(-0.12, 0.55, 0);
      inner.add(key);
      for (let k = 0; k < 6; k++) {
        const l = new T.Mesh(new T.BoxGeometry(0.06, 0.2, 0.06), legMat);
        l.position.set(-0.26 + (k % 3) * 0.26, 0.08, k < 3 ? 0.34 : -0.34);
        inner.add(l);
        legs.push(l);
      }
    } else if (kind === 'crab') {
      const body = new T.Mesh(new T.SphereGeometry(0.4, 18, 12), tint);
      body.scale.set(1.35, 0.62, 0.9);
      body.position.y = 0.32;
      inner.add(body);
      for (const s of [-1, 1]) {
        const stalk = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.26, 6), tint);
        stalk.position.set(s * 0.14, 0.6, 0.18);
        inner.add(stalk);
        const e = new T.Mesh(new T.SphereGeometry(0.1, 12, 10), mat('#ffffff', { roughness: 0.3 }));
        e.position.set(s * 0.14, 0.76, 0.2);
        inner.add(e);
        const p = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), mat('#14121f'));
        p.position.set(s * 0.14, 0.77, 0.29);
        inner.add(p);
        const arm = new T.Group();
        arm.position.set(s * 0.5, 0.36, 0.1);
        const a = new T.Mesh(new T.BoxGeometry(0.28, 0.08, 0.08), tint);
        a.position.x = s * 0.12;
        arm.add(a);
        const claw = new T.Mesh(new T.SphereGeometry(0.16, 12, 10), tint);
        claw.scale.set(1, 0.8, 0.7);
        claw.position.set(s * 0.28, 0.12, 0);
        arm.add(claw);
        const pinch = new T.Mesh(new T.BoxGeometry(0.06, 0.16, 0.08), tint);
        pinch.position.set(s * 0.34, 0.28, 0);
        arm.add(pinch);
        inner.add(arm);
        claws.push(arm);
        for (let k = 0; k < 3; k++) {
          const l = new T.Mesh(new T.BoxGeometry(0.22, 0.05, 0.05), legMat);
          l.position.set(s * 0.42, 0.14, -0.2 + k * 0.16);
          l.rotation.z = s * -0.7;
          inner.add(l);
          legs.push(l);
        }
      }
      const smile = new T.Mesh(new T.BoxGeometry(0.22, 0.03, 0.03), mat('#7a2a10'));
      smile.position.set(0, 0.3, 0.37);
      inner.add(smile);
    } else {
      const body = new T.Mesh(new T.SphereGeometry(0.3, 16, 12), tint);
      body.position.y = 0.4;
      inner.add(body);
      const belly = new T.Mesh(new T.SphereGeometry(0.22, 12, 10), mat('#ffe066'));
      belly.position.set(-0.12, 0.33, 0);
      inner.add(belly);
      eyes(inner, 0.22, 0.5, 0, 0.13, 0.13);
      const wm = new T.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, roughness: 0.2, side: T.DoubleSide });
      for (const s of [-1, 1]) {
        const wg = new T.Group();
        wg.position.set(-0.05, 0.62, s * 0.08);
        const wing = new T.Mesh(new T.CircleGeometry(0.3, 14), wm);
        wing.scale.set(1.3, 0.6, 1);
        wing.rotation.x = Math.PI / 2;
        wing.position.set(-0.15, 0.02, s * 0.22);
        wg.add(wing);
        inner.add(wg);
        wings.push(wg);
      }
      for (let k = 0; k < 4; k++) {
        const l = new T.Mesh(new T.BoxGeometry(0.04, 0.2, 0.04), legMat);
        l.position.set(-0.1 + (k % 2) * 0.2, 0.12, k < 2 ? 0.12 : -0.12);
        inner.add(l);
        legs.push(l);
      }
    }
    root.userData = { kind, tint, base: new T.Color(A.KIND_COLORS[kind]), flip, inner, legs, wings, claws, key, lvl: -1, angry: false };
    return root;
  };
  // redder each time it flips back (and when a crab gets cross)
  A.tintCritter = function (m, lvl, angry) {
    const u = m.userData;
    if (u.lvl === lvl && u.angry === angry) return;
    u.lvl = lvl;
    u.angry = angry;
    const k = Math.min(1, lvl * 0.45 + (angry ? 0.35 : 0));
    u.tint.color.copy(u.base).lerp(RED, k);
  };

  // ---------- coins ----------
  A.coin = function () {
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = '#ffc928';
    g.beginPath();
    g.arc(64, 64, 62, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffe680';
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 18 : 42;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = '#e0a000';
    g.lineWidth = 6;
    g.stroke();
    const capMat = new T.MeshStandardMaterial({ map: G.toTexture(c), metalness: 0.35, roughness: 0.35, emissive: '#553300', emissiveIntensity: 0.25 });
    const rimMat = mat('#e8a800', { metalness: 0.4, roughness: 0.35 });
    const m = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 0.09, 22), [rimMat, capMat, capMat]);
    m.rotation.x = Math.PI / 2;
    const g2 = new T.Group();
    g2.add(m);
    return g2;
  };

  // ---------- the respawn cloud ----------
  A.cloud = function () {
    const g = new T.Group();
    const m = new T.MeshStandardMaterial({ color: '#ffffff', emissive: '#dff4ff', emissiveIntensity: 0.45, roughness: 0.8 });
    [[-0.8, 0, 0.42], [-0.25, 0.12, 0.55], [0.35, 0.08, 0.5], [0.85, -0.02, 0.4], [0.05, -0.1, 0.5]].forEach(([x, y, r]) => {
      const s = new T.Mesh(new T.SphereGeometry(r, 14, 10), m);
      s.position.set(x, y - 0.3, 0);
      s.scale.set(1, 0.7, 0.9);
      g.add(s);
    });
    return g;
  };

  // ---------- confetti: one instanced mesh of little paper squares (from TT Barrel Climb) ----------
  A.confetti = function (scene, max) {
    max = max || 500;
    const geo = new T.PlaneGeometry(0.16, 0.1);
    const im = new T.InstancedMesh(geo, new T.MeshBasicMaterial({ side: T.DoubleSide }), max);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.frustumCulled = false;
    scene.add(im);
    const ps = [];
    const col = new T.Color(), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(1, 1, 1), v = new T.Vector3();
    const COLS = ['#ff3d7f', '#ffd400', '#18d4ff', '#7dff5a', '#ff8a1f', '#c77dff', '#ffffff'];
    for (let i = 0; i < max; i++) { im.setColorAt(i, col.set(COLS[i % COLS.length])); m4.makeScale(0, 0, 0); im.setMatrixAt(i, m4); }
    let next = 0;
    return {
      burst(x, y, z, n, power, colors) {
        for (let i = 0; i < n; i++) {
          const k = next++ % max;
          const a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random()) * (power || 4);
          ps[k] = { x, y, z: z || 0.5, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp + 1.5, vz: (Math.random() - 0.3) * 2, rx: Math.random() * 6, ry: Math.random() * 6, life: 1.6 + Math.random() * 1.2 };
          im.setColorAt(k, col.set(colors ? colors[i % colors.length] : COLS[k % COLS.length]));
        }
        im.instanceColor.needsUpdate = true;
      },
      rain(x0, x1, y, n) {
        for (let i = 0; i < n; i++) {
          const k = next++ % max;
          ps[k] = { x: x0 + Math.random() * (x1 - x0), y: y + Math.random() * 3, z: 0.6 + Math.random(), vx: (Math.random() - 0.5) * 1.5, vy: -1 - Math.random(), vz: 0, rx: Math.random() * 6, ry: Math.random() * 6, life: 4 + Math.random() * 2 };
          im.setColorAt(k, col.set(COLS[k % COLS.length]));
        }
        im.instanceColor.needsUpdate = true;
      },
      update(dt) {
        for (let k = 0; k < max; k++) {
          const p = ps[k];
          if (!p) continue;
          p.life -= dt;
          if (p.life <= 0) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); continue; }
          p.vy -= 6 * dt;
          p.vx *= 1 - 1.2 * dt;
          p.vy = Math.max(p.vy, -2.2);
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.rx += dt * 7; p.ry += dt * 5;
          q.setFromEuler(e.set(p.rx, p.ry, 0));
          s.setScalar(Math.min(1, p.life * 2));
          m4.compose(v.set(p.x, p.y, p.z), q, s);
          im.setMatrixAt(k, m4);
        }
        im.instanceMatrix.needsUpdate = true;
      },
      clear() { for (let k = 0; k < max; k++) if (ps[k]) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); } im.instanceMatrix.needsUpdate = true; },
    };
  };

  // ---------- spinning stars over a dizzy head, emoji sprites ----------
  A.stars = function () {
    const g = new T.Group();
    const tex = G.emojiTexture('⭐');
    for (let i = 0; i < 5; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false }));
      s.scale.set(0.3, 0.3, 1);
      g.add(s);
    }
    g.userData.spin = (t) => g.children.forEach((s, i) => { const a = t * 5 + (i / 5) * Math.PI * 2; s.position.set(Math.cos(a) * 0.42, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.42); });
    return g;
  };
  A.emoji = function (e, size) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(e), depthTest: false }));
    s.scale.set(size || 0.6, size || 0.6, 1);
    s.renderOrder = 5;
    s.userData.e = e;
    return s;
  };
  A.setEmoji = function (s, e) {
    if (s.userData.e === e) return;
    s.material.map = G.emojiTexture(e);
    s.material.needsUpdate = true;
    s.userData.e = e;
  };
})();
