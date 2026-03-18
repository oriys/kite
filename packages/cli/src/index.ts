#!/usr/bin/env node
import { Command } from 'commander'
import { loginCommand } from './commands/login.js'
import { pullCommand } from './commands/pull.js'
import { pushCommand } from './commands/push.js'
import { lintCommand } from './commands/lint.js'
import { publishCommand } from './commands/publish.js'
import { exportCommand } from './commands/export.js'
import { searchCommand } from './commands/search.js'
import { docsCommand } from './commands/docs.js'
import { openapiCommand } from './commands/openapi.js'
import { aiCommand } from './commands/ai.js'
import { statusCommand } from './commands/status.js'
import { mcpCommand } from './commands/mcp.js'

const program = new Command()
  .name('kite')
  .description('Kite API Documentation CLI')
  .version('0.1.0')

program.addCommand(loginCommand)
program.addCommand(pullCommand)
program.addCommand(pushCommand)
program.addCommand(lintCommand)
program.addCommand(publishCommand)
program.addCommand(exportCommand)
program.addCommand(searchCommand)
program.addCommand(docsCommand)
program.addCommand(openapiCommand)
program.addCommand(aiCommand)
program.addCommand(statusCommand)
program.addCommand(mcpCommand)

program.parse()
