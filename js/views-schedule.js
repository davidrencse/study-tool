/* ==========================================================================
   views-schedule.js — nested to-do list and the day schedule
   ========================================================================== */

/* ------------------------------ shared helpers ------------------------------ */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_START = 4 * 60; // the day rolls over at 4 AM, so a midnight block still belongs to "today"

/** Place the caret at the start or end of an editable element. */
function focusEdit(el, atStart = false) {
  if (!el) return;
  el.focus();
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(atStart);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}
function caretAtStart(el) {
  const sel = getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return false;
  const r = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length === 0;
}
const editText = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const editable = (cls, text, attrs, placeholder) =>
  `<span class="ed ${cls}" contenteditable="plaintext-only" role="textbox" spellcheck="true" data-ph="${esc(placeholder)}" ${attrs}>${esc(text)}</span>`;

/** A toast with an Undo button. */
function undoToast(msg, undo) {
  toast('', 'info');
  const el = $('#toasts').lastElementChild;
  el.classList.add('toast-undo');
  el.innerHTML = `<span>${esc(msg)}</span><button type="button">Undo</button>`;
  $('button', el).addEventListener('click', () => {
    undo();
    el.remove();
  });
}

/** Small popover anchored to a button. Closes on outside click, Escape or scroll. */
function openMenu(anchor, html, onMount) {
  closeMenu();
  const m = document.createElement('div');
  m.className = 'pop';
  m.innerHTML = html;
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8));
  let top = r.bottom + 6;
  if (top + m.offsetHeight > innerHeight - 8) top = Math.max(8, r.top - m.offsetHeight - 6);
  m.style.left = `${left}px`;
  m.style.top = `${top}px`;
  anchor.setAttribute('aria-expanded', 'true');
  const outside = (e) => !m.contains(e.target) && e.target !== anchor && !anchor.contains(e.target) && closeMenu();
  const key = (e) => {
    if (e.key === 'Escape') {
      closeMenu();
      anchor.focus();
    }
  };
  const scroll = (e) => !m.contains(e.target) && closeMenu();
  setTimeout(() => document.addEventListener('mousedown', outside), 0);
  document.addEventListener('keydown', key);
  addEventListener('scroll', scroll, true);
  m._cleanup = () => {
    anchor.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', outside);
    document.removeEventListener('keydown', key);
    removeEventListener('scroll', scroll, true);
  };
  onMount?.(m);
  $('button, input', m)?.focus();
  return m;
}
function closeMenu() {
  const m = $('.pop');
  if (!m) return;
  m._cleanup?.();
  m.remove();
}
addEventListener('hashchange', closeMenu);

/** Enter in a single-line field always submits its form, whatever the browser does by default. */
function enterSubmits(form) {
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing || !e.target.matches('input')) return;
    e.preventDefault();
    form.requestSubmit();
  });
}

/** Re-render the view, then put the caret back where the user was typing. */
function refreshAndFocus(selector, atStart = false) {
  App.refresh();
  if (selector) focusEdit($(selector, App.viewEl), atStart);
}

/* ==========================================================================
   To-do list — an outline you can nest as deep as you like
   ========================================================================== */
const TodoUI = { addParent: null, flash: null, reveal: null };

const todos = () => S().todo;
const todoById = (id) => todos().find((x) => x.id === id);
const todoKids = (id) => todos().filter((x) => x.parent === id);
function todoDescendants(id) {
  const out = [];
  const walk = (p) => todoKids(p).forEach((c) => (out.push(c), walk(c.id)));
  walk(id);
  return out;
}
function todoAncestors(item) {
  const out = [];
  for (let p = item.parent && todoById(item.parent); p; p = p.parent && todoById(p.parent)) out.push(p);
  return out;
}
const todoPath = (item) => todoAncestors(item).reverse().map((a) => a.title).join(' › ');
const todoSel = (id) => `.td[data-id="${id}"] > .td-row .td-title`;
const newTodo = (title, parent, extra = {}) => ({ id: uid(), title, parent, done: null, due: null, url: null, collapsed: false, ...extra });

function setTodoDone(item, done) {
  const day = todayStr();
  item.done = done ? day : null;
  if (done) todoDescendants(item.id).forEach((c) => (c.done ||= day));
  for (const a of todoAncestors(item)) {
    if (done) {
      if (a.done || !todoKids(a.id).every((k) => k.done)) break;
      a.done = day;
    } else if (a.done) a.done = null;
  }
}

/** Leaves still to do, in list order: the things you can actually pick up next. */
const openLeaves = () => todos().filter((x) => !x.done && !todoKids(x.id).length && x.parent);

/** Parse pasted text ("- item", "* [ ] item", indented lines) into rows with a depth. */
function parseLooseOutline(text) {
  const stack = [];
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => {
      const ws = line.match(/^[\t ]*/)[0].replace(/\t/g, '    ').length;
      let title = line.trim().replace(/^([-*+•]|\d+[.)])\s*/, '');
      let done = null;
      const box = title.match(/^\[( |x|X)?\]\s*/);
      if (box) {
        if ((box[1] || '').trim()) done = todayStr();
        title = title.slice(box[0].length);
      }
      const stamp = title.match(/\s*✅\s*(\d{4}-\d{2}-\d{2})?\s*$/);
      if (stamp) {
        done = stamp[1] || todayStr();
        title = title.slice(0, stamp.index);
      }
      return { ws, title: title.trim(), done };
    })
    .filter((r) => r.title)
    .map((r) => {
      while (stack.length && stack[stack.length - 1] >= r.ws) stack.pop();
      r.depth = stack.length;
      stack.push(r.ws);
      return r;
    });
}

/** Insert parsed rows under parentId, at array position `at` (end if omitted). Returns the created items. */
function insertOutline(rows, parentId, at = todos().length) {
  const made = [];
  const stack = [];
  for (const r of rows) {
    const it = newTodo(r.title, r.depth ? stack[r.depth - 1] : parentId, { done: r.done });
    stack.length = r.depth;
    stack[r.depth] = it.id;
    made.push(it);
  }
  todos().splice(at, 0, ...made);
  if (parentId) todoById(parentId).collapsed = false;
  return made;
}

function moveTodo(item, target, where) {
  if (item === target || todoDescendants(item.id).includes(target)) return false;
  const list = todos();
  list.splice(list.indexOf(item), 1);
  if (where === 'inside') {
    item.parent = target.id;
    target.collapsed = false;
    if (target.done && !item.done) target.done = null;
    list.push(item);
  } else {
    item.parent = target.parent;
    list.splice(list.indexOf(target) + (where === 'after' ? 1 : 0), 0, item);
  }
  return true;
}
function shiftTodo(item, dir) {
  const sibs = todoKids(item.parent);
  const other = sibs[sibs.indexOf(item) + dir];
  if (!other) return false;
  const list = todos();
  const a = list.indexOf(item);
  const b = list.indexOf(other);
  [list[a], list[b]] = [list[b], list[a]];
  return true;
}
function indentTodo(item) {
  const sibs = todoKids(item.parent);
  const prev = sibs[sibs.indexOf(item) - 1];
  return prev ? moveTodo(item, prev, 'inside') : false;
}
function outdentTodo(item) {
  const parent = item.parent && todoById(item.parent);
  return parent ? moveTodo(item, parent, 'after') : false;
}

