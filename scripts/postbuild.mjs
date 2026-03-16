import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const scriptsDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = dirname(scriptsDir)
const standaloneRoot = join(repoRoot, '.next', 'standalone')

function copyDirectory(source, destination) {
  if (!existsSync(source)) return
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination, { recursive: true })
}

copyDirectory(
  join(repoRoot, '.next', 'static'),
  join(standaloneRoot, '.next', 'static'),
)
copyDirectory(join(repoRoot, 'public'), join(standaloneRoot, 'public'))

let nodePtyRoot = null
try {
  nodePtyRoot = dirname(require.resolve('node-pty/package.json'))
} catch {
  nodePtyRoot = null
}

if (nodePtyRoot) {
  const nodePtyStandaloneRoot = join(
    standaloneRoot,
    relative(repoRoot, nodePtyRoot),
  )

  copyDirectory(join(nodePtyRoot, 'build'), join(nodePtyStandaloneRoot, 'build'))
  copyDirectory(
    join(nodePtyRoot, 'prebuilds'),
    join(nodePtyStandaloneRoot, 'prebuilds'),
  )
}
