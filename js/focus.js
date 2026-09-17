/* ==========================================================================
   focus.js — Pomodoro focus timer + study time log
   The timer keeps running while you move around the app (and survives a
   reload, because it stores when the session ends, not a countdown).
   ========================================================================== */

const MODES = { work: 'Focus', short: 'Short break', long: 'Long break' };

const Focus = {
  start() {
    this.state();
    setInterval(() => this.tick(), 1000);
    this.tick();
  },

  cfg() {
    return S().settings.focus;
  },

  state() {
    const s = S();
    if (!s.timer) s.timer = { mode: 'work', running: false, endsAt: 0, remaining: this.cfg().work * 60, classId: '', label: '', round: 0 };
    return s.timer;
  },

  length(mode) {
    const c = this.cfg();
    return (mode === 'work' ? c.work : mode === 'short' ? c.short : c.long) * 60;
  },

  left() {
    const t = this.state();
    return t.running ? Math.max(0, Math.round((t.endsAt - Date.now()) / 1000)) : t.remaining;
  },

  play() {
    const t = this.state();
    if (t.running) return;
    if (t.remaining <= 0) t.remaining = this.length(t.mode);
    t.running = true;
    t.startedAt = Date.now();
    t.endsAt = Date.now() + t.remaining * 1000;
    Store.save();
    this.paint();
  },

  pause() {
    const t = this.state();
    if (!t.running) return;
    t.remaining = this.left();
    t.running = false;
    Store.save();
    this.paint();
  },

  toggle() {
    this.state().running ? this.pause() : this.play();
  },

  reset() {
    const t = this.state();
    t.running = false;
    t.remaining = this.length(t.mode);
    Store.save();
    this.paint();
  },

  setMode(mode) {
    const t = this.state();
    t.mode = mode;
    this.reset();
  },

  skip() {
    this.complete(false);
  },

  tick() {
    const t = this.state();
    if (t.running && this.left() <= 0) this.complete(true);
    this.paint();
  },

  complete(natural) {
    const t = this.state();
    const s = S();
    const was = t.mode;
    if (was === 'work') {
      const secs = natural ? this.length('work') : this.length('work') - this.left();
      const minutes = Math.round(secs / 60);
      if (minutes >= 1) s.focusLog.push({ id: uid(), date: todayStr(), classId: t.classId, label: t.label, minutes, at: Date.now() });
      if (natural) t.round += 1;
      t.mode = t.round > 0 && t.round % this.cfg().rounds === 0 ? 'long' : 'short';
    } else {
      t.mode = 'work';
    }
    t.remaining = this.length(t.mode);
    t.running = natural && was === 'work' && this.cfg().autoBreak;
    if (t.running) t.endsAt = Date.now() + t.remaining * 1000;
    Store.save();
    if (natural) {
      const n = was === 'work'
        ? { title: 'Focus session done', body: `${t.label ? t.label + '. ' : ''}Take a ${t.mode === 'long' ? 'longer' : 'short'} break.`, kind: 'timer' }
        : { title: 'Break’s over', body: 'Ready for the next focus session?', kind: 'timer' };
      Notify.push({ key: `timer:${Date.now()}`, href: '#/focus', ...n });
    }
    if (App.current?.name === 'focus') App.refresh();
  },

  /* ---------- DOM updates without re-rendering views ---------- */
  paint() {
    const t = this.state();
    const left = this.left();
    const total = this.length(t.mode);
    const active = t.running || left < total;
    const pill = $('#timer-pill');
    if (pill) {
      pill.hidden = !active;
      pill.classList.toggle('paused', !t.running);
      pill.innerHTML = `${icon(t.running ? 'timer' : 'pause', 15)}<span class="num">${mmss(left)}</span><span class="hide-sm">${MODES[t.mode]}</span>`;
      pill.setAttribute('aria-label', `${MODES[t.mode]} timer, ${mmss(left)} left${t.running ? '' : ', paused'}`);
    }
    const time = $('#fx-time');
    if (time) {
      time.textContent = mmss(left);
      const ring = $('#fx-ring');
      if (ring) ring.style.strokeDashoffset = String(RING * (left / total));
      document.title = t.running ? `${mmss(left)} · ${MODES[t.mode]}` : 'Focus · Study Hub';
    }
  },
};