function deleteTodo(item) {
  const before = todos().slice();
  const gone = new Set([item.id, ...todoDescendants(item.id).map((d) => d.id)]);
  S().todo = todos().filter((x) => !gone.has(x.id));
  Store.save();
  App.refresh();
  undoToast(gone.size > 1 ? `Deleted “${item.title}” and ${plural(gone.size - 1, 'item')} inside` : `Deleted “${item.title || 'item'}”`, () => {
    S().todo = before;
    Store.save();
    App.refresh();
  });
}

/** Which rows are visible, in on-screen order (for arrow-key movement). */
const visibleTitles = (root) => $$('.td-title', root);

Views.todo = {
  title: 'To-do',

  render(_, query) {
    const s = S();
    const prefs = s.todoPrefs;
    const t = todayStr();
    if (query.item && TodoUI.reveal !== query.item) {
      TodoUI.reveal = query.item;
      const it = todoById(query.item);
      if (it) {
        todoAncestors(it).forEach((a) => (a.collapsed = false));
        prefs.focus = '';
        prefs.showDone ||= !!it.done;
        TodoUI.flash = it.id;
      }
    }
    const focus = prefs.focus && todoById(prefs.focus);
    if (!focus) prefs.focus = '';
    const leaves = openLeaves();
    const doneWeek = todos().filter((x) => x.done && x.done >= addDays(t, -6) && !todoKids(x.id).length).length;
    const dueSoon = todos().filter((x) => x.due && !x.done && x.due <= addDays(t, 7)).sort((a, b) => a.due.localeCompare(b.due));
    const tops = todoKids(null);
    const roots = focus ? [focus] : tops;
    const scheduled = new Map((s.scheduleExtra[scheduleToday()] || []).filter((x) => x.todoId).map((x) => [x.todoId, x.blockId]));

    // groups you can add into: top level and one level down
    const addParent = TodoUI.addParent && todoById(TodoUI.addParent) ? TodoUI.addParent : focus?.id || '';
    const groupOpts = tops
      .map((g) => [g, ...todoKids(g.id).filter((k) => todoKids(k.id).length)].map((x, i) => `<option value="${x.id}" ${x.id === addParent ? 'selected' : ''}>${i ? ' ' : ''}${esc(x.title)}</option>`).join(''))
      .join('');

    const node = (item, depth) => {
      const kids = todoKids(item.id);
      const shown = prefs.showDone ? kids : kids.filter((k) => !k.done);
      const doneKids = kids.filter((k) => k.done).length;
      const blockId = scheduled.get(item.id);
      const block = blockId && s.schedule.find((b) => b.id === blockId);
      const overdue = item.due && !item.done && item.due < t;
      const soon = item.due && !item.done && item.due <= addDays(t, 3);
      const label = esc(item.title || 'untitled item');
      return `
      <li class="td ${item.done ? 'done' : ''} ${TodoUI.flash === item.id ? 'flash' : ''}" data-id="${item.id}" role="treeitem" ${kids.length ? `aria-expanded="${!item.collapsed}"` : ''}>
        <div class="td-row ${depth === 0 ? 'top' : ''}" draggable="true">
          <span class="td-grip" title="Drag to move">${icon('grip', 14)}</span>
          ${kids.length
            ? `<button class="td-tw ${item.collapsed ? '' : 'open'}" data-tw aria-label="${item.collapsed ? 'Show' : 'Hide'} items in ${label}">${icon('right', 14)}</button>`
            : '<span class="td-tw"></span>'}
          <input type="checkbox" data-check ${item.done ? 'checked' : ''} aria-label="Mark ${label} done">
          <div class="td-body">
            ${editable('td-title', item.title, `aria-label="To-do"`, 'Type a to-do')}
            <span class="td-meta">
              ${kids.length ? `<button class="td-count" data-tw title="${doneKids} of ${kids.length} done">${doneKids}/${kids.length}</button>` : ''}
              ${item.due && !item.done ? `<span class="tag ${overdue || soon ? 'solid' : ''}">${overdue ? 'Overdue' : 'Due'} ${relDay(item.due).replace(' overdue', '')}</span>` : ''}
              ${block ? `<a class="tag td-sched" href="#/schedule" title="On today’s schedule">${icon('clock', 12)}${fmtTime(block.time)}</a>` : ''}
              ${item.url ? `<a class="td-link" href="${esc(item.url)}" target="_blank" rel="noopener" title="Open link" aria-label="Open link for ${label}">${icon('link', 14)}</a>` : ''}
              ${item.done ? `<span class="td-when">${icon('check', 12)}${fmtDate(item.done)}</span>` : ''}
            </span>
          </div>
          <span class="td-acts">
            <button class="icon-btn sm" data-addkid title="Add an item inside" aria-label="Add an item inside ${label}">${icon('plus', 16)}</button>
            <button class="icon-btn sm" data-menu title="More" aria-label="More for ${label}" aria-haspopup="menu">${icon('more', 16)}</button>
          </span>
        </div>
        ${kids.length && !item.collapsed ? `<ul role="group">${shown.map((k) => node(k, depth + 1)).join('')}${shown.length ? '' : '<li class="td-hidden">All done here.</li>'}</ul>` : ''}
      </li>`;
    };
    const visibleRoots = prefs.showDone || focus ? roots : roots.filter((r) => !r.done);
    TodoUI.flash = null;

    return `
    <header class="page-head">
      <div><h1>To-do</h1><p class="lede">${plural(leaves.length, 'thing')} left. ${doneWeek ? `${doneWeek} finished in the last 7 days.` : ''}</p></div>
      <div class="head-actions">
        <button class="btn" data-act="paste">${icon('text', 16)}Paste a list</button>
        <a class="btn" href="#/schedule">${icon('clock', 16)}Schedule</a>
      </div>
    </header>

    <form class="td-add" id="td-add">
      <span class="td-add-ico">${icon('plus', 18)}</span>
      <input name="title" placeholder="Add a to-do, then press Enter" autocomplete="off" aria-label="New to-do" required>
      <label class="td-add-where"><span>in</span><select name="parent" aria-label="Add it to">${`<option value="">Top of the list</option>`}${groupOpts}</select></label>
      <button class="btn primary">Add</button>
    </form>

    ${dueSoon.length ? `<div class="callout"><span>${dueSoon.map((x) => `<a href="#/todo?item=${x.id}"><strong>${esc(x.title.length > 60 ? x.title.slice(0, 58) + '…' : x.title)}</strong></a> is due ${relDay(x.due).toLowerCase()}`).join('. ')}.</span></div>` : ''}

    <div class="td-bar">
      <div class="chips" role="group" aria-label="Show one part of the list">
        <button class="chip toggle ${focus ? 'off' : ''}" data-focus="" aria-pressed="${!focus}">Everything</button>
        ${tops.map((g) => `<button class="chip toggle ${focus?.id === g.id ? '' : 'off'}" data-focus="${g.id}" aria-pressed="${focus?.id === g.id}">${esc(g.title)}</button>`).join('')}
      </div>
      <div class="td-bar-right">
        <label class="check small"><input type="checkbox" data-showdone ${prefs.showDone ? 'checked' : ''}>Show finished</label>
        <button class="btn sm ghost" data-all="open">Open all</button>
        <button class="btn sm ghost" data-all="close">Close all</button>
      </div>
    </div>
    ${focus && focus.parent ? `<p class="td-crumb">${esc(todoPath(focus))}</p>` : ''}

    <section class="panel td-panel">
      <ul class="td-tree" role="tree" aria-label="To-do list">
        ${visibleRoots.map((r) => node(r, 0)).join('') || `<li class="rows-empty">${todos().length ? 'Everything here is finished.' : 'Nothing yet. Add your first to-do above.'}</li>`}
      </ul>
    </section>
    <p class="hint td-keys">Click any text to edit it. <kbd>Enter</kbd> new item · <kbd>Tab</kbd> move inside · <kbd>Shift</kbd>+<kbd>Tab</kbd> move out · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> check off · <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> reorder · drag the dots to move.</p>`;
  },

  mount(el) {
    const s = S();
    const itemOf = (node) => todoById(node.closest('.td')?.dataset.id);
    const save = () => Store.save();

    el.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('[data-act="paste"]')) return pasteListModal();
      const f = t.closest('[data-focus]');
      if (f) {
        s.todoPrefs.focus = f.dataset.focus;
        save();
        return App.refresh();
      }
      const all = t.closest('[data-all]');
      if (all) {
        const open = all.dataset.all === 'open';
        todos().forEach((x) => todoKids(x.id).length && (x.collapsed = !open || (!!x.done && !s.todoPrefs.showDone)));
        save();
        return App.refresh();
      }
      const item = itemOf(t);
      if (!item) return;
      if (t.closest('[data-tw]')) {
        item.collapsed = !item.collapsed;
        save();
        return App.refresh();
      }
      if (t.closest('[data-addkid]')) {
        const kid = newTodo('', item.id);
        const kids = todoKids(item.id);
        todos().splice(kids.length ? todos().indexOf(kids[kids.length - 1]) + 1 : todos().length, 0, kid);
        item.collapsed = false;
        if (item.done) item.done = null;
        return refreshAndFocus(todoSel(kid.id));
      }
      const mb = t.closest('[data-menu]');
      if (mb) return todoMenu(mb, item);
    });

    el.addEventListener('change', (e) => {
      if (e.target.matches('[data-showdone]')) {
        s.todoPrefs.showDone = e.target.checked;
        save();
        return App.refresh();
      }
      if (e.target.matches('[data-check]')) {
        const item = itemOf(e.target);
        setTodoDone(item, e.target.checked);
        if (e.target.checked && !s.todoPrefs.showDone) {
          // let the tick register before the row leaves
          e.target.closest('.td').classList.add('leaving');
          save();
          return setTimeout(() => App.refresh(), 380);
        }
        save();
        App.refresh();
      }
    });

    /* ---- editing text ---- */
    const saveTitle = debounce((item, node) => {
      item.title = editText(node);
      save();
    }, 250);
    el.addEventListener('input', (e) => {
      if (e.target.matches('.td-title')) saveTitle(itemOf(e.target), e.target);
    });
    el.addEventListener('focusout', (e) => {
      if (!e.target.matches('.td-title')) return;
      const item = itemOf(e.target);
      if (!item) return;
      item.title = editText(e.target);
      // an item left blank disappears quietly
      if (!item.title && !todoKids(item.id).length) {
        S().todo = todos().filter((x) => x !== item);
        e.target.closest('.td').remove();
      }
      save();
    });

    el.addEventListener('keydown', (e) => {
      const ed = e.target.closest('.td-title');
      if (!ed) return;
      const item = itemOf(ed);
      item.title = editText(ed);
      const go = (fn, sel = todoSel(item.id), atStart = false) => {
        e.preventDefault();
        if (fn() === false) return;
        save();
        refreshAndFocus(sel, atStart);
      };
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setTodoDone(item, !item.done);
        save();
        return refreshAndFocus(todoSel(item.id));
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!item.title && item.parent) return go(() => outdentTodo(item));
        const kids = todoKids(item.id);
        const fresh = kids.length && !item.collapsed ? newTodo('', item.id) : newTodo('', item.parent);
        if (caretAtStart(ed) && item.title && fresh.parent === item.parent) {
          todos().splice(todos().indexOf(item), 0, fresh);
          save();
          return refreshAndFocus(todoSel(item.id), true);
        }
        todos().splice(fresh.parent === item.id ? todos().indexOf(kids[0]) : todos().indexOf(item) + 1, 0, fresh);
        save();
        return refreshAndFocus(todoSel(fresh.id));
      }
      if (e.key === 'Tab') return go(() => (e.shiftKey ? outdentTodo(item) : indentTodo(item)));
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return go(() => shiftTodo(item, e.key === 'ArrowUp' ? -1 : 1));
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const list = visibleTitles(el);
        const next = list[list.indexOf(ed) + (e.key === 'ArrowUp' ? -1 : 1)];
        const sel = getSelection();
        // only jump rows when the caret is on the first/last line of a wrapped title
        const r = sel.rangeCount && sel.getRangeAt(0).getBoundingClientRect();
        const box = ed.getBoundingClientRect();
        const edge = !r || !r.height || (e.key === 'ArrowUp' ? r.top - box.top < 8 : box.bottom - r.bottom < 8);
        if (next && edge) {
          e.preventDefault();
          focusEdit(next);
        }
        return;
      }
      if (e.key === 'Backspace' && !item.title && !todoKids(item.id).length) {
        e.preventDefault();
        const list = visibleTitles(el);
        const prev = list[list.indexOf(ed) - 1];
        const prevId = prev && itemOf(prev)?.id;
        S().todo = todos().filter((x) => x !== item);
        save();
        return refreshAndFocus(prevId && todoSel(prevId));
      }
      if (e.key === 'Escape') ed.blur();
    });

    // pasting several lines makes several items
    el.addEventListener('paste', (e) => {
      const ed = e.target.closest('.td-title');
      const text = e.clipboardData?.getData('text/plain') || '';
      if (!ed || !text.includes('\n')) return;
      e.preventDefault();
      const item = itemOf(ed);
      const rows = parseLooseOutline(text);
      if (!rows.length) return;
      let at = todos().indexOf(item) + 1;
      if (!editText(ed)) {
        // an empty row takes the first pasted line
        item.title = rows[0].title;
        item.done = rows[0].done;
        const rest = rows.slice(1);
        if (rest.length && rest[0].depth > 0) {
          insertOutline(rest.map((r) => ({ ...r, depth: r.depth - 1 })).map((r) => ({ ...r, depth: Math.max(0, r.depth) })), item.id);
          save();
          return refreshAndFocus(todoSel(item.id));
        }
        rows.shift();
      }
      const made = insertOutline(rows, item.parent, at);
      save();
      toast(`Added ${plural(made.length, 'item')}.`, 'ok');
      refreshAndFocus(todoSel(made[made.length - 1].id));
    });

    /* ---- drag and drop ---- */
    let dragId = null;
    const clearMarks = () => $$('.drop-before, .drop-after, .drop-inside', el).forEach((n) => n.classList.remove('drop-before', 'drop-after', 'drop-inside'));
    const zone = (row, y) => {
      const r = row.getBoundingClientRect();
      const f = (y - r.top) / r.height;
      return f < 0.3 ? 'before' : f > 0.7 ? 'after' : 'inside';
    };
    el.addEventListener('dragstart', (e) => {
      const row = e.target.closest?.('.td-row');
      if (!row || e.target.closest('.ed')) return;
      dragId = row.parentElement.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', todoById(dragId).title);
      e.dataTransfer.setData('application/x-todo', dragId);
      requestAnimationFrame(() => row.classList.add('dragging'));
    });
    el.addEventListener('dragend', () => {
      dragId = null;
      clearMarks();
      $$('.dragging', el).forEach((n) => n.classList.remove('dragging'));
    });
    el.addEventListener('dragover', (e) => {
      const row = e.target.closest('.td-row');
      if (!dragId || !row) return;
      e.preventDefault();
      clearMarks();
      row.classList.add(`drop-${zone(row, e.clientY)}`);
    });
    el.addEventListener('drop', (e) => {
      const row = e.target.closest('.td-row');
      if (!dragId || !row) return;
      e.preventDefault();
      const item = todoById(dragId);
      if (moveTodo(item, todoById(row.parentElement.dataset.id), zone(row, e.clientY))) {
        TodoUI.flash = item.id;
        save();
        App.refresh();
      }
    });

    /* ---- add bar ---- */
    const form = $('#td-add', el);
    enterSubmits(form);
    form.parent.addEventListener('change', () => (TodoUI.addParent = form.parent.value || null));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = form.title.value;
      if (!text.trim()) return;
      const parent = form.parent.value || null;
      const made = insertOutline(parseLooseOutline(text), parent);
      TodoUI.addParent = parent;
      TodoUI.flash = made[0]?.id;
      if (s.todoPrefs.focus && parent && !todoAncestors(todoById(parent)).concat(todoById(parent)).some((a) => a.id === s.todoPrefs.focus)) s.todoPrefs.focus = '';
      save();
      App.refresh();
      $('#td-add input', App.viewEl).focus();
    });
    form.title.addEventListener('paste', (e) => {
      const text = e.clipboardData?.getData('text/plain') || '';
      if (!text.includes('\n')) return;
      e.preventDefault();
      pasteListModal(text, form.parent.value);
    });

    const flashed = $('.td.flash', el);
    flashed?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
};

