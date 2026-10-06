/* Merge a reviewed local Brightspace export into existing Study Hub data. */
if (typeof BRIGHTSPACE_SNAPSHOT !== 'undefined') CONTENT_PACKS.push({
  id: `${BRIGHTSPACE_SNAPSHOT.id}-merge-v3`,
  apply(s) {
    const matchExisting = (item) => {
      const bySource = s.events.find(e => e.brightspaceKey === item.key || e.key === item.key);
      if (bySource) return bySource;
      const number = (item.title.match(/(?:homework|assignment|PA|project)\s*#?\s*(\d+)/i) || [])[1];
      if (!number) return null;
      if (item.classId === 'os' && number === '1') return s.events.find(e => e.key === 'os-assignment-1') || null;
      if (item.classId === 'sec') return s.events.find(e => e.key === `sec-pa${number}`) || null;
      return null;
    };
    for (const course of BRIGHTSPACE_SNAPSHOT.courses) {
      const klass = s.classes.find(c => c.id === course.classId);
      if (!klass) continue;
      klass.resources ||= [];
      for (const resource of course.resources) {
        if (!klass.resources.some(r => r.url === resource.url))
          klass.resources.push({ id: uid(), ...resource });
      }
      for (const note of course.notes) {
        const current = s.notes.find(n => n.id === note.id);
        if (!current)
          s.notes.push({ ...note, created: Date.now(), updated: Date.now() });
        else if (current.updated === current.created && current.body !== note.body) {
          current.body = note.body;
          current.created = current.updated = Date.now();
        }
      }
      for (const item of course.events) {
        const existing = matchExisting(item);
        if (!existing) {
          s.events.push({ id: uid(), done: !!item.submitted, topicIds: [], repeat: 'none', skip: [], ...item });
          continue;
        }
        existing.brightspaceKey = item.key;
        existing.brightspaceId = item.brightspaceId || existing.brightspaceId;
        existing.brightspaceEntityType = item.brightspaceEntityType || existing.brightspaceEntityType;
        if (item.submitted && existing.sourceType !== 'brightspace-api') existing.done = true;
        existing.date = item.date;
        existing.time = item.time;
        existing.dueAt = item.dueAt;
        existing.dueTimezone = item.dueTimezone;
        existing.assignmentUrl = item.assignmentUrl || existing.assignmentUrl;
        existing.sourceType = item.sourceType;
        if (existing.key === 'os-assignment-1') {
          if (existing.title === 'Assignment 1') existing.title = item.title;
          existing.notes = (existing.notes || '').replace(
            /the announcement does not specify a submission time\. Check Brightspace for the exact time and assignment instructions\./i,
            `Brightspace confirms the ${item.time} New York time deadline. See the attached assignment instructions.`
          );
        }
        existing.sources = [...(existing.sources || [])];
        for (const source of item.sources || [])
          if (!existing.sources.some(x => x.url === source.url)) existing.sources.push(source);
        if (!existing.notes) existing.notes = item.notes || '';
        // Keep the student's title, completion, and notes for matched records.
      }
    }
    // Earlier course packs had approximate dates. Fold confirmed Brightspace
    // records into them, retaining IDs, edits, and completion where possible.
    const absorb = (target, source, { keepTime = false } = {}) => {
      if (!target || !source || target === source) return;
      target.date = source.date;
      if (!keepTime) {
        target.time = source.time;
        target.dueAt = source.dueAt;
        target.dueTimezone = source.dueTimezone;
        target.brightspaceKey = source.brightspaceKey || source.key;
      }
      target.done = !!(target.done || source.done);
      target.assignmentUrl = source.assignmentUrl || target.assignmentUrl;
      target.sourceType = 'brightspace-api';
      target.sources ||= [];
      for (const item of source.sources || [])
        if (!target.sources.some(x => x.url === item.url)) target.sources.push(item);
      if (source.notes && !target.notes) target.notes = source.notes;
      s.events = s.events.filter(e => e !== source);
    };
    const event = key => s.events.find(e => e.key === key);
    const connectIds = ['2025033', '2025036', '2025037', '2046665', '2046683'];
    connectIds.forEach((id, i) => absorb(event(`nut-connect-${i}`), event(`brightspace-calendar-609704-${id}`)));
    absorb(event('nut-quiz1'), event('brightspace-quiz-609704-521010'));
    const essay = s.events.find(e => e.classId === 'urb' && /resilien(?:cy|ce).*essay/i.test(e.title) && !e.key);
    absorb(essay, event('brightspace-dropbox-601719-1252206'));
    const exam = event('nut-exam1');
    const connectExam = event('brightspace-calendar-609704-2025035');
    if (exam && connectExam) {
      absorb(exam, connectExam, { keepTime: true });
      if (!/Brightspace calendar lists the Connect exam item at 8:00 PM/i.test(exam.notes || ''))
        exam.notes = `${exam.notes || ''}\n\nBrightspace calendar lists the Connect exam item at 8:00 PM New York time. The exam is taken in class; the course meeting begins at 4:55 PM.`.trim();
    }
    // The old seed treated this submitted PA1 as an open personal to-do.
    if (event('sec-pa1')?.done) {
      const oldTask = s.tasks.find(t => /^PA1: expand the one-word answers with the specific traces/i.test(t.title));
      if (oldTask) oldTask.done = true;
    }
  },
});

/* Dates and instructions verified against the September 30 export. */
CONTENT_PACKS.push({
  id: 'brightspace-reviewed-2026-10-01',
  apply(s) {
    const addEvent = item => {
      if (!s.events.some(e => e.key === item.key))
        s.events.push({ id: uid(), done: false, topicIds: [], repeat: 'none', skip: [], ...item });
    };
    const addNote = note => {
      if (!s.notes.some(n => n.id === note.id))
        s.notes.push({ ...note, created: Date.now(), updated: Date.now() });
    };
    const nut = s.classes.find(c => c.id === 'nut');
    if (nut) {
      const exam3 = nut.custom?.find(x => x.k === 'Exam 3');
      if (exam3 && /Date to be announced/i.test(exam3.v))
        exam3.v = 'Final exam: December 21 at 6:00 PM, Silver Center room 408 (Week 2 Housekeeping Notes).';
      addEvent({ key: 'nut-final-2026', classId: 'nut', title: 'Nutrition final exam', type: 'exam',
        date: '2026-12-21', time: '18:00', location: 'Silver Center, Room 408',
        notes: 'Final exam date, time, and room confirmed in the Week 2 Housekeeping Notes. Cumulative, with emphasis on chapters 11–16. On Connect in class.',
        sources: [{ label: 'Week 2 Housekeeping Notes', url: 'https://brightspace.nyu.edu/d2l/le/news/609704' }] });
      const resource = label => nut.resources?.find(r => r.label === label)?.url || '';
      const review = resource('Review Sheets: Exam 1');
      const slides = resource('Presentation Slides: Chapter 4');
      const links = [review && `[Exam 1 review sheet](${review})`, slides && `[Chapter 4 slides](${slides})`,
        '[Connect assignments and Recharge practice](https://connect.mheducation.com/class/m-zandes-mitch-zandes-nutr-human-nutrition-003)'].filter(Boolean);
      addNote({ id: 'brightspace-nut-exam1-study-20261001', classId: 'nut', title: 'Exam 1: what to study', tags: ['brightspace', 'exam', 'study guide'],
        body: `# Exam 1 — October 5\n\nThe exam is in class on your own device through Connect, with proctoring. It is closed book. Review chapters 1–4, the review sheet, presentation slides, and Connect assignments. The instructor says the review sheet does not cover every exam topic.\n\n## Extra topics from Week 3 Housekeeping Notes\n\n- Order of small and large intestine segments, including duodenum, jejunum, and ileum.\n- Nutrients made by microorganisms in the large intestine.\n- When food becomes a bolus, then chyme.\n- The six key nutrient concepts in Chapter 1.\n- The enzyme that begins starch digestion in the mouth.\n- The difference between the gastrointestinal lumen and mucosa.\n\n${links.map(x => `- ${x}`).join('\n')}\n\nBrightspace calendar lists the Connect exam item at 8:00 PM New York time; class starts at 4:55 PM.` });
      const practice = resource('Practice Quiz - Requires Respondus LockDown Browser');
      if (practice) addNote({ id: 'brightspace-nut-practice-quiz-20261001', classId: 'nut', title: 'Set up LockDown Browser and try the practice quiz', tags: ['brightspace', 'quiz', 'setup'],
        body: `The practice quiz is ungraded and has no published due date. Use it to check that Respondus LockDown Browser works before the graded quizzes.\n\n[Open practice quiz](${practice})` });
    }
    const urb = s.classes.find(c => c.id === 'urb');
    if (urb) {
      s.events = s.events.filter(e => !(e.classId === 'urb' && e.title?.startsWith('[Template]')));
      if (urb.info.meeting === 'Twice a week, in person') urb.info.meeting = 'Mondays and Wednesdays, 2:00–3:50 PM';
      if (!urb.info.location) urb.info.location = '370 Jay St, Room 309';
      urb.custom ||= [];
      if (!urb.custom.some(x => x.k === 'Reading team'))
        urb.custom.push({ k: 'Reading team', v: 'Team Aspirations — David Ren, Diya Hegde, Hong Li.' });
      addEvent({ key: 'urb-midterm-paper-2026', classId: 'urb', title: 'Healthy Cities midterm paper', type: 'paper',
        date: '2026-10-30', time: '23:59',
        notes: 'Final midterm paper due October 30 at 11:59 PM. Write a 10–12 page expository literature review on the approved urban health topic, with at least 10 scholarly sources and MLA references. Presentations run October 19–28; confirm your individual slot.',
        assignmentUrl: 'https://brightspace.nyu.edu/d2l/le/lessons/601719/units/13819543',
        sources: [{ label: 'Brightspace midterm brief', url: 'https://brightspace.nyu.edu/d2l/le/lessons/601719/units/13819543' }] });
      addNote({ id: 'brightspace-urb-midterm-guide-20261001', classId: 'urb', title: 'Healthy Cities midterm: requirements and timeline', tags: ['brightspace', 'midterm', 'study guide'],
        body: '# Midterm project\n\n- **September 30, 11:59 PM:** submit your topic selection, introduction, and outline. Brightspace lists both an assignment folder and a discussion post for this step.\n- **October 19–28:** presentation period. Confirm your assigned date.\n- **October 30, 11:59 PM:** completed paper due.\n\nThe paper is a 10–12 page expository literature review for an educated public. Explain the topic’s relevance to urban health, discuss differing applications and perspectives, use at least 10 scholarly sources, and cite in MLA style. Your own writing must be original.\n\n[Full Brightspace midterm brief](https://brightspace.nyu.edu/d2l/le/lessons/601719/units/13819543)' });
    }
  },
});
