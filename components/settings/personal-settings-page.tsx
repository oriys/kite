'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  BrainCircuit,
  Palette,
  PencilLine,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'

import { usePersonalSettings } from '@/components/personal-settings-provider'
import { useDocEditorAiPanelSide } from '@/hooks/use-doc-editor-ai-panel-side'
import { useDocEditorWidth } from '@/hooks/use-doc-editor-width'
import {
  DOC_EDITOR_WIDTH_DEFAULT,
  DOC_EDITOR_WIDTH_PRESETS,
} from '@/lib/doc-editor-layout'
import {
  NOTIFICATION_PREFERENCE_CONFIG,
  NOTIFICATION_PREFERENCE_KEYS,
  mergeNotificationPreferences,
  type NotificationPreferenceKey,
  type NotificationPreferenceValues,
} from '@/lib/notification-preferences'
import {
  PERSONAL_FEATURE_CONFIG,
  PERSONAL_FEATURE_IDS,
  DEFAULT_NAV_ORDER,
  createPersonalFeatureVisibilityUpdate,
  type NavItemKey,
} from '@/lib/personal-settings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldTitle,
} from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const NAV_ITEM_LABELS: Record<NavItemKey, string> = {
  documents: 'Documents',
  compare: 'Compare',
  openApi: 'OpenAPI',
  grpc: 'gRPC',
  analytics: 'Analytics',
  templates: 'Templates',
  approvals: 'Approvals',
  linkHealth: 'Link Health',
  settings: 'Settings',
}