function todoMenu(anchor, item) {
  const blocks = blocksFor(scheduleToday());
  const kids = todoKids(item.id).length;
  const sibs = todoKids(item.parent);
  const i = sibs.indexOf(item);
  openMenu(anchor, `
    <div class="pop-sec">
      <div class="pop-label">Put on today’s schedule</div>
      <div class="pop-blocks">${blocks.map((b) => `<button data-to-block="${b.id}"><span class="num">${fmtTime(b.time)}</span>${esc(b.title || 'Untitled')}</button>`).join('') || '<span class="muted small">No blocks today yet.</span>'}</div>
    </div>
    <div class="pop-sec pop-grid">
      <label>Due date<input type="date" data-due value="${item.due || ''}"></label>
      <label>Link<input type="url" data-url value="${esc(item.url || '')}" placeholder="https://"></label>
    </div>
    <div class="pop-sec pop-row">
      <button data-m="up" ${i > 0 ? '' : 'disabled'}>${icon('left', 14)}<span>Move up</span></button>
      <button data-m="down" ${i < sibs.length - 1 ? '' : 'disabled'}>${icon('right', 14)}<span>Move down</span></button>
      <button data-m="in" ${i > 0 ? '' : 'disabled'}><span>Move inside the item above</span></button>
      <button data-m="out" ${item.parent ? '' : 'disabled'}><span>Move out one level</span></button>
    </div>
    <div class="pop-sec">
      ${kids ? `<button data-m="focus">Show only this</button>` : ''}
      <button data-m="del" class="pop-danger">Delete${kids ? ` with ${plural(todoDescendants(item.id).length, 'item')} inside` : ''}</button>
    </div>`, (m) => {
    $$('.pop-row [data-m="up"] svg, .pop-row [data-m="down"] svg', m).forEach((svg) => svg.classList.add('rot'));
    m.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.toBlock) {
        const day = scheduleToday();
        const list = (S().scheduleExtra[day] ||= []);
        const existing = list.find((x) => x.todoId === item.id);
        if (existing) existing.blockId = b.dataset.toBlock;
        else list.push({ id: uid(), blockId: b.dataset.toBlock, title: item.title, todoId: item.id });
        const blk = S().schedule.find((x) => x.id === b.dataset.toBlock);
        toast(`Added to ${blk.title || 'the block'} at ${fmtTime(blk.time)}.`, 'ok');
      }
      const m2 = b.dataset.m;
      if (m2 === 'up') shiftTodo(item, -1);
      if (m2 === 'down') shiftTodo(item, 1);
      if (m2 === 'in') indentTodo(item);
      if (m2 === 'out') outdentTodo(item);
      if (m2 === 'focus') S().todoPrefs.focus = item.id;
      closeMenu();
      if (m2 === 'del') return deleteTodo(item);
      TodoUI.flash = item.id;
      Store.save();
      App.refresh();
    });
    m.addEventListener('change', (e) => {
      if (e.target.matches('[data-due]')) item.due = e.target.value || null;
      if (e.target.matches('[data-url]')) item.url = /^https?:\/\//i.test(e.target.value.trim()) ? e.target.value.trim() : null;
      Store.save();
      App.refresh();
    });
  });
}

