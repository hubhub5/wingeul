// 모의 모드 응답 (WG_MOCK=1). API 키 없이 전 기능을 끝까지 점검하기 위한 고정 데이터.
// 스키마와 같은 모양을 돌려주므로 실제 호출과 같은 경로(정규화·검수·서식·이미지)를 그대로 탄다.

function kw(user: string): string {
  return user.match(/키워드[:\s"“]+([^\n"”]+)/)?.[1]?.trim() ?? '대구임플란트'
}

export function mockResponse(step: string, user: string): unknown {
  const k = kw(user)
  switch (step) {
    case '고객 심리':
      return {
        searchIntent: `${k}를 알아보는 사람은 가격 차이의 이유와 통증·뼈이식 여부를 먼저 확인하고 싶어 한다.`,
        appeals: [
          { point: '3D CT 정밀 진단', posts: [1, 2, 4] },
          { point: '전문의 직접 수술', posts: [1, 3] },
          { point: '수면 마취', posts: [2] },
        ],
        hesitations: [
          { issue: '가격 차이', detail: '같은 임플란트인데 왜 치과마다 가격이 다른지 모른다', coveredBy: [2, 4], evidence: '80만원인 곳도 있고 150만원인 곳도 있던데', bias: '기준점 효과(가격)', intensity: 5, copyAngle: '가격표 대신 구성표로 비교하는 법을 알려 준다' },
          { issue: '뼈이식 필요 여부', detail: '뼈이식을 해야 한다는 말에 비용·기간이 늘까 걱정', coveredBy: [10], evidence: '뼈이식 꼭 해야 하나요?', bias: '모호성 회피', intensity: 4, copyAngle: 'CT에서 무엇을 보고 판단하는지 기준을 보여 준다' },
          { issue: '수술 통증', detail: '수술이 아플까 두려움', coveredBy: [], evidence: '임플란트 많이 아픈가요? (지식iN)', bias: '손실 회피', intensity: 4, copyAngle: '마취 4단계를 순서대로 보여 줘 통제감을 준다' },
          { issue: '사후 관리', detail: '나중에 흔들리거나 문제가 생기면 어떻게 하나', coveredBy: [], evidence: '임플란트 흔들림 (지식iN)', bias: '후회 회피', intensity: 3, copyAngle: '정기검진·보증 기준을 구체적으로 안내한다' },
        ],
        gaps: ['수술 당일 통증을 줄이는 단계별 마취 과정 설명', '보증 기간과 정기검진 등 사후 관리 기준'],
        persona: { label: '견적 세 곳을 받아 들고 결정을 미루는 50대 가장', age: '50대 초반', situation: '어금니 하나를 뺀 지 1년, 씹기 불편해 상담을 다니는 중', coreNeed: '합리적인 가격에 오래 쓰고 싶다', hiddenNeed: '비싸게 하고도 실패하면 가족에게 면목이 없을까 걱정', trigger: '다른 쪽 치아까지 아파오기 시작함', objection: '좀 더 알아보고 해도 늦지 않겠지' },
        emotions: [ { emotion: '불안', score: 4, cue: '많이 아픈가요' }, { emotion: '의심', score: 4, cue: '왜 이렇게 차이 나요' }, { emotion: '피로감', score: 3, cue: '여러 군데 상담' }, { emotion: '기대', score: 2, cue: '편하게 씹고 싶어요' } ],
        barriers: ['가격 기준점이 제각각이라 판단 불가', '수술 통증에 대한 막연한 공포', '실패·재수술 가능성'],
        drivers: ['남은 치아까지 상할 수 있다는 인식', '과정이 투명하게 설명될 때', '전문의 직접 진료'],
        objections: [ { objection: '싼 데서 해도 똑같지 않나', reply: '구성과 과정이 같은지 먼저 비교해 보시라고 안내' }, { objection: '나중에 해도 되겠지', reply: '방치 시 잇몸뼈 변화가 생길 수 있음을 정보로만 전달' }, { objection: '아플까 봐 무섭다', reply: '단계별 마취 과정을 순서대로 보여 줌' } ],
        commonStructure: '원장 인사로 시작해 환자 질문을 던지고, 번호 소제목마다 이미지와 짧은 줄 설명을 반복한 뒤 비교표·체크리스트로 마무리한다.',
      }
    case '업체 정보':
      return {
        summary: '대구 북구에서 365일 진료하는 치과. 통합치의학과 전문의가 직접 상담·수술한다.',
        facts: [
          { key: '대표원장', value: '통합치의학과 전문의 김OO', source: '홈페이지', verified: true },
          { key: '진료', value: '365일 진료', source: '홈페이지', verified: true },
          { key: '장비', value: '3D CT, 디지털 가이드', source: '기존 글', verified: true },
        ],
        strengths: ['365일 진료', '3D CT 기반 수술 계획', '4단계 마취', '원내 기공실'],
        tone: '차분하고 다정한 설명형. 환자 입장에서 먼저 공감한다.',
        bannedPhrases: ['최고', '저렴한'],
        greeting: '치과가 무서운 마음을 누구보다 잘 알기에 ==예시치과 대표원장==입니다.',
        closing: '환자분의 현명한 선택과 건강한 미소를 응원합니다.',
        headingStyle: '번호 + 질문형 소제목을 표 박스로',
        styleRules: ['한 줄 15~25자로 짧게 끊는다', '2~3줄마다 빈 줄', '가운데 정렬', '환자 질문은 굵게 따옴표로', '핵심 문장은 파스텔 형광펜'],
      }
    case '컨셉':
      return {
        angles: [
          { name: '가격표 뒤에 숨은 구성 차이', persona: '여러 치과 견적을 받아 들고 고민하는 50대', hook: '같은 임플란트인데 왜 가격이 두 배까지 차이 날까요?', hesitationsSolved: ['가격 차이', '사후 관리'], strengthsUsed: ['3D CT 기반 수술 계획', '원내 기공실'], whyWin: '상위글은 가격 비교만 하고 보증·관리 기준은 다루지 않는다', outline: ['가격이 다른 이유', '비싸면 오래가나', '가격보다 볼 것', '마취와 통증', '사후 관리'] },
          { name: '수술이 무서운 분을 위한 4단계 마취', persona: '치과 공포증이 있는 60대', hook: '마취 주사가 무서워 미루고 계셨나요?', hesitationsSolved: ['수술 통증'], strengthsUsed: ['4단계 마취'], whyWin: '통증을 단계별로 설명한 글이 상위에 없다', outline: ['왜 무서울까', '4단계 마취', '수면 진료', '수술 후 관리'] },
          { name: '뼈가 부족하다는 말을 들었다면', persona: '다른 치과에서 뼈이식 진단을 받은 분', hook: '뼈이식이 꼭 필요한지 먼저 확인해 보세요', hesitationsSolved: ['뼈이식 필요 여부'], strengthsUsed: ['3D CT 기반 수술 계획'], whyWin: 'CT 판단 기준을 구체적으로 보여 준다', outline: ['뼈가 부족한 이유', 'CT로 보는 것', '이식이 필요한 경우', '기간과 관리'] },
        ],
      }
    case '제목':
      return {
        titles: [
          { text: `${k} 가격 비교 전에 꼭 확인할 3가지`, rationale: '숫자 + 선행 행동' },
          { text: `${k}, 80만원과 150만원은 무엇이 다를까요?`, rationale: '구체적 비교 질문' },
          { text: `${k} 견적이 치과마다 다른 진짜 이유`, rationale: '호기심 간극' },
          { text: `${k} 상담 전에 보세요, 가격표 읽는 법`, rationale: '실용 가이드' },
          { text: `${k} 비싸면 더 오래갈까요?`, rationale: '통념 질문' },
        ],
      }
    case '원고':
      return { blocks: mockArticle(k) }
    case '부분 수정': {
      const json = user.slice(user.indexOf('블록:') + 3).trim()
      try {
        const blocks = JSON.parse(json) as { type: string; text: string }[]
        return { blocks: blocks.map((b) => ({ ...b, text: b.text ? b.text.replace(/습니다\./g, '어요.') : b.text })) }
      } catch {
        return { blocks: [] }
      }
    }
  }
  return {}
}

