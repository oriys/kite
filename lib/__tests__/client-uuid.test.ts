import { afterEach, describe, expect, it } from 'vitest'
import { createClientUuid } from '../client-uuid'

const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')

function setCrypto(value: Crypto | undefined) {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value,
  })
}

afterEach(() => {
  if (originalCrypto) {
    Object.defineProperty(globalThis, 'crypto', originalCrypto)
    return
  }

  Reflect.deleteProperty(globalThis, 'crypto')
})

describe('createClientUuid', () => {
  it('uses native randomUUID when available', () => {
    setCrypto({
      randomUUID: () => 'native-uuid',
    } as Crypto)

    expect(createClientUuid()).toBe('native-uuid')
  })

  it('falls back to getRandomValues and formats a v4 uuid', () => {
    setCrypto({
      getRandomValues: <T extends ArrayBufferView | null>(array: T) => {
        if (!(array instanceof Uint8Array)) {
          throw new TypeError('Expected Uint8Array')
        }

        array.set([
          0x00, 0x01, 0x02, 0x03,
          0x04, 0x05, 0x06, 0x07,
          0x08, 0x09, 0x0a, 0x0b,
          0x0c, 0x0d, 0x0e, 0x0f,
        ])
        return array as T
      },
    } as Crypto)

    expect(createClientUuid()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  })

  it('still returns an id when crypto is unavailable', () => {
    setCrypto(undefined)

    expect(createClientUuid()).toMatch(/^client-[0-9a-f]+-[0-9a-f]+$/)
  })
})
