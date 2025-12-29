// SPDX-FileCopyrightText: 2024 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Kanban E2EE Test Suite
 *
 * Tests that verify end-to-end encryption is working correctly for the Kanban board.
 * This simulates the exact encryption flow from user data → encrypted message → decryption.
 *
 * Run with: node scripts/tests/test-kanban-e2ee.js
 */

'use strict';

const Nacl = require('tweetnacl/nacl-fast');
const NaclUtil = require('tweetnacl-util');

// Simulate the crypto module from www/components/chainpad-crypto/crypto.js
const Crypto = (function() {
    const encodeBase64 = NaclUtil.encodeBase64;
    const decodeBase64 = (str) => {
        let i;
        if (i = str.length % 4) { str += '='.repeat(4 - i); }
        return NaclUtil.decodeBase64(str);
    };
    const decodeUTF8 = NaclUtil.decodeUTF8;
    const encodeUTF8 = NaclUtil.encodeUTF8;

    const encryptStr = function(str, key) {
        const array = decodeUTF8(str);
        const nonce = Nacl.randomBytes(24);
        const packed = Nacl.secretbox(array, nonce, key);
        if (!packed) { throw new Error('Encryption failed'); }
        return encodeBase64(nonce) + "|" + encodeBase64(packed);
    };

    const decryptStr = function(str, key) {
        const arr = str.split('|');
        if (arr.length !== 2) { throw new Error('Invalid encrypted format'); }
        const nonce = decodeBase64(arr[0]);
        const packed = decodeBase64(arr[1]);
        const unpacked = Nacl.secretbox.open(packed, nonce, key);
        if (!unpacked) { throw new Error('Decryption failed - wrong key?'); }
        return encodeUTF8(unpacked);
    };

    return {
        encrypt: encryptStr,
        decrypt: decryptStr,
        genKey: () => encodeBase64(Nacl.randomBytes(18)),
        parseKey: (str) => {
            const array = decodeBase64(str);
            const hash = Nacl.hash(array);
            return {
                cryptKey: hash.subarray(0, 32),
                lookupKey: hash.subarray(32)
            };
        }
    };
})();

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    if (condition) {
        testsPassed++;
        console.log(`  ✓ ${message}`);
    } else {
        testsFailed++;
        console.error(`  ✗ ${message}`);
    }
}

function assertThrows(fn, message) {
    try {
        fn();
        testsFailed++;
        console.error(`  ✗ ${message} (expected to throw)`);
    } catch (e) {
        testsPassed++;
        console.log(`  ✓ ${message}`);
    }
}

// Sample Kanban board data (what the app works with - plaintext)
const sampleKanbanContent = {
    content: {
        list: ["board1", "board2", "board3"],
        data: {
            board1: { id: "board1", title: "To Do", color: "#ff0000", item: [1, 2] },
            board2: { id: "board2", title: "In Progress", color: "#ffff00", item: [3] },
            board3: { id: "board3", title: "Done", color: "#00ff00", item: [4, 5] }
        },
        items: {
            1: {
                id: 1,
                title: "Secret Task Alpha",
                body: "This contains sensitive information about Project X",
                tags: ["confidential", "q4-planning"],
                color: "#ff5500",
                assignee: "alice@example.com",
                due_date: "2024-12-31",
                priority: "high",  // Custom field example
                scoring: { impact: 8, effort: 3 }
            },
            2: {
                id: 2,
                title: "Budget Review",
                body: "Review Q4 budget allocations - $500k discretionary",
                tags: ["finance", "sensitive"]
            },
            3: {
                id: 3,
                title: "API Integration",
                body: "API key: sk_live_abc123xyz (DO NOT SHARE)",
                tags: ["technical"]
            },
            4: {
                id: 4,
                title: "Completed Feature",
                body: "Successfully shipped user authentication"
            },
            5: {
                id: 5,
                title: "Documentation",
                body: "Internal docs for password reset flow"
            }
        }
    },
    metadata: {
        title: "Q4 Planning Board",
        type: "kanban"
    }
};

// Sensitive strings that should NEVER appear in encrypted output
const sensitiveStrings = [
    "Secret Task Alpha",
    "Project X",
    "confidential",
    "alice@example.com",
    "Budget Review",
    "$500k",
    "sk_live_abc123xyz",
    "password reset",
    "Q4 Planning Board"
];

// ============================================================================
// TEST SUITE
// ============================================================================

console.log("\n========================================");
console.log("KANBAN E2EE TEST SUITE");
console.log("========================================\n");

// ---------------------------------------------------------------------------
// Test 1: Basic Encryption/Decryption Round-Trip
// ---------------------------------------------------------------------------
console.log("Test 1: Basic Encryption/Decryption Round-Trip");
console.log("-----------------------------------------------");