const F = { text: '', num: 0, items: [], rows: [], kind: '', caption: '', shotGuide: '', visual: '', label: '', url: '', q: '', a: '' }

function mockArticle(k: string) {
  return [
    { ...F, type: 'paragraph', text: '치과가 무서운 마음을\n누구보다 잘 알기에\n\n환자분의 입장에서 먼저 생각하는\n==예시치과 대표원장==입니다.' },
    { ...F, type: 'image', kind: 'thumbnail', caption: '대표 이미지', visual: `${k}\n가격 비교 전에\n보세요` },
    { ...F, type: 'quote', text: '“원장님, 임플란트가 80만원인 곳도 있고\n150만원인 곳도 있던데 왜 다른가요?”' },
    { ...F, type: 'paragraph', text: `적지 않은 비용이 드는 치료라\n여러 곳을 비교하시는 마음,\n충분히 이해합니다.\n\n결론부터 말씀드리면\n${k} 가격은 ==구성과 과정==에 따라 달라집니다.` },
    { ...F, type: 'contact' },
    { ...F, type: 'section', num: 1, text: '같은 임플란트인데 왜 가격이 다를까요?' },
    { ...F, type: 'image', kind: 'ai', caption: '임플란트 구성', shotGuide: '임플란트 크라운·지대주·픽스처 분해도 3D 렌더', visual: '비용 차이는 부품 구성에 있습니다 | 크라운: 지르코니아 등 재료 | 지대주: 맞춤형 여부 | 픽스처: 국산·수입 표면처리 | 상담 때 포함 여부를 꼭 확인하세요' },
    { ...F, type: 'paragraph', text: '임플란트는 잇몸뼈에 심는\n인공 뿌리와 연결 기둥,\n치아 모양의 크라운으로 구성됩니다.\n\n어떤 재료를 쓰는지,\n뼈이식이 포함되는지에 따라\n**최종 비용이 달라질 수 있어요.**' },
    { ...F, type: 'section', num: 2, text: '수술이 많이 아플까요?' },
    { ...F, type: 'image', kind: 'ai', caption: '단계별 마취', shotGuide: '부드러운 치과 진료실과 마취 단계 아이콘', visual: '통증을 줄이는 4단계 마취 | 가글 마취: 입안 감각 둔화 | 도포 마취: 주사 부위 준비 | 컴퓨터 마취기: 일정한 속도 | 본 마취: 수술 진행' },
    { ...F, type: 'paragraph', text: '가글 마취부터 본 마취까지\n단계별로 진행하면\n마취 과정의 자극을 줄일 수 있습니다.\n\n수술 후 붓기나 통증은\n개인차가 있을 수 있어요.' },
    { ...F, type: 'section', num: 3, text: '가격보다 먼저 확인할 것은 무엇일까요?' },
    { ...F, type: 'table', rows: [['비교 항목', '확인할 내용'], ['기본 비용', '픽스처·지대주·크라운 포함 여부'], ['추가 비용', '뼈이식·수면진정'], ['수술 과정', 'CT 진단·디지털 가이드'], ['사후 관리', '정기검진·보증 조건']] },
    { ...F, type: 'list', items: ['최종 보철물까지 포함된 가격인가요?', '뼈이식 등 추가 비용을 확인했나요?', '마취 방법과 수술 계획을 들었나요?', '보증 조건을 확인했나요?'] },
    { ...F, type: 'paragraph', text: `${k} 가격을 비교하실 때는\n숫자만 보지 마시고\n과정과 관리까지 함께 살펴보세요.\n\n치료 결과와 회복 기간은\n개인에 따라 다를 수 있습니다.` },
    { ...F, type: 'image', kind: 'card', caption: '마무리', visual: '환자분의 현명한 선택과\n건강한 미소를 응원합니다.' },
    { ...F, type: 'contact' },
  ]
}
