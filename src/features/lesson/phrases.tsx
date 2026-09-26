/*
  Экраны фаз 2+: фразы, «угадай значение», «сборка», «скажи сам», карточки повторения.
*/
import { useEffect, useMemo, useRef, useState } from 'react'
import { Hanzi, MixedText, Pinyin } from '../../components/Chinese'
import { PlayButton } from '../../components/Play'
import { RecordCompare } from '../../components/RecordCompare'
import { ToneGlyph } from '../../components/ToneChart'
import ui from '../../components/ui.module.css'
import { isPunct, sentenceById, wordById } from '../../content'
import type { Item, Sentence } from '../../content/types'
import { ru } from '../../i18n/ru'
import { playItem, stopAudio } from '../../lib/audio/audio'
import { isSentenceItem, isWordItem } from '../../lib/audio/manifest'
import { sfx } from '../../lib/audio/sfx'
import { db } from '../../lib/db/db'
import type { CardRow, HanziMode } from '../../lib/db/types'
import type { Screen } from '../../lib/lesson/build'
import { tonePattern } from '../../lib/lesson/build'
import type { Tone } from '../../lib/pinyin/marks'
import { addToday } from '../../lib/progress/record'
import { answerCard } from '../../lib/srs/cards'
import { formatInterval, previewIntervals, type Grade14 } from '../../lib/srs/srs'
import { useSettings } from '../../lib/settings/settings'
import s from './lesson.module.css'
import type { ScreenResult } from './screens'

type Props<K extends Screen['kind']> = {
  screen: Extract<Screen, { kind: K }>
  hanziMode: HanziMode
  onDone: (r: ScreenResult) => void
}

