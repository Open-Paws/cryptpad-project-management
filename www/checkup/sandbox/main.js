// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

define([
    'jquery',
    '/api/config',
    '/common/common-util.js',
    '/checkup/checkup-tools.js',

    '/components/tweetnacl/nacl-fast.min.js',
    'css!/components/components-font-awesome/css/font-awesome.min.css',
    'less!/checkup/app-checkup.less',
], function ($, ApiConfig, Util, Tools) {
    // Expected parent origin (main CryptPad domain)
    var expectedOrigin = ApiConfig.httpUnsafeOrigin;
    var postMessage = function (content) {
        // Security: Only post messages to the expected parent origin, not '*'
        window.parent.postMessage(JSON.stringify(content), expectedOrigin);
    };
    postMessage({ command: "READY", });
    var getHeaders = function (url, cb) {
        Tools.common_xhr(url, function (xhr) {
            var allHeaders = xhr.getAllResponseHeaders();
            return void cb(void 0, allHeaders, xhr);
        });
    };
    var COMMANDS = {};
    COMMANDS.GET_HEADER = function (content, cb) {
        var url = content.url;
        getHeaders(url, function (err, headers, xhr) {
            cb(xhr.getResponseHeader(content.header));
        });
    };

    COMMANDS.CHECK_JS_APIS = function (content, cb) {
        var globalAPIs = content['globals'] || [];
        var response = {};
        globalAPIs.forEach(function (key) {
            if (Array.isArray(key)) {
                response[key.join('.')] = Boolean(Util.find(window, key));
                return;
            }

            response[key] = Boolean(window[key]);
        });
        cb(response);
    };

    COMMANDS.FANCY_API_CHECKS = function (content, cb) {
        cb({
            SharedArrayBufferFallback: Tools.supportsSharedArrayBuffers(),
        });
    };

    COMMANDS.CHECK_HTTP_STATUS = function (content, cb) {
        Tools.common_xhr(content.url, function (xhr) {
            cb(xhr.status);
        });
    };

    window.addEventListener("message", function (event) {
        // Security: Only accept messages from the expected parent origin
        if (event.origin !== expectedOrigin) { return; }
        var txid, command;
        if (event && event.data) {
            try {
                //console.log(JSON.parse(event.data));
                var msg = JSON.parse(event.data);
                command = msg.command;
                txid = msg.txid;
                if (!txid) { return; }
                COMMANDS[command](msg.content, function (response) {
                    // postMessage with same txid
                    postMessage({
                        txid: txid,
                        content: response,
                    });
                });
            } catch (err) {
                postMessage({
                    txid: txid,
                    content: err,
                });
                console.error(err, command);
            }
        } else {
            console.error(event);
        }
    });
});
