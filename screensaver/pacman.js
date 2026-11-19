'use strict';

// Self-playing Pac-Man for the screensaver: pure game state, stepped with dt (seconds).
// The maze is generated (symmetric, no dead ends, fresh each level), Pac-Man is steered by a
// small AI (nearest dot, keep away from ghosts, chase blue ghosts) and the four ghosts use the
// arcade targeting rules, so a whole game plays out: levels, power pellets, deaths, game over.
const COLS = 39, ROWS = 21, MID = 19;
const DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]]; // up, left, down, right (arcade tie order)
const DOOR = [8, MID], EXIT = [7, MID], HOME = [10, MID], PAC_START = [15, MID];
const PELLETS = [[1, 1], [1, COLS - 2], [ROWS - 2, 1], [ROWS - 2, COLS - 2]];
const PAC_SPEED = 7, LIVES = 3, DANGER = 2, STEP = 1 / 60;
const MODES = [7, 20, 7, 20, 5, Infinity]; // scatter, chase, ... (seconds)
const GHOSTS = [
    { name: 'blinky', color: 0xFF2D2D, start: [7, MID], release: 0, corner: [-2, COLS - 3] },
    { name: 'pinky', color: 0xFFB0E0, start: [10, MID], release: 0.5, corner: [-2, 2] },
    { name: 'inky', color: 0x2DE6FF, start: [10, 17], release: 3, corner: [ROWS + 1, COLS - 1] },
    { name: 'clyde', color: 0xFFB347, start: [10, 21], release: 6, corner: [ROWS + 1, 0] }
];

const inHouse = (r, c) => r >= 9 && r <= 11 && c >= 17 && c <= 21;
const isDoor = (r, c) => r === DOOR[0] && c === DOOR[1];
const wrapC = c => (c + COLS) % COLS;
const key = (r, c) => r * COLS + c;

function makeMaze(rand) {
    const g = [];
    for (let r = 0; r < ROWS; r++) {
        g.push([]);
        for (let c = 0; c < COLS; c++) g[r].push(r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 || (r % 2 === 0 && c % 2 === 0) ? 1 : 0);
    }
    // Ghost house: walls rows 8/12 and cols 16/22, a door on top, open ring of corridor around it.
    for (let r = 7; r <= 13; r++) for (let c = 15; c <= 23; c++) {
        const wall = (r === 8 || r === 12) && c >= 16 && c <= 22 || (c === 16 || c === 22) && r >= 8 && r <= 12;
        g[r][c] = wall && !isDoor(r, c) ? 1 : 0;
    }
    g[9][0] = g[9][COLS - 1] = 0; // tunnel
    const fixed = (r, c) => r >= 7 && r <= 13 && c >= 15 && c <= 23;
    const cand = [];
    for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c <= MID; c++) if ((r + c) % 2 === 1 && !fixed(r, c)) cand.push([r, c]);
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
    const maze = { g: g };
    cand.forEach(rc => {
        if (rand() > 0.85) return; // leave some extra loops
        const r = rc[0], c = rc[1], m = COLS - 1 - c;
        g[r][c] = g[r][m] = 1;
        if (!valid(maze)) g[r][c] = g[r][m] = 0;
    });
    return maze;
}

function pacOpen(maze, r, c) { c = wrapC(c); return r >= 0 && r < ROWS && !maze.g[r][c] && !inHouse(r, c) && !isDoor(r, c); }
function ghostOpen(maze, r, c, house) { c = wrapC(c); return r >= 0 && r < ROWS && !maze.g[r][c] && (house || (!inHouse(r, c) && !isDoor(r, c))); }

// No dead ends anywhere Pac-Man can go, and every such tile reachable from his start.
function valid(maze) {
    let open = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (!pacOpen(maze, r, c)) continue;
        open++;
        if (DIRS.filter(d => pacOpen(maze, r + d[1], c + d[0])).length < 2) return false;
    }
    return bfs(maze, [PAC_START], (r, c) => pacOpen(maze, r, c)).count === open;
}

// Distances from the sources over passable tiles (Int16Array, -1 = unreachable).
function bfs(maze, sources, pass) {
    const dist = new Int16Array(ROWS * COLS).fill(-1), q = [];
    sources.forEach(s => { const k = key(s[0], wrapC(s[1])); if (dist[k] < 0) { dist[k] = 0; q.push(k); } });
    for (let i = 0; i < q.length; i++) {
        const r = Math.floor(q[i] / COLS), c = q[i] % COLS;
        DIRS.forEach(d => {
            const nr = r + d[1], nc = wrapC(c + d[0]), k = key(nr, nc);
            if (nr >= 0 && nr < ROWS && dist[k] < 0 && pass(nr, nc)) { dist[k] = dist[q[i]] + 1; q.push(k); }
        });
    }
    dist.count = q.length;
    return dist;
}

const tileOf = e => [Math.round(e.y), wrapC(Math.round(e.x))];
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

