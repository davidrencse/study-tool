/* Tasks combines existing coursework, daily tasks and actionable list items.
 * The records remain in their original stores so calendar and list edits agree.
 */
Views.daily = Views.tasks;
Views.daily.title = 'Daily routine';

function taskHubItems() {
  const s = S();
  const parents = new Set(s.todo.map(t => t.parent).filter(Boolean));
  return [
    ...deadlines().map(e => ({ kind: 'coursework', id: e.id, title: e.title, date: e.date, done: !!e.done, classId: e.classId || '', priority: 'med', detail: EVENT_TYPES[e.type]?.label || 'Deadline', record: e })),
    ...s.tasks.map(t => ({ kind: 'personal', id: t.id, title: t.title, date: t.date, done: !!t.done, classId: t.classId || '', priority: t.priority || 'med', detail: t.category || 'Personal', record: t })),
    ...s.todo.filter(t => !parents.has(t.id)).map(t => ({ kind: 'lists', id: t.id, title: t.title, date: t.due || '', done: !!t.done, classId: '', priority: t.priority || 'med', detail: todoAncestors(t).map(a => a.title).reverse().join(' / ') || 'List item', record: t })),
  ];
}

function taskHubFilter(items, query = {}) {
  const today = todayStr();
  const q = (query.q || '').trim().toLowerCase();
  const status = ['all','done'].includes(query.status) ? query.status : 'open';
  return items.filter(t => {
    if (status === 'open' && t.done || status === 'done' && !t.done) return false;
    if (query.source && query.source !== 'all' && t.kind !== query.source) return false;
    if (query.class && t.classId !== query.class) return false;
    if (q && !`${t.title} ${t.detail} ${className(t.classId)}`.toLowerCase().includes(q)) return false;
    if (query.when === 'overdue' && (!t.date || t.date >= today || t.done)) return false;
    if (query.when === 'today' && t.date !== today) return false;
    if (query.when === 'week' && (!t.date || t.date < today || t.date > addDays(today,7))) return false;
    if (query.date && t.date !== query.date) return false;
    return true;
  }).sort((a,b) => Number(a.done)-Number(b.done) || (a.date || '9999').localeCompare(b.date || '9999') ||
    ({high:0,med:1,low:2}[a.priority] ?? 1)-({high:0,med:1,low:2}[b.priority] ?? 1) || a.title.localeCompare(b.title));
}

function editPersonalTask(id, defaults={}) {
  const existing = id && S().tasks.find(t => t.id === id);
  const task = existing || { title:'', date:todayStr(), category:'Personal', priority:'med',classId:defaults.classId||'' };
  openModal(existing ? 'Edit task' : 'New task', `<form class="form" id="hub-task-form">
    <label>Task<input name="title" value="${esc(task.title)}" placeholder="What needs doing?" required></label>
    <div class="form-row"><label>Date<input type="date" name="date" value="${esc(task.date)}" required></label>
    <label>Category<select name="category">${TASK_CATEGORIES.map(c=>`<option ${c===task.category?'selected':''}>${esc(c)}</option>`).join('')}</select></label></div>
    <label>Class<select name="classId">${classOptions(task.classId||'',{includeNone:true,noneLabel:'No class'})}</select></label>
    <label>Priority<select name="priority">${[['high','High'],['med','Normal'],['low','Low']].map(([v,label])=>`<option value="${v}" ${v===task.priority?'selected':''}>${label}</option>`).join('')}</select></label>
    <div class="form-actions">${existing ? '<button class="btn ghost danger" type="button" data-delete-task>Delete task</button>':''}<span class="spacer"></span><button class="btn" type="button" data-close>Cancel</button><button class="btn primary">Save task</button></div>
  </form>`, { onMount(modal) {
    $('#hub-task-form',modal).addEventListener('submit',e=>{
      e.preventDefault();const f=new FormData(e.target);const title=f.get('title').trim();if(!title)return;
      const changes={title,classId:f.get('classId'),date:f.get('date'),category:f.get('category'),priority:f.get('priority')};
      if(existing)Object.assign(existing,changes);else S().tasks.push({id:uid(),done:false,...changes});
      Store.save();closeModal();App.refresh();
    });
    $('[data-delete-task]',modal)?.addEventListener('click',()=>{
      if(!confirm(`Delete “${existing.title}”?`))return;
      S().tasks=S().tasks.filter(t=>t.id!==existing.id);Store.save();closeModal();App.refresh();
    });
  }});
}

function taskHubRow(t) {
  const overdue = !t.done && t.date && t.date < todayStr();
  return `<li class="row hub-task-row ${t.done?'done':''}">
    <input type="checkbox" data-hub-check="${esc(t.id)}" data-kind="${t.kind}" ${t.done?'checked':''} aria-label="Complete ${esc(t.title)}">
    <button class="row-main" data-hub-open="${esc(t.id)}" data-kind="${t.kind}">
      <span class="row-title">${esc(t.title)}</span>
      <span class="row-meta">${t.classId?`${mark(t.classId)}${esc(className(t.classId))} · `:''}${esc(t.detail)}${t.priority==='high'?' · High priority':''}${t.record.sourceType==='brightspace-email'?' · Email confirmed':''}</span>
    </button>
    <span class="hub-due ${overdue?'overdue':''}">${t.date ? `${relDay(t.date)}${t.record.time?`<small>${fmtTime(t.record.time)}</small>`:''}`:'No due date'}</span>
  </li>`;
}

