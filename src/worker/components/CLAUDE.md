# src/worker/components — Worker Shared Components

Lower-level building blocks used by the worker modules. These implement the core data structures and protocols that feature modules compose. They are reused across multiple contexts (user drive, team drives, shared folders).

## Files

| File | Purpose |
|------|---------|
| `roster.js` | Team member list management with role-based permissions (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`). Uses ChainPad for consensus on an encrypted roster channel. Checkpoint interval: 25 operations. |
| `sharedfolder.js` | Shared folder access level logic. Three tiers: View-only (primary key only), Edit (primary + secondary key), Owner (primary + secondary + ownership). Access level is determined by which keys the user possesses. |
| `account.ts` | Account-level operations (TypeScript). |
| `drive.ts` | Drive data structure and operations (TypeScript). |
| `pad.ts` | Pad/document operations (TypeScript). |
| `invitation.js` | Team invitation flow. Generates invite tokens and manages invite acceptance. |
| `mailbox-handlers.js` | Message type handlers for the mailbox system (ADD_OWNER, FRIEND_REQUEST, TEAM_INVITE, etc). |
| `messaging.js` | Low-level messaging primitives shared between messenger and mailbox. |
| `merge-drive.js` | Drive merge operations for account recovery and device sync. |
| `migrate-user-object.js` | User object schema migration for upgrades. |

## Key Patterns

- `roster.js` uses a CHECKPOINT_INTERVAL of 25 and TIMEOUT_INTERVAL of 30s — adjust carefully, these affect consensus performance
- Shared folder access is cryptographic, not server-side: the server never knows which tier a user is in
- Drive operations in `drive.ts` always operate on the proxy object — mutations auto-sync through ChainPad

## Cross-References

- Root `CLAUDE.md` — Teams & Shared Folders section, Role-Based Permissions
- `src/worker/modules/team.js` — composes `roster.js` and `sharedfolder.js`
- `src/common/user-object.js` — drive data structure these components operate on
