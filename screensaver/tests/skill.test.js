'use strict';
// node tests/skill.test.js  (Node 6 compatible)
// Menu opens settings (no dimming); Start or a background open runs the screensaver, which dims
// the screen and restores the old brightness on close. The background script waits for idle.
const assert = require('assert'), Module = require('module');

let backlight = 0.4;
const sets = [], ticker = [], components = {};
const component = () => ({ display: { visible: true }, locked: false, lockInput(v) { this.locked = v; } });
const views = { currentView: null, viewStackLength: 1, _viewProcess: { active: false, processQueue: [] },
    STATE: { OPENED: 'opened', CLOSED: 'closed', DESTROYED: 'destroyed' }, ComponentGroup: { prototype: { destroy() {} } },
    ActionData: { CALLBACK: 'cb' }, GESTURE: { SWIPE_DOWN: 'sd' }, TRANSITION: { IN: 'in', OUT: 'out' },
    events: { process: { on() {}, off() {} } },
    createView(type, config) {
        Object.keys(components).forEach(k => delete components[k]);
        config.componentConfigs.forEach(c => { components[c.id] = Object.assign(component(), { config: c }); });
        const actions = [];
        return { state: 'opened', actions: actions, addAction(t, data) { actions.push(data.callback); },
            getComponentById: id => components[id], stage: { addChildAt() {}, addChild() {} } };
    },
    changeView(cfg, ready, fail, before) {
        if (cfg.addView) { views.currentView = cfg.addView; if (before) before(); if (ready) ready(); return; }
        views.currentView.state = 'destroyed'; views.currentView = null; ready();
    } };
const jibo = { face: { views, tween: { stop() {} } },
    system: { getBacklight(cb) { setImmediate(() => cb(null, backlight)); }, setBacklight(v, cb) { backlight = v; sets.push(v); cb(null); } } };
let exits = 0;
class BeSkill { exit() { exits++; } destroy(done) { done(); } }
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const display = function () { this.anchor = { set() {} }; this.scale = { set() {} }; this.visible = true; this.style = {}; this.addChild = () => {}; };
const graphics = function () {
    display.call(this);
    ['beginFill', 'drawRect', 'endFill', 'clear', 'lineStyle', 'moveTo', 'lineTo', 'arc', 'drawCircle', 'drawEllipse', 'drawRoundedRect']
        .forEach(n => { this[n] = () => this; });
};
global.PIXI = { Graphics: graphics, Container: display, Sprite: display, Text: function (t) { display.call(this); this.text = t || ''; },
    Texture: { EMPTY: {}, fromCanvas: () => ({}) },
    ticker: { shared: { add(fn) { ticker.push(fn); }, remove(fn) { ticker.splice(ticker.indexOf(fn), 1); } } } };
global.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, beginPath() {}, arc() {}, fill() {} }) }) };
global.Image = function () {};
const load = Module._load;
Module._load = function (request) {
    if (request === 'jibo') return jibo;
    if (request === '@be/be-framework') return { BeSkill };
    return load.apply(this, arguments);
};
const Skill = require('../index.js'), Settings = require('../settings'), background = require('../background.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const press = id => components[id].config.action.data.callback();
const auto = { nlu: { intent: 'background', entities: { auto: true } } };

const skill = new Skill();
Promise.resolve().then(() => {
    // Menu launch: settings screen, tap-to-leave is locked, nothing dims or animates.
    skill.open({ nlu: { intent: 'menu' } });
    assert.ok(components.tapAnywhere.locked && !components.tapAnywhere.display.visible, 'tap-anywhere off on settings');
    assert.strictEqual(ticker.length, 0);
    press('style:pacman'); press('after:30');
    assert.deepStrictEqual(Settings.load(), { style: 'pacman', after: 30 }, 'choices saved');
    return wait(300);
}).then(() => {
    assert.deepStrictEqual(sets, [], 'settings screen does not dim');
    press('start');
    assert.ok(!components.tapAnywhere.locked && components.tapAnywhere.display.visible && components['style:photos'].locked, 'settings locked, tap live');
    assert.strictEqual(ticker.length, 1); ticker[0]();
    assert.strictEqual(skill.saver.constructor.name, 'PacView');
    return wait(600);
}).then(() => {
    assert.deepStrictEqual(sets, [0.3, 0.2], 'steps down from 0.4 to 0.2');
    views.currentView.actions[0](); press('tapAnywhere');
    assert.strictEqual(exits, 1, 'swipe and tap leave once');
    skill.close(() => {});
    assert.strictEqual(backlight, 0.4, 'brightness restored on close');
    assert.strictEqual(ticker.length, 0, 'frame callback removed');
    // Background open goes straight to the chosen screensaver; an already-dark screen stays as it is.
    store[Settings.KEY] = JSON.stringify({ style: 'photos', after: 5 });
    backlight = 0.1; sets.length = 0; skill.open(auto);
    assert.strictEqual(skill.saver.constructor.name, 'UI'); assert.strictEqual(ticker.length, 1);
    return wait(300);
}).then(() => {
    assert.deepStrictEqual(sets, []);
    skill.close(() => {});
    assert.deepStrictEqual(sets, [0.1]);
    // Closing before getBacklight answers must not dim afterwards.
    backlight = 0.4; sets.length = 0; skill.open(auto); skill.close(() => {});
    return wait(300);
}).then(() => {
    assert.deepStrictEqual(sets, [], 'no late dimming after close');
    // Bad saved values fall back to defaults.
    store[Settings.KEY] = JSON.stringify({ style: 'tetris', after: 7 });
    assert.deepStrictEqual(Settings.load(), { style: 'photos', after: 0 });

    // Background: opens after the chosen idle time, restarts the wait on activity, never when Off.
    let idle = true, opens = 0;
    const api = { isIdle: () => idle, open: () => { opens++; return true; } }, M = 60000;
    store[Settings.KEY] = JSON.stringify({ style: 'photos', after: 5 });
    background.check(api, 0); background.check(api, 5 * M - 1);
    assert.strictEqual(opens, 0);
    idle = false; background.check(api, 5 * M); idle = true;
    background.check(api, 6 * M); background.check(api, 10 * M);
    assert.strictEqual(opens, 0, 'activity restarts the wait');
    background.check(api, 11 * M);
    assert.strictEqual(opens, 1);
    store[Settings.KEY] = JSON.stringify({ style: 'photos', after: 0 });
    background.check(api, 0); background.check(api, 1e9);
    assert.strictEqual(opens, 1, 'Off never opens');
    console.log('skill tests passed');
}).catch(e => { console.error(e); process.exitCode = 1; });