const RING = 2 * Math.PI * 118;
const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

function focusMinutes({ from, to = todayStr(), classId } = {}) {
  return S().focusLog.filter((l) => (!from || l.date >= from) && l.date <= to && (classId === undefined || l.classId === classId)).reduce((a, l) => a + l.minutes, 0);
}
const focusHrs = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`);

Views.focus = {
  title: 'Focus',
  render() {
    const t = Focus.state();
    const c = Focus.cfg();
    const left = Focus.left();
    const total = Focus.length(t.mode);
    const today = todayStr();
    const weekStart = addDays(today, -6);
    const todayLog = S().focusLog.filter((l) => l.date === today).reverse();
    const days = [...Array(7)].map((_, i) => {
      const d = addDays(weekStart, i);
      return { d, m: focusMinutes({ from: d, to: d }) };
    });
    const maxDay = Math.max(30, ...days.map((x) => x.m));
    const byClass = [...S().classes.map((k) => ({ id: k.id, name: k.name, m: focusMinutes({ from: weekStart, classId: k.id }) })), { id: '', name: 'No class', m: focusMinutes({ from: weekStart, classId: '' }) }].filter((x) => x.m);
    const maxClass = Math.max(1, ...byClass.map((x) => x.m));
    const soon = deadlines().filter((e) => !e.done && e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);

    return `
    <header class="page-head">
      <div><h1>Focus</h1><p class="lede">${Math.round(c.work)}-minute sessions with short breaks. The timer keeps going while you use the rest of the app.</p></div>
    </header>
    <div class="grid-2 wide-left">
      <section class="panel focus-panel">
        <div class="seg" role="radiogroup" aria-label="Timer mode">
          ${Object.entries(MODES).map(([k, l]) => `<label><input type="radio" name="fmode" value="${k}" ${t.mode === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </div>
        <div class="dial ${t.running ? 'running' : ''}">
          <svg viewBox="0 0 260 260" aria-hidden="true">
            <circle cx="130" cy="130" r="118" class="dial-track"/>
            <circle id="fx-ring" cx="130" cy="130" r="118" class="dial-fill" style="stroke-dasharray:${RING};stroke-dashoffset:${RING * (left / total)}"/>
          </svg>
          <div class="dial-center">
            <span id="fx-time" class="dial-time num" role="timer" aria-live="off">${mmss(left)}</span>
            <span class="dial-mode">${MODES[t.mode]}${t.mode === 'work' ? `, round ${(t.round % c.rounds) + 1} of ${c.rounds}` : ''}</span>
          </div>
        </div>
        <div class="focus-controls">
          <button class="icon-btn lg" data-f="reset" aria-label="Reset">${icon('reset', 20)}</button>
          <button class="btn primary xl" data-f="toggle">${icon(t.running ? 'pause' : 'play', 18)}${t.running ? 'Pause' : left < total ? 'Resume' : 'Start'}</button>
          <button class="icon-btn lg" data-f="skip" aria-label="Skip to the next session">${icon('skip', 20)}</button>
        </div>
        <div class="focus-what">
          <label>Class<select data-fx="classId">${classOptions(t.classId, { includeNone: true, noneLabel: 'No class' })}</select></label>
          <label>Working on<input data-fx="label" value="${esc(t.label)}" placeholder="PA2, OS reading, flashcards…"></label>
        </div>
        ${soon.length ? `<div class="chips focus-picks"><span class="muted small">Quick pick:</span>${soon.map((e) => `<button class="chip" data-pick="${e.id}">${e.classId ? mark(e.classId) : ''}${esc(e.title.replace('[Template] ', ''))}</button>`).join('')}</div>` : ''}
      </section>

      <div class="stack">
        <section class="panel">
          <header class="panel-head"><h2>Today</h2><span class="num strong">${focusHrs(focusMinutes({ from: today }))}</span></header>
          <ul class="rows compact">${todayLog.map((l) => `<li class="row"><span class="row-main static"><span class="row-title">${l.classId ? mark(l.classId) : ''}${esc(l.label || className(l.classId) || 'Focus session')}</span><span class="row-meta">${new Date(l.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span></span><span class="num">${l.minutes} min</span></li>`).join('') || '<li class="rows-empty">No sessions yet today. One 25-minute session is a great start.</li>'}</ul>
        </section>
        <section class="panel">
          <header class="panel-head"><h2>Last 7 days</h2><span class="num strong">${focusHrs(focusMinutes({ from: weekStart }))}</span></header>
          <div class="bars" role="img" aria-label="Minutes focused per day">
            ${days.map((x) => `<div class="bar ${x.d === today ? 'today' : ''}" title="${fmtDate(x.d, { weekday: 'long' })}: ${x.m} min"><span style="height:${Math.round((x.m / maxDay) * 100)}%"></span><small>${fmtDate(x.d, { weekday: 'narrow' })}</small></div>`).join('')}
          </div>
          ${byClass.length ? `<h3 class="sub">By class</h3>${byClass.map((x) => `<div class="hbar"><span class="hbar-label">${x.id ? mark(x.id) : ''}${esc(x.name)}</span><span class="hbar-track"><span style="width:${Math.round((x.m / maxClass) * 100)}%"></span></span><span class="num small">${focusHrs(x.m)}</span></div>`).join('')}` : ''}
        </section>
        <section class="panel">
          <header class="panel-head"><h2>Timer settings</h2></header>
          <div class="form-row">
            <label>Focus (min)<input type="number" min="5" max="120" data-cfg="work" value="${c.work}"></label>
            <label>Short break<input type="number" min="1" max="30" data-cfg="short" value="${c.short}"></label>
            <label>Long break<input type="number" min="5" max="60" data-cfg="long" value="${c.long}"></label>
            <label>Rounds<input type="number" min="2" max="8" data-cfg="rounds" value="${c.rounds}"></label>
          </div>
          <label class="check"><input type="checkbox" data-cfg="autoBreak" ${c.autoBreak ? 'checked' : ''}> Start breaks automatically</label>
        </section>
      </div>
    </div>`;
  },

  mount(el) {
    const t = Focus.state();
    el.addEventListener('click', (e) => {
      const f = e.target.closest('[data-f]')?.dataset.f;
      if (f) {
        Focus[f]();
        return App.refresh();
      }
      const pick = e.target.closest('[data-pick]');
      if (pick) {
        const ev = S().events.find((x) => x.id === pick.dataset.pick);
        t.classId = ev.classId || '';
        t.label = ev.title.replace('[Template] ', '');
        Store.save();
        App.refresh();
      }
    });
    el.addEventListener('change', (e) => {
      const x = e.target;
      if (x.name === 'fmode') {
        Focus.setMode(x.value);
        return App.refresh();
      }
      if (x.dataset.fx) {
        t[x.dataset.fx] = x.value;
        Store.save();
      }
      const k = x.dataset.cfg;
      if (k) {
        const c = Focus.cfg();
        c[k] = x.type === 'checkbox' ? x.checked : Math.max(+x.min, Math.min(+x.max, +x.value || c[k]));
        if (!t.running) t.remaining = Focus.length(t.mode);
        Store.save();
        App.refresh();
      }
    });
    Focus.paint();
    this._keys = (e) => {
      if (e.code === 'Space' && !e.target.matches('input, textarea, select, button, [contenteditable]')) {
        e.preventDefault();
        Focus.toggle();
        App.refresh();
      }
    };
    document.addEventListener('keydown', this._keys);
  },

  unmount() {
    document.removeEventListener('keydown', this._keys);
    document.title = 'Study Hub';
  },
};
