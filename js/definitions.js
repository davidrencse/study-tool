/* References researched against MDN, NIST CSRC, Linux manuals and OSTEP.
 * Matching stays local: no note content is sent to a reference service. */
const DEFINITION_TERMS = [];
function addDefinitionTerms(base, source, entries) {
  for (const [slug, aliases] of entries) for (const term of aliases.split('|'))
    DEFINITION_TERMS.push({term,url:base+slug,source});
}
addDefinitionTerms('https://developer.mozilla.org/en-US/docs/Glossary/','MDN',[
 ['API','API|APIs|application programming interface'],['Algorithm','algorithm|algorithms'],['Data_structure','data structure|data structures'],['Abstraction','abstraction'],['Thread','thread|threads'],['JavaScript','JavaScript'],['HTML','HTML'],['CSS','CSS'],['HTTP','HTTP'],['HTTPS','HTTPS'],['TCP','TCP'],['UDP','UDP'],['DNS','DNS|domain name system'],['IP_Address','IP address'],['SQL','SQL'],['JSON','JSON'],['REST','REST'],['Recursion','recursion'],['Closure','closure|closures'],['Asynchronous','asynchronous'],['Callback_function','callback|callbacks'],['OOP','object-oriented programming|OOP'],['Cross-site_scripting','cross-site scripting|XSS'],['CSRF','CSRF|cross-site request forgery'],['Hash','hash|hashing'],['Encryption','encryption'],['Cryptography','cryptography'],['Symmetric-key_cryptography','symmetric-key cryptography'],['Public-key_cryptography','public-key cryptography'],['TLS','TLS'],['WebSocket','WebSocket|WebSockets'],['DOM','DOM|document object model'],['Cache','cache|caching'],['Compile','compiler|compilation'],['UTF-8','UTF-8']
]);
addDefinitionTerms('https://csrc.nist.gov/glossary/term/','NIST CSRC',[
 ['authentication','authentication'],['authorization','authorization'],['confidentiality','confidentiality'],['integrity','integrity'],['availability','availability'],['access_control','access control'],['malware','malware'],['phishing','phishing'],['vulnerability','vulnerability|vulnerabilities'],['digital_signature','digital signature|digital signatures'],['firewall','firewall|firewalls'],['buffer_overflow','buffer overflow'],['least_privilege','least privilege'],['risk_assessment','risk assessment']
]);
addDefinitionTerms('https://pages.cs.wisc.edu/~remzi/OSTEP/','OSTEP textbook',[
 ['intro.pdf','operating system|operating systems'],['cpu-intro.pdf','process|processes'],['cpu-sched.pdf','CPU scheduling|round robin|shortest job first|scheduling algorithm'],['cpu-api.pdf','fork|system call|system calls'],['vm-intro.pdf','virtual memory|address space|address spaces'],['vm-paging.pdf','paging|page table|page tables'],['vm-tlbs.pdf','translation lookaside buffer|TLB'],['vm-segmentation.pdf','segmentation'],['threads-intro.pdf','concurrency'],['threads-locks.pdf','mutex|mutexes|race condition|race conditions|critical section'],['threads-sema.pdf','semaphore|semaphores'],['threads-bugs.pdf','deadlock|deadlocks'],['file-intro.pdf','file system|file systems|inode|inodes'],['file-journaling.pdf','journaling'],['threads-cv.pdf','condition variable|condition variables']
]);
DEFINITION_TERMS.push({term:'threat model',url:'https://ssd.eff.org/glossary/threat-model',source:'EFF Surveillance Self-Defense'});
const definitionByTerm = new Map(DEFINITION_TERMS.map(d=>[d.term.toLowerCase(),d]));
const definitionPattern = new RegExp('(?<![\\w])('+DEFINITION_TERMS.map(d=>d.term).sort((a,b)=>b.length-a.length).map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?![\\w])','gi');
function definitionMatches(text) {
  return [...String(text).matchAll(definitionPattern)].map(m=>({index:m.index,text:m[0],...definitionByTerm.get(m[0].toLowerCase())}));
}
const DEFINITION_EXCLUDED = 'a,button,input,textarea,select,option,code,pre,script,style,svg,label,h1,h2,h3,summary,[role=timer],.study-day,.glance,[contenteditable],.sub-tabs,.practice-choices,.practice-question:not(.definition-review)';
function linkDefinitions(root) {
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=root.nodeType===Node.TEXT_NODE?[root]:[];
  while(walker.nextNode()) {
    const node=walker.currentNode;
    if(node.parentElement&&!node.parentElement.closest(DEFINITION_EXCLUDED))nodes.push(node);
  }
  for(const node of nodes){
    if(!node.parentElement||node.parentElement.closest(DEFINITION_EXCLUDED))continue;
    const matches=definitionMatches(node.nodeValue);if(!matches.length)continue;
    const fragment=document.createDocumentFragment();let offset=0;
    for(const match of matches){fragment.append(document.createTextNode(node.nodeValue.slice(offset,match.index)));const a=document.createElement('a');a.className='definition-link';a.href=match.url;a.target='_blank';a.rel='noopener noreferrer';a.title=`Read about ${match.text} · ${match.source}`;a.textContent=match.text;fragment.append(a);offset=match.index+match.text.length;}
    fragment.append(document.createTextNode(node.nodeValue.slice(offset)));node.replaceWith(fragment);
  }
}
function watchDefinitions(root) {
  linkDefinitions(root);
  const observer=new MutationObserver(records=>{
    observer.disconnect();
    try {
      // Scan inserted content, rather than the whole page after every timer tick.
      for(const record of records)for(const node of record.addedNodes){
        if(root.contains(node)&&(node.nodeType===Node.ELEMENT_NODE||node.nodeType===Node.TEXT_NODE))linkDefinitions(node);
      }
    } finally { observer.observe(root,{childList:true,subtree:true}); }
  });
  observer.observe(root,{childList:true,subtree:true});return observer;
}
