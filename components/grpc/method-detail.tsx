'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

interface FieldSchema {
  name: string
  type: string
  repeated: boolean
  map: boolean
  message?: MessageSchema
  enumValues?: string[]
}

interface MessageSchema {
  name: string
  fields: FieldSchema[]
}

interface MethodDetailProps {
  inputType: Record<string, unknown>
  outputType: Record<string, unknown>
}

export function MethodDetail({ inputType, outputType }: MethodDetailProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Request — {(inputType as unknown as MessageSchema).name}
        </h4>
        <div className="rounded-md bg-muted/50 p-2">
          <MessageSchemaTree schema={inputType as unknown as MessageSchema} />
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Response — {(outputType as unknown as MessageSchema).name}
        </h4>
        <div className="rounded-md bg-muted/50 p-2">
          <MessageSchemaTree schema={outputType as unknown as MessageSchema} />
        </div>
      </div>
    </div>
  )
}

function MessageSchemaTree({
  schema,
  depth = 0,
}: {
  schema: MessageSchema
  depth?: number
}) {
  if (!schema.fields || schema.fields.length === 0) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        {schema.name || 'Empty'}
      </span>
    )
  }

  return (
    <div className="space-y-0.5">
      {schema.fields.map((field) => (
        <FieldRow key={field.name} field={field} depth={depth} />
      ))}
    </div>
  )
}

function FieldRow({ field, depth }: { field: FieldSchema; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasNested = field.message && field.message.fields.length > 0
  const hasEnum = field.enumValues && field.enumValues.length > 0

  const typeLabel = field.repeated
    ? `repeated ${field.type}`
    : field.map
      ? `map<${field.type}>`
      : field.type

  return (
    <div className="py-0.5">
      <div className="flex items-center gap-2">
        {hasNested ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronRight
              className={cn('size-3 transition-transform', expanded && 'rotate-90')}
            />
            <code className="font-medium text-foreground">{field.name}</code>
          </button>
        ) : (
          <code className="text-xs font-medium text-foreground">{field.name}</code>
        )}
        <span className="font-mono text-xs text-muted-foreground/70">
          {typeLabel}
        </span>
        {hasEnum && (
          <Badge
            variant="outline"
            className="h-4 px-1 text-[10px] leading-none text-muted-foreground"
          >
            enum
          </Badge>
        )}
      </div>

      {hasEnum && !hasNested && (
        <div className="ml-5 mt-0.5 text-xs text-muted-foreground/60">
          [{field.enumValues!.join(', ')}]
        </div>
      )}

      {hasNested && expanded && (
        <div className="ml-3 mt-0.5 border-l border-border/50 pl-3">
          <MessageSchemaTree schema={field.message!} depth={depth + 1} />
        </div>
      )}
    </div>
  )
}
