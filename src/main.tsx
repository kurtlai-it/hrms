import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import './i18n'
import App from './App.tsx'
import { initTextSize } from './lib/textSize'

initTextSize()

// The saved light / dark choice applies before any page draws, so Login and
// the public onboarding form follow it too (AppLayout keeps it in sync later).
try {
  document.documentElement.classList.toggle('dark', localStorage.getItem('myhrms:theme') === 'dark')
} catch {
  /* storage blocked: light */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