// Move e by dist tiles; at every tile centre choose(e) picks the next direction (null = stop).
function advance(e, dist, choose) {
    for (let guard = 0; dist > 1e-9 && guard < 50; guard++) {
        const cx = Math.round(e.x), cy = Math.round(e.y), at = Math.abs(e.x - cx) < 1e-6 && Math.abs(e.y - cy) < 1e-6;
        let to;
        if (at) {
            e.x = cx; e.y = cy;
            const d = choose(e);
            if (!d) { e.dir = [0, 0]; return; }
            e.dir = d; to = 1;
        } else {
            if (!e.dir[0] && !e.dir[1]) return;
            const pos = e.dir[0] ? e.x : e.y, s = e.dir[0] || e.dir[1];
            to = s > 0 ? Math.floor(pos) + 1 - pos : pos - (Math.ceil(pos) - 1);
        }
        const step = Math.min(dist, to);
        e.x += e.dir[0] * step; e.y += e.dir[1] * step; dist -= step;
        e.travel = (e.travel || 0) + step;
        if (e.x < -0.5) e.x += COLS; else if (e.x >= COLS - 0.5) e.x -= COLS;
    }
}

class Game {
    constructor(rand) { this.rand = rand || Math.random; this.highScore = 0; this.newGame(); }
    newGame() { this.score = 0; this.lives = LIVES; this.level = 1; this.newLevel(); }
    newLevel() {
        this.maze = makeMaze(this.rand); this.mazeVersion = (this.mazeVersion || 0) + 1;
        this.dots = {};
        for (let r = 0; r < ROWS; r++) for (let c = 1; c < COLS - 1; c++) if (pacOpen(this.maze, r, c) && !same([r, c], PAC_START)) this.dots[key(r, c)] = 1;
        PELLETS.forEach(p => { this.dots[key(p[0], p[1])] = 2; });
        this.dotsLeft = Object.keys(this.dots).length; this.dotsVersion = 0;
        this.resetActors();
    }
    resetActors() {
        this.pac = { x: PAC_START[1], y: PAC_START[0], dir: [-1, 0], travel: 0 };
        this.ghosts = GHOSTS.map(def => ({ def: def, x: def.start[1], y: def.start[0], dir: [-1, 0],
            state: def.release === 0 ? 'active' : 'house', fright: false }));
        this.power = 0; this.combo = 0; this.modeIndex = 0; this.modeTime = 0; this.clock = 0;
        this.phase = 'ready'; this.phaseTime = 0;
    }
    get chase() { return this.modeIndex % 2 === 1; }
    get ghostSpeed() { return PAC_SPEED * Math.min(1.05, 0.8 + 0.06 * (this.level - 1)); }
    get powerTime() { return Math.max(2, 8 - this.level); }
    step(dt) {
        for (dt = Math.min(dt, 0.25); dt > 1e-9; dt -= STEP) this.tick(Math.min(dt, STEP));
    }
    tick(dt) {
        this.phaseTime += dt;
        const p = this.phase;
        if (p === 'ready' && this.phaseTime > 2) this.setPhase('play');
        else if (p === 'dying' && this.phaseTime > 1.8) {
            if (--this.lives <= 0) this.setPhase('gameover'); else this.resetActors();
        } else if (p === 'cleared' && this.phaseTime > 2.5) { this.level++; this.newLevel(); }
        else if (p === 'gameover' && this.phaseTime > 4) this.newGame();
        else if (p === 'play') this.play(dt);
    }
    setPhase(phase) { this.phase = phase; this.phaseTime = 0; }
    play(dt) {
        this.clock += dt;
        if (this.power > 0 && (this.power -= dt) <= 0) { this.power = 0; this.ghosts.forEach(g => { g.fright = false; }); }
        if (!this.power && (this.modeTime += dt) > MODES[this.modeIndex]) {
            this.modeTime = 0; this.modeIndex++;
            this.ghosts.forEach(g => { if (g.state === 'active') g.dir = [-g.dir[0], -g.dir[1]]; });
        }
        advance(this.pac, PAC_SPEED * dt, e => this.pacChoice(e));
        this.eat();
        this.ghosts.forEach(g => {
            if (g.state === 'house') { if (this.clock >= g.def.release) g.state = 'leaving'; else return; }
            const speed = g.state === 'eaten' ? PAC_SPEED * 2 : g.state === 'leaving' || g.fright ? PAC_SPEED * 0.5 : this.ghostSpeed;
            advance(g, speed * dt, e => this.ghostChoice(e));
        });
        this.collide();
    }
    eat() {
        const t = tileOf(this.pac), k = key(t[0], t[1]), dot = this.dots[k];
        if (!dot) return;
        delete this.dots[k]; this.dotsLeft--; this.dotsVersion++;
        this.addScore(dot === 2 ? 50 : 10);
        if (dot === 2) {
            this.power = this.powerTime; this.combo = 0;
            this.ghosts.forEach(g => { if (g.state === 'active' || g.state === 'leaving') { g.fright = true; if (g.state === 'active') g.dir = [-g.dir[0], -g.dir[1]]; } });
        }
        if (!this.dotsLeft) this.setPhase('cleared');
    }
    addScore(n) { this.score += n; if (this.score > this.highScore) this.highScore = this.score; }
    collide() {
        if (this.phase !== 'play') return;
        this.ghosts.forEach(g => {
            if (g.state !== 'active' || Math.abs(g.x - this.pac.x) + Math.abs(g.y - this.pac.y) > 0.6) return;
            if (g.fright) { g.state = 'eaten'; g.fright = false; this.addScore(200 << this.combo++); }
            else if (this.phase === 'play') this.setPhase('dying');
        });
    }
    // Pac-Man: shortest path to the nearest dot (or blue ghost) that keeps DANGER tiles away from ghosts.
    pacChoice(e) {
        const maze = this.maze, here = tileOf(e);
        const hunters = this.ghosts.filter(g => g.state === 'active' && !g.fright).map(tileOf);
        const fear = hunters.length ? bfs(maze, hunters, (r, c) => ghostOpen(maze, r, c)) : null;
        const safe = (r, c) => pacOpen(maze, r, c) && (!fear || fear[key(r, c)] < 0 || fear[key(r, c)] > DANGER);
        const prey = this.power > 1.5 ? this.ghosts.filter(g => g.state === 'active' && g.fright).map(tileOf) : [];
        const isGoal = (r, c) => prey.some(t => same(t, [r, c])) || (!prey.length && this.dots[key(r, c)]);
        // BFS from Pac-Man, remembering the first step of each path.
        const first = {}, q = [];
        DIRS.forEach(d => {
            const r = here[0] + d[1], c = wrapC(here[1] + d[0]), k = key(r, c);
            if (safe(r, c) && !(k in first)) { first[k] = d; q.push([r, c]); }
        });
        for (let i = 0; i < q.length; i++) {
            const r = q[i][0], c = q[i][1];
            if (isGoal(r, c)) return first[key(r, c)];
            DIRS.forEach(d => {
                const nr = r + d[1], nc = wrapC(c + d[0]), k = key(nr, nc);
                if (!(k in first) && !same([nr, nc], here) && safe(nr, nc)) { first[k] = first[key(r, c)]; q.push([nr, nc]); }
            });
        }
        // Cornered or nothing safe to go for: step to the open neighbour farthest from the ghosts.
        let best = null, bestD = -2;
        DIRS.forEach(d => {
            const r = here[0] + d[1], c = here[1] + d[0];
            if (!pacOpen(maze, r, c)) return;
            const f = fear ? fear[key(r, wrapC(c))] : 99;
            if (f > bestD) { bestD = f; best = d; }
        });
        return best;
    }
    ghostChoice(g) {
        const maze = this.maze, here = tileOf(g);
        if (g.state === 'leaving' || g.state === 'eaten') {
            const goal = g.state === 'leaving' ? EXIT : HOME;
            if (same(here, goal)) {
                if (g.state === 'eaten') g.state = 'leaving';
                else { g.state = 'active'; return [-1, 0]; }
                return this.ghostChoice(g);
            }
            const dist = bfs(maze, [goal], (r, c) => ghostOpen(maze, r, c, true));
            let best = null;
            DIRS.forEach(d => {
                const k = key(here[0] + d[1], wrapC(here[1] + d[0]));
                if (dist[k] >= 0 && (!best || dist[k] < best.v)) best = { d: d, v: dist[k] };
            });
            return best && best.d;
        }
        let opts = DIRS.filter(d => !(d[0] === -g.dir[0] && d[1] === -g.dir[1]) && ghostOpen(maze, here[0] + d[1], here[1] + d[0]));
        if (!opts.length) opts = DIRS.filter(d => ghostOpen(maze, here[0] + d[1], here[1] + d[0]));
        if (g.fright) return opts[Math.floor(this.rand() * opts.length)];
        const target = this.target(g);
        let best = null, bestV = Infinity;
        opts.forEach(d => {
            const v = Math.pow(here[0] + d[1] - target[0], 2) + Math.pow(here[1] + d[0] - target[1], 2);
            if (v < bestV) { bestV = v; best = d; }
        });
        return best;
    }
    // Arcade targets: Blinky chases, Pinky ambushes 4 ahead, Inky flanks off Blinky, Clyde backs off when close.
    target(g) {
        if (!this.chase) return g.def.corner;
        const p = tileOf(this.pac), d = this.pac.dir;
        switch (g.def.name) {
        case 'pinky': return [p[0] + 4 * d[1], p[1] + 4 * d[0]];
        case 'inky': { const b = tileOf(this.ghosts[0]), a = [p[0] + 2 * d[1], p[1] + 2 * d[0]]; return [2 * a[0] - b[0], 2 * a[1] - b[1]]; }
        case 'clyde': { const t = tileOf(g); return Math.pow(t[0] - p[0], 2) + Math.pow(t[1] - p[1], 2) > 64 ? p : g.def.corner; }
        default: return p;
        }
    }
}

Object.assign(Game, { COLS: COLS, ROWS: ROWS, DIRS: DIRS, makeMaze: makeMaze, valid: valid, pacOpen: pacOpen, ghostOpen: ghostOpen,
    inHouse: inHouse, isDoor: isDoor, key: key, tileOf: tileOf, advance: advance, PELLETS: PELLETS });
module.exports = Game;
