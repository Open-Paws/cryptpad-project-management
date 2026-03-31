// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// This file is used when a user tries to export the entire CryptDrive.
// Pads from the code app will be exported using this format instead of plain text.
define([
], function () {
    var module = {
        ext: '.json'
    };

    // Strip T3 confidential items before CryptDrive bulk export.
    // This mirrors the redactT3Items logic in inner.js — kept inline since export.js
    // has no imports. Normalizes tier strings to handle case/whitespace in imported data.
    var redactT3 = function (content) {
        var out = JSON.parse(JSON.stringify(content));
        var items = out.items || {};
        var data = out.data || {};
        var t3Ids = {};
        Object.keys(items).forEach(function (id) {
            var rawTier = items[id].security_tier;
            var tier = typeof rawTier === 'string' ? rawTier.trim().toUpperCase() : '';
            if (tier === 'T3') {
                t3Ids[id] = true;
                delete items[id];
            }
        });
        Object.keys(data).forEach(function (boardId) {
            var board = data[boardId];
            if (Array.isArray(board.item)) {
                board.item = board.item.filter(function (id) { return !t3Ids[String(id)]; });
            }
        });
        Object.keys(items).forEach(function (id) {
            var item = items[id];
            if (Array.isArray(item.dependencies)) {
                item.dependencies = item.dependencies.filter(function (depId) {
                    return !t3Ids[String(depId)];
                });
            }
        });
        return out;
    };

    module.main = function (userDoc, cb) {
        var content = redactT3(userDoc.content);
        cb(new Blob([JSON.stringify(content, 0, 2)], {
            type: 'application/json',
        }));
    };

    module.import = function (content) {
        // Import from Trello

        var c = {
            data: {},
            items: {},
            list: []
        };

        var colorMap = {
            red: 'color1',
            orange: 'color2',
            yellow: 'color3',
            lime: 'color4',
            green: 'color5',
            sky: 'color6',
            blue: 'color7',
            purple: 'color8',
            pink: 'color9',
            black: 'nocolor'
        };
        content.cards.forEach(function (obj, i) {
            var tags;
            var color;
            if (Array.isArray(obj.labels)) {
                obj.labels.forEach(function (l) {
                    if (!color) {
                        color = colorMap[l.color] || '';
                    }
                    if (l.name) {
                        tags = tags || [];
                        var n = l.name.toLowerCase().trim();
                        if (tags.indexOf(n) === -1) { tags.push(n); }
                    }
                });
            }
            c.items[(i+1)] = {
                id: (i+1),
                title: obj.name,
                body: obj.desc,
                color: color,
                tags: tags
            };
        });

        var id = 1;
        content.lists.forEach(function (obj) {
            var _id = obj.id;
            var cards = [];
            content.cards.forEach(function (card, i) {
                if (card.idList === _id) {
                    cards.push(i+1);
                }
            });
            c.data[id] = {
                id: id,
                title: obj.name,
                item: cards
            };
            c.list.push(id);

            id++;
        });

        return c;
    };

    return module;
});

