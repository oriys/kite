export const PERSONAL_FEATURE_IDS = [
  'openApi',
  'templates',
  'aiWorkspace',
  'analytics',
  'approvals',
  'webhooks',
  'linkHealth',
  'quickInsert',
] as const

export type PersonalFeatureId = (typeof PERSONAL_FEATURE_IDS)[number]

export type PersonalFeatureVisibility = Record<PersonalFeatureId, boolean>

const DEFAULT_PERSONAL_FEATURE_VISIBILITY: PersonalFeatureVisibility = {
  openApi: true,
  templates: true,
  aiWorkspace: true,
  analytics: true,
  approvals: true,
  webhooks: true,
  linkHealth: true,
  quickInsert: true,
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
  webhooks: {
    label: 'Webhooks',
    description:
      'Hide webhook management when you are not working on downstream integrations.',
    href: '/docs/webhooks',
  },
  linkHealth: {
    label: 'Link Health',
    description:
      'Hide the broken-link dashboard when you are not maintaining published docs.',
    href: '/docs/link-health',
  },
  quickInsert: {
    label: 'Quick Insert',
    description:
      'Hide the snippet manager when you do not curate reusable editor components.',
    href: '/docs/components',
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
    case 'webhooks':
      return { webhooks: enabled }
    case 'linkHealth':
      return { linkHealth: enabled }
    case 'quickInsert':
      return { quickInsert: enabled }
  }
}
