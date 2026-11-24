// 페이지 안에서 실행되는 추출 함수들 (문자열로 주입됨 → 외부 참조 금지, 순수 DOM 코드만).
// 네이버는 클래스명을 자주 바꾸므로 클래스보다 "링크 패턴 + 텍스트 휴리스틱" 위주로 추출한다.
// DOM이 바뀌면 이 파일만 고치면 된다. 회귀 테스트는 tests/fixtures 의 저장된 HTML로.

/** 통합검색: 섹션 순서·제목, 연관검색어, 스마트블록 주제 */
export const EXTRACT_INTEGRATED = function () {
  const clean = (s: string | null | undefined) => (s || '').replace(/새 창 열림/g, '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('#main_pack') || document.body
  const blocks = Array.from(root.children) as HTMLElement[]
  const sections: { order: number; kind: string; title: string }[] = []
  const kindOf = (t: string, el: HTMLElement) => {
    const s = t + ' ' + (el.className || '')
    if (/파워링크|광고|power_?link|ad_/i.test(s)) return 'powerlink'
    if (/플레이스|place|지도/i.test(s)) return 'place'
    if (/지식\s?iN|kin/i.test(s)) return 'kin'
    if (/카페|cafe/i.test(s)) return 'cafe'
    if (/동영상|클립|video|clip/i.test(s)) return 'video'
    if (/뉴스|news/i.test(s)) return 'news'
    if (/이미지|image/i.test(s)) return 'image'
    if (/인기글|블로그|blog|view/i.test(s)) return 'blog'
    if (/웹문서|web/i.test(s)) return 'web'
    return 'smartblock'
  }
  let order = 0
  for (const el of blocks) {
    if (!el.offsetHeight || el.offsetHeight < 40) continue
    const h = el.querySelector('[class*="headline1"], h2, h3, [class*="headline"], [class*="title_area"], .api_title')
    const raw = h ? ((h as HTMLElement).innerText || '').split('\n')[0] : ''
    const title = clean(raw.replace(/이 광고가 표시된 이유|검색결과 안내|등록 안내|내 업체 등록|신규장소 등록|도움말|정보 확인/g, '')).slice(0, 60)
    if (!title || /(연관|관련)\s?검색어|함께 많이 찾는/.test(title)) continue
    sections.push({ order: ++order, kind: kindOf(title, el), title })
  }
  // 연관검색어: "관련 검색어"/"연관 검색어"/"함께 많이 찾는" 제목을 찾아 그 블록의 링크 텍스트
  const related = new Set<string>()
  const heads = (Array.from(document.querySelectorAll('span, h2, h3, strong')) as HTMLElement[]).filter((e) =>
    /^((연관|관련)\s?검색어|함께 많이 찾는.*)$/.test(clean(e.innerText)),
  )
  for (const hd of heads.slice(0, 3)) {
    let box: HTMLElement | null = hd
    for (let i = 0; i < 8 && box; i++) {
      box = box.parentElement
      if (box && box.querySelectorAll('a').length >= 3) break
    }
    if (!box) continue
    ;(Array.from(box.querySelectorAll('a[href*="query="]')) as HTMLAnchorElement[]).forEach((a) => {
      // 화면 텍스트에는 "많이 찾는" 같은 배지가 섞이므로 링크의 검색어 파라미터를 직접 읽는다
      let q = ''
      try { q = new URL(a.href, location.href).searchParams.get('query') || '' } catch { q = '' }
      const t = clean(q || (a as HTMLElement).innerText)
      if (t && t.length <= 30) related.add(t)
    })
  }
  return { sections, related: Array.from(related).slice(0, 20) }
}.toString()

/** 블로그탭(또는 VIEW) 상위 글 목록 */
export const EXTRACT_BLOG_LIST = function () {
  const clean = (s: string | null | undefined) => (s || '').replace(/새 창 열림/g, '').replace(/\s+/g, ' ').trim()
  const POST = /(?:m\.)?blog\.naver\.com\/(?:PostView\.naver\?blogId=)?([\w-]+)(?:\/|&logNo=)(\d{6,})/
  const seen = new Set<string>()
  const out: { title: string; url: string; blogName: string; date: string; snippet: string }[] = []
  const anchors = Array.from(document.querySelectorAll('a[href*="blog.naver.com"]')) as HTMLAnchorElement[]
  for (const a of anchors) {
    const m = a.href.match(POST)
    if (!m) continue
    const key = m[1] + '/' + m[2]
    const title = clean(a.innerText)
    if (seen.has(key) || title.length < 6) continue
    // 같은 글로 가는 링크 중 텍스트가 가장 긴 것이 제목. 컨테이너는 6단계 위까지
    // 컨테이너: 블로그 홈(프로필) 링크가 포함되고, 다른 글 링크는 포함하지 않는 가장 큰 조상
    let box: HTMLElement | null = a
    for (let i = 0; i < 10 && box && box.parentElement; i++) {
      const up: HTMLElement = box.parentElement
      const otherPost = (Array.from(up.querySelectorAll('a[href*="blog.naver.com"]')) as HTMLAnchorElement[]).some((x) => {
        const mm = x.href.match(POST)
        return mm && mm[1] + '/' + mm[2] !== key
      })
      if (otherPost) break
      box = up
    }
    const text = clean(box ? box.innerText : '')
    if (text.length < title.length + 10) continue
    const nameA = box ? (Array.from(box.querySelectorAll('a[href*="blog.naver.com"]')) as HTMLAnchorElement[]).find((x) => !POST.test(x.href) && clean(x.innerText).length > 0) : null
    const date = (text.match(/(\d{4}\.\s?\d{1,2}\.\s?\d{1,2}\.?|\d+\s?(분|시간|일|주)\s?전|어제)/) || [''])[0]
    const snippet = clean(text.replace(title, '')).slice(0, 160)
    seen.add(key)
    out.push({ title, url: 'https://blog.naver.com/' + key, blogName: nameA ? clean(nameA.innerText) : m[1], date, snippet })
    if (out.length >= 15) break
  }
  return out
}.toString()

/** 지식iN 질문 제목 */
export const EXTRACT_KIN = function () {
  const clean = (s: string | null | undefined) => (s || '').replace(/새 창 열림/g, '').replace(/\s+/g, ' ').trim()
  const set = new Set<string>()
  ;(Array.from(document.querySelectorAll('a[href*="kin.naver.com/qna/"]')) as HTMLAnchorElement[]).forEach((a) => {
    const t = clean(a.innerText)
    if (t.length >= 8 && t.length <= 120) set.add(t)
  })
  return Array.from(set).slice(0, 15)
}.toString()

/** 블로그 본문 (모바일 페이지, 스마트에디터 ONE + 구버전 대응) */
export const EXTRACT_POST = function () {
  const clean = (s: string | null | undefined) => (s || '').replace(/[ \t ]+/g, ' ').trim()
  const doc = document
  const container = doc.querySelector('.se-main-container') || doc.querySelector('#viewTypeSelector') || doc.querySelector('.post_ct') || doc.body
  const titleEl = doc.querySelector('.se-title-text, .se_title, .tit_h3, h3.se_textarea')
  const title = clean(titleEl ? (titleEl as HTMLElement).innerText : doc.title)
  // 스마트에디터 ONE은 소제목을 인용구(se-quotation)나 소제목(se-sectionTitle) 컴포넌트로 쓴다
  const headings = Array.from(container.querySelectorAll('.se-component.se-sectionTitle, .se-component.se-quotation, h2, h3'))
    .map((h) => clean((h as HTMLElement).innerText))
    .filter((t) => t && t.length < 80)
  let paragraphs = Array.from(container.querySelectorAll('.se-component:not(.se-documentTitle) .se-text-paragraph, .post_ct p'))
    .map((p) => clean((p as HTMLElement).innerText))
    .filter(Boolean)
  if (paragraphs.length < 3) paragraphs = clean((container as HTMLElement).innerText).split(/\n+/).filter(Boolean)
  const images = container.querySelectorAll('.se-image-resource, .se_mediaImage').length
  const hasVideo = !!container.querySelector('.se-video, .se-oembed, iframe[src*="video"], .se-module-video')
  const hasMap = !!container.querySelector('.se-component.se-placesMap, .se-module-map-image, .se-map-title')
  return { title, paragraphs, headings, images, hasVideo, hasMap }
}.toString()

/** 블로그/통합검색 결과에서 특정 글의 순위 찾기용 — URL 목록만 */
export const EXTRACT_POST_KEYS = function () {
  const POST = /(?:m\.)?blog\.naver\.com\/(?:PostView\.naver\?blogId=)?([\w-]+)(?:\/|&logNo=)(\d{6,})/
  const keys: string[] = []
  ;(Array.from(document.querySelectorAll('a[href*="blog.naver.com"]')) as HTMLAnchorElement[]).forEach((a) => {
    const m = a.href.match(POST)
    if (!m) return
    const k = m[1].toLowerCase() + '/' + m[2]
    if (!keys.includes(k)) keys.push(k)
  })
  return keys
}.toString()

/** 글 형식 해부: 스마트에디터 컴포넌트를 순서대로 (유형·정렬·강조·이미지) — 형식 학습·개발 점검용 */
export const EXTRACT_STRUCTURE = function () {
  const clean = (s: string | null | undefined) => (s || '').replace(/[ \t\u00a0]+/g, ' ').trim()
  const comps = Array.from(document.querySelectorAll('.se-main-container > .se-component, .se-main-container .se-component')) as HTMLElement[]
  const seen = new Set<HTMLElement>()
  const out: Record<string, unknown>[] = []
  for (const c of comps) {
    if (seen.has(c)) continue
    seen.add(c)
    const type = (c.className.match(/se-component (se-[a-zA-Z]+)/) || [])[1] || 'unknown'
    const layout = (c.className.match(/se-l-([a-zA-Z0-9_]+)/) || [])[1] || ''
    const item: Record<string, unknown> = { type: type.replace('se-', ''), layout }
    if (type === 'se-text' || type === 'se-quotation' || type === 'se-sectionTitle') {
      const paras = Array.from(c.querySelectorAll('.se-text-paragraph')) as HTMLElement[]
      item.align = paras[0] ? (paras[0].className.match(/se-text-paragraph-align-(\w+)/) || [])[1] || 'left' : ''
      item.text = clean(c.innerText).slice(0, 300)
      const marks: string[] = []
      c.querySelectorAll('span[style], b, strong').forEach((sp) => {
        const st = (sp as HTMLElement).getAttribute('style') || ''
        const t = clean((sp as HTMLElement).innerText).slice(0, 30)
        if (!t) return
        if (/background-color/.test(st)) marks.push('HL[' + st.match(/background-color:\s*([^;]+)/)![1] + ']' + t)
        else if (/color/.test(st)) marks.push('C[' + st.match(/color:\s*([^;]+)/)![1] + ']' + t)
        else if (sp.tagName === 'B' || sp.tagName === 'STRONG') marks.push('B:' + t)
      })
      const fs = Array.from(c.querySelectorAll('[class*="se-fs-"]')).map((e) => (e.className.match(/se-fs-?(\w+)/) || [])[1]).filter(Boolean)
      if (fs.length) item.fontSize = Array.from(new Set(fs)).join(',')
      if (marks.length) item.marks = marks.slice(0, 8)
      item.lines = paras.length
    } else if (/image|imageStrip|imageGroup/.test(type)) {
      const imgs = Array.from(c.querySelectorAll('img.se-image-resource')) as HTMLImageElement[]
      item.images = imgs.map((i) => (i.getAttribute('data-src') || i.src || '').replace(/\?type=.*/, ''))
      item.caption = clean((c.querySelector('.se-caption') as HTMLElement | null)?.innerText).slice(0, 100)
    } else {
      item.text = clean(c.innerText).slice(0, 120)
    }
    out.push(item)
  }
  const title = clean((document.querySelector('.se-title-text') as HTMLElement | null)?.innerText)
  return { title, components: out }
}.toString()
