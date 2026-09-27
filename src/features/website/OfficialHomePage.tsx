import { Link, useLocation } from 'react-router-dom'
import { CANONICAL_FARM_PATH } from '../../app/farmReturnNavigation'
import { NURSERY_V2_MAIN_ART } from '../../game-world/farmArtAssets'
import './website.css'

export function OfficialHomePage() {
  const location = useLocation()
  // Keep explicit local test options when launching; production ignores those options.
  const play = { pathname: CANONICAL_FARM_PATH, search: location.search }
  return (
    <div className="official-site">
      <a className="skip-link" href="#website-main">Skip to content</a>
      <header className="official-site__header">
        <Link to="/" aria-label="CactiGrow home"><img className="official-site__logo" src="/cactigrow-logo.png" alt="CactiGrow by CactiSwap" /></Link>
        <nav aria-label="Website navigation">
          <a href="#the-game">The game</a>
          <Link className="cg-button cg-button--primary" to={play}>PLAY NOW</Link>
        </nav>
      </header>
      <main id="website-main">
        <section className="official-site__hero" aria-labelledby="welcome-title">
          <div className="official-site__intro">
            <p className="official-site__eyebrow">The cactus-growing game</p>
            <h1 id="welcome-title">A world worth<br />growing into.</h1>
            <p>Plant your first seeds. Raise remarkable cacti. Make a little corner of the desert your own.</p>
            <Link className="cg-button cg-button--primary official-site__play" to={play}>PLAY NOW <span aria-hidden="true">→</span></Link>
            <p className="official-site__note">Your Farm is where it begins.</p>
          </div>
          <figure className="official-site__art">
            <img src={NURSERY_V2_MAIN_ART.path} width="620" height="430" alt="The CactiGrow Nursery, a sunlit greenhouse filled with cacti" fetchPriority="high" />
            <figcaption>A place to put down roots.</figcaption>
          </figure>
        </section>
        <section className="official-site__features" id="the-game" aria-label="Discover CactiGrow">
          <article><span aria-hidden="true">01</span><h2>Grow</h2><p>Tend your Nursery and watch your seeds become cactus specimens.</p></article>
          <article><span aria-hidden="true">02</span><h2>Discover</h2><p>Build your Garden collection and explore the genetics of your plants.</p></article>
          <article><span aria-hidden="true">03</span><h2>Explore</h2><p>Walk your Farm, visit its buildings, and take the road into Town.</p></article>
        </section>
      </main>
      <footer className="official-site__footer"><span>CactiGrow</span><p>An independent cactus-growing game.</p></footer>
    </div>
  )
}
