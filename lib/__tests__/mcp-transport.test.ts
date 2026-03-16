import { describe, expect, it } from 'vitest'

import {
  getAllowedMcpStdioCommands,
  parseMcpRemoteUrl,
  validateMcpStdioCommand,
} from '../mcp-transport'

describe('mcp-transport', () => {
  it('allows supported stdio commands', () => {
    for (const command of getAllowedMcpStdioCommands()) {
      expect(() => validateMcpStdioCommand(command)).not.toThrow()
    }
  })

  it('allows whitelisted commands with absolute paths', () => {
    expect(() => validateMcpStdioCommand('/usr/local/bin/npx')).not.toThrow()
  })

  it('rejects unsupported stdio commands', () => {
    expect(() => validateMcpStdioCommand('sh')).toThrow(
      /Stdio command "sh" is not allowed/,
    )
  })

  it('parses valid http and https MCP URLs', () => {
    expect(parseMcpRemoteUrl('https://mcp.example.com/sse').toString()).toBe(
      'https://mcp.example.com/sse',
    )
    expect(parseMcpRemoteUrl('http://127.0.0.1:8123/mcp').toString()).toBe(
      'http://127.0.0.1:8123/mcp',
    )
  })

  it('rejects malformed or unsupported MCP URLs', () => {
    expect(() => parseMcpRemoteUrl('not a url')).toThrow('Invalid URL')
    expect(() => parseMcpRemoteUrl('ws://mcp.example.com')).toThrow(
      'Only http and https URLs are supported',
    )
  })
})
