/* ==========================================================================
   code.js — coding tools for CS classes
   Monochrome syntax highlighting, code blocks with copy, a snippet library
   per class, and code-aware ChatGPT prompts.
   ========================================================================== */

const LANGS = {
  c: { label: 'C', kw: 'auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while bool true false NULL size_t pid_t uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t', comment: ['//', '/*'], pre: true },
  cpp: { label: 'C++', kw: 'auto bool break case catch char class const constexpr continue default delete do double else enum explicit extern false float for friend if inline int long namespace new nullptr operator private protected public return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while std string vector', comment: ['//', '/*'], pre: true },
  java: { label: 'Java', kw: 'abstract boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch synchronized this throw throws try void volatile while true false String', comment: ['//', '/*'] },
  js: { label: 'JavaScript', kw: 'async await break case catch class const continue default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield', comment: ['//', '/*'] },
  python: { label: 'Python', kw: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return self True try while with yield print', comment: ['#'] },
  bash: { label: 'Shell', kw: 'if then else elif fi for in do done while until case esac function return exit export local echo sudo cd ls cat grep chmod chown', comment: ['#'] },
  sql: { label: 'SQL', kw: 'select from where and or not insert into values update set delete create table drop alter join left right inner outer on group by order having limit as null is in like union distinct primary key foreign references', comment: ['--'], ci: true },
  asm: { label: 'Assembly', kw: 'mov push pop call ret jmp je jne jz jnz cmp add sub mul div lea xor and or nop int syscall rax rbx rcx rdx rsi rdi rbp rsp rip eax ebx ecx edx esp ebp eip', comment: [';'], ci: true },
  text: { label: 'Plain text', kw: '', comment: [] },
};
const LANG_ALIAS = { h: 'c', cc: 'cpp', hpp: 'cpp', 'c++': 'cpp', javascript: 'js', ts: 'js', typescript: 'js', py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash', s: 'asm', nasm: 'asm', x86: 'asm', txt: 'text', '': 'text' };
const langKey = (l) => (LANGS[l] ? l : LANG_ALIAS[l] || 'text');

/** Tokenize and wrap in spans. Colourless: weight, style and grey carry meaning. */
function highlightCode(code, lang) {
  const L = LANGS[langKey(lang)];
  if (!L.kw && !L.comment.length) return esc(code);
  const kw = new Set(L.kw.split(/\s+/).filter(Boolean).map((k) => (L.ci ? k.toLowerCase() : k)));
  const parts = [];
  if (L.comment.includes('/*')) parts.push('\\/\\*[\\s\\S]*?(?:\\*\\/|$)');
  for (const c of L.comment.filter((c) => c !== '/*')) parts.push(`${c.replace(/[#/-]/g, (m) => '\\' + m)}[^\\n]*`);
  const commentRe = parts.join('|');
  const re = new RegExp(
    [
      commentRe && `(${commentRe})`,
      `("(?:[^"\\\\\\n]|\\\\.)*"|'(?:[^'\\\\\\n]|\\\\.)*'${lang === 'python' ? '|"""[\\s\\S]*?"""' : ''})`,
      L.pre ? '(^[ \\t]*#[^\\n]*)' : '(\\b\\B)',
      '(\\b(?:0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b)',
      '([A-Za-z_][A-Za-z0-9_]*)(?=\\s*\\()',
      '([A-Za-z_][A-Za-z0-9_]*)',
    ].filter(Boolean).join('|'),
    'gm'
  );
  let out = '';
  let last = 0;
  const offset = commentRe ? 0 : -1;
  code.replace(re, (m, ...g) => {
    const idx = g[g.length - 2];
    out += esc(code.slice(last, idx));
    last = idx + m.length;
    const [com, str, pre, num, fn, word] = offset ? [undefined, ...g] : g;
    if (com) out += `<span class="tk-c">${esc(m)}</span>`;
    else if (str) out += `<span class="tk-s">${esc(m)}</span>`;
    else if (pre) out += `<span class="tk-p">${esc(m)}</span>`;
    else if (num) out += `<span class="tk-n">${esc(m)}</span>`;
    else if (fn) out += kw.has(L.ci ? fn.toLowerCase() : fn) ? `<span class="tk-k">${esc(m)}</span>` : `<span class="tk-f">${esc(m)}</span>`;
    else if (word && kw.has(L.ci ? word.toLowerCase() : word)) out += `<span class="tk-k">${esc(m)}</span>`;
    else out += esc(m);
    return m;
  });
  return out + esc(code.slice(last));
}

function codeBlock(code, lang) {
  const key = langKey(lang);
  return `<div class="codeblock"><div class="codeblock-bar"><span>${esc(LANGS[key].label)}</span><button class="linklike" data-copy-code>Copy</button></div><pre><code>${highlightCode(code, key)}</code></pre></div>`;
}

// one delegated handler for every Copy button in the app
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy-code]');
  if (!b) return;
  const code = b.closest('.codeblock').querySelector('code').textContent;
  const ok = await copyText(code);
  b.textContent = ok ? 'Copied' : 'Copy failed';
  setTimeout(() => (b.textContent = 'Copy'), 1400);
});

