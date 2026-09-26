import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { initApp } from './app/init'
import { installAudioUnlock } from './lib/audio/player'
import './styles/base.css'

void initApp()
installAudioUnlock()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
