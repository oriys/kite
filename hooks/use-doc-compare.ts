'use client'

import * as React from 'react'
import { type Doc, type DocVersion } from '@/lib/documents'

export type CompareMode = 'version' | 'locale' | 'document'

export interface TranslationLink {
  id: string
  documentId: string
  locale: string
  status: string
  documentTitle: string
}

export interface CompareSide {
  doc: Doc | null
  /** For version mode: the selected version content, or current doc content */
  content: string
  title: string
  label: string
  loading: boolean
}

interface UseDocCompareOptions {
  initialDocId?: string | null
  initialMode?: CompareMode
}

export function useDocCompare(options: UseDocCompareOptions = {}) {
  const [mode, setMode] = React.useState<CompareMode>(options.initialMode ?? 'version')
  const [baseDocId, setBaseDocId] = React.useState<string | null>(options.initialDocId ?? null)

  // Version mode state
  const [versions, setVersions] = React.useState<DocVersion[]>([])
  const [leftVersionId, setLeftVersionId] = React.useState<string | null>(null)
  const [rightVersionId, setRightVersionId] = React.useState<string | null>(null)

  // Locale mode state
  const [translations, setTranslations] = React.useState<TranslationLink[]>([])
  const [currentLocale, setCurrentLocale] = React.useState('en')
  const [rightLocaleDocId, setRightLocaleDocId] = React.useState<string | null>(null)

  // Document mode state
  const [leftDocId, setLeftDocId] = React.useState<string | null>(options.initialDocId ?? null)
  const [rightDocId, setRightDocId] = React.useState<string | null>(null)

  // Fetched data
  const [baseDoc, setBaseDoc] = React.useState<Doc | null>(null)
  const [rightDoc, setRightDoc] = React.useState<Doc | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [versionsLoading, setVersionsLoading] = React.useState(false)

  // View mode: 'diff' for text diff, 'preview' for rendered markdown
  const [viewMode, setViewMode] = React.useState<'diff' | 'preview'>('diff')

  // Fetch base document
  const fetchDoc = React.useCallback(async (id: string): Promise<Doc | null> => {
    try {
      const res = await fetch(`/api/documents/${id}`)
      if (!res.ok) return null
      return (await res.json()) as Doc
    } catch {
      return null
    }
  }, [])

  // Fetch versions for a document
  const fetchVersions = React.useCallback(async (docId: string) => {
    setVersionsLoading(true)
    try {
      const res = await fetch(`/api/documents/${docId}/versions`)
      if (!res.ok) return
      const data = (await res.json()) as DocVersion[]
      setVersions(data)
      // Auto-select: latest two versions, or current + latest version
      if (data.length >= 1) {
        setLeftVersionId(data.length >= 2 ? data[1].id : null)
        setRightVersionId(data[0].id)
      }
    } finally {
      setVersionsLoading(false)
    }
  }, [])

  // Fetch translations for a document
  const fetchTranslations = React.useCallback(async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/translations`)
      if (!res.ok) return
      const data = (await res.json()) as { currentLocale: string; translations: TranslationLink[] }
      setCurrentLocale(data.currentLocale)
      setTranslations(data.translations)
      if (data.translations.length > 0) {
        setRightLocaleDocId(data.translations[0].documentId)
      }
    } catch {
      // silent
    }
  }, [])

  // Load base document and mode-specific data
  React.useEffect(() => {
    if (!baseDocId) return

    let cancelled = false

    async function load() {
      setLoading(true)
      const doc = await fetchDoc(baseDocId!)
      if (cancelled) return
      setBaseDoc(doc)
      setLoading(false)
    }

    void load()
    return () => { cancelled = true }
  }, [baseDocId, fetchDoc])

  // Load versions when mode is 'version'
  React.useEffect(() => {
    if (mode === 'version' && baseDocId) {
      void fetchVersions(baseDocId)
    }
  }, [mode, baseDocId, fetchVersions])

  // Load translations when mode is 'locale'
  React.useEffect(() => {
    if (mode === 'locale' && baseDocId) {
      void fetchTranslations(baseDocId)
    }
  }, [mode, baseDocId, fetchTranslations])

  // Fetch right document for locale/document modes
  React.useEffect(() => {
    const targetId = mode === 'locale' ? rightLocaleDocId : mode === 'document' ? rightDocId : null
    if (!targetId) {
      setRightDoc(null)
      return
    }

    let cancelled = false

    async function load() {
      const doc = await fetchDoc(targetId!)
      if (cancelled) return
      setRightDoc(doc)
    }

    void load()
    return () => { cancelled = true }
  }, [mode, rightLocaleDocId, rightDocId, fetchDoc])

  // Fetch left document for document mode (when different from baseDoc)
  React.useEffect(() => {
    if (mode === 'document' && leftDocId && leftDocId !== baseDocId) {
      let cancelled = false

      async function load() {
        const doc = await fetchDoc(leftDocId!)
        if (cancelled) return
        setBaseDoc(doc)
      }

      void load()
      return () => { cancelled = true }
    }
  }, [mode, leftDocId, baseDocId, fetchDoc])

  // Compute left/right content
  const left = React.useMemo((): CompareSide => {
    if (mode === 'version') {
      // Left: either a selected version or current doc
      if (leftVersionId === null) {
        return {
          doc: baseDoc,
          content: baseDoc?.content ?? '',
          title: baseDoc?.title ?? '',
          label: 'Current',
          loading,
        }
      }
      const ver = versions.find((v) => v.id === leftVersionId)
      return {
        doc: baseDoc,
        content: ver?.content ?? '',
        title: baseDoc?.title ?? '',
        label: ver ? formatDate(ver.savedAt) : 'Version',
        loading: loading || versionsLoading,
      }
    }

    // For locale/document modes, left is always the base doc
    return {
      doc: baseDoc,
      content: baseDoc?.content ?? '',
      title: baseDoc?.title ?? '',
      label: mode === 'locale' ? (baseDoc?.locale ?? currentLocale) : 'Left',
      loading,
    }
  }, [mode, baseDoc, leftVersionId, versions, loading, versionsLoading, currentLocale])

  const right = React.useMemo((): CompareSide => {
    if (mode === 'version') {
      if (rightVersionId === null) {
        return {
          doc: baseDoc,
          content: baseDoc?.content ?? '',
          title: baseDoc?.title ?? '',
          label: 'Current',
          loading,
        }
      }
      const ver = versions.find((v) => v.id === rightVersionId)
      return {
        doc: baseDoc,
        content: ver?.content ?? '',
        title: baseDoc?.title ?? '',
        label: ver ? formatDate(ver.savedAt) : 'Version',
        loading: loading || versionsLoading,
      }
    }

    if (mode === 'locale') {
      const tl = translations.find((t) => t.documentId === rightLocaleDocId)
      return {
        doc: rightDoc,
        content: rightDoc?.content ?? '',
        title: rightDoc?.title ?? tl?.documentTitle ?? '',
        label: tl?.locale ?? '',
        loading: !rightDoc && !!rightLocaleDocId,
      }
    }

    // document mode
    return {
      doc: rightDoc,
      content: rightDoc?.content ?? '',
      title: rightDoc?.title ?? '',
      label: 'Right',
      loading: !rightDoc && !!rightDocId,
    }
  }, [mode, baseDoc, rightVersionId, versions, loading, versionsLoading, translations, rightLocaleDocId, rightDoc, rightDocId])

  const swap = React.useCallback(() => {
    if (mode === 'version') {
      setLeftVersionId(rightVersionId)
      setRightVersionId(leftVersionId)
    } else if (mode === 'document') {
      setLeftDocId(rightDocId)
      setRightDocId(leftDocId)
    }
  }, [mode, leftVersionId, rightVersionId, leftDocId, rightDocId])

  return {
    mode,
    setMode,
    baseDocId,
    setBaseDocId,

    // Version mode
    versions,
    leftVersionId,
    setLeftVersionId,
    rightVersionId,
    setRightVersionId,
    versionsLoading,

    // Locale mode
    translations,
    currentLocale,
    rightLocaleDocId,
    setRightLocaleDocId,

    // Document mode
    leftDocId,
    setLeftDocId,
    rightDocId,
    setRightDocId,

    // Computed sides
    left,
    right,
    loading,

    // View mode
    viewMode,
    setViewMode,

    // Actions
    swap,
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}