function useAutoplay(item: Item | null, deps: unknown[]) {
  useEffect(() => {
    if (!item) return
    const t = setTimeout(() => void playItem(item).catch(() => {}), 250)
    return () => {
      clearTimeout(t)
      stopAudio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

/* ——— Фраза по словам: иероглифы, под ними пиньинь ——— */

export function SentenceLine({ sentence, hanziMode = 'always', big }: { sentence: Sentence; hanziMode?: HanziMode; big?: boolean }) {
  const showHanzi = hanziMode !== 'never'
  return (
    <p className={`${s.sentence} ${big ? s.sentenceBig : ''}`}>
      {sentence.tokens.map((t, i) =>
        isPunct(t) ? (
          <span key={i} className={s.punct} lang="zh-CN">
            {showHanzi ? t.hanzi : ''}
          </span>
        ) : (
          <span key={i} className={s.token}>
            {showHanzi && <Hanzi className={s.tokenHanzi}>{t.hanzi}</Hanzi>}
            <Pinyin numeric={t.pinyin} className={s.tokenPinyin} />
          </span>
        ),
      )}
    </p>
  )
}

/** Фраза или слово — компактно, для «скажи сам» и объяснений. */
export function ItemReveal({ item, hanziMode }: { item: Item; hanziMode: HanziMode }) {
  if (isSentenceItem(item)) {
    const sen = sentenceById.get(item)
    return sen ? <SentenceLine sentence={sen} hanziMode={hanziMode} big /> : null
  }
  if (isWordItem(item)) {
    const w = wordById.get(item)
    if (!w) return null
    return (
      <div className={s.big}>
        {hanziMode !== 'never' && <Hanzi className={s.bigHanzi}>{w.hanzi}</Hanzi>}
        <Pinyin numeric={w.pinyin} className={s.bigPinyin} />
      </div>
    )
  }
  return <Pinyin numeric={item} className={s.bigPinyin} />
}

export function ruOf(item: Item): string {
  if (isSentenceItem(item)) return sentenceById.get(item)?.ru ?? ''
  if (isWordItem(item)) return wordById.get(item)?.ru.join(', ') ?? ''
  return ''
}

/* ——— Фразы ——— */

export function SentenceView({ screen, hanziMode, onDone }: Props<'sentence'>) {
  const sen = sentenceById.get(screen.id)!
  const [literal, setLiteral] = useState(false)
  useAutoplay(screen.id, [screen.id])
  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.center}`}>
        <p className={s.kicker}>{ru.lesson.phraseTitle}</p>
        <SentenceLine sentence={sen} hanziMode={hanziMode} big />
        <p className={s.ruLine}>{sen.ru}</p>
        {sen.literal && (
          <button type="button" className={ui.link} onClick={() => setLiteral((v) => !v)} aria-expanded={literal}>
            {literal ? sen.literal : ru.lesson.literal}
          </button>
        )}
        <div className={s.voicePair}>
          {(['female', 'male'] as const).map((v) => (
            <span key={v} className={s.voiceCol}>
              <PlayButton item={screen.id} voice={v} label={`${ru.lesson.listenAgain}: ${ru.lesson.voices[v]}`} />
              <span className={s.exRu} aria-hidden>
                {ru.lesson.voices[v]}
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className={s.actions}>
        <button type="button" className={ui.primary} onClick={() => onDone({})}>
          {ru.lesson.next}
        </button>
      </div>
    </div>
  )
}

/* ——— Угадай значение ——— */

export function MeaningView({ screen, hanziMode, onDone }: Props<'meaning'>) {
  const w = wordById.get(screen.word)!
  const [given, setGiven] = useState<string | null>(null)
  const [line] = useState(() => pick(ru.lines.correct))
  useAutoplay(screen.prompt === 'audio' ? screen.word : null, [screen.word])
  const correct = given === screen.word
  const choose = (id: string) => {
    if (given) return
    setGiven(id)
    sfx(id === screen.word ? 'correct' : 'wrong')
    if (screen.prompt === 'text') void playItem(screen.word).catch(() => {})
  }
  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.center}`}>
        <p className={s.kicker}>{screen.prompt === 'audio' ? ru.lesson.meaningAudio : ru.lesson.meaningText}</p>
        {screen.prompt === 'audio' && !given ? (
          <PlayButton item={screen.word} label={ru.lesson.listenAgain} size="l" />
        ) : (
          <div className={s.big}>
            {hanziMode !== 'never' && <Hanzi className={s.bigHanzi}>{w.hanzi}</Hanzi>}
            <Pinyin numeric={w.pinyin} className={s.bigPinyin} />
          </div>
        )}
        <div className={s.meanings}>
          {screen.options.map((id) => {
            const o = wordById.get(id)!
            const state = given ? (id === screen.word ? 'right' : id === given ? 'wrong' : 'dim') : undefined
            return (
              <button key={id} type="button" className={s.meaningBtn} data-state={state} disabled={!!given} onClick={() => choose(id)}>
                {o.ru[0]}
              </button>
            )
          })}
        </div>
        {given && (
          <div className={s.feedback} data-kind={correct ? 'right' : 'wrong'} role="status">
            <span className={s.feedbackTitle}>{correct ? ru.lesson.correct : ru.lesson.itMeans(w.ru.join(', '))}</span>
            {correct && <span className={s.feedbackLine}>{line}</span>}
          </div>
        )}
      </div>
      <div className={s.actions}>
        {given && (
          <button
            type="button"
            className={ui.primary}
            onClick={() =>
              onDone({
                correct,
                answer: { kind: 'meaning', item: screen.word, expected: screen.word, given: given ?? '', correct },
              })
            }
          >
            {ru.lesson.next}
          </button>
        )}
      </div>
    </div>
  )
}

/* ——— Сборка: собрать фразу, потом послушать и повторить ——— */

export function AssembleView({ screen, hanziMode, onDone }: Props<'assemble'>) {
  const sen = sentenceById.get(screen.id)!
  const words = useMemo(() => sen.tokens.map((t, i) => ({ ...t, i })).filter((t) => !isPunct(t)), [sen])
  const [placed, setPlaced] = useState<number[]>([])
  const [checked, setChecked] = useState<boolean | null>(null)
  const pool = screen.order.filter((i) => !placed.includes(i))
  const right = words.map((t) => t.i)

  const place = (i: number) => {
    const next = [...placed, i]
    setPlaced(next)
    if (next.length !== right.length) return
    // Верно, если собранные слова совпадают с правильными (одинаковые слова взаимозаменяемы).
    const ok = next.every((x, k) => sen.tokens[x]!.hanzi === sen.tokens[right[k]!]!.hanzi)
    setChecked(ok)
    sfx(ok ? 'correct' : 'wrong')
    void playItem(screen.id).catch(() => {})
  }
  useEffect(() => () => stopAudio(), [])

  const chip = (i: number, onClick: () => void, disabled?: boolean) => {
    const t = sen.tokens[i]!
    return (
      <button key={i} type="button" className={s.chipWord} onClick={onClick} disabled={disabled}>
        {hanziMode !== 'never' && <Hanzi className={s.chipHanzi}>{t.hanzi}</Hanzi>}
        <Pinyin numeric={t.pinyin} className={s.chipPinyin} />
      </button>
    )
  }

  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.center}`}>
        <p className={s.kicker}>{ru.lesson.assembleTitle}</p>
        <p className={s.ruLine}>{sen.ru}</p>
        <div className={s.answerLine} data-state={checked === null ? undefined : checked ? 'right' : 'wrong'} aria-label={ru.lesson.assembleAnswer}>
          {placed.map((i) => chip(i, () => checked === null && setPlaced((p) => p.filter((x) => x !== i)), checked !== null))}
        </div>
        {checked === null ? (
          <div className={s.pool}>{pool.map((i) => chip(i, () => place(i)))}</div>
        ) : (
          <div className={s.feedback} data-kind={checked ? 'right' : 'wrong'} role="status">
            <span className={s.feedbackTitle}>{checked ? ru.lesson.correct : ru.lesson.rightOrder}</span>
            {!checked && <SentenceLine sentence={sen} hanziMode={hanziMode} />}
            <span className={s.feedbackLine}>{ru.lesson.nowRepeat}</span>
            <PlayButton item={screen.id} label={ru.lesson.listenAgain} />
          </div>
        )}
      </div>
      <div className={s.actions}>
        {checked === null ? (
          placed.length > 0 && (
            <button type="button" className={ui.secondary} onClick={() => setPlaced([])}>
              {ru.lesson.reset}
            </button>
          )
        ) : (
          <button
            type="button"
            className={ui.primary}
            onClick={() =>
              onDone({
                correct: checked,
                spoken: true,
                answer: { kind: 'order', item: screen.id, expected: right.join(','), given: placed.join(','), correct: checked },
              })
            }
          >
            {ru.lesson.saidIt}
          </button>
        )}
      </div>
    </div>
  )
}

/* ——— Скажи сам ——— */

export function SayItView({ screen, hanziMode, onDone }: Props<'sayIt'>) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => () => stopAudio(), [])
  const done = (good: boolean) =>
    onDone({ spoken: true, answer: { kind: 'self', item: screen.item, expected: 'ok', given: good ? 'ok' : 'meh', correct: good } })
  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.center}`}>
        <p className={s.kicker}>{ru.lesson.sayItTitle}</p>
        <p className={s.ruBig}>{ruOf(screen.item)}</p>
        {revealed ? (
          <>
            <ItemReveal item={screen.item} hanziMode={hanziMode} />
            <PlayButton item={screen.item} label={ru.lesson.listenAgain} />
            <p className={s.phase}>{ru.lesson.selfCheck}</p>
            <RecordCompare item={screen.item} compact />
          </>
        ) : (
          <p className={s.phase}>{ru.lesson.sayItHint}</p>
        )}
      </div>
      <div className={s.actions}>
        {revealed ? (
          <div className={s.row}>
            <button type="button" className={ui.secondary} onClick={() => done(false)}>
              {ru.lesson.notReally}
            </button>
            <button type="button" className={ui.primary} onClick={() => done(true)}>
              {ru.lesson.good}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={ui.primary}
            onClick={() => {
              setRevealed(true)
              void playItem(screen.item).catch(() => {})
            }}
          >
            {ru.lesson.check}
          </button>
        )}
      </div>
    </div>
  )
}

