// 프롬프트와 출력 스키마. 캐싱을 위해 "고정 블록"은 입력이 같으면 바이트가 같도록 결정적으로 만든다.

import type { Angle, BrandBrain, Client, HesitationMap, SerpSnapshot } from '@shared/types'
import { PACKS } from '@shared/compliance/packs'

// ───────── 스키마 헬퍼 ─────────
const str = { type: 'string' }
const strArr = { type: 'array', items: str }
const intArr = { type: 'array', items: { type: 'integer' } }
function obj(props: Record<string, unknown>) {
  return { type: 'object', properties: props, required: Object.keys(props), additionalProperties: false }
}
const arr = (items: unknown) => ({ type: 'array', items })

// ───────── 1. 불안 지도 (Haiku) ─────────

export const ANALYST_SYSTEM = `너는 네이버 블로그 상위노출 경쟁 분석과 소비자 심리 분석을 함께 하는 마케팅 리서처다.
주어진 키워드의 상위 블로그 글들과 지식iN 질문(실제 고객의 말)을 읽고 한국어로 다음을 추출한다. 주어진 텍스트에 근거하고 추측으로 사실을 만들지 않는다.
- searchIntent: 이 키워드로 검색하는 사람이 진짜 알고 싶은 것 (1~2문장)
- appeals: 상위글들이 강조하는 소구점과 그 소구점을 쓴 글의 rank 목록
- hesitations: 결정을 망설이게 하는 고민 6~10개. 통증, 비용, 기간, 실패, 과잉진료, 신뢰 등
  · coveredBy: 그 고민을 실제로 해소해 준 글의 rank만 (언급만 한 글은 제외)
  · evidence: 근거 문장이나 질문을 짧게 인용 (지식iN에서 나온 고민을 빠뜨리지 말 것)
  · bias: 그 고민 밑에 있는 심리 기제 하나 — 손실 회피, 모호성 회피, 현재 편향(미루기), 사회적 증거 탐색, 권위 의존, 통제감 욕구, 기준점 효과(가격), 후회 회피, 인지 부조화, 낙인 걱정 중에서
  · intensity: 고민의 강도 1~5 (검색어·질문에서 얼마나 자주, 절박하게 나오는가)
  · copyAngle: 이 고민을 풀어 주는 원고 방향 한 문장 (규제 위반 표현 없이)
- gaps: 상위글 누구도 제대로 해소하지 않은 지점 3~5개 (우리 글의 공략 포인트)
- commonStructure: 상위글들의 공통 형식 2~3문장
- persona: 가장 대표적인 검색자 한 명 — label(한 줄), age, situation, coreNeed(겉으로 말하는 니즈), hiddenNeed(말하지 않는 진짜 이유), trigger(검색 계기), objection(끝까지 남는 반론)
- emotions: 검색자의 감정 4~6개와 강도 score 1~5, cue(그렇게 본 근거 표현)
- barriers: 결정을 막는 장벽 3~5개 / drivers: 결정을 밀어 주는 요인 3~5개
- objections: 검색자가 속으로 하는 반론 4~6개와 원고에서 쓸 답변(reply, 규제 준수)`

export const HESITATION_SCHEMA = obj({
  searchIntent: str,
  appeals: arr(obj({ point: str, posts: intArr })),
  hesitations: arr(obj({ issue: str, detail: str, coveredBy: intArr, evidence: str, bias: str, intensity: { type: 'integer' }, copyAngle: str })),
  gaps: strArr,
  commonStructure: str,
  persona: obj({ label: str, age: str, situation: str, coreNeed: str, hiddenNeed: str, trigger: str, objection: str }),
  emotions: arr(obj({ emotion: str, score: { type: 'integer' }, cue: str })),
  barriers: strArr,
  drivers: strArr,
  objections: arr(obj({ objection: str, reply: str })),
})

export function hesitationUser(serp: SerpSnapshot, posts: { rank: number; title: string; body: string }[]): string {
  return [
    `키워드: ${serp.keyword}`,
    `자동완성: ${serp.autocomplete.join(', ') || '없음'}`,
    `연관검색어: ${serp.related.join(', ') || '없음'}`,
    `통합검색 블록 순서: ${serp.sections.map((s) => s.title).join(' > ') || '정보 없음'}`,
    `지식iN 질문:\n${serp.kinQuestions.map((q) => `- ${q}`).join('\n') || '없음'}`,
    '',
    ...posts.map((p) => `### [rank ${p.rank}] ${p.title}\n${p.body}`),
  ].join('\n')
}

// ───────── 2. 브랜드 두뇌 (Sonnet, 클라이언트당 1회) ─────────

