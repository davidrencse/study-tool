/* ==========================================================================
   app.js — router, shell (sidebar, search, theme), boot
   ========================================================================== */

const NAV = [
  { id: 'dashboard', label: 'Today', icon: 'today', views: ['dashboard'] },
  { id: 'classes', label: 'Classes', icon: 'classes', views: ['classes', 'grades'], tabs: [['#/classes', 'Classes', 'classes'], ['#/grades', 'Grades', 'grades']] },
  { id: 'notes', label: 'Notes', icon: 'notes', views: ['notes', 'code', 'import'], tabs: [['#/notes', 'All notes', 'notes'], ['#/code', 'Code', 'code'], ['#/import', 'Add material', 'import']] },
  { id: 'cards', label: 'Flashcards', icon: 'cards', views: ['cards'], badge: () => dueCards().length },
  { id: 'assist', label: 'AI', icon: 'ai', views: ['assist', 'summary'], tabs: [['#/assist', 'Ask ChatGPT', 'assist'], ['#/summary', 'Summarize', 'summary']] },
  { id: 'leetcode', label: 'LeetCode', icon: 'leetcode', views: ['leetcode', 'lcpractice'], tabs: [['#/leetcode', 'Problems', 'leetcode'], ['#/lcpractice', 'Practice', 'lcpractice']], badge: () => lcDue().length, badgeLabel: 'to re-solve' },
  { id: 'graph', label: 'Map', icon: 'map', views: ['graph', 'tree', 'connections'], tabs: [['#/graph', 'Graph', 'graph'], ['#/tree', 'Skill tree', 'tree'], ['#/connections', 'Connections', 'connections']] },
  { id: 'calendar', label: 'Planner', icon: 'planner', views: ['calendar', 'schedule', 'todo', 'tasks', 'exams'], tabs: [['#/calendar', 'Calendar', 'calendar'], ['#/schedule', 'Day plan', 'schedule'], ['#/todo', 'To-do', 'todo'], ['#/tasks', 'Tasks', 'tasks'], ['#/exams', 'Exams', 'exams']], badge: () => deadlines().filter((e) => !e.done && e.date < todayStr()).length + (S().todo || []).filter((x) => x.due && !x.done && x.due < todayStr()).length, badgeLabel: 'overdue' },
  { id: 'focus', label: 'Focus', icon: 'timer', views: ['focus'] },
];
const navFor = (view) => NAV.find((n) => n.views.includes(view));

