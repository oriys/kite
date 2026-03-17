import {
  OPENAPI_SPEC_MAX_SIZE,
  getOpenapiContentByteLength,
  getOpenapiSpecTooLargeMessage,
  isOpenapiContentTooLarge,
  parseOpenapiCreateRequestPayload,
} from '@/lib/openapi/upload'

describe('openapi upload helpers', () => {
  it('parses JSON create payloads', async () => {
    const body = {
      name: 'Petstore',
      rawContent: '{"openapi":"3.1.0"}',
    }
    const request = {
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      async json() {
        return body
      },
      async formData() {
        throw new Error('Not multipart')
      },
    }

    await expect(parseOpenapiCreateRequestPayload(request)).resolves.toEqual({
      name: 'Petstore',
      rawContent: '{"openapi":"3.1.0"}',
      sourceUrl: undefined,
    })
  })

  it('parses multipart file payloads', async () => {
    const formData = new FormData()
    formData.set('name', 'Petstore')
    formData.set(
      'file',
      new File(
        ['openapi: 3.1.0\ninfo:\n  title: Petstore\n  version: 1.0.0\n'],
        'petstore.yaml',
        { type: 'application/yaml' },
      ),
    )

    const request = {
      headers: new Headers({
        'Content-Type': 'multipart/form-data; boundary=test-boundary',
      }),
      clone() {
        return this as unknown as Request
      },
      async formData() {
        return formData
      },
      async json() {
        return {
          name: 'Petstore',
        }
      },
    }

    await expect(parseOpenapiCreateRequestPayload(request)).resolves.toEqual({
      name: 'Petstore',
      rawContent: 'openapi: 3.1.0\ninfo:\n  title: Petstore\n  version: 1.0.0\n',
      sourceUrl: undefined,
    })
  })

  it('measures UTF-8 byte length', () => {
    expect(getOpenapiContentByteLength('你好')).toBe(6)
  })

  it('flags content beyond the supported size', () => {
    expect(isOpenapiContentTooLarge('a'.repeat(OPENAPI_SPEC_MAX_SIZE + 1))).toBe(
      true,
    )
    expect(getOpenapiSpecTooLargeMessage()).toContain('10MB')
  })
})
