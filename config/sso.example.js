// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// IMPORTANT: Migration notes for @node-saml/node-saml v5.x
// If upgrading from v4.x, the following breaking changes apply:
// - 'cert' has been renamed to 'idpCert'
// - 'signingCert' has been renamed to 'publicCert'
// - 'path', 'protocol', and 'host' options have been removed - use 'callbackUrl' directly
// - 'issuer' is now REQUIRED
// - 'audience' is now REQUIRED
// - Node.js 18+ is required
// See: https://github.com/node-saml/node-saml/releases/tag/v5.0.0

//const fs = require('node:fs');
module.exports = {
    // Enable SSO login on this instance
    enabled: false,
    // Block registration for non-SSO users on this instance
    enforced: false,
    // Allow users to add an additional CryptPad password to their SSO account
    cpPassword: false,
    // You can also force your SSO users to add a CryptPad password
    forceCpPassword: false,
    // List of SSO providers
    list: [
    /*
    {
        name: 'google',
        type: 'oidc',
        url: 'https://accounts.google.com',
        client_id: "{your_client_id}",
        client_secret: "{your_client_secret}",
        jwt_alg: 'RS256' (optional)
    }, {
        name: 'samltest',
        type: 'saml',
        url: 'https://samltest.id/idp/profile/SAML2/Redirect/SSO',
        issuer: 'your-cryptpad-issuer-id',         // REQUIRED in v5.x
        audience: 'your-cryptpad-audience',        // REQUIRED in v5.x
        callbackUrl: 'https://your-cryptpad-instance.com/sso/saml/callback',  // REQUIRED in v5.x (replaces path/protocol/host)
        idpCert: fs.readFileSync("./your/idp/cert/location", "utf-8"),       // renamed from 'cert' in v5.x
        privateKey: fs.readFileSync("./your/private/key/location", "utf-8"),
        publicCert: fs.readFileSync("./your/signing/cert/location", "utf-8"), // renamed from 'signingCert' in v5.x
    }
    */
    ]
};

