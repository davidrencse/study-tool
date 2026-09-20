/* ==========================================================================
   seed.js — the starting template. Everything here is editable in the app.
   Reset anytime from Settings → "Reset to template".
   ========================================================================== */

const INFO_FIELDS = [
  ['code', 'Course code'],
  ['instructor', 'Instructor'],
  ['email', 'Instructor email'],
  ['meeting', 'Meeting days & time'],
  ['location', 'Location / room'],
  ['officeHours', 'Office hours'],
  ['ta', 'TA / section'],
  ['syllabus', 'Syllabus link'],
  ['lms', 'Course site (Canvas, etc.)'],
  ['textbook', 'Textbook / readings'],
  ['grading', 'Grading breakdown'],
  ['credits', 'Credits'],
];

const EVENT_TYPES = {
  assignment: { label: 'Assignment' },
  exam: { label: 'Exam', major: true },
  quiz: { label: 'Quiz' },
  reading: { label: 'Reading' },
  project: { label: 'Project', major: true },
  lab: { label: 'Lab' },
  paper: { label: 'Paper', major: true },
  other: { label: 'Other' },
  // scheduled events (time blocks, not things that are due)
  event: { label: 'Event', event: true },
  lecture: { label: 'Class session', event: true },
  study: { label: 'Study session', event: true },
  meeting: { label: 'Meeting', event: true },
  appointment: { label: 'Appointment', event: true },
  social: { label: 'Social', event: true },
  work: { label: 'Work shift', event: true },
};

