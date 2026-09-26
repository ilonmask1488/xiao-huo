import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CourseScreen } from '../features/course/CourseScreen'
import { UnitScreen } from '../features/course/UnitScreen'
import { DictionaryScreen } from '../features/dictionary/DictionaryScreen'
import { AboutScreen, MoreScreen } from '../features/more/MoreScreen'
import { EchoScreen, StoryScreen } from '../features/more/PlaceholderScreens'
import { StatsScreen } from '../features/stats/StatsScreen'
import { GameRoute } from '../features/games/GameScreen'
import { LessonScreen } from '../features/lesson/LessonScreen'
import { SoundCheckScreen } from '../features/lesson/SoundCheck'
import { HomeScreen } from '../features/session/HomeScreen'
import { LaunchBlockScreen } from '../features/session/LaunchBlockScreen'
import { LaunchScreen } from '../features/session/LaunchScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TonesScreen } from '../features/tones/TonesScreen'
import { configureAudio } from '../lib/audio/audio'
import { configureFeedback } from '../lib/audio/sfx'
import { applyAppearance, useSettings } from '../lib/settings/settings'
import { Shell } from './Shell'

/*
  HashRouter: адреса вида …/#/tones работают на GitHub Pages без серверных перенаправлений
  и в офлайне — сервер всегда отдаёт один index.html.
*/
export function App() {
  const settings = useSettings()
  useEffect(() => {
    configureAudio(settings)
    configureFeedback(settings)
  }, [settings])
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
          <Route path="session" element={<LaunchScreen />} />
          <Route path="lesson/:id" element={<LessonScreen />} />
          <Route path="launch/:seg" element={<LaunchBlockScreen />} />
          <Route path="unit/:id" element={<UnitScreen />} />
          <Route path="sound-check" element={<SoundCheckScreen />} />
          <Route path="game/:id" element={<GameRoute />} />
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
