/* ==========================================================================
   views-graph.js — Map: knowledge graph, skill tree, connections
   ========================================================================== */

const KIND_LABEL = { class: 'Class', topic: 'Topic', note: 'Note' };

function nodeLabel(id) {
  const [k, ref] = [id.slice(0, 1), id.slice(2)];
  if (k === 'c') return getClass(ref)?.name;
  if (k === 't') return getTopic(ref)?.name;
  if (k === 'n') return getNote(ref)?.title;
}

function openGraphNode(n) {
  openNodeRef(n.kind, n.ref);
}

function nodeSelectOptions(selected, includeNotes) {
  let h = '<option value="">Choose</option><optgroup label="Classes">';
  h += S().classes.map((c) => `<option value="c:${c.id}" ${selected === 'c:' + c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  h += '</optgroup>';
  for (const c of S().classes) {
    h += `<optgroup label="${esc(c.name)}">`;
    h += topicsOf(c.id).map((t) => `<option value="t:${t.id}" ${selected === 't:' + t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    h += '</optgroup>';
  }
  if (includeNotes) {
    h += '<optgroup label="Notes">';
    h += S().notes.map((n) => `<option value="n:${n.id}" ${selected === 'n:' + n.id ? 'selected' : ''}>${esc(n.title)}</option>`).join('');
    h += '</optgroup>';
  }
  return h;
}

const nodeMark = (n) => (n.kind === 'note' ? '<i class="mark mk-ring" aria-hidden="true"></i>' : mark(n.classId));

/* ------------------------------ Knowledge graph ------------------------------ */
const GraphUI = { hidden: new Set(), notes: true, labels: 'auto', selected: null };

Views.graph = {
  title: 'Graph',
  render() {
    const g = buildGraph({ includeNotes: GraphUI.notes });
    return `
    <div class="graph-page">
      <header class="graph-toolbar">
        <div class="chips" role="group" aria-label="Show classes">
          ${S().classes.map((c) => `<button class="chip toggle ${GraphUI.hidden.has(c.id) ? 'off' : ''}" data-cls="${c.id}" aria-pressed="${!GraphUI.hidden.has(c.id)}">${mark(c.id)}${esc(c.short || c.name)}</button>`).join('')}
          <button class="chip toggle ${GraphUI.hidden.has('') ? 'off' : ''}" data-cls="" aria-pressed="${!GraphUI.hidden.has('')}"><i class="mark mk-ring" aria-hidden="true"></i>No class</button>
        </div>
        <span class="spacer"></span>
        <input list="graph-nodes" class="compact graph-search" placeholder="Find on the map" aria-label="Find on the map">
        <datalist id="graph-nodes">${g.nodes.map((n) => `<option value="${esc(n.label)}">`).join('')}</datalist>
        <label class="check"><input type="checkbox" data-opt="notes" ${GraphUI.notes ? 'checked' : ''}> Notes</label>
        <select class="compact" data-opt="labels" aria-label="Labels">
          <option value="auto" ${GraphUI.labels === 'auto' ? 'selected' : ''}>Labels on zoom</option>
          <option value="all" ${GraphUI.labels === 'all' ? 'selected' : ''}>All labels</option>
          <option value="none" ${GraphUI.labels === 'none' ? 'selected' : ''}>No labels</option>
        </select>
        <button class="btn sm" data-act="fit">Fit</button>
        <button class="btn sm" data-act="shake">Rearrange</button>
      </header>
      <div class="graph-body">
        <div class="graph-wrap"><canvas aria-label="Map of classes, topics and notes. Use Find on the map or the side panel to move around."></canvas>
          <div class="graph-legend" aria-hidden="true">
            <span><i class="lg-node filled"></i>Known topic</span><span><i class="lg-node"></i>Not started</span><span><i class="lg-node note"></i>Note</span>
            <span><i class="lg-line"></i>Part of / learn first</span><span><i class="lg-line dash"></i>Across classes</span>
          </div>
        </div>
        <aside class="panel graph-info" aria-live="polite"></aside>
      </div>
    </div>`;
  },

  mount(el, _, query) {
    const canvas = $('canvas', el);
    const info = $('.graph-info', el);
    const visible = () => {
      const set = new Set(['', ...S().classes.map((c) => c.id)]);
      GraphUI.hidden.forEach((h) => set.delete(h));
      return set;
    };
    const fg = (this.fg = new ForceGraph(canvas, {
      labels: GraphUI.labels,
      onSelect: (n) => {
        GraphUI.selected = n?.id || null;
        info.innerHTML = this.info(n, fg);
      },
      onOpen: openGraphNode,
    }));
    const load = () => fg.setData(buildGraph({ includeNotes: GraphUI.notes, classFilter: visible() }));
    load();
    info.innerHTML = this.info(null, fg);

    const focus = query.focus || GraphUI.selected;
    setTimeout(() => {
      if (this.fg !== fg) return;
      fg.fit();
      if (focus && fg.byId.has(focus)) fg.focusNode(focus);
    }, 900);

    el.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cls]');
      if (c) {
        const id = c.dataset.cls;
        GraphUI.hidden.has(id) ? GraphUI.hidden.delete(id) : GraphUI.hidden.add(id);
        c.classList.toggle('off');
        c.setAttribute('aria-pressed', !GraphUI.hidden.has(id));
        load();
        return;
      }
      const f = e.target.closest('[data-focus]');
      if (f) return fg.focusNode(f.dataset.focus);
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'fit') fg.fit();
      if (act === 'shake') {
        fg.nodes.forEach((n) => {
          n.x = (Math.random() - 0.5) * 600;
          n.y = (Math.random() - 0.5) * 600;
        });
        fg.reheat(1);
        setTimeout(() => this.fg === fg && fg.fit(), 1200);
      }
      if (act === 'open' && fg.selected) openGraphNode(fg.selected);
    });
    el.addEventListener('change', (e) => {
      const o = e.target.dataset.opt;
      if (o === 'notes') {
        GraphUI.notes = e.target.checked;
        load();
      }
      if (o === 'labels') {
        GraphUI.labels = fg.labels = e.target.value;
        fg.draw();
      }
    });
    $('.graph-search', el).addEventListener('change', (e) => {
      const q = e.target.value.toLowerCase();
      if (!q) return;
      const n = fg.nodes.find((x) => x.label.toLowerCase() === q) || fg.nodes.find((x) => x.label.toLowerCase().includes(q));
      if (n) fg.focusNode(n.id);
      else toast('Nothing on the map matches that', 'warn');
    });
  },

  info(n, fg) {
    if (!n) {
      const top = fg.nodes.filter((x) => x.kind !== 'class').sort((a, b) => b.deg - a.deg).slice(0, 8);
      return `
        <h2>Overview</h2>
        <dl class="facts">
          <div><dt>Items</dt><dd>${fg.nodes.length}</dd></div>
          <div><dt>Links</dt><dd>${fg.edges.length}</dd></div>
          <div><dt>Across classes</dt><dd>${fg.edges.filter((e) => e.type === 'cross').length}</dd></div>
        </dl>
        <h3 class="sub">Most connected</h3>
        <ul class="rows compact">${top.map((x) => `<li class="row"><button class="row-main" data-focus="${x.id}"><span class="row-title">${nodeMark(x)}${esc(x.label)}</span></button><span class="num muted">${x.deg}</span></li>`).join('')}</ul>
        <p class="hint">Select anything to see what it connects to. Double-click to open it. Links come from topic order, <code>[[links]]</code> in notes, and <a href="#/connections">connections you add</a>.</p>`;
    }
    const nb = [...(fg.neighbors.get(n.id) || [])].map((id) => fg.byId.get(id)).filter(Boolean);
    const topic = n.kind === 'topic' ? getTopic(n.ref) : null;
    const note = n.kind === 'note' ? getNote(n.ref) : null;
    return `
      <p class="kind">${nodeMark(n)}${KIND_LABEL[n.kind]}${n.classId && n.kind !== 'class' ? ` in ${esc(className(n.classId))}` : ''}</p>
      <h2>${esc(n.label)}</h2>
      ${topic ? `<p class="hint">${esc(topic.desc || '')}</p><p class="mastery-line">${masteryPips(topic.mastery)}${MASTERY[topic.mastery].label}</p>` : ''}
      ${note ? `<p class="hint">${esc(stripMarkdown(note.body).replace(/\s+/g, ' ').slice(0, 180))}…</p>` : ''}
      <div class="btn-row">
        <button class="btn sm primary" data-act="open">Open</button>
        <a class="btn sm" href="#/connections?from=${n.id}">Find a path</a>
        ${topic ? `<a class="btn sm" href="#/assist?topic=${topic.id}">Ask ChatGPT</a><a class="btn sm" href="#/cards?tab=import&topic=${topic.id}">Make cards</a>` : ''}
      </div>
      <h3 class="sub">Connected to ${nb.length}</h3>
      <ul class="rows compact">${nb.map((x) => `<li class="row"><button class="row-main" data-focus="${x.id}"><span class="row-title">${nodeMark(x)}${esc(x.label)}</span></button><span class="muted small">${KIND_LABEL[x.kind]}</span></li>`).join('') || '<li class="rows-empty">Nothing yet.</li>'}</ul>`;
  },

  unmount() {
    this.fg?.destroy();
    this.fg = null;
  },
};

