import { Link, Outlet } from 'react-router-dom'

export function PageLayout() {
  return (
    <div className="location-page">
      <Link className="farm-return" to="/">← Back to Farm</Link>
      <div className="location-page__content"><Outlet /></div>
    </div>
  )
}