export const BRAIN_SYSTEM = `너는 마케팅 대행사의 브랜드 전략가다. 클라이언트의 홈페이지·설문지·기존 블로그 글을 읽고
블로그 글쓰기에 재사용할 "브랜드 두뇌"를 만든다.
- facts: 검증 가능한 사실만 (의료진, 경력, 장비, 위치, 진료시간, 수치 등). source는 '홈페이지'/'설문지'/'기존 글' 중 하나. 자료에 명시된 것만 verified=true.
- strengths: 글에서 소구할 수 있는 이 클라이언트만의 강점. 근거가 있는 것만. 5~10개
- tone: 말투·태도 요약 1~2문장
- bannedPhrases: 자료에서 드러나는 피해야 할 표현 (없으면 빈 배열)
- greeting / closing: 기존 글의 인사말·마무리 시그니처를 그대로 (없으면 빈 문자열)
- headingStyle: 소제목 스타일 설명
- styleRules: 기존 글 형식을 재현하기 위한 구체적 규칙 6~12개 (문장 길이, 줄바꿈, 이모지, 강조 방식, 문단 구성, 질문 활용 등)
- summary: 브랜드 한 문단 요약
자료에 없는 사실을 지어내지 마라.`

export const BRAIN_SCHEMA = obj({
  summary: str,
  facts: arr(obj({ key: str, value: str, source: str, verified: { type: 'boolean' } })),
  strengths: strArr,
  tone: str,
  bannedPhrases: strArr,
  greeting: str,
  closing: str,
  headingStyle: str,
  styleRules: strArr,
})

// ───────── 3. 작성 단계 공통 고정 블록 (Sonnet, 캐시 공유) ─────────

export const WRITER_SYSTEM = `너는 네이버 블로그 상위노출 전문 카피라이터다. 목표는 같은 키워드의 상위글보다
더 클릭되고, 더 오래 읽히고, 독자의 망설임을 실제로 해소하는 글을 쓰는 것이다.

원칙
1. 검색자의 고민을 정면으로 다룬다. 공략 포인트(경쟁글이 다루지 않은 지점)를 반드시 해소하고, 고민별 심리 기제에 맞는 카피 방향과 반론 처리를 원고에 녹인다.
2. 브랜드 강점은 독자의 불안을 해소하는 "근거"로만 등장시킨다. 자랑하지 말고 연결한다.
3. 브랜드 팩트시트에 없는 수치·경력·실적을 절대 지어내지 않는다.
4. 업종 규제를 지킨다(아래 금지 사항). 최상급, 비교, 효과 보장, 할인·이벤트, 치료경험담 금지.
5. 클라이언트의 기존 글 형식(문체 규칙, 인사말·마무리, 소제목 스타일)을 그대로 따른다.
6. AI 티를 내지 않는다: "결론적으로/살펴보겠습니다/다양한/중요한 역할" 같은 상투어 금지, 같은 종결어미 연속 금지,
   짧은 문장과 긴 문장을 섞고, 독자에게 말을 거는 문장을 섞는다.

본문 블록 형식
- section: 번호 질문형 소제목 박스 (num=1,2,3…, text="같은 임플란트인데 왜 치과마다 가격이 다를까요?")
- heading: 일반 소제목 (section을 쓰지 않는 형식일 때)
- paragraph: 문단. text 안에서 한 줄 15~25자로 \\n 줄바꿈하고, 의미 단위 2~3줄마다 빈 줄(\\n\\n)을 넣는다 (모바일 가운데 정렬 형식)
- quote: 환자 질문·핵심 문장 (예: “원장님, 임플란트가 80만원인 곳도 있던데 왜 다른가요?”)
- list: 체크리스트 (항목만, 기호 없이) / table: 비교표 rows (첫 행 머리글, 2~3열, 4~6행)
- image: 이미지 자리. kind로 종류를 정한다
  · thumbnail: 첫 대표 이미지 — visual에 썸네일 큰 제목 2~4줄 (\\n 구분)
  · ai: 개념 설명 인포그래픽·3D 일러스트 — visual에 이미지 안에 들어갈 한국어 문구를 "제목 | 항목1: 설명 | 항목2: 설명 | 하단 문구" 형식으로, shotGuide에 그림 내용(예: 임플란트 픽스처·지대주·크라운 분해도)
  · card: 글자만 있는 카드(마무리 메시지 등) — visual에 문구
  · photo: 실제 촬영이 필요한 사진(진료실·장비·원장) — shotGuide에 촬영 지시
- contact: 전화문의 박스 자리 (내용은 앱이 채움) / link: 링크 카드 자리 (label, url — 브랜드 링크 목록에 있는 것만)
- divider: 구분선 / cta: 마무리 행동 유도(규제 준수) / faq: 자주 묻는 질문(q, a)
- 문단 안 인라인 강조: **굵게**, ==형광펜==, ^^강조색^^ — 핵심 문장에만. 원장 인사에서 "치과명 직함 원장"은 ==형광펜==.`

