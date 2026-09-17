/* ==========================================================================
   core.js — utilities, persistent store, markdown, graph model, UI helpers
   ========================================================================== */

/** View registry: Views[name] = { title, render(params, query) → html, mount(el, params, query), unmount() } */
const Views = {};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- dates (all stored as local YYYY-MM-DD strings) ---------- */
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
const todayStr = () => ymd(new Date());
function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function daysBetween(a, b) {
  return Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
}
function fmtDate(s, opts = { month: 'short', day: 'numeric' }) {
  return parseYmd(s).toLocaleDateString(undefined, opts);
}
function relDay(s) {
  const n = daysBetween(todayStr(), s);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n}d overdue`;
  if (n < 7) return fmtDate(s, { weekday: 'long' });
  return `in ${n}d`;
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/* ---------- calendar entries: deadlines (due, can be done/overdue) vs scheduled events ---------- */
const isScheduled = (e) => !!EVENT_TYPES[e.type]?.event;
const deadlines = () => S().events.filter((e) => !isScheduled(e));

/** Does a (possibly repeating) entry happen on day `d`? */
function occursOn(e, d) {
  if (d === e.date) return !e.skip?.includes(d);
  const rep = e.repeat || 'none';
  if (rep === 'none' || d < e.date || (e.until && d > e.until) || e.skip?.includes(d)) return false;
  const a = parseYmd(e.date);
  const b = parseYmd(d);
  const gap = daysBetween(e.date, d);
  if (rep === 'daily') return true;
  if (rep === 'weekdays') return b.getDay() > 0 && b.getDay() < 6;
  if (rep === 'weekly') return gap % 7 === 0;
  if (rep === 'biweekly') return gap % 14 === 0;
  if (rep === 'monthly') return a.getDate() === b.getDate();
  return false;
}

/** Every entry occurrence between two days (inclusive), each copied with its own `date` and `seriesStart`. */
function occurrences(from, to, list = S().events) {
  const out = [];
  for (const e of list) {
    if (!e.repeat || e.repeat === 'none') {
      if (e.date >= from && e.date <= to) out.push(e);
      continue;
    }
    for (let d = e.date > from ? e.date : from; d <= to && (!e.until || d <= e.until); d = addDays(d, 1)) {
      if (occursOn(e, d)) out.push(d === e.date ? e : { ...e, date: d, seriesStart: e.date });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || !!a.allDay - !!b.allDay || (a.time || '').localeCompare(b.time || ''));
}

const toMin = (t) => (t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : 0);
function fmtSpan(e) {
  if (e.allDay || !e.time) return isScheduled(e) ? 'All day' : '';
  return e.end ? `${fmtTime(e.time)} – ${fmtTime(e.end)}` : fmtTime(e.time);
}

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ==========================================================================
   Store
   ========================================================================== */
const STORE_KEY = 'studyhub.v1';

const Store = {
  state: null,

  load() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORE_KEY);
    } catch (_) {}
    if (raw) {
      try {
        this.state = migrate(JSON.parse(raw));
        return;
      } catch (_) {}
    }
    this.state = buildSeed();
    applyPlannerExtras(this.state);
    if (typeof applyPacks === 'function') applyPacks(this.state);
    this.save();
  },

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
    } catch (_) {
      toast('Could not save — browser storage is unavailable or full.', 'error');
    }
  },

  reset() {
    this.state = buildSeed();
    this.save();
  },
};

function migrate(s) {
  const seed = buildSeed();
  for (const k of Object.keys(seed)) if (s[k] === undefined) s[k] = seed[k];
  s.settings = { ...seed.settings, ...s.settings };
  s.settings.notify = { ...seed.settings.notify, ...(s.settings.notify || {}) };
  s.settings.focus = { ...seed.settings.focus, ...(s.settings.focus || {}) };
  s.cards.forEach((c) => {
    c.ease ??= 2.5;
    c.interval ??= 0;
    c.reps ??= 0;
    c.lapses ??= 0;
    c.due ??= todayStr();
  });
  // v1 template notes opened with an emoji heading
  s.notes.forEach((n) => {
    if (n.id.startsWith('hub-')) n.body = n.body.replace(/^# \p{Extended_Pictographic}️?\s*/u, '# ');
  });
  s.events.forEach((e) => {
    e.topicIds ??= [];
    e.repeat ??= 'none';
    e.skip ??= [];
  });
  s.classes.forEach((c) => {
    c.meetings ??= [];
    c.grading ??= defaultGrading(c.id);
    c.mark ??= MARKS.find((m) => !s.classes.some((x) => x.mark === m)) || 'dot';
  });
  s.topics.forEach((t) => {
    t.prereqs ??= [];
    t.mastery ??= 0;
  });
  applyPlannerExtras(s);
  if (typeof applyPacks === 'function') applyPacks(s);
  return s;
}

/* ---------- lookups ---------- */
const S = () => Store.state;
const getClass = (id) => S().classes.find((c) => c.id === id);
const getTopic = (id) => S().topics.find((t) => t.id === id);
const getNote = (id) => S().notes.find((n) => n.id === id);
const topicsOf = (classId) => S().topics.filter((t) => t.classId === classId);
const notesOf = (classId) => S().notes.filter((n) => n.classId === classId);
const cardsOf = (classId) => S().cards.filter((c) => c.classId === classId);
const className = (id) => getClass(id)?.name || 'General';
const dueCards = (classId) =>
  S().cards.filter((c) => c.due <= todayStr() && (!classId || c.classId === classId));

function classMastery(classId) {
  const ts = topicsOf(classId);
  if (!ts.length) return 0;
  return Math.round((ts.reduce((a, t) => a + t.mastery, 0) / (ts.length * 3)) * 100);
}

function studyStreak() {
  const log = S().reviewLog;
  let d = todayStr();
  if (!log[d]) d = addDays(d, -1);
  let n = 0;
  while (log[d]) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/* ---------- option builders ---------- */
function classOptions(selected, { includeNone = false, noneLabel = 'General / none' } = {}) {
  let h = includeNone ? `<option value="">${esc(noneLabel)}</option>` : '';
  for (const c of S().classes)
    h += `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`;
  return h;
}
function topicOptions(classId, selected, { includeNone = true, noneLabel = '— any topic —' } = {}) {
  let h = includeNone ? `<option value="">${esc(noneLabel)}</option>` : '';
  const groups = classId ? [getClass(classId)].filter(Boolean) : S().classes;
  for (const c of groups) {
    const ts = topicsOf(c.id);
    if (!ts.length) continue;
    h += `<optgroup label="${esc(c.name)}">`;
    for (const t of ts) h += `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${esc(t.name)}</option>`;
    h += `</optgroup>`;
  }
  return h;
}

/* ==========================================================================
   Markdown-lite renderer with [[wikilinks]]
   ========================================================================== */
function inlineMd(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
      const resolved = resolveWiki(target.trim());
      const cls = resolved ? 'wikilink' : 'wikilink missing';
      return `<a href="#" class="${cls}" data-wiki="${target.trim()}">${label || target}</a>`;
    })
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|library\/)[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function renderMarkdown(src) {
  const lines = esc(src || '').split('\n');
  let out = '';
  let list = null; // 'ul' | 'ol'
  let inCode = false;
  let para = [];

  const flushPara = () => {
    if (para.length) out += `<p>${inlineMd(para.join(' '))}</p>`;
    para = [];
  };
  const closeList = () => {
    if (list) out += `</${list}>`;
    list = null;
  };

  let codeLang = '';
  let codeBuf = [];
  const rawLines = (src || '').split('\n');
  for (const [li, line] of lines.entries()) {
    if (line.trim().startsWith('```')) {
      flushPara();
      closeList();
      if (inCode) out += codeBlock(codeBuf.join('\n'), codeLang);
      else {
        codeLang = line.trim().slice(3).trim().toLowerCase();
        codeBuf = [];
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeBuf.push(rawLines[li]);
      continue;
    }
    let m;
    if (!line.trim()) {
      flushPara();
      closeList();
    } else if ((m = line.match(/^(#{1,4})\s+(.*)/))) {
      flushPara();
      closeList();
      const lvl = m[1].length + 1;
      out += `<h${lvl}>${inlineMd(m[2])}</h${lvl}>`;
    } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushPara();
      closeList();
      out += '<hr>';
    } else if ((m = line.match(/^&gt;\s?(.*)/))) {
      flushPara();
      closeList();
      out += `<blockquote>${inlineMd(m[1])}</blockquote>`;
    } else if ((m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)/))) {
      flushPara();
      if (list !== 'ul') {
        closeList();
        out += '<ul class="checklist">';
        list = 'ul';
      }
      out += `<li><input type="checkbox" disabled ${m[1].trim() ? 'checked' : ''}> ${inlineMd(m[2])}</li>`;
    } else if ((m = line.match(/^\s*[-*]\s+(.*)/))) {
      flushPara();
      if (list !== 'ul') {
        closeList();
        out += '<ul>';
        list = 'ul';
      }
      out += `<li>${inlineMd(m[1])}</li>`;
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      flushPara();
      if (list !== 'ol') {
        closeList();
        out += '<ol>';
        list = 'ol';
      }
      out += `<li>${inlineMd(m[1])}</li>`;
    } else {
      closeList();
      para.push(line.trim());
    }
  }
  flushPara();
  closeList();
  if (inCode) out += codeBlock(codeBuf.join('\n'), codeLang);
  return out;
}

