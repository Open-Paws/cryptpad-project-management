/**
 * Kanban E2EE Browser Console Test
 *
 * Copy and paste this entire script into the browser console while viewing
 * a Kanban board to verify E2EE is working correctly.
 *
 * This test:
 * 1. Inspects live encryption/decryption
 * 2. Verifies no plaintext leaks to the server
 * 3. Tests that new fields are automatically encrypted
 *
 * Usage:
 *   1. Open a Kanban board in CryptPad
 *   2. Open browser DevTools (F12)
 *   3. Go to Console tab
 *   4. Paste this entire script and press Enter
 *
 * Note: This script automatically finds the inner iframe where CryptPad
 * stores its APP object and ChainPad instance.
 */

(function() {
    'use strict';

    console.log('%c========================================', 'color: #4CAF50; font-weight: bold');
    console.log('%cKANBAN E2EE BROWSER TEST', 'color: #4CAF50; font-weight: bold; font-size: 14px');
    console.log('%c========================================', 'color: #4CAF50; font-weight: bold');

    // ---------------------------------------------------------------------------
    // Find the correct window context (inner iframe)
    // ---------------------------------------------------------------------------
    let targetWindow = window;
    let contextName = 'current window';

    // Check if APP exists in current window
    if (!window.APP) {
        // Try to find the inner iframe
        const iframe = document.querySelector('iframe#sbox-iframe') ||
                       document.querySelector('iframe[src*="inner"]') ||
                       document.querySelector('iframe');

        if (iframe && iframe.contentWindow) {
            try {
                if (iframe.contentWindow.APP) {
                    targetWindow = iframe.contentWindow;
                    contextName = 'inner iframe';
                    console.log('%c  ℹ Found APP in inner iframe, using that context', 'color: #FF9800');
                }
            } catch (e) {
                console.log('%c  ⚠ Cannot access iframe (cross-origin?)', 'color: #FF9800');
            }
        }
    }

    if (!targetWindow.APP) {
        console.error('%c  ✗ Could not find CryptPad APP object!', 'color: #f44336');
        console.log('%c  ℹ Make sure you are on a Kanban board page', 'color: #FF9800');
        console.log('%c  ℹ If running from outer frame, try selecting the iframe context:', 'color: #FF9800');
        console.log('%c    1. Look for dropdown at top-left of Console (says "top")', 'color: #757575');
        console.log('%c    2. Change it to the iframe (e.g., "sbox-iframe")', 'color: #757575');
        console.log('%c    3. Re-run this script', 'color: #757575');
        return;
    }

    console.log(`%c  ✓ Using context: ${contextName}`, 'color: #4CAF50');

    // Use targetWindow for all references
    const APP = targetWindow.APP;

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            passed++;
            console.log(`%c  ✓ ${message}`, 'color: #4CAF50');
        } else {
            failed++;
            console.error(`%c  ✗ ${message}`, 'color: #f44336');
        }
    }

    // ---------------------------------------------------------------------------
    // Test 1: Verify CryptPad Objects Exist
    // ---------------------------------------------------------------------------
    console.log('\n%cTest 1: CryptPad Objects Exist', 'color: #2196F3; font-weight: bold');
    console.log('--------------------------------');

    const cpNfInner = APP && APP.framework && APP.framework._.cpNfInner;
    assert(!!cpNfInner, 'cpNfInner (ChainPad framework) exists');

    const chainpad = cpNfInner && cpNfInner.chainpad;
    assert(!!chainpad, 'ChainPad instance exists');

    assert(!!APP, 'APP object available');

    // ---------------------------------------------------------------------------
    // Test 2: Content Is Valid JSON
    // ---------------------------------------------------------------------------
    console.log('\n%cTest 2: Document Content Structure', 'color: #2196F3; font-weight: bold');
    console.log('------------------------------------');

    let userDoc;
    try {
        userDoc = chainpad ? chainpad.getUserDoc() : null;
        assert(!!userDoc, 'getUserDoc() returns content');

        const parsed = JSON.parse(userDoc);
        assert(typeof parsed === 'object', 'Content parses as valid JSON');
        assert(!!parsed.content, 'Content has "content" property');
        assert(!!parsed.content.items || parsed.content.boards, 'Content has items/boards');
    } catch (e) {
        assert(false, 'Content parsing failed: ' + e.message);
    }

    // ---------------------------------------------------------------------------
    // Test 3: Inspect Network Tab for Plaintext Leakage
    // ---------------------------------------------------------------------------
    console.log('\n%cTest 3: Network Inspection Helper', 'color: #2196F3; font-weight: bold');
    console.log('-----------------------------------');

    // Get sample content to search for
    let sampleSearchTerms = [];
    if (userDoc) {
        try {
            const parsed = JSON.parse(userDoc);
            const items = parsed.content && parsed.content.items;
            if (items) {
                Object.values(items).slice(0, 3).forEach(item => {
                    if (item.title && item.title.length > 3) {
                        sampleSearchTerms.push(item.title);
                    }
                    if (item.body && item.body.length > 10) {
                        sampleSearchTerms.push(item.body.slice(0, 20));
                    }
                });
            }
        } catch (e) {}
    }

    console.log('%c  ℹ To manually verify no plaintext leakage:', 'color: #FF9800');
    console.log('%c    1. Open Network tab in DevTools', 'color: #757575');
    console.log('%c    2. Filter by "WS" (WebSocket)', 'color: #757575');
    console.log('%c    3. Click on the WebSocket connection', 'color: #757575');
    console.log('%c    4. Go to "Messages" tab', 'color: #757575');
    console.log('%c    5. Search for these terms (should NOT find them):', 'color: #757575');
    sampleSearchTerms.forEach(term => {
        console.log(`%c       - "${term}"`, 'color: #9C27B0');
    });

    // ---------------------------------------------------------------------------
    // Test 4: Verify Encryption Format
    // ---------------------------------------------------------------------------
    console.log('\n%cTest 4: Verify Encrypted Message Format', 'color: #2196F3; font-weight: bold');
    console.log('-----------------------------------------');

    // Hook into the message system to inspect encrypted messages
    // We need to hook in the outer window where WebSocket lives
    const outerWindow = window.top || window;
    const originalSend = outerWindow.WebSocket.prototype.send;
    let capturedEncryptedMsg = null;

    outerWindow.WebSocket.prototype.send = function(data) {
        if (typeof data === 'string' && data.includes('|') && data.length > 50) {
            // This looks like an encrypted message
            capturedEncryptedMsg = data;
        }
        return originalSend.apply(this, arguments);
    };

    console.log('%c  ℹ WebSocket send intercepted for inspection', 'color: #FF9800');
    console.log('%c  ℹ Make a change to the board to capture an encrypted message', 'color: #FF9800');

    // Provide a function to inspect captured messages (on outer window for accessibility)
    outerWindow.CryptPad_E2EE_Test = {
        inspectLastMessage: function() {
            if (!capturedEncryptedMsg) {
                console.log('%c  No encrypted message captured yet. Make a change to the board.', 'color: #FF9800');
                return;
            }

            console.log('\n%cCaptured Encrypted Message Analysis:', 'color: #2196F3; font-weight: bold');
            console.log('--------------------------------------');

            // Check format
            const hasNonceSeparator = capturedEncryptedMsg.includes('|');
            assert(hasNonceSeparator, 'Message has nonce|ciphertext format');

            // Check that it's base64-like
            const parts = capturedEncryptedMsg.split('|');
            const looksLikeBase64 = /^[A-Za-z0-9+/=]+$/.test(parts[parts.length - 1].replace(/^cp\|[^|]+\|/, ''));
            assert(looksLikeBase64, 'Ciphertext appears to be base64 encoded');

            // Check for plaintext leakage
            sampleSearchTerms.forEach(term => {
                const found = capturedEncryptedMsg.toLowerCase().includes(term.toLowerCase());
                assert(!found, `Plaintext "${term.slice(0, 15)}..." not in encrypted message`);
            });

            console.log('\n%cRaw encrypted message (first 200 chars):', 'color: #757575');
            console.log(capturedEncryptedMsg.slice(0, 200) + '...');
        },

        cleanup: function() {
            outerWindow.WebSocket.prototype.send = originalSend;
            console.log('%c  WebSocket hook removed', 'color: #4CAF50');
        }
    };

    // ---------------------------------------------------------------------------
    // Test 5: URL Hash Contains Key Material
    // ---------------------------------------------------------------------------
    console.log('\n%cTest 5: URL Key Material', 'color: #2196F3; font-weight: bold');
    console.log('-------------------------');

    // Use outer window for URL (that's where the actual URL with hash lives)
    const hash = outerWindow.location.hash;
    assert(hash.length > 20, 'URL hash contains key material');
    assert(hash.startsWith('#/'), 'URL hash has correct format');

    // Check that query params don't contain keys
    const queryParams = outerWindow.location.search;
    assert(!queryParams.includes('key='), 'No key in URL query params (would leak to server)');

    // ---------------------------------------------------------------------------
    // Test 6: Verify Keys Are Not in localStorage Plaintext
    // ---------------------------------------------------------------------------
    console.log('\n%cTest 6: localStorage Security', 'color: #2196F3; font-weight: bold');
    console.log('-------------------------------');

    // Check localStorage in outer window (where it's typically stored)
    const ls = outerWindow.localStorage;
    const lsKeys = Object.keys(ls);
    let foundPlaintextKey = false;
    lsKeys.forEach(key => {
        const value = ls.getItem(key);
        // Look for obvious key patterns
        if (value && value.includes('cryptKey') && value.includes(':')) {
            // Check if it looks encrypted (has nonce separator)
            if (!value.includes('|') && value.length < 100) {
                foundPlaintextKey = true;
            }
        }
    });
    assert(!foundPlaintextKey, 'No obvious plaintext keys in localStorage');

    // ---------------------------------------------------------------------------
    // Test 7: Test Adding a Field (Manual)
    // ---------------------------------------------------------------------------
    console.log('\n%cTest 7: Test New Field Encryption', 'color: #2196F3; font-weight: bold');
    console.log('-----------------------------------');

    console.log('%c  ℹ To test that new fields are encrypted:', 'color: #FF9800');
    console.log('%c    1. Run: CryptPad_E2EE_Test.addTestField()', 'color: #757575');
    console.log('%c    2. Check Network tab - the field should NOT appear in plaintext', 'color: #757575');
    console.log('%c    3. Run: CryptPad_E2EE_Test.inspectLastMessage()', 'color: #757575');

    outerWindow.CryptPad_E2EE_Test.addTestField = function() {
        if (!APP || !APP.framework) {
            console.error('APP.framework not found');
            return;
        }

        // Get the kanban instance
        const kanban = APP.kanban;
        if (!kanban || !kanban.options || !kanban.options.boards) {
            console.error('Kanban board not found');
            return;
        }

        // Find the first item
        const items = kanban.options.boards.items;
        const firstItemId = Object.keys(items)[0];
        if (!firstItemId) {
            console.error('No items found in board');
            return;
        }

        // Add a test field with sensitive-looking data
        const testValue = 'E2EE_TEST_SECRET_' + Date.now();
        items[firstItemId]._e2eTestField = testValue;

        // Trigger sync
        APP.framework.localChange();

        console.log(`%c  ✓ Added test field with value: ${testValue}`, 'color: #4CAF50');
        console.log('%c  ℹ Now run: CryptPad_E2EE_Test.inspectLastMessage()', 'color: #FF9800');
        console.log('%c  ℹ The value should NOT appear in the encrypted message', 'color: #FF9800');

        // Store for later verification
        outerWindow.CryptPad_E2EE_Test._testValue = testValue;
    };

    outerWindow.CryptPad_E2EE_Test.verifyTestField = function() {
        const testValue = outerWindow.CryptPad_E2EE_Test._testValue;
        if (!testValue) {
            console.error('Run addTestField() first');
            return;
        }

        if (capturedEncryptedMsg) {
            const found = capturedEncryptedMsg.includes(testValue);
            assert(!found, `Test value "${testValue}" is encrypted (not visible in message)`);
        } else {
            console.log('%c  ℹ No message captured. Make sure you added the field.', 'color: #FF9800');
        }
    };

    // ---------------------------------------------------------------------------
    // Summary
    // ---------------------------------------------------------------------------
    console.log('\n%c========================================', 'color: #4CAF50; font-weight: bold');
    console.log('%cINITIAL TEST SUMMARY', 'color: #4CAF50; font-weight: bold');
    console.log('%c========================================', 'color: #4CAF50; font-weight: bold');
    console.log(`%c  Passed: ${passed}`, 'color: #4CAF50');
    console.log(`%c  Failed: ${failed}`, failed > 0 ? 'color: #f44336' : 'color: #4CAF50');

    console.log('\n%cAvailable Commands:', 'color: #2196F3; font-weight: bold');
    console.log('%c  CryptPad_E2EE_Test.inspectLastMessage() - Analyze last encrypted message', 'color: #757575');
    console.log('%c  CryptPad_E2EE_Test.addTestField()       - Add a test field to verify encryption', 'color: #757575');
    console.log('%c  CryptPad_E2EE_Test.verifyTestField()    - Verify the test field was encrypted', 'color: #757575');
    console.log('%c  CryptPad_E2EE_Test.cleanup()            - Remove WebSocket hook', 'color: #757575');

    console.log('\n%c⚠ Remember to run CryptPad_E2EE_Test.cleanup() when done!', 'color: #FF9800; font-weight: bold');

})();
