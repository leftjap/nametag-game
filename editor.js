// ═══════════════════════════════════════
// editor.js — 에디터 툴바, 복사/붙여넣기, 미디어, 제스처
// ═══════════════════════════════════════

// ═══ 툴바 ═══
function execCmd(cmd, val) {
  const target = activeTab==='memo' ? document.getElementById('memo-body') : document.getElementById('edBody');
  target.focus();
  if(cmd==='formatBlock' && val) document.execCommand(cmd, false, '<'+val+'>');
  else document.execCommand(cmd, false, val||null);
}

function insertChecklist() {
  const target = activeTab==='memo' ? document.getElementById('memo-body') : document.getElementById('edBody');
  target.focus();
  document.execCommand('insertHTML', false, '<ul style="list-style:none;padding-left:0;"><li><input type="checkbox" style="margin-right:8px;transform:scale(1.2);"> </li></ul>');
}

function setupEnterKey() {
  document.querySelectorAll('.ed-title, .sf-input').forEach(input => {
    input.addEventListener('keydown', e => {
      if(e.key==='Enter') {
        e.preventDefault();
        const wrapper = e.target.closest('.editor-content-wrap');
        if(e.target.classList.contains('ed-title') || e.target.classList.contains('sf-input')) {
          const body = wrapper.querySelector('.ed-body');
          if(body) body.focus();
        }
      }
    });
  });
}

function toggleHeadingMenu() { document.getElementById('headingDropdown').classList.toggle('open'); }
function applyHeading(tag)   { document.getElementById('headingDropdown').classList.remove('open'); execCmd('formatBlock', tag); }

// ═══ 플로팅 툴바 ═══
let selectionTimeout = null;
function checkSelection() {
  const sel=window.getSelection(), ft=document.getElementById('floatingToolbar');
  if(!sel||sel.isCollapsed||sel.toString().trim()==='') { hideFloatingToolbar(); return; }
  const range=sel.getRangeAt(0), rect=range.getBoundingClientRect();
  if(rect.width===0) { hideFloatingToolbar(); return; }
  ft.classList.add('show'); ft.style.display='flex';
  const tbW=ft.offsetWidth||220, tbH=ft.offsetHeight||38, margin=8;
  let left=rect.left+rect.width/2-tbW/2, top=rect.top+window.scrollY-tbH-margin-6;
  if(left<margin) left=margin; if(left+tbW>window.innerWidth-margin) left=window.innerWidth-tbW-margin;
  if(top<margin) top=rect.bottom+window.scrollY+margin;
  ft.style.left=left+'px'; ft.style.top=top+'px';
}

function hideFloatingToolbar() {
  const ft=document.getElementById('floatingToolbar');
  if(ft) { ft.classList.remove('show'); ft.style.display='none'; }
}

function applyFormatFT(cmd, val) { execCmd(cmd, val); setTimeout(checkSelection, 50); }

function applyHighlight() {
  const target = activeTab==='memo' ? document.getElementById('memo-body') : document.getElementById('edBody');
  target.focus();
  document.execCommand('backColor', false, '#fde68a');
  setTimeout(checkSelection, 50); updateWC();
  if(textTypes.includes(activeTab)) saveCurDoc(activeTab); else saveMemo();
}

document.addEventListener('mousedown', e => {
  const hd=document.getElementById('headingDropdown'), hb=document.getElementById('headingBtn');
  if(hd&&hd.classList.contains('open')) { if(hb&&!hb.contains(e.target)&&!hd.contains(e.target)) hd.classList.remove('open'); }
  const ft=document.getElementById('floatingToolbar'), eb=document.getElementById('edBody'), mb=document.getElementById('memo-body');
  if(ft&&ft.classList.contains('show')) { if(!ft.contains(e.target)&&!(eb&&eb.contains(e.target))&&!(mb&&mb.contains(e.target))) hideFloatingToolbar(); }
});
document.addEventListener('keydown', e => { if(e.key==='Escape') hideFloatingToolbar(); });

