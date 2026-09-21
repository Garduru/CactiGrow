import type { ApiEnvironment } from '../env.ts'
import type {
  IdentityProvider,
  IdentityVerificationRequest,
  VerifiedExternalIdentity,
} from './IdentityProvider.ts'

export const DEVELOPMENT_IDENTITY_HEADER = 'x-cactigrow-development-identity'

const DEVELOPMENT_SUBJECTS = new Set(['account-a', 'account-b'])

export class DevelopmentIdentityProvider implements IdentityProvider {
  constructor(environment: ApiEnvironment) {
    if (environment === 'production') {
      throw new Error('Development identity cannot be enabled in production.')
    }
  }

  async verify(request: IdentityVerificationRequest): Promise<VerifiedExternalIdentity | null> {
    const subject = request.getHeader(DEVELOPMENT_IDENTITY_HEADER)

    if (!subject || subject.includes(',') || !DEVELOPMENT_SUBJECTS.has(subject)) {
      return null
    }

    return {
      provider: 'development',
      subject,
    }
  }
}
