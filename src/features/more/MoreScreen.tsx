import { Link } from 'react-router-dom'
import { IconChevron } from '../../components/Icons'
import { Mascot } from '../../components/Mascot'
import { Screen } from '../../components/ui'
import { ru } from '../../i18n/ru'
import { manifest } from '../../lib/audio/manifest'
import s from './MoreScreen.module.css'

const ITEMS = ['stats', 'soundCheck', 'echo', 'story', 'settings', 'about'] as const
const PATHS: Record<(typeof ITEMS)[number], string> = {
  stats: '/stats',
  soundCheck: '/sound-check',
  echo: '/echo',
  story: '/story',
  settings: '/settings',
  about: '/about',
}

export function MoreScreen() {
  return (
    <Screen title={ru.more.title}>
      <ul className={s.list}>
        {ITEMS.map((key) => (
          <li key={key}>
            <Link to={PATHS[key]} className={s.item}>
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
  ['pinyin-pro (проверка контента при сборке)', 'MIT'],
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
        <h2>{t.audio}</h2>
        <dl className={s.licenses}>
          {Object.values(manifest.sources).map((src) => (
            <div key={src.name}>
              <dt>
                {src.name}
                <span className={s.itemWhat}>{src.credit}</span>
              </dt>
              <dd className="mono">{src.license}</dd>
            </div>
          ))}
        </dl>
        <p className={s.note}>
          {t.audioNote} <a href="https://github.com/hugolpz/audio-cmn">github.com/hugolpz/audio-cmn</a>
        </p>
      </div>
    </Screen>
  )
}
