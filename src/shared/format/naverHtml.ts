// 블록 JSON → 네이버 스마트에디터 ONE 붙여넣기용 HTML.
// 인라인 스타일만 사용 (text-align, color, background-color, font-weight, font-size).
// 표(<table>)는 스마트에디터에서 표 컴포넌트로 붙는다 — 예시 글들이 번호 소제목·전화문의·비교표를 표로 쓰는 형식을 재현.

import type { Block, ClientContact, StylePreset } from '../types'

export const DEFAULT_PRESET: StylePreset = {
  align: 'center',
  highlightColor: '#daf9f9',
  accentColor: '#0078cb',
  headingColor: '#111111',
  quoteStyle: 'patient',
  quoteColor: '#ba0000',
  sectionBg: '#f3f7f7',
  blankLinesBetween: 1,
  fontSize: 16,
}

/** 저장된 옛 프리셋에 새 필드 기본값을 채운다 */
export function withPresetDefaults(p: Partial<StylePreset> | undefined): StylePreset {
  return { ...DEFAULT_PRESET, ...(p ?? {}) }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 인라인 마크 → span. **굵게** ==형광펜== ^^강조색^^ */
export function inline(text: string, p: StylePreset): string {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/==(.+?)==/g, `<span style="background-color:${p.highlightColor};">$1</span>`)
    .replace(/\^\^(.+?)\^\^/g, `<span style="color:${p.accentColor};"><b>$1</b></span>`)
}

const EMPTY = (p: StylePreset) => `<p style="text-align:${p.align};">&nbsp;</p>`
const blank = (p: StylePreset, n = p.blankLinesBetween) => EMPTY(p).repeat(n)

function para(inner: string, p: StylePreset, extra = ''): string {
  return `<p style="text-align:${p.align};font-size:${p.fontSize}px;${extra}">${inner}</p>`
}

/**
 * 문단 텍스트 → 줄 배열. 작성자가 넣은 줄바꿈(\n)을 그대로 따르고 빈 줄은 간격('')으로.
 * 줄바꿈이 전혀 없으면 문장 단위로 끊는다 (모바일 가독성).
 */
export function toLines(text: string): string[] {
  if (text.includes('\n')) {
    return text.split('\n').map((l) => l.trim()).reduce<string[]>((acc, l) => {
      if (!l && acc[acc.length - 1] === '') return acc
      acc.push(l)
      return acc
    }, [])
  }
  return text.replace(/([.!?…])\s+/g, '$1\n').split('\n').map((s) => s.trim()).filter(Boolean)
}

function table(rows: string[][], p: StylePreset, headerBg: string): string {
  const cell = (c: string, head: boolean) =>
    `<td style="border:1px solid #dddddd;padding:10px 12px;text-align:center;font-size:${p.fontSize - 1}px;${head ? `background-color:${headerBg};font-weight:bold;` : ''}">${inline(c, p)}</td>`
  return `<table style="width:100%;border-collapse:collapse;">${rows.map((r, i) => `<tr>${r.map((c) => cell(c, i === 0)).join('')}</tr>`).join('')}</table>`
}

function box(inner: string, bg: string): string {
  return `<table style="width:100%;border-collapse:collapse;"><tr><td style="border:1px solid #dddddd;background-color:${bg};padding:16px;text-align:center;">${inner}</td></tr></table>`
}

