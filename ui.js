// ═══════════════════════════════════════
// ui.js — UI 전환, 탭, 리스트 렌더링 (Day One 스타일)
// ═══════════════════════════════════════

// ═══ 탭별 파스텔 색상 (Day One 스타일) ═══
const TAB_COLORS = {
  navi:    '#7EB5F4',
  fiction: '#F4B77E',
  blog:    '#82C99A',
  book:    '#7E9CF4',
  quote:   '#C49ADE',
  memo:    '#B0B0B8'
};

// ═══ 레이아웃 전환 ═══
function switchListView(view) {
  currentListView = view;
  ['list','photo','calendar'].forEach(v => {
    document.getElementById('pane-'+v).style.display = 'none';
    document.getElementById('btn-'+v).classList.remove('on');
  });
  const target = document.getElementById('pane-'+view);
  target.style.display = (view==='list') ? 'flex' : 'block';
  document.getElementById('btn-'+view).classList.add('on');
  renderListPanel();
}

function toggleSidebar() {
  const app = document.getElementById('mainApp');
  app.classList.toggle('sidebar-closed');
  localStorage.setItem('gb_sidebar_closed', app.classList.contains('sidebar-closed') ? '1' : '0');
}

function setMobileView(view) {
  const app = document.getElementById('mainApp');
  app.classList.remove('view-side','view-list','view-editor');
  app.classList.add('view-'+view);
  if(view==='list') renderListPanel();
}

function toggleSearch() {
  const bar=document.getElementById('searchBar'), input=document.getElementById('searchInput'), vs=document.getElementById('viewSwitcher');
  bar.classList.toggle('active');
  if(bar.classList.contains('active')) { vs.style.display='none'; input.focus(); }
  else { clearSearch(); }
}

function handleSearch(e) {
  currentSearchQuery = e.target.value.trim();
  document.getElementById('clearSearchBtn').style.display = currentSearchQuery ? 'flex' : 'none';
  renderListPanel();
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  input.value = '';
  currentSearchQuery = '';
  document.getElementById('clearSearchBtn').style.display = 'none';
  document.getElementById('searchBar').classList.remove('active');
  document.getElementById('viewSwitcher').style.display = 'flex';
  renderListPanel();
}

function setTagSearch(tag) {
  const bar=document.getElementById('searchBar'), input=document.getElementById('searchInput'), vs=document.getElementById('viewSwitcher');
  bar.classList.add('active'); vs.style.display='none';
  input.value=tag; currentSearchQuery=tag;
  document.getElementById('clearSearchBtn').style.display='flex';
  if(window.innerWidth<=768) setMobileView('list');
  renderListPanel();
}

// ═══ 탭 전환 ═══
function renderWritingGrid() {
  const nav = document.getElementById('sideNav'); if(!nav) return;
  const tabs = [
    {id:'navi',   label:'오늘의 네비'},
    {id:'fiction', label:'단편 습작'},
    {id:'blog',   label:'블로그'},
    {id:'book',   label:'서재'},
    {id:'quote',  label:'어구'},
    {id:'memo',   label:'메모'}
  ];
  let html = '';
  if(window.innerWidth <= 768) {
    tabs.forEach(t => {
      const color = TAB_COLORS[t.id] || '#B0B0B8';
      const isOn = activeTab===t.id;
      html += `<div class="side-menu ${isOn?'on':''}" data-tab="${t.id}" onclick="switchTab('${t.id}'); setMobileView('list');">
        <div class="side-menu-l"><span class="tab-color-dot" style="background:${isOn ? '#ffffff' : color}"></span>${t.label}</div>
        <div class="badge-pill">${getTabCount(t.id)}</div>
        <div class="wi-arrow">›</div>
      </div>`;
    });
  } else {
    tabs.forEach(t => {
      const color = TAB_COLORS[t.id] || '#B0B0B8';
      const isOn = activeTab===t.id;
      html += `<button class="side-menu ${isOn?'on':''}" onclick="switchTab('${t.id}'); setMobileView('list');">
        <span class="side-menu-l"><span class="tab-color-dot" style="background:${isOn ? '#ffffff' : color}"></span>${t.label}</span>
        <span class="badge-pill">${getTabCount(t.id)}</span>
      </button>`;
    });
  }
  nav.innerHTML = html;
}

window.addEventListener('resize', () => { renderWritingGrid(); renderChk(); });

