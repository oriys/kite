'use client'

import { useGlobalErrorReporter } from '@/hooks/use-global-error-reporter'

export function ErrorReporter() {
  useGlobalErrorReporter()
  return null
}