function pasteListModal(prefill = '', parent = S().todoPrefs.focus || '') {
  const opts = todos()
    .filter((x) => todoKids(x.id).length || !x.parent)
    .map((x) => `<option value="${x.id}" ${x.id === parent ? 'selected' : ''}>${' '.repeat(todoAncestors(x).length)}${esc(x.title)}</option>`)
    .join('');
  openModal('Paste a list', `
    <form class="form" id="paste-form">
      <label>Your list<textarea name="text" rows="10" placeholder="One item per line. Indent a line to put it inside the one above.\n\nApply to jobs\n  Job 1\n  Job 2">${esc(prefill)}</textarea></label>
      <label>Add it to<select name="parent"><option value="">Top of the list</option>${opts}</select></label>
      <p class="hint" id="paste-count"></p>
      <div class="form-actions"><button class="btn primary">Add items</button><button type="button" class="btn ghost" data-close>Cancel</button></div>
    </form>`, {
    onMount(m) {
      const f = $('#paste-form', m);
      const count = () => {
        const n = parseLooseOutline(f.text.value).length;
        $('#paste-count', m).textContent = n ? `${plural(n, 'item')} will be added. Bullets, [ ] and [x] are understood.` : '';
      };
      f.text.addEventListener('input', count);
      count();
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const rows = parseLooseOutline(f.text.value);
        if (!rows.length) return;
        const made = insertOutline(rows, f.parent.value || null);
        TodoUI.flash = made[0].id;
        Store.save();
        closeModal();
        toast(`Added ${plural(made.length, 'item')}.`, 'ok');
        if (location.hash.startsWith('#/todo')) App.refresh();
        else location.hash = '#/todo';
      });
    },
  });
}

