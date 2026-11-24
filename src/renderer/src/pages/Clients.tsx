import { useEffect, useState } from 'react'
import type { BrandBrain, Client, Fact, Industry } from '@shared/types'
import { PACKS } from '@shared/compliance/packs'
import { DEFAULT_PRESET, withPresetDefaults } from '@shared/format/naverHtml'
import { useApp } from '../lib/ctx'
import { api, imgUrl, uid, ymd } from '../lib/api'
import Icon from '../components/Icon'

const IND: Industry[] = ['medical', 'legal', 'finance', 'general']

export default function Clients() {
  const { clients, reloadClients, clientId, setClientId } = useApp()
  const [editId, setEditId] = useState<string | null>(clientId || null)
  const editing = clients.find((c) => c.id === editId) ?? null

  async function add() {
    const c: Client = { id: uid(), name: '새 업체', industry: 'medical', brain: null, preset: { ...DEFAULT_PRESET }, createdAt: Date.now() }
    await api('clients.save', c)
    await reloadClients()
    setEditId(c.id)
    setClientId(c.id)
  }

  if (editing) return <ClientDetail c={editing} onBack={() => setEditId(null)} />

  return (
    <>
      <div className="page-head">
        <div className="kicker mono"><span>업체 {clients.length}곳</span></div>
        <h1>업체 관리</h1>
        <p>업체별 강점·확인된 정보·원고 형식을 한 번 정리해 두면 이후 모든 원고에 자동으로 반영됩니다.</p>
      </div>
      <div className="blocks">
        {clients.map((c, i) => (
          <button key={c.id} className="block" style={{ textAlign: 'left' }} onClick={() => { setEditId(c.id); setClientId(c.id) }}>
            <div className="av">{c.assets?.doctorPhoto ? <img src={imgUrl(c.assets.doctorPhoto)} alt="" /> : c.name.slice(0, 1)}</div>
            <span className="mono"><span>C-{String(i + 1).padStart(3, '0')}</span><span>{PACKS[c.industry].name.split('(')[0]}</span></span>
            <h3>{c.name}</h3>
            <p>{c.brain ? `정보 갱신 ${ymd(c.brain.updatedAt)} · 확인 정보 ${c.brain.facts.length} · 강점 ${c.brain.strengths.length}` : '업체 정보 없음'}</p>
          </button>
        ))}
        <button className="block add" onClick={add}><Icon name="plus" size={26} />업체 추가</button>
      </div>
    </>
  )
}

