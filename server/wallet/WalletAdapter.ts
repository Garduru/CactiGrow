export interface WalletSubject {
  playerId: string
}

export interface WalletBalance {
  currency: string
  available: number
  authoritativeAsOf: string
}

export interface WalletOperationRequest {
  subject: WalletSubject
  amount: number
  currency: string
  idempotencyKey: string
  reason: string
  relatedEntityId?: string
}

export type WalletFailureCode = 'rejected' | 'unavailable' | 'unsupported' | 'unknown'

export type WalletOperationResult =
  | {
    ok: true
    status: 'pending' | 'succeeded'
    externalReference: string
    balance?: WalletBalance
  }
  | {
    ok: false
    code: WalletFailureCode
    retryable: boolean
    externalReference?: string
  }

export interface WalletAdapter {
  getBalance(subject: WalletSubject): Promise<WalletBalance>
  debit(request: WalletOperationRequest): Promise<WalletOperationResult>
  credit(request: WalletOperationRequest): Promise<WalletOperationResult>
  getOperation(idempotencyKey: string): Promise<WalletOperationResult | null>
}