function stripMarkdown(src) {
  return (src || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`=>#]/g, '')
    .replace(/^\s*[-*]\s+\[.\]\s+/gm, '')
    .replace(/^\s*([-*]|\d+[.)])\s+/gm, '');
}

function extractWikilinks(text) {
  const out = [];
  const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let m;
  while ((m = re.exec(text || ''))) out.push(m[1].trim());
  return out;
}

/** Resolve a [[target]] to {kind, id} — notes first, then topics, then classes. */
function resolveWiki(target) {
  const t = target.toLowerCase();
  const note = S().notes.find((n) => n.title.toLowerCase() === t);
  if (note) return { kind: 'note', id: note.id };
  const topic = S().topics.find((x) => x.name.toLowerCase() === t);
  if (topic) return { kind: 'topic', id: topic.id };
  const cls = S().classes.find((c) => c.name.toLowerCase() === t || (c.code || '').toLowerCase() === t);
  if (cls) return { kind: 'class', id: cls.id };
  return null;
}

function openWiki(target) {
  const r = resolveWiki(target);
  if (!r) {
    if (confirm(`No note called “${target}” yet. Create it?`)) {
      const n = createNote({ title: target, classId: '' });
      location.hash = `#/notes/${n.id}`;
    }
    return;
  }
  openNodeRef(r.kind, r.id);
}

