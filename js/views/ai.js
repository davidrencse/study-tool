/* ==========================================================================
   views-ai.js — AI Assist (→ ChatGPT in browser) and AI Summary (in-app)
   ========================================================================== */

const AssistUI = { tpl: 'explain', classId: '', topicId: '', noteId: '', extra: '' };

function assistContext() {
  const c = getClass(AssistUI.classId);
  const t = getTopic(AssistUI.topicId);
  const n = getNote(AssistUI.noteId);
  return {
    cls: c ? c.name : 'my classes',
    topic: t ? t.name : '',
    note: n ? n.body.trim().slice(0, 12000) : '',
    extra: AssistUI.extra.trim(),
  };
}

Views.assist = {
  title: 'Ask ChatGPT',
  render(_, query) {
    // apply URL params only when arriving via a new link, not on every re-render
    if (location.hash !== AssistUI._hash) {
      AssistUI._hash = location.hash;
      if (query.class !== undefined) AssistUI.classId = query.class;
      if (query.note !== undefined) {
        AssistUI.noteId = query.note;
        AssistUI.tpl = query.tpl || 'summarize';
        const n = getNote(query.note);
        if (n?.classId) AssistUI.classId = n.classId;
      }
      if (query.topic !== undefined) {
        AssistUI.topicId = query.topic;
        AssistUI.classId = getTopic(query.topic)?.classId || AssistUI.classId;
      }
      if (query.tpl) AssistUI.tpl = query.tpl;
    }
    if (AssistUI.topicId && getTopic(AssistUI.topicId)?.classId !== AssistUI.classId) AssistUI.topicId = '';

    const tpl = PROMPT_TEMPLATES.find((p) => p.id === AssistUI.tpl) || PROMPT_TEMPLATES[0];
    const notes = S().notes.filter((n) => !AssistUI.classId || n.classId === AssistUI.classId || !n.classId);

    return `
    <header class="page-head">
      <div><h1>Ask ChatGPT</h1><p class="lede">Pick what you need. The app writes the prompt, copies it and opens ChatGPT.</p></div>
      <div class="head-actions"><a class="btn" href="${esc(safeLink(S().settings.chatUrl))}" target="_blank" rel="noopener">Open ChatGPT ${icon('external', 15)}</a></div>
    </header>

    <div class="grid-2 assist-grid">
      <div class="stack">
        <section class="panel">
          <header class="panel-head"><h2>What it’s about</h2></header>
          <div class="form">
            <div class="form-row">
              <label>Class<select data-a="classId">${classOptions(AssistUI.classId, { includeNone: true, noneLabel: 'All classes' })}</select></label>
              <label>Topic<select data-a="topicId">${topicOptions(AssistUI.classId, AssistUI.topicId, { noneLabel: 'Whole class' })}</select></label>
            </div>
            <label>Include a note (optional)<select data-a="noteId"><option value="">No note</option>${notes.map((n) => `<option value="${n.id}" ${n.id === AssistUI.noteId ? 'selected' : ''}>${esc(n.title)}</option>`).join('')}</select></label>
            <label>Your question / extra details<textarea data-a="extra" rows="3" placeholder="I don't get why paging needs a TLB">${esc(AssistUI.extra)}</textarea></label>
          </div>
        </section>
        <section class="panel">
          <header class="panel-head"><h2>What you want</h2></header>
          <div class="tpl-grid">
            ${PROMPT_TEMPLATES.map((p) => `
              <button class="tpl ${p.id === tpl.id ? 'active' : ''}" data-tpl="${p.id}" aria-pressed="${p.id === tpl.id}">
                <span class="tpl-name">${esc(p.name)}</span><span class="tpl-desc">${esc(p.desc)}</span>
              </button>`).join('')}
          </div>
        </section>
      </div>

      <div class="stack">
        <section class="panel sticky">
          <header class="panel-head"><h2>Prompt</h2><span class="muted small" data-count></span></header>
          <textarea class="prompt-box" rows="16" aria-label="Prompt preview">${esc(tpl.build(assistContext()))}</textarea>
          <div class="btn-row">
            <button class="btn primary" data-act="send">Copy and open ChatGPT ${icon('external', 15)}</button>
            <button class="btn" data-act="copy">Copy only</button>
            <button class="btn ghost" data-act="regen">Undo my edits</button>
          </div>
          <p class="hint">Edit it freely before sending. ${S().settings.prefillUrl ? 'ChatGPT opens with it filled in.' : 'In ChatGPT, paste with <kbd>Ctrl</kbd> <kbd>V</kbd>.'}</p>
        </section>

        <section class="panel">
          <header class="panel-head"><h2>Save the answer</h2></header>
          <p class="hint">Paste ChatGPT’s reply to keep it with your notes.${tpl.id === 'flashcards' ? ' For flashcards, use the <a href="#/cards?tab=import">flashcard importer</a>.' : ''}</p>
          <textarea class="paste-back" rows="5" placeholder="Paste the response…"></textarea>
          <div class="form-row">
            <select data-back-note aria-label="Target note"><option value="__new">New note</option>${S().notes.map((n) => `<option value="${n.id}" ${n.id === AssistUI.noteId ? 'selected' : ''}>${esc(n.title)}</option>`).join('')}</select>
            <button class="btn" data-act="save-back">Save to note</button>
          </div>
        </section>
      </div>
    </div>`;
  },

  mount(el) {
    const box = $('.prompt-box', el);
    const count = $('[data-count]', el);
    const updateCount = () => (count.textContent = `${box.value.length.toLocaleString()} chars`);
    const regen = () => {
      const tpl = PROMPT_TEMPLATES.find((p) => p.id === AssistUI.tpl);
      box.value = tpl.build(assistContext());
      updateCount();
    };
    updateCount();
    box.addEventListener('input', updateCount);

    el.addEventListener('change', (e) => {
      const k = e.target.dataset.a;
      if (!k) return;
      AssistUI[k] = e.target.value;
      if (k === 'classId') {
        AssistUI.topicId = '';
        App.refresh();
      } else regen();
    });
    $('[data-a="extra"]', el).addEventListener('input', debounce((e) => {
      AssistUI.extra = e.target.value;
      regen();
    }, 250));

    el.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tpl]');
      if (t) {
        AssistUI.tpl = t.dataset.tpl;
        $$('.tpl', el).forEach((x) => {
          x.classList.toggle('active', x === t);
          x.setAttribute('aria-pressed', x === t);
        });
        regen();
        return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'send') sendToChatGPT(box.value);
      if (act === 'copy') toast((await copyText(box.value)) ? 'Prompt copied.' : 'Copy failed — select and copy manually.', 'ok');
      if (act === 'regen') regen();
      if (act === 'save-back') {
        const text = $('.paste-back', el).value.trim();
        if (!text) return toast('Paste a response first.', 'warn');
        const target = $('[data-back-note]', el).value;
        const tpl = PROMPT_TEMPLATES.find((p) => p.id === AssistUI.tpl);
        const heading = `\n\n## ChatGPT: ${tpl.name}, ${fmtDate(todayStr())}\n\n`;
        let note;
        if (target === '__new') {
          const topic = getTopic(AssistUI.topicId);
          note = createNote({ title: `${tpl.name}: ${topic?.name || getClass(AssistUI.classId)?.name || 'AI notes'}`, classId: AssistUI.classId, body: text, tags: ['ai'] });
        } else {
          note = getNote(target);
          note.body += heading + text;
          note.updated = Date.now();
          Store.save();
        }
        toast('Answer saved to note', 'ok');
        location.hash = `#/notes/${note.id}`;
      }
    });
  },
};

