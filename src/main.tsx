import { reportReactError } from './lib/errorTracking'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ClubOnboarding } from './components/ClubOnboarding'
import './Mobile.css'
import './PlayfulTheme.css'
import './NativeApp.css'
import { initializeMobile } from './lib/mobile'

void initializeMobile().catch(() => console.error('Native lifecycle initialization failed'));

createRoot(document.getElementById('root')!, {
  onUncaughtError: reportReactError,
  onCaughtError: reportReactError,
  onRecoverableError: reportReactError,
}).render(
  <StrictMode>
    {['/register-club', '/platform-admin', '/owner-setup'].includes(window.location.pathname) ? <ClubOnboarding /> : <App />}
  </StrictMode>,
)
