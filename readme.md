<!--
SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors

SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Open Paws Project Management Tool

**An end to end ecnrypted specialized project management tool for animal advocacy organizations with high security requirements**

This is a customized version of CryptPad that adds powerful project management features specifically designed for animal advocacy organizations. We've enhanced CryptPad's Kanban board with strategic project scoring, assignment management, due dates, and advanced filtering capabilities.

## 🎯 Open Paws Enhancements

**What we've added to CryptPad's Kanban:**

### **Strategic Project Scoring System**
- **10-dimension scoring framework** designed for advocacy impact assessment:
  - Scale - Potential reach and scope
  - Impact Magnitude - Depth of change potential  
  - Longevity - Long-term sustainability
  - Multiplication - Ability to inspire similar efforts
  - Foundation - Building movement infrastructure
  - AGI-Readiness - Future-proofing for technological change
  - Accessibility - Ease of participation and adoption
  - Coalition Building - Cross-movement collaboration potential
  - Pillar Coverage - Impact across transformation areas
  - Build Feasibility - Development and implementation speed
- **Automatic score calculation** with visual priority indicators on cards
- **Fully encrypted** - all scoring data uses CryptPad's native storage

### **Advanced Project Management Features**
- **Assignee management** - assign multiple team members per project
- **Due date tracking** - visual indicators and deadline management
- **Advanced filtering and sorting** - filter by assignee, score ranges, and due dates
- **Real-time collaboration** - multiple users can score and assign projects simultaneously

### **Recent Stability Improvements (December 2024)**
We've fixed 11 bugs to significantly improve the collaborative editing experience:
- **Modal editing stability** - assignee, color, scoring, and date fields no longer lose focus during remote updates
- **Task checkbox reliability** - eliminated visual flickering when multiple users toggle checkboxes
- **Timeline accuracy** - fixed off-by-one date calculations and drag positioning
- **Memory leak fixes** - proper cleanup of event handlers prevents performance degradation
- **Crash prevention** - null checks on scroll operations prevent errors
- **Filter indicator** - now correctly shows when status filters are active
- **UI polish** - fixed compact mode toggle titles and internationalized empty states

## 🔐 Built on CryptPad's Foundation

**Everything else is standard CryptPad** - you get all of CryptPad's powerful collaboration tools (Documents, Sheets, Presentations, Forms, Code editor, Whiteboard) with the same end-to-end encryption and security. Our enhancements are fully integrated and encrypted using CryptPad's native data storage.

![Drive screenshot](screenshot.png "preview of the CryptDrive")

![Suite screenshots](screenshot-suite.png "CryptPad applications: Document, Sheet, Presentation, Form, Enhanced Kanban, Code, Rich Text, Whiteboard")

# Installation

## For development

