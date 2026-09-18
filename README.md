# Study Hub

A black-and-white study app built with React, shadcn/ui, and Tailwind CSS. Notes and progress save in your browser; no account is required.

## Running on Arch Linux

Install Node.js, npm, and Firefox from Arch’s official repositories:

```sh
sudo pacman -Syu nodejs npm firefox
cd /path/to/study-tool
npm ci
npm run dev -- --port 5178
```

Open **http://127.0.0.1:5178** in Firefox. Keep the address and port the same as your previous installation to retain browser data. Export a backup before changing the browser or origin. Opening the source `index.html` directly is no longer supported.

To build and serve the production app:

```sh
npm run build
npm run preview -- --port 5178
```

`dist/` contains the complete static app, including original PDFs. You can also serve that directory with `python3 -m http.server 5178 --bind 127.0.0.1 --directory dist`. No Node.js server is needed after building. Obsidian links require Obsidian and its `obsidian://` handler.

Run regression checks with `npm test`.

Set up for Operating Systems, Computer Security, Nutrition and Health, and the Advanced Seminar in Urban Studies.

## Where things are

The sidebar groups pages under **Plan**, **Classes**, **Materials**, and **Tools**. Expand a class for its Overview, Materials, Tasks, and Class info. The top-bar **Create** menu adds notes, tasks, and materials; search opens with Ctrl/Cmd+K.

