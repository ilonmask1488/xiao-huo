/*
  Карточка слова (/word/:id): чтение и звук, значения, мнемоника, порядок черт, примеры, повторение.
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { MixedText } from '../../components/Chinese'
import { PlayButton } from '../../components/Play'
import { Term } from '../../components/Sheet'
import { Placeholder, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { content, wordById } from '../../content'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import { useSettings } from '../../lib/settings/settings'
import { cardId, newCard } from '../../lib/srs/srs'
import { wordRu } from '../../lib/words'
import { SentenceLine } from '../lesson/phrases'
import { WordLine } from '../lesson/screens'
import s from './WordScreen.module.css'

const StrokeOrder = lazy(() => import('../../components/StrokeOrder'))

export function WordScreen() {
  const { id = '' } = useParams()
  const w = wordById.get(id)
  const settings = useSettings()
  const t = ru.word
  const inReview = useLiveQuery(async () => !!(await db.cards.get(cardId(id, 1))), [id])

  if (!w) {
    return (
      <Screen title={ru.dictionary.title} back>
        <Placeholder mood="oops" text={t.notFound} />
      </Screen>
    )
  }
  const hsk = settings.hskScale === 'hsk2' ? w.hsk2 : w.hsk3
  const examples = content.sentences
    .filter((sen) => sen.id === w.example || sen.tokens.some((tok) => tok.wordId === w.id))
    .sort((a, b) => a.tokens.length - b.tokens.length)
    .slice(0, 3)

  return (
    <Screen title={w.hanzi} subtitle={wordRu(w)} back paper>
      <div className={s.wrap}>
        <WordLine id={w.id} showSandhi />
        <p className={s.meta}>
          {w.pos && <span>{w.pos}</span>}
          {hsk && (
            <Term k="hsk" className="mono">
              {t.hsk(settings.hskScale === 'hsk2' ? '2.0' : '3.0', hsk)}
            </Term>
          )}
          {w.tags.includes('engineering') && <span className={s.tag}>{t.engineering}</span>}
        </p>

        {w.mnemonic && (
          <section className={s.section}>
            <h2>{t.mnemonic}</h2>
            <p className={s.mnemonic}>
              <MixedText text={w.mnemonic} />
            </p>
          </section>
        )}

        <section className={s.section}>
          <h2>{t.strokes}</h2>
          <Suspense fallback={<p className={s.note}>{t.loading}</p>}>
            <StrokeOrder hanzi={w.hanzi} />
          </Suspense>
        </section>

        {examples.length > 0 && (
          <section className={s.section}>
            <h2>{t.examples}</h2>
            <ul className={s.examples}>
              {examples.map((sen) => (
                <li key={sen.id} className={s.example}>
                  <div>
                    <SentenceLine sentence={sen} hanziMode={settings.hanziMode} />
                    <span className={s.note}>{sen.ru}</span>
                  </div>
                  <PlayButton item={sen.id} label={ru.lesson.listenAgain} size="s" />
                </li>
              ))}
            </ul>
          </section>
        )}

        {inReview === false && (
          <button type="button" className={ui.secondary} onClick={() => void db.cards.put(newCard(w.id, 1))}>
            {t.addToReview}
          </button>
        )}
        {inReview && <p className={s.note}>{t.inReview}</p>}
      </div>
    </Screen>
  )
}
