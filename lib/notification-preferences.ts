export const NOTIFICATION_PREFERENCE_KEYS = [
  'commentEnabled',
  'mentionEnabled',
  'approvalEnabled',
  'statusChangeEnabled',
  'webhookFailureEnabled',
] as const

export type NotificationPreferenceKey =
  (typeof NOTIFICATION_PREFERENCE_KEYS)[number]

export type NotificationPreferenceValues = Record<
  NotificationPreferenceKey,
  boolean
>

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceValues = {
  commentEnabled: true,
  mentionEnabled: true,
  approvalEnabled: true,
  statusChangeEnabled: true,
  webhookFailureEnabled: true,
}

export const NOTIFICATION_PREFERENCE_CONFIG: Record<
  NotificationPreferenceKey,
  {
    label: string
    description: string
  }
> = {
  commentEnabled: {
    label: 'Comments',
    description:
      'Receive updates when collaborators start or continue document discussions.',
  },
  mentionEnabled: {
    label: 'Mentions',
    description: 'Receive updates when someone @mentions you in a comment.',
  },
  approvalEnabled: {
    label: 'Approvals',
    description:
      'Receive updates for approval requests and approval decisions that involve you.',
  },
  statusChangeEnabled: {
    label: 'Status changes',
    description:
      'Receive updates when documents move between draft, review, published, and archived.',
  },
  webhookFailureEnabled: {
    label: 'Webhook failures',
    description:
      'Receive updates when webhook deliveries fail and need attention.',
  },
}

export function mergeNotificationPreferences(
  preferences?: Partial<NotificationPreferenceValues> | null,
): NotificationPreferenceValues {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...preferences,
  }
}
