// 앱 전체에서 공유하는 데이터 모델. main / renderer / tests 모두 이 파일을 참조한다.

export type Industry = 'medical' | 'legal' | 'finance' | 'general'

export interface Fact {
  key: string // 예: "대표원장", "장비"
  value: string // 예: "보철과 전문의 김OO"
  source: string // "홈페이지", "설문지", "직접 입력"
  verified: boolean // 사람이 확인했는가
}

export interface StyleStats {
  avgSentenceLen: number
  endingRatios: Record<string, number> // "~요", "~다", "~죠" 등 종결 비율
  emojiPer1000: number
  avgParagraphSentences: number
}

export interface StyleDna extends StyleStats {
  greeting: string // 인사말 시그니처
  closing: string // 마무리 시그니처
  headingStyle: string // 소제목 스타일 설명
  rules: string[] // 문체 규칙 (사람이 읽고 고칠 수 있는 문장)
  structure?: string // 예시 글에서 로컬로 추출한 글 골격 (예: 인사 → 썸네일 → 환자 질문 → …)
}

export interface BrandBrain {
  summary: string // 한 문단 브랜드 요약
  facts: Fact[]
  strengths: string[] // 우리의 강점 (소구 가능한 것)
  tone: string
  bannedPhrases: string[] // 이 클라이언트가 쓰지 않는 표현
  styleDna: StyleDna | null
  sampleExcerpt: string // 형식 예시 (few-shot, 캐시됨)
  updatedAt: number
}

export interface StylePreset {
  align: 'center' | 'left'
  highlightColor: string // 형광펜 배경색
  accentColor: string // 강조 글자색
  headingColor: string
  quoteStyle: 'line' | 'box' | 'quotation' | 'patient' // patient = 굵은 강조색 (환자 질문형)
  quoteColor: string // 환자 질문 글자색
  sectionBg: string // 번호 소제목 박스 배경
  blankLinesBetween: number // 문단 사이 빈 줄
  fontSize: number // 본문 px
}

export interface ClientContact {
  phone?: string
  bookingUrl?: string
  placeName?: string // 지도 검색용 장소명
  links?: { label: string; url: string }[] // 진료철학 글 등 고정 링크
}

export interface ClientAssets {
  doctorPhoto?: string // 로컬 파일 경로 (썸네일 생성용 참고 이미지)
  logo?: string
  imageStyle?: string // AI 이미지 공통 스타일 (예: "베이지·청록 톤, 부드러운 3D 렌더")
}

export interface Client {
  id: string
  name: string
  industry: Industry
  region?: string
  homepage?: string
  brain: BrandBrain | null
  preset: StylePreset
  contact?: ClientContact
  assets?: ClientAssets
  createdAt: number
}

// ───────── SERP / 경쟁 분석 ─────────

export interface SerpPost {
  rank: number
  title: string
  url: string
  blogName: string
  date?: string
  snippet?: string
}

export interface SerpSection {
  order: number
  kind: 'powerlink' | 'place' | 'blog' | 'cafe' | 'kin' | 'smartblock' | 'video' | 'news' | 'image' | 'web' | 'other'
  title: string // 화면에 보이는 블록 제목 (스마트블록 주제명 포함)
}

export interface SerpSnapshot {
  keyword: string
  fetchedAt: number
  autocomplete: string[]
  related: string[]
  sections: SerpSection[]
  blogTop: SerpPost[]
  kinQuestions: string[]
  screenshotPath?: string
}

export interface PostMetrics {
  chars: number
  charsNoSpace: number
  images: number
  headings: number
  keywordCount: number
  keywordInTitle: boolean
  keywordInFirstPara: boolean
  hasVideo: boolean
  hasMap: boolean
}

export interface CompetitorPost {
  rank: number
  url: string
  title: string
  blogName: string
  date?: string
  text: string // 압축 전 본문 (로컬 유사도 검사용)
  metrics: PostMetrics
}

