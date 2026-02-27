// ═══════════════════════════════════════
// sync.js — GAS 동기화, 지도, 이미지 메뉴, init
// ═══════════════════════════════════════

// ═══ GAS Sync ═══
const GAS_URL = '[https://script.google.com/macros/s/AKfycbw3WUMJJyab2uZ33OtZVU1Rv4kvo47cqTaRecEZta4gAtaizN667CV4oZLS8q4nNUTY/exec](https://script.google.com/macros/s/AKfycbw3WUMJJyab2uZ33OtZVU1Rv4kvo47cqTaRecEZta4gAtaizN667CV4oZLS8q4nNUTY/exec)';

const SYNC = {
  dbTimer:null, timer:null, checksTimer:null, isDbLoaded:false,
  savingDocs:{}, dirtyDocs:{}, quoteSyncHistory:{},

  setSyncStatus(text, type) {
    const el=document.getElementById('syncStatus'), dot=document.getElementById('syncDot');
    if(el) el.textContent=text;
    if(dot) { dot.style.background=type==='error'?'var(--red)':type==='syncing'?'var(--yellow)':'#7a9968'; dot.style.animation=type==='syncing'?'pulse 1s infinite':'none'; }
  },

  async _post(data) {
    data.token=APP_TOKEN; data.idToken=localStorage.getItem('gb_id_token');
    if(!data.idToken) throw new Error('LocalMode');
    try {
      const res=await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(data)});
      const json=await res.json();
      if(json.status==='error'){if(json.message==='Unauthorized')throw new Error('Unauthorized');else throw new Error(json.message);}
      return json;
    } catch(e) { if(e.message!=='Unauthorized'&&e.message!=='LocalMode') this.setSyncStatus('통신 지연','error'); throw e; }
  },

  async loadDatabase() {
    try {
      const res=await this._post({action:'load_db'});
      if(res&&res.dbData&&Object.keys(res.dbData).length>0){
        const db=res.dbData;
        if(db[K.docs]&&db[K.docs].length>=0) S(K.docs,db[K.docs]);
        if(db[K.books])  S(K.books,db[K.books]);
        if(db[K.quotes]) S(K.quotes,db[K.quotes]);
        if(db[K.memos])  S(K.memos,db[K.memos]);
        if(db[K.checks]) S(K.checks,db[K.checks]);
        this.isDbLoaded=true; this.setSyncStatus('동기화 완료','ok');
      } else { this.isDbLoaded=true; this.setSyncStatus('신규 상태','ok'); }
    } catch(e) {
      if(e.message==='LocalMode') this.setSyncStatus('로컬 전용','error');
      else this.setSyncStatus('불러오기 실패','error');
    }
  },

  async saveDatabase() {
    if(!this.isDbLoaded) return;
    const dbData={[K.docs]:L(K.docs)||[],[K.books]:L(K.books)||[],[K.memos]:L(K.memos)||[],[K.quotes]:L(K.quotes)||[],[K.checks]:L(K.checks)||{}};
    await this._post({action:'save_db', dbData});
  },

  scheduleDatabaseSave() { clearTimeout(this.dbTimer); this.dbTimer=setTimeout(async()=>{try{await this.saveDatabase();}catch(e){}},3000); },

  async uploadImage(base64, filename, mimeType) {
    if(!GAS_URL) throw new Error('No GAS URL');
    this.setSyncStatus('업로드 중','syncing');
    try { const res=await this._post({action:'upload_image',bytes:base64,filename,mimeType}); this.setSyncStatus('저장 완료','ok'); return res; }
    catch(e) { if(e.message==='LocalMode') this.setSyncStatus('로컬 전용','error'); else this.setSyncStatus('업로드 실패','error'); throw e; }
  },

  async saveDocToGDrive(id, type) {
    if(!GAS_URL||!this.isDbLoaded) return;
    if(this.savingDocs[id]){this.dirtyDocs[id]=type;return;}
    this.savingDocs[id]=true;
    const items=(type==='memo')?getMemos():allDocs();
    const doc=items.find(d=>d.id===id);
    if(!doc||!stripHtml(doc.content).trim()){this.savingDocs[id]=false;return;}
    try {
      const res=await this._post({action:'save_doc',id:doc.id,driveId:doc.driveId||null,type,title:doc.title||today(),content:buildDocContent(doc)});
      if(res&&res.driveId){
        const freshItems=(type==='memo')?getMemos():allDocs();
        const freshDoc=freshItems.find(d=>d.id===doc.id);
        if(freshDoc&&freshDoc.driveId!==res.driveId){freshDoc.driveId=res.driveId;if(type==='memo')saveMemos(freshItems);else saveDocs(freshItems);}
      }
    } finally {
      this.savingDocs[id]=false;
      if(this.dirtyDocs[id]){const nextType=this.dirtyDocs[id];delete this.dirtyDocs[id];this.saveDocToGDrive(id,nextType).catch(()=>{});}
    }
  },

  scheduleChecksSave() { clearTimeout(this.checksTimer); this.checksTimer=setTimeout(async()=>{try{await this.saveChecksToSheet();}catch(e){}this.scheduleDatabaseSave();},400); },

  async saveChecksToSheet(dateStr, checkData) {
    if(!GAS_URL||!this.isDbLoaded) return;
    const dStr=dateStr||today(), dData=checkData||getChk();
    const p={action:'save_routine',date:dStr,checks:dData}, pk=JSON.stringify(p);
    if(this.checksSaving){this.checksPending=true;return;}
    if(pk===this.lastChecksPayload) return;
    this.checksSaving=true;
    try{await this._post(p);this.lastChecksPayload=pk;}
    finally{this.checksSaving=false;if(this.checksPending){this.checksPending=false;try{await this.saveChecksToSheet();}catch(e){}}}
  },

  scheduleBookSave(book)  { clearTimeout(this.bookTimer);  this.bookTimer=setTimeout(async()=>{try{await this.saveBooksToSheet(book);}catch(e){}this.scheduleDatabaseSave();},5000); },
  scheduleQuoteSave(text,by,id) { clearTimeout(this.quoteTimer); this.quoteTimer=setTimeout(async()=>{if(!this.quoteSyncHistory[id]){try{await this.saveQuotesToSheet(text,by);}catch(e){}this.quoteSyncHistory[id]=true;}this.scheduleDatabaseSave();},5000); },
  async saveQuotesToSheet(text, by) { if(!GAS_URL||!this.isDbLoaded)return; await this._post({action:'save_quote',text:text||'',by:by||''}); },
  async saveBooksToSheet(book) {
    if(!GAS_URL||!book||!this.isDbLoaded) return;
    const res=await this._post({action:'save_doc',id:book.id,driveId:book.driveId,type:'book',title:book.title,content:'저자: '+(book.author||'')+'\n출판사: '+(book.publisher||'')+'\n읽은 양: '+(book.pages||0)+'p\n\n'+stripHtml(book.memo||'')});
    if(res&&res.driveId){const books=getBooks();const idx=books.findIndex(b=>b.id===book.id);if(idx!==-1&&books[idx].driveId!==res.driveId){books[idx].driveId=res.driveId;saveBooks(books);}}
  },
  scheduleDocSave(type) {
    clearTimeout(this.timer); this.timer=setTimeout(async()=>{
      let id=(type==='memo')?curMemoId:curIds[type];
      if(id){try{await this.saveDocToGDrive(id,type);}catch(e){}}
      this.scheduleDatabaseSave();
    },5000);
  },
  async syncAll() {
    if(!this.isDbLoaded) return; clearTimeout(this.timer); this.setSyncStatus('동기화 중','syncing');
    try {
      const promises=[];
      for(const type of textTypes){if(curIds[type])promises.push(this.saveDocToGDrive(curIds[type],type));}
      if(curMemoId) promises.push(this.saveDocToGDrive(curMemoId,'memo'));
      promises.push(this.saveDatabase());
      await Promise.all(promises); this.setSyncStatus('완료됨','ok');
    } catch(e) {
      if(e.message==='LocalMode') this.setSyncStatus('로컬 전용','error');
      else this.setSyncStatus('통신 지연','error');
    }
  }
};

