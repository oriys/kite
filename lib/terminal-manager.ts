import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { IPty } from 'node-pty'

let ptyModulePromise: Promise<typeof import('node-pty')> | null = null

async function loadPtyModule() {
  ptyModulePromise ??= import('node-pty')
  return ptyModulePromise
}

export interface TerminalSession {
  id: string
  pty: IPty
  tmpDir: string
  listeners: Set<(data: string) => void>
  exitListeners: Set<(code: number | undefined) => void>
  createdAt: Date
}

class TerminalManager {
  private sessions = new Map<string, TerminalSession>()

  async createSession(options?: {
    cols?: number
    rows?: number
  }): Promise<TerminalSession> {
    const pty = await loadPtyModule()
    const id = crypto.randomUUID()
    const tmpDir = mkdtempSync(join(tmpdir(), 'kite-term-'))

    const shell =
      process.env.SHELL ||
      (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash')

    let ptyProcess: IPty
    try {
      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: options?.cols ?? 80,
        rows: options?.rows ?? 24,
        cwd: tmpDir,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        } as Record<string, string>,
      })
    } catch (error) {
      if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true })
      }
      throw error
    }

    const session: TerminalSession = {
      id,
      pty: ptyProcess,
      tmpDir,
      listeners: new Set(),
      exitListeners: new Set(),
      createdAt: new Date(),
    }

    ptyProcess.onData((data) => {
      for (const listener of session.listeners) {
        listener(data)
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      for (const listener of session.exitListeners) {
        listener(exitCode)
      }
      this.cleanup(id)
    })

    this.sessions.set(id, session)
    return session
  }

  getSession(id: string): TerminalSession | undefined {
    return this.sessions.get(id)
  }

  writeInput(id: string, data: string): boolean {
    const session = this.sessions.get(id)
    if (!session) return false
    session.pty.write(data)
    return true
  }

  resize(id: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(id)
    if (!session) return false
    session.pty.resize(cols, rows)
    return true
  }

  destroySession(id: string): boolean {
    const session = this.sessions.get(id)
    if (!session) return false
    try {
      session.pty.kill()
    } catch {
      /* already exited */
    }
    this.cleanup(id)
    return true
  }

  private cleanup(id: string) {
    const session = this.sessions.get(id)
    if (!session) return

    try {
      if (existsSync(session.tmpDir)) {
        rmSync(session.tmpDir, { recursive: true, force: true })
      }
    } catch {
      /* best-effort */
    }

    session.listeners.clear()
    session.exitListeners.clear()
    this.sessions.delete(id)
  }
}

// Persist across hot reloads in development
const g = globalThis as unknown as { _terminalManager?: TerminalManager }
export const terminalManager = (g._terminalManager ??= new TerminalManager())
