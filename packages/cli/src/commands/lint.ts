import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { readFile } from 'node:fs/promises'
import { apiRequest } from '../lib/api-client.js'

const SEVERITY_COLORS: Record<string, (s: string) => string> = {
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  hint: chalk.dim,
}

export const lintCommand = new Command('lint')
  .description('Lint an OpenAPI spec file')
  .argument('<file>', 'Path to OpenAPI spec file')
  .action(async (file) => {
    const spinner = ora('Linting…').start()

    try {
      const content = await readFile(file, 'utf-8')

      // Push the spec to get an ID, then trigger lint
      const uploadRes = await apiRequest('/api/openapi', {
        method: 'POST',
        body: JSON.stringify({ name: `lint-${Date.now()}`, rawContent: content }),
      })
      const source = await uploadRes.json() as { id: string }

      const lintRes = await apiRequest(`/api/openapi/${source.id}/lint`, {
        method: 'POST',
      })
      const results = await lintRes.json() as Array<{
        severity: string
        message: string
        path?: string
        line?: number
      }>

      spinner.stop()

      if (results.length === 0) {
        console.log(chalk.green('✓'), 'No issues found')
        return
      }

      const counts = { error: 0, warning: 0, info: 0, hint: 0 }
      for (const r of results) {
        const colorFn = SEVERITY_COLORS[r.severity] || chalk.dim
        const location = r.path || (r.line ? `line ${r.line}` : '')
        counts[r.severity as keyof typeof counts] = (counts[r.severity as keyof typeof counts] || 0) + 1

        console.log(
          colorFn(`  ${r.severity.padEnd(7)}`),
          r.message,
          location ? chalk.dim(`(${location})`) : '',
        )
      }

      console.log()
      const parts: string[] = []
      if (counts.error) parts.push(chalk.red(`${counts.error} error${counts.error !== 1 ? 's' : ''}`))
      if (counts.warning) parts.push(chalk.yellow(`${counts.warning} warning${counts.warning !== 1 ? 's' : ''}`))
      if (counts.info) parts.push(chalk.blue(`${counts.info} info`))
      console.log(`  ${parts.join(', ')}`)

      if (counts.error > 0) process.exit(1)
    } catch (err) {
      spinner.fail('Lint failed')
      console.error(chalk.red(`  ${(err as Error).message}`))
      process.exit(1)
    }
  })