(function testBasicRoundTrip() {
    const keyStr = Crypto.genKey();
    const { cryptKey } = Crypto.parseKey(keyStr);

    const plaintext = JSON.stringify(sampleKanbanContent);
    const encrypted = Crypto.encrypt(plaintext, cryptKey);
    const decrypted = Crypto.decrypt(encrypted, cryptKey);

    assert(encrypted !== plaintext, "Encrypted output differs from plaintext");
    assert(decrypted === plaintext, "Decrypted output matches original plaintext");
    assert(encrypted.includes("|"), "Encrypted format contains nonce|ciphertext separator");

    const parsed = JSON.parse(decrypted);
    assert(parsed.content.items[1].title === "Secret Task Alpha", "Decrypted content preserves item title");
    assert(parsed.content.items[1].priority === "high", "Decrypted content preserves custom field");
})();

// ---------------------------------------------------------------------------
// Test 2: No Plaintext Leakage in Encrypted Output
// ---------------------------------------------------------------------------
console.log("\nTest 2: No Plaintext Leakage in Encrypted Output");
console.log("-------------------------------------------------");

(function testNoPlaintextLeakage() {
    const keyStr = Crypto.genKey();
    const { cryptKey } = Crypto.parseKey(keyStr);

    const plaintext = JSON.stringify(sampleKanbanContent);
    const encrypted = Crypto.encrypt(plaintext, cryptKey);

    // Check that no sensitive strings appear in the encrypted output
    sensitiveStrings.forEach(sensitive => {
        const found = encrypted.toLowerCase().includes(sensitive.toLowerCase());
        assert(!found, `Sensitive string "${sensitive}" not visible in encrypted output`);
    });

    // Also check for common JSON patterns that might leak
    assert(!encrypted.includes('"title"'), 'JSON key "title" not visible in encrypted output');
    assert(!encrypted.includes('"body"'), 'JSON key "body" not visible in encrypted output');
    assert(!encrypted.includes('"tags"'), 'JSON key "tags" not visible in encrypted output');
})();

// ---------------------------------------------------------------------------
// Test 3: Different Keys Produce Different Ciphertext
// ---------------------------------------------------------------------------
console.log("\nTest 3: Different Keys Produce Different Ciphertext");
console.log("----------------------------------------------------");

(function testDifferentKeys() {
    const key1Str = Crypto.genKey();
    const key2Str = Crypto.genKey();
    const { cryptKey: key1 } = Crypto.parseKey(key1Str);
    const { cryptKey: key2 } = Crypto.parseKey(key2Str);

    const plaintext = JSON.stringify(sampleKanbanContent);
    const encrypted1 = Crypto.encrypt(plaintext, key1);
    const encrypted2 = Crypto.encrypt(plaintext, key2);

    assert(encrypted1 !== encrypted2, "Same content encrypted with different keys produces different ciphertext");
    assert(key1Str !== key2Str, "Generated keys are unique");
})();

// ---------------------------------------------------------------------------
// Test 4: Same Key, Different Nonces (Randomness)
// ---------------------------------------------------------------------------
console.log("\nTest 4: Same Key, Different Nonces (Randomness)");
console.log("------------------------------------------------");

(function testNonceRandomness() {
    const keyStr = Crypto.genKey();
    const { cryptKey } = Crypto.parseKey(keyStr);

    const plaintext = JSON.stringify(sampleKanbanContent);

    // Encrypt the same content multiple times
    const encryptions = [];
    for (let i = 0; i < 5; i++) {
        encryptions.push(Crypto.encrypt(plaintext, cryptKey));
    }

    // All encryptions should be different (due to random nonces)
    const unique = new Set(encryptions);
    assert(unique.size === 5, "Each encryption produces unique ciphertext (random nonces)");

    // But all should decrypt to the same plaintext
    encryptions.forEach((enc, i) => {
        const dec = Crypto.decrypt(enc, cryptKey);
        assert(dec === plaintext, `Encryption ${i + 1} decrypts correctly`);
    });
})();

// ---------------------------------------------------------------------------
// Test 5: Wrong Key Cannot Decrypt
// ---------------------------------------------------------------------------
console.log("\nTest 5: Wrong Key Cannot Decrypt");
console.log("---------------------------------");

(function testWrongKeyFails() {
    const correctKeyStr = Crypto.genKey();
    const wrongKeyStr = Crypto.genKey();
    const { cryptKey: correctKey } = Crypto.parseKey(correctKeyStr);
    const { cryptKey: wrongKey } = Crypto.parseKey(wrongKeyStr);

    const plaintext = JSON.stringify(sampleKanbanContent);
    const encrypted = Crypto.encrypt(plaintext, correctKey);

    // Decryption with wrong key should fail
    assertThrows(
        () => Crypto.decrypt(encrypted, wrongKey),
        "Decryption with wrong key throws error"
    );

    // Correct key still works
    const decrypted = Crypto.decrypt(encrypted, correctKey);
    assert(decrypted === plaintext, "Correct key still decrypts successfully");
})();

