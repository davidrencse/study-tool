import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Api, cookieHeader, exportCourse, parseArgs, safeName, safeSegments, run } from '../tools/brightspace-export.mjs';

test('Brightspace options and remote paths reject unsafe input', () => {
  assert.equal(parseArgs(['--site', 'https://school.example.edu', '--course', '123']).site, 'https://school.example.edu');
  assert.equal(parseArgs([]).site, 'https://brightspace.nyu.edu');
  assert.equal(parseArgs(['--resume']).resume, true);
  assert.equal(parseArgs(['--concurrency', '3']).concurrency, 3);
  assert.throws(() => parseArgs(['--concurrency', '5']), /concurrency/);
  assert.throws(() => parseArgs(['--site', 'http://school.example.edu']), /HTTPS/);
  assert.throws(() => parseArgs(['--site', 'https://school.example.edu/path']), /origin/);
  assert.throws(() => safeSegments('../../outside'), /Unsafe/);
  assert.deepEqual(safeSegments('/week 1/lecture.pdf'), ['week 1', 'lecture.pdf']);
  assert.equal(safeName('CON.txt'), '_CON.txt');
});

test('cookie export selects only live cookies for the requested site', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'brightspace-cookie-test-'));
  try {
    const file = path.join(dir, 'cookies.json');
    await writeFile(file, JSON.stringify({ cookies: [
      { name: 'session', value: 'ok', domain: '.example.edu' },
      { name: 'host-session', value: 'yes', domain: 'school.example.edu' },
      { name: 'other', value: 'bad', domain: 'other.edu' },
      { name: 'expired', value: 'bad', domain: '.example.edu', expires: 1 }
    ] }));
    assert.equal(await cookieHeader(file, 'https://school.example.edu'), 'host-session=yes');
    const netscape = path.join(dir, 'cookies.txt');
    await writeFile(netscape, [
      '# Netscape HTTP Cookie File',
      'school.example.edu\tFALSE\t/\tTRUE\t0\tsession\tok',
      '.example.edu\tTRUE\t/\tTRUE\t0\tother\tbad',
      'school.example.edu\tFALSE\t/\tTRUE\t1\texpired\tbad'
    ].join('\n'));
    assert.equal(await cookieHeader(netscape, 'https://school.example.edu'), 'session=ok');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('resumed concurrent export skips complete course manifests', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'brightspace-resume-test-'));
  const oldToken = process.env.BRIGHTSPACE_TOKEN;
  try {
    await mkdir(path.join(dir, '42-course'));
    await writeFile(path.join(dir, '42-course', 'manifest.json'), JSON.stringify({ orgUnitId: 42, counts: {}, warnings: [] }));
    process.env.BRIGHTSPACE_TOKEN = 'test-token';
    const calls = [];
    const fetchImpl = async url => {
      calls.push(url.pathname);
      const data = url.pathname.endsWith('/content/toc') ? { Modules: [] } : [];
      return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const reports = await run(parseArgs(['--course', '42', '--course', '43', '--out', dir, '--resume', '--concurrency', '3']), fetchImpl);
    assert.deepEqual(reports.map(r => r.orgUnitId), [42, 43]);
    assert.ok(calls.every(route => !route.includes('/42/')));
    assert.ok(calls.some(route => route.includes('/43/')));
  } finally {
    if (oldToken === undefined) delete process.env.BRIGHTSPACE_TOKEN;
    else process.env.BRIGHTSPACE_TOKEN = oldToken;
    await rm(dir, { recursive: true, force: true });
  }
});

