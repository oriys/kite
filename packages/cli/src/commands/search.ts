import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { apiRequest } from '../lib/api-client.js'

export const searchCommand = new Command('search')
  .description('Search documents')
  .argument('<query>', 'Search query')
  .option('-l, --limit <n>', 'Max results', '10')
  .action(async (query, opts) => {
    const spinner = ora('Searching…').start()

    try {
      const limit = parseInt(opts.limit, 10) || 10
      const params = new URLSearchParams({
        q: query,
        mode: 'keyword',
        limit: String(limit),
      })

      const res = await apiRequest(`/api/search?${params}`)
      const data = (await res.json()) as {
        results: Array<{
          documentId: string
          title: string
          slug?: string
          preview?: string
          score?: number
        }>
      }

      spinner.stop()

      if (!data.results || data.results.length === 0) {
        console.log(chalk.dim('  No results found'))
        return
      }

      for (const r of data.results) {
        const score = r.score != null ? chalk.dim(` (${r.score.toFixed(2)})`) : ''
        console.log(`  ${chalk.bold(r.title)}${score}`)
        if (r.slug) console.log(`  ${chalk.cyan(r.slug)}`)
        if (r.preview) console.log(`  ${chalk.dim(r.preview.slice(0, 120))}`)
        console.log()
      }

      console.log(chalk.dim(`  ${data.results.length} result${data.results.length !== 1 ? 's' : ''}`))
    } catch (err) {
      spinner.fail('Search failed')
      console.error(chalk.red(`  ${(err as Error).message}`))
      process.exit(1)
    }
  })
