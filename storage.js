// ═══════════════════════════════════════
// storage.js — 스토리지, 공통 유틸, 루틴 체크
// ═══════════════════════════════════════

// ═══ Storage 기본 ═══
const APP_TOKEN = 'nametag2026';
const K = { docs:'gb_docs', checks:'gb_chk', books:'gb_books', quotes:'gb_quotes', memos:'gb_memos' };
const L = k => { try { return JSON.parse(localStorage.getItem(k)) || null } catch { return null } };

const S = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    console.error('localStorage 저장 실패:', k, e.message);
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      if (!window._storageWarningShown) {
        window._storageWarningShown = true;
        alert('저장 공간이 부족합니다. 오래된 기록을 정리하거나, 동기화 후 브라우저 캐시를 정리해주세요.');
      }
    }
  }
};

// ═══ 날짜/시간 유틸 ═══
const getLocalYMD = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today = () => getLocalYMD(new Date());
const weekdays = ['일','월','화','수','목','금','토'];

const formatFullDate = iso => {
  if(!iso) return '';
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes(), ampm = h >= 12 ? '오후' : '오전';
  h = h % 12 || 12;
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${weekdays[d.getDay()]}) ${ampm} ${h}:${String(m).padStart(2,'0')}`;
};

const formatTimeOnly = iso => {
  if(!iso) return '';
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes(), ampm = h >= 12 ? '오후' : '오전';
  h = h % 12 || 12;
  return `${ampm} ${h}:${String(m).padStart(2,'0')}`;
};

const getMonthYearStr = iso => {
  if(!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth()+1}월`;
};

function getWeekDates() {
  const d = new Date(), day = d.getDay(), sun = new Date(d);
  sun.setDate(d.getDate() - day);
  return Array.from({length:7}, (_, i) => {
    const x = new Date(sun);
    x.setDate(sun.getDate() + i);
    return getLocalYMD(x);
  });
}

const stripHtml = s => (s||'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ');
const formatTopDate = iso => formatFullDate(iso);

function buildDocContent(doc) {
  const body = stripHtml(doc.content || '');
  const metaLines = ['---'];
  if (doc.location) metaLines.push('위치: ' + doc.location);
  if (doc.weather)  metaLines.push('날씨: ' + doc.weather);
  if (doc.tags)     metaLines.push('태그: ' + doc.tags);
  if (doc.lat && doc.lng) metaLines.push('좌표: ' + doc.lat + ', ' + doc.lng);
  metaLines.push('작성일: ' + (doc.created || ''));
  return body + '\n\n' + metaLines.join('\n');
}

function fixDriveImageUrls(html) {
  if(!html) return '';
  return html.replace(/https:\/\/drive\.google\.com\/uc\?export=view(&amp;|&)id=([a-zA-Z0-9_-]+)/g,
    'https://drive.google.com/thumbnail?id=$2&sz=w1000');
}

// ═══ 모의 데이터 주입 (최초 실행 시) ═══
function injectMockData() {
  if(L(K.docs) && L(K.docs).length > 0) return;
  const docs = [
    { id:'m1', type:'blog', title:'바이브 코딩 체험기', tags:'#AI #개발 #에세이',
      content:'바이브 코딩은 처음 해보는데 그야말로 신세계다.<br><br>말로 이렇게 저렇게 구현됐으면 좋겠다고 말하면 AI가 뚝딱 결과물을 내놓는다.',
      created: new Date(Date.now() - 86400000).toISOString(), updated: new Date().toISOString(), pinned: false }
  ];
  S(K.docs, docs);
  const memos = [
    { id:'mem1', title:'제천음악영화제 시청 기록', tags:'#영화 #장항준 #인사이트',
      content:'영화 &lt;왕의 남자&gt;가 흥행하면서 관련 콘텐츠가 많이 올라온다.',
      created: new Date().toISOString(), updated: new Date().toISOString(), pinned: true }
  ];
  S(K.memos, memos);
  const quotes = [
    { id:'q1', text:'긴장하면 지고 설레면 이긴다.', by:'장항준', created: new Date().toISOString(), pinned: false }
  ];
  S(K.quotes, quotes);
}

// ═══ 루틴 체크 데이터 ═══
const ROUTINE_META = [
  { id:'exercise', name:'운동',   color:'#e87461', bg:'#fdf1ef' },
  { id:'vitamin',  name:'영양제', color:'#f0a848', bg:'#fef6eb' },
  { id:'english',  name:'영어',   color:'#5a8ec4', bg:'#eff3f9' },
  { id:'japanese', name:'일본어', color:'#7cb87c', bg:'#f2f8f2' },
  { id:'drawing',  name:'드로잉', color:'#9a6cb8', bg:'#f5f0f8' },
  { id:'ukulele',  name:'우쿨렐레', color:'#d4789a', bg:'#fbf1f5' },
  { id:'nodrink',  name:'금주',   color:'#6ab0a0', bg:'#f0f7f5' }
];