function openNodeRef(kind, id) {
  if (kind === 'note') location.hash = `#/notes/${id}`;
  else if (kind === 'class') location.hash = `#/classes/${id}`;
  else if (kind === 'topic') location.hash = `#/tree/${getTopic(id)?.classId}?topic=${id}`;
}

function createNote({ title = 'Untitled note', classId = '', body = '', tags = [], source = null } = {}) {
  const n = { id: uid(), title, classId, body, tags, source, created: Date.now(), updated: Date.now() };
  S().notes.unshift(n);
  Store.save();
  return n;
}

function deleteNote(id) {
  const n = getNote(id);
  if (n?.source?.fileId) FileStore.remove(n.source.fileId);
  S().notes = S().notes.filter((x) => x.id !== id);
  Store.save();
}

/* ==========================================================================
   FileStore — original slide decks / documents kept in IndexedDB
   (localStorage is too small for files; notes keep only the extracted text)
   ========================================================================== */
const FileStore = {
  _db: null,
  open() {
    if (this._db) return this._db;
    this._db = new Promise((resolve, reject) => {
      const req = indexedDB.open('studyhub-files', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this._db;
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const t = db.transaction('files', mode);
      const r = fn(t.objectStore('files'));
      t.oncomplete = () => resolve(r?.result);
      t.onerror = () => reject(t.error);
    });
  },
  put(id, blob) {
    return this.tx('readwrite', (st) => st.put(blob, id));
  },
  get(id) {
    return this.tx('readonly', (st) => st.get(id));
  },
  remove(id) {
    return this.tx('readwrite', (st) => st.delete(id)).catch(() => {});
  },
};

async function openOriginal(note) {
  try {
    const blob = await FileStore.get(note.source.fileId);
    if (!blob) return toast('The original file is not stored in this browser.', 'warn');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    if (blob.type === 'application/pdf') a.target = '_blank';
    else a.download = note.source.name;
    a.rel = 'noopener';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (_) {
    toast('Could not open the original file.', 'error');
  }
}

/* ==========================================================================
   Knowledge graph model (shared by graph view, degrees view, backlinks)
   ========================================================================== */
function buildGraph({ includeNotes = true, classFilter = null } = {}) {
  const s = S();
  const nodes = [];
  const edges = [];
  const has = new Set();
  const keep = (classId) => !classFilter || classFilter.has(classId || '');

  for (const c of s.classes) {
    if (!keep(c.id)) continue;
    nodes.push({ id: 'c:' + c.id, kind: 'class', ref: c.id, label: c.name, classId: c.id });
    has.add('c:' + c.id);
  }
  for (const t of s.topics) {
    if (!keep(t.classId)) continue;
    nodes.push({ id: 't:' + t.id, kind: 'topic', ref: t.id, label: t.name, classId: t.classId, mastery: t.mastery });
    has.add('t:' + t.id);
  }
  if (includeNotes) {
    for (const n of s.notes) {
      if (!keep(n.classId)) continue;
      nodes.push({ id: 'n:' + n.id, kind: 'note', ref: n.id, label: n.title, classId: n.classId });
      has.add('n:' + n.id);
    }
  }

  const add = (a, b, type, label = '') => {
    if (a !== b && has.has(a) && has.has(b)) edges.push({ source: a, target: b, type, label });
  };

  for (const t of s.topics) {
    const local = t.prereqs.filter((p) => getTopic(p)?.classId === t.classId);
    if (!local.length) add('c:' + t.classId, 't:' + t.id, 'contains');
    for (const p of t.prereqs) add('t:' + p, 't:' + t.id, 'prereq', 'prerequisite');
  }
  for (const l of s.links) add('t:' + l.a, 't:' + l.b, 'cross', l.label);
  if (includeNotes) {
    for (const n of s.notes) {
      if (n.classId) add('c:' + n.classId, 'n:' + n.id, 'note');
      for (const w of new Set(extractWikilinks(n.body))) {
        const r = resolveWiki(w);
        if (r) add('n:' + n.id, r.kind[0] + ':' + r.id, 'mention', 'mentions');
      }
    }
  }
  return { nodes, edges };
}

function adjacency(graph) {
  const adj = new Map(graph.nodes.map((n) => [n.id, []]));
  for (const e of graph.edges) {
    adj.get(e.source)?.push({ to: e.target, edge: e });
    adj.get(e.target)?.push({ to: e.source, edge: e });
  }
  return adj;
}

/** Breadth-first shortest path. Returns [{id, via}] or null. */
function shortestPath(graph, from, to) {
  if (from === to) return [{ id: from, via: null }];
  const adj = adjacency(graph);
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const { to: nxt, edge } of adj.get(cur) || []) {
      if (prev.has(nxt)) continue;
      prev.set(nxt, { from: cur, edge });
      if (nxt === to) {
        const path = [];
        let x = to;
        while (x) {
          const p = prev.get(x);
          path.unshift({ id: x, via: p?.edge || null });
          x = p?.from || null;
        }
        return path;
      }
      queue.push(nxt);
    }
  }
  return null;
}

