// 업종 규칙팩. 정규식 기반이라 토큰 0. 법적 판단을 대신하지 않으며 보조 검수용이다.
// 의료: 의료법 제56조(의료광고 금지 사항) 및 의료광고 심의 기준에서 자주 문제되는 표현 위주.

import type { Industry } from '../types'

export interface Rule {
  id: string
  label: string
  severity: 'error' | 'warn'
  pattern: string // RegExp source (플래그 g 적용)
  message: string
  suggestion?: string
}

export interface RulePack {
  industry: Industry
  name: string
  rules: Rule[]
  /** 본문 전체 조건 검사: 시술을 언급하면 부작용·개인차 고지가 있어야 함 등 */
  requires?: { id: string; when: string; mustHave: string; message: string }[]
}

const GENERAL: Rule[] = [
  { id: 'g-spam', label: '저품질 유발 표현', severity: 'warn', pattern: '(무조건|대박|강추|클릭하세요|링크\\s*클릭|최저가|돈\\s*버는|100%\\s*보장)', message: '네이버 저품질·광고성으로 분류될 수 있는 표현', suggestion: '구체적 근거로 바꾸거나 삭제' },
  { id: 'g-contact', label: '연락처 반복 노출', severity: 'warn', pattern: '(카톡\\s*문의|카카오톡\\s*ID|오픈채팅|010[-\\s]?\\d{3,4}[-\\s]?\\d{4})', message: '본문 내 연락처·메신저 유도는 광고성 신호가 될 수 있습니다' },
]