/* ------------------------------ AI Summary ------------------------------ */
const SummaryUI = { source: 'note', noteId: '', text: '', length: 5, engine: 'offline', result: null, busy: false, error: '', classId: '', topicId: '' };

function summarySourceText() {
  if (SummaryUI.source === 'note') return getNote(SummaryUI.noteId)?.body || '';
  return SummaryUI.text;
}

Views.summary = {
  title: 'Summarize',
  render(_, query) {
    if (query.note && query.note !== SummaryUI._fromQuery) {
      SummaryUI._fromQuery = query.note;
      SummaryUI.source = 'note';
      SummaryUI.noteId = query.note;
      SummaryUI.result = null;
      SummaryUI.classId = getNote(query.note)?.classId || '';
    }
    if (!SummaryUI.noteId && S().notes[0]) SummaryUI.noteId = S().notes[0].id;
    const hasKey = !!S().settings.openaiKey;
    if (!hasKey) SummaryUI.engine = 'offline';
    const r = SummaryUI.result;
    const note = getNote(SummaryUI.noteId);

    return `
    <header class="page-head">
      <div><h1>Summarize</h1><p class="lede">Key points, key terms and suggested flashcards, made right here in the app.</p></div>
    </header>

    <div class="grid-2">
      <section class="panel">
        <header class="panel-head"><h2>Source</h2></header>
        <div class="seg" role="radiogroup" aria-label="Source">
          <label><input type="radio" name="source" value="note" ${SummaryUI.source === 'note' ? 'checked' : ''}><span>A note</span></label>
          <label><input type="radio" name="source" value="paste" ${SummaryUI.source === 'paste' ? 'checked' : ''}><span>Pasted text</span></label>
        </div>
        ${SummaryUI.source === 'note'
          ? `<select data-s="noteId" aria-label="Note">${S().notes.map((n) => `<option value="${n.id}" ${n.id === SummaryUI.noteId ? 'selected' : ''}>${esc(n.title)}</option>`).join('')}</select>
             <div class="source-preview prose">${note ? renderMarkdown(note.body) : '<p class="muted">No notes yet.</p>'}</div>`
          : `<textarea data-s="text" rows="14" placeholder="Paste a reading, slides or a transcript">${esc(SummaryUI.text)}</textarea>`}

        <div class="form">
          <label>Key points: <b data-len-label>${SummaryUI.length}</b><input type="range" min="3" max="12" value="${SummaryUI.length}" data-s="length"></label>
          <fieldset><legend>Engine</legend>
            <div class="seg">
              <label><input type="radio" name="engine" value="offline" ${SummaryUI.engine === 'offline' ? 'checked' : ''}><span>Built in, offline</span></label>
              <label title="${hasKey ? '' : 'Add an API key in Settings'}"><input type="radio" name="engine" value="api" ${SummaryUI.engine === 'api' ? 'checked' : ''} ${hasKey ? '' : 'disabled'}><span>OpenAI${hasKey ? '' : ' (add a key in Settings)'}</span></label>
            </div>
          </fieldset>
        </div>
        <div class="btn-row">
          <button class="btn primary" data-act="run" ${SummaryUI.busy ? 'disabled' : ''}>${SummaryUI.busy ? 'Summarizing…' : 'Summarize'}</button>
          <button class="btn" data-act="chatgpt">Use ChatGPT instead ${icon('external', 15)}</button>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head"><h2>Result</h2>${r ? `<span class="muted small">${r.stats.words} words, about ${r.stats.readMin} min to read</span>` : ''}</header>
        ${SummaryUI.error ? `<div class="callout strong">${esc(SummaryUI.error)}</div>` : ''}
        ${!r ? emptyState('spark', 'Nothing summarized yet', 'Choose a note or paste text, then press Summarize.') : `
          <h3 class="sub">Key points</h3>
          <ul class="summary-list">${r.summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
          <h3 class="sub">Key terms</h3>
          <div class="chips">${r.terms.map((t) => `<span class="chip">${esc(t)}</span>`).join('') || '<span class="muted small">None found</span>'}</div>
          <div class="btn-row">
            <button class="btn sm" data-act="copy-md">Copy as Markdown</button>
            <button class="btn sm" data-act="save-note">${SummaryUI.source === 'note' && note ? 'Add to the end of the note' : 'Save as a new note'}</button>
          </div>

          <h3 class="sub">Suggested flashcards</h3>
          ${r.cards.length ? `
            <ul class="suggest-cards">
              ${r.cards.map((c, i) => `
                <li><label class="check"><input type="checkbox" data-card="${i}" checked>
                  <span><b>${esc(c.front)}</b><br><span class="muted">${esc(c.back)}</span></span></label></li>`).join('')}
            </ul>
            <div class="form-row">
              <select data-s="classId" aria-label="Deck">${classOptions(SummaryUI.classId, { includeNone: true, noneLabel: 'No class' })}</select>
              <select data-s="topicId" aria-label="Topic">${topicOptions(SummaryUI.classId, SummaryUI.topicId, { noneLabel: 'No topic' })}</select>
              <button class="btn primary" data-act="add-cards">Add selected cards</button>
            </div>
            <p class="hint">Picked by rule, not written by AI. Uncheck any that don’t make sense.</p>`
          : '<p class="hint">No card suggestions for this text.</p>'}
        `}
      </section>
    </div>`;
  },

  mount(el) {
    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'source' || t.name === 'engine') {
        SummaryUI[t.name] = t.value;
        App.refresh();
      }
      const k = t.dataset.s;
      if (k === 'noteId') {
        SummaryUI.noteId = t.value;
        SummaryUI.result = null;
        SummaryUI.classId = getNote(t.value)?.classId || '';
        App.refresh();
      }
      if (k === 'classId') {
        SummaryUI.classId = t.value;
        SummaryUI.topicId = '';
        App.refresh();
      }
      if (k === 'topicId') SummaryUI.topicId = t.value;
    });
    el.addEventListener('input', (e) => {
      const k = e.target.dataset.s;
      if (k === 'text') SummaryUI.text = e.target.value;
      if (k === 'length') {
        SummaryUI.length = +e.target.value;
        $('[data-len-label]', el).textContent = e.target.value;
      }
    });

    el.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      const text = summarySourceText();
      if (act === 'run') {
        if (text.trim().length < 40) return toast('Give me a bit more text to summarize.', 'warn');
        SummaryUI.error = '';
        if (SummaryUI.engine === 'api') {
          SummaryUI.busy = true;
          App.refresh();
          try {
            SummaryUI.result = await summarizeWithOpenAI(text, { sentences: SummaryUI.length, className: className(SummaryUI.classId) });
          } catch (err) {
            SummaryUI.error = err.message + '. Showing the built-in summary instead.';
            SummaryUI.result = summarizeOffline(text, { sentences: SummaryUI.length });
          }
          SummaryUI.busy = false;
        } else {
          SummaryUI.result = summarizeOffline(text, { sentences: SummaryUI.length });
        }
        App.refresh();
      }
      if (act === 'chatgpt') {
        const tpl = PROMPT_TEMPLATES.find((p) => p.id === 'summarize');
        sendToChatGPT(tpl.build({ cls: getClass(SummaryUI.classId)?.name || 'my class', topic: '', note: text.slice(0, 12000), extra: `Aim for about ${SummaryUI.length} main bullet points.` }));
      }
      const r = SummaryUI.result;
      if (!r) return;
      const md = `## Summary, ${fmtDate(todayStr())}\n\n${r.summary.map((s) => `- ${s}`).join('\n')}\n\n**Key terms:** ${r.terms.join(', ')}\n`;
      if (act === 'copy-md') toast((await copyText(md)) ? 'Copied.' : 'Copy failed.', 'ok');
      if (act === 'save-note') {
        const note = getNote(SummaryUI.noteId);
        if (SummaryUI.source === 'note' && note) {
          note.body = note.body.trimEnd() + '\n\n' + md;
          note.updated = Date.now();
          Store.save();
          toast('Summary appended to note.', 'ok');
        } else {
          const n = createNote({ title: `Summary — ${fmtDate(todayStr())}`, classId: SummaryUI.classId, body: md + '\n---\n\n## Source\n\n' + text, tags: ['summary'] });
          toast('Saved as a new note.', 'ok');
          location.hash = `#/notes/${n.id}`;
        }
      }
      if (act === 'add-cards') {
        const picked = $$('[data-card]:checked', el).map((c) => r.cards[+c.dataset.card]);
        if (!picked.length) return toast('Select at least one card.', 'warn');
        picked.forEach((c) => S().cards.push(newCard({ ...c, classId: SummaryUI.classId, topicId: SummaryUI.topicId, source: 'summary' })));
        Store.save();
        toast(`Added ${picked.length} card${picked.length === 1 ? '' : 's'}.`, 'ok');
      }
    });
  },
};
