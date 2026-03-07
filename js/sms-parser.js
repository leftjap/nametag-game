// ═══════════════════════════════════════
// sms-parser.js — 카드 문자 파싱
// ═══════════════════════════════════════

function parseSMS(text) {
  if (!text || typeof text !== 'string') return null;

  const result = {
    amount: 0,
    merchant: '',
    card: '',
    date: '',
    time: '',
    category: 'etc',
    isExpense: true
  };

  // 금액 추출
  const amountMatch = text.match(/([\d,]+)\s*원/);
  if (!amountMatch) return null;
  result.amount = parseInt(amountMatch[1].replace(/,/g, ''));
  if (result.amount <= 0) return null;

  // 카드사 매칭
  const cardPatterns = [
    '신한카드', '삼성카드', '국민카드', 'KB국민', 'KB카드',
    '현대카드', '롯데카드', '하나카드', 'NH카드', 'NH농협',
    '우리카드', 'BC카드', '씨티카드', '카카오페이', '네이버페이',
    '토스페이', '토스', '카카오뱅크', '케이뱅크'
  ];
  for (const cp of cardPatterns) {
    if (text.includes(cp)) { result.card = cp; break; }
  }

  // 날짜 추출
  const dateMatch = text.match(/(\d{1,2})[\/\.\-](\d{1,2})/);
  if (dateMatch) {
    const m = dateMatch[1].padStart(2, '0');
    const d = dateMatch[2].padStart(2, '0');
    result.date = `${new Date().getFullYear()}-${m}-${d}`;
  } else {
    result.date = today();
  }

  // 시간 추출
  const timeMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    result.time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
  }

  // 가맹점 추출: 불필요한 부분 제거 후 남은 텍스트
  let mt = text;
  mt = mt.replace(/\[Web발신\]/g, '').replace(/\[웹발신\]/g, '');
  mt = mt.replace(/([\d,]+)\s*원/g, '');
  if (result.card) mt = mt.replace(new RegExp(result.card.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
  mt = mt.replace(/\d{1,2}[\/\.\-]\d{1,2}/g, '');
  mt = mt.replace(/\d{1,2}:\d{2}(:\d{2})?/g, '');
  mt = mt.replace(/(승인|일시불|취소|해외|결제|체크|신용|할부|\d+회차|누적|잔액|&[^)]*\)|스카이패스|MILEAGE|PLATINUM|\([^)]*\))/gi, '');
  mt = mt.replace(/[|\-\/·,]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = mt.split(' ').filter(t => t.length >= 2);
  result.merchant = tokens.join(' ').slice(0, 30);

  // 카테고리 자동 매칭
  result.category = autoMatchCategory(result.merchant);

  return result;
}

function autoMatchCategory(merchant) {
  if (!merchant) return 'etc';
  const m = merchant.toLowerCase();

  const rules = {
    food: ['김밥','찌개','식당','밥','치킨','피자','맥도날드','버거킹','롯데리아',
           '배달','요기요','배민','쿠팡이츠','떡볶이','분식','한식','중식','일식',
           '냉면','국수','삼겹살','고기','초밥','돈까스','스타벅스','투썸','이디야',
           '커피','카페','빽다방','메가커피','컴포즈','할리스','폴바셋','블루보틀',
           '바나프레소','파리바게뜨','뚜레쥬르','베이커리','편의점','GS25','CU',
           '세븐일레븐','미니스톱','이마트24'],
    living: ['이마트','홈플러스','롯데마트','쿠팡','네이버쇼핑','무신사',
             '올리브영','다이소','이케아','마트','의류','신발','화장품'],
    transport: ['택시','카카오T','우버','타다','주유소','GS칼텍스','SK에너지',
                'S-OIL','주차','고속도로','톨게이트','코레일','KTX','SRT',
                '버스','지하철','교통'],
    utility: ['관리비','전기','가스','수도','통신','SKT','KT','LG','인터넷',
              '아파트','수도요금','전기세','도시가스','KT텔레캅'],
    loan: ['대출','이자','원금','상환','여신'],
    medical: ['약국','병원','의원','치과','안과','피부과','한의원','클리닉',
              '건강검진','정형외과','내과','이비인후과'],
    pet: ['동물병원','펫','사료','반려','애견','애묘','동물의료','펫샵','동물약국'],
    culture: ['CGV','메가박스','롯데시네마','넷플릭스','유튜브','멜론','스포티파이',
              '애플뮤직','서점','교보','영풍','알라딘','예스24','구글플레이',
              '항공','호텔','여행','에어비앤비','아고다','항공권']
  };

  for (const [category, keywords] of Object.entries(rules)) {
    for (const kw of keywords) {
      if (m.includes(kw.toLowerCase())) return category;
    }
  }
  return 'etc';
}
