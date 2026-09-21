/* ==========================================================================
   app.js — navigation model, route parsing, global search and theme.
   The React shell in src/main.jsx does the rendering: it supplies
   App.refresh / App.renderNav, sets App.current and App.viewEl, and calls
   StudyHub.boot(). Everything here is shared with the classic view files.
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

if (typeof window !== 'undefined') window.StudyHub = {
 Store, S, App, Views, NAV, Focus, Notify, globalSearch, watchDefinitions, startExamCountdowns,
 taskHubItems, taskHubFilter, todayStr, fmtDate, relDay, className, getClass, getNote, editPersonalTask, editEventModal, setTodoDone,
 createNote, dueCards, applyTheme, classModal, examCountdownPanel, cardEditModal, occurrences, isScheduled, fmtTime,
 downloadRecovery(){const raw=localStorage.getItem(STORE_KEY);if(!raw)return;const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='studyhub-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
 newNote(){NotesUI.mode='write'; location.hash=`#/notes/${createNote().id}`;},
 setModalRenderer(open,close){openModal=open;closeModal=close;},
 boot(){
  Store.load();applyTheme();
  window.addEventListener('pagehide',()=>Store.save());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')Store.save();});
  // Typing in another tab saves every few hundred ms, and each storage event costs
  // a ~900KB parse plus a migrate. Keep only the newest payload and adopt it once
  // the burst stops: intermediate states are superseded anyway, and this way the
  // store and the UI move together instead of the UI trailing the data.
  let pending=null;
  const adopt=debounce(()=>{
   const raw=pending;pending=null;
   try{Store.state=migrate(JSON.parse(raw));Store.recoveryRequired=false;Store._lastSaved=raw;App.refresh();}catch(_){}
  },150);
  window.addEventListener('storage',e=>{if(e.key===STORE_KEY&&e.newValue){pending=e.newValue;adopt();}});
 },
};
