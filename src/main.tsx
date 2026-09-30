import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource-variable/geist'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/unbounded'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/index.css'

// Lenis owns scrolling; stop the browser restoring stale positions on reload.
history.scrollRestoration = 'manual'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      fallback={
        <div className="grid min-h-svh place-items-center p-8 text-center font-mono text-sm text-fg-muted">
          <p>
            something broke.{' '}
            <a className="text-fg underline" href="/">
              reload
            </a>
          </p>
        </div>
      }
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