export interface Hesitation {
  issue: string // 예: "임플란트 통증"
  detail: string // 독자가 실제로 망설이는 이유
  coveredBy: number[] // 이 불안을 다룬 경쟁글 rank 목록
  evidence: string // 근거 (경쟁글 문장 또는 지식iN 질문)
  bias?: string // 심리 기제 (손실 회피, 모호성 회피 …)
  intensity?: number // 1~5
  copyAngle?: string // 해소 카피 방향
}

export interface Persona {
  label: string // 한 줄 요약
  age: string
  situation: string // 지금 처한 상황
  coreNeed: string // 겉으로 말하는 니즈
  hiddenNeed: string // 숨은 니즈 (말하지 않는 진짜 이유)
  trigger: string // 검색을 시작하게 만든 계기
  objection: string // 마지막까지 남는 반론
}

export interface HesitationMap {
  searchIntent: string
  appeals: { point: string; posts: number[] }[] // 경쟁글 소구점
  hesitations: Hesitation[]
  gaps: string[] // 아무도 해결하지 않은 지점 → 공략 포인트
  commonStructure: string // 상위글의 공통 형식
  persona?: Persona
  emotions?: { emotion: string; score: number; cue: string }[] // 감정 온도
  barriers?: string[] // 결정 장벽
  drivers?: string[] // 결정 촉진 요인
  objections?: { objection: string; reply: string }[] // 반론 처리표
}

export interface Angle {
  id: string
  name: string
  persona: string // 타겟 (주제에 따라 자동)
  hook: string
  hesitationsSolved: string[]
  strengthsUsed: string[]
  whyWin: string
  outline: string[]
}

export interface TitleCandidate {
  text: string
  rationale: string
  score?: number
  breakdown?: Record<string, number>
}

// ───────── 본문 블록 ─────────
// paragraph/quote/cta 텍스트 안의 인라인 마크:
//   **굵게**   ==형광펜==   ^^강조색^^

// paragraph 텍스트의 줄바꿈(\n)은 그대로 한 줄, 빈 줄(\n\n)은 문단 간격이 된다.

export type ImageKind = 'thumbnail' | 'ai' | 'card' | 'photo'
// thumbnail: 대표 이미지(원장 사진 + 큰 제목) / ai: 인포그래픽·3D 일러스트 (Gemini)
// card: 텍스트 카드 (로컬 무료 렌더링) / photo: 실제 촬영 필요

export type Block =
  | { type: 'heading'; text: string }
  | { type: 'section'; num: number; text: string } // 번호 질문형 소제목 박스 ("1. 왜 가격이 다를까요?")
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; rows: string[][] } // 첫 행이 머리글
  | { type: 'image'; caption: string; shotGuide: string; kind?: ImageKind; visual?: string; file?: string }
  | { type: 'divider' }
  | { type: 'cta'; text: string }
  | { type: 'contact' } // 클라이언트 연락처 박스 (자동 채움)
  | { type: 'link'; label: string; url: string }
  | { type: 'faq'; q: string; a: string }

export interface RankRecord {
  date: string // YYYY-MM-DD
  blogTab: number | null
  integrated: number | null
}

export interface Post {
  id: string
  clientId: string
  keyword: string
  title: string
  angle: Angle | null
  blocks: Block[]
  status: 'draft' | 'published'
  url?: string
  ranks: RankRecord[]
  createdAt: number
  updatedAt: number
}

// ───────── 비용 ─────────

export interface CostEntry {
  ts: number
  clientId?: string
  step: string
  model: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  usd: number
}

export interface Settings {
  analysisModel: string
  writingModel: string
  imageModel: string
  monthlyBudgetUsd: number
  targetChars: number
  hasApiKey: boolean
  hasGeminiKey: boolean
  mock: boolean // 모의 모드 (API 호출 없이 전 기능 점검)
  naverClientId?: string
  hasNaverSecret?: boolean
}

// ───────── 검수 ─────────

export interface Finding {
  checker: string // 'compliance' | 'density' | 'similarity' | 'aiTell' | 'factLock' | 'length' | 'cannibal'
  severity: 'error' | 'warn' | 'info'
  message: string
  excerpt?: string
  suggestion?: string
  blockIndex?: number
}
