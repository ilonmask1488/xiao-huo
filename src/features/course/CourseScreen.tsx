import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { lessonById, unitsOfStage, wordById } from '../../content'
import { hanziChars, hanziDataUrl } from '../../lib/hanzi'
import type { Unit } from '../../content/types'
import { ru } from '../../i18n/ru'
import { entriesFor, urlOf } from '../../lib/audio/manifest'
import { db } from '../../lib/db/db'
import type { LessonProgressRow } from '../../lib/db/types'
import { itemsOf, buildLesson } from '../../lib/lesson/build'
import { nextLessonId } from '../../lib/lesson/progress'
import s from './CourseScreen.module.css'

/* Контуры частей ракеты, сверху вниз: обтекатель, вторая ступень, первая, стартовый стол. */
const PARTS: Record<number, string> = {
  3: 'M32 4 C48 22 56 60 56 128 L8 128 C8 60 16 22 32 4 Z',
  2: 'M8 0 H56 V128 H8 Z',
  1: 'M8 0 H56 V128 H8 Z M8 70 L0 118 L0 128 L8 128 M56 70 L64 118 L64 128 L56 128 M22 128 L42 128',
  0: 'M2 40 H62 V54 H2 Z M10 54 V128 M54 54 V128 M10 90 L54 128 M54 90 L10 128 M26 40 L28 0 M38 40 L36 0',
}

type Status = 'built' | 'partial' | 'none'

export function CourseScreen() {
  // Ждём прогресс из базы: иначе раскрылся бы «первый» этап вместо текущего.
  const loaded = useLiveQuery(() => db.lessonProgress.toArray(), [])
  const progress: LessonProgressRow[] = loaded ?? []
  const byLesson = new Map(progress.map((p) => [p.lessonId, p]))
  const completed = new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId))
  const current = nextLessonId(completed)
  const stages = [...ru.stages].reverse()
  const currentRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (loaded) currentRef.current?.scrollIntoView({ block: 'start' })
  }, [loaded])

  if (!loaded) return null
  return (
    <Screen title={ru.map.title} subtitle={ru.map.subtitle} paper>
      <ol className={s.stack}>
        {stages.map((st) => {
          const units = unitsOfStage(st.n)
          const lessonIds = units.flatMap((u) => u.lessons)
          const done = lessonIds.filter((id) => completed.has(id)).length
          const status: Status = lessonIds.length && done === lessonIds.length ? 'built' : done > 0 ? 'partial' : 'none'
          const isCurrent = units.some((u) => u.lessons.includes(current ?? ''))
          return (
            <li key={st.n} className={s.stage} data-status={status} ref={isCurrent || (!current && st.n === 0) ? currentRef : undefined}>
              <svg className={s.drawing} viewBox="0 0 64 128" preserveAspectRatio="none" aria-hidden>
                {status === 'partial' && (
                  <clipPath id={`fill-${st.n}`}>
                    <rect x="0" y={128 - (128 * done) / lessonIds.length} width="64" height="128" />
                  </clipPath>
                )}
                <path className={s.part} d={PARTS[st.n]} vectorEffect="non-scaling-stroke" />
                {status === 'partial' && (
                  <path className={s.partFill} d={PARTS[st.n]} clipPath={`url(#fill-${st.n})`} vectorEffect="non-scaling-stroke" />
                )}
              </svg>
              <div className={s.text}>
                <span className={`${s.num} mono`}>ступень {st.n}</span>
                <h2>{st.title}</h2>
                <p className={s.what}>{st.what}</p>
                <p className={s.meta}>
                  <span>{st.when}</span>
                  <span>{lessonIds.length ? ru.map.lessonsDone(done, lessonIds.length) : ru.map.preparing}</span>
                </p>
                {units.length > 0 && (
                  <ul className={s.units}>
                    {units.map((u) => (
                      <UnitRow key={u.id} unit={u} completed={completed} progress={byLesson} current={current} />
                    ))}
                  </ul>
                )}
                {lessonIds.length > 0 && <OfflineAudio lessonIds={lessonIds} />}
              </div>
            </li>
          )
        })}
      </ol>
    </Screen>
  )
}

