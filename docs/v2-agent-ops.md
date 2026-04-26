# JustANotepad v2 Agent Operations

This document defines the long-running agent structure for the JustANotepad v2 rebuild. The goal is strict v1 parity first, then safer and faster v2 behavior.

## Mission

- Rebuild `justanotepad.com/v2` as the production v2 of JustANotepad.
- Match the v1 user-facing UI, UX, design language, toolbox, role packs, templates, storage behavior, and sync choices.
- Improve known v1 risks: storage quota failures, data-loss-prone sync, OCR/AI reliability, mobile overflow, and incomplete QA coverage.
- Keep server involvement minimal. User data should live on the user's device or in a user-owned storage provider unless the user explicitly chooses Supabase or an AI proxy.

## Agent Roster

| Agent | Role | Owns | Required output |
| --- | --- | --- | --- |
| Codex lead | Product integrator and release owner | Final decisions, implementation, docs, commits, deployment checks | Working code, updated docs, test results, deployment status |
| Aquinas | v1 reference auditor | v1 UI, UX, toolbox, role packs, templates, storage and sync behavior | Evidence-backed v1 feature inventory and migration priorities |
| Gauss | v2 implementation auditor | Current v2 code, missing/partial features, implementation risks | Done/partial/missing matrix, next implementation priorities, test gaps |
| Kant | QA and release auditor | Automated tests, manual QA matrix, release gates, rollback criteria | QA checklist, release gate status, missing device/provider coverage |

## Operating Loop

1. Reference check
   - Compare the target feature against v1 files before implementation.
   - Capture v1 evidence in `docs/v1-v2-parity.md` or a focused feature note.

2. v2 gap check
   - Classify the target as `done`, `partial`, or `missing`.
   - Mark data risk, sync risk, UI risk, and test risk before changing code.

3. Implementation
   - Prefer existing v2 stores, helpers, and UI language.
   - Keep user data local-first by default.
   - Add server calls only for optional Supabase sync or explicit AI/OCR provider flows.
   - Keep mobile/tablet layouts first-class, not afterthoughts.

4. Verification
   - Run targeted lint for changed files when full lint is blocked by legacy debt.
   - Run `npm run build`, `npm test`, and the relevant Playwright E2E checks.
   - For UI changes, verify desktop and mobile viewports with browser screenshots.
   - For release candidates, include at least one live `/v2/` smoke test.

5. Release
   - Deploy only after the release gates below are satisfied or explicitly waived.
   - Record deployment URL, commit hash, and any untested provider/device caveats.

## Release Gates

| Gate | Requirement |
| --- | --- |
| Code freeze | Scope is recorded, especially storage, sync, AI, OCR, or migration impact. |
| Local automation | `npm run build` and `npm test` pass in `v2`. Relevant E2E passes locally or against live. |
| Preview | Vercel preview loads `/v2/`, assets, config, service worker, and API routes without blocking console errors. |
| Core manual QA | Desktop Chrome, desktop Edge, and one mobile Android Chrome pass save/reload and no-horizontal-overflow checks. |
| Data safety | IndexedDB/localStorage restore, JSON backup/import, image blob refs, and at least one selected sync provider are verified. |
| Production smoke | Production `/v2/` loads and core edit/save flow works within 5 minutes of deployment. |
| Rollback trigger | Blank screen, data corruption, broken sync pull, or sustained AI proxy 5xx triggers rollback. |

## Current Migration Priorities

1. Storage/load/autosave parity with `sticky-memo-v4` compatibility and IndexedDB blob externalization.
2. JSON backup/import/export with restore verification.
3. BYOC sync: local folder, Dropbox, and Supabase legacy migration.
4. Storage quota recovery and full IndexedDB mode.
5. Tabs, workspaces, tags, trash, version history, locks, and tab context actions.
6. Full command palette registration.
7. Rich text toolbar parity and Microsoft Word-compatible shortcuts.
8. Calendar Pro, today memo, calendar tags, ICS, and reminders.
9. Role selection, My Tools dashboard, role data persistence, and role template generation.
10. High-use role tools: timetable, budget, D-Day, time tracking, estimate/invoice.
11. Template picker, pro templates, snippets, and role templates.
12. Attachments, image handling, voice recording, and media save system.
13. Table/image floating toolbars and table calculations.
14. Paper/research features: auto conversion, footnotes, citations, bibliography, page wrappers, two-column layout, undo.
15. High-value specialty tools: handwriting, paint, image converter, business card manager, meeting/LectureOS, JustPin.

## Current v2 Audit Snapshot

Last reviewed: 2026-04-26.

