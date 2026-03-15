#!/usr/bin/env node
import { Command } from 'commander'
import { loginCommand } from './commands/login.js'
import { pullCommand } from './commands/pull.js'
import { pushCommand } from './commands/push.js'
import { lintCommand } from './commands/lint.js'
import { publishCommand } from './commands/publish.js'
import { exportCommand } from './commands/export.js'

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

program.parse()