export function PersonalSettingsPage({
  initialNotificationPreferences,
  workspaceName,
}: {
  initialNotificationPreferences: NotificationPreferenceValues
  workspaceName: string
}) {
  const { documentWidth, resetDocumentWidth, setDocumentWidth } =
    useDocEditorWidth()
  const { aiPanelSide, setAiPanelSide } = useDocEditorAiPanelSide()
  const {
    featureVisibility,
    isUpdatingFeatureVisibility,
    updateFeatureVisibility,
    navOrder,
    isUpdatingNavOrder,
    updateNavOrder,
  } = usePersonalSettings()
  const [notificationPreferences, setNotificationPreferences] =
    React.useState<NotificationPreferenceValues>(() =>
      mergeNotificationPreferences(initialNotificationPreferences),
    )
  const [pendingNotificationKey, setPendingNotificationKey] =
    React.useState<NotificationPreferenceKey | null>(null)

  const editorDefaultsChanged =
    documentWidth !== DOC_EDITOR_WIDTH_DEFAULT || aiPanelSide !== 'right'

  const handleDocumentWidthChange = React.useCallback(
    (value: string) => {
      if (!value) {
        return
      }

      const nextWidth = Number(value)

      if (!Number.isFinite(nextWidth)) {
        return
      }

      setDocumentWidth(nextWidth)
    },
    [setDocumentWidth],
  )

  const handleNotificationToggle = React.useCallback(
    async (preferenceKey: NotificationPreferenceKey, enabled: boolean) => {
      if (pendingNotificationKey) {
        return
      }

      const previousPreferences = notificationPreferences
      const nextPreferences = mergeNotificationPreferences({
        ...previousPreferences,
        [preferenceKey]: enabled,
      })

      setNotificationPreferences(nextPreferences)
      setPendingNotificationKey(preferenceKey)

      try {
        const response = await fetch('/api/notifications/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            [preferenceKey]: enabled,
          }),
        })

        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            typeof payload?.error === 'string'
              ? payload.error
              : 'Failed to update notification preferences.',
          )
        }

        setNotificationPreferences(mergeNotificationPreferences(payload))
      } catch (error) {
        setNotificationPreferences(previousPreferences)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to update notification preferences.',
        )
      } finally {
        setPendingNotificationKey(null)
      }
    },
    [notificationPreferences, pendingNotificationKey],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Personal settings
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Tune Kite around how you work: choose the visual theme, set your
          editor defaults, decide which notifications matter, and hide advanced
          modules you do not want in the docs navigation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What you can personalize</CardTitle>
          <CardDescription>
            Personal settings now centralize the preferences that are most
            likely to vary from one teammate to another.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-border/70 bg-muted/30 p-4">
              <Badge variant="secondary">This browser</Badge>
              <p className="mt-3 text-sm font-medium text-foreground">
                Appearance and editor defaults
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Theme, document width, and the default side for the AI panel.
              </p>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/30 p-4">
              <Badge variant="secondary">{workspaceName}</Badge>
              <p className="mt-3 text-sm font-medium text-foreground">
                Notification categories
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Comments, mentions, approvals, status changes, and webhook
                failures are all adjustable per workspace.
              </p>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/30 p-4">
              <Badge variant="secondary">Account-wide</Badge>
              <p className="mt-3 text-sm font-medium text-foreground">
                Feature visibility
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Hide OpenAPI, Templates, AI management pages, Analytics,
                Approvals, and Link Health until you
                need them again.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-2 border-t pt-4">
          {featureVisibility.aiWorkspace ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/docs/settings/ai">
                  <BrainCircuit data-icon="inline-start" />
                  AI models
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/docs/settings/ai-prompts">
                  <PencilLine data-icon="inline-start" />
                  AI prompts
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              AI management pages are currently hidden. Re-enable them in
              Feature access below whenever you want them back.
            </p>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardAction>
            <Badge variant="secondary">This browser</Badge>
          </CardAction>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Theme, colors, fonts, contrast, and pointer cursors are now managed
            on a dedicated page.
          </CardDescription>
        </CardHeader>
        <CardFooter className="border-t pt-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/docs/settings/appearance">
              <Palette data-icon="inline-start" />
              Appearance settings
            </Link>
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardAction>
            <Badge variant="secondary">This browser</Badge>
          </CardAction>
          <CardTitle>Editor defaults</CardTitle>
          <CardDescription>
            Decide how the document editor should open before you start writing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <Field>
              <FieldTitle>Document width</FieldTitle>
              <FieldDescription>
                Start with a focused canvas or a wider working surface.
              </FieldDescription>
              <ToggleGroup
                type="single"
                variant="outline"
                value={String(documentWidth)}
                onValueChange={handleDocumentWidthChange}
                className="flex w-full flex-wrap"
              >
                {DOC_EDITOR_WIDTH_PRESETS.map((preset) => (
                  <ToggleGroupItem
                    key={preset.value}
                    value={String(preset.value)}
                    className="flex-1"
                  >
                    {preset.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            <FieldSeparator />

            <Field>
              <FieldTitle>AI panel side</FieldTitle>
              <FieldDescription>
                Choose which side should host the AI result panel by default.
              </FieldDescription>
              <ToggleGroup
                type="single"
                variant="outline"
                value={aiPanelSide}
                onValueChange={(value) => {
                  if (value === 'left' || value === 'right') {
                    setAiPanelSide(value)
                  }
                }}
                className="flex w-full flex-wrap"
              >
                <ToggleGroupItem value="left" className="flex-1">
                  Left
                </ToggleGroupItem>
                <ToggleGroupItem value="right" className="flex-1">
                  Right
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            These defaults apply to both document editing and template editing.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetDocumentWidth()
              setAiPanelSide('right')
            }}
            disabled={!editorDefaultsChanged}
          >
            <RotateCcw data-icon="inline-start" />
            Restore editor defaults
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardAction>
            <Badge variant="secondary">{workspaceName}</Badge>
          </CardAction>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Fine-tune which updates should appear in your notification inbox for
            the current workspace.
          </CardDescription>
        </CardHeader>
        <CardContent id="notifications">
          <FieldGroup className="gap-4">
            {NOTIFICATION_PREFERENCE_KEYS.map((preferenceKey, index) => {
              const config = NOTIFICATION_PREFERENCE_CONFIG[preferenceKey]
              const isDisabled = pendingNotificationKey !== null

              return (
                <React.Fragment key={preferenceKey}>
                  {index > 0 ? <FieldSeparator /> : null}
                  <Field
                    orientation="horizontal"
                    data-disabled={isDisabled || undefined}
                  >
                    <FieldContent>
                      <FieldLabel htmlFor={`notification-${preferenceKey}`}>
                        {config.label}
                      </FieldLabel>
                      <FieldDescription>
                        {config.description}
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id={`notification-${preferenceKey}`}
                      checked={notificationPreferences[preferenceKey]}
                      onCheckedChange={(enabled) =>
                        void handleNotificationToggle(preferenceKey, enabled)
                      }
                      disabled={isDisabled}
                    />
                  </Field>
                </React.Fragment>
              )
            })}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardAction>
            <Badge variant="secondary">Account-wide</Badge>
          </CardAction>
          <CardTitle>Navigation order</CardTitle>
          <CardDescription>
            Reorder the items in the top navigation bar to match your workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {navOrder.map((key, index) => (
              <div
                key={key}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
              >
                <span className="flex-1 text-sm font-medium text-foreground">
                  {NAV_ITEM_LABELS[key]}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === 0 || isUpdatingNavOrder}
                  onClick={() => {
                    const next = [...navOrder]
                    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                    void updateNavOrder(next)
                  }}
                  aria-label={`Move ${NAV_ITEM_LABELS[key]} up`}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === navOrder.length - 1 || isUpdatingNavOrder}
                  onClick={() => {
                    const next = [...navOrder]
                    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                    void updateNavOrder(next)
                  }}
                  aria-label={`Move ${NAV_ITEM_LABELS[key]} down`}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Changes apply to the docs navigation immediately.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={isUpdatingNavOrder || navOrder.join(',') === DEFAULT_NAV_ORDER.join(',')}
            onClick={() => void updateNavOrder(null)}
          >
            <RotateCcw data-icon="inline-start" />
            Reset to default
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardAction>
            <Badge variant="secondary">Account-wide</Badge>
          </CardAction>
          <CardTitle>Feature access</CardTitle>
          <CardDescription>
            Hide optional modules from the docs navigation. If you open a hidden
            route directly, Kite shows a restore screen instead of the module.
          </CardDescription>
        </CardHeader>
        <CardContent id="feature-access">
          <FieldGroup className="gap-4">
            {PERSONAL_FEATURE_IDS.map((featureId, index) => {
              const config = PERSONAL_FEATURE_CONFIG[featureId]

              return (
                <React.Fragment key={featureId}>
                  {index > 0 ? <FieldSeparator /> : null}
                  <Field
                    orientation="horizontal"
                    data-disabled={isUpdatingFeatureVisibility || undefined}
                  >
                    <FieldContent>
                      <FieldLabel htmlFor={`feature-${featureId}`}>
                        {config.label}
                      </FieldLabel>
                      <FieldDescription>
                        {config.description}
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id={`feature-${featureId}`}
                      checked={featureVisibility[featureId]}
                      onCheckedChange={(enabled) =>
                        void updateFeatureVisibility(
                          createPersonalFeatureVisibilityUpdate(
                            featureId,
                            enabled,
                          ),
                        )
                      }
                      disabled={isUpdatingFeatureVisibility}
                    />
                  </Field>
                </React.Fragment>
              )
            })}
          </FieldGroup>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Changes apply to the docs navigation immediately.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
