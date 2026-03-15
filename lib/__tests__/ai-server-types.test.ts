import { describe, it, expect } from 'vitest'
import { AiCompletionError } from '../ai-server-types'

describe('AiCompletionError', () => {
  it('is an instance of Error', () => {
    const err = new AiCompletionError('test message', 500)
    expect(err).toBeInstanceOf(Error)
  })

  it('stores message and status', () => {
    const err = new AiCompletionError('Model unavailable', 503)
    expect(err.message).toBe('Model unavailable')
    expect(err.status).toBe(503)
    expect(err.name).toBe('AiCompletionError')
  })
})
