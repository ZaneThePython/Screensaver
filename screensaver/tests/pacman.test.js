'use strict';
// node tests/pacman.test.js  (Node 6 compatible)
const assert = require('assert');
const Game = require('../pacman');

let seed = 11;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// Mazes: mirror-symmetric, no dead ends, everything reachable, tunnel and house intact.
for (let i = 0; i < 20; i++) {
    const m = Game.makeMaze(rand);
    assert.ok(Game.valid(m), 'maze ' + i + ' valid');
    for (let r = 0; r < Game.ROWS; r++) for (let c = 0; c < Game.COLS; c++) assert.strictEqual(m.g[r][c], m.g[r][Game.COLS - 1 - c]);
    assert.ok(Game.pacOpen(m, 9, 0) && Game.pacOpen(m, 9, Game.COLS - 1), 'tunnel open');
    assert.ok(!Game.pacOpen(m, 8, 19) && Game.ghostOpen(m, 8, 19, true), 'door is ghosts-only');
    Game.PELLETS.forEach(p => assert.ok(Game.pacOpen(m, p[0], p[1])));
}

// Movement stops at tile centres to turn, and wraps through the tunnel.
const e = { x: 1, y: 9, dir: [-1, 0] };
Game.advance(e, 2.5, () => [-1, 0]);
assert.ok(Math.abs(e.x - (Game.COLS - 1.5)) < 1e-9, 'wrapped to the right side: ' + e.x);

// Play for an hour of game time: the game keeps going through levels, deaths and game overs,
// and nobody ever stands inside a wall.
const g = new Game(rand), seen = { cleared: 0, dying: 0, gameover: 0, ghostEaten: 0 };
let last = g.phase, prev = [], maxLevel = 1;
for (let t = 0; t < 3600; t += 0.05) {
    g.step(0.05);
    if (g.phase !== last && seen[g.phase] !== undefined) seen[g.phase]++;
    last = g.phase;
    seen.ghostEaten += g.ghosts.filter((gh, i) => gh.state === 'eaten' && prev[i] !== 'eaten').length;
    prev = g.ghosts.map(gh => gh.state); maxLevel = Math.max(maxLevel, g.level);
    const p = Game.tileOf(g.pac);
    assert.ok(Game.pacOpen(g.maze, p[0], p[1]), 'pac in wall at ' + p + ' t=' + t.toFixed(2));
    g.ghosts.forEach(gh => { const q = Game.tileOf(gh); assert.ok(Game.ghostOpen(g.maze, q[0], q[1], true), gh.def.name + ' in wall'); });
}
console.log('levels cleared', seen.cleared, 'deaths', seen.dying, 'game overs', seen.gameover, 'max level', maxLevel, 'ghosts eaten', seen.ghostEaten, 'high score', g.highScore);
assert.ok(seen.cleared >= 2, 'clears levels');
assert.ok(seen.ghostEaten >= 5, 'eats blue ghosts');
assert.ok(seen.dying >= 3 && seen.gameover >= 1, 'loses lives and restarts');
console.log('pacman tests passed');
