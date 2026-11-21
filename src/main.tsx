import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SG_ASSETS } from './lib/sgAssets'
import './index.css'
import App from './App.tsx'

const iconLink = document.querySelector<HTMLLinkElement>("link[rel='icon']")
if (iconLink) {
  iconLink.href = SG_ASSETS.favicon
  iconLink.type = 'image/svg+xml'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
