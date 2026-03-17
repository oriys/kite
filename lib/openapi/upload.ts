import { MAX_CONTENT_SIZE } from '@/lib/constants'

const textEncoder = new TextEncoder()

export interface OpenapiCreateRequestPayload {
  name?: string
  rawContent?: string
  sourceUrl?: string
}

type OpenapiCreateRequestInput = Pick<Request, 'headers' | 'json' | 'formData'> & {
  clone?: () => Request
}

export const OPENAPI_SPEC_MAX_SIZE = MAX_CONTENT_SIZE
export const OPENAPI_SPEC_MAX_SIZE_LABEL = `${Math.floor(
  OPENAPI_SPEC_MAX_SIZE / (1024 * 1024),
)}MB`

function readStringFormValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : undefined
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    value !== null &&
    typeof value === 'object' &&
    'text' in value &&
    typeof value.text === 'function'
  )
}

export async function parseOpenapiCreateRequestPayload(
  request: OpenapiCreateRequestInput,
): Promise<OpenapiCreateRequestPayload | null> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data') || contentType.length === 0) {
    const formDataRequest =
      typeof request.clone === 'function' ? request.clone() : request
    const formData = await formDataRequest.formData().catch(() => null)

    if (formData) {
      const rawContentField = formData.get('rawContent')
      const fileField = formData.get('file')
      const rawContent =
        typeof rawContentField === 'string'
          ? rawContentField
          : isFileLike(fileField)
            ? await fileField.text()
            : undefined

      return {
        name: readStringFormValue(formData, 'name'),
        rawContent,
        sourceUrl: readStringFormValue(formData, 'sourceUrl'),
      }
    }
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return null

  const payload = body as Record<string, unknown>

  return {
    name: typeof payload.name === 'string' ? payload.name : undefined,
    rawContent:
      typeof payload.rawContent === 'string' ? payload.rawContent : undefined,
    sourceUrl:
      typeof payload.sourceUrl === 'string' ? payload.sourceUrl : undefined,
  }
}

export function getOpenapiContentByteLength(content: string) {
  return textEncoder.encode(content).byteLength
}

export function isOpenapiContentTooLarge(content: string) {
  return getOpenapiContentByteLength(content) > OPENAPI_SPEC_MAX_SIZE
}

export function getOpenapiSpecTooLargeMessage() {
  return `OpenAPI spec too large. Max ${OPENAPI_SPEC_MAX_SIZE_LABEL}.`
}
