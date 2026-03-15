import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { writeFile } from 'node:fs/promises'
import { apiRequest } from '../lib/api-client.js'

export const exportCommand = new Command('export')
  .description('Export a document in various formats')
  .requiredOption('--doc <slug>', 'Document slug or ID')
  .option('-f, --format <format>', 'Export format: md, html, pdf, docx', 'md')
  .option('-o, --output <file>', 'Output file path')
  .action(async (opts) => {
    const spinner = ora('Exporting…').start()

    try {
      // Resolve slug to document ID
      const listRes = await apiRequest(`/api/documents?q=${encodeURIComponent(opts.doc)}&page_size=50`)
      const data = await listRes.json() as {
        items: Array<{ id: string; slug: string; title: string }>
      }

      const doc = data.items.find(
        (d) => d.slug === opts.doc || d.id === opts.doc,
      )

      if (!doc) {
        spinner.fail(`Document "${opts.doc}" not found`)
        process.exit(1)
      }

      const formatMap: Record<string, string> = {
        md: 'markdown',
        markdown: 'markdown',
        html: 'html',
        pdf: 'pdf',
        docx: 'docx',
      }
      const format = formatMap[opts.format] || opts.format

      const res = await apiRequest(
        `/api/export?documentId=${doc.id}&format=${format}`,
      )

      const extMap: Record<string, string> = {
        markdown: 'md',
        html: 'html',
        pdf: 'pdf',
        docx: 'docx',
      }
      const ext = extMap[format] || format
      const outputPath = opts.output || `${doc.slug || doc.id}.${ext}`

      if (format === 'pdf' || format === 'docx') {
        const buffer = Buffer.from(await res.arrayBuffer())
        await writeFile(outputPath, buffer)
      } else {
        const text = await res.text()
        await writeFile(outputPath, text, 'utf-8')
      }

      spinner.succeed(`Exported to ${chalk.bold(outputPath)}`)
    } catch (err) {
      spinner.fail('Export failed')
      console.error(chalk.red(`  ${(err as Error).message}`))
      process.exit(1)
    }
  })