// ═══ 복사 핸들러 ═══
function setupCopyHandler() {
  document.addEventListener('copy', function(e) {
    const activeEl = document.activeElement;
    if(activeEl && activeEl.isContentEditable) {
      const selection = window.getSelection();
      if(selection.rangeCount>0 && !selection.isCollapsed) {
        const range=selection.getRangeAt(0), tempDiv=document.createElement('div');
        tempDiv.appendChild(range.cloneContents());
        if(tempDiv.querySelector('img')) return;
        e.preventDefault();
        let text='';
        function traverse(el) {
          if(el.nodeType===Node.TEXT_NODE) { text+=el.nodeValue; }
          else if(el.nodeType===Node.ELEMENT_NODE) {
            const tag=el.tagName.toLowerCase();
            const isBlock=['div','p','h1','h2','h3','li','blockquote','ul','ol'].includes(tag);
            if(isBlock && text.length>0 && !text.endsWith('\n')) text+='\n';
            if(tag==='br') text+='\n';
            for(let child of el.childNodes) traverse(child);
            if(isBlock && text.length>0 && !text.endsWith('\n')) text+='\n';
          }
        }
        traverse(tempDiv);
        text = text.replace(/\n{3,}/g,'\n\n').trim();
        e.clipboardData.setData('text/plain', text);
        e.clipboardData.setData('text/html', text.replace(/\n/g,'<br>'));
      }
    }
  });
}

// ═══ 미디어 업로드 ═══
async function handleMediaUpload(e) {
  const file=e.target.files[0]; if(!file) return;
  const isImage = file.type.startsWith('image/');
  if(!isImage) {
    const attachHtml=`<div style="display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin:8px 0;font-size:14px;user-select:none;">📎 ${file.name}</div><br>`;
    execCmd('insertHTML', attachHtml); updateWC();
    if(textTypes.includes(activeTab)) saveCurDoc(activeTab); else saveMemo();
    e.target.value=''; return;
  }
  const tempBlobUrl=URL.createObjectURL(file), mimeType=file.type;
  const filename='img_'+Date.now()+(mimeType==='image/png'?'.png':'.jpg');
  const tempId='img_'+Date.now();
  const imgHtml=`<img src="${tempBlobUrl}" id="${tempId}" alt="첨부이미지" style="box-sizing:border-box;border:3px solid var(--ac-light);transition:border-color 0.3s;opacity:1;">`;
  execCmd('insertHTML', imgHtml+'<br>'); updateWC();
  if(textTypes.includes(activeTab)) saveCurDoc(activeTab); else saveMemo();
  const reader=new FileReader();
  reader.onload = async function(ev) {
    const base64Data=ev.target.result.split(',')[1];
    try {
      const res=await SYNC.uploadImage(base64Data, filename, mimeType);
      const directUrl=`https://drive.google.com/thumbnail?id=${res.id}&sz=w1000`;
      const editor=activeTab==='memo'?document.getElementById('memo-body'):document.getElementById('edBody');
      const imgEl=editor.querySelector(`#${tempId}`);
      if(imgEl){imgEl.src=directUrl;imgEl.style.border='1px solid var(--border-l)';imgEl.removeAttribute('id');}
      if(textTypes.includes(activeTab)) saveCurDoc(activeTab); else saveMemo();
    } catch(err) {
      const editor=activeTab==='memo'?document.getElementById('memo-body'):document.getElementById('edBody');
      const imgEl=editor.querySelector(`#${tempId}`);
      if(imgEl){imgEl.style.border='3px solid var(--red)';imgEl.title='업로드 실패';imgEl.removeAttribute('id');}
      if(textTypes.includes(activeTab)) saveCurDoc(activeTab); else saveMemo();
    }
  };
  reader.readAsDataURL(file); e.target.value='';
}

