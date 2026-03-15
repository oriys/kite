import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { apiRequest } from '../lib/api-client.js'

export const pullCommand = new Command('pull')
  .description('Pull published documents as local files')
  .option('-o, --output <dir>', 'Output directory', './docs')
  .action(async (opts) => {
    const spinner = ora('Fetching documents…').start()

    try {
      const res = await apiRequest('/api/documents?status=published&page_size=100')
      const data = await res.json() as { items: Array<{ id: string; title: string; slug: string; content: string | null }> }
      const docs = data.items

      if (docs.length === 0) {
        spinner.info('No published documents found')
        return
      }

      await mkdir(opts.output, { recursive: true })

      let written = 0
      for (const doc of docs) {
        const filename = `${doc.slug || doc.id}.md`
        const filepath = join(opts.output, filename)
        const frontmatter = `---\ntitle: "${doc.title}"\nid: ${doc.id}\n---\n\n`
        const content = frontmatter + (doc.content || '')

        await writeFile(filepath, content, 'utf-8')
        written++
      }

      spinner.succeed(`Pulled ${written} document${written !== 1 ? 's' : ''} to ${chalk.bold(opts.output)}`)
    } catch (err) {
      spinner.fail('Failed to pull documents')
      console.error(chalk.red(`  ${(err as Error).message}`))
      process.exit(1)
    }
  })
