import { useEffect, useRef, useState } from 'react'
import type { CharacterAppearance } from '../../shared/characters/appearance.ts'
import { loadCharacterArt, paintCharacterArt } from './characterArt'
export function CharacterPreview({ appearance, onReadyChange }: { appearance: CharacterAppearance; onReadyChange?(ready: boolean): void }) {
  const canvas = useRef<HTMLCanvasElement>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    onReadyChange?.(false)
    void loadCharacterArt().then(sources => { if (active && canvas.current) { paintCharacterArt(canvas.current, sources, appearance); setError(''); onReadyChange?.(true) } })
      .catch(e => { if (active) { setError(e instanceof Error ? e.message : 'Character artwork unavailable.'); onReadyChange?.(false) } })
    return () => { active = false }
  }, [appearance, onReadyChange, retry])
  return <><canvas ref={canvas} width={128} height={224} className="character-preview" role="img" aria-label="Character preview" />{error && <div className="character-preview__error"><p role="alert">{error}</p><button className="cg-button" type="button" onClick={() => setRetry(previous => previous + 1)}>Retry artwork</button></div>}</>
}