// ═══ 붙여넣기 ═══
async function handlePaste(e) {
  const items=(e.clipboardData||e.originalEvent.clipboardData).items;
  let hasImage=false;
  for(let item of items) {
    if(item.type.indexOf('image/')===0) {
      hasImage=true; e.preventDefault();
      const file=item.getAsFile(), tempBlobUrl=URL.createObjectURL(file), mimeType=file.type;
      const filename='img_'+Date.now()+(mimeType==='image/png'?'.png':'.jpg'), tempId='img_'+Date.now();
      const imgHtml=`<img src="${tempBlobUrl}" id="${tempId}" alt="첨부이미지" style="box-sizing:border-box;border:3px solid var(--ac-light);transition:border-color 0.3s;opacity:1;">`;
      document.execCommand('insertHTML', false, imgHtml+'<br>'); updateWC();
      if(textTypes.includes(activeTab)) saveCurDoc(activeTab); else saveMemo();
      const reader=new FileReader();
      reader.onload=async function(ev){
        const base64Data=ev.target.result.split(',')[1];
        try{
          const res=await SYNC.uploadImage(base64Data,filename,mimeType);
          const directUrl=`https://drive.google.com/thumbnail?id=${res.id}&sz=w1000`;
          const editor=activeTab==='memo'?document.getElementById('memo-body'):document.getElementById('edBody');
          const imgEl=editor.querySelector(`#${tempId}`);
          if(imgEl){imgEl.src=directUrl;imgEl.style.border='1px solid var(--border-l)';imgEl.removeAttribute('id');}
          if(textTypes.includes(activeTab))saveCurDoc(activeTab);else saveMemo();
        }catch(err){
          const editor=activeTab==='memo'?document.getElementById('memo-body'):document.getElementById('edBody');
          const imgEl=editor.querySelector(`#${tempId}`);
          if(imgEl){imgEl.style.border='3px solid var(--red)';imgEl.title='업로드 실패';imgEl.removeAttribute('id');}
          if(textTypes.includes(activeTab))saveCurDoc(activeTab);else saveMemo();
        }
      };
      reader.readAsDataURL(file); break;
    }
  }
  if(!hasImage) {
    e.preventDefault();
    const text=(e.clipboardData||e.originalEvent.clipboardData).getData('text/plain');
    if(text) {
      const escapedText=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      document.execCommand('insertHTML', false, escapedText.replace(/\r\n/g,'<br>').replace(/\n/g,'<br>'));
    }
    setTimeout(()=>{if(textTypes.includes(activeTab))saveCurDoc(activeTab);else saveMemo();updateWC();},100);
  }
}

function setupEditorImageSelection() {
  const onImageClick=function(e){if(e.target.tagName==='IMG'&&e.target.closest('.ed-body')){const range=document.createRange();range.selectNode(e.target);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);}};
  document.getElementById('edBody').addEventListener('click', onImageClick);
  document.getElementById('memo-body').addEventListener('click', onImageClick);
}

// ═══ 자동 저장 ═══
let _at = null;
function setupAutoSave() {
  const showSaving = () => { if(document.getElementById('edSaveStatus')) document.getElementById('edSaveStatus').textContent='저장 중...'; };
  const showSaved  = () => { if(document.getElementById('edSaveStatus')) document.getElementById('edSaveStatus').textContent='저장됨'; };
  const saveLocalOnly = () => {
    if(textTypes.includes(activeTab)){saveCurDoc(activeTab);showSaved();}
    else if(activeTab==='memo'){saveMemo();showSaved();}
    else if(activeTab==='book'){saveBook();showSaved();}
    else if(activeTab==='quote'){saveQuote();showSaved();}
  };
  const doSaveAndSync = () => {
    saveLocalOnly(); SYNC.scheduleDatabaseSave();
    if(textTypes.includes(activeTab)) SYNC.scheduleDocSave(activeTab);
    else if(activeTab==='memo') SYNC.scheduleDocSave('memo');
  };
  const onInput = () => { showSaving(); clearTimeout(_at); _at=setTimeout(doSaveAndSync,800); updateWC(); };
  const els=['edBody','edTitle','memo-body','memo-title','book-title','book-author','book-publisher','book-pages','book-body','quote-by','quote-body'];
  els.forEach(id => {
    const el=document.getElementById(id);
    if(el) {
      el.addEventListener('input', onInput);
      el.addEventListener('blur', () => { setTimeout(() => { saveLocalOnly(); }, 200); });
    }
  });
  document.addEventListener('visibilitychange', () => { if(document.visibilityState==='hidden'){clearTimeout(_at);saveLocalOnly();SYNC.syncAll();} });
}

