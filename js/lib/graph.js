/* ==========================================================================
   graph.js — dependency-free, Obsidian-style force-directed canvas graph
   ========================================================================== */

class ForceGraph {
  constructor(canvas, { onSelect, onOpen, labels = 'auto' } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect;
    this.onOpen = onOpen;
    this.labels = labels; // 'auto' | 'all' | 'none'
    this.nodes = [];
    this.edges = [];
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.alpha = 1;
    this.hover = null;
    this.selected = null;
    this.highlight = null; // Set of node ids (path)
    this.highlightEdges = null; // Set of "a|b"
    this.running = false;
    this.drag = null;
    this._raf = 0;
    this._bind();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement);
    this.resize();
  }

  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = Math.max(200, r.width);
    this.h = Math.max(200, r.height);
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.dpr = dpr;
    if (!this._centered) {
      this.panX = this.w / 2;
      this.panY = this.h / 2;
      this._centered = true;
    }
    this.draw();
  }

  setData({ nodes, edges }) {
    const old = new Map(this.nodes.map((n) => [n.id, n]));
    const deg = new Map();
    for (const e of edges) {
      deg.set(e.source, (deg.get(e.source) || 0) + 1);
      deg.set(e.target, (deg.get(e.target) || 0) + 1);
    }
    // seed class nodes on a ring so clusters separate nicely
    const classIds = [...new Set(nodes.filter((n) => n.kind === 'class').map((n) => n.id))];
    const anchor = new Map(classIds.map((id, i) => {
      const a = (i / Math.max(1, classIds.length)) * Math.PI * 2;
      return [id, { x: Math.cos(a) * 220, y: Math.sin(a) * 220 }];
    }));
    const classAnchor = (n) => anchor.get('c:' + n.classId) || { x: 0, y: 0 };

    this.nodes = nodes.map((n) => {
      const o = old.get(n.id);
      const d = deg.get(n.id) || 0;
      const r = n.kind === 'class' ? 18 : n.kind === 'topic' ? 7 + Math.min(6, d) : 4.5 + Math.min(3, d * 0.5);
      if (o) return { ...n, x: o.x, y: o.y, vx: 0, vy: 0, r, deg: d, fixed: o.fixed };
      const a = classAnchor(n);
      return { ...n, x: a.x + (Math.random() - 0.5) * 120, y: a.y + (Math.random() - 0.5) * 120, vx: 0, vy: 0, r, deg: d };
    });
    this.byId = new Map(this.nodes.map((n) => [n.id, n]));
    this.edges = edges.filter((e) => this.byId.has(e.source) && this.byId.has(e.target)).map((e) => ({ ...e, s: this.byId.get(e.source), t: this.byId.get(e.target) }));
    this.neighbors = new Map(this.nodes.map((n) => [n.id, new Set()]));
    for (const e of this.edges) {
      this.neighbors.get(e.source).add(e.target);
      this.neighbors.get(e.target).add(e.source);
    }
    this.reheat(1);
  }

  setHighlight(ids) {
    if (!ids || !ids.length) {
      this.highlight = this.highlightEdges = null;
    } else {
      this.highlight = new Set(ids);
      this.highlightEdges = new Set();
      for (let i = 0; i < ids.length - 1; i++) {
        this.highlightEdges.add(ids[i] + '|' + ids[i + 1]);
        this.highlightEdges.add(ids[i + 1] + '|' + ids[i]);
      }
    }
    this.draw();
  }

  reheat(a = 0.6) {
    this.alpha = Math.max(this.alpha, a);
    if (!this.running) this.start();
  }

  start() {
    this.running = true;
    cancelAnimationFrame(this._raf);
    const loop = () => {
      if (!this.running) return;
      if (this.alpha > 0.005 || this.drag) {
        this.tick();
        this.alpha *= 0.985;
      }
      this.draw();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  destroy() {
    this.stop();
    this.ro.disconnect();
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
  }

  tick() {
    const N = this.nodes;
    const a = Math.max(this.alpha, 0.02);
    // repulsion
    for (let i = 0; i < N.length; i++) {
      const p = N[i];
      for (let j = i + 1; j < N.length; j++) {
        const q = N[j];
        let dx = q.x - p.x;
        let dy = q.y - p.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = 1;
        }
        if (d2 > 250000) continue;
        const f = ((p.kind === 'class' || q.kind === 'class' ? 5200 : 1400) * a) / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        p.vx -= fx;
        p.vy -= fy;
        q.vx += fx;
        q.vy += fy;
      }
    }
    // springs
    for (const e of this.edges) {
      const L = e.type === 'cross' ? 150 : e.type === 'contains' ? 80 : e.type === 'note' ? 70 : e.type === 'mention' ? 90 : 55;
      const k = e.type === 'cross' ? 0.02 : e.type === 'mention' ? 0.015 : 0.06;
      const dx = e.t.x - e.s.x;
      const dy = e.t.y - e.s.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - L) * k * a;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      e.s.vx += fx;
      e.s.vy += fy;
      e.t.vx -= fx;
      e.t.vy -= fy;
    }
    // gravity + integrate
    for (const n of N) {
      n.vx -= n.x * 0.004 * a;
      n.vy -= n.y * 0.004 * a;
      if (this.drag?.node === n || n.fixed) {
        n.vx = n.vy = 0;
        continue;
      }
      n.vx *= 0.62;
      n.vy *= 0.62;
      n.x += Math.max(-30, Math.min(30, n.vx));
      n.y += Math.max(-30, Math.min(30, n.vy));
    }
  }

  readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (k, d) => cs.getPropertyValue(k).trim() || d;
    this.col = { ink: v('--ink', '#000'), paper: v('--paper', '#fff'), muted: v('--muted', '#777'), edge: v('--graph-edge', '#bbb') };
  }

  /** Draw a node's shape: classes and their topics share the class mark. */
  _shape(n, r) {
    const { ctx } = this;
    const shape = n.kind === 'note' ? 'circle' : getClass(n.classId)?.mark || 'circle';
    ctx.beginPath();
    switch (shape) {
      case 'square':
      case 'bar':
        ctx.rect(n.x - r * 0.88, n.y - r * 0.88, r * 1.76, r * 1.76);
        break;
      case 'triangle':
        ctx.moveTo(n.x, n.y - r * 1.12);
        ctx.lineTo(n.x + r * 1.05, n.y + r * 0.78);
        ctx.lineTo(n.x - r * 1.05, n.y + r * 0.78);
        ctx.closePath();
        break;
      case 'diamond':
      case 'cross':
        ctx.moveTo(n.x, n.y - r * 1.2);
        ctx.lineTo(n.x + r * 1.2, n.y);
        ctx.lineTo(n.x, n.y + r * 1.2);
        ctx.lineTo(n.x - r * 1.2, n.y);
        ctx.closePath();
        break;
      default:
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    }
    return shape;
  }

  draw() {
    if (!this.ctx) return;
    this.readColors();
    const { ctx, dpr, col } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.setTransform(dpr * this.zoom, 0, 0, dpr * this.zoom, dpr * this.panX, dpr * this.panY);

    const focus = this.hover || this.selected;
    const nb = focus ? this.neighbors.get(focus.id) : null;
    const hl = this.highlight;
    const dimNode = (n) => (hl ? !hl.has(n.id) : focus ? n !== focus && !nb.has(n.id) : false);
    const px = 1 / Math.sqrt(this.zoom);

    // edges
    for (const e of this.edges) {
      const onPath = this.highlightEdges?.has(e.source + '|' + e.target);
      const touching = focus && (e.s === focus || e.t === focus);
      ctx.globalAlpha = hl ? (onPath ? 1 : 0.12) : focus ? (touching ? 1 : 0.14) : 1;
      ctx.beginPath();
      ctx.setLineDash(e.type === 'cross' ? [5, 4] : e.type === 'mention' ? [1.5, 3] : []);
      ctx.moveTo(e.s.x, e.s.y);
      ctx.lineTo(e.t.x, e.t.y);
      ctx.strokeStyle = onPath || touching || e.type === 'cross' ? col.ink : col.edge;
      ctx.lineWidth = (onPath ? 3.2 : touching ? 1.6 : 1) * px;
      ctx.stroke();
      if (e.type === 'prereq' && (this.zoom > 0.9 || touching || onPath)) this._arrow(e);
    }
    ctx.setLineDash([]);

    // nodes
    for (const n of this.nodes) {
      ctx.globalAlpha = dimNode(n) ? 0.2 : 1;
      if (n.kind === 'note') {
        this._shape(n, n.r);
        ctx.fillStyle = col.paper;
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = col.ink;
        ctx.stroke();
      } else {
        this._shape(n, n.r);
        ctx.fillStyle = n.kind === 'topic' && !n.mastery ? col.paper : col.ink;
        ctx.fill();
        ctx.lineWidth = n.kind === 'class' ? 0 : 1.6;
        ctx.strokeStyle = col.ink;
        if (n.kind === 'topic') ctx.stroke();
        if (n.kind === 'topic' && n.mastery && n.mastery < 3) {
          // partly known: inner paper dot shrinks as mastery grows
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * (n.mastery === 1 ? 0.55 : 0.3), 0, Math.PI * 2);
          ctx.fillStyle = col.paper;
          ctx.fill();
        }
      }
      if (n === this.selected || hl?.has(n.id)) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2);
        ctx.strokeStyle = col.ink;
        ctx.lineWidth = 1.5 / this.zoom;
        ctx.setLineDash([2.5 / this.zoom, 2.5 / this.zoom]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // labels
    if (this.labels !== 'none') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const n of this.nodes) {
        const important = n === focus || nb?.has(n.id) || hl?.has(n.id) || n.kind === 'class';
        const show = this.labels === 'all' || important || (this.zoom > 1.15 && n.kind !== 'note') || this.zoom > 1.8;
        if (!show || (dimNode(n) && !important)) continue;
        const size = (n.kind === 'class' ? 13 : 11) / Math.min(this.zoom, 1.6);
        ctx.font = `${n.kind === 'class' ? 650 : n === focus ? 600 : 450} ${size}px Geist, system-ui, sans-serif`;
        ctx.globalAlpha = dimNode(n) ? 0.35 : 1;
        const label = n.label.length > 34 ? n.label.slice(0, 32) + '…' : n.label;
        const y = n.y + n.r * 1.2 + 5;
        ctx.lineWidth = 4 / this.zoom;
        ctx.strokeStyle = col.paper;
        ctx.strokeText(label, n.x, y);
        ctx.fillStyle = n.kind === 'note' ? col.muted : col.ink;
        ctx.fillText(label, n.x, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  _arrow(e) {
    const { ctx } = this;
    const dx = e.t.x - e.s.x;
    const dy = e.t.y - e.s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const tipX = e.t.x - ux * (e.t.r + 2);
    const tipY = e.t.y - uy * (e.t.r + 2);
    const s = 5;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - ux * s - uy * s * 0.6, tipY - uy * s + ux * s * 0.6);
    ctx.lineTo(tipX - ux * s + uy * s * 0.6, tipY - uy * s - ux * s * 0.6);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  toWorld(sx, sy) {
    return { x: (sx - this.panX) / this.zoom, y: (sy - this.panY) / this.zoom };
  }

  nodeAt(sx, sy) {
    const p = this.toWorld(sx, sy);
    let best = null;
    let bd = Infinity;
    for (const n of this.nodes) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < n.r + 6 / this.zoom && d < bd) {
        best = n;
        bd = d;
      }
    }
    return best;
  }

  focusNode(id) {
    const n = this.byId?.get(id);
    if (!n) return;
    this.selected = n;
    this.zoom = Math.max(this.zoom, 1.3);
    this.panX = this.w / 2 - n.x * this.zoom;
    this.panY = this.h / 2 - n.y * this.zoom;
    this.onSelect?.(n);
    this.draw();
  }

  fit() {
    if (!this.nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    }
    const pad = 60;
    this.zoom = Math.min(2, Math.max(0.2, Math.min(this.w / (maxX - minX + pad * 2), this.h / (maxY - minY + pad * 2))));
    this.panX = this.w / 2 - ((minX + maxX) / 2) * this.zoom;
    this.panY = this.h / 2 - ((minY + maxY) / 2) * this.zoom;
    this.draw();
  }

  _bind() {
    const c = this.canvas;
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    c.addEventListener('pointerdown', (e) => {
      const p = pos(e);
      const n = this.nodeAt(p.x, p.y);
      this.drag = n ? { node: n, moved: false, sx: p.x, sy: p.y } : { pan: true, moved: false, sx: p.x, sy: p.y, px: this.panX, py: this.panY };
      c.classList.add('grabbing');
    });

    this._onMove = (e) => {
      const r = c.getBoundingClientRect();
      const p = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (this.drag) {
        if (Math.hypot(p.x - this.drag.sx, p.y - this.drag.sy) > 3) this.drag.moved = true;
        if (this.drag.node) {
          const w = this.toWorld(p.x, p.y);
          this.drag.node.x = w.x;
          this.drag.node.y = w.y;
          if (this.drag.moved) this.reheat(0.3);
        } else if (this.drag.pan) {
          this.panX = this.drag.px + (p.x - this.drag.sx);
          this.panY = this.drag.py + (p.y - this.drag.sy);
          this.draw();
        }
        return;
      }
      if (e.target !== c) return;
      const n = this.nodeAt(p.x, p.y);
      if (n !== this.hover) {
        this.hover = n;
        c.style.cursor = n ? 'pointer' : 'grab';
        this.draw();
      }
    };
    this._onUp = () => {
      if (!this.drag) return;
      const d = this.drag;
      this.drag = null;
      c.classList.remove('grabbing');
      if (!d.moved) {
        this.selected = d.node || null;
        this.onSelect?.(this.selected);
        this.draw();
      }
    };
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);

    c.addEventListener('pointerleave', () => {
      if (this.hover) {
        this.hover = null;
        this.draw();
      }
    });

    c.addEventListener('dblclick', (e) => {
      const p = pos(e);
      const n = this.nodeAt(p.x, p.y);
      if (n) this.onOpen?.(n);
    });

    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const p = pos(e);
        const w = this.toWorld(p.x, p.y);
        const z = Math.min(4, Math.max(0.15, this.zoom * Math.exp(-e.deltaY * 0.0015)));
        this.zoom = z;
        this.panX = p.x - w.x * z;
        this.panY = p.y - w.y * z;
        this.draw();
      },
      { passive: false }
    );
  }
}

