'use strict';

// Runs from boot (manifest permission "background"): opens the screensaver once Jibo has sat
// idle for the time picked in settings. Checked every 10 s; any activity restarts the wait.
const Settings = require('./settings');
const CHECK_MS = 10000;
let timer = null, idleSince = null;

function check(api, now) {
    const after = Settings.load().after;
    if (!after || !api.isIdle()) { idleSince = null; return false; }
    if (idleSince === null) idleSince = now;
    if (now - idleSince < after * 60000) return false;
    idleSince = null;
    return api.open({ auto: true });
}

module.exports = {
    start(api) { clearInterval(timer); idleSince = null; timer = setInterval(() => check(api, Date.now()), CHECK_MS); },
    stop() { clearInterval(timer); timer = null; },
    check: check
};
