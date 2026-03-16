const ALLOWED_STDIO_COMMANDS = [
  'node',
  'npx',
  'python',
  'python3',
  'uvx',
  'docker',
  'deno',
  'bun',
  'bunx',
] as const

const ALLOWED_STDIO_COMMAND_SET = new Set<string>(ALLOWED_STDIO_COMMANDS)

export function getAllowedMcpStdioCommands() {
  return [...ALLOWED_STDIO_COMMANDS]
}

export function validateMcpStdioCommand(command: string) {
  const binary = command.split('/').pop()?.split('\\').pop() ?? command
  if (!ALLOWED_STDIO_COMMAND_SET.has(binary)) {
    throw new Error(
      `Stdio command "${binary}" is not allowed. Permitted: ${getAllowedMcpStdioCommands().join(', ')}`,
    )
  }
}

export function parseMcpRemoteUrl(input: string) {
  let url: URL

  try {
    url = new URL(input)
  } catch {
    throw new Error('Invalid URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported')
  }

  return url
}
