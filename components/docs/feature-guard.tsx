'use client'

import Link from 'next/link'
import * as React from 'react'
import { EyeOff, RotateCcw, Settings2 } from 'lucide-react'

import { usePersonalSettings } from '@/components/personal-settings-provider'
import {
  PERSONAL_FEATURE_CONFIG,
  createPersonalFeatureVisibilityUpdate,
  type PersonalFeatureId,
} from '@/lib/personal-settings'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'

export function FeatureGuard({
  featureId,
  children,
}: {
  featureId: PersonalFeatureId
  children: React.ReactNode
}) {
  const {
    featureVisibility,
    isUpdatingFeatureVisibility,
    pendingFeatureIds,
    updateFeatureVisibility,
  } = usePersonalSettings()

  if (featureVisibility[featureId]) {
    return <>{children}</>
  }

  const feature = PERSONAL_FEATURE_CONFIG[featureId]
  const isPending = isUpdatingFeatureVisibility || pendingFeatureIds.includes(featureId)

  return (
    <div className="mx-auto flex max-w-4xl px-4 py-8 sm:px-6">
      <Empty className="w-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <EyeOff />
          </EmptyMedia>
          <EmptyTitle>{feature.label} is hidden</EmptyTitle>
          <EmptyDescription>
            You turned this module off in Personal settings to keep the docs
            workspace focused. Turn it back on whenever you need it again.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={() =>
              void updateFeatureVisibility(
                createPersonalFeatureVisibilityUpdate(featureId, true),
              )
            }
            disabled={isPending}
          >
            {isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RotateCcw data-icon="inline-start" />
            )}
            Show again
          </Button>

          <Button asChild variant="outline">
            <Link href="/docs/settings/personal#feature-access">
              <Settings2 data-icon="inline-start" />
              Open Personal settings
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