export const PACKS: Record<Industry, RulePack> = {
  medical: {
    industry: 'medical',
    name: '의료(병·의원·치과·한의원)',
    rules: [
      { id: 'm-superlative', label: '최상급·비교우위', severity: 'error', pattern: '(최고의?|최상의?|최초|유일(한|무이)?|독보적|1위|넘버\\s*원|No\\.?\\s*1|완벽(한|하게)?|가장\\s*(잘|좋|뛰어|많))', message: '최상급·단정 표현은 의료광고 금지 사항에 해당할 수 있습니다', suggestion: '"~에 집중하고 있습니다", "~을 중요하게 생각합니다"처럼 사실 서술로' },
      { id: 'm-compare', label: '타 의료기관 비교', severity: 'error', pattern: '(다른\\s*(병원|치과|의원|한의원)(과|보다|들과)|타\\s*(병원|치과|의원)(과|보다)|일반\\s*(치과|병원)(과|보다)\\s*(달리|다르게))', message: '다른 의료기관과의 비교 광고는 금지됩니다' },
      { id: 'm-review', label: '치료경험담', severity: 'error', pattern: '(치료\\s*후기|시술\\s*후기|수술\\s*후기|환자분?\\s*(후기|말씀|리뷰)|만족하셨|감사\\s*인사를?\\s*(받|전해)|직접\\s*경험하신)', message: '환자 치료경험담은 소비자를 오인하게 할 우려가 있는 광고로 금지됩니다', suggestion: '개인 경험담 대신 일반적인 진료 과정 설명으로' },
      { id: 'm-guarantee', label: '효과 보장·부작용 부정', severity: 'error', pattern: '(100\\s*%|완치|평생\\s*(보장|사용)|부작용\\s*(이|은)?\\s*(없|전혀)|통증\\s*(이|은)?\\s*(전혀|하나도)\\s*없|무통|확실(한|하게)\\s*(효과|결과)|반드시\\s*(낫|좋아))', message: '치료 효과 보장·부작용 부정 표현은 금지됩니다', suggestion: '"통증을 줄이기 위해 ~을 합니다", "개인차가 있을 수 있습니다"' },
      { id: 'm-discount', label: '가격 할인·이벤트', severity: 'error', pattern: '(할인|이벤트|특가|무료\\s*(시술|진료|검진|상담\\s*이벤트)|선착순|\\d+\\s*%\\s*(off|OFF|할인)|공짜|사은품|페이백)', message: '비급여 진료비 할인·면제, 이벤트성 환자 유인은 의료법 위반 소지가 있습니다' },
      { id: 'm-beforeafter', label: '전후 사진', severity: 'warn', pattern: '(전후\\s*사진|before\\s*&?\\s*after|비포\\s*애프터|치료\\s*전\\s*후\\s*비교)', message: '치료 전후 사진은 심의 대상이며 제한됩니다' },
      { id: 'm-specialist', label: '전문병원·전문의 표방', severity: 'warn', pattern: '(전문\\s*병원|전문\\s*치과|[가-힣]+\\s*전문\\s*(센터|클리닉))', message: '지정받지 않은 "전문병원" 표방, 전문의가 아닌데 "전문" 표기는 금지됩니다. 업체 정보로 확인하세요' },
      { id: 'm-media', label: '언론·방송 인용', severity: 'warn', pattern: '(방송\\s*출연|TV\\s*출연|언론\\s*보도|신문에\\s*소개)', message: '언론 보도·방송 출연을 이용한 광고는 제한됩니다' },
      { id: 'm-fear', label: '공포 조장', severity: 'warn', pattern: '(방치하면\\s*(큰일|위험|돌이킬)|늦으면\\s*(후회|소용)|지금\\s*안\\s*하면)', message: '불안을 과도하게 조장하는 표현은 오인 광고로 볼 수 있습니다', suggestion: '정보 제공형 표현으로 완화' },
      ...GENERAL,
    ],
    requires: [
      { id: 'm-sidefx', when: '(임플란트|수술|시술|발치|교정|이식|레이저|주사|보톡스|필러)', mustHave: '(부작용|개인차|개인에\\s*따라|주의\\s*사항|출혈|염증|붓기|부기)', message: '시술을 다루면서 부작용·개인차 고지가 없습니다. 마지막에 고지 문장을 넣으세요' },
    ],
  },
  legal: {
    industry: 'legal',
    name: '법률(변호사·법무사)',
    rules: [
      { id: 'l-win', label: '승소 보장', severity: 'error', pattern: '(승소율\\s*\\d+|무조건\\s*(승소|이깁)|100\\s*%\\s*승소|결과\\s*보장|반드시\\s*이기)', message: '결과 보장·승소율 과장은 변호사 광고규정 위반 소지가 있습니다' },
      { id: 'l-superlative', label: '최상급', severity: 'error', pattern: '(최고의?|유일(한)?|1위|넘버\\s*원|독보적)', message: '객관적 근거 없는 최상급 표현은 금지됩니다' },
      { id: 'l-ex', label: '전관 표방', severity: 'error', pattern: '(전관|판사\\s*출신이라|검사\\s*출신이라\\s*(유리|빠르))', message: '공직 경력을 이용한 영향력 암시는 금지됩니다' },
      { id: 'l-fee', label: '수임료 할인·무료', severity: 'warn', pattern: '(수임료\\s*할인|무료\\s*수임|착수금\\s*(없|0원))', message: '수임료 관련 유인 표현은 주의가 필요합니다' },
      ...GENERAL,
    ],
  },
  finance: {
    industry: 'finance',
    name: '금융·보험·투자',
    rules: [
      { id: 'f-guarantee', label: '수익·원금 보장', severity: 'error', pattern: '(원금\\s*보장|확정\\s*수익|무위험|수익\\s*보장|손실\\s*(없|0))', message: '금융소비자보호법상 수익·원금 보장 표현은 금지됩니다' },
      { id: 'f-superlative', label: '최상급', severity: 'warn', pattern: '(최고\\s*(수익|금리)|가장\\s*(높은|유리한))', message: '비교 근거가 없으면 최상급 표현을 피하세요' },
      ...GENERAL,
    ],
    requires: [
      { id: 'f-risk', when: '(투자|펀드|주식|코인|보험)', mustHave: '(원금\\s*손실|손실\\s*가능|위험|약관)', message: '투자·보험 상품을 다루면 손실 가능성·약관 확인 고지가 필요합니다' },
    ],
  },
  general: { industry: 'general', name: '일반', rules: GENERAL },
}