/* ==========================================================================
   Spaced repetition (SM-2 variant with Anki-style buttons)
   ========================================================================== */
const SRS = {
  preview(card, grade) {
    const c = { ...card };
    const today = todayStr();
    if (grade === 0) {
      c.lapses++;
      c.reps = 0;
      c.ease = Math.max(1.3, c.ease - 0.2);
      c.interval = 0;
    } else if (grade === 1) {
      c.ease = Math.max(1.3, c.ease - 0.15);
      // a brand-new card graded Hard stays in today's session
      c.interval = c.reps === 0 ? 0 : Math.max(1, Math.round((c.interval || 1) * 1.2));
      if (c.reps > 0) c.reps++;
    } else if (grade === 2) {
      c.interval = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(c.interval * c.ease);
      c.reps++;
    } else {
      c.ease += 0.15;
      c.interval = c.reps === 0 ? 4 : Math.round(Math.max(c.interval, 1) * c.ease * 1.3);
      c.reps++;
    }
    c.due = addDays(today, c.interval);
    return c;
  },
  label(card, grade) {
    const i = this.preview(card, grade).interval;
    if (i === 0) return grade === 0 ? '<1m' : '<10m';
    if (i < 30) return `${i}d`;
    if (i < 365) return `${Math.round(i / 30)}mo`;
    return `${(i / 365).toFixed(1)}y`;
  },
  apply(card, grade) {
    Object.assign(card, this.preview(card, grade), { lastReviewed: Date.now() });
    const log = S().reviewLog;
    log[todayStr()] = (log[todayStr()] || 0) + 1;
    Store.save();
  },
};