const REPEATS = { none: 'Does not repeat', daily: 'Every day', weekdays: 'Every weekday (Mon–Fri)', weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month' };

const TASK_CATEGORIES = ['School', 'Personal', 'Health', 'Errands', 'Work', 'Social'];

function blankInfo(overrides = {}) {
  const info = {};
  for (const [k] of INFO_FIELDS) info[k] = '';
  return { ...info, ...overrides };
}

function buildSeed() {
  const t = todayStr();

  const classes = [
    { id: 'os', name: 'Operating Systems', short: 'OS', mark: 'square', info: blankInfo({ grading: 'Homework __% · Projects __% · Midterm __% · Final __%' }), custom: [] },
    { id: 'sec', name: 'Computer Security', short: 'SEC', mark: 'triangle', info: blankInfo({ grading: 'Labs __% · Homework __% · Midterm __% · Final __%' }), custom: [] },
    { id: 'nut', name: 'Nutrition and Health', short: 'NUT', mark: 'circle', info: blankInfo({ grading: 'Quizzes __% · Diet analysis __% · Exams __%' }), custom: [] },
    { id: 'urb', name: 'Advanced Seminar in Urban Studies', short: 'URB', mark: 'diamond', info: blankInfo({ grading: 'Participation __% · Reading responses __% · Seminar paper __%' }), custom: [] },
  ];

  classes.forEach((c) => {
    c.meetings = [];
    c.grading = defaultGrading(c.id);
  });

  // [id, name, prereqs, description]
  const T = {
    os: [
      ['os-intro', 'OS Structure & System Calls', [], 'Kernel vs user mode, system calls, monolithic vs microkernel designs.'],
      ['os-proc', 'Processes', ['os-intro'], 'Process control block, states, fork/exec, process lifecycle.'],
      ['os-thr', 'Threads & Concurrency', ['os-proc'], 'User vs kernel threads, threading models, parallelism.'],
      ['os-sched', 'CPU Scheduling', ['os-proc'], 'FCFS, SJF, Round Robin, priority, multilevel feedback queues.'],
      ['os-sync', 'Synchronization', ['os-thr'], 'Critical sections, mutexes, semaphores, condition variables, monitors.'],
      ['os-dead', 'Deadlocks', ['os-sync'], 'Coffman conditions, prevention, avoidance (Banker’s), detection.'],
      ['os-mem', 'Memory Management', ['os-intro'], 'Address spaces, segmentation, allocation, fragmentation.'],
      ['os-vm', 'Virtual Memory & Paging', ['os-mem'], 'Page tables, TLB, page faults, replacement algorithms.'],
      ['os-fs', 'File Systems', ['os-intro'], 'Inodes, directories, allocation, journaling.'],
      ['os-io', 'I/O & Storage', ['os-fs'], 'Device drivers, interrupts, DMA, disk scheduling, SSDs.'],
      ['os-prot', 'Protection & Isolation', ['os-vm'], 'Privilege rings, memory protection, access rights.'],
      ['os-virt', 'Virtualization & Containers', ['os-vm', 'os-sched'], 'Hypervisors, VMs, containers, namespaces.'],
    ],
    sec: [
      ['sec-cia', 'Security Principles (CIA)', [], 'Confidentiality, integrity, availability; least privilege; defense in depth.'],
      ['sec-threat', 'Threat Modeling', ['sec-cia'], 'Attack surfaces, adversary models, STRIDE.'],
      ['sec-crypto', 'Cryptography Basics', ['sec-cia'], 'Goals of crypto, Kerckhoffs’s principle, randomness.'],
      ['sec-sym', 'Symmetric Encryption', ['sec-crypto'], 'Block & stream ciphers, AES, modes of operation.'],
      ['sec-pk', 'Public-Key Crypto & PKI', ['sec-crypto'], 'RSA, Diffie–Hellman, signatures, certificates.'],
      ['sec-hash', 'Hashing & MACs', ['sec-crypto'], 'Hash properties, HMAC, integrity.'],
      ['sec-auth', 'Authentication & Passwords', ['sec-hash'], 'Salting, key stretching, MFA.'],
      ['sec-ac', 'Access Control', ['sec-auth'], 'DAC, MAC, RBAC, capabilities, ACLs.'],
      ['sec-mem', 'Memory Safety & Buffer Overflows', ['sec-threat'], 'Stack smashing, ROP, ASLR, canaries, DEP.'],
      ['sec-web', 'Web Security', ['sec-threat'], 'XSS, CSRF, SQL injection, same-origin policy.'],
      ['sec-net', 'Network Security', ['sec-pk'], 'TLS, firewalls, IDS, common network attacks.'],
      ['sec-mal', 'Malware', ['sec-threat'], 'Viruses, worms, ransomware, rootkits, sandboxing.'],
      ['sec-priv', 'Privacy & Ethics', ['sec-cia'], 'Data minimization, anonymity, disclosure ethics, law.'],
    ],
    nut: [
      ['nut-basics', 'Nutrition Fundamentals', [], 'Nutrients, energy, DRIs, evaluating nutrition claims.'],
      ['nut-dig', 'Digestion & Absorption', ['nut-basics'], 'GI tract, enzymes, absorption, the microbiome.'],
      ['nut-carb', 'Carbohydrates & Fiber', ['nut-dig'], 'Sugars, starches, fiber, glycemic response.'],
      ['nut-lip', 'Lipids', ['nut-dig'], 'Fatty acids, triglycerides, cholesterol, lipoproteins.'],
      ['nut-prot', 'Proteins & Amino Acids', ['nut-dig'], 'Essential amino acids, protein quality, needs.'],
      ['nut-vit', 'Vitamins', ['nut-basics'], 'Water- vs fat-soluble vitamins, functions, deficiencies.'],
      ['nut-min', 'Minerals & Water', ['nut-basics'], 'Major & trace minerals, hydration, electrolytes.'],
      ['nut-energy', 'Energy Balance & Metabolism', ['nut-carb', 'nut-lip', 'nut-prot'], 'BMR, TEF, activity, energy pathways.'],
      ['nut-wt', 'Weight Management', ['nut-energy'], 'BMI & its limits, body composition, sustainable change.'],
      ['nut-guide', 'Dietary Guidelines & Labels', ['nut-basics'], 'Dietary Guidelines, MyPlate, Nutrition Facts panel.'],
      ['nut-chronic', 'Diet & Chronic Disease', ['nut-energy', 'nut-lip'], 'Cardiovascular disease, type 2 diabetes, hypertension.'],
      ['nut-life', 'Lifecycle Nutrition', ['nut-guide'], 'Pregnancy, childhood, aging.'],
      ['nut-foodsec', 'Food Security & Public Health', ['nut-guide'], 'Food access, food deserts, assistance programs.'],
    ],
    urb: [
      ['urb-theory', 'Urban Theory Foundations', [], 'What is a city? Classic and contemporary urban theory.'],
      ['urb-chicago', 'Chicago School & Urban Ecology', ['urb-theory'], 'Park, Burgess, concentric zones, human ecology.'],
      ['urb-polecon', 'Political Economy of Cities', ['urb-theory'], 'Growth machine, Harvey, right to the city.'],
      ['urb-gent', 'Gentrification & Displacement', ['urb-polecon'], 'Rent gap, cultural vs economic explanations.'],
      ['urb-housing', 'Housing Policy', ['urb-polecon'], 'Public housing, vouchers, zoning, affordability.'],
      ['urb-seg', 'Segregation & Inequality', ['urb-chicago'], 'Redlining, concentrated poverty, neighborhood effects.'],
      ['urb-trans', 'Transportation & Mobility', ['urb-theory'], 'Transit, car dependence, spatial mismatch.'],
      ['urb-gov', 'Urban Governance & Planning', ['urb-polecon'], 'Regimes, participation, planning history.'],
      ['urb-env', 'Environmental Justice', ['urb-seg'], 'Uneven exposure to hazards, climate & cities.'],
      ['urb-health', 'Cities & Public Health', ['urb-seg'], 'Built environment and health outcomes.'],
      ['urb-smart', 'Smart Cities & Surveillance', ['urb-gov'], 'Data-driven governance, sensors, critiques.'],
      ['urb-methods', 'Research Methods & Seminar Paper', ['urb-theory'], 'Ethnography, GIS, case studies, lit reviews.'],
    ],
  };

  const topics = [];
  for (const [classId, list] of Object.entries(T))
    for (const [id, name, prereqs, desc] of list) topics.push({ id, classId, name, prereqs, desc, mastery: 0 });

  const links = [
    ['os-prot', 'sec-ac', 'isolation ↔ access control'],
    ['os-mem', 'sec-mem', 'stack/heap layout'],
    ['os-fs', 'sec-ac', 'file permissions'],
    ['os-virt', 'sec-mal', 'sandboxing'],
    ['os-sync', 'sec-threat', 'race conditions (TOCTOU)'],
    ['os-sched', 'urb-trans', 'queueing & scheduling analogies'],
    ['sec-priv', 'urb-smart', 'surveillance & data'],
    ['sec-net', 'urb-smart', 'critical infrastructure'],
    ['nut-foodsec', 'urb-health', 'food deserts'],
    ['nut-foodsec', 'urb-seg', 'unequal food access'],
    ['nut-chronic', 'urb-env', 'environmental health'],
  ].map(([a, b, label]) => ({ id: uid(), a, b, label }));

  // [classId, topicId, front, back]
  const starter = [
    ['os', 'os-dead', 'What are the four necessary (Coffman) conditions for deadlock?', 'Mutual exclusion, hold and wait, no preemption, circular wait.'],
    ['os', 'os-thr', 'Process vs. thread?', 'A process has its own address space and resources; threads within a process share them but each has its own stack, registers, and program counter.'],
    ['os', 'os-vm', 'What is a page fault?', 'A trap raised when a program touches a page not currently in physical memory; the OS loads the page (or signals an error if the access is invalid).'],
    ['os', 'os-proc', 'What is a context switch?', 'Saving the CPU state of the running process/thread and restoring another’s so the CPU can switch between them.'],
    ['os', 'os-vm', 'What does the TLB do?', 'Caches recent virtual-to-physical page translations to speed up address translation.'],
    ['os', 'os-sync', 'What is a race condition?', 'A bug where the outcome depends on the unpredictable interleaving of concurrent operations on shared data.'],
    ['os', 'os-sched', 'How does Round Robin scheduling work?', 'Each ready process runs for a fixed time quantum in turn; if it doesn’t finish, it’s preempted and moved to the back of the ready queue.'],
    ['sec', 'sec-cia', 'What does the CIA triad stand for?', 'Confidentiality, Integrity, Availability.'],
    ['sec', 'sec-crypto', 'Symmetric vs. asymmetric encryption?', 'Symmetric uses one shared secret key for both directions; asymmetric uses a public/private key pair.'],
    ['sec', 'sec-auth', 'Why salt password hashes?', 'A unique random salt per password makes identical passwords hash differently and defeats precomputed (rainbow table) attacks.'],
    ['sec', 'sec-mem', 'What is a buffer overflow?', 'Writing past the end of a buffer, overwriting adjacent memory (e.g., a saved return address), potentially hijacking control flow.'],
    ['sec', 'sec-web', 'What is cross-site scripting (XSS)?', 'An attack where injected script runs in victims’ browsers in the context of a trusted site.'],
    ['sec', 'sec-cia', 'Principle of least privilege?', 'Every user and program should get only the permissions it needs to do its job — nothing more.'],
    ['sec', 'sec-web', 'Primary defense against SQL injection?', 'Parameterized queries / prepared statements (never build SQL by string concatenation of user input).'],
    ['nut', 'nut-energy', 'Calories per gram of carbohydrate, protein, fat, and alcohol?', 'Carbohydrate 4 · Protein 4 · Fat 9 · Alcohol 7.'],
    ['nut', 'nut-vit', 'Which vitamins are fat-soluble?', 'A, D, E, and K.'],
    ['nut', 'nut-prot', 'What is an essential amino acid?', 'One the body can’t make in sufficient amounts, so it must come from the diet (there are 9).'],
    ['nut', 'nut-dig', 'Where does most nutrient absorption occur?', 'The small intestine.'],
    ['nut', 'nut-carb', 'Soluble vs. insoluble fiber?', 'Soluble fiber dissolves into a gel and can help lower cholesterol and blunt blood-sugar spikes; insoluble fiber adds bulk and promotes regularity.'],
    ['nut', 'nut-energy', 'What is energy balance?', 'The relationship between energy intake and expenditure — a sustained surplus leads to weight gain, a deficit to weight loss.'],
    ['nut', 'nut-foodsec', 'What is food insecurity?', 'Lacking consistent access to enough food for an active, healthy life.'],
    ['urb', 'urb-gent', 'Define gentrification.', 'An influx of higher-income residents and capital into lower-income neighborhoods, often raising costs and displacing existing residents.'],
    ['urb', 'urb-chicago', 'What is Burgess’s concentric zone model?', 'A Chicago School model depicting the city as rings expanding outward from the central business district, each with distinct land uses and populations.'],
    ['urb', 'urb-seg', 'What was redlining?', 'The practice (notably via 1930s HOLC maps) of marking mostly Black and immigrant neighborhoods as “hazardous” for lending, denying them investment.'],
    ['urb', 'urb-env', 'What is environmental justice?', 'The fair distribution of environmental benefits and burdens, and the movement against the disproportionate exposure of marginalized communities to pollution.'],
    ['urb', 'urb-polecon', 'What is the “urban growth machine”?', 'Logan & Molotch’s idea that coalitions of landowners, developers, and local elites push growth to increase land values.'],
    ['urb', 'urb-polecon', 'Who coined “the right to the city”?', 'Henri Lefebvre (1968); later developed by David Harvey.'],
  ];
  const cards = starter.map(([classId, topicId, front, back]) => newCard({ front, back, classId, topicId, source: 'starter' }));

  const hub = (c, links) => ({
    id: 'hub-' + c.id,
    title: `${c.name} — Course Hub`,
    classId: c.id,
    tags: ['hub', 'template'],
    created: Date.now(),
    updated: Date.now(),
    body: `# ${c.name}

> Template note. Replace anything here with your real course info.

## Big picture
- What is this course about in one sentence?
- Why does it matter?

## Topic map
${links.map((l) => `- [[${l}]]`).join('\n')}

## Lecture log
- Week 1 —
- Week 2 —

## Things I'm confused about
- [ ]

## Exam prep
- Key formulas / definitions:
- Practice problems:
`,
  });

  const notes = [
    hub(classes[0], T.os.map((x) => x[1])),
    hub(classes[1], T.sec.map((x) => x[1])),
    hub(classes[2], T.nut.map((x) => x[1])),
    hub(classes[3], T.urb.map((x) => x[1])),
    {
      id: 'tmpl-lecture',
      title: 'Lecture Note Template',
      classId: '',
      tags: ['template'],
      created: Date.now(),
      updated: Date.now(),
      body: `# Lecture — (topic)
**Class:** · **Date:** · **Links:** [[Operating Systems]]

## Key ideas
1.
2.

## Definitions
- **Term** — meaning

## Examples

## Questions to ask
- [ ]

## Summary (write in your own words)
`,
    },
    {
      id: 'tmpl-cross',
      title: 'Cross-Class Connections',
      classId: '',
      tags: ['connections'],
      created: Date.now(),
      updated: Date.now(),
      body: `# Where my classes overlap

- [[Memory Management]] explains the stack/heap layout abused in [[Memory Safety & Buffer Overflows]].
- [[Protection & Isolation]] is the OS side of [[Access Control]].
- [[Food Security & Public Health]] meets urban studies through [[Cities & Public Health]] and [[Segregation & Inequality]].
- [[Privacy & Ethics]] is central to critiques of [[Smart Cities & Surveillance]].

Add your own links with double brackets — they show up in the Knowledge Graph.
`,
    },
  ];

  const events = [
    ['urb', 'Reading response #1', 3, 'reading'],
    ['os', 'Problem set 1', 5, 'assignment'],
    ['sec', 'Lab 1', 7, 'lab'],
    ['nut', '3-day diet analysis', 10, 'project'],
    ['os', 'Midterm exam', 30, 'exam'],
  ].map(([classId, title, d, type]) => ({ id: uid(), classId, title: `[Template] ${title}`, date: addDays(t, d), time: type === 'exam' ? '10:00' : '23:59', type, done: false, notes: 'Example entry. Edit or delete it.', topicIds: type === 'exam' ? ['os-proc', 'os-thr', 'os-sched', 'os-sync', 'os-dead', 'os-mem', 'os-vm'] : [] }));

  const tasks = [
    ['Fill in class info (instructor, times, syllabus links)', 'School', 'high'],
    ['Add real due dates to the calendar', 'School', 'high'],
    ['Review today’s flashcards', 'School', 'med'],
    ['Grocery run', 'Errands', 'low'],
  ].map(([title, category, priority]) => ({ id: uid(), title, date: t, done: false, category, priority }));

  const routines = ['Review due flashcards', '30 min focused reading', 'Check the calendar', 'Drink water and eat a real meal', 'Move / exercise', 'Plan tomorrow'].map((title) => ({ id: uid(), title }));

  return {
    version: 1,
    settings: {
      theme: 'system', name: '', chatUrl: 'https://chatgpt.com/', prefillUrl: false, openaiKey: '', openaiModel: 'gpt-4o-mini', typeAnswers: true, dailyNewLimit: 50,
      notify: { desktop: false, sound: true, daysBefore: 1, dayOf: true, hourBefore: true, overdue: true, classStart: true, classLead: 15, cardsDaily: true },
      focus: { work: 25, short: 5, long: 15, rounds: 4, autoBreak: true },
    },
    classes,
    topics,
    links,
    notes,
    cards,
    events,
    tasks,
    routines,
    routineDone: {},
    ...plannerSeed(),
    reviewLog: {},
    snippets: seedSnippets(),
    notifications: [],
    notifyLog: {},
    focusLog: [],
    timer: null,
    practiceExams: [],
    practiceDraft: { classId: '', examId: '', topicId: '', noteIds: [], count: 10, level: 'Course level', format: 'Mixed', extra: '', material: '', prompt: '', paste: '' },
  };
}


/* ---------- grading templates (edit weights to match each syllabus) ---------- */
const GRADE_SCALE = [
  [93, 'A'], [90, 'A-'], [87, 'B+'], [83, 'B'], [80, 'B-'], [77, 'C+'], [73, 'C'], [70, 'C-'], [67, 'D+'], [60, 'D'], [0, 'F'],
];

function defaultGrading(classId) {
  const presets = {
    os: [['Homework', 25], ['Projects', 30], ['Midterm', 20], ['Final exam', 25]],
    sec: [['Labs', 30], ['Homework', 20], ['Midterm', 20], ['Final exam', 30]],
    nut: [['Quizzes', 20], ['Diet analysis', 20], ['Midterm', 25], ['Final exam', 35]],
    urb: [['Participation', 20], ['Reading responses', 25], ['Presentation', 15], ['Seminar paper', 40]],
  };
  const cats = (presets[classId] || [['Assignments', 40], ['Midterm', 25], ['Final exam', 35]]).map(([name, weight]) => ({ id: uid(), name, weight }));
  return { categories: cats, items: [], target: 90 };
}

/* ---------- code snippet starters for the CS classes ---------- */
function seedSnippets() {
  const now = Date.now();
  const mk = (classId, topicId, title, lang, code, notes) => ({ id: uid(), classId, topicId, title, lang, code, notes, tags: ['starter'], created: now, updated: now });
  return [
    mk('os', 'os-proc', 'fork() and wait()', 'c', `#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>

int main(void) {
    pid_t pid = fork();          // duplicate the calling process
    if (pid < 0) {
        perror("fork");
        return 1;
    } else if (pid == 0) {
        printf("child: pid=%d\n", getpid());
        return 0;                // child exits
    } else {
        int status;
        waitpid(pid, &status, 0); // parent blocks until child ends
        printf("parent: child %d finished\n", pid);
    }
    return 0;
}`, 'fork() returns 0 in the child and the child PID in the parent. Without wait(), the finished child stays a zombie until the parent reaps it.'),
    mk('os', 'os-sync', 'Mutex around a shared counter', 'c', `#include <pthread.h>

static long counter = 0;
static pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

void *worker(void *arg) {
    for (int i = 0; i < 100000; i++) {
        pthread_mutex_lock(&lock);   // critical section starts
        counter++;
        pthread_mutex_unlock(&lock); // critical section ends
    }
    return NULL;
}`, 'counter++ is read, add, write. Without the lock, two threads can interleave those steps and lose updates (a race condition).'),
    mk('sec', 'sec-mem', 'Stack buffer overflow (vulnerable)', 'c', `#include <string.h>

void greet(const char *name) {
    char buf[16];
    strcpy(buf, name);   // no bounds check: input longer than 15 chars
                         // overwrites the stack, including the return address
}

/* safer */
void greet_safe(const char *name) {
    char buf[16];
    snprintf(buf, sizeof buf, "%s", name);
}`, 'Classic stack smash. Mitigations: bounds-checked copies, stack canaries, ASLR, non-executable stack (DEP).'),
    mk('sec', 'sec-web', 'SQL injection and the fix', 'python', `# Vulnerable: user input is pasted into the query
cursor.execute("SELECT * FROM users WHERE name = '" + name + "'")
# name = "x' OR '1'='1"  ->  returns every row

# Fixed: parameterized query, the driver keeps data separate from SQL
cursor.execute("SELECT * FROM users WHERE name = %s", (name,))`, 'Parameterized queries are the primary defense; escaping by hand is error-prone.'),
  ];
}

/* ---------- to-do outline + day schedule ----------
   Two spaces per level. "✅ YYYY-MM-DD" marks an item done on that day,
   "📅 YYYY-MM-DD" gives it a due date, "🔗 url" attaches a link. */
const TODO_OUTLINE = `
Do leetcode
  Do leetcode 1
  Do leetcode 2
  Do leetcode 3
  Do leetcode 4
  Do leetcode 5
OPSEC
  Download photos from iCloud
  Hide photos on iPhone
Career
  Apply to jobs
    US jobs ✅ 2026-09-16
      Apply to job 1 ✅ 2026-09-13
      Apply to job 2 ✅ 2026-09-16
      Apply to job 3 ✅ 2026-09-16
      Apply to job 4 ✅ 2026-09-16
      Apply to job 5 ✅ 2026-09-16
    Canada jobs
      Apply to job 1
      Apply to job 2
      Apply to job 3
      Apply to job 4
      Apply to job 5
    Asian jobs
      Apply to job 1
      Apply to job 2
      Apply to job 3
      Apply to job 4
      Apply to job 5
  Apply to programs
    Apply to program 1
    Apply to program 2
    Apply to program 3
    Apply to program 4
    Apply to program 5
  Apply to universities (master's)
    Apply to university 1
    Apply to university 2
    Apply to university 3
    Apply to university 4
    Apply to university 5
Studying
  Classes
    Operating Systems
      Review pointers, pointer arithmetic, arrays, structs, malloc, stack/heap, functions, header files, compilation and linking
      Read xv6 Ch. 0 and Ch. 1 and take notes
      Read OSTEP Ch. 1 and take notes
      Review C programming
      Create Anki cards for lectures 1 and 2
    Computer Security
      Review last lecture and take notes
    Advanced Seminar
      Readings ✅ 2026-09-16
        Read “NY’s 2 Sandys” — Aldana Cohen & Liboiron (2014) ✅ 2026-09-16
        Read “Has ‘Resiliency’ Been Hijacked to Justify and Promote Development?” — The Architect’s Newspaper (2016) ✅ 2026-09-16
        Read McKay (2023), “Native Hawaiians fear Maui wildfire destruction will lead to their cultural erasure,” CBC News ✅ 2026-09-16 🔗 https://brightspace.nyu.edu/content/enforced/601719-FA26_URB-UY_4504_1_A_crse/Native%20Hawaiians%20fear%20Maui%20wildfire%20destruction%20will%20lead%20to%20their%20cultural%20erasure.pdf
      Resiliency essay: 3 pages with references (due 9/23, 11:59 pm) 📅 2026-09-23
        Outline the different ways to think about resiliency from the readings
        Propose alternative definitions or solutions for ASH purposes
        Find outside research sources
        Write the draft
        Add references and submit
    Nutrition and Health
  CodePath
    Advanced Interview Prep
      Do at least 1 assessment every week
    AI Engineering
    Intermediate Cybersecurity
  Software engineering
    AWS
    Learn C++
    Splunk learning
  Cybersecurity
    Do recruitCTF for Osiris
    Study CompTIA+
    Web exploitation
      Do a web exploitation picoCTF
      Learn web exploitation
    Binary exploitation
      Do a binary exploitation picoCTF
      Learn binary exploitation
    Reverse engineering
      Do a reverse engineering picoCTF
      Learn reverse engineering
    Cryptography
      Do a cryptography picoCTF
      Learn cryptography
    Tools
      Learn Wireshark
      Learn Burp Suite
      Learn Metasploit
  Study my cybersecurity learning roadmap
    Web exploitation
    Binary exploitation
    Reverse engineering
    Cryptography
    Forensics
Learning languages
  Korean
    Do Anki
    Watch K-dramas
    Do Duolingo
  Russian
    Do Anki
    Watch Russian media and movies
    Do Duolingo
  Chinese
    Do Anki
    Watch C-dramas
    Do Duolingo
  Chess
    Play 3 blitz games
    Study chess theory
Personal projects
  Build my own private coding GPT
  Work on the European database project (Project Watchtower)
  Start an engineering project, like a blueprint for a drone
  Make an IP-logger website
  Dual-screen setup (two PCs, two screens, shared)
  Reverse shell
  PC remote access (PC A views PC B like a virtual machine window, with drag-and-drop of folders in and out)
Personal
  Get a US mobile phone number
  Set up Google Voice
  Set up the claim app using the number(s)
`;

function parseOutline(text) {
  const out = [];
  const stack = [];
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    const depth = Math.floor(raw.match(/^ */)[0].length / 2);
    let title = raw.trim();
    const pull = (re) => {
      const m = title.match(re);
      if (m) title = title.replace(m[0], '').trim();
      return m?.[1] || null;
    };
    const url = pull(/🔗\s*(\S+)/);
    const done = pull(/✅\s*(\d{4}-\d{2}-\d{2})/);
    const due = pull(/📅\s*(\d{4}-\d{2}-\d{2})/);
    stack.length = depth;
    const item = { id: uid(), title, parent: stack[depth - 1] || null, done, due, url, collapsed: false };
    // finished branches start folded so the list opens on what's left
    out.push(item);
    stack[depth] = item.id;
  }
  out.forEach((x) => {
    if (x.done && out.some((c) => c.parent === x.id)) x.collapsed = true;
  });
  return out;
}

