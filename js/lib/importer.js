/* ==========================================================================
   importer.js — turn slide decks, documents and existing notes into notes
   PDF → pdf.js · PPTX / DOCX → JSZip + XML · MD / TXT / HTML → read directly
   Libraries load on demand from cdnjs; a fresh tab needs internet or a cached copy.
   ========================================================================== */

const Importer = {
  _scripts: {},

  loadScript(src) {
    this._scripts[src] ||= new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => {
        delete this._scripts[src];
        reject(new Error('Could not load the file reader. Check your internet connection and try again.'));
      };
      document.head.appendChild(s);
    });
    return this._scripts[src];
  },

  async pdfjs() {
    const base = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
    await this.loadScript(base + 'pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js';
    return window.pdfjsLib;
  },

  async jszip() {
    await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    return window.JSZip;
  },

  kind(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'pptx') return 'pptx';
    if (ext === 'docx') return 'docx';
    if (['md', 'markdown', 'txt', 'text'].includes(ext)) return 'text';
    if (['html', 'htm'].includes(ext)) return 'html';
    if (ext === 'ppt' || ext === 'doc' || ext === 'key' || ext === 'pages') return 'legacy';
    if (['c', 'h', 'cpp', 'cc', 'hpp', 'py', 'java', 'js', 'ts', 'sh', 'sql', 's', 'asm'].includes(ext)) return 'code';
    return 'unsupported';
  },

  kindLabel: { pdf: 'PDF', pptx: 'Slides', docx: 'Word', text: 'Note', html: 'Web page', code: 'Code', legacy: 'Old format', unsupported: 'Unsupported' },

  baseName(name) {
    return name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
  },

  /** → { title, body, tags, units, unitLabel } */
  async extract(file) {
    const kind = this.kind(file);
    if (kind === 'legacy') throw new Error('Save it as .pptx, .docx or PDF first, then add it again.');
    if (kind === 'unsupported') throw new Error('This file type can’t be read. Use PDF, PowerPoint (.pptx), Word (.docx), Markdown, text or source code.');
    if (kind === 'pdf') return this.fromPdf(file);
    if (kind === 'pptx') return this.fromPptx(file);
    if (kind === 'docx') return this.fromDocx(file);
    if (kind === 'html') return this.fromHtml(file);
    if (kind === 'code') {
      const code = (await file.text()).replace(/\r/g, '');
      const lang = langKey(file.name.split('.').pop().toLowerCase());
      return { title: file.name, body: code, code, lang, tags: ['code'], units: code.split('\n').length, unitLabel: 'line' };
    }
    return this.fromText(file);
  },

  async fromPdf(file) {
    const pdfjs = await this.pdfjs();
    // Disable dynamic evaluation (Mozilla's workaround for CVE-2024-4367).
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
    const parts = [];
    let firstLine = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        text += item.str;
        text += item.hasEOL ? '\n' : item.str.endsWith(' ') ? '' : ' ';
      }
      const lines = text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (!firstLine && lines[0]) firstLine = lines[0];
      if (!lines.length) continue;
      const [head, ...rest] = lines;
      parts.push(`## ${p}. ${head.slice(0, 120)}\n\n${rest.map((l) => (l.length < 90 ? `- ${l}` : l)).join('\n')}`);
    }
    if (!parts.length) throw new Error('No text found — this PDF may be scanned images. Export it with text, or paste the text instead.');
    return { title: this.baseName(file.name), body: parts.join('\n\n'), tags: ['slides'], units: doc.numPages, unitLabel: 'page' };
  },

  xml(str) {
    return new DOMParser().parseFromString(str, 'application/xml');
  },

  paragraphs(root, pTag, tTag) {
    return [...root.getElementsByTagName(pTag)]
      .map((p) => [...p.getElementsByTagName(tTag)].map((t) => t.textContent).join('').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  },

  async fromPptx(file) {
    const JSZip = await this.jszip();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slidePaths = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => +a.match(/(\d+)\.xml$/)[1] - +b.match(/(\d+)\.xml$/)[1]);
    if (!slidePaths.length) throw new Error('No slides found in this file.');

    const parts = [];
    for (const [i, path] of slidePaths.entries()) {
      const doc = this.xml(await zip.file(path).async('string'));
      let title = '';
      const body = [];
      for (const shape of doc.getElementsByTagName('p:sp')) {
        const ph = shape.getElementsByTagName('p:ph')[0];
        const type = ph?.getAttribute('type') || '';
        if (['sldNum', 'dt', 'ftr'].includes(type)) continue;
        const paras = this.paragraphs(shape, 'a:p', 'a:t');
        if (!paras.length) continue;
        if (!title && (type === 'title' || type === 'ctrTitle')) title = paras.join(' ');
        else body.push(...paras);
      }
      // tables and grouped shapes outside p:sp
      for (const tbl of doc.getElementsByTagName('a:tbl')) {
        for (const row of tbl.getElementsByTagName('a:tr')) {
          const cells = [...row.getElementsByTagName('a:tc')].map((c) => this.paragraphs(c, 'a:p', 'a:t').join(' '));
          if (cells.some(Boolean)) body.push(cells.join(' | '));
        }
      }

      // speaker notes via the slide's relationships
      let notes = [];
      const rels = zip.file(path.replace('slides/', 'slides/_rels/') + '.rels');
      if (rels) {
        const rel = [...this.xml(await rels.async('string')).getElementsByTagName('Relationship')].find((r) => /notesSlide$/.test(r.getAttribute('Type')));
        const target = rel && 'ppt/' + rel.getAttribute('Target').replace(/^\.\.\//, '');
        const nf = target && zip.file(target);
        if (nf) {
          const nd = this.xml(await nf.async('string'));
          for (const shape of nd.getElementsByTagName('p:sp')) {
            const type = shape.getElementsByTagName('p:ph')[0]?.getAttribute('type');
            if (type === 'body') notes.push(...this.paragraphs(shape, 'a:p', 'a:t'));
          }
        }
      }

      const heading = title || body.shift() || `Slide ${i + 1}`;
      let section = `## ${i + 1}. ${heading}`;
      if (body.length) section += '\n\n' + body.map((l) => `- ${l}`).join('\n');
      if (notes.length) section += '\n\n> Speaker notes: ' + notes.join(' ');
      parts.push(section);
    }
    return { title: this.baseName(file.name), body: parts.join('\n\n'), tags: ['slides'], units: slidePaths.length, unitLabel: 'slide' };
  },

  async fromDocx(file) {
    const JSZip = await this.jszip();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const main = zip.file('word/document.xml');
    if (!main) throw new Error('This doesn’t look like a Word document.');
    const doc = this.xml(await main.async('string'));
    const lines = [];
    for (const p of doc.getElementsByTagName('w:p')) {
      const text = [...p.getElementsByTagName('w:t')].map((t) => t.textContent).join('').trim();
      if (!text) continue;
      const style = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || '';
      const h = style.match(/^(?:Heading|heading)\s?(\d)/);
      if (h) lines.push(`\n${'#'.repeat(Math.min(4, +h[1] + 1))} ${text}\n`);
      else if (/^Title$/i.test(style)) lines.push(`\n# ${text}\n`);
      else if (p.getElementsByTagName('w:numPr').length) lines.push(`- ${text}`);
      else lines.push(`\n${text}\n`);
    }
    const body = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!body) throw new Error('No text found in this document.');
    return { title: this.baseName(file.name), body, tags: ['document'], units: lines.length, unitLabel: 'paragraph' };
  },

  async fromHtml(file) {
    const doc = new DOMParser().parseFromString(await file.text(), 'text/html');
    doc.querySelectorAll('script, style, nav, footer').forEach((n) => n.remove());
    const lines = [];
    doc.body.querySelectorAll('h1, h2, h3, h4, p, li, pre, blockquote').forEach((n) => {
      const t = n.textContent.replace(/\s+/g, ' ').trim();
      if (!t) return;
      if (/^H\d$/.test(n.tagName)) lines.push(`${'#'.repeat(Math.min(4, +n.tagName[1] + 1))} ${t}`);
      else if (n.tagName === 'LI') lines.push(`- ${t}`);
      else lines.push(t);
    });
    return { title: doc.title || this.baseName(file.name), body: lines.join('\n\n'), tags: ['web'], units: lines.length, unitLabel: 'block' };
  },

  async fromText(file) {
    return this.fromString(await file.text(), this.baseName(file.name));
  },

  /** Plain text or Markdown, including Obsidian notes with YAML front matter. */
  fromString(raw, fallbackTitle = 'Imported note') {
    let text = raw.replace(/\r/g, '').replace(/^﻿/, '');
    const tags = [];
    let title = '';
    const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
    if (fm) {
      text = text.slice(fm[0].length);
      const t = fm[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
      if (t) title = t[1];
      const inline = fm[1].match(/^tags:\s*\[(.*)\]\s*$/m);
      const block = fm[1].match(/^tags:\s*\n((?:\s*-\s*.+\n?)+)/m);
      if (inline) tags.push(...inline[1].split(',').map((x) => x.trim().replace(/^["'#]|["']$/g, '')));
      if (block) tags.push(...block[1].split('\n').map((x) => x.replace(/^\s*-\s*/, '').trim()).filter(Boolean));
    }
    // #hashtags written inline (Obsidian style)
    for (const m of text.matchAll(/(?:^|\s)#([A-Za-z][\w/-]{1,30})\b/g)) tags.push(m[1]);
    // image embeds can't come along; keep a readable marker
    text = text.replace(/!\[\[([^\]]+)\]\]/g, '*(embedded file: $1)*');
    const h1 = text.match(/^#\s+(.+)$/m);
    if (!title && h1 && text.indexOf(h1[0]) < 200) title = h1[1].trim();
    return {
      title: title || fallbackTitle,
      body: text.trim(),
      tags: [...new Set(tags.filter(Boolean))].slice(0, 12),
      units: (text.match(/\S+/g) || []).length,
      unitLabel: 'word',
    };
  },

  /** Best guess at which class a file belongs to, from its name, folder and first lines. */
  guessClass(name, body = '') {
    const hay = (name + ' ' + body.slice(0, 600)).toLowerCase();
    const scored = S().classes.map((c) => {
      let score = 0;
      const short = (c.short || '').toLowerCase();
      if (short && new RegExp(`(^|[^a-z])${short}([^a-z]|$)`).test(hay)) score += 3;
      if ((c.info.code || '') && hay.includes(c.info.code.toLowerCase())) score += 5;
      for (const w of c.name.toLowerCase().split(/\W+/).filter((w) => w.length > 4 && !['advanced', 'seminar', 'studies'].includes(w))) if (hay.includes(w)) score += 2;
      for (const t of topicsOf(c.id)) if (hay.includes(t.name.toLowerCase().split(/[(&]/)[0].trim())) score += 1;
      return { id: c.id, score };
    });
    const best = scored.sort((a, b) => b.score - a.score)[0];
    return best && best.score >= 2 ? best.id : '';
  },
};
