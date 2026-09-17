/* ==========================================================================
   packs.js — real course content, merged into your data once.
   Each pack runs a single time (tracked in state.appliedPacks) and never
   overwrites anything you have already edited.
   ========================================================================== */

const CONTENT_PACKS = [
  {
    id: 'nyu-fall-2026-os',
    apply(s) {
      const c = s.classes.find((x) => x.id === 'os');
      if (!c) return;
      const setIfEmpty = (k, v) => {
        if (!c.info[k]) c.info[k] = v;
      };
      setIfEmpty('code', 'CS-UY 3224');
      setIfEmpty('instructor', 'Prof. Gustavo Sandoval');
      setIfEmpty('email', 'gustavo.sandoval@nyu.edu');
      setIfEmpty('meeting', 'Tuesdays and Thursdays, 2:00–3:50 PM');
      setIfEmpty('officeHours', 'Wednesdays 2–3 PM on Zoom (nyu.zoom.us/my/Sandoval)');
      setIfEmpty('ta', 'Student assistant hours are posted on EdStem');
      setIfEmpty('lms', 'https://brightspace.nyu.edu/d2l/home/627912');
      setIfEmpty('syllabus', 'library/os/course/Syllabus%20Fall%202026.pdf');
      setIfEmpty('credits', '4');
      setIfEmpty('textbook', 'xv6 book (rev 8) and xv6 source, Operating Systems: Three Easy Pieces (OSTEP), Tanenbaum & Bos, Modern Operating Systems');
      c.info.grading = '20% homework (programming projects), 35% midterm, 35% final, 10% participation (polls)';
      addCustom(c, [
        ['Discussion', 'EdStem (linked below)'],
        ['Homework', 'Individual programming projects in C, graded by the Anubis autograder. Resubmit as often as you like before the deadline.'],
        ['Late policy', '24 hours per assignment, then not accepted'],
        ['Recitation', 'Optional, over Zoom and recorded (Friday 4:30 in the Lecture 5 announcement)'],
        ['Participation', 'Poll Everywhere through Brightspace. Answer at least 80% of polls for full credit; no makeups.'],
        ['Collaboration', 'Individual work. Discuss ideas but never share code (a plagiarism match means a 0).'],
        ['Midterm', 'After the virtual memory unit (date not announced yet)'],
        ['Final exam', 'Scheduled school-wide during finals week. Don’t book travel before it ends.'],
      ]);
      c.resources = mergeResources(c.resources, [
        ['Brightspace', 'https://brightspace.nyu.edu/d2l/home/627912', 'site'],
        ['Ed Discussion', 'https://edstem.org/us/courses/105298/discussion/8232385', 'site'],
        ['My notes (Google Drive)', PACK_DATA.drive, 'notes'],
        ['Recitation Zoom', 'https://nyu.zoom.us/j/93463267042', 'site'],
        ['Office hours Zoom', 'https://nyu.zoom.us/my/Sandoval', 'site'],
        ['Syllabus (PDF)', 'library/os/course/Syllabus%20Fall%202026.pdf', 'book'],
        ['GDB cheat sheet', 'http://darkdust.net/files/GDB%20Cheat%20Sheet.pdf', 'site'],
        ['OSTEP (PDF)', 'library/os/books/OSTEP.pdf', 'book'],
        ['xv6 book, rev 8 (PDF)', 'library/os/books/xv6%20book%20rev8.pdf', 'book'],
        ['xv6 source listing, rev 8 (PDF)', 'library/os/books/xv6%20source%20rev8.pdf', 'book'],
        ['Tanenbaum, Modern Operating Systems (PDF)', 'library/os/books/Tanenbaum%20Modern%20Operating%20Systems.pdf', 'book'],
        ['OSTEP online', 'http://pages.cs.wisc.edu/~remzi/OSTEP/', 'book'],
        ['Beej’s Guide to C', 'https://beej.us/guide/bgc/', 'site'],
        ['C reference (cppreference)', 'https://en.cppreference.com/w/c.html', 'site'],
      ]);
      c.grading = gradingFrom([['Homework', 20], ['Midterm', 35], ['Final exam', 35], ['Participation', 10]], c.grading);

      // topics that match the lectures
      ensureTopic(s, { id: 'os-c', classId: 'os', name: 'C Programming', prereqs: [], desc: 'Types, operators, control flow, functions, arrays, strings, pointers, compiling with gcc and make.' });
      ensureTopic(s, { id: 'os-asm', classId: 'os', name: 'x86 Assembly & Booting', prereqs: ['os-c'], desc: 'Registers, AT&T syntax, the stack, calling conventions, BIOS and the xv6 bootloader.' });
      const intro = s.topics.find((t) => t.id === 'os-intro');
      if (intro && !intro.prereqs.includes('os-asm')) intro.prereqs.push('os-asm');
      addLink(s, 'os-asm', 'sec-mem', 'stack frames and return addresses');

      addSchedule(s, [
        { key: 'os-lec-tue', classId: 'os', title: 'Operating Systems', type: 'lecture', date: '2026-09-08', time: '14:00', end: '15:50', repeat: 'weekly', until: '2026-12-08', remind: true },
        { key: 'os-lec-thu', classId: 'os', title: 'Operating Systems', type: 'lecture', date: '2026-09-03', time: '14:00', end: '15:50', repeat: 'weekly', until: '2026-12-10', skip: ['2026-11-26'], remind: true },
        { key: 'os-oh', classId: 'os', title: 'OS office hours (Zoom)', type: 'meeting', date: '2026-09-09', time: '14:00', end: '15:00', repeat: 'weekly', until: '2026-12-09', location: 'nyu.zoom.us/my/Sandoval', remind: false },
      ]);
      addNotes(s, PACK_DATA.osNotes);
      markCovered(s, PACK_DATA.osNotes);
      addCards(s, 'os');
      s.events = s.events.filter((e) => !(e.classId === 'os' && e.title.startsWith('[Template]')));
      rewriteHub(s, 'os');
    },
  },
  {
    id: 'nyu-fall-2026-sec',
    apply(s) {
      const c = s.classes.find((x) => x.id === 'sec');
      if (!c) return;
      c.name = c.name === 'Computer Security' ? 'Computer Security' : c.name;
      Object.assign(c.info, {
        code: c.info.code || 'CS-UY 3923 / CS-GY 6813',
        instructor: c.info.instructor || 'Prof. Evan Johnson',
        email: c.info.email || 'e.johnson@nyu.edu',
        meeting: c.info.meeting || 'Tuesdays 6:30–9:00 PM (Sept 8 – Dec 15)',
        officeHours: c.info.officeHours || 'Thursdays 2:30–3:30 PM, 370 Jay St room 1055',
        ta: c.info.ta || 'Aryan Chaudhary (Tue 4–5 PM, room TBD), Will Liu (Mon 1–2 PM, 370 Jay St 1068)',
        syllabus: c.info.syllabus || 'library/sec/course/Syllabus%20Fall%202026.pdf',
        lms: c.info.lms || 'https://brightspace.nyu.edu/d2l/home/625009',
        textbook: c.info.textbook || 'No textbook. Readings are linked from the lectures.',
        grading: 'Projects 25% (5 assignments), Exam 1 20%, Exam 2 20%, Final 35%',
      });
      addCustom(c, [
        ['Course name on Brightspace', 'Information Security & Privacy'],
        ['Submissions', 'Gradescope, through Brightspace'],
        ['Late days', '3 late days across all project checkpoints, no email needed'],
        ['Teams', 'Work alone or in pairs'],
        ['AI policy', 'Allowed on projects if you cite how you used it. Exams are pen and paper, no AI.'],
        ['Setup', 'Linux with POSIX tools and QEMU. Mac/Windows setups aren’t supported by staff.'],
      ]);
      c.resources = mergeResources(c.resources, [
        ['Brightspace', 'https://brightspace.nyu.edu/d2l/home/625009', 'site'],
        ['Syllabus (PDF)', 'library/sec/course/Syllabus%20Fall%202026.pdf', 'book'],
        ['Smashing the Stack for Fun and Profit (Phrack 49)', 'http://phrack.org/issues/49/14.html', 'book'],
        ['Chromium memory safety', 'https://www.chromium.org/Home/chromium-security/memory-safety/', 'book'],
        ['OverTheWire wargames', 'http://overthewire.org/wargames/', 'site'],
        ['Reverse engineering challenges', 'https://challenges.re/', 'site'],
        ['CTFtime', 'https://ctftime.org/ctfs', 'site'],
      ]);
      c.grading = gradingFrom([['Projects', 25], ['Exam 1', 20], ['Exam 2', 20], ['Final exam', 35]], c.grading);
      c.grading.scale = [[92, 'A'], [90, 'A-'], [88, 'B+'], [82, 'B'], [80, 'B-'], [78, 'C+'], [72, 'C'], [70, 'C-'], [68, 'D+'], [62, 'D'], [0, 'F']];

      addSchedule(s, [
        { key: 'sec-lec', classId: 'sec', title: 'Computer Security', type: 'lecture', date: '2026-09-08', time: '18:30', end: '21:00', repeat: 'weekly', until: '2026-12-08', skip: ['2026-10-27'], remind: true },
        { key: 'sec-oh', classId: 'sec', title: 'Security office hours', type: 'meeting', date: '2026-09-10', time: '14:30', end: '15:30', repeat: 'weekly', until: '2026-12-10', location: '370 Jay St, room 1055', remind: false },
        { key: 'sec-ta-aryan', classId: 'sec', title: 'Security TA hours (Aryan)', type: 'meeting', date: '2026-09-08', time: '16:00', end: '17:00', repeat: 'weekly', until: '2026-12-08', location: 'Room TBD', remind: false },
        { key: 'sec-ta-will', classId: 'sec', title: 'Security TA hours (Will)', type: 'meeting', date: '2026-09-14', time: '13:00', end: '14:00', repeat: 'weekly', until: '2026-12-07', location: '370 Jay St, room 1068', remind: false },
      ]);

      // topics follow the syllabus instead of a generic security survey
      const topics = [
        ['sec-cia', 'Security Mindset & CIA', [], 'Security as making things not happen; binary vs risk-management models; confidentiality, integrity, availability.'],
        ['sec-threat', 'Threat Modeling & Safety Policies', ['sec-cia'], 'What to protect and from whom: safety policies, attacker models, attack surfaces, vulnerabilities.'],
        ['sec-mem', 'Buffer Overflows & Stack Smashing', ['sec-threat', 'os-asm'], 'Overwriting return addresses, shellcode, NOP sleds, the four overflow patterns.'],
        ['sec-fmt', 'Format String & Integer Bugs', ['sec-mem'], 'printf with attacker-controlled formats; integer overflow in length checks.'],
        ['sec-heap', 'Heap Exploits', ['sec-mem'], 'Advanced memory corruption on the heap (Week 3).'],
        ['sec-fuzz', 'Finding Vulnerabilities', ['sec-heap'], 'Fuzzing, sanitizers and static analysis (Week 4).'],
        ['sec-mitig', 'Exploit Mitigations', ['sec-heap'], 'Compiler and OS mitigations that make bugs harder to exploit (Week 5).'],
        ['sec-hw', 'Hardware Defenses', ['sec-mitig'], 'Hardware support for memory safety (Week 7).'],
        ['sec-lang', 'Language Defenses & Memory Safety', ['sec-mitig'], 'Memory-safe languages and language-level defenses (Week 8).'],
        ['sec-iso', 'Process & Hypervisor Isolation', ['sec-hw'], 'Isolation with processes and hypervisors (Week 9).'],
        ['sec-sfi', 'Software Fault Isolation', ['sec-iso'], 'Sandboxing code inside a process (Week 10).'],
        ['sec-side', 'Side Channels', ['sec-hw'], 'Leaking secrets through timing, caches and other shared state (Week 12).'],
        ['sec-ct', 'Constant-time Programming & IFC', ['sec-side'], 'Writing code whose behavior doesn’t depend on secrets; information flow control (Week 13).'],
      ];
      const keep = new Set(topics.map((t) => t[0]));
      const removed = new Set(s.topics.filter((t) => t.classId === 'sec' && !keep.has(t.id)).map((t) => t.id));
      s.topics = s.topics.filter((t) => !removed.has(t.id));
      for (const [id, name, prereqs, desc] of topics) {
        const t = s.topics.find((x) => x.id === id);
        if (t) Object.assign(t, { name, desc, prereqs: [...new Set([...prereqs, ...t.prereqs.filter((p) => !removed.has(p))])] });
        else s.topics.push({ id, classId: 'sec', name, prereqs, desc, mastery: 0 });
      }
      s.topics.forEach((t) => (t.prereqs = t.prereqs.filter((p) => !removed.has(p))));
      const remap = { 'sec-ac': 'sec-iso', 'sec-mal': 'sec-iso', 'sec-priv': 'sec-threat' };
      s.links = s.links
        .map((l) => ({ ...l, a: remap[l.a] || l.a, b: remap[l.b] || l.b }))
        .filter((l) => !removed.has(l.a) && !removed.has(l.b) && l.a !== l.b)
        .filter((l, i, arr) => arr.findIndex((x) => (x.a === l.a && x.b === l.b) || (x.a === l.b && x.b === l.a)) === i);
      s.links.forEach((l) => {
        if (l.a === 'os-prot' && l.b === 'sec-iso') l.label = 'process isolation';
        if (l.a === 'os-virt' && l.b === 'sec-iso') l.label = 'hypervisors';
        if (l.b === 'urb-smart' && l.a === 'sec-threat') l.label = 'threat models for surveillance';
      });
      addLink(s, 'os-vm', 'sec-side', 'caches, TLBs and timing');
      addLink(s, 'os-proc', 'sec-mem', 'execve and shellcode');
      s.cards = s.cards.filter((x) => !(x.classId === 'sec' && x.source === 'starter' && x.topicId !== 'sec-mem'));
      s.cards.forEach((x) => {
        if (removed.has(x.topicId)) x.topicId = '';
      });
      (s.snippets || []).forEach((x) => {
        if (removed.has(x.topicId)) x.topicId = '';
      });

      // deadlines and exams from the syllabus and Week 2 slides
      s.events = s.events.filter((e) => !(e.classId === 'sec' && e.title.startsWith('[Template]')));
      const exam1 = ['sec-cia', 'sec-threat', 'sec-mem', 'sec-fmt', 'sec-heap', 'sec-fuzz', 'sec-mitig'];
      const exam2 = ['sec-hw', 'sec-lang', 'sec-iso', 'sec-sfi'];
      addEvents(s, [
        { key: 'sec-pa1', title: 'PA1', date: '2026-09-22', time: '17:00', type: 'project', notes: 'Postponed to 9/22 at 5pm (Week 2 slides). Submit on Gradescope.' },
        { key: 'sec-pa2', title: 'PA2 (Brightspace: Assignment 2)', date: '2026-09-29', time: '17:00', type: 'project', notes: 'Due 5pm on Gradescope. Released Sept 15. Start early.' },
        { key: 'sec-pa3', title: 'PA3', date: '2026-10-20', time: '17:00', type: 'project', notes: 'Date from the syllabus schedule. Confirm the time on Brightspace.' },
        { key: 'sec-pa4', title: 'PA4', date: '2026-11-10', time: '17:00', type: 'project', notes: 'Date from the syllabus schedule. Confirm the time on Brightspace.' },
        { key: 'sec-pa5', title: 'PA5', date: '2026-12-01', time: '17:00', type: 'project', notes: 'Date from the syllabus schedule. Confirm the time on Brightspace.' },
        { key: 'sec-exam1', title: 'Exam 1', date: '2026-10-13', time: '18:30', type: 'exam', notes: 'Pen and paper, no AI. Covers Weeks 1–5. Confirm room and time.', topicIds: exam1 },
        { key: 'sec-exam2', title: 'Exam 2', date: '2026-11-24', time: '18:30', type: 'exam', notes: 'Pen and paper, no AI. Covers Weeks 7–10. Confirm room and time.', topicIds: exam2 },
        { key: 'sec-final', title: 'Final exam', date: '2026-12-22', time: '18:30', type: 'exam', notes: 'Worth 35%. Confirm date, room and time on Brightspace.', topicIds: [...exam1, ...exam2, 'sec-side', 'sec-ct'] },
      ].map((e) => ({ ...e, classId: 'sec' })));

      addNotes(s, PACK_DATA.secNotes);
      markCovered(s, PACK_DATA.secNotes);
      addCards(s, 'sec');
      rewriteHub(s, 'sec');
      const cross = s.notes.find((n) => n.id === 'tmpl-cross');
      if (cross && cross.body.includes('[[Access Control]]')) {
        cross.body = cross.body
          .replace('[[Protection & Isolation]] is the OS side of [[Access Control]].', '[[Protection & Isolation]] in OS is the foundation for [[Process & Hypervisor Isolation]] in Security.')
          .replace('[[Memory Management]] explains the stack/heap layout abused in [[Memory Safety & Buffer Overflows]].', '[[x86 Assembly & Booting]] (stack frames, return addresses) is exactly what [[Buffer Overflows & Stack Smashing]] abuses.')
          .replace('[[Privacy & Ethics]] is central to critiques of [[Smart Cities & Surveillance]].', '[[Threat Modeling & Safety Policies]] is a useful lens for critiques of [[Smart Cities & Surveillance]].');
      }
    },
  },
];

