'use strict';

// Pure timing logic for the screensaver (no Date.now() inside; callers pass `now`).
// Each slot shows one photo for PHOTO_MS; the next photo cross-fades in over the
// last FADE_MS of the slot. The clock moves to a new corner every slot, cycling
// through all four so each corner gets the same screen time (burn-in protection).
const PHOTO_MS = 30000, FADE_MS = 2000;
const CORNERS = ['bottomLeft', 'topRight', 'bottomRight', 'topLeft'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Shuffled photo order that never shows the same photo twice in a row, also across reshuffles.
function shuffled(count, rand, avoid) {
    const order = [];
    for (let i = 0; i < count; i++) order.push(i);
    for (let i = count - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    if (count > 1 && order[0] === avoid) { const t = order[0]; order[0] = order[1]; order[1] = t; }
    return order;
}

class Saver {
    constructor(count, now, rand) {
        this.count = count; this.start = now; this.rand = rand || Math.random;
        this.order = shuffled(count, this.rand, -1);
        this.corner0 = Math.floor(this.rand() * CORNERS.length);
    }
    photo(slot) {
        while (this.order.length <= slot) this.order = this.order.concat(shuffled(this.count, this.rand, this.order[this.order.length - 1]));
        return this.order[slot];
    }
    corner(slot) { return CORNERS[(this.corner0 + slot) % CORNERS.length]; }
    // What to draw at `now`: current photo, the incoming one with its alpha, Ken Burns
    // progress of each (0..1 over its whole time on screen) and the clock's corner/alpha.
    state(now) {
        const elapsed = Math.max(0, now - this.start), slot = Math.floor(elapsed / PHOTO_MS), into = elapsed - slot * PHOTO_MS;
        const fade = into > PHOTO_MS - FADE_MS ? (into - (PHOTO_MS - FADE_MS)) / FADE_MS : 0;
        const span = PHOTO_MS + FADE_MS;
        // Clock fades out over the first half of the cross-fade and back in at the next corner over the second half.
        const clockNext = fade >= 0.5;
        return {
            slot: slot, photo: this.photo(slot), next: this.photo(slot + 1), fade: fade,
            progress: (into + FADE_MS) / span,
            nextProgress: fade * FADE_MS / span,
            corner: this.corner(clockNext ? slot + 1 : slot),
            clockAlpha: fade === 0 ? 1 : Math.abs(1 - 2 * fade)
        };
    }
}

function formatTime(date) {
    const h = date.getHours() % 12 || 12, m = date.getMinutes();
    return h + ':' + (m < 10 ? '0' : '') + m;
}
function formatDate(date) { return DAYS[date.getDay()] + ', ' + MONTHS[date.getMonth()] + ' ' + date.getDate(); }

Saver.PHOTO_MS = PHOTO_MS; Saver.FADE_MS = FADE_MS; Saver.CORNERS = CORNERS;
Saver.shuffled = shuffled; Saver.formatTime = formatTime; Saver.formatDate = formatDate;
module.exports = Saver;
