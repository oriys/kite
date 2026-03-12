'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VersionBadge } from '@/components/version-badge'
import { cn } from '@/lib/utils'

interface ApiVersion {
  id: string
  label: string
  slug: string
  status: 'active' | 'beta' | 'deprecated' | 'retired'
  isDefault: boolean
}

interface VersionSwitcherProps {
  currentVersionId?: string
  onVersionChange: (versionId: string | null) => void
  className?: string
}

const ALL_VERSIONS_VALUE = '__all__'

export function VersionSwitcher({
  currentVersionId,
  onVersionChange,
  className,
}: VersionSwitcherProps) {
  const [versions, setVersions] = useState<ApiVersion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchVersions() {
      try {
        const res = await fetch('/api/api-versions')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setVersions(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchVersions()
    return () => {
      cancelled = true
    }
  }, [])

  const handleChange = useCallback(
    (value: string) => {
      onVersionChange(value === ALL_VERSIONS_VALUE ? null : value)
    },
    [onVersionChange],
  )

  if (loading) {
    return (
      <div
        className={cn(
          'h-9 w-40 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800',
          className,
        )}
      />
    )
  }

  if (versions.length === 0) return null

  return (
    <Select
      value={currentVersionId ?? ALL_VERSIONS_VALUE}
      onValueChange={handleChange}
    >
      <SelectTrigger
        className={cn(
          'w-auto min-w-[160px] gap-2 text-sm font-medium',
          className,
        )}
      >
        <SelectValue placeholder="Select version" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VERSIONS_VALUE}>All versions</SelectItem>
        {versions.map((v) => (
          <SelectItem key={v.id} value={v.id}>
            <span className="flex items-center gap-2">
              <span>{v.label}</span>
              <VersionBadge status={v.status} />
              {v.isDefault && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                  default
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
