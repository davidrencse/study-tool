/* ==========================================================================
   packs-more.js — Nutrition, Healthy Cities seminar, and your own notes
   (from Desktop\info). Same rules as packs.js: applied once, never
   overwrites what you have edited.
   ========================================================================== */

CONTENT_PACKS.push(
  {
    id: 'nyu-fall-2026-nut',
    apply(s) {
      const c = s.classes.find((x) => x.id === 'nut');
      if (!c) return;
      const i = c.info;
      Object.assign(i, {
        code: i.code || 'NUTR-UE 119.003',
        instructor: i.instructor || 'Mitchell Zandes, MS, RD, CDCES, CSCS',
        email: i.email || 'mpz220@nyu.edu',
        meeting: i.meeting || 'Mondays 4:55 PM',
        location: i.location || 'Silver Center, Room 408',
        officeHours: i.officeHours || 'By appointment (in person on Mondays preferred). Email first; resend if there is no reply in 48 hours.',
        syllabus: i.syllabus || 'library/nut/course/Syllabus%20Fall%202026.pdf',
        textbook: i.textbook || 'McGraw Hill Connect (Follett ACCESS, billed as a book charge)',
        grading: '500 points: attendance 10, three diet and lifestyle quizzes 90, Connect assignments 100, three exams 300. Absolute scale, no curve.',
        credits: i.credits || '3',
      });
      addCustom(c, [
        ['Exams', 'On Connect, in person during class, multiple choice and true/false. LockDown Browser required.'],
        ['Exam 3', 'Date to be announced (cumulative, emphasis on chapters 11–16)'],
        ['Attendance', 'Two absences are fine. Six or more costs 100 points.'],
        ['Missed exams', 'Email at least a week ahead for scheduled conflicts; unexcused misses score 0.'],
        ['Mailbox', '411 Lafayette, 5th floor, room 509'],
      ]);
      c.resources = mergeResources(c.resources, [
        ['Connect class page', 'https://connect.mheducation.com/class/m-zandes-mitch-zandes-nutr-human-nutrition-003', 'site'],
        ['LockDown Browser download', 'https://download.respondus.com/lockdown/download.php?id=543490690', 'site'],
        ['Syllabus (PDF)', 'library/nut/course/Syllabus%20Fall%202026.pdf', 'book'],
        ['Course schedule (PDF)', 'library/nut/course/Schedule%20Fall%202026.pdf', 'book'],
      ]);
      c.grading = gradingFrom([['Attendance', 2], ['Diet and lifestyle quizzes', 18], ['Connect assignments', 20], ['Exam 1', 20], ['Exam 2', 20], ['Exam 3', 20]], c.grading);
      c.grading.scale = [[93, 'A'], [90, 'A-'], [87, 'B+'], [83, 'B'], [80, 'B-'], [77, 'C+'], [73, 'C'], [70, 'C-'], [65, 'D+'], [60, 'D'], [0, 'F']];

      addSchedule(s, [
        { key: 'nut-lec', classId: 'nut', title: 'Nutrition and Health', type: 'lecture', date: '2026-09-14', time: '16:55', end: '', repeat: 'weekly', until: '2026-12-14', skip: ['2026-10-12'], location: 'Silver Center 408', remind: true },
        { key: 'nut-lec-1014', classId: 'nut', title: 'Nutrition and Health (Monday classes meet Wednesday)', type: 'lecture', date: '2026-10-14', time: '16:55', end: '', repeat: 'none', location: 'Silver Center 408', remind: true },
      ]);

      const connect = [
        ['2026-09-21', 'Orientation to Connect, Ch. 1 & 2'], ['2026-09-28', 'Ch. 3'], ['2026-10-05', 'Ch. 4'], ['2026-10-19', 'Ch. 5'],
        ['2026-10-26', 'Ch. 6'], ['2026-11-02', 'Ch. 7 & 8'], ['2026-11-09', 'Ch. 9 & 10'], ['2026-11-23', 'Ch. 11 & 12'],
        ['2026-11-30', 'Ch. 13 & 14'], ['2026-12-07', 'Ch. 15'], ['2026-12-14', 'Ch. 16'],
      ];
      s.events = s.events.filter((e) => !(e.classId === 'nut' && e.title.startsWith('[Template]')));
      addEvents(s, [
        ...connect.map(([date, what], k) => ({ key: `nut-connect-${k}`, title: `Connect assignment: ${what}`, date, time: '', type: 'assignment', notes: 'Due date from the course schedule. Check Connect for the exact time.' })),
        { key: 'nut-quiz1', title: 'Diet and lifestyle analysis quiz #1', date: '2026-10-14', time: '16:55', type: 'quiz', notes: 'Analyze a one-day diet and lifestyle profile and suggest healthier alternatives (30 points).' },
        { key: 'nut-quiz2', title: 'Diet and lifestyle analysis quiz #2', date: '2026-11-16', time: '16:55', type: 'quiz', notes: 'Analyze a one-day diet and lifestyle profile and suggest healthier alternatives (30 points).' },
        { key: 'nut-quiz3', title: 'Diet and lifestyle analysis quiz #3', date: '2026-12-14', time: '16:55', type: 'quiz', notes: 'Analyze a one-day diet and lifestyle profile and suggest healthier alternatives (30 points).' },
        { key: 'nut-exam1', title: 'Exam 1 (chapters 1–4)', date: '2026-10-05', time: '16:55', type: 'exam', notes: 'On Connect, in class, with LockDown Browser. Multiple choice and true/false.', topicIds: ['nut-basics', 'nut-guide', 'nut-dig'] },
        { key: 'nut-exam2', title: 'Exam 2 (chapters 5–10)', date: '2026-11-09', time: '16:55', type: 'exam', notes: 'On Connect, in class, with LockDown Browser. Multiple choice and true/false.', topicIds: ['nut-carb', 'nut-lip', 'nut-prot', 'nut-energy', 'nut-vit'] },
      ].map((e) => ({ ...e, classId: 'nut' })));

      addNotes(s, PACK_DATA.nutNotes);
      markCovered(s, PACK_DATA.nutNotes);
      // the starter macronutrient card duplicates the lecture one
      s.cards = s.cards.filter((x) => !(x.classId === 'nut' && x.source === 'starter' && /Calories per gram/i.test(x.front)));
      addCards(s, 'nut');
      rewriteHub(s, 'nut');
    },
  },
  {
    id: 'nyu-fall-2026-urb',
    apply(s) {
      const c = s.classes.find((x) => x.id === 'urb');
      if (!c) return;
      const i = c.info;
      Object.assign(i, {
        code: i.code || 'URB-UY 4504',
        meeting: i.meeting || 'Twice a week, in person',
        syllabus: i.syllabus || 'library/urb/course/Syllabus.docx',
        textbook: i.textbook || 'No textbook. Readings are posted as scans and PDFs or through the NYU Library.',
        grading: 'Attendance and participation 25%, midterm project 25%, individual and group assignments 25%, final group project 25%',
        credits: i.credits || '4',
      });
      addCustom(c, [
        ['Course title', 'Healthy Cities and Built Environments'],
        ['Midterm project', 'Individual literature review on a topic you choose, plus a short tutorial presentation'],
        ['Final project', 'Team proposal for a context-relevant healthy city plan: presentation and summary document'],
        ['Writing', 'MLA citations and spell-checked, scholarly papers. The NYU Writing Center can help.'],
        ['AI policy', 'OK for early brainstorming; every claim needs a real, cited source'],
        ['Attendance', 'More than 3 unexcused absences means losing credit. Late work loses points unless you get an extension in advance.'],
        ['Workload', 'About 6.6 hours of outside work per week'],
      ]);
      c.resources = mergeResources(c.resources, [
        ['Syllabus (Word file)', 'library/urb/course/Syllabus.docx', 'book'],
        ['Purdue OWL: MLA style', 'https://owl.purdue.edu/owl/research_and_citation/mla_style/mla_formatting_and_style_guide/mla_general_format.html', 'site'],
      ]);
      c.grading = gradingFrom([['Attendance and participation', 25], ['Midterm project', 25], ['Individual and group assignments', 25], ['Final project', 25]], c.grading);

      ensureTopic(s, { id: 'urb-healthy', classId: 'urb', name: 'Healthy Cities', prereqs: ['urb-theory'], desc: 'What makes a city healthy for the people who live in it, and whether that is even possible.' });
      ensureTopic(s, { id: 'urb-tbl', classId: 'urb', name: 'Triple Bottom Line & Just Sustainability', prereqs: ['urb-healthy'], desc: 'The three pillars of sustainability and Agyeman & Evans’ just sustainability.' });
      ensureTopic(s, { id: 'urb-resil', classId: 'urb', name: 'Urban Resilience', prereqs: ['urb-tbl', 'urb-env'], desc: 'Competing definitions of resilience and who they serve: Sandy, Maui, New Orleans, Miami.' });
      const health = s.topics.find((t) => t.id === 'urb-health');
      if (health && !health.prereqs.includes('urb-healthy')) health.prereqs.push('urb-healthy');
      addLink(s, 'urb-healthy', 'nut-foodsec', 'food environments and health');
      markCovered(s, [{ lecture: { covered: true }, body: '[[Healthy Cities]] [[Triple Bottom Line & Just Sustainability]] [[Urban Resilience]] [[Political Economy of Cities]] [[Segregation & Inequality]] [[Gentrification & Displacement]]' }]);
      rewriteHub(s, 'urb');
    },
  },
  {
    id: 'my-notes-2026-09',
    apply(s) {
      addNotes(s, PACK_DATA.myNotes);
      const essay = s.events.find((e) => /resiliency/i.test(e.title));
      if (essay && !/Readings:/.test(essay.notes || '')) {
        essay.notes = `${essay.notes || ''}\n\nReadings: NY’s 2 Sandys, The Architect’s Newspaper (2016), and your reading group article. Your reading notes are in Notes, tagged “reading”.`.trim();
        essay.topicIds = ['urb-resil'];
      }
      if (!s.tasks.some((t) => /PA1/.test(t.title)))
        s.tasks.push({ id: uid(), title: 'PA1: expand the one-word answers with the specific traces (due Tue 9/22, 5pm)', date: todayStr(), done: false, category: 'School', priority: 'high' });
    },
  }
);
