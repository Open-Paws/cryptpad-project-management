# Claude Code Guidelines for CryptPad Development

This document provides essential rules and patterns for safely modifying CryptPad applications (Kanban, Code, Pad, etc.) without breaking the end-to-end encryption (E2EE) architecture.

## Executive Summary

CryptPad uses **symmetric encryption** (NaCl secretbox) with keys derived from URL hash fragments. The server **never** has access to decryption keys. All document content is encrypted client-side before transmission and stored encrypted on the server. When modifying applications, you must ensure all user data flows through the existing encryption layer - never bypass it or expose plaintext to the server.

---

## Table of Contents

1. [Encryption Architecture Overview](#encryption-architecture-overview)
2. [Multi-User Realtime Collaboration](#multi-user-realtime-collaboration)
3. [Access Control System](#access-control-system)
4. [User Authentication & Login](#user-authentication--login)
5. [Mailboxes & Encrypted Messaging](#mailboxes--encrypted-messaging)
6. [Teams & Shared Folders](#teams--shared-folders)
7. [The User Drive (Proxy Object)](#the-user-drive-proxy-object)
8. [File Structure and Key Components](#file-structure-and-key-components)
9. [The Ten Commandments of CryptPad Development](#the-ten-commandments-of-cryptpad-development)
10. [Practical Patterns for App Development](#practical-patterns-for-app-development)
11. [Testing Encryption Integrity](#testing-encryption-integrity)

---

## Encryption Architecture Overview

### How Keys Work

1. **Key derivation from URL hash**: The URL fragment (after `#`) contains the seed for key derivation
   - Example: `https://cryptpad.example.com/kanban/#/2/kanban/edit/SEED_HERE/`
   - The `SEED_HERE` portion derives all cryptographic keys
   - URL fragments are **never sent to the server** by browsers

2. **Key hierarchy** (from `www/components/chainpad-crypto/crypto.js`):
   ```
   seed (18 bytes base64)
     └── hash = Nacl.hash(seed + password?)
           ├── signKey = hash[0:32] → Nacl.sign.keyPair.fromSeed()
           ├── cryptKey = hash[32:64] → used for Nacl.secretbox
           └── chanId = derived from hash → identifies the channel
   ```

3. **Edit vs View keys**:
   - **Edit key** (`editKeyStr`): Can sign messages (prove authorship) AND decrypt
   - **View key** (`viewKeyStr`): Can only decrypt, cannot sign/write
   - View keys are derived from edit keys, so sharing edit = sharing view

### Hash Versions (from `src/common/common-hash.js`)

CryptPad has evolved through multiple URL hash formats:

| Version | Format | Features |
|---------|--------|----------|
| 0 | `#channelkey` | Legacy, no read-only support |
| 1 | `#/1/mode/channel/key/` | Adds read-only (view) mode |
| 2 | `#/2/type/mode/key/p/` | Adds password protection |
| 3 | `#/3/type/mode/channel/p/` | "Safe links" - channel in hash |
| 4 | `#/4/type/newpad=.../` | Data URLs for new pads |

**Password Protection Flow:**
```javascript
// From common-hash.js - getSecrets()
if (parsed.version === 2 && password) {
    // Password extends the key material
    secret.keys = Crypto.createEditCryptor2(parsed.key, void 0, password);
    // Channel ID changes with password - wrong password = wrong channel
    secret.channel = base64ToHex(secret.keys.chanId);
}
```

### Data Flow (The Golden Path)

```
User Input → App State (plaintext) → JSON.stringify → ChainPad diff
    ↓
ChainPad patches → Framework onLocal() → Crypto.encrypt() → Server
    ↓
Server stores encrypted message (cannot read it)
    ↓
Other clients receive → Crypto.decrypt() → ChainPad merge → App State → UI
```

**Critical**: Applications only interact with **plaintext** JSON. The encryption/decryption happens automatically in the framework layer.

---

## Multi-User Realtime Collaboration

### How Multiple Users Stay in Sync

CryptPad uses **ChainPad** for operational transformation-based conflict resolution. Here's how users collaborate without the server knowing content:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         REALTIME COLLABORATION FLOW                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Client A                    Server                    Client B          │
│  ────────                    ──────                    ────────          │
│                                                                          │
│  1. User types "Hello"                                                   │
│         ↓                                                                │
│  2. ChainPad creates patch                                               │
│     {op: 'insert', pos: 0, text: 'Hello'}                               │
│         ↓                                                                │
│  3. Framework encrypts patch                                             │
│     encrypt(JSON.stringify(patch), cryptKey)                            │
│         ↓                                                                │
│  4. Send to server ─────────► 5. Store encrypted ─────► 6. Broadcast    │
│                                   (no decryption)           │            │
│                                                             ↓            │
│                                                      7. Client receives  │
│                                                         encrypted patch  │
│                                                             ↓            │
│                                                      8. Decrypt patch    │
│                                                             ↓            │
│                                                      9. ChainPad merges  │
│                                                         with local state │
│                                                             ↓            │
│                                                      10. UI updates      │
│                                                          shows "Hello"   │
└──────────────────────────────────────────────────────────────────────────┘
```

### ChainPad Consensus Model

From `www/common/sframe-chainpad-netflux-inner.js`:

```javascript
var makeChainPad = function () {
    var _chainpad = ChainPad.create({
        userName: userName,
        initialState: initialState,
        patchTransformer: patchTransformer,  // Handles conflicts
        validateContent: validateContent,     // Validates merged state
        avgSyncMilliseconds: avgSyncMilliseconds
    });

    // When ChainPad wants to send a message
    _chainpad.onMessage(function(message, cb) {
        // Message is already a patch - framework encrypts it
        sframeChan.query('Q_RT_MESSAGE', message, function (err, obj) {
            cb(err);
        });
    });

    // When ChainPad receives a remote patch
    _chainpad.onPatch(function () {
        onRemote({ realtime: chainpad });  // Notify app of remote change
    });
};
```

**Key concepts:**
- `getUserDoc()` - Returns local document state (what user sees)
- `getAuthDoc()` - Returns authoritative state (after consensus)
- `onSettle()` - Fires when local and auth states match

### Cursor & Presence (Ephemeral Channels)

Cursor positions are shared on **ephemeral channels** (34-char IDs, not stored):

```javascript
// From src/worker/modules/cursor.js
var sendMyCursor = function (ctx, clientId) {
    var data = {
        id: client.id,
        cursor: client.cursor,      // Position in document
        name: displayName,          // User's display name
        color: settings.cursor.color
    };

    // Encrypted with same keys as document
    var cmsg = chan.encryptor.encrypt(JSON.stringify(data));
    chan.wc.bcast(cmsg);  // Broadcast to ephemeral channel
};
```

**Why ephemeral?** Cursor positions are:
- Temporary (no need to persist)
- High-frequency (would bloat history)
- Privacy-sensitive (reveals editing patterns)

---

## Access Control System

### Overview

CryptPad implements access control through **cryptographic ownership** and **metadata signatures**, NOT through server-side content inspection.

### Key Concepts

| Concept | Purpose | Stored Where |
|---------|---------|--------------|
| `owners` | Array of Ed25519 public keys who can modify metadata | Channel metadata (server) |
| `allowed` | Array of public keys who can access restricted channels | Channel metadata (server) |
| `validateKey` | Public key to verify metadata command signatures | Channel metadata (server) |
| `restricted` | Boolean flag enabling access control | Channel metadata (server) |

### How Ownership Works

From `lib/metadata.js`:

```javascript
// Metadata structure stored on server
{
    channel: "abc123...",           // 32-hex channel ID
    validateKey: "Ed25519PubKey",   // For signature verification
    owners: ["pubKey1", "pubKey2"], // Can modify metadata
    allowed: ["pubKey3"],           // Can access if restricted
    restricted: true,               // Access control enabled
    expire: 1234567890,             // Optional expiration timestamp
    mailbox: { "pubKey1": "mailboxChannel" }  // Owner notification channels
}
```

### Access Control Flow (Server Perspective)

From `lib/commands/metadata.js`:

```javascript
Data.setMetadata = function (Env, safeKey, data, cb, Server) {
    var unsafeKey = Util.unescapeKeyCharacters(safeKey);

    Data.getMetadataRaw(Env, channel, function (err, metadata) {
        // Check if user is owner (by public key)
        if (!Core.isOwner(metadata, unsafeKey)) {
            cb('INSUFFICIENT_PERMISSIONS');
            return;
        }

        // Apply metadata command (ADD_OWNERS, RESTRICT_ACCESS, etc.)
        var changed = Meta.handleCommand(metadata, line);

        // Write to metadata log
        Env.msgStore.writeMetadata(channel, JSON.stringify(line), ...);

        // If restricted, kick out non-allowed users
        if (metadata.restricted) {
            const allowed = HK.listAllowedUsers(metadata);
            Server.getChannelUserList(channel).forEach(function (userId) {
                if (!HK.isUserSessionAllowed(allowed, session)) {
                    // Send error and disconnect
                    Server.send(userId, [..., JSON.stringify({error: 'ERESTRICTED'})]);
                }
            });
        }
    });
};
```

### Restricted Document Access Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    RESTRICTED DOCUMENT ACCESS FLOW                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User tries to open restricted document                                  │
│         ↓                                                                │
│  Client sends GET_HISTORY with user's edPublic                          │
│         ↓                                                                │
│  Server checks: Is edPublic in (owners ∪ allowed)?                       │
│         ↓                                                                │
│  ┌─── YES ───┐                      ┌─── NO ───┐                        │
│  │           │                      │          │                         │
│  │  Send     │                      │  Send    │                         │
│  │  metadata │                      │  error:  │                         │
│  │  + history│                      │  {       │                         │
│  │           │                      │    restricted: true,               │
│  │           │                      │    allowed: [...],                 │
│  │           │                      │    rejected: true                  │
│  │           │                      │  }       │                         │
│  └───────────┘                      └──────────┘                         │
│                                                                          │
│  NOTE: Server never sees document content - only checks public keys      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Metadata Commands

From `lib/metadata.js`:

| Command | Purpose | Who Can Execute |
|---------|---------|-----------------|
| `ADD_OWNERS` | Add public keys to owners list | Owners only |
| `RM_OWNERS` | Remove owners | Owners only |
| `RESTRICT_ACCESS` | Enable/disable access control | Owners only |
| `ADD_ALLOWED` | Add users to allowed list | Owners only |
| `RM_ALLOWED` | Remove from allowed list | Owners only |
| `ADD_PENDING_OWNERS` | Invite someone to become owner | Owners only |
| `ADD_MAILBOX` | Set notification channel | Owners only |

### The validateKey

The `validateKey` is an **Ed25519 public key** used to verify that metadata commands came from authorized users:

```javascript
// From hk-util.js - message validation
Env.validateMessage(signedMsg, metadata.validateKey, function (err) {
    // Validates SIGNATURE only, not content
    // Server verifies: "This message was signed by someone with the private key"
    // Server does NOT decrypt or read the content
});
```

**Important**: validateKey is for ACCESS CONTROL, not content encryption. The server:
- CAN verify signatures (proves sender has private key)
- CANNOT decrypt document content
- CANNOT validate patch semantics

---

## User Authentication & Login

### The Block System

User credentials and encrypted drives are stored in **blocks** - encrypted storage units identified by Ed25519 public keys.

From `lib/commands/block.js`:

```javascript
Block.validateLoginBlock = function (Env, publicKey, signature, block, cb) {
    // Convert public key to Uint8Array
    var u8_public_key = Util.decodeBase64(publicKey);
    var u8_signature = Util.decodeBase64(signature);
    var u8_block = Util.decodeBase64(block);

    // Hash the encrypted block content
    var hash = Nacl.hash(u8_block);

    // Verify signature against hash
    var verified = Nacl.sign.detached.verify(hash, u8_signature, u8_public_key);

    if (!verified) { return void cb("E_COULD_NOT_VERIFY"); }
    return void cb(null, block);  // Return still-encrypted block
};
```

### Login Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           USER LOGIN FLOW                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User enters username + password                                      │
│         ↓                                                                │
│  2. Client derives keys using Scrypt:                                    │
│     Scrypt(password, username + serverSalt, 8, 1024, 128)               │
│         ↓                                                                │
│  3. 128 bytes of entropy split into sub-keys:                           │
│     ├── Ed25519 signing keypair seed (32 bytes)                         │
│     ├── Curve25519 encryption keypair seed (32 bytes)                   │
│     ├── Block encryption key (32 bytes)                                 │
│     └── Additional keys for user object                                 │
│         ↓                                                                │
│  4. Derive block ID from Ed25519 public key                             │
│         ↓                                                                │
│  5. Request block from server by ID                                      │
│         ↓                                                                │
│  6. Server returns encrypted block (cannot read it)                      │
│         ↓                                                                │
│  7. Client decrypts block with derived key                              │
│         ↓                                                                │
│  8. Block contains encrypted user drive                                  │
│     (channels, keys, contacts, settings)                                │
│         ↓                                                                │
│  9. User is now "logged in" with access to their drive                  │
│                                                                          │
│  NOTE: Server never sees password or decrypted drive                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Key Types Generated at Login

| Key | Type | Purpose |
|-----|------|---------|
| `edPublic` / `edPrivate` | Ed25519 | Signing metadata commands, proving identity |
| `curvePublic` / `curvePrivate` | Curve25519 | Asymmetric encryption (mailboxes, contacts) |
| Block key | XSalsa20-Poly1305 | Encrypting the user's login block |
| Drive key | XSalsa20-Poly1305 | Encrypting the user's drive content |

---

## Mailboxes & Encrypted Messaging

### How Users Send Encrypted Messages to Each Other

CryptPad uses **asymmetric encryption** (Curve25519) for user-to-user messaging.

From `src/worker/modules/mailbox.js`:

```javascript
var sendTo = Mailbox.sendTo = function (ctx, type, msg, user, cb) {
    // Get sender's Curve25519 keys
    var keys = getMyKeys(ctx);  // { curvePrivate, curvePublic }

    // Create encryptor for recipient
    crypto = Crypto.Mailbox.createEncryptor(keys);

    // Recipient's mailbox channel
    channel = user.channel;

    // Encrypt message with recipient's public key
    // Format: senderPubKey || nonce || box(message, sharedSecret)
    var ciphertext = crypto.encrypt(text, user.curvePublic);

    // Send to server (server stores encrypted, can't read)
    anonRpc.send("WRITE_PRIVATE_MESSAGE", [channel, ciphertext]);
};
```

### Mailbox Message Types

| Type | Purpose |
|------|---------|
| `ADD_OWNER` | Offering pad ownership to another user |
| `RM_OWNER` | Notifying user of ownership removal |
| `REQUEST_PAD_ACCESS` | Requesting edit access to restricted pad |
| `FRIEND_REQUEST` | Contact request |
| `TEAM_INVITE` | Invitation to join a team |

### Anonymous Messaging

Users can send messages without revealing their identity:

```javascript
// From mailbox.js - sendToAnon
Mailbox.sendToAnon = function (anonRpc, type, msg, user, cb) {
    // Generate ephemeral keypair
    var curveSeed = Nacl.randomBytes(32);
    var curvePair = Nacl.box.keyPair.fromSecretKey(curveSeed);

    // Use ephemeral keys for one-time message
    // Recipient can decrypt but doesn't know sender's real identity
    sendTo({
        store: { proxy: {
            curvePrivate: encodeBase64(curvePair.secretKey),
            curvePublic: encodeBase64(curvePair.publicKey)
        }}
    }, type, msg, user, cb);
};
```

---

## Teams & Shared Folders

### Team Architecture

Teams have multiple encrypted channels for different purposes:

```javascript
// Team structure from src/worker/modules/team.js
var team = {
    keys: {
        drive: { channel, keys },     // Shared team drive
        chat: { channel, keys },      // Team chat
        roster: { channel, keys },    // Member list
        mailbox: { channel, keys }    // Team notifications
    },
    metadata: {
        name: "Team Name",            // Encrypted in drive
        avatar: "..."                 // Encrypted in drive
    }
};
```

### Shared Folder Access Levels

From `src/worker/components/sharedfolder.js`:

| Access Level | Has Primary Key | Has Secondary Key | Can Do |
|--------------|-----------------|-------------------|--------|
| View-only | Yes | No | Read content |
| Edit | Yes | Yes | Read + write |
| Owner | Yes | Yes + ownership | Full control |

```javascript
// Access level determined by which keys you have
var secret = Hash.getSecrets('drive', parsed.hash, password);
var secondaryKey = secret.keys.secondaryKey;

if (secondaryKey) {
    // Edit access - can modify shared folder
} else {
    // View-only - can only read
}
```

### Role-Based Permissions

From `src/worker/components/roster.js`:

```javascript
var roles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

var canAddRole = function (author, role, members) {
    var authorRole = members[author].role;

    if (authorRole === 'OWNER') return true;  // Owners can do anything
    if (authorRole === 'ADMIN') {
        // Admins can add ADMIN, MEMBER, VIEWER but not OWNER
        return ['ADMIN', 'MEMBER', 'VIEWER'].includes(role);
    }
    return false;  // Members and viewers can't add roles
};
```

---

## The User Drive (Proxy Object)

### What is the User Drive?

The user drive is an **encrypted JSON object** that stores all of a user's data:

```javascript
// Drive structure from src/common/user-object.js
{
    root: {
        // Folder hierarchy
        "My Documents": {
            "Project A": { ... }
        }
    },
    trash: {
        // Deleted items
    },
    template: [
        // Template pad IDs
    ],
    sharedFolders: {
        "folderId": {
            href: "encrypted_href",  // Encrypted with drive key!
            roHref: "/pad/#/1/view/...",
            password: "if_set"
        }
    },
    [FILES_DATA]: {
        // Pad metadata by ID
        123: {
            href: "encrypted_href",    // Edit link (encrypted!)
            roHref: "/pad/#/view/...", // View link (public)
            title: "Document Title",   // Plaintext in drive (encrypted on server)
            atime: 1234567890,
            ctime: 1234567890
        }
    }
}
```

### Href Encryption in Drive

**Critical**: Edit links (`href`) are encrypted WITHIN the already-encrypted drive:

```javascript
// From user-object.js
var createCryptor = function (key) {
    var cryptor = {};
    var c = Crypto.createEncryptor(key);

    cryptor.encrypt = function (href) {
        // Never encrypt blob (file) hrefs - they're always read-only
        if (href.slice(0,7) === '/file/#') { return href; }
        return c.encrypt(href);
    };

    cryptor.decrypt = function (msg) {
        return c.decrypt(msg);
    };
    return cryptor;
};

// When reading pad data
module.getHref = function (pad, cryptor) {
    if (pad.href && cryptor) {
        // Decrypt the encrypted href
        var decrypted = cryptor.decrypt(pad.href);
        if (decrypted) return decrypted;
    }
    return pad.roHref;  // Fallback to read-only
};
```

**Why double encryption?**
- Drive is encrypted on server with user's keys
- Edit links WITHIN drive are encrypted with drive-specific key
- If someone gets your drive, they still can't access your pads without the additional key

### Drive Synchronization (ChainPad-Listmap)

The drive uses `chainpad-listmap` for realtime sync:

```javascript
// From chainpad-listmap.js
// Creates a Proxy that automatically syncs changes
var proxy = DeepProxy.create(initialState, function onChange() {
    // Any modification to proxy triggers sync
    chainpad.contentUpdate(Sortify(proxy));
});

// Usage in app code:
proxy.root["New Folder"] = {};  // Automatically encrypted and synced
```

---

## File Structure and Key Components

### Encryption Layer Files

| File | Purpose |
|------|---------|
| `www/components/chainpad-crypto/crypto.js` | Core encryption: `encrypt()`, `decrypt()`, key derivation |
| `www/file/file-crypto.js` | File encryption with chunking for uploads |
| `www/common/sframe-chainpad-netflux-outer.js` | Encrypts outgoing messages, decrypts incoming |
| `www/common/sframe-common-outer.js` | Key initialization, creates encryptor from URL hash |
| `lib/hk-util.js` | Server-side history keeper - stores encrypted blobs |

### Access Control Files

| File | Purpose |
|------|---------|
| `lib/metadata.js` | Metadata command handlers (ADD_OWNERS, RESTRICT_ACCESS, etc.) |
| `lib/commands/metadata.js` | Server-side metadata enforcement |
| `lib/commands/core.js` | Core ownership/permission checks |

### User & Authentication Files

| File | Purpose |
|------|---------|
| `lib/commands/block.js` | Login block validation and storage |
| `src/common/common-credential.js` | Scrypt key derivation from password |
| `src/common/common-hash.js` | URL hash parsing, key derivation |
| `src/common/user-object.js` | User drive structure and operations |

### Collaboration Files

| File | Purpose |
|------|---------|
| `www/common/sframe-chainpad-netflux-inner.js` | ChainPad realtime sync coordination |
| `www/components/chainpad-listmap/chainpad-listmap.js` | Proxy-based realtime object sync |
| `src/worker/modules/cursor.js` | Cursor/presence on ephemeral channels |

### Application Files

| File | Purpose |
|------|---------|
| `www/common/sframe-app-framework.js` | Framework that apps use - handles encryption transparently |
| `www/kanban/inner.js` | Kanban app - works with plaintext JSON only |
| `www/code/inner.js` | Code editor app |
| `www/pad/inner.js` | Rich text pad app |

---

## The Ten Commandments of CryptPad Development

### 1. NEVER Add Plaintext Fields to Server-Stored Data

```javascript
// BAD - Server can see the title
msgStruct = [seq, peerId, timestamp, "My Secret Title", encryptedContent];

// GOOD - Everything goes through encryption
const content = { title: "My Secret Title", data: {...} };
const encrypted = Crypto.encrypt(JSON.stringify(content), key);
```

### 2. NEVER Create New Server Endpoints That Accept Plaintext

If you need a new API endpoint, ensure it only receives:
- Channel IDs
- Encrypted blobs
- Public metadata (expiration timestamps, public keys)

```javascript
// BAD - Server receives plaintext search query
padRpc.query('SEARCH_DOCUMENTS', { query: "secret keyword" });

// Server should NEVER have search capability for document contents
```

### 3. ALWAYS Use the Framework's Content System

Applications use `setContentGetter` and `onContentUpdate`:

```javascript
// In your app (e.g., kanban/inner.js)
framework.setContentGetter(function() {
    // Return plaintext object - framework handles encryption
    return {
        boards: kanban.options.boards,
        items: kanban.options.items
    };
});

framework.onContentUpdate(function(newContent) {
    // Receive plaintext object - framework handled decryption
    renderBoards(newContent.boards);
});

// Trigger local changes (framework encrypts and sends)
framework.localChange();
```

### 4. NEVER Store Keys Server-Side or in Cookies

Keys exist only in:
- URL hash fragment (primary)
- Browser memory during session
- User's encrypted drive (if logged in)
- localStorage/IndexedDB on client (encrypted)

```javascript
// BAD
fetch('/api/store-key', { body: JSON.stringify({ key: cryptKey }) });
document.cookie = `padKey=${cryptKey}`;

// Keys are managed automatically by the framework
```

### 5. NEVER Reuse Nonces

Each encryption operation must use a **random** 24-byte nonce:

```javascript
// From crypto.js - this is the correct pattern
var encryptStr = function (str, key) {
    var array = decodeUTF8(str);
    var nonce = Nacl.randomBytes(24);  // RANDOM for each message
    var packed = Nacl.secretbox(array, nonce, key);
    return encodeBase64(nonce) + "|" + encodeBase64(packed);
};

// BAD - Never do this
var staticNonce = new Uint8Array(24);  // Reusing = catastrophic failure
```

### 6. NEVER Validate Content Semantics Server-Side

The server validates **signatures** (for access control), not content:

```javascript
// Server (hk-util.js) - signature validation only
Env.validateMessage(signedMsg, metadata.validateKey, function (err) {
    // This validates the SIGNATURE, not the content
    // Server cannot and should not parse the encrypted content
});

// BAD - Server trying to understand content
if (decryptedPatch.op === 'delete' && decryptedPatch.itemId === 'admin') {
    return reject('Cannot delete admin');  // IMPOSSIBLE - server can't decrypt
}
```

### 7. PRESERVE the Encrypted Message Format

Messages follow this format: `nonce|ciphertext` (base64 encoded)

```javascript
// Encrypted message structure
"WVhaa2MydG1NREl5TXpR...|YWJjZGVmZ2hpamts..."
 ^--- 24-byte nonce (base64)    ^--- ciphertext (base64)

// Checkpoints have a prefix
"cp|CHECKPOINT_ID|WVhaa2...|YWJjZGVm..."
```

### 8. ALWAYS Handle Missing/Invalid Decryption Gracefully

```javascript
// From crypto.js - the correct pattern
var decryptStr = function (str, key) {
    var arr = str.split('|');
    if (arr.length !== 2) { throw new Error(); }  // Invalid format
    var nonce = decodeBase64(arr[0]);
    var packed = decodeBase64(arr[1]);
    var unpacked = Nacl.secretbox.open(packed, nonce, key);
    if (!unpacked) { throw new Error(); }  // Decryption failed (wrong key)
    return encodeUTF8(unpacked);
};

// In your app - handle gracefully
try {
    const content = JSON.parse(decryptedData);
} catch (e) {
    // Don't crash - show error UI
    console.error('Failed to parse content');
}
```

### 9. NEVER Log Encrypted Content on Server

```javascript
// BAD - Even encrypted content shouldn't be logged verbatim
Log.debug('Received message: ' + encryptedMsg);

// GOOD - Log only metadata
Log.debug('Received message', {
    channel: channelId,
    length: encryptedMsg.length,
    isCheckpoint: /^cp\|/.test(encryptedMsg)
});
```

### 10. NEVER Send Unencrypted Metadata to Server

All user-generated content must be encrypted:

```javascript
// BAD - Tags are readable by server
{
    encryptedContent: "abc123...",
    tags: ["personal", "secret-project"],  // EXPOSED
    owner: "user@email.com"  // EXPOSED
}

// GOOD - Everything in the encrypted blob
{
    // This entire object gets encrypted
    content: "...",
    tags: ["personal", "secret-project"],
    metadata: { ... }
}
```

---

## Practical Patterns for App Development

### Adding a New Field to an App (e.g., Kanban)

When adding a new field to items or boards:

```javascript
// In kanban/inner.js

// 1. Define the field in PROPERTIES if it should be saved
var PROPERTIES = ['title', 'body', 'tags', 'color', 'yourNewField'];

// 2. Handle it in the content getter/setter
var getContent = function() {
    return {
        boards: kanban.options.boards,
        // All of this gets encrypted automatically
    };
};

// 3. Render it in the UI
var renderItem = function(item) {
    // item.yourNewField is decrypted plaintext
    $item.find('.new-field').text(item.yourNewField);
};

// 4. Save changes through the framework
$input.on('change', function() {
    item.yourNewField = $(this).val();
    framework.localChange();  // Triggers encryption + sync
});
```

### Adding New Encrypted Metadata

```javascript
// Metadata is stored in the content object
var content = {
    boards: { ... },
    items: { ... },
    metadata: {
        // Add new metadata here - it's all encrypted
        customSetting: true,
        createdAt: Date.now()
    }
};
```

### Working with Access Control

```javascript
// To add someone to allowed list (client-side)
common.setPadAttribute('allowed', [...currentAllowed, newUserPubKey], function(err) {
    // This sends a signed ADD_ALLOWED command to server
});

// To check if current user is owner
var isOwner = common.isOwner(metadata.owners, common.getMetadata().priv.edPublic);
```

### Sending User-to-User Messages

```javascript
// Get recipient's mailbox info from their profile
var recipient = {
    channel: recipientMailboxChannel,
    curvePublic: recipientCurvePublic
};

// Send encrypted notification
Mailbox.sendTo(ctx, 'SHARE_PAD', {
    href: padHref,
    title: padTitle
}, recipient, function(err) {
    // Message sent and encrypted with recipient's key
});
```

### File Uploads

Files use chunked encryption with incrementing nonces:

```javascript
// From file-crypto.js - the correct chunking pattern
var encrypt = function (u8, metadata, key) {
    var nonce = createNonce();  // Starts at zero

    // Encrypt metadata first
    var metaBox = Nacl.secretbox(metaBytes, nonce, key);
    increment(nonce);  // MUST increment

    // Encrypt each chunk
    for (var i = 0; i < chunks.length; i++) {
        var box = Nacl.secretbox(chunks[i], nonce, key);
        increment(nonce);  // MUST increment for each chunk
    }
};
```

---

## What the Server Can See (And Cannot See)

### Server CAN See:
- Channel IDs (32 hex characters)
- Message timestamps
- Message sizes
- Who is connected (netflux IDs, not identities)
- Checkpoint markers (`cp|ID|...`)
- Encrypted blob prefixes (first 64 chars for deduplication)
- File sizes
- Access control metadata (owners/allowed as public keys)
- Metadata command signatures

### Server CANNOT See:
- Document content
- User display names (in document)
- Search queries
- Tags
- File names (encrypted in metadata)
- What type of content is in a document
- Any user-generated text
- Passwords
- Encryption keys

---

## Testing Encryption Integrity

When modifying apps, verify:

1. **Network tab inspection** - no plaintext in requests
2. **localStorage check** - keys stored encrypted (if logged in)
3. **Server log inspection** - no readable content
4. **View-only link test** - cannot edit
5. **Wrong password test** - cannot decrypt
6. **Different user test** - cannot access restricted content

```javascript
// Debug helper - add to console
window.CryptPad_debug = {
    showEncrypted: function() {
        // This should show encrypted blobs, never plaintext
        return cpNfInner.chainpad.getAuthDoc();
    },
    showKeys: function() {
        // Show current encryption keys (for debugging only!)
        return window.CryptPad.secret;
    }
};
```

---

## Common Mistakes to Avoid

### Mistake 1: Adding Server-Side Search

```javascript
// WRONG - This breaks E2EE
app.get('/search', (req, res) => {
    const query = req.query.q;
    // Server searches document contents - IMPOSSIBLE with E2EE
});
```

### Mistake 2: Exposing Titles for "Recent Documents"

```javascript
// WRONG - Title should be in encrypted drive
{
    channel: "abc123",
    title: "Q4 Financial Report"  // Server can see this!
}

// RIGHT - Title only in user's encrypted drive
// Server only knows channel ID
```

### Mistake 3: Caching Plaintext Server-Side

```javascript
// WRONG
cache[channelId] = decryptedContent;  // Server has plaintext!

// Server only caches encrypted blobs and public metadata
```

### Mistake 4: Bypassing Access Control

```javascript
// WRONG - Checking ownership client-side only
if (clientSideOwnerCheck) {
    allowDelete();
}

// RIGHT - Server enforces via signed metadata commands
// Client can only REQUEST, server VERIFIES signature
```

### Mistake 5: Storing Keys in URL Parameters

```javascript
// WRONG - Server can see query parameters
https://cryptpad.example.com/pad/?key=abc123

// RIGHT - Keys in hash fragment (never sent to server)
https://cryptpad.example.com/pad/#/2/pad/edit/abc123/
```

---

## Architecture Diagrams

### Complete Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        CRYPTPAD DATA FLOW                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  URL: /kanban/#/2/kanban/edit/u5ACvxAYmhvG0FtrNn9FJQcf/                  │
│                                      ↓                                   │
│                          Hash Fragment (never sent to server)            │
│                                      ↓                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    CLIENT-SIDE KEY DERIVATION                       │ │
│  │                                                                     │ │
│  │  seed = "u5ACvxAYmhvG0FtrNn9FJQcf"                                 │ │
│  │    ↓                                                                │ │
│  │  hash = Nacl.hash(seed + password)  // 64 bytes                    │ │
│  │    ├── signKey = hash[0:32]  → Ed25519 keypair                     │ │
│  │    ├── cryptKey = hash[32:64] → XSalsa20-Poly1305                  │ │
│  │    └── chanId = derive(hash) → "abc123def456..."                   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                      ↓                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      APPLICATION LAYER                              │ │
│  │                                                                     │ │
│  │  kanban/inner.js                                                   │ │
│  │    │                                                                │ │
│  │    ├── User edits board (plaintext JSON)                           │ │
│  │    │   { boards: {...}, items: {...} }                             │ │
│  │    │                                                                │ │
│  │    └── framework.localChange()                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                      ↓                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      ENCRYPTION LAYER                               │ │
│  │                                                                     │ │
│  │  sframe-chainpad-netflux-outer.js                                  │ │
│  │    │                                                                │ │
│  │    ├── ChainPad creates patch                                      │ │
│  │    │                                                                │ │
│  │    └── Crypto.encrypt(patch, cryptKey)                             │ │
│  │        → "nonce|ciphertext"                                        │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                      ↓                                   │
│  ════════════════════════════ NETWORK ══════════════════════════════════ │
│                                      ↓                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      SERVER (NO KEYS)                               │ │
│  │                                                                     │ │
│  │  lib/hk-util.js                                                    │ │
│  │    │                                                                │ │
│  │    ├── Receives: [seq, peerId, timestamp, "nonce|ciphertext"]     │ │
│  │    │                                                                │ │
│  │    ├── Validates signature (if restricted channel)                 │ │
│  │    │   Uses validateKey - does NOT decrypt content                 │ │
│  │    │                                                                │ │
│  │    ├── Stores encrypted message as-is                              │ │
│  │    │                                                                │ │
│  │    └── Broadcasts to other clients (still encrypted)               │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Access Control Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     ACCESS CONTROL ARCHITECTURE                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  METADATA (Stored on Server, Not Encrypted)                              │
│  ───────────────────────────────────────────                             │
│  {                                                                       │
│    channel: "abc123...",                                                 │
│    validateKey: "Ed25519PubKey",    ← For signature verification         │
│    owners: ["pubKey1", "pubKey2"],  ← Can modify metadata               │
│    allowed: ["pubKey3"],            ← Can access if restricted          │
│    restricted: true,                ← Access control enabled            │
│    mailbox: {...}                   ← Owner notification channels       │
│  }                                                                       │
│                                                                          │
│  OWNERSHIP VERIFICATION                                                  │
│  ─────────────────────────                                               │
│                                                                          │
│  User wants to add someone to allowed list:                              │
│                                                                          │
│  1. Client creates command:                                              │
│     ["ADD_ALLOWED", ["newUserPubKey"], timestamp]                       │
│                                                                          │
│  2. Client signs command with Ed25519 private key                        │
│                                                                          │
│  3. Server receives signed command                                       │
│                                                                          │
│  4. Server checks:                                                       │
│     - Is sender's pubKey in owners[]? ← If no, reject                   │
│     - Is signature valid? ← Uses validateKey                            │
│                                                                          │
│  5. If valid, server updates metadata and broadcasts                     │
│                                                                          │
│  NOTE: Server NEVER decrypts document content                           │
│        Access control is based on PUBLIC KEYS only                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Summary Checklist

Before submitting changes, verify:

- [ ] No plaintext sent to server endpoints
- [ ] All user content goes through framework encryption
- [ ] No new server-side decryption
- [ ] No keys stored outside URL hash/user drive
- [ ] No plaintext metadata added to messages
- [ ] Nonces are random, never reused
- [ ] Graceful handling of decryption failures
- [ ] No server-side content validation
- [ ] Console logging doesn't expose secrets
- [ ] Tests pass with view-only and edit access
- [ ] Access control changes use signed metadata commands
- [ ] User-to-user messages use asymmetric encryption
- [ ] No bypassing of ownership checks

---

## Additional Resources

- `docs/ARCHITECTURE.md` - Overall CryptPad architecture
- [TweetNaCl documentation](https://tweetnacl.js.org/) - The encryption library used
- [ChainPad documentation](https://github.com/xwiki-contrib/chainpad) - Realtime collaboration algorithm
- `lib/metadata.js` - Metadata command reference
- `src/common/common-hash.js` - Hash version and key derivation reference
