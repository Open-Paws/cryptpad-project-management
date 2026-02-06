// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Security: Use explicit origin allowlist instead of overly permissive regex
// The previous /.*/i regex allowed any origin, defeating the purpose of origin validation
var ALLOWED_ORIGINS = [];

// Initialize allowed origins from available context
(function() {
    try {
        // Allow same-origin by default
        if (window.location && window.location.origin) {
            ALLOWED_ORIGINS.push(window.location.origin);
        }
        // Use document.referrer to determine the parent's origin when cross-origin.
        // Reading window.parent.location.origin throws SecurityError in cross-origin
        // iframes, so we derive the parent origin from document.referrer instead.
        if (document.referrer) {
            try {
                var referrerOrigin = new URL(document.referrer).origin;
                if (referrerOrigin && referrerOrigin !== 'null' &&
                    ALLOWED_ORIGINS.indexOf(referrerOrigin) === -1) {
                    ALLOWED_ORIGINS.push(referrerOrigin);
                }
            } catch (e) {
                // Invalid referrer URL - ignore
            }
        }
    } catch (e) {
        // Fallback: only allow same origin
    }
})();

var isValidOrigin = function (origin) {
    // Security: Require explicit origin match instead of regex wildcards
    if (!origin || typeof origin !== 'string') { return false; }
    return ALLOWED_ORIGINS.indexOf(origin) !== -1;
};

window.addEventListener('message', function(e) {
    // Security: Strict origin validation - reject unknown origins
    if (!isValidOrigin(e.origin)) {
        console.warn('Blocked message from untrusted origin:', e.origin);
        return;
    }

    var payload;
    try {
        payload = JSON.parse(e.data);
    } catch (err) {
        console.warn('Failed to parse message data');
        return;
    }

    var parent = window.parent;
    var respond = function (error, data) {
        var res = {
            _uid: payload._uid,
            error: error,
            data: data,
        };
        // Security: Respond only to the validated origin, never use '*'
        parent.postMessage(JSON.stringify(res), e.origin);
    };

    switch(payload.method) {
        case undefined:
            return respond('No method supplied');
        default:
            return respond(void 0, "EHLO");
    }
});
