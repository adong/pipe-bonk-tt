/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: PB.TITLE, // the name lives in js/title.js
  keys: [
    ['walk', '← → or A D'],
    ['jump: bump the floor above you', 'Space or ↑ or W'],
    ['2 players: Teddy walks and jumps', 'A D · W'],
    ['2 players: Tommy walks and jumps', '← → · ↑'],
    ['call your brother: he bumps the BOING block (2 players: high five)', 'T'],
    ['pause · sound', 'P or Esc · M'],
    ['title: 1 or 2 players · easy · normal · who plays', '1 2 · E · N · C'],
  ],
  note: 'Jump up under a critter to bump the floor and flip it over, then run into it to kick it home. Upright critters bonk you! Flipped ones flip back after a while, faster and redder. Bump the BOING block to flip every critter on the floor (3 times). The screen wraps: walk off one side, come in on the other. Call your brother as often as you like.',
  touch: '◀ ▶ walk, ⤴️ jumps, and your brother\'s face calls him. 2 players: each brother has his own ◀ ▶ ⤴️ in his corner.',
});