| Sidebar | What's inside |
|---|---|
| **Today** | Priorities, recent materials, today’s schedule, upcoming deadlines, exam countdowns, and study shortcuts |
| **Classes** | *Classes*: one page per class with lectures (tick them off as they're covered), notes, topics, grade, class times, links and books, deadlines and class info. *Grades*: enter scores, see your current grade and what you need on the rest |
| **Notes & slides** | *All notes*: Markdown editor with `[[links]]` and highlighted code. *Code*: snippet library with "explain / debug / trace / find the vulnerability" prompts. *Add material*: bring in slides, notes and source files you already have |
| **Flashcards** | Review (spaced repetition, keys `1`–`4`), browse, *Make with AI* (ChatGPT prompt, then paste its reply), write a card |
| **AI tools** | *Ask ChatGPT*: builds the prompt, copies it, opens ChatGPT. *Summarize*: key points and suggested cards, made inside the app |
| **LeetCode** | *Problems*: every problem you've solved, from your Obsidian vault, with filters by difficulty and pattern. *Practice*: self-paced re-solving without due dates |
| **Knowledge map** | *Graph*: everything you know as a network. *Skill tree*: topic order per class. *Connections*: how many steps apart any two things are |
| **Tasks** | All coursework, everyday tasks and actionable list items, with search, class/source/status/date filters, completion checkboxes and editing. *Daily routine*: daily tasks and habits. *Lists*: nested to-do outlines. |
| **Calendar** | Month, Week and Agenda for events and deadlines, *Day plan* time blocks, and *Exams* with countdowns and study plans |
| **Focus** | Pomodoro timer that keeps running while you use the app, with study time per day and per class |

## Reminders
The bell in the top bar collects reminders: the day before something is due, the morning it's due, an hour before, when it becomes overdue, a week and 3 days before exams, before class starts, and once a day when flashcards are due. Turn on desktop notifications from the bell or in **Settings → Reminders**. Reminders only run while Study Hub is open (a background tab is fine).

## Your course content
`js/packs-data.js` and `js/packs.js` / `js/packs-more.js` load your real Fall 2026 content once: syllabi details, class times, deadlines and exams, lecture notes built from the slides (Operating Systems lectures 1–21, Security weeks 1–2, Nutrition chapters 1–2), your own notes and reading notes from `Desktop\info`, and flashcards for what's been covered so far. The slides, syllabi and textbooks are copied into `library/`, and notes link straight to them (textbook readings open at the right page). Dates marked "confirm" in the notes weren't fully spelled out in the syllabus.

Classes are told apart by **shape**, not color: ■ OS, ▲ Security, ● Nutrition, ◆ Urban Studies (change a shape under Classes, then *Rename or change mark*).

## Adding slides and existing notes

### Google Docs and images in notes

Open a note and expand **Attach a Google Doc**. Paste your Google Docs URL and click **Save document**. The document appears above your Markdown notes, including images displayed by Google. The saved link is included in backups; the live document stays in Google Docs and requires internet.

For a specific section or page, create a bookmark in Google Docs and paste its full link, or use a heading link. Study Hub preserves the URL's query and fragment. Google may ignore that target in the preview iframe; **Open in Google Docs** always uses your original link. This does not promise a numeric “go to page” control. [Google's bookmark instructions](https://support.google.com/docs/answer/45893?hl=en).

The optional **Custom embed URL** accepts a Google Docs preview, editor, or published URL. A normal document URL defaults to a read-only preview. Private documents depend on your browser's Google sign-in and access; use **Open in Google Docs** if Google blocks the iframe. For an already published document, paste its published URL. Publishing changes who can see the document, so it is not required or performed by Study Hub. [Google's embed instructions](https://support.google.com/docs/answer/183965?hl=en).

The **Image** toolbar button inserts an image URL into Markdown, or write `![Description](https://example.com/image.png)` directly. Local `library/` image paths also work. Use a direct image URL rather than a Google Drive sharing page. Inline code examples stay literal. This URL-based feature does not upload images or automatically synchronize the Google document into your local notes, flashcards or search.

Click **Add material** in the top bar, or drop files onto the Notes page.

- **PDF** slides or readings, **PowerPoint (.pptx)** including speaker notes, **Word (.docx)**, **Markdown / text**, and **web pages (.html)**
- **Choose a folder** to bring in a whole course folder or an **Obsidian vault**. Its `[[links]]`, front-matter tags and `#tags` are kept.
- Each file is matched to a class from its name, and you can change the match before adding. Each file becomes a new note, or you can add it to the end of a note you already have.
- The original PDF, PPTX or DOCX is kept in the browser, so an imported note can reopen it.
- PDF notes display the original document in an embedded viewer, with a separate field for your own notes. They do not display extracted slide text. Bundled lecture PDFs open directly from `library/`; imported PDFs load from browser storage. **Open PDF** opens a full viewer in a separate tab. Restoring a backup without the original imported files requires importing those PDFs again.
- Old `.ppt` / `.doc` files need to be saved as `.pptx`, `.docx` or PDF first. Scanned PDFs are displayed as their original pages.
- PDF imports keep and embed the original file without a CDN reader or text extraction, including scanned PDFs. Office text readers load from a CDN on demand and need internet unless cached. Fonts also load from the internet, with local fallbacks. Core notes, flashcards and planning work offline; external links and ChatGPT require internet.

## Calendar

Brightspace emails checked on September 17, 2026 supply confirmed OS Assignment 1, Security Assignment 1 (including its extension and corrected submission location), and the Nutrition Chapter 1–2 Connect deadline. These updates merge once into existing browser data when you reload, preserving completion status. Open the deadline to see its assignment and source-email links. Email confirmation is marked separately from other course dates. Other instructions without confirmed deadlines are saved in course notes. This is a reviewed snapshot, not automatic background Gmail polling.

- **Event** is something you attend: a class session, study group, appointment or shift. It has start and end times, a location, and can repeat (daily, weekdays, weekly, every 2 weeks, monthly) until a date you pick.
- **Deadline** is something due. You can check it off, and it shows as overdue if you miss it.
- In **Week**, click an empty slot to add an event at that time. When you open one repeat of an event, you can delete just that day.
- **Import .ics / Export .ics** (bottom of the calendar sidebar) moves events to and from Google, Outlook or Apple Calendar.

## LeetCode
Problems come from `Vault/4 - Main Notes/Leetcode/<Easy|Medium|Hard>/<number>. <Title>.md`. Each note needs the solution in a code block. The LeetCode link and notes below the code are optional.

- **After solving more problems**, run `node tools/sync-leetcode.js "/path/to/Vault"` and reload the app. Optionally pass the vault-relative LeetCode folder as a second argument. You can also set `OBSIDIAN_VAULT` and run the command without arguments. Paths with spaces must be quoted; Linux paths are case-sensitive. New problems are added, changed code and notes are updated, and your practice history is kept. Or click **Sync from vault** and pick the vault or its `Leetcode` folder.
- **Practice** lets you re-solve any saved problem whenever you want. Open it on LeetCode, compare with your saved solution and record how it went. Ratings retain practice history without scheduling future reviews.
- The **pattern** is guessed from the problem number (NeetCode list). Change it, and add a one-line **key idea**, on the problem's page. Both are saved in the app only; your vault isn't changed.
- **Open in Obsidian** jumps to the note. **Review with ChatGPT** asks for complexity, missed edge cases and a better approach.

## Tips
- `Ctrl+K` or `/` searches everything.
- Starter deadlines are marked **[Template]**. Remove them in **Settings → Remove example deadlines**.
- **Settings → Export backup** regularly. The backup has your notes and cards, including text pulled from slides, but not the original files.

## Files
```
index.html          entry point and existing study scripts
src/main.jsx        React shell, dashboard, tasks, classes, and editor bridge
src/components/ui/  shadcn/ui components
src/index.css       neutral theme and editor compatibility styling
vite.config.mjs     build and original PDF asset copying
css/styles.css      all styling (white and black themes)
js/core.js          storage, file store, markdown, graph model, spaced repetition, icons, class marks
js/seed.js          starter template (classes, topics, starter cards)
js/importer.js      PDF / PPTX / DOCX / Markdown / HTML → note text
js/ai.js            ChatGPT prompt templates + offline summarizer
js/graph.js         canvas graph + skill-tree layout
js/views-*.js       one file per area of the app
js/app.js           route parsing, shared operations, React bridge
js/notify.js        reminders, bell panel, desktop notifications
js/focus.js         focus timer and study log
js/views-grades.js  grade tracker
js/views-exams.js   exam countdowns and study plans
js/code.js          syntax highlighting, code snippets, code prompts
js/packs*.js        your course content (applied once)
library/            slides, syllabi and textbooks the notes link to
js/leetcode-parse.js    Obsidian LeetCode note → problem (shared with the sync script)
js/leetcode-data.js     generated snapshot of the vault's LeetCode notes
tools/sync-leetcode.js  node script that regenerates leetcode-data.js
css/leetcode.css        LeetCode section styles
```
## Checks

Run the dependency-free regression suite with `node --test tests/audit.test.js`. It covers reset and storage migration, invalid backups, malformed routes, unsafe links, calendar dates and exceptions, LeetCode review preservation, and vault sync with Linux paths.

See [AUDIT.md](AUDIT.md) for the tested environment, browser checks and remaining limitations.

### Practice exams, class tasks and definitions

**Practice exams → Get prompt** selects a class, scheduled exam, topics and notes. Copy the prompt and open ChatGPT, then paste its entire response into **Create test → Parse & preview → Save & take test**. The prompt requests a strict `BEGIN_QUESTION` / `END_QUESTION` format. Invalid responses show errors and cannot be saved. Multiple-choice and true/false questions grade automatically; short answers use a model answer and self-grading rubric after submission. Answers, attempts and missed-question flashcards save locally and travel with backups. Upload original PDFs to ChatGPT or paste source material when the prompt lacks text; Google Docs iframe content is not automatically available to the app.

Each class has **Class tasks & deadlines**. Add class tasks or deadlines, edit them and mark them complete. These are the same records shown on the main Tasks page. Midterms/finals and other exams have countdowns on Today, their class page and Exams. Set an exam time for a live days/hours/minutes/seconds countdown; otherwise the app shows calendar days remaining. Times follow the browser's local zone.

Recognized computing and security terms in displayed text link to the [MDN glossary](https://developer.mozilla.org/en-US/docs/Glossary/), [NIST CSRC glossary](https://csrc.nist.gov/glossary/) or relevant chapters of [OSTEP](https://pages.cs.wisc.edu/~remzi/OSTEP/). Hover or keyboard-focus a dotted link to see its source. The curated mappings and aliases live in `js/definitions.js`; unknown terms stay unchanged. Existing links, code, inputs and unfinished exam questions are excluded. Embedded PDFs and Google Docs retain their own document text and links. Matching runs locally without transmitting notes.

### Focused workspace interface

The interface now uses a shared black-and-white visual system with light and dark themes. Today puts the schedule and tasks immediately after the day summary, limits upcoming work to five records, and keeps statistics, class shortcuts and review history collapsed. Example/template deadlines are excluded from the Today preview but remain manageable in Tasks and Calendar. The Tasks hub previews eight records per section until a source is selected. Explore tools and Create actions open on demand.

Class pages have Overview, Materials, Tasks and Class info tabs. Overview previews four open tasks; the Tasks tab shows all open class tasks. Existing notes open in Read mode; creating a note opens Write mode. Google Docs setup, the generated practice prompt and advanced practice settings stay collapsed until needed. Startup reminders are stored quietly in the bell rather than showing a burst of alerts; scheduled deadline reminders continue to use configured notification settings.

Visual tokens and component refinements live in `css/workspace.css`; [DESIGN.md](DESIGN.md) records the design choices. The `frontend-design` Codex skill was installed from `anthropics/skills` and used for the overhaul.

Navigation follows **Plan → Classes → Materials → Tools**. Each class expands into Overview, Materials, Tasks & deadlines and Class info. Breadcrumbs keep the class and current page visible, including on narrow screens. The UI palette is strictly black, white and neutral grey in both themes; classes are distinguished by shapes and names. LeetCode is self-paced: legacy review due dates are removed, ratings record practice history without scheduling another session, and every problem remains available to practice.

## Reliability checks

`npm run check` runs regression tests and the production build. The same checks run on pushes and pull requests through GitHub Actions.

If saved data can’t be read, the app preserves the original bytes and pauses saving. Use **Download original data**, then restore a known-good backup or explicitly reset in Settings. Storage-full errors remain visible until saving succeeds; export a backup before closing a tab with unsaved changes.

Production builds combine the existing study scripts into one minified file with a content-based filename. Search runs only while open, and specialized editors retain their DOM when unrelated data saves. File storage retries failed database opens and reports aborted transactions.

`npm run check` also checks startup asset references and bundle-size budgets. Run `npm run check:build` to inspect an existing `dist/` build. Search loads on demand and reuses its text index between edits; typing in global search keeps the underlying workspace intact. Size checks report gzip equivalents, not a guarantee that your static server enables compression.