The CryptPad [developer guide](https://docs.cryptpad.org/en/dev_guide/setup.html) provides instructions for setting up a local instance without HTTPS or more advanced security features.

## For production

Configuring CryptPad for production requires additional steps. Refer to CryptPad's [admin installation guide](https://docs.cryptpad.org/en/admin_guide/installation.html) for production-related instructions, customization, and maintenance details.

## Current version

The most recent version and all past release notes can be found on the [releases page on GitHub](https://github.com/cryptpad/cryptpad/releases/).

## Setup using Docker

You can find `Dockerfile`, `docker-compose.yml` and `docker-entrypoint.sh` files at the root of this repository. CryptPad also publishs every release on [Docker Hub](https://hub.docker.com/r/cryptpad/cryptpad) as AMD64 & ARM64 official images.

Previously, Docker images were community maintained, had their own repository and weren't official supported. They changed that with v5.4.0 during July 2023. Thanks to @promasu for all the work on the community images.

## ⚠️ **CRITICAL: Production Deployment Warning**

### **DO NOT Use PaaS Platforms**

**Avoid Railway, Vercel, Render, Heroku, and similar Platform-as-a-Service providers.** These platforms cannot handle CryptPad's complex architecture requirements:

- **Multi-stage client-side encryption** with sandboxed cross-origin domains for security isolation
- **Persistent websocket connections** for real-time collaboration
- **Complex volume mounting** for encrypted blob storage and customization files
- **Custom SSL certificate handling** for proper Content Security Policy headers
- **Complete control over domain routing** and security policies

CryptPad implements its own zero-knowledge encryption stack that requires infrastructure-level control. PaaS platforms will fail spectacularly and waste hours of your time.

### **✅ Recommended: VPS + Docker Compose**

For production deployment of Open Paws CryptPad, use:

1. **VPS Provider**: DigitalOcean, Linode, or similar (minimum 2GB RAM, 2 CPU cores)
2. **Docker Compose**: For service orchestration
3. **NGINX Reverse Proxy**: For SSL termination and security headers
4. **Let's Encrypt**: For automated SSL certificate management
5. **Proper DNS**: A records pointing your domains to the server IP

### **Production Setup Requirements**

```bash
# Required domains (configure DNS A records):
# - your-main-domain.com -> Your server IP
# - sandbox.your-main-domain.com -> Your server IP

# Minimum server specifications:
# - 2GB RAM (4GB recommended for larger teams)
# - 2 CPU cores
# - 20GB SSD storage (scales with usage)
# - Ubuntu 22.04 LTS or similar
```

### **Expected Complexity Level**

**This is NOT a "git push to deploy" setup.** Budget 3-4 hours for:
- Server provisioning and security hardening
- Docker and Docker Compose installation
- SSL certificate generation and NGINX configuration
- Debugging HTTPS-Only mode and Content Security Policy issues
- Volume permissions and data persistence setup

CryptPad's security architecture requires proper infrastructure management. If you need simple deployment, consider using [our hosted service](https://cryptpad.openpaws.ai/) instead.

### **Production Deployment Guide**

For complete production deployment instructions with Docker Compose, NGINX, and SSL automation, see our [production deployment repository](https://github.com/stuckvgn/cryptpad-openpaws-deploy-public) which includes:

- Pre-configured Docker Compose files
- NGINX reverse proxy setup
- Automated SSL certificate generation
- Security hardening configurations
- Deployment automation scripts

**Live Example**: [https://cryptpad.openpaws.ai](https://cryptpad.openpaws.ai) - deployed using these exact configurations.

# Using the Enhanced Features

## Getting Started with Project Management

After installation, create a new Kanban board to access the Open Paws enhancements:

1. **Create Projects**: Add cards to represent your advocacy projects
2. **Score Projects**: Click edit on any card to access the 10-dimension scoring system
3. **Assign Team Members**: Add comma-separated assignees (e.g., "Sam, Gary, Maddie")
4. **Set Due Dates**: Use the date picker for project deadlines
5. **Filter & Sort**: Use the toolbar to filter by assignee, score range, or due date

## Project Scoring Methodology

The 10-dimension framework is specifically designed for animal advocacy impact assessment:

- **Scale (0-10)**: How many animals or people could this project reach?
- **Impact Magnitude (0-10)**: How deep is the potential change this could create?
- **Longevity (0-10)**: Will the impact of this project last and compound over time?
- **Multiplication (0-10)**: Could this project inspire others to take similar action?
- **Foundation (0-10)**: Does this build infrastructure for future movement growth?
- **AGI-Readiness (0-10)**: Is this project resilient to technological disruption?
- **Accessibility (0-10)**: How easy is it for others to participate or adopt?
- **Coalition Building (0-10)**: Does this create bridges with other movements?
- **Pillar Coverage (0-10)**: Does this address multiple aspects of transformation?
- **Build Feasibility (0-10)**: How quickly and easily can this be implemented?

The final project score is calculated as the average of all dimensions, providing a clear priority ranking for strategic decision-making.

# Privacy / Security

**This section describes CryptPad's base security model, which our Open Paws enhancements fully preserve.**

CryptPad offers a variety of collaborative tools that encrypt your data in your browser
before it is sent to the server and your collaborators. In the event that the server is
compromized, the database holds encrypted data that is not of much value to attackers.

**Open Paws enhancements maintain this same security level** - all project scores, assignees, and due dates are encrypted using CryptPad's native storage system before being sent to the server.

The code which performs the encryption is still loaded from the host server like any
other web page, so you still need to trust the administrator to keep their server secure
and to send you the right code. An expert can download code from the server and check
that it isn't doing anything malicious like leaking your encryption keys, which is why
this is considered an [active attack].

The platform is designed to minimize what data is exposed to its operators. User
registration and account access are based on cryptographic keys that are derived from your
username and password. Hence, the server never needs to see either, and you don't need to
worry about whether they are being stored securely. It is impossible to verify whether a
server's operators are logging your IP or other activity, so if you consider this
information sensitive it is safest to assume it is being recorded and access your
preferred instance via [Tor browser].

A correctly configured instance has safeguards to prevent collaborators from doing some
nasty things like injecting scripts into collaborative documents or uploads. The project
is actively maintained and bugs that our safeguards don't catch tend to get fixed quickly.
For this reason it is best to only use instances that are running the most recent version,
which is currently on a three-month release cycle. It is difficult for a non-expert to
determine whether an instance is otherwise configured correctly, so we are actively
working on allowing administrators to opt in to a [public directory of
servers](https://cryptpad.org/instances/) that
meet our strict criteria for safety.

For end users, a [guide](https://blog.cryptpad.org/2024/03/14/Most-Secure-CryptPad-Usage/)
is provided in our blog to help understand the security of CryptPad. This blog post
also explains and show the best practices when using CryptPad and clarify what end-to-end
encryption entails and not.

# Translations

CryptPad can be translated with nothing more than a web browser via our
[Weblate instance](https://weblate.cryptpad.org/projects/cryptpad/app/). See the state of the translated languages:

![](https://weblate.cryptpad.org/widgets/cryptpad/-/app/multi-auto.svg)

More information about this can be found in [CryptPad's translation guide](/customize.dist/translations/README.md).

# Contacting CryptPad

The best places to reach the development team and the community are the [CryptPad Forum](https://forum.cryptpad.org) and the [Matrix chat](https://matrix.to/#/#cryptpad:matrix.xwiki.com)

The team is also on the fediverse: [@cryptpad@xwiki.com](https://social.xwiki.com/@CryptPad)

# Team

CryptPad is actively developed by a team at [XWiki SAS](https://www.xwiki.com), a company that has been building Open-Source software since 2004 with contributors from around the world. Between 2015 and 2019 it was funded by a research grant from the French state through [BPI France](https://www.bpifrance.fr/). In the years since they have been funded by [NLnet PET](https://nlnet.nl/PET/), [NGI TRUST](https://www.ngi.eu/ngi-projects/ngi-trust/), [NGI DAPSI](https://dapsi.ngi.eu/), subscribers of CryptPad.fr, and donations to their [Open-Collective campaign](https://opencollective.com/cryptpad).

## Open Paws Enhancements

The animal advocacy project management enhancements were developed by [Open Paws](https://openpaws.org) to provide specialized tools for movement building and strategic project prioritization. These enhancements maintain full compatibility with standard CryptPad instances while adding powerful features for advocacy organizations.

# License

![AGPL logo](https://www.gnu.org/graphics/agplv3-155x51.png "GNU Affero General Public License")

This software is and will always be available under the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the License, or (at your option)
any later version. If you wish to use this technology in a proprietary product, please contact
sales@cryptpad.org

[Tor browser]: https://www.torproject.org/download/
[active attack]: https://en.wikipedia.org/wiki/Attack_(computing)#Types_of_attack