function UnitRow({
  unit,
  completed,
  progress,
  current,
}: {
  unit: Unit
  completed: Set<string>
  progress: Map<string, LessonProgressRow>
  current?: string
}) {
  const navigate = useNavigate()
  const hasCurrent = unit.lessons.includes(current ?? '')
  const [open, setOpen] = useState(hasCurrent)
  const done = unit.lessons.filter((id) => completed.has(id)).length
  const total = unit.lessons.length
  if (!total) {
    return (
      <li className={s.unit} data-empty>
        <span className={`${s.code} mono`}>{unit.code}</span>
        <span className={s.unitTitle}>{unit.title}</span>
        <span className={s.unitMeta}>{ru.map.preparing}</span>
      </li>
    )
  }
  const firstOpen = unit.lessons.find((id) => !completed.has(id)) ?? unit.lessons[0]!
  const inProgress = unit.lessons.some((id) => (progress.get(id)?.step ?? 0) > 0)
  const action = done === total ? ru.map.redo : done > 0 || inProgress ? ru.map.continue : ru.map.open
  return (
    <li className={s.unit}>
      <button type="button" className={s.unitHead} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={`${s.code} mono`}>{unit.code}</span>
        <span className={s.unitTitle}>{unit.title}</span>
        <span className={s.unitMeta}>{ru.map.lessonsDone(done, total)}</span>
      </button>
      {open && (
        <ol className={s.lessons}>
          {unit.lessons.map((id) => {
            const l = lessonById.get(id)!
            const isDone = completed.has(id)
            const p = progress.get(id)
            return (
              <li key={id} className={s.lesson} data-done={isDone || undefined} data-current={id === current || undefined}>
                <span className={s.check} aria-hidden>
                  {isDone ? '✓' : id === current ? '●' : '○'}
                </span>
                <span className={s.lessonTitle}>{l.title}</span>
                <button type="button" className={ui.link} onClick={() => navigate(`/lesson/${id}`)}>
                  {isDone ? ru.map.redo : (p?.step ?? 0) > 0 ? ru.map.continue : ru.map.open}
                </button>
              </li>
            )
          })}
        </ol>
      )}
      {!open && (
        <button type="button" className={`${ui.secondary} ${s.unitAction}`} onClick={() => navigate(`/lesson/${firstOpen}`)}>
          {action}
        </button>
      )}
      {open && (
        <button type="button" className={`${ui.link} ${s.unitDetails}`} onClick={() => navigate(`/unit/${unit.id}`)}>
          {ru.unit.details}
        </button>
      )}
    </li>
  )
}

/** «Скачать звук ступени для офлайна»: все звуки уроков — в кэш. */
function OfflineAudio({ lessonIds }: { lessonIds: string[] }) {
  const [state, setState] = useState<{ done: number; total: number } | null>(null)
  const run = async () => {
    const items = new Set(lessonIds.flatMap((id) => buildLesson(lessonById.get(id)!).flatMap(itemsOf)))
    const chars = lessonIds.flatMap((id) => lessonById.get(id)!.newWords.flatMap((w) => hanziChars(wordById.get(w)?.hanzi ?? '')))
    // Звук уроков и порядок черт новых слов — чтобы в полёте работало всё.
    const urls = [...new Set([...[...items].flatMap((i) => entriesFor(i).map(urlOf)), ...chars.map(hanziDataUrl)])]
    setState({ done: 0, total: urls.length })
    let done = 0
    const queue = [...urls]
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let u = queue.shift(); u; u = queue.shift()) {
          await fetch(u).catch(() => {})
          setState({ done: ++done, total: urls.length })
        }
      }),
    )
  }
  if (state && state.done === state.total) return <p className={s.offline}>{ru.map.offlineDone(state.total)}</p>
  return (
    <button type="button" className={`${ui.link} ${s.offlineBtn}`} disabled={!!state} onClick={() => void run()}>
      {state ? ru.map.offlineProgress(state.done, state.total) : ru.map.offline}
    </button>
  )
}