/* ------------------------------ Connections ------------------------------ */
const ConnUI = { from: 'c:os', to: 'c:urb', notes: false };

// [reading forward along the edge, reading it backward]
const EDGE_WORDS = {
  contains: ['includes', 'part of'],
  note: ['has note', 'note in'],
  prereq: ['leads to', 'builds on'],
  mention: ['mentions', 'mentioned in'],
  cross: ['related to', 'related to'],
};
const edgeWord = (edge, fromId) => (edge.type === 'cross' && edge.label) || EDGE_WORDS[edge.type][edge.source === fromId ? 0 : 1];

Views.connections = {
  title: 'Connections',
  render(_, query) {
    if (query.from && location.hash !== ConnUI._hash) {
      ConnUI._hash = location.hash;
      ConnUI.from = query.from;
      if (query.from.startsWith('n:')) ConnUI.notes = true;
      if (ConnUI.to === ConnUI.from) ConnUI.to = '';
    }
    const graph = buildGraph({ includeNotes: ConnUI.notes });
    const path = ConnUI.from && ConnUI.to ? shortestPath(graph, ConnUI.from, ConnUI.to) : null;
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));

    const cls = S().classes;
    const topicGraph = buildGraph({ includeNotes: false });
    const matrix = cls.map((a) => cls.map((b) => (a === b ? null : shortestPath(topicGraph, 'c:' + a.id, 'c:' + b.id)?.length - 1 || null)));

    const crossCount = new Map();
    const bump = (id) => crossCount.set(id, (crossCount.get(id) || 0) + 1);
    S().links.forEach((l) => {
      bump(l.a);
      bump(l.b);
    });
    S().topics.forEach((t) => t.prereqs.forEach((p) => {
      if (getTopic(p)?.classId !== t.classId) {
        bump(t.id);
        bump(p);
      }
    }));
    const bridges = [...crossCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    // transit-line rendering of the path
    const line = path
      ? `<ol class="line" aria-label="Path">${path.map((p, i) => {
          const n = byId.get(p.id);
          const edge = path[i + 1]?.via;
          return `
            <li class="stop ${n.kind}">
              <button class="stop-dot" data-open="${p.id}" aria-label="Open ${esc(n.label)}">${nodeMark(n)}</button>
              <button class="stop-label" data-open="${p.id}"><small>${KIND_LABEL[n.kind]}${n.kind !== 'class' && n.classId ? `, ${esc(getClass(n.classId)?.short || '')}` : ''}</small>${esc(n.label)}</button>
              ${edge ? `<span class="track ${edge.type}"><span>${esc(edgeWord(edge, p.id))}</span></span>` : ''}
            </li>`;
        }).join('')}</ol>`
      : '';

    return `
    <header class="page-head">
      <div><h1>How are these connected?</h1><p class="lede">Pick any two classes, topics or notes to see the shortest chain between them.</p></div>
    </header>

    <section class="panel">
      <div class="conn-pickers">
        <label>From<select data-c="from">${nodeSelectOptions(ConnUI.from, ConnUI.notes)}</select></label>
        <button class="icon-btn" data-act="swap" aria-label="Swap" title="Swap">${icon('swap')}</button>
        <label>To<select data-c="to">${nodeSelectOptions(ConnUI.to, ConnUI.notes)}</select></label>
        <button class="btn" data-act="random">${icon('shuffle', 16)}Surprise me</button>
        <label class="check"><input type="checkbox" data-c="notes" ${ConnUI.notes ? 'checked' : ''}> Include notes</label>
      </div>

      ${!ConnUI.from || !ConnUI.to ? '<p class="hint">Pick two things above.</p>'
        : !path ? `<div class="callout">These aren’t connected yet. Link two topics below, or mention one in a note with <code>[[Topic name]]</code>.</div>`
        : `
        <div class="degrees">
          <p class="degrees-num"><span class="num">${path.length - 1}</span> ${path.length - 1 === 1 ? 'step' : 'steps'} apart</p>
          ${line}
          <button class="btn" data-act="explain-path">Ask ChatGPT to explain this chain ${icon('external', 15)}</button>
        </div>`}
      <div class="graph-wrap mini"><canvas aria-hidden="true"></canvas></div>
    </section>

    <div class="grid-2">
      <section class="panel">
        <header class="panel-head"><h2>Steps between classes</h2></header>
        <div class="table-wrap"><table class="table matrix">
          <thead><tr><th><span class="sr-only">From</span></th>${cls.map((c) => `<th title="${esc(c.name)}">${mark(c.id)}${esc(c.short || c.name)}</th>`).join('')}</tr></thead>
          <tbody>${cls.map((a, i) => `<tr><th>${mark(a.id)}${esc(a.short || a.name)}</th>${matrix[i].map((v, j) => `<td>${i === j ? '<span class="muted">·</span>' : v === null ? '<span class="muted">none</span>' : `<button class="linklike num" data-pair="c:${a.id}|c:${cls[j].id}" aria-label="${esc(a.name)} to ${esc(cls[j].name)}: ${v} steps">${v}</button>`}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        <p class="hint">Counted through topics and links, not notes. Select a number to see the chain.</p>

        <h3 class="sub">Topics that bridge classes</h3>
        <ul class="rows compact">${bridges.map(([id, n]) => {
          const t = getTopic(id);
          return t ? `<li class="row"><button class="row-main" data-open="t:${id}"><span class="row-title">${mark(t.classId)}${esc(t.name)}</span></button><span class="muted small">${plural(n, 'link')}</span></li>` : '';
        }).join('') || '<li class="rows-empty">None yet.</li>'}</ul>
      </section>

      <section class="panel">
        <header class="panel-head"><h2>Links across classes</h2></header>
        <form class="form" id="link-form">
          <div class="form-row">
            <label>Topic<select name="a" required>${topicOptions(null, '', { noneLabel: 'Choose' })}</select></label>
            <label>Related topic<select name="b" required>${topicOptions(null, '', { noneLabel: 'Choose' })}</select></label>
          </div>
          <div class="form-row">
            <label>How they relate<input name="label" placeholder="Both are about permissions"></label>
            <button class="btn primary">Link topics</button>
          </div>
        </form>
        <ul class="rows compact">
          ${S().links.map((l) => {
            const a = getTopic(l.a), b = getTopic(l.b);
            if (!a || !b) return '';
            return `<li class="row link-row">
              <span class="row-main static"><span class="row-title">${mark(a.classId)}${esc(a.name)} <span class="muted">and</span> ${mark(b.classId)}${esc(b.name)}</span>${l.label ? `<span class="row-meta">${esc(l.label)}</span>` : ''}</span>
              <button class="icon-btn sm" data-del-link="${l.id}" aria-label="Remove link">${icon('close', 14)}</button>
            </li>`;
          }).join('')}
        </ul>
      </section>
    </div>`;
  },

  mount(el) {
    const graph = buildGraph({ includeNotes: ConnUI.notes });
    const path = ConnUI.from && ConnUI.to ? shortestPath(graph, ConnUI.from, ConnUI.to) : null;
    const canvas = $('canvas', el);
    const keep = new Set();
    const adj = adjacency(graph);
    (path || []).forEach((p) => {
      keep.add(p.id);
      (adj.get(p.id) || []).slice(0, 6).forEach((x) => keep.add(x.to));
    });
    if (!path) S().classes.forEach((c) => keep.add('c:' + c.id));
    const sub = { nodes: graph.nodes.filter((n) => keep.has(n.id)), edges: graph.edges.filter((e) => keep.has(e.source) && keep.has(e.target)) };
    const fg = (this.fg = new ForceGraph(canvas, { labels: 'auto', onOpen: openGraphNode }));
    fg.setData(sub);
    fg.setHighlight(path?.map((p) => p.id));
    setTimeout(() => this.fg === fg && fg.fit(), 800);
    setTimeout(() => this.fg === fg && fg.fit(), 2200);

    el.addEventListener('change', (e) => {
      const k = e.target.dataset.c;
      if (!k) return;
      ConnUI[k] = k === 'notes' ? e.target.checked : e.target.value;
      App.refresh();
    });
    el.addEventListener('click', (e) => {
      const open = e.target.closest('[data-open]');
      if (open) {
        const id = open.dataset.open;
        return openNodeRef({ c: 'class', t: 'topic', n: 'note' }[id[0]], id.slice(2));
      }
      const pair = e.target.closest('[data-pair]');
      if (pair) {
        [ConnUI.from, ConnUI.to] = pair.dataset.pair.split('|');
        App.refresh();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const dl = e.target.closest('[data-del-link]');
      if (dl) {
        S().links = S().links.filter((l) => l.id !== dl.dataset.delLink);
        Store.save();
        return App.refresh();
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'swap') {
        [ConnUI.from, ConnUI.to] = [ConnUI.to, ConnUI.from];
        App.refresh();
      }
      if (act === 'random') {
        const ts = S().topics;
        const a = ts[Math.floor(Math.random() * ts.length)];
        const others = ts.filter((t) => t.classId !== a.classId);
        const b = others[Math.floor(Math.random() * others.length)] || ts[0];
        ConnUI.from = 't:' + a.id;
        ConnUI.to = 't:' + b.id;
        App.refresh();
      }
      if (act === 'explain-path' && path) {
        const chain = path.map((p) => nodeLabel(p.id)).join(' → ');
        sendToChatGPT(`I'm a student taking ${S().classes.map((c) => c.name).join(', ')}.

In my knowledge map, these ideas connect in this chain:
${chain}

Explain each link in the chain in 1–2 sentences, then explain in a short paragraph how "${nodeLabel(path[0].id)}" ultimately relates to "${nodeLabel(path[path.length - 1].id)}". End with one discussion question that uses both ideas.`);
      }
    });
    $('#link-form', el).addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const a = f.get('a'), b = f.get('b');
      if (!a || !b || a === b) return toast('Choose two different topics', 'warn');
      if (S().links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) return toast('Those topics are already linked', 'warn');
      S().links.push({ id: uid(), a, b, label: f.get('label').trim() });
      Store.save();
      toast('Topics linked', 'ok');
      App.refresh();
    });
  },

  unmount() {
    this.fg?.destroy();
    this.fg = null;
  },
};

