# lib/commands — Server-Side Command Handlers

Node.js modules handling authenticated RPC commands from clients. The server never decrypts document content — it only processes metadata, access control, and storage operations on encrypted blobs and public keys.

All commands validate **signatures** (proving the sender holds a private key), never content. See the root `CLAUDE.md` Ten Commandments for the full list of server-side restrictions.

## Files

| File | Purpose |
|------|---------|
| `metadata.js` | Metadata command enforcement: `ADD_OWNERS`, `RM_OWNERS`, `RESTRICT_ACCESS`, `ADD_ALLOWED`, `RM_ALLOWED`, `ADD_PENDING_OWNERS`, `ADD_MAILBOX`. Checks ownership via Ed25519 public key, writes to metadata log, kicks non-allowed users on restriction changes. |
| `core.js` | Core ownership and permission checks: `isOwner()`, `isValidId()`. Shared by all other command handlers. |
| `block.js` | Login block validation and storage. Validates Ed25519 signature over the encrypted block hash. Server never decrypts the block. |
| `channel.js` | Channel creation, history retrieval, and channel operations. |
| `pin-rpc.js` | Pin management RPC: track which channels a user has pinned for quota enforcement. |
| `quota.js` | Storage quota enforcement per user/team. |
| `upload.js` | File upload handling. Chunks are received pre-encrypted from the client. |
| `users.js` | User account operations. |
| `admin-rpc.js` | Admin-only operations. Requires admin Ed25519 key. |
| `invitation.js` | Team invitation token management. |
| `moderators.js` | Moderation commands (report handling). |

## Key Pattern

Every command handler follows the same structure:
1. Validate the channel/block ID is well-formed
2. Check signature against the stored `validateKey`
3. Apply the operation (metadata update, storage write, etc.)
4. Never inspect or return decrypted content

## Cross-References

- Root `CLAUDE.md` — Access Control System, Metadata Commands table
- `lib/metadata.js` — metadata state machine (command log format)
- `lib/hk-util.js` — history keeper that routes messages to these handlers
