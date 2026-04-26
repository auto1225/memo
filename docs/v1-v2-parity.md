# JustANotepad v1 to v2 Parity Plan

This document tracks the migration target: v2 must reproduce the v1 design and user-facing feature set while improving performance, maintainability, and testability.

## Product Target

- Product name: JustANotepad
- v1 reference: `/app` and `app.html`
- v2 implementation: `/v2`, `v2/src`, React + TypeScript + Vite + TipTap
- Deployable static output: `dist-v2`

## Design Parity

- Window shell: draggable notepad-style pad, topbar controls, tabs, toolbar, sidebar, status bar.
- Visual themes: lavender, butter, rose, mint, noir, ocean, plus v2 light/dark/auto compatibility.
- Paper backgrounds: lined, grid, dot, blank, music, Cornell.
- Responsive behavior: v1 topbar overflow behavior, compact toolbar, mobile-safe editor.
- Modal style: v1 rounded modal/backdrop language with keyboard-safe interactions.
- Icon language: stroke SVG icons, no emoji as primary UI glyphs.

## Feature Parity Matrix

| Area | v1 Capability | v2 Status | Notes |
| --- | --- | --- | --- |
| Core editing | Rich text, headings, lists, checklists, code, quote, table, links, images | In progress | TipTap foundation is present. Verify command coverage and keyboard shortcuts. |
| Tabs/memos | Multi-tab notes, close/add/reorder, current memo restore | In progress | `MemoTabs`, `memosStore`; needs v1 behavior audit. |
| Sidebar | Workspace, tags, favorites, filters | In progress | `Sidebar`, `TagsBar`; compare exact v1 buckets. |
| Search | Find/replace and global search | In progress | `FindReplaceBar`, `SearchPanel`; verify regex/case/word modes. |
| Paper/page | A-series pages, margins, page breaks, print preview | In progress | `PaperPanel`, `PrintPreview`, pagination plugin. |
| Drawing | Handwriting/paint canvas | In progress | `PaintCanvas`; compare pen pressure/smoothing expectations. |
| AI | Summary, improve, continue, translate, Q&A, flashcards | In progress | `AiHelper`, `AiChatPanel`, API config required for live test. |
| OCR | Image to text / math / markdown table | In progress | `OcrModal`, `ocr.ts`; provider parity needs verification. |
| Business cards | Scan/upload, SNS fields, vCard, duplicate checks, stats | Partial | Current v2 header has placeholder popup; needs dedicated v1-level manager. |
| Meeting notes | Recording, transcription, speaker split, summary/actions | Partial | Template exists; recording/transcript parity needs implementation audit. |
| Productivity | Pomodoro, flashcards, word cloud, calendar, link cards | Partial | Several commands exist; verify UI and persistence. |
| Import/export | PDF, DOCX/HWPX, HTML, Markdown, TXT, SRT, JSON backup | In progress | `hwpxExport`, `pdfExport`, markdown, file ops. DOCX/SRT parity TBD. |
| Security | Tab encryption, lock modal | In progress | `LockModal`, `memoCrypto`; verify v1 compatible data flow. |
| Sync | Local, Supabase/cloud, multi-tab sync | In progress | v2 now uses the same Supabase `user_data` + Auth/RLS model as v1 and can migrate v1 cloud blobs into v2 snapshots. Live OAuth/dashboard validation still depends on Supabase provider settings. |
| PWA/desktop | Manifest, service worker, Tauri window controls | In progress | v2 PWA metadata now uses JustANotepad product name. |

## Performance Goals

- Keep the v2 editor interactive under large notes by avoiding unnecessary rerenders.
- Lazy-load heavy panels and providers only when opened.
- Keep `/v2` production build free of TypeScript errors and blocking console errors.
- Prefer typed helper modules over v1-style global script accumulation.
- Maintain Chrome live smoke checks for load, edit, shortcuts, and modal opening.

## Immediate Next Milestones

1. Complete design audit with v1/v2 screenshots and exact layout deltas.
2. Validate Supabase Google OAuth redirect URLs for `/v2` in the live dashboard.
3. Replace placeholder v2 business-card popup with a dedicated manager matching v1 behavior.
4. Audit meeting-note recording/transcription parity.
5. Add targeted E2E smoke tests that can run against Chrome or bundled Playwright browsers.
