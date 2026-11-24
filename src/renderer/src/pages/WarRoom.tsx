import { useEffect, useMemo, useState } from 'react'
import type { Angle, TitleCandidate } from '@shared/types'
import type { BattleView } from '@shared/api'
import { customerWords, intentMix, LEVERS, leverAudit, readingLoad, titleTriggers, triggerDistribution } from '@shared/analysis/psych'
import { useApp } from '../lib/ctx'
import { api, ymd } from '../lib/api'
import Icon from '../components/Icon'

const STEPS = ['키워드', '상위노출 분석', '고객 심리', '컨셉', '제목', '원고'] as const

export default function WarRoom() {
  const { clients, clientId, setClientId, keyword, setKeyword, run, busy, openPost } = useApp()
  const [step, setStep] = useState(0)
  const [input, setInput] = useState(keyword)
  const [battle, setBattle] = useState<BattleView | null>(null)
  const [angles, setAngles] = useState<Angle[]>([])
  const [angle, setAngle] = useState<Angle | null>(null)
  const [extra, setExtra] = useState('')
  const [titles, setTitles] = useState<TitleCandidate[]>([])
  const [title, setTitle] = useState('')
  const client = clients.find((c) => c.id === clientId)

  useEffect(() => {
    if (!keyword) return
    void api('battle.get', keyword).then((b) => {
      setBattle(b)
      if (b) setStep(b.hesitation ? 3 : 2)
    })
  }, [keyword])

  const reached = [true, !!battle, !!battle, !!battle?.hesitation, !!angle, !!title]

  async function analyze(force = false) {
    const k = input.trim()
    if (!k) return
    setKeyword(k)
    setAngles([]); setAngle(null); setTitles([]); setTitle('')
    const b = await run('상위노출 분석', () => api('battle.analyze', k, force))
    if (b) { setBattle(b); setStep(1) }
  }
  async function psych() {
    const h = await run('고객 심리 분석', () => api('battle.hesitation', keyword))
    if (h) { setBattle((b) => (b ? { ...b, hesitation: h } : b)); setStep(2) }
  }
  async function makeAngles() {
    if (!clientId) return alert('먼저 위에서 업체를 선택하세요')
    const a = await run('컨셉 생성', () => api('write.angles', clientId, keyword, extra))
    if (a) { setAngles(a); setAngle(null); setStep(3) }
  }
  async function makeTitles(a: Angle) {
    setAngle(a)
    const t = await run('제목 생성', () => api('write.titles', clientId, keyword, a))
    if (t) { setTitles(t); setTitle(t[0]?.text ?? ''); setStep(4) }
  }
  async function write() {
    if (!angle || !title.trim()) return
    const p = await run('원고 작성', () => api('write.article', clientId, keyword, angle, title.trim()))
    if (p) openPost(p)
  }

  return (
    <>
      <div className="page-head">
        <div className="kicker">
          <span>{client ? client.name : '업체 미선택'}</span>
          {battle && <span>수집 {ymd(battle.serp.fetchedAt)}</span>}
          {battle && <span>상위글 {battle.competitors.length}개 분석</span>}
        </div>
        <h1>{keyword || '원고 작성'}</h1>
        <p>상위노출 글과 검색자의 심리를 분석한 뒤, 경쟁 글이 다루지 않은 지점을 공략하는 원고를 씁니다.</p>
      </div>

      <div className="steps">
        {STEPS.map((s, i) => (
          <button key={s} data-step={i} className={(step === i ? 'on ' : '') + (reached[i] && i < step ? 'done' : '')} disabled={!reached[i]} onClick={() => setStep(i)}>
            <span className="mono">{i + 1}</span>
            <b>{s}</b>
          </button>
        ))}
      </div>

      {step === 0 && (
        <section className="sec" style={{ maxWidth: 760 }}>
          <div className="row-f">
            <label className="f">
              <span>업체</span>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">선택</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.brain ? '' : ' (업체 정보 없음)'}</option>)}
              </select>
            </label>
            <label className="f">
              <span>메인 키워드</span>
              <input type="text" value={input} placeholder="예: 대구임플란트" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && analyze()} />
            </label>
          </div>
          <div className="btns">
            <button className="btn pri" id="go-analyze" disabled={busy || !input.trim()} onClick={() => analyze(false)}><Icon name="search" size={18} />분석 시작</button>
            {battle && <button className="btn ghost" disabled={busy} onClick={() => analyze(true)}><Icon name="refresh" size={16} />다시 수집</button>}
          </div>
          <p className="hint" style={{ marginTop: 12 }}>수집은 이 PC의 브라우저로 진행되며 비용이 들지 않습니다. 같은 키워드는 24시간 동안 다시 수집하지 않습니다.</p>
        </section>
      )}

      {step === 1 && battle && <SerpView b={battle} onNext={psych} busy={busy} />}

      {step === 2 && battle && (
        battle.hesitation ? (
          <PsychView b={battle} onNext={() => setStep(3)} />
        ) : (
          <div className="empty">
            상위글 {battle.competitors.length}개와 지식iN 질문을 함께 읽고 검색자의 고민·감정·심리 기제를 분석합니다. (Haiku, 1~2원)
            <div><button className="btn pri" id="go-psych" disabled={busy} onClick={psych}><Icon name="sparkle" size={18} />심리 분석 실행</button></div>
          </div>
        )
      )}

      {step === 3 && (
        <div className="cols">
          <div>
            {angles.length === 0 && <div className="empty">오른쪽에서 컨셉을 받아 보세요.</div>}
            <div className="picks">
              {angles.map((a, i) => (
                <button key={a.id} className={'pick' + (angle?.id === a.id ? ' on' : '')} onClick={() => makeTitles(a)} disabled={busy}>
                  <span className="mono">컨셉 {i + 1} · {a.persona}</span>
                  <h3>{a.name}</h3>
                  <p>{a.hook}</p>
                  <p><b>해소할 고민</b>{a.hesitationsSolved.join(' · ')}</p>
                  <p><b>연결할 강점</b>{a.strengthsUsed.join(' · ') || '—'}</p>
                  <p><b>차별점</b>{a.whyWin}</p>
                  <div className="tags" style={{ marginTop: 10 }}>{a.outline.map((o, k) => <span key={k} className="tag">{k + 1}. {o}</span>)}</div>
                </button>
              ))}
            </div>
          </div>
          <aside className="panel sticky">
            <h3>원고 컨셉</h3>
            <label className="f">
              <span>이번 원고에서 강조할 점 (선택)</span>
              <textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="예: 이번 달은 수면 진료 장비 강조" />
            </label>
            <button className="btn pri" id="go-angles" disabled={busy || !clientId} onClick={makeAngles}>{angles.length ? '다시 받기' : '컨셉 3개 받기'}</button>
            <p className="hint" style={{ marginTop: 10 }}>컨셉을 고르면 바로 제목 후보를 만듭니다. 업체 정보와 분석 결과는 캐시되어 이후 호출 비용이 줄어듭니다.</p>
          </aside>
        </div>
      )}

      {step === 4 && battle && (
        <div className="cols">
          <div>
            <div className="sec-h"><h2>제목 후보</h2><small>키워드 위치·길이·구체성·호기심·상위 제목과의 차별도로 채점</small></div>
            <div className="picks">
              {titles.map((t) => (
                <button key={t.text} className={'pick' + (title === t.text ? ' on' : '')} onClick={() => setTitle(t.text)}>
                  <span className="mono">{t.rationale}</span>
                  <h3>{t.text}</h3>
                  <div className="tags" style={{ marginTop: 6 }}>{titleTriggers(t.text).map((x) => <span key={x} className="pill">{x}</span>)}</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div className="bar acc" style={{ flex: 1 }}><i style={{ width: `${t.score}%` }} /></div>
                    <span className="score">{t.score}</span>
                  </div>
                  {t.breakdown && <p className="hint">{Object.entries(t.breakdown).map(([k, v]) => `${LABEL[k] ?? k} ${v}`).join(' · ')}</p>}
                </button>
              ))}
            </div>
          </div>
          <aside className="panel sticky">
            <h3>상위노출 제목</h3>
            <ol className="plain" style={{ marginBottom: 16 }}>
              {battle.serp.blogTop.map((p) => <li key={p.url} className="mute">{p.rank}. {p.title}</li>)}
            </ol>
            <label className="f">
              <span>최종 제목 (수정 가능)</span>
              <textarea value={title} onChange={(e) => setTitle(e.target.value)} style={{ minHeight: 64 }} />
            </label>
            <div className="btns">
              <button className="btn pri" id="go-write" disabled={busy || !title.trim()} onClick={write}><Icon name="quill" size={18} />원고 작성</button>
              <button className="btn ghost" disabled={busy || !angle} onClick={() => angle && makeTitles(angle)}>다시 받기</button>
            </div>
          </aside>
        </div>
      )}

      {step === 5 && <div className="empty">원고는 작성 후 원고 검수 화면에서 열립니다.</div>}
    </>
  )
}

