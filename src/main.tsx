import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource/jersey-10'
import '@fontsource-variable/pixelify-sans'
import '@fontsource/vt323'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      fallback={
        <div className="grid min-h-svh place-items-center p-8 text-center font-mono text-lg text-fg-muted">
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
