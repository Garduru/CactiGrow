export const API_ENVIRONMENTS = ['development', 'test', 'production'] as const

export type ApiEnvironment = typeof API_ENVIRONMENTS[number]

export type WorkerEnv = Omit<CloudflareEnv, 'CACTIGROW_ENVIRONMENT' | 'CACTIGROW_VERSION'> & {
  CACTIGROW_ENVIRONMENT: ApiEnvironment
  CACTIGROW_VERSION: string
  HYPERDRIVE?: Hyperdrive
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
