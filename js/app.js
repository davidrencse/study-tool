/* ==========================================================================
   app.js — router, shell (sidebar, search, theme), boot
   ========================================================================== */

const NAV = [
  { group: 'Plan', id: 'dashboard', label: 'Today', icon: 'today', views: ['dashboard'] },
  { group: 'Plan', id: 'tasks', label: 'Tasks', icon: 'check', views: ['tasks', 'daily', 'todo'], tabs: [['#/tasks', 'All tasks', 'tasks'], ['#/daily', 'Daily routine', 'daily'], ['#/todo', 'Lists', 'todo']], badge: () => taskHubItems().filter(t => !t.done && t.date && t.date < todayStr()).length, badgeLabel: 'overdue' },
  { group: 'Plan', id: 'calendar', label: 'Calendar', icon: 'planner', views: ['calendar', 'schedule', 'exams'], tabs: [['#/calendar', 'Calendar', 'calendar'], ['#/schedule', 'Day plan', 'schedule'], ['#/exams', 'Exams', 'exams']] },
  { group: 'Plan', id: 'focus', label: 'Focus', icon: 'timer', views: ['focus'] },
  { group: 'Classes', id: 'classes', label: 'All classes', icon: 'classes', views: ['classes', 'grades'], tabs: [['#/classes', 'Classes', 'classes'], ['#/grades', 'Grades', 'grades']] },
  { group: 'Materials', id: 'notes', label: 'Notes & slides', icon: 'notes', views: ['notes', 'code', 'import'], tabs: [['#/notes', 'Notes & slides', 'notes'], ['#/code', 'Code', 'code'], ['#/import', 'Add material', 'import']] },
  { group: 'Materials', id: 'cards', label: 'Flashcards', icon: 'cards', views: ['cards'], badge: () => dueCards().length },
  { group: 'Materials', id: 'practice', label: 'Practice exams', icon: 'exam', views: ['practice'] },
  { group: 'Tools', id: 'assist', label: 'AI tools', icon: 'ai', views: ['assist', 'summary'], tabs: [['#/assist', 'Ask ChatGPT', 'assist'], ['#/summary', 'Summarize', 'summary']] },
  { group: 'Tools', id: 'leetcode', label: 'LeetCode', icon: 'leetcode', views: ['leetcode', 'lcpractice'], tabs: [['#/leetcode', 'Problems', 'leetcode'], ['#/lcpractice', 'Practice', 'lcpractice']] },
  { group: 'Tools', id: 'graph', label: 'Knowledge map', icon: 'map', views: ['graph', 'tree', 'connections'], tabs: [['#/graph', 'Graph', 'graph'], ['#/tree', 'Skill tree', 'tree'], ['#/connections', 'Connections', 'connections']] },
];
const navFor = (view) => NAV.find((n) => n.views.includes(view));

