/* ==========================================================================
   views-exams.js — exam countdowns, readiness, and day-by-day study plans
   ========================================================================== */

function examCountdownText(e, now=new Date()) {
  if(e.done)return 'Completed';
  if(!e.date)return 'Date not set';
  if(!e.time){const current=ymd(now);const days=daysBetween(current,e.date);return days<0?'Date passed':days===0?'Exam today':`${days} ${days===1?'day':'days'} to go`;}
  const target=new Date(`${e.date}T${e.time}`);const seconds=Math.ceil((target-now)/1000);
  if(!Number.isFinite(seconds))return 'Check exam date';
  if(seconds<=0)return 'Start time passed';
  const d=Math.floor(seconds/86400),h=Math.floor(seconds%86400/3600),m=Math.floor(seconds%3600/60),sec=seconds%60;
  return `${d?d+'d ':''}${h}h ${m}m ${sec}s to go`;
}
function examCountdown(e) {
  return `<span class="exam-live-countdown" data-exam-countdown="${esc(e.id)}" role="timer" aria-label="Countdown to ${esc(e.title)}">${examCountdownText(e)}</span>`;
}
function examCountdownPanel(classId='',limit=Infinity) {
  const exams=deadlines().filter(e=>e.type==='exam'&&!e.done&&e.date>=todayStr()&&(!classId||e.classId===classId)).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  if(!exams.length)return '';
  return `<section class="panel exam-countdown-panel"><header class="panel-head"><h2>Midterms & finals</h2><a class="quiet-link" href="#/exams">All exams & study plans →</a></header><div class="exam-countdown-grid">${exams.slice(0,limit).map(e=>`<article><p class="small muted">${mark(e.classId)}${esc(className(e.classId))}</p><h3>${esc(e.title)}</h3>${examCountdown(e)}<p class="small muted">${fmtDate(e.date,{month:'short',day:'numeric',year:'numeric'})}${e.time?' · '+fmtTime(e.time):' · Time not set'}</p><button class="btn sm ghost" data-countdown-edit="${e.id}">Edit date & time</button></article>`).join('')}</div></section>`;
}
function startExamCountdowns(root) {
  root.addEventListener('click',event=>{const button=event.target.closest('[data-countdown-edit]');if(button)editEventModal(button.dataset.countdownEdit);});
  const tick=()=>{for(const el of root.querySelectorAll('[data-exam-countdown]')){const e=S().events.find(e=>e.id===el.dataset.examCountdown);if(e&&el.firstChild)el.firstChild.nodeValue=examCountdownText(e);}};
  tick();return root.querySelector('[data-exam-countdown]')?setInterval(tick,1000):null;
}

const ExamUI = { editing: '' };

function inDays(date) {
  const n = daysBetween(todayStr(), date);
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
}

function examTopics(e) {
  const ids = e.topicIds?.length ? e.topicIds : topicsOf(e.classId).map((t) => t.id);
  return ids.map(getTopic).filter(Boolean);
}

function readiness(e) {
  const ts = examTopics(e);
  if (!ts.length) return 0;
  return Math.round((ts.reduce((a, t) => a + t.mastery, 0) / (ts.length * 3)) * 100);
}

/** Spread topics over the days before the exam (weakest first), then review days. */
function makePlan(e) {
  const today = todayStr();
  const last = addDays(e.date, -1);
  const first = today > addDays(e.date, -21) ? today : addDays(e.date, -21);
  const days = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  if (!days.length) return [];
  const cls = getClass(e.classId)?.short || className(e.classId);
  const topics = examTopics(e).slice().sort((a, b) => a.mastery - b.mastery);
  const learn = days.slice(0, Math.max(1, Math.ceil(days.length * 0.7)));
  const review = days.slice(learn.length);
  const items = [];
  // a topic can't be studied before the lecture that teaches it
  const taught = (t) => S().notes
    .filter((n) => n.lecture?.date && extractWikilinks(n.body).some((w) => w.toLowerCase() === t.name.toLowerCase()))
    .map((n) => n.lecture.date).sort()[0];
  topics.forEach((t, i) => {
    let d = learn[Math.floor((i * learn.length) / Math.max(1, topics.length))];
    const from = taught(t);
    if (from && from > d) d = from > last ? last : from;
    items.push({ date: d, text: `Study ${t.name}: reread the lecture notes, then make or review cards`, topicId: t.id });
  });
  learn.forEach((d, i) => {
    if (i % 2 === 1) items.push({ date: d, text: `Review due ${cls} flashcards` });
  });
  review.forEach((d, i) => {
    items.push({ date: d, text: i === review.length - 1 ? 'Practice exam with ChatGPT, then fix the weak spots it finds' : 'Mixed review: weakest topics first, then all flashcards' });
  });
  if (!review.length) items.push({ date: last, text: 'Practice exam with ChatGPT, then fix the weak spots it finds' });
  return items.sort((a, b) => a.date.localeCompare(b.date)).map((x) => ({ id: uid(), done: false, ...x }));
}

