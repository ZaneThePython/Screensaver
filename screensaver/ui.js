'use strict';

const path = require('path');
const Saver = require('./saver');

// Chromecast-style ambient screen: full-screen photos with a slow zoom and pan,
// cross-fading every 30 s, and the time and date in a corner over a soft shade.
// The clock changes corner with every photo so nothing stays lit in one place.
const W = 1280, H = 720, MARGIN = 80, PHOTO_W = 1440, SHADE_W = 900, SHADE_H = 520;
const PHOTOS = path.join(__dirname, 'resources/photos');
const photoPath = i => path.join(PHOTOS, (i < 10 ? '0' : '') + i + '.jpg');

class UI {
    constructor(count, now) { this.saver = new Saver(count, now); this.textures = {}; this.corner = null; }
    decorate(view, PIXI, doc, index) {
        this.view = view; this.PIXI = PIXI;
        let i = index;
        const bg = new PIXI.Graphics(); bg.beginFill(0x000000); bg.drawRect(0, 0, W, H); bg.endFill();
        view.stage.addChildAt(bg, i++);
        this.current = this.sprite(); view.stage.addChildAt(this.current, i++);
        this.incoming = this.sprite(); view.stage.addChildAt(this.incoming, i++);
        this.shade = new PIXI.Sprite(shadeTexture(PIXI, doc)); this.shade.anchor.set(0, 1); view.stage.addChildAt(this.shade, i++);
        const shadow = { dropShadow: true, dropShadowColor: '#000000', dropShadowAlpha: 0.6, dropShadowBlur: 12, dropShadowDistance: 0, padding: 16 };
        this.time = new PIXI.Text('', Object.assign({ fontFamily: 'Proxima Nova Light', fontSize: 128, fill: '#FFFFFF' }, shadow));
        this.date = new PIXI.Text('', Object.assign({ fontFamily: 'Proxima Nova Soft', fontSize: 36, fill: '#F2F2F2' }, shadow));
        view.stage.addChildAt(this.time, i++); view.stage.addChildAt(this.date, i++);
    }
    sprite() { const s = new this.PIXI.Sprite(this.PIXI.Texture.EMPTY); s.anchor.set(0.5, 0.5); s.visible = false; return s; }
    // Load a photo once; keeps only the photos still needed (current and incoming).
    texture(index) {
        if (!this.textures[index]) {
            const image = new Image(), entry = this.textures[index] = { texture: null, ready: false };
            // Build the texture only once the image has decoded (PIXI then uploads it on first draw).
            image.onload = () => {
                if (this.textures[index] !== entry) return; // released while loading
                entry.texture = new this.PIXI.Texture(new this.PIXI.BaseTexture(image)); entry.ready = true;
            };
            image.onerror = () => { entry.failed = true; };
            image.src = 'file://' + photoPath(index);
        }
        return this.textures[index];
    }
    release(keep) {
        Object.keys(this.textures).forEach(k => {
            if (keep.indexOf(Number(k)) >= 0) return;
            try { if (this.textures[k].texture) this.textures[k].texture.destroy(true); } catch (_) {}
            delete this.textures[k];
        });
    }
    // Ken Burns: zoom from 104% to 112% of cover size, drifting sideways (direction alternates per photo).
    place(sprite, entry, progress, slot, alpha) {
        if (!entry.ready) { sprite.visible = false; return false; }
        if (sprite.texture !== entry.texture) sprite.texture = entry.texture;
        const scale = (W / PHOTO_W) * (1.04 + 0.08 * progress), dir = slot % 2 ? 1 : -1;
        sprite.scale.set(scale, scale);
        sprite.x = W / 2 + dir * (40 * progress - 20); sprite.y = H / 2;
        sprite.alpha = alpha; sprite.visible = true;
        return true;
    }
    render(now, date) {
        if (!this.view || !this.time) return;
        const s = this.saver.state(now), cur = this.texture(s.photo);
        this.place(this.current, cur, s.progress, s.slot, 1);
        if (s.fade > 0) {
            const next = this.texture(s.next);
            if (!this.place(this.incoming, next, s.nextProgress, s.slot + 1, s.fade) && next.failed) this.incoming.visible = false;
        } else {
            this.incoming.visible = false;
            if (s.progress > 0.2) this.texture(s.next); // preload well before the fade
        }
        if (this.lastSlot !== s.slot) { this.lastSlot = s.slot; this.release([s.photo, s.next]); }
        this.clock(s.corner, s.clockAlpha, date);
    }
    clock(corner, alpha, date) {
        const t = Saver.formatTime(date), d = Saver.formatDate(date);
        if (this.time.text !== t) this.time.text = t;
        if (this.date.text !== d) this.date.text = d;
        if (this.corner !== corner) {
            this.corner = corner;
            const right = /Right/.test(corner), top = /^top/.test(corner);
            this.time.anchor.set(right ? 1 : 0, 0); this.date.anchor.set(right ? 1 : 0, 0);
            const x = right ? W - MARGIN : MARGIN, blockTop = top ? MARGIN - 34 : H - MARGIN - 176;
            this.time.x = this.date.x = x; this.time.y = blockTop; this.date.y = blockTop + 142;
            this.shade.x = right ? W : 0; this.shade.y = top ? 0 : H;
            this.shade.scale.set((right ? -1 : 1) * SHADE_W / 512, (top ? -1 : 1) * SHADE_H / 512);
        }
        this.time.alpha = this.date.alpha = alpha; this.shade.alpha = alpha * 0.85;
    }
    destroy() { this.release([]); this.view = null; this.time = null; }
}

// A soft black glow anchored at the clock's corner so white text reads on bright photos.
// Drawn as a circle fading to nothing at the canvas edges, then stretched into an ellipse.
function shadeTexture(PIXI, doc) {
    const R = 512, c = doc.createElement('canvas'); c.width = R; c.height = R;
    const g = c.getContext('2d'), grad = g.createRadialGradient(0, R, 0, 0, R, R);
    grad.addColorStop(0, 'rgba(0,0,0,0.6)'); grad.addColorStop(0.5, 'rgba(0,0,0,0.3)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, R, R);
    return PIXI.Texture.fromCanvas(c);
}

UI.photoPath = photoPath;
module.exports = UI;
