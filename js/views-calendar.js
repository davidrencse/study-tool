/* ==========================================================================
   views-calendar.js — Calendar (month / week / agenda), scheduled events,
   repeating entries, .ics import/export.
   Loads after views-main.js and views-plan.js and replaces their
   Views.calendar, eventRow and editEventModal.
   ========================================================================== */

const CalView = { mode: null, show: 'all', lastKind: 'event' };
/** Pixels per hour in the week view (set by --wk-h in calendar.css). */
const weekHour = (el) => parseFloat(getComputedStyle(el).getPropertyValue('--wk-h')) || 48;
const hrs = (n) => `calc(var(--wk-h) * ${+n.toFixed(4)})`;

const calFilter = (e) =>
  (!CalUI.filter || (CalUI.filter === '-' ? !e.classId : e.classId === CalUI.filter)) &&
  (CalView.show === 'all' || (CalView.show === 'event') === isScheduled(e));

const isRepeating = (e) => e.repeat && e.repeat !== 'none';
const weekStart = (d) => addDays(d, -parseYmd(d).getDay());
const plusHour = (t) => {
  const m = Math.min(toMin(t) + 60, 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/* ------------------------------ rows ------------------------------ */
function eventRow(e, { showClass = true } = {}) {
  const t = todayStr();
  const type = EVENT_TYPES[e.type] || EVENT_TYPES.other;
  const sched = isScheduled(e);
  const overdue = !sched && !e.done && e.date < t;
  const when = sched && e.date < t ? fmtDate(e.date) : relDay(e.date);
  const lead = sched
    ? `<span class="ev-lead" aria-hidden="true">${icon('planner', 14)}</span>`
    : `<input type="checkbox" data-act="toggle-event" data-id="${e.id}" ${e.done ? 'checked' : ''} aria-label="Mark ${esc(e.title)} done">`;
  return `
  <li class="row event-row ${e.done ? 'done' : ''} ${sched ? 'sched' : ''} ${sched && e.date < t ? 'past' : ''}">
    ${lead}
    <button class="row-main" data-act="edit-event" data-id="${e.id}" data-date="${e.date}">
      <span class="row-title">${esc(e.title)}</span>
      <span class="row-meta">${showClass && e.classId ? `${mark(e.classId)}${esc(getClass(e.classId)?.short || '')}` : ''}<span class="${type.major ? 'tag solid' : 'tag'}">${type.label}</span>${e.sourceType === 'brightspace-email' ? ' <span class="tag">Email confirmed</span>' : ''}${fmtSpan(e) ? `<span>${fmtSpan(e)}</span>` : ''}${e.location ? `<span>${esc(e.location)}</span>` : ''}${isRepeating(e) ? `<span class="ev-rep" title="${REPEATS[e.repeat]}">${icon('swap', 12)}</span>` : ''}</span>
    </button>
    <span class="when ${overdue ? 'tag solid' : ''}">${when}</span>
  </li>`;
}

/* ------------------------------ editor ------------------------------ */
function editEventModal(id, defaults = {}, occDate = null) {
  const existing = id ? S().events.find((e) => e.id === id) : null;
  const kind0 = existing ? (isScheduled(existing) ? 'event' : 'deadline') : defaults.kind || 'deadline';
  const start = defaults.time || '09:00';
  const e = existing || {
    title: '', classId: defaults.classId ?? (kind0 === 'deadline' ? S().classes[0]?.id || '' : ''),
    date: defaults.date || todayStr(), type: kind0 === 'event' ? 'event' : 'assignment',
    time: kind0 === 'event' ? start : '23:59', end: defaults.end || plusHour(start), allDay: false,
    location: '', repeat: 'none', until: '', notes: '', done: false, skip: [],
  };
  const typeOpts = (sched) => Object.entries(EVENT_TYPES).filter(([, v]) => !!v.event === sched)
    .map(([k, v]) => `<option value="${k}" ${k === e.type ? 'selected' : ''}>${v.label}</option>`).join('');
  const rep = isRepeating(e);
  const noun = (k) => (k === 'event' ? 'event' : 'deadline');

  openModal(existing ? `Edit ${noun(kind0)}` : 'Add to calendar', `
    <form class="form ev-form" id="event-form" data-kind="${kind0}">
      ${existing ? '' : `
      <div class="seg block" role="radiogroup" aria-label="Kind">
        <label><input type="radio" name="kind" value="event" ${kind0 === 'event' ? 'checked' : ''}><span>Event</span></label>
        <label><input type="radio" name="kind" value="deadline" ${kind0 === 'deadline' ? 'checked' : ''}><span>Deadline</span></label>
      </div>`}
      <label>Title<input name="title" required value="${esc(e.title)}" data-ph-event="Study group, dentist, club meeting" data-ph-deadline="Problem set 2"></label>
      <div class="form-row">
        <label>Class<select name="classId">${classOptions(e.classId, { includeNone: true, noneLabel: 'Personal' })}</select></label>
        <label>Type
          <select name="typeEvent" data-for="event">${typeOpts(true)}</select>
          <select name="typeDeadline" data-for="deadline">${typeOpts(false)}</select>
        </label>
      </div>
      <div class="form-row">
        <label><span data-for="event">${rep ? 'Starts on' : 'Date'}</span><span data-for="deadline">Due date</span><input type="date" name="date" required value="${e.seriesStart || e.date}"></label>
        <label data-for="deadline">Time<input type="time" name="dtime" value="${existing ? e.time || '' : '23:59'}"></label>
        <label class="check ev-allday" data-for="event"><input type="checkbox" name="allDay" ${e.allDay ? 'checked' : ''}> All day</label>
      </div>
      <div class="form-row" data-for="event" data-timed>
        <label>Starts<input type="time" name="start" value="${e.time || start}"></label>
        <label>Ends<input type="time" name="end" value="${e.end || plusHour(e.time || start)}"></label>
      </div>
      <label data-for="event">Location<input name="location" value="${esc(e.location)}" placeholder="Room, building, link"></label>
      <div class="form-row" data-for="event">
        <label>Repeats<select name="repeat">${Object.entries(REPEATS).map(([k, v]) => `<option value="${k}" ${k === (e.repeat || 'none') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label data-until>Until<input type="date" name="until" value="${e.until || ''}" aria-describedby="until-hint"><small id="until-hint" class="muted">Leave empty to keep going</small></label>
      </div>
      ${existing && rep ? `<p class="hint" data-for="event">Changes apply to every repeat${e.skip?.length ? ` (${plural(e.skip.length, 'skipped day')})` : ''}.</p>` : ''}
      <label>Notes<textarea name="notes" rows="3" data-ph-event="Agenda, what to bring" data-ph-deadline="Rubric, links, what to submit">${esc(e.notes)}</textarea></label>
      ${e.assignmentUrl || e.sources?.length ? `<div class="source-bar" aria-label="Assignment sources">
        ${e.assignmentUrl ? `<a class="btn sm" href="${esc(safeLink(e.assignmentUrl))}" target="_blank" rel="noopener">Open assignment</a>` : ''}
        ${(e.sources || []).map(source => `<a class="btn sm ghost" href="${esc(safeLink(source.url))}" target="_blank" rel="noopener">${esc(source.label)}</a>`).join('')}
      </div>` : ''}
      <label class="check" data-for="deadline"><input type="checkbox" name="done" ${e.done ? 'checked' : ''}> Done</label>
      <label class="check" data-for="event"><input type="checkbox" name="remind" ${e.remind !== false ? 'checked' : ''}> Remind me before it starts</label>
      <div class="form-actions">
        ${existing && rep && occDate ? `<button type="button" class="btn ghost danger" data-del="one">Delete ${fmtDate(occDate)} only</button>` : ''}
        ${existing ? `<button type="button" class="btn ghost danger" data-del="all">${rep ? 'Delete all' : 'Delete'}</button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" data-close>Cancel</button>
        <button class="btn primary" data-submit>Save</button>
      </div>
    </form>`, {
    onMount(m) {
      const form = $('#event-form', m);
      const kind = () => form.dataset.kind;
      const sync = () => {
        const k = kind();
        $$('[data-for]', form).forEach((n) => {
          const on = n.dataset.for === k;
          n.hidden = !on;
          $$('input, select', n).forEach((i) => (i.disabled = !on));
          if (n.matches('select')) n.disabled = !on;
        });
        const timed = k === 'event' && !form.allDay.checked;
        $('[data-timed]', form).hidden = !timed;
        $$('[data-timed] input', form).forEach((i) => (i.disabled = !timed));
        $('[data-until]', form).hidden = form.repeat.value === 'none';
        $$('[data-ph-event]', form).forEach((n) => (n.placeholder = n.dataset[k === 'event' ? 'phEvent' : 'phDeadline']));
        $('[data-submit]', form).textContent = existing ? `Save ${noun(k)}` : `Add ${noun(k)}`;
      };
      form.addEventListener('change', (ev) => {
        if (ev.target.name === 'kind' && ev.target.checked) {
          form.dataset.kind = ev.target.value;
          CalView.lastKind = ev.target.value;
          // personal by default for events, a class for deadlines
          if (!form.title.value && ev.target.value === 'deadline' && !form.classId.value) form.classId.value = S().classes[0]?.id || '';
          if (!form.title.value && ev.target.value === 'event' && defaults.classId === undefined) form.classId.value = '';
        }
        if (ev.target.name === 'start' && form.end.value && form.end.value <= ev.target.value) form.end.value = plusHour(ev.target.value);
        form.end.setCustomValidity('');
        form.until.setCustomValidity('');
        sync();
      });
      sync();
      form.title.focus();

      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const f = new FormData(form);
        const sched = kind() === 'event';
        const allDay = sched && f.get('allDay') === 'on';
        if (sched && !allDay && f.get('end') <= f.get('start')) {
          form.end.setCustomValidity('End time must be after the start time.');
          return form.end.reportValidity();
        }
        const repeat = sched ? f.get('repeat') : 'none';
        const until = repeat !== 'none' ? f.get('until') || '' : '';
        if (until && until < f.get('date')) {
          form.until.setCustomValidity('Pick a day on or after the start date.');
          return form.until.reportValidity();
        }
        const data = {
          title: f.get('title').trim(), classId: f.get('classId'), date: f.get('date'), notes: f.get('notes'),
          type: sched ? f.get('typeEvent') : f.get('typeDeadline'),
          time: sched ? (allDay ? '' : f.get('start')) : f.get('dtime'),
          end: sched && !allDay ? f.get('end') : '',
          allDay, repeat, until,
          location: sched ? f.get('location').trim() : '',
          done: !sched && f.get('done') === 'on',
          remind: sched ? f.get('remind') === 'on' : undefined,
        };
        if (existing) {
          if (existing.date !== data.date) existing.skip = [];
          Object.assign(existing, data);
        } else S().events.push({ id: uid(), topicIds: [], skip: [], ...data });
        Store.save();
        closeModal();
        toast(existing ? 'Saved' : `${sched ? 'Event' : 'Deadline'} added`, 'ok');
        if (!existing && App.current.name === 'calendar') CalUI.selected = data.date;
        App.refresh();
      });

      $$('[data-del]', m).forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.del === 'one') {
          existing.skip = [...new Set([...(existing.skip || []), occDate])];
        } else {
          if (!confirm(rep ? `Delete every repeat of “${existing.title}”?` : `Delete “${existing.title}”?`)) return;
          S().events = S().events.filter((x) => x.id !== id);
        }
        Store.save();
        closeModal();
        App.refresh();
      }));
    },
  });
}

