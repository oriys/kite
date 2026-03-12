'use client'

import * as React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class EditorErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-border/75 bg-card/95 px-6 py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Editor failed to load</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              {this.state.error?.message ?? 'An unexpected error occurred in the editor.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            <RotateCcw data-icon="inline-start" />
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
