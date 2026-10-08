import { useState } from 'react'
import { usePlayerBootstrap } from '../../app/usePlayerBootstrap'
import { StartingResetControl } from './StartingResetControl'
export default function StartingSetupReset() {
  const bootstrap = usePlayerBootstrap(), [receipt, setReceipt] = useState('')
  const playerId = bootstrap.status === 'authenticated' ? bootstrap.bootstrap.player.playerId : null
  return <details className="starting-setup-reset"><summary>Staging Developer Tools - onboarding reset</summary><StartingResetControl playerId={playerId} enabled={!!playerId} recordAction={setReceipt} />{receipt && <small>{receipt}</small>}</details>
}
