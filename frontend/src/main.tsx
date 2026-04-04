import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './stores/themeStore'
import './stores/adminThemeStore'
import { bootstrapDocumentTheme } from './themeBootstrap'
import App from './App.tsx'

bootstrapDocumentTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