test('exports assignment instructions, nested content, course file tree and permission report', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'brightspace-export-test-'));
  const calls = [];
  const routes = new Map([
    ['/d2l/api/le/1.82/42/dropbox/folders/', [{ Id: 5, Name: 'Essay', DueDate: '2026-10-12T23:00:00Z', Attachments: [{ FileId: 8, FileName: 'rubric.pdf' }] }]],
    ['/d2l/api/le/1.82/42/dropbox/folders/5/attachments/8', 'RUBRIC'],
    ['/d2l/api/le/1.82/42/dropbox/folders/5/submissions/mysubmissions/', [{
      Entity: { EntityId: 11, EntityType: 'User' },
      Submissions: [{ Id: 12, Files: [{ FileId: 13, FileName: 'essay.docx' }] }],
      Feedback: { Files: [{ FileId: 14, FileName: 'comments.pdf' }] }
    }]],
    ['/d2l/api/le/1.82/42/dropbox/folders/5/submissions/12/files/13', 'ESSAY'],
    ['/d2l/api/le/1.82/42/dropbox/folders/5/feedback/user/11/attachments/14', 'COMMENTS'],
    ['/d2l/api/le/1.82/42/content/toc', { Modules: [{ ModuleId: 2, Title: 'Week 1', Topics: [{ TopicId: 9, Title: 'Lecture', TopicType: 1, Url: '/lecture.pdf' }], Modules: [] }] }],
    ['/d2l/api/le/1.82/42/content/modules/2', { ModuleId: 2, Description: { Html: 'Week one' } }],
    ['/d2l/api/le/1.82/42/content/topics/9', { TopicId: 9, Description: { Html: 'Lecture notes' } }],
    ['/d2l/api/le/1.82/42/content/topics/9/file', 'LECTURE'],
    ['/d2l/api/lp/1.49/42/managefiles/', { Objects: [{ Name: 'slides', FileSystemObjectType: 1 }], Next: null }],
    ['/d2l/api/lp/1.49/42/managefiles/?path=slides', { Objects: [{ Name: 'notes.txt', FileSystemObjectType: 2 }], Next: null }],
    ['/d2l/api/lp/1.49/42/managefiles/file?path=slides%2Fnotes.txt', 'NOTES'],
    ['/d2l/api/le/1.82/42/calendar/events/', { Objects: [{ Id: 22, Title: 'Lecture' }], Next: null }],
    ['/d2l/api/le/1.82/42/quizzes/', { Objects: [{ QuizId: 23, Name: 'Midterm quiz' }], Next: null }],
    ['/d2l/api/le/1.82/42/quizzes/23', { QuizId: 23, Name: 'Midterm quiz' }],
    ['/d2l/api/le/1.82/42/discussions/forums/', [{ ForumId: 24, Name: 'Questions' }]],
    ['/d2l/api/le/1.82/42/discussions/forums/24/topics/', [{ TopicId: 25, Name: 'Week 1' }]]
  ]);
  const fetchImpl = async (url, init) => {
    const key = url.pathname + url.search;
    calls.push({ key, auth: init.headers.Authorization });
    if (key === '/d2l/api/le/1.82/42/news/' || key === '/d2l/api/le/1.82/42/grades/values/myGradeValues/')
      return new Response('forbidden', { status: 403 });
    const value = routes.get(key);
    if (value === undefined) return new Response('missing', { status: 404 });
    return typeof value === 'string' ? new Response(value) : Response.json(value);
  };
  try {
    const api = new Api('https://school.example.edu', { token: 'test-secret' }, fetchImpl);
    const report = await exportCourse(api, { out: dir, le: '1.82', lp: '1.49', files: true }, 42, { Name: 'My Course' });
    const root = path.join(dir, '42-My Course');
    assert.equal(report.counts.assignments, 1);
    assert.equal(report.counts.modules, 1);
    assert.equal(report.counts.topics, 1);
    assert.equal(report.counts.courseFiles, 1);
    assert.equal(report.counts.calendarEvents, 1);
    assert.equal(report.counts.quizzes, 1);
    assert.equal(report.counts.discussionForums, 1);
    assert.equal(await readFile(path.join(root, 'assignments', '5-Essay', 'attachments', '8-rubric.pdf'), 'utf8'), 'RUBRIC');
    assert.equal(await readFile(path.join(root, 'assignments', '5-Essay', 'my-submission-files', '12-13-essay.docx'), 'utf8'), 'ESSAY');
    assert.equal(await readFile(path.join(root, 'assignments', '5-Essay', 'feedback-files', '14-comments.pdf'), 'utf8'), 'COMMENTS');
    assert.equal(await readFile(path.join(root, 'content', 'modules', '2-Week 1', '9-Lecture-lecture.pdf'), 'utf8'), 'LECTURE');
    assert.equal(await readFile(path.join(root, 'course-files', 'slides', 'notes.txt'), 'utf8'), 'NOTES');
    assert.deepEqual(report.warnings.map(w => w.section), ['announcements', 'grades']);
    assert.ok(calls.every(c => c.auth === 'Bearer test-secret'));
    assert.doesNotMatch(await readFile(path.join(root, 'manifest.json'), 'utf8'), /test-secret/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('download redirects do not forward bearer credentials to another origin', async () => {
  const requests = [];
  const api = new Api('https://school.example.edu', { token: 'secret' }, async (url, init) => {
    requests.push({ origin: url.origin, auth: init.headers.Authorization });
    return requests.length === 1
      ? new Response(null, { status: 302, headers: { Location: 'https://files.example.net/file' } })
      : new Response('file');
  });
  assert.equal(await (await api.get('/d2l/api/le/1.82/42/content/topics/9/file')).text(), 'file');
  assert.deepEqual(requests, [
    { origin: 'https://school.example.edu', auth: 'Bearer secret' },
    { origin: 'https://files.example.net', auth: undefined }
  ]);
});
