/* ==========================================================================
   views-notes.js — Markdown notes with [[wikilinks]], backlinks, AI hand-offs
   ========================================================================== */

const NotesUI = { mode: 'preview', q: '', kind: '' };

function googleDocEmbed(raw, preview = true) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || url.username || url.password || url.port) return null;
    if (!/^\/document\/(?:u\/\d+\/)?d\/(?:e\/)?[\w-]+(?:\/(?:edit|view|preview|pub))?\/?$/.test(url.pathname)) return null;
    if (preview && !/\/d\/e\//.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/(?:edit|view|preview)\/?$/, '').replace(/\/$/, '') + '/preview';
    }
    if (/\/pub\/?$/.test(url.pathname)) url.searchParams.set('embedded', 'true');
    return url.href;
  } catch (_) { return null; }
}

function googleDocPanel(n) {
  const doc = n.googleDoc || {};
  const embed = googleDocEmbed(doc.embedUrl || doc.url, !doc.embedUrl);
  const open = googleDocEmbed(doc.url, false);
  return `<section class="google-doc-panel" aria-label="Google Docs">
    <details>
      <summary>${embed ? 'Google Docs settings' : 'Attach a Google Doc'}</summary>
      <form class="google-doc-form">
        <label>Document or section URL<input name="doc-url" type="url" placeholder="https://docs.google.com/document/d/…/edit#heading=…" value="${esc(doc.url)}" required></label>
        <label>Custom embed URL (optional)<input name="embed-url" type="url" placeholder="Published or preview Google Docs URL" value="${esc(doc.embedUrl)}"></label>
        <p class="muted small">Paste a heading or bookmark link to save your place. Google may ignore section targets inside the embed; Open in Google Docs keeps the full link. Private docs need Google sign-in and access. A published URL can be used for a read-only embed.</p>
        <div class="btn-row"><button class="btn sm" type="submit">Save document</button>${doc.url ? '<button class="btn sm ghost" type="button" data-act="remove-doc">Remove document</button>' : ''}</div>
      </form>
    </details>
    ${embed && open ? `<div class="source-bar"><strong>Google Docs</strong><span class="spacer"></span><a class="btn sm" href="${esc(open)}" target="_blank" rel="noopener">Open in Google Docs</a></div>
      <iframe class="google-doc-frame" src="${esc(embed)}" title="Google document for ${esc(n.title || 'Untitled note')}" loading="lazy" referrerpolicy="no-referrer" allowfullscreen></iframe>
      <p class="muted small">If Google blocks the embed or asks you to sign in, use Open in Google Docs. Document images are displayed by Google.</p>` : ''}
  </section>`;
}

