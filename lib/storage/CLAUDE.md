# lib/storage — Server Storage Layer

Filesystem-backed storage for multi-factor auth primitives and session state. Intentionally avoids a relational database — each data type uses the filesystem with a documented naming convention. Designed to be replaceable with a relational DB later without changing calling code.

Each storage type implements the same three-method interface: `read`, `write`, `delete`.

## Files

| File | Purpose |
|------|---------|
| `basic.js` | Shared filesystem read/write/delete primitives using `fs-extra`. Base layer for all other storage modules. |
| `blob.js` | Binary file (blob) storage for encrypted file uploads. Handles chunk storage and deduplication prefix checks. |
| `block.js` | Login block storage: the encrypted credential blobs keyed by Ed25519 public key. |
| `challenge.js` | MFA challenge storage: short-lived challenge tokens for authentication flows. |
| `file.js` | Document history file storage. Encrypted message logs per channel. |
| `invite.js` | Invitation token storage for team invites. |
| `mfa.js` | MFA account settings storage (TOTP secrets, recovery codes — all encrypted client-side before storage). |
| `moderator.js` | Moderation record storage. |
| `sessions.js` | Session token storage for authenticated sessions. |
| `sso.js` | SSO integration token storage. |
| `tasks.js` | Scheduled task queue (expiration, eviction jobs). |
| `user.js` | Per-user storage slot management. |

## Key Pattern

All data stored here is **already encrypted by the client** before transmission. The storage layer is content-blind — it stores and retrieves opaque bytes without any knowledge of what they contain.

Exception: `sessions.js` and `mfa.js` store server-side auth tokens (not user content). These must follow the same access-control rules as any server secret.

## Cross-References

- `lib/commands/block.js` — writes/reads login blocks via `storage/block.js`
- `lib/commands/upload.js` — writes file chunks via `storage/blob.js`
- Root `CLAUDE.md` — Ten Commandments #1 (never store plaintext server-side)
