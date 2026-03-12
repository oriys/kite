'use client'

import * as React from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CopyButton } from '@/components/ui/copy-button'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateCodeSnippet, CODE_TARGETS, type RequestConfig } from '@/lib/code-generation'
import { highlightCodeSegments } from '@/lib/code-highlighting'

interface CodeSnippetTabsProps {
  config: RequestConfig
  className?: string
}

function HighlightedCode({ code, language }: { code: string; language: string }) {
  const segments = React.useMemo(
    () => highlightCodeSegments(code, language),
    [code, language],
  )

  return (
    <>
      {segments.map((segment, i) =>
        segment.className ? (
          <span key={i} className={segment.className}>
            {segment.text}
          </span>
        ) : (
          segment.text
        ),
      )}
    </>
  )
}

export function CodeSnippetTabs({ config, className }: CodeSnippetTabsProps) {
  const [activeTab, setActiveTab] = React.useState(CODE_TARGETS[0].id)
  const [snippets, setSnippets] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState<string | null>(null)

  // Serialize config for cache invalidation
  const configKey = React.useMemo(
    () => JSON.stringify(config),
    [config],
  )

  // Clear cache when config changes
  React.useEffect(() => {
    setSnippets({})
  }, [configKey])

  // Generate snippet lazily when tab is selected
  React.useEffect(() => {
    const target = CODE_TARGETS.find((t) => t.id === activeTab)
    if (!target || snippets[activeTab]) return

    let cancelled = false
    setLoading(activeTab)

    generateCodeSnippet(config, target).then((code) => {
      if (cancelled) return
      setSnippets((prev) => ({ ...prev, [activeTab]: code }))
      setLoading(null)
    })

    return () => {
      cancelled = true
    }
  }, [activeTab, configKey, config, snippets])

  return (
    <div className={cn('overflow-hidden rounded-md border border-border/80', className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between border-b border-border/80 bg-muted/40 px-3 py-1.5">
          <TabsList className="h-8 bg-transparent p-0">
            {CODE_TARGETS.map((target) => (
              <TabsTrigger
                key={target.id}
                value={target.id}
                className="h-7 rounded-sm px-2.5 text-xs data-[state=active]:bg-background/80 data-[state=active]:shadow-sm"
              >
                {target.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {CODE_TARGETS.map((target) => (
          <TabsContent key={target.id} value={target.id} className="mt-0">
            <div className="relative group bg-neutral-950 dark:bg-neutral-950">
              {loading === target.id ? (
                <div className="flex items-center justify-center py-12 text-neutral-500">
                  <Loader2 className="size-4 motion-safe:animate-spin" />
                  <span className="ml-2 text-xs">Generating…</span>
                </div>
              ) : (
                <>
                  <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6 text-neutral-200">
                    <code>
                      <HighlightedCode
                        code={snippets[target.id] ?? ''}
                        language={target.language}
                      />
                    </code>
                  </pre>
                  {snippets[target.id] && (
                    <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <CopyButton
                        value={snippets[target.id]}
                        className="h-6 w-6 border border-neutral-700 bg-neutral-900/80 text-neutral-400 shadow-sm backdrop-blur-sm hover:bg-neutral-800 hover:text-neutral-200"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
