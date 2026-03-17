import { describe, expect, it } from 'vitest'

import {
  normalizeMcpServerConfigList,
  normalizeMcpServerConfigListItem,
  normalizeMcpServerConnectionTestResult,
} from '@/lib/mcp-server-config'

describe('mcp-server-config', () => {
  it('normalizes MCP server items with safe defaults for optional fields', () => {
    const item = normalizeMcpServerConfigListItem({
      id: 'server-1',
      name: 'Context7',
      transportType: 'stdio',
      args: ['-y', 1, ' @upstash/context7-mcp '],
      env: {
        npm_config_registry: 'https://registry.npmjs.org',
        ignored: 1,
      },
      enabled: 'false',
      createdAt: new Date('2026-03-17T00:00:00.000Z'),
      updatedAt: '2026-03-17T00:01:00.000Z',
    })

    expect(item).toMatchObject({
      id: 'server-1',
      name: 'Context7',
      transportType: 'stdio',
      transportLabel: 'Standard I/O',
      command: '',
      url: '',
      enabled: false,
      args: ['-y', '@upstash/context7-mcp'],
      env: {
        npm_config_registry: 'https://registry.npmjs.org',
      },
      headers: {},
      argsCount: 2,
      envCount: 1,
      headersCount: 0,
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:01:00.000Z',
    })
  })

  it('rejects non-array list payloads', () => {
    expect(() =>
      normalizeMcpServerConfigList({ items: [] }),
    ).toThrowError('Unexpected MCP servers response')
  })

  it('normalizes connection test payloads', () => {
    expect(
      normalizeMcpServerConnectionTestResult({
        ok: 'true',
        toolCount: '2',
        promptCount: 1,
        resourceCount: null,
      }),
    ).toEqual({
      ok: true,
      toolCount: 2,
      promptCount: 1,
      resourceCount: 0,
      error: undefined,
    })
  })
})