/* ==========================================================================
   Schedule — your day in time blocks, each with a short checklist
   ========================================================================== */
const SchedUI = { date: null, showOff: false, flash: null };

function scheduleToday() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() < DAY_START ? addDays(todayStr(), -1) : todayStr();
}
const dayMin = (time) => {
  const [h, m] = time.split(':').map(Number);
  const v = h * 60 + m;
  return v < DAY_START ? v + 1440 : v;
};
function nowMin() {
  const d = new Date();
  const v = d.getHours() * 60 + d.getMinutes();
  return v < DAY_START ? v + 1440 : v;
}
function blocksFor(date, all = false) {
  const wd = parseYmd(date).getDay();
  return S().schedule.filter((b) => all || b.days.includes(wd)).sort((a, b) => dayMin(a.time) - dayMin(b.time));
}
/** Steps for a block on a date: the repeating ones plus anything added for that day only. */
function blockSteps(b, date) {
  const s = S();
  const doneIds = s.scheduleDone[date] || [];
  const extra = (s.scheduleExtra[date] || []).filter((x) => x.blockId === b.id);
  return [
    ...b.items.map((i) => ({ id: i.id, title: i.title, kind: 'repeat', done: doneIds.includes(i.id) })),
    ...extra.map((x) => {
      const todo = x.todoId && todoById(x.todoId);
      return { id: x.id, title: todo ? todo.title : x.title, kind: todo ? 'todo' : 'once', todo, done: todo ? !!todo.done : doneIds.includes(x.id) };
    }),
  ];
}
function dayProgress(date) {
  const steps = blocksFor(date).flatMap((b) => blockSteps(b, date));
  return { total: steps.length, done: steps.filter((x) => x.done).length };
}
function fmtDur(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}
const DAYS_ALL = [0, 1, 2, 3, 4, 5, 6];
function daysLabel(days) {
  const d = [...days].sort();
  if (d.length === 7) return 'Every day';
  if (d.join() === '1,2,3,4,5') return 'Weekdays';
  if (d.join() === '0,6') return 'Weekends';
  return d.map((x) => WEEKDAYS[x]).join(', ');
}

/** Where the day stands right now: the running block, the next one, time left. */
function scheduleNow() {
  const date = scheduleToday();
  const blocks = blocksFor(date);
  const n = nowMin();
  let idx = -1;
  blocks.forEach((b, i) => dayMin(b.time) <= n && (idx = i));
  const cur = blocks[idx] || null;
  const next = blocks[idx + 1] || null;
  const start = cur ? dayMin(cur.time) : null;
  const end = next ? dayMin(next.time) : DAY_START + 1440;
  return { date, blocks, cur, next, n, start, end, left: end - n, pct: cur ? Math.round(((n - start) / (end - start)) * 100) : 0 };
}

function toggleStep(date, blockId, stepId, on) {
  const s = S();
  const step = blockSteps(s.schedule.find((b) => b.id === blockId), date).find((x) => x.id === stepId);
  if (!step) return;
  if (step.todo) setTodoDone(step.todo, on);
  else {
    const list = (s.scheduleDone[date] ||= []);
    const i = list.indexOf(stepId);
    if (on && i < 0) list.push(stepId);
    if (!on && i >= 0) list.splice(i, 1);
  }
  Store.save();
}

function stepList(b, date, { editable: canEdit = true } = {}) {
  const steps = blockSteps(b, date);
  return `<ul class="steps">${steps.map((x) => `
    <li class="step ${x.done ? 'done' : ''}" data-step="${x.id}" data-kind="${x.kind}">
      <input type="checkbox" data-scheck data-block="${b.id}" data-date="${date}" data-step-id="${x.id}" ${x.done ? 'checked' : ''} aria-label="Mark ${esc(x.title)} done">
      ${canEdit ? editable('step-title', x.title, 'aria-label="Step"', 'Name this step') : `<span class="step-title">${esc(x.title)}</span>`}
      ${x.kind === 'todo' ? `<a class="tag" href="#/todo?item=${x.todo.id}" title="${esc(todoPath(x.todo))}">To-do</a>` : x.kind === 'once' ? `<span class="tag">This day only</span>` : ''}
      ${canEdit ? `<button class="icon-btn sm reveal" data-sdel aria-label="Remove ${esc(x.title)}">${icon('close', 14)}</button>` : ''}
    </li>`).join('')}</ul>`;
}

/** The "right now" card, shared by the schedule and the Today page. */
function nowCard({ compact = false } = {}) {
  const now = scheduleNow();
  if (!now.blocks.length) {
    return `<section class="panel now-card"><div class="now-top"><span class="now-label">Right now</span></div><p class="muted">No time blocks yet. <a href="#/schedule">Plan your day</a>.</p></section>`;
  }
  if (!now.cur) {
    const first = now.blocks[0];
    return `<section class="panel now-card"><div class="now-top"><span class="now-label">Coming up</span>${compact ? '<a class="quiet-link" href="#/schedule">Schedule</a>' : ''}</div>
      <h2 class="now-title">${esc(first.title || 'Untitled')}</h2>
      <p class="now-sub">Starts at ${fmtTime(first.time)}, in ${fmtDur(dayMin(first.time) - now.n)}.</p></section>`;
  }
  const steps = blockSteps(now.cur, now.date);
  const open = steps.filter((x) => !x.done).length;
  return `
  <section class="panel now-card live">
    <div class="now-top"><span class="now-label"><i class="now-dot"></i>Right now</span>${compact ? '<a class="quiet-link" href="#/schedule">Full schedule</a>' : ''}</div>
    <h2 class="now-title">${esc(now.cur.title || 'Untitled')}</h2>
    <p class="now-sub">${fmtTime(now.cur.time)} to ${now.next ? fmtTime(now.next.time) : 'end of day'} · <strong>${fmtDur(now.left)} left</strong>${steps.length ? ` · ${open ? `${open} of ${steps.length} steps to go` : 'all steps done'}` : ''}</p>
    ${progressBar(now.pct)}
    ${compact && steps.length ? stepList(now.cur, now.date, { editable: false }) : ''}
    ${now.next ? `<p class="now-next">Next: <strong>${esc(now.next.title || 'Untitled')}</strong> at ${fmtTime(now.next.time)}</p>` : ''}
  </section>`;
}

/** Keep "right now" fresh while a page shows it, without disturbing typing. */
function startNowTicker(viewName) {
  const id = setInterval(() => {
    if (App.current?.name !== viewName) return clearInterval(id);
    const a = document.activeElement;
    if (a && a !== document.body && App.viewEl.contains(a) && a.matches('input:not([type="checkbox"]), select, textarea, .ed')) return;
    if ($('.pop') || $('.modal-backdrop')) return;
    App.refresh();
  }, 30000);
  return () => clearInterval(id);
}

const BLOCK_IDEAS = ['Wake up', 'Gym', 'Breakfast', 'Lunch', 'Class', 'Study', 'LeetCode', 'Job applications', 'Languages', 'Dinner', 'Wind down', 'Sleep'];

