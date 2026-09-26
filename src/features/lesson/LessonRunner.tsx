/*
  Проигрыватель урока: шапка с прогрессом, текущий экран, запись ответов и времени,
  сохранение места (можно выйти и продолжить), итоги.
*/
import { useEffect, useMemo, useRef, useState } from 'react'
import { IconClose } from '../../components/Icons'
import { Mascot } from '../../components/Mascot'
import ui from '../../components/ui.module.css'
import { ru } from '../../i18n/ru'
import { preloadItems, stopAudio } from '../../lib/audio/audio'
import type { AnswerSource, HanziMode } from '../../lib/db/types'
import { isQuestion, itemsOf, type Screen } from '../../lib/lesson/build'
import { saveLessonStep } from '../../lib/lesson/progress'
import { type AchievementId } from '../../lib/progress/achievements'
import { dvForLesson } from '../../lib/progress/dv'
import { recordAnswer } from '../../lib/progress/record'
import s from './lesson.module.css'
import { ScreenView, type ScreenResult } from './screens'

export type RunResult = {
  seconds: number
  correct: number
  wrong: number
  spoken: number
  accuracy: number | null
  dv: number
}

type Props = {
  runId: string
  screens: Screen[]
  source: AnswerSource
  lessonId?: string
  hanziMode: HanziMode
  startAt?: number
  initialResults?: Record<string, boolean>
  onExit: () => void
  /** вызывается один раз в конце: записать завершение, вернуть новые достижения */
  onFinish: (r: RunResult) => Promise<AchievementId[]>
  summaryActions: (r: RunResult) => React.ReactNode
  onRestart?: () => void
}

export function LessonRunner(props: Props) {
  const { screens, runId } = props
  const [index, setIndex] = useState(() => Math.min(props.startAt ?? 0, screens.length))
  const [results, setResults] = useState<Record<string, boolean>>(props.initialResults ?? {})
  const [spoken, setSpoken] = useState(0)
  const [finished, setFinished] = useState<{ r: RunResult; fresh: AchievementId[] } | null>(null)
  const lastTick = useRef(0)
  const seconds = useRef(0)
  const resumed = (props.startAt ?? 0) > 0

  // Время на экране: считаем только пока вкладка видима.
  useEffect(() => {
    lastTick.current = Date.now()
    const tick = () => {
      const now = Date.now()
      if (document.visibilityState === 'visible') seconds.current += Math.min(60, (now - lastTick.current) / 1000)
      lastTick.current = now
    }
    const id = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      stopAudio()
    }
  }, [])

  // Предзагрузка звуков текущего и следующих 4 экранов.
  useEffect(() => {
    preloadItems(screens.slice(index, index + 5).flatMap(itemsOf))
  }, [index, screens])

  const screen = screens[index]

  async function onDone(r: ScreenResult) {
    const i = index
    const nextResults = isQuestion(screens[i]!) && r.correct !== undefined ? { ...results, [i]: r.correct } : results
    if (r.answer) {
      await recordAnswer({ ...r.answer, source: props.source, lessonId: props.lessonId }).catch((e) => console.error(e))
    }
    if (r.spoken) setSpoken((n) => n + 1)
    setResults(nextResults)
    const secs = seconds.current
    seconds.current = 0
    const next = i + 1
    await saveLessonStep(runId, next >= screens.length ? 0 : next, nextResults, secs).catch((e) => console.error(e))
    totalSeconds.current += secs
    if (next >= screens.length) {
      const vals = Object.values(nextResults)
      const correct = vals.filter(Boolean).length
      const wrong = vals.length - correct
      const spokenAll = spoken + (r.spoken ? 1 : 0)
      const result: RunResult = {
        seconds: totalSeconds.current,
        correct,
        wrong,
        spoken: spokenAll,
        accuracy: vals.length ? correct / vals.length : null,
        dv: dvForLesson({ seconds: totalSeconds.current, correct, wrong, spoken: spokenAll }),
      }
      const fresh = await props.onFinish(result).catch((e) => (console.error(e), [] as AchievementId[]))
      setFinished({ r: result, fresh })
    }
    setIndex(next)
    window.scrollTo(0, 0)
  }
  const totalSeconds = useRef(0)

  const progress = useMemo(() => (screens.length ? Math.min(index, screens.length) / screens.length : 0), [index, screens.length])

  if (finished) return <Summary {...finished} actions={props.summaryActions(finished.r)} />

  return (
    <div className={s.runner} data-run={runId} data-start-at={props.startAt ?? 0}>
      <div className={s.top}>
        <button type="button" className={s.close} onClick={props.onExit} aria-label={ru.lesson.close}>
          <IconClose size={24} />
        </button>
        <div className={s.bar} role="progressbar" aria-valuemin={0} aria-valuemax={screens.length} aria-valuenow={index}>
          <div className={s.barFill} style={{ width: `${progress * 100}%` }} />
        </div>
        <span className={`${s.count} mono`}>{ru.lesson.progress(Math.min(index + 1, screens.length), screens.length)}</span>
      </div>
      {resumed && index === props.startAt && props.onRestart && (
        <div className={s.resume}>
          <span>{ru.lesson.resumeTitle}</span>
          <button type="button" className={ui.link} onClick={props.onRestart}>
            {ru.lesson.restart}
          </button>
        </div>
      )}
      {screen && <ScreenView key={`${runId}:${index}`} screen={screen} hanziMode={props.hanziMode} onDone={(r) => void onDone(r)} />}
    </div>
  )
}

function Summary({ r, fresh, actions }: { r: RunResult; fresh: AchievementId[]; actions: React.ReactNode }) {
  const t = ru.lesson.summary
  const pool = r.accuracy === null || r.accuracy >= 0.85 ? ru.lines.summaryHigh : r.accuracy >= 0.6 ? ru.lines.summaryMid : ru.lines.summaryLow
  const [line] = useState(() => pool[Math.floor(Math.random() * pool.length)]!)
  return (
    <div className={s.runner}>
      <div className={`${s.body} ${s.summary}`}>
        <Mascot mood={fresh.length || (r.accuracy ?? 1) >= 0.85 ? 'celebrate' : 'happy'} size={96} />
        <h1>{t.title}</h1>
        <p>{line}</p>
        <div className={s.stats}>
          <div className={s.stat}>
            <span className={s.statValue}>{t.minutes(r.seconds)}</span>
            <span className={s.statLabel}>{t.time}</span>
          </div>
          <div className={s.stat}>
            <span className={s.statValue}>{r.accuracy === null ? '—' : `${Math.round(r.accuracy * 100)}%`}</span>
            <span className={s.statLabel}>{t.accuracy}</span>
          </div>
          <div className={s.stat}>
            <span className={s.statValue}>+{r.dv}</span>
            <span className={s.statLabel}>{t.dv}, м/с</span>
          </div>
          <div className={s.stat}>
            <span className={s.statValue}>{r.spoken}</span>
            <span className={s.statLabel}>{t.spoken}</span>
          </div>
        </div>
        {fresh.map((id) => (
          <div key={id} className={s.badge} role="status">
            <span className={s.statLabel}>{t.achievement}</span>
            <b>{ru.achievements.list[id]?.name}</b>
            <span>{ru.achievements.list[id]?.what}</span>
          </div>
        ))}
      </div>
      <div className={s.actions}>{actions}</div>
    </div>
  )
}
