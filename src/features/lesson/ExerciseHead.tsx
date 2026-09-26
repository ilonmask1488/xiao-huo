/*
  Шапка упражнения (UX §4): инструкция глаголом, строка шагов и «?». При первой встрече
  с типом упражнения — однократная подсказка поверх экрана (коучмарк).
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Help } from '../../components/Help'
import { Sheet } from '../../components/Sheet'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import s from './lesson.module.css'

export type ExerciseKind = Exclude<keyof typeof ru.exercise, 'newTitle'>

function useCoachmark(kind: ExerciseKind) {
  const seen = useLiveQuery(async () => ({ list: parse(await db.getMeta<string>('seenExercises')) }), [])
  // Закрываем сразу локально: запись в базу догонит (иначе лист висит ещё кадр-другой после нажатия)
  const [closed, setClosed] = useState(false)
  const show = !closed && !!seen && !seen.list.includes(kind)
  const dismiss = () => {
    setClosed(true)
    void db.setMeta('seenExercises', JSON.stringify([...new Set([...(seen?.list ?? []), kind])]))
  }
  return { show, dismiss }
}

function parse(v: string | undefined): string[] {
  try {
    const list = v ? (JSON.parse(v) as unknown) : []
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function ExerciseHead({ kind, title }: { kind: ExerciseKind; title?: string }) {
  const t = ru.exercise[kind]
  const coach = useCoachmark(kind)
  return (
    <>
      <div className={s.cardHead}>
        <div>
          <p className={s.kicker}>{title ?? t.title}</p>
          {t.steps && <p className={s.stepsLine}>{t.steps}</p>}
        </div>
        <Help title={t.title} text={t.help} />
      </div>
      {coach.show && (
        <Sheet title={ru.exercise.newTitle(t.title)} onClose={coach.dismiss}>
          {t.help.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {t.steps && (
            <p>
              <b>{t.steps}</b>
            </p>
          )}
        </Sheet>
      )}
    </>
  )
}