/* ==========================================================================
   Skill-tree layout: layers by longest prerequisite chain within a class
   ========================================================================== */
function skillTreeLayout(classId) {
  const ts = topicsOf(classId);
  const ids = new Set(ts.map((t) => t.id));
  const depth = new Map();
  const visiting = new Set();
  const dep = (t) => {
    if (depth.has(t.id)) return depth.get(t.id);
    if (visiting.has(t.id)) return 0; // cycle guard
    visiting.add(t.id);
    const ps = t.prereqs.filter((p) => ids.has(p)).map((p) => dep(getTopic(p)));
    const d = ps.length ? Math.max(...ps) + 1 : 0;
    visiting.delete(t.id);
    depth.set(t.id, d);
    return d;
  };
  ts.forEach(dep);

  const layers = [];
  for (const t of ts) (layers[depth.get(t.id)] ||= []).push(t);

  const NW = 176, NH = 52, GX = 26, GY = 64;
  const pos = new Map();
  layers.forEach((layer, li) => {
    if (li > 0) {
      // barycenter ordering to reduce edge crossings
      layer.sort((a, b) => bary(a) - bary(b));
    }
    const width = layer.length * NW + (layer.length - 1) * GX;
    layer.forEach((t, i) => pos.set(t.id, { x: -width / 2 + i * (NW + GX), y: li * (NH + GY), t }));
  });
  function bary(t) {
    const ps = t.prereqs.filter((p) => pos.has(p));
    if (!ps.length) return 0;
    return ps.reduce((a, p) => a + pos.get(p).x, 0) / ps.length;
  }

  const maxW = Math.max(NW, ...layers.map((l) => l.length * NW + (l.length - 1) * GX));
  const height = layers.length * (NH + GY) - GY;
  return { pos, NW, NH, width: maxW, height, ids };
}
