/* «Профиль» (UX §2.1): сводка прогресса простыми словами и разделы — статистика, настройки, звук, о приложении. */
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { IconChevron } from '../../components/Icons'
import { Mascot } from '../../components/Mascot'
import { Term } from '../../components/Sheet'
import { Screen } from '../../components/ui'
import { ru } from '../../i18n/ru'
import { manifest } from '../../lib/audio/manifest'
import { db } from '../../lib/db/db'
import { computeStreak, localDate } from '../../lib/progress/streak'
import s from './MoreScreen.module.css'

const ITEMS = ['stats', 'settings', 'how', 'soundCheck', 'about'] as const
const PATHS: Record<(typeof ITEMS)[number], string> = {
  stats: '/stats',
  settings: '/settings',
  how: '/how',
  soundCheck: '/sound-check',
  about: '/about',
}

export function MoreScreen() {
  const t = ru.more
  const summary = useLiveQuery(async () => {
    const days = await db.days.toArray()
    return {
      streak: computeStreak(new Map(days.map((d) => [d.date, d.seconds])), localDate()).days,
      dv: days.reduce((sum, d) => sum + d.dv, 0),
      words: (await db.cards.where('kind').equals(1).count()),
    }
  }, [])
  return (
    <Screen title={t.title}>
      <dl className={s.summary}>
        <div>
          <dt>
            <Term k="streak">{t.streak}</Term>
          </dt>
          <dd className="mono">{summary?.streak ?? 0}</dd>
        </div>
        <div>
          <dt>
            <Term k="dv">
              {t.points} <span className={s.dim}>· {t.pointsNote}</span>
            </Term>
          </dt>
          <dd className="mono">{summary?.dv ?? 0}</dd>
        </div>
        <div>
          <dt>
            <Term k="retention">{t.words}</Term>
          </dt>
          <dd className="mono">{summary?.words ?? 0}</dd>
        </div>
      </dl>
      <ul className={s.list}>
        {ITEMS.map((key) => (
          <li key={key}>
            <Link to={PATHS[key]} className={s.item}>
              <span>
                <span className={s.itemTitle}>{t.items[key].title}</span>
                <span className={s.itemWhat}>{t.items[key].what}</span>
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
  ['ts-fsrs (интервальное повторение)', 'MIT'],
  ['pitchy (график высоты тона)', 'MIT'],
  ['hanzi-writer (порядок черт)', 'MIT'],
  ['Данные черт: Make Me a Hanzi через hanzi-writer-data', 'Arphic Public License (текст — hanzi/ARPHICPL.TXT)'],
  ['Списки HSK: drkameleon/complete-hsk-vocabulary', 'MIT'],
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