/** Parse pasted AI output into cards. Supports Q:/A: blocks, TSV, "front | back", "front :: back". */
function parseCards(text) {
  const cards = [];
  const src = (text || '').replace(/\r/g, '').trim();
  if (!src) return cards;

  const qa = /(?:^|\n)\s*(?:\*\*)?(?:Q|Question|Front)\s*\d*\s*[:.)-]\s*(?:\*\*)?\s*([\s\S]*?)\n\s*(?:\*\*)?(?:A|Answer|Back)\s*[:.)-]\s*(?:\*\*)?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:Q|Question|Front)\s*\d*\s*[:.)-]|\n\s*\n\s*\n|$)/gi;
  let m;
  while ((m = qa.exec(src))) {
    const front = m[1].trim();
    const back = m[2].trim().replace(/\n{2,}/g, '\n');
    if (front && back) cards.push({ front, back });
  }
  if (cards.length) return cards;

  for (let line of src.split('\n')) {
    line = line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '').trim();
    if (!line || /^[-|: ]+$/.test(line)) continue;
    let parts = null;
    if (line.includes('\t')) parts = line.split('\t');
    else if (line.includes(' :: ')) parts = line.split(' :: ');
    else if (line.includes(' | ')) parts = line.replace(/^\||\|$/g, '').split(' | ');
    else if (line.includes(';;')) parts = line.split(';;');
    if (parts && parts.length >= 2) {
      const front = parts[0].trim();
      const back = parts.slice(1).join(' ').trim();
      if (front && back && !/^front$/i.test(front)) cards.push({ front, back });
    }
  }
  return cards;
}

function newCard({ front, back, classId = '', topicId = '', source = 'manual' }) {
  return { id: uid(), front, back, classId, topicId, source, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: todayStr(), created: Date.now() };
}

/* ==========================================================================
   ChatGPT bridge
   ========================================================================== */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (_) {}
    ta.remove();
    return ok;
  }
}

async function sendToChatGPT(prompt) {
  const { chatUrl, prefillUrl } = S().settings;
  const base = chatUrl || 'https://chatgpt.com/';
  const copied = await copyText(prompt);
  let url = base;
  if (prefillUrl && prompt.length < 6000) url = `${base}${base.includes('?') ? '&' : '?'}q=${encodeURIComponent(prompt)}`;
  window.open(url, '_blank', 'noopener');
  if (url !== base) toast('Opened ChatGPT with your prompt prefilled (also copied).', 'ok');
  else toast(copied ? 'Prompt copied — paste it into ChatGPT with Ctrl+V.' : 'Opened ChatGPT. Copy the prompt manually.', copied ? 'ok' : 'warn');
}

/* ==========================================================================
   UI helpers
   ========================================================================== */
