import { Link, useLocation } from 'react-router-dom'
import { CANONICAL_FARM_PATH } from '../../app/farmReturnNavigation'
import { getSpeciesById } from '../../data/species'
import './website.css'

const pillars = [
  ['Cultivate', 'Plant seeds, raise individual cactus specimens, and build a collection that stays with you.'],
  ['Research', 'Study your specimens to uncover traits, understand their genetics, and find breeding potential.'],
  ['Explore', 'Walk your Farm, follow the road to Town, and find your place in a world that is growing.'],
  ['Connect', 'Meet other growers, make friends, chat, and keep in touch through Mail.'],
] as const

export function OfficialHomePage() {
  const location = useLocation()
  // Keep explicit local test options when launching; production ignores those options.
  const play = { pathname: CANONICAL_FARM_PATH, search: location.search }
  const sanPedro = getSpeciesById('echinopsis-pachanoi')
  return (
    <div className="official-site">
      <a className="skip-link" href="#website-main">Skip to content</a>
      <header className="official-site__header">
        <Link to="/" aria-label="CactiGrow home"><img className="official-site__logo" src="/assets/branding/cactigrow-logo.png" alt="CactiGrow" width="1536" height="1024" /></Link>
        <nav aria-label="Website navigation"><Link className="official-site__header-play" to={play}>Play CactiGrow <span aria-hidden="true">↗</span></Link></nav>
      </header>
      <main id="website-main">
        <section className="official-site__hero" aria-labelledby="welcome-title">
          <div className="official-site__intro">
            <p className="official-site__eyebrow">A cactus-growing online world</p>
            <h1 id="welcome-title">Grow a collection.<br /><span>Build a legacy.</span></h1>
            <p>Raise unique cactus specimens, uncover their genetics, build your Farm, and explore a growing online world.</p>
            <Link className="cg-button cg-button--primary official-site__play" to={play}>Play CactiGrow <span aria-hidden="true">→</span></Link>
            <p className="official-site__note">Your Farm is only the beginning.</p>
          </div>
          <figure className="official-site__art official-site__nursery">
            <span className="official-site__art-label">01 / Your Nursery</span>
            <img src="/assets/website/nursery-v01.webp" width="1120" height="493" alt="The CactiGrow Nursery, a timber-and-glass greenhouse filled with cacti" fetchPriority="high" />
            <figcaption>From your first seed to a collection of your own.</figcaption>
          </figure>
        </section>
        <section className="official-site__features" aria-label="Discover CactiGrow">
          {pillars.map(([title, copy], index) => <article key={title}><span className="official-site__eyebrow">0{index + 1}</span><h2>{title}</h2><p>{copy}</p></article>)}
        </section>
        <section className="official-site__specimens official-site__split" aria-labelledby="specimen-title">
          <figure className="official-site__specimen-art">
            <div className="official-site__specimen-heading"><span className="official-site__eyebrow">Specimen spotlight</span><strong>{sanPedro?.commonName}</strong><em>{sanPedro?.scientificName}</em></div>
            <img src="/assets/website/san-pedro-v01.webp" width="256" height="384" alt="Mature San Pedro cactus from CactiGrow's in-game plant artwork" loading="lazy" />
            <figcaption>One plant. More to discover.</figcaption>
          </figure>
          <div className="official-site__section-copy">
            <p className="official-site__eyebrow">More than a crop</p>
            <h2 id="specimen-title">Every specimen<br />has a history.</h2>
            <p>A cactus is an individual worth keeping. Each specimen has its own identity, species, and genetic record. Bred specimens carry the lineage of their parents.</p>
            <dl className="official-site__records">
              <div><dt>Identity &amp; lineage</dt><dd>Follow the specimen, its clone line, and its parentage.</dd></div>
              <div><dt>Genetics &amp; discovery</dt><dd>Build lasting research knowledge as you study each clone line.</dd></div>
              <div><dt>A collection of your own</dt><dd>Keep Favorites, organize your Garden, and choose parents for your next cross.</dd></div>
            </dl>
          </div>
        </section>
        <section className="official-site__world official-site__split" aria-labelledby="world-title">
          <div className="official-site__section-copy">
            <p className="official-site__eyebrow">Beyond the greenhouse</p>
            <h2 id="world-title">Take the road<br />into Town.</h2>
            <p>Walk between your Farm's Nursery, Garden, and Genetics Lab. Then head to Town, meet other growers, and visit the Shop and Marketplace.</p>
            <p className="official-site__note">Farm and Town are the beginning. The world is still growing.</p>
          </div>
          <figure className="official-site__art official-site__town">
            <span className="official-site__art-label">02 / Around Town</span>
            <img src="/assets/website/town-shop-v01.webp" width="960" height="683" alt="The warm adobe storefront of CactiGrow's Town Shop" loading="lazy" />
            <figcaption>Your Farm is one place in a larger world.</figcaption>
          </figure>
        </section>
        <section className="official-site__social" aria-labelledby="social-title">
          <div><p className="official-site__eyebrow">Grow alongside others</p><h2 id="social-title">A familiar name. A new friend.</h2></div>
          <div><p>Find growers through player profiles and Friends. Talk in Local, Town, or World chat, or send a DM to someone online.</p><p>Leave a message in Mail for later, with seeds, currency, or an eligible specimen attached.</p></div>
        </section>
        <section className="official-site__final" aria-labelledby="play-title">
          <p className="official-site__eyebrow">Start with a seed</p>
          <h2 id="play-title">What will you grow?</h2>
          <p>Your first specimen is the start of your story.</p>
          <Link className="cg-button cg-button--primary official-site__play" to={play}>Play CactiGrow <span aria-hidden="true">→</span></Link>
        </section>
      </main>
      <footer className="official-site__footer"><span>CactiGrow</span><p>An independent cactus-growing game.</p></footer>
    </div>
  )
}