function workspaceBreadcrumb(name,params=[],query={}) {
  const c=getClass(name==='classes'?params[0]:query.class||(name==='notes'?getNote(params[0]||Views.notes._current)?.classId:''));
  const current=(label)=>`<span aria-current="page">${esc(label)}</span>`;
  if(c){const tab=['materials','tasks','info'].includes(query.tab)?query.tab:'overview';const labels={overview:'Overview',materials:'Materials',tasks:'Tasks & deadlines',info:'Class info'};return `<a href="#/classes">Classes</a><a href="#/classes/${c.id}">${esc(c.name)}</a>${current(name==='classes'?labels[tab]:Views[name]?.title||name)}`;}
  const group=navFor(name)?.group;
  return `${group?`<span>${esc(group)}</span>`:''}${current(name==='dashboard'?'Today':Views[name]?.title||name)}`;
}

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
    const [name, ...params] = path.split('/').map((part) => {
      try { return decodeURIComponent(part); }
      catch (_) { return part; }
    });
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
    this.definitionObserver?.disconnect();
    clearInterval(this.examCountdownTimer);
    const { name, params, query } = this.current;
    const v = Views[name];
    const group = navFor(name);
    const el = document.createElement('div');
    el.className = `view view-${name}`;
    el.innerHTML = '<nav id="workspace-page" class="page-breadcrumbs" aria-label="Breadcrumb"></nav>' + (group?.tabs && !(name==='classes'&&params[0]) ? subTabs(group.tabs, name) : '') + v.render(params, query);
    $('#view').replaceChildren(el);
    this.viewEl = el;
    document.title = `${v.title} · Study Hub`;
    $('#workspace-page').innerHTML=workspaceBreadcrumb(name,params,query);
    $('.create-menu').open=false;
    v.mount?.(el, params, query);
    this.definitionObserver=watchDefinitions(el);
    this.examCountdownTimer=startExamCountdowns(el);
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
    const cur=this.current;
    const selectedClass=cur?.name==='classes'?cur.params[0]:cur?.query.class||(cur?.name==='notes'?getNote(cur.params[0]||Views.notes._current)?.classId:'');
    const classTree=S().classes.map(c=>{
      const selected=selectedClass===c.id;
      const tab=cur?.query.tab||'overview';
      return `<details class="class-nav-branch" ${selected?'open':''}><summary title="${esc(c.name)}">${mark(c.id)}<span>${esc(c.name)}</span></summary><div class="class-nav-children">${[['overview','Overview'],['materials','Materials'],['tasks','Tasks & deadlines'],['info','Class info']].map(([key,label])=>`<a href="#/classes/${c.id}?tab=${key}" ${cur?.name==='classes'&&selected&&tab===key?'aria-current="page"':''}>${label}</a>`).join('')}</div></details>`;
    }).join('');
    $('#nav').innerHTML=['Plan','Classes','Materials','Tools'].map(group=>{
      const links=NAV.filter(n=>n.group===group).map(item).join('');
      if(group==='Tools')return `<details class="nav-explore" ${navFor(cur?.name)?.group==='Tools'?'open':''}><summary>Tools</summary>${links}</details>`;
      return `<div class="nav-heading">${group}</div>${links}${group==='Classes'?`<nav id="nav-classes" aria-label="Class pages">${classTree}</nav>`:''}`;
    }).join('');
    $('#nav-foot').innerHTML=item({id:'settings',label:'Settings',icon:'settings'});

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
  const state=S();
  let index=globalSearch._index;
  if(!index || index.state!==state) {
    const entries=[];
    const add=(texts,result)=>entries.push({texts:texts.map(t=>(t||'').toLowerCase()),result});
    state.classes.forEach(c=>add([c.name],()=>({icon:'classes',label:c.name,sub:'Class',href:`#/classes/${c.id}`})));
    state.topics.forEach(t=>add([t.name,t.desc],()=>({icon:'map',label:t.name,sub:`Topic in ${className(t.classId)}`,href:`#/tree/${t.classId}?topic=${t.id}`})));
    state.notes.forEach(n=>{
      const body=(n.body||'').toLowerCase();
      entries.push({texts:[(n.title||'').toLowerCase(),body],result:query=>{
        const i=body.indexOf(query);
        return {icon:n.source?'slides':'notes',label:n.title,sub:i>=0?'…'+n.body.slice(Math.max(0,i-30),i+50).replace(/\s+/g,' ')+'…':'Note',href:`#/notes/${n.id}`};
      }});
    });
    state.events.forEach(e=>add([e.title,e.location],()=>({icon:'planner',label:e.title,sub:`${isScheduled(e)?(e.repeat&&e.repeat!=='none'?REPEATS[e.repeat]:fmtDate(e.date))+(e.location?`, ${e.location}`:''):`Due ${fmtDate(e.date)}`}, ${className(e.classId)}`,href:'#/calendar',eventId:e.id})));
    state.cards.forEach(c=>add([c.front,c.back],()=>({icon:'cards',label:c.front,sub:c.back,cardId:c.id})));
    LC.all().forEach(p=>add([`${p.num}. ${p.title}`,p.pattern],()=>({icon:'leetcode',label:`${p.num}. ${p.title}`,sub:`LeetCode · ${p.difficulty} · ${p.pattern}`,href:`#/leetcode/${p.num}`})));
    state.todo.forEach(t=>add([t.title],()=>({icon:'list',label:t.title,sub:`To-do${t.parent?' in '+todoPath(t):''}${t.done?', done':''}`,href:`#/todo?item=${t.id}`})));
    state.tasks.forEach(t=>add([t.title],()=>({icon:'check',label:t.title,sub:`Task for ${fmtDate(t.date)}`,href:`#/tasks?date=${t.date}`})));
    index=globalSearch._index={state,entries};
  }
  const results=[];
  for(const entry of index.entries) {
    if(entry.texts.some(text=>text.includes(q)))results.push(entry.result(q));
    if(results.length===30)break;
  }
  return results;
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
  // Flush pending edits before a reload or when the tab moves into the background.
  window.addEventListener('pagehide', () => Store.save());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') Store.save();
  });
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
  $('#quick-note').addEventListener('click', () => {NotesUI.mode='write';location.hash = `#/notes/${createNote().id}`;});
  $('.create-menu-items').addEventListener('click',()=>$('.create-menu').open=false);
  document.addEventListener('click',e=>{if(!e.target.closest('.create-menu'))$('.create-menu').open=false;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$('.create-menu').open=false;});
  $('#quick-task').addEventListener('click', () => editPersonalTask());
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

document.addEventListener('DOMContentLoaded', () => { if (!document.getElementById('root')) boot(); });

if (typeof window !== 'undefined') window.StudyHub = {
 Store, S, App, Views, NAV, Focus, Notify, globalSearch, workspaceBreadcrumb, watchDefinitions, startExamCountdowns,
 taskHubItems, taskHubFilter, todayStr, fmtDate, relDay, className, getClass, getNote, editPersonalTask, editEventModal, setTodoDone,
 createNote, dueCards, applyTheme, classModal, examCountdownPanel, cardEditModal, occurrences, isScheduled, fmtTime,
 downloadRecovery(){const raw=localStorage.getItem(STORE_KEY);if(!raw)return;const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='studyhub-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
 newNote(){NotesUI.mode='write'; location.hash=`#/notes/${createNote().id}`;},
 setModalRenderer(open,close){openModal=open;closeModal=close;},
 boot(){Store.load();applyTheme();window.addEventListener('pagehide',()=>Store.save());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')Store.save();});window.addEventListener('storage',e=>{if(e.key===STORE_KEY&&e.newValue){try{Store.state=migrate(JSON.parse(e.newValue));Store.recoveryRequired=false;Store._lastSaved=e.newValue;App.refresh();}catch(_){}}});},
};
