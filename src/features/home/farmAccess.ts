import type { FarmAccessPreference } from '../../types/property'

export interface FarmAccessOption {
  id: FarmAccessPreference
  label: string
  description: string
}

export const farmAccessOptions: readonly FarmAccessOption[] = [
  { id: 'nobody', label: 'Nobody', description: 'No other players may enter your Farm.' },
  { id: 'friends', label: 'Friends Only', description: 'Accepted friends may visit.' },
  { id: 'invite', label: 'Invite Only', description: 'Only players explicitly invited may visit.' },
  { id: 'anyone', label: 'Anyone', description: 'Any eligible CactiGrow player may visit.' },
]