// ═══ 지도 ═══
const LOCATIONS = {
  gio:{addrMain:'Mapo-gu, South Korea',addrSub:'와우산로37길'},
  soyeon:{addrMain:'Shinjuku, Tokyo',addrSub:'新宿区, 東京都'}
};

function openLocationModal(key) {
  const loc=LOCATIONS[key]; if(!loc) return;
  document.getElementById('addrMain').textContent=loc.addrMain;
  document.getElementById('addrSub').textContent=loc.addrSub;
  
  const mapContainer = document.querySelector('.modal-map');
  const searchQuery = encodeURIComponent(loc.addrSub + ' ' + loc.addrMain);
  
  mapContainer.innerHTML = `<iframe 
    width="100%" 
    height="100%" 
    frameborder="0" 
    style="border:0;" 
    src="[https://maps.google.com/maps?q=$](https://maps.google.com/maps?q=$){searchQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed">
  </iframe>`;

  document.getElementById('modalOverlay').classList.add('open');
}

function closeLocationModal() { document.getElementById('modalOverlay').classList.remove('open'); }
function onLocationOverlayClick(e) { if(e.target===document.getElementById('modalOverlay')) closeLocationModal(); }

// ═══ 이미지 호버 메뉴 ═══
let currentHoverImg = null;
function setupImageHover() {
  const hoverBtn=document.getElementById('imgHoverBtn'), menu=document.getElementById('imgDropdownMenu');
  const scrollAreas=document.querySelectorAll('.editor-scroll-area');
  const hideAll=()=>{if(!menu.classList.contains('open')){hoverBtn.classList.remove('show');currentHoverImg=null;}};
  const checkImgHover=(e)=>{
    if(e.target.tagName==='IMG'&&e.target.closest('.ed-body')){
      currentHoverImg=e.target; const rect=currentHoverImg.getBoundingClientRect();
      hoverBtn.style.top=(rect.top+10)+'px'; hoverBtn.style.left=(rect.right-42)+'px';
      hoverBtn.classList.add('show');
    } else if(e.target.closest('#imgHoverBtn')||e.target.closest('#imgDropdownMenu')) {}
    else { hideAll(); }
  };
  document.addEventListener('mousemove', checkImgHover);
  scrollAreas.forEach(area=>{area.addEventListener('scroll',()=>{hoverBtn.classList.remove('show');menu.classList.remove('open');currentHoverImg=null;});});
  document.addEventListener('click',e=>{if(!e.target.closest('#imgDropdownMenu')&&!e.target.closest('#imgHoverBtn')){menu.classList.remove('open');hoverBtn.classList.remove('show');}});
}

