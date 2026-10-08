import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ACCESSORY_STYLES, BODY_STYLES, HAIR_COLORS, HAIR_STYLES, HAT_STYLES, PANTS_COLORS, SHIRT_COLORS, SKIN_COLORS, DEFAULT_APPEARANCE, resolveCharacterAppearance, type CharacterAppearance } from '../../../shared/characters/appearance.ts'
import { CharacterPreview } from '../../characters/CharacterPreview'
import { useStartingExperience } from './StartingContext'
import { useWorldLocation } from '../../game-world/WorldLocationContext'
const SetupReset = (import.meta.env.MODE === 'staging' || import.meta.env.MODE === 'development') ? lazy(() => import('./StartingSetupReset')) : null
export function AppearanceSetup() {
  const tutorial = useStartingExperience()
  const [appearance, setAppearance] = useState(() => resolveCharacterAppearance(tutorial.state?.appearance ?? DEFAULT_APPEARANCE))
  const [step, setStep] = useState(0)
  const [previewReady, setPreviewReady] = useState(false)
  const shell = useRef<HTMLElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = shell.current
    if (!element) return
    const viewport = window.visualViewport
    const mobile = window.matchMedia('(max-width:640px), (max-width:960px) and (max-height:520px)')
    const root = document.documentElement
    const alreadyLocked = root.classList.contains('appearance-setup-open')
    let frame = 0
    const update = () => {
      element.style.setProperty('--appearance-viewport-top', `${viewport?.offsetTop ?? 0}px`)
      element.style.setProperty('--appearance-viewport-left', `${viewport?.offsetLeft ?? 0}px`)
      element.style.setProperty('--appearance-viewport-width', `${viewport?.width ?? window.innerWidth}px`)
      element.style.setProperty('--appearance-viewport-height', `${viewport?.height ?? window.innerHeight}px`)
      root.classList.toggle('appearance-setup-open', mobile.matches || alreadyLocked)
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const focused = document.activeElement, panel = controls.current
        if (!mobile.matches || !panel || !(focused instanceof HTMLElement) || !panel.contains(focused)) return
        const bounds = panel.getBoundingClientRect(), field = focused.getBoundingClientRect()
        if (field.bottom > bounds.bottom) panel.scrollTop += field.bottom - bounds.bottom + 8
        else if (field.top < bounds.top) panel.scrollTop -= bounds.top - field.top + 8
      })
    }
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    mobile.addEventListener('change', update)
    element.addEventListener('focusin', update)
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      mobile.removeEventListener('change', update)
      element.removeEventListener('focusin', update)
      window.cancelAnimationFrame(frame)
      root.classList.toggle('appearance-setup-open', alreadyLocked)
    }
  }, [])
  useEffect(() => { if (controls.current) controls.current.scrollTop = 0 }, [step])
  const world = useWorldLocation()
  const choose = (key: keyof CharacterAppearance, value: number) => setAppearance(previous => ({ ...previous, [key]: value }))
  const group = (key: keyof CharacterAppearance, title: string, labels: readonly string[], colors?: readonly number[]) => <fieldset className={`appearance-options appearance-options--${key}`}><legend>{title}</legend><div>{labels.map((label, index) => <button className="appearance-choice" type="button" key={label} aria-pressed={appearance[key] === index} disabled={tutorial.pending} onClick={() => choose(key, index)}>{colors && <span className="appearance-choice__swatch" style={{ backgroundColor: `#${colors[index].toString(16).padStart(6, '0')}` }} aria-hidden="true" />}{label}</button>)}</div></fieldset>
  const stepLabel = step === 0 ? '1 of 2 · Face and hair' : '2 of 2 · Field outfit'
  return <main ref={shell} className="deployment-access-state appearance-setup"><header><span className="eyebrow">Your desert grower</span><h1>Make yourself at home</h1><p>Choose a practical look for the road ahead.</p><span className="appearance-setup__mobile-step" aria-hidden="true">{stepLabel}</span></header>
    <div className="appearance-setup__body"><aside className="appearance-setup__preview"><CharacterPreview appearance={appearance} onReadyChange={setPreviewReady} /><span>Field grower</span><small>Your look follows you through every Area.</small></aside>
    <section className="appearance-setup__options" aria-label={step === 0 ? 'Face and hair' : 'Field outfit'}><p className="appearance-setup__step">{stepLabel}</p><div ref={controls} className="appearance-setup__controls">
      {step === 0 ? <>{group('body', 'Body presentation', BODY_STYLES)}{group('skin', 'Skin tone', ['Tone 1', 'Tone 2', 'Tone 3'], SKIN_COLORS)}{group('hair', 'Hair style', HAIR_STYLES)}{group('hairColor', 'Hair color', ['Umber', 'Chestnut', 'Straw', 'Silver'], HAIR_COLORS)}</> : <>{group('shirt', 'Work shirt', ['Terracotta', 'Sage', 'Slate', 'Linen'], SHIRT_COLORS)}{group('pants', 'Trousers', ['Sand', 'Walnut', 'Charcoal'], PANTS_COLORS)}{group('hat', 'Headwear', HAT_STYLES)}{group('accessory', 'Accessory', ACCESSORY_STYLES)}</>}
      {tutorial.error && <p role="alert">{tutorial.error}</p>}
      {SetupReset && <Suspense fallback={null}><SetupReset /></Suspense>}
      </div>
      <div className="appearance-setup__actions">{step === 0 ? <button className="cg-button cg-button--primary" type="button" onClick={() => setStep(1)}>Next: outfit</button> : <><button className="cg-button" type="button" disabled={tutorial.pending} onClick={() => setStep(0)}>Back</button><button className="cg-button cg-button--primary" type="button" disabled={tutorial.pending || !previewReady} onClick={() => { void tutorial.execute({ type: 'save-appearance', appearance }).then(ok => { if (ok) world.reload() }) }}>{tutorial.pending ? 'Saving…' : !previewReady ? 'Loading artwork…' : 'Begin your adventure'}</button></>}</div>
    </section></div>
  </main>
}
