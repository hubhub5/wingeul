import photo from '../assets/maker.jpg'
import { api } from '../lib/api'

/** 만든 사람 카드 — 홈·설정에 표시 */
export default function Maker({ compact = false }: { compact?: boolean }) {
  return (
    <div className={'maker-card' + (compact ? ' compact' : '')}>
      <img src={photo} alt="WinGeul을 만든 사람" />
      <div>
        <span className="role">만든 사람 · Moist Marketer</span>
        <b>1인 기업가들의 고객 확보를 돕습니다.</b>
        {!compact && <p>작은 사업이 블로그·뉴스레터·브랜딩으로 손님을 모으는 방법을 연구하고, 마케팅 뉴스레터 Moist Notes를 548편 써 왔습니다.</p>}
        <div className="btns" style={{ marginTop: 10 }}>
          <button className="btn sm pri" onClick={() => api('shell.open', 'https://maily.so/moistnotes')}>Moist Notes</button>
          <button className="btn sm ghost" onClick={() => api('shell.open', 'https://github.com/hubhub5/wingeul/issues')}>문의·제안</button>
        </div>
      </div>
    </div>
  )
}
