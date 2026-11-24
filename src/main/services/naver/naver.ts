import { net } from 'electron'
import type { CompetitorPost, SerpPost, SerpSection, SerpSnapshot } from '@shared/types'
import { computeMetrics, type ParsedPost } from '@shared/analysis/metrics'
import { scrape } from './scraper'
import { EXTRACT_BLOG_LIST, EXTRACT_INTEGRATED, EXTRACT_KIN, EXTRACT_POST, EXTRACT_POST_KEYS, EXTRACT_STRUCTURE } from './extractors'
import type { PostStructure } from '@shared/analysis/structure'

const enc = encodeURIComponent

/** 자동완성 — 네이버 자동완성 JSON 엔드포인트. 응답 형식이 바뀌어도 문자열만 평탄화해서 뽑는다 */
export async function autocomplete(keyword: string): Promise<string[]> {
  const url = `https://ac.search.naver.com/nx/ac?q=${enc(keyword)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100`
  try {
    const res = await net.fetch(url)
    const json = await res.json()
    const out: string[] = []
    const walk = (v: unknown) => {
      if (typeof v === 'string') {
        if (v.length > 1 && v.length <= 40 && /[가-힣a-zA-Z]/.test(v) && !out.includes(v)) out.push(v)
      } else if (Array.isArray(v)) v.forEach(walk)
    }
    walk((json as { items?: unknown }).items ?? [])
    return out.filter((s) => s !== keyword).slice(0, 15)
  } catch {
    return []
  }
}

/** 키워드 확장: "키워드 + ㄱ~ㅎ" 자동완성 (키워드 레이더용) */
export async function expandKeyword(seed: string): Promise<string[]> {
  const suffixes = ['', ' ㄱ', ' ㄴ', ' ㄷ', ' ㅂ', ' ㅅ', ' ㅇ', ' ㅈ', ' ㅊ', ' ㅎ', ' 비용', ' 후기', ' 추천']
  const all = new Set<string>()
  for (const s of suffixes) {
    for (const k of await autocomplete(seed + s)) all.add(k)
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 250))
  }
  return Array.from(all)
}

export async function collectSerp(keyword: string): Promise<SerpSnapshot> {
  const q = enc(keyword)
  const shot = `${Date.now()}_${keyword.replace(/[^\w가-힣]/g, '')}.png`
  const [ac, integrated, blog, kin] = [
    autocomplete(keyword),
    scrape<{ sections: SerpSection[]; related: string[] }>(`https://search.naver.com/search.naver?query=${q}`, EXTRACT_INTEGRATED, { screenshot: shot, settleMs: 900, scroll: true }),
    scrape<Omit<SerpPost, 'rank'>[]>(`https://search.naver.com/search.naver?ssc=tab.blog.all&query=${q}`, EXTRACT_BLOG_LIST, { screenshot: 'blog_' + shot }),
    scrape<string[]>(`https://search.naver.com/search.naver?ssc=tab.kin.kqna&query=${q}`, EXTRACT_KIN),
  ]
  const [acR, intR, blogR, kinR] = await Promise.all([ac, integrated, blog, kin])
  return {
    keyword,
    fetchedAt: Date.now(),
    autocomplete: acR,
    related: intR.data.related,
    sections: intR.data.sections,
    blogTop: blogR.data.slice(0, 10).map((p, i) => ({ ...p, rank: i + 1 })),
    kinQuestions: kinR.data,
    screenshotPath: intR.screenshotPath,
  }
}

export function mobileUrl(url: string): string {
  const m = url.match(/blog\.naver\.com\/(?:PostView\.naver\?blogId=)?([\w-]+)(?:\/|&logNo=)(\d+)/)
  return m ? `https://m.blog.naver.com/${m[1]}/${m[2]}` : url
}

export async function fetchPost(p: SerpPost, keyword: string): Promise<CompetitorPost | null> {
  try {
    const { data } = await scrape<ParsedPost>(mobileUrl(p.url), EXTRACT_POST, { mobile: true, settleMs: 800 })
    const text = data.paragraphs.join('\n')
    if (text.length < 100) return null
    return { rank: p.rank, url: p.url, title: data.title || p.title, blogName: p.blogName, date: p.date, text, metrics: computeMetrics(data, keyword) }
  } catch {
    return null
  }
}

export function postKey(url: string): string | null {
  const m = url.match(/blog\.naver\.com\/(?:PostView\.naver\?blogId=)?([\w-]+)(?:\/|&logNo=)(\d{6,})/)
  return m ? m[1].toLowerCase() + '/' + m[2] : null
}

/** 내 글의 블로그탭·통합검색 순위 (없으면 null) */
export async function checkRank(keyword: string, url: string): Promise<{ blogTab: number | null; integrated: number | null }> {
  const key = postKey(url)
  if (!key) throw new Error('네이버 블로그 글 URL이 아닙니다 (예: https://blog.naver.com/아이디/글번호)')
  const q = enc(keyword)
  const blog = await scrape<string[]>(`https://search.naver.com/search.naver?ssc=tab.blog.all&query=${q}`, EXTRACT_POST_KEYS)
  const integ = await scrape<string[]>(`https://search.naver.com/search.naver?query=${q}`, EXTRACT_POST_KEYS)
  const pos = (list: string[]) => {
    const i = list.indexOf(key)
    return i === -1 ? null : i + 1
  }
  return { blogTab: pos(blog.data), integrated: pos(integ.data) }
}

/** 홈페이지 텍스트 (브랜드 두뇌 학습용) — 메인 + 같은 도메인 링크 몇 개 */
export async function crawlHomepage(url: string, maxPages = 5): Promise<string> {
  const EXTRACT = function () {
    const text = (document.body.innerText || '').replace(/\n{3,}/g, '\n\n').slice(0, 8000)
    const host = location.host
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map((a) => (a as HTMLAnchorElement).href)
      .filter((h) => h.includes(host) && !/#|\.(jpg|png|pdf)$|login|join|javascript/i.test(h))
    return { text, links: Array.from(new Set(links)).slice(0, 40) }
  }.toString()
  const first = await scrape<{ text: string; links: string[] }>(url, EXTRACT, { settleMs: 1200 })
  const texts = [first.data.text]
  // 소개·의료진·장비·진료 관련 페이지 우선
  const priority = first.data.links.sort((a, b) => score(b) - score(a)).slice(0, maxPages - 1)
  for (const l of priority) {
    try {
      const r = await scrape<{ text: string; links: string[] }>(l, EXTRACT, { settleMs: 800 })
      texts.push(r.data.text)
    } catch {
      /* 개별 페이지 실패는 무시 */
    }
  }
  return texts.join('\n\n---\n\n')
}

function score(u: string): number {
  return /about|intro|doctor|staff|equip|소개|의료진|장비|진료|clinic|info|greeting/i.test(decodeURIComponent(u)) ? 1 : 0
}

/** 예시 글의 컴포넌트 구조 (형식 학습용) */
export async function fetchStructure(url: string): Promise<PostStructure | null> {
  try {
    const { data } = await scrape<PostStructure>(mobileUrl(url), EXTRACT_STRUCTURE, { mobile: true, settleMs: 1000 })
    return data.components.length ? data : null
  } catch {
    return null
  }
}