Views.schedule = {
  title: 'Schedule',

  render(_, query) {
    const s = S();
    if (query.date && SchedUI._q !== query.date) SchedUI.date = SchedUI._q = query.date;
    const d = (SchedUI.date ||= scheduleToday());
    const today = scheduleToday();
    const isToday = d === today;
    const blocks = blocksFor(d, SchedUI.showOff);
    const offCount = s.schedule.length - blocksFor(d).length;
    const wd = parseYmd(d).getDay();
    const now = isToday ? scheduleNow() : null;
    const prog = dayProgress(d);

    const dow = (wd + 6) % 7;
    const monday = addDays(d, -dow);
    const week = [...Array(7)].map((_, i) => {
      const day = addDays(monday, i);
      return { day, ...dayProgress(day) };
    });

    const last = blocks[blocks.length - 1];
    const suggest = last ? `${String(Math.floor(((dayMin(last.time) + 60) % 1440) / 60)).padStart(2, '0')}:${last.time.slice(3)}` : '09:00';

    const blockHtml = (b, i) => {
      const off = !b.days.includes(wd);
      const nextB = blocks.slice(i + 1).find((x) => x.days.includes(wd));
      const len = off ? null : (nextB ? dayMin(nextB.time) : DAY_START + 1440) - dayMin(b.time);
      const steps = blockSteps(b, d);
      const done = steps.filter((x) => x.done).length;
      const isNow = now?.cur?.id === b.id;
      const past = isToday && !isNow && !off && now && dayMin(b.time) < now.n;
      return `
      <li class="blk ${isNow ? 'now' : ''} ${past ? 'past' : ''} ${off ? 'off' : ''} ${SchedUI.flash === b.id ? 'flash' : ''}" data-block="${b.id}">
        <div class="blk-time">
          <input type="time" value="${b.time}" data-btime aria-label="Start time for ${esc(b.title || 'this block')}" step="300">
          ${len && len < 1440 ? `<span class="blk-dur">${fmtDur(len)}</span>` : ''}
        </div>
        <div class="blk-card">
          ${isNow ? `<div class="blk-now" style="--pct:${now.pct}%"><span class="sr-only">${now.pct}% through this block</span></div>` : ''}
          <div class="blk-head">
            ${editable('blk-title', b.title, `aria-label="Block name"`, 'Name this block')}
            ${isNow ? `<span class="tag solid">Now · ${fmtDur(now.left)} left</span>` : ''}
            ${b.days.length < 7 ? `<button class="tag tag-btn" data-bmenu title="Change which days this repeats">${off ? 'Not on ' + WEEKDAYS[wd] + 's · ' : ''}${daysLabel(b.days)}</button>` : ''}
            ${steps.length ? `<span class="blk-count num" aria-label="${done} of ${steps.length} steps done">${done}/${steps.length}</span>` : ''}
            <button class="icon-btn sm" data-bmenu aria-label="Options for ${esc(b.title || 'this block')}" aria-haspopup="menu">${icon('more', 16)}</button>
          </div>
          ${steps.length ? stepList(b, d) : ''}
          <div class="step-add">
            ${icon('plus', 15)}
            <input data-stepadd placeholder="Add a step" aria-label="Add a step to ${esc(b.title || 'this block')}" autocomplete="off">
            <button class="btn sm ghost" data-fromtodo>${icon('list', 15)}From to-do</button>
          </div>
        </div>
      </li>`;
    };
    SchedUI.flash = null;

    const leaves = openLeaves();
    const linked = new Set((s.scheduleExtra[d] || []).map((x) => x.todoId).filter(Boolean));
    const upNext = leaves.filter((x) => !linked.has(x.id)).slice(0, 8);
    const rDone = s.routineDone[d] || [];

    return `
    <header class="page-head">
      <div><h1>${isToday ? 'Today’s schedule' : fmtDate(d, { weekday: 'long' })}</h1><p class="lede">${fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}. ${prog.total ? `${prog.done} of ${plural(prog.total, 'step')} done.` : 'Add a time block to start planning.'}</p></div>
      <div class="head-actions">
        <button class="icon-btn" data-day="-1" aria-label="Previous day">${icon('left')}</button>
        <input type="date" class="compact" value="${d}" data-pick aria-label="Pick a date">
        <button class="icon-btn" data-day="1" aria-label="Next day">${icon('right')}</button>
        ${isToday ? '' : '<button class="btn sm" data-day="0">Back to today</button>'}
      </div>
    </header>

    <div class="week-strip">
      ${week.map((w) => `
        <button class="week-day ${w.day === d ? 'active' : ''} ${w.day === today ? 'today' : ''}" data-goto="${w.day}" aria-label="${fmtDate(w.day, { weekday: 'long', month: 'long', day: 'numeric' })}, ${w.done} of ${w.total} steps done">
          <span class="wd-name">${fmtDate(w.day, { weekday: 'short' })}</span>
          <span class="wd-num">${parseYmd(w.day).getDate()}</span>
          <span class="wd-meta">${w.total ? `${w.done}/${w.total}` : '&nbsp;'}</span>
          ${progressBar(w.total ? Math.round((w.done / w.total) * 100) : 0)}
        </button>`).join('')}
    </div>

    <div class="grid-2 wide-left sched-layout">
      <section class="panel sched-panel">
        <header class="panel-head">
          <h2>Time blocks</h2>
          <div class="seg sm" role="radiogroup" aria-label="New steps">
            <label><input type="radio" name="scope" value="repeat" ${SchedUI.once ? '' : 'checked'}><span>New steps repeat</span></label>
            <label><input type="radio" name="scope" value="once" ${SchedUI.once ? 'checked' : ''}><span>Only ${isToday ? 'today' : fmtDate(d, { weekday: 'short' })}</span></label>
          </div>
        </header>
        <ol class="sched">${blocks.map(blockHtml).join('') || '<li class="rows-empty">No time blocks on this day yet.</li>'}</ol>
        ${offCount ? `<button class="linklike small muted sched-off" data-showoff>${SchedUI.showOff ? 'Hide' : 'Show'} ${plural(offCount, 'block')} that ${offCount === 1 ? 'doesn’t' : 'don’t'} repeat on ${WEEKDAYS[wd]}s</button>` : ''}

        <form class="blk-add" id="blk-add">
          <input type="time" name="time" value="${suggest}" aria-label="Start time" required step="300">
          <input name="title" placeholder="New block, like “Study” or “Lunch”" aria-label="Block name" autocomplete="off" required>
          <button class="btn primary">${icon('plus', 16)}Add block</button>
        </form>
        <div class="chips blk-ideas">${BLOCK_IDEAS.map((x) => `<button class="chip" type="button" data-idea="${x}">${x}</button>`).join('')}</div>
        <p class="hint">Click a time or name to change it. Blocks sort themselves by time, and each one runs until the next starts.</p>
      </section>

      <aside class="stack">
        ${isToday ? nowCard() : ''}
        <section class="panel">
          <header class="panel-head"><h2>Next from your to-do list</h2><a class="quiet-link" href="#/todo">All</a></header>
          <p class="hint">Drag one onto a block, or use the clock to add it to the block that’s on now.</p>
          <ul class="rows compact up-next">
            ${upNext.map((x) => `
              <li class="row" draggable="true" data-todo="${x.id}">
                <span class="td-grip">${icon('grip', 14)}</span>
                <span class="row-main static"><span class="row-title">${esc(x.title)}</span><span class="row-meta">${esc(todoPath(x))}</span></span>
                <button class="icon-btn sm" data-pickblock="${x.id}" aria-label="Add ${esc(x.title)} to a block" aria-haspopup="menu">${icon('clock', 16)}</button>
              </li>`).join('') || '<li class="rows-empty">Your to-do list is clear.</li>'}
          </ul>
        </section>
        <section class="panel">
          <header class="panel-head"><h2>Daily habits</h2><a class="quiet-link" href="#/tasks?date=${d}">Edit</a></header>
          ${progressBar(s.routines.length ? Math.round((rDone.length / s.routines.length) * 100) : 0)}
          <ul class="rows compact routine">
            ${s.routines.map((r) => `<li class="row task-row ${rDone.includes(r.id) ? 'done' : ''}"><label class="check grow"><input type="checkbox" data-habit="${r.id}" ${rDone.includes(r.id) ? 'checked' : ''}><span class="row-title">${esc(r.title)}</span></label></li>`).join('')}
          </ul>
        </section>
      </aside>
    </div>`;
  },

  mount(el) {
    const s = S();
    const d = SchedUI.date;
    const blockOf = (n) => s.schedule.find((b) => b.id === n.closest('[data-block]')?.dataset.block);
    const save = () => Store.save();
    const setDate = (x) => {
      SchedUI.date = x;
      App.refresh();
    };
    const stepSel = (bid, sid) => `[data-block="${bid}"] [data-step="${sid}"] .step-title`;
    const addSel = (bid) => `[data-block="${bid}"] [data-stepadd]`;
    const addToBlock = (block, todo) => {
      const list = (s.scheduleExtra[d] ||= []);
      const had = list.find((x) => x.todoId === todo.id);
      if (had) had.blockId = block.id;
      else list.push({ id: uid(), blockId: block.id, title: todo.title, todoId: todo.id });
      SchedUI.flash = block.id;
      save();
      App.refresh();
    };

    el.addEventListener('click', (e) => {
      const t = e.target;
      const nav = t.closest('[data-day]');
      if (nav) return setDate(+nav.dataset.day === 0 ? scheduleToday() : addDays(d, +nav.dataset.day));
      const g = t.closest('[data-goto]');
      if (g) return setDate(g.dataset.goto);
      if (t.closest('[data-showoff]')) {
        SchedUI.showOff = !SchedUI.showOff;
        return App.refresh();
      }
      const idea = t.closest('[data-idea]');
      if (idea) {
        const f = $('#blk-add', el);
        f.title.value = idea.dataset.idea;
        return f.requestSubmit();
      }
      const pick = t.closest('[data-pickblock]');
      if (pick) {
        const todo = todoById(pick.dataset.pickblock);
        const blocks = blocksFor(d);
        const cur = d === scheduleToday() ? scheduleNow().cur : null;
        return openMenu(pick, `<div class="pop-sec"><div class="pop-label">Add to which block?</div><div class="pop-blocks">${blocks.map((b) => `<button data-to="${b.id}"><span class="num">${fmtTime(b.time)}</span>${esc(b.title || 'Untitled')}${b === cur ? ' <span class="tag solid">Now</span>' : ''}</button>`).join('')}</div></div>`, (m) =>
          m.addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-to]');
            if (!b) return;
            closeMenu();
            addToBlock(s.schedule.find((x) => x.id === b.dataset.to), todo);
          }));
      }
      const block = blockOf(t);
      if (!block) return;
      if (t.closest('[data-bmenu]')) return blockMenu(t.closest('[data-bmenu]'), block);
      if (t.closest('[data-fromtodo]')) return fromTodoModal(block, d, (todo) => addToBlock(block, todo));
      const del = t.closest('[data-sdel]');
      if (del) {
        const li = del.closest('[data-step]');
        const sid = li.dataset.step;
        if (li.dataset.kind === 'repeat') {
          const at = block.items.findIndex((x) => x.id === sid);
          const [gone] = block.items.splice(at, 1);
          save();
          App.refresh();
          return undoToast(`Removed “${gone.title}” from every ${block.days.length === 7 ? 'day' : 'repeat'}`, () => {
            block.items.splice(at, 0, gone);
            save();
            App.refresh();
          });
        }
        s.scheduleExtra[d] = (s.scheduleExtra[d] || []).filter((x) => x.id !== sid);
        save();
        return App.refresh();
      }
    });

    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.matches('[data-pick]') && t.value) return setDate(t.value);
      if (t.name === 'scope') {
        SchedUI.once = t.value === 'once';
        return;
      }
      if (t.matches('[data-scheck]')) {
        toggleStep(t.dataset.date, t.dataset.block, t.dataset.stepId, t.checked);
        return App.refresh();
      }
      if (t.matches('[data-habit]')) {
        const list = (s.routineDone[d] ||= []);
        const i = list.indexOf(t.dataset.habit);
        i >= 0 ? list.splice(i, 1) : list.push(t.dataset.habit);
        save();
        return App.refresh();
      }
      if (t.matches('[data-btime]') && t.value) {
        blockOf(t).time = t.value;
        save();
      }
    });
    // re-sort once the time field is left, so the block doesn't jump while typing
    el.addEventListener('focusout', (e) => {
      const t = e.target;
      if (t.matches('[data-btime]')) {
        const b = blockOf(t);
        const order = $$('[data-block]', el).map((n) => n.dataset.block).join();
        const want = blocksFor(d, SchedUI.showOff).map((x) => x.id).join();
        if (order !== want || t.value !== b.time) {
          SchedUI.flash = b.id;
          setTimeout(() => !el.contains(document.activeElement) || !document.activeElement.matches('[data-btime]') ? App.refresh() : null, 0);
        }
        return;
      }
      if (t.matches('.blk-title')) {
        blockOf(t).title = editText(t);
        save();
      }
      if (t.matches('.step-title')) saveStepTitle(t);
    });

    const saveStepTitle = (node) => {
      const block = blockOf(node);
      const li = node.closest('[data-step]');
      const title = editText(node);
      if (!title) return;
      if (li.dataset.kind === 'repeat') block.items.find((x) => x.id === li.dataset.step).title = title;
      else {
        const x = (s.scheduleExtra[d] || []).find((y) => y.id === li.dataset.step);
        const todo = x.todoId && todoById(x.todoId);
        if (todo) todo.title = title;
        x.title = title;
      }
      save();
    };
    el.addEventListener('input', debounce((e) => {
      if (e.target.matches('.blk-title')) {
        blockOf(e.target).title = editText(e.target);
        save();
      }
    }, 250));

    el.addEventListener('keydown', (e) => {
      const t = e.target;
      const block = t.closest('[data-block]') && blockOf(t);
      if (!block) return;
      if (t.matches('.blk-title')) {
        if (e.key === 'Enter') {
          e.preventDefault();
          block.title = editText(t);
          save();
          $(addSel(block.id), el)?.focus();
        }
        if (e.key === 'Escape') t.blur();
        return;
      }
      if (t.matches('.step-title')) {
        const li = t.closest('[data-step]');
        if (e.key === 'Enter') {
          e.preventDefault();
          saveStepTitle(t);
          $(addSel(block.id), el)?.focus();
        } else if (e.key === 'Backspace' && !editText(t)) {
          e.preventDefault();
          const prev = li.previousElementSibling?.dataset.step;
          if (li.dataset.kind === 'repeat') block.items = block.items.filter((x) => x.id !== li.dataset.step);
          else s.scheduleExtra[d] = (s.scheduleExtra[d] || []).filter((x) => x.id !== li.dataset.step);
          save();
          refreshAndFocus(prev ? stepSel(block.id, prev) : null);
        } else if (e.key === 'Escape') t.blur();
        return;
      }
      if (t.matches('[data-stepadd]')) {
        if (e.key === 'Backspace' && !t.value) {
          const lastStep = $$(`[data-block="${block.id}"] .step-title`, el).pop();
          if (lastStep) {
            e.preventDefault();
            focusEdit(lastStep);
          }
        }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const titles = t.value.split(/\n/).map((x) => x.trim()).filter(Boolean);
        if (!titles.length) return;
        for (const title of titles) {
          if (SchedUI.once) (s.scheduleExtra[d] ||= []).push({ id: uid(), blockId: block.id, title, todoId: null });
          else block.items.push({ id: uid(), title });
        }
        save();
        App.refresh();
        $(addSel(block.id), App.viewEl)?.focus();
      }
    });

    /* ---- add block ---- */
    const form = $('#blk-add', el);
    enterSubmits(form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = form.title.value.trim();
      if (!title || !form.time.value) return;
      const b = { id: uid(), time: form.time.value, title, days: [...DAYS_ALL], items: [] };
      s.schedule.push(b);
      SchedUI.flash = b.id;
      save();
      App.refresh();
      $(addSel(b.id), App.viewEl)?.focus();
    });

    /* ---- drag a to-do onto a block ---- */
    el.addEventListener('dragstart', (e) => {
      const row = e.target.closest?.('[data-todo]');
      if (!row) return;
      e.dataTransfer.setData('application/x-todo', row.dataset.todo);
      e.dataTransfer.setData('text/plain', todoById(row.dataset.todo).title);
      e.dataTransfer.effectAllowed = 'copy';
      el.classList.add('dragging-todo');
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging-todo');
      $$('.blk.drop', el).forEach((n) => n.classList.remove('drop'));
    });
    el.addEventListener('dragover', (e) => {
      const blk = e.target.closest('.blk');
      if (!blk || !e.dataTransfer.types.includes('application/x-todo')) return;
      e.preventDefault();
      $$('.blk.drop', el).forEach((n) => n !== blk && n.classList.remove('drop'));
      blk.classList.add('drop');
    });
    el.addEventListener('drop', (e) => {
      const blk = e.target.closest('.blk');
      const id = e.dataTransfer.getData('application/x-todo');
      if (!blk || !id) return;
      e.preventDefault();
      addToBlock(blockOf(blk), todoById(id));
    });

    $('.blk.flash', el)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    this._stop = startNowTicker('schedule');
  },

  unmount() {
    this._stop?.();
  },
};