function slidePdfPath(n) {
  const path = n.source?.path || '';
  return /^library\/[^?#]+\.pdf(?:[?#].*)?$/i.test(path) ? path : '';
}

function isPdfNote(n) {
  return !!slidePdfPath(n) || n.source?.kind === 'pdf';
}

function notePdfFiles(n) {
  const files = [];
  const add = (path, label) => {
    if (!/^library\/[^?#]+\.pdf(?:[?#].*)?$/i.test(path)) return;
    let key;
    try { key = decodeURI(path); } catch (_) { key = path; }
    if (!files.some((f) => f.key === key)) files.push({ path, label, key });
  };
  if (slidePdfPath(n)) add(slidePdfPath(n), n.source.name || 'Original PDF');
  for (const match of (n.body || '').matchAll(/\[([^\]]+)\]\((library\/[^\s)]+\.pdf(?:[?#][^\s)]*)?)\)/gi)) add(match[2], match[1]);
  return files;
}

function slidePdfPanel(n) {
  const files = notePdfFiles(n);
  const path = files.find((f) => f.path === n.pdfViewPath)?.path || slidePdfPath(n) || files[0]?.path || '';
  if (!isPdfNote(n)) return '';
  if (!path && !n.source.fileId) return '<section class="slide-pdf-panel"><p>The original PDF is missing. Import the PDF again to display it.</p></section>';
  return `<section class="slide-pdf-panel" aria-label="Original PDF">
    <div class="source-bar"><strong>Original PDF</strong><span class="spacer"></span>
      ${files.length > 1 ? `<select class="pdf-file-select" aria-label="PDF document">${files.map((f) => `<option value="${esc(f.path)}" ${path === f.path ? 'selected' : ''}>${esc(f.label)} — ${esc(f.key.split('/').pop().split('#')[0])}</option>`).join('')}</select>` : ''}
      ${path ? `<a class="btn sm pdf-open" href="${esc(path)}" target="_blank" rel="noopener">Open PDF</a>` : '<button class="btn sm" data-act="original">Open PDF</button>'}
    </div>
    <iframe class="slide-pdf-frame" ${path ? `src="${esc(path)}"` : ''} title="Original PDF for ${esc(n.title)}"></iframe>
    <p class="muted small pdf-status">${path ? 'Use Open PDF if your browser cannot display the document here.' : 'Loading original PDF…'}</p>
  </section>`;
}

function noteBacklinks(note) {
  return S().notes.filter((n) => n.id !== note.id && extractWikilinks(n.body).some((w) => {
    const r = resolveWiki(w);
    return r?.kind === 'note' && r.id === note.id;
  }));
}

function noteMatches(n, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q));
}

const NOTE_KINDS = [
  ['', 'All notes'],
  ['written', 'Written'],
  ['imported', 'Slides & files'],
];

Views.notes = {
  title: 'Notes',
  render([id], query) {
    const classFilter = query.class ?? '';
    const all = S().notes.slice().sort((a, b) => b.updated - a.updated);
    const list = all.filter((n) =>
      (classFilter === '' || n.classId === classFilter) &&
      noteMatches(n, NotesUI.q) &&
      (!NotesUI.kind || (NotesUI.kind === 'imported') === !!n.source));
    const note = id ? getNote(id) : list[0];
    this._current = note?.id;
    const q = classFilter ? `?class=${classFilter}` : '';

    return `
    <header class="page-head materials-head"><div><h1>Notes & slides</h1><p class="lede">Your class materials, with space to think.</p></div><a class="btn primary" href="#/import${q}">${icon('upload',16)}Add material</a></header>
    <div class="notes-layout mode-${NotesUI.mode}">
      <aside class="panel notes-side" aria-label="Note list">
        <div class="notes-side-head">
          <input type="search" class="notes-search" placeholder="Search notes" value="${esc(NotesUI.q)}" aria-label="Search notes">
          <button class="icon-btn" data-act="new" aria-label="New note" title="New note">${icon('plus')}</button>
        </div>
        <div class="filter-row">
          <select data-filter="class" aria-label="Class"><option value="">All classes</option>${S().classes.map((c) => `<option value="${c.id}" ${c.id === classFilter ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
          <select data-filter="kind" aria-label="Kind">${NOTE_KINDS.map(([k, l]) => `<option value="${k}" ${k === NotesUI.kind ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>
        <ul class="note-list">
          ${list.map((n) => `
            <li><a href="#/notes/${n.id}${q}" class="${n.id === note?.id ? 'active' : ''}" data-note="${n.id}" ${n.id === note?.id ? 'aria-current="true"' : ''}>
              <span class="note-list-title">${n.classId ? mark(n.classId) : ''}<span data-title>${esc(n.title || 'Untitled')}</span></span>
              <span class="note-list-meta">${n.source ? `${esc(n.source.kindLabel || 'File')}, ` : ''}${new Date(n.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </a></li>`).join('') || '<li class="rows-empty">No notes match.</li>'}
        </ul>
        <a class="btn block" href="#/import${q}">${icon('upload', 16)}Add slides or notes</a>
      </aside>

      <section class="panel note-editor" data-drop>
        ${note ? this.editor(note) : emptyState('notes', 'No notes here yet', 'Write one, or bring in slides and notes you already have.', `<div class="btn-row center"><button class="btn primary" data-act="new">New note</button><a class="btn" href="#/import${q}">Add material</a></div>`)}
      </section>
    </div>`;
  },

  editor(n) {
    const pdf = isPdfNote(n);
    const back = noteBacklinks(n);
    const out = [...new Set(extractWikilinks(n.body))];
    return `
      <input class="note-title" value="${esc(n.title)}" placeholder="Untitled" aria-label="Note title">
      <div class="note-meta">
        <select data-field="classId" aria-label="Class">${classOptions(n.classId, { includeNone: true, noneLabel: 'No class' })}</select>
        <input data-field="tags" value="${esc(n.tags.join(', '))}" placeholder="Tags, separated by commas" aria-label="Tags">
        ${pdf ? '' : `<div class="seg sm" role="radiogroup" aria-label="Editor layout">
          ${[['write', 'Write'], ['split', 'Split'], ['preview', 'Read']].map(([m, l]) => `<label><input type="radio" name="mode" value="${m}" ${NotesUI.mode === m ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </div>`}
      </div>
      ${n.source && !pdf ? `
        <div class="source-bar">
          ${icon(n.source.kind === 'pptx' || n.source.kind === 'pdf' ? 'slides' : 'file', 16)}
          <span>Imported from <strong>${esc(n.source.name)}</strong>${n.source.units ? `, ${plural(n.source.units, n.source.unitLabel || 'page')}` : ''}</span>
          <span class="spacer"></span>
          ${n.source.fileId ? `<button class="btn sm" data-act="original">${n.source.kind === 'pdf' ? 'Open original' : 'Download original'}</button>` : ''}
        </div>` : ''}
      ${slidePdfPanel(n)}
      ${!pdf || n.googleDoc ? googleDocPanel(n) : ''}
      ${pdf ? `<label class="pdf-annotations">Your notes<textarea class="pdf-notes" rows="4" placeholder="Write your own notes about these slides…">${esc(n.annotations || '')}</textarea></label>` : `<div class="md-toolbar" role="toolbar" aria-label="Formatting">
        <button data-md="h" title="Heading" aria-label="Heading">H</button>
        <button data-md="b" title="Bold (Ctrl+B)" aria-label="Bold"><b>B</b></button>
        <button data-md="i" title="Italic (Ctrl+I)" aria-label="Italic"><i>I</i></button>
        <button data-md="hl" title="Highlight" aria-label="Highlight"><mark>ab</mark></button>
        <button data-md="ul" title="Bulleted list" aria-label="Bulleted list">List</button>
        <button data-md="todo" title="Checklist" aria-label="Checklist">Todo</button>
        <button data-md="code" title="Code" aria-label="Code">Code</button>
        <button data-md="image" title="Insert image URL" aria-label="Insert image URL">Image</button>
        <select data-md="link" aria-label="Link to a topic or note">
          <option value="">Link to...</option>
          <optgroup label="Classes">${S().classes.map((c) => `<option>${esc(c.name)}</option>`).join('')}</optgroup>
          ${S().classes.map((c) => `<optgroup label="${esc(c.name)} topics">${topicsOf(c.id).map((t) => `<option>${esc(t.name)}</option>`).join('')}</optgroup>`).join('')}
          <optgroup label="Notes">${S().notes.filter((x) => x.id !== n.id).map((x) => `<option>${esc(x.title)}</option>`).join('')}</optgroup>
        </select>
        <span class="spacer"></span>
        <span class="muted small save-state" aria-live="polite">Saved</span>
      </div>
      <div class="md-panes">
        <textarea class="md-input" spellcheck="true" aria-label="Note text" placeholder="Write in Markdown. Link ideas with [[Topic name]].">${esc(n.body)}</textarea>
        <article class="md-preview prose">${renderMarkdown(n.body)}</article>
      </div>`}
      <footer class="note-foot">
        <dl class="link-summary">
          <div><dt>Links</dt><dd>${out.map((w) => `<a href="#" class="wikilink ${resolveWiki(w) ? '' : 'missing'}" data-wiki="${esc(w)}">${esc(w)}</a>`).join(' ') || '<span class="muted">None</span>'}</dd></div>
          <div><dt>Linked from</dt><dd>${back.map((b) => `<a href="#/notes/${b.id}">${esc(b.title)}</a>`).join(', ') || '<span class="muted">None</span>'}</dd></div>
        </dl>
        <div class="btn-row">
          <a class="btn sm" href="#/summary?note=${n.id}">Summarize</a>
          ${n.classId?`<a class="btn sm" href="#/practice?tab=prompt&class=${n.classId}&note=${n.id}">Make practice test</a>`:''}
          <a class="btn sm" href="#/assist?note=${n.id}${n.classId ? `&class=${n.classId}` : ''}">Ask ChatGPT</a>
          <a class="btn sm" href="#/cards?tab=import&note=${n.id}${n.classId ? `&class=${n.classId}` : ''}">Make flashcards</a>
          <a class="btn sm ghost" href="#/graph?focus=n:${n.id}">Show on map</a>
          <span class="spacer"></span>
          <button class="btn sm ghost danger" data-act="delete">Delete note</button>
        </div>
      </footer>`;
  },

  mount(el, [id], query) {
    const n = this._current && getNote(this._current);
    const saveState = $('.save-state', el);
    const persist = debounce(() => {
      Store.save();
      if (saveState) saveState.textContent = 'Saved';
    }, 400);
    const touch = () => {
      n.updated = Date.now();
      if (saveState) saveState.textContent = 'Saving';
      persist();
    };

    $('.notes-search', el).addEventListener('input', debounce((e) => {
      NotesUI.q = e.target.value;
      App.refresh();
      const s = $('.notes-search', App.viewEl);
      s.focus();
      s.setSelectionRange(s.value.length, s.value.length);
    }, 200));
    el.addEventListener('change', (e) => {
      const f = e.target.dataset.filter;
      if (f === 'class') location.hash = `#/notes${e.target.value ? `?class=${e.target.value}` : ''}`;
      if (f === 'kind') {
        NotesUI.kind = e.target.value;
        App.refresh();
      }
    });

    el.addEventListener('click', (e) => {
      const wl = e.target.closest('.wikilink');
      if (wl) {
        e.preventDefault();
        openWiki(wl.dataset.wiki);
        return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'new') {
        NotesUI.mode='write';
        const note = createNote({ classId: query.class || '' });
        location.hash = `#/notes/${note.id}${query.class ? `?class=${query.class}` : ''}`;
      }
      if (act === 'original' && n) openOriginal(n);
      if (act === 'delete' && n && confirm(`Delete “${n.title}”? This can’t be undone.`)) {
        deleteNote(n.id);
        location.hash = '#/notes';
      }
    });

    // drop files anywhere on the notes page to import them
    el.addEventListener('dragover', (e) => {
      if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
      e.preventDefault();
      el.classList.add('dropping');
    });
    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) el.classList.remove('dropping');
    });
    el.addEventListener('drop', (e) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      el.classList.remove('dropping');
      ImportUI.addFiles([...e.dataTransfer.files], query.class || n?.classId || '');
      location.hash = `#/import${query.class ? `?class=${query.class}` : ''}`;
    });

    if (!n) return;
    $('.pdf-file-select', el)?.addEventListener('change', (e) => {
      const path = e.target.value;
      if (!notePdfFiles(n).some((f) => f.path === path)) return;
      n.pdfViewPath = path;
      $('.slide-pdf-frame', el).src = path;
      $('.pdf-open', el).href = path;
      Store.save();
    });
    const pdfFrame = $('.slide-pdf-frame', el);
    if (pdfFrame && !slidePdfPath(n)) {
      FileStore.get(n.source.fileId).then((blob) => {
        if (!el.isConnected) return;
        const status = $('.pdf-status', el);
        if (!blob) {
          pdfFrame.remove();
          status.textContent = 'The original PDF is missing from this browser. Import the file again; backups contain extracted text but not original files.';
          return;
        }
        this._pdfUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        pdfFrame.src = this._pdfUrl;
        status.textContent = 'Use Open PDF if the embedded viewer is unavailable.';
      }).catch(() => {
        if (!el.isConnected) return;
        pdfFrame.remove();
        $('.pdf-status', el).textContent = 'Could not load the original PDF from browser storage. Try importing it again.';
      });
    }
    $('.google-doc-form', el)?.addEventListener('submit', (e) => {
      e.preventDefault();
      const url = e.target.elements['doc-url'].value.trim();
      const embedUrl = e.target.elements['embed-url'].value.trim();
      if (!googleDocEmbed(url, false) || (embedUrl && !googleDocEmbed(embedUrl, false))) {
        return toast('Use an HTTPS Google Docs document, preview or published URL.', 'warn');
      }
      n.googleDoc = { url, embedUrl };
      n.updated = Date.now();
      Store.save();
      App.refresh();
    });
    $('[data-act="remove-doc"]', el)?.addEventListener('click', () => {
      delete n.googleDoc;
      n.updated = Date.now();
      Store.save();
      App.refresh();
    });
    $('.note-title', el).addEventListener('input', (e) => {
      n.title = e.target.value;
      const item = $(`[data-note="${n.id}"] [data-title]`, el);
      if (item) item.textContent = n.title || 'Untitled';
      touch();
    });
    $('[data-field="classId"]', el).addEventListener('change', (e) => {
      n.classId = e.target.value;
      touch();
    });
    $('[data-field="tags"]', el).addEventListener('change', (e) => {
      n.tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
      touch();
    });
    if (isPdfNote(n)) {
      $('.pdf-notes', el).addEventListener('input', (e) => {
        n.annotations = e.target.value;
        touch();
      });
      return;
    }
    const ta = $('.md-input', el);
    const preview = $('.md-preview', el);

    const updatePreview = debounce(() => (preview.innerHTML = renderMarkdown(n.body)), 120);
    ta.addEventListener('input', () => {
      n.body = ta.value;
      updatePreview();
      touch();
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        insertAtCursor(ta, '  ');
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        wrapSel(ta, '**', '**');
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        wrapSel(ta, '*', '*');
      }
      // continue lists on Enter
      if (e.key === 'Enter' && !e.shiftKey) {
        const before = ta.value.slice(0, ta.selectionStart);
        const line = before.slice(before.lastIndexOf('\n') + 1);
        const m = line.match(/^(\s*)([-*] \[[ xX]\] |[-*] |(\d+)\. )/);
        if (m) {
          e.preventDefault();
          if (line.trim() === m[2].trim()) {
            ta.setRangeText('', ta.selectionStart - line.length, ta.selectionStart, 'end');
            insertAtCursor(ta, '\n');
          } else {
            const bullet = m[3] ? `${+m[3] + 1}. ` : m[2].replace(/\[[xX]\]/, '[ ]');
            insertAtCursor(ta, '\n' + m[1] + bullet);
          }
        }
      }
    });

    $$('input[name="mode"]', el).forEach((r) =>
      r.addEventListener('change', () => {
        NotesUI.mode = r.value;
        $('.notes-layout', el).className = `notes-layout mode-${r.value}`;
        preview.innerHTML = renderMarkdown(n.body);
      })
    );

    $('.md-toolbar', el).addEventListener('click', (e) => {
      const b = e.target.closest('button[data-md]');
      if (!b) return;
      const k = b.dataset.md;
      if (k === 'b') wrapSel(ta, '**', '**');
      if (k === 'i') wrapSel(ta, '*', '*');
      if (k === 'hl') wrapSel(ta, '==', '==');
      if (k === 'code') wrapSel(ta, '`', '`');
      if (k === 'image') {
        const url = prompt('Image URL (https://… or library/…)');
        if (!url) return;
        if (safeLink(url) === '#' || /[\s()]/.test(url.trim())) return toast('Use an image URL without spaces or parentheses (encode them in the URL).', 'warn');
        insertAtCursor(ta, `![Image](${url.trim()})`);
      }
      if (k === 'h') prefixLine(ta, '## ');
      if (k === 'ul') prefixLine(ta, '- ');
      if (k === 'todo') prefixLine(ta, '- [ ] ');
    });
    $('select[data-md="link"]', el).addEventListener('change', (e) => {
      if (!e.target.value) return;
      insertAtCursor(ta, `[[${e.target.value}]]`);
      e.target.value = '';
    });
  },
  unmount() {
    if (this._pdfUrl) URL.revokeObjectURL(this._pdfUrl);
    this._pdfUrl = null;
  },
};

function insertAtCursor(ta, text) {
  ta.focus();
  ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
  ta.dispatchEvent(new Event('input'));
}
function wrapSel(ta, a, b) {
  const { selectionStart: s, selectionEnd: e } = ta;
  const sel = ta.value.slice(s, e) || 'text';
  ta.focus();
  ta.setRangeText(a + sel + b, s, e, 'end');
  ta.setSelectionRange(s + a.length, s + a.length + sel.length);
  ta.dispatchEvent(new Event('input'));
}
function prefixLine(ta, prefix) {
  const s = ta.selectionStart;
  const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
  ta.focus();
  ta.setRangeText(prefix, lineStart, lineStart, 'end');
  ta.dispatchEvent(new Event('input'));
}

/* ==========================================================================
   Add material — slides, documents and existing notes → notes
   ========================================================================== */
const ImportUI = {
  items: [], // { id, file, kind, status: 'reading'|'ready'|'error'|'done', error, data, title, classId, target, noteId }
  classId: '',
  paste: { title: '', text: '' },

  addFiles(files, classId = '') {
    for (const file of files) {
      if (file.name.startsWith('.') || file.size === 0) continue;
      const kind = Importer.kind(file);
      if (kind === 'unsupported' && files.length > 1) continue; // skip images etc. inside vault folders
      const folder = (file.webkitRelativePath || '').split('/').slice(0, -1).join(' ');
      const item = { id: uid(), file, kind, folder, status: 'reading', title: Importer.baseName(file.name), classId: classId || this.classId, target: 'new' };
      this.items.push(item);
      const reading = kind === 'pdf'
        ? Promise.resolve({ title: Importer.baseName(file.name), body: '', tags: ['slides'], units: 1, unitLabel: 'file' })
        : Importer.extract(file);
      reading
        .then((data) => {
          Object.assign(item, { status: 'ready', data, title: data.title });
          if (!item.classId) item.classId = Importer.guessClass(file.name + ' ' + folder, data.body);
        })
        .catch((err) => Object.assign(item, { status: 'error', error: err.message }))
        .finally(() => App.current?.name === 'import' && App.refresh());
    }
  },
};

Views.import = {
  title: 'Add material',
  render(_, query) {
    if (location.hash !== ImportUI._hash) {
      ImportUI._hash = location.hash;
      if (query.class !== undefined) ImportUI.classId = query.class;
    }
    const items = ImportUI.items;
    const ready = items.filter((i) => i.status === 'ready');
    const done = items.filter((i) => i.status === 'done');
    const titles = new Set(S().notes.map((n) => n.title.toLowerCase()));

    return `
    <header class="page-head">
      <div><h1>Add material</h1><p class="lede">Bring in lecture slides, readings and notes you already have. Each file becomes a note you can search, link, summarize and turn into flashcards.</p></div>
    </header>

    <div class="stack">
      <section class="panel">
        <label class="dropzone" data-dropzone>
          <input type="file" multiple hidden data-files accept=".pdf,.pptx,.docx,.md,.markdown,.txt,.html,.htm,.c,.h,.cpp,.py,.java,.js,.sh,.sql,.s,.asm">
          ${icon('upload', 28)}
          <strong>Drop files here or choose files</strong>
          <span>PDF, PowerPoint (.pptx), Word (.docx), Markdown, text, and source code (.c, .py, .java…)</span>
        </label>
        <div class="btn-row">
          <button class="btn" data-act="pick-files">${icon('file', 16)}Choose files</button>
          <button class="btn" data-act="pick-folder">${icon('folder', 16)}Choose a folder</button>
          <input type="file" hidden data-folder webkitdirectory multiple>
          <span class="spacer"></span>
          <label class="inline-label">File into <select data-default-class>${classOptions(ImportUI.classId, { includeNone: true, noneLabel: 'Guess from file name' })}</select></label>
        </div>
        <p class="hint">A folder works for an Obsidian vault or a course folder: Markdown keeps its [[links]] and tags. Old .ppt and .doc files need to be saved as .pptx, .docx or PDF first.</p>

        ${items.length ? `
          <div class="table-wrap import-table">
            <table class="table">
              <thead><tr><th>File</th><th>Note title</th><th>Class</th><th>Put it in</th><th><span class="sr-only">Remove</span></th></tr></thead>
              <tbody>
                ${items.map((it) => `
                  <tr class="${it.status}">
                    <td>
                      <div class="file-cell">${icon(it.kind === 'pdf' || it.kind === 'pptx' ? 'slides' : 'file', 16)}<span><strong>${esc(it.file.name)}</strong>
                      <small>${it.status === 'reading' ? 'Reading…' : it.status === 'error' ? esc(it.error) : it.status === 'done' ? (it.snippetId ? `Added to Code. <a href="#/code/${it.snippetId}">Open snippet</a>` : `Added. <a href="#/notes/${it.noteId}">Open note</a>`) : `${Importer.kindLabel[it.kind]}, ${plural(it.data.units, it.data.unitLabel)}`}</small></span></div>
                    </td>
                    <td>${it.status === 'ready' ? `<input data-item="${it.id}" data-k="title" value="${esc(it.title)}" aria-label="Note title">${it.target === 'new' && titles.has(it.title.toLowerCase()) ? '<small class="hint">A note with this name exists; this adds a second one.</small>' : ''}` : ''}</td>
                    <td>${it.status === 'ready' ? `<select data-item="${it.id}" data-k="classId" aria-label="Class">${classOptions(it.classId, { includeNone: true, noneLabel: 'No class' })}</select>` : ''}</td>
                    <td>${it.status === 'ready' ? `<select data-item="${it.id}" data-k="target" aria-label="Destination">
                      <option value="new">New note</option>
                      ${it.kind === 'pdf' ? '' : `<optgroup label="Add to the end of">${S().notes.filter((n) => !it.classId || n.classId === it.classId).map((n) => `<option value="${n.id}" ${it.target === n.id ? 'selected' : ''}>${esc(n.title)}</option>`).join('')}</optgroup>`}
                    </select>` : ''}</td>
                    <td>${it.status !== 'done' ? `<button class="icon-btn sm" data-remove="${it.id}" aria-label="Remove ${esc(it.file.name)}">${icon('close', 14)}</button>` : icon('check', 16)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="btn-row">
            <button class="btn primary" data-act="import" ${ready.length ? '' : 'disabled'}>Add ${plural(ready.length, 'note')}</button>
            <label class="check"><input type="checkbox" data-keep ${ImportUI.keepOriginals !== false ? 'checked' : ''}> Keep original Office files (PDFs are always kept)</label>
            <span class="spacer"></span>
            <button class="btn ghost" data-act="clear">Clear list</button>
          </div>
          ${done.length ? `<p class="hint">Next: <a href="#/summary?note=${done[done.length - 1].noteId}">summarize</a> or <a href="#/cards?tab=import&note=${done[done.length - 1].noteId}">make flashcards</a> from what you just added.</p>` : ''}
        ` : ''}
      </section>

      <section class="panel paste-panel">
        <header class="panel-head"><h2>Or paste text</h2></header>
        <p class="hint">From Google Docs, Notion, OneNote, a website or a transcript.</p>
        <form class="form" id="paste-form">
          <div class="form-row">
            <label>Title<input name="title" value="${esc(ImportUI.paste.title)}" placeholder="Week 3 lecture" required></label>
            <label>Class<select name="classId">${classOptions(ImportUI.classId, { includeNone: true, noneLabel: 'No class' })}</select></label>
          </div>
          <label>Text<textarea name="text" rows="8" required placeholder="Paste here">${esc(ImportUI.paste.text)}</textarea></label>
          <div class="form-actions"><span class="spacer"></span><button class="btn primary">Add note</button></div>
        </form>
      </section>
    </div>`;
  },

  mount(el) {
    const files = $('[data-files]', el);
    const folder = $('[data-folder]', el);
    const add = (list) => {
      ImportUI.addFiles([...list]);
      App.refresh();
    };
    files.addEventListener('change', () => add(files.files));
    folder.addEventListener('change', () => add(folder.files));

    const zone = $('[data-dropzone]', el);
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('over');
      add(e.dataTransfer.files);
    });

    el.addEventListener('click', async (e) => {
      const rm = e.target.closest('[data-remove]');
      if (rm) {
        ImportUI.items = ImportUI.items.filter((i) => i.id !== rm.dataset.remove);
        return App.refresh();
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'pick-files') files.click();
      if (act === 'pick-folder') folder.click();
      if (act === 'clear') {
        ImportUI.items = [];
        App.refresh();
      }
      if (act === 'import') {
        const keep = $('[data-keep]', el).checked;
        ImportUI.keepOriginals = keep;
        let count = 0;
        for (const it of ImportUI.items.filter((i) => i.status === 'ready')) {
          const d = it.data;
          const source = { name: it.file.name, kind: it.kind, kindLabel: Importer.kindLabel[it.kind], units: d.units, unitLabel: d.unitLabel, size: it.file.size, added: Date.now() };
          if (it.kind === 'pdf' || (keep && ['pptx', 'docx'].includes(it.kind))) {
            source.fileId = uid();
            try {
              await FileStore.put(source.fileId, it.file);
            } catch (_) {
              delete source.fileId;
              if (it.kind === 'pdf') {
                Object.assign(it, { status: 'error', error: 'Could not store the PDF. Free browser storage and try again.' });
                continue;
              }
            }
          }
          if (it.kind === 'code') {
            const sn = { id: uid(), classId: it.classId, topicId: '', title: it.title.trim() || it.file.name, lang: d.lang, code: d.code, notes: '', tags: ['imported'], created: Date.now(), updated: Date.now() };
            S().snippets.unshift(sn);
            Store.save();
            Object.assign(it, { status: 'done', noteId: null, snippetId: sn.id });
            count++;
            continue;
          }
          let note;
          if (it.target === 'new' || it.kind === 'pdf') {
            note = createNote({ title: it.title.trim() || d.title, classId: it.classId, body: d.body, tags: d.tags, source });
          } else {
            note = getNote(it.target);
            note.body = `${note.body.trimEnd()}\n\n---\n\n## From ${it.file.name}\n\n${d.body}`;
            note.tags = [...new Set([...note.tags, ...d.tags])];
            note.updated = Date.now();
            Store.save();
          }
          Object.assign(it, { status: 'done', noteId: note.id });
          count++;
        }
        toast(`Added ${plural(count, 'note')}`, 'ok');
        App.refresh();
      }
    });

    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.matches('[data-default-class]')) {
        ImportUI.classId = t.value;
        ImportUI.items.forEach((i) => {
          if (i.status === 'ready' && t.value) i.classId = t.value;
        });
        return App.refresh();
      }
      const it = t.dataset.item && ImportUI.items.find((i) => i.id === t.dataset.item);
      if (!it) return;
      it[t.dataset.k] = t.value;
      if (t.dataset.k !== 'title') App.refresh();
    });
    el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.form?.id === 'paste-form') ImportUI.paste[t.name] = t.value;
      const it = t.dataset.item && ImportUI.items.find((i) => i.id === t.dataset.item);
      if (it && t.dataset.k === 'title') it.title = t.value;
    });

    $('#paste-form', el).addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const parsed = Importer.fromString(f.get('text'), f.get('title').trim());
      const note = createNote({ title: f.get('title').trim(), classId: f.get('classId'), body: parsed.body, tags: parsed.tags, source: { name: 'Pasted text', kind: 'paste', kindLabel: 'Pasted', units: parsed.units, unitLabel: 'word', added: Date.now() } });
      ImportUI.paste = { title: '', text: '' };
      toast('Note added', 'ok');
      location.hash = `#/notes/${note.id}`;
    });
  },
};
