interface RiskAssessment {
  level: 'low' | 'medium' | 'high'
  score: number
  factors: string[]
}

export function classifyChangeRisk(
  originalContent: string,
  newContent: string,
  options: {
    hasDownstreamDependents?: number
    isApiDoc?: boolean
    translationCount?: number
  } = {},
): RiskAssessment {
  const factors: string[] = []
  let score = 0

  // Content change volume
  const originalLength = originalContent.length
  const newLength = newContent.length
  const changePct = originalLength > 0
    ? Math.abs(newLength - originalLength) / originalLength
    : 1

  if (changePct > 0.5) {
    score += 30
    factors.push(`Major content change (${Math.round(changePct * 100)}% size difference)`)
  } else if (changePct > 0.2) {
    score += 15
    factors.push(`Moderate content change (${Math.round(changePct * 100)}% size difference)`)
  } else if (changePct > 0) {
    score += 5
    factors.push(`Minor content change (${Math.round(changePct * 100)}% size difference)`)
  }

  // Downstream dependents
  if (options.hasDownstreamDependents && options.hasDownstreamDependents > 0) {
    const depScore = Math.min(options.hasDownstreamDependents * 10, 30)
    score += depScore
    factors.push(`${options.hasDownstreamDependents} downstream dependent(s)`)
  }

  // API documentation is higher risk
  if (options.isApiDoc) {
    score += 20
    factors.push('API documentation change')
  }

  // Incomplete translations increase risk
  if (options.translationCount && options.translationCount > 0) {
    score += 10
    factors.push(`${options.translationCount} translation(s) may need updating`)
  }

  let level: 'low' | 'medium' | 'high'
  if (score >= 50) {
    level = 'high'
  } else if (score >= 25) {
    level = 'medium'
  } else {
    level = 'low'
  }

  return { level, score, factors }
}