function plannerSeed() {
  const block = (time, title, items, days = [0, 1, 2, 3, 4, 5, 6]) => ({ id: uid(), time, title, days, items: items.map((t) => ({ id: uid(), title: t })) });
  const t = todayStr();
  const morning = block('09:00', 'Wake up', ['Shower', 'Brush teeth', 'Shave', 'Skin care']);
  const schedule = [
    morning,
    block('11:00', 'Gym', ['Push day', 'Cardio']),
    block('14:00', 'Operating Systems', ['Attend lecture', 'Take notes']),
    block('15:50', 'Study', []),
    block('18:00', 'Dinner', []),
    block('21:00', 'Evening', []),
    block('00:00', 'Sleep', []),
  ];
  return {
    todo: parseOutline(TODO_OUTLINE),
    todoPrefs: { showDone: true, focus: '' },
    schedule,
    // the first two morning steps were already ticked off today
    scheduleDone: { [t]: morning.items.slice(0, 2).map((i) => i.id) },
    scheduleExtra: {},
  };
}

/** One-time additions to an existing store: daily habits from the to-do list and the essay deadline. */
function applyPlannerExtras(s) {
  if (s.plannerExtras) return;
  s.plannerExtras = true;
  for (const title of ['Eat at least 150 g of protein', 'Eat around 1,000 calories or less', 'Walk 10k steps']) {
    if (!s.routines.some((r) => r.title === title)) s.routines.push({ id: uid(), title });
  }
  if (!s.events.some((e) => /resiliency/i.test(e.title))) {
    s.events.push({ id: uid(), classId: 'urb', title: 'Resiliency essay (3 pages, with references)', date: '2026-09-23', time: '23:59', type: 'paper', done: false, notes: 'Explain the different ways to think about resiliency from the readings and propose alternative definitions or solutions for ASH purposes. Use class readings and outside research.', topicIds: [], repeat: 'none', skip: [] });
  }
}