function switchTab(t) {
  if(textTypes.includes(activeTab)) saveCurDoc(activeTab);
  activeTab = t;
  document.getElementById('editorText').style.display  = textTypes.includes(t) ? 'flex':'none';
  document.getElementById('editorBook').style.display  = t==='book'  ? 'flex':'none';
  document.getElementById('editorQuote').style.display = t==='quote' ? 'flex':'none';
  document.getElementById('editorMemo').style.display  = t==='memo'  ? 'flex':'none';
  document.getElementById('edToolbar').style.display   = ['book','quote'].includes(t) ? 'none':'flex';
  clearSearch(); switchListView('list');
  if(textTypes.includes(t)) { const docs=getDocs(t); if(curIds[t])loadDoc(t,curIds[t],true); else if(docs.length)loadDoc(t,docs[0].id,true); else{const nd=newDoc(t);loadDoc(t,nd.id,true);} }
  if(t==='book')  { if(curBookId)loadBook(curBookId,true); else{const b=getBooks();if(b.length)loadBook(b[0].id,true);else newBook();} }
  if(t==='memo')  { if(curMemoId)loadMemo(curMemoId,true); else{const m=getMemos();if(m.length)loadMemo(m[0].id,true);else newMemoForm();} }
  if(t==='quote') { newQuoteForm(); }
  renderListPanel();
}

