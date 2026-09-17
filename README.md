# Study Hub

A black-and-white study app that runs entirely in your browser. There's nothing to install and no account.
**Open `index.html`** (double-click it). Everything saves automatically in that browser.

Set up for Operating Systems, Computer Security, Nutrition and Health, and the Advanced Seminar in Urban Studies.

## Where things are

| Sidebar | What's inside |
|---|---|
| **Today** | A greeting and one-line summary, what's happening right now, next class, next exam, focus time, cards due, today's plan, what's coming up, and a card for each class |
| **Classes** | *Classes*: one page per class with lectures (tick them off as they're covered), notes, topics, grade, class times, links and books, deadlines and class info. *Grades*: enter scores, see your current grade and what you need on the rest |
| **Notes** | *All notes*: Markdown editor with `[[links]]` and highlighted code. *Code*: snippet library with "explain / debug / trace / find the vulnerability" prompts. *Add material*: bring in slides, notes and source files you already have |
| **Flashcards** | Review (spaced repetition, keys `1`–`4`), browse, *Make with AI* (ChatGPT prompt, then paste its reply), write a card |
| **AI** | *Ask ChatGPT*: builds the prompt, copies it, opens ChatGPT. *Summarize*: key points and suggested cards, made inside the app |
| **LeetCode** | *Problems*: every problem you've solved, from your Obsidian vault, with filters by difficulty and pattern. *Practice*: re-solve problems on a spaced schedule |
| **Map** | *Graph*: everything you know as a network. *Skill tree*: topic order per class. *Connections*: how many steps apart any two things are |
| **Planner** | *Calendar* (Month, Week, Agenda) for scheduled events and deadlines, *Day plan* time blocks, *To-do* outline, *Tasks* for everyday to-dos and a daily routine, *Exams* with countdowns, readiness and a day-by-day study plan |
| **Focus** | Pomodoro timer that keeps running while you use the app, with study time per day and per class |

## Reminders
The bell in the top bar collects reminders: the day before something is due, the morning it's due, an hour before, when it becomes overdue, a week and 3 days before exams, before class starts, and once a day when flashcards are due. Turn on desktop notifications from the bell or in **Settings → Reminders**. Reminders only run while Study Hub is open (a background tab is fine).

## Your course content
`js/packs-data.js` and `js/packs.js` / `js/packs-more.js` load your real Fall 2026 content once: syllabi details, class times, deadlines and exams, lecture notes built from the slides (Operating Systems lectures 1–21, Security weeks 1–2, Nutrition chapters 1–2), your own notes and reading notes from `Desktop\info`, and flashcards for what's been covered so far. The slides, syllabi and textbooks are copied into `library/`, and notes link straight to them (textbook readings open at the right page). Dates marked "confirm" in the notes weren't fully spelled out in the syllabus.

Classes are told apart by **shape**, not color: ■ OS, ▲ Security, ● Nutrition, ◆ Urban Studies (change a shape under Classes, then *Rename or change mark*).

## Adding slides and existing notes

Click **Add material** in the top bar, or drop files onto the Notes page.

- **PDF** slides or readings, **PowerPoint (.pptx)** including speaker notes, **Word (.docx)**, **Markdown / text**, and **web pages (.html)**
- **Choose a folder** to bring in a whole course folder or an **Obsidian vault**. Its `[[links]]`, front-matter tags and `#tags` are kept.
- Each file is matched to a class from its name, and you can change the match before adding. Each file becomes a new note, or you can add it to the end of a note you already have.
- The original PDF, PPTX or DOCX is kept in the browser, so an imported note can reopen it.
- Old `.ppt` / `.doc` files need to be saved as `.pptx`, `.docx` or PDF first. Scanned PDFs have no text to pull out.
- The PDF and Office readers load from the internet the first time you import one of those files. Everything else works offline.

## Calendar
- **Event** is something you attend: a class session, study group, appointment or shift. It has start and end times, a location, and can repeat (daily, weekdays, weekly, every 2 weeks, monthly) until a date you pick.
- **Deadline** is something due. You can check it off, and it shows as overdue if you miss it.
- In **Week**, click an empty slot to add an event at that time. When you open one repeat of an event, you can delete just that day.
- **Import .ics / Export .ics** (bottom of the calendar sidebar) moves events to and from Google, Outlook or Apple Calendar.

## LeetCode
Problems come from `Vault/4 - Main Notes/Leetcode/<Easy|Medium|Hard>/<number>. <Title>.md`. Each note needs the solution in a code block. The LeetCode link and notes below the code are optional.

- **After solving more problems**, run `node tools/sync-leetcode.js` and reload the app. New problems are added, changed code and notes are updated, and your practice history is kept. Or click **Sync from vault** and pick the vault or its `Leetcode` folder.
- **Practice** shows up to three new problems a day. Open the problem on LeetCode, solve it from a blank editor, then click **Show my solution** and grade how it went. *Couldn't* brings it back tomorrow; *Easy* pushes it out further.
- The **pattern** is guessed from the problem number (NeetCode list). Change it, and add a one-line **key idea**, on the problem's page. Both are saved in the app only; your vault isn't changed.
- **Open in Obsidian** jumps to the note. **Review with ChatGPT** asks for complexity, missed edge cases and a better approach.

## Tips
- `Ctrl+K` or `/` searches everything.
- Starter deadlines are marked **[Template]**. Remove them in **Settings → Remove example deadlines**.
- **Settings → Export backup** regularly. The backup has your notes and cards, including text pulled from slides, but not the original files.

## Files
```
index.html          app shell
css/styles.css      all styling (white and black themes)
js/core.js          storage, file store, markdown, graph model, spaced repetition, icons, class marks
js/seed.js          starter template (classes, topics, starter cards)
js/importer.js      PDF / PPTX / DOCX / Markdown / HTML → note text
js/ai.js            ChatGPT prompt templates + offline summarizer
js/graph.js         canvas graph + skill-tree layout
js/views-*.js       one file per area of the app
js/app.js           router, sidebar, search
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
"# study-tool" 
