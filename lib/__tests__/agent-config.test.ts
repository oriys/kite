import { describe, expect, it } from 'vitest'

import {
  DOC_AGENT_DEFAULT_MAX_STEPS,
  DOC_AGENT_DEFAULT_TEMPERATURE,
  DOC_AGENT_MAX_MAX_STEPS,
  createDefaultDocAgentRunSettings,
  parseDocAgentMaxSteps,
  parseDocAgentModelId,
  parseDocAgentTemperature,
  sanitizeDocAgentRunSettings,
} from '@/lib/agent/config'

describe('doc agent config helpers', () => {
  it('creates the expected default settings', () => {
    expect(createDefaultDocAgentRunSettings()).toEqual({
      modelId: null,
      maxSteps: DOC_AGENT_DEFAULT_MAX_STEPS,
      temperature: DOC_AGENT_DEFAULT_TEMPERATURE,
    })
  })

  it('sanitizes stale client settings against available models', () => {
    expect(
      sanitizeDocAgentRunSettings(
        {
          modelId: 'provider::retired-model',
          maxSteps: 999,
          temperature: -0.5,
        },
        { availableModelIds: ['provider::current-model'] },
      ),
    ).toEqual({
      modelId: null,
      maxSteps: DOC_AGENT_MAX_MAX_STEPS,
      temperature: 0,
    })
  })

  it('keeps a valid model override while clamping numeric values', () => {
    expect(
      sanitizeDocAgentRunSettings(
        {
          modelId: 'provider::current-model',
          maxSteps: 12.6,
          temperature: 0.26,
        },
        { availableModelIds: ['provider::current-model'] },
      ),
    ).toEqual({
      modelId: 'provider::current-model',
      maxSteps: 13,
      temperature: 0.3,
    })
  })

  it('parses explicit API defaults', () => {
    expect(parseDocAgentModelId(undefined)).toEqual({ value: null })
    expect(parseDocAgentMaxSteps(undefined)).toEqual({
      value: DOC_AGENT_DEFAULT_MAX_STEPS,
    })
    expect(parseDocAgentTemperature(undefined)).toEqual({
      value: DOC_AGENT_DEFAULT_TEMPERATURE,
    })
  })

  it('rejects invalid API payload types and ranges', () => {
    expect(parseDocAgentModelId('x'.repeat(201))).toEqual({
      error: 'Model identifier is too long',
    })
    expect(parseDocAgentMaxSteps(2.5)).toEqual({
      error: 'Max steps must be an integer',
    })
    expect(parseDocAgentTemperature('0.4')).toEqual({
      error: 'Temperature must be a number',
    })
    expect(parseDocAgentTemperature(1.5)).toEqual({
      error: 'Temperature must be between 0 and 1',
    })
  })
})
