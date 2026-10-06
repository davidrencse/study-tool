#!/usr/bin/env node
/* Read-only Brightspace archive. Node 20+, no additional dependencies. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HELP = `Usage: node tools/brightspace-export.mjs --cookies FILE [options]

Authentication (choose one):
  BRIGHTSPACE_TOKEN environment variable   OAuth bearer access token
  --cookies FILE                           Exported browser cookies (Netscape or JSON)

Options:
  --site URL        Brightspace origin (default: https://brightspace.nyu.edu)
  --course ID       Export one course (repeatable); default: all accessible courses
  --out DIR         Output directory (default: brightspace-export)
  --le-version N    Learning Environment API version (default: 1.82)
  --lp-version N    Learning Platform API version (default: 1.49)
  --metadata-only   Skip binary downloads
  --resume          Skip courses with a completed manifest in --out
  --concurrency N   Export up to N courses at once (default: 1; max: 4)
  --help            Show help

Cookie files may be Netscape HTTP Cookie File text, a JSON array, or Playwright
storageState JSON. Only cookies scoped to the exact Brightspace host are used.
Some sites require OAuth for the API even when a browser session works in the UI.
`;

function parseArgs(argv) {
  const o = { courses: [], site: 'https://brightspace.nyu.edu', out: 'brightspace-export', le: '1.82', lp: '1.49', files: true, resume: false, concurrency: 1 };
  const fields = { '--site': 'site', '--out': 'out', '--cookies': 'cookies', '--le-version': 'le', '--lp-version': 'lp', '--concurrency': 'concurrency' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help') o.help = true;
    else if (a === '--metadata-only') o.files = false;
    else if (a === '--resume') o.resume = true;
    else if (a === '--course' || fields[a]) {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new Error(`Missing value for ${a}`);
      if (a === '--course') o.courses.push(v);
      else o[fields[a]] = v;
    } else throw new Error(`Unknown option: ${a}`);
  }
  if (o.help) return o;
  const u = new URL(o.site);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)))
    throw new Error('Brightspace site must use HTTPS');
  if (u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error('--site must be only the site origin');
  o.site = u.origin;
  if (!/^\d+\.\d+$/.test(o.le) || !/^\d+\.\d+$/.test(o.lp)) throw new Error('Invalid API version');
  if (!/^[1-4]$/.test(String(o.concurrency))) throw new Error('--concurrency must be 1 through 4');
  o.concurrency = Number(o.concurrency);
  if (o.courses.some(id => !/^\d+$/.test(id))) throw new Error('--course requires a numeric org unit ID');
  return o;
}

function safeName(value) {
  const s = String(value ?? '').normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.+$/g, '').trim();
  const name = (s && s !== '.' && s !== '..' ? s : 'unnamed').slice(0, 120);
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? `_${name}` : name;
}
function safeSegments(remote) {
  const parts = String(remote).replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.some(p => p === '.' || p === '..')) throw new Error(`Unsafe remote path: ${remote}`);
  return parts.map(safeName);
}
async function cookieHeader(file, origin) {
  const text = await readFile(file, 'utf8');
  const raw = text.trimStart().startsWith('# Netscape HTTP Cookie File')
    ? text.split(/\r?\n/).filter(line => line && (!line.startsWith('#') || line.startsWith('#HttpOnly_')))
      .map(line => {
        const [domain, , cookiePath, secure, expires, name, ...value] = line.split('\t');
        return { domain: domain?.replace(/^#HttpOnly_/, ''), path: cookiePath, secure: secure === 'TRUE',
          expires: Number(expires), name, value: value.join('\t') };
      })
    : JSON.parse(text);
  const cookies = Array.isArray(raw) ? raw : raw.cookies;
  if (!Array.isArray(cookies)) throw new Error('Cookie file needs a cookies array');
  const site = new URL(origin);
  const host = site.hostname.toLowerCase();
  const now = Date.now() / 1000;
  const list = cookies.filter(c => {
    const domain = String(c.domain || host).replace(/^\./, '').toLowerCase();
    const expiry = c.expires || c.expirationDate;
    return c.name && typeof c.value === 'string' && host === domain &&
      String(c.path || '/').startsWith('/') && '/d2l/api/'.startsWith(String(c.path || '/')) &&
      (!c.secure || site.protocol === 'https:') &&
      (!expiry || expiry < 0 || expiry > now);
  });
  if (!list.length) throw new Error('No usable cookies for this site');
  return list.map(c => `${c.name}=${c.value}`).join('; ');
}

class Api {
  constructor(origin, credential, fetchImpl = fetch) {
    this.origin = origin; this.credential = credential; this.fetchImpl = fetchImpl;
  }
  url(route) {
    const u = new URL(route, this.origin);
    if (u.origin !== this.origin || !u.pathname.startsWith('/d2l/api/')) throw new Error(`Unsafe API route: ${route}`);
    return u;
  }
  async get(route) {
    const url = this.url(route);
    for (let attempt = 0; attempt < 5; attempt++) {
      const headers = { Accept: '*/*', ...(this.credential.token ?
        { Authorization: `Bearer ${this.credential.token}` } : { Cookie: this.credential.cookie }) };
      let res = await this.fetchImpl(url, { headers, redirect: 'manual' });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const target = new URL(res.headers.get('location'), url);
        if (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname)))
          throw new Error('Unsafe download redirect');
        if (/\/login(?:\/|$)/i.test(target.pathname)) throw new Error('Brightspace redirected to login; this session is not authenticated for the API');
        res = await this.fetchImpl(target, { headers: target.origin === this.origin ? headers : {}, redirect: 'error' });
      }
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        const seconds = Number(res.headers.get('retry-after'));
        await new Promise(resolve => setTimeout(resolve, Math.min(30000, (Number.isFinite(seconds) && seconds > 0 ? seconds : 2 ** attempt) * 1000)));
        continue;
      }
      if (!res.ok) {
        const e = new Error(`HTTP ${res.status} ${url.pathname}${url.search}`);
        e.status = res.status;
        throw e;
      }
      return res;
    }
  }
  async json(route) { return (await this.get(route)).json(); }
}
async function saveJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + '\n');
}
async function download(api, route, file) {
  const res = await api.get(route);
  await mkdir(path.dirname(file), { recursive: true });
  await pipeline(res.body, createWriteStream(file));
}
function objects(page) {
  if (Array.isArray(page)) return page;
  for (const key of ['Objects', 'Items', 'Results']) if (Array.isArray(page?.[key])) return page[key];
  throw new Error('Unexpected paged response');
}
async function paged(api, first) {
  const all = [], seen = new Set();
  let route = first;
  while (route) {
    const url = String(api.url(route));
    if (seen.has(url)) throw new Error('Pagination loop');
    seen.add(url);
    const page = await api.json(route);
    all.push(...objects(page));
    if (page.Next) route = page.Next;
    else if (page.PagingInfo?.HasMoreItems && page.PagingInfo.Bookmark) {
      const next = api.url(first);
      next.searchParams.set('bookmark', page.PagingInfo.Bookmark);
      route = String(next);
    } else route = null;
  }
  return all;
}