/* ------------------------------ week layout ------------------------------ */
/** Side-by-side columns for overlapping timed events. */
function layoutDay(list) {
  const items = list.map((e) => {
    const s = toMin(e.time);
    return { e, s, f: Math.max(e.end ? toMin(e.end) : s + 60, s + 20), col: 0, cols: 1 };
  }).sort((a, b) => a.s - b.s || b.f - a.f);
  let group = [];
  let groupEnd = -1;
  const close = () => {
    const n = Math.max(0, ...group.map((x) => x.col)) + 1;
    group.forEach((x) => (x.cols = n));
    group = [];
  };
  for (const it of items) {
    if (it.s >= groupEnd && group.length) close();
    const used = new Set(group.filter((x) => x.f > it.s).map((x) => x.col));
    while (used.has(it.col)) it.col++;
    group.push(it);
    groupEnd = Math.max(groupEnd, it.f);
  }
  if (group.length) close();
  return items;
}

function calPill(e) {
  const sched = isScheduled(e);
  const label = esc(e.title.replace('[Template] ', ''));
  return `<button class="cal-pill ${sched ? 'ev' : 'dl'} ${e.done ? 'done' : ''} ${EVENT_TYPES[e.type]?.major ? 'major' : ''}" data-act="edit-event" data-id="${e.id}" data-date="${e.date}" title="${esc(e.title)}${fmtSpan(e) ? ` · ${fmtSpan(e)}` : ''}${e.location ? ` · ${esc(e.location)}` : ''}">${e.classId ? mark(e.classId) : ''}${sched && e.time && !e.allDay ? `<span class="pill-time">${fmtTime(e.time).replace(/:00|\s/g, '').toLowerCase()}</span>` : ''}<span class="pill-text">${!sched ? '<span class="sr-only">Due: </span>' : ''}${label}</span></button>`;
}

