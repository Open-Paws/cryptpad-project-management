# scripts/tests — Test Suite

Server-side and integration tests. Includes E2EE-specific tests that verify encryption integrity end-to-end. Run with `node scripts/tests/<test-file>.js`.

## Files

| File | Purpose |
|------|---------|
| `test-kanban-e2ee.js` | **Open Paws addition.** Kanban E2EE test suite. Simulates the full encryption flow: plaintext item data → encrypted message → decryption. Verifies that scoring fields, security tier, assignees, and due dates survive a round-trip through NaCl secretbox. |
| `test-kanban-e2ee-browser.js` | Browser-based variant of the E2EE kanban tests. |
| `test-mailbox.js` | Mailbox send/receive tests including anonymous messaging. |
| `test-metadata.js` | Metadata command tests: ownership, access restriction, allowed-list management. |
| `test-pins.js` | Pin management and quota tracking tests. |
| `test-plan.js` | Scheduled task queue tests. |
| `test-lkh.js` | Last-known-hash tests for reconnection logic. |
| `roster.js` | Team roster integration tests. |
| `index.js` | Test runner entry point. |
| `test-data/` | Static test fixture data. |

## Running Tests

```bash
node scripts/runtests.js            # Full suite
node scripts/tests/test-kanban-e2ee.js   # Kanban E2EE only (fastest)
node scripts/tests/test-metadata.js     # Access control only
```

## Key Pattern — Spec-First for E2EE

`test-kanban-e2ee.js` self-contains the crypto simulation (NaCl secretbox, base64 encoding) without importing from `www/`. This is intentional: tests must be runnable in Node.js without a browser context, and must verify real encryption behavior — not mock it.

Any new Open Paws kanban field added to `inner.js` **must** have a corresponding round-trip test in `test-kanban-e2ee.js` verifying the field survives encryption/decryption intact.

## Cross-References

- `www/kanban/inner.js` — the Open Paws customizations these tests cover
- `lib/crypto.js` — the NaCl wrapper these tests simulate
- Root `CLAUDE.md` — Testing Encryption Integrity checklist
