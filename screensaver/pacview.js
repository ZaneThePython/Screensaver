'use strict';

const Game = require('./pacman');
const Saver = require('./saver');

// Draws the self-playing Pac-Man game. Pac-Man is Jibo's Pac-Man look (his eye turned
// sideways into a shaded yellow ball whose lids are the mouth). The whole board shifts a few
// pixels every life/level so the maze lines never sit on the same pixels for long.
const T = 32, BOARD_X = 16, BOARD_Y = 44, WALL = 0x3F5BFF, MOUTH = 38;

class PacView {
    constructor(rand) { this.game = new Game(rand); this.last = null; }
    decorate(view, PIXI, doc, index) {
        this.PIXI = PIXI;
        const root = this.root = new PIXI.Container();
        view.stage.addChildAt(root, index);
        const bg = new PIXI.Graphics(); bg.beginFill(0x000000); bg.drawRect(0, 0, 1280, 720); bg.endFill(); root.addChild(bg);
        this.board = new PIXI.Container(); root.addChild(this.board);
        this.walls = new PIXI.Graphics(); this.dots = new PIXI.Graphics(); this.ghosts = new PIXI.Graphics();
        this.ball = new PIXI.Sprite(ballTexture(PIXI, doc)); this.ball.anchor.set(0.5, 0.5); this.ball.scale.set(T * 0.9 / 128);
        this.mouth = new PIXI.Graphics(); this.ball.mask = this.mouth;
        [this.walls, this.dots, this.ball, this.mouth, this.ghosts].forEach(c => this.board.addChild(c));
        const style = (size, fill) => ({ fontFamily: 'Proxima Nova Soft', fontSize: size, fill: fill || '#FFFFFF', fontWeight: 'bold' });
        this.score = new PIXI.Text('', style(28)); this.score.y = 6;
        this.time = new PIXI.Text('', style(28)); this.time.anchor.set(0.5, 0); this.time.y = 6;
        this.banner = new PIXI.Text('', style(30, '#FFE14D')); this.banner.anchor.set(0.5, 0.5);
        this.lives = new PIXI.Graphics();
        [this.score, this.time, this.lives].forEach(c => root.addChild(c)); this.board.addChild(this.banner);
    }
    render(now, date) {
        if (!this.root) return;
        const g = this.game, dt = this.last === null ? 0 : (now - this.last) / 1000;
        this.last = now; g.step(dt);
        if (this.resetCount !== g.mazeVersion + ':' + g.lives) {
            this.resetCount = g.mazeVersion + ':' + g.lives;
            this.shiftX = Math.round((Math.random() * 2 - 1) * 10); this.shiftY = Math.round((Math.random() * 2 - 1) * 4);
        }
        this.board.x = BOARD_X + this.shiftX; this.board.y = BOARD_Y + this.shiftY;
        if (this.mazeVersion !== g.mazeVersion) { this.mazeVersion = g.mazeVersion; this.drawWalls(); }
        // Maze blinks when a level is cleared, like the arcade.
        this.walls.alpha = g.phase === 'cleared' && Math.floor(g.phaseTime * 4) % 2 ? 0.35 : 1;
        this.drawDots(now);
        this.drawPac();
        this.drawGhosts(now);
        this.hud(date);
    }
    drawWalls() {
        const m = this.game.maze.g, w = this.walls; w.clear();
        const isWall = (r, c) => r >= 0 && r < Game.ROWS && c >= 0 && c < Game.COLS && m[r][c] === 1;
        [[10, 0.22], [4, 1]].forEach(s => {
            w.lineStyle(s[0], WALL, s[1]);
            for (let r = 0; r < Game.ROWS; r++) for (let c = 0; c < Game.COLS; c++) {
                if (!isWall(r, c)) continue;
                const x = c * T + T / 2, y = r * T + T / 2;
                if (isWall(r, c + 1)) { w.moveTo(x, y); w.lineTo(x + T, y); }
                if (isWall(r + 1, c)) { w.moveTo(x, y); w.lineTo(x, y + T); }
            }
        });
        w.lineStyle(4, 0xFFB0E0, 1); w.moveTo(18 * T + 4, 8 * T + T / 2); w.lineTo(20 * T - 4, 8 * T + T / 2); // ghost door
    }
    drawDots(now) {
        const g = this.game, blink = Math.floor(now / 250) % 2 === 0 || g.phase !== 'play';
        if (this.dotsKey === g.dotsVersion + ':' + g.mazeVersion + ':' + blink) return;
        this.dotsKey = g.dotsVersion + ':' + g.mazeVersion + ':' + blink;
        const d = this.dots; d.clear();
        Object.keys(g.dots).forEach(k => {
            const r = Math.floor(k / Game.COLS), c = k % Game.COLS, x = c * T + T / 2, y = r * T + T / 2;
            if (g.dots[k] === 2) { if (blink) { d.beginFill(0xFFD8B0); d.drawCircle(x, y, 9); d.endFill(); } }
            else { d.beginFill(0xFFD8B0); d.drawRect(x - 3, y - 3, 6, 6); d.endFill(); }
        });
    }
    drawPac() {
        const g = this.game, p = g.pac, m = this.mouth;
        let open = Math.abs(Math.sin(p.travel * Math.PI * 1.5)) * MOUTH;
        if (g.phase === 'ready') open = 20;
        if (g.phase === 'dying') open = Math.min(180, MOUTH + 160 * Math.max(0, g.phaseTime - 0.4));
        const visible = g.phase !== 'gameover' && !(g.phase === 'dying' && open >= 180);
        this.ball.visible = m.visible = visible;
        if (!visible) return;
        const x = p.x * T + T / 2, y = p.y * T + T / 2, d = p.dir[0] || p.dir[1] ? p.dir : [-1, 0];
        const a = g.phase === 'dying' ? -Math.PI / 2 : Math.atan2(d[1], d[0]), o = open * Math.PI / 180, r = T * 0.48;
        this.ball.x = x; this.ball.y = y;
        m.clear(); m.beginFill(0xFFFFFF);
        m.moveTo(x, y); m.lineTo(x + r * Math.cos(a + o), y + r * Math.sin(a + o));
        m.arc(x, y, r, a + o, a + 2 * Math.PI - o); m.lineTo(x, y); m.endFill();
    }
    drawGhosts(now) {
        const g = this.game, gr = this.ghosts; gr.clear();
        if (g.phase === 'gameover' || (g.phase === 'dying' && g.phaseTime > 0.4) || g.phase === 'cleared') return;
        const wobble = Math.floor(now / 160) % 2;
        g.ghosts.forEach(gh => {
            const x = gh.x * T + T / 2, y = gh.y * T + T / 2 + (gh.state === 'house' ? Math.sin(now / 200) * 3 : 0), r = T * 0.46;
            const d = gh.dir[0] || gh.dir[1] ? gh.dir : [0, 1];
            if (gh.state !== 'eaten') {
                const flash = gh.fright && g.power < 2 && Math.floor(now / 200) % 2;
                gr.beginFill(gh.fright ? (flash ? 0xFFFFFF : 0x2135FF) : gh.def.color);
                gr.moveTo(x - r, y + r); gr.lineTo(x - r, y); gr.arc(x, y, r, Math.PI, 0); gr.lineTo(x + r, y + r);
                for (let i = 1; i <= 6; i++) gr.lineTo(x + r - 2 * r * i / 6, y + r - ((i + wobble) % 2 ? r * 0.28 : 0)); // wavy skirt
                gr.endFill();
                if (gh.fright) {
                    gr.beginFill(flash ? 0xFF2D2D : 0xFFD8B0); gr.drawRect(x - 7, y - 5, 4, 4); gr.drawRect(x + 3, y - 5, 4, 4); gr.endFill();
                    return;
                }
            }
            [-1, 1].forEach(s => {
                const ex = x + s * r * 0.4, ey = y - r * 0.15;
                gr.beginFill(0xFFFFFF); gr.drawEllipse(ex + d[0] * 2, ey + d[1] * 2, r * 0.28, r * 0.36); gr.endFill();
                gr.beginFill(0x1E2BD0); gr.drawCircle(ex + d[0] * 5, ey + d[1] * 5, r * 0.15); gr.endFill();
            });
        });
    }
    hud(date) {
        const g = this.game;
        const score = 'SCORE ' + g.score + (g.highScore > g.score ? '    HIGH ' + g.highScore : '');
        if (this.score.text !== score) this.score.text = score;
        const t = Saver.formatTime(date);
        if (this.time.text !== t) this.time.text = t;
        this.score.x = BOARD_X + this.shiftX + 8; this.time.x = 640 + this.shiftX;
        const banner = g.phase === 'ready' ? (g.level > 1 && g.lives === 3 && g.score ? 'LEVEL ' + g.level : 'READY!') : g.phase === 'gameover' ? 'GAME OVER' : '';
        if (this.banner.text !== banner) this.banner.text = banner;
        this.banner.x = 19 * T + T / 2; this.banner.y = 13 * T + T / 2;
        if (this.livesKey !== g.lives + ':' + this.shiftX) {
            this.livesKey = g.lives + ':' + this.shiftX;
            const l = this.lives; l.clear(); l.beginFill(0xFFD400);
            for (let i = 0; i < g.lives - 1; i++) {
                const x = 1240 + this.shiftX - i * 34, y = 24, o = 0.6;
                l.moveTo(x, y); l.lineTo(x + 13 * Math.cos(Math.PI + o), y + 13 * Math.sin(Math.PI + o));
                l.arc(x, y, 13, Math.PI + o, 3 * Math.PI - o); l.lineTo(x, y);
            }
            l.endFill();
        }
    }
    destroy() { if (this.root && this.root.parent) this.root.parent.removeChild(this.root); this.root = null; }
}

// Jibo's eye as Pac-Man: a ball lit from the upper left, in the yellow of his Pac-Man lids.
function ballTexture(PIXI, doc) {
    const c = doc.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grad = g.createRadialGradient(44, 40, 6, 64, 64, 64);
    grad.addColorStop(0, '#FFF6B0'); grad.addColorStop(0.35, '#FFD400'); grad.addColorStop(1, '#8A6F00');
    g.fillStyle = grad; g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
    return PIXI.Texture.fromCanvas(c);
}

module.exports = PacView;