Views.tasks = {
  title:'Tasks',
  render(_,query={}) {
    const all=taskHubItems();const open=all.filter(t=>!t.done);const shown=taskHubFilter(all,query);const today=todayStr();
    const sections=[['coursework','Coursework','Assignments, quizzes, exams and readings.',''],['personal','Everyday tasks','School work, errands and personal tasks.',''],['lists','From your lists','Actionable items from your nested lists.','#/todo']];
    const select=(name,options,value)=>`<select name="${name}" aria-label="${name==='source'?'Task source':name==='status'?'Completion status':'Due date filter'}">${options.map(([v,label])=>`<option value="${v}" ${v===value?'selected':''}>${label}</option>`).join('')}</select>`;
    const overdue=open.filter(t=>t.date&&t.date<today).length;
    return `<header class="page-head"><div><h1>Tasks</h1><p class="lede">Coursework and everyday to-dos, organized in one place.</p></div>
      <div class="head-actions"><button class="btn" data-hub-add="deadline">${icon('planner',16)}Add coursework</button><button class="btn primary" data-hub-add="task">${icon('plus',16)}New task</button></div></header>
      <div class="task-overview">
        <a href="#/tasks?when=overdue"><span>Overdue</span><strong>${overdue}</strong><small>Needs attention</small></a>
        <a href="#/tasks?when=today"><span>Due today</span><strong>${open.filter(t=>t.date===today).length}</strong><small>${fmtDate(today)}</small></a>
        <a href="#/tasks?when=week"><span>Next 7 days</span><strong>${open.filter(t=>t.date>=today&&t.date<=addDays(today,7)).length}</strong><small>Plan ahead</small></a>
        <a href="#/daily"><span>Daily routine</span><strong>${(S().routineDone[today]||[]).length}/${S().routines.length}</strong><small>Open today's checklist →</small></a>
      </div>
      <form class="task-hub-filters" id="task-hub-filter"><input name="q" type="search" value="${esc(query.q||'')}" placeholder="Search tasks or coursework" aria-label="Search tasks">
        ${select('source',[['all','All sources'],['coursework','Coursework'],['personal','Everyday tasks'],['lists','Lists']],query.source||'all')}
        ${select('status',[['open','Open'],['done','Completed'],['all','Open and completed']],query.status||'open')}
        ${select('when',[['all','Any date'],['overdue','Overdue'],['today','Today'],['week','Next 7 days']],query.when||'all')}
        <select name="class" aria-label="Filter by class">${classOptions(query.class||'',{includeNone:true,noneLabel:'All classes'})}</select>
        <button class="btn" type="submit">Search</button>${Object.keys(query).length?'<a class="btn ghost" href="#/tasks">Clear filters</a>':''}
      </form>
      ${query.date?`<p class="muted small">Showing tasks for ${fmtDate(query.date)}. <a href="#/tasks">Show all dates</a></p>`:''}
      <div class="task-hub-sections">${sections.filter(([kind])=>!query.source||query.source==='all'||query.source===kind).map(([kind,label,desc,href])=>{
        const items=shown.filter(t=>t.kind===kind);const limited=!query.q&&(!query.source||query.source==='all');const visible=limited?items.slice(0,8):items;
        return `<section class="panel task-hub-section"><header class="panel-head"><div><h2>${label} <span class="badge">${items.length}</span></h2><p class="muted small">${desc}</p></div>${href?`<a class="quiet-link" href="${href}">Manage lists →</a>`:''}</header>
          <ul class="rows">${visible.map(taskHubRow).join('')||'<li class="rows-empty">No tasks match these filters.</li>'}</ul>
          ${limited&&items.length>8?`<a class="btn sm ghost" href="#/tasks?source=${kind}&status=${esc(query.status||'open')}">View all ${items.length} ${kind==='lists'?'list items':'tasks'}</a>`:''}</section>`;
      }).join('')}</div>`;
  },
  mount(el) {
    const filter=$('#task-hub-filter',el);
    const apply=()=>{const params=new URLSearchParams(new FormData(filter));if(App.current.query.date)params.set('date',App.current.query.date);location.hash='#/tasks?'+params.toString();};
    filter.addEventListener('submit',e=>{e.preventDefault();apply();});
    filter.addEventListener('change',e=>{if(e.target.tagName==='SELECT')apply();});
    el.addEventListener('click',e=>{
      const add=e.target.closest('[data-hub-add]');if(add)return add.dataset.hubAdd==='task'?editPersonalTask():editEventModal(null,{kind:'deadline'});
      const button=e.target.closest('[data-hub-open]');if(!button)return;
      if(button.dataset.kind==='coursework')editEventModal(button.dataset.hubOpen);
      else if(button.dataset.kind==='personal')editPersonalTask(button.dataset.hubOpen);
      else location.hash='#/todo?item='+encodeURIComponent(button.dataset.hubOpen);
    });
    el.addEventListener('change',e=>{
      const input=e.target;if(!input.dataset.hubCheck)return;
      const item=taskHubItems().find(t=>t.id===input.dataset.hubCheck&&t.kind===input.dataset.kind);if(!item)return;
      if(item.kind==='lists')setTodoDone(item.record,input.checked);else item.record.done=input.checked;
      Store.save();App.refresh();
    });
  },
};
