const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function app() {
  const storage = new Map();
  const context = vm.createContext({
    console, Date, Math, URL, URLSearchParams, setTimeout, clearTimeout, addEventListener() {},
    document: { addEventListener() {} }, location: { hash: '' },
    localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) },
  });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const [, file] of html.matchAll(/<script src="([^"]+)"/g)) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  const run = code => vm.runInContext(code, context);
  run('Store.load(); toast = () => {}; App.refresh = () => {};');
  return run;
}
test('fresh storage and reset initialize identical course content', () => {
  const run = app();
  const counts = () => run('JSON.stringify([S().classes.length,S().notes.length,S().cards.length,S().events.length,S().routines.length,S().appliedPacks])');
  const first = counts(); run('Store.reset()'); assert.equal(counts(), first);
  run('Store.save(); Store.state=null; Store.load()'); assert.equal(counts(), first);
});
test('Brightspace email deadlines and submission corrections update the planner', () => {
  const run = app();
  assert.equal(run("S().events.find(e=>e.key==='os-assignment-1').date"), '2026-09-29');
  assert.equal(run("S().events.find(e=>e.key==='os-assignment-1').time"), '');
  assert.equal(run("S().events.find(e=>e.key==='sec-pa1').dueAt"), '2026-09-22T21:00:00Z');
  assert.equal(run("S().events.find(e=>e.key==='nut-connect-0').dueAt"), '2026-09-21T20:55:00Z');
  assert.match(run("S().events.find(e=>e.key==='sec-pa1').notes"), /directly through Brightspace/);
  assert.match(run("S().classes.find(c=>c.id==='sec').custom.find(f=>f.k==='Submissions').v"), /Brightspace/);
  assert.equal(run("S().events.filter(e=>e.key==='nut-connect-0').length"),1);
  assert.equal(run("S().events.find(e=>e.key==='sec-pa1').sources.length"),3);
});
test('email updates preserve existing completion and apply only once', () => {
  const run = app();
  run("const pack=CONTENT_PACKS.find(p=>p.id==='brightspace-email-2026-09-17');const s=buildSeed();applyPlannerExtras(s);s.appliedPacks=CONTENT_PACKS.filter(p=>p!==pack).map(p=>p.id);s.events.push({id:'kept-id',key:'sec-pa1',classId:'sec',title:'PA1',type:'project',date:'2026-09-15',time:'23:59',notes:'My work is ready',done:true,topicIds:[],repeat:'none',skip:[]});Store.state=s;applyPacks(s)");
  assert.equal(run("S().events.find(e=>e.key==='sec-pa1').id"),'kept-id');
  assert.equal(run("S().events.find(e=>e.key==='sec-pa1').done"),true);
  assert.match(run("S().events.find(e=>e.key==='sec-pa1').notes"),/My work is ready/);
  const count=run('S().events.length');run('applyPacks(S());Store.save();Store.state=null;Store.load()');
  assert.equal(run('S().events.length'),count);
});
test('Tasks includes coursework, everyday tasks and actionable list items', () => {
  const run=app();
  assert.equal(run("taskHubItems().filter(t=>t.kind==='coursework').length"),run('deadlines().length'));
  assert.equal(run("taskHubItems().some(t=>t.kind==='coursework'&&isScheduled(t.record))"),false);
  assert.equal(run("taskHubItems().filter(t=>t.kind==='lists').every(t=>!todoKids(t.id).length)"),true);
  assert.ok(run("taskHubFilter(taskHubItems(),{source:'coursework',q:'Assignment 1'}).length")>=2);
  assert.equal(run("taskHubFilter(taskHubItems(),{source:'coursework',class:'sec'}).every(t=>t.classId==='sec')"),true);
  assert.equal(run("taskHubFilter(taskHubItems(),{status:'done'}).every(t=>t.done)"),true);
  assert.equal(run("taskHubFilter(taskHubItems(),{when:'overdue'}).every(t=>t.date<todayStr()&&!t.done)"),true);
  assert.match(run('Views.tasks.render([],{})'), /<h1>Tasks<\/h1>/);
  assert.match(run('Views.daily.render([],{})'), /<h1>Daily routine<\/h1>/);
});
test('reorganized navigation assigns each page to exactly one section', () => {
  const run=app();
  assert.equal(run("Object.keys(Views).filter(v=>v!=='settings').every(v=>NAV.filter(n=>n.views.includes(v)).length===1)"),true);
  assert.equal(run("navFor('tasks').group"),'Plan');
  assert.equal(run("navFor('todo').id"),'tasks');
  assert.equal(run("navFor('notes').group"),'Materials');
  assert.equal(run("navFor('graph').group"),'Tools');
});
test('malformed URL encoding does not crash navigation', () => {
  const run = app(); run("location.hash='#/notes/%?class=os'");
  assert.equal(run('App.parse().name'), 'notes'); assert.equal(run('App.parse().params[0]'), '%');
});
test('imported links cannot execute script URLs', () => {
  const run = app();
  for (const url of ['javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'data:text/html,test', '//example.com']) {
    assert.equal(run(`safeLink(${JSON.stringify(url)})`), '#');
  }
  for (const url of ['https://leetcode.com/problems/two-sum/', 'library/os/books/OSTEP.pdf']) {
    assert.equal(run(`safeLink(${JSON.stringify(url)})`), url);
  }
});
test('Google Docs embeds preserve section links and validate the document origin', () => {
  const run = app();
  const link = 'https://docs.google.com/document/d/abc-123/edit?tab=t.0#heading=h.notes';
  assert.equal(run(`googleDocEmbed(${JSON.stringify(link)})`), link.replace('/edit?', '/preview?'));
  assert.equal(run(`googleDocEmbed(${JSON.stringify(link)},false)`), link);
  assert.equal(run("googleDocEmbed('https://docs.google.com/document/d/e/published/pub')"), 'https://docs.google.com/document/d/e/published/pub?embedded=true');
  for (const url of ['javascript:alert(1)', 'https://docs.google.com.evil.com/document/d/abc/edit', 'https://user:pass@docs.google.com/document/d/abc/edit', 'https://docs.google.com/spreadsheets/d/abc/edit']) {
    assert.equal(run(`googleDocEmbed(${JSON.stringify(url)})`), null);
  }
  run(`const docNote=createNote({title:'Doc notes'});docNote.googleDoc={url:${JSON.stringify(link)},embedUrl:''};Store.save();Store.state=null;Store.load()`);
  assert.equal(run('S().notes.find(n=>n.title==="Doc notes").googleDoc.url'),link);
  assert.match(run('Views.notes.editor(S().notes.find(n=>n.title==="Doc notes"))'), /<iframe[^>]+src="https:\/\/docs.google.com\/document\/d\/abc-123\/preview\?tab=t.0#heading=h.notes"/);
});
test('Markdown images render safely and image syntax inside code stays literal', () => {
  const run = app();
  const render = text => run(`renderMarkdown(${JSON.stringify(text)})`);
  assert.match(render('![Diagram](https://example.com/image.png)'), /<img src="https:\/\/example.com\/image.png" alt="Diagram"/);
  assert.match(render('![Local](library/diagram.png)'), /<img src="library\/diagram.png"/);
  assert.doesNotMatch(render('![Bad](javascript:alert)'), /<img/);
  assert.doesNotMatch(render('`![Example](https://example.com/image.png)`'), /<img/);
  assert.match(render('![" onerror="alert](https://example.com/image.png)'), /alt="&quot; onerror=&quot;alert"/);
});
test('lecture notes display original PDFs and imported PDFs have a viewer', () => {
  const run = app();
  assert.match(run("Views.notes.editor(getNote('os-lec-01'))"), /class="slide-pdf-frame" src="library\/os\/lectures\/L01 Intro.pdf"/);
  assert.match(run("slidePdfPanel({title:'Imported',source:{kind:'pdf',fileId:'saved-file'}})"), /class="slide-pdf-frame"/);
  assert.equal(run("slidePdfPanel({title:'Text',source:{kind:'paste'}})"), '');
  assert.equal(run("slidePdfPath({source:{path:'javascript:bad.pdf'}})"), '');
  assert.ok(run("notePdfFiles(getNote('nut-wk-01')).length") >= 3);
  assert.match(run("Views.notes.editor(getNote('nut-wk-01'))"), /pdf-file-select/);
});
test('every PDF-backed note displays a PDF without extracted text or Markdown controls', () => {
  const run = app();
  assert.ok(run('S().notes.filter(isPdfNote).length') > 20);
  assert.equal(run("S().notes.filter(isPdfNote).every(n=>{const html=Views.notes.editor(n);return html.includes('slide-pdf-frame')&&!html.includes('md-input')&&!html.includes('md-preview')&&!html.includes('md-toolbar')})"), true);
  run("const missingPdf=createNote({title:'Missing PDF',body:'EXTRACTED TEXT',source:{kind:'pdf'}})");
  assert.doesNotMatch(run('Views.notes.editor(missingPdf)'), /EXTRACTED TEXT|md-preview|md-input/);
  assert.match(run('Views.notes.editor(missingPdf)'), /original PDF is missing/);
});
test('PDF imports do not extract text or require a CDN reader', async () => {
  const run = app();
  run("Importer.extract=()=>{throw Error('PDF extraction must not run')};Importer.guessClass=()=>'';ImportUI.addFiles([{name:'Scanned slides.pdf',size:100}], 'os')");
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(run('ImportUI.items[0].status'), 'ready');
  assert.equal(run('ImportUI.items[0].data.body'), '');
});
test('invalid backups cannot replace current storage', () => {
  const run = app();
  for (const value of ['null', '[]', '{classes:{},notes:[]}', '{classes:[],notes:[null]}']) {
    assert.throws(() => run(`Store.state=migrate(${value})`));
    assert.equal(run('S().classes.length'), 4);
  }
});
test('calendar dates and repeat exceptions survive DST boundaries', () => {
  const run = app();
  assert.equal(run("addDays('2026-03-08',1)"), '2026-03-09');
  assert.equal(run("daysBetween('2026-03-07','2026-03-09')"), 2);
  assert.equal(run("occursOn({date:'2026-09-01',repeat:'daily',skip:['2026-09-02']},'2026-09-02')"), false);
});
test('ICS daily exceptions and duplicate imports are preserved', async () => {
  const run = app();
  const text = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:audit-daily\r\nDTSTART;VALUE=DATE:20260901\r\nRRULE:FREQ=DAILY;COUNT=4\r\nEXDATE;VALUE=DATE:20260902\r\nSUMMARY:Audit\r\nEND:VEVENT\r\nEND:VCALENDAR';
  await run(`importIcs({text:async()=>${JSON.stringify(text)}})`);
  assert.equal(run("S().events.find(e=>e.importUid==='audit-daily').skip[0]"), '2026-09-02');
  assert.equal(run("S().events.find(e=>e.importUid==='audit-daily').until"), '2026-09-04');
  await run(`importIcs({text:async()=>${JSON.stringify(text)}})`);
  assert.equal(run("S().events.filter(e=>e.importUid==='audit-daily').length"), 1);
});
test('ICS named time zones convert to local time with seasonal offsets', () => {
  const run = app();
  for (const [date,utc] of [['20260917','2026-09-17T16:00:00Z'],['20260117','2026-01-17T17:00:00Z']]) {
    assert.equal(run(`JSON.stringify(icsWhen('DTSTART;TZID=America/Los_Angeles:${date}T090000'))`),
      run(`JSON.stringify({date:ymd(new Date('${utc}')),time:String(new Date('${utc}').getHours()).padStart(2,'0')+':00'})`));
  }
});
test('LeetCode snapshot updates preserve review history and edited patterns', () => {
  const run = app(); run('LC.all(); const p=LC.all()[0]; p.reps=7; p.patternSet=true; p.pattern="Custom"; p.keyIdea="Keep"; LC.merge([{...p,code:"updated"}])');
  assert.equal(run('LC.all()[0].reps'), 7); assert.equal(run('LC.all()[0].pattern'), 'Custom');
  assert.equal(run('LC.all()[0].keyIdea'), 'Keep'); assert.equal(run('LC.all()[0].code'), 'updated');
});
test('sync works with Linux paths, spaces, uppercase extensions and environment configuration', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'study-audit-'));
  try {
    fs.mkdirSync(path.join(dir,'tools'));fs.mkdirSync(path.join(dir,'js'));
    for (const file of ['tools/sync-leetcode.js','js/leetcode-parse.js']) fs.copyFileSync(path.join(root,file),path.join(dir,file));
    const vault = path.join(dir,'My Vault');const notes = path.join(vault,'4 - Main Notes','Leetcode','Easy');fs.mkdirSync(notes,{recursive:true});
    fs.writeFileSync(path.join(notes,'1. Two Sum.MD'),'```python\nreturn []\n```');
    const script = path.join(dir,'tools/sync-leetcode.js');
    const result = spawnSync(process.execPath,[script,vault],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/Wrote 1 problems/);
    assert.match(fs.readFileSync(path.join(dir,'js/leetcode-data.js'),'utf8'),/4 - Main Notes\/Leetcode\/Easy\/1. Two Sum.MD/);
    assert.equal(spawnSync(process.execPath,[script],{env:{...process.env,OBSIDIAN_VAULT:vault}}).status,0);
    const missing=spawnSync(process.execPath,[script],{env:{...process.env,OBSIDIAN_VAULT:''},encoding:'utf8'});
    assert.equal(missing.status,1);assert.match(missing.stderr,/Usage:/);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

const examFixture=fs.readFileSync(path.join(__dirname,'fixtures/practice-exam.txt'),'utf8');
test('practice parser accepts mixed questions and rejects incomplete or ambiguous imports',()=>{
 const {parsePracticeExam}=require('../js/practice-exams.js');
 const parsed=parsePracticeExam('```text\r\n'+examFixture.replace(/\n/g,'\r\n')+'```');
 assert.equal(parsed.errors.length,0);assert.equal(parsed.questions.length,3);
 for(const bad of [examFixture.replace('ANSWER: A','ANSWER: Z'),examFixture.replace('D) A filename',''),examFixture.replace('END_QUESTION',''),examFixture.replace('TYPE: SHORT','TYPE: ESSAY'),examFixture.replace('EXPLANATION: A mutex provides mutual exclusion.','')]) assert.ok(parsePracticeExam(bad).errors.length);
});
test('practice tests persist answers, score objective questions, self-grade short answers and deduplicate flashcards',()=>{
 const run=app();run(`const parsedExam=parsePracticeExam(${JSON.stringify(examFixture)});const savedExam=savePracticeExam(parsedExam,{classId:'os',examId:'',noteIds:[]});savedExam.answers[savedExam.questions[0].id]='B';savedExam.answers[savedExam.questions[1].id]='False';savedExam.answers[savedExam.questions[2].id]='My response';finishPracticeExam(savedExam);finishPracticeExam(savedExam)`);
 assert.equal(run('savedExam.attempts.length'),1);assert.equal(run('practiceExamScore(savedExam).correct'),1);assert.equal(run('practiceExamScore(savedExam).pending'),1);
 assert.equal(run('practiceMissedCards(savedExam)'),1);assert.equal(run('practiceMissedCards(savedExam)'),0);
 run('savedExam.selfGrades[savedExam.questions[2].id]=1;Store.save();Store.state=null;Store.load()');
 assert.equal(run('practiceExamScore(practiceTests()[0]).correct'),2);assert.equal(run('practiceTests()[0].answers[practiceTests()[0].questions[2].id]'),'My response');
 assert.doesNotMatch(run('practiceTests()[0].submitted=false;Views.practice.test(practiceTests()[0])'),/Model answer|Explanation & review/);
});
test('practice prompts ground tests in class material and use the parser schema',()=>{
 const run=app();const prompt=run("practicePrompt({classId:'os',examId:'',topicId:'',noteIds:[],count:7,level:'Course level',format:'Mixed',extra:'fork traces',material:'A mutex protects a critical section.'})");
 assert.match(prompt,/exactly 7 actual questions/);assert.match(prompt,/A mutex protects/);assert.match(prompt,/BEGIN_QUESTION/);assert.match(prompt,/upload\/paste/);
});
test('class pages show scoped task records and definitions match whole longest terms',()=>{
 const run=app();run("S().tasks.push({id:'class-only',title:'OS exercise',classId:'os',date:todayStr(),done:false})");
 assert.match(run("Views.classes.render(['os'])"),/OS exercise/);assert.doesNotMatch(run("Views.classes.render(['sec'])"),/OS exercise/);
 assert.equal(run("definitionMatches('APIs APIary virtual memory and authentication').length"),3);
 assert.match(run("definitionMatches('virtual memory')[0].url"),/vm-intro.pdf$/);
});
test('exam countdowns distinguish date-only, timed, completed and past exams',()=>{
 const run=app();
 assert.equal(run("examCountdownText({date:'2026-10-01'},new Date('2026-09-30T12:00:00'))"),'1 day to go');
 assert.equal(run("examCountdownText({date:'2026-10-01'},new Date('2026-10-01T12:00:00'))"),'Exam today');
 assert.equal(run("examCountdownText({date:'2026-10-01',time:'14:00'},new Date('2026-10-01T12:30:00'))"),'1h 30m 0s to go');
 assert.equal(run("examCountdownText({date:'2026-10-01',time:'14:00'},new Date('2026-10-01T14:00:00'))"),'Start time passed');
 assert.equal(run("examCountdownText({date:'2026-10-01',done:true})"),'Completed');
 run("S().events.push({id:'countdown-test',classId:'os',title:'Midterm',type:'exam',date:addDays(todayStr(),3),time:'',done:false})");
 assert.match(run("examCountdownPanel('os')"),/Midterms & finals/);
});
test('class tabs separate long materials and info from the default overview',()=>{
 const run=app();
 const overview=run("Views.classes.render(['os'])");
 assert.match(overview,/Class tasks & deadlines/);assert.match(overview,/Continue studying/);
 assert.doesNotMatch(overview,/lecture-list|id="res-add"|data-custom-k/);
 assert.match(run("Views.classes.render(['os'],{tab:'materials'})"),/lecture-list/);
 assert.match(run("Views.classes.render(['os'],{tab:'info'})"),/data-custom-k|Class info/);
 assert.doesNotMatch(run("Views.classes.render(['os'],{tab:'tasks'})"),/lecture-list/);
 assert.equal(run('NotesUI.mode'),'preview');
 assert.doesNotMatch(run("googleDocPanel({title:'Test'})"),/<details open/);
});
test('quiet reminder checks retain reminders without emitting startup toasts',()=>{
 const run=app();
 run("let reminderToasts=0;toast=()=>reminderToasts++;Notify.desktop=()=>{};Notify.renderBell=()=>{};Notify.settings=()=>({cardsDaily:true});S().notifyLog={};Notify.check({quiet:true})");
 assert.equal(run('reminderToasts'),0);
 run("Notify.push({key:'quiet-test',title:'Saved reminder',kind:'cards'},{quiet:true})");
 assert.equal(run('reminderToasts'),0);assert.equal(run("S().notifications[0].title"),'Saved reminder');
});
test('LeetCode is self-paced and removes legacy scheduling without losing history',()=>{
 const run=app();run("LC.all();const lcProblem=LC.all()[0];lcProblem.due='2099-01-01';lcProblem.interval=12;lcProblem.ease=2.5;lcProblem.reps=7;LC.data()");
 assert.equal(run("'due' in lcProblem"),false);assert.equal(run('lcProblem.reps'),7);
 run('LC.grade(lcProblem,0)');assert.equal(run("'due' in lcProblem"),false);assert.equal(run('lcProblem.reps'),8);
 run('Views.lcpractice.start()');assert.equal(run('LCUI.session.queue.length'),run('LC.all().length'));
 assert.doesNotMatch(run('Views.leetcode.render([])+Views.leetcode.detail(lcProblem.num)'),/Due now|Next on|Next to re-solve|lc-due-now/);
 run('LCUI.session.pos=LCUI.session.queue.length;LCUI.session.stats=[0,0,1,0]');assert.match(run('Views.lcpractice.render([],{})'),/re-solved/);
});
test('breadcrumbs reflect the class hierarchy and navigation groups',()=>{
 const run=app();
 assert.match(run("workspaceBreadcrumb('classes',['os'],{tab:'tasks'})"),/<a href="#\/classes">Classes<\/a>.*Operating Systems.*Tasks &amp; deadlines/);
 assert.match(run("workspaceBreadcrumb('classes',['os'],{tab:'materials'})"),/aria-current="page">Materials/);
 assert.equal(run("navFor('classes').group"),'Classes');assert.equal(run("navFor('assist').group"),'Tools');
});

test('unreadable saved data is preserved until an explicit reset',()=>{
 const run=app();
 run("localStorage.setItem(STORE_KEY,'{broken original');Store.load();S().notes[0].title='Unsaved change';Store.save()");
 assert.equal(run('Store.recoveryRequired'),true);
 assert.equal(run('localStorage.getItem(STORE_KEY)'),'{broken original');
 assert.equal(run('Store.save()'),false);
 run('Store.reset()');
 assert.equal(run('Store.recoveryRequired'),false);
 assert.doesNotThrow(()=>JSON.parse(run('localStorage.getItem(STORE_KEY)')));
});
test('unchanged saves skip writes and failed saves remain retryable',()=>{
 const run=app();
 run('var writes=0;var setItemOriginal=localStorage.setItem;localStorage.setItem=(k,v)=>{writes++;setItemOriginal(k,v)};Store.save();Store.save()');
 assert.equal(run('writes'),0);
 run("S().notes[0].title='Changed';Store.save();Store.save()");
 assert.equal(run('writes'),1);
 run("localStorage.setItem=()=>{throw new Error('quota')};S().notes[0].title='Retry me'");
 assert.equal(run('Store.save()'),false);
 assert.equal(run('Store.saveError'),true);
 run('localStorage.setItem=setItemOriginal');
 assert.equal(run('Store.save()'),true);
 assert.equal(run('Store.saveError'),false);
 assert.equal(JSON.parse(run('localStorage.getItem(STORE_KEY)')).notes[0].title,'Retry me');
});
test('file storage retries failed opens and rejects transaction aborts',async()=>{
 const run=app();
 run("var openCount=0;var openReq;var fakeTx;var fakeDb={transaction(){fakeTx={objectStore(){return {get(){return {result:'file'}}}}};setTimeout(()=>fakeTx.onabort(),0);return fakeTx},close(){}};var indexedDB={open(){openCount++;openReq={};setTimeout(()=>{if(openCount===1){openReq.error=new Error('unavailable');openReq.onerror()}else{openReq.result=fakeDb;openReq.onsuccess()}},0);return openReq}}");
 await assert.rejects(run('FileStore.open()'),/unavailable/);
 await run('FileStore.open()');
 assert.equal(run('openCount'),2);
 await assert.rejects(run("FileStore.get('test')"),/aborted/);
 run('fakeDb.onversionchange()');
 assert.equal(run('FileStore._db'),null);
});
test('background services start once and release intervals and listeners',()=>{
 const run=app();
 run("var activeIntervals=new Set();var intervalSequence=0;var visibilityListeners=new Set();var setInterval=()=>{const id=++intervalSequence;activeIntervals.add(id);return id};var clearInterval=id=>activeIntervals.delete(id);document.addEventListener=(name,fn)=>visibilityListeners.add(fn);document.removeEventListener=(name,fn)=>visibilityListeners.delete(fn);Focus.tick=()=>{};Notify.check=()=>{};Notify.renderBell=()=>{};Focus.start();Focus.start();Notify.start();Notify.start()");
 assert.equal(run('activeIntervals.size'),2);
 assert.equal(run('visibilityListeners.size'),1);
 run('Focus.stop();Notify.stop();Focus.stop();Notify.stop()');
 assert.equal(run('activeIntervals.size'),0);
 assert.equal(run('visibilityListeners.size'),0);
});

test('search reuses its text index and refreshes after edits and storage failures',()=>{
 const run=app();
 run("globalSearch('operating');var firstIndex=globalSearch._index;globalSearch('nutrition')");
 assert.equal(run('firstIndex===globalSearch._index'),true);
 run("S().notes[0].title='Unique speed fixture';S().notes[0].body='Cachedbodyfixture';Store.save()");
 assert.equal(run("globalSearch('cachedbodyfixture').some(r=>r.label==='Unique speed fixture')"),true);
 assert.equal(run('firstIndex===globalSearch._index'),false);
 run("localStorage.setItem=()=>{throw new Error('quota')};S().notes[0].body='Failedsavefixture';Store.save()");
 assert.equal(run("globalSearch('failedsavefixture').some(r=>r.label==='Unique speed fixture')"),true);
 assert.equal(run("globalSearch('cachedbodyfixture').some(r=>r.label==='Unique speed fixture')"),false);
 run("S().notes[0].body='Cachedbodyfixture';Store.save()");
 assert.equal(run("globalSearch('cachedbodyfixture').some(r=>r.label==='Unique speed fixture')"),true);
 assert.equal(run("globalSearch('failedsavefixture').length"),0);
});
test('search caps results and remains accurate across state replacement',()=>{
 const run=app();
 run("S().notes.push(...Array.from({length:100},(_,i)=>({id:'search-'+i,title:'Capfixture '+i,body:'',classId:''})));Store.save()");
 assert.equal(run("globalSearch('capfixture').length"),30);
 assert.equal(run("globalSearch('capfixture')[29].label"),'Capfixture 29');
 assert.equal(run("globalSearch('c').length"),0);
 run('Store.reset()');
 assert.equal(run("globalSearch('capfixture').length"),0);
});
