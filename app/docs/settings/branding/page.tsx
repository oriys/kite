'use client'

import * as React from 'react'
import { Palette, Globe, Image as ImageIcon, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface BrandingData {
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string | null
  accentColor: string | null
  customDomain: string | null
  customCss: string | null
  metaTitle: string | null
  metaDescription: string | null
  ogImageUrl: string | null
}

const defaultBranding: BrandingData = {
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  accentColor: null,
  customDomain: null,
  customCss: null,
  metaTitle: null,
  metaDescription: null,
  ogImageUrl: null,
}

export default function BrandingSettingsPage() {
  const [data, setData] = React.useState<BrandingData>(defaultBranding)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/branding')
      .then((r) => r.json())
      .then((d) => setData({ ...defaultBranding, ...d }))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const update = (key: keyof BrandingData, value: string) =>
    setData((prev) => ({ ...prev, [key]: value || null }))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Branding & Custom Domain
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Customize how your documentation portal appears to visitors
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4" />
              Custom Domain
            </CardTitle>
            <CardDescription>
              Serve your docs on your own domain
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Domain</Label>
              <Input
                placeholder="docs.yourcompany.com"
                value={data.customDomain ?? ''}
                onChange={(e) => update('customDomain', e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Add a CNAME record pointing to your deployment URL
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ImageIcon className="h-4 w-4" />
              Logo & Images
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input
                  placeholder="https://…/logo.svg"
                  value={data.logoUrl ?? ''}
                  onChange={(e) => update('logoUrl', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Favicon URL</Label>
                <Input
                  placeholder="https://…/favicon.ico"
                  value={data.faviconUrl ?? ''}
                  onChange={(e) => update('faviconUrl', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>OG Image URL</Label>
              <Input
                placeholder="https://…/og-image.png"
                value={data.ogImageUrl ?? ''}
                onChange={(e) => update('ogImageUrl', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Palette className="h-4 w-4" />
              Colors & Styling
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    className="h-9 w-12 cursor-pointer p-1"
                    value={data.primaryColor ?? '#1a1a1a'}
                    onChange={(e) => update('primaryColor', e.target.value)}
                  />
                  <Input
                    placeholder="#1a1a1a"
                    value={data.primaryColor ?? ''}
                    onChange={(e) => update('primaryColor', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    className="h-9 w-12 cursor-pointer p-1"
                    value={data.accentColor ?? '#3b82f6'}
                    onChange={(e) => update('accentColor', e.target.value)}
                  />
                  <Input
                    placeholder="#3b82f6"
                    value={data.accentColor ?? ''}
                    onChange={(e) => update('accentColor', e.target.value)}
                  />
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Custom CSS</Label>
              <Textarea
                className="font-mono text-xs"
                placeholder=":root { --custom-var: value; }"
                rows={5}
                value={data.customCss ?? ''}
                onChange={(e) => update('customCss', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">SEO & Meta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Site Title</Label>
              <Input
                placeholder="Your API Documentation"
                value={data.metaTitle ?? ''}
                onChange={(e) => update('metaTitle', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta Description</Label>
              <Textarea
                placeholder="Comprehensive API documentation for…"
                rows={2}
                value={data.metaDescription ?? ''}
                onChange={(e) => update('metaDescription', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
