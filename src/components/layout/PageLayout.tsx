import { Link, Outlet, useLocation } from 'react-router-dom'
import { resolveFarmReturnPath } from '../../app/farmReturnNavigation'

export function PageLayout() {
  const location = useLocation()
  const farmReturnPath = resolveFarmReturnPath(location.state)
  const farmReturnLabel = farmReturnPath === '/town' ? '← Back to Town' : '← Back to Farm'

  return (
    <div className="location-page">
      <Link data-tutorial-target="farm-return" className="farm-return cg-button cg-button--ghost" to={farmReturnPath} state={location.state}>{farmReturnLabel}</Link>
      <div className="location-page__content"><Outlet /></div>
    </div>
  )
}
