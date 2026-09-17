/* ==========================================================================
   views-grades.js — grade tracker per class
   Weighted categories, scores, current grade, and "what do I need?"
   ========================================================================== */

function scaleOf(c) {
  return c.grading?.scale || GRADE_SCALE;
}
function letterFor(c, pct) {
  if (pct == null || Number.isNaN(pct)) return '';
  return scaleOf(c).find(([min]) => pct >= min)?.[1] || 'F';
}

/** current: weighted % over graded categories; best/worst: if the rest scores 100% / 0%. */
function gradeSummary(classId) {
  const c = getClass(classId);
  const g = c?.grading;
  if (!g) return null;
  const totalW = g.categories.reduce((a, k) => a + (+k.weight || 0), 0) || 1;
  let earnedW = 0;
  let gradedW = 0;
  const cats = g.categories.map((k) => {
    const items = g.items.filter((i) => i.catId === k.id && i.score !== '' && i.score != null && +i.max > 0);
    const got = items.reduce((a, i) => a + +i.score, 0);
    const max = items.reduce((a, i) => a + +i.max, 0);
    const avg = max ? (got / max) * 100 : null;
    if (avg != null) {
      earnedW += (avg / 100) * k.weight;
      gradedW += +k.weight;
    }
    return { ...k, avg, count: items.length };
  });
  const current = gradedW ? (earnedW / gradedW) * 100 : null;
  const remaining = totalW - gradedW;
  return {
    cats,
    current,
    letter: letterFor(c, current),
    gradedPct: (gradedW / totalW) * 100,
    best: ((earnedW + remaining) / totalW) * 100,
    worst: (earnedW / totalW) * 100,
    needFor: (target) => (remaining > 0 ? ((target / 100) * totalW - earnedW) / remaining * 100 : null),
    totalW,
  };
}

const pctText = (v, d = 1) => (v == null ? '—' : `${v.toFixed(d)}%`);

const GradesUI = { classId: '' };