/* ——— Карточка повторения ——— */

export function CardView({ screen, hanziMode, onDone }: Props<'card'>) {
  const settings = useSettings()
  const w = wordById.get(screen.word)!
  const [intervals, setIntervals] = useState<Record<Grade14, number> | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [given, setGiven] = useState<string | null>(null)
  const started = useRef(0)
  useEffect(() => {
    started.current = Date.now()
    void db.cards.get(screen.cardId).then((r: CardRow | undefined) => {
      if (r) setIntervals(previewIntervals(r, Date.now(), settings.desiredRetention))
    })
  }, [screen.cardId, settings.desiredRetention])
  useAutoplay(screen.cardKind === 1 || screen.cardKind === 4 ? screen.word : null, [screen.cardId])

  const finish = async (grade: Grade14) => {
    await answerCard(screen.cardId, grade, Date.now() - started.current, settings.desiredRetention).catch((e) => console.error(e))
    if (screen.cardKind === 3) await addToday({ spoken: 1 }).catch(() => {})
    onDone({ correct: grade >= 2, spoken: screen.cardKind === 3 })
  }

  const showHanzi = hanziMode !== 'never'
  const answer = (
    <div className={s.big}>
      {showHanzi && <Hanzi className={s.bigHanzi}>{w.hanzi}</Hanzi>}
      <Pinyin numeric={w.pinyin} className={s.bigPinyin} />
      <span className={s.bigRu}>{w.ru.join(', ')}</span>
      {(screen.cardKind === 2 || screen.cardKind === 5) && w.mnemonic && (
        <p className={s.mnemonic}>
          <b>{ru.review.mnemonic}.</b> <MixedText text={w.mnemonic} />
        </p>
      )}
    </div>
  )

  // Тип 4: выбрать тоновый рисунок — оценка по ответу.
  if (screen.cardKind === 4) {
    const right = tonePattern(screen.word)
    return (
      <div className={s.view}>
        <div className={`${s.body} ${s.center}`}>
          <p className={s.kicker}>{ru.review.kind[4]}</p>
          {showHanzi ? <Hanzi className={s.bigHanzi}>{w.hanzi}</Hanzi> : <span className={s.bigRu}>{w.ru[0]}</span>}
          <PlayButton item={screen.word} label={ru.lesson.listenAgain} />
          {given && <Pinyin numeric={w.pinyin} className={s.bigPinyin} />}
          <div className={s.choices}>
            {(screen.options ?? [right]).map((o) => (
              <button
                key={o}
                type="button"
                className={s.choice}
                data-state={given ? (o === right ? 'right' : o === given ? 'wrong' : 'dim') : undefined}
                disabled={!!given}
                aria-label={[...o].map((t) => ru.lesson.toneName(Number(t))).join(' + ')}
                onClick={() => {
                  setGiven(o)
                  sfx(o === right ? 'correct' : 'wrong')
                }}
              >
                <span style={{ display: 'flex', gap: 2 }}>
                  {[...o].map((t, i) => (
                    <ToneGlyph key={i} tone={Number(t) as Tone} size={26} />
                  ))}
                </span>
                <span className={s.choiceLabel}>{[...o].map((t) => ru.lesson.toneShort(Number(t))).join(' + ')}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={s.actions}>
          {given && (
            <button type="button" className={ui.primary} onClick={() => void finish(given === right ? 3 : 1)}>
              {ru.lesson.next}
            </button>
          )}
        </div>
      </div>
    )
  }

  const prompt =
    screen.cardKind === 1 ? (
      <PlayButton item={screen.word} label={ru.lesson.listenAgain} size="l" />
    ) : screen.cardKind === 5 ? (
      <Hanzi className={s.bigHanzi}>{w.hanzi}</Hanzi>
    ) : screen.cardKind === 2 ? (
      <div className={s.big}>
        {showHanzi && <Hanzi className={s.bigHanzi}>{w.hanzi}</Hanzi>}
        <Pinyin numeric={w.pinyin} className={s.bigPinyin} />
      </div>
    ) : (
      <p className={s.ruBig}>{w.ru.join(', ')}</p>
    )

  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.center}`}>
        <p className={s.kicker}>{ru.review.kind[screen.cardKind]}</p>
        {prompt}
        {revealed ? answer : <p className={s.phase}>{ru.review.hint[screen.cardKind]}</p>}
      </div>
      <div className={s.actions}>
        {revealed ? (
          <div className={s.grades} role="group" aria-label={ru.review.gradeLabel}>
            {([1, 2, 3, 4] as const).map((g) => (
              <button key={g} type="button" className={g === 3 ? ui.primary : ui.secondary} onClick={() => void finish(g)}>
                <span>{ru.review.grades[g]}</span>
                {intervals && <span className={s.gradeTime}>{formatInterval(intervals[g])}</span>}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            className={ui.primary}
            onClick={() => {
              setRevealed(true)
              if (screen.cardKind !== 1) void playItem(screen.word).catch(() => {})
            }}
          >
            {ru.review.show}
          </button>
        )}
      </div>
    </div>
  )
}
