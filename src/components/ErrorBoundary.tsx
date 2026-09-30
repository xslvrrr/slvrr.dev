import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Renders `fallback` if anything below throws (e.g. no WebGL support, or a live
 * widget receiving data it didn't expect), so one broken piece can't blank the page.
 */
export class ErrorBoundary extends Component<
  { fallback?: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[slvrr] a section crashed and was hidden:', error, info.componentStack)
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
