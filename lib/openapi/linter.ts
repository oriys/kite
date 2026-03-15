import { Spectral, type ISpectralDiagnostic, type RulesetDefinition } from '@stoplight/spectral-core'
import { oas } from '@stoplight/spectral-rulesets'

export interface LintIssue {
  code: string | number
  message: string
  severity: 'error' | 'warning' | 'info' | 'hint'
  path: string[]
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
}

export interface LintSummary {
  issues: LintIssue[]
  errorCount: number
  warningCount: number
  infoCount: number
  hintCount: number
}

const severityMap: Record<number, LintIssue['severity']> = {
  0: 'error',
  1: 'warning',
  2: 'info',
  3: 'hint',
}

export async function lintOpenApiSpec(
  rawContent: string,
  customRules?: Record<string, unknown>,
): Promise<LintSummary> {
  const spectral = new Spectral()

  spectral.setRuleset({ extends: [[oas as RulesetDefinition, 'all']] })

  if (customRules) {
    for (const [ruleName, config] of Object.entries(customRules)) {
      if (spectral.ruleset?.rules?.[ruleName]) {
        if (config === 'off' || config === false) {
          spectral.ruleset.rules[ruleName].enabled = false
        } else if (config === 'warn') {
          spectral.ruleset.rules[ruleName].severity = 1
        } else if (config === 'error') {
          spectral.ruleset.rules[ruleName].severity = 0
        } else if (config === 'info') {
          spectral.ruleset.rules[ruleName].severity = 2
        } else if (config === 'hint') {
          spectral.ruleset.rules[ruleName].severity = 3
        }
      }
    }
  }

  const results: ISpectralDiagnostic[] = await spectral.run(rawContent)

  const issues: LintIssue[] = results.map((r) => ({
    code: r.code,
    message: r.message,
    severity: severityMap[r.severity] ?? 'info',
    path: r.path.map(String),
    range: r.range,
  }))

  return {
    issues,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    infoCount: issues.filter((i) => i.severity === 'info').length,
    hintCount: issues.filter((i) => i.severity === 'hint').length,
  }
}
