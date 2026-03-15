type PRNG = () => number

function createSeededRNG(seed: number): PRNG {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return ((s >>> 0) / 0xffffffff)
  }
}

export function generateMockResponse(
  schema: Record<string, unknown>,
  seed?: number,
  _seenRefs?: Set<string>,
  _depth?: number,
): unknown {
  const rng: PRNG = seed != null ? createSeededRNG(seed) : Math.random
  return generate(schema, rng, _seenRefs ?? new Set(), _depth ?? 0)
}

function generate(
  schema: Record<string, unknown>,
  rng: PRNG,
  seenRefs: Set<string>,
  depth: number,
): unknown {
  if (!schema || typeof schema !== 'object') return null
  if (depth > 5) return null

  if (schema.example !== undefined) return schema.example

  if (schema.$ref) {
    const ref = schema.$ref as string
    if (seenRefs.has(ref)) return null
    seenRefs.add(ref)
    return null
  }

  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0] as unknown
  }

  if (schema.allOf && Array.isArray(schema.allOf)) {
    const merged: Record<string, unknown> = {}
    for (const sub of schema.allOf as Record<string, unknown>[]) {
      const val = generate(sub, rng, seenRefs, depth + 1)
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        Object.assign(merged, val)
      }
    }
    return Object.keys(merged).length > 0 ? merged : null
  }

  if (schema.oneOf && Array.isArray(schema.oneOf) && (schema.oneOf as Record<string, unknown>[]).length > 0) {
    return generate((schema.oneOf as Record<string, unknown>[])[0], rng, seenRefs, depth + 1)
  }

  if (schema.anyOf && Array.isArray(schema.anyOf) && (schema.anyOf as Record<string, unknown>[]).length > 0) {
    return generate((schema.anyOf as Record<string, unknown>[])[0], rng, seenRefs, depth + 1)
  }

  const type = schema.type

  if (type === 'string') {
    return generateString(schema, rng)
  }

  if (type === 'integer') {
    const min = (schema.minimum as number) ?? 1
    const max = (schema.maximum as number) ?? 100
    return Math.floor(rng() * (max - min + 1)) + min
  }

  if (type === 'number') {
    const min = (schema.minimum as number) ?? 0
    const max = (schema.maximum as number) ?? 100
    return Math.round((rng() * (max - min) + min) * 100) / 100
  }

  if (type === 'boolean') {
    return rng() > 0.5
  }

  if (type === 'array') {
    const itemSchema = schema.items as Record<string, unknown> | undefined
    if (!itemSchema) return []
    const count = Math.min(
      (schema.minItems as number) ?? 1,
      3,
      (schema.maxItems as number) ?? 3,
    )
    const items: unknown[] = []
    for (let i = 0; i < Math.max(count, 1); i++) {
      items.push(generate(itemSchema, rng, seenRefs, depth + 1))
    }
    return items
  }

  if (type === 'object' || schema.properties) {
    const result: Record<string, unknown> = {}
    const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>
    for (const [key, propSchema] of Object.entries(props)) {
      result[key] = generate(propSchema, rng, seenRefs, depth + 1)
    }
    return result
  }

  return null
}

function generateString(schema: Record<string, unknown>, _rng: PRNG): string {
  const format = schema.format
  switch (format) {
    case 'email':
      return 'user@example.com'
    case 'date-time':
      return new Date('2024-01-15T10:30:00Z').toISOString()
    case 'date':
      return '2024-01-15'
    case 'time':
      return '10:30:00'
    case 'uuid':
      return '550e8400-e29b-41d4-a716-446655440000'
    case 'uri':
    case 'url':
      return 'https://example.com'
    case 'ipv4':
      return '192.168.1.1'
    case 'ipv6':
      return '::1'
    case 'hostname':
      return 'example.com'
    case 'binary':
      return 'dGVzdA=='
    default: {
      if (schema.pattern) return 'string'
      const min = (schema.minLength as number) ?? 0
      if (min > 0) {
        return 'a'.repeat(min as number)
      }
      return 'string'
    }
  }
}
