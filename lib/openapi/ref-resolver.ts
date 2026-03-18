const MAX_LOCAL_REF_DEPTH = 20

export function resolveLocalOpenApiRefs<T>(
  value: T,
  root: Record<string, unknown>,
): T {
  return resolveValue(value, root, 0, new Set()) as T
}

function resolveValue(
  value: unknown,
  root: Record<string, unknown>,
  depth: number,
  seenRefs: Set<string>,
): unknown {
  if (depth > MAX_LOCAL_REF_DEPTH || value == null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, root, depth + 1, seenRefs))
  }

  const record = value as Record<string, unknown>
  const ref = record.$ref

  if (typeof ref === 'string' && ref.startsWith('#/')) {
    if (seenRefs.has(ref)) {
      return value
    }

    const resolved = resolveJsonPointer(root, ref)
    if (!resolved || typeof resolved !== 'object') {
      return value
    }

    const nextSeenRefs = new Set(seenRefs)
    nextSeenRefs.add(ref)

    const merged = {
      ...(resolved as Record<string, unknown>),
      ...record,
    }
    delete merged.$ref

    return resolveValue(merged, root, depth + 1, nextSeenRefs)
  }

  const resolvedRecord: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(record)) {
    resolvedRecord[key] = resolveValue(child, root, depth + 1, seenRefs)
  }

  return resolvedRecord
}

function resolveJsonPointer(
  root: Record<string, unknown>,
  ref: string,
): unknown {
  const segments = ref
    .slice(2)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))

  let current: unknown = root
  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current
}
