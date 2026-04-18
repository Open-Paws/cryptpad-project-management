# AGENTS.md — cryptpad-project-management

## Summary

This is an end-to-end encrypted project management tool built as a fork of [CryptPad](https://github.com/cryptpad/cryptpad). Open Paws customizations extend the upstream Kanban board application with a ten-dimension strategic scoring system, three-tier security classification (T1/T2/T3), timeline and personal task views, assignee management, dependency tracking, and T3-item redaction on export. All customizations live in `www/kanban/`. Upstream CryptPad handles encryption, real-time collaboration, access control, and all other application types (Docs, Sheets, Whiteboard, etc.) without modification. The server never has access to decryption keys or document content — all cryptographic operations happen client-side using NaCl secretbox.

---

## Status

**🟢 Production** — Active operational tool. Deployed at `https://cryptpaws.openpaws.ai`. Stores Tier 3 data (investigation planning, witness coordination, legal defense notes). Treat all encryption-related changes as security-critical.

**Change implications of this status:**
- Do not merge features that add server-side content access under any circumstances
- Upstream sync requires a dedicated review branch and functional verification before merging to main
- Breaking the export T3 redaction is a data confidentiality incident

---

## Key Files

### Open Paws Customizations (fork-specific)

| File | Purpose |
|------|---------|
| `www/kanban/inner.js` | Primary customization layer. Strategic scoring (10 dimensions), security tier filtering, assignee management, Timeline view, My Tasks view, dependency tracking, T3 redaction. ~300 KB — the largest single file in the fork. |
| `www/kanban/jkanban_cp.js` | CryptPad fork of jKanban board renderer. DST-safe date arithmetic (`parseDateLocal`, `toDayNumber`), relative due-date formatting, Dragula drag-and-drop. |
| `www/kanban/export.js` | CryptDrive bulk export handler. Strips T3 items before export via `redactT3Items()`. Intentionally self-contained with no imports for reliability in the export pipeline. |
| `www/kanban/CLAUDE.md` | Kanban-specific development guide. Read before touching `www/kanban/`. |
| `CLAUDE.md` | Root development guide. Contains the Ten Commandments of CryptPad Development — inviolable rules for preserving E2EE. |
| `SECURITY_DECISIONS.md` | Security audit log. Documents resolved CVEs, false positives, and accepted risks. |
| `docker-compose.yml` | Deployment configuration. Domains, ports, volume mounts. |
| `config/config.example.js` | Server configuration template. |
| `customize/translations/` | Custom translation overrides. |

### Upstream CryptPad (do not modify without security review)

| File/Directory | Purpose |
|---|---|
| `lib/` | Server-side: history keeper, metadata, access control, block storage |
| `lib/hk-util.js` | History keeper — stores encrypted blobs, validates signatures, never decrypts |
| `lib/metadata.js` | Access control command handlers (ADD_OWNERS, RESTRICT_ACCESS, etc.) |
| `lib/crypto.js` | Core encryption: NaCl secretbox, key derivation, signature verification |
| `www/common/sframe-chainpad-netflux-outer.js` | Encryption layer: encrypts outgoing, decrypts incoming |
| `www/common/sframe-app-framework.js` | App framework used by all editors — wraps encryption transparently |
| `src/common/common-hash.js` | URL hash parsing, key derivation from URL fragments |
| `server.js` | Entry point |

---

## Deploy Commands

```bash
# Production (Docker Compose)
docker compose up -d

# View logs
docker compose logs -f cryptpad

# Restart after config change
docker compose restart cryptpad

# Development (local Node.js)
npm install
npm run install:components
npm run dev         # DEV=1 node server.js

# Lint
npm run lint

# Build assets
npm run build
```

**Required environment variables (via docker-compose.yml):**

| Variable | Value |
|----------|-------|
| `CPAD_MAIN_DOMAIN` | `https://cryptpaws.openpaws.ai` |
| `CPAD_SANDBOX_DOMAIN` | `https://cryptbox.openpaws.ai` |
| `CPAD_CONF` | `/cryptpad/config/config.js` |

**Ports (host → container):**

| Host | Container | Service |
|------|-----------|---------|
| 3002 | 3000 | Main application (HTTP) |
| 3001 | 3001 | WebSocket |
| 3005 | 3003 | Sandbox domain |

---

## Architecture Decisions

### Why CryptPad

Animal advocacy organizations face three adversaries: state surveillance via ag-gag statutes and subpoenas, industry infiltration through corporate investigators, and data breaches. CryptPad's zero-knowledge model means the server operator cannot comply with a subpoena for document contents because the server does not have them. No other collaboration tool with real-time multi-user editing provides this guarantee.

### Encryption Model

CryptPad uses NaCl secretbox (XSalsa20-Poly1305) with keys derived from the URL hash fragment. Hash fragments are never sent to servers by browsers. The key hierarchy (from `lib/crypto.js`):

```
seed (18 bytes base64 from URL)
  └── hash = Nacl.hash(seed + optional-password)
        ├── signKey  = hash[0:32]  → Ed25519 keypair (signs metadata commands)
        ├── cryptKey = hash[32:64] → XSalsa20-Poly1305 (encrypts content)
        └── chanId   = derive(hash) → identifies the server channel
```

The server sees channel IDs and encrypted blobs. It validates Ed25519 signatures for access control commands but never decrypts content.

### What Was Customized and Why

The upstream Kanban is a general-purpose board. Open Paws needed:

1. **Strategic prioritization** — campaign work spans many projects; a scoring system surfaces the highest-leverage work. Ten dimensions were chosen to cover scale, depth, longevity, and movement-building value.
2. **Security tiering** — investigation planning (T3) must never appear in exports or default views due to legal risk. Tier filtering is built into the board, not bolted on later.
3. **Timeline and personal task views** — coordination across many simultaneous campaigns requires both a project-level Gantt view and a personal task view.
4. **Dependency tracking** — projects have prerequisites; dependency IDs enable that graph.

All of this is implemented as plaintext JSON manipulation in `inner.js`. The CryptPad framework handles encryption transparently.

### Encryption Domain Sovereignty (2026-03-28)

CryptPad's NaCl secretbox and Matrix's Megolm are structurally incompatible encryption systems. A proxy re-encryption bridge would require a server that holds keys for both — destroying the zero-knowledge property. This decision is settled: all content crossing between CryptPad and other systems must be a deliberate human action at the application layer. No automated bridges.

### SSO Constraint

If SSO is enabled, `forceCpPassword: true` is mandatory. Without it, the SSO provider's session token becomes a de facto decryption key proxy — a server that can decrypt documents exists, which defeats the threat model against subpoena.

---

## Integration Points

| System | Integration | Notes |
|--------|-------------|-------|
| NGINX | Reverse proxy | Terminates SSL, proxies to ports 3002/3001/3005 |
| Let's Encrypt | TLS certificates | Two certificates required (main domain + sandbox domain) |
| CryptPad upstream | Git fork | Customizations in `www/kanban/` only; sync via `git merge upstream/main` |
| Matrix | None (intentional) | Keys must never appear in Matrix widget state events; use pinned message links only |
| Open Paws platform | None (intentional) | CryptPad is encryption-domain sovereign; no automated data extraction |

---

## Safe vs Risky Changes

### Safe

- UI text changes in `customize/translations/`
- CSS changes in `www/kanban/app-kanban.less`
- Adding or renaming scoring dimensions in `inner.js` (the `scoringDimensions` array at module level)
- Adding new filter or sort options that operate on existing item fields
- Updating `docker-compose.yml` resource limits
- Dependency updates for non-cryptographic packages when Dependabot flags them

### Requires Care

- Any change to `www/kanban/inner.js` — verify `framework.localChange()` is always the write path
- Adding new item fields — fields not in the content object will not be encrypted and synced
- Upstream CryptPad sync — always merge to a review branch, check the kanban diff, verify T3 redaction

### High Risk (security review required before merge)

- Any change to `lib/crypto.js`, `lib/hk-util.js`, `lib/metadata.js`
- Any change to `www/common/sframe-chainpad-netflux-outer.js` or `sframe-app-framework.js`
- Any change to `server.js` that adds new HTTP endpoints
- Any change to `www/kanban/export.js` — T3 redaction must be verified
- SSO configuration changes
- Adding any form of server-side content reading, caching, or logging

### Never Do

- Add a server endpoint that accepts or returns plaintext document content
- Log encrypted message content on the server (even encrypted blobs should not be logged verbatim)
- Store encryption keys outside URL hash fragments or user's encrypted drive
- Reuse nonces in any encryption operation
- Add a Matrix widget or bridge that would place CryptPad keys in Matrix state events

---

## TODOs

- [ ] Upstream sync review: check for kanban changes in cryptpad/cryptpad since the last merge
- [ ] Verify `forceCpPassword: true` is set in the deployed SSO config
- [ ] Add characterization tests for T3 redaction in `export.js` before the next upstream sync
- [ ] Document the NGINX configuration (SSL termination, CSP headers, two-domain setup) in `docs/`
- [ ] Evaluate `toggle-array` transitive dependency (CVE-2025-57328, CVSS 2.9) — no fix available; monitor
- [ ] Consider moving scoring dimensions to a shared config file so `inner.js` and `www/kanban/CLAUDE.md` stay in sync automatically
