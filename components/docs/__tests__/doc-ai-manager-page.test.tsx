import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { DocAiManagerPage } from '../doc-ai-manager-page'
import { useAiModels } from '@/hooks/use-ai-models'
import { useAiPreferences } from '@/hooks/use-ai-preferences'
import { useAiProviders } from '@/hooks/use-ai-providers'

vi.mock('@/hooks/use-ai-models', () => ({
  useAiModels: vi.fn(),
}))

vi.mock('@/hooks/use-ai-preferences', () => ({
  useAiPreferences: vi.fn(),
}))

vi.mock('@/hooks/use-ai-providers', () => ({
  useAiProviders: vi.fn(),
}))

const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  vi.clearAllMocks()
})

afterAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
})

describe('DocAiManagerPage', () => {
  it('does not loop when hooks return fresh empty arrays during loading', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(useAiModels).mockImplementation(() => ({
      catalog: null,
      items: [],
      configured: false,
      providers: [],
      defaultModelId: '',
      enabledModelIds: [],
      fetchedAt: '',
      loading: true,
      error: null,
      refresh: vi.fn(),
    }))

    vi.mocked(useAiPreferences).mockImplementation(() => ({
      preferences: {
        activeModelId: null,
        enabledModelIds: [],
      },
      enabledModels: [],
      activeModel: null,
      activeModelId: null,
      enabledModelIds: [],
      saving: false,
      toggleModel: vi.fn(),
      setActiveModelId: vi.fn(),
      resetToDefault: vi.fn(),
    }))

    vi.mocked(useAiProviders).mockImplementation(() => ({
      items: [],
      loading: true,
      mutating: false,
      error: null,
      refresh: vi.fn(),
      createProvider: vi.fn(),
      updateProvider: vi.fn(),
      deleteProvider: vi.fn(),
    }))

    expect(() => {
      act(() => {
        root.render(<DocAiManagerPage />)
      })
    }).not.toThrow()

    act(() => {
      root.unmount()
    })
    consoleErrorSpy.mockRestore()
    container.remove()
  })

  it('does not mount the default-model select before a valid active model exists', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)

    vi.mocked(useAiModels).mockReturnValue({
      catalog: null,
      items: [],
      configured: false,
      providers: [],
      defaultModelId: '',
      enabledModelIds: [],
      fetchedAt: '',
      loading: false,
      error: null,
      refresh: vi.fn(),
    })

    vi.mocked(useAiPreferences).mockReturnValue({
      preferences: {
        activeModelId: null,
        enabledModelIds: [],
      },
      enabledModels: [],
      activeModel: null,
      activeModelId: null,
      enabledModelIds: [],
      saving: false,
      toggleModel: vi.fn(),
      setActiveModelId: vi.fn(),
      resetToDefault: vi.fn(),
    })

    vi.mocked(useAiProviders).mockReturnValue({
      items: [],
      loading: false,
      mutating: false,
      error: null,
      refresh: vi.fn(),
      createProvider: vi.fn(),
      updateProvider: vi.fn(),
      deleteProvider: vi.fn(),
    })

    act(() => {
      root.render(<DocAiManagerPage />)
    })

    expect(
      container.textContent,
    ).toContain('Enable a model below to choose a default route.')
    expect(container.querySelector('[role="combobox"]')).toBeNull()

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
