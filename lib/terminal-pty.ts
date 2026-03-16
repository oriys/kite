import {
  spawn as spawnChildProcess,
  type ChildProcessWithoutNullStreams,
} from 'node:child_process'
import { createRequire } from 'node:module'

export interface IExitEvent {
  exitCode: number | undefined
}

export interface PtyProcess {
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
  onData(listener: (data: string) => void): { dispose(): void }
  onExit(listener: (event: IExitEvent) => void): { dispose(): void }
}

export interface PtyModule {
  spawn(
    file: string,
    args: string[],
    options: {
      name?: string
      cols?: number
      rows?: number
      cwd?: string
      env?: Record<string, string>
    },
  ): PtyProcess
  isFallback?: boolean
}

const require = createRequire(import.meta.url)

let ptyModulePromise: Promise<PtyModule> | null = null

function createFallbackPtyModule(): PtyModule {
  return {
    isFallback: true,
    spawn(file, args, options) {
      const shellArgs =
        process.platform === 'win32' || args.length > 0 ? args : ['-i']
      const child = spawnChildProcess(file, shellArgs, {
        cwd: options.cwd,
        env: options.env as NodeJS.ProcessEnv | undefined,
        stdio: 'pipe',
      }) as ChildProcessWithoutNullStreams

      return {
        write(data: string) {
          child.stdin.write(data)
        },
        resize() {
          // No-op: child_process pipes do not support PTY resize semantics.
        },
        kill() {
          child.kill()
        },
        onData(listener: (data: string) => void) {
          const stdoutHandler = (chunk: Buffer | string) =>
            listener(chunk.toString())
          const stderrHandler = (chunk: Buffer | string) =>
            listener(chunk.toString())

          child.stdout.on('data', stdoutHandler)
          child.stderr.on('data', stderrHandler)

          return {
            dispose() {
              child.stdout.off('data', stdoutHandler)
              child.stderr.off('data', stderrHandler)
            },
          }
        },
        onExit(listener: (event: IExitEvent) => void) {
          const exitHandler = (code: number | null) => {
            listener({ exitCode: code ?? undefined })
          }

          child.on('exit', exitHandler)

          return {
            dispose() {
              child.off('exit', exitHandler)
            },
          }
        },
      }
    },
  }
}

export async function loadTerminalPtyModule() {
  ptyModulePromise ??= (async () => {
    try {
      const moduleName = 'node-pty'
      return require(moduleName) as PtyModule
    } catch {
      return createFallbackPtyModule()
    }
  })()

  return ptyModulePromise
}
