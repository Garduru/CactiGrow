const DEVELOPMENT_IDENTITY_HEADER = 'x-cactigrow-development-identity'
const DEVELOPMENT_IDENTITIES = new Set(['account-a', 'account-b'])

export function createDevelopmentCredentials(
  enabled: boolean,
  search: string,
): HeadersInit | undefined {
  if (!enabled) return undefined

  const identity = new URLSearchParams(search).get('developmentIdentity')
  if (!identity || !DEVELOPMENT_IDENTITIES.has(identity)) return undefined

  return { [DEVELOPMENT_IDENTITY_HEADER]: identity }
}
