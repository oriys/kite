export const PERSONAL_FEATURE_IDS = [
  'openApi',
  'templates',
  'aiWorkspace',
  'analytics',
  'approvals',
  'linkHealth',
] as const

export type PersonalFeatureId = (typeof PERSONAL_FEATURE_IDS)[number]

export type PersonalFeatureVisibility = Record<PersonalFeatureId, boolean>

export const NAV_ITEM_KEYS = [
  'documents',
  'compare',
  'openApi',
  'analytics',
  'templates',
  'approvals',
  'linkHealth',
  'settings',
] as const

export type NavItemKey = (typeof NAV_ITEM_KEYS)[number]

export const DEFAULT_NAV_ORDER: NavItemKey[] = [...NAV_ITEM_KEYS]

const DEFAULT_PERSONAL_FEATURE_VISIBILITY: PersonalFeatureVisibility = {
  openApi: true,
  templates: true,
  aiWorkspace: true,
  analytics: true,
  approvals: true,
  linkHealth: true,
}

export const PERSONAL_FEATURE_CONFIG: Record<
  PersonalFeatureId,
  {
    label: string
    description: string
    href: string
  }
> = {
  openApi: {
    label: 'OpenAPI',
    description:
      'Hide OpenAPI source management when you are not importing or syncing API specs.',
    href: '/docs/openapi',
  },
  templates: {
    label: 'Templates',
    description:
      'Hide the template library and template-based document shortcuts when you prefer to author from scratch.',
    href: '/docs/templates',
  },
  aiWorkspace: {
    label: 'AI workspace',
    description:
      'Hide the AI models and AI prompts management pages when you do not need to tune browser-level AI controls.',
    href: '/docs/settings/ai',
  },
  analytics: {
    label: 'Analytics',
    description:
      'Hide search and feedback dashboards when you do not review audience signals every day.',
    href: '/docs/analytics',
  },
  approvals: {
    label: 'Approvals',
    description:
      'Hide the approval queue when formal review workflows are not part of your day-to-day work.',
    href: '/docs/approvals',
  },
  linkHealth: {
    label: 'Link Health',
    description:
      'Hide the broken-link dashboard when you are not maintaining published docs.',
    href: '/docs/link-health',
  },
}

export function createDefaultPersonalFeatureVisibility(): PersonalFeatureVisibility {
  return {
    ...DEFAULT_PERSONAL_FEATURE_VISIBILITY,
  }
}

export function mergePersonalFeatureVisibility(
  visibility?: Partial<PersonalFeatureVisibility> | null,
): PersonalFeatureVisibility {
  return {
    ...DEFAULT_PERSONAL_FEATURE_VISIBILITY,
    ...visibility,
  }
}

export function createPersonalFeatureVisibilityUpdate(
  featureId: PersonalFeatureId,
  enabled: boolean,
): Partial<PersonalFeatureVisibility> {
  switch (featureId) {
    case 'openApi':
      return { openApi: enabled }
    case 'templates':
      return { templates: enabled }
    case 'aiWorkspace':
      return { aiWorkspace: enabled }
    case 'analytics':
      return { analytics: enabled }
    case 'approvals':
      return { approvals: enabled }
    case 'linkHealth':
      return { linkHealth: enabled }
  }
}

/**
 * Merge a saved navOrder with the default order.
 * Ensures all known keys are present and unknown keys are removed.
 */
export function mergeNavOrder(
  navOrder?: string[] | null,
): NavItemKey[] {
  if (!navOrder || navOrder.length === 0) {
    return DEFAULT_NAV_ORDER
  }

  const knownKeys = new Set<string>(NAV_ITEM_KEYS)
  const seen = new Set<string>()
  const result: NavItemKey[] = []

  for (const key of navOrder) {
    if (knownKeys.has(key) && !seen.has(key)) {
      result.push(key as NavItemKey)
      seen.add(key)
    }
  }

  // Append any missing keys in their default order
  for (const key of NAV_ITEM_KEYS) {
    if (!seen.has(key)) {
      result.push(key)
    }
  }

  return result
}

/**
 * Validate that a navOrder array is a valid permutation of NAV_ITEM_KEYS.
 */
export function isValidNavOrder(navOrder: unknown): navOrder is string[] {
  if (!Array.isArray(navOrder)) return false
  if (navOrder.length !== NAV_ITEM_KEYS.length) return false

  const knownKeys = new Set<string>(NAV_ITEM_KEYS)
  const seen = new Set<string>()

  for (const key of navOrder) {
    if (typeof key !== 'string' || !knownKeys.has(key) || seen.has(key)) {
      return false
    }
    seen.add(key)
  }

  return true
}
