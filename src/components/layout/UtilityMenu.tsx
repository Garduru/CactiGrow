import { useState } from 'react'
import { devToolsAvailable } from '../../config/deploymentMode'
import { useFeaturePanel, type FeatureId } from '../../features/menu/featurePanelState'
import { useAdminAccess } from '../../features/admin/adminAccess'

export function MenuDropdown({ onDismiss }: { onDismiss(): void }) {
  const [expanded, setExpanded] = useState<string[]>([])
  const { openFeature } = useFeaturePanel()
  const { session: staff } = useAdminAccess()
  function launch(feature: FeatureId) { onDismiss(); openFeature(feature) }
  return <nav id="hud-menu-dropdown" className="menu-dropdown" aria-label="Menu">
    {['Game', 'Social', 'Other'].map((category) => <section key={category}>
      <button type="button" className="menu-dropdown__category" aria-expanded={expanded.includes(category)} aria-controls={`menu-category-${category}`}
        onClick={() => setExpanded((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])}>
        <span aria-hidden="true">{expanded.includes(category) ? '\u25be' : '\u25b8'}</span> {category}
      </button>
      {expanded.includes(category) && <div id={`menu-category-${category}`} className="menu-dropdown__items">
        {category === 'Game' && (['skills', 'journal', 'research', 'achievements'] as const).map((feature) => <button key={feature} type="button" onClick={() => launch(feature)}>{feature[0].toUpperCase() + feature.slice(1)}</button>)}
        {category === 'Social' && <>
          <button type="button" onClick={() => launch('friends')}>Friends</button>
          <button type="button" onClick={() => launch('mail')}>Mail</button>
        </>}
        {category === 'Other' && <>
          <button type="button" onClick={() => launch('help')}>Help</button>
          <button type="button" onClick={() => launch('settings')}>Settings</button>
          <a href="https://cactiswap.com" target="_blank" rel="noopener noreferrer" onClick={onDismiss}>Visit CactiSwap</a>
          <button type="button" onClick={() => launch('signout')}>Sign Out</button>
          {devToolsAvailable() && <button type="button" onClick={() => launch('devtools')}>Developer Tools</button>}
          {staff?.permissions.includes('admin.access') && <button type="button" onClick={() => launch('admintools')}>Admin Tools</button>}
        </>}
      </div>}
    </section>)}
  </nav>
}