async function exportCourse(api, options, id, course) {
  const root = path.join(options.out, `${id}-${safeName(course?.Name || 'course')}`);
  const report = { orgUnitId: id, course, exportedAt: new Date().toISOString(), counts: {}, warnings: [] };
  const le = `/d2l/api/le/${options.le}/${id}`;
  const lp = `/d2l/api/lp/${options.lp}/${id}`;
  const section = async (name, fn) => {
    try { await fn(); }
    catch (e) {
      if (e.status === 401 || /redirected to login|session is not authenticated/i.test(e.message)) throw e;
      report.warnings.push({ section: name, status: e.status || null, message: e.message });
      process.stderr.write(`[${id}] ${name}: ${e.message}\n`);
    }
  };
  await mkdir(root, { recursive: true });
  await section('assignments', async () => {
    const folders = await api.json(`${le}/dropbox/folders/`);
    if (!Array.isArray(folders)) throw new Error('Unexpected assignments response');
    report.counts.assignments = folders.length;
    await saveJson(path.join(root, 'assignments', 'index.json'), folders);
    for (const f of folders) {
      const dir = path.join(root, 'assignments', `${f.Id}-${safeName(f.Name)}`);
      await saveJson(path.join(dir, 'details.json'), f);
      for (const a of f.Attachments || []) if (options.files && a.FileId != null)
        await section(`assignment ${f.Id} attachment ${a.FileId}`, () => download(api,
          `${le}/dropbox/folders/${f.Id}/attachments/${a.FileId}`,
          path.join(dir, 'attachments', `${a.FileId}-${safeName(a.FileName)}`)));
      await section(`assignment ${f.Id} own submissions`, async () => {
        const own = await api.json(`${le}/dropbox/folders/${f.Id}/submissions/mysubmissions/`);
        await saveJson(path.join(dir, 'my-submissions.json'), own);
        for (const entry of own) {
          for (const submission of entry.Submissions || []) {
            for (const file of submission.Files || []) if (options.files && file.FileId != null)
              await section(`submission ${submission.Id} file ${file.FileId}`, () => download(api,
                `${le}/dropbox/folders/${f.Id}/submissions/${submission.Id}/files/${file.FileId}`,
                path.join(dir, 'my-submission-files', `${submission.Id}-${file.FileId}-${safeName(file.FileName)}`)));
          }
          const entity = entry.Entity;
          const kind = entity?.EntityType === 'Group' ? 'group' : 'user';
          for (const file of entry.Feedback?.Files || []) if (options.files && file.FileId != null && entity?.EntityId != null)
            await section(`feedback file ${file.FileId}`, () => download(api,
              `${le}/dropbox/folders/${f.Id}/feedback/${kind}/${entity.EntityId}/attachments/${file.FileId}`,
              path.join(dir, 'feedback-files', `${file.FileId}-${safeName(file.FileName)}`)));
        }
      });
    }
  });
  await section('content', async () => {
    const toc = await api.json(`${le}/content/toc`);
    await saveJson(path.join(root, 'content', 'toc.json'), toc);
    const walk = async (modules, parent) => {
      for (const m of modules || []) {
        const dir = path.join(parent, `${m.ModuleId}-${safeName(m.Title)}`);
        await saveJson(path.join(dir, 'module.json'), m);
        report.counts.modules = (report.counts.modules || 0) + 1;
        await section(`module details ${m.ModuleId}`, async () => saveJson(path.join(dir, 'details.json'),
          await api.json(`${le}/content/modules/${m.ModuleId}`)));
        for (const t of m.Topics || []) {
          const base = `${t.TopicId}-${safeName(t.Title)}`;
          await saveJson(path.join(dir, `${base}.json`), t);
          report.counts.topics = (report.counts.topics || 0) + 1;
          await section(`topic details ${t.TopicId}`, async () => saveJson(path.join(dir, `${base}.details.json`),
            await api.json(`${le}/content/topics/${t.TopicId}`)));
          if (options.files && (t.TopicType === 1 || t.ActivityType === 1))
            await section(`topic file ${t.TopicId}`, () => download(api,
              `${le}/content/topics/${t.TopicId}/file`,
              path.join(dir, `${base}-${safeName(t.Url?.split('/').pop() || 'file')}`)));
        }
        await walk(m.Modules, dir);
      }
    };
    await walk(toc.Modules, path.join(root, 'content', 'modules'));
  });
  await section('course files', async () => {
    const seen = new Set();
    const base = `${lp}/managefiles/`;
    const walk = async (remote = '') => {
      if (seen.has(remote)) return;
      seen.add(remote);
      const entries = await paged(api, remote ? `${base}?path=${encodeURIComponent(remote)}` : base);
      await saveJson(path.join(root, 'course-files', ...safeSegments(remote), '.listing.json'), entries);
      for (const item of entries) {
        const child = [remote, item.Name].filter(Boolean).join('/');
        if (item.FileSystemObjectType === 1) await section(`folder ${child}`, () => walk(child));
        else if (item.FileSystemObjectType === 2) {
          report.counts.courseFiles = (report.counts.courseFiles || 0) + 1;
          if (options.files) await section(`file ${child}`, () => download(api,
            `${base}file?path=${encodeURIComponent(child)}`,
            path.join(root, 'course-files', ...safeSegments(child))));
        }
      }
    };
    await walk();
  });
  await section('announcements', async () => {
    const news = await api.json(`${le}/news/`);
    await saveJson(path.join(root, 'announcements.json'), news);
    report.counts.announcements = Array.isArray(news) ? news.length : 0;
    for (const item of news) for (const file of item.Attachments || []) if (options.files && file.FileId != null)
      await section(`announcement ${item.Id} attachment ${file.FileId}`, () => download(api,
        `${le}/news/${item.Id}/attachments/${file.FileId}`,
        path.join(root, 'announcement-files', `${item.Id}-${file.FileId}-${safeName(file.FileName)}`)));
  });
  await section('grades', async () => saveJson(path.join(root, 'my-grades.json'),
    await api.json(`${le}/grades/values/myGradeValues/`)));
  await section('calendar', async () => {
    const events = await paged(api, `${le}/calendar/events/`);
    await saveJson(path.join(root, 'calendar-events.json'), events);
    report.counts.calendarEvents = events.length;
  });
  await section('quizzes', async () => {
    const quizzes = await paged(api, `${le}/quizzes/`);
    await saveJson(path.join(root, 'quizzes', 'index.json'), quizzes);
    report.counts.quizzes = quizzes.length;
    for (const q of quizzes) {
      const quizId = q.QuizId ?? q.Id;
      if (quizId == null) continue;
      await section(`quiz ${quizId} details`, async () => saveJson(path.join(root, 'quizzes', `${quizId}.json`),
        await api.json(`${le}/quizzes/${quizId}`)));
    }
  });
  await section('discussions', async () => {
    const forums = await api.json(`${le}/discussions/forums/`);
    if (!Array.isArray(forums)) throw new Error('Unexpected discussions response');
    await saveJson(path.join(root, 'discussions', 'forums.json'), forums);
    report.counts.discussionForums = forums.length;
    for (const f of forums) await section(`discussion forum ${f.ForumId} topics`, async () => {
      const topics = await api.json(`${le}/discussions/forums/${f.ForumId}/topics/`);
      await saveJson(path.join(root, 'discussions', `${f.ForumId}-topics.json`), topics);
    });
  });
  await saveJson(path.join(root, 'manifest.json'), report);
  return report;
}

