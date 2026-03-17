import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'
import { apiRequest } from '../lib/api-client.js'
import { buildOpenapiUploadBody } from '../lib/openapi-upload.js'

async function collectFiles(path: string): Promise<string[]> {
  const info = await stat(path)
  if (info.isFile()) return [path]

  const entries = await readdir(path, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase()
      if (['.md', '.json', '.yaml', '.yml'].includes(ext)) {
        files.push(join(path, entry.name))
      }
    }
  }
  return files
}

function detectType(filepath: string, explicit?: string): 'openapi' | 'markdown' {
  if (explicit) return explicit as 'openapi' | 'markdown'
  const ext = extname(filepath).toLowerCase()
  if (['.json', '.yaml', '.yml'].includes(ext)) return 'openapi'
  return 'markdown'
}

export const pushCommand = new Command('push')
  .description('Push local files to the workspace')
  .argument('<path>', 'File or directory to push')
  .option('-t, --type <type>', 'File type: openapi or markdown')
  .action(async (path, opts) => {
    const spinner = ora('Reading files…').start()

    try {
      const files = await collectFiles(path)

      if (files.length === 0) {
        spinner.info('No supported files found')
        return
      }

      spinner.text = `Pushing ${files.length} file${files.length !== 1 ? 's' : ''}…`

      let success = 0
      let failed = 0

      for (const filepath of files) {
        const content = await readFile(filepath, 'utf-8')
        const type = detectType(filepath, opts.type)
        const name = basename(filepath, extname(filepath))

        try {
          if (type === 'openapi') {
            await apiRequest('/api/openapi', {
              method: 'POST',
              body: buildOpenapiUploadBody(name, content),
            })
          } else {
            await apiRequest('/api/documents', {
              method: 'POST',
              body: JSON.stringify({ title: name, content }),
            })
          }
          success++
        } catch (err) {
          failed++
          console.error(chalk.red(`  ✗ ${basename(filepath)}: ${(err as Error).message}`))
        }
      }

      if (failed === 0) {
        spinner.succeed(`Pushed ${success} file${success !== 1 ? 's' : ''} successfully`)
      } else {
        spinner.warn(`Pushed ${success} file${success !== 1 ? 's' : ''}, ${failed} failed`)
      }
    } catch (err) {
      spinner.fail('Push failed')
      console.error(chalk.red(`  ${(err as Error).message}`))
      process.exit(1)
    }
  })