function ClientDetail({ c: initial, onBack }: { c: Client; onBack: () => void }) {
  const { reloadClients, run, busy } = useApp()
  const [c, setC] = useState({ ...initial, preset: withPresetDefaults(initial.preset) })
  const [homepage, setHomepage] = useState(initial.homepage ?? '')
  const [survey, setSurvey] = useState('')
  const [urls, setUrls] = useState('')
  const [texts, setTexts] = useState('')
  useEffect(() => setC({ ...initial, preset: withPresetDefaults(initial.preset) }), [initial])

  async function saveClient(next: Client) {
    setC(next)
    await api('clients.save', next)
    await reloadClients()
  }

  async function learn() {
    const brain = await run('업체 정보 분석', () =>
      api('brain.learn', c.id, {
        homepage: homepage.trim() || undefined,
        survey,
        sampleUrls: urls.split('\n').map((s) => s.trim()).filter(Boolean),
        sampleTexts: texts.split(/\n-{3,}\n/).filter((s) => s.trim()),
      }),
    )
    if (brain) {
      await saveClient({ ...c, homepage, brain })
    }
  }

  async function del() {
    if (!confirm(`${c.name}을(를) 삭제할까요? 작성한 원고는 남습니다.`)) return
    await api('clients.delete', c.id)
    await reloadClients()
    onBack()
  }

  const b = c.brain
  const setBrain = (nb: BrandBrain) => saveClient({ ...c, brain: nb })

  return (
    <>
      <div className="page-head">
        <div className="kicker mono">
          <button className="wl" onClick={onBack}>업체 목록</button>
          <span>등록 {ymd(c.createdAt)}</span>
          {b && <span>정보 갱신 {ymd(b.updatedAt)}</span>}
        </div>
        <h1>{c.name}</h1>
      </div>

      <div className="cols">
        <div>
          <section className="sec">
            <div className="sec-h"><span className="mono">01</span><h2>기본 정보</h2></div>
            <div className="row-f">
              <label className="f"><span>이름</span><input type="text" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} onBlur={() => saveClient(c)} /></label>
              <label className="f"><span>업종 (광고 규정 검수)</span>
                <select value={c.industry} onChange={(e) => saveClient({ ...c, industry: e.target.value as Industry })}>
                  {IND.map((i) => <option key={i} value={i}>{PACKS[i].name}</option>)}
                </select>
              </label>
              <label className="f"><span>지역</span><input type="text" value={c.region ?? ''} onChange={(e) => setC({ ...c, region: e.target.value })} onBlur={() => saveClient(c)} placeholder="예: 대구 수성구" /></label>
            </div>
          </section>

          <ContactAssets c={c} onSave={saveClient} />

          <section className="sec">
            <div className="sec-h"><span className="mono">02</span><h2>업체 정보 분석</h2><small>설문지·홈페이지·예시 글을 한 번 분석해 두면 매번 붙여넣지 않아도 됩니다</small></div>
            <label className="f"><span>홈페이지 주소 (소개·의료진·장비 페이지를 자동으로 함께 읽음)</span><input type="url" value={homepage} onChange={(e) => setHomepage(e.target.value)} placeholder="https://" /></label>
            <label className="f"><span>설문지·소개 자료 (붙여넣기)</span><textarea value={survey} onChange={(e) => setSurvey(e.target.value)} style={{ minHeight: 120 }} /></label>
            <label className="f"><span>형식을 따라 할 예시 글 주소 (한 줄에 하나, 3~10개) — 글 골격·형광펜·환자 질문색·글자 크기를 자동으로 배웁니다</span><textarea value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://blog.naver.com/..." /></label>
            <label className="f"><span>또는 기존 글 본문 붙여넣기 (글 사이를 --- 로 구분)</span><textarea value={texts} onChange={(e) => setTexts(e.target.value)} /></label>
            <button className="btn pri" disabled={busy} onClick={learn}>{b ? '다시 분석' : '분석 시작'}</button>
            <span className="hint" style={{ marginLeft: 10 }}>업체당 1회, 약 100~200원</span>
          </section>

          {b && <BrainEditor b={b} onChange={setBrain} />}
        </div>

        <aside className="panel sticky">
          <h3>서식 프리셋 (네이버 붙여넣기)</h3>
          <label className="f"><span>정렬</span>
            <select value={c.preset.align} onChange={(e) => saveClient({ ...c, preset: { ...c.preset, align: e.target.value as 'center' | 'left' } })}>
              <option value="center">가운데</option><option value="left">왼쪽</option>
            </select>
          </label>
          {(['highlightColor', 'accentColor', 'quoteColor', 'sectionBg', 'headingColor'] as const).map((k) => (
            <label className="f" key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={c.preset[k]} onChange={(e) => setC({ ...c, preset: { ...c.preset, [k]: e.target.value } })} onBlur={() => saveClient(c)} style={{ width: 36, height: 26, padding: 0, border: '1px solid var(--line-2)' }} />
              <span style={{ margin: 0 }}>{{ highlightColor: '형광펜', accentColor: '강조 글자색', quoteColor: '환자 질문색', sectionBg: '번호 소제목 박스', headingColor: '소제목 색' }[k]}</span>
            </label>
          ))}
          <label className="f"><span>인용구 모양</span>
            <select value={c.preset.quoteStyle} onChange={(e) => saveClient({ ...c, preset: { ...c.preset, quoteStyle: e.target.value as 'line' } })}>
              <option value="patient">굵은 강조색 (환자 질문형)</option><option value="line">세로선</option><option value="box">배경 상자</option><option value="quotation">따옴표</option>
            </select>
          </label>
          <div className="row-f">
            <label className="f"><span>문단 사이 빈 줄</span><input type="number" min={0} max={3} value={c.preset.blankLinesBetween} onChange={(e) => saveClient({ ...c, preset: { ...c.preset, blankLinesBetween: +e.target.value } })} /></label>
            <label className="f"><span>본문 크기(px)</span><input type="number" min={13} max={20} value={c.preset.fontSize} onChange={(e) => saveClient({ ...c, preset: { ...c.preset, fontSize: +e.target.value } })} /></label>
          </div>
          <div className="hr" />
          <button className="btn sm danger" onClick={del}><Icon name="trash" size={15} />업체 삭제</button>
        </aside>
      </div>
    </>
  )
}

