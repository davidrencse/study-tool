/* ==========================================================================
   views-leetcode.js — solved LeetCode problems from the Obsidian vault,
   with self-paced re-solve practice.
   Data: S().leetcode = { problems: [...], snapshot, vault, folder }
   Sources: js/leetcode-data.js (tools/sync-leetcode.js) or "Sync from vault".
   ========================================================================== */

ICON_PATHS.leetcode = '<path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>';

const LC = {
  /** Lazily creates the store and folds in a newer bundled snapshot. */
  data() {
    const s = S();
    if (!s.leetcode) s.leetcode = { problems: [], snapshot: '', vault: 'Vault', folder: '4 - Main Notes/Leetcode' };
    const snap = typeof LEETCODE_SNAPSHOT !== 'undefined' ? LEETCODE_SNAPSHOT : null;
    if (snap && snap.generated > s.leetcode.snapshot) {
      s.leetcode.snapshot = snap.generated;
      s.leetcode.vault = snap.vault || s.leetcode.vault;
      this.merge(snap.problems);
    }
    let changed=false;
    for(const p of s.leetcode.problems){for(const key of ['due','interval','ease'])if(key in p){delete p[key];changed=true;}}
    if(changed)Store.save();
    return s.leetcode;
  },
  all() {
    return this.data().problems;
  },
  get(num) {
    return this.all().find((p) => p.num === +num);
  },
  /** Vault is the source for content; practice history and your edits stay. */
  merge(incoming) {
    const list = S().leetcode.problems;
    let added = 0;
    let updated = 0;
    const fresh = [];
    for (const p of incoming) {
      const cur = list.find((x) => x.num === p.num);
      if (!cur) {
        fresh.push(p);
        continue;
      }
      if (cur.code !== p.code || cur.notes !== p.notes || cur.title !== p.title || cur.difficulty !== p.difficulty) updated++;
      Object.assign(cur, {
        title: p.title, difficulty: p.difficulty, url: p.url, lang: p.lang, code: p.code, notes: p.notes, tags: p.tags, path: p.path,
        solved: cur.solved && cur.solved < p.solved ? cur.solved : p.solved,
      });
      if (!cur.patternSet) cur.pattern = p.pattern;
    }
    // Keep imported problems available for practice at any time.
    fresh.sort((a, b) => a.solved.localeCompare(b.solved) || a.num - b.num);
    fresh.forEach((p) => {
      list.push({ ...p, keyIdea: '', patternSet: false, reps: 0, lapses: 0 });
      added++;
    });
    list.sort((a, b) => a.num - b.num);
    Store.save();
    return { added, updated };
  },

  obsidianUrl(p) {
    return `obsidian://open?vault=${encodeURIComponent(this.data().vault)}&file=${encodeURIComponent(p.path.replace(/\.md$/, ''))}`;
  },

  /** Read a folder picked in the browser: the whole vault or just the Leetcode folder. */
  async syncFromFiles(files) {
    const d = this.data();
    const parentOfFolder = d.folder.split('/').slice(0, -1).join('/');
    const parsed = [];
    let vaultName = null;
    for (const f of files) {
      const rel = f.webkitRelativePath || f.name;
      if (!rel.toLowerCase().endsWith('.md') || rel.includes('/.obsidian/')) continue;
      const segs = rel.split('/');
      let path;
      if (segs[0].toLowerCase() === 'leetcode') path = (parentOfFolder ? parentOfFolder + '/' : '') + rel;
      else {
        path = segs.slice(1).join('/');
        if (!/(^|\/)leetcode\//i.test(path)) continue;
        vaultName = segs[0];
      }
      const p = parseLeetcodeNote({ path, text: await f.text(), date: ymd(new Date(f.lastModified)) });
      if (p) parsed.push(p);
    }
    if (vaultName) d.vault = vaultName;
    if (!parsed.length) return null;
    return this.merge(parsed);
  },

  grade(p, g) {
    p.reps=(p.reps||0)+1;
    if(g===0)p.lapses=(p.lapses||0)+1;
    p.lastReviewed=Date.now();p.lastGrade=g;
    Store.save();
  },
};

const LCUI = { q: '', diff: '', pattern: '', sort: 'num', session: null };

function lcDiffTag(d) {
  return `<span class="tag lc-diff lc-${d.toLowerCase()}">${d}</span>`;
}

function lcCode(p) {
  if (!p.code) return '<p class="muted small">No code in this note.</p>';
  return typeof codeBlock === 'function'
    ? codeBlock(p.code, p.lang)
    : `<pre class="lc-pre"><code>${esc(p.code)}</code></pre>`;
}

function lcPatternOptions(selected, { includeAll = false } = {}) {
  const used = new Set(LC.all().map((p) => p.pattern));
  const list = includeAll ? LC_PATTERN_LIST.filter((x) => used.has(x)) : LC_PATTERN_LIST;
  return (includeAll ? `<option value="">All patterns</option>` : '') +
    list.map((x) => `<option ${x === selected ? 'selected' : ''}>${esc(x)}</option>`).join('');
}

function lcSolveHeatmap(weeks = 26) {
  const per = {};
  LC.all().forEach((p) => (per[p.solved] = (per[p.solved] || 0) + 1));
  const end = todayStr();
  const start = addDays(end, -(weeks * 7 - 1) + (6 - parseYmd(end).getDay()));
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const n = per[d] || 0;
    const lvl = d > end ? 'x' : Math.min(4, n);
    cells += `<span class="hm hm${lvl}" title="${fmtDate(d)}: ${n} solved"></span>`;
  }
  return `<div class="heatmap lc-heatmap" role="img" aria-label="Problems solved per day over the last ${weeks} weeks">${cells}</div>`;
}

