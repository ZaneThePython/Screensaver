'use strict';

// Settings screen (what opens from the menu button) and the saved choices.
// Saved in localStorage so the background script reads the same values.
const KEY = 'be.screensaver.settings';
const STYLES = [['photos', 'Photos'], ['pacman', 'Pac-Man']];
const DELAYS = [[0, 'Off'], [5, '5 min'], [30, '30 min'], [60, '1 hour'], [360, '6 hours']]; // minutes idle
const CYAN = [0x25F2FB, 0x107799];
const ROWS = [
    { key: 'style', title: 'Show', y: 230, w: 260, options: STYLES },
    { key: 'after', title: 'Start by itself when Jibo is idle for', y: 460, w: 156, options: DELAYS }
];

function load() {
    let s = {};
    try { s = JSON.parse(global.localStorage.getItem(KEY)) || {}; } catch (_) {}
    const ok = (list, v) => list.some(o => o[0] === v);
    return { style: ok(STYLES, s.style) ? s.style : 'photos', after: ok(DELAYS, s.after) ? s.after : 0 };
}
function save(s) { try { global.localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} }

class SettingsUI {
    constructor(actions) { this.actions = actions; this.ids = []; }
    // Tap areas over each choice pill, plus a stock Start button like Pomodoro's Set.
    components(views) {
        const callback = fn => ({ type: views.ActionData.CALLBACK, data: { callback: fn } }), out = [];
        ROWS.forEach(row => row.options.forEach((o, i) => {
            const id = row.key + ':' + o[0]; this.ids.push(id);
            out.push({ type: 'Button', id: id, assets: [], position: { x: 80 + i * (row.w + 16), y: row.y },
                hitArea: { x: 0, y: 0, width: row.w, height: 84 }, action: callback(() => this.actions.pick(row.key, o[0])) });
        }));
        out.push({ type: 'ActionButton', id: 'start', iconSrc: 'core://resources/actionIcons/play.png', colors: CYAN,
            position: { x: 1068, y: 212 }, transform: { scaleX: 0.5, scaleY: 0.5 }, action: callback(() => this.actions.start()) });
        out.push({ type: 'Label', id: 'startCaption', text: 'Start', position: { x: 1132, y: 384 }, targetAnchor: { x: 0.5, y: 0.5 },
            style: { fontFamily: 'Proxima Nova Light', fontSize: 45, fill: '#FFFFFF' } });
        this.ids.push('start', 'startCaption');
        return out;
    }
    decorate(view, PIXI, index) {
        this.view = view; this.PIXI = PIXI;
        const layer = this.layer = new PIXI.Container();
        const bg = new PIXI.Graphics(); bg.beginFill(0x000000); bg.drawRect(0, 0, 1280, 720); bg.endFill(); layer.addChild(bg);
        this.pills = new PIXI.Graphics(); layer.addChild(this.pills);
        const text = (s, size, x, y, font) => {
            const t = new PIXI.Text(s, { fontFamily: font || 'Proxima Nova Soft', fontSize: size, fill: '#FFFFFF', fontWeight: size > 60 ? 'bold' : 'normal' });
            t.x = x; t.y = y; layer.addChild(t); return t;
        };
        text('Screensaver', 80, 80, 50);
        this.labels = [];
        ROWS.forEach(row => {
            text(row.title, 38, 80, row.y - 58, 'Proxima Nova Light');
            row.options.forEach((o, i) => {
                const t = text(o[1], row.w > 200 ? 40 : 34, 80 + i * (row.w + 16) + row.w / 2, row.y + 42);
                t.anchor.set(0.5, 0.5); this.labels.push({ text: t, key: row.key, value: o[0] });
            });
        });
        view.stage.addChildAt(layer, index);
    }
    render(settings) {
        if (!this.pills) return;
        const g = this.pills; g.clear();
        ROWS.forEach(row => row.options.forEach((o, i) => {
            const on = settings[row.key] === o[0];
            g.beginFill(on ? CYAN[0] : 0x282735); g.drawRoundedRect(80 + i * (row.w + 16), row.y, row.w, 84, 42); g.endFill();
        }));
        this.labels.forEach(l => { l.text.style.fill = settings[l.key] === l.value ? '#0B1A33' : '#FFFFFF'; });
    }
    hide() {
        if (this.layer) this.layer.visible = false;
        this.ids.forEach(id => { const c = this.view && this.view.getComponentById(id); if (c) { c.display.visible = false; if (c.lockInput) c.lockInput(true); } });
    }
}

Object.assign(SettingsUI, { load: load, save: save, KEY: KEY, STYLES: STYLES, DELAYS: DELAYS });
module.exports = SettingsUI;
