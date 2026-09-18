# Code audit — September 17, 2026

Study Hub's core browser flows work in the tested Arch Linux environment. The current UI uses React, shadcn/ui, Tailwind CSS, and Vite. Node.js/npm are required to build or develop it; the production `dist/` remains a static app and includes the original PDF library. There is no native Windows dependency.

## Environment and verification

- Arch Linux (rolling), Firefox 155.0.1, Node.js 26.8.2 and Python 3.14.7.
- Firefox ran headlessly with an isolated temporary profile; existing personal browser data was not used.
- All 21 registered views rendered and mounted without captured JavaScript errors or unhandled promise rejections. Also checked all four class detail pages and month/week/agenda calendar modes.
- Before the React migration, HTTP startup at `http://127.0.0.1:5178` and direct `file://` startup both loaded the seeded app: 4 classes, 67 notes, 99 flashcards and 35 events.
- Checked Markdown import with frontmatter and wikilinks, a real 30-page Nutrition PDF, the real Urban Studies Word syllabus, and a generated PowerPoint fixture with slide text and speaker notes.
- Checked IndexedDB file write/read/delete, note editing and save flushing, global search, flashcard grading, focus start/pause/reset, and reset initialization.
- All 80 local links rendered from seeded notes point to existing files, including on Linux's case-sensitive filesystem.
- Dependency-free regression tests cover initialization/reset/reload, invalid backup containers, malformed URLs, unsafe link schemes, DST date arithmetic, calendar exceptions and duplicate imports, named time zone conversion, LeetCode review preservation, and CLI sync with Linux paths, spaces, uppercase Markdown extensions and environment configuration.
- JavaScript syntax checks and `git diff --check` pass.

Run regressions from the project root:

```sh
TZ=America/New_York node --test tests/audit.test.js
```

## Repairs