function BrainEditor({ b, onChange }: { b: BrandBrain; onChange: (b: BrandBrain) => void }) {
  const [draft, setDraft] = useState(b)
  useEffect(() => setDraft(b), [b])
  const commit = (nb: BrandBrain) => { setDraft(nb); onChange(nb) }
  const setFact = (i: number, f: Partial<Fact>) => commit({ ...draft, facts: draft.facts.map((x, j) => (j === i ? { ...x, ...f } : x)) })
  const lines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean)

  return (
    <>
      <section className="sec">
        <div className="sec-h"><span className="mono">03</span><h2>확인된 정보</h2><small>여기 없는 수치는 검수에서 "근거 없음"으로 표시됩니다. 미확인 항목은 확인 후 체크하세요</small></div>
        <table className="tbl">
          <thead><tr><th>항목</th><th>내용</th><th>출처</th><th>확인</th><th /></tr></thead>
          <tbody>
            {draft.facts.map((f, i) => (
              <tr key={i}>
                <td style={{ width: 120 }}><input type="text" value={f.key} onChange={(e) => setDraft({ ...draft, facts: draft.facts.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)) })} onBlur={() => onChange(draft)} /></td>
                <td><input type="text" value={f.value} onChange={(e) => setDraft({ ...draft, facts: draft.facts.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} onBlur={() => onChange(draft)} /></td>
                <td className="hint">{f.source}</td>
                <td><input type="checkbox" checked={f.verified} onChange={(e) => setFact(i, { verified: e.target.checked })} /></td>
                <td><button className="btn sm ghost" onClick={() => commit({ ...draft, facts: draft.facts.filter((_, j) => j !== i) })}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn sm" style={{ marginTop: 8 }} onClick={() => commit({ ...draft, facts: [...draft.facts, { key: '', value: '', source: '직접 입력', verified: true }] })}>+ 정보 추가</button>
      </section>

      <section className="sec">
        <div className="sec-h"><span className="mono">04</span><h2>강점·톤·금지 표현</h2></div>
        <label className="f"><span>업체 요약</span><textarea value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} onBlur={() => onChange(draft)} /></label>
        <label className="f"><span>강점 (한 줄에 하나)</span><textarea value={draft.strengths.join('\n')} onChange={(e) => setDraft({ ...draft, strengths: e.target.value.split('\n') })} onBlur={() => onChange({ ...draft, strengths: lines(draft.strengths.join('\n')) })} /></label>
        <label className="f"><span>톤</span><input type="text" value={draft.tone} onChange={(e) => setDraft({ ...draft, tone: e.target.value })} onBlur={() => onChange(draft)} /></label>
        <label className="f"><span>쓰지 않는 표현 (한 줄에 하나)</span><textarea value={draft.bannedPhrases.join('\n')} onChange={(e) => setDraft({ ...draft, bannedPhrases: e.target.value.split('\n') })} onBlur={() => onChange({ ...draft, bannedPhrases: lines(draft.bannedPhrases.join('\n')) })} /></label>
      </section>

      {draft.styleDna && (
        <section className="sec">
          <div className="sec-h"><span className="mono">05</span><h2>문체·형식 분석</h2><small>예시 글에서 계산한 통계와 규칙</small></div>
          <div className="info">
            <div className="row"><span>평균 문장</span><span>{draft.styleDna.avgSentenceLen}자 · 문단당 {draft.styleDna.avgParagraphSentences}문장 · 이모지 1000자당 {draft.styleDna.emojiPer1000}</span></div>
            <div className="row"><span>종결어미</span><span className="mono">{Object.entries(draft.styleDna.endingRatios).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(' · ')}</span></div>
          </div>
          <div className="row-f" style={{ marginTop: 12 }}>
            <label className="f"><span>인사말</span><input type="text" value={draft.styleDna.greeting} onChange={(e) => setDraft({ ...draft, styleDna: { ...draft.styleDna!, greeting: e.target.value } })} onBlur={() => onChange(draft)} /></label>
            <label className="f"><span>마무리</span><input type="text" value={draft.styleDna.closing} onChange={(e) => setDraft({ ...draft, styleDna: { ...draft.styleDna!, closing: e.target.value } })} onBlur={() => onChange(draft)} /></label>
          </div>
          <label className="f"><span>문체 규칙 (한 줄에 하나)</span><textarea style={{ minHeight: 160 }} value={draft.styleDna.rules.join('\n')} onChange={(e) => setDraft({ ...draft, styleDna: { ...draft.styleDna!, rules: e.target.value.split('\n') } })} onBlur={() => onChange({ ...draft, styleDna: { ...draft.styleDna!, rules: lines(draft.styleDna!.rules.join('\n')) } })} /></label>
        </section>
      )}
    </>
  )
}

function ContactAssets({ c, onSave }: { c: Client; onSave: (c: Client) => Promise<void> }) {
  const { reloadClients } = useApp()
  const [d, setD] = useState(c)
  useEffect(() => setD(c), [c])
  const contact = d.contact ?? {}
  const links = contact.links ?? []
  const setContact = (patch: Partial<NonNullable<Client['contact']>>) => setD({ ...d, contact: { ...contact, ...patch } })
  const commit = () => onSave(d)

  async function pick() {
    const r = await api('assets.pickPhoto', c.id)
    if (r) await reloadClients()
  }

  return (
    <>
      <section className="sec">
        <div className="sec-h"><span className="mono">CONTACT</span><h2>연락처·링크</h2><small>본문의 전화문의 박스와 링크 카드에 자동으로 들어갑니다</small></div>
        <div className="row-f">
          <label className="f"><span>전화번호</span><input type="tel" value={contact.phone ?? ''} onChange={(e) => setContact({ phone: e.target.value })} onBlur={commit} placeholder="0507-0000-0000" /></label>
          <label className="f"><span>예약 링크</span><input type="url" value={contact.bookingUrl ?? ''} onChange={(e) => setContact({ bookingUrl: e.target.value })} onBlur={commit} placeholder="https://booking.naver.com/..." /></label>
          <label className="f"><span>지도 장소명</span><input type="text" value={contact.placeName ?? ''} onChange={(e) => setContact({ placeName: e.target.value })} onBlur={commit} placeholder="네이버 지도에 등록된 이름" /></label>
        </div>
        <span className="hint">고정 링크 (진료철학 글, 원장 소개 등 — 작성 시 링크 카드로 넣을 수 있는 목록)</span>
        {links.map((l, i) => (
          <div className="row-f" key={i} style={{ marginTop: 8 }}>
            <input type="text" value={l.label} placeholder="제목" onChange={(e) => setContact({ links: links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} onBlur={commit} />
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="url" value={l.url} placeholder="https://" onChange={(e) => setContact({ links: links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} onBlur={commit} />
              <button className="icon-btn" onClick={() => onSave({ ...d, contact: { ...contact, links: links.filter((_, j) => j !== i) } })} aria-label="삭제"><Icon name="close" size={16} /></button>
            </div>
          </div>
        ))}
        <button className="btn sm text" style={{ marginTop: 8 }} onClick={() => setContact({ links: [...links, { label: '', url: '' }] })}><Icon name="plus" size={14} />링크 추가</button>
      </section>

      <section className="sec">
        <div className="sec-h"><span className="mono">IMAGE</span><h2>이미지 자산</h2><small>썸네일·인포그래픽 자동 생성에 쓰입니다</small></div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 16 }}>
          <div className="av" style={{ width: 88, height: 88, borderRadius: 20, overflow: 'hidden', background: 'var(--surface-3)', display: 'grid', placeItems: 'center', color: 'var(--mute)' }}>
            {d.assets?.doctorPhoto ? <img src={imgUrl(d.assets.doctorPhoto)} alt="원장 사진" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="camera" size={28} />}
          </div>
          <div>
            <button className="btn sm" onClick={pick}><Icon name="image" size={15} />{d.assets?.doctorPhoto ? '원장 사진 바꾸기' : '원장 사진 넣기'}</button>
            <p className="hint" style={{ marginTop: 6 }}>배경이 단순한 상반신 사진이 썸네일에 가장 잘 어울립니다.</p>
          </div>
        </div>
        <label className="f"><span>AI 이미지 공통 스타일 (비우면 기본: 아이보리·청록 톤의 부드러운 3D 렌더)</span>
          <input type="text" value={d.assets?.imageStyle ?? ''} onChange={(e) => setD({ ...d, assets: { ...(d.assets ?? {}), imageStyle: e.target.value } })} onBlur={commit} placeholder="예: warm beige and teal palette, soft 3D dental render, clean Korean typography" />
        </label>
      </section>
    </>
  )
}