/* ---------------- helpers ---------------- */
function addCustom(c, pairs) {
  c.custom ||= [];
  for (const [k, v] of pairs) if (!c.custom.some((f) => f.k === k)) c.custom.push({ k, v });
}

function mergeResources(list = [], items) {
  for (const [label, url, kind] of items) if (!list.some((r) => r.url === url)) list.push({ id: uid(), label, url, kind });
  return list;
}

function gradingFrom(pairs, existing) {
  if (existing?.items?.length) return existing; // never throw away entered scores
  return { categories: pairs.map(([name, weight]) => ({ id: uid(), name, weight })), items: [], target: existing?.target || 90 };
}

function ensureTopic(s, t) {
  if (!s.topics.some((x) => x.id === t.id)) s.topics.push({ mastery: 0, ...t });
}

function addLink(s, a, b, label) {
  if (!s.topics.some((t) => t.id === a) || !s.topics.some((t) => t.id === b)) return;
  if (s.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) return;
  s.links.push({ id: uid(), a, b, label });
}

/** Recurring class sessions and office hours, stored as the calendar's scheduled events. */
function addSchedule(s, list) {
  for (const e of list) {
    if (s.events.some((x) => x.key === e.key)) continue;
    s.events.push({ id: uid(), done: false, topicIds: [], skip: [], location: '', notes: '', allDay: false, ...e });
  }
}

