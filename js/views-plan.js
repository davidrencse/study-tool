/* ==========================================================================
   views-plan.js — Assignment calendar and daily task lists
   ========================================================================== */

const CalUI = { month: todayStr().slice(0, 7), selected: todayStr(), filter: '' };

Views.calendar = {
  title: 'Calendar',
  render() {
    const t = todayStr();
    const [y, m] = CalUI.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const start = addDays(ymd(first), -first.getDay());
    const events = S().events.filter((e) => !CalUI.filter || e.classId === CalUI.filter);
    const byDay = new Map();
    events.forEach((e) => (byDay.get(e.date) || byDay.set(e.date, []).get(e.date)).push(e));
    byDay.forEach((l) => l.sort((a, b) => (a.time || '').localeCompare(b.time || '')));

    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const inMonth = d.slice(0, 7) === CalUI.month;
      const list = byDay.get(d) || [];
      const taskCount = S().tasks.filter((x) => x.date === d && !x.done).length;
      cells += `
        <div class="cal-cell ${inMonth ? '' : 'out'} ${d === t ? 'today' : ''} ${d === CalUI.selected ? 'sel' : ''}" data-day="${d}" tabindex="0" role="gridcell" aria-label="${fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}, ${list.length} items">
          <div class="cal-date"><span>${parseYmd(d).getDate()}</span><button class="cal-add" data-add-day="${d}" aria-label="Add a deadline on ${fmtDate(d)}" tabindex="-1">${icon('plus', 14)}</button>${taskCount ? `<span class="cal-tasks" title="${plural(taskCount, 'open task')}">${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}</span>` : ''}</div>
          ${list.slice(0, 3).map((e) => `<button class="cal-pill ${e.done ? 'done' : ''} ${EVENT_TYPES[e.type]?.major ? 'major' : ''}" data-act="edit-event" data-id="${e.id}" title="${esc(e.title)}">${e.classId ? mark(e.classId) : ''}${esc(e.title.replace('[Template] ', ''))}</button>`).join('')}
          ${list.length > 3 ? `<span class="cal-more">${list.length - 3} more</span>` : ''}
        </div>`;
    }

    const sel = (byDay.get(CalUI.selected) || []);
    const upcoming = events.filter((e) => !e.done && e.date >= t && e.date <= addDays(t, 30)).sort((a, b) => a.date.localeCompare(b.date));
    const overdue = events.filter((e) => !e.done && e.date < t).sort((a, b) => a.date.localeCompare(b.date));

    return `
    <header class="page-head">
      <div><h1>${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h1><p class="lede">Assignments, exams and readings. Bold items are exams, projects and papers.</p></div>
      <div class="head-actions">
        <button class="icon-btn" data-nav="-1" aria-label="Previous month">${icon('left')}</button>
        <button class="btn sm" data-nav="0">Today</button>
        <button class="icon-btn" data-nav="1" aria-label="Next month">${icon('right')}</button>
        <button class="btn primary" data-act="add">${icon('plus', 16)}Deadline</button>
      </div>
    </header>
    <div class="chips filter-chips" role="group" aria-label="Show class">
      <button class="chip toggle ${CalUI.filter === '' ? '' : 'off'}" data-filter="" aria-pressed="${CalUI.filter === ''}">All classes</button>
      ${S().classes.map((c) => `<button class="chip toggle ${CalUI.filter === c.id ? '' : 'off'}" data-filter="${c.id}" aria-pressed="${CalUI.filter === c.id}">${mark(c.id)}${esc(c.name)}</button>`).join('')}
    </div>
    <div class="cal-layout">
      <section class="panel cal-panel">
        <div class="cal-grid" role="grid">
          ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="cal-dow">${d}</div>`).join('')}
          ${cells}
        </div>
        <p class="hint">Select a day to see its deadlines. Use the plus on a day to add one there, and arrow keys to move between days.</p>
      </section>

      <aside class="stack">
        <section class="panel">
          <header class="panel-head"><h2>${fmtDate(CalUI.selected, { weekday: 'long', month: 'short', day: 'numeric' })}</h2><button class="btn sm" data-act="add-sel">${icon('plus', 14)}Add</button></header>
          <ul class="rows">${sel.map((e) => eventRow(e)).join('') || '<li class="rows-empty">Nothing due.</li>'}</ul>
          <a class="quiet-link" href="#/tasks?date=${CalUI.selected}">Tasks for this day</a>
        </section>
        ${overdue.length ? `<section class="panel inverted"><header class="panel-head"><h2>Overdue</h2></header><ul class="rows">${overdue.map((e) => eventRow(e)).join('')}</ul></section>` : ''}
        <section class="panel">
          <header class="panel-head"><h2>Next 30 days</h2></header>
          <ul class="rows">${upcoming.map((e) => eventRow(e)).join('') || '<li class="rows-empty">Nothing due in the next 30 days.</li>'}</ul>
        </section>
      </aside>
    </div>`;
  },

  mount(el) {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) {
        if (handleCommonAction(b.dataset.act, b.dataset.id)) return;
        if (b.dataset.act === 'add') return editEventModal(null, { classId: CalUI.filter || undefined });
        if (b.dataset.act === 'add-sel') return editEventModal(null, { date: CalUI.selected, classId: CalUI.filter || undefined });
      }
      const addDay = e.target.closest('[data-add-day]');
      if (addDay) return editEventModal(null, { date: addDay.dataset.addDay, classId: CalUI.filter || undefined });
      const nav = e.target.closest('[data-nav]');
      if (nav) {
        const n = +nav.dataset.nav;
        if (n === 0) {
          CalUI.month = todayStr().slice(0, 7);
          CalUI.selected = todayStr();
        } else {
          const [y, m] = CalUI.month.split('-').map(Number);
          CalUI.month = ymd(new Date(y, m - 1 + n, 1)).slice(0, 7);
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
        CalUI.selected = cell.dataset.day;
        if (cell.dataset.day.slice(0, 7) !== CalUI.month) CalUI.month = cell.dataset.day.slice(0, 7);
        App.refresh();
      }
    });
    el.addEventListener('keydown', (e) => {
      const cell = e.target.closest('[data-day]');
      if (!cell || e.target !== cell) return;
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (moves[e.key]) {
        e.preventDefault();
        CalUI.selected = addDays(cell.dataset.day, moves[e.key]);
        CalUI.month = CalUI.selected.slice(0, 7);
        App.refresh();
        $(`[data-day="${CalUI.selected}"]`, App.viewEl)?.focus();
      }
      if (e.key === 'Enter') editEventModal(null, { date: cell.dataset.day });
    });
  },
};

/* ------------------------------ Tasks ------------------------------ */
const TaskUI = { date: todayStr(), editRoutine: false };

Views.tasks = {
  title: 'Tasks',
  render(_, query) {
    if (query.date && location.hash !== TaskUI._hash) {
      TaskUI._hash = location.hash;
      TaskUI.date = query.date;
    }
    const s = S();
    const d = TaskUI.date;
    const tasks = s.tasks.filter((x) => x.date === d);
    const prioRank = { high: 0, med: 1, low: 2 };
    const open = tasks.filter((x) => !x.done).sort((a, b) => prioRank[a.priority] - prioRank[b.priority]);
    const done = tasks.filter((x) => x.done);
    const leftovers = s.tasks.filter((x) => !x.done && x.date < d);
    const doneIds = s.routineDone[d] || [];
    const events = deadlines().filter((e) => e.date === d || (!e.done && e.date > d && e.date <= addDays(d, 3))).sort((a, b) => a.date.localeCompare(b.date));
    const agenda = occurrences(d, d).filter(isScheduled);

    // week strip (Mon–Sun containing the date)
    const dow = (parseYmd(d).getDay() + 6) % 7;
    const monday = addDays(d, -dow);
    const week = [...Array(7)].map((_, i) => {
      const day = addDays(monday, i);
      const ts = s.tasks.filter((x) => x.date === day);
      return { day, total: ts.length, done: ts.filter((x) => x.done).length, events: deadlines().filter((e) => e.date === day).length };
    });

    return `
    <header class="page-head">
      <div><h1>${d === todayStr() ? 'Today' : fmtDate(d, { weekday: 'long' })}</h1><p class="lede">${fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}. ${done.length} of ${plural(tasks.length, 'task')} done.</p></div>
      <div class="head-actions">
        <button class="icon-btn" data-day-nav="-1" aria-label="Previous day">${icon('left')}</button>
        <input type="date" class="compact" value="${d}" data-date aria-label="Pick a date">
        <button class="icon-btn" data-day-nav="1" aria-label="Next day">${icon('right')}</button>
        <button class="btn sm" data-day-nav="0">Today</button>
      </div>
    </header>

    <div class="week-strip">
      ${week.map((w) => `
        <button class="week-day ${w.day === d ? 'active' : ''} ${w.day === todayStr() ? 'today' : ''}" data-goto="${w.day}">
          <span class="wd-name">${fmtDate(w.day, { weekday: 'short' })}</span>
          <span class="wd-num">${parseYmd(w.day).getDate()}</span>
          <span class="wd-meta">${w.total ? `${w.done}/${w.total}` : '&nbsp;'}</span>${w.events ? `<span class="wd-due" title="${plural(w.events, 'deadline')}"></span>` : ''}
          ${progressBar(w.total ? Math.round((w.done / w.total) * 100) : 0)}
        </button>`).join('')}
    </div>

    <div class="grid-2 wide-left">
      <section class="panel">
        <header class="panel-head"><h2>Tasks</h2></header>
        <form class="task-add" id="task-add">
          <input name="title" placeholder="Add a task" required autocomplete="off" aria-label="Task">
          <select name="category" aria-label="Category">${TASK_CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select>
          <select name="priority" aria-label="Priority"><option value="high">High priority</option><option value="med" selected>Normal</option><option value="low">Low priority</option></select>
          <button class="btn primary">Add</button>
        </form>
        ${leftovers.length ? `<div class="callout"><span>${plural(leftovers.length, 'unfinished task')} from earlier days.</span><button class="btn sm" data-act="carry">Move ${leftovers.length === 1 ? 'it' : 'them'} to ${d === todayStr() ? 'today' : 'this day'}</button></div>` : ''}
        <ul class="rows">${open.map(taskRow).join('') || `<li class="rows-empty">${tasks.length ? 'All done.' : 'No tasks for this day.'}</li>`}</ul>
        ${done.length ? `<details class="done-group"><summary>Completed (${done.length})</summary><ul class="rows">${done.map(taskRow).join('')}</ul></details>` : ''}
        <h3 class="sub">Common tasks</h3>
        <div class="chips">
          ${['Go to lecture', 'Do readings', 'Work on problem set', 'Office hours', 'Review notes', 'Meal prep', 'Laundry', 'Gym', 'Call family'].map((q) => `<button class="chip" data-quick="${q}">${icon('plus', 12)}${q}</button>`).join('')}
        </div>
      </section>

      <div class="stack">
        <section class="panel">
          <header class="panel-head"><h2>Daily routine</h2><button class="btn sm ghost" data-act="edit-routine">${TaskUI.editRoutine ? 'Done editing' : 'Edit'}</button></header>
          ${progressBar(s.routines.length ? Math.round((doneIds.length / s.routines.length) * 100) : 0)}
          <p class="small muted routine-count">${doneIds.length} of ${s.routines.length} done</p>
          <ul class="rows routine">
            ${s.routines.map((r) => `
              <li class="row task-row ${doneIds.includes(r.id) ? 'done' : ''}">
                ${TaskUI.editRoutine
                  ? `<input class="grow" data-routine="${r.id}" value="${esc(r.title)}" aria-label="Routine item"><button class="icon-btn sm" data-del-routine="${r.id}" aria-label="Remove ${esc(r.title)}">${icon('close', 14)}</button>`
                  : `<label class="check grow"><input type="checkbox" data-rcheck="${r.id}" ${doneIds.includes(r.id) ? 'checked' : ''}> <span class="row-title">${esc(r.title)}</span></label>`}
              </li>`).join('')}
          </ul>
          ${TaskUI.editRoutine ? '<form id="routine-add" class="inline-add"><input name="title" placeholder="Add a daily habit" required aria-label="New daily habit"><button class="btn">Add</button></form>' : ''}
        </section>
        ${agenda.length ? `<section class="panel"><header class="panel-head"><h2>Schedule</h2><a class="quiet-link" href="#/calendar">Calendar</a></header><ul class="rows">${agenda.map((e) => eventRow(e)).join('')}</ul></section>` : ''}
        <section class="panel">
          <header class="panel-head"><h2>Due soon</h2><a class="quiet-link" href="#/calendar">Calendar</a></header>
          <ul class="rows">${events.map((e) => eventRow(e)).join('') || '<li class="rows-empty">Nothing due in the next 3 days.</li>'}</ul>
        </section>
      </div>
    </div>`;
  },

  mount(el) {
    const s = S();
    const setDate = (d) => {
      TaskUI.date = d;
      App.refresh();
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) {
        if (handleCommonAction(b.dataset.act, b.dataset.id)) return;
        if (b.dataset.act === 'carry') {
          s.tasks.forEach((x) => {
            if (!x.done && x.date < TaskUI.date) x.date = TaskUI.date;
          });
          Store.save();
          App.refresh();
        }
        if (b.dataset.act === 'edit-routine') {
          TaskUI.editRoutine = !TaskUI.editRoutine;
          App.refresh();
        }
        return;
      }
      const nav = e.target.closest('[data-day-nav]');
      if (nav) return setDate(+nav.dataset.dayNav === 0 ? todayStr() : addDays(TaskUI.date, +nav.dataset.dayNav));
      const g = e.target.closest('[data-goto]');
      if (g) return setDate(g.dataset.goto);
      const q = e.target.closest('[data-quick]');
      if (q) {
        s.tasks.push({ id: uid(), title: q.dataset.quick, date: TaskUI.date, done: false, category: /meal|laundry/i.test(q.dataset.quick) ? 'Errands' : /gym/i.test(q.dataset.quick) ? 'Health' : /family/i.test(q.dataset.quick) ? 'Social' : 'School', priority: 'med' });
        Store.save();
        App.refresh();
      }
      const dr = e.target.closest('[data-del-routine]');
      if (dr) {
        s.routines = s.routines.filter((r) => r.id !== dr.dataset.delRoutine);
        Store.save();
        App.refresh();
      }
    });
    el.addEventListener('change', (e) => {
      if (e.target.matches('[data-date]') && e.target.value) setDate(e.target.value);
      const rc = e.target.dataset.rcheck;
      if (rc) {
        const list = (s.routineDone[TaskUI.date] ||= []);
        const i = list.indexOf(rc);
        i >= 0 ? list.splice(i, 1) : list.push(rc);
        Store.save();
        App.refresh();
      }
      const rt = e.target.dataset.routine;
      if (rt) {
        s.routines.find((r) => r.id === rt).title = e.target.value;
        Store.save();
      }
    });
    $('#task-add', el).addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      s.tasks.push({ id: uid(), title: f.get('title').trim(), date: TaskUI.date, done: false, category: f.get('category'), priority: f.get('priority') });
      Store.save();
      App.refresh();
      $('#task-add input', App.viewEl).focus();
    });
    $('#routine-add', el)?.addEventListener('submit', (e) => {
      e.preventDefault();
      s.routines.push({ id: uid(), title: e.target.title.value.trim() });
      Store.save();
      App.refresh();
      $('#routine-add input', App.viewEl)?.focus();
    });
  },
};