function toast(msg, kind = 'info') {
  let host = $('#toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3600);
}

function openModal(title, bodyHtml, { onMount, wide = false } = {}) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close">${icon('close')}</button></header>
      <div class="modal-body">${bodyHtml}</div>
    </div>`;
  wrap.addEventListener('mousedown', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) closeModal();
  });
  document.body.appendChild(wrap);
  const modal = $('.modal', wrap);
  onMount?.(modal);
  $('input, textarea, select', modal)?.focus();
  return modal;
}
function closeModal() {
  $('.modal-backdrop')?.remove();
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

const MASTERY = [
  { label: 'Not started', cls: 'm0' },
  { label: 'Learning', cls: 'm1' },
  { label: 'Proficient', cls: 'm2' },
  { label: 'Mastered', cls: 'm3' },
];

/** Three pips, filled to the mastery level — readable without colour. */
function masteryPips(level) {
  return `<span class="pips" title="${MASTERY[level].label}" aria-label="${MASTERY[level].label}">${[1, 2, 3].map((i) => `<i class="${i <= level ? 'on' : ''}"></i>`).join('')}</span>`;
}

function progressBar(pct) {
  return `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>`;
}

function emptyState(iconName, title, sub = '', action = '') {
  return `<div class="empty">${iconName ? `<span class="empty-icon">${icon(iconName, 22)}</span>` : ''}<strong>${esc(title)}</strong>${sub ? `<p>${esc(sub)}</p>` : ''}${action}</div>`;
}

/* ==========================================================================
   Icons — one drawn set, 24px grid, 1.6 stroke
   ========================================================================== */
const ICON_PATHS = {
  today: '<path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z"/>',
  classes: '<path d="M5 4h13v16H5z"/><path d="M9 4v16"/><path d="M12 8.5h3"/>',
  notes: '<path d="M6 3.5h8.5L19 8v12.5H6z"/><path d="M14.5 3.5V8H19"/><path d="M9 12.5h6.5M9 16h6.5"/>',
  cards: '<path d="M3.5 8h13v11.5h-13z"/><path d="M7.5 8V4.5h13V16h-4"/>',
  ai: '<path d="M4 5h16v11h-9.5L6 20v-4H4z"/><path d="M8.5 10.5h7"/>',
  map: '<circle cx="6" cy="6.5" r="2.2"/><circle cx="18" cy="8.5" r="2.2"/><circle cx="10" cy="18" r="2.2"/><path d="M8.1 7.1l7.7 1.2M16.6 10.2l-5.1 6.1M6.7 8.6l2.4 7.3"/>',
  planner: '<path d="M4 5.5h16v14.5H4z"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M8 14h2M14 14h2"/>',
  settings: '<path d="M4 7h9M17.5 7H20M4 17h3.5M12 17h8"/><circle cx="15.2" cy="7" r="2.2"/><circle cx="9.8" cy="17" r="2.2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9"/><path d="M4.5 15v4.5h15V15"/>',
  theme: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  right: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  external: '<path d="M13.5 4.5h6v6M19.5 4.5l-8.5 8.5"/><path d="M17.5 14v5.5h-13v-13H10"/>',
  file: '<path d="M6 3.5h8.5L19 8v12.5H6z"/><path d="M14.5 3.5V8H19"/>',
  folder: '<path d="M3.5 6h6l2 2.2h9V19h-17z"/>',
  slides: '<path d="M3.5 4.5h17v11h-17z"/><path d="M12 15.5v4M8 19.5h8"/>',
  text: '<path d="M5 6h14M5 10.5h14M5 15h9"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  swap: '<path d="M4.5 8.5h14l-3.5-3.5M19.5 15.5h-14l3.5 3.5"/>',
  shuffle: '<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.7-1.6 3.6-3.5M13 10c.9-1.7 2-3 3.5-3H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>',
  spark: '<path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  list: '<path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H20"/><path d="M4 5.5l1.2 1.2L7 4.8M4 11l1.2 1.2L7 10.3"/><circle cx="5.5" cy="17.5" r="1.2"/>',
  more: '<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>',
  grip: '<circle cx="9" cy="6.5" r="1.2" fill="currentColor"/><circle cx="15" cy="6.5" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="17.5" r="1.2" fill="currentColor"/><circle cx="15" cy="17.5" r="1.2" fill="currentColor"/>',
  down: '<path d="M5.5 9.5 12 16l6.5-6.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  empty: '<path d="M4 8h16v11.5H4z"/><path d="M4 8l2.5-3.5h11L20 8M9 12.5h6"/>',
  timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V10M9.5 3.5h5M18 7l1.5-1.5"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  skip: '<path d="M6 5.5l9 6.5-9 6.5zM18 5.5v13"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>',
  grades: '<path d="M4.5 19.5h15"/><path d="M7 16V11M12 16V6M17 16v-7"/>',
  exam: '<path d="M6 3.5h12v17H6z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  code: '<path d="M9 7 4 12l5 5M15 7l5 5-5 5"/>',
  book: '<path d="M5 4.5h6.5a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5z"/><path d="M19 4.5h-3.5M13.5 6.5a2 2 0 0 1 2-2H19v13h-3.5a2 2 0 0 0-2 2"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>',
};

function icon(name, size = 18) {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

/* ==========================================================================
   Class marks — classes are told apart by shape, never by colour
   ========================================================================== */
const MARKS = ['square', 'triangle', 'circle', 'diamond', 'ring', 'bar', 'cross', 'half'];

function classMarkName(classId) {
  return getClass(classId)?.mark || 'dot';
}
function mark(classId, extra = '') {
  return `<i class="mark mk-${classMarkName(classId)} ${extra}" aria-hidden="true"></i>`;
}

/** Tabs shown above views that share one navigation entry. */
function subTabs(items, active) {
  return `<nav class="subtabs" aria-label="Section">${items
    .map(([href, label, id]) => `<a href="${href}" class="subtab ${id === active ? 'active' : ''}" ${id === active ? 'aria-current="page"' : ''}>${label}</a>`)
    .join('')}</nav>`;
}
