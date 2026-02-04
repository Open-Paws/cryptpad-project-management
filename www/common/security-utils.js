// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Security Utilities Module
 *
 * This module provides centralized security functions for sanitization,
 * escaping, and validation to prevent XSS and injection vulnerabilities.
 */
define([
    '/lib/dompurify/purify.min.js'
], function (DOMPurify) {
    'use strict';

    var Security = {};

    /**
     * Sanitize HTML content using DOMPurify
     * Removes any potentially malicious scripts, event handlers, etc.
     *
     * @param {string} html - The HTML string to sanitize
     * @param {Object} config - Optional DOMPurify configuration
     * @returns {string} Sanitized HTML string
     */
    Security.sanitizeHtml = function (html, config) {
        if (!html || typeof html !== 'string') { return ''; }

        var defaultConfig = {
            ALLOWED_TAGS: ['a', 'b', 'i', 'u', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li',
                          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
                          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'div',
                          'hr', 'sup', 'sub', 'del', 's', 'mark', 'figure', 'figcaption',
                          'media-tag', 'iframe', 'video', 'audio', 'source'],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'style', 'target',
                          'rel', 'data-*', 'colspan', 'rowspan', 'width', 'height',
                          'data-crypto-key', 'controls', 'type', 'sandbox', 'allowfullscreen'],
            ALLOW_DATA_ATTR: true,
            ADD_ATTR: ['target'],
            FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
        };

        var mergedConfig = config ? Object.assign({}, defaultConfig, config) : defaultConfig;
        return DOMPurify.sanitize(html, mergedConfig);
    };

    /**
     * Safely set innerHTML on an element with sanitization
     *
     * @param {HTMLElement} element - The DOM element
     * @param {string} html - The HTML string to set
     * @param {Object} config - Optional DOMPurify configuration
     */
    Security.setInnerHTML = function (element, html, config) {
        if (!element) { return; }
        element.innerHTML = Security.sanitizeHtml(html, config);
    };

    /**
     * Escape HTML entities to prevent XSS
     * Use this for plain text that should not contain HTML
     *
     * @param {string} str - The string to escape
     * @returns {string} Escaped string
     */
    Security.escapeHtml = function (str) {
        if (!str || typeof str !== 'string') { return ''; }
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return str.replace(/[&<>"']/g, function (char) {
            return map[char];
        });
    };

    /**
     * Validate and sanitize a file path to prevent path traversal attacks
     *
     * @param {string} basePath - The base directory path
     * @param {string} userPath - The user-provided path component
     * @returns {string|null} Sanitized path or null if invalid
     */
    Security.sanitizePath = function (basePath, userPath) {
        if (!basePath || !userPath) { return null; }
        if (typeof basePath !== 'string' || typeof userPath !== 'string') { return null; }

        // Remove any path traversal attempts
        var sanitized = userPath
            .replace(/\.\./g, '')
            .replace(/\/\//g, '/')
            .replace(/\\/g, '/')
            .replace(/^\/+/, '')
            .replace(/[<>:"|?*\x00-\x1f]/g, ''); // Remove invalid filename characters

        // Validate the result doesn't escape the base path
        if (sanitized.indexOf('..') !== -1) { return null; }

        return sanitized;
    };

    /**
     * Validate a channel ID for CryptPad
     * Channel IDs should be alphanumeric with specific length requirements
     *
     * @param {string} id - The channel ID to validate
     * @returns {boolean} True if valid
     */
    Security.isValidChannelId = function (id) {
        return typeof id === 'string' &&
            id.length >= 32 && id.length < 50 &&
            /^[a-zA-Z0-9=+-]*$/.test(id);
    };

    /**
     * Sanitize multi-character strings comprehensively
     * Handles cases where simple replace might miss nested patterns
     *
     * @param {string} str - The string to sanitize
     * @param {string} pattern - The pattern to remove (e.g., '<script>')
     * @returns {string} Sanitized string
     */
    Security.sanitizePattern = function (str, pattern) {
        if (!str || typeof str !== 'string') { return ''; }
        if (!pattern || typeof pattern !== 'string') { return str; }

        var result = str;
        var prev;
        // Keep replacing until no more instances exist (handles nested cases)
        do {
            prev = result;
            result = result.split(pattern).join('');
        } while (result !== prev);

        return result;
    };

    /**
     * Properly handle character escaping without double-escaping
     *
     * @param {string} str - The string to escape
     * @returns {string} Properly escaped string
     */
    Security.safeEscape = function (str) {
        if (!str || typeof str !== 'string') { return ''; }

        // First, decode any existing entities to prevent double-escaping
        var decoded = str
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

        // Then escape properly
        return Security.escapeHtml(decoded);
    };

    /**
     * Validate URL to prevent javascript: and other dangerous protocols
     *
     * @param {string} url - The URL to validate
     * @returns {boolean} True if URL is safe
     */
    Security.isSafeUrl = function (url) {
        if (!url || typeof url !== 'string') { return false; }

        try {
            var parsed = new URL(url, window.location.origin);
            var safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
            return safeProtocols.indexOf(parsed.protocol) !== -1;
        } catch (e) {
            return false;
        }
    };

    /**
     * Sanitize URL, returning empty string if invalid
     *
     * @param {string} url - The URL to sanitize
     * @returns {string} Safe URL or empty string
     */
    Security.sanitizeUrl = function (url) {
        return Security.isSafeUrl(url) ? url : '';
    };

    /**
     * Strip HTML tags from a string safely
     * Uses DOMPurify with no allowed tags
     *
     * @param {string} text - The text potentially containing HTML
     * @returns {string} Plain text without HTML
     */
    Security.stripTags = function (text) {
        if (!text || typeof text !== 'string') { return ''; }
        return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    };

    return Security;
});