function addEvents(s, list) {
  for (const e of list) {
    if (s.events.some((x) => x.key === e.key)) continue;
    s.events.push({ id: uid(), done: false, topicIds: [], ...e });
  }
}

function addNotes(s, notes) {
  const now = Date.now();
  notes.forEach((n, i) => {
    if (s.notes.some((x) => x.id === n.id)) return;
    s.notes.push({ ...n, created: now - i, updated: now - i });
  });
}

function markCovered(s, notes) {
  const topicByName = new Map(s.topics.map((t) => [t.name.toLowerCase(), t]));
  for (const n of notes) {
    if (!n.lecture?.covered) continue;
    for (const w of extractWikilinks(n.body)) {
      const t = topicByName.get(w.toLowerCase());
      if (t && t.mastery === 0) t.mastery = 1;
    }
  }
}

function addCards(s, classId) {
  const have = new Set(s.cards.map((c) => c.front));
  for (const c of PACK_DATA.cards.filter((x) => x.classId === classId)) {
    if (have.has(c.front)) continue;
    s.cards.push(newCard({ ...c, source: 'lecture' }));
  }
}

function rewriteHub(s, classId) {
  const hub = s.notes.find((n) => n.id === 'hub-' + classId);
  if (!hub || !hub.tags.includes('template')) return;
  const c = s.classes.find((x) => x.id === classId);
  const lectures = s.notes.filter((n) => n.classId === classId && n.lecture).sort((a, b) => a.lecture.n - b.lecture.n);
  hub.tags = ['hub'];
  hub.title = `${c.name}: course hub`;
  hub.body = `# ${c.name}
${c.info.code}, ${c.info.instructor}

## Lectures
${lectures.map((l) => `- ${l.lecture.covered ? '[x]' : '[ ]'} [[${l.title}]]`).join('\n')}

## Topics
${s.topics.filter((t) => t.classId === classId).map((t) => `- [[${t.name}]]`).join('\n')}

## Big picture
- What is this course about, in one sentence?

## Things I'm confused about
- [ ]
`;
  hub.updated = Date.now();
}

function applyPacks(s) {
  s.appliedPacks ||= [];
  if (typeof PACK_DATA === 'undefined') return s;
  for (const p of CONTENT_PACKS) {
    if (s.appliedPacks.includes(p.id)) continue;
    try {
      p.apply(s);
      s.appliedPacks.push(p.id);
    } catch (err) {
      console.error('Content pack failed', p.id, err);
    }
  }
  return s;
}
