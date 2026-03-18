import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { readFile } from 'node:fs/promises'
import { apiRequest } from '../lib/api-client.js'

const listCommand = new Command('list')
  .description('List documents')
  .option('-s, --status <status>', 'Filter by status (draft, review, published, archived)')
  .option('-l, --limit <n>', 'Max results', '20')
  .action(async (opts) => {
    const spinner = ora('Fetching documents…').start()

    try {
      const params = new URLSearchParams({ page_size: opts.limit || '20' })
      if (opts.status) params.set('status', opts.status)

      const res = await apiRequest(`/api/documents?${params}`)
      const data = (await res.json()) as {
        items: Array<{
          id: string
          title: string
          slug: string
          status: string
          updatedAt: string
        }>
      }

      spinner.stop()

      if (data.items.length === 0) {
        console.log(chalk.dim('  No documents found'))
        return
      }

      const statusColors: Record<string, (s: string) => string> = {
        draft: chalk.yellow,
        review: chalk.blue,
        published: chalk.green,
        archived: chalk.dim,
      }

      for (const doc of data.items) {
        const colorFn = statusColors[doc.status] || chalk.white
        const status = colorFn(doc.status.padEnd(9))
        console.log(`  ${status} ${chalk.bold(doc.title)} ${chalk.dim(doc.slug)}`)
      }

      console.log()
      console.log(chalk.dim(`  ${data.items.length} document${data.items.length !== 1 ? 's' : ''}`))
    } catch (err) {
      spinner.fail('Failed to list documents')
      console.error(chalk.red(`  ${(err as Error).message}`))
      process.exit(1)
    }
  })

const getCommand = new Command('get')
  .description('Get a document by slug or ID')
  .argument('<slug>', 'Document slug or ID')
  .option('--json', 'Output as JSON')
  .action(async (slug, opts) => {
    const spinner = ora('Fetching document…').start()

    try {
      const listRes = await apiRequest(
        `/api/documents?q=${encodeURIComponent(slug)}&page_size=50`,
      )
      const data = (await listRes.json()) as {
        items: Array<{
          id: string
          title: string
          slug: string
          status: string
          content: string | null
          updatedAt: string
        }>
      }

      const doc = data.items.find((d) => d.slug === slug || d.id === slug)

      if (!doc) {
        spinner.fail(`Document "${slug}" not found`)
        process.exit(1)
      }

      spinner.stop()

      if (opts.json) {
        console.log(JSON.stringify(doc, null, 2))
      } else {
        console.log(chalk.bold(doc.title))
        console.log(chalk.dim(`slug: ${doc.slug}  status: ${doc.status}  updated: ${doc.updatedAt}`))
        console.log()
        console.log(doc.content || chalk.dim('(empty)'))
      }
    } catch (err) {
      spinner.fail('Failed to get document')
      console.error(chalk.red(`  ${(err as Error).message}`))
      process.exit(1)
    }
  })

const createCommand = new Command('create')
  .description('Create a new document')
  .requiredOption('--title <title>', 'Document title')
  .option('--file <path>', 'Read content from file')
  .action(async (opts) => {
    const spinner = ora('Creating document…').start()

    try {
      let content = ''
      if (opts.file) {
        content = await readFile(opts.file, 'utf-8')
      }

      const res = await apiRequest('/api/documents', {
        method: 'POST',
        body: JSON.stringify({ title: opts.title, content }),
      })
      const doc = (await res.json()) as { id: string; title: string; slug: string }

      spinner.succeed(`Created ${chalk.bold(doc.title)} ${chalk.dim(doc.slug)}`)
    } catch (err) {
      spinner.fail('Failed to create document')
      console.error(chalk.red(`  ${(err as Error).message}`))
      process.exit(1)
    }
  })

const deleteCommand = new Command('delete')
  .description('Delete a document')
  .argument('<slug>', 'Document slug or ID')
  .action(async (slug) => {
    const spinner = ora('Deleting…').start()

    try {
      const listRes = await apiRequest(
        `/api/documents?q=${encodeURIComponent(slug)}&page_size=50`,
      )
      const data = (await listRes.json()) as {
        items: Array<{ id: string; slug: string; title: string }>
      }

      const doc = data.items.find((d) => d.slug === slug || d.id === slug)
      if (!doc) {
        spinner.fail(`Document "${slug}" not found`)
        process.exit(1)
      }

      await apiRequest(`/api/documents/${doc.id}`, { method: 'DELETE' })

      spinner.succeed(`Deleted ${chalk.bold(doc.title)}`)
    } catch (err) {
      spinner.fail('Delete failed')
      console.error(chalk.red(`  ${(err as Error).message}`))
      process.exit(1)
    }
  })

export const docsCommand = new Command('docs')
  .description('Manage documents')
  .addCommand(listCommand)
  .addCommand(getCommand)
  .addCommand(createCommand)
  .addCommand(deleteCommand)