function toggleImgMenu(e) {
  e.stopPropagation(); const menu=document.getElementById('imgDropdownMenu'), hoverBtn=document.getElementById('imgHoverBtn');
  if(menu.classList.contains('open')){menu.classList.remove('open');}
  else{
    const btnRect=hoverBtn.getBoundingClientRect();
    menu.style.top=(btnRect.bottom+6)+'px';
    let left=btnRect.right-210; if(left<10)left=10; menu.style.left=left+'px';
    const now=new Date(); document.getElementById('imgMenuDate').textContent=`${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일`;
    menu.classList.add('open');
  }
}

async function execImgAction(action) {
  const menu=document.getElementById('imgDropdownMenu'), hoverBtn=document.getElementById('imgHoverBtn');
  menu.classList.remove('open'); hoverBtn.classList.remove('show');
  if(!currentHoverImg) return;
  if(action==='delete'||action==='cut'){currentHoverImg.remove();updateWC();if(textTypes.includes(activeTab))saveCurDoc(activeTab);else saveMemo();}
  if(action==='copy'||action==='cut'){
    try{
      const src=currentHoverImg.src;
      if(src.startsWith('data:')){const res=await fetch(src);const blob=await res.blob();await navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]);}
      else{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([currentHoverImg.outerHTML],{type:'text/html'})})]);}
    }catch(err){console.warn('Clipboard write failed:',err);}
  }
  currentHoverImg=null;
}

// ═══ 인증 ═══
const GOOGLE_CLIENT_ID = '910366325974-3ollm3pose37r1fvv8ngnd0v09f2p57l.apps.googleusercontent.com';
const ALLOWED_EMAIL    = 'leftjap@gmail.com';

function handleCredentialResponse(response) {
  try {
    const jwt=response.credential;
    const payload=JSON.parse(atob(jwt.split('.')[1]));
    if(payload.email===ALLOWED_EMAIL){
      localStorage.setItem('gb_auth','1');
      localStorage.setItem('gb_id_token',jwt);
      document.getElementById('lockScreen').classList.add('hidden');
      showApp();
    } else {
      document.getElementById('lockErr').textContent='접근 권한이 없는 계정입니다.';
    }
  } catch(e) {
    document.getElementById('lockErr').textContent='로그인 처리 중 오류가 발생했습니다.';
  }
}

window.onload = function() {
  document.getElementById('lockScreen').classList.add('hidden');
  showApp();
};

async function showApp() {
  const loading=document.getElementById('loadingScreen');
  loading.classList.remove('hidden');
  SYNC.setSyncStatus('동기화 중','syncing');
  await SYNC.loadDatabase();
  injectMockData();
  init();
  loading.style.opacity='0';
  setTimeout(()=>{
    loading.classList.add('hidden');
    loading.style.opacity='';
    document.getElementById('mainApp').style.display='flex';
    if(window.innerWidth<=768) setMobileView('side');
  },400);
}

// ═══ Init ═══
function init() {
  try {
    if(localStorage.getItem('gb_sidebar_closed')==='1') document.getElementById('mainApp').classList.add('sidebar-closed');
    renderChk(); updateBookStats(); updateWritingStats(); showRandomQuote();
    setupAutoSave(); setupEnterKey(); setupSwipeActions();
    setupCopyHandler(); setupImageHover();
    document.getElementById('edBody').addEventListener('paste', handlePaste);
    document.getElementById('memo-body').addEventListener('paste', handlePaste);
    const checkSelWrapper=()=>{clearTimeout(selectionTimeout);selectionTimeout=setTimeout(checkSelection,50);};
    document.getElementById('edBody').addEventListener('mouseup', checkSelWrapper);
    document.getElementById('edBody').addEventListener('keyup', e=>{if(e.shiftKey)checkSelWrapper();});
    document.getElementById('memo-body').addEventListener('mouseup', checkSelWrapper);
    document.getElementById('memo-body').addEventListener('keyup', e=>{if(e.shiftKey)checkSelWrapper();});
    setupEditorImageSelection(); setupGesturesAndUI();
    const naviDocs=getDocs('navi');
    if(naviDocs.length) loadDoc('navi',naviDocs[0].id,true);
    else { const nd=newDoc('navi'); loadDoc('navi',nd.id,true); }
    if(GAS_URL) SYNC.setSyncStatus('완료됨','ok'); else SYNC.setSyncStatus('로컬 전용','error');
    switchListView('list');
  } catch(e) {
    console.error('init error:',e);
    alert('초기화 오류: '+e.message);
  }
}
