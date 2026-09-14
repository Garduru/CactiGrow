import { Link, Outlet, useLocation } from 'react-router-dom'
import { resolveFarmReturnPath } from '../../app/farmReturnNavigation'

export function PageLayout() {
  const location = useLocation()
  const farmReturnPath = resolveFarmReturnPath(location.state)
  const farmReturnLabel = location.pathname === '/town' ? '← Return to Farm' : '← Back to Farm'

  return (
    <div className="location-page">
      <Link className="farm-return cg-button cg-button--ghost" to={farmReturnPath}>{farmReturnLabel}</Link>
      <div className="location-page__content"><Outlet /></div>
    </div>
  )
}
