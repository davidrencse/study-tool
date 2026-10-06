#!/usr/bin/env node
/* Convert the local Brightspace archive into Study Hub course data. No network calls. */
import { readFile, readdir, mkdir, copyFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const COURSES = { 627912: 'os', 625009: 'sec', 609704: 'nut', 601719: 'urb' };
const SITE = 'https://brightspace.nyu.edu';
const root = path.resolve(import.meta.dirname, '..');
const archive = path.resolve(root, process.argv[2] || 'brightspace-current');
const assetRoot = path.join(root, 'library', 'brightspace');
const output = path.join(root, 'js', 'data', 'brightspace-snapshot.js');
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const maybeJson = async file => readJson(file).catch(e => e.code === 'ENOENT' ? null : Promise.reject(e));
const list = async dir => readdir(dir, { withFileTypes: true }).catch(e => e.code === 'ENOENT' ? [] : Promise.reject(e));
const exists = async file => stat(file).then(s => s.isFile()).catch(() => false);
const safePart = s => String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120);
const md = s => String(s || '').replace(/[\[\]\\]/g, '\\$&');
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const url = (course, kind, id) => `${SITE}/d2l/le/lessons/${course}/units/${id}`;
const dropboxUrl = (course, id) => `${SITE}/d2l/lms/dropbox/user/folder_submit_files.d2l?ou=${course}&db=${id}`;
const remoteUrl = s => { try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const link = (title, href) => href ? `[${md(title)}](${encodeURI(href).replace(/\(/g, '%28').replace(/\)/g, '%29')})` : md(title);

async function copyAsset(file, classId, pieces) {
  // Large lab images remain in the private archive; the app links to Brightspace.
  if ((await stat(file)).size > 50 * 1024 * 1024) return null;
  const relative = path.posix.join('library', 'brightspace', classId, ...pieces.map(safePart));
  const destination = path.join(root, ...relative.split('/'));
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(file, destination);
  return relative.split('/').map(encodeURIComponent).join('/').replace(/^library/, 'library');
}

function localDate(iso) {
  if (!iso || Number.isNaN(Date.parse(iso))) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(iso)).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

async function convertCourse(dir, course, classId) {
  const entry = { classId, courseId: Number(course), events: [], notes: [], resources: [], warnings: [] };
  const manifest = await maybeJson(path.join(dir, 'manifest.json'));
  if (!manifest) throw new Error(`Course ${course} is not fully exported (manifest.json missing)`);
  entry.warnings = manifest.warnings || [];
  const resourceSeen = new Set();
  const addResource = (label, href, kind = 'book') => {
    if (!href || resourceSeen.has(href)) return;
    resourceSeen.add(href);
    entry.resources.push({ label, url: href, kind });
  };
  const assignments = await maybeJson(path.join(dir, 'assignments', 'index.json')) || [];
  for (const a of assignments) {
    if (a.IsHidden) continue;
    const id = Number(a.Id), title = clean(a.Name) || `Assignment ${id}`;
    const href = dropboxUrl(course, id), fileLinks = [];
    const assignmentDir = (await list(path.join(dir, 'assignments'))).find(d => d.isDirectory() && d.name.startsWith(`${id}-`));
    const own = assignmentDir ? await maybeJson(path.join(dir, 'assignments', assignmentDir.name, 'my-submissions.json')) : null;
    const submitted = Array.isArray(own) && own.some(record => (record.Submissions || []).length > 0);
    if (assignmentDir) for (const file of await list(path.join(dir, 'assignments', assignmentDir.name, 'attachments'))) {
      if (!file.isFile()) continue;
      const local = await copyAsset(path.join(dir, 'assignments', assignmentDir.name, 'attachments', file.name), classId, ['assignments', String(id), file.name]);
      fileLinks.push({ label: file.name.replace(/^\d+-/, ''), url: local || href });
      addResource(`${title}: ${file.name.replace(/^\d+-/, '')}`, local || href);
    }
    const instructions = String(a.CustomInstructions?.Text || '').trim();
    const noteId = `brightspace-${classId}-assignment-${id}`;
    entry.notes.push({ id: noteId, classId, title: `${title}: instructions`, tags: ['brightspace', 'assignment'],
      body: `# ${title}\n\n${link('Open assignment in Brightspace', href)}${a.DueDate ? `\n\n**Due:** ${localDate(a.DueDate)?.date} ${localDate(a.DueDate)?.time} New York time` : ''}${instructions ? `\n\n## Instructions\n\n${instructions}` : ''}${fileLinks.length ? `\n\n## Files\n\n${fileLinks.map(f => `- ${link(f.label, f.url)}`).join('\n')}` : ''}` });
    const due = localDate(a.DueDate);
    if (due) entry.events.push({ key: `brightspace-dropbox-${course}-${id}`, classId, title, type: 'assignment',
      date: due.date, time: due.time, dueAt: a.DueDate, dueTimezone: 'America/New_York',
      assignmentUrl: href, sourceType: 'brightspace-api', brightspaceId: id, submitted,
      brightspaceEntityType: 'D2L.LE.Dropbox.Dropbox',
      notes: clean(instructions).slice(0, 400), sources: [{ label: 'Brightspace assignment', url: href }, ...fileLinks] });
    addResource(`${title}: assignment`, href, 'site');
  }
  const toc = await maybeJson(path.join(dir, 'content', 'toc.json'));
  async function visit(modules, trail = []) {
    for (const m of modules || []) {
      if (m.IsHidden) continue;
      const heading = [...trail.map(x => x.title), m.Title || 'Module'];
      const lines = [`# ${heading.join(' / ')}`, '', link('Open module in Brightspace', url(course, 'module', m.ModuleId))];
      const walkDir = async (base, id) => (await list(base)).find(d => d.name.startsWith(`${id}-`));
      const relativeDir = async () => {
        let base = path.join(dir, 'content', 'modules');
        for (const part of [...trail.map(x => x.id), m.ModuleId]) {
          const found = await walkDir(base, part);
          if (!found) return null;
          base = path.join(base, found.name);
        }
        return base;
      };
      const moduleDir = await relativeDir();
      for (const t of m.Topics || []) {
        if (t.IsHidden) continue;
        const title = clean(t.Title) || `Topic ${t.TopicId}`;
        let href = remoteUrl(t.Url) || url(course, 'topic', t.TopicId);
        if (moduleDir) {
          const downloaded = (await list(moduleDir)).find(f => f.isFile() && f.name.startsWith(`${t.TopicId}-`) && !f.name.endsWith('.json'));
          if (downloaded) {
            href = await copyAsset(path.join(moduleDir, downloaded.name), classId, ['content', String(t.TopicId), downloaded.name]) || href;
            addResource(`${heading.join(' / ')}: ${title}`, href);
          }
        }
        lines.push(`- ${link(title, href)}${t.Description?.Text ? ` — ${clean(t.Description.Text).slice(0, 240)}` : ''}`);
      }
      if (m.Topics?.length || m.Description?.Text) {
        if (m.Description?.Text) lines.splice(3, 0, '', String(m.Description.Text).trim().slice(0, 12000), '');
        entry.notes.push({ id: `brightspace-${classId}-module-${m.ModuleId}`, classId,
          title: `Brightspace: ${heading.join(' / ')}`, body: lines.join('\n'),
          tags: ['brightspace', 'course material'] });
      }
      await visit(m.Modules, [...trail, { id: m.ModuleId, title: m.Title || 'Module' }]);
    }
  }
  await visit(toc?.Modules);
  const quizzes = await maybeJson(path.join(dir, 'quizzes', 'index.json')) || [];
  for (const q of quizzes) {
    const id = q.QuizId ?? q.Id;
    if (q.IsHidden || id == null) continue;
    const href = `${SITE}/d2l/lms/quizzing/user/quiz_summary.d2l?ou=${course}&qi=${id}`;
    addResource(q.Name || `Quiz ${id}`, href, 'site');
    const due = localDate(q.DueDate);
    if (!due) continue;
    entry.events.push({ key: `brightspace-quiz-${course}-${id}`, classId, title: q.Name || `Quiz ${id}`,
      type: 'quiz', date: due.date, time: due.time, dueAt: q.DueDate, dueTimezone: 'America/New_York',
      assignmentUrl: href, sourceType: 'brightspace-api', brightspaceEntityType: 'D2L.LE.Quizzing.Quiz',
      sources: [{ label: 'Brightspace quiz', url: href }] });
  }
  const calendar = await maybeJson(path.join(dir, 'calendar-events.json')) || [];
  const assignmentIds = new Set(entry.events.filter(e => e.brightspaceId).map(e => e.brightspaceId));
  const normalizedTitle = title => clean(title).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
  for (const c of calendar) {
    if (c.AssociatedEntity?.AssociatedEntityType?.includes('Dropbox') && assignmentIds.has(c.AssociatedEntity.AssociatedEntityId)) continue;
    const date = localDate(c.EndDateTime || c.StartDateTime);
    if (!date || !c.Title) continue;
    const entityType = c.AssociatedEntity?.AssociatedEntityType || '';
    if (entry.events.some(e => e.date === date.date && normalizedTitle(e.title) === normalizedTitle(c.Title) && e.brightspaceEntityType === entityType)) continue;
    const href = remoteUrl(c.AssociatedEntity?.Link) || remoteUrl(c.CalendarEventViewUrl);
    const discussion = entityType.includes('Discussion');
    entry.events.push({ key: `brightspace-calendar-${course}-${c.CalendarEventId}`, classId,
      title: discussion ? `Discussion: ${c.Title}` : c.Title,
      type: /exam|test/i.test(c.Title) ? 'exam' : /quiz/i.test(c.Title) ? 'quiz' : 'assignment',
      date: date.date, time: c.IsAllDayEvent ? '' : date.time, dueAt: c.IsAllDayEvent ? '' : c.EndDateTime || c.StartDateTime,
      dueTimezone: 'America/New_York', assignmentUrl: href, sourceType: 'brightspace-api', brightspaceEntityType: entityType,
      notes: clean(c.Description).replace(/<[^>]+>/g, ' ').slice(0, 400), sources: href ? [{ label: 'Brightspace calendar', url: href }] : [] });
  }
  const announcements = await maybeJson(path.join(dir, 'announcements.json')) || [];
  for (const a of announcements) {
    if (a.IsHidden) continue;
    const text = clean(a.Body?.Text || a.Body?.Html || a.Body || '');
    if (!text) continue;
    entry.notes.push({ id: `brightspace-${classId}-announcement-${a.Id}`, classId,
      title: `Announcement: ${clean(a.Title)}`, body: `# ${clean(a.Title)}\n\n${text}`, tags: ['brightspace', 'announcement'] });
  }
  return entry;
}

async function main() {
  const dirs = await list(archive), courses = [];
  for (const [id, classId] of Object.entries(COURSES)) {
    const found = dirs.find(d => d.isDirectory() && d.name.startsWith(`${id}-`));
    if (!found) throw new Error(`Missing course ${id} in ${archive}`);
    courses.push(await convertCourse(path.join(archive, found.name), id, classId));
  }
  const hash = createHash('sha256').update(JSON.stringify(courses)).digest('hex').slice(0, 12);
  const snapshot = { id: `brightspace-api-${hash}`, exportedAt: new Date().toISOString(), courses };
  await writeFile(output, `/* Generated from the local Brightspace archive. Contains course materials, no cookies or grades. */\nconst BRIGHTSPACE_SNAPSHOT = ${JSON.stringify(snapshot).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, ' ')};\n`);
  console.log(`Wrote ${output}: ${courses.reduce((n, c) => n + c.events.length, 0)} deadlines, ${courses.reduce((n, c) => n + c.notes.length, 0)} notes, ${courses.reduce((n, c) => n + c.resources.length, 0)} resources.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
