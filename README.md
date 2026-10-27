# TT Pipe Bonk

[![TT Pipe Bonk title screen](docs/screenshot.jpg)](https://adong.github.io/pipe-bonk-tt/)

Press **?** any time (or tap the round **?** button on the left edge) to see the keys. The game waits while you look.
Tap the language button under it (the A文 icon) to switch between English and 中文; the dashboard and every game remember the choice.

**中文：** 水管碰碰：小虫子从上面的水管里爬出来。跳起来从下面顶地板，把小虫翻过来，再跑过去把它踢走，它会滚进下面的水管挥手拜拜。顶“嘣”方块，地板上的小虫全都翻过来！还有抓金币的奖励关。

## Play

A one-screen arcade game in a giant toy bathroom, starring Teddy and Tommy. Silly critters (wind-up beetles, hopping crabs and fluttering flies) come out of the pipes at the top corners and walk down the floors. Jump up under one to bump the floor and flip it over, then run into it to kick it off: it tumbles into a bottom pipe and waves goodbye, and a coin rolls out of a top pipe. Nobody gets hurt: an upright critter just bonks you dizzy and a soap bubble floats you up to a cloud.

A 3D game for the boys, built with Claude Code from plain JavaScript and Three.js on the shared Claude Games kit. There are no image, model or audio files: every texture is painted on a canvas and every sound is synthesised. The name, the critters, the BOING block, the art and the sounds are our own.

- **Single page:** open `dist/pipe-bonk-tt.html` (double-click works offline), or `index.html` with the `js/` and `kit/` folders next to it.
- **Players:** 1 player (Teddy or Tommy, and the other brother comes whenever you call him), or 2 players together on one keyboard or one iPad.
- **Level:** 🐣 **EASY** is the default, for Tommy (5): slower critters, flips last 9 seconds, 5 lives, and a full BOING block every phase. 🔥 **NORMAL** is for Teddy (8): faster critters, flips last 5.5 seconds, crabs need two bumps, 3 lives, and the BOING block refills after each bonus stage.
- **Score:** a flip is 10, a kick 800, a coin 800, a perfect bonus stage 3,000. An extra life at 20,000. HI-SCORE and the TOP BONKERS board (with Foxy 🦊 and Froggy 🐸, who cheer from the top pipes) are kept for each level.

## The screen

- **Four floors** of toy bricks: the ground, two side ledges with a gap in the middle, one long middle floor, and two top ledges with the pipes at the corners.
- **The screen wraps:** walk off one side and you come in on the other, on the same floor. Critters wrap too.
- **Bump:** a jump under a slab pops its bricks up. The critter standing over that spot flips onto its back (a crab on NORMAL gets grumpy first and needs a second bump). Bumping a flipped one again keeps it flipped longer.
- **Kick:** run into a flipped critter. Run into an upright one and it bonks you (a life), so bump it first!
- **Flip back:** a flipped critter wiggles, then flips back after a while, faster and redder each time (UPSY-DAISY!).
- **The BOING block** in the middle: bump it from below and every critter on the floor flips, flies in mid-hop too. It works 3 times (the dots on it), then it's gone until it refills.
- **Critters** walk down floor by floor; on the ground they go into a bottom pipe and come back out at the top. Flies hop, and can only be bumped when they're low.
- **Phases:** a phase ends when every critter is gone. Every third phase is a **bonus stage**: grab all 10 coins before the time runs out for PERFECT. After phase 9 it starts again, a little faster.
- **2 players:** together on the same screen, each with his own score and lives. Bumping your brother from below just pops him up.

## Controls

| | 1 player | 2 players: Teddy | 2 players: Tommy |
|---|---|---|---|
| walk | ← → or A D | A D | ← → |
| jump (bump the floor above) | Space, ↑ or W | W | ↑ |
| call your brother · high five | T | T | T |
| pause · sound | P or Esc · M | | |

On the title: 1 / 2 players, E easy, N normal, C (or ← →) picks who plays, Enter starts.

**Touch:** ◀ ▶ bottom left, ⤴️ and your brother's face bottom right. In 2 players each brother has his own ◀ ▶ ⤴️ in his corner, and ✋ is the high five. The floors fit the free part of the screen, beside or above the buttons, on phones and iPads.

## Call your brother (companion mode)

- **Any time, as often as you like:** press **T** or tap his face (1 player). Calling again while he's here gets one more BOING.
- **He pops in** on a little cloud at his own size, does his signature move (Teddy's boxing or 🏀 jump shot, Tommy's ✌️ Y pose) and tosses you a treat (🍦 💧 🧃 🍪 🍉 🍌, +100).
- **Then he flies to the BOING block and bumps it** for free (it doesn't use up the block): "TOMMY SAYS: BOING!" and every critter on the floor flips.
- **While he's here, nothing can bonk you.**
- **2 players:** T is a high five (+50 each).

## The end

When the lives run out: the brothers do their signature moves on the ground floor, confetti, GREAT BONKING! (or GREAT TEAMWORK!), the TOP BONKERS board and PLAY AGAIN. Every phase clear is a little party too: the brothers do their moves where they stand.

## How it's tested

- **The rules** (`js/sim.js`) run without drawing in fixed 1/60 s steps, so the page, the autopilot (`js/bot.js`) and the checks share them.
- **The headless check:** `node tools/check.js` (or `game.check()` in the page) checks the brief's rules on the real rules: a bump flips the critter over that spot (every floor, every kind, both levels) and not one 2.6 m away; a flipped critter gets kicked into a bottom pipe and an upright one bonks you; flipped critters flip back on a timer, faster and redder; the BOING block works 3 times; a phase ends when every critter is gone; the screen wraps. Plus the companion, the brother pop, the respawn cloud, and the autopilot clearing all 9 phases on EASY and NORMAL.
- **It can fail:** `node tools/check.js --fail` turns on 10 sabotages one at a time (no flips, the wrong spot, no kicks, harmless critters, no flip-back, an endless or useless BOING block, phases that never end, no wrap, a lazy brother); each must be caught.
- **Real keys:** `game.playCheck()` (run by `node tools/shoot.js tools/keys.json`) presses real `keydown`/`keyup` events on `window` and taps the touch buttons with pointer events, never the autopilot: → moves right and ← left on screen on all 9 phases and all 4 floors, for Teddy, Tommy and each brother in 2 players (only his own brother), keys and touch; jumps go up; a jump under a critter flips it and walking into it kicks it; the edge wraps; and nothing leaves him stuck (the respawn cloud, a key held through pause, a lost window, a cancelled touch, his brother's pop, a used-up BOING block under his feet, the companion, the next phase, a keyboard kid mashing keys on every phase). `game.playCheck('mirror')` and `game.playCheck('stuckCloud')` must fail.
- **中文:** `node tools/shoot.js tools/zh.json` visits every screen in 中文 (`Kit.lang.untranslated()` is empty on each) and checks English mode shows no Chinese. `tools/layout.json` checks phone portrait and landscape and iPads with touch: no overlaps, no scrolling. `tools/dist.json` checks the single page from `file://`.
- **docs/screenshot.jpg:** `node tools/shoot.js tools/shots.json docs 1200 750`.
- Tests run muted; sound is checked in code (`game.state().sfx` counts every effect).

## Not verified

- **Sound:** every sound is synthesised and counted in code, but nobody has listened to it (tests ran muted).
- **Real devices:** touch was driven with synthetic pointer events in emulated phones and iPads, not on a real iPad or iPhone. Frame rate was only seen in headless software rendering, not on an older iPad.
- **Real kids:** how hard Easy and Normal feel was tuned with an autopilot that can't be bonked, not with Teddy and Tommy.
- **A real Finder double-click,** the home-screen icon on a real iPad, and the offline font fallback.