// ---------------------------------------------------------------------------
// Test 6: Tampered Ciphertext Detection
// ---------------------------------------------------------------------------
console.log("\nTest 6: Tampered Ciphertext Detection");
console.log("--------------------------------------");

(function testTamperedCiphertext() {
    const keyStr = Crypto.genKey();
    const { cryptKey } = Crypto.parseKey(keyStr);

    const plaintext = JSON.stringify(sampleKanbanContent);
    const encrypted = Crypto.encrypt(plaintext, cryptKey);

    // Tamper with the ciphertext
    const parts = encrypted.split('|');
    const tamperedCiphertext = parts[0] + '|' + 'X' + parts[1].slice(1);

    assertThrows(
        () => Crypto.decrypt(tamperedCiphertext, cryptKey),
        "Tampered ciphertext throws error on decryption"
    );
})();

// ---------------------------------------------------------------------------
// Test 7: All Kanban Item Fields Are Encrypted
// ---------------------------------------------------------------------------
console.log("\nTest 7: All Kanban Item Fields Are Encrypted");
console.log("---------------------------------------------");

(function testAllFieldsEncrypted() {
    const keyStr = Crypto.genKey();
    const { cryptKey } = Crypto.parseKey(keyStr);

    // Test each item individually
    Object.values(sampleKanbanContent.content.items).forEach(item => {
        const itemJson = JSON.stringify(item);
        const encrypted = Crypto.encrypt(itemJson, cryptKey);

        // Verify title is not visible
        if (item.title) {
            assert(!encrypted.includes(item.title), `Item "${item.id}" title is encrypted`);
        }

        // Verify body is not visible
        if (item.body) {
            assert(!encrypted.includes(item.body.slice(0, 20)), `Item "${item.id}" body is encrypted`);
        }

        // Verify tags are not visible
        if (item.tags) {
            item.tags.forEach(tag => {
                assert(!encrypted.includes(tag), `Item "${item.id}" tag "${tag}" is encrypted`);
            });
        }
    });
})();

// ---------------------------------------------------------------------------
// Test 8: New Custom Fields Are Automatically Encrypted
// ---------------------------------------------------------------------------
console.log("\nTest 8: New Custom Fields Are Automatically Encrypted");
console.log("------------------------------------------------------");

(function testCustomFieldsEncrypted() {
    const keyStr = Crypto.genKey();
    const { cryptKey } = Crypto.parseKey(keyStr);

    // Add a new custom field (simulating adding a feature)
    const contentWithNewField = JSON.parse(JSON.stringify(sampleKanbanContent));
    contentWithNewField.content.items[1].mySecretNewField = "This is super secret data";
    contentWithNewField.content.items[1].anotherCustomField = {
        nested: "nested secret",
        array: ["secret1", "secret2"]
    };

    const plaintext = JSON.stringify(contentWithNewField);
    const encrypted = Crypto.encrypt(plaintext, cryptKey);

    // Verify new fields are not visible
    assert(!encrypted.includes("mySecretNewField"), "New field key not visible");
    assert(!encrypted.includes("super secret data"), "New field value not visible");
    assert(!encrypted.includes("nested secret"), "Nested field value not visible");
    assert(!encrypted.includes("secret1"), "Array values not visible");

    // Verify round-trip preserves new fields
    const decrypted = JSON.parse(Crypto.decrypt(encrypted, cryptKey));
    assert(
        decrypted.content.items[1].mySecretNewField === "This is super secret data",
        "Custom field preserved after round-trip"
    );
    assert(
        decrypted.content.items[1].anotherCustomField.nested === "nested secret",
        "Nested custom field preserved after round-trip"
    );
})();

// ---------------------------------------------------------------------------
// Test 9: Metadata Is Also Encrypted
// ---------------------------------------------------------------------------
console.log("\nTest 9: Metadata Is Also Encrypted");
console.log("-----------------------------------");

(function testMetadataEncrypted() {
    const keyStr = Crypto.genKey();
    const { cryptKey } = Crypto.parseKey(keyStr);

    const plaintext = JSON.stringify(sampleKanbanContent);
    const encrypted = Crypto.encrypt(plaintext, cryptKey);

    // Metadata should also be encrypted
    assert(!encrypted.includes("Q4 Planning Board"), "Document title in metadata is encrypted");
    assert(!encrypted.includes('"metadata"'), "Metadata key not visible");
})();

// ---------------------------------------------------------------------------
// Test 10: Empty/Null Fields Don't Break Encryption
// ---------------------------------------------------------------------------
console.log("\nTest 10: Empty/Null Fields Don't Break Encryption");
console.log("--------------------------------------------------");

