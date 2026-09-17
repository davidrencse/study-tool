/* ==========================================================================
   views-cards.js — Active-recall review (SM-2), browse, ChatGPT import, add
   ========================================================================== */

const CardsUI = {
  tab: 'review',
  deck: '',
  mode: 'due',
  session: null,
  browse: { q: '', classId: '', sort: 'due' },
  imp: { classId: '', topicId: '', count: 15, style: 'mixed', noteId: '', extra: '', pasted: '', parsed: [] },
  add: { classId: '', topicId: '' },
};

function startSession(deck, mode) {
  let pool = S().cards.filter((c) => !deck || c.classId === deck);
  if (mode === 'due') pool = pool.filter((c) => c.due <= todayStr());
  if (mode === 'weak') pool = pool.filter((c) => c.lapses > 0 || c.ease < 2.3);
  // due mode: most overdue first, then shuffle within the same day
  const queue = mode === 'due' ? shuffle(pool).sort((a, b) => a.due.localeCompare(b.due)).map((c) => c.id) : shuffle(pool).map((c) => c.id);
  CardsUI.session = { deck, mode, queue, pos: 0, revealed: false, typed: '', stats: [0, 0, 0, 0], seen: new Set(), total: queue.length };
}

function cardEditModal(id) {
  const c = S().cards.find((x) => x.id === id);
  if (!c) return;
  openModal('Edit card', `
    <form class="form" id="card-form">
      <label>Question<textarea name="front" rows="3" required>${esc(c.front)}</textarea></label>
      <label>Answer<textarea name="back" rows="3" required>${esc(c.back)}</textarea></label>
      <div class="form-row">
        <label>Class<select name="classId" data-cls>${classOptions(c.classId, { includeNone: true, noneLabel: 'No class' })}</select></label>
        <label>Topic<select name="topicId" data-top>${topicOptions(c.classId, c.topicId, { noneLabel: 'No topic' })}</select></label>
      </div>
      <p class="hint">Due ${fmtDate(c.due)}, repeats every ${c.interval} days. Reviewed ${c.reps} times, missed ${c.lapses}.</p>
      <div class="form-actions">
        <button type="button" class="btn ghost danger" data-del>Delete</button>
        <button type="button" class="btn ghost" data-reset>Start over</button>
        <span class="spacer"></span>
        <button type="button" class="btn ghost" data-close>Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>`, {
    onMount(m) {
      $('[data-cls]', m).addEventListener('change', (e) => ($('[data-top]', m).innerHTML = topicOptions(e.target.value, '', { noneLabel: 'No topic' })));
      $('#card-form', m).addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        Object.assign(c, { front: f.get('front').trim(), back: f.get('back').trim(), classId: f.get('classId'), topicId: f.get('topicId') });
        Store.save();
        closeModal();
        App.refresh();
      });
      $('[data-reset]', m).addEventListener('click', () => {
        Object.assign(c, { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: todayStr() });
        Store.save();
        closeModal();
        toast('Card starts over today', 'ok');
        App.refresh();
      });
      $('[data-del]', m).addEventListener('click', () => {
        if (!confirm('Delete this card?')) return;
        S().cards = S().cards.filter((x) => x.id !== id);
        if (CardsUI.session) CardsUI.session.queue = CardsUI.session.queue.filter((x) => x !== id);
        Store.save();
        closeModal();
        App.refresh();
      });
    },
  });
}

