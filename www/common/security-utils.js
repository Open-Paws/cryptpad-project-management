// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

define([
    '/lib/dompurify/purify.min.js'
], function (DOMPurify) {
    'use strict';

    var Security = {};

    /**
     * Centralized DOMPurify configurations for different contexts.
     * Import and use these instead of duplicating config objects across files.
     */
    Security.DOMPurifyConfig = {
        // For general UI elements (common-interface.js, pages.js)
        ui: {
            ALLOWED_TAGS: ['a', 'b', 'i', 'u', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li',
                          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
                          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'div',
                          'hr', 'sup', 'sub', 'del', 's', 'mark', 'svg', 'path', 'g'],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'style', 'target',
                          'rel', 'data-*', 'colspan', 'rowspan', 'width', 'height', 'd',
                          'viewBox', 'fill', 'stroke', 'xmlns'],
            ALLOW_DATA_ATTR: true
        },
        // For UI elements with form controls (common-ui-elements.js)
        // Allows input/button/label because CryptPad's internal UI dialogs
        // render these from trusted Messages.* localization strings.
        uiElements: {
            ALLOWED_TAGS: ['a', 'b', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'small', 'span', 'strong', 'sub', 'sup',
                'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul', 'blockquote', 'label', 'input', 'button'],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel', 'style',
                'data-localization', 'data-localization-title', 'type', 'name', 'value', 'checked',
                'disabled', 'for', 'tabindex', 'aria-label', 'role'],
            ALLOW_DATA_ATTR: true,
            ADD_ATTR: ['target']
        },
        // For rendered markdown content (diffMarked.js)
        // Note: style attribute is allowed for markdown compatibility.
        // CSS-based exfiltration between collaborators is an accepted tradeoff
        // given CryptPad's E2EE model (server cannot inject styles).
        markdown: {
            ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li',
                'blockquote', 'pre', 'code', 'em', 'strong', 'del', 'br', 'hr', 'table',
                'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'div', 'sup', 'sub',
                'details', 'summary', 'dl', 'dt', 'dd',
                'media-tag', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
                'text', 'g', 'defs', 'marker', 'foreignObject', 'i', 'b', 'u', 's'],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
                'data-href', 'data-plugin', 'data-crypto-key', 'data-type', 'style',
                'width', 'height', 'viewBox', 'xmlns', 'd', 'fill', 'stroke', 'stroke-width',
                'transform', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'points', 'x1', 'y1',
                'x2', 'y2', 'marker-end', 'marker-start', 'font-size', 'text-anchor',
                'dominant-baseline', 'colspan', 'rowspan'],
            ALLOW_DATA_ATTR: true,
            ADD_ATTR: ['target', 'rel']
        },
        // For comment content (comments.js) - very restricted
        comments: {
            ALLOWED_TAGS: ['span', 'br'],
            ALLOWED_ATTR: ['class', 'data-name', 'data-avatar', 'data-profile']
        },
        // For comment editing (comments.js) - includes contenteditable
        commentsEdit: {
            ALLOWED_TAGS: ['span', 'br'],
            ALLOWED_ATTR: ['class', 'data-name', 'data-avatar', 'data-profile', 'contenteditable']
        }
    };

    return Security;
});
