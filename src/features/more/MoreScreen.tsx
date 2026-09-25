import { Link } from 'react-router-dom'
import { IconChevron } from '../../components/Icons'
import { Mascot } from '../../components/Mascot'
import { Screen } from '../../components/ui'
import { ru } from '../../i18n/ru'
import s from './MoreScreen.module.css'

const ITEMS = ['stats', 'echo', 'story', 'settings', 'about'] as const

export function MoreScreen() {
  return (
    <Screen title={ru.more.title}>
      <ul className={s.list}>
        {ITEMS.map((key) => (
          <li key={key}>
            <Link to={`/${key}`} className={s.item}>
              <span>
                <span className={s.itemTitle}>{ru.more.items[key].title}</span>
                <span className={s.itemWhat}>{ru.more.items[key].what}</span>
              </span>
              <IconChevron />
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  )
}

const LICENSES: [string, string][] = [
  ['React, React Router', 'MIT'],
  ['Dexie', 'Apache-2.0'],
  ['Workbox, vite-plugin-pwa', 'MIT'],
  ['IBM Plex Sans, IBM Plex Mono', 'SIL Open Font License 1.1'],
]

export function AboutScreen() {
  const t = ru.about
  return (
    <Screen title={t.title} back>
      <div className={s.about}>
        <Mascot mood="wink" size={72} />
        <p className="mono">{t.version(__APP_VERSION__, __BUILD_DATE__)}</p>
        <p>{t.privacy}</p>
        <h2>{t.licenses}</h2>
        <dl className={s.licenses}>
          {LICENSES.map(([what, lic]) => (
            <div key={what}>
              <dt>{what}</dt>
              <dd className="mono">{lic}</dd>
            </div>
          ))}
        </dl>
        <p className={s.note}>{t.audioSoon}</p>
      </div>
    </Screen>
  )
}
