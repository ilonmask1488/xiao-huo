import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { initApp } from './app/init'
import { loadManifest } from './lib/audio/manifest'
import { installAudioUnlock } from './lib/audio/player'
import './styles/base.css'

void initApp()
installAudioUnlock()

// Манифест звука нужен экранам синхронно — рендерим, когда он загружен (из кэша это мгновенно).
void loadManifest().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
