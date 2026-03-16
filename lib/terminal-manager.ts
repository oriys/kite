import { mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  hasTerminalSessionAccess,
  type TerminalSessionAccess,
} from '@/lib/terminal-session-access'
import {
  loadTerminalPtyModule,
  type IExitEvent,
  type PtyProcess,
} from '@/lib/terminal-pty'

export type TerminalSessionStatus = 'bootstrapping' | 'ready' | 'error' | 'closed'

export interface TerminalSession {
  id: string
  pty: PtyProcess
  tmpDir: string
  copilotHomeDir: string
  skillsDir: string
  skillsLockPath: string
  ptyBackend: 'node-pty' | 'fallback'
  userId: string
  workspaceId: string
  status: TerminalSessionStatus
  bootstrapStartedAt: Date | null
  bootstrapCompletedAt: Date | null
  bootstrapError: string | null
  bootstrapPromise: Promise<void> | null
  outputBuffer: string[]
  listeners: Set<(data: string) => void>
  statusListeners: Set<(status: TerminalSessionStatus) => void>
  exitListeners: Set<(code: number | undefined) => void>
  createdAt: Date
}

const MAX_TERMINAL_OUTPUT_CHUNKS = 500

class TerminalManager {
  private sessions = new Map<string, TerminalSession>()

  async createSession(options: {
    cols?: number
    rows?: number
    userId: string
    workspaceId: string
  }): Promise<TerminalSession> {
    const pty = await loadTerminalPtyModule()
    const id = crypto.randomUUID()
    const tmpDir = mkdtempSync(join(tmpdir(), 'kite-term-'))
    const copilotHomeDir = join(tmpDir, '.copilot')
    const skillsDir = join(copilotHomeDir, 'skills')
    const skillsLockPath = join(copilotHomeDir, 'skills-lock.json')

    mkdirSync(skillsDir, { recursive: true })

    const shell =
      process.env.SHELL ||
      (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash')

    let ptyProcess: PtyProcess
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
          COPILOT_HOME: copilotHomeDir,
          KITE_CLI_SKILLS_DIR: skillsDir,
          KITE_CLI_SKILLS_LOCK: skillsLockPath,
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
      copilotHomeDir,
      skillsDir,
      skillsLockPath,
      ptyBackend: pty.isFallback ? 'fallback' : 'node-pty',
      userId: options.userId,
      workspaceId: options.workspaceId,
      status: 'bootstrapping',
      bootstrapStartedAt: null,
      bootstrapCompletedAt: null,
      bootstrapError: null,
      bootstrapPromise: null,
      outputBuffer: [],
      listeners: new Set(),
      statusListeners: new Set(),
      exitListeners: new Set(),
      createdAt: new Date(),
    }

    ptyProcess.onData((data: string) => {
      this.recordOutput(session, data)
    })

    ptyProcess.onExit(({ exitCode }: IExitEvent) => {
      session.status = 'closed'
      this.notifyStatusListeners(session)
      for (const listener of session.exitListeners) {
        listener(exitCode)
      }
      this.cleanup(id)
    })

    this.sessions.set(id, session)

    if (session.ptyBackend === 'fallback') {
      this.recordOutput(
        session,
        '[Kite] node-pty is unavailable; using the built-in terminal fallback.\r\n',
      )
    }

    return session
  }

  getSession(id: string, access?: TerminalSessionAccess): TerminalSession | undefined {
    return this.resolveSession(id, access)
  }

  ensureSessionBootstrap(
    id: string,
    access: TerminalSessionAccess,
    bootstrapper: (session: TerminalSession) => Promise<void>,
  ) {
    const session = this.resolveSession(id, access)
    if (!session) {
      return Promise.reject(new Error('Terminal session not found'))
    }
    if (session.bootstrapPromise) {
      return session.bootstrapPromise
    }

    session.bootstrapPromise = Promise.resolve()
      .then(() => bootstrapper(session))
      .finally(() => {
        const activeSession = this.sessions.get(id)
        if (activeSession) {
          activeSession.bootstrapPromise = null
        }
      })

    return session.bootstrapPromise
  }

  updateSessionStatus(
    id: string,
    status: TerminalSessionStatus,
    access?: TerminalSessionAccess,
    bootstrapError?: string | null,
  ): boolean {
    const session = this.resolveSession(id, access)
    if (!session) return false

    session.status = status
    if (status === 'bootstrapping' && !session.bootstrapStartedAt) {
      session.bootstrapStartedAt = new Date()
    }
    if (status === 'ready') {
      session.bootstrapCompletedAt = new Date()
      session.bootstrapError = null
    } else if (status === 'error') {
      session.bootstrapCompletedAt = new Date()
        session.bootstrapError = bootstrapError ?? 'Unknown bootstrap error'
    }
    this.notifyStatusListeners(session)
    return true
  }

  appendOutput(id: string, data: string, access?: TerminalSessionAccess): boolean {
    const session = this.resolveSession(id, access)
    if (!session) return false
    this.recordOutput(session, data)
    return true
  }

  writeInput(id: string, data: string, access?: TerminalSessionAccess): boolean {
    const session = this.resolveSession(id, access)
    if (!session) return false
    session.pty.write(data)
    return true
  }

  resize(id: string, cols: number, rows: number, access?: TerminalSessionAccess): boolean {
    const session = this.resolveSession(id, access)
    if (!session) return false
    session.pty.resize(cols, rows)
    return true
  }

  destroySession(id: string, access?: TerminalSessionAccess): boolean {
    const session = this.resolveSession(id, access)
    if (!session) return false
    try {
      session.status = 'closed'
      this.notifyStatusListeners(session)
      session.pty.kill()
    } catch {
      /* already exited */
    }
    this.cleanup(id)
    return true
  }

  private resolveSession(
    id: string,
    access?: TerminalSessionAccess,
  ): TerminalSession | undefined {
    const session = this.sessions.get(id)
    if (!session) return undefined
    if (access && !hasTerminalSessionAccess(session, access)) {
      return undefined
    }
    return session
  }

  private recordOutput(session: TerminalSession, data: string) {
    session.outputBuffer.push(data)
    if (session.outputBuffer.length > MAX_TERMINAL_OUTPUT_CHUNKS) {
      session.outputBuffer.splice(
        0,
        session.outputBuffer.length - MAX_TERMINAL_OUTPUT_CHUNKS,
      )
    }

    for (const listener of session.listeners) {
      listener(data)
    }
  }

  private notifyStatusListeners(session: TerminalSession) {
    for (const listener of session.statusListeners) {
      listener(session.status)
    }
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
    session.statusListeners.clear()
    session.exitListeners.clear()
    this.sessions.delete(id)
  }
}

// Persist across hot reloads in development
const g = globalThis as unknown as { _terminalManager?: TerminalManager }
export const terminalManager = (g._terminalManager ??= new TerminalManager())