export function brandBlock(c: Client): string {
  const b: BrandBrain | null = c.brain
  const pack = PACKS[c.industry]
  const lines = [
    `# 클라이언트: ${c.name} (${pack.name}${c.region ? `, ${c.region}` : ''})`,
    `## 업종 금지 사항`,
    ...pack.rules.map((r) => `- ${r.label}: ${r.message}`),
    ...(pack.requires ?? []).map((r) => `- 필수: ${r.message}`),
  ]
  if (!b) return lines.concat('## 브랜드 두뇌: 아직 학습되지 않음 — 브랜드 고유 사실을 언급하지 말 것').join('\n')
  const d = b.styleDna
  lines.push(
    `## 브랜드 요약\n${b.summary}`,
    `## 팩트시트 (이 목록에 있는 사실만 사용)`,
    ...b.facts.map((f) => `- ${f.key}: ${f.value}${f.verified ? '' : ' (미확인: 단정하지 말 것)'}`),
    `## 강점`,
    ...b.strengths.map((s) => `- ${s}`),
    `## 톤\n${b.tone}`,
    b.bannedPhrases.length ? `## 이 클라이언트 금지 표현\n${b.bannedPhrases.join(', ')}` : '',
  )
  if (d) {
    const endings = Object.entries(d.endingRatios).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(', ')
    lines.push(
      `## 문체 DNA`,
      `- 평균 문장 길이 ${d.avgSentenceLen}자, 문단당 ${d.avgParagraphSentences}문장, 이모지 1000자당 ${d.emojiPer1000}개`,
      `- 종결어미 비율: ${endings}`,
      d.greeting ? `- 인사말: ${d.greeting}` : '',
      d.closing ? `- 마무리: ${d.closing}` : '',
      `- 소제목 스타일: ${d.headingStyle}`,
      ...d.rules.map((r) => `- ${r}`),
    )
  }
  if (d?.structure) lines.push(`## 형식 골격 (예시 글에서 학습 — 이 순서를 따를 것)\n${d.structure}`)
  const links = c.contact?.links ?? []
  lines.push(`## 연락처·링크: 전화 ${c.contact?.phone ? '있음 → contact 블록 사용' : '없음 → contact 블록 쓰지 말 것'}${links.length ? `, 링크: ${links.map((l) => `${l.label} ${l.url}`).join(' / ')}` : ''}`)
  if (b.sampleExcerpt) lines.push(`## 형식 예시 (기존 글 발췌 — 형식과 리듬만 참고, 내용 복사 금지)\n${b.sampleExcerpt}`)
  return lines.filter(Boolean).join('\n')
}

export function battleBlock(serp: SerpSnapshot, h: HesitationMap, competitorTitles: string[], bench: Record<string, number>): string {
  return [
    `# 키워드 전장: ${serp.keyword}`,
    `검색 의도: ${h.searchIntent}`,
    `자동완성: ${serp.autocomplete.slice(0, 10).join(', ')}`,
    `연관검색어: ${serp.related.slice(0, 10).join(', ')}`,
    `통합검색 블록: ${serp.sections.map((s) => s.title).join(' > ')}`,
    `## 상위글 제목`,
    ...competitorTitles.map((t, i) => `${i + 1}. ${t}`),
    `## 상위글 평균: 글자수 ${bench.chars}, 이미지 ${bench.images}장, 소제목 ${bench.headings}개, 키워드 ${bench.keywordCount}회`,
    `## 상위글 공통 형식\n${h.commonStructure}`,
    `## 경쟁 소구점`,
    ...h.appeals.map((a) => `- ${a.point} (${a.posts.length}개 글)`),
    `## 고객 고민 (해소한 경쟁글 수/전체)`,
    ...h.hesitations.map((x) => `- ${x.issue} [${x.coveredBy.length}/${competitorTitles.length}]: ${x.detail}`),
    `## 공략 포인트 (아무도 해소하지 않음)`,
    ...h.gaps.map((g) => `- ${g}`),
    h.persona ? `## 대표 검색자\n${h.persona.label} / ${h.persona.age} / 상황: ${h.persona.situation} / 겉 니즈: ${h.persona.coreNeed} / 숨은 니즈: ${h.persona.hiddenNeed} / 반론: ${h.persona.objection}` : '',
    h.emotions?.length ? `## 감정 온도: ${h.emotions.map((e) => `${e.emotion} ${e.score}`).join(', ')}` : '',
    h.hesitations.some((x) => x.bias) ? `## 고민별 심리 기제·카피 방향\n${h.hesitations.map((x) => `- ${x.issue}: ${x.bias ?? ''} → ${x.copyAngle ?? ''}`).join('\n')}` : '',
    h.barriers?.length ? `## 결정 장벽: ${h.barriers.join(' / ')}\n## 결정 촉진: ${(h.drivers ?? []).join(' / ')}` : '',
    h.objections?.length ? `## 반론 처리\n${h.objections.map((o) => `- "${o.objection}" → ${o.reply}`).join('\n')}` : '',
  ].filter(Boolean).join('\n')
}

