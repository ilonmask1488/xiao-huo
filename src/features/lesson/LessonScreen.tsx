/* Маршрут /lesson/:id — урок с продолжением с места выхода и проверкой звука перед первым уроком. */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Placeholder, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { lessonById } from '../../content'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import type { LessonProgressRow } from '../../lib/db/types'
import { finishBlock } from '../../lib/launch/launch'
import { trainingFor, weakest } from '../../lib/lesson/boss'
import { buildLesson } from '../../lib/lesson/build'
import { completeLesson, getLessonProgress, resetLessonRun } from '../../lib/lesson/progress'
import { evaluateAchievements } from '../../lib/progress/achievements'
import { addToday } from '../../lib/progress/record'
import { useSettings } from '../../lib/settings/settings'
import s from './lesson.module.css'
import { LessonRunner } from './LessonRunner'
import { SoundCheckPanel } from './SoundCheck'

export function LessonScreen() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const from = params.get('from') // 'launch' — вернуться в пуск
  const navigate = useNavigate()
  const settings = useSettings()
  const lesson = lessonById.get(id)
  const screens = useMemo(() => (lesson ? buildLesson(lesson) : []), [lesson])
  const [runKey, setRunKey] = useState(0)
  // Место старта читаем один раз на прохождение (не «живым» запросом: он обновлялся бы после каждого экрана).
  const [loaded, setLoaded] = useState<{ key: string; progress?: LessonProgressRow; soundChecked: boolean } | null>(null)
  const state = loaded?.key === `${id}:${runKey}` ? loaded : null
  useEffect(() => {
    let alive = true
    void (async () => {
      const next = {
        key: `${id}:${runKey}`,
        progress: await getLessonProgress(id),
        soundChecked: !!(await db.getMeta('soundChecked')),
      }
      if (alive) setLoaded(next)
    })()
    return () => {
      alive = false
    }
  }, [id, runKey])
  const [checkedNow, setCheckedNow] = useState(false)

  if (!lesson) {
    return (
      <Screen title={ru.map.title} back>
        <Placeholder mood="oops" text={ru.lesson.notFound} />
      </Screen>
    )
  }
  if (!state) return null

  if (!state.soundChecked && !checkedNow) {
    return (
      <div className={s.runner}>
        <div className={s.body}>
          <h1>{ru.soundCheck.title}</h1>
          <SoundCheckPanel
            onOk={() => {
              setCheckedNow(true)
              void db.setMeta('soundChecked', true)
            }}
          />
        </div>
      </div>
    )
  }

  const back = () => navigate(from === 'launch' ? '/session' : '/map')
  const p = state.progress
  const startAt = p && p.step > 0 && p.step < screens.length ? p.step : 0

  return (
    <LessonRunner
      key={state.key}
      runId={lesson.id}
      lessonId={lesson.id}
      screens={screens}
      source={from === 'launch' ? 'launch' : 'lesson'}
      hanziMode={settings.hanziMode}
      startAt={startAt}
      initialResults={startAt ? p?.results : {}}
      onExit={back}
      onRestart={() => void resetLessonRun(lesson.id).then(() => setRunKey((k) => k + 1))}
      boss={lesson.boss}
      onFinish={async (r) => {
        // «Босс» засчитывается только при успехе; неудача — без штрафов, время и Δv всё равно идут в зачёт.
        if (!lesson.boss || r.passed) await completeLesson(lesson.id, r.accuracy)
        else await resetLessonRun(lesson.id)
        await addToday({ seconds: r.seconds, dv: r.dv, spoken: r.spoken, newWords: lesson.newWords.length })
        if (from === 'launch') {
          await finishBlock('new', { seconds: r.seconds, dv: r.dv, correct: r.correct, total: r.correct + r.wrong })
        }
        return evaluateAchievements()
      }}
      summaryActions={(r) => {
        const restart = () => void resetLessonRun(lesson.id).then(() => setRunKey((k) => k + 1))
        if (lesson.boss && !r.passed) {
          const weak = weakest(r.breakdown ?? [])
          return (
            <>
              {weak && (
                <button type="button" className={ui.primary} onClick={() => navigate(trainingFor(weak))}>
                  {ru.boss.train(ru.boss.skills[weak]!.toLowerCase())}
                </button>
              )}
              <button type="button" className={weak ? ui.secondary : ui.primary} onClick={restart}>
                {ru.boss.again}
              </button>
              <button type="button" className={ui.link} onClick={back}>
                {ru.lesson.summary.toMap}
              </button>
            </>
          )
        }
        return (
          <>
            <button type="button" className={ui.primary} onClick={back}>
              {from === 'launch' ? ru.lesson.summary.toLaunch : ru.lesson.summary.toMap}
            </button>
            <button type="button" className={ui.secondary} onClick={restart}>
              {ru.lesson.summary.repeat}
            </button>
          </>
        )
      }}
    />
  )
}
