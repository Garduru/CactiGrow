import { Link } from 'react-router-dom'
import { farmLocations } from './locations'
import { LocationArt } from './LocationArt'

export function FarmPage() {
  return (
    <section className="farm" aria-labelledby="farm-heading">
      <div className="farm__intro">
        <div><span className="eyebrow">Your patch of the desert</span><h1 id="farm-heading">The Farm</h1></div>
        <p>Take a little wander. See what grows.</p>
      </div>
      <nav className="farm-world" aria-label="Farm locations">
        <svg className="farm-world__terrain" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 140 130 60 213 109 328 35 440 133 582 65 690 119 829 41 1000 130V600H0Z" fill="#392d24" opacity=".5" />
          <path d="M500 640V306Q500 240 278 209M500 306Q502 242 738 209M500 338Q500 436 245 443M500 338Q500 436 757 443" fill="none" stroke="#75543b" strokeWidth="42" strokeLinecap="round" opacity=".48" />
          <path d="M500 640V306Q500 240 278 209M500 306Q502 242 738 209M500 338Q500 436 245 443M500 338Q500 436 757 443" fill="none" stroke="#a37b50" strokeWidth="2" strokeDasharray="2 14" opacity=".5" />
          <g fill="#91734c" opacity=".38"><ellipse cx="98" cy="311" rx="8" ry="4" /><ellipse cx="891" cy="361" rx="12" ry="5" /><ellipse cx="592" cy="173" rx="6" ry="3" /><ellipse cx="389" cy="529" rx="11" ry="4" /></g>
        </svg>
        <div className="farm-world__locations">
          {farmLocations.map((location) => (
            <Link key={location.id} to={location.to} className={`farm-location farm-location--${location.id}`}>
              <LocationArt location={location.id} />
              <span className="farm-location__sign">{location.label}<span aria-hidden="true">↗</span></span>
              <span className="farm-location__description">{location.description}</span>
            </Link>
          ))}
        </div>
        <span className="farm-world__caption">A little room to grow</span>
      </nav>
    </section>
  )
}