export function blocksToNaverHtml(title: string, blocks: Block[], preset: Partial<StylePreset> = DEFAULT_PRESET, contact?: ClientContact): string {
  const p = withPresetDefaults(preset)
  void title
  const out: string[] = []
  let imgNo = 0
  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
        out.push(para(`<b><span style="color:${p.headingColor};font-size:${p.fontSize + 3}px;">${inline(b.text, p)}</span></b>`, p))
        break
      case 'section':
        out.push(box(`<p style="text-align:center;"><b><span style="color:${p.accentColor};font-size:${p.fontSize + 2}px;">${b.num}.</span></b></p><p style="text-align:center;"><b><span style="font-size:${p.fontSize + 2}px;">${inline(b.text, p)}</span></b></p>`, p.sectionBg))
        break
      case 'paragraph':
        for (const line of toLines(b.text)) out.push(line ? para(inline(line, p), p) : EMPTY(p))
        break
      case 'quote': {
        const lines = toLines(b.text).filter(Boolean)
        for (const l of lines) {
          const inner = inline(l, p)
          if (p.quoteStyle === 'patient') out.push(para(`<b><span style="color:${p.quoteColor};">${inner}</span></b>`, p))
          else if (p.quoteStyle === 'quotation') out.push(para(`<span style="color:#888;">“</span> ${inner} <span style="color:#888;">”</span>`, p))
          else if (p.quoteStyle === 'box') out.push(para(`<span style="background-color:#f3f4f6;">&nbsp;${inner}&nbsp;</span>`, p))
          else out.push(para(`<span style="color:#555;">│ ${inner}</span>`, p))
        }
        break
      }
      case 'list':
        for (const it of b.items) out.push(para(`${/^[□■✔✓·\-]/.test(it) ? '' : '□ '}${inline(it, p)}`, p))
        break
      case 'table':
        if (b.rows.length) out.push(table(b.rows, p, p.sectionBg))
        break
      case 'image':
        imgNo++
        out.push(para(`<span style="color:#999999;">[사진 ${imgNo}: ${esc(b.caption)}]</span>`, p))
        break
      case 'divider':
        out.push(para('<span style="color:#cccccc;">───────────</span>', p))
        break
      case 'cta':
        out.push(para(`<span style="background-color:${p.highlightColor};"><b>${inline(b.text, p)}</b></span>`, p))
        break
      case 'contact':
        if (contact?.phone) {
          out.push(box(`<p style="text-align:center;"><b>전화 문의</b></p><p style="text-align:center;"><b><span style="color:${p.accentColor};font-size:${p.fontSize + 2}px;">${esc(contact.phone)}</span></b></p><p style="text-align:center;"><span style="color:#888888;font-size:13px;">(모바일에서 누르면 바로 연결됩니다.)</span></p>`, '#ffffff'))
        }
        if (contact?.bookingUrl) out.push(para(esc(contact.bookingUrl), p))
        break
      case 'link':
        if (b.label) out.push(para(`<b>${esc(b.label)}</b>`, p))
        out.push(para(esc(b.url), p))
        break
      case 'faq':
        out.push(para(`<b><span style="color:${p.accentColor};">Q.</span> ${inline(b.q, p)}</b>`, p))
        for (const line of toLines(b.a)) out.push(line ? para(inline(line, p), p) : EMPTY(p))
        break
    }
    out.push(blank(p))
  }
  return out.join('\n')
}

const strip = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/==(.+?)==/g, '$1').replace(/\^\^(.+?)\^\^/g, '$1')

/** 서식 없는 붙여넣기용 텍스트 */
export function blocksToPlain(blocks: Block[], contact?: ClientContact): string {
  let imgNo = 0
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'heading': return `■ ${strip(b.text)}`
        case 'section': return `${b.num}. ${strip(b.text)}`
        case 'paragraph': return strip(b.text)
        case 'quote': return strip(b.text)
        case 'list': return b.items.map((i) => `□ ${strip(i)}`).join('\n')
        case 'table': return b.rows.map((r) => r.map(strip).join(' | ')).join('\n')
        case 'image': return `[사진 ${++imgNo}: ${b.caption}]`
        case 'divider': return '───────────'
        case 'cta': return strip(b.text)
        case 'contact': return [contact?.phone && `전화 문의 ${contact.phone}`, contact?.bookingUrl].filter(Boolean).join('\n')
        case 'link': return `${b.label}\n${b.url}`
        case 'faq': return `Q. ${strip(b.q)}\n${strip(b.a)}`
      }
    })
    .join('\n\n')
}

/** 촬영·이미지 지시서 — 실제 촬영이 필요한 사진과 생성할 이미지 목록 */
export function shotList(title: string, blocks: Block[]): string {
  const imgs = blocks.filter((b): b is Extract<Block, { type: 'image' }> => b.type === 'image')
  const kindKo = { thumbnail: '대표 이미지', ai: 'AI 생성', card: '카드(자동)', photo: '촬영 필요' }
  return [`[이미지 지시서] ${title}`, ...imgs.map((b, i) => `${i + 1}. (${kindKo[b.kind ?? 'photo']}) ${b.caption}\n   → ${b.kind === 'photo' || !b.kind ? b.shotGuide : b.visual || b.shotGuide}`)].join('\n')
}