/* ---------------- code prompts (ChatGPT) ---------------- */
const CODE_PROMPTS = [
  {
    id: 'explain', name: 'Explain it line by line', desc: 'What each part does and why.',
    build: (c) => `I'm studying ${c.cls}. Explain this ${c.langLabel} code to me line by line, then summarize what it does in two sentences and name the ${c.cls} concept it demonstrates.${c.extra ? `\n\nMy question: ${c.extra}` : ''}\n\n\`\`\`${c.lang}\n${c.code}\n\`\`\``,
  },
  {
    id: 'debug', name: 'Help me debug it', desc: 'Find the bug without handing over the fix.',
    build: (c) => `This ${c.langLabel} code for my ${c.cls} class isn't working.${c.extra ? ` What happens: ${c.extra}.` : ''}\n\nDon't rewrite it for me. First ask me what I expected to happen, then give hints one at a time until I find the bug myself.\n\n\`\`\`${c.lang}\n${c.code}\n\`\`\``,
  },
  {
    id: 'trace', name: 'Trace it by hand', desc: 'Step through state, processes or memory.',
    build: (c) => `Walk me through a hand trace of this ${c.langLabel} code as an exam question would expect. Show a table of the important state (variables, processes, threads, stack or memory) after each step, and point out any output order that could vary.${c.extra ? `\n\nFocus on: ${c.extra}` : ''}\n\n\`\`\`${c.lang}\n${c.code}\n\`\`\``,
  },
  {
    id: 'vuln', name: 'Find the vulnerability', desc: 'Security review for coursework.',
    build: (c) => `For my Computer Security class, review this ${c.langLabel} code. Identify any vulnerabilities, explain the conditions under which each one is exploitable at a conceptual level, and show how to fix it safely. Also name the mitigations (compiler, OS, or design) that make it harder to exploit.${c.extra ? `\n\n${c.extra}` : ''}\n\n\`\`\`${c.lang}\n${c.code}\n\`\`\``,
  },
  {
    id: 'quiz', name: 'Quiz me on it', desc: 'Questions about what the code does.',
    build: (c) => `Give me 6 exam-style questions about this ${c.langLabel} code (what it prints, what happens if a line is changed, which concept it shows). Ask them one at a time and wait for my answer before telling me if I'm right.\n\n\`\`\`${c.lang}\n${c.code}\n\`\`\``,
  },
];

/* ---------------- snippet library view ---------------- */
const CodeUI = { classId: '', q: '', current: null, prompt: 'explain', extra: '' };

function snippetMatches(sn, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return sn.title.toLowerCase().includes(q) || sn.code.toLowerCase().includes(q) || (sn.notes || '').toLowerCase().includes(q);
}

function codeContext(sn) {
  return { cls: className(sn.classId), lang: langKey(sn.lang), langLabel: LANGS[langKey(sn.lang)].label, code: sn.code, extra: CodeUI.extra.trim() };
}

