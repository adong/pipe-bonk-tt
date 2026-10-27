#!/usr/bin/env node
/* The headless check from the command line: the same js/check.js the page runs as game.check().
     node tools/check.js          the brief's rules and more; exits 1 if anything fails
     node tools/check.js --fail   proves the check can fail: each sabotage in js/check.js must be caught */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Number, JSON, Object, Array, Map, Set, WeakMap, Date };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/title.js', 'js/levels.js', 'js/sim.js', 'js/bot.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const C = ctx.PB.check;
const t0 = Date.now();
if (process.argv.includes('--fail')) {
  const r = C.fail();
  for (const c of r.caught) console.log(`${c.caught ? 'caught ' : 'MISSED '} ${c.sabotage} (${c.what}) by ${c.check}: ${c.failed.join('; ')}`);
  console.log(r.ok ? `every sabotage was caught (${((Date.now() - t0) / 1000).toFixed(1)} s)` : 'SOME SABOTAGE WAS NOT CAUGHT');
  process.exit(r.ok ? 0 : 1);
}
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const r = C.run(only.length ? only : null);
for (const x of r.results) console.log(`${x.ok ? 'ok  ' : 'FAIL'} ${x.name}: ${x.info}`);
console.log(r.ok ? `all ${r.results.length} checks pass (${((Date.now() - t0) / 1000).toFixed(1)} s)` : `${r.failed.length} FAILED`);
process.exit(r.ok ? 0 : 1);
