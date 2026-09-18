/* Reviewed Brightspace emails, checked September 17, 2026.
 * This is a local snapshot, not a background Gmail connection.
 * Apply once to existing browser data; retain completion and unrelated edits.
 */
CONTENT_PACKS.push({
  id: 'brightspace-email-2026-09-17',
  apply(s) {
    const mail = (id, label) => ({ label, url: `https://mail.google.com/mail/#all/${id}` });
    const updates = [
      {
        key: 'os-assignment-1', classId: 'os', title: 'Assignment 1', type: 'assignment',
        date: '2026-09-29', time: '',
        notes: 'Released September 17. Due September 29; the announcement does not specify a submission time. Check Brightspace for the exact time and assignment instructions.',
        assignmentUrl: 'https://brightspace.nyu.edu/d2l/p/le/news/627912',
        sources: [mail('1a0b05dc8d8cbf9a', 'OS announcement — September 17')],
      },
      {
        key: 'sec-pa1', classId: 'sec', title: 'PA1 (Brightspace: Assignment 1)', type: 'project',
        date: '2026-09-22', time: '17:00', dueAt: '2026-09-22T21:00:00Z',
        notes: 'Deadline extended to September 22 at 5:00 PM EDT, replacing September 15 at 11:59 PM. Submit directly through Brightspace, NOT Gradescope: the September 10 announcement corrects the assignment instructions. Extension confirmed by the September 15 announcement and September 17 activity summary.',
        assignmentUrl: 'https://brightspace.nyu.edu/d2l/lms/dropbox/dropbox.d2l?ou=625009&db=1243954',
        sources: [mail('1a0a623085da5bc1', 'Deadline extension — September 15'), mail('1a0ad8a474c84a5f', 'Confirmed deadline — September 17'), mail('1a08bb058a2a581b', 'Submit through Brightspace — September 10')],
      },
      {
        key: 'nut-connect-0', classId: 'nut', title: 'Connect assignment: Orientation, Ch. 1 & 2', type: 'assignment',
        date: '2026-09-21', time: '16:55', dueAt: '2026-09-21T20:55:00Z',
        notes: 'Chapter 1 & 2 Connect assignment due September 21 at 4:55 PM (New York course time). Register for McGraw Hill Connect using the course link. Exact deadline time confirmed by the September 15 Housekeeping Notes.',
        assignmentUrl: 'https://connect.mheducation.com/class/m-zandes-mitch-zandes-nutr-human-nutrition-003',
        sources: [mail('1a0a63cd6f5a9e0b', 'Housekeeping Notes — September 15')],
      },
    ];
    for (const update of updates) {
      if (!s.classes.some(c => c.id === update.classId)) continue;
      const current = s.events.find(e => e.key === update.key) || s.events.find(e =>
        e.classId === update.classId && !isScheduled(e) &&
        (update.key === 'os-assignment-1' ? /^(?:\[Template\]\s*)?(?:Assignment|Homework)\s*1$/i.test(e.title) :
          update.key === 'sec-pa1' ? /^(?:PA\s*1|Assignment\s*1)(?:\b|$)/i.test(e.title) : /connect.*(?:ch(?:apter)?\.?\s*1).*2/i.test(e.title)));
      const verified = { ...update, sourceType: 'brightspace-email', emailChecked: '2026-09-17', dueTimezone: update.dueAt ? 'America/New_York' : '' };
      if (verified.dueAt) {
        const local = new Date(verified.dueAt);
        verified.date = ymd(local);
        verified.time = `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`;
      }
      if (current) {
        const personalNotes = current.notes || '';
        Object.assign(current, verified);
        // Keep existing personal context; discard superseded seed instructions.
        if (personalNotes && !/Submit on Gradescope|Due date from the course schedule|Check Connect for the exact time/i.test(personalNotes)) {
          current.notes += `\n\nPrevious notes:\n${personalNotes}`;
        }
      } else {
        s.events.push({ id: uid(), done: false, topicIds: [], repeat: 'none', skip: [], ...verified });
      }
    }
    const sec = s.classes.find(c => c.id === 'sec');
    const submission = sec?.custom?.find(f => f.k === 'Submissions');
    if (submission && /Gradescope/i.test(submission.v)) submission.v = 'Assignment 1: submit directly through Brightspace (September 10 announcement overrides the original Gradescope instructions). Check each later assignment separately.';
    const nut = s.classes.find(c => c.id === 'nut');
    if (nut && !nut.info.lms) nut.info.lms = 'https://brightspace.nyu.edu/d2l/home/609704';
    const urb = s.classes.find(c => c.id === 'urb');
    if (urb) {
      if (!urb.info.instructor) urb.info.instructor = 'MaryAnn Sorensen Allacci';
      if (!urb.info.lms) urb.info.lms = 'https://brightspace.nyu.edu/d2l/home/601719';
      const essay = s.events.find(e => e.classId === 'urb' && /resilien(?:cy|ce).*essay/i.test(e.title));
      if (essay) {
        essay.notes = `${essay.notes || ''}\n\nSeptember 15 email: incorporate all assigned readings plus independent research; note article sources and class presentation comments. This email does not confirm the essay deadline; the existing September 23 date still comes from prior course notes.`.trim();
        essay.sources = [...(essay.sources || []), mail('1a0a5bb0b986a444', 'Reading teams and essay guidance — September 15')];
      }
    }
    const addUpdateNote = (id, classId, title, body) => {
      if (!s.classes.some(c => c.id === classId) || s.notes.some(n => n.id === id)) return;
      s.notes.push({ id, classId, title, body, tags: ['brightspace', 'email'], created: Date.now(), updated: Date.now() });
    };
    addUpdateNote('brightspace-nut-20260917', 'nut', 'Nutrition: Brightspace updates (September 17)',
      '# Email-confirmed course updates\n\n- Register for Connect. Chapter 1 & 2 assignment: September 21, 4:55 PM.\n- Download Respondus LockDown Browser and complete the ungraded Practice Quiz on Brightspace. No deadline was given for this practice quiz; it checks your device before the three course quizzes.\n- Review the syllabus and course schedule.\n\n[Housekeeping Notes, September 15](https://mail.google.com/mail/#all/1a0a63cd6f5a9e0b)\n\n## Historical attendance deadline\nAttendance — 9/14 was due September 14 at 11:59 PM EDT. This email does not establish your current completion status, so it was not added as a new overdue assignment.\n\n[September 14 activity summary](https://mail.google.com/mail/#all/1a09e190b450d7b8)\n\nThe September 17 digest lists two quizzes not attempted but does not name them or give deadlines; no assignments were invented from that count.');
    addUpdateNote('brightspace-urb-20260917', 'urb', 'Healthy Cities: reading teams and resilience essay',
      '# Reading team instructions\n\nSeptember 15 email assigned readings and brief team presentations for September 16. Everyone should review all three listed articles. Each team member should contribute oral comments; team presentations are limited to 15 minutes.\n\n[Reading teams](https://brightspace.nyu.edu/d2l/le/lessons/601719/units/13819566)\n[Assigned articles](https://brightspace.nyu.edu/d2l/le/lessons/601719/units/13819535)\n\n## Resilience essay\nIncorporate all readings and independent sources. Keep notes on reading presentations, comments and article sources. The email does not state the essay due date.\n\n[Original email, September 15](https://mail.google.com/mail/#all/1a0a5bb0b986a444)');
    s.brightspaceEmailChecked = '2026-09-17';
  },
});
