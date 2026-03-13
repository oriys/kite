// ─── Line-level text diff algorithm ─────────────────────────────
// Myers-style LCS diff producing aligned left/right line segments.

export type DiffLineType = 'equal' | 'add' | 'remove'

export interface DiffLine {
  type: DiffLineType
  /** Original line content (undefined for 'add' lines on the left, 'remove' lines on the right) */
  text: string
  /** 1-based line number in the source it came from (left or right) */
  lineNumber: number
}

export interface DiffBlock {
  type: 'equal' | 'change'
  leftLines: DiffLine[]
  rightLines: DiffLine[]
}

export interface DiffResult {
  blocks: DiffBlock[]
  stats: {
    additions: number
    removals: number
    unchanged: number
  }
}

/**
 * Compute a line-level diff between two texts.
 * Returns aligned blocks that can be rendered side-by-side.
 */
export function diffTexts(left: string, right: string): DiffResult {
  const leftLines = splitLines(left)
  const rightLines = splitLines(right)
  const ops = computeLCS(leftLines, rightLines)
  return buildBlocks(ops, leftLines, rightLines)
}

// ── Internal ────────────────────────────────────────────────────

type EditOp = { type: 'equal'; li: number; ri: number }
  | { type: 'remove'; li: number }
  | { type: 'add'; ri: number }

function splitLines(text: string): string[] {
  if (!text) return []
  return text.split('\n')
}

/**
 * Myers diff algorithm (O((N+M)D)) producing an edit script.
 * For documents of reasonable size this is fast and produces minimal diffs.
 */
function computeLCS(a: string[], b: string[]): EditOp[] {
  const n = a.length
  const m = b.length
  const max = n + m
  // V stores the furthest-reaching d-path endpoints
  // Index by k+max to avoid negative indices
  const size = 2 * max + 1
  const v = new Int32Array(size).fill(-1)
  v[max + 1] = 0

  const trace: Int32Array[] = []

  outer:
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice())
    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
        x = v[k + 1 + max]
      } else {
        x = v[k - 1 + max] + 1
      }
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[k + max] = x
      if (x >= n && y >= m) break outer
    }
  }

  // Backtrack to recover the edit script
  const ops: EditOp[] = []
  let x = n
  let y = m

  for (let d = trace.length - 1; d >= 0; d--) {
    const tv = trace[d]
    const k = x - y

    let prevK: number
    if (k === -d || (k !== d && tv[k - 1 + max] < tv[k + 1 + max])) {
      prevK = k + 1
    } else {
      prevK = k - 1
    }

    const prevX = tv[prevK + max]
    const prevY = prevX - prevK

    // Diagonal moves (equal lines)
    while (x > prevX && y > prevY) {
      x--
      y--
      ops.push({ type: 'equal', li: x, ri: y })
    }

    if (d > 0) {
      if (x === prevX) {
        // Vertical move = insertion
        y--
        ops.push({ type: 'add', ri: y })
      } else {
        // Horizontal move = deletion
        x--
        ops.push({ type: 'remove', li: x })
      }
    }
  }

  ops.reverse()
  return ops
}

function buildBlocks(ops: EditOp[], leftLines: string[], rightLines: string[]): DiffResult {
  const blocks: DiffBlock[] = []
  let additions = 0
  let removals = 0
  let unchanged = 0

  let pendingLeft: DiffLine[] = []
  let pendingRight: DiffLine[] = []

  function flushChange() {
    if (pendingLeft.length || pendingRight.length) {
      blocks.push({ type: 'change', leftLines: pendingLeft, rightLines: pendingRight })
      pendingLeft = []
      pendingRight = []
    }
  }

  for (const op of ops) {
    switch (op.type) {
      case 'equal': {
        flushChange()
        const line: DiffLine = { type: 'equal', text: leftLines[op.li], lineNumber: op.li + 1 }
        blocks.push({
          type: 'equal',
          leftLines: [{ ...line }],
          rightLines: [{ type: 'equal', text: rightLines[op.ri], lineNumber: op.ri + 1 }],
        })
        unchanged++
        break
      }
      case 'remove': {
        pendingLeft.push({ type: 'remove', text: leftLines[op.li], lineNumber: op.li + 1 })
        removals++
        break
      }
      case 'add': {
        pendingRight.push({ type: 'add', text: rightLines[op.ri], lineNumber: op.ri + 1 })
        additions++
        break
      }
    }
  }

  flushChange()

  // Merge consecutive equal blocks for compactness
  return { blocks: mergeEqualBlocks(blocks), stats: { additions, removals, unchanged } }
}

function mergeEqualBlocks(blocks: DiffBlock[]): DiffBlock[] {
  const merged: DiffBlock[] = []
  for (const block of blocks) {
    const prev = merged[merged.length - 1]
    if (prev && prev.type === 'equal' && block.type === 'equal') {
      prev.leftLines.push(...block.leftLines)
      prev.rightLines.push(...block.rightLines)
    } else {
      merged.push(block)
    }
  }
  return merged
}
