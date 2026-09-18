/* ==========================================================================
   views-main.js — Today (dashboard), Classes, Settings + shared editors
   ========================================================================== */

/* ------------------------------ shared pieces ------------------------------ */
function nextDeadline(classId) {
  const t = todayStr();
  return deadlines().filter((e) => e.classId === classId && !e.done && e.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
}

function classRows(classes) {
  return `
  <div class="class-rows" role="list">
    ${classes.map((c) => {
      const pct = classMastery(c.id);
      const next = nextDeadline(c.id);
      const due = dueCards(c.id).length;
      return `
      <div class="class-row" role="listitem">
        <a class="class-row-name" href="#/classes/${c.id}">${mark(c.id)}<span><strong>${esc(c.name)}</strong><small>${esc(c.info.meeting || c.info.code || 'Add meeting time in class info')}</small></span></a>
        <div class="class-row-mastery"><span class="num">${pct}%</span>${progressBar(pct)}</div>
        <a class="class-row-due" href="#/cards?class=${c.id}"><span class="num">${due}</span> due</a>
        <div class="class-row-next">${next ? `${esc(next.title.replace('[Template] ', ''))} <span class="muted">${relDay(next.date).toLowerCase()}</span>` : '<span class="muted">No deadlines</span>'}</div>
        <nav class="class-row-links" aria-label="${esc(c.name)} shortcuts">
          <a href="#/notes?class=${c.id}">Notes</a><a href="#/tree/${c.id}">Skill tree</a><a href="#/assist?class=${c.id}">Ask AI</a>
        </nav>
      </div>`;
    }).join('')}
  </div>`;
}

function eventRow(e, { showClass = true } = {}) {
  const overdue = !e.done && e.date < todayStr();
  const type = EVENT_TYPES[e.type] || EVENT_TYPES.other;
  return `
  <li class="row event-row ${e.done ? 'done' : ''}">
    <input type="checkbox" data-act="toggle-event" data-id="${e.id}" ${e.done ? 'checked' : ''} aria-label="Mark ${esc(e.title)} done">
    <button class="row-main" data-act="edit-event" data-id="${e.id}">
      <span class="row-title">${esc(e.title)}</span>
      <span class="row-meta">${showClass && e.classId ? `${mark(e.classId)}${esc(getClass(e.classId)?.short || '')}` : ''}<span class="${type.major ? 'tag solid' : 'tag'}">${type.label}</span>${e.time ? `<span>${fmtTime(e.time)}</span>` : ''}</span>
    </button>
    <span class="when ${overdue ? 'tag solid' : ''}">${relDay(e.date)}</span>
  </li>`;
}

function taskRow(t) {
  return `
  <li class="row task-row ${t.done ? 'done' : ''} ${t.priority === 'high' ? 'high' : ''}">
    <input type="checkbox" data-act="toggle-task" data-id="${t.id}" ${t.done ? 'checked' : ''} aria-label="Complete ${esc(t.title)}">
    <span class="row-title">${esc(t.title)}</span>
    ${t.priority === 'high' ? '<span class="tag">High</span>' : ''}
    <span class="row-meta">${esc(t.category)}</span>
    <button class="icon-btn sm reveal" data-act="del-task" data-id="${t.id}" aria-label="Delete ${esc(t.title)}">${icon('close', 14)}</button>
  </li>`;
}

/** Common click handlers used by several views (events + tasks). Returns true if handled. */
function handleCommonAction(act, id) {
  const s = S();
  if (act === 'toggle-event') {
    const e = s.events.find((x) => x.id === id);
    e.done = !e.done;
  } else if (act === 'edit-event') {
    editEventModal(id);
    return true;
  } else if (act === 'toggle-task') {
    const t = s.tasks.find((x) => x.id === id);
    t.done = !t.done;
  } else if (act === 'del-task') {
    s.tasks = s.tasks.filter((x) => x.id !== id);
  } else return false;
  Store.save();
  App.refresh();
  return true;
}

function editEventModal(id, defaults = {}) {
  const existing = id ? S().events.find((e) => e.id === id) : null;
  const e = existing || { title: '', classId: defaults.classId || S().classes[0]?.id || '', date: defaults.date || todayStr(), time: '23:59', type: 'assignment', notes: '', done: false };
  openModal(existing ? 'Edit deadline' : 'Add deadline', `
    <form class="form" id="event-form">
      <label>Title<input name="title" required value="${esc(e.title)}" placeholder="Problem set 2"></label>
      <div class="form-row">
        <label>Class<select name="classId">${classOptions(e.classId, { includeNone: true, noneLabel: 'Personal' })}</select></label>
        <label>Type<select name="type">${Object.entries(EVENT_TYPES).map(([k, v]) => `<option value="${k}" ${k === e.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
      </div>
      <div class="form-row">
        <label>Due date<input type="date" name="date" required value="${e.date}"></label>
        <label>Time<input type="time" name="time" value="${e.time || ''}"></label>
      </div>
      <label>Notes<textarea name="notes" rows="3" placeholder="Rubric, links, what to submit">${esc(e.notes)}</textarea></label>
      <label class="check"><input type="checkbox" name="done" ${e.done ? 'checked' : ''}> Done</label>
      <div class="form-actions">
        ${existing ? '<button type="button" class="btn ghost danger" data-del>Delete</button>' : ''}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" data-close>Cancel</button>
        <button class="btn primary">${existing ? 'Save deadline' : 'Add deadline'}</button>
      </div>
    </form>`, {
    onMount(m) {
      $('#event-form', m).addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const data = { title: f.get('title').trim(), classId: f.get('classId'), type: f.get('type'), date: f.get('date'), time: f.get('time'), notes: f.get('notes'), done: f.get('done') === 'on' };
        if (existing) Object.assign(existing, data);
        else S().events.push({ id: uid(), ...data });
        Store.save();
        closeModal();
        toast(existing ? 'Deadline saved' : 'Deadline added', 'ok');
        App.refresh();
      });
      $('[data-del]', m)?.addEventListener('click', () => {
        if (!confirm('Delete this deadline?')) return;
        S().events = S().events.filter((x) => x.id !== id);
        Store.save();
        closeModal();
        App.refresh();
      });
    },
  });
}

function editTopicModal(topicId, classId, onDone, defaults = {}) {
  const existing = topicId ? getTopic(topicId) : null;
  const t = existing || { name: '', desc: '', prereqs: [], mastery: 0, classId, ...defaults };
  const cid = existing?.classId || classId;
  const others = S().topics.filter((x) => x.id !== topicId);
  openModal(existing ? 'Edit topic' : 'New topic', `
    <form class="form" id="topic-form">
      <label>Topic name<input name="name" required value="${esc(t.name)}" placeholder="Page replacement algorithms"></label>
      <label>What it covers<textarea name="desc" rows="2">${esc(t.desc)}</textarea></label>
      <label>Class<select name="classId">${classOptions(cid)}</select></label>
      <fieldset><legend>How well do you know it?</legend><div class="seg">${MASTERY.map((m, i) => `<label><input type="radio" name="mastery" value="${i}" ${t.mastery === i ? 'checked' : ''}><span>${m.label}</span></label>`).join('')}</div></fieldset>
      <fieldset><legend>Learn these first</legend>
        <p class="hint">Sets the order in the skill tree. Topics from other classes become connections on the map.</p>
        <input type="search" placeholder="Filter topics" data-filter class="compact">
        <div class="check-list">
          ${S().classes.map((c) => {
            const ts = others.filter((x) => x.classId === c.id);
            if (!ts.length) return '';
            return `<div class="check-group"><div class="check-group-title">${mark(c.id)}${esc(c.name)}</div>${ts.map((x) => `<label class="check"><input type="checkbox" name="prereqs" value="${x.id}" ${t.prereqs.includes(x.id) ? 'checked' : ''}> ${esc(x.name)}</label>`).join('')}</div>`;
          }).join('')}
        </div>
      </fieldset>
      <div class="form-actions">
        ${existing ? '<button type="button" class="btn ghost danger" data-del>Delete topic</button>' : ''}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" data-close>Cancel</button>
        <button class="btn primary">${existing ? 'Save topic' : 'Add topic'}</button>
      </div>
    </form>`, {
    wide: true,
    onMount(m) {
      $('[data-filter]', m).addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        $$('.check-list .check', m).forEach((l) => (l.style.display = l.textContent.toLowerCase().includes(q) ? '' : 'none'));
      });
      $('#topic-form', m).addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const data = { name: f.get('name').trim(), desc: f.get('desc').trim(), classId: f.get('classId'), mastery: Number(f.get('mastery') || 0), prereqs: f.getAll('prereqs') };
        let id = topicId;
        if (existing) Object.assign(existing, data);
        else {
          id = uid();
          S().topics.push({ id, ...data });
        }
        Store.save();
        closeModal();
        onDone ? onDone(id) : App.refresh();
      });
      $('[data-del]', m)?.addEventListener('click', () => {
        if (!confirm(`Delete the topic “${t.name}”? Its flashcards stay, without the topic.`)) return;
        deleteTopic(topicId);
        closeModal();
        onDone ? onDone(null) : App.refresh();
      });
    },
  });
}

function deleteTopic(id) {
  const s = S();
  s.topics = s.topics.filter((x) => x.id !== id);
  s.topics.forEach((x) => (x.prereqs = x.prereqs.filter((p) => p !== id)));
  s.links = s.links.filter((l) => l.a !== id && l.b !== id);
  s.cards.forEach((c) => {
    if (c.topicId === id) c.topicId = '';
  });
  Store.save();
}

function reviewHeatmap(weeks = 18) {
  const log = S().reviewLog;
  const end = todayStr();
  const endDow = parseYmd(end).getDay();
  const start = addDays(end, -(weeks * 7 - 1) - (6 - endDow));
  const max = Math.max(1, ...Object.values(log));
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const n = log[d] || 0;
    const lvl = d > end ? 'x' : n === 0 ? 0 : Math.ceil((n / max) * 4);
    cells += `<span class="hm hm${lvl}" title="${fmtDate(d)}: ${n} review${n === 1 ? '' : 's'}"></span>`;
  }
  return `<div class="heatmap">${cells}</div>`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* ------------------------------ Today ------------------------------ */
function nextClassSession() {
  const t = todayStr();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return occurrences(t, addDays(t, 7))
    .filter((e) => isScheduled(e) && e.type === 'lecture' && e.time)
    .find((e) => e.date > t || toMin(e.end || e.time) > nowMin);
}

function greeting() {
  const h = new Date().getHours();
  const name = (S().settings.name || '').trim().split(/\s+/)[0];
  const part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${esc(name)}` : part;
}

Views.dashboard = {
  title: 'Today',
  render() {
    const s = S();
    const t = todayStr();
    const due = dueCards().length;
    const tasksToday = s.tasks.filter((x) => x.date === t);
    const openToday = tasksToday.filter((x) => !x.done).length;
    const upcoming = deadlines().filter((e) => !e.done && !e.title.includes('[Template]') && e.date <= addDays(t, 14)).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    const weekCount = deadlines().filter((e) => !e.done && e.date >= t && e.date <= addDays(t, 7)).length;
    const overdue = deadlines().filter((e) => !e.done && e.date < t).length;
    const agenda = occurrences(t, t).filter(isScheduled);
    const classesToday = agenda.filter((e) => e.type === 'lecture').length;
    const rDone = (s.routineDone[t] || []).length;
    const streak = studyStreak();
    const next = nextClassSession();
    const exam = deadlines().filter((e) => e.type === 'exam' && !e.done && e.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
    const focusToday = typeof focusMinutes === 'function' ? focusMinutes({ from: t }) : 0;
    const timer = s.timer;

    const bits = [];
    if (classesToday) bits.push(`<a href="#/calendar">${plural(classesToday, 'class')}</a> today`);
    bits.push(`<a href="#/tasks?source=coursework&when=week">${weekCount ? plural(weekCount, 'thing') : 'nothing'}</a> due this week`);

    const sentence = bits.length > 1 ? `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}` : bits[0];
    const mood = overdue
      ? `<a href="#/tasks?when=overdue" class="strong">${plural(overdue, 'item')} overdue.</a> Knock ${overdue === 1 ? 'it' : 'those'} out first.`
      : openToday === 0 && tasksToday.length
        ? 'Every task for today is done. Nice work.'
        : streak > 1 ? `You’re on a ${streak}-day review streak. Keep it going.` : 'One small step at a time.';

    return `
    <header class="hello study-day">
      <div class="study-date"><strong>${parseYmd(t).getDate()}</strong><span>${fmtDate(t,{month:'short',year:'numeric'})}</span><small>${fmtDate(t,{weekday:'long'})}</small></div>
      <div>
        <h1>${greeting()}.</h1>
        <p class="lede">${sentence}.${overdue?` ${mood}`:''}</p>
      </div>
      <div class="study-actions">
        <a href="#/focus">${icon('timer',20)}<span>Start a focus session<small>Make time for your next topic</small></span>${icon('right',16)}</a>
        <a href="#/practice?tab=prompt">${icon('exam',20)}<span>Build a practice test<small>Study from your class material</small></span>${icon('right',16)}</a>
      </div>
    </header>

    <div class="grid-2">
      <section class="panel">
        <header class="panel-head"><h2>Today’s plan</h2><a href="#/tasks" class="quiet-link">All tasks</a></header>
        ${agenda.length ? `<h3 class="sub">Schedule</h3><ul class="rows">${agenda.map((e) => eventRow(e)).join('')}</ul><h3 class="sub">Tasks</h3>` : ''}
        <form class="inline-add" data-form="quick-task">
          <input name="title" placeholder="Add a task for today" autocomplete="off" aria-label="New task">
          <button class="btn">Add</button>
        </form>
        <ul class="rows">${tasksToday.map(taskRow).join('') || '<li class="rows-empty">Nothing on your list yet. What’s one thing you want to get done?</li>'}</ul>
        <a class="routine-line" href="#/daily">
          <span>Daily routine</span><span class="num">${rDone} of ${s.routines.length}</span>
          ${progressBar(s.routines.length ? Math.round((rDone / s.routines.length) * 100) : 0)}
        </a>
      </section>

      <section class="panel">
        <header class="panel-head"><h2>Coming up</h2><a href="#/calendar" class="quiet-link">Calendar</a></header>
        <ul class="rows">${upcoming.slice(0,5).map((e) => eventRow(e)).join('') || '<li class="rows-empty">Nothing due in the next two weeks.</li>'}</ul>
      </section>
    </div>

    ${examCountdownPanel('',2)}

    <details class="dashboard-library"><summary>Study overview <span>Next exam, focus time and flashcards</span></summary><div class="glance">
      <a class="glance-card" href="#/calendar">
        <span class="glance-label">${icon('classes', 16)}Next class</span>
        ${next ? `<strong>${mark(next.classId)}${esc(className(next.classId))}</strong><span>${next.date === t ? 'Today' : relDay(next.date)}, ${fmtSpan(next)}${next.location ? ` · ${esc(next.location)}` : ''}</span>`
          : '<strong>No classes this week</strong><span>Add your class times in the calendar</span>'}
      </a>
      <a class="glance-card" href="#/exams">
        <span class="glance-label">${icon('exam', 16)}Next exam</span>
        ${exam ? `<strong><span class="big num">${daysBetween(t, exam.date)}</span> ${daysBetween(t, exam.date) === 1 ? 'day' : 'days'}</strong><span>${mark(exam.classId)}${esc(exam.title)}, ${fmtDate(exam.date)}</span>`
          : '<strong>None scheduled</strong><span>Add one to get a study plan</span>'}
      </a>
      <a class="glance-card" href="#/focus">
        <span class="glance-label">${icon('timer', 16)}Focus today</span>
        <strong><span class="big num">${focusToday}</span> min</strong>
        <span>${timer?.running ? `${MODES[timer.mode]} running now` : 'Start a 25-minute session'}</span>
      </a>
      <a class="glance-card" href="#/cards">
        <span class="glance-label">${icon('cards', 16)}Flashcards</span>
        <strong><span class="big num">${due}</span> due</strong>
        <span>${due ? `About ${Math.max(1, Math.round(due * 0.25))} min of review` : 'All caught up'}</span>
      </a>
    </div></details>

    <details class="dashboard-library"><summary>Your classes <span>Notes, deadlines and review</span></summary><div class="class-cards">${s.classes.map(classCard).join('')}</div></details>
    <details class="dashboard-library"><summary>Review activity <span>Last 18 weeks</span></summary>${reviewHeatmap()}</details>`;
  },
  mount(el) {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const { act, id } = b.dataset;
      if (handleCommonAction(act, id)) return;
      if (act === 'add-event') editEventModal(null);
      if (act === 'add-sched') editEventModal(null, { kind: 'event' });
    });
    el.addEventListener('change', (e) => {
      if (e.target.matches('[data-scheck]') && typeof toggleStep === 'function') {
        toggleStep(e.target.dataset.date, e.target.dataset.block, e.target.dataset.stepId, e.target.checked);
        App.refresh();
      }
    });
    $('[data-form="quick-task"]', el).addEventListener('submit', (e) => {
      e.preventDefault();
      const title = e.target.title.value.trim();
      if (!title) return;
      S().tasks.push({ id: uid(), title, date: todayStr(), done: false, category: 'School', priority: 'med' });
      Store.save();
      App.refresh();
      $('[data-form="quick-task"] input', App.viewEl)?.focus();
    });

  },
  unmount() {
    this._stop?.();
  },
};

function lectureProgress(classId) {
  const lecs = S().notes.filter((n) => n.classId === classId && n.lecture);
  if (!lecs.length) return null;
  const done = lecs.filter((n) => n.lecture.covered).length;
  const next = lecs.filter((n) => !n.lecture.covered).sort((a, b) => a.lecture.n - b.lecture.n)[0];
  return { done, total: lecs.length, next };
}

function classCard(c) {
  const next = nextDeadline(c.id);
  const g = typeof gradeSummary === 'function' ? gradeSummary(c.id) : null;
  const lp = lectureProgress(c.id);
  const pct = classMastery(c.id);
  return `
  <article class="class-card" data-class="${esc(c.id)}">
    <a class="class-card-main" href="#/classes/${c.id}">
      <div class="class-card-top">
        ${mark(c.id, 'md')}
        <span class="class-card-grade">${g?.current == null ? '' : `<b>${g.letter}</b> ${pctText(g.current, 0)}`}</span>
      </div>
      <h3>${esc(c.name)}</h3>
      <p class="class-card-sub">${esc([c.info.code, c.info.meeting].filter(Boolean).join(' · ') || 'Add class info')}</p>
      <div class="class-card-meter"><span>Mastery</span><span class="num">${pct}%</span></div>
      ${progressBar(pct)}
      ${lp ? `<div class="class-card-meter"><span>Lectures</span><span class="num">${lp.done} of ${lp.total}</span></div>${progressBar(Math.round((lp.done / lp.total) * 100))}` : ''}
      <p class="class-card-next">${next ? `<span class="muted">Next due</span> ${esc(next.title.replace('[Template] ', ''))}, <b>${relDay(next.date).toLowerCase()}</b>` : '<span class="muted">Nothing due</span>'}</p>
    </a>
    <nav class="class-card-links" aria-label="${esc(c.name)} shortcuts">
      <a href="#/notes?class=${c.id}">Notes</a><a href="#/cards?class=${c.id}">Review ${dueCards(c.id).length}</a><a href="#/grades?class=${c.id}">Grades</a>
    </nav>
  </article>`;
}

/* ------------------------------ Classes ------------------------------ */
Views.classes = {
  title: 'Classes',
  render([id],query={}) {
    if (id) return this.detail(id,query);
    return `
    <header class="page-head">
      <div><h1>Classes</h1><p class="lede">Each class keeps its info, topics, notes, cards and deadlines together.</p></div>
      <div class="head-actions"><button class="btn primary" data-act="add-class">${icon('plus', 16)}Add class</button></div>
    </header>
    <section class="panel">${classRows(S().classes)}</section>`;
  },

  detail(id,query={}) {
    const c = getClass(id);
    if (!c) return emptyState('empty', 'Class not found', '', '<a class="btn" href="#/classes">Back to classes</a>');
    const t = todayStr();
    const events = deadlines().filter((e) => e.classId === id).sort((a, b) => a.date.localeCompare(b.date));
    const upcoming = events.filter((e) => !e.done && e.date >= addDays(t, -7));
    const notes = notesOf(id).sort((a, b) => b.updated - a.updated);
    const topics = topicsOf(id);
    const pct = classMastery(id);
    const lectures = notes.filter((n) => n.lecture).sort((a, b) => a.lecture.n - b.lecture.n);
    const others = notes.filter((n) => !n.lecture);
    const g = typeof gradeSummary === 'function' ? gradeSummary(id) : null;
    const weekly = S().events.filter((e) => e.classId === id && isScheduled(e) && e.repeat && e.repeat !== 'none');
    const DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
    const resources = c.resources || [];

    const tab=['materials','tasks','info'].includes(query.tab)?query.tab:'overview';
    const classTasks=taskHubFilter(taskHubItems(),{class:c.id,status:'open'});
    const materialsHTML=`${lectures.length ? `
        <section class="panel">
          <header class="panel-head"><h2>Lectures</h2><span class="muted small">${lectures.filter((n) => n.lecture.covered).length} of ${lectures.length} covered</span></header>
          ${progressBar(Math.round((lectures.filter((n) => n.lecture.covered).length / lectures.length) * 100))}
          <ul class="rows lecture-list">${lectures.map((n) => `
            <li class="row ${n.lecture.covered ? '' : 'upcoming'}">
              <input type="checkbox" data-covered="${n.id}" ${n.lecture.covered ? 'checked' : ''} aria-label="Mark ${esc(n.title)} as covered">
              <a class="row-main" href="#/notes/${n.id}"><span class="row-title">${esc(n.title.replace(/^(OS|Security|Nutrition) /, ''))}</span>${n.lecture.date ? `<span class="row-meta">${fmtDate(n.lecture.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>` : ''}</a>
              ${n.source?.path ? `<a class="btn sm ghost" href="${esc(safeLink(n.source.path))}" target="_blank" rel="noopener">Slides</a>` : ''}
            </li>`).join('')}</ul>
        </section>` : ''}<section class="panel">
          <header class="panel-head"><h2>${lectures.length ? 'Other notes' : 'Notes and slides'}</h2><button class="btn sm" data-act="new-note">${icon('plus', 14)}New note</button></header>
          <ul class="rows">${others.slice(0, 12).map((n) => `
            <li class="row"><a class="row-main" href="#/notes/${n.id}"><span class="row-title">${esc(n.title)}</span><span class="row-meta">${n.tags.includes('reading') ? '<span class="tag">Reading</span>' : n.tags.includes('my notes') ? '<span class="tag">My notes</span>' : n.source ? `<span class="tag">${esc(n.source.kindLabel || 'Imported')}</span>` : ''}<span>${new Date(n.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></span></a></li>`).join('') || '<li class="rows-empty">No notes yet. Add slides or write a note.</li>'}</ul>
          ${others.length > 12 ? `<a class="quiet-link" href="#/notes?class=${id}">All ${notes.length} notes</a>` : ''}
        </section>`;
    const progressHTML=`<section class="panel">
          <header class="panel-head"><h2>Progress</h2><span class="num strong">${pct}%</span></header>
          ${progressBar(pct)}
          <dl class="facts">
            <div><dt>Topics</dt><dd>${topics.length}</dd></div>
            <div><dt>Mastered</dt><dd>${topics.filter((x) => x.mastery === 3).length}</dd></div>
            <div><dt>Cards</dt><dd>${cardsOf(id).length}</dd></div>
            <div><dt>Notes</dt><dd>${notes.length}</dd></div>
          </dl>
          <div class="btn-row">
            <a class="btn sm" href="#/assist?class=${id}">Ask ChatGPT</a>
            <a class="btn sm" href="#/cards?tab=import&class=${id}">Make cards with AI</a>
            <a class="btn sm" href="#/graph?focus=c:${id}">Map</a>
          </div>
        </section>`;
    const timesHTML=`<section class="panel">
          <header class="panel-head"><h2>Class times</h2><button class="btn sm" data-act="add-time">${icon('plus', 14)}Add</button></header>
          <ul class="rows compact">${weekly.map((e) => `
            <li class="row"><button class="row-main" data-act="edit-time" data-id="${e.id}"><span class="row-title">${esc(e.title)}</span><span class="row-meta">${DAYS[parseYmd(e.date).getDay()]}, ${fmtSpan(e)}${e.location ? ` · ${esc(e.location)}` : ''}</span></button></li>`).join('') || '<li class="rows-empty">Add lecture and office hour times so they show on your calendar and remind you before class.</li>'}</ul>
        </section>`;
    const resourcesHTML=`<section class="panel">
          <header class="panel-head"><h2>Links and books</h2></header>
          <ul class="rows compact resource-list">${resources.map((r) => `
            <li class="row">
              ${icon(r.kind === 'book' ? 'book' : r.kind === 'notes' ? 'notes' : 'globe', 16)}
              <a class="row-main" href="${esc(safeLink(r.url))}" target="_blank" rel="noopener"><span class="row-title">${esc(r.label)}</span><span class="row-meta">${esc(r.url.startsWith('library/') ? 'Saved file' : r.url.replace(/^https?:\/\//, '').split('/')[0])}</span></a>
              <button class="icon-btn sm reveal" data-del-res="${r.id}" aria-label="Remove ${esc(r.label)}">${icon('close', 14)}</button>
            </li>`).join('') || '<li class="rows-empty">Add the course site, discussion board, textbooks and your notes folder.</li>'}</ul>
          <form class="res-add" id="res-add">
            <input name="label" placeholder="Name" required aria-label="Link name">
            <input name="url" placeholder="https://" required aria-label="Link address">
            <button class="btn sm">Add link</button>
          </form>
        </section>`;
    const tasksHTML=`<section class="panel">
          <header class="panel-head"><h2>Class tasks & deadlines</h2><div class="btn-row"><button class="btn sm" data-act="add-class-task">${icon('plus',14)}Add task</button><button class="btn sm" data-act="add-event">Add deadline</button></div></header>
          <ul class="rows">${(tab==='tasks'?classTasks:classTasks.slice(0,4)).map(taskHubRow).join('') || '<li class="rows-empty">No open tasks for this class.</li>'}</ul>
          <a class="quiet-link" href="#/tasks?class=${c.id}&status=all">View all class tasks, including completed →</a>
        </section>`;
    const infoHTML=`<section class="panel">
          <header class="panel-head"><h2>Class info</h2><span class="muted small">Saves as you type</span></header>
          <div class="info-grid">
            ${INFO_FIELDS.map(([k, label]) => `
              <label class="${k === 'grading' || k === 'textbook' ? 'span-2' : ''}">
                <span>${label}</span>
                ${k === 'grading' || k === 'textbook'
                  ? `<textarea data-info="${k}" rows="2">${esc(c.info[k])}</textarea>`
                  : `<input data-info="${k}" value="${esc(c.info[k])}" ${k === 'syllabus' || k === 'lms' ? 'type="url" placeholder="https://"' : ''}>`}
                ${(k === 'syllabus' || k === 'lms') && /^https?:/.test(c.info[k]) ? `<a class="quiet-link" href="${esc(safeLink(c.info[k]))}" target="_blank" rel="noopener">Open link ${icon('external', 13)}</a>` : ''}
              </label>`).join('')}
          </div>
          <h3 class="sub">Your own fields</h3>
          <div class="custom-fields">
            ${c.custom.map((f, i) => `
              <div class="custom-row">
                <input data-custom-k="${i}" value="${esc(f.k)}" placeholder="Field" aria-label="Field name">
                <input data-custom-v="${i}" value="${esc(f.v)}" placeholder="Value" aria-label="Field value">
                <button class="icon-btn sm" data-act="del-custom" data-i="${i}" aria-label="Remove field">${icon('close', 14)}</button>
              </div>`).join('') || '<p class="hint">Exam room, lab partner, group chat link, anything else.</p>'}
          </div>
          <div class="btn-row">
            <button class="btn sm" data-act="add-custom">${icon('plus', 14)}Field</button>
            <span class="spacer"></span>
            <button class="btn sm ghost" data-act="edit-class">Rename or change mark</button>
          </div>
        </section>`;
    const topicsHTML=`<section class="panel">
          <header class="panel-head"><h2>Topics</h2><button class="btn sm" data-act="add-topic">${icon('plus', 14)}Topic</button></header>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Topic</th><th>Learn first</th><th class="num">Cards</th><th>Mastery</th><th><span class="sr-only">Edit</span></th></tr></thead>
            <tbody>
            ${topics.map((tp) => `
              <tr>
                <td><strong>${esc(tp.name)}</strong><div class="muted small">${esc(tp.desc || '')}</div></td>
                <td class="small">${tp.prereqs.map((p) => esc(getTopic(p)?.name || '')).filter(Boolean).join(', ') || '<span class="muted">None</span>'}</td>
                <td class="num">${S().cards.filter((x) => x.topicId === tp.id).length}</td>
                <td><select data-mastery="${tp.id}" class="compact" aria-label="Mastery of ${esc(tp.name)}">${MASTERY.map((m, i) => `<option value="${i}" ${i === tp.mastery ? 'selected' : ''}>${m.label}</option>`).join('')}</select></td>
                <td><button class="btn sm ghost" data-act="edit-topic" data-id="${tp.id}">Edit</button></td>
              </tr>`).join('')}
            </tbody>
          </table></div>
        </section>`;
    const gradeHTML=`${g ? `
        <section class="panel">
          <header class="panel-head"><h2>Grade</h2><a class="quiet-link" href="#/grades?class=${id}">Enter scores</a></header>
          <div class="grade-big sm">${g.current == null ? '<span class="grade-empty">No scores yet</span>' : `<span class="grade-letter">${g.letter}</span><span class="num">${pctText(g.current)}</span>`}</div>
          <p class="hint">${esc(c.info.grading || g.cats.map((k) => `${k.name} ${k.weight}%`).join(', '))}</p>
        </section>` : ''}`;
    return `
    <header class="page-head">
      <div class="class-title">${mark(id, 'lg')}<div><h1>${esc(c.name)}</h1><p class="lede">${esc([c.info.code, c.info.meeting, c.info.location].filter(Boolean).join(', ') || 'Fill in the class info below.')}</p></div></div>
      <div class="head-actions">
        <a class="btn" href="#/import?class=${id}">${icon('upload', 16)}Add material</a>
        <a class="btn" href="#/tree/${id}">Skill tree</a>
        <a class="btn primary" href="#/cards?class=${id}">Review ${dueCards(id).length} cards</a>
      </div>
    </header>

    <nav class="subtabs class-tabs" aria-label="Class pages">${[['overview','Overview'],['materials','Materials'],['tasks',`Tasks (${classTasks.length})`],['info','Class info']].map(([key,label])=>`<a class="subtab ${tab===key?'active':''}" href="#/classes/${id}?tab=${key}" ${tab===key?'aria-current="page"':''}>${label}</a>`).join('')}</nav>
    ${tab==='overview'?`<div class="grid-2 wide-left"><div class="stack">${tasksHTML}${examCountdownPanel(id)}<section class="panel"><header class="panel-head"><h2>Continue studying</h2><a class="quiet-link" href="#/classes/${id}?tab=materials">All materials</a></header><ul class="rows">${notes.slice(0,3).map(n=>`<li class="row"><a class="row-main" href="#/notes/${n.id}"><span class="row-title">${esc(n.title)}</span></a></li>`).join('')||'<li class="rows-empty">Add your first class note or PDF.</li>'}</ul><a class="btn sm" href="#/practice?tab=prompt&class=${id}">Create practice test</a></section></div><div class="stack">${timesHTML}${gradeHTML}</div></div>`:''}
    ${tab==='materials'?`<div class="grid-2 wide-left"><div class="stack">${materialsHTML}<details class="panel class-topic-details"><summary>Topics & mastery</summary>${topicsHTML}</details></div><div class="stack">${progressHTML}${resourcesHTML}</div></div>`:''}
    ${tab==='tasks'?`<div class="class-task-page">${tasksHTML}${examCountdownPanel(id)}</div>`:''}
    ${tab==='info'?`<div class="grid-2 wide-left"><div class="stack">${infoHTML}<button class="btn sm ghost danger" data-act="del-class">Delete class</button></div><div class="stack">${timesHTML}${resourcesHTML}</div></div>`:''}`;
  },

  mount(el, [id]) {
    const c = id && getClass(id);
    el.addEventListener('click',e=>{const b=e.target.closest('[data-hub-open]');if(!b||!c)return;const item=taskHubItems().find(t=>t.id===b.dataset.hubOpen&&t.classId===c.id);if(item?.kind==='coursework')editEventModal(item.id);else if(item?.kind==='personal')editPersonalTask(item.id);});
    const saveSoon = debounce(() => Store.save(), 300);

    el.addEventListener('input', (e) => {
      if (!c) return;
      const k = e.target.dataset.info;
      if (k) {
        c.info[k] = e.target.value;
        saveSoon();
      }
      if (e.target.dataset.customK !== undefined) {
        c.custom[+e.target.dataset.customK].k = e.target.value;
        saveSoon();
      }
      if (e.target.dataset.customV !== undefined) {
        c.custom[+e.target.dataset.customV].v = e.target.value;
        saveSoon();
      }
    });

    el.addEventListener('change', (e) => {
      const check=e.target;
      if(check.dataset.hubCheck){const item=taskHubItems().find(t=>t.id===check.dataset.hubCheck&&t.classId===c?.id);if(item){item.record.done=check.checked;Store.save();App.refresh();}return;}
      const tid = e.target.dataset.mastery;
      if (tid) {
        getTopic(tid).mastery = +e.target.value;
        Store.save();
        App.refresh();
      }
      if (e.target.dataset.info) App.renderNav();
      const cov = e.target.dataset.covered && getNote(e.target.dataset.covered);
      if (cov) {
        cov.lecture.covered = e.target.checked;
        cov.body = cov.body.replace(/^\*\*Status:\*\* .*$/m, `**Status:** ${cov.lecture.covered ? 'Covered in class' : 'Coming up'}`);
        Store.save();
        App.refresh();
      }
    });

    $('#res-add', el)?.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      let url = f.get('url').trim();
      if (!/^(https?:\/\/|library\/)/.test(url)) url = 'https://' + url;
      c.resources = [...(c.resources || []), { id: uid(), label: f.get('label').trim(), url, kind: 'site' }];
      Store.save();
      App.refresh();
    });

    el.addEventListener('click', (e) => {
      const dr = e.target.closest('[data-del-res]');
      if (dr && c) {
        c.resources = c.resources.filter((r) => r.id !== dr.dataset.delRes);
        Store.save();
        return App.refresh();
      }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const { act } = b.dataset;
      if (act === 'add-time' && c) return editEventModal(null, { classId: c.id, kind: 'event', type: 'lecture', repeat: 'weekly', title: c.name });
      if (act === 'edit-time') return editEventModal(b.dataset.id);
      if (handleCommonAction(act, b.dataset.id)) return;
      if (act === 'add-class') return classModal(null);
      if (!c) return;
      if (act === 'edit-class') classModal(c.id);
      if (act === 'add-custom') {
        c.custom.push({ k: '', v: '' });
        Store.save();
        App.refresh();
      }
      if (act === 'del-custom') {
        c.custom.splice(+b.dataset.i, 1);
        Store.save();
        App.refresh();
      }
      if (act === 'add-event') editEventModal(null, { classId: c.id, kind:'deadline' });
      if (act === 'add-class-task') editPersonalTask(null,{classId:c.id});
      if (act === 'new-note') {NotesUI.mode='write';location.hash = `#/notes/${createNote({ classId: c.id }).id}`;}
      if (act === 'add-topic') editTopicModal(null, c.id);
      if (act === 'edit-topic') editTopicModal(b.dataset.id, c.id);
      if (act === 'del-class') {
        if (!confirm(`Delete “${c.name}” with its topics, cards and deadlines? Its notes are kept.`)) return;
        const s = S();
        const topicIds = new Set(topicsOf(c.id).map((t) => t.id));
        s.classes = s.classes.filter((x) => x.id !== c.id);
        s.topics = s.topics.filter((t) => t.classId !== c.id);
        s.topics.forEach((t) => (t.prereqs = t.prereqs.filter((p) => !topicIds.has(p))));
        s.links = s.links.filter((l) => !topicIds.has(l.a) && !topicIds.has(l.b));
        s.cards = s.cards.filter((x) => x.classId !== c.id);
        s.events = s.events.filter((x) => x.classId !== c.id);
        s.tasks.forEach(t=>{if(t.classId===c.id)t.classId='';});
        s.notes.forEach((n) => {
          if (n.classId === c.id) n.classId = '';
        });
        Store.save();
        location.hash = '#/classes';
      }
    });
  },
};

function classModal(id) {
  const used = new Set(S().classes.filter((x) => x.id !== id).map((x) => x.mark));
  const c = id ? getClass(id) : { name: '', short: '', mark: MARKS.find((m) => !used.has(m)) || 'square' };
  openModal(id ? 'Edit class' : 'Add class', `
    <form class="form" id="class-form">
      <label>Class name<input name="name" required value="${esc(c.name)}" placeholder="Linear Algebra"></label>
      <label>Short name<input name="short" maxlength="6" value="${esc(c.short)}" placeholder="LA"></label>
      <fieldset><legend>Mark</legend>
        <p class="hint">Classes are told apart by shape everywhere in the app.</p>
        <div class="mark-picker">
          ${MARKS.map((m) => `<label title="${m}${used.has(m) ? ' (used by another class)' : ''}"><input type="radio" name="mark" value="${m}" ${m === c.mark ? 'checked' : ''}><span><i class="mark mk-${m} lg"></i></span></label>`).join('')}
        </div>
      </fieldset>
      <div class="form-actions"><span class="spacer"></span><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">${id ? 'Save class' : 'Add class'}</button></div>
    </form>`, {
    onMount(m) {
      $('#class-form', m).addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const data = { name: f.get('name').trim(), short: f.get('short').trim().toUpperCase(), mark: f.get('mark') || 'square' };
        if (id) Object.assign(getClass(id), data);
        else {
          const nid = uid();
          S().classes.push({ id: nid, ...data, info: blankInfo(), custom: [] });
          Store.save();
          closeModal();
          location.hash = `#/classes/${nid}`;
          return;
        }
        Store.save();
        closeModal();
        App.refresh();
      });
    },
  });
}

/* ------------------------------ Settings ------------------------------ */
Views.settings = {
  title: 'Settings',
  render() {
    const st = S().settings;
    const s = S();
    return `
    <header class="page-head"><div><h1>Settings</h1></div></header>
    <div class="grid-2">
      <section class="panel">
        <header class="panel-head"><h2>You</h2></header>
        <label class="form-label">Your name<input data-setting="name" value="${esc(st.name || '')}" placeholder="Used in the greeting on Today" autocomplete="given-name"></label>
        <h3 class="sub">Appearance</h3>
        <div class="seg" role="radiogroup" aria-label="Theme">
          ${[['system', 'Match device'], ['light', 'White'], ['dark', 'Black']].map(([t, l]) => `<label><input type="radio" name="theme" value="${t}" ${st.theme === t ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </div>
        <h3 class="sub">Flashcards</h3>
        <label class="check"><input type="checkbox" data-setting="typeAnswers" ${st.typeAnswers ? 'checked' : ''}> Type my answer before the card flips</label>
      </section>

      <section class="panel">
        <header class="panel-head"><h2>Reminders</h2></header>
        <p class="hint">Reminders appear under the bell at the top while Study Hub is open, even in a background tab.</p>
        <div class="form">
          <label class="check"><input type="checkbox" data-notify="desktop" ${st.notify.desktop ? 'checked' : ''}> Also show desktop notifications</label>
          <label class="check"><input type="checkbox" data-notify="sound" ${st.notify.sound ? 'checked' : ''}> Play a soft chime</label>
          <label class="inline-label">Remind me
            <select data-notify="daysBefore">${[[0, 'not ahead of time'], [1, '1 day before'], [2, '2 days before'], [3, '3 days before'], [7, 'a week before']].map(([v, l]) => `<option value="${v}" ${+st.notify.daysBefore === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            something is due
          </label>
          <label class="check"><input type="checkbox" data-notify="dayOf" ${st.notify.dayOf ? 'checked' : ''}> On the morning it’s due</label>
          <label class="check"><input type="checkbox" data-notify="hourBefore" ${st.notify.hourBefore ? 'checked' : ''}> An hour before the deadline</label>
          <label class="check"><input type="checkbox" data-notify="overdue" ${st.notify.overdue ? 'checked' : ''}> When something becomes overdue</label>
          <label class="inline-label"><input type="checkbox" data-notify="classStart" ${st.notify.classStart ? 'checked' : ''}> Before class,
            <select data-notify="classLead">${[5, 10, 15, 30, 60].map((v) => `<option value="${v}" ${+st.notify.classLead === v ? 'selected' : ''}>${v} min</option>`).join('')}</select> ahead
          </label>
          <label class="check"><input type="checkbox" data-notify="cardsDaily" ${st.notify.cardsDaily ? 'checked' : ''}> Once a day when flashcards are due</label>
          <div class="btn-row"><button class="btn sm" data-act="test-notify">Send a test reminder</button></div>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head"><h2>AI</h2></header>
        <div class="form">
          <label>ChatGPT address<input data-setting="chatUrl" value="${esc(st.chatUrl)}"></label>
          <label class="check"><input type="checkbox" data-setting="prefillUrl" ${st.prefillUrl ? 'checked' : ''}> Put the prompt in the ChatGPT link</label>
          <p class="hint">Off by default because the link would contain your note text. The prompt is always copied to your clipboard.</p>
          <h3 class="sub">Summaries inside the app</h3>
          <p class="hint">Summarize works offline. Add your own OpenAI key to use a real model instead. The key stays in this browser and is only sent to api.openai.com.</p>
          <label>OpenAI API key<input type="password" data-setting="openaiKey" value="${esc(st.openaiKey)}" placeholder="sk-..." autocomplete="off"></label>
          <label>Model<input data-setting="openaiModel" value="${esc(st.openaiModel)}"></label>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head"><h2>Backup</h2></header>
        <p class="hint">Your notes, cards and plans live in this browser. Export a backup now and then, especially before clearing browsing data. Original slide files are not included in the backup; their extracted text is.</p>
        <p class="small">${plural(s.notes.length, 'note')}, ${plural(s.cards.length, 'card')}, ${plural(s.topics.length, 'topic')}, ${plural(deadlines().length, 'deadline')}, ${plural(s.events.length - deadlines().length, 'event')}, ${plural(s.tasks.length, 'task')}</p>
        <div class="btn-row">
          <button class="btn primary" data-act="export">Export backup</button>
          <label class="btn">Restore backup<input type="file" accept="application/json,.json" data-act="import" hidden></label>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head"><h2>Starter content</h2></header>
        <p class="hint">Deadlines marked [Template] are examples. Remove them once your real dates are in.</p>
        <div class="btn-row">
          <button class="btn" data-act="clear-examples">Remove example deadlines</button>
          <button class="btn ghost danger" data-act="reset">Reset everything</button>
        </div>
      </section>
    </div>`;
  },
  mount(el) {
    const st = S().settings;
    el.addEventListener('change', (e) => {
      if (e.target.name === 'theme') {
        st.theme = e.target.value;
        applyTheme();
        Store.save();
      }
      const k = e.target.dataset.setting;
      if (k) {
        st[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim();
        Store.save();
        toast('Setting saved', 'ok');
        if (k === 'name') App.renderNav();
      }
      const n = e.target.dataset.notify;
      if (n) {
        if (n === 'desktop' && e.target.checked) {
          e.target.checked = false;
          return Notify.enableDesktop().then(() => App.refresh());
        }
        st.notify[n] = e.target.type === 'checkbox' ? e.target.checked : +e.target.value;
        Store.save();
        toast('Reminder settings saved', 'ok');
      }
    });
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'test-notify') Notify.push({ key: `test:${Date.now()}`, title: 'This is what a reminder looks like', body: 'Due tomorrow: PA2 · Computer Security · 5:00 PM', href: '#/calendar', kind: 'upcoming' });
      if (act === 'export') {
        const blob = new Blob([JSON.stringify(S(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `study-hub-backup-${todayStr()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
      if (act === 'clear-examples') {
        const s = S();
        s.events = s.events.filter((x) => !x.title.startsWith('[Template]'));
        Store.save();
        toast('Example deadlines removed', 'ok');
        App.refresh();
      }
      if (act === 'reset' && confirm('Reset everything to the starter content? Export a backup first if you want to keep anything.')) {
        Store.reset();
        applyTheme();
        toast('Reset to starter content', 'ok');
        App.refresh();
      }
    });
    $('[data-act="import"]', el).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data.classes || !data.notes) throw new Error('this is not a Study Hub backup');
        if (!confirm('Replace everything with this backup?')) return;
        Store.state = migrate(data);
        Store.recoveryRequired = false;
        if (!Store.save()) throw new Error('Browser storage is unavailable; the restored data is in memory. Export a backup before closing.');
        applyTheme();
        toast('Backup restored', 'ok');
        App.refresh();
      } catch (err) {
        toast('Restore failed: ' + err.message, 'error');
      }
    });
  },
};