| Area | Status | Primary risk |
| --- | --- | --- |
| Core editing and toolbar | Partial | v1 command and shortcut parity is not fully proven. |
| Tabs, sidebar, memos, trash | Partial | v1 context actions, filters, restore, and ordering need tighter parity checks. |
| Paper/page settings | Near-complete partial | Editor page UI is strong, but print/PDF may not share the same settings. |
| Templates | Partial | Built-in pro templates and home/template merge behavior are incomplete. |
| Role packs and My Tools | Partial | Current tests cover part of the surface; full v1 role/tool coverage is not complete. |
| Business cards | Partial | Camera, Web Share, QR fallback, mention links, and live AI/OCR flows need verification. |
| OCR | Partial | Math/table/document OCR modes and CDN failure handling need more coverage. |
| AI | Partial | Provider parity, smart AI shortcuts, meeting AI, and browser-key safety need work. |
| Meeting/Lecture notes | Missing to partial | v1 recording, STT, speaker split, summary, SRT/TXT flows are not rebuilt. |
| Import/export | Partial | DOCX, SRT, TXT, real PDF parity and backup completeness need proof. |
| Backup/sync | Partial | Dropbox/Supabase OAuth, conflict policy, and multi-tab wiring need live or mock tests. |
| Attachments/media | Partial | Inserted attachment persistence after reload is a high-risk path. |
| Print/preview | Partial | A4 and margin assumptions may ignore user page settings. |
| Search/shortcuts/command palette | Partial | v1 shortcut expectations and replace behavior need regression tests. |
| Mobile/PWA | Partial | Only part of the mobile surface is covered by E2E today. |

## Immediate Implementation Queue

1. Unify JSON backup/import/export paths and verify all local-first stores are included.
2. Fix attachment insertion so images and non-image files survive reload and sync.
3. Make print/PDF use the same page size, margins, orientation, and background settings as the editor.
4. Add sync conflict handling and wire multi-tab sync where needed.
5. Harden AI/OCR providers with mocks, timeouts, error states, and v1 mode coverage.
6. Rebuild meeting/LectureOS flows: recording, transcription, speaker split, summaries, SRT/TXT export, memo insertion.
7. Expand import/export parity for DOCX, SRT, TXT, HWPX, Markdown, PDF, and image-heavy notes.
8. Complete v1 shortcut, search, replace, and command palette parity.
9. Finish business card real-world flows: camera, OCR/AI extraction, QR fallback, mentions, export/import.
10. Expand role pack, My Tools, and pro template coverage toward full v1 parity.

## Immediate Test Queue

1. JSON backup/import E2E through every UI entry point, including notes, tags, templates, snippets, role tools, business cards, settings, and blob refs.
2. Attachment E2E: upload image and non-image file, insert into note, reload, open, delete, and export.
3. Print preview E2E for A3/B4/landscape/grid/cornell and Paged.js fallback.
4. Mocked Supabase and Dropbox E2E for push, pull, conflict, logout, and token expiry.
5. Mocked AI/OCR tests for success, timeout, 401, provider missing, proxy failure, and CDN failure.
6. Business card E2E for file upload, OCR/AI extraction, CSV/vCard import/export, QR, and duplicate detection.
7. Role tool persistence test across all implemented role tools.
8. Search and shortcut E2E for v1 core shortcuts, find/replace, and formatted content replace-all.
9. Import/export tests with Korean text, tables, images, and long notes.
10. Mobile smoke expansion for editor, toolbar, page settings, business cards, roles, and attachments.

## QA Matrix

| Area | Minimum coverage |
| --- | --- |
| Desktop | Windows Chrome latest, Windows Edge latest, 1440x900. |
| Laptop | Chrome/Edge, 1366x768, keyboard shortcuts and touchpad. |
| Tablet | 834x1194 or 1024x768, portrait and landscape. |
| Phone | Android Chrome/Edge, 390x844 and 360x800. |
| Storage | New note, reload restore, IndexedDB check, localStorage migration, JSON backup/import. |
| Sync | Supabase push/pull, BYOC local push/pull, Dropbox push/pull, offline then resync. |
| Images | Paste, drop, upload, camera, HEIC/JPG/PNG/WebP, large image, blob ref persistence. |
| Business cards | Manual add, image OCR, AI vision, CSV/vCard import/export, QR, duplicate detection, search/filter. |
| OCR | `kor+eng`, `eng`, low-quality image, CDN failure, editable result insertion. |
| AI | Provider missing, direct provider, proxy provider, text AI, vision AI, timeout, CORS/error handling. |

## Agent Task Templates

### v1 audit

Use this when starting a new feature:

```text
Audit the v1 implementation for [feature]. Provide evidence paths/lines, UI behavior, data keys, sync/backup implications, and parity risks. Do not edit code.
```

### v2 audit

Use this before implementation or after a large change:

```text
Audit the v2 implementation for [feature]. Classify done/partial/missing, cite files, list data/sync/UI/test risks, and recommend the next smallest implementation slice. Do not edit code.
```

### QA audit

Use this before deployment:

```text
Verify the release readiness for [feature or commit]. Inspect tests, scripts, browser flows, provider dependencies, and rollback risks. Return pass/fail gates and missing coverage. Do not edit code.
```

## Known Process Risks

- Full repository lint can be blocked by existing legacy lint debt; use targeted lint for changed v2 files until the debt is cleaned.
- Browser-only provider flows cannot be fully verified by unit tests: File System Access folder handles, Dropbox OAuth, camera input, Supabase OAuth, and AI vision require manual or live browser QA.
- V1 source contains large legacy scripts. Always use evidence-backed migration, not memory, when cloning v1 behavior.
- Production `/v2/` is a live user-facing path. Data migration, sync pull, and import changes require extra caution.