/** Off-canvas sidebar on narrow screens. */
function setNavOpen(open) {
  document.body.classList.toggle('nav-open', open);
  const btn = $('#nav-toggle');
  btn.setAttribute('aria-expanded', open);
  btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

const App = {
  viewEl: null,
  current: null,

  parse() {
    const raw = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [path, qs = ''] = raw.split('?');
    const [name, ...params] = path.split('/').map(decodeURIComponent);
    const query = Object.fromEntries(new URLSearchParams(qs));
    return { name: Views[name] ? name : 'dashboard', params, query };
  },

  route() {
    const { name, params, query } = this.parse();
    const prev = this.current && Views[this.current.name];
    prev?.unmount?.();
    const changed = this.current?.name !== name;
    this.current = { name, params, query };
    this.draw();
    if (changed) {
      window.scrollTo(0, 0);
      this.viewEl.classList.add('enter');
    }
    setNavOpen(false);
  },

  /** Re-render the current view in place (keeps scroll position). */
  refresh() {
    const v = Views[this.current.name];
    v.unmount?.();
    const wy = window.scrollY;
    this.draw();
    window.scrollTo(0, wy);
  },

  draw() {
    const { name, params, query } = this.current;
    const v = Views[name];
    const group = navFor(name);
    const el = document.createElement('div');
    el.className = `view view-${name}`;
    el.innerHTML = (group?.tabs ? subTabs(group.tabs, name) : '') + v.render(params, query);
    $('#view').replaceChildren(el);
    this.viewEl = el;
    document.title = `${v.title} · Study Hub`;
    v.mount?.(el, params, query);
    this.renderNav();
  },

  renderNav() {
    const active = navFor(this.current?.name)?.id || this.current?.name;
    const item = (n) => {
      const b = n.badge?.() || 0;
      return `<a href="#/${n.id}" class="nav-item ${active === n.id ? 'active' : ''}" ${active === n.id ? 'aria-current="page"' : ''}>
        ${icon(n.icon)}<span class="nav-label">${n.label}</span>${b ? `<span class="badge" aria-label="${b} ${n.badgeLabel || 'due'}">${b}</span>` : ''}
      </a>`;
    };
    $('#nav').innerHTML = NAV.map(item).join('');
    $('#nav-foot').innerHTML = item({ id: 'settings', label: 'Settings', icon: 'settings' });
    const cur = this.current;
    $('#nav-classes').innerHTML = S().classes.map((c) => `
      <a href="#/classes/${c.id}" class="nav-class ${cur?.name === 'classes' && cur.params[0] === c.id ? 'active' : ''}">
        ${mark(c.id)}<span class="nav-label">${esc(c.name)}</span>
      </a>`).join('');
  },
};

/* ---------------- theme ---------------- */
function applyTheme() {
  const t = S().settings.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/* ---------------- global search ---------------- */
function globalSearch(q) {
  q = q.trim().toLowerCase();
  if (q.length < 2) return [];
  const out = [];
  const hit = (s) => (s || '').toLowerCase().includes(q);
  S().classes.forEach((c) => hit(c.name) && out.push({ icon: 'classes', label: c.name, sub: 'Class', href: `#/classes/${c.id}` }));
  S().topics.forEach((t) => (hit(t.name) || hit(t.desc)) && out.push({ icon: 'map', label: t.name, sub: `Topic in ${className(t.classId)}`, href: `#/tree/${t.classId}?topic=${t.id}` }));
  S().notes.forEach((n) => {
    if (hit(n.title) || hit(n.body)) {
      const i = n.body.toLowerCase().indexOf(q);
      const snip = i >= 0 ? '…' + n.body.slice(Math.max(0, i - 30), i + 50).replace(/\s+/g, ' ') + '…' : 'Note';
      out.push({ icon: n.source ? 'slides' : 'notes', label: n.title, sub: snip, href: `#/notes/${n.id}` });
    }
  });
  S().events.forEach((e) => (hit(e.title) || hit(e.location)) && out.push({ icon: 'planner', label: e.title, sub: `${isScheduled(e) ? (e.repeat && e.repeat !== 'none' ? REPEATS[e.repeat] : fmtDate(e.date)) + (e.location ? `, ${e.location}` : '') : `Due ${fmtDate(e.date)}`}, ${className(e.classId)}`, href: '#/calendar', eventId: e.id }));
  S().cards.forEach((c) => (hit(c.front) || hit(c.back)) && out.push({ icon: 'cards', label: c.front, sub: c.back, cardId: c.id }));
  LC.all().forEach((p) => (hit(`${p.num}. ${p.title}`) || hit(p.pattern)) && out.push({ icon: 'leetcode', label: `${p.num}. ${p.title}`, sub: `LeetCode · ${p.difficulty} · ${p.pattern}`, href: `#/leetcode/${p.num}` }));
  S().todo.forEach((t) => hit(t.title) && out.push({ icon: 'list', label: t.title, sub: `To-do${t.parent ? ' in ' + todoPath(t) : ''}${t.done ? ', done' : ''}`, href: `#/todo?item=${t.id}` }));
  S().tasks.forEach((t) => hit(t.title) && out.push({ icon: 'check', label: t.title, sub: `Task for ${fmtDate(t.date)}`, href: `#/tasks?date=${t.date}` }));
  return out.slice(0, 30);
}

function setupSearch() {
  const input = $('#search');
  const box = $('#search-results');
  let items = [];
  let idx = -1;
  const close = () => {
    box.hidden = true;
    idx = -1;
  };
  const choose = (it) => {
    close();
    input.value = '';
    input.blur();
    if (it.cardId) return cardEditModal(it.cardId);
    if (it.eventId) {
      const e = S().events.find((x) => x.id === it.eventId);
      CalUI.month = e.date.slice(0, 7);
      CalUI.selected = e.date;
    }
    if (location.hash === it.href) App.refresh();
    else location.hash = it.href;
  };
  const draw = () => {
    box.innerHTML = items.length
      ? items.map((it, i) => `<button class="sr ${i === idx ? 'active' : ''}" data-i="${i}" role="option" aria-selected="${i === idx}"><span class="sr-icon">${icon(it.icon, 16)}</span><span class="sr-text"><b>${esc(it.label)}</b><small>${esc(it.sub)}</small></span></button>`).join('')
      : '<div class="sr-empty">Nothing matches</div>';
    box.hidden = false;
  };
  input.addEventListener('input', () => {
    items = globalSearch(input.value);
    idx = items.length ? 0 : -1;
    if (input.value.trim().length < 2) return close();
    draw();
  });
  input.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'ArrowDown') idx = Math.min(items.length - 1, idx + 1);
    else if (e.key === 'ArrowUp') idx = Math.max(0, idx - 1);
    else if (e.key === 'Enter' && items[idx]) return choose(items[idx]);
    else if (e.key === 'Escape') return close();
    else return;
    e.preventDefault();
    draw();
  });
  box.addEventListener('mousedown', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) {
      e.preventDefault();
      choose(items[+b.dataset.i]);
    }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));

  document.addEventListener('keydown', (e) => {
    const inField = e.target.matches('input, textarea, select, [contenteditable]');
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !inField)) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}

/* ---------------- boot ---------------- */
function boot() {
  Store.load();
  applyTheme();
  setupSearch();

  $('#theme-toggle').addEventListener('click', () => {
    const cur = S().settings.theme;
    const dark = cur === 'dark' || (cur === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    S().settings.theme = dark ? 'light' : 'dark';
    Store.save();
    applyTheme();
    if (['settings', 'graph', 'connections'].includes(App.current.name)) App.refresh();
  });
  $('#nav-toggle').addEventListener('click', () => setNavOpen(!document.body.classList.contains('nav-open')));
  $('#scrim').addEventListener('click', () => setNavOpen(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && document.body.classList.contains('nav-open') && setNavOpen(false));
  $('#quick-note').addEventListener('click', () => (location.hash = `#/notes/${createNote().id}`));
  $$('[data-icon]').forEach((n) => (n.innerHTML = icon(n.dataset.icon, +(n.dataset.size || 18)) + n.innerHTML));

  // sync if the app is open in two tabs
  window.addEventListener('storage', (e) => {
    if (e.key !== STORE_KEY || !e.newValue) return;
    try {
      Store.state = migrate(JSON.parse(e.newValue));
      if (App.current.name !== 'notes') App.refresh();
    } catch (_) {}
  });

  window.addEventListener('hashchange', () => App.route());
  App.route();

  // reminders + focus timer live outside any one view
  $('#bell')?.addEventListener('click', () => Notify.toggle());
  if (typeof Focus !== 'undefined') Focus.start();
  if (typeof Notify !== 'undefined') Notify.start();
}

document.addEventListener('DOMContentLoaded', boot);
