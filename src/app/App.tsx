import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CourseScreen } from '../features/course/CourseScreen'
import { DictionaryScreen } from '../features/dictionary/DictionaryScreen'
import { AboutScreen, MoreScreen } from '../features/more/MoreScreen'
import { EchoScreen, StatsScreen, StoryScreen } from '../features/more/PlaceholderScreens'
import { HomeScreen } from '../features/session/HomeScreen'
import { SessionScreen } from '../features/session/SessionScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TonesScreen } from '../features/tones/TonesScreen'
import { applyAppearance, useSettings } from '../lib/settings/settings'
import { Shell } from './Shell'

/*
  HashRouter: адреса вида …/#/tones работают на GitHub Pages без серверных перенаправлений
  и в офлайне — сервер всегда отдаёт один index.html.
*/
export function App() {
  const settings = useSettings()
  useEffect(() => {
    applyAppearance(settings)
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyAppearance(settings)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings])

  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomeScreen />} />
          <Route path="session" element={<SessionScreen />} />
          <Route path="map" element={<CourseScreen />} />
          <Route path="tones" element={<TonesScreen />} />
          <Route path="dictionary" element={<DictionaryScreen />} />
          <Route path="more" element={<MoreScreen />} />
          <Route path="stats" element={<StatsScreen />} />
          <Route path="echo" element={<EchoScreen />} />
          <Route path="story" element={<StoryScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="about" element={<AboutScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
