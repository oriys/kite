export type RecoverableClientRuntimeErrorKind = 'chunk-load'

export interface RecoverableClientRuntimeError {
  name?: string | null
  message?: string | null
}

export interface ClientRuntimeRecoveryResult {
  kind: RecoverableClientRuntimeErrorKind | null
  signature: string | null
  triggered: boolean
  alreadyAttempted: boolean
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface ClientRuntimeRecoveryOptions {
  storage?: Pick<StorageLike, 'getItem' | 'setItem'> | null
  reload?: () => void
}

const CLIENT_RUNTIME_RECOVERY_KEY = 'kite:client-runtime-recovery'
const CHUNK_LOAD_PATTERNS = [
  /loading chunk [^ ]+ failed/i,
  /failed to load chunk/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
] as const

function getSessionStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.sessionStorage
}

export function classifyRecoverableClientRuntimeError(
  error: RecoverableClientRuntimeError | null | undefined,
): Pick<ClientRuntimeRecoveryResult, 'kind' | 'signature'> {
  const name = typeof error?.name === 'string' ? error.name.trim() : ''
  const message = typeof error?.message === 'string' ? error.message.trim() : ''
  const haystack = `${name}\n${message}`

  if (name === 'ChunkLoadError' || CHUNK_LOAD_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return {
      kind: 'chunk-load',
      signature: `${CLIENT_RUNTIME_RECOVERY_KEY}:chunk-load`,
    }
  }

  return {
    kind: null,
    signature: null,
  }
}

export function attemptClientRuntimeRecovery(
  error: RecoverableClientRuntimeError | null | undefined,
  options: ClientRuntimeRecoveryOptions = {},
): ClientRuntimeRecoveryResult {
  const classification = classifyRecoverableClientRuntimeError(error)

  if (!classification.kind || !classification.signature) {
    return {
      ...classification,
      triggered: false,
      alreadyAttempted: false,
    }
  }

  const storage = options.storage ?? getSessionStorage()
  if (!storage) {
    return {
      ...classification,
      triggered: false,
      alreadyAttempted: false,
    }
  }

  const previousSignature = storage.getItem(CLIENT_RUNTIME_RECOVERY_KEY)
  if (previousSignature === classification.signature) {
    return {
      ...classification,
      triggered: false,
      alreadyAttempted: true,
    }
  }

  storage.setItem(CLIENT_RUNTIME_RECOVERY_KEY, classification.signature)

  if (options.reload) {
    options.reload()
  } else if (typeof window !== 'undefined') {
    window.location.reload()
  }

  return {
    ...classification,
    triggered: true,
    alreadyAttempted: false,
  }
}

export function clearClientRuntimeRecoveryState(
  storage?: Pick<StorageLike, 'removeItem'> | null,
) {
  const targetStorage = storage ?? getSessionStorage()
  if (!targetStorage) {
    return
  }

  targetStorage.removeItem(CLIENT_RUNTIME_RECOVERY_KEY)
}