function blockMenu(anchor, block) {
  openMenu(anchor, `
    <div class="pop-sec">
      <div class="pop-label">Repeats on</div>
      <div class="pop-days">${WEEKDAYS.map((w, i) => `<button data-wd="${i}" aria-pressed="${block.days.includes(i)}">${w.slice(0, 2)}</button>`).join('')}</div>
      <div class="pop-row pop-presets">
        <button data-preset="all">Every day</button><button data-preset="wk">Weekdays</button><button data-preset="we">Weekends</button>
      </div>
    </div>
    <div class="pop-sec">
      <button data-b="dup">Duplicate block</button>
      <button data-b="clear" ${block.items.length ? '' : 'disabled'}>Clear its steps</button>
      <button data-b="del" class="pop-danger">Delete block</button>
    </div>`, (m) => {
    m.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const s = S();
      if (b.dataset.wd) {
        const i = +b.dataset.wd;
        const on = block.days.includes(i);
        if (on && block.days.length === 1) return toast('A block needs at least one day.', 'warn');
        block.days = on ? block.days.filter((x) => x !== i) : [...block.days, i].sort();
        b.setAttribute('aria-pressed', String(!on));
        Store.save();
        return App.refresh();
      }
      if (b.dataset.preset) {
        block.days = { all: [...DAYS_ALL], wk: [1, 2, 3, 4, 5], we: [0, 6] }[b.dataset.preset];
        $$('[data-wd]', m).forEach((x) => x.setAttribute('aria-pressed', String(block.days.includes(+x.dataset.wd))));
        Store.save();
        return App.refresh();
      }
      closeMenu();
      const at = s.schedule.indexOf(block);
      if (b.dataset.b === 'dup') {
        const copy = { ...block, id: uid(), title: `${block.title} (copy)`, days: [...block.days], items: block.items.map((x) => ({ id: uid(), title: x.title })) };
        s.schedule.splice(at + 1, 0, copy);
        SchedUI.flash = copy.id;
      }
      if (b.dataset.b === 'clear') {
        const items = block.items;
        block.items = [];
        undoToast(`Cleared ${plural(items.length, 'step')}`, () => {
          block.items = items;
          Store.save();
          App.refresh();
        });
      }
      if (b.dataset.b === 'del') {
        s.schedule.splice(at, 1);
        undoToast(`Deleted “${block.title || 'block'}”`, () => {
          s.schedule.splice(at, 0, block);
          Store.save();
          App.refresh();
        });
      }
      Store.save();
      App.refresh();
    });
  });
}

