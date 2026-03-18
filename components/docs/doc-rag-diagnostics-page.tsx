'use client'

import * as React from 'react'
import { Loader2, Play } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'

interface DiagnosticTimings {
  semanticSearchMs: number
  keywordSearchMs: number
  neighborhoodMs: number
  rerankMs: number
  referenceExpansionMs: number
  totalMs: number
}

interface SemanticChunk {
  chunkId: string
  documentId: string
  documentTitle: string
  chunkIndex: number
  similarity: number
}

interface KeywordDocument {
  documentId: string
  title: string
}

interface RerankScore {
  documentId: string
  title: string
  score: number | null
}

interface SelectedSection {
  documentId: string
  title: string
  relationType: string
  contentPreview: string
}

interface DiagnosticsResult {
  context: {
    text: string
    sources: unknown[]
  }
  diagnostics: {
    queryVariants: string[]
    timings: DiagnosticTimings
    semanticChunks: SemanticChunk[]
    keywordDocuments: KeywordDocument[]
    rerankScores: RerankScore[]
    selectedSections: SelectedSection[]
  }
}

const TIMING_LABELS: Record<keyof DiagnosticTimings, string> = {
  semanticSearchMs: 'Semantic Search',
  keywordSearchMs: 'Keyword Search',
  neighborhoodMs: 'Neighborhood',
  rerankMs: 'Rerank',
  referenceExpansionMs: 'Reference Expansion',
  totalMs: 'Total',
}

export function DocRagDiagnosticsPage() {
  const [query, setQuery] = React.useState('')
  const [documentId, setDocumentId] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<DiagnosticsResult | null>(null)

  async function handleRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/rag-diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          documentId: documentId.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(
          typeof body?.error === 'string' ? body.error : 'Diagnostics query failed',
        )
      }

      const data: DiagnosticsResult = await response.json()
      setResult(data)
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : 'An unexpected error occurred',
      )
    } finally {
      setLoading(false)
    }
  }

  const diag = result?.diagnostics

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          RAG Diagnostics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inspect the retrieval pipeline to debug search quality and
          performance.
        </p>
      </div>

      {/* Query input */}
      <section>
        <form onSubmit={handleRun}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="rag-query">Query</FieldLabel>
              <FieldContent>
                <Input
                  id="rag-query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="How do I authenticate API requests?"
                />
                <FieldDescription>
                  The user question to run through the retrieval pipeline.
                </FieldDescription>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="rag-doc-id">
                Document ID (optional)
              </FieldLabel>
              <FieldContent>
                <Input
                  id="rag-doc-id"
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                  placeholder="clx..."
                />
                <FieldDescription>
                  Scope the query to a specific document.
                </FieldDescription>
              </FieldContent>
            </Field>
            <div>
              <Button type="submit" disabled={loading || !query.trim()}>
                {loading ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Play data-icon="inline-start" />
                )}
                Run
              </Button>
            </div>
          </FieldGroup>
        </form>
      </section>

      {/* Error */}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Results */}
      {diag ? (
        <div className="space-y-6">
          {/* Timings */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Timings
            </h2>
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/30">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Stage
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(TIMING_LABELS).map(([key, label]) => (
                    <tr
                      key={key}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td
                        className={`px-4 py-2 ${key === 'totalMs' ? 'font-semibold text-foreground' : 'text-foreground'}`}
                      >
                        {label}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-mono ${key === 'totalMs' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                      >
                        {diag.timings[key as keyof DiagnosticTimings]}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Query Variants */}
          {diag.queryVariants.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Query Variants
              </h2>
              <ul className="space-y-1 rounded-xl border border-border/70 p-4">
                {diag.queryVariants.map((variant, i) => (
                  <li key={i} className="text-sm text-foreground">
                    {variant}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Semantic Chunks */}
          {diag.semanticChunks.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Semantic Chunks
              </h2>
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/30">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Document
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                        Chunk
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                        Similarity
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {diag.semanticChunks.map((chunk) => (
                      <tr
                        key={chunk.chunkId}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-4 py-2 text-foreground">
                          {chunk.documentTitle}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                          {chunk.chunkIndex}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                          {chunk.similarity.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* Keyword Documents */}
          {diag.keywordDocuments.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Keyword Documents
              </h2>
              <ul className="space-y-1 rounded-xl border border-border/70 p-4">
                {diag.keywordDocuments.map((doc) => (
                  <li
                    key={doc.documentId}
                    className="text-sm text-foreground"
                  >
                    {doc.title}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Rerank Scores */}
          {diag.rerankScores.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Rerank Scores
              </h2>
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/30">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Document
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {diag.rerankScores.map((entry, entryIndex) => (
                      <tr
                        key={`${entry.documentId}-${entryIndex}`}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-4 py-2 text-foreground">
                          {entry.title}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                          {entry.score !== null ? entry.score.toFixed(4) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* Selected Sections */}
          {diag.selectedSections.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Selected Sections
              </h2>
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/30">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Document
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Relation
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Content Preview
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {diag.selectedSections.map((section, i) => (
                      <tr
                        key={`${section.documentId}-${i}`}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-4 py-2 text-foreground">
                          {section.title}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {section.relationType}
                        </td>
                        <td className="max-w-md truncate px-4 py-2 font-mono text-xs text-muted-foreground">
                          {section.contentPreview}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