- Replaced a personal Windows vault path with an explicit path argument or `OBSIDIAN_VAULT`, with useful usage errors. Sync accepts uppercase `.MD` files and rejects paths that aren't directories.
- Reset now applies the same planner and course initialization as startup.
- Malformed percent escapes in routes no longer crash navigation.
- Pending note edits save when the page hides or moves into the background.
- Storage migration rejects invalid top-level data and invalid array containers before replacing the current store. This is basic structural validation, not an exhaustive backup schema.
- User-supplied external links are restricted to HTTP(S) and local library files; importing a `javascript:` URL no longer creates an executable link in the affected views.
- PDF extraction sets `isEvalSupported: false`, the workaround documented in [Mozilla's CVE-2024-4367 advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq). The existing PDF.js version remains pinned; this mitigation is not a claim that every dependency vulnerability has been eliminated.
- Calendar imports retain daily/weekday repeat exceptions and convert IANA `TZID` values using seasonal offsets. Exception dates preserve their time zone metadata during conversion. Imports stage events before committing, and reader failures surface in the UI.
- All-day recurrence exports use date-valued `UNTIL`, matching their date-valued start.
- README now gives Arch setup instructions and accurately describes CDN/offline requirements.

## Limits

- This audit verifies the flows above; it cannot guarantee every interaction or input works. Chromium, mobile browsers, real desktop notification delivery, external ChatGPT/Obsidian launches, and long-running/background timer behavior were not exercised.
- Calendar storage supports single-day events and a limited set of repeat rules. It does not preserve arbitrary ICS rules, multi-day durations, custom VTIMEZONE definitions, or the source time zone for recurring events. COUNT-based weekly/weekday imports use an approximate end date. Cross-zone recurring events may shift relative to the original calendar across DST changes.
- PDF/Office imports use CDN readers; a fresh offline browser may not have them cached. External services require internet. Browser storage availability and quotas affect persistence; export backups regularly. Backups exclude original imported files.
- No dependencies were installed and no system configuration was changed. Arch's official repositories provide [Firefox](https://archlinux.org/packages/extra/x86_64/firefox/) and [Node.js](https://archlinux.org/packages/extra/x86_64/nodejs/).

## Google Docs and images follow-up

Added saved per-note Google Docs URLs, an optional custom embed URL, an iframe preview, a separate original-link action, and Markdown image rendering with an Image toolbar action. Normal document URLs default to preview; query parameters and section fragments remain intact. Only HTTPS Google Docs document URLs are accepted for embeds. No Google Docs/Drive account connector is available in this session; Gmail access does not supply document access.

The regression suite now has 11 passing tests, including Google Docs URL validation, section preservation, embed persistence/rendering, Markdown images, escaped image attributes and literal code examples. An isolated Firefox check verified attaching a document, iframe source and original link, reload persistence, removing the document, image markup and attribute escaping. This check used a placeholder document ID: authenticated rendering of a real private Google Doc was not tested. Google permissions, sign-in and framing restrictions still apply, and iframe section navigation is controlled by Google.

## Original slide PDFs

PDF-backed notes now show an embedded original PDF above the extracted text and notes, with an Open PDF action. Bundled lecture files load from their library paths; imported files load from IndexedDB through a temporary object URL that is revoked when leaving the view. Missing imported files show a recovery message. Twelve regression tests pass. Firefox checks confirmed a bundled PDF URL serves actual PDF bytes and an imported PDF resolves to a blob URL in the viewer.

## PDF-only correction

PDF note views now display the embedded original document and a separate user annotations field, with no extracted-text preview, Markdown editor or formatting controls. This supersedes the earlier PDF-above-text layout. Existing underlying note text is preserved in storage, but is not rendered in PDF note views. New PDF imports bypass text extraction and CDN readers, always retain the original PDF, and report storage errors rather than creating text-only notes. Fourteen regressions pass; Firefox checks verified all 23 bundled PDF-backed notes have embedded viewers and no extracted-text controls, actual PDF import with original-file retention even when the Office retention option is disabled, blob-backed viewing, and annotations saving.

## Brightspace email updates

Searched course-related Gmail notifications from August 1 through September 17, 2026, and read relevant announcements and activity summaries. Added a once-applied content update with these email-confirmed deadlines:

- Operating Systems Assignment 1: September 29, no time specified in the September 17 announcement.
- Security Assignment 1: September 22, 5:00 PM EDT; September 15 extension supersedes the old September 15 deadline, corroborated by the September 17 digest. The September 10 announcement corrects submission to Brightspace rather than Gradescope.
- Nutrition Connect Chapter 1–2: September 21, 4:55 PM, from September 15 Housekeeping Notes.

Known times are represented with exact instants and displayed in the browser's local time zone; course-time wording remains in the notes. Existing completion, IDs and unrelated context remain. Assignment and source-email links are visible in the calendar editor. Urban Studies reading-team/essay instructions and Nutrition practice-quiz instructions were saved as course notes. Historical attendance information and unnamed quiz counts were not interpreted as new incomplete assignments; the Urban Studies email did not confirm the existing essay due date. No email was sent or modified. This is a reviewed local snapshot, not a live/background Gmail connection. Sixteen regression tests pass, including email corrections, duplicate prevention and completion preservation.

## Tasks, practice exams, references and countdowns

Navigation now groups planning, studying and exploration. Tasks combines existing coursework, daily-task and actionable list records; Daily routine and Lists retain their own pages. Class pages show their open coursework and class-tagged tasks, with creation, editing and completion using the same records. Exam plan tasks now retain their class association.

Practice exams use a class/source-aware ChatGPT website prompt and a regex block parser. Invalid responses cannot save. Objective questions auto-grade; short answers require rubric self-grading. Answer keys and definition links inside questions stay hidden until submission. Attempts, answers and missed-question flashcards persist locally. No automatic private Google Docs reading or file upload is claimed.

Definition mappings use MDN, NIST CSRC and relevant OSTEP chapters, researched online September 17, 2026. Matching is local, handles longest phrases and word boundaries, skips existing links, code, form controls and unfinished questions, and watches displayed content updates. Unknown terms and iframe document text remain unchanged. Not every possible term has a definition mapping; external reference availability can change.

Live exam countdowns appear on Today, class pages and Exams. Date-only exams show calendar days; timed exams show days/hours/minutes/seconds and report when the start time passes. Completed exams are excluded from overview panels. The refresh timer is cleared when views redraw.

Firefox on Arch Linux verified class-task creation with class preselected and completion persistence; prompt generation; mixed-question import; hidden answer keys and definition links during the test; objective grading and short-answer self-grading; missed-question flashcard generation; reload persistence; task/class/practice/calendar pages; and a timed countdown decreasing between ticks. All 23 registered views rendered without errors. At Firefox's headless minimum viewport of 500px the checked Tasks, practice builder and class page had no horizontal document overflow; narrower physical mobile devices were not tested. The dependency-free Node suite has 23 passing regressions.

## Focused UI overhaul

Applied the installed frontend-design skill to the shared navigation, toolbar, typography, color tokens, forms, lists, calendar, notes, practice questions, grades and countdown surfaces. Added a compact Create menu and collapsed Explore navigation. Today prioritizes schedule/tasks, previews at most five upcoming non-template deadlines and two exams, and collapses statistics/class shortcuts/review history. Task sections preview eight items until the user selects a source. Class pages now separate Overview, Materials, Tasks and Info; the underlying records and editors remain shared. Read mode is the default for existing notes; new notes open in Write mode. Unused Docs setup and advanced practice/prompt controls stay collapsed. Startup notifications are retained in the bell quietly, with ordinary later deadline alerts retaining their settings.

Reviewed Firefox screenshots of Today, Tasks, class overview, notes, practice setup and dark mode. Interactive Firefox checks verified Create → New task, class task creation with class association, resource-link creation, switching Read/Write, PDF embedding without extracted-text controls, practice import and objective grading, and the navigation drawer. All checked narrow layouts at 500 CSS pixels had no document overflow and emitted no browser UI errors. Firefox CLI screenshots at exactly 390 pixels verified Today and class Tasks layouts; these supersede the earlier minimum-window-only layout limitation. These are desktop Firefox viewport checks, not physical iOS/Android testing. Browser caching was disabled for final checks. Twenty-five Node regressions pass, including class-tab separation and quiet reminder retention; syntax and whitespace checks pass.

## Monochrome hierarchy and self-paced LeetCode

The monochrome palette supersedes the blue/slate palette in the earlier UI pass. All workspace hex colors were checked to be neutral greys; shared foregrounds, accents, urgent labels, sidebar backgrounds and class indicators now use black/white/grey in both themes. The layout hierarchy is Plan, Classes (nested per-class pages), Materials, and collapsed Tools. Page breadcrumbs show the current class and destination on desktop and narrow screens. Today’s plan has primary visual weight over the upcoming-work preview.

LeetCode no longer generates or displays due dates, scheduled rating intervals, due-count badges or early-practice messages. Old scheduling fields are removed on loading the LeetCode store; solve dates, practice counts, outcomes and user edits remain. Every problem is available in the self-paced queue. Firefox checks confirmed absence of scheduling fields before and after rating, four nested pages for the selected class, correct class-task breadcrumbs, grey/black computed UI backgrounds and no browser UI errors. Twenty-seven regressions pass, including legacy LeetCode date removal and breadcrumb scope.

## shadcn/ui revamp verification

- Actual shadcn/ui components now power the sidebar/mobile sheet, breadcrumbs, command search, creation menu, modal dialogs, tabs, checkboxes, and primary workspace pages.
- Dashboard, task hub, class index, class overview, and class task pages render in React. Existing document editors and specialized study views use a lifecycle bridge with their original data and PDF behavior.
- Production Vite build succeeds and copies all original library assets. All 27 regression checks pass.
- Firefox checks covered every routed study area, task creation/save/dialog closure, workspace search, original PDF iframe rendering, light/dark themes, production startup and persistence across reload.
- Reviewed desktop and 390px mobile screenshots, and checked mobile navigation opening and closing after choosing a page.
- Source `index.html` now needs Vite; direct file opening is no longer supported. Keep the previous HTTP origin/port to retain existing localStorage and IndexedDB data.

## Reliability and performance hardening

- Unreadable localStorage is preserved; recovery mode blocks automatic overwrite and provides an original-data download. Explicit reset and validated backup restoration resume saving.
- Unchanged saves skip localStorage writes and workspace refresh events. Failed writes remain retryable and display a persistent status.
- IndexedDB connections reset after open failures/version changes, and aborted transactions reject instead of hanging.
- Background services start once and expose cleanup for intervals and visibility listeners. Page mounting cleans up partial failures; a React error boundary offers retry and Settings access.
- Search is memoized, deferred while typing, and disabled while closed. Definition-link updates scan added nodes instead of the full view; paused timers skip redundant pill updates.
- Production startup uses one minified, content-versioned classic script instead of 30 separate scripts. Relative asset paths support serving a built workspace below a URL subdirectory.
- 31 regressions pass, including damaged storage, write failures/retries, IndexedDB abort/retry, and service cleanup. Firefox production checks confirmed recovery preserves damaged bytes, failed-page retry works, persistence survives reload, and original PDFs and countdowns remain available.
- `npm run check` and a GitHub Actions workflow run tests plus the build. No production speedup percentage is claimed; request reduction and skipped operations are verified implementation changes.

## Additional efficiency work — September 18, 2026

- Search now caches normalized text until workspace changes, builds display snippets only for matches, and stops after 30 results. Cache invalidation covers failed saves, undoing a failed edit, and replacement/reset of the workspace.
- React memoization prevents global search input changes from rerendering navigation and native workspace pages. Firefox observed zero dashboard DOM mutations during warm search typing.
- The command-search interface is lazy loaded. Firefox observed zero search-chunk requests at startup and one when search opened. The main React bundle decreased from approximately 422 kB to 411 kB uncompressed.
- A local headless Firefox comparison returned identical results for the checked queries. Median of seven 500-query samples: previous search 546 ms, cached search 93 ms. These are warm search-function timings with the local seeded workspace, rather than whole-site load timings.
- Search-chunk load failures have a recovery control that retains the page; reload is allowed only after a successful save, otherwise Settings is opened for backup.
- `npm run check` now validates production entry assets, classic-script syntax, and initial JavaScript/CSS size budgets after tests/build. Gzip-equivalent budgets measure payload growth; the hosting server controls actual HTTP compression.
- All 33 regression tests and production payload checks pass. Firefox verified lazy search, keyboard Escape, class/task pages, practice, calendar, flashcards, LeetCode, and original PDF iframe viewing.
