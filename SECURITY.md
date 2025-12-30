<!--
SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors

SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Security Policy

## Supported Versions

Considering the amount of resources necessary to backport security or bug fixes to previous, unsupported CryptPad versions, it's not something we do.
However, we quickly release new minor versions in case of need.

Please keep up with the latest release published here: https://github.com/cryptpad/cryptpad/releases

Note that every GitHub release page has an RSS compatible feed that you can subscribe on to be informed of every new release.

We do also communicate about this topic on:
- [Our blog](https://blog.cryptpad.org)
- [Our Matrix public space](https://matrix.to/#/#cryptpad:matrix.xwiki.com)
- [Our Mastodon account](https://social.xwiki.com/@CryptPad)

## Reporting a Vulnerability

Brefore reaching out about a potential vulnerability, ensure it falls within the scope of our project. Please read thoroughly our [whitepaper](https://blog.cryptpad.org/2023/02/02/Whitepaper/) describing our threat model and what we consider acceptable or not security-wise. If you are sure you found a real vulnerability, you can report it using the GitHub Security interface. You can also send us an email at security@cryptpad.org

## Security Analysis

For detailed information about security alerts, mitigation strategies, and architectural decisions, see [SECURITY_DECISIONS.md](./SECURITY_DECISIONS.md).

### Regular Security Reviews

This project undergoes regular security reviews including:
- Dependabot vulnerability scanning
- CodeQL static analysis
- Manual code review of security-sensitive components

### Known Issues and Mitigations

See [SECURITY_DECISIONS.md](./SECURITY_DECISIONS.md) for:
- Analysis of current security alerts
- Explanation of false positives
- Mitigation strategies for vendor library vulnerabilities
- Architectural security features