// ───────── 3-1. 앵글 ─────────

export const ANGLES_SCHEMA = obj({
  angles: arr(obj({ name: str, persona: str, hook: str, hesitationsSolved: strArr, strengthsUsed: strArr, whyWin: str, outline: strArr })),
})

export const anglesUser = (extra: string) =>
  `서로 확실히 다른 원고 컨셉 3개를 제안하라. 각 앵글마다:
- persona: 이 앵글이 말을 거는 구체적 타겟 (주제에서 자동 도출, 예: "다른 치과에서 뼈이식 해야 한다는 말을 듣고 겁먹은 50대")
- hook: 첫 3줄에서 독자를 붙잡을 한 문장
- hesitationsSolved: 해소할 고민 (공략 포인트 우선)
- strengthsUsed: 연결할 브랜드 강점 (팩트시트·강점 목록에서만)
- whyWin: 상위글 대비 차별점
- outline: 소제목 흐름 5~7개
${extra ? `\n추가 요청: ${extra}` : ''}`

// ───────── 3-2. 제목 ─────────

export const TITLES_SCHEMA = obj({ titles: arr(obj({ text: str, rationale: str })) })

export const titlesUser = (a: Angle, keyword: string) =>
  `선택된 컨셉: ${a.name}\n타겟: ${a.persona}\n후킹: ${a.hook}\n
이 컨셉으로 제목 후보 10개를 만들어라.
- 키워드 "${keyword}"를 제목 앞쪽에 자연스럽게 (띄어쓰기 변형 허용 안 함)
- 18~32자 권장, 모바일에서 잘리지 않게
- 상위글 제목들과 확실히 달라야 한다 (같은 패턴 "잘하는 곳 추천" 반복 금지)
- 호기심 간극, 구체적 숫자(팩트시트 근거가 있을 때만), 타겟 호명, 질문형 등 서로 다른 기법을 섞어라
- 업종 규제 위반 표현 금지
rationale에는 사용한 후킹 기법을 짧게.`

// ───────── 3-3. 본문 ─────────

export const BLOCK_SCHEMA = obj({
  type: { type: 'string', enum: ['heading', 'section', 'paragraph', 'quote', 'list', 'table', 'image', 'divider', 'cta', 'contact', 'link', 'faq'] },
  text: str,
  num: { type: 'integer' },
  items: strArr,
  rows: arr(strArr),
  kind: { type: 'string', enum: ['thumbnail', 'ai', 'card', 'photo', ''] },
  caption: str,
  shotGuide: str,
  visual: str,
  label: str,
  url: str,
  q: str,
  a: str,
})

export const ARTICLE_SCHEMA = obj({ blocks: arr(BLOCK_SCHEMA) })

export const articleUser = (a: Angle, title: string, keyword: string, targetChars: number, images: number) =>
  `제목: ${title}
컨셉: ${a.name} / 타겟: ${a.persona}
후킹: ${a.hook}
해소할 고민: ${a.hesitationsSolved.join(', ')}
연결할 강점: ${a.strengthsUsed.join(', ')}
소제목 흐름: ${a.outline.join(' → ')}

위 설계로 본문을 블록 배열로 작성하라.
- 본문 글자수(공백 포함, 사진·구분선 제외) ${targetChars}자 ±5%
- 키워드 "${keyword}"는 첫 문단에 1회 포함, 전체 4~7회 자연스럽게
- image 블록 ${images}개 내외: 첫 이미지는 thumbnail, 설명 이미지는 ai 위주, 실제 사진이 꼭 필요한 곳만 photo
- 형식 골격이 있으면 그 순서(원장 인사 → 대표 이미지 → 환자 질문 → 결론 먼저 → 번호 소제목 반복 → 비교표·체크리스트 → 연락처·링크)를 따를 것
- 공략 포인트를 해소하는 섹션과 faq 2~3개를 반드시 포함 (반론 처리표의 답변을 활용)
- 기존 글 형식(인사말·마무리·문체 규칙)을 따를 것
- 시술·상품을 다루면 마지막에 부작용·개인차 등 고지 문장 포함
- 사용하지 않는 필드는 빈 문자열/빈 배열/0으로`

// ───────── 3-4. 부분 수정 ─────────

export const REWRITE_SCHEMA = obj({ blocks: arr(BLOCK_SCHEMA) })

export const rewriteUser = (instruction: string, blocksJson: string) =>
  `아래 블록들을 지시에 맞게 고쳐서 같은 형식의 블록 배열로 돌려줘. 지시와 관련 없는 내용은 바꾸지 마.
지시: ${instruction}
블록:
${blocksJson}`
