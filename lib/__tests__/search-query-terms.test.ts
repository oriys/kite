import { describe, expect, it } from 'vitest'

import {
  containsCjk,
  createQueryMatchPlan,
  extractQueryTerms,
} from '@/lib/search/query-terms'

describe('search query term extraction', () => {
  it('adds english identifier variants', () => {
    const terms = extractQueryTerms('AccessScope webhook_retry')

    expect(terms).toEqual(expect.arrayContaining([
      'AccessScope webhook_retry',
      'AccessScope webhook retry',
      'AccessScopewebhookretry',
      'AccessScope',
      'Access Scope',
      'webhook_retry',
      'webhook retry',
      'webhookretry',
    ]))
  })

  it('expands cjk queries with lightweight segmentation terms', () => {
    const terms = extractQueryTerms('如何配置退款审批流程')

    expect(terms).toEqual(expect.arrayContaining([
      '如何配置退款审批流程',
      '退款审批流程',
      '退款',
      '审批',
      '流程',
    ]))
    expect(terms.length).toBeLessThanOrEqual(24)
  })

  it('separates stronger phrase-like terms from weaker fragments', () => {
    const plan = createQueryMatchPlan('如何配置退款审批流程')

    expect(plan.primaryTerms).toEqual(expect.arrayContaining([
      '如何配置退款审批流程',
      '退款审批流程',
      '退款审批',
      '审批流程',
    ]))
    expect(plan.secondaryTerms).toEqual(expect.arrayContaining([
      '退款',
      '审批',
      '流程',
    ]))
  })

  it('detects cjk text', () => {
    expect(containsCjk('退款流程')).toBe(true)
    expect(containsCjk('AccessScope')).toBe(false)
  })
})