// ═══ 리스트 패널 렌더링 ═══
function getThumb(content) {
  if(!content) return '';
  const m = content.match(/<img[^>]+src=["'](data:image[^"']+|https?:[^"']+)["'][^>]*>/i);
  return m ? m[1] : '';
}

// XSS 방어
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const hl = (txt) => {
  if (!txt) return '';
  const safe = escapeHtml(txt);
  if (!currentSearchQuery) return safe;
  const safeQuery = escapeHtml(currentSearchQuery).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${safeQuery})`, 'gi'), '<mark class="highlight">$1</mark>');
};

const getPreviewText = (htmlContent) => {
  let raw = stripHtml(htmlContent)||'';
  if(!currentSearchQuery) return raw.slice(0,80);
  const idx = raw.toLowerCase().indexOf(currentSearchQuery.toLowerCase());
  if(idx!==-1) { const start=Math.max(0,idx-30), end=Math.min(raw.length,idx+currentSearchQuery.length+30); return (start>0?'...':'')+raw.substring(start,end)+(end<raw.length?'...':''); }
  return raw.slice(0,80);
};

function generateItemHtml(item, t) {
  const dt=new Date(item.created||item.date||Date.now()), day=dt.getDate(), dow=weekdays[dt.getDay()], time=formatTimeOnly(item.created||item.date);
  const swipePin = fn => `<div class="swipe-action pin-action" onclick="event.stopPropagation();${fn}"><span><svg viewBox="0 0 24 24"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.87l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>고정</span></div>`;
  const swipeDel = fn => `<div class="swipe-action del-action" onclick="event.stopPropagation();${fn}"><span><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>삭제</span></div>`;
  const dateBlock = `<div class="lp-date-wrap"><div class="lp-dow">${dow}</div><div class="lp-day">${day}</div></div>`;
  let isCur=false, clickFn='';

  if(textTypes.includes(t)) {
    isCur=curIds[t]===item.id; clickFn=`loadDoc('${t}','${item.id}'); setMobileView('editor');`;
    const rawPreview=getPreviewText(item.content), preview=hl(rawPreview), thumb=getThumb(item.content);
    const thumbHtml=thumb?`<div class="lp-thumb"><img src="${thumb}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"></div>`:'';
    const tagHtml=item.tags?`<div class="lp-item-tags">${hl(item.tags)}</div>`:'';
    return `<div class="lp-item ${isCur?'on':''}" onclick="${clickFn}">${dateBlock}<div class="lp-text-wrap"><div class="lp-item-title">${hl(item.title||'제목 없음')}</div>${tagHtml}${preview?`<div class="lp-item-preview">${preview}</div>`:''}<div class="lp-item-meta">${item.pinned?'📌 ':''}${time}</div></div>${thumbHtml}<div class="lp-item-actions"><button class="lp-action-btn pin ${item.pinned?'on':''}" onclick="togglePin('${t}','${item.id}',event)"><svg viewBox="0 0 24 24"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.87l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg></button><button class="lp-action-btn del" onclick="delDoc('${t}','${item.id}',event)"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div><div class="swipe-actions">${swipePin(`togglePin('${t}','${item.id}',event)`)}${swipeDel(`delDoc('${t}','${item.id}',event)`)}</div></div>`;
  } else if(t==='book') {
    isCur=curBookId===item.id; clickFn=`loadBook('${item.id}'); setMobileView('editor');`;
    const authorPub=[item.author,item.publisher].filter(Boolean).join(' · ');
    return `<div class="lp-item ${isCur?'on':''}" onclick="${clickFn}">${dateBlock}<div class="lp-text-wrap"><div class="lp-item-title">${hl(item.title)}</div><div class="lp-item-preview">${hl(authorPub)}</div><div class="lp-item-meta">${item.pinned?'📌 ':''}${time}</div></div><div class="lp-item-actions"><button class="lp-action-btn pin ${item.pinned?'on':''}" onclick="togglePin('${t}','${item.id}',event)"><svg viewBox="0 0 24 24"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.87l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg></button><button class="lp-action-btn del" onclick="delBook('${item.id}',event)"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div><div class="swipe-actions">${swipePin(`togglePin('${t}','${item.id}',event)`)}${swipeDel(`delBook('${item.id}',event)`)}</div></div>`;
  } else if(t==='quote') {
    isCur=curQuoteId===item.id; clickFn=`loadQuote('${item.id}'); setMobileView('editor');`;
    return `<div class="lp-item ${isCur?'on':''}" onclick="${clickFn}">${dateBlock}<div class="lp-text-wrap"><div class="quote-txt">${hl(item.text)}</div>${item.by?`<div class="lp-item-meta" style="margin-top:4px;">${item.pinned?'📌 ':''}${hl(item.by)}</div>`:''}</div><div class="lp-item-actions"><button class="lp-action-btn pin ${item.pinned?'on':''}" onclick="togglePin('${t}','${item.id}',event)"><svg viewBox="0 0 24 24"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.87l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg></button><button class="lp-action-btn del" onclick="delQuote('${item.id}',event)"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div><div class="swipe-actions">${swipePin(`togglePin('${t}','${item.id}',event)`)}${swipeDel(`delQuote('${item.id}',event)`)}</div></div>`;
  } else if(t==='memo') {
    isCur=curMemoId===item.id; clickFn=`loadMemo('${item.id}'); setMobileView('editor');`;
    const rawPreview=getPreviewText(item.content), preview=hl(rawPreview), thumb=getThumb(item.content);
    const thumbHtml=thumb?`<div class="lp-thumb"><img src="${thumb}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"></div>`:'';
    const tagHtml=item.tags?`<div class="lp-item-tags">${hl(item.tags)}</div>`:'';
    return `<div class="lp-item ${isCur?'on':''}" onclick="${clickFn}">${dateBlock}<div class="lp-text-wrap"><div class="lp-item-title">${hl(item.title||'제목 없음')}</div>${tagHtml}${preview?`<div class="lp-item-preview">${preview}</div>`:''}<div class="lp-item-meta">${item.pinned?'📌 ':''}${time}</div></div>${thumbHtml}<div class="lp-item-actions"><button class="lp-action-btn pin ${item.pinned?'on':''}" onclick="togglePin('${t}','${item.id}',event)"><svg viewBox="0 0 24 24"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.87l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg></button><button class="lp-action-btn del" onclick="delMemo('${item.id}',event)"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div><div class="swipe-actions">${swipePin(`togglePin('${t}','${item.id}',event)`)}${swipeDel(`delMemo('${item.id}',event)`)}</div></div>`;
  }
}

// ═══ 사진 뷰 (Day One 스타일 — 날짜 우측 하단) ═══
let selectedPhotoId = null;
function renderPhotoView(items, t) {
  const grid = document.getElementById('photoGrid');
  const photoItems = items.filter(item => {
    let thumb=''; if(textTypes.includes(t)||t==='memo') thumb=getThumb(item.content); return !!thumb;
  });
  if(!photoItems.length) { grid.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--tx-hint);grid-column:1/-1;font-size:13px;">사진이 포함된 기록이 없습니다</div>'; return; }
  let html='';
  photoItems.forEach(item => {
    const thumb=getThumb(item.content), dt=new Date(item.created||item.date||Date.now());
    const day=String(dt.getDate()).padStart(2,'0');
    const ym=`${dt.getFullYear()}년 ${dt.getMonth()+1}월`;
    const isSolo=photoItems.length===1, isSelected=selectedPhotoId===item.id;
    let clickFn=`loadDoc('${t}','${item.id}'); setMobileView('editor');`;
    if(t==='memo') clickFn=`loadMemo('${item.id}'); setMobileView('editor');`;
    html+=`<div class="photo-cell${isSolo?' solo':''}${isSelected?' selected':''}" onclick="selectPhoto('${item.id}', event); ${clickFn}">
      <div class="photo-cell-bg" style="background-image:url('${thumb}');"></div>
      <div class="photo-date-block">
        <span class="photo-day-num">${day}</span>
        <span class="photo-ym">${ym}</span>
      </div>
    </div>`;
  });
  grid.innerHTML = html;
}

function selectPhoto(id, e) {
  e.stopPropagation();
  selectedPhotoId = (selectedPhotoId===id) ? null : id;
  document.querySelectorAll('.photo-cell').forEach(el => el.classList.remove('selected'));
  if(selectedPhotoId) {
    document.querySelectorAll('.photo-cell').forEach(el => {
      if(el.getAttribute('onclick')&&el.getAttribute('onclick').includes(`'${selectedPhotoId}'`)) el.classList.add('selected');
    });
  }
}

// ═══ 캘린더 뷰 (Day One 스타일 — 과거→현재→미래 순서, 현재월 자동 스크롤) ═══
function renderCalendarView(items, t) {
  const calWrap=document.getElementById('calWrap');
  const todayD=new Date();
  const todayY=todayD.getFullYear(), todayM=todayD.getMonth()+1, todayDay=todayD.getDate();

  // 기본 범위: 이번달 기준 미래 2개월
  let minDate=new Date(todayY, todayM-1, 1);
  const futureEnd=new Date(todayY, todayM+1, 0); // 2개월 뒤 마지막날
  let maxDate=futureEnd;

  const entriesMap={}, photoDays={}, itemMap={};
  items.forEach(item=>{
    const dt=new Date(item.created||item.date||Date.now());
    if(dt<minDate) minDate=new Date(dt.getFullYear(), dt.getMonth(), 1);
    const y=dt.getFullYear(),m=dt.getMonth()+1,d=dt.getDate();
    const key=`${y}-${m}`,pKey=`${y}-${m}-${d}`;
    if(!entriesMap[key])entriesMap[key]=new Set();
    entriesMap[key].add(d);
    if(!itemMap[pKey])itemMap[pKey]=[];
    itemMap[pKey].push(item.id);
    let thumb=''; if(textTypes.includes(t)||t==='memo')thumb=getThumb(item.content);
    if(thumb&&!photoDays[pKey])photoDays[pKey]=thumb;
  });

  let startY=minDate.getFullYear(), startM=minDate.getMonth()+1;
  let endY=maxDate.getFullYear(), endM=maxDate.getMonth()+1;

  // 과거→미래 순서 (오래된 것이 위)
  const months=[]; let cy=startY,cm=startM;
  while(cy<endY||(cy===endY&&cm<=endM)){
    months.push({y:cy,m:cm,label:`${cy}년 ${cm}월`});
    cm++; if(cm>12){cm=1;cy++;}
  }

  let html='';
  let currentMonthIdx = -1;
  months.forEach((mo,mi)=>{
    // 현재월 인덱스 기억
    if(mo.y===todayY && mo.m===todayM) currentMonthIdx=mi;

    const first=new Date(mo.y,mo.m-1,1).getDay(), days=new Date(mo.y,mo.m,0).getDate();
    const key=`${mo.y}-${mo.m}`, entries=entriesMap[key]?Array.from(entriesMap[key]):[];
    let cells='';
    for(let i=0;i<first;i++) cells+=`<div class="cal-day empty"></div>`;
    for(let d=1;d<=days;d++){
      const has=entries.includes(d);
      const isToday=(mo.y===todayY && mo.m===todayM && d===todayDay);
      const pk=`${mo.y}-${mo.m}-${d}`, thumb=photoDays[pk];
      let cls='cal-day'; if(has)cls+=' has-entry'; if(isToday)cls+=' today';
      let inner='', numHtml=d;
      if(thumb){cls+=' has-photo';inner=`<div class="cal-photo-bg" style="background-image:url('${thumb}');"></div>`;numHtml=`<span class="cal-day-num">${d}</span>`;}
      let clickFn='';
      if(has&&itemMap[pk]&&itemMap[pk].length>0){
        const docId=itemMap[pk][0];
        let loadCall=`loadDoc('${t}','${docId}')`;
        if(t==='book')loadCall=`loadBook('${docId}')`;
        else if(t==='quote')loadCall=`loadQuote('${docId}')`;
        else if(t==='memo')loadCall=`loadMemo('${docId}')`;
        clickFn=`onclick="${loadCall}; setMobileView('editor'); selectCalDay(this);"`;
      }
      cells+=`<div class="${cls}" ${clickFn}>${inner}${numHtml}</div>`;
    }
    const monthId = `cal-month-${mo.y}-${mo.m}`;
    html+=`${mi>0?'<div class="cal-separator"></div>':''}
      <div class="cal-month-title" id="${monthId}">${mo.label}</div>
      <div class="cal-grid">${cells}</div>`;
  });
  calWrap.innerHTML=html;

  // 현재월로 자동 스크롤
  requestAnimationFrame(()=>{
    const currentEl = document.getElementById(`cal-month-${todayY}-${todayM}`);
    if(currentEl) {
      const pane = document.getElementById('pane-calendar');
      if(pane) {
        currentEl.scrollIntoView({block:'start'});
        // 요일 헤더 높이만큼 살짝 위로
        pane.scrollTop = Math.max(0, pane.scrollTop - 40);
      }
    }
  });
}

function selectCalDay(element) {
  document.querySelectorAll('.cal-day').forEach(el=>el.classList.remove('selected'));
  if(element) element.classList.add('selected');
}

function renderListPanel() {
  renderWritingGrid();
  const t=activeTab, el=document.getElementById('pane-list');
  const emptyState='<div style="text-align:center;padding:80px 20px;color:var(--tx-hint);font-size:15px">기록이 없습니다</div>';
  let items=[];
  if(textTypes.includes(t))items=getDocs(t);
  else if(t==='book')items=getBooks();
  else if(t==='quote')items=getQuotes();
  else if(t==='memo')items=getMemos();

  if(currentSearchQuery){
    const q=currentSearchQuery.toLowerCase();
    items=items.filter(it=>{
      const title=(it.title||'').toLowerCase(),content=(stripHtml(it.content||'')).toLowerCase();
      const tags=(it.tags||'').toLowerCase(),text=(it.text||'').toLowerCase();
      const by=(it.by||'').toLowerCase(),author=(it.author||'').toLowerCase();
      const dt=new Date(it.created||it.date||Date.now()),dStr=getLocalYMD(dt);
      return title.includes(q)||content.includes(q)||tags.includes(q)||text.includes(q)||by.includes(q)||author.includes(q)||dStr.includes(q);
    });
  }

  if(currentListView==='photo'){renderPhotoView(items,t);}
  if(currentListView==='calendar'){renderCalendarView(items,t);}
  if(!items.length){el.innerHTML=emptyState;return;}

  const pinnedItems=items.filter(i=>i.pinned), unpinnedItems=items.filter(i=>!i.pinned);
  const sortFn=(a,b)=>new Date(b.created||b.date||0)-new Date(a.created||a.date||0);
  pinnedItems.sort(sortFn); unpinnedItems.sort(sortFn);

  let html='';
  if(pinnedItems.length>0){
    html+=`<div class="lp-pin-hdr"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ac-light)"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.87l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg> 고정됨</div>`;
    pinnedItems.forEach(item=>{html+=generateItemHtml(item,t);});
  }
  let currentMonthStr='';
  unpinnedItems.forEach(item=>{
    const dt=new Date(item.created||item.date||Date.now()),mStr=getMonthYearStr(dt.toISOString());
    if(mStr!==currentMonthStr){html+=`<div class="lp-month-hdr">${mStr}</div>`;currentMonthStr=mStr;}
    html+=generateItemHtml(item,t);
  });
  el.innerHTML=html;
}

// ═══ 간단 액션 ═══
function handleNew() {
  const t=activeTab;
  if(textTypes.includes(t)){const nd=newDoc(t);loadDoc(t,nd.id,true);}
  else if(t==='book')  newBook();
  else if(t==='quote') newQuoteForm();
  else if(t==='memo')  newMemoForm();
  renderListPanel(); setMobileView('editor');
}

function handleDone() { if(document.activeElement) document.activeElement.blur(); setMobileView('list'); }