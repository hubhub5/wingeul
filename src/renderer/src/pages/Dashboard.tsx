import { useEffect, useState } from 'react'
import type { Post } from '@shared/types'
import { useApp } from '../lib/ctx'
import { api, krw, usd, ymd } from '../lib/api'
import { Spark } from './Posts'

export default function Dashboard() {
  const { clients, cost, go, openPost, setClientId } = useApp()
  const [posts, setPosts] = useState<Post[]>([])
  useEffect(() => { void api('posts.list').then(setPosts) }, [])

  const drafts = posts.filter((p) => p.status === 'draft')
  const published = posts.filter((p) => p.status === 'published')
  const dropped = published.filter((p) => {
    const [a, b] = [p.ranks.at(-2)?.blogTab, p.ranks.at(-1)?.blogTab]
    return (a && !b) || (a && b && b - a >= 3)
  })
  const noBrain = clients.filter((c) => !c.brain)
  const top10 = published.filter((p) => (p.ranks.at(-1)?.blogTab ?? 99) <= 10).length

  return (
    <>
      <div className="page-head">
        <div className="kicker"><span>{new Date().toISOString().slice(0, 10).replace(/-/g, '.')}</span><span>업체 {clients.length}</span><span>원고 {posts.length}</span></div>
        <h1>오늘 할 일</h1>
      </div>

      <div className="stats">
        <div className="hero"><span className="mono">이번 달 원고</span><b>{cost?.postsThisMonth ?? 0}</b><small>편</small></div>
        <div><span className="mono">발행·추적 중</span><b>{published.length}</b><small>편</small></div>
        <div><span className="mono">블로그탭 10위 안</span><b>{top10}</b><small>편</small></div>
        <div><span className="mono">이번 달 API</span><b>{usd(cost?.monthUsd ?? 0)}</b><small>{krw(cost?.monthUsd ?? 0)}</small></div>
      </div>

      <div className="cols">
        <div>
          <section className="sec">
            <div className="sec-h"><span className="mono">01</span><h2>발행 대기 원고</h2><small>{drafts.length}편</small></div>
            {drafts.length === 0 ? <p className="hint">없음</p> : (
              <ul className="plain">{drafts.slice(0, 10).map((p) => <li key={p.id}><button className="wl" onClick={() => openPost(p)}>{p.title}</button> <span className="mono mute">{p.keyword} · {ymd(p.createdAt)}</span></li>)}</ul>
            )}
          </section>
          <section className="sec">
            <div className="sec-h"><span className="mono">02</span><h2>순위 하락 — 재작성 대상</h2><small>{dropped.length}편</small></div>
            {dropped.length === 0 ? <p className="hint">없음</p> : (
              <table className="tbl"><tbody>{dropped.map((p) => (
                <tr key={p.id}><td><button className="wl" onClick={() => openPost(p)}>{p.title}</button></td><td><Spark post={p} /></td><td className="mono">{p.ranks.at(-2)?.blogTab} → {p.ranks.at(-1)?.blogTab ?? '권외'}</td></tr>
              ))}</tbody></table>
            )}
          </section>
          <section className="sec">
            <div className="sec-h"><span className="mono">03</span><h2>최근 발행</h2></div>
            {published.length === 0 ? <p className="hint">아직 없음</p> : (
              <table className="tbl"><tbody>{published.slice(0, 10).map((p) => (
                <tr key={p.id}><td className="mono">{ymd(p.createdAt)}</td><td>{p.keyword}</td><td><button className="wl" onClick={() => openPost(p)}>{p.title}</button></td><td><Spark post={p} /></td></tr>
              ))}</tbody></table>
            )}
          </section>
        </div>
        <aside className="panel sticky">
          <h3>시작하기</h3>
          <ol className="flow" style={{ marginBottom: 16 }}>
            <li><span className="mono">1</span><p>설정에서 Claude API 키 입력</p></li>
            <li><span className="mono">2</span><p>업체 등록 후 업체 정보·예시 글 분석</p></li>
            <li className="break"><span className="mono">3</span><p>원고 작성에서 키워드로 원고 완성</p></li>
            <li><span className="mono">4</span><p>네이버용 복사 → 붙여넣기 → 주소 등록</p></li>
          </ol>
          <button className="btn pri" onClick={() => go('war')}>원고 작성</button>
          {noBrain.length > 0 && (
            <>
              <div className="hr" />
              <h3>업체 정보가 없는 업체</h3>
              <ul className="plain">{noBrain.map((c) => <li key={c.id}><button className="wl" onClick={() => { setClientId(c.id); go('clients') }}>{c.name}</button></li>)}</ul>
            </>
          )}
        </aside>
      </div>
    </>
  )
}
