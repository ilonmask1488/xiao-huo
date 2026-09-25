import { Component, useEffect, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { IconDictionary, IconLaunch, IconMap, IconMore, IconTones } from '../components/Icons'
import { Banner } from '../components/ui'
import ui from '../components/ui.module.css'
import { ru } from '../i18n/ru'
import s from './Shell.module.css'

const TABS = [
  { to: '/', label: ru.nav.launch, icon: <IconLaunch /> },
  { to: '/map', label: ru.nav.map, icon: <IconMap /> },
  { to: '/tones', label: ru.nav.tones, icon: <IconTones /> },
  { to: '/dictionary', label: ru.nav.dictionary, icon: <IconDictionary /> },
  { to: '/more', label: ru.nav.more, icon: <IconMore /> },
]

/** Экраны, где нижняя навигация мешает (занятие во весь экран). */
const FULLSCREEN = ['/session']

export function Shell() {
  const { pathname } = useLocation()
  const fullscreen = FULLSCREEN.includes(pathname)
  return (
    <div className={s.app}>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      <UpdateToasts />
      {!fullscreen && (
        <nav className={s.nav} aria-label="Разделы">
          <ul className={s.navList}>
            {TABS.map((t) => (
              <li key={t.to}>
                <NavLink to={t.to} end={t.to === '/'} className={s.navLink}>
                  {t.icon}
                  <span>{t.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}

function UpdateToasts() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (e) => console.error('SW registration', e),
  })
  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 4000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])
  if (!needRefresh && !offlineReady) return null
  return (
    <div className={s.toasts}>
      {needRefresh && (
        <Banner
          action={ru.banners.updateAction}
          onAction={() => void updateServiceWorker(true)}
          onClose={() => setNeedRefresh(false)}
        >
          {ru.banners.update}
        </Banner>
      )}
      {offlineReady && !needRefresh && (
        <Banner onClose={() => setOfflineReady(false)}>{ru.banners.offlineReady}</Banner>
      )}
    </div>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error(error)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className={s.fatal} role="alert">
        <p>{ru.errors.boundary}</p>
        <button type="button" className={ui.secondary} onClick={() => location.reload()}>
          {ru.errors.reload}
        </button>
      </div>
    )
  }
}
