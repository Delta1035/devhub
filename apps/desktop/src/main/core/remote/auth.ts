import { createHash, randomBytes, timingSafeEqual } from 'crypto'

/** 32 random bytes, URL-safe so it can be pasted or typed on a phone. */
export const generateToken = (): string => randomBytes(32).toString('base64url')

/** Constant-time comparison; hashing first hides the length of the expected token too. */
export function tokensEqual(given: string, expected: string): boolean {
  const digest = (value: string): Buffer => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(given), digest(expected))
}

/** The token from an `Authorization: Bearer <token>` header, or null. */
export function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer ([^\s]+)$/.exec(header ?? '')
  return match?.[1] ?? null
}

export interface FailureLimiter {
  /** True while the address has used up its failed attempts for the current window. */
  isBlocked(address: string): boolean
  recordFailure(address: string): void
}

/** Counts failed authentications per address in fixed windows, to slow down token guessing. */
export function createFailureLimiter({
  maxFailures = 10,
  windowMs = 60_000,
  now = Date.now
}: { maxFailures?: number; windowMs?: number; now?: () => number } = {}): FailureLimiter {
  const failures = new Map<string, { count: number; since: number }>()

  const current = (address: string): { count: number; since: number } | undefined => {
    const entry = failures.get(address)
    if (entry && now() - entry.since >= windowMs) {
      failures.delete(address)
      return undefined
    }
    return entry
  }

  return {
    isBlocked: (address) => (current(address)?.count ?? 0) >= maxFailures,
    recordFailure(address) {
      // Bounds memory when many addresses fail once and never come back.
      if (failures.size >= 1000) for (const key of [...failures.keys()]) current(key)
      const entry = current(address)
      if (entry) entry.count += 1
      else failures.set(address, { count: 1, since: now() })
    }
  }
}
