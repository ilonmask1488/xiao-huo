/* «Пуск» — ежедневное занятие из блоков. Маршрут /session. */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mascot } from '../../components/Mascot'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import type { LaunchRow } from '../../lib/db/types'
import { getTodayLaunch, lessonTitle, skipBlock, type LaunchBlockId } from '../../lib/launch/launch'
import { localDate } from '../../lib/progress/streak'
import { useSettings } from '../../lib/settings/settings'
import { useLiveQuery } from 'dexie-react-hooks'
import s from './LaunchScreen.module.css'

export function LaunchScreen() {
  const navigate = useNavigate()
  const settings = useSettings()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void getTodayLaunch().then(() => setReady(true))
  }, [])
  const row = useLiveQuery(() => (ready ? db.launches.get(localDate()) : undefined), [ready]) as LaunchRow | undefined
  const t = ru.launch
  if (!row) return null

  const next = row.blocks.find((b) => b.status === 'pending')
  const open = (id: LaunchBlockId, lessonId?: string) =>
    navigate(id === 'new' && lessonId ? `/lesson/${lessonId}?from=launch` : `/launch/${id}`)
  const minutes = Math.round(row.seconds / 60)

  return (
    <Screen title={t.title} back paper>
      <ol className={s.blocks}>
        {row.blocks.map((b) => (
          <li key={b.id} className={s.block} data-status={b.status}>
            <span className={s.mark} aria-hidden>
              {b.status === 'done' ? '✓' : b.status === 'skipped' ? '—' : '○'}
            </span>
            <span className={s.text}>
              <span className={s.title}>{ru.blocks[b.id].title}</span>
              <span className={s.what}>
                {b.status === 'skipped'
                  ? t.skipped[b.id]
                  : b.id === 'new'
                    ? lessonTitle(b.lessonId)
                    : t.what[b.id]}
              </span>
            </span>
            {b.status === 'pending' && b !== next && (
              <button type="button" className={ui.link} onClick={() => open(b.id, b.lessonId)}>
                {t.open}
              </button>
            )}
          </li>
        ))}
      </ol>

      {next ? (
        <div className={s.launch}>
          <button type="button" className={ui.primary} onClick={() => open(next.id, next.lessonId)}>
            {row.seconds > 0 ? t.continue(ru.blocks[next.id].title) : t.start(ru.blocks[next.id].title)}
          </button>
          <button type="button" className={ui.link} onClick={() => void skipBlock(next.id)}>
            {t.skip}
          </button>
        </div>
      ) : (
        <div className={s.done}>
          <Mascot mood="celebrate" size={88} />
          <h2>{t.doneTitle}</h2>
          <p className="mono">
            {t.doneStats(minutes, row.dv, row.total ? Math.round((row.correct / row.total) * 100) : null)}
          </p>
          {minutes < settings.sessionMinutes && <p className={s.honest}>{t.shortToday(minutes)}</p>}
          <button type="button" className={ui.secondary} onClick={() => navigate('/map')}>
            {t.toMap}
          </button>
        </div>
      )}
    </Screen>
  )
}
