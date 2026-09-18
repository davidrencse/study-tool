/* ==========================================================================
   notify.js — reminders for due dates, exams, class times and reviews.
   Checks every 30 seconds while Study Hub is open (in any tab, even in the
   background). Shows them in the bell panel, as a toast, and optionally as
   desktop notifications.
   ========================================================================== */

const Notify = {
  _timer: 0,

  start() {
    if (this._timer) return;
    this.renderBell();
    this.check({quiet:true});
    this._timer = setInterval(() => this.check(), 30000);
    this._onVisible = () => { if (!document.hidden) this.check(); };
    document.addEventListener('visibilitychange', this._onVisible);
  },

  stop() {
    clearInterval(this._timer); this._timer = null;
    document.removeEventListener('visibilitychange', this._onVisible);
    this._onVisible = null;
  },

  settings() {
    return S().settings.notify;
  },

  /* ---------- the rules ---------- */
  check({quiet=false}={}) {
    const s = S();
    if (!s) return;
    const st = this.settings();
    const now = new Date();
    const today = todayStr();
    const fired = [];
    const want = (key, n) => {
      if (s.notifyLog[key]) return;
      fired.push({ key, ...n });
    };

    for (const e of deadlines()) {
      if (e.done) continue;
      const at = dueAt(e);
      const mins = (at - now) / 60000;
      const cls = className(e.classId);
      const when = e.time ? ` at ${fmtTime(e.time)}` : '';
      const href = EVENT_TYPES[e.type]?.major && e.type === 'exam' ? '#/exams' : '#/calendar';
      if (mins < 0) {
        if (st.overdue && mins > -14 * 1440) want(`over:${e.id}:${e.date}`, { title: `Overdue: ${e.title}`, body: `${cls} · was due ${fmtDate(e.date)}${when}`, href, kind: 'overdue' });
        continue;
      }
      if (st.hourBefore && e.time && mins <= 60) want(`hour:${e.id}:${e.date}`, { title: `Due within the hour: ${e.title}`, body: `${cls} · due${when}`, href, kind: 'soon' });
      if (st.dayOf && e.date === today && now.getHours() >= 8) want(`today:${e.id}:${e.date}`, { title: `Due today: ${e.title}`, body: `${cls}${when ? ' ·' + when : ''}`, href, kind: 'soon' });
      const days = daysBetween(today, e.date);
      if (st.daysBefore > 0 && days > 0 && days <= st.daysBefore)
        want(`lead:${e.id}:${e.date}`, { title: `${days === 1 ? 'Due tomorrow' : `Due in ${days} days`}: ${e.title}`, body: `${cls} · ${fmtDate(e.date, { weekday: 'long', month: 'short', day: 'numeric' })}${when}`, href, kind: 'upcoming' });
      if (e.type === 'exam') {
        for (const d of [7, 3]) {
          if (days > 0 && days <= d) want(`exam${d}:${e.id}:${e.date}`, { title: `${e.title} in ${days} day${days === 1 ? '' : 's'}`, body: `${cls}. Your study plan is under Planner, Exams.`, href: '#/exams', kind: 'exam' });
        }
      }
    }

    if (st.classStart && typeof occurrences === 'function') {
      for (const e of occurrences(today, today).filter(isScheduled)) {
        if (e.remind === false || !e.time || e.allDay) continue;
        const start = new Date(`${e.date}T${e.time}:00`);
        const mins = (start - now) / 60000;
        if (mins > 0 && mins <= st.classLead)
          want(`start:${e.id}:${e.date}`, { title: `${e.title} starts at ${fmtTime(e.time)}`, body: [e.location, `in ${Math.round(mins)} min`].filter(Boolean).join(' · '), href: '#/calendar', kind: 'class' });
      }
    }

    if (st.cardsDaily && now.getHours() >= 9) {
      const n = dueCards().length;
      if (n) want(`cards:${today}`, { title: `${plural(n, 'flashcard')} to review today`, body: 'A few minutes now keeps them from piling up.', href: '#/cards', kind: 'cards' });
    }

    if (!fired.length) return;
    const burst = fired.length > 5;
    const show = burst ? fired.slice(0, 4) : fired;
    for (const n of fired) s.notifyLog[n.key] = Date.now();
    for (const n of show) this.push(n, { quiet: quiet || burst || n.kind==='cards' });
    if (burst) this.push({ key: `digest:${Date.now()}`, title: `${fired.length - 4} more reminders`, body: 'Open the bell to see everything that’s due.', href: '#/calendar', kind: 'digest' }, {quiet});
    this.prune();
    Store.save();
    this.renderBell();
    if (App.current?.name === 'dashboard') App.refresh();
  },

  push(n, { quiet = false } = {}) {
    const s = S();
    const item = { id: uid(), at: Date.now(), read: false, ...n };
    s.notifications.unshift(item);
    s.notifications.length = Math.min(s.notifications.length, 60);
    s.notifyLog[n.key] ||= Date.now();
    if (!quiet) toast(n.title, n.kind === 'overdue' ? 'warn' : 'info');
    if (!quiet) this.desktop(item);
    if (this.settings().sound && !quiet) chime();
    this.renderBell();
  },

  desktop(n) {
    if (!this.settings().desktop || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const note = new Notification(n.title, { body: n.body || '', tag: n.key, icon: $('link[rel=icon]')?.href });
      note.onclick = () => {
        window.focus();
        this.open(n.id);
        note.close();
      };
    } catch (_) {}
  },

  async enableDesktop() {
    if (!('Notification' in window)) return toast('This browser can’t show desktop notifications', 'warn');
    const p = await Notification.requestPermission();
    S().settings.notify.desktop = p === 'granted';
    Store.save();
    toast(p === 'granted' ? 'Desktop alerts are on' : 'Desktop alerts are blocked in your browser settings', p === 'granted' ? 'ok' : 'warn');
    if (p === 'granted') this.desktop({ id: '', key: 'test', title: 'Study Hub reminders are on', body: 'You’ll get alerts for due dates and classes while Study Hub is open.' });
    this.renderPanel();
  },

  prune() {
    const s = S();
    const cutoff = Date.now() - 45 * 86400000;
    for (const k of Object.keys(s.notifyLog)) if (s.notifyLog[k] < cutoff) delete s.notifyLog[k];
  },

  unread() {
    return S().notifications.filter((n) => !n.read).length;
  },

  open(id) {
    const n = S().notifications.find((x) => x.id === id);
    if (n) {
      n.read = true;
      Store.save();
      if (n.href) location.hash = n.href;
    }
    this.close();
    this.renderBell();
  },

  /* ---------- bell + panel ---------- */
  renderBell() {
    const b = $('#bell');
    if (!b) return;
    const n = this.unread();
    b.innerHTML = icon('bell') + (n ? `<span class="bell-count">${n > 9 ? '9+' : n}</span>` : '');
    b.setAttribute('aria-label', n ? `Notifications, ${n} unread` : 'Notifications');
  },

  toggle() {
    $('#notify-panel') ? this.close() : this.openPanel();
  },

  openPanel() {
    const p = document.createElement('div');
    p.id = 'notify-panel';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(p);
    this.renderPanel();
    $('#bell').setAttribute('aria-expanded', 'true');
    setTimeout(() => document.addEventListener('mousedown', this._outside), 0);
  },

  _outside: (e) => {
    if (!e.target.closest('#notify-panel, #bell')) Notify.close();
  },

  close() {
    $('#notify-panel')?.remove();
    $('#bell')?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', this._outside);
  },

  renderPanel() {
    const p = $('#notify-panel');
    if (!p) return;
    const s = S();
    const list = s.notifications.slice(0, 25);
    const today = todayStr();
    const soon = deadlines().filter((e) => !e.done && e.date >= today && e.date <= addDays(today, 3)).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')).slice(0, 5);
    const canAsk = 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied';
    p.innerHTML = `
      <header class="np-head">
        <h2>Notifications</h2>
        ${list.some((n) => !n.read) ? '<button class="linklike small" data-np="read">Mark all read</button>' : ''}
      </header>
      ${canAsk || (!s.settings.notify.desktop && Notification.permission === 'granted') ? `
        <div class="np-cta">
          <span>Get alerts on your desktop too, even when this tab is in the background.</span>
          <button class="btn sm primary" data-np="desktop">Turn on</button>
        </div>` : ''}
      <div class="np-section">Due in the next 3 days</div>
      <ul class="np-list">
        ${soon.map((e) => `<li><a href="#/calendar" data-np-go>${e.classId ? mark(e.classId) : ''}<span><b>${esc(e.title)}</b><small>${relDay(e.date)}${e.time ? `, ${fmtTime(e.time)}` : ''}</small></span></a></li>`).join('') || '<li class="np-empty">Nothing due. Nice.</li>'}
      </ul>
      <div class="np-section">Recent</div>
      <ul class="np-list">
        ${list.map((n) => `
          <li class="${n.read ? '' : 'unread'}">
            <button data-np-open="${n.id}"><span class="np-dot" aria-hidden="true"></span><span><b>${esc(n.title)}</b><small>${esc(n.body || '')}</small><small>${timeAgo(n.at)}</small></span></button>
          </li>`).join('') || '<li class="np-empty">You’re all caught up. Reminders for due dates, exams and classes will show up here.</li>'}
      </ul>
      <footer class="np-foot"><a href="#/settings" data-np-go>Reminder settings</a>${list.length ? '<button class="linklike small" data-np="clear">Clear all</button>' : ''}</footer>`;
    p.onclick = (e) => {
      const o = e.target.closest('[data-np-open]');
      if (o) return this.open(o.dataset.npOpen);
      if (e.target.closest('[data-np-go]')) return this.close();
      const a = e.target.closest('[data-np]')?.dataset.np;
      if (a === 'read') s.notifications.forEach((n) => (n.read = true));
      if (a === 'clear') s.notifications = [];
      if (a === 'desktop') return this.enableDesktop();
      if (a) {
        Store.save();
        this.renderBell();
        this.renderPanel();
      }
    };
  },
};

function dueAt(e) {
  return new Date(`${e.date}T${e.time || '23:59'}:00`);
}

function timeAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** A soft two-note chime (Web Audio, no files). */
function chime() {
  try {
    const ctx = (chime.ctx ||= new (window.AudioContext || window.webkitAudioContext)());
    const t = ctx.currentTime;
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.14 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.14);
      o.stop(t + i * 0.14 + 0.55);
    });
  } catch (_) {}
}