Views.cards = {
  title: 'Flashcards',
  render(_, query) {
    if (location.hash !== CardsUI._hash) {
      CardsUI._hash = location.hash;
      CardsUI.tab = query.tab || 'review';
      if (query.class !== undefined) {
        CardsUI.deck = query.class;
        CardsUI.imp.classId = query.class;
        CardsUI.add.classId = query.class;
        CardsUI.imp.topicId = '';
      }
      if (query.note) {
        CardsUI.imp.noteId = query.note;
        const n = getNote(query.note);
        if (n?.classId) CardsUI.imp.classId = n.classId;
      }
      if (query.topic) {
        CardsUI.imp.topicId = query.topic;
        CardsUI.imp.classId = getTopic(query.topic)?.classId || CardsUI.imp.classId;
      }
    }
    const tabs = [
      ['review', 'Review'],
      ['browse', `Browse (${S().cards.length})`],
      ['import', 'Make with AI'],
      ['add', 'Write a card'],
    ];
    return `
    <header class="page-head">
      <div><h1>Flashcards</h1><p class="lede">Short daily reviews. Cards you know come back less often.</p></div>
    </header>
    <nav class="subtabs inline" aria-label="Flashcard views">
      ${tabs.map(([k, l]) => `<button class="subtab ${CardsUI.tab === k ? 'active' : ''}" data-tab="${k}" ${CardsUI.tab === k ? 'aria-current="page"' : ''}>${l}</button>`).join('')}
    </nav>
    ${this[CardsUI.tab]()}`;
  },

  /* ---------- review ---------- */
  review() {
    const ss = CardsUI.session;
    if (!ss) {
      const deckRow = (id, name) => {
        const all = S().cards.filter((c) => !id || c.classId === id);
        const due = all.filter((c) => c.due <= todayStr()).length;
        const learned = all.filter((c) => c.interval >= 21).length;
        return `
          <button class="deck ${CardsUI.deck === id ? 'active' : ''}" data-deck="${id}" aria-pressed="${CardsUI.deck === id}">
            <span class="deck-name">${id ? mark(id) : '<i class="mark mk-all" aria-hidden="true"></i>'}${esc(name)}</span>
            <span class="deck-due"><span class="num">${due}</span> due</span>
            <span class="deck-total">${plural(all.length, 'card')}, ${learned} well learned</span>
          </button>`;
      };
      const pool = S().cards.filter((c) => !CardsUI.deck || c.classId === CardsUI.deck);
      const count = { due: pool.filter((c) => c.due <= todayStr()).length, cram: pool.length, weak: pool.filter((c) => c.lapses > 0 || c.ease < 2.3).length }[CardsUI.mode];
      return `
      <div class="grid-2 wide-left">
        <section class="panel">
          <header class="panel-head"><h2>Choose a deck</h2></header>
          <div class="decks">
            ${deckRow('', 'All classes')}
            ${S().classes.map((c) => deckRow(c.id, c.name)).join('')}
          </div>
          <div class="review-start">
            <div class="seg" role="radiogroup" aria-label="Which cards">
              <label><input type="radio" name="rmode" value="due" ${CardsUI.mode === 'due' ? 'checked' : ''}><span>Due today</span></label>
              <label><input type="radio" name="rmode" value="cram" ${CardsUI.mode === 'cram' ? 'checked' : ''}><span>Every card</span></label>
              <label><input type="radio" name="rmode" value="weak" ${CardsUI.mode === 'weak' ? 'checked' : ''}><span>Ones I miss</span></label>
            </div>
            <label class="check"><input type="checkbox" data-type-answers ${S().settings.typeAnswers ? 'checked' : ''}> Type my answer first</label>
            <button class="btn primary lg" data-act="start" ${count ? '' : 'disabled'}>Start ${plural(count, 'card')}</button>
          </div>
          ${!count && CardsUI.mode === 'due' ? '<p class="hint">Nothing due in this deck. Review every card, or make more with AI.</p>' : ''}
        </section>
        <section class="panel">
          <header class="panel-head"><h2>How a review works</h2></header>
          <ol class="steps">
            <li><strong>Answer from memory.</strong> Say it or type it before you look.</li>
            <li><strong>Flip the card</strong> with <kbd>Space</kbd> and compare honestly.</li>
            <li><strong>Grade yourself</strong> with <kbd>1</kbd> to <kbd>4</kbd>. Cards you know come back later; cards you miss come back soon.</li>
          </ol>
        </section>
      </div>`;
    }

    if (ss.pos >= ss.queue.length) {
      const [a, h, g, e] = ss.stats;
      const total = a + h + g + e;
      return `
      <section class="session-done">
        <h2>Deck finished</h2>
        <p class="lede">${plural(total, 'review')} across ${plural(ss.seen.size, 'card')}.</p>
        <dl class="facts wide">
          <div><dt>Again</dt><dd>${a}</dd></div><div><dt>Hard</dt><dd>${h}</dd></div><div><dt>Good</dt><dd>${g}</dd></div><div><dt>Easy</dt><dd>${e}</dd></div>
        </dl>
        <div class="btn-row center">
          <button class="btn" data-act="end">Back to decks</button>
          <button class="btn primary" data-act="again-cram">Go through this deck again</button>
        </div>
      </section>`;
    }

    const card = S().cards.find((c) => c.id === ss.queue[ss.pos]);
    if (!card) {
      ss.pos++;
      return this.review();
    }
    const cls = getClass(card.classId);
    const topic = getTopic(card.topicId);
    const typing = S().settings.typeAnswers;
    const remaining = ss.queue.length - ss.pos;
    const sim = ss.revealed && typing && ss.typed.trim() ? answerSimilarity(ss.typed, card.back) : null;
    const head = `
      <header class="ic-head">
        <span>${cls ? `${mark(cls.id)}${esc(cls.name)}` : 'No class'}${topic ? `<span class="muted">, ${esc(topic.name)}</span>` : ''}</span>
        <span class="ic-side">${ss.revealed ? 'Answer' : card.reps === 0 ? 'New card' : 'Question'}</span>
      </header>`;

    return `
    <div class="review">
      <div class="review-top">
        <span class="num">${remaining} left</span>
        ${progressBar(Math.round((ss.pos / ss.queue.length) * 100))}
        <button class="btn sm ghost" data-act="edit" data-id="${card.id}">Edit card</button>
        <button class="btn sm ghost" data-act="end">Stop</button>
      </div>

      <article class="index-card ${ss.revealed ? 'is-back' : ''}" aria-live="polite">
        ${head}
        ${!ss.revealed
          ? `<div class="ic-body"><div class="ic-text prose">${renderMarkdown(card.front)}</div></div>`
          : `<div class="ic-body">
               <div class="ic-q">${esc(card.front)}</div>
               <div class="ic-text prose">${renderMarkdown(card.back)}</div>
             </div>`}
      </article>

      ${!ss.revealed ? `
        <div class="review-controls">
          ${typing ? `<textarea class="recall-input" rows="2" placeholder="Type what you remember, then press Ctrl Enter" aria-label="Your answer">${esc(ss.typed)}</textarea>` : ''}
          <button class="btn primary lg block" data-act="reveal">Flip card <kbd>Space</kbd></button>
        </div>
      ` : `
        <div class="review-controls">
          ${typing ? `<div class="your-answer"><span class="muted small">${sim !== null ? `Your answer has ${sim}% of the key words` : 'Your answer'}</span><p>${esc(ss.typed) || '<span class="muted">Nothing</span>'}</p></div>` : ''}
          <div class="grades" role="group" aria-label="How well did you know it?">
            ${['Again', 'Hard', 'Good', 'Easy'].map((l, i) => `
              <button class="grade ${i === 2 ? 'primary' : ''}" data-grade="${i}"><span>${l}</span><small>${SRS.label(card, i)}</small><kbd>${i + 1}</kbd></button>`).join('')}
          </div>
          <p class="center"><a class="quiet-link" href="#/assist?tpl=explain${card.topicId ? `&topic=${card.topicId}` : card.classId ? `&class=${card.classId}` : ''}">Still confused? Ask ChatGPT to explain it</a></p>
        </div>
      `}
    </div>`;
  },

  /* ---------- browse ---------- */
  browse() {
    const b = CardsUI.browse;
    const q = b.q.toLowerCase();
    let list = S().cards.filter((c) => (!b.classId || c.classId === b.classId) && (!q || c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)));
    const sorters = {
      due: (x, y) => x.due.localeCompare(y.due),
      newest: (x, y) => y.created - x.created,
      hardest: (x, y) => x.ease - y.ease || y.lapses - x.lapses,
    };
    list.sort(sorters[b.sort]);
    const shown = list.slice(0, 400);
    return `
    <section class="panel">
      <div class="filter-row">
        <input type="search" data-b="q" value="${esc(b.q)}" placeholder="Search cards" aria-label="Search cards">
        <select data-b="classId" aria-label="Class"><option value="">All classes</option>${S().classes.map((c) => `<option value="${c.id}" ${c.id === b.classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <select data-b="sort" aria-label="Sort">
          <option value="due" ${b.sort === 'due' ? 'selected' : ''}>Due soonest</option>
          <option value="newest" ${b.sort === 'newest' ? 'selected' : ''}>Newest</option>
          <option value="hardest" ${b.sort === 'hardest' ? 'selected' : ''}>Hardest</option>
        </select>
      </div>
      <p class="muted small">${list.length} card${list.length === 1 ? '' : 's'}${list.length > shown.length ? ` (showing first ${shown.length})` : ''}</p>
      <div class="table-wrap"><table class="table cards-table">
        <thead><tr><th>Question</th><th>Answer</th><th>Class</th><th>Due</th><th class="num">Every</th><th><span class="sr-only">Edit</span></th></tr></thead>
        <tbody>
          ${shown.map((c) => `
            <tr>
              <td>${esc(c.front)}</td>
              <td class="muted">${esc(c.back)}</td>
              <td class="nowrap">${c.classId ? `${mark(c.classId)}${esc(getClass(c.classId)?.short || '')}` : '<span class="muted">None</span>'}${c.topicId ? `<div class="muted small">${esc(getTopic(c.topicId)?.name || '')}</div>` : ''}</td>
              <td class="nowrap ${c.due <= todayStr() ? 'strong' : ''}">${c.due <= todayStr() ? 'Today' : fmtDate(c.due)}</td>
              <td class="num">${c.interval ? `${c.interval}d` : '<span class="muted">New</span>'}</td>
              <td><button class="btn sm ghost" data-act="edit" data-id="${c.id}">Edit</button></td>
            </tr>`).join('') || `<tr><td colspan="6">${emptyState('cards', 'No cards match')}</td></tr>`}
        </tbody>
      </table></div>
    </section>`;
  },

  /* ---------- import from ChatGPT ---------- */
  import() {
    const im = CardsUI.imp;
    const topic = getTopic(im.topicId);
    const prompt = buildCardPrompt({
      cls: getClass(im.classId)?.name || 'my',
      topic: topic?.name || '',
      count: im.count,
      style: im.style,
      source: getNote(im.noteId)?.body.slice(0, 12000) || '',
      extra: im.extra,
    });
    return `
    <div class="grid-2">
      <section class="panel">
        <header class="panel-head"><h2>1. Ask ChatGPT for cards</h2></header>
        <div class="form">
          <div class="form-row">
            <label>Class<select data-i="classId">${classOptions(im.classId, { includeNone: true, noneLabel: 'No class' })}</select></label>
            <label>Topic<select data-i="topicId">${topicOptions(im.classId, im.topicId, { noneLabel: 'Whole class' })}</select></label>
          </div>
          <div class="form-row">
            <label>How many<input type="number" min="5" max="60" data-i="count" value="${im.count}"></label>
            <label>Style<select data-i="style">
              ${[['basic', 'Question and answer'], ['cloze', 'Fill-in-the-blank'], ['mixed', 'Mixed'], ['deep', 'Deep understanding']].map(([k, l]) => `<option value="${k}" ${im.style === k ? 'selected' : ''}>${l}</option>`).join('')}
            </select></label>
          </div>
          <label>Source note (optional)<select data-i="noteId"><option value="">None, use what ChatGPT knows</option>${S().notes.map((n) => `<option value="${n.id}" ${n.id === im.noteId ? 'selected' : ''}>${esc(n.title)}</option>`).join('')}</select></label>
          <label>Extra instructions<input data-i="extra" value="${esc(im.extra)}" placeholder="Focus on page replacement algorithms"></label>
        </div>
        <textarea class="prompt-box" rows="10" aria-label="Flashcard prompt">${esc(prompt)}</textarea>
        <div class="btn-row">
          <button class="btn primary" data-act="send-prompt">Copy and open ChatGPT ${icon('external', 15)}</button>
          <button class="btn" data-act="copy-prompt">Copy only</button>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head"><h2>2. Paste its reply</h2></header>
        <p class="hint">Works with <code>Q:</code> and <code>A:</code> lines, tab-separated lines, <code>question | answer</code> or <code>question :: answer</code>.</p>
        <textarea class="paste-cards" rows="10" placeholder="Q: What is a page fault?&#10;A: A trap raised when a page is not in memory">${esc(im.pasted)}</textarea>
        <div class="btn-row"><button class="btn" data-act="parse">Preview cards</button><button class="btn ghost" data-act="clear-paste">Clear</button></div>

        ${im.parsed.length ? `
          <h2 class="step">3. Check them (${im.parsed.length})</h2>
          <div class="btn-row"><button class="btn sm ghost" data-act="sel-all">Select all</button><button class="btn sm ghost" data-act="sel-none">Select none</button></div>
          <ul class="suggest-cards scroll">
            ${im.parsed.map((c, i) => `
              <li><label class="check"><input type="checkbox" data-pc="${i}" ${c.dup ? '' : 'checked'}>
              <span><b>${esc(c.front)}</b>${c.dup ? ' <span class="tag">Already have it</span>' : ''}<br><span class="muted">${esc(c.back)}</span></span></label></li>`).join('')}
          </ul>
          <p class="hint">They go into <strong>${esc(getClass(im.classId)?.name || 'no class')}</strong>${topic ? `, topic <strong>${esc(topic.name)}</strong>` : ''}. Change that in step 1.</p>
          <button class="btn primary" data-act="do-import">Add selected cards</button>
        ` : ''}
      </section>
    </div>`;
  },

  /* ---------- add ---------- */
  add() {
    const a = CardsUI.add;
    return `
    <section class="panel narrow">
      <form class="form" id="add-card">
        <div class="form-row">
          <label>Class<select name="classId" data-add="classId">${classOptions(a.classId, { includeNone: true, noneLabel: 'No class' })}</select></label>
          <label>Topic<select name="topicId" data-add="topicId">${topicOptions(a.classId, a.topicId, { noneLabel: 'No topic' })}</select></label>
        </div>
        <label>Question<textarea name="front" rows="3" required></textarea></label>
        <label>Answer<textarea name="back" rows="3" required placeholder="Keep it short"></textarea></label>
        <div class="form-actions"><span class="hint">Press <kbd>Ctrl</kbd> <kbd>Enter</kbd> to add</span><span class="spacer"></span><button class="btn primary">Add card</button></div>
      </form>
      ${S().cards.some((c) => c.source === 'manual') ? `<p class="hint">Recently written: ${S().cards.filter((c) => c.source === 'manual').slice(-3).reverse().map((c) => `“${esc(c.front.slice(0, 40))}”`).join(', ')}</p>` : ''}
    </section>`;
  },

  mount(el) {
    const ui = CardsUI;
    const ss = ui.session;

    el.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) {
        ui.tab = tab.dataset.tab;
        return App.refresh();
      }
      const deck = e.target.closest('[data-deck]');
      if (deck) {
        ui.deck = deck.dataset.deck;
        return App.refresh();
      }
      const g = e.target.closest('[data-grade]');
      if (g) return this.grade(+g.dataset.grade);

      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'start') {
        startSession(ui.deck, ui.mode);
        App.refresh();
      }
      if (act === 'reveal') this.reveal();
      if (act === 'end') {
        ui.session = null;
        App.refresh();
      }
      if (act === 'again-cram') {
        startSession(ss.deck, 'cram');
        App.refresh();
      }
      if (act === 'edit') cardEditModal(btn.dataset.id);

      // import tab
      const im = ui.imp;
      const promptBox = $('.prompt-box', el);
      if (act === 'send-prompt') sendToChatGPT(promptBox.value);
      if (act === 'copy-prompt') toast((await copyText(promptBox.value)) ? 'Prompt copied' : 'Could not copy. Select the text and copy it yourself.', 'ok');
      if (act === 'parse') {
        im.pasted = $('.paste-cards', el).value;
        const existing = new Set(S().cards.map((c) => c.front.trim().toLowerCase()));
        im.parsed = parseCards(im.pasted).map((c) => ({ ...c, dup: existing.has(c.front.trim().toLowerCase()) }));
        if (!im.parsed.length) toast('No cards found. Each card needs a line starting with Q: and one starting with A:', 'warn');
        App.refresh();
      }
      if (act === 'clear-paste') {
        im.pasted = '';
        im.parsed = [];
        App.refresh();
      }
      if (act === 'sel-all' || act === 'sel-none') $$('[data-pc]', el).forEach((c) => (c.checked = act === 'sel-all'));
      if (act === 'do-import') {
        const picked = $$('[data-pc]:checked', el).map((c) => im.parsed[+c.dataset.pc]);
        if (!picked.length) return toast('Select at least one card', 'warn');
        picked.forEach(({ front, back }) => S().cards.push(newCard({ front, back, classId: im.classId, topicId: im.topicId, source: 'chatgpt' })));
        Store.save();
        im.pasted = '';
        im.parsed = [];
        toast(`Added ${plural(picked.length, 'card')}, due today`, 'ok');
        ui.deck = im.classId;
        ui.tab = 'review';
        ui.mode = 'due';
        App.refresh();
      }
    });

    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'rmode') {
        ui.mode = t.value;
        App.refresh();
      }
      if (t.matches('[data-type-answers]')) {
        S().settings.typeAnswers = t.checked;
        Store.save();
      }
      if (t.dataset.b) {
        ui.browse[t.dataset.b] = t.value;
        App.refresh();
      }
      if (t.dataset.i) {
        const k = t.dataset.i;
        ui.imp[k] = k === 'count' ? Math.max(5, Math.min(60, +t.value || 15)) : t.value;
        if (k === 'classId') ui.imp.topicId = '';
        if (k === 'noteId' && getNote(t.value)?.classId && !ui.imp.classId) ui.imp.classId = getNote(t.value).classId;
        ui.imp.pasted = $('.paste-cards', el)?.value ?? ui.imp.pasted;
        App.refresh();
      }
      if (t.dataset.add) {
        ui.add[t.dataset.add] = t.value;
        if (t.dataset.add === 'classId') {
          ui.add.topicId = '';
          $('[data-add="topicId"]', el).innerHTML = topicOptions(t.value, '', { noneLabel: 'No topic' });
        }
      }
    });

    const bSearch = $('[data-b="q"]', el);
    bSearch?.addEventListener('input', debounce(() => {
      ui.browse.q = bSearch.value;
      App.refresh();
      const s = $('[data-b="q"]', App.viewEl);
      s.focus();
      s.setSelectionRange(s.value.length, s.value.length);
    }, 250));

    const addForm = $('#add-card', el);
    if (addForm) {
      const submit = () => {
        const f = new FormData(addForm);
        const front = f.get('front').trim();
        const back = f.get('back').trim();
        if (!front || !back) return toast('Fill in the question and the answer', 'warn');
        S().cards.push(newCard({ front, back, classId: f.get('classId'), topicId: f.get('topicId') }));
        Store.save();
        toast('Card added', 'ok');
        App.refresh();
        $('#add-card textarea', App.viewEl)?.focus();
      };
      addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submit();
      });
      addForm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          submit();
        }
      });
    }

    // review keyboard + typed answer
    const recall = $('.recall-input', el);
    if (recall) {
      recall.focus();
      recall.addEventListener('input', () => (ss.typed = recall.value));
    }
    this._keys = (e) => {
      if (!ui.session || ui.tab !== 'review' || $('.modal-backdrop')) return;
      const s = ui.session;
      if (s.pos >= s.queue.length) return;
      const inField = e.target.matches('textarea, input, select');
      if (!s.revealed) {
        if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || (!inField && (e.key === ' ' || e.key === 'Enter'))) {
          e.preventDefault();
          this.reveal();
        }
      } else if (!inField && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        this.grade(+e.key - 1);
      } else if (!inField && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        this.grade(2);
      }
    };
    document.addEventListener('keydown', this._keys);
  },

  unmount() {
    document.removeEventListener('keydown', this._keys);
  },

  reveal() {
    const ss = CardsUI.session;
    const r = $('.recall-input', App.viewEl);
    if (r) ss.typed = r.value;
    ss.revealed = true;
    App.refresh();
  },

  grade(g) {
    const ss = CardsUI.session;
    const id = ss.queue[ss.pos];
    const card = S().cards.find((c) => c.id === id);
    if (!card) return;
    SRS.apply(card, g);
    ss.stats[g]++;
    ss.seen.add(id);
    if (card.interval === 0) ss.queue.push(id); // see it again this session
    ss.pos++;
    ss.revealed = false;
    ss.typed = '';
    App.refresh();
  },
};