/* ------------------------------ view ------------------------------ */
Views.calendar = {
  title: 'Calendar',

  range() {
    if (CalView.mode === 'week') {
      const s = weekStart(CalUI.selected);
      return [s, addDays(s, 6)];
    }
    if (CalView.mode === 'agenda') return [CalUI.selected, addDays(CalUI.selected, 59)];
    const [y, m] = CalUI.month.split('-').map(Number);
    const s = weekStart(ymd(new Date(y, m - 1, 1)));
    return [s, addDays(s, 41)];
  },

  heading() {
    const [a, b] = this.range();
    if (CalView.mode === 'month') {
      const [y, m] = CalUI.month.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    const sameMonth = a.slice(0, 7) === b.slice(0, 7);
    return `${fmtDate(a, { month: 'short', day: 'numeric' })} – ${fmtDate(b, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}, ${b.slice(0, 4)}`;
  },

  render() {
    CalView.mode ||= S().settings.calMode || 'month';
    const [from, to] = this.range();
    const occ = occurrences(from, to).filter(calFilter);
    const byDay = new Map();
    occ.forEach((e) => (byDay.get(e.date) || byDay.set(e.date, []).get(e.date)).push(e));
    const mode = CalView.mode;
    const body = mode === 'week' ? this.week(from, byDay) : mode === 'agenda' ? this.agenda(from, to, byDay) : this.month(from, byDay);
    const unit = { month: 'month', week: 'week', agenda: '60 days' }[mode];

    return `
    <header class="page-head">
      <div><h1>${this.heading()}</h1><p class="lede">Events you schedule and the deadlines you have to hit. Filled items are exams, projects and papers.</p></div>
      <div class="head-actions">
        <div class="seg sm" role="radiogroup" aria-label="Calendar layout">
          ${['month', 'week', 'agenda'].map((k) => `<label><input type="radio" name="cal-mode" value="${k}" ${mode === k ? 'checked' : ''}><span>${k[0].toUpperCase() + k.slice(1)}</span></label>`).join('')}
        </div>
        <button class="icon-btn" data-nav="-1" aria-label="Previous ${unit}">${icon('left')}</button>
        <button class="btn sm" data-nav="0">Today</button>
        <button class="icon-btn" data-nav="1" aria-label="Next ${unit}">${icon('right')}</button>
        <button class="btn" data-act="add-deadline">${icon('plus', 16)}Deadline</button>
        <button class="btn primary" data-act="add-event">${icon('plus', 16)}Event</button>
      </div>
    </header>
    <div class="cal-bar">
      <div class="chips filter-chips" role="group" aria-label="Show class">
        <button class="chip toggle ${CalUI.filter === '' ? '' : 'off'}" data-filter="" aria-pressed="${CalUI.filter === ''}">Everything</button>
        ${S().classes.map((c) => `<button class="chip toggle ${CalUI.filter === c.id ? '' : 'off'}" data-filter="${c.id}" aria-pressed="${CalUI.filter === c.id}">${mark(c.id)}${esc(c.name)}</button>`).join('')}
        <button class="chip toggle ${CalUI.filter === '-' ? '' : 'off'}" data-filter="-" aria-pressed="${CalUI.filter === '-'}">Personal</button>
      </div>
      <div class="seg sm" role="radiogroup" aria-label="Show">
        ${[['all', 'All'], ['event', 'Events'], ['deadline', 'Deadlines']].map(([k, l]) => `<label><input type="radio" name="cal-show" value="${k}" ${CalView.show === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      </div>
    </div>
    ${body}`;
  },

  side() {
    const t = todayStr();
    const sel = occurrences(CalUI.selected, CalUI.selected).filter(calFilter);
    const dls = deadlines().filter((e) => calFilter(e) && !e.done);
    const overdue = dls.filter((e) => e.date < t).sort((a, b) => a.date.localeCompare(b.date));
    const upcoming = dls.filter((e) => e.date >= t && e.date <= addDays(t, 30)).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    return `
      <aside class="stack">
        <section class="panel">
          <header class="panel-head"><h2>${fmtDate(CalUI.selected, { weekday: 'long', month: 'short', day: 'numeric' })}</h2><button class="btn sm" data-act="add-sel">${icon('plus', 14)}Add</button></header>
          <ul class="rows">${sel.map((e) => eventRow(e)).join('') || '<li class="rows-empty">Nothing scheduled.</li>'}</ul>
          <a class="quiet-link" href="#/tasks?date=${CalUI.selected}">Tasks for this day</a>
        </section>
        ${overdue.length ? `<section class="panel inverted"><header class="panel-head"><h2>Overdue</h2></header><ul class="rows">${overdue.map((e) => eventRow(e)).join('')}</ul></section>` : ''}
        <section class="panel">
          <header class="panel-head"><h2>Due in the next 30 days</h2></header>
          <ul class="rows">${upcoming.map((e) => eventRow(e)).join('') || '<li class="rows-empty">Nothing due in the next 30 days.</li>'}</ul>
        </section>
        <section class="panel">
          <header class="panel-head"><h2>Other calendars</h2></header>
          <p class="hint">Bring in a Google, Outlook or Apple Calendar export, or send this calendar there.</p>
          <div class="btn-row">
            <label class="btn sm">Import .ics<input type="file" accept=".ics,text/calendar" data-ics-import hidden></label>
            <button class="btn sm" data-act="ics-export">Export .ics</button>
          </div>
        </section>
      </aside>`;
  },

  month(start, byDay) {
    const t = todayStr();
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const list = byDay.get(d) || [];
      const taskCount = S().tasks.filter((x) => x.date === d && !x.done).length;
      cells += `
        <div class="cal-cell ${d.slice(0, 7) === CalUI.month ? '' : 'out'} ${d === t ? 'today' : ''} ${d === CalUI.selected ? 'sel' : ''}" data-day="${d}" tabindex="${d === CalUI.selected ? 0 : -1}" role="gridcell" aria-selected="${d === CalUI.selected}" aria-label="${fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}, ${plural(list.length, 'item')}">
          <div class="cal-date"><span>${parseYmd(d).getDate()}</span><button class="cal-add" data-add-day="${d}" aria-label="Add on ${fmtDate(d)}" tabindex="-1">${icon('plus', 14)}</button>${taskCount ? `<span class="cal-tasks" title="${plural(taskCount, 'open task')}">${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}</span>` : ''}</div>
          ${list.slice(0, 3).map(calPill).join('')}
          ${list.length > 3 ? `<span class="cal-more">${list.length - 3} more</span>` : ''}
        </div>`;
    }
    return `
    <div class="cal-layout">
      <section class="panel cal-panel">
        <div class="cal-grid" role="grid" aria-label="${this.heading()}">
          ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="cal-dow" role="columnheader">${d}</div>`).join('')}
          ${cells}
        </div>
        <p class="hint">Select a day to see what's on it. Double-click a day or press Enter to add something. Arrow keys move between days.</p>
      </section>
      ${this.side()}
    </div>`;
  },

  week(start, byDay) {
    const t = todayStr();
    const days = [...Array(7)].map((_, i) => addDays(start, i));
    const timed = days.flatMap((d) => (byDay.get(d) || []).filter((e) => isScheduled(e) && !e.allDay && e.time));
    let h0 = 7;
    let h1 = 23;
    timed.forEach((e) => {
      h0 = Math.min(h0, Math.floor(toMin(e.time) / 60));
      h1 = Math.max(h1, Math.ceil((e.end ? toMin(e.end) : toMin(e.time) + 60) / 60));
    });
    h1 = Math.min(h1, 24);
    const hours = [...Array(h1 - h0)].map((_, i) => h0 + i);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const cols = days.map((d) => {
      const list = (byDay.get(d) || []).filter((e) => isScheduled(e) && !e.allDay && e.time);
      const blocks = layoutDay(list).map(({ e, s, f, col, cols }) => `
        <button class="wk-ev ${f - s < 45 ? 'short' : ''}" data-act="edit-event" data-id="${e.id}" data-date="${d}"
          style="top:${hrs((s - h0 * 60) / 60)};height:calc(${hrs((f - s) / 60)} - 2px);left:calc(${(col / cols) * 100}% + 2px);width:calc(${100 / cols}% - 4px)">
          <span class="wk-ev-title">${e.classId ? mark(e.classId) : ''}${esc(e.title)}</span>
          <span class="wk-ev-meta">${fmtSpan(e)}${e.location ? ` · ${esc(e.location)}` : ''}</span>
        </button>`).join('');
      const line = d === t && nowMin >= h0 * 60 && nowMin <= h1 * 60 ? `<div class="wk-now" style="top:${hrs((nowMin - h0 * 60) / 60)}" aria-hidden="true"></div>` : '';
      return `<div class="wk-col ${d === t ? 'today' : ''}" data-col-day="${d}" data-h0="${h0}" role="button" tabindex="-1" aria-label="Add an event on ${fmtDate(d)}">${blocks}${line}</div>`;
    }).join('');

    return `
    <section class="panel wk-panel">
      <div class="wk" style="--wk-rows:${hours.length}">
        <div class="wk-row wk-head">
          <div class="wk-gutter"></div>
          ${days.map((d) => `<button class="wk-day ${d === t ? 'today' : ''} ${d === CalUI.selected ? 'sel' : ''}" data-day="${d}"><span>${fmtDate(d, { weekday: 'short' })}</span><b>${parseYmd(d).getDate()}</b></button>`).join('')}
        </div>
        <div class="wk-row wk-allday">
          <div class="wk-gutter"><span>All day<br>&amp; due</span></div>
          ${days.map((d) => `<div class="wk-ad" data-add-day="${d}">${(byDay.get(d) || []).filter((e) => !isScheduled(e) || e.allDay || !e.time).map(calPill).join('')}</div>`).join('')}
        </div>
        <div class="wk-scroll">
          <div class="wk-row wk-body">
            <div class="wk-gutter">${hours.map((h) => `<span style="top:${hrs(h - h0)}">${h === 0 ? '' : fmtTime(`${String(h).padStart(2, '0')}:00`).replace(':00', '')}</span>`).join('')}</div>
            ${cols}
          </div>
        </div>
      </div>
      <p class="hint">Click an empty slot to add an event at that time. Events that overlap sit side by side.</p>
    </section>`;
  },

  agenda(from, to, byDay) {
    const t = todayStr();
    const days = [...byDay.keys()].sort();
    return `
    <div class="cal-layout">
      <section class="panel agenda">
        ${days.map((d) => `
          <div class="ag-day ${d === t ? 'today' : ''}">
            <button class="ag-date" data-add-day="${d}" aria-label="Add on ${fmtDate(d)}"><b>${parseYmd(d).getDate()}</b><span>${fmtDate(d, { weekday: 'short', month: 'short' })}</span></button>
            <ul class="rows">${byDay.get(d).map((e) => eventRow(e)).join('')}</ul>
          </div>`).join('') || emptyState('planner', 'Nothing in the next 60 days', 'Add an event or a deadline to see it here.', `<button class="btn primary" data-act="add-event">${icon('plus', 16)}Event</button>`)}
        <p class="hint">Showing ${fmtDate(from)} to ${fmtDate(to, { month: 'short', day: 'numeric', year: 'numeric' })}.</p>
      </section>
      ${this.side()}
    </div>`;
  },

  mount(el) {
    const newAt = (date, extra = {}) => editEventModal(null, { date, classId: CalUI.filter && CalUI.filter !== '-' ? CalUI.filter : undefined, kind: CalView.lastKind, ...extra });
    const select = (d) => {
      CalUI.selected = d;
      CalUI.month = d.slice(0, 7);
    };

    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) {
        const { act, id, date } = b.dataset;
        if (act === 'edit-event') return editEventModal(id, {}, date);
        if (handleCommonAction(act, id)) return;
        if (act === 'add-event') return editEventModal(null, { kind: 'event', date: CalView.mode === 'month' ? CalUI.selected : undefined });
        if (act === 'add-deadline') return editEventModal(null, { kind: 'deadline', classId: CalUI.filter && CalUI.filter !== '-' ? CalUI.filter : undefined });
        if (act === 'add-sel') return newAt(CalUI.selected);
        if (act === 'ics-export') return exportIcs();
        return;
      }
      const addDay = e.target.closest('[data-add-day]');
      if (addDay && (e.target === addDay || e.target.closest('.cal-add, .ag-date'))) return newAt(addDay.dataset.addDay);
      const col = e.target.closest('[data-col-day]');
      if (col && e.target === col) {
        const y = e.clientY - col.getBoundingClientRect().top;
        const m = Math.max(0, Math.min(23 * 60 + 30, +col.dataset.h0 * 60 + Math.floor((y / weekHour(col)) * 2) * 30));
        const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        return editEventModal(null, { kind: 'event', date: col.dataset.colDay, time, classId: CalUI.filter && CalUI.filter !== '-' ? CalUI.filter : undefined });
      }
      const nav = e.target.closest('[data-nav]');
      if (nav) {
        const n = +nav.dataset.nav;
        if (n === 0) select(todayStr());
        else if (CalView.mode === 'week') select(addDays(CalUI.selected, 7 * n));
        else if (CalView.mode === 'agenda') select(addDays(CalUI.selected, 30 * n));
        else {
          const [y, m] = CalUI.month.split('-').map(Number);
          CalUI.month = ymd(new Date(y, m - 1 + n, 1)).slice(0, 7);
          CalUI.selected = `${CalUI.month}-01`;
        }
        return App.refresh();
      }
      const f = e.target.closest('[data-filter]');
      if (f) {
        CalUI.filter = f.dataset.filter;
        return App.refresh();
      }
      const cell = e.target.closest('[data-day]');
      if (cell && cell.dataset.day !== CalUI.selected) {
        select(cell.dataset.day);
        App.refresh();
        $(`.cal-cell[data-day="${CalUI.selected}"]`, App.viewEl)?.focus();
      }
    });

    el.addEventListener('dblclick', (e) => {
      const cell = e.target.closest('.cal-cell, .wk-ad');
      if (cell && !e.target.closest('[data-act]')) newAt(cell.dataset.day || cell.dataset.addDay);
    });

    el.addEventListener('change', (e) => {
      if (e.target.name === 'cal-mode') {
        CalView.mode = S().settings.calMode = e.target.value;
        Store.save();
        if (CalView.mode === 'agenda' && CalUI.selected.slice(0, 7) === todayStr().slice(0, 7)) CalUI.selected = todayStr();
        App.refresh();
      }
      if (e.target.name === 'cal-show') {
        CalView.show = e.target.value;
        App.refresh();
      }
      if (e.target.matches('[data-ics-import]') && e.target.files[0]) {
        importIcs(e.target.files[0]).catch((err) => toast('Calendar import failed: ' + err.message, 'error'));
      }
    });

    el.addEventListener('keydown', (e) => {
      const cell = e.target.closest('.cal-cell');
      if (!cell || e.target !== cell) return;
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (moves[e.key]) {
        e.preventDefault();
        select(addDays(cell.dataset.day, moves[e.key]));
        App.refresh();
        $(`.cal-cell[data-day="${CalUI.selected}"]`, App.viewEl)?.focus();
      }
      if (e.key === 'Enter') newAt(cell.dataset.day);
    });

    // start the week view scrolled to the first event, or 8 am
    const scroller = $('.wk-scroll', el);
    if (scroller) {
      const tops = $$('.wk-ev', el).map((n) => n.offsetTop);
      const h0 = +$('[data-h0]', el).dataset.h0;
      scroller.scrollTop = Math.max(0, tops.length ? Math.min(...tops) - weekHour(scroller) : (8 - h0) * weekHour(scroller));
    }
  },
};

