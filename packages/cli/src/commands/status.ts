import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { apiRequest } from '../lib/api-client.js'

export const statusCommand = new Command('status')
  .description('Show workspace overview')
  .action(async () => {
    const spinner = ora('Fetching status…').start()

    try {
      // Fetch documents and openapi sources in parallel
      const [docsRes, openapiRes] = await Promise.all([
        apiRequest('/api/documents?page_size=100'),
        apiRequest('/api/openapi').catch(() => null),
      ])

      const docsData = (await docsRes.json()) as {
        items: Array<{ status: string }>
        total?: number
      }

      let openapiCount = 0
      if (openapiRes) {
        const openapiData = (await openapiRes.json()) as {
          items: Array<unknown>
        }
        openapiCount = openapiData.items?.length || 0
      }

      spinner.stop()

      const docs = docsData.items || []
      const counts: Record<string, number> = {}
      for (const doc of docs) {
        counts[doc.status] = (counts[doc.status] || 0) + 1
      }

      const total = docsData.total ?? docs.length

      console.log(chalk.bold('  Workspace Overview'))
      console.log()
      console.log(`  Documents:       ${chalk.bold(String(total))}`)
      if (counts.draft) console.log(`    Draft:         ${chalk.yellow(String(counts.draft))}`)
      if (counts.review) console.log(`    In Review:     ${chalk.blue(String(counts.review))}`)
      if (counts.published) console.log(`    Published:     ${chalk.green(String(counts.published))}`)
      if (counts.archived) console.log(`    Archived:      ${chalk.dim(String(counts.archived))}`)
      console.log(`  OpenAPI Sources:  ${chalk.bold(String(openapiCount))}`)
    } catch (err) {
      spinner.fail('Failed to fetch status')
      console.error(chalk.red(`  ${(err as Error).message}`))
      process.exit(1)
    }
  })
