# src/worker/modules — Worker Feature Modules

Feature modules running inside the shared worker. Each module owns a specific domain of functionality. They communicate with the main thread through the store RPC interface (`src/worker/core/store-rpc.js`) and share state via the proxy manager.

All data handled here is **plaintext** from the worker's perspective — encryption and decryption happen at the framework layer before data reaches these modules.

## Files

| File | Purpose |
|------|---------|
| `cursor.js` | Cursor position sharing over ephemeral channels. Broadcasts cursor/presence data encrypted with the same key as the document. Ephemeral channel IDs are 34 chars (never stored). |
| `mailbox.js` | Encrypted user-to-user messaging using Curve25519 asymmetric encryption. Handles notifications, support-team messages, and admin broadcast channel. Includes anonymous messaging via ephemeral keypairs. |
| `team.js` | Team management: shared drive, chat, roster, and mailbox channels. Handles password changes on shared folders and team key rotation. |
| `messenger.js` | Real-time chat between contacts. Builds on mailbox infrastructure. |
| `history.js` | Document history and version management. |
| `profile.js` | User profile data: display name, avatar, public curve key for contact discovery. |
| `calendar.js` | Calendar app data management. |
| `badge.ts` | Badge/achievement tracking (TypeScript). |
| `integration.js` | Integration with external tools (OnlyOffice etc). |
| `support.js` | Support ticket communication between users and admins. |
| `onlyoffice.js` | OnlyOffice document collaboration integration. |
| `test.ts` | Module-level tests (TypeScript). |

## Key Patterns

- Modules receive a `ctx` (context) object containing the store, proxy, and network primitives
- Use `Util.mkEvent()` for internal pub/sub — never shared global state
- Ephemeral channels (34-char IDs) are used for presence/cursor — never stored, never historied
- `sendTo` / `sendToAnon` in `mailbox.js`: anonymous messaging uses a fresh Nacl keypair per message, hiding sender identity

## Security Notes

- Mailbox messages are encrypted with the **recipient's** Curve25519 public key — the server cannot read them
- Team roster is stored in its own encrypted channel, separate from team content
- Support messages route through the admin broadcast channel (`000000000000000000000000000000000`)

## Cross-References

- Root `CLAUDE.md` — Mailboxes & Encrypted Messaging section, Teams & Shared Folders section
- `src/worker/components/` — lower-level primitives these modules compose
- `src/worker/core/store-rpc.js` — RPC layer these modules expose to the main thread