/* ------------------------------ Skill tree ------------------------------ */
function wrapLabel(s, max = 22) {
  const words = s.split(' ');
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if ((cur + ' ' + w).trim().length > max && cur) lines.push(w);
    else lines[lines.length - 1] = (cur + ' ' + w).trim();
  }
  if (lines.length > 2) {
    lines.length = 2;
    lines[1] = lines[1].slice(0, max - 1) + '…';
  }
  return lines;
}

function isLocked(t, ids) {
  return t.mastery === 0 && t.prereqs.some((p) => ids.has(p) && getTopic(p).mastery === 0);
}

Views.tree = {
  title: 'Skill tree',
  render([classId], query) {
    const cls = getClass(classId) || S().classes[0];
    if (!cls) return emptyState('classes', 'No classes yet', '', '<a class="btn" href="#/classes">Add a class</a>');
    const selId = query.topic && getTopic(query.topic)?.classId === cls.id ? query.topic : null;
    const L = skillTreeLayout(cls.id);
    const PAD = 24;
    const vbX = -L.width / 2 - PAD;
    const vbW = L.width + PAD * 2;
    const vbH = L.height + PAD * 2;
    const pct = classMastery(cls.id);
    const ts = topicsOf(cls.id);

    let edges = '';
    let nodes = '';
    for (const { x, y, t } of L.pos.values()) {
      for (const p of t.prereqs) {
        const pp = L.pos.get(p);
        if (!pp) continue;
        const x1 = pp.x + L.NW / 2, y1 = pp.y + L.NH, x2 = x + L.NW / 2, y2 = y;
        const my = (y1 + y2) / 2;
        edges += `<path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}" class="st-edge ${pp.t.mastery >= 2 ? 'lit' : ''}"/>`;
      }
      const locked = isLocked(t, L.ids);
      const lines = wrapLabel(t.name);
      const cross = t.prereqs.filter((p) => !L.ids.has(p)).length + S().links.filter((l) => l.a === t.id || l.b === t.id).length;
      nodes += `
        <g class="st-node m${t.mastery} ${locked ? 'locked' : ''} ${t.id === selId ? 'sel' : ''}" data-topic="${t.id}" transform="translate(${x},${y})" tabindex="0" role="button" aria-label="${esc(t.name)}: ${MASTERY[t.mastery].label}${locked ? ', learn earlier topics first' : ''}">
          <rect class="st-box" width="${L.NW}" height="${L.NH}" rx="10"/>
          ${lines.map((ln, i) => `<text x="${L.NW / 2}" y="${L.NH / 2 - 4 + (i - (lines.length - 1) / 2) * 15 + 4}" text-anchor="middle">${esc(ln)}</text>`).join('')}
          <g class="st-pips" transform="translate(${L.NW / 2 - 13},${L.NH - 9})">${[0, 1, 2].map((i) => `<rect x="${i * 9}" width="8" height="3" rx="1.5" class="${i < t.mastery ? 'on' : ''}"/>`).join('')}</g>
          ${cross ? `<circle class="st-cross" cx="${L.NW - 9}" cy="9" r="3"><title>Linked to another class</title></circle>` : ''}
        </g>`;
    }

    return `
    <header class="page-head">
      <div><h1>${esc(cls.name)}</h1><p class="lede">${ts.filter((t) => t.mastery === 3).length} of ${ts.length} topics mastered. Topics lower down build on the ones above them.</p></div>
      <div class="head-actions">
        <select class="class-switch" data-switch aria-label="Class">${S().classes.map((c) => `<option value="${c.id}" ${c.id === cls.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <button class="btn primary" data-act="add">${icon('plus', 16)}Topic</button>
      </div>
    </header>
    <div class="tree-layout">
      <section class="panel tree-panel">
        <div class="tree-head">
          ${progressBar(pct)}
          <div class="legend-row">
            <span class="lg"><i class="lg-box"></i>Not started</span>
            <span class="lg"><i class="lg-box m1"></i>Learning</span>
            <span class="lg"><i class="lg-box m2"></i>Proficient</span>
            <span class="lg"><i class="lg-box m3"></i>Mastered</span>
            <span class="lg"><i class="lg-box locked"></i>Learn earlier topics first</span>
            <span class="lg"><i class="lg-dot"></i>Linked to another class</span>
          </div>
        </div>
        <div class="tree-scroll">
          ${ts.length ? `<svg class="skill-tree" viewBox="${vbX} ${-PAD} ${vbW} ${vbH}" style="min-width:${Math.min(vbW, 1400)}px" role="group" aria-label="Skill tree">${edges}${nodes}</svg>` : emptyState('map', 'No topics yet', 'Add the first topic for this class.')}
        </div>
      </section>
      <aside class="panel tree-side">${this.side(selId, cls)}</aside>
    </div>`;
  },

  side(id, cls) {
    const t = id && getTopic(id);
    const ids = new Set(topicsOf(cls.id).map((y) => y.id));
    if (!t) {
      const next = topicsOf(cls.id).filter((x) => x.mastery < 3 && !isLocked(x, ids));
      return `
        <h2>Ready to learn</h2>
        <p class="hint">Topics whose groundwork you’ve started. Select one to set your progress.</p>
        <ul class="rows compact">${next.slice(0, 8).map((x) => `<li class="row"><a class="row-main" href="#/tree/${cls.id}?topic=${x.id}"><span class="row-title">${esc(x.name)}</span></a>${masteryPips(x.mastery)}</li>`).join('') || '<li class="rows-empty">Everything here is mastered.</li>'}</ul>`;
    }
    const unlocks = S().topics.filter((x) => x.prereqs.includes(t.id));
    const cards = S().cards.filter((c) => c.topicId === t.id);
    const dueN = cards.filter((c) => c.due <= todayStr()).length;
    const mentions = S().notes.filter((n) => extractWikilinks(n.body).some((w) => w.toLowerCase() === t.name.toLowerCase()));
    const links = S().links.filter((l) => l.a === t.id || l.b === t.id);
    const topicRow = (x, meta = '') => `<li class="row"><a class="row-main" href="#/tree/${x.classId}?topic=${x.id}"><span class="row-title">${mark(x.classId)}${esc(x.name)}</span>${meta ? `<span class="row-meta">${meta}</span>` : ''}</a>${masteryPips(x.mastery)}</li>`;
    return `
      <p class="kind">${isLocked(t, ids) ? 'Learn earlier topics first' : 'Topic'}</p>
      <h2>${esc(t.name)}</h2>
      <p class="hint">${esc(t.desc || 'No description yet.')}</p>
      <fieldset class="block-seg"><legend class="sr-only">How well you know it</legend>
        <div class="seg block">${MASTERY.map((m, i) => `<label><input type="radio" name="mastery" value="${i}" ${t.mastery === i ? 'checked' : ''}><span>${m.label}</span></label>`).join('')}</div>
      </fieldset>
      <h3 class="sub">Learn first</h3>
      <ul class="rows compact">${t.prereqs.map((p) => getTopic(p)).filter(Boolean).map((x) => topicRow(x)).join('') || '<li class="rows-empty">Nothing, this is a starting point.</li>'}</ul>
      <h3 class="sub">Leads to</h3>
      <ul class="rows compact">${unlocks.map((x) => topicRow(x)).join('') || '<li class="rows-empty">Nothing yet.</li>'}</ul>
      ${links.length ? `<h3 class="sub">Related in other classes</h3><ul class="rows compact">${links.map((l) => [getTopic(l.a === t.id ? l.b : l.a), l.label]).filter(([o]) => o).map(([o, label]) => topicRow(o, esc(label))).join('')}</ul>` : ''}
      <h3 class="sub">Study it</h3>
      <p class="small">${plural(cards.length, 'card')}${cards.length ? `, ${dueN} due` : ''}. ${mentions.length ? `Mentioned in ${plural(mentions.length, 'note')}.` : 'No notes mention it yet.'}</p>
      ${mentions.length ? `<ul class="rows compact">${mentions.slice(0, 5).map((n) => `<li class="row"><a class="row-main" href="#/notes/${n.id}"><span class="row-title">${esc(n.title)}</span></a></li>`).join('')}</ul>` : ''}
      <div class="btn-row">
        <a class="btn sm" href="#/assist?topic=${t.id}&tpl=explain">Ask ChatGPT</a>
        <a class="btn sm" href="#/cards?tab=import&topic=${t.id}">Make cards</a>
        <button class="btn sm" data-act="note">Write a note</button>
      </div>
      <div class="btn-row">
        <button class="btn sm ghost" data-act="edit" data-id="${t.id}">Edit topic</button>
        <button class="btn sm ghost" data-act="child" data-id="${t.id}">Add a topic after this</button>
      </div>`;
  },

  mount(el, [classId], query) {
    const cls = getClass(classId) || S().classes[0];
    if (!cls) return;
    const selId = query.topic;
    const go = (id) => (location.hash = `#/tree/${cls.id}${id ? `?topic=${id}` : ''}`);

    el.addEventListener('click', (e) => {
      const node = e.target.closest('[data-topic]');
      if (node) return go(node.dataset.topic);
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'add') editTopicModal(null, cls.id, (id) => (id ? go(id) : App.refresh()));
      if (b.dataset.act === 'edit') editTopicModal(b.dataset.id, cls.id, (id) => (id ? App.refresh() : go(null)));
      if (b.dataset.act === 'child') editTopicModal(null, cls.id, (id) => (id ? go(id) : App.refresh()), { prereqs: [b.dataset.id] });
      if (b.dataset.act === 'note') {
        const t = getTopic(selId);
        const n = createNote({ title: t.name, classId: cls.id, body: `# ${t.name}\n\n> ${t.desc || ''}\n\nBuilds on: ${t.prereqs.map((p) => `[[${getTopic(p)?.name}]]`).join(', ') || 'nothing'}\n\n## Notes\n\n` });
        location.hash = `#/notes/${n.id}`;
      }
    });
    el.addEventListener('keydown', (e) => {
      const node = e.target.closest('[data-topic]');
      if (node && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        go(node.dataset.topic);
      }
    });
    el.addEventListener('change', (e) => {
      if (e.target.matches('[data-switch]')) location.hash = `#/tree/${e.target.value}`;
      if (e.target.name === 'mastery' && selId) {
        getTopic(selId).mastery = +e.target.value;
        Store.save();
        App.refresh();
      }
    });
  },
};