/* ------------------------------ Problems ------------------------------ */
Views.leetcode = {
  title: 'LeetCode',

  render(params) {
    if (params[0]) return this.detail(params[0]);
    const all = LC.all();
    const count = (d) => all.filter((p) => p.difficulty === d).length;

    if (!all.length) {
      return `
        <div class="page-head"><div><h1>LeetCode</h1><p class="lede">Your solved problems, from your Obsidian vault.</p></div></div>
        <div class="panel">${emptyState('leetcode', 'No problems yet', 'Choose your vault or its Leetcode folder. Notes named like “49. Group Anagrams.md” inside Easy, Medium and Hard folders are read.', `<div class="btn-row center"><button class="btn primary" data-act="sync">${icon('folder', 16)}Sync from vault</button></div>`)}</div>
        <input type="file" hidden data-lc-folder webkitdirectory multiple>`;
    }

    const byPattern = LC_PATTERN_LIST.map((name) => [name, all.filter((p) => p.pattern === name).length]).filter(([, n]) => n);
    const maxP = Math.max(...byPattern.map(([, n]) => n));
    const last30 = all.filter((p) => daysBetween(p.solved, todayStr()) < 30).length;

    return `
      <div class="page-head">
        <div>
          <h1>LeetCode</h1>
          <p class="lede">${plural(all.length, 'problem')} solved. Practice whenever you want.</p>
        </div>
        <div class="head-actions">
          <button class="btn" data-act="sync" title="Pick your vault or its Leetcode folder">${icon('folder', 16)}Sync from vault</button>
          <a class="btn primary" href="#/lcpractice">${icon('leetcode',16)}Practice</a>
        </div>
      </div>
      <input type="file" hidden data-lc-folder webkitdirectory multiple>

      <div class="grid-2 wide-left">
        <section class="panel" aria-labelledby="lc-list-h">
          <div class="panel-head"><h2 id="lc-list-h">Problems</h2><span class="muted small" data-lc-count></span></div>
          <div class="lc-filters">
            <input type="search" data-f="q" placeholder="Number, title or code" value="${esc(LCUI.q)}" aria-label="Search problems">
            <div class="seg sm" role="radiogroup" aria-label="Difficulty">
              ${['', ...LC_DIFFICULTIES].map((d) => `<label><input type="radio" name="lc-diff" value="${d}" ${LCUI.diff === d ? 'checked' : ''}><span>${d || 'All'}</span></label>`).join('')}
            </div>
            <select data-f="pattern" class="compact" aria-label="Pattern">${lcPatternOptions(LCUI.pattern, { includeAll: true })}</select>
            <select data-f="sort" class="compact" aria-label="Sort">
              ${[['num', 'By number'], ['recent', 'Recently solved'], ['diff', 'By difficulty']].map(([v, l]) => `<option value="${v}" ${LCUI.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <ul class="rows lc-rows" data-lc-list></ul>
        </section>

        <div class="stack">
          <section class="panel">
            <h2>Progress</h2>
            <dl class="facts">
              <div><dt>Easy</dt><dd>${count('Easy')}</dd></div>
              <div><dt>Medium</dt><dd>${count('Medium')}</dd></div>
              <div><dt>Hard</dt><dd>${count('Hard')}</dd></div>
              <div><dt>Last 30 days</dt><dd>${last30}</dd></div>
            </dl>
            <div class="lc-split" aria-hidden="true">
              ${LC_DIFFICULTIES.map((d) => `<span class="lc-${d.toLowerCase()}" style="flex:${count(d)}"></span>`).join('')}
            </div>
            <h3 class="sub">Solved per day, last 26 weeks</h3>
            ${lcSolveHeatmap()}
          </section>

          <section class="panel">
            <div class="panel-head"><h2>By pattern</h2>${LCUI.pattern ? '<button class="linklike small" data-pattern="">Show all</button>' : ''}</div>
            <ul class="lc-patterns">
              ${byPattern.map(([name, n]) => `
                <li><button class="lc-pattern ${LCUI.pattern === name ? 'active' : ''}" data-pattern="${esc(name)}" aria-pressed="${LCUI.pattern === name}">
                  <span>${esc(name)}</span><span class="num">${n}</span>
                  <span class="lc-bar"><i style="width:${Math.round((n / maxP) * 100)}%"></i></span>
                </button></li>`).join('')}
            </ul>
          </section>
        </div>
      </div>`;
  },

  listHtml() {
    const q = LCUI.q.trim().toLowerCase();
    const order = { Easy: 0, Medium: 1, Hard: 2 };
    const sorters = {
      num: (a, b) => a.num - b.num,
      recent: (a, b) => b.solved.localeCompare(a.solved) || b.num - a.num,
      diff: (a, b) => order[b.difficulty] - order[a.difficulty] || a.num - b.num,
    };
    const list = LC.all()
      .filter((p) => (!LCUI.diff || p.difficulty === LCUI.diff) && (!LCUI.pattern || p.pattern === LCUI.pattern))
      .filter((p) => !q || String(p.num) === q || p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.notes.toLowerCase().includes(q))
      .sort(sorters[LCUI.sort] || sorters.num);
    const html = list.map((p) => `
      <li class="row">
        <a class="row-main" href="#/leetcode/${p.num}">
          <span class="row-title"><span class="lc-num">${p.num}</span>${esc(p.title)}</span>
          <span class="row-meta">${lcDiffTag(p.difficulty)}<span>${esc(p.pattern)}</span><span>Solved ${fmtDate(p.solved, { month: 'short', day: 'numeric', year: p.solved.slice(0, 4) === todayStr().slice(0, 4) ? undefined : 'numeric' })}</span></span>
        </a>
      </li>`).join('');
    return { html: html || '<li class="rows-empty">Nothing matches these filters.</li>', n: list.length };
  },

  detail(num) {
    const p = LC.get(num);
    if (!p) return `<a class="back" href="#/leetcode">${icon('left', 14)}All problems</a>${emptyState('leetcode', `No problem ${esc(num)}`, 'It may not be synced from your vault yet.')}`;
    const all = LC.all();
    const i = all.indexOf(p);
    const prev = all[i - 1];
    const next = all[i + 1];
    return `
      <a class="back" href="#/leetcode">${icon('left', 14)}All problems</a>
      <div class="page-head">
        <div>
          <p class="kind lc-kicker">${lcDiffTag(p.difficulty)}<span>Problem ${p.num}</span></p>
          <h1>${esc(p.title)}</h1>
          <p class="lede">Solved ${fmtDate(p.solved, { month: 'long', day: 'numeric', year: 'numeric' })}${p.reps ? ` · re-solved ${plural(p.reps, 'time')}` : ''}${p.lapses ? ` · missed ${plural(p.lapses, 'time')}` : ''}</p>
        </div>
        <div class="head-actions">
          <a class="btn primary" href="${esc(safeLink(p.url))}" target="_blank" rel="noopener">${icon('external', 16)}Open on LeetCode</a>
          <a class="btn" href="${esc(LC.obsidianUrl(p))}">${icon('notes', 16)}Open in Obsidian</a>
        </div>
      </div>

      <div class="grid-2 wide-left">
        <div class="stack">
          <section class="panel">
            <div class="panel-head"><h2>My solution</h2><button class="btn sm ghost" data-act="ask">${icon('ai', 16)}Review with ChatGPT</button></div>
            ${lcCode(p)}
          </section>
          ${p.notes ? `<section class="panel"><h2>Notes</h2><div class="prose">${renderMarkdown(p.notes)}</div></section>` : ''}
        </div>

        <div class="stack">
          <section class="panel">
            <h2>Re-solve</h2>
            <p class="hint">Solve it again from a blank editor, then compare with your saved solution. Practice at your own pace.</p>
            <a class="btn block" href="#/lcpractice?p=${p.num}">${icon('leetcode', 16)}Practice this one now</a>
          </section>

          <section class="panel">
            <h2>Pattern and key idea</h2>
            <form class="form lc-meta" onsubmit="return false">
              <label>Pattern<select data-lc="pattern">${lcPatternOptions(p.pattern)}</select></label>
              <label>Key idea
                <textarea data-lc="keyIdea" rows="3" placeholder="The one sentence that unlocks it, e.g. “sorted letters are the same for anagrams”">${esc(p.keyIdea || '')}</textarea>
              </label>
              <p class="hint">Shown when you flip a problem in Practice. Saved in this browser; the vault stays untouched.</p>
            </form>
          </section>

          <nav class="lc-pager" aria-label="Other problems">
            ${prev ? `<a class="btn" href="#/leetcode/${prev.num}">${icon('left', 16)}${prev.num}</a>` : '<span></span>'}
            ${next ? `<a class="btn" href="#/leetcode/${next.num}">${next.num}${icon('right', 16)}</a>` : ''}
          </nav>
        </div>
      </div>`;
  },

  mount(el, params) {
    const picker = $('[data-lc-folder]', el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act], [data-pattern]');
      if (!b) return;
      if (b.dataset.act === 'sync') picker.click();
      else if (b.dataset.act === 'ask') this.ask(LC.get(params[0]));
      else if (b.dataset.pattern !== undefined) {
        LCUI.pattern = LCUI.pattern === b.dataset.pattern ? '' : b.dataset.pattern;
        App.refresh();
      }
    });
    picker?.addEventListener('change', async () => {
      const files = [...picker.files];
      if (!files.length) return;
      toast(`Reading ${plural(files.length, 'file')}…`);
      try {
        const r = await LC.syncFromFiles(files);
        if (!r) toast('No LeetCode notes found. Pick the vault or its Leetcode folder.', 'warn');
        else toast(r.added || r.updated ? `Synced: ${r.added} new, ${r.updated} updated.` : 'Already up to date.', 'ok');
      } catch (_) {
        toast('Could not read that folder.', 'error');
      }
      picker.value = '';
      App.refresh();
    });

    if (params[0]) return this.mountDetail(el, LC.get(params[0]));

    const listEl = $('[data-lc-list]', el);
    if (!listEl) return;
    const drawList = () => {
      const { html, n } = this.listHtml();
      listEl.innerHTML = html;
      $('[data-lc-count]', el).textContent = n === LC.all().length ? '' : `${n} of ${LC.all().length}`;
    };
    drawList();
    $('[data-f="q"]', el).addEventListener('input', debounce((e) => {
      LCUI.q = e.target.value;
      drawList();
    }, 120));
    $('[data-f="sort"]', el).addEventListener('change', (e) => {
      LCUI.sort = e.target.value;
      drawList();
    });
    $('[data-f="pattern"]', el).addEventListener('change', (e) => {
      LCUI.pattern = e.target.value;
      App.refresh();
    });
    $$('input[name="lc-diff"]', el).forEach((r) => r.addEventListener('change', () => {
      LCUI.diff = r.value;
      drawList();
    }));
  },

  mountDetail(el, p) {
    if (!p) return;
    $('[data-lc="pattern"]', el)?.addEventListener('change', (e) => {
      p.pattern = e.target.value;
      p.patternSet = true;
      Store.save();
      toast('Pattern saved.', 'ok');
    });
    $('[data-lc="keyIdea"]', el)?.addEventListener('input', debounce((e) => {
      p.keyIdea = e.target.value.trim();
      Store.save();
    }, 300));
  },

  ask(p) {
    if (!p) return;
    sendToChatGPT(
      `I solved LeetCode ${p.num}. ${p.title} (${p.difficulty}). Review my ${p.lang} solution:\n` +
      `1. Time and space complexity, with a one-line reason each.\n` +
      `2. Edge cases it gets wrong, if any, with a failing input.\n` +
      `3. Whether a cleaner or faster approach exists. Describe it, but don't write it out unless I ask.\n` +
      `4. In two sentences, the ${p.pattern} idea that makes this problem work, so I can recognize it next time.\n\n` +
      '```' + p.lang + '\n' + p.code + '\n```'
    );
  },
};

