/* KernelQuest · command navigation, accessibility and responsive interaction enhancements */
(() => {
  'use strict';
  const nav = window.KernelQuestNavigate;
  const $ = id => document.getElementById(id);
  const commandButton = $('commandBtn');
  const palette = $('commandPalette');
  const search = $('paletteInput');
  const results = $('paletteItems');
  const menu = $('menuBtn');
  const sidebar = $('sidebar');
  const overlay = $('sidebarOverlay');
  if (!nav || !palette || !search || !results || !sidebar) return;
  const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const common = [
    {title:'Overview',subtitle:'Dashboard · mission control',icon:'◈',kind:'view',key:'dashboard'},
    {title:'Learning path',subtitle:'12 core modules · 2 extensions',icon:'▦',kind:'view',key:'path'},
    {title:'Lab environments',subtitle:'10 hands-on simulators',icon:'⌘',kind:'view',key:'labs'},
    {title:'Mock examination',subtitle:'Timed OS midterm · 15 / 25 / 40 questions',icon:'◎',kind:'view',key:'exam'},
    {title:'Review queue',subtitle:'Revisit missed checkpoint questions',icon:'✳',kind:'view',key:'review'},
    {title:'Source library',subtitle:'Lecture and xv6 practice references',icon:'▤',kind:'view',key:'sources'}
  ];
  const data = Array.isArray(window.OS_DATA?.missions) ? window.OS_DATA.missions.map(m => ({
    title:m.title, subtitle:`Module ${m.n} · ${m.lectures} · ${m.tag}`,icon:m.n,kind:'mission',key:m.id
  })) : [];
  const labs = nav.labs.map(m => ({title:m.name,subtitle:`Interactive lab · ${m.description}`,icon:'⌘',kind:'lab',key:m.id}));
  const all = [...common,...data,...labs];
  let entries = [];
  let selected = 0;
  let focusBefore = null;
  function match(q,item){const text=(item.title+' '+item.subtitle).toLowerCase();const words=q.trim().toLowerCase().split(/\s+/).filter(Boolean);return words.every(word=>text.includes(word));}
  function renderItems(){
    const q=search.value||'';
    entries=all.filter(item=>match(q,item)).slice(0,15);
    selected=Math.min(selected,Math.max(0,entries.length-1));
    if(!entries.length){results.innerHTML='<div class="palette-empty">No matching modules or labs. Try a different search.</div>';return;}
    results.innerHTML=entries.map((item,i)=>'<button type="button" class="palette-option '+(i===selected?'active':'')+'" data-quick-index="'+i+'" role="option" aria-selected="'+(i===selected)+'"><span class="palette-icon">'+safe(item.icon)+'</span><span class="palette-main">'+safe(item.title)+'<small>'+safe(item.subtitle)+'</small></span><span class="palette-arrow">↗</span></button>').join('');
    const active=results.querySelector('.palette-option.active');
    active?.scrollIntoView({block:'nearest'});
  }
  function open(){
    if(!palette.hidden)return;
    closeMobile();
    focusBefore=document.activeElement;
    palette.hidden=false; search.value='';selected=0;renderItems();
    requestAnimationFrame(()=>search.focus());
    document.body.classList.add('palette-open');
  }
  function close(){
    if(palette.hidden)return;
    palette.hidden=true;document.body.classList.remove('palette-open');
    focusBefore?.focus?.();
  }
  function activate(i){
    const item=entries[i];if(!item)return;
    close();
    let ok=true;
    if(item.kind==='view')ok=nav.view(item.key);
    if(item.kind==='mission')ok=nav.mission(item.key);
    if(item.kind==='lab')ok=nav.lab(item.key);
    if(ok!==false)$('screen')?.focus({preventScroll:true});
  }
  function openMobile(){sidebar.classList.add('open');overlay.hidden=false;menu?.setAttribute('aria-expanded','true');document.body.classList.add('nav-open');}
  function closeMobile(){sidebar.classList.remove('open');overlay.hidden=true;menu?.setAttribute('aria-expanded','false');document.body.classList.remove('nav-open');}
  commandButton?.addEventListener('click',open);
  palette.addEventListener('click',e=>{if(e.target===palette)close();const hit=e.target.closest('[data-quick-index]');if(hit)activate(Number(hit.dataset.quickIndex));});
  search.addEventListener('input',()=>{selected=0;renderItems();});
  search.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){e.preventDefault();selected=Math.min(entries.length-1,selected+1);renderItems();}
    if(e.key==='ArrowUp'){e.preventDefault();selected=Math.max(0,selected-1);renderItems();}
    if(e.key==='Enter'){e.preventDefault();activate(selected);}
  });
  window.addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();palette.hidden?open():close();}
    if(e.key==='Escape'){if(!palette.hidden){e.preventDefault();close();}else if(sidebar.classList.contains('open'))closeMobile();}
    if(!palette.hidden&&e.key==='Tab'){
      const focusable=[search,...palette.querySelectorAll('button')].filter(x=>!x.disabled);
      const current=focusable.indexOf(document.activeElement);
      if(e.shiftKey&&current===0){e.preventDefault();focusable[focusable.length-1].focus();}
      if(!e.shiftKey&&current===focusable.length-1){e.preventDefault();focusable[0].focus();}
    }
  });
  // The original site already toggles the rail. Our listener runs after it; use
  // the resulting state to synchronize the overlay and accessibility state.
  menu?.addEventListener('click',()=>{
    const visible=sidebar.classList.contains('open');
    overlay.hidden=!visible; menu.setAttribute('aria-expanded',String(visible));
    document.body.classList.toggle('nav-open',visible);
  });
  overlay.addEventListener('click',closeMobile);
  sidebar.addEventListener('click',e=>{if(e.target.closest('[data-view]'))closeMobile();});
  window.matchMedia('(min-width: 781px)').addEventListener('change',e=>{if(e.matches)closeMobile();});
  // Key tips are progressive enhancement; no shortcut traps ordinary typing.
  window.KernelQuestUI={openSearch:open,closeSearch:close,closeMobile};
})();