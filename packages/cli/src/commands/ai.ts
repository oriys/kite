import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { apiRequest } from '../lib/api-client.js'

export const aiCommand = new Command('ai')
  .description('AI-powered features')

aiCommand
  .command('ask')
  .description('Ask a question about your documentation')
  .argument('<question>', 'Your question')
  .option('--doc <slug>', 'Scope to a specific document')
  .action(async (question, opts) => {
    const spinner = ora('Thinking…').start()

    try {
      const body: Record<string, unknown> = { message: question }

      if (opts.doc) {
        // Resolve slug to document ID
        const listRes = await apiRequest(
          `/api/documents?q=${encodeURIComponent(opts.doc)}&page_size=50`,
        )
        const data = (await listRes.json()) as {
          items: Array<{ id: string; slug: string }>
        }
        const doc = data.items.find(
          (d) => d.slug === opts.doc || d.id === opts.doc,
        )
        if (doc) body.documentId = doc.id
      }

      const res = await apiRequest('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      spinner.stop()

      // Handle streaming response (text/event-stream or JSON)
      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
        const reader = res.body?.getReader()
        if (!reader) {
          console.log(chalk.dim('  No response'))
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            // Parse SSE data lines
            if (line.startsWith('0:')) {
              // AI SDK data protocol: text delta
              try {
                const text = JSON.parse(line.slice(2))
                if (typeof text === 'string') process.stdout.write(text)
              } catch {
                // Not JSON, write raw
                process.stdout.write(line.slice(2))
              }
            } else if (line.startsWith('d:') || line.startsWith('e:')) {
              // Done or error signal — skip
            }
          }
        }

        console.log()
      } else {
        // JSON response
        const data = (await res.json()) as { content?: string; message?: string }
        console.log(data.content || data.message || JSON.stringify(data, null, 2))
      }
    } catch (err) {
      spinner.fail('AI request failed')
      console.error(chalk.red(`  ${(err as Error).message}`))
      process.exit(1)
    }
  })