// ═══ 모바일 제스처 ═══
function setupGesturesAndUI() {
  const app=document.getElementById('mainApp');
  let startX=0,startY=0,isPulling=false;
  const editorEl=document.querySelector('.editor');
  app.addEventListener('touchstart',e=>{
    if(window.innerWidth>768)return;
    startX=e.touches[0].screenX; startY=e.touches[0].screenY;
    const scrollArea=e.target.closest('.editor-scroll-area');
    if(app.classList.contains('view-editor')&&scrollArea&&scrollArea.scrollTop<=0) isPulling=true;
  },{passive:true});
  app.addEventListener('touchmove',e=>{
    if(window.innerWidth>768)return;
    if(isPulling&&app.classList.contains('view-editor')){
      let dy=e.touches[0].screenY-startY, dx=Math.abs(e.touches[0].screenX-startX);
      if(dy>0&&dy>dx){e.preventDefault();editorEl.style.transform=`translateX(0) translateY(${dy*0.8}px)`;editorEl.style.transition='none';}
    }
  },{passive:false});
  app.addEventListener('touchend',e=>{
    if(window.innerWidth>768)return;
    const dx=e.changedTouches[0].screenX-startX, dy=e.changedTouches[0].screenY-startY;
    if(Math.abs(dx)>Math.abs(dy)*1.5&&dx>50&&startX<40){if(app.classList.contains('view-editor'))handleDone();else if(app.classList.contains('view-list'))setMobileView('side');}
    if(isPulling){
      isPulling=false; editorEl.style.transition='transform 0.35s cubic-bezier(0.2,0.8,0.2,1)';
      if(dy>window.innerHeight*0.35||dy>200) handleDone(); else editorEl.style.transform='translateX(0) translateY(0)';
      setTimeout(()=>{editorEl.style.transform='';},350);
    }
  },{passive:true});
}

function setupSwipeActions() {
  const listEl=document.getElementById('pane-list'); if(!listEl)return;
  let startX=0,startY=0,currentItem=null,swiping=false,dx=0;
  const THRESHOLD=60;
  listEl.addEventListener('touchstart',e=>{
    if(window.innerWidth>768)return;
    const item=e.target.closest('.lp-item'); if(!item)return;
    if(currentItem&&currentItem!==item){currentItem.style.transform='';currentItem.classList.remove('swiped');}
    currentItem=item; startX=e.touches[0].clientX; startY=e.touches[0].clientY; swiping=false; dx=0; item.style.transition='none';
  },{passive:true});
  listEl.addEventListener('touchmove',e=>{
    if(!currentItem||window.innerWidth>768)return;
    const mx=e.touches[0].clientX-startX, my=e.touches[0].clientY-startY;
    if(!swiping&&Math.abs(mx)>Math.abs(my)&&Math.abs(mx)>10) swiping=true;
    if(!swiping)return; e.preventDefault();
    dx=Math.min(0,mx); if(currentItem.classList.contains('swiped')) dx=Math.min(0,mx-160);
    currentItem.style.transform=`translateX(${dx}px)`;
  },{passive:false});
  listEl.addEventListener('touchend',e=>{
    if(!currentItem||!swiping||window.innerWidth>768)return;
    currentItem.style.transition='transform .25s ease';
    if(dx<-THRESHOLD){currentItem.style.transform='translateX(-160px)';currentItem.classList.add('swiped');}
    else{currentItem.style.transform='';currentItem.classList.remove('swiped');}
    swiping=false;
  },{passive:true});
  document.addEventListener('touchstart',e=>{
    if(currentItem&&!e.target.closest('.lp-item')&&!e.target.closest('.swipe-action')){
      currentItem.style.transition='transform .25s ease'; currentItem.style.transform=''; currentItem.classList.remove('swiped'); currentItem=null;
    }
  },{passive:true});
}
