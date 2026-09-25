import { useLiveQuery } from 'dexie-react-hooks'
import { Screen } from '../../components/ui'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import s from './CourseScreen.module.css'

/* Контуры частей ракеты, сверху вниз: обтекатель, вторая ступень, первая, стартовый стол. */
const PARTS: Record<number, string> = {
  3: 'M32 4 C48 22 56 60 56 128 L8 128 C8 60 16 22 32 4 Z',
  2: 'M8 0 H56 V128 H8 Z',
  1: 'M8 0 H56 V128 H8 Z M8 70 L0 118 L0 128 L8 128 M56 70 L64 118 L64 128 L56 128 M22 128 L42 128',
  0: 'M2 40 H62 V54 H2 Z M10 54 V128 M54 54 V128 M10 90 L54 128 M54 90 L10 128 M26 40 L28 0 M38 40 L36 0',
}

export function CourseScreen() {
  const done = useLiveQuery(() => db.unitProgress.filter((u) => u.completedAt !== undefined).count(), [], 0)
  // Этапы появятся вместе с контентом ступеней (фаза 1+); пока у ступеней 0 этапов.
  const stages = [...ru.stages].reverse()

  return (
    <Screen title={ru.map.title} subtitle={ru.map.subtitle} paper>
      <ol className={s.stack} reversed>
        {stages.map((st) => {
          const built = false
          return (
            <li key={st.n} className={`${s.stage} ${built ? s.built : ''}`}>
              <svg className={s.drawing} viewBox="0 0 64 128" preserveAspectRatio="none" aria-hidden>
                <path className={s.part} d={PARTS[st.n]} vectorEffect="non-scaling-stroke" />
              </svg>
              <div className={s.text}>
                <span className={`${s.num} mono`}>ступень {st.n}</span>
                <h2>{st.title}</h2>
                <p className={s.what}>{st.what}</p>
                <p className={s.meta}>
                  <span>{st.when}</span>
                  <span>{ru.map.progress(st.n === 0 ? done : 0, 0)}</span>
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </Screen>
  )
}