/* ------------------------------ .ics ------------------------------ */
const icsEsc = (s) => String(s || '').replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
const icsDate = (d) => d.replace(/-/g, '');
const icsDT = (d, t) => `${icsDate(d)}T${t.replace(':', '')}00`;

function exportIcs() {
  const rule = { daily: 'FREQ=DAILY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY', biweekly: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY' };
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Study Hub//Calendar//EN', 'CALSCALE:GREGORIAN'];
  for (const e of S().events) {
    const sched = isScheduled(e);
    const timed = e.time && !e.allDay;
    lines.push('BEGIN:VEVENT', `UID:${e.id}@studyhub`, `DTSTAMP:${stamp}`);
    if (timed) {
      lines.push(`DTSTART:${icsDT(e.date, e.time)}`, `DTEND:${icsDT(e.date, sched && e.end ? e.end : e.time)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(e.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(e.date, 1))}`);
    }
    const title = sched ? e.title : `Due: ${e.title}`;
    lines.push(`SUMMARY:${icsEsc(e.classId ? `[${getClass(e.classId)?.short || className(e.classId)}] ${title}` : title)}`);
    if (e.location) lines.push(`LOCATION:${icsEsc(e.location)}`);
    if (e.notes) lines.push(`DESCRIPTION:${icsEsc(e.notes)}`);
    if (isRepeating(e)) {
      lines.push(`RRULE:${rule[e.repeat]}${e.until ? `;UNTIL=${icsDate(e.until)}${timed ? 'T235959' : ''}` : ''}`);
      (e.skip || []).forEach((d) => lines.push(timed ? `EXDATE:${icsDT(d, e.time)}` : `EXDATE;VALUE=DATE:${icsDate(d)}`));
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  a.download = `study-hub-${todayStr()}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Exported ${plural(S().events.length, 'entry')}`.replace('entrys', 'entries'), 'ok');
}

/** Parse an ICS date value into local { date, time } (time '' for all-day). */
function icsWhen(prop) {
  const [head, val] = [prop.slice(0, prop.indexOf(':')), prop.slice(prop.indexOf(':') + 1).trim()];
  const m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{2}(Z)?)?/);
  if (!m) return null;
  if (!m[4] || /VALUE=DATE(?!-)/.test(head)) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: '' };
  const zone = head.match(/(?:^|;)TZID="?([^;"]+)"?/i)?.[1];
  if (m[6] || zone) {
    const wall = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
    let instant = wall;
    if (!m[6] && zone) {
      // Intl supplies the zone's offset at the event date, including DST.
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      });
      for (let i = 0; i < 3; i++) {
        const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
        const observed = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
        const adjustment = wall - observed;
        instant += adjustment;
        if (!adjustment) break;
      }
    }
    const d = new Date(instant);
    return { date: ymd(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
}

async function importIcs(file) {
  const text = (await file.text()).replace(/\r?\n[ \t]/g, ''); // unfold
  const unesc = (s) => (s || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  const known = new Set(S().events.map((e) => e.importUid).filter(Boolean));
  let added = 0;
  let skipped = 0;
  const incoming = [];
  for (const block of text.split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0];
    const props = body.split(/\r?\n/).filter(Boolean);
    const get = (name) => props.find((p) => new RegExp(`^${name}[;:]`, 'i').test(p));
    const val = (name) => {
      const p = get(name);
      return p ? p.slice(p.indexOf(':') + 1) : '';
    };
    const start = get('DTSTART') && icsWhen(get('DTSTART'));
    if (!start) continue;
    const uidv = val('UID');
    if (uidv && known.has(uidv)) {
      skipped++;
      continue;
    }
    // Study Hub's own exports come back in unchanged
    if (/@studyhub$/.test(uidv) && S().events.some((e) => `${e.id}@studyhub` === uidv)) {
      skipped++;
      continue;
    }
    const end = get('DTEND') && icsWhen(get('DTEND'));
    const rr = Object.fromEntries(val('RRULE').split(';').filter(Boolean).map((kv) => kv.split('=')));
    let repeat = 'none';
    if (rr.FREQ === 'DAILY' && (!rr.INTERVAL || rr.INTERVAL === '1')) repeat = 'daily';
    else if (rr.FREQ === 'WEEKLY' && /^MO,TU,WE,TH,FR$/.test(rr.BYDAY || '')) repeat = 'weekdays';
    else if (rr.FREQ === 'WEEKLY' && rr.INTERVAL === '2') repeat = 'biweekly';
    else if (rr.FREQ === 'WEEKLY' && (!rr.INTERVAL || rr.INTERVAL === '1')) repeat = 'weekly';
    else if (rr.FREQ === 'MONTHLY' && !rr.BYDAY) repeat = 'monthly';
    const title = unesc(val('SUMMARY')) || 'Untitled event';
    const allDay = !start.time;
    const skip = props.filter((p) => /^EXDATE/i.test(p)).flatMap((p) => p.slice(p.indexOf(':') + 1).split(',').map((v) => icsWhen(`${p.slice(0, p.indexOf(':'))}:${v}`)?.date)).filter(Boolean);
    // "every Tue and Thu" becomes one weekly entry per day
    const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const byDay = /^(bi)?weekly$/.test(repeat) && rr.BYDAY ? rr.BYDAY.split(',').map((d) => DAYS.indexOf(d.slice(-2))).filter((i) => i >= 0) : [];
    const starts = byDay.length ? byDay.map((dow) => addDays(start.date, (dow - parseYmd(start.date).getDay() + 7) % 7)) : [start.date];
    let until = rr.UNTIL ? icsWhen(`X:${rr.UNTIL}`)?.date || '' : '';
    if (!until && +rr.COUNT > 0 && repeat !== 'none') {
      const n = +rr.COUNT;
      const per = repeat === 'weekdays' ? 5 : byDay.length || 1;
      if (repeat === 'daily') until = addDays(start.date, n - 1);
      else if (repeat === 'monthly') until = ymd(new Date(parseYmd(start.date).setMonth(parseYmd(start.date).getMonth() + n - 1)));
      else until = addDays(start.date, Math.ceil(n / per) * 7 * (repeat === 'biweekly' ? 2 : 1) - 1);
    }
    for (const date of starts) {
      incoming.push({
        id: uid(), importUid: uidv || undefined, title, classId: '', type: 'event',
        date, time: start.time, end: !allDay && end && end.date === start.date ? end.time : allDay ? '' : plusHour(start.time),
        allDay, location: unesc(val('LOCATION')), notes: unesc(val('DESCRIPTION')).slice(0, 2000),
        repeat, until, skip: [...skip], done: false, topicIds: [],
      });
      added++;
    }
    if (uidv) known.add(uidv);
  }
  S().events.push(...incoming);
  Store.save();
  toast(added ? `Imported ${plural(added, 'event')}${skipped ? `, ${skipped} already here` : ''}` : skipped ? 'Everything in that file is already here' : 'No events found in that file', added ? 'ok' : 'info');
  App.refresh();
}