const LABEL: Record<string, string> = { keywordFront: '키워드 위치', length: '길이', specificity: '구체성', curiosity: '호기심', differentiation: '차별도', freshness: '중복 회피' }

function Meter({ label, value, max = 100, unit = '%', note, gold }: { label: string; value: number; max?: number; unit?: string; note?: string; gold?: boolean }) {
  return (
    <div className="meter-row">
      <span>{label}</span>
      <div className={'track' + (gold ? ' gold' : '')}><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
      <b>{value}{unit}</b>
      {note && <small>{note}</small>}
    </div>
  )
}

function SerpView({ b, onNext, busy }: { b: BattleView; onNext: () => void; busy: boolean }) {
  const { serp, competitors, bench } = b
  const load = useMemo(() => {
    const all = competitors.map((c) => readingLoad(c.text, c.metrics.images))
    const avg = (f: (x: (typeof all)[number]) => number) => Math.round(all.reduce((a, x) => a + f(x), 0) / Math.max(1, all.length))
    return { sentence: avg((x) => x.sentenceLen), line: avg((x) => x.lineLen), perImg: avg((x) => x.charsPerImage) }
  }, [competitors])
  const triggers = useMemo(() => triggerDistribution(serp.blogTop.map((p) => p.title)), [serp])
  return (
    <>
      <div className="stats">
        <div className="hero"><span className="mono">상위글 평균 글자수</span><b>{bench.chars.toLocaleString()}</b><small>자</small></div>
        <div><span className="mono">평균 이미지</span><b>{bench.images}</b><small>장</small></div>
        <div><span className="mono">평균 소제목</span><b>{bench.headings}</b><small>개</small></div>
        <div><span className="mono">키워드 반복</span><b>{bench.keywordCount}</b><small>회</small></div>
        <div><span className="mono">이미지 1장당 글자</span><b>{load.perImg}</b><small>자</small></div>
        <div><span className="mono">평균 문장 길이</span><b>{load.sentence}</b><small>자</small></div>
      </div>

      <div className="cols">
        <div>
          <section className="sec">
            <div className="sec-h"><h2>블로그탭 상위 10</h2><small>본문은 상위 {competitors.length}개를 읽었습니다</small></div>
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>순위</th><th>제목</th><th>블로그</th><th>발행</th><th>글자</th><th>사진</th><th>키워드</th></tr></thead>
                <tbody>
                  {serp.blogTop.map((p) => {
                    const c = competitors.find((x) => x.url === p.url)
                    return (
                      <tr key={p.url}>
                        <td><b>{p.rank}</b></td>
                        <td><button className="wl" onClick={() => api('shell.open', p.url)}>{p.title}</button></td>
                        <td className="hint">{p.blogName}</td>
                        <td className="hint">{p.date}</td>
                        <td>{c?.metrics.chars ?? '—'}</td>
                        <td>{c?.metrics.images ?? '—'}</td>
                        <td>{c ? `${c.metrics.keywordCount}${c.metrics.keywordInTitle ? '' : ' (제목X)'}` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="sec">
            <div className="sec-h"><h2>상위 제목의 심리 트리거</h2><small>경쟁 제목이 어떤 장치로 클릭을 끄는지 — 적게 쓰인 트리거가 차별화 여지</small></div>
            {triggers.map((t) => <Meter key={t.name} label={t.name} value={t.count} max={Math.max(1, serp.blogTop.length)} unit={`/${serp.blogTop.length}`} gold={t.count <= 1} />)}
          </section>

          <section className="sec">
            <div className="sec-h"><h2>통합검색 구성</h2><small>스마트블록 제목은 네이버가 판단한 검색 의도입니다</small></div>
            <ol className="flow">
              {serp.sections.map((s) => (
                <li key={s.order} className={s.kind === 'blog' || s.kind === 'smartblock' ? 'break' : ''}>
                  <span>{KIND[s.kind] ?? s.kind}</span>
                  <p>{s.title}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="panel sticky">
          <h3>자동완성</h3>
          <div className="tags">{serp.autocomplete.map((k) => <span className="tag" key={k}>{k}</span>)}{!serp.autocomplete.length && <span className="hint">없음</span>}</div>
          <h3>연관검색어</h3>
          <div className="tags">{serp.related.map((k) => <span className="tag" key={k}>{k}</span>)}{!serp.related.length && <span className="hint">없음</span>}</div>
          <h3>지식iN 질문</h3>
          <ul className="plain">{serp.kinQuestions.slice(0, 8).map((q) => <li key={q}>{q}</li>)}</ul>
          {serp.screenshotPath && <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => api('shell.open', serp.screenshotPath!)}><Icon name="image" size={15} />통합검색 캡처</button>}
          <div className="hr" />
          <button className="btn pri" id="go-psych2" disabled={busy} onClick={onNext}><Icon name="sparkle" size={18} />{b.hesitation ? '고객 심리 보기' : '고객 심리 분석'}</button>
        </aside>
      </div>
    </>
  )
}

const KIND: Record<string, string> = { powerlink: '광고', place: '플레이스', blog: '블로그', cafe: '카페', kin: '지식iN', smartblock: '스마트블록', video: '동영상', news: '뉴스', image: '이미지', web: '웹문서', other: '기타' }
const TABS = ['고민 지도', '페르소나', '감정·심리 기제', '설득 장치', '검색 의도', '고객 언어', '반론 처리'] as const

function PsychView({ b, onNext }: { b: BattleView; onNext: () => void }) {
  const h = b.hesitation!
  const [tab, setTab] = useState<(typeof TABS)[number]>('고민 지도')
  const ranks = b.competitors.map((c) => c.rank)
  const audit = useMemo(() => leverAudit(b.competitors.map((c) => ({ label: `${c.rank}위`, text: c.text }))), [b])
  const intent = useMemo(() => intentMix([b.serp.keyword, ...b.serp.autocomplete, ...b.serp.related, ...b.serp.kinQuestions]), [b])
  const words = useMemo(() => customerWords(b.serp.kinQuestions, [b.serp.keyword]), [b])
  const biasCount = useMemo(() => {
    const m: Record<string, number> = {}
    h.hesitations.forEach((x) => x.bias && (m[x.bias] = (m[x.bias] ?? 0) + (x.intensity ?? 1)))
    return Object.entries(m).sort((a, c) => c[1] - a[1])
  }, [h])
  const uncovered = h.hesitations.filter((x) => x.coveredBy.length === 0).length

  return (
    <div className="cols">
      <div>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t}{t === '고민 지도' && uncovered ? <small>공백 {uncovered}</small> : null}{t === '설득 장치' && audit.open.length ? <small>여지 {audit.open.length}</small> : null}
            </button>
          ))}
        </div>

        {tab === '고민 지도' && (
          <section className="sec">
            <div className="sec-h"><h2>고객 고민 × 상위글</h2><small>■ 해소함 □ 다루지 않음 · 노란 표시 = 아무도 해소하지 않은 고민</small></div>
            <div className="scroll-x">
              <table className="matrix">
                <thead><tr><th>고민 · 심리 기제 · 강도</th>{ranks.map((r) => <th key={r}>{r}위</th>)}</tr></thead>
                <tbody>
                  {[...h.hesitations].sort((a, c) => (c.intensity ?? 0) - (a.intensity ?? 0)).map((x) => (
                    <tr key={x.issue} className={x.coveredBy.length === 0 ? 'gap' : ''}>
                      <td>
                        <b>{x.issue}</b> {x.bias && <span className="pill gold">{x.bias}</span>} {x.intensity ? <span className="pill">강도 {x.intensity}/5</span> : null}
                        <small>{x.detail}</small>
                        <small>근거 · {x.evidence}</small>
                        {x.copyAngle && <small style={{ color: 'var(--primary)', fontWeight: 700 }}>원고 방향 · {x.copyAngle}</small>}
                      </td>
                      {ranks.map((r) => <td key={r} className={x.coveredBy.includes(r) ? 'hit' : 'miss'} />)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === '페르소나' && h.persona && (
          <section className="sec">
            <div className="sec-h"><h2>대표 검색자</h2><small>검색어·질문·상위글 반응에서 추정</small></div>
            <div className="persona">
              <div className="wide"><span>한 줄 요약</span><p>{h.persona.label}</p></div>
              <div><span>연령대</span><p>{h.persona.age}</p></div>
              <div><span>검색 계기</span><p>{h.persona.trigger}</p></div>
              <div><span>지금 상황</span><p>{h.persona.situation}</p></div>
              <div><span>겉으로 말하는 니즈</span><p>{h.persona.coreNeed}</p></div>
              <div><span>숨은 니즈</span><p>{h.persona.hiddenNeed}</p></div>
              <div><span>끝까지 남는 반론</span><p>{h.persona.objection}</p></div>
            </div>
          </section>
        )}

        {tab === '감정·심리 기제' && (
          <>
            <section className="sec">
              <div className="sec-h"><h2>감정 온도</h2><small>검색어·질문 표현에서 읽힌 감정의 세기</small></div>
              {(h.emotions ?? []).map((e) => <Meter key={e.emotion} label={e.emotion} value={e.score} max={5} unit="/5" note={`단서 · ${e.cue}`} />)}
            </section>
            <section className="sec">
              <div className="sec-h"><h2>심리 기제 분포</h2><small>고민 강도를 합산 — 원고가 먼저 풀어야 할 마음의 작동 방식</small></div>
              {biasCount.map(([k, v]) => <Meter key={k} label={k} value={v} max={Math.max(...biasCount.map((x) => x[1]))} unit="" gold />)}
            </section>
            <section className="sec">
              <div className="sec-h"><h2>결정 장벽과 촉진 요인</h2></div>
              <div className="two-col">
                <div><h4>결정을 막는 것</h4><ul className="plain check">{(h.barriers ?? []).map((x) => <li key={x}>{x}</li>)}</ul></div>
                <div><h4>결정을 밀어 주는 것</h4><ul className="plain check">{(h.drivers ?? []).map((x) => <li key={x}>{x}</li>)}</ul></div>
              </div>
            </section>
          </>
        )}

        {tab === '설득 장치' && (
          <section className="sec">
            <div className="sec-h"><h2>상위글 설득 장치 비교</h2><small>문장 단위로 센 사용 횟수 · 대부분 쓰는 장치는 차별화가 안 되고, 거의 안 쓰는 장치가 공략 여지</small></div>
            <div className="scroll-x">
              <table className="heat">
                <thead><tr><th>장치</th>{audit.matrix.map((m) => <th key={m.label}>{m.label}</th>)}<th>사용 글</th></tr></thead>
                <tbody>
                  {LEVERS.map((l) => {
                    const max = Math.max(1, ...audit.matrix.map((m) => m.counts[l.key]))
                    const cov = Math.round(audit.coverage[l.key] * 100)
                    return (
                      <tr key={l.key}>
                        <td><b>{l.name}</b> {audit.open.includes(l.key) && <span className="pill pri">공략 여지</span>}{audit.saturated.includes(l.key) && <span className="pill">포화</span>}<small>{l.desc}</small></td>
                        {audit.matrix.map((m) => {
                          const v = m.counts[l.key]
                          return <td key={m.label} className="c" style={{ background: v ? `color-mix(in srgb, var(--primary) ${Math.round((v / max) * 55) + 8}%, transparent)` : 'transparent', color: v / max > 0.6 ? 'var(--on-primary)' : 'var(--ink)' }}>{v || ''}</td>
                        })}
                        <td><b>{cov}%</b></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === '검색 의도' && (
          <section className="sec">
            <div className="sec-h"><h2>검색 의도 단계</h2><small>메인·자동완성·연관 검색어·질문 {1 + b.serp.autocomplete.length + b.serp.related.length + b.serp.kinQuestions.length}개 분류 — 결정 직전 비중이 높으면 비교표·체크리스트가 효과적</small></div>
            {intent.map((x) => <Meter key={x.stage} label={x.stage} value={x.share} note={x.examples.join(' · ')} />)}
          </section>
        )}

        {tab === '고객 언어' && (
          <section className="sec">
            <div className="sec-h"><h2>고객이 실제로 쓰는 말</h2><small>지식iN 질문 {b.serp.kinQuestions.length}개에서 자주 나온 표현 — 원고의 질문 문장·소제목에 그대로 쓰면 공감도가 올라갑니다</small></div>
            <div className="cloud" style={{ marginBottom: 18 }}>
              {words.map((w) => <span key={w.word} style={{ fontSize: 13 + Math.min(14, w.count * 4) }}>{w.word}<i>{w.count}</i></span>)}
              {!words.length && <span className="hint">질문 데이터가 부족합니다</span>}
            </div>
            <ul className="plain">{b.serp.kinQuestions.map((q) => <li key={q}>“{q}”</li>)}</ul>
          </section>
        )}

        {tab === '반론 처리' && (
          <section className="sec">
            <div className="sec-h"><h2>속으로 하는 반론과 답</h2><small>원고의 FAQ·문단에 그대로 녹입니다</small></div>
            <table className="tbl">
              <thead><tr><th>검색자의 반론</th><th>원고에서의 답</th></tr></thead>
              <tbody>{(h.objections ?? []).map((o) => <tr key={o.objection}><td><b>“{o.objection}”</b></td><td>{o.reply}</td></tr>)}</tbody>
            </table>
          </section>
        )}
      </div>

      <aside className="panel sticky">
        <h3>검색 의도</h3>
        <p style={{ marginBottom: 14 }}>{h.searchIntent}</p>
        <h3>공략 포인트</h3>
        <ul className="plain check" style={{ marginBottom: 14 }}>{h.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
        <h3>경쟁 소구점</h3>
        <div className="tags" style={{ marginBottom: 14 }}>{h.appeals.map((a) => <span key={a.point} className="tag">{a.point} <b>{a.posts.length}</b></span>)}</div>
        <h3>상위글 공통 형식</h3>
        <p className="hint" style={{ marginBottom: 16 }}>{h.commonStructure}</p>
        <button className="btn pri" id="go-concept" onClick={onNext}>컨셉 정하기 <Icon name="arrow" size={16} /></button>
      </aside>
    </div>
  )
}
