/* Синтетический блок пуска (разминка, эхо, скажи сам). Маршрут /launch/:block. */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Placeholder, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { ru } from '../../i18n/ru'
import { blockScreens, finishBlock, learnedMaterial, type LaunchBlockId } from '../../lib/launch/launch'
import { completedLessonIds, getLessonProgress } from '../../lib/lesson/progress'
import { evaluateAchievements } from '../../lib/progress/achievements'
import { addToday } from '../../lib/progress/record'
import { localDate } from '../../lib/progress/streak'
import { useSettings } from '../../lib/settings/settings'
import { LessonRunner } from '../lesson/LessonRunner'

export function LaunchBlockScreen() {
  const block = (useParams().block ?? 'warmup') as LaunchBlockId
  const navigate = useNavigate()
  const settings = useSettings()
  const date = localDate()
  const runId = `launch:${date}:${block}`
  const [data, setData] = useState<{ completed: Set<string>; startAt: number; results: Record<string, boolean> } | null>(null)
  useEffect(() => {
    void (async () => {
      const completed = await completedLessonIds()
      const p = await getLessonProgress(runId)
      setData({ completed, startAt: p?.step ?? 0, results: p?.results ?? {} })
    })()
  }, [runId])
  const screens = useMemo(() => (data ? blockScreens(block, learnedMaterial(data.completed), date) : []), [data, block, date])

  if (!data) return null
  if (!screens.length) {
    return (
      <Screen title={ru.blocks[block]?.title ?? ru.launch.title} back>
        <Placeholder text={ru.launch.skipped[block] ?? ''} />
      </Screen>
    )
  }
  const back = () => navigate('/session')
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
        await finishBlock(block, { seconds: r.seconds, dv: r.dv, correct: r.correct, total: r.correct + r.wrong })
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