Views.grades = {
  title: 'Grades',
  render(_, query) {
    if (location.hash !== GradesUI._hash) {
      GradesUI._hash = location.hash;
      if (query.class) GradesUI.classId = query.class;
    }
    const classes = S().classes;
    const c = getClass(GradesUI.classId) || classes[0];
    if (!c) return emptyState('grades', 'No classes yet');
    GradesUI.classId = c.id;
    const g = c.grading;
    const sum = gradeSummary(c.id);
    const target = g.target ?? 90;
    const need = sum.needFor(target);
    const targetLetter = letterFor(c, target);

    return `
    <header class="page-head">
      <div><h1>Grades</h1><p class="lede">Enter scores as they come back. Weights come from each syllabus, and you can edit them.</p></div>
    </header>

    <div class="grade-overview">
      ${classes.map((k) => {
        const x = gradeSummary(k.id);
        return `
        <button class="grade-tile ${k.id === c.id ? 'active' : ''}" data-cls="${k.id}" aria-pressed="${k.id === c.id}">
          <span class="grade-tile-name">${mark(k.id)}${esc(k.short || k.name)}</span>
          <span class="grade-tile-letter ${x.current == null ? 'empty' : ''}">${x.current == null ? 'Not graded yet' : x.letter}</span>
          <span class="grade-tile-pct num">${x.current == null ? 'Add a score to start' : pctText(x.current)}</span>
        </button>`;
      }).join('')}
    </div>

    <div class="grid-2 wide-left">
      <div class="stack">
        <section class="panel">
          <header class="panel-head"><h2>${esc(c.name)} scores</h2></header>
          <form class="score-add" id="score-add">
            <input name="name" placeholder="What was graded (e.g. PA1)" required aria-label="Name">
            <select name="catId" aria-label="Category">${g.categories.map((k) => `<option value="${k.id}">${esc(k.name)}</option>`).join('')}</select>
            <input name="score" type="number" step="any" min="0" placeholder="Score" required aria-label="Score">
            <input name="max" type="number" step="any" min="0.01" placeholder="Out of" value="100" required aria-label="Out of">
            <button class="btn primary">Add score</button>
          </form>
          ${g.categories.map((k) => {
            const items = g.items.filter((i) => i.catId === k.id);
            const cat = sum.cats.find((x) => x.id === k.id);
            return `
            <div class="score-group">
              <div class="score-group-head"><strong>${esc(k.name)}</strong><span class="muted small">${k.weight}% of grade</span><span class="spacer"></span><span class="num">${cat.avg == null ? '' : pctText(cat.avg)}</span></div>
              <ul class="rows compact">
                ${items.map((i) => `
                  <li class="row">
                    <input class="grow compact" data-item="${i.id}" data-k="name" value="${esc(i.name)}" aria-label="Name">
                    <input class="compact score-num" type="number" step="any" data-item="${i.id}" data-k="score" value="${esc(i.score)}" aria-label="Score">
                    <span class="muted">/</span>
                    <input class="compact score-num" type="number" step="any" data-item="${i.id}" data-k="max" value="${esc(i.max)}" aria-label="Out of">
                    <span class="num score-pct">${+i.max ? pctText((+i.score / +i.max) * 100, 0) : ''}</span>
                    <button class="icon-btn sm" data-del-item="${i.id}" aria-label="Delete ${esc(i.name)}">${icon('close', 14)}</button>
                  </li>`).join('') || '<li class="rows-empty">No scores yet.</li>'}
              </ul>
            </div>`;
          }).join('')}
        </section>

        <section class="panel">
          <header class="panel-head"><h2>Weights</h2><span class="small ${Math.round(sum.totalW) === 100 ? 'muted' : 'strong'}">${Math.round(sum.totalW) === 100 ? 'Adds up to 100%' : `Adds up to ${sum.totalW}%`}</span></header>
          <ul class="rows compact">
            ${g.categories.map((k) => `
              <li class="row">
                <input class="grow compact" data-cat="${k.id}" data-k="name" value="${esc(k.name)}" aria-label="Category name">
                <input class="compact score-num" type="number" step="any" min="0" data-cat="${k.id}" data-k="weight" value="${k.weight}" aria-label="Weight in percent">
                <span class="muted">%</span>
                <button class="icon-btn sm" data-del-cat="${k.id}" aria-label="Delete ${esc(k.name)}">${icon('close', 14)}</button>
              </li>`).join('')}
          </ul>
          <button class="btn sm" data-act="add-cat">${icon('plus', 14)}Category</button>
          ${c.info.grading ? `<p class="hint">From the syllabus: ${esc(c.info.grading)}</p>` : ''}
        </section>
      </div>

      <div class="stack">
        <section class="panel grade-card">
          <p class="kind">${mark(c.id)}Current grade</p>
          <div class="grade-big">${sum.current == null ? '<span class="grade-empty">No scores yet. Add your first one on the left.</span>' : `<span class="grade-letter">${sum.letter}</span><span class="num">${pctText(sum.current)}</span>`}</div>
          ${progressBar(Math.round(sum.gradedPct))}
          <p class="hint">${Math.round(sum.gradedPct)}% of the course has been graded so far.</p>
          <dl class="facts">
            <div><dt>If the rest goes perfectly</dt><dd>${pctText(sum.best)}</dd></div>
            <div><dt>If you got 0 on the rest</dt><dd>${pctText(sum.worst)}</dd></div>
          </dl>
        </section>

        <section class="panel">
          <header class="panel-head"><h2>What do I need?</h2></header>
          <label class="inline-label">I want at least
            <select data-target>${scaleOf(c).filter(([min]) => min > 0).map(([min, l]) => `<option value="${min}" ${min === target ? 'selected' : ''}>${l} (${min}%)</option>`).join('')}</select>
          </label>
          <p class="need">
            ${need == null ? 'Everything has been graded.'
              : need <= 0 ? `You already have a ${esc(targetLetter)} locked in, even with zeros on the rest.`
              : need > 100 ? `A ${esc(targetLetter)} isn’t reachable anymore. The best you can finish with is ${pctText(sum.best)}.`
              : `Average <strong class="num">${need.toFixed(1)}%</strong> on everything that’s left to get a ${esc(targetLetter)}.`}
          </p>
          ${need != null && sum.gradedPct < 100 ? `<p class="hint">Still to come: ${sum.cats.filter((k) => k.avg == null).map((k) => `${esc(k.name)} (${k.weight}%)`).join(', ') || 'the rest of partly graded categories'}.</p>` : ''}
        </section>
        <section class="panel">
          <header class="panel-head"><h2>Letter scale</h2></header>
          <div class="scale">${scaleOf(c).map(([min, l]) => `<span><b>${l}</b>${min}%+</span>`).join('')}</div>
        </section>
      </div>
    </div>`;
  },

  mount(el) {
    const c = getClass(GradesUI.classId);
    if (!c) return;
    const g = c.grading;
    const save = debounce(() => Store.save(), 300);

    el.addEventListener('click', (e) => {
      const tile = e.target.closest('[data-cls]');
      if (tile) {
        GradesUI.classId = tile.dataset.cls;
        return App.refresh();
      }
      const di = e.target.closest('[data-del-item]');
      if (di) {
        g.items = g.items.filter((i) => i.id !== di.dataset.delItem);
        Store.save();
        return App.refresh();
      }
      const dc = e.target.closest('[data-del-cat]');
      if (dc) {
        const used = g.items.some((i) => i.catId === dc.dataset.delCat);
        if (used && !confirm('Delete this category and its scores?')) return;
        g.categories = g.categories.filter((k) => k.id !== dc.dataset.delCat);
        g.items = g.items.filter((i) => i.catId !== dc.dataset.delCat);
        Store.save();
        return App.refresh();
      }
      if (e.target.closest('[data-act="add-cat"]')) {
        g.categories.push({ id: uid(), name: 'New category', weight: 0 });
        Store.save();
        App.refresh();
      }
    });

    el.addEventListener('change', (e) => {
      const x = e.target;
      if (x.matches('[data-target]')) {
        g.target = +x.value;
        Store.save();
        return App.refresh();
      }
      const it = x.dataset.item && g.items.find((i) => i.id === x.dataset.item);
      if (it) {
        it[x.dataset.k] = x.dataset.k === 'name' ? x.value : x.value === '' ? '' : +x.value;
        Store.save();
        return App.refresh();
      }
      const cat = x.dataset.cat && g.categories.find((k) => k.id === x.dataset.cat);
      if (cat) {
        cat[x.dataset.k] = x.dataset.k === 'weight' ? +x.value || 0 : x.value;
        Store.save();
        App.refresh();
      }
    });
    el.addEventListener('input', () => save());

    $('#score-add', el).addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      g.items.push({ id: uid(), name: f.get('name').trim(), catId: f.get('catId'), score: +f.get('score'), max: +f.get('max') });
      Store.save();
      toast('Score added', 'ok');
      App.refresh();
      $('#score-add input', App.viewEl)?.focus();
    });
  },
};