function getChk()    { return (L(K.checks)||{})[today()]||{}; }
function saveChk(id,v) { const d=L(K.checks)||{}; if(!d[today()])d[today()]={};d[today()][id]=v; S(K.checks,d); }
function getAllChk() { return L(K.checks)||{}; }

function renderChk() {
  const chk=getChk(), all=getAllChk(), week=getWeekDates(), td=today();
  const container=document.getElementById('chkTable');
  const mob = window.innerWidth <= 768;
  const W = mob ? Math.max(200, window.innerWidth - 68) : 240;
  const H = mob ? 48 : 52;

  function circleRectArea(cx, cy, r) {
    const steps=200, dy=H/steps; let area=0;
    for(let i=0; i<steps; i++) {
      const y=(i+0.5)*dy, d2=r*r-(y-cy)*(y-cy);
      if(d2<=0) continue;
      const hw=Math.sqrt(d2), x0=Math.max(0,cx-hw), x1=Math.min(W,cx+hw);
      if(x1>x0) area+=(x1-x0)*dy;
    }
    return area;
  }
  function findRadius(cx, cy, targetArea) {
    let lo=0, hi=W*3;
    for(let i=0; i<60; i++) { const mid=(lo+hi)/2; if(circleRectArea(cx,cy,mid)<targetArea) lo=mid; else hi=mid; }
    return (lo+hi)/2;
  }
  const CENTER_MAP = {1:{cx:-15,cy:-8},2:{cx:0,cy:H},3:{cx:0,cy:H/2},4:{cx:W*0.15,cy:0},5:{cx:-10,cy:0},6:{cx:0,cy:H*0.3}};

  let h = '';
  const dayN = ['일','월','화','수','목','금','토'];
  h += '<div class="chk-week-hdr"><div class="chk-week-hdr-spacer"></div><div class="day-labels">'
    + dayN.map(d => '<span class="day-lbl">'+d+'</span>').join('')
    + '</div></div>';

  ROUTINE_META.forEach(r => {
    const weekDone = week.map(dt => all[dt] && all[dt][r.id] ? 1 : 0);
    const doneCount = weekDone.filter(d => d).length;
    const pct = Math.round((doneCount/7)*100);
    const target = (doneCount===1) ? (1.7/7)*W*H : (doneCount/7)*W*H;
    let blobHtml = '';
    if(doneCount===7) {
      blobHtml = '<div class="chk-blob" style="background:'+r.color+';width:9999px;height:9999px;left:-4999px;top:'+(H/2-4999)+'px;"></div>';
    } else if(doneCount>0) {
      const {cx,cy} = CENTER_MAP[doneCount];
      const rr = findRadius(cx,cy,target);
      blobHtml = '<div class="chk-blob" style="background:'+r.color+';width:'+(rr*2)+'px;height:'+(rr*2)+'px;left:'+(cx-rr)+'px;top:'+(cy-rr)+'px;"></div>';
    }
    const dotHtml = weekDone.map((done,i) => {
      const dt=week[i], isTd=dt===td;
      return '<div class="chk-dot '+(done?'done':'')+' '+(isTd?'today':'')+'" onclick="event.stopPropagation();toggleDay(\''+r.id+'\',\''+dt+'\')"></div>';
    }).join('');
    h += '<div class="chk-row" onclick="toggleChk(\''+r.id+'\')">'+blobHtml
      +(doneCount>0?'<span class="chk-pct">'+pct+'%</span>':'')
      +'<div class="chk-left"><span class="chk-lb">'+r.name+'</span></div>'
      +'<div class="chk-dots">'+dotHtml+'</div>'
      +'</div>';
  });
  container.innerHTML = h;
}

let _chkT = null;
function toggleChk(id) { toggleDay(id, today()); }
function toggleDay(id, dateStr) {
  const d = L(K.checks)||{};
  if(!d[dateStr]) d[dateStr]={};
  d[dateStr][id] = !d[dateStr][id];
  S(K.checks, d);
  renderChk();
  clearTimeout(_chkT);
  _chkT = setTimeout(() => { SYNC.saveChecksToSheet(dateStr, d[dateStr]); SYNC.scheduleDatabaseSave(); }, 1200);
}