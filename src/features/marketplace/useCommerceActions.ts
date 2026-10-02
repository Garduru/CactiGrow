import { useRef, useState } from 'react'
import { useGrowerAuthority } from '../../app/useGrowerAuthority'
import type { GrowerAlphaCommandInputV1 } from '../../../shared/api/growerAlphaV1'

export function useCommerceActions() {
  const grower = useGrowerAuthority()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const ready = grower.state.authority === 'server' && grower.state.status === 'ready'
  const balance = grower.state.authority === 'server' && grower.state.status === 'ready' ? grower.state.projection.player.tokenBalance : null
  async function transact(command: GrowerAlphaCommandInputV1): Promise<boolean> {
    if (lock.current || !ready) return false
    lock.current = true; setBusy(true); setMessage('')
    try {
      const result = await grower.mutate(command)
      if (!result) throw new Error('The transaction could not be completed. Refresh and try again.')
      setMessage('Transaction completed.')
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to complete the transaction.')
      return false
    } finally { lock.current = false; setBusy(false) }
  }
  return { ready, balance, busy, message, transact, refreshBalance: grower.refresh }
}