Views.exams = {
  title: 'Exams',
  render() {
    const today = todayStr();
    const all = deadlines().filter((e) => e.type === 'exam').sort((a, b) => a.date.localeCompare(b.date));
    const upcoming = all.filter((e) => !e.done && e.date >= today);
    const past = all.filter((e) => e.done || e.date < today);

    return `
    <header class="page-head">
      <div><h1>Exams</h1><p class="lede">${upcoming.length ? `Next up: <strong>${esc(upcoming[0].title)}</strong> for ${esc(className(upcoming[0].classId))}, ${inDays(upcoming[0].date)}.` : 'No exams coming up.'} Each exam gets a study plan built from its topics, weakest first.</p></div>
      <div class="head-actions"><button class="btn" data-act="add-exam">${icon('plus', 16)}Add exam</button></div>
    </header>

    <div class="exam-list">
      ${upcoming.map((e) => this.card(e)).join('') || emptyState('exam', 'No upcoming exams', 'Add one and pick its topics to get a study plan.', '<button class="btn primary" data-act="add-exam">Add exam</button>')}
    </div>

    ${past.length ? `
      <section class="panel">
        <header class="panel-head"><h2>Past exams</h2></header>
        <ul class="rows compact">${past.map((e) => `<li class="row"><span class="row-main static"><span class="row-title">${mark(e.classId)}${esc(e.title)}</span><span class="row-meta">${fmtDate(e.date, { month: 'short', day: 'numeric', year: 'numeric' })}</span></span><a class="quiet-link" href="#/grades?class=${e.classId}">Enter score</a></li>`).join('')}</ul>
      </section>` : ''}`;
  },

  card(e) {
    const today = todayStr();
    const days = daysBetween(today, e.date);
    const ready = readiness(e);
    const topics = examTopics(e);
    const plan = e.plan?.items || [];
    const done = plan.filter((x) => x.done).length;
    const due = S().cards.filter((c) => c.due <= today && topics.some((t) => t.id === c.topicId)).length;
    const byDate = plan.reduce((m, x) => ((m[x.date] ||= []).push(x), m), {});
    const editing = ExamUI.editing === e.id;

    return `
    <article class="panel exam-card" data-exam="${e.id}">
      <div class="exam-head">
        <div class="countdown ${days <= 3 ? 'urgent' : ''}">
          ${examCountdown(e)}
        </div>
        <div class="exam-title">
          <p class="kind">${mark(e.classId)}${esc(className(e.classId))}</p>
          <h2>${esc(e.title)}</h2>
          <p class="muted small">${fmtDate(e.date, { weekday: 'long', month: 'long', day: 'numeric' })}${e.time ? `, ${fmtTime(e.time)}` : ''}${e.notes ? ` · ${esc(e.notes.split('\n')[0])}` : ''}</p>
        </div>
        <div class="readiness">
          <span class="num">${ready}%</span><small>ready</small>
          ${progressBar(ready)}
        </div>
      </div>

      <div class="exam-body">
        <div>
          <h3 class="sub">Topics ${e.topicIds?.length ? '' : '<span class="muted">(whole class)</span>'}</h3>
          ${editing ? `
            <div class="check-list">${topicsOf(e.classId).map((t) => `<label class="check"><input type="checkbox" data-topic-pick="${t.id}" ${e.topicIds?.includes(t.id) ? 'checked' : ''}> ${esc(t.name)}</label>`).join('')}</div>
            <div class="btn-row"><button class="btn sm primary" data-act="topics-done">Done</button></div>
          ` : `
            <ul class="rows compact">${topics.map((t) => `<li class="row"><a class="row-main" href="#/tree/${t.classId}?topic=${t.id}"><span class="row-title">${esc(t.name)}</span></a>${masteryPips(t.mastery)}</li>`).join('')}</ul>
            <div class="btn-row">
              <button class="btn sm ghost" data-act="topics">Choose topics</button>
              <a class="btn sm" href="#/cards?class=${e.classId}">Review cards${due ? ` (${due} due)` : ''}</a>
              <a class="btn sm" href="#/practice?tab=prompt&class=${e.classId}&exam=${e.id}">Make a practice test ${icon('exam', 13)}</a>
            </div>`}
        </div>

        <div>
          <h3 class="sub">Study plan ${plan.length ? `<span class="muted">${done} of ${plan.length} done</span>` : ''}</h3>
          ${plan.length ? `
            <ol class="plan">
              ${Object.entries(byDate).map(([d, items]) => `
                <li class="plan-day ${d < today ? 'past' : d === today ? 'today' : ''}">
                  <span class="plan-date">${d === today ? 'Today' : fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <ul>${items.map((x) => `<li><label class="check ${x.done ? 'done' : ''}"><input type="checkbox" data-plan="${x.id}" ${x.done ? 'checked' : ''}> <span>${esc(x.text)}</span></label></li>`).join('')}</ul>
                </li>`).join('')}
            </ol>
            <div class="btn-row">
              <button class="btn sm primary" data-act="to-tasks">Add today’s plan to Tasks</button>
              <button class="btn sm ghost" data-act="plan">Rebuild plan</button>
            </div>`
          : `<p class="hint">A day-by-day plan for the ${Math.min(days, 21)} days before the exam: new topics first, weakest first, then mixed review and a practice exam.</p>
             <button class="btn primary" data-act="plan">Make my study plan</button>`}
        </div>
      </div>
    </article>`;
  },

  mount(el) {
    const find = (node) => S().events.find((x) => x.id === node.closest('[data-exam]')?.dataset.exam);
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'add-exam') return editEventModal(null, { type: 'exam' });
      const e = find(b);
      if (!e) return;
      if (act === 'plan') {
        if (e.plan?.items?.some((x) => x.done) && !confirm('Rebuild the plan? Checked items will be cleared.')) return;
        e.plan = { made: todayStr(), items: makePlan(e) };
        toast(e.plan.items.length ? 'Study plan ready' : 'The exam is today or already past', e.plan.items.length ? 'ok' : 'warn');
      }
      if (act === 'topics') ExamUI.editing = e.id;
      if (act === 'topics-done') ExamUI.editing = '';
      if (act === 'to-tasks') {
        const today = todayStr();
        const items = (e.plan?.items || []).filter((x) => x.date <= today && !x.done);
        let n = 0;
        for (const x of items) {
          const title = `${getClass(e.classId)?.short || ''} ${e.title}: ${x.text}`.trim();
          if (S().tasks.some((t) => t.title === title && t.date === today)) continue;
          S().tasks.push({ id: uid(), title, date: today, done: false, category: 'School', priority: 'high', classId:e.classId });
          n++;
        }
        toast(n ? `Added ${plural(n, 'task')} for today` : 'Today’s plan is already in Tasks', 'ok');
      }
      Store.save();
      App.refresh();
    });
    el.addEventListener('change', (ev) => {
      const x = ev.target;
      const e = find(x);
      if (!e) return;
      if (x.dataset.plan) {
        const item = e.plan.items.find((i) => i.id === x.dataset.plan);
        item.done = x.checked;
      }
      if (x.dataset.topicPick) {
        e.topicIds ||= [];
        e.topicIds = x.checked ? [...new Set([...e.topicIds, x.dataset.topicPick])] : e.topicIds.filter((t) => t !== x.dataset.topicPick);
      }
      Store.save();
      if (x.dataset.plan) App.refresh();
    });
  },
};
