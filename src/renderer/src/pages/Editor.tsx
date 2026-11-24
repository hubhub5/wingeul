import { useEffect, useMemo, useRef, useState } from 'react'
import type { Block, ImageKind, Post } from '@shared/types'
import type { BattleView } from '@shared/api'
import { review } from '@shared/analysis/review'
import { persuasionFlow } from '@shared/analysis/psych'
import { blocksToNaverHtml, blocksToPlain, shotList, withPresetDefaults } from '@shared/format/naverHtml'
import { useApp } from '../lib/ctx'
import { api, imgUrl, ymd } from '../lib/api'
import Icon from '../components/Icon'

const TYPES: Block['type'][] = ['section', 'heading', 'paragraph', 'quote', 'list', 'table', 'image', 'contact', 'link', 'divider', 'cta', 'faq']
const TYPE_KO: Record<Block['type'], string> = {
  section: '번호 소제목', heading: '소제목', paragraph: '문단', quote: '환자 질문·인용', list: '체크리스트', table: '비교표',
  image: '이미지', contact: '전화문의', link: '링크', divider: '구분선', cta: '마무리', faq: 'FAQ',
}
const KIND_KO: Record<ImageKind, string> = { thumbnail: '대표 썸네일', ai: 'AI 인포그래픽', card: '텍스트 카드', photo: '실제 촬영' }

const QUICK = [
  ['AI 티 줄이기', '상투어를 없애고, 종결어미를 다양하게, 짧은 문장을 섞어 사람이 쓴 것처럼 고쳐줘. 내용은 유지.'],
  ['규제 위반 고치기', '업종 금지 사항(최상급·비교·효과 보장·할인·치료경험담)에 걸리는 표현을 사실 서술로 바꿔줘.'],
  ['불안 해소 강화', '독자의 불안을 더 구체적으로 짚고, 확인된 업체 정보로 해소하는 문장을 보강해줘.'],
  ['더 짧게', '핵심만 남기고 30% 줄여줘. 줄바꿈 형식은 유지.'],
  ['더 길게', '구체적 예시와 설명을 더해 40% 늘려줘. 확인된 정보에 없는 수치는 넣지 마. 줄바꿈 형식 유지.'],
] as const

