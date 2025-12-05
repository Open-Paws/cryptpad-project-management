<!--
SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors

SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Open Paws Project Management

**End-to-end encrypted project management for organizations with high security requirements.**

This is a customized version of [CryptPad](https://cryptpad.org) that transforms the Kanban board into a full-featured project management tool. Built for [Open Paws](https://openpaws.ai) to coordinate animal advocacy work, but useful for any organization that needs secure, collaborative project planning.

**Live instance**: [cryptpad.openpaws.ai](https://cryptpad.openpaws.ai)

---

## What We Built

We've extended CryptPad's Kanban with three integrated views, task management, and a strategic scoring system—all while preserving CryptPad's zero-knowledge encryption.

### Three Views

**Pipeline** — Enhanced kanban board with drag-and-drop columns, color-coded cards, priority scores displayed on each card, and a compact mode toggle.

**My Tasks** — Personal dashboard showing all your tasks across every project. Check off tasks, edit inline, filter by status or due date. Includes "Add Quick Task" for standalone to-dos.

**Timeline** — Gantt chart view. Drag projects to reschedule, resize bars to change duration. Tasks appear nested under their parent projects.

### Tasks Inside Projects

Each project card can contain sub-tasks:
- Checkbox completion tracking
- Per-task assignees and due dates
- Progress indicator on cards (e.g., "3/5 complete")
- Tasks inherit the project's due date if none set

### Project Scoring

Nine-dimension scoring system for prioritization:

| Dimension | What it measures |
|-----------|------------------|
| Scale | Number of animals/advocates affected |
| Impact Magnitude | Depth of positive change |
| Longevity | Lasting value over time |
| Multiplication | Enables additional impact |
| Foundation | Creates platform for future work |
| Accessibility | Easy for advocates to adopt |
| Coalition Building | Strengthens movement unity |
| Coverage | Impact across advocacy approaches |
| Build Feasibility | Speed and ease of implementation |

Each dimension scored 0-10. The composite score (average) displays on cards and enables score-based filtering and sorting.

### Other Features

- **Assignee management** — Assign team members to projects and tasks
- **Date tracking** — Start dates and due dates with urgency indicators
- **Filtering** — By assignee, score range, due date preset, completion status
- **Sorting** — By score, due date, title, or creation date
- **Real-time collaboration** — Multiple users editing simultaneously
- **Compact mode** — Hide card details for a cleaner board view

---

## Security

All data—including scores, assignees, tasks, and dates—is encrypted in your browser before reaching the server. The server only stores encrypted blobs it cannot read.

This is CryptPad's standard zero-knowledge model. Our enhancements add no server-side components and make no changes to the encryption layer.

---

## Deployment

### Use Our Hosted Instance

The easiest option: [cryptpad.openpaws.ai](https://cryptpad.openpaws.ai)

### Self-Host with Docker

CryptPad requires proper infrastructure—it won't work on PaaS platforms like Railway, Vercel, or Heroku due to:
- Sandboxed cross-origin iframe requirements
- Persistent WebSocket connections
- Complex CSP header configuration
- Two-domain setup (main + sandbox subdomain)

**Recommended setup:**
- VPS (2GB RAM, 2 CPU cores minimum)
- Docker Compose
- NGINX reverse proxy
- Let's Encrypt SSL
- Two DNS A records (main domain + sandbox subdomain)

**Deployment guide**: See our [deployment repository](https://github.com/stuckvgn/cryptpad-openpaws-deploy-public) for pre-configured Docker Compose, NGINX configs, and setup scripts.

**Development setup**: Follow CryptPad's [developer guide](https://docs.cryptpad.org/en/dev_guide/setup.html).

---

## Usage

1. Create a new Kanban board from the CryptPad drive
2. Add columns (e.g., Backlog, In Progress, Done)
3. Create project cards in columns
4. Click a card to edit: add tasks, set scores, assign team members, set dates
5. Switch views using the toolbar buttons (Pipeline / My Tasks / Timeline)
6. Use filters and sort options to focus on what matters

---

## Built On

This is a fork of [CryptPad](https://github.com/cryptpad/cryptpad), the open-source encrypted collaboration suite developed by [XWiki SAS](https://www.xwiki.com). CryptPad provides Documents, Spreadsheets, Presentations, Polls, Whiteboards, and more—all end-to-end encrypted.

Our modifications are limited to the Kanban application (`www/kanban/`). Everything else is standard CryptPad.

---

## License

GNU Affero General Public License v3.0 or later. See [LICENSE](LICENSE).

[Tor browser]: https://www.torproject.org/download/
[active attack]: https://en.wikipedia.org/wiki/Attack_(computing)#Types_of_attack
