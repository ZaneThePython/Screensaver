'use strict';

const jibo = require('jibo'), BeSkill = require('@be/be-framework').BeSkill;
const fs = require('fs'), path = require('path');
const lifecycle = require('./touch-lifecycle'), Settings = require('./settings'), PhotoUI = require('./ui'), PacView = require('./pacview');

// Backlight values are 0..1 and change in steps of 0.1. Jibo's awake level is 0.4 and
// his asleep level 0.1; the screensaver sits just above asleep.
const DIM = 0.2, AWAKE = 0.4, STEP_MS = 150;
const PHOTO_COUNT = fs.readdirSync(path.join(__dirname, 'resources/photos')).filter(f => /\.jpg$/.test(f)).length;

// Menu button -> settings screen (style, auto-start delay, Start). The background script
// opens it with intent 'background', which goes straight to the screensaver.
class ScreensaverSkill extends BeSkill {
    constructor() { super(...arguments); this.generation = 0; this.view = null; this.closing = null; this.restoreTo = null; }
    open(result) {
        // Reopen whenever the old view is gone; exit rather than sit with no UI if it still cannot close.
        if (this.view) { this.close(() => { if (!this.view) this.open(result); else this.exit({ noElementsOfSurprise: true }); }); return; }
        const generation = ++this.generation, views = jibo.face.views;
        const auto = !!(result && result.nlu && result.nlu.intent === 'background');
        this.closing = null; this.leaving = false; this.opened = false; this.saver = null; this.running = false;
        this.settings = Settings.load();
        this.settingsUI = new Settings({
            pick: (k, v) => { this.settings[k] = v; Settings.save(this.settings); this.settingsUI.render(this.settings); },
            start: () => this.startSaver()
        });
        // One invisible full-screen button, live only while the screensaver runs: any tap leaves.
        const tap = { type: 'Button', id: 'tapAnywhere', assets: [], position: { x: 0, y: 0 }, hitArea: { x: 0, y: 0, width: 1280, height: 720 },
            action: { type: views.ActionData.CALLBACK, data: { callback: () => this.leave() } } };
        const config = { viewConfig: { type: 'View', id: 'screensaver', category: 'gui', ignoreSwipeDown: true, transitionStageOnly: true },
            componentConfigs: this.settingsUI.components(views).concat([tap]) };
        const view = this.view = lifecycle.prepareView(views.createView('View', config));
        view.addAction(views.ActionData.CALLBACK, { callback: () => this.leave() }, true, false, views.GESTURE.SWIPE_DOWN);
        const current = () => generation === this.generation && !this.leaving && !!this.view;
        views.changeView({ addView: view, transitionOpen: views.TRANSITION.IN, transitionClose: views.TRANSITION.OUT },
            () => { if (!current()) return; this.opened = true; if (this.saver) this.run(generation); },
            () => { if (current()) this.leave(); },
            () => {
                if (!current()) return;
                this.settingsUI.decorate(view, global.PIXI, 0); this.settingsUI.render(this.settings);
                this.lockTap(true);
                if (auto) this.startSaver();
            });
    }
    lockTap(locked) {
        const c = this.view && this.view.getComponentById('tapAnywhere');
        if (c) { c.display.visible = !locked; if (c.lockInput) c.lockInput(locked); } // hidden too: a locked-but-visible button still caught taps on .165
    }
    startSaver() {
        if (this.saver || !this.view) return;
        this.settingsUI.hide(); this.lockTap(false);
        this.saver = this.settings.style === 'pacman' ? new PacView() : new PhotoUI(PHOTO_COUNT, Date.now());
        this.saver.decorate(this.view, global.PIXI, global.document, 0);
        this.render();
        if (this.opened) this.run(this.generation);
    }
    run(generation) {
        if (this.running) return;
        this.running = true;
        this.frame = () => { if (generation === this.generation && !this.leaving) this.render(); };
        global.PIXI.ticker.shared.add(this.frame);
        this.dim(generation);
    }
    render() { if (this.saver) this.saver.render(Date.now(), new Date()); }
    // Remember the brightness we found, then step down to DIM (never brighter than it was).
    dim(generation) {
        const system = jibo.system;
        if (!system || !system.getBacklight || !system.setBacklight) return;
        try {
            system.getBacklight((error, value) => {
                if (generation !== this.generation || this.leaving) return;
                const from = !error && typeof value === 'number' && value > 0 ? Math.round(value * 10) / 10 : AWAKE;
                this.restoreTo = from;
                const steps = [];
                for (let v = from - 0.1; v >= DIM - 0.001; v -= 0.1) steps.push(Math.round(v * 10) / 10);
                const next = () => {
                    if (generation !== this.generation || this.leaving || !steps.length) { this.dimTimer = null; return; }
                    setBacklight(steps.shift()); this.dimTimer = setTimeout(next, STEP_MS);
                };
                next();
            });
        } catch (_) {}
    }
    restoreBrightness() {
        clearTimeout(this.dimTimer); this.dimTimer = null;
        if (this.restoreTo === null) return;
        const value = this.restoreTo; this.restoreTo = null;
        setBacklight(value);
    }
    leave() { if (this.leaving) return; this.leaving = true; this.exit({ noElementsOfSurprise: true }); }
    close(done) {
        done = done || (() => {});
        if (this.closing && this.closing.finished && this.closing.error) this.closing = null; // retry a failed close, don't replay it
        if (this.closing) {
            if (this.closing.finished) done(this.closing.error); else this.closing.callbacks.push(done);
            return;
        }
        const closing = this.closing = { finished: false, error: null, callbacks: [done] };
        ++this.generation; this.leaving = true; this.running = false;
        if (this.frame) { try { global.PIXI.ticker.shared.remove(this.frame); } catch (_) {} this.frame = null; }
        this.restoreBrightness();
        lifecycle.closeView(jibo.face.views, jibo.face.tween, this.view, require('timers'), 'screensaver', error => {
            closing.finished = true; closing.error = error || null;
            if (!error) { if (this.saver) this.saver.destroy(); this.saver = null; this.view = null; }
            closing.callbacks.splice(0).forEach(callback => callback(closing.error));
        });
    }
    destroy(done) { this.close(error => super.destroy(baseError => done(error || baseError))); }
}

function setBacklight(value) { try { jibo.system.setBacklight(value, () => {}); } catch (_) {} }

ScreensaverSkill.DIM = DIM;
module.exports = ScreensaverSkill;
