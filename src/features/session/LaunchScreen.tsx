/* «Пуск» — ежедневное занятие из сегментов не длиннее ~3 минут одного формата. Маршрут /session. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClaudeButton } from '../../components/ClaudeButton'
import { Mascot } from '../../components/Mascot'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import type { LaunchSegment } from '../../lib/db/types'
import { DUE_OVERLOAD, getTodayLaunch, lessonTitle, segmentUrl, skipBlock } from '../../lib/launch/launch'
import { localDate } from '../../lib/progress/streak'
import { useSettings } from '../../lib/settings/settings'
import s from './LaunchScreen.module.css'

function segmentWhat(seg: LaunchSegment): string {
  if (seg.kind === 'lesson') return lessonTitle(seg.lessonId) ?? ''
  if (seg.kind === 'game') return (ru.games as unknown as Record<string, { title?: string }>)[seg.game ?? '']?.title ?? ''
  const n = seg.items?.length ?? 0
  if (seg.kind === 'cards') return ru.launch.cards(n)
  if (seg.kind === 'echo') return ru.launch.echoItems(n)
  return ru.launch.speakItems(n)
}

export function LaunchScreen() {
  const navigate = useNavigate()
  const settings = useSettings()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void getTodayLaunch(settings.sessionMinutes).then(() => setReady(true))
  }, [settings.sessionMinutes])
  const row = useLiveQuery(() => (ready ? db.launches.get(localDate()) : undefined), [ready])
  const t = ru.launch
  if (!row?.segments) return null

  const segments = row.segments
  const next = segments.find((x) => x.status === 'pending')
  const minutes = Math.round(row.seconds / 60)
  const cardsTaken = segments.filter((x) => x.kind === 'cards').reduce((a, x) => a + (x.items?.length ?? 0), 0)
  let t0 = 0

  return (
    <Screen title={t.title} subtitle={t.subtitle} back paper>
      {(row.totalDue ?? 0) > DUE_OVERLOAD && <p className={s.capped}>{ru.review.capped(row.totalDue!, cardsTaken)}</p>}
      <ol className={s.blocks}>
        {segments.map((seg) => {
          const start = t0
          t0 += seg.minutes
          return (
            <li key={seg.id} className={s.block} data-status={seg.status} data-current={seg === next || undefined}>
              <span className={`${s.mark} mono`} aria-hidden>
                {seg.status === 'done' ? '✓' : seg.status === 'skipped' ? '—' : `T+${String(start).padStart(2, '0')}`}
              </span>
              <span className={s.text}>
                <span className={s.title}>
                  {ru.blocks[seg.block].title} <span className={`${s.min} mono`}>· {seg.minutes} мин</span>
                </span>
                <span className={s.what}>{segmentWhat(seg)}</span>
              </span>
              {seg.status === 'pending' && seg !== next && (
                <button type="button" className={ui.link} onClick={() => navigate(segmentUrl(seg))}>
                  {t.open}
                </button>
              )}
            </li>
          )
        })}
      </ol>
      {!segments.some((x) => x.block === 'review') && <p className={s.honest}>{t.noReview}</p>}

      {next ? (
        <div className={s.launch}>
          <button type="button" className={ui.primary} onClick={() => navigate(segmentUrl(next))}>
            {row.seconds > 0 ? t.continue(ru.blocks[next.block].title) : t.start(ru.blocks[next.block].title)}
          </button>
          <button type="button" className={ui.link} onClick={() => void skipBlock(next.block)}>
            {t.skip(ru.blocks[next.block].title)}
          </button>
        </div>
      ) : (
        <div className={s.done}>
          <Mascot mood="celebrate" size={88} />
          <h2>{t.doneTitle}</h2>
          <p className="mono">{t.doneStats(minutes, row.dv, row.total ? Math.round((row.correct / row.total) * 100) : null)}</p>
          {minutes < settings.sessionMinutes - 5 && <p className={s.honest}>{t.shortToday(minutes)}</p>}
          <ClaudeButton />
          <button type="button" className={ui.secondary} onClick={() => navigate('/map')}>
            {t.toMap}
          </button>
        </div>
      )}
    </Screen>
  )
}