(function testEmptyFields() {
    const keyStr = Crypto.genKey();
    const { cryptKey } = Crypto.parseKey(keyStr);

    const contentWithEmptyFields = {
        content: {
            list: ["board1"],
            data: { board1: { id: "board1", title: "", item: [] } },
            items: {
                1: { id: 1, title: "", body: null, tags: [], customField: undefined }
            }
        }
    };

    const plaintext = JSON.stringify(contentWithEmptyFields);
    const encrypted = Crypto.encrypt(plaintext, cryptKey);
    const decrypted = Crypto.decrypt(encrypted, cryptKey);

    assert(encrypted !== plaintext, "Content with empty fields encrypts");

    const parsed = JSON.parse(decrypted);
    assert(parsed.content.items[1].title === "", "Empty string field preserved");
    assert(parsed.content.items[1].body === null, "Null field preserved");
    assert(Array.isArray(parsed.content.items[1].tags) && parsed.content.items[1].tags.length === 0, "Empty array preserved");
})();

// ---------------------------------------------------------------------------
// Test 11: Large Content Encryption
// ---------------------------------------------------------------------------
console.log("\nTest 11: Large Content Encryption");
console.log("----------------------------------");

(function testLargeContent() {
    const keyStr = Crypto.genKey();
    const { cryptKey } = Crypto.parseKey(keyStr);

    // Create a large board with many items
    const largeContent = {
        content: {
            list: [],
            data: {},
            items: {}
        }
    };

    // Add 100 boards with 10 items each
    for (let b = 0; b < 100; b++) {
        const boardId = `board${b}`;
        largeContent.content.list.push(boardId);
        largeContent.content.data[boardId] = {
            id: boardId,
            title: `Board ${b} - Secret Project ${b}`,
            item: []
        };

        for (let i = 0; i < 10; i++) {
            const itemId = b * 10 + i;
            largeContent.content.data[boardId].item.push(itemId);
            largeContent.content.items[itemId] = {
                id: itemId,
                title: `Secret Task ${itemId}`,
                body: `Confidential description for task ${itemId}. `.repeat(10),
                tags: [`secret-${itemId}`, `project-${b}`]
            };
        }
    }

    const plaintext = JSON.stringify(largeContent);
    console.log(`    (Testing with ${plaintext.length} bytes of content)`);

    const startEncrypt = Date.now();
    const encrypted = Crypto.encrypt(plaintext, cryptKey);
    const encryptTime = Date.now() - startEncrypt;

    const startDecrypt = Date.now();
    const decrypted = Crypto.decrypt(encrypted, cryptKey);
    const decryptTime = Date.now() - startDecrypt;

    assert(decrypted === plaintext, "Large content round-trips correctly");
    assert(encryptTime < 1000, `Encryption completes in reasonable time (${encryptTime}ms)`);
    assert(decryptTime < 1000, `Decryption completes in reasonable time (${decryptTime}ms)`);

    // Spot check that content is really encrypted
    assert(!encrypted.includes("Secret Task 500"), "Sample item from large content is encrypted");
})();

// ---------------------------------------------------------------------------
// Test 12: Unicode Content Encryption
// ---------------------------------------------------------------------------
console.log("\nTest 12: Unicode Content Encryption");
console.log("------------------------------------");

(function testUnicodeContent() {
    const keyStr = Crypto.genKey();
    const { cryptKey } = Crypto.parseKey(keyStr);

    const unicodeContent = {
        content: {
            list: ["board1"],
            data: { board1: { id: "board1", title: "日本語ボード 🎯", item: [1] } },
            items: {
                1: {
                    id: 1,
                    title: "机密任务 🔐",
                    body: "Diese Aufgabe ist streng geheim 🇩🇪",
                    tags: ["秘密", "émoji", "Ключ"]
                }
            }
        }
    };

    const plaintext = JSON.stringify(unicodeContent);
    const encrypted = Crypto.encrypt(plaintext, cryptKey);
    const decrypted = Crypto.decrypt(encrypted, cryptKey);

    assert(decrypted === plaintext, "Unicode content round-trips correctly");
    assert(!encrypted.includes("日本語"), "Japanese text is encrypted");
    assert(!encrypted.includes("机密"), "Chinese text is encrypted");
    assert(!encrypted.includes("geheim"), "German text is encrypted");
    assert(!encrypted.includes("Ключ"), "Russian text is encrypted");

    const parsed = JSON.parse(decrypted);
    assert(parsed.content.items[1].title === "机密任务 🔐", "Emoji preserved in title");
})();

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log("\n========================================");
console.log("TEST SUMMARY");
console.log("========================================");
console.log(`  Passed: ${testsPassed}`);
console.log(`  Failed: ${testsFailed}`);
console.log("========================================\n");

if (testsFailed > 0) {
    process.exit(1);
}
