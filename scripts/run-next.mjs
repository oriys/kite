import { spawn } from 'node:child_process'

const mode = process.argv[2]
const port = process.env.APP_PORT ?? process.env.PORT ?? '8000'
const host =
  process.env.APP_HOST ?? process.env.HOST ?? process.env.HOSTNAME ?? '0.0.0.0'

function getCommandArgs(currentMode) {
  if (currentMode === 'dev') {
    return [
      './node_modules/next/dist/bin/next',
      'dev',
      '--hostname',
      host,
      '--port',
      port,
    ]
  }

  if (currentMode === 'start') {
    return ['./.next/standalone/server.js']
  }

  throw new Error(`Unsupported Next.js run mode: ${currentMode}`)
}

const args = getCommandArgs(mode)
const env = {
  ...process.env,
  PORT: port,
  HOSTNAME: host,
}

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env,
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
