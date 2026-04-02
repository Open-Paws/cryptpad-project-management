# www/kanban — Open Paws Kanban App

The primary Open Paws customization layer on top of CryptPad. This is where strategic project scoring, assignment management, security tiers, due dates, and advanced filtering are implemented. All user data flows through the CryptPad E2EE framework — this module only ever handles plaintext JSON.

## Files

| File | Purpose |
|------|---------|
| `inner.js` | Main kanban app logic. Contains all Open Paws customizations: 10-dimension project scoring, security tier filtering (T1/T2/T3), assignee management, due date handling, dependency tracking, T3 item redaction on export. Do not bypass `framework.localChange()` — it is the only path to encrypted sync. |
| `jkanban_cp.js` | CryptPad fork of jKanban board renderer. Contains date parsing (`parseDateLocal`, `toDayNumber`), relative due-date formatting, and drag-and-drop via Dragula. DST-safe day arithmetic for due dates. |
| `export.js` | CryptDrive bulk export handler. Strips T3-tier confidential items before export — mirrors `redactT3Items` in `inner.js`. Logic is intentionally self-contained (no imports) to remain usable from the export pipeline. |
| `index.html` | App entry HTML shell. |
| `inner.html` | Inner iframe HTML. |
| `app-kanban.less` | Kanban-specific styles. |

## Open Paws Scoring Dimensions

Defined in `inner.js` at module level as `scoringDimensions` (10 dimensions):

| Key | Label |
|-----|-------|
| `scale_score` | Scale — Number of animals/advocates affected |
| `impact_magnitude_score` | Impact Magnitude — Depth of positive change |
| `longevity_score` | Longevity — Lasting value over time |
| `multiplication_score` | Multiplication — Enables additional impact |
| `foundation_score` | Foundation — Creates platform for future work |
| `agi_readiness_score` | Future-Readiness — Adapts to changing landscape |
| `accessibility_score` | Accessibility — Easy for advocates to adopt |
| `coalition_building_score` | Coalition Building — Strengthens movement unity |
| `pillar_coverage_score` | Coverage — Impact across advocacy approaches |
| `build_feasibility_score` | Build Feasibility — Speed and ease of implementation |

## Security Tier Filtering

Items carry a `security_tier` field with values `T1`, `T2`, or `T3`. T3 items (investigation planning, witness coordination, legal defense notes) are:
- Filtered from default views
- Stripped from export via `export.js` and `redactT3Items()` in `inner.js`
- Never exported in CryptDrive bulk exports

This aligns with the 2026-03-28 encryption domain sovereignty decision — T3 data never crosses boundaries without deliberate human action.

## Key Patterns

- **Never bypass `framework.localChange()`** — all writes must go through the framework to be encrypted and synced
- **`DEBUG_KANBAN` flag** — set to `false` in production; toggle to `true` only for local diagnostic logging
- `parseDateLocal()` and `toDayNumber()` use UTC arithmetic to avoid DST boundary bugs in due-date calculations
- Dependency IDs between items use string coercion (`String(id)`) for safe cross-type comparison

## Cross-References

- Root `CLAUDE.md` — E2EE architecture, Ten Commandments, framework patterns
- `lib/metadata.js` — access control enforced server-side
- `www/common/sframe-app-framework.js` — the framework wrapping all encryption
