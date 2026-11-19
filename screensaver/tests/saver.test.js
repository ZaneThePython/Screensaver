'use strict';
// node tests/saver.test.js  (Node 6 compatible)
const assert = require('assert');
const Saver = require('../saver');

let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const P = Saver.PHOTO_MS, F = Saver.FADE_MS, t0 = 1000000;
const s = new Saver(19, t0, rand);

// Every photo shows once per round of 19, and never the same photo twice in a row.
const first = [];
for (let i = 0; i < 19; i++) first.push(s.photo(i));
assert.deepStrictEqual(first.slice().sort((a, b) => a - b), Array.from({ length: 19 }, (_, i) => i));
for (let i = 0; i < 400; i++) assert.notStrictEqual(s.photo(i), s.photo(i + 1), 'repeat at slot ' + i);

// No fade until the last 2 s of a slot; the incoming photo is the next slot's photo.
let st = s.state(t0 + P - F - 1);
assert.strictEqual(st.fade, 0); assert.strictEqual(st.slot, 0); assert.strictEqual(st.clockAlpha, 1);
st = s.state(t0 + P - F / 2);
assert.ok(Math.abs(st.fade - 0.5) < 1e-9); assert.strictEqual(st.next, s.photo(1));
assert.ok(st.clockAlpha < 1e-9, 'clock is invisible when it jumps corners');

// The clock switches corner exactly at mid-fade and visits all four corners once per four photos.
assert.strictEqual(s.state(t0 + P - F / 2 - 1).corner, s.corner(0));
assert.strictEqual(s.state(t0 + P - F / 2).corner, s.corner(1));
const corners = [0, 1, 2, 3].map(i => s.state(t0 + i * P + 1).corner);
assert.deepStrictEqual(corners.slice().sort(), Saver.CORNERS.slice().sort());

// Ken Burns progress is continuous across the hand-off from incoming to current.
const end = s.state(t0 + P - 1), start = s.state(t0 + P);
assert.ok(Math.abs(end.nextProgress - start.progress) < 1e-3);
assert.ok(start.progress > 0 && s.state(t0 + 2 * P - 1).progress <= 1);

// Clock text: 12-hour without leading zero, padded minutes; full weekday and month.
assert.strictEqual(Saver.formatTime(new Date(2026, 10, 17, 0, 5)), '12:05');
assert.strictEqual(Saver.formatTime(new Date(2026, 10, 17, 13, 40)), '1:40');
assert.strictEqual(Saver.formatTime(new Date(2026, 10, 17, 9, 0)), '9:00');
assert.strictEqual(Saver.formatDate(new Date(2026, 10, 17)), 'Tuesday, November 17');

// A clock running backwards (time set earlier) never produces a negative slot.
assert.strictEqual(new Saver(19, t0, rand).state(t0 - 5000).slot, 0);
console.log('saver tests passed');
