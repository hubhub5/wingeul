import photo from '../assets/maker.jpg'
import { api } from '../lib/api'

/** 만든 사람 카드 — 홈·설정에 표시 */
export default function Maker({ compact = false }: { compact?: boolean }) {
  return (
    <div className={'maker-card' + (compact ? ' compact' : '')}>
      <img src={photo} alt="WinGeul을 만든 사람" />
      <div>
        <span className="role">만든 사람</span>
        <b>1인 기업가들의 고객 확보를 돕습니다.</b>
        {!compact && <p>작은 사업이 블로그로 손님을 모으는 일을 돕고 있습니다.</p>}
        <div className="btns" style={{ marginTop: 10 }}>
          <button className="btn sm ghost" onClick={() => api('shell.open', 'https://github.com/hubhub5/wingeul/issues')}>문의·제안</button>
        </div>
      </div>
    </div>
  )
}