function fromTodoModal(block, date, onPick) {
  const draw = (q) => {
    q = q.trim().toLowerCase();
    const items = openLeaves().filter((x) => !q || x.title.toLowerCase().includes(q) || todoPath(x).toLowerCase().includes(q));
    return items.slice(0, 60).map((x) => `<li><button class="pick-row" data-pick="${x.id}"><span class="row-title">${esc(x.title)}</span><span class="row-meta">${esc(todoPath(x))}</span></button></li>`).join('') || '<li class="rows-empty">Nothing matches.</li>';
  };
  openModal(`Add to ${block.title || 'this block'} (${fmtTime(block.time)})`, `
    <input type="search" placeholder="Search your to-do list" aria-label="Search your to-do list" data-q autocomplete="off">
    <ul class="pick-list">${draw('')}</ul>
    <p class="hint">Checking it off here also checks it off in your to-do list.</p>`, {
    wide: true,
    onMount(m) {
      const list = $('.pick-list', m);
      $('[data-q]', m).addEventListener('input', (e) => (list.innerHTML = draw(e.target.value)));
      $('[data-q]', m).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('[data-pick]', list)?.click();
      });
      list.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pick]');
        if (!b) return;
        closeModal();
        onPick(todoById(b.dataset.pick));
      });
    },
  });
}
