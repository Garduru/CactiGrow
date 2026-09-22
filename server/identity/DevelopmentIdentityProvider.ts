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
    if (environment !== 'development' && environment !== 'test') {
      throw new Error('Development identity can only be enabled in development or test.')
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