/* ------------------------------ Practice ------------------------------ */
Views.lcpractice = {
  title: 'LeetCode practice',

  start(only) {
    const queue = only ? [LC.get(only)].filter(Boolean) : LC.all().slice().sort((a,b)=>(a.lastReviewed||0)-(b.lastReviewed||0)||a.num-b.num);
    LCUI.session = { queue: queue.map((p) => p.num), pos: 0, revealed: false, stats: [0, 0, 0, 0], single: !!only };
  },

  render(params, query) {
    LC.data();
    const ss = LCUI.session;
    if (query.p && (!ss || !ss.single || ss.queue[0] !== +query.p)) this.start(query.p);
    else if (!query.p && (!ss || ss.single)) this.start();
    const s = LCUI.session;

    const head = `<div class="page-head"><div><h1>Practice</h1><p class="lede">Re-solve from memory on LeetCode, then compare with the solution you saved.</p></div></div>`;

    if (s.pos >= s.queue.length) {
      const done = s.stats.reduce((a, b) => a + b, 0);
      if (!done) {
        return head + `<div class="panel">${emptyState('check','No problems to practice','Sync your vault to add problems.','<a class="btn" href="#/leetcode">Browse problems</a>')}</div>`;
      }
      return head + `
        <div class="panel session-done">
          <h2>${plural(done, 'problem')} re-solved</h2>
          <dl class="facts wide">
            ${['Couldn’t', 'Struggled', 'Solved', 'Easy'].map((l, i) => `<div><dt>${l}</dt><dd>${s.stats[i]}</dd></div>`).join('')}
          </dl>
          <div class="btn-row center"><a class="btn primary" href="#/leetcode">Back to problems</a></div>
        </div>`;
    }

    const p = LC.get(s.queue[s.pos]);
    const left = s.queue.length - s.pos;
    return head + `
      <div class="review lc-review">
        <div class="review-top">
          <span class="num">${left} left</span>
          ${progressBar(Math.round((s.pos / s.queue.length) * 100))}
          <a class="btn sm ghost" href="#/leetcode/${p.num}">Details</a>
          <button class="btn sm ghost" data-act="skip">Skip</button>
        </div>

        <article class="index-card ${s.revealed ? 'is-back' : ''}" aria-live="polite">
          <header class="ic-head">
            <span>${lcDiffTag(p.difficulty)}&nbsp; Problem ${p.num}</span>
            <span class="ic-side">${s.revealed ? esc(p.pattern) : 'Pattern hidden'}</span>
          </header>
          <div class="ic-body">
            ${s.revealed
              ? `<div class="ic-q">${esc(p.title)}</div><div class="ic-text">${p.keyIdea ? esc(p.keyIdea) : `<span class="muted">${esc(p.pattern)}</span>`}</div>
                 ${p.keyIdea ? '' : `<p class="ic-q"><a href="#/leetcode/${p.num}">Add a key idea</a> to see it here next time.</p>`}`
              : `<div class="ic-text">${esc(p.title)}</div><p class="ic-q">Last solved ${fmtDate(p.lastReviewed ? ymd(new Date(p.lastReviewed)) : p.solved, { month: 'short', day: 'numeric', year: 'numeric' })}</p>`}
          </div>
        </article>

        ${!s.revealed ? `
          <div class="review-controls">
            <a class="btn lg block" href="${esc(safeLink(p.url))}" target="_blank" rel="noopener">${icon('external', 16)}Open on LeetCode</a>
            <button class="btn primary lg block" data-act="reveal">Show my solution <kbd>Space</kbd></button>
          </div>
        ` : `
          <div class="review-controls">
            <div class="lc-review-code">${lcCode(p)}</div>
            ${p.notes ? `<details class="lc-notes"><summary>My notes</summary><div class="prose">${renderMarkdown(p.notes)}</div></details>` : ''}
            <div class="grades" role="group" aria-label="How did re-solving it go?">
              ${['Couldn’t', 'Struggled', 'Solved', 'Easy'].map((l, i) => `
                <button class="grade ${i === 2 ? 'primary' : ''}" data-grade="${i}"><span>${l}</span><kbd>${i + 1}</kbd></button>`).join('')}
            </div>
          </div>
        `}
      </div>`;
  },

  mount(el) {
    const s = LCUI.session;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act], [data-grade]');
      if (!b) return;
      if (b.dataset.grade) this.grade(+b.dataset.grade);
      else if (b.dataset.act === 'reveal') this.reveal();
      else if (b.dataset.act === 'skip') {
        s.queue.push(s.queue.splice(s.pos, 1)[0]);
        if (s.queue.length === 1) s.pos++;
        s.revealed = false;
        App.refresh();
      }
    });
    this._keys = (e) => {
      if (e.target.matches('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (s.pos >= s.queue.length) return;
      if (!s.revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        this.reveal();
      } else if (s.revealed && /^[1-4]$/.test(e.key)) this.grade(+e.key - 1);
    };
    document.addEventListener('keydown', this._keys);
  },

  unmount() {
    document.removeEventListener('keydown', this._keys);
    // leaving (not just re-rendering) after a finished session: start fresh next time
    const s = LCUI.session;
    if (s && s.pos >= s.queue.length && !location.hash.startsWith('#/lcpractice')) LCUI.session = null;
  },

  reveal() {
    LCUI.session.revealed = true;
    App.refresh();
  },

  grade(g) {
    const s = LCUI.session;
    LC.grade(LC.get(s.queue[s.pos]), g);
    s.stats[g]++;
    s.pos++;
    s.revealed = false;
    App.refresh();
    window.scrollTo(0, 0);
  },
};