export default function Editor() {
  const { editing, setEditing, clients, settings, run, busy, go } = useApp()
  const [post, setPost] = useState<Post | null>(editing)
  const [battle, setBattle] = useState<BattleView | null>(null)
  const [past, setPast] = useState<{ keyword: string; title: string; text: string }[]>([])
  const [sel, setSel] = useState<number[]>([])
  const [ins, setIns] = useState('')
  const [preview, setPreview] = useState(false)
  const [url, setUrl] = useState(editing?.url ?? '')
  const [copied, setCopied] = useState('')
  const focus = useRef<{ el: HTMLTextAreaElement; i: number; field: string } | null>(null)
  const client = clients.find((c) => c.id === post?.clientId)
  const preset = withPresetDefaults(client?.preset)

  useEffect(() => {
    setPost(editing)
    setUrl(editing?.url ?? '')
    if (!editing) return
    void api('battle.get', editing.keyword).then(setBattle)
    void api('posts.past', editing.clientId, editing.id).then(setPast)
  }, [editing?.id])

  // 자동 저장 (0.8초 디바운스)
  useEffect(() => {
    if (!post || busy) return // 이미지 생성·순위 확인 중에는 자동 저장을 멈춘다
    const t = setTimeout(() => void api('posts.save', post).then((p) => setEditing(p)), 800)
    return () => clearTimeout(t)
  }, [post, busy])

  const result = useMemo(() => {
    if (!post) return null
    return review({
      title: post.title, blocks: post.blocks, keyword: post.keyword,
      industry: client?.industry ?? 'general', targetChars: settings?.targetChars ?? 1800,
      facts: client?.brain?.facts ?? [], brandTerms: client ? [client.name] : [],
      bannedPhrases: client?.brain?.bannedPhrases ?? [],
      competitors: (battle?.competitors ?? []).map((c) => ({ label: `${c.rank}위 ${c.title.slice(0, 20)}`, text: c.text })),
      pastPosts: past,
    })
  }, [post, client, settings, battle, past])

  const flow = useMemo(() => (post ? persuasionFlow(post.blocks, battle?.hesitation?.hesitations.map((h) => h.issue) ?? []) : null), [post, battle])

  if (!post) {
    return (
      <div className="empty">
        열린 원고가 없습니다.
        <div><button className="btn pri" onClick={() => go('posts')}>원고 목록 열기</button></div>
      </div>
    )
  }

  const setBlocks = (blocks: Block[]) => setPost({ ...post, blocks })
  const update = (i: number, b: Block) => setBlocks(post.blocks.map((x, j) => (j === i ? b : x)))
  const remove = (i: number) => setBlocks(post.blocks.filter((_, j) => j !== i))
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= post.blocks.length) return
    const arr = [...post.blocks]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setBlocks(arr)
  }
  const insert = (i: number) => setBlocks([...post.blocks.slice(0, i + 1), { type: 'paragraph', text: '' }, ...post.blocks.slice(i + 1)])
  const toggleSel = (i: number) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i].sort((a, b) => a - b)))

  function wrap(mark: string) {
    const f = focus.current
    if (!f) return
    const { el, i, field } = f
    const s = el.selectionStart
    const e = el.selectionEnd
    if (s === e) return
    const v = el.value
    const b = post!.blocks[i] as Record<string, unknown>
    update(i, { ...b, [field]: v.slice(0, s) + mark + v.slice(s, e) + mark + v.slice(e) } as Block)
  }

  async function rewrite(instruction: string) {
    const p = await run('부분 수정', () => api('write.rewrite', post!.id, sel, instruction))
    if (p) { setPost(p); setEditing(p); setSel([]) }
  }

  async function genImage(i: number, engine: 'auto' | 'gemini' | 'card') {
    await api('posts.save', post!)
    const p = await run('이미지 생성', () => api('images.generate', post!.id, i, engine))
    if (p) { setPost(p); setEditing(p) }
  }

  async function genAll() {
    await api('posts.save', post!)
    const p = await run('이미지 모두 생성', () => api('images.generateAll', post!.id))
    if (p) { setPost(p); setEditing(p) }
  }

  function copy(kind: 'naver' | 'text' | 'shots') {
    if (kind === 'naver') void api('clipboard.naver', post!.title, post!.blocks, preset, client?.contact)
    if (kind === 'text') void api('clipboard.text', post!.title + '\n\n' + blocksToPlain(post!.blocks, client?.contact))
    if (kind === 'shots') void api('clipboard.text', shotList(post!.title, post!.blocks))
    setCopied(kind)
    setTimeout(() => setCopied(''), 1500)
  }

  async function publish() {
    if (!/blog\.naver\.com/.test(url)) return alert('네이버 블로그 글 주소를 넣어 주세요')
    const saved = await api('posts.save', { ...post!, url: url.trim(), status: 'published' })
    setPost(saved)
    const tracked = await run('순위 확인', () => api('rank.track', saved.id))
    if (tracked) { setPost(tracked); setEditing(tracked) }
  }

  const badBlocks = new Set(result?.findings.filter((f) => f.severity === 'error' && f.blockIndex !== undefined).map((f) => f.blockIndex))
  const images = post.blocks.filter((b): b is Extract<Block, { type: 'image' }> => b.type === 'image')
  const pending = images.filter((b) => b.kind && b.kind !== 'photo' && !b.file).length
  const errors = result?.findings.filter((f) => f.severity === 'error').length ?? 0

  return (
    <>
      <div className="page-head">
        <div className="kicker">
          <span>{client?.name ?? '업체 없음'}</span>
          <span>키워드 {post.keyword}</span>
          <span>작성 {ymd(post.createdAt)}</span>
          <span>{post.status === 'published' ? '발행됨' : '초안'}</span>
          {post.angle && <span>{post.angle.name}</span>}
        </div>
        <textarea value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} style={{ border: 0, background: 'transparent', padding: 0, minHeight: 0, resize: 'none', boxShadow: 'none' }} rows={1} aria-label="제목" />
      </div>

      <div className="cols">
        <div>
          <div className="toolbar">
            <span className="hint">선택 글자</span>
            <button className="btn sm ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('**')}><b>굵게</b></button>
            <button className="btn sm" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('==')} style={{ background: preset.highlightColor, color: '#1a1a1a' }}>형광펜</button>
            <button className="btn sm ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('^^')} style={{ color: preset.accentColor }}>강조색</button>
            <span style={{ flex: 1 }} />
            <button className="btn sm ghost" disabled={busy || !pending} onClick={genAll}><Icon name="sparkle" size={16} />이미지 {pending ? `${pending}장 ` : ''}생성</button>
            <button className={'btn sm' + (preview ? ' pri' : ' ghost')} onClick={() => setPreview(!preview)}><Icon name={preview ? 'edit' : 'eye'} size={16} />{preview ? '편집' : '미리보기'}</button>
          </div>

          {preview ? (
            <div className="phone-wrap">
              <div className="phone">
                <h1>{post.title}</h1>
                <PreviewBody post={post} preset={preset} contact={client?.contact} />
              </div>
            </div>
          ) : (
            <div className="doc">
              {post.blocks.map((b, i) => (
                <div key={i} className={`blk t-${b.type}` + (sel.includes(i) ? ' sel' : '') + (badBlocks.has(i) ? ' bad' : '')}>
                  <div className="bh">
                    <span className="mono" onClick={() => toggleSel(i)} title="클릭해서 부분 수정 대상으로 선택">
                      <Icon name={sel.includes(i) ? 'check' : 'plus'} size={13} />{String(i + 1).padStart(2, '0')}
                    </span>
                    <select value={b.type} onChange={(e) => update(i, convert(b, e.target.value as Block['type']))}>
                      {TYPES.map((t) => <option key={t} value={t}>{TYPE_KO[t]}</option>)}
                    </select>
                  </div>
                  <div className="blk-tools">
                    <button className="icon-btn" onClick={() => move(i, -1)} aria-label="위로"><Icon name="up" size={16} /></button>
                    <button className="icon-btn" onClick={() => move(i, 1)} aria-label="아래로"><Icon name="down" size={16} /></button>
                    <button className="icon-btn" onClick={() => insert(i)} aria-label="아래에 문단 추가"><Icon name="plus" size={16} /></button>
                    <button className="icon-btn" onClick={() => remove(i)} aria-label="삭제"><Icon name="trash" size={16} /></button>
                  </div>
                  <BlockFields b={b} contact={client?.contact} busy={busy} onChange={(nb) => update(i, nb)} onFocus={(el, field) => (focus.current = { el, i, field })} onGen={(engine) => genImage(i, engine)} />
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="sticky">
          {result && (
            <>
              <div className="stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 12 }}>
                <div className="hero"><span className="mono">글자수 · 공백 포함</span><b>{result.chars.withSpace}</b><small>/ {settings?.targetChars}</small></div>
                <div><span className="mono">키워드 반복</span><b>{result.keywordCount}</b><small>회</small></div>
                <div><span className="mono">AI 문체 지수</span><b>{result.aiScore}</b><small>/100</small></div>
                <div><span className="mono">최대 유사도</span><b>{Math.round(result.similarity.maxScore * 100)}</b><small>%</small></div>
              </div>

              <div className="panel">
                <div className={'verdict' + (errors ? ' bad' : '')}><span className="dot" />{errors ? `수정이 필요한 곳 ${errors}건` : '검수 통과'}</div>
                <ul className="finds">
                  {result.findings.slice(0, 40).map((f, k) => (
                    <li key={k} onClick={() => f.blockIndex !== undefined && setSel([f.blockIndex])} style={{ cursor: f.blockIndex !== undefined ? 'pointer' : 'default' }}>
                      <span className={'sev ' + f.severity}>{f.severity === 'error' ? '오류' : f.severity === 'warn' ? '주의' : '참고'}</span>
                      {f.message}
                      {f.excerpt && <q>{f.excerpt}</q>}
                      {f.suggestion && <span className="sug">→ {f.suggestion}</span>}
                    </li>
                  ))}
                </ul>
                <p className="hint" style={{ marginTop: 10 }}>규제 검수는 보조 도구입니다. 의료광고 사전심의 등 법적 판단을 대신하지 않습니다.</p>
              </div>
            </>
          )}

          {flow && (
            <div className="panel">
              <h3>설득 구조 점검 · {flow.orderScore}점</h3>
              <div className="stage-line">{flow.stages.map((st) => <span key={st.stage} className={st.at !== null ? 'on' : ''} title={st.at !== null ? `원고 ${Math.round(st.at * 100)}% 지점` : '없음'}>{st.stage}</span>)}</div>
              <p className="hint" style={{ marginBottom: 10 }}>공감 → 문제 제기 → 원인 → 해소 근거 → 확신 → 행동 유도 순서가 자연스러울수록 점수가 높습니다.</p>
              <div className="info">
                <div className="row"><span>첫 3줄 후킹</span><span>{flow.hook.ok ? '있음' : '없음'} · {flow.hook.reason}</span></div>
                <div className="row"><span>고민 반영</span><span>{flow.coverage.length ? `${flow.coverage.filter((c) => c.covered).length}/${flow.coverage.length} — ${flow.coverage.filter((c) => !c.covered).map((c) => c.issue).join(', ') || '모두 반영'}` : '심리 분석 후 표시'}</span></div>
                <div className="row"><span>독자 지칭</span><span>{flow.readerAddress}회 · 질문 문장 {flow.questionRatio}%</span></div>
                <div className="row"><span>구체성</span><span>1000자당 숫자 {flow.specificity}개</span></div>
                <div className="row"><span>이탈 위험</span><span>{flow.dropZones.length ? `블록 ${flow.dropZones.map((i) => i + 1).join(', ')}부터 이미지·소제목 없이 깁니다` : '없음'}</span></div>
              </div>
            </div>
          )}

          <div className="panel">
            <h3>AI로 고치기 {sel.length ? `· 블록 ${sel.map((i) => i + 1).join(', ')}` : '· 선택 없음 = 전체'}</h3>
            <div className="tags" style={{ marginBottom: 10 }}>
              {QUICK.map(([label, text]) => <button key={label} className="tag" disabled={busy} onClick={() => rewrite(text)}>{label}</button>)}
            </div>
            <textarea value={ins} onChange={(e) => setIns(e.target.value)} placeholder="직접 지시: 예) 이 부분에 수면마취 이야기를 넣어줘" style={{ minHeight: 64 }} />
            <button className="btn sm" style={{ marginTop: 8 }} disabled={busy || !ins.trim()} onClick={() => rewrite(ins)}>지시대로 고치기</button>
          </div>

          <div className="panel">
            <h3>발행</h3>
            <div className="btns" style={{ marginBottom: 10 }}>
              <button className="btn pri" onClick={() => copy('naver')}><Icon name={copied === 'naver' ? 'check' : 'copy'} size={18} />{copied === 'naver' ? '복사됨' : '네이버용 서식 복사'}</button>
            </div>
            <div className="btns" style={{ marginBottom: 10 }}>
              <button className="btn sm ghost" onClick={() => api('images.export', post.id)}><Icon name="folder" size={16} />이미지 폴더</button>
              <button className="btn sm ghost" onClick={() => copy('text')}>{copied === 'text' ? '복사됨' : '텍스트만'}</button>
              <button className="btn sm ghost" onClick={() => copy('shots')}>{copied === 'shots' ? '복사됨' : '이미지 지시서'}</button>
            </div>
            <p className="hint" style={{ marginBottom: 14 }}>스마트에디터 본문에 붙여넣기(⌘V) 후 [사진 N] 자리에 이미지 폴더의 같은 번호 파일을 넣으세요.</p>
            <label className="f">
              <span>발행한 글 주소 → 순위 추적 시작</span>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://blog.naver.com/아이디/글번호" />
            </label>
            <button className="btn sm" disabled={busy || !url} onClick={publish}><Icon name="trend" size={16} />등록하고 순위 확인</button>
            {post.ranks.length > 0 && (
              <p className="hint" style={{ marginTop: 10 }}>
                {post.ranks.slice(-5).map((r) => `${r.date.slice(5)} 블로그 ${r.blogTab ?? '-'} · 통검 ${r.integrated ?? '-'}`).join('   ')}
              </p>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}

/** 미리보기: 서식 HTML의 [사진 N] 자리에 실제 생성 이미지를 끼운다 */
function PreviewBody({ post, preset, contact }: { post: Post; preset: ReturnType<typeof withPresetDefaults>; contact?: import('@shared/types').ClientContact }) {
  let html = blocksToNaverHtml(post.title, post.blocks, preset, contact)
  const imgs = post.blocks.filter((b): b is Extract<Block, { type: 'image' }> => b.type === 'image')
  imgs.forEach((b, n) => {
    if (!b.file) return
    html = html.replace(new RegExp(`<p[^>]*><span[^>]*>\\[사진 ${n + 1}:[^<]*</span></p>`), `<img class="pimg" src="${imgUrl(b.file)}">`)
  })
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

function convert(b: Block, t: Block['type']): Block {
  const text = 'text' in b ? b.text : b.type === 'list' ? b.items.join('\n') : b.type === 'faq' ? b.q + '\n' + b.a : b.type === 'image' ? b.caption : b.type === 'table' ? b.rows.map((r) => r.join(' | ')).join('\n') : ''
  switch (t) {
    case 'list': return { type: 'list', items: text.split('\n').filter(Boolean) }
    case 'table': return { type: 'table', rows: text ? text.split('\n').map((l) => l.split('|').map((s) => s.trim())) : [['항목', '내용'], ['', '']] }
    case 'image': return { type: 'image', kind: 'ai', caption: text, shotGuide: '', visual: text }
    case 'section': return { type: 'section', num: 1, text }
    case 'divider': return { type: 'divider' }
    case 'contact': return { type: 'contact' }
    case 'link': return { type: 'link', label: text, url: '' }
    case 'faq': { const [q, ...a] = text.split('\n'); return { type: 'faq', q: q ?? '', a: a.join(' ') } }
    default: return { type: t, text }
  }
}

function Auto({ value, onChange, onFocus, placeholder, className }: { value: string; onChange: (v: string) => void; onFocus?: (el: HTMLTextAreaElement) => void; placeholder?: string; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
  }, [value])
  return <textarea ref={ref} className={className} rows={1} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onFocus={(e) => onFocus?.(e.currentTarget)} style={{ resize: 'none', overflow: 'hidden' }} />
}

function BlockFields({ b, onChange, onFocus, onGen, contact, busy }: {
  b: Block; onChange: (b: Block) => void; onFocus: (el: HTMLTextAreaElement, field: string) => void
  onGen: (engine: 'auto' | 'gemini' | 'card') => void; contact?: import('@shared/types').ClientContact; busy: boolean
}) {
  switch (b.type) {
    case 'heading': case 'paragraph': case 'quote': case 'cta':
      return <Auto value={b.text} onChange={(text) => onChange({ ...b, text })} onFocus={(el) => onFocus(el, 'text')} />
    case 'section':
      return (
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span className="num">{b.num}.</span>
          <Auto value={b.text} onChange={(text) => onChange({ ...b, text })} onFocus={(el) => onFocus(el, 'text')} />
        </div>
      )
    case 'list':
      return <Auto value={b.items.join('\n')} onChange={(v) => onChange({ ...b, items: v.split('\n') })} placeholder="한 줄에 하나" />
    case 'table':
      return (
        <div className="mini-table">
          {b.rows.map((r, ri) => (
            <div className="r" key={ri} style={{ gridTemplateColumns: `repeat(${r.length}, 1fr) 30px` }}>
              {r.map((c, ci) => (
                <input key={ci} type="text" value={c} onChange={(e) => onChange({ ...b, rows: b.rows.map((rr, x) => (x === ri ? rr.map((cc, y) => (y === ci ? e.target.value : cc)) : rr)) })} />
              ))}
              <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => onChange({ ...b, rows: b.rows.filter((_, x) => x !== ri) })} aria-label="행 삭제"><Icon name="close" size={14} /></button>
            </div>
          ))}
          <button className="btn sm text" onClick={() => onChange({ ...b, rows: [...b.rows, b.rows[0]?.map(() => '') ?? ['', '']] })}><Icon name="plus" size={14} />행 추가</button>
        </div>
      )
    case 'image': {
      const kind = b.kind ?? 'photo'
      return (
        <div className="imgslot">
          <div className={'thumb' + (kind === 'thumbnail' ? ' sq' : '')}>
            {b.file ? <img src={imgUrl(b.file)} alt={b.caption} /> : <span>{kind === 'photo' ? '촬영 필요' : '아직 생성 안 됨'}</span>}
          </div>
          <div>
            <div className="btns" style={{ marginBottom: 6 }}>
              <select value={kind} onChange={(e) => onChange({ ...b, kind: e.target.value as ImageKind })} style={{ width: 'auto', padding: '4px 10px', fontSize: 12.5 }}>
                {(Object.keys(KIND_KO) as ImageKind[]).map((k) => <option key={k} value={k}>{KIND_KO[k]}</option>)}
              </select>
              {kind !== 'photo' && <button className="btn sm" disabled={busy} onClick={() => onGen('auto')}><Icon name={b.file ? 'refresh' : 'sparkle'} size={15} />{b.file ? '다시' : '생성'}</button>}
              <button className="btn sm ghost" disabled={busy} onClick={() => onGen('card')} title="API 없이 로컬에서 무료로 카드 디자인 생성">카드로</button>
            </div>
            <Auto value={b.caption} onChange={(caption) => onChange({ ...b, caption })} placeholder="사진 설명" />
            <Auto value={kind === 'photo' ? b.shotGuide : b.visual ?? ''} onChange={(v) => onChange(kind === 'photo' ? { ...b, shotGuide: v } : { ...b, visual: v })} placeholder={kind === 'photo' ? '촬영 지시' : '이미지 안 문구: 제목 | 항목: 설명 | 하단'} className="hint" />
            {kind === 'ai' && <Auto value={b.shotGuide} onChange={(shotGuide) => onChange({ ...b, shotGuide })} placeholder="그림 내용 (예: 임플란트 분해도 3D)" className="hint" />}
          </div>
        </div>
      )
    }
    case 'contact':
      return <span className="contact-pill"><Icon name="phone" size={16} />{contact?.phone ? `전화 문의 ${contact.phone}` : '업체 관리에 전화번호를 넣으면 채워집니다'}</span>
    case 'link':
      return (
        <>
          <input type="text" value={b.label} onChange={(e) => onChange({ ...b, label: e.target.value })} placeholder="링크 제목" />
          <input type="url" value={b.url} onChange={(e) => onChange({ ...b, url: e.target.value })} placeholder="https://" />
        </>
      )
    case 'faq':
      return (
        <>
          <Auto value={b.q} onChange={(q) => onChange({ ...b, q })} onFocus={(el) => onFocus(el, 'q')} placeholder="질문" />
          <Auto value={b.a} onChange={(a) => onChange({ ...b, a })} onFocus={(el) => onFocus(el, 'a')} placeholder="답변" />
        </>
      )
    case 'divider':
      return <div className="hr" style={{ margin: '8px 0' }} />
  }
}
