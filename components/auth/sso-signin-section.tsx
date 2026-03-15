'use client'

import * as React from 'react'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SsoSignInSection() {
  const [slug, setSlug] = React.useState('')

  return (
    <form
      action={`/api/auth/sso`}
      method="GET"
      className="flex gap-2"
      onSubmit={(e) => {
        if (!slug.trim()) {
          e.preventDefault()
          return
        }
        e.preventDefault()
        window.location.href = `/api/auth/sso?workspace=${encodeURIComponent(slug.trim())}`
      }}
    >
      <Input
        name="workspace"
        placeholder="Workspace slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" variant="outline" disabled={!slug.trim()}>
        <KeyRound className="size-4" />
        SSO
      </Button>
    </form>
  )
}
