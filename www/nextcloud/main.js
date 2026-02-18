// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

var url = 'http://localhost:3000';
define([
    'jquery',
    url + '/cryptpad-api.js'
], function ($, Api) {
    if (window.top !== window) { return; }
    $(function () {

        // TODO
        // This is a test application
        // It can be used to embed another cryptpad instance using the new API

        console.log(Api);
        var defaultKey = '/2/integration/edit/X3RlrgR2JhA0rI+PJ3rXufsQ/';
        var key = window.location.hash ? window.location.hash.slice(1) : defaultKey;
        window.location.hash = key;

// Test doc
var mystring = "Hello World!";
var blob = new Blob([mystring], {
    type: 'text/markdown'
});
var docUrl = URL.createObjectURL(blob);
console.warn(docUrl);

        var onSave = function (_blob, cb) {
            console.log('APP ONSAVE', _blob);
            docUrl = URL.createObjectURL(_blob);
            console.log('New doc URL', docUrl);
            if (typeof (cb) === "function") { cb(); }
        };
        var onNewKey = function (data, cb) {
            var newKey = data.new;
            window.location.hash = newKey;
            cb(newKey);
        };


        Api(url, null, {
            document: {
                url: docUrl,
                key: key,
                fileType: 'md'
            },
            documentType: 'code', // appname
            events: {
                onSave: onSave,
                onNewKey: onNewKey
            }
        }).then(function () {
            console.log('SUCCESS');
        }).catch(function (e) {
            console.error('ERROR', e);
        });


    });
});
