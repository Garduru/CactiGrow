export const API_ENVIRONMENTS = ['development', 'test', 'staging', 'production'] as const

export type ApiEnvironment = typeof API_ENVIRONMENTS[number]

export type WorkerEnv = Omit<CloudflareEnv, 'CACTIGROW_ENVIRONMENT' | 'CACTIGROW_VERSION' | 'CACTIGROW_REALTIME_ENABLED' | 'CACTIGROW_REALTIME_ORIGIN'> & {
  CACTIGROW_ENVIRONMENT: ApiEnvironment
  CACTIGROW_VERSION: string
  CACTIGROW_ACCESS_TEAM_DOMAIN?: string
  CACTIGROW_ACCESS_AUDIENCE?: string
  CACTIGROW_BASE44_APP_ID?: string
  HYPERDRIVE?: Hyperdrive
  AREA_PRESENCE?: DurableObjectNamespace
  CACTIGROW_REALTIME_ENABLED?: string
  CACTIGROW_REALTIME_ORIGIN?: string
}

export interface RuntimeMetadata {
  environment: ApiEnvironment
  version: string
}

export function getRuntimeMetadata(env: WorkerEnv): RuntimeMetadata {
  if (!API_ENVIRONMENTS.includes(env.CACTIGROW_ENVIRONMENT)) {
    throw new Error('Invalid CactiGrow Worker environment binding.')
  }

  const version = env.CACTIGROW_VERSION.trim()
  if (!version || version.length > 100 || !/^[a-zA-Z0-9._-]+$/.test(version)) {
    throw new Error('Invalid CactiGrow Worker version binding.')
  }

  return { environment: env.CACTIGROW_ENVIRONMENT, version }
}