Views.code = {
  title: 'Code',
  render([id], query) {
    if (location.hash !== CodeUI._hash) {
      CodeUI._hash = location.hash;
      if (query.class !== undefined) CodeUI.classId = query.class;
    }
    const list = S().snippets.filter((sn) => (!CodeUI.classId || sn.classId === CodeUI.classId) && snippetMatches(sn, CodeUI.q)).sort((a, b) => b.updated - a.updated);
    const sn = (id && S().snippets.find((x) => x.id === id)) || list[0];
    CodeUI.current = sn?.id;

    return `
    <div class="notes-layout">
      <aside class="panel notes-side" aria-label="Snippets">
        <div class="notes-side-head">
          <input type="search" class="code-search" placeholder="Search code" value="${esc(CodeUI.q)}" aria-label="Search code">
          <button class="icon-btn" data-act="new" aria-label="New snippet" title="New snippet">${icon('plus')}</button>
        </div>
        <div class="filter-row">
          <select data-filter="class" aria-label="Class"><option value="">All classes</option>${classOptions(CodeUI.classId)}</select>
        </div>
        <ul class="note-list">
          ${list.map((x) => `
            <li><a href="#/code/${x.id}" class="${x.id === sn?.id ? 'active' : ''}" ${x.id === sn?.id ? 'aria-current="true"' : ''}>
              <span class="note-list-title">${x.classId ? mark(x.classId) : ''}<span data-title>${esc(x.title || 'Untitled snippet')}</span></span>
              <span class="note-list-meta">${esc(LANGS[langKey(x.lang)].label)}, ${plural(x.code.split('\n').length, 'line')}</span>
            </a></li>`).join('') || '<li class="rows-empty">No snippets yet.</li>'}
        </ul>
        <p class="hint">Source files (.c, .py, .java, .sql…) can be added from <a href="#/import">Add material</a>.</p>
      </aside>

      <section class="panel note-editor">
        ${sn ? this.editor(sn) : emptyState('code', 'Keep the code you study here', 'Lecture examples, lab starter code, exploits you are learning to spot. Each snippet can be explained, traced or turned into flashcards.', '<div class="btn-row center"><button class="btn primary" data-act="new">New snippet</button></div>')}
      </section>
    </div>`;
  },

  editor(sn) {
    const p = CODE_PROMPTS.find((x) => x.id === CodeUI.prompt) || CODE_PROMPTS[0];
    return `
      <input class="note-title" data-f="title" value="${esc(sn.title)}" placeholder="Untitled snippet" aria-label="Snippet title">
      <div class="note-meta">
        <select data-f="classId" aria-label="Class">${classOptions(sn.classId, { includeNone: true, noneLabel: 'No class' })}</select>
        <select data-f="topicId" aria-label="Topic">${topicOptions(sn.classId, sn.topicId, { noneLabel: 'No topic' })}</select>
        <select data-f="lang" aria-label="Language">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${langKey(sn.lang) === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
        <span class="spacer"></span>
        <span class="muted small save-state" aria-live="polite">Saved</span>
      </div>
      <div class="code-panes">
        <label class="code-edit"><span class="sr-only">Code</span><textarea data-f="code" spellcheck="false" wrap="off">${esc(sn.code)}</textarea></label>
        <div class="code-view">${codeBlock(sn.code, sn.lang)}</div>
      </div>
      <label class="form-label">What to remember<textarea data-f="notes" rows="2" placeholder="The idea this code shows, in your own words">${esc(sn.notes || '')}</textarea></label>

      <div class="code-ai">
        <h2>Work on it with ChatGPT</h2>
        <div class="seg" role="radiogroup" aria-label="What to ask">
          ${CODE_PROMPTS.map((x) => `<label title="${esc(x.desc)}"><input type="radio" name="cprompt" value="${x.id}" ${x.id === p.id ? 'checked' : ''}><span>${x.name}</span></label>`).join('')}
        </div>
        <p class="hint">${esc(p.desc)}</p>
        <div class="inline-add">
          <input data-extra value="${esc(CodeUI.extra)}" placeholder="Add a question or what went wrong (optional)" aria-label="Extra detail">
          <button class="btn primary" data-act="ask">Ask ChatGPT ${icon('external', 15)}</button>
        </div>
      </div>

      <footer class="note-foot">
        <div class="btn-row">
          <button class="btn sm" data-act="cards">Make flashcards from it</button>
          <button class="btn sm" data-act="to-note">Copy into a note</button>
          <span class="spacer"></span>
          <button class="btn sm ghost danger" data-act="delete">Delete snippet</button>
        </div>
      </footer>`;
  },

  mount(el) {
    const sn = S().snippets.find((x) => x.id === CodeUI.current);
    const state = $('.save-state', el);
    const persist = debounce(() => {
      Store.save();
      if (state) state.textContent = 'Saved';
    }, 400);

    $('.code-search', el).addEventListener('input', debounce((e) => {
      CodeUI.q = e.target.value;
      App.refresh();
      const s = $('.code-search', App.viewEl);
      s.focus();
      s.setSelectionRange(s.value.length, s.value.length);
    }, 200));

    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.filter === 'class') {
        CodeUI.classId = t.value;
        return App.refresh();
      }
      if (t.name === 'cprompt') {
        CodeUI.prompt = t.value;
        return App.refresh();
      }
      if (!sn) return;
      const f = t.dataset.f;
      if (f === 'classId' || f === 'topicId' || f === 'lang') {
        sn[f] = t.value;
        if (f === 'classId') sn.topicId = '';
        sn.updated = Date.now();
        Store.save();
        App.refresh();
      }
    });

    el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.matches('[data-extra]')) CodeUI.extra = t.value;
      if (!sn) return;
      const f = t.dataset.f;
      if (f === 'title' || f === 'code' || f === 'notes') {
        sn[f] = t.value;
        sn.updated = Date.now();
        if (state) state.textContent = 'Saving';
        persist();
        if (f === 'code') $('.code-view', el).innerHTML = codeBlock(sn.code, sn.lang);
        if (f === 'title') {
          const item = $('.note-list a.active [data-title]', el);
          if (item) item.textContent = sn.title || 'Untitled snippet';
        }
      }
    });

    const ta = $('[data-f="code"]', el);
    ta?.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'new') {
        const n = { id: uid(), classId: CodeUI.classId || 'os', topicId: '', title: '', lang: 'c', code: '', notes: '', tags: [], created: Date.now(), updated: Date.now() };
        S().snippets.unshift(n);
        Store.save();
        location.hash = `#/code/${n.id}`;
        setTimeout(() => $('.note-title', App.viewEl)?.focus(), 50);
      }
      if (!sn) return;
      if (act === 'ask') {
        if (!sn.code.trim()) return toast('Paste some code first', 'warn');
        sendToChatGPT(CODE_PROMPTS.find((x) => x.id === CodeUI.prompt).build(codeContext(sn)));
      }
      if (act === 'cards') {
        CardsUI.imp = { ...CardsUI.imp, classId: sn.classId, topicId: sn.topicId || '', style: 'code', noteId: '', codeSource: { title: sn.title, lang: langKey(sn.lang), code: sn.code }, pasted: '', parsed: [] };
        CardsUI._hash = '#/cards?tab=import';
        CardsUI.tab = 'import';
        location.hash = '#/cards?tab=import';
      }
      if (act === 'to-note') {
        const body = `# ${sn.title || 'Code'}\n\n\`\`\`${langKey(sn.lang)}\n${sn.code}\n\`\`\`\n\n${sn.notes || ''}\n`;
        const n = createNote({ title: sn.title || 'Code note', classId: sn.classId, body, tags: ['code'] });
        location.hash = `#/notes/${n.id}`;
      }
      if (act === 'delete' && confirm(`Delete “${sn.title || 'this snippet'}”?`)) {
        S().snippets = S().snippets.filter((x) => x.id !== sn.id);
        Store.save();
        location.hash = '#/code';
      }
    });
  },
};
