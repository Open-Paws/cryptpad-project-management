# src/common — Shared Client Utilities

Client-side utilities shared between the main thread and the worker. These are the building blocks for key derivation, credential handling, drive structure, and realtime sync. Most of this is upstream CryptPad code — do not modify without understanding the E2EE implications documented in the root `CLAUDE.md`.

## Files

| File | Purpose |
|------|---------|
| `common-hash.js` | URL hash parsing and key derivation. Parses all 5 hash versions (v0-v4). `getSecrets()` derives all cryptographic keys from a URL hash seed. Never modify without reviewing the hash version table in root `CLAUDE.md`. |
| `common-credential.js` | Scrypt key derivation from username + password. Produces 128 bytes of entropy split into Ed25519 + Curve25519 + block keys. The server never sees the password. |
| `user-object.js` | User drive structure: root folder hierarchy, trash, templates, shared folders, `FILES_DATA`. Edit hrefs (`href`) are double-encrypted within the already-encrypted drive. |
| `user-object-setter.js` | Mutation helpers for the user object proxy. |
| `common-util.js` | General utility functions shared across client and worker. |
| `common-constants.js` | Shared constants (channel lengths, magic values). |
| `common-realtime.js` | Realtime sync helpers. |
| `common-signing-keys.js` | Ed25519 signing key utilities. |
| `common-feedback.js` | Anonymous usage feedback (opt-in). |
| `cryptget.js` | Single-use document fetch: retrieves and decrypts a pad without establishing a persistent channel. |
| `pad-types.js` | Pad type definitions and feature flags. |
| `proxy-manager.js` | Manages ChainPad proxy objects for drive and team drives. |
| `rpc.js` | Client-side RPC to the server. |
| `notify.js` | Notification dispatch. |
| `pinpad.js` | Pin management for billing/quota tracking. |
| `network-config.js` | Netflux network configuration. |
| `events-channel.js` | Cross-frame event bus. |
| `recurrence.js` | Calendar recurrence rule parsing. |
| `onlyoffice/` | OnlyOffice integration utilities. |
| `outer/` | Outer frame utilities. |

## Security-Critical Files

These files directly implement the cryptographic foundation. Any modification requires a full security review:

- **`common-hash.js`** — changing key derivation breaks all existing pads for all users
- **`common-credential.js`** — changing Scrypt parameters locks out all existing accounts
- **`user-object.js`** — double-encryption of hrefs is a deliberate security property; do not flatten

## Cross-References

- Root `CLAUDE.md` — User Authentication & Login, The User Drive (Proxy Object), Hash Versions table
- `lib/commands/block.js` — server-side counterpart to `common-credential.js`
- `src/worker/modules/` — modules that consume these utilities
