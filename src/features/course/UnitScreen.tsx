/* Страница этапа: уроки, слова, фразы, грамматика, «пройти заново», тренировка с Claude. Маршрут /unit/:id. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { ClaudeButton } from '../../components/ClaudeButton'
import { PlayButton } from '../../components/Play'
import { Placeholder, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { content, lessonById, sentenceById, unitById } from '../../content'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import { SentenceLine } from '../lesson/phrases'
import { WordLine } from '../lesson/screens'
import s from './UnitScreen.module.css'

export function UnitScreen() {
  const id = useParams().id ?? ''
  const navigate = useNavigate()
  const unit = unitById.get(id)
  const progress = useLiveQuery(() => db.lessonProgress.toArray(), [])
  if (!unit) {
    return (
      <Screen title={ru.map.title} back>
        <Placeholder mood="oops" text={ru.lesson.notFound} />
      </Screen>
    )
  }
  const done = new Set((progress ?? []).filter((p) => p.completedAt).map((p) => p.lessonId))
  const inProgress = new Set((progress ?? []).filter((p) => p.step > 0).map((p) => p.lessonId))
  const sentences = content.sentences.filter((x) => x.unitId === unit.id)

  return (
    <Screen title={`${unit.code} ${unit.title}`} subtitle={unit.goals.join(' · ')} back>
      <section className={s.section}>
        <h2>{ru.unit.lessons}</h2>
        <ol className={s.lessons}>
          {unit.lessons.map((lid) => {
            const l = lessonById.get(lid)!
            return (
              <li key={lid} className={s.lesson} data-done={done.has(lid) || undefined}>
                <span className={s.check} aria-hidden>
                  {done.has(lid) ? '✓' : '○'}
                </span>
                <span>{l.title}</span>
                <button type="button" className={ui.link} onClick={() => navigate(`/lesson/${lid}`)}>
                  {done.has(lid) ? ru.map.redo : inProgress.has(lid) ? ru.map.continue : ru.map.open}
                </button>
              </li>
            )
          })}
        </ol>
        <ClaudeButton unitId={unit.id} />
      </section>

      {unit.newWords.length > 0 && (
        <section className={s.section}>
          <h2>{ru.unit.words(unit.newWords.length)}</h2>
          <div>
            {unit.newWords.map((w) => (
              <WordLine key={w} id={w} />
            ))}
          </div>
        </section>
      )}

      {sentences.length > 0 && (
        <section className={s.section}>
          <h2>{ru.unit.phrases(sentences.length)}</h2>
          <ul className={s.phrases}>
            {sentences.map((x) => (
              <li key={x.id} className={s.phrase}>
                <div>
                  <SentenceLine sentence={x} />
                  <span className={s.ru}>{x.ru}</span>
                </div>
                <PlayButton item={x.id} label={ru.lesson.listenAgain} size="s" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {unit.grammarNotes.length > 0 && (
        <section className={s.section}>
          <h2>{ru.unit.grammar}</h2>
          {unit.grammarNotes.map((g) => (
            <div key={g.title} className={s.note}>
              <h3>{g.title}</h3>
              <p>{g.ru}</p>
              {g.examples.map((eid) => {
                const x = sentenceById.get(eid)
                return x ? (
                  <div key={eid} className={s.phrase}>
                    <div>
                      <SentenceLine sentence={x} />
                      <span className={s.ru}>{x.ru}</span>
                    </div>
                    <PlayButton item={eid} label={ru.lesson.listenAgain} size="s" />
                  </div>
                ) : null
              })}
            </div>
          ))}
        </section>
      )}
    </Screen>
  )
}
