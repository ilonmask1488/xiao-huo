/* Сегмент пуска: повторение карточек, эхо или «скажи сам». Маршрут /launch/:seg. */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Placeholder, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import type { CardRow, LaunchSegment } from '../../lib/db/types'
import { finishSegment, segmentScreens } from '../../lib/launch/launch'
import { getLessonProgress } from '../../lib/lesson/progress'
import { evaluateAchievements } from '../../lib/progress/achievements'
import { addToday } from '../../lib/progress/record'
import { localDate } from '../../lib/progress/streak'
import { useSettings } from '../../lib/settings/settings'
import { LessonRunner } from '../lesson/LessonRunner'

export function LaunchBlockScreen() {
  const segId = useParams().seg ?? ''
  const navigate = useNavigate()
  const settings = useSettings()
  const date = localDate()
  const runId = `launch:${date}:${segId}`
  const [data, setData] = useState<{ seg?: LaunchSegment; cards: Map<string, CardRow>; startAt: number; results: Record<string, boolean> } | null>(
    null,
  )
  useEffect(() => {
    void (async () => {
      const row = await db.launches.get(date)
      const seg = row?.segments?.find((x) => x.id === segId)
      const cards = new Map((await db.cards.bulkGet(seg?.items ?? [])).filter((c): c is CardRow => !!c).map((c) => [c.id, c]))
      const p = await getLessonProgress(runId)
      setData({ seg, cards, startAt: p?.step ?? 0, results: p?.results ?? {} })
    })()
  }, [runId, segId, date])
  const screens = useMemo(() => (data?.seg ? segmentScreens(data.seg, date, data.cards) : []), [data, date])

  if (!data) return null
  const back = () => navigate('/session')
  if (!data.seg || !screens.length) {
    return (
      <Screen title={ru.launch.title} back>
        <Placeholder text={ru.review.empty} />
      </Screen>
    )
  }
  const seg = data.seg
  return (
    <LessonRunner
      runId={runId}
      screens={screens}
      source="launch"
      hanziMode={settings.hanziMode}
      startAt={data.startAt < screens.length ? data.startAt : 0}
      initialResults={data.results}
      onExit={back}
      onFinish={async (r) => {
        await addToday({ seconds: r.seconds, dv: r.dv, spoken: r.spoken })
        await finishSegment(seg.id, { seconds: r.seconds, dv: r.dv, correct: r.correct, total: r.correct + r.wrong })
        return evaluateAchievements()
      }}
      summaryActions={() => (
        <button type="button" className={ui.primary} onClick={back}>
          {ru.lesson.summary.toLaunch}
        </button>
      )}
    />
  )
}
