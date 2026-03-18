'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Loader2, Play, Copy, Check } from 'lucide-react'

interface MessageSchema {
  name: string
  fields: FieldSchema[]
}

interface FieldSchema {
  name: string
  type: string
  repeated: boolean
  map: boolean
  message?: MessageSchema
  enumValues?: string[]
}

interface MethodTryItProps {
  protoContent: string
  serviceName: string
  methodName: string
  inputType: Record<string, unknown>
}

const TARGET_ADDRESS_KEY = 'kite:grpc:try-it:target-address'

function generateExampleFromSchema(schema: MessageSchema): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const field of schema.fields) {
    if (field.message) {
      const nested = generateExampleFromSchema(field.message)
      obj[field.name] = field.repeated ? [nested] : nested
    } else if (field.enumValues && field.enumValues.length > 0) {
      obj[field.name] = field.enumValues[0]
    } else {
      switch (field.type) {
        case 'string':
          obj[field.name] = field.repeated ? ['string'] : 'string'
          break
        case 'int32':
        case 'int64':
        case 'uint32':
        case 'uint64':
        case 'sint32':
        case 'sint64':
        case 'fixed32':
        case 'fixed64':
        case 'sfixed32':
        case 'sfixed64':
        case 'float':
        case 'double':
          obj[field.name] = field.repeated ? [0] : 0
          break
        case 'bool':
          obj[field.name] = field.repeated ? [true] : true
          break
        case 'bytes':
          obj[field.name] = field.repeated ? [''] : ''
          break
        default:
          obj[field.name] = field.repeated ? [null] : null
      }
    }
  }
  return obj
}

export function MethodTryIt({
  protoContent,
  serviceName,
  methodName,
  inputType,
}: MethodTryItProps) {
  const [targetAddress, setTargetAddress] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<{
    body: Record<string, unknown>
    duration: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Load target address from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(TARGET_ADDRESS_KEY)
    if (stored) setTargetAddress(stored)
  }, [])

  // Persist target address
  const addressRef = useRef(targetAddress)
  addressRef.current = targetAddress
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (addressRef.current) {
        localStorage.setItem(TARGET_ADDRESS_KEY, addressRef.current)
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [targetAddress])

  // Initialize body with example
  useEffect(() => {
    if (!body) {
      const schema = inputType as unknown as MessageSchema
      if (schema?.fields) {
        const example = generateExampleFromSchema(schema)
        setBody(JSON.stringify(example, null, 2))
      }
    }
  }, [inputType]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendRequest = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      let requestBody: Record<string, unknown>
      try {
        requestBody = JSON.parse(body)
      } catch {
        setError('Invalid JSON in request body')
        setLoading(false)
        return
      }

      const res = await fetch('/api/grpc/try-it', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protoContent,
          serviceName,
          methodName,
          targetAddress,
          requestBody,
        }),
      })

      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResponse(data)
      }
    } catch {
      setError('Failed to send gRPC request')
    } finally {
      setLoading(false)
    }
  }

  const copyResponse = async () => {
    if (!response) return
    await navigator.clipboard.writeText(JSON.stringify(response.body, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 rounded-md border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          gRPC Playground
        </span>
      </div>

      {/* Target Address */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Target Address
        </label>
        <Input
          value={targetAddress}
          onChange={(e) => setTargetAddress(e.target.value)}
          placeholder="api.example.com:50051"
          className="h-8 font-mono text-sm"
        />
      </div>

      {/* Request Body */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Request Body (JSON)
        </label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder='{"key": "value"}'
          className="min-h-[120px] font-mono text-xs"
        />
      </div>

      {/* Send button */}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={sendRequest}
          disabled={loading || !targetAddress}
          className="h-8 gap-1.5"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          Send
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-tone-error-border bg-tone-error-bg p-3 text-sm text-tone-error-text">
          {error}
        </div>
      )}

      {/* Response */}
      {response && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'inline-flex items-center rounded px-2 py-0.5 text-xs font-bold',
                'bg-tone-success-bg text-tone-success-text',
              )}
            >
              OK
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {response.duration}ms
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 gap-1 px-2 text-xs"
              onClick={copyResponse}
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <pre className="max-h-80 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
            {JSON.stringify(response.body, null, 2)}
          </pre>
        </div>
      )}

      {!loading && !error && !response && (
        <div className="py-4 text-center text-sm text-muted-foreground">
          Send a request to see the response here.
        </div>
      )}
    </div>
  )
}
