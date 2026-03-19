import { emitAuditEvent, type AuditAction } from '@/lib/queries/audit-logs'
import { dispatchWebhookEvent } from '@/lib/queries/webhooks'
import { dispatchToChannels } from '@/lib/notification-sender'
import { logServerError } from '@/lib/server-errors'

interface ResourceEventInput {
  workspaceId: string
  actorId: string
  action: AuditAction
  resourceType: string
  resourceId: string
  resourceTitle?: string
  metadata?: Record<string, unknown>
  /** Webhook event name, e.g. "document.published" or "approval.approved" */
  webhookEvent?: string
  /** Extra fields to include in the webhook payload */
  webhookPayload?: Record<string, unknown>
  /** Override channel notification title/body. If omitted, channels are not dispatched. */
  channel?: {
    title: string
    body: string
    linkUrl?: string
  }
}

/**
 * Emit audit event, webhook event, and channel notification in one call.
 * All dispatches are fire-and-forget with error logging (not silent swallowing).
 */
export function emitResourceEvent(input: ResourceEventInput): void {
  const { workspaceId, actorId, action, resourceType, resourceId, resourceTitle, metadata } = input

  emitAuditEvent({
    workspaceId,
    actorId,
    action,
    resourceType,
    resourceId,
    resourceTitle,
    metadata,
  }).catch((err) => {
    logServerError('Failed to emit audit event', err, { resourceType, resourceId, action })
  })

  if (input.webhookEvent) {
    dispatchWebhookEvent(workspaceId, input.webhookEvent, {
      [`${resourceType}Id`]: resourceId,
      ...(resourceTitle ? { title: resourceTitle } : {}),
      actorId,
      ...input.webhookPayload,
    }).catch((err) => {
      logServerError('Failed to dispatch webhook event', err, {
        event: input.webhookEvent,
        resourceId,
      })
    })
  }

  if (input.channel) {
    dispatchToChannels({
      type: input.webhookEvent ?? `${resourceType}.${action}`,
      title: input.channel.title,
      body: input.channel.body,
      workspaceId,
      linkUrl: input.channel.linkUrl,
    }).catch((err) => {
      logServerError('Failed to dispatch channel notification', err, {
        type: input.webhookEvent,
        resourceId,
      })
    })
  }
}