async function run(options, fetchImpl = fetch) {
  const token = process.env.BRIGHTSPACE_TOKEN;
  if (Boolean(token) === Boolean(options.cookies)) throw new Error('Provide exactly one of BRIGHTSPACE_TOKEN or --cookies');
  const credential = token ? { token } : { cookie: await cookieHeader(options.cookies, options.site) };
  const api = new Api(options.site, credential, fetchImpl);
  let courses = options.courses.map(id => ({ OrgUnit: { Id: Number(id), Name: 'course' } }));
  if (!courses.length) {
    courses = await paged(api, `/d2l/api/lp/${options.lp}/enrollments/myenrollments/?canAccess=true`);
    courses = courses.filter(c => c.OrgUnit?.Type?.Name === 'Course Offering' ||
      c.OrgUnit?.Type?.Code === 'Course Offering' || c.OrgUnit?.Type?.Id === 3);
    if (!courses.length) throw new Error('No accessible course offerings found. Pass --course ID if this site labels org unit types differently.');
  }
  const reports = new Array(courses.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < courses.length) {
      const index = cursor++;
      const c = courses[index];
      const id = c.OrgUnit?.Id ?? c.OrgUnitId ?? c.Id;
      if (!/^\d+$/.test(String(id))) continue;
      const saved = path.join(options.out, `${id}-${safeName(c.OrgUnit?.Name || 'course')}`, 'manifest.json');
      if (options.resume) {
        try {
          const previous = JSON.parse(await readFile(saved, 'utf8'));
          if (String(previous.orgUnitId) === String(id)) {
            process.stdout.write(`Already exported ${c.OrgUnit?.Name || id} (${id}); skipping.\n`);
            reports[index] = previous;
            continue;
          }
        } catch (_) { /* Missing or incomplete manifest: export this course. */ }
      }
      process.stdout.write(`Exporting ${c.OrgUnit?.Name || id} (${id})...\n`);
      reports[index] = await exportCourse(api, options, id, c.OrgUnit || c);
    }
  };
  await Promise.all(Array.from({ length: Math.min(options.concurrency, courses.length) }, () => worker()));
  const completed = reports.filter(Boolean);
  await saveJson(path.join(options.out, 'manifest.json'), {
    site: options.site, exportedAt: new Date().toISOString(),
    courses: completed.map(r => ({ orgUnitId: r.orgUnitId, counts: r.counts, warnings: r.warnings }))
  });
  const warnings = completed.reduce((n, r) => n + r.warnings.length, 0);
  if (warnings) process.stderr.write(`Export finished with ${warnings} section/file warning(s); inspect manifest.json for gaps.\n`);
  return completed;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) process.stdout.write(HELP);
    else {
      const reports = await run(options);
      process.stdout.write(`Done: ${reports.length} course(s). See ${path.resolve(options.out, 'manifest.json')}\n`);
    }
  } catch (e) {
    process.stderr.write(`Brightspace export: ${e.message}\n`);
    process.exitCode = 1;
  }
}
export { Api, parseArgs, safeName, safeSegments, cookieHeader, paged, exportCourse, run };
