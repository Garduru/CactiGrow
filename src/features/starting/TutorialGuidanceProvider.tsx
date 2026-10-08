import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useStartingExperience } from './StartingContext'
import { useWorldLocation } from '../../game-world/WorldLocationContext'
import { useFeaturePanel } from '../menu/featurePanelState'
import { resolveTutorialGuidance, type Guidance } from './tutorialGuidance'
import { TutorialGuidanceContext } from './TutorialGuidanceContext'

/** Presentation only: registered real targets; never posts gameplay completion. */
export function TutorialGuidanceProvider({ children }: { children: ReactNode }) {
  const tutorial = useStartingExperience(), world = useWorldLocation(), route = useLocation(), panels = useFeaturePanel()
  const [guidance, setGuidance] = useState<Guidance>({ target: null, instruction: '' })
  useEffect(() => {
    const apply = () => {
      const targets = [...document.querySelectorAll<HTMLElement>('[data-tutorial-target]')]
      const available = new Set(targets.map(element => element.dataset.tutorialTarget!))
      const next = resolveTutorialGuidance(tutorial.active ? tutorial.state : null, { path: route.pathname, areaId: world.location?.areaId, inventoryOpen: panels.feature === 'inventory', available })
      for (const element of targets) {
        if (element.dataset.tutorialTarget === next.target) element.dataset.tutorialHighlight = 'true'
        else delete element.dataset.tutorialHighlight
      }
      setGuidance(previous => previous.target === next.target && previous.instruction === next.instruction ? previous : next)
    }
    apply()
    // Panel/specimen controls mount normally. Attribute changes are deliberately not observed.
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); document.querySelectorAll('[data-tutorial-highlight]').forEach(element => element.removeAttribute('data-tutorial-highlight')) }
  }, [tutorial.active, tutorial.state, route.pathname, world.location?.areaId, panels.feature])
  return <TutorialGuidanceContext.Provider value={guidance}>{children}</TutorialGuidanceContext.Provider>
}
