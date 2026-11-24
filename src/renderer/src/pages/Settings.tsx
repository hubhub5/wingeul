import { useEffect, useState } from 'react'
import { useApp } from '../lib/ctx'
import { api, krw, usd } from '../lib/api'
import Maker from '../components/Maker'

const MODELS = [
  ['claude-haiku-5-5', 'Haiku 5.5 — 가장 저렴 ($0.10 / $0.50)'],
  ['claude-sonnet-5-5', 'Sonnet 5.5 — 권장 ($2 / $10)'],
  ['claude-opus-5-5', 'Opus 5.5 — 최고 품질 ($4 / $20)'],
]

export default function SettingsPage() {
  const { settings, reloadSettings, cost, reloadCost } = useApp()
  const [key, setKey] = useState('')
  const [gkey, setGkey] = useState('')
  const [models, setModels] = useState<Record<string, { label: string; usd: number }>>({})
  useEffect(() => { void api('app.info').then((i) => setModels(i.imageModels)) }, [])
  const [s, setS] = useState(settings)
  const [saved, setSaved] = useState(false)
  useEffect(() => setS(settings), [settings])
  useEffect(() => { void reloadCost() }, [reloadCost])
  if (!s) return null

  async function save() {
    await api('settings.set', {
      analysisModel: s!.analysisModel,
      writingModel: s!.writingModel,
      monthlyBudgetUsd: s!.monthlyBudgetUsd,
      targetChars: s!.targetChars,
      imageModel: s!.imageModel,
      ...(key ? { apiKey: key } : {}),
      ...(gkey ? { geminiKey: gkey } : {}),
    })
    setKey('')
    setGkey('')
    await reloadSettings()
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <>
      <div className="page-head">
        <div className="kicker"><span>설정</span><span>키는 이 PC의 키체인에 암호화 저장</span>{s.mock && <span>모의 모드 실행 중</span>}</div>
        <h1>설정과 비용</h1>
      </div>
      <div className="cols">
        <div>
          <section className="sec">
            <div className="sec-h"><span className="mono">01</span><h2>Claude API 키</h2><small>{s.hasApiKey ? '등록됨' : '미등록'}</small></div>
            <label className="f"><span>console.anthropic.com → API Keys에서 발급한 키</span><input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={s.hasApiKey ? '변경할 때만 입력' : 'sk-ant-...'} /></label>
          </section>
          <section className="sec">
            <div className="sec-h"><span className="mono">IMAGE</span><h2>이미지 생성 (선택)</h2><small>{s.hasGeminiKey ? 'Gemini 키 등록됨' : '키가 없으면 무료 로컬 카드로 생성'}</small></div>
            <label className="f"><span>Gemini API 키 — aistudio.google.com 에서 발급</span><input type="password" value={gkey} onChange={(e) => setGkey(e.target.value)} placeholder={s.hasGeminiKey ? '변경할 때만 입력' : 'AIza...'} /></label>
            <label className="f"><span>이미지 모델</span>
              <select value={s.imageModel} onChange={(e) => setS({ ...s, imageModel: e.target.value })}>
                {Object.entries(models).map(([v, m]) => <option key={v} value={v}>{m.label} (장당 약 ${m.usd})</option>)}
              </select>
            </label>
            <p className="hint">인포그래픽·썸네일은 Gemini로, 텍스트 카드는 앱 안에서 무료로 그립니다. 이미지 안 문구는 본문 작성 때 함께 만들어지므로 이미지 단계에서 Claude 비용은 없습니다.</p>
          </section>

          <section className="sec">
            <div className="sec-h"><span className="mono">02</span><h2>모델과 예산</h2></div>
            <div className="row-f">
              <label className="f"><span>분석용 (고객 심리)</span>
                <select value={s.analysisModel} onChange={(e) => setS({ ...s, analysisModel: e.target.value })}>{MODELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
              <label className="f"><span>작성용 (컨셉·제목·원고·업체 정보)</span>
                <select value={s.writingModel} onChange={(e) => setS({ ...s, writingModel: e.target.value })}>{MODELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
              <label className="f"><span>월 예산 상한 (USD) — 넘으면 호출 중단</span><input type="number" min={1} value={s.monthlyBudgetUsd} onChange={(e) => setS({ ...s, monthlyBudgetUsd: +e.target.value })} /></label>
              <label className="f"><span>목표 글자수 (공백 포함)</span><input type="number" min={600} step={100} value={s.targetChars} onChange={(e) => setS({ ...s, targetChars: +e.target.value })} /></label>
            </div>
            <button className="btn pri" onClick={save}>{saved ? '저장됨' : '저장'}</button>
          </section>
        </div>
        <aside className="panel sticky">
          <h3>이번 달 사용</h3>
          {cost && (
            <>
              <p style={{ fontSize: 22, fontWeight: 800 }}>{usd(cost.monthUsd)} <span className="hint">≈ {krw(cost.monthUsd)}</span></p>
              <div className="bar acc" style={{ marginBottom: 6 }}><i style={{ width: `${Math.min(100, (cost.monthUsd / cost.budgetUsd) * 100)}%` }} /></div>
              <p className="hint" style={{ marginBottom: 14 }}>
                예산 {usd(cost.budgetUsd)} · 이번 달 원고 {cost.postsThisMonth}편 · 원고당 평균 {cost.postsThisMonth ? usd(cost.monthUsd / cost.postsThisMonth) : '—'}
              </p>
              <h3>단계별</h3>
              <table className="tbl" style={{ marginBottom: 14 }}><tbody>{Object.entries(cost.byStep).map(([k, v]) => <tr key={k}><td>{k}</td><td className="mono right">{usd(v)}</td></tr>)}</tbody></table>
              <h3>업체별</h3>
              <table className="tbl" style={{ marginBottom: 14 }}><tbody>{Object.entries(cost.byClient).map(([k, v]) => <tr key={k}><td>{k}</td><td className="mono right">{usd(v)}</td></tr>)}</tbody></table>
              <h3>최근 호출</h3>
              <ul className="plain">
                {cost.recent.slice(0, 12).map((c) => (
                  <li key={c.ts} className="mono">
                    {c.step} · {c.model.replace('claude-', '')} · 입력 {c.input} / 캐시 {c.cacheRead} / 출력 {c.output} · {usd(c.usd)}
                  </li>
                ))}
              </ul>
            </>
          )}
          <Maker compact />
        </aside>
      </div>
    </>
  )
}
