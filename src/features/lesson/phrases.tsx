/*
  Экраны фаз 2+: фразы, «угадай значение», «сборка», «скажи сам», карточки повторения.
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Hanzi, MixedText, Pinyin } from '../../components/Chinese'
import { Help } from '../../components/Help'
import { PlayButton } from '../../components/Play'
import { WordTap, useWordSheet } from '../../components/WordSheet'
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
import { formatWhen, previewIntervals, type Grade14 } from '../../lib/srs/srs'
import { useSettings } from '../../lib/settings/settings'
import { meaningOf, wordRu } from '../../lib/words'
import { ExerciseHead } from './ExerciseHead'
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

export function SentenceLine({
  sentence,
  hanziMode = 'always',
  big,
  tappable,
}: {
  sentence: Sentence
  hanziMode?: HanziMode
  big?: boolean
  /** слова нажимаются — тап открывает перевод (UX §1.5); не внутри других кнопок */
  tappable?: boolean
}) {
  const showHanzi = hanziMode !== 'never'
  const open = useWordSheet()
  return (
    <p className={`${s.sentence} ${big ? s.sentenceBig : ''}`}>
      {sentence.tokens.map((t, i) =>
        isPunct(t) ? (
          <span key={i} className={s.punct} lang="zh-CN">
            {showHanzi ? t.hanzi : ''}
          </span>
        ) : tappable ? (
          <button key={i} type="button" className={`${s.token} ${s.tokenBtn}`} aria-label={ru.wordSheet.open(t.hanzi)} onClick={() => open({ token: t })}>
            {showHanzi && <Hanzi className={s.tokenHanzi}>{t.hanzi}</Hanzi>}
            <Pinyin numeric={t.pinyin} className={s.tokenPinyin} />
          </button>
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
    return sen ? <SentenceLine sentence={sen} hanziMode={hanziMode} big tappable /> : null
  }
  if (isWordItem(item)) {
    const w = wordById.get(item)
    if (!w) return null
    return (
      <div className={s.big}>
        <WordTap id={item}>
          {hanziMode !== 'never' && <Hanzi className={s.bigHanzi}>{w.hanzi}</Hanzi>}
          <Pinyin numeric={w.pinyin} className={s.bigPinyin} />
        </WordTap>
      </div>
    )
  }
  return <Pinyin numeric={item} className={s.bigPinyin} />
}

export function ruOf(item: Item): string {
  if (isSentenceItem(item)) return sentenceById.get(item)?.ru ?? ''
  if (isWordItem(item)) {
    const w = wordById.get(item)
    return w ? wordRu(w) : ''
  }
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
        <ExerciseHead kind="sentence" />
        <SentenceLine sentence={sen} hanziMode={hanziMode} big tappable />
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
        <ExerciseHead kind={screen.prompt === 'audio' ? 'meaningAudio' : 'meaningText'} />
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
                {meaningOf(o)}
              </button>
            )
          })}
        </div>
        {given && (
          <div className={s.feedback} data-kind={correct ? 'right' : 'wrong'} role="status">
            <span className={s.feedbackTitle}>{correct ? ru.lesson.correct : ru.lesson.itMeans(wordRu(w))}</span>
            {correct ? <span className={s.feedbackLine}>{line}</span> : <span className={s.feedbackLine}>{wordRu(w)}</span>}
            <PlayButton item={screen.word} label={ru.lesson.listenAgain} size="s" />
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
        <ExerciseHead kind="assemble" />
        <p className={s.ruLine}>{sen.ru}</p>
        <div className={s.answerLine} data-state={checked === null ? undefined : checked ? 'right' : 'wrong'} aria-label={ru.lesson.assembleAnswer}>
          {placed.map((i) => chip(i, () => checked === null && setPlaced((p) => p.filter((x) => x !== i)), checked !== null))}
        </div>
        {checked === null ? (
          <div className={s.pool}>{pool.map((i) => chip(i, () => place(i)))}</div>
        ) : (
          <div className={s.feedback} data-kind={checked ? 'right' : 'wrong'} role="status">
            <span className={s.feedbackTitle}>{checked ? ru.lesson.correct : ru.lesson.rightOrder}</span>
            {!checked && <SentenceLine sentence={sen} hanziMode={hanziMode} tappable />}
            <span className={s.feedbackLine}>{ru.lesson.nowRepeat}</span>
            <PlayButton item={screen.id} label={ru.lesson.listenAgain} />
          </div>
        )}
      </div>
      <div className={s.actions}>
        {checked === null ? (
          placed.length > 0 ? (
            <button type="button" className={ui.secondary} onClick={() => setPlaced([])}>
              {ru.lesson.reset}
            </button>
          ) : (
            <p className={s.disabledHint}>{ru.lesson.assembleFirst}</p>
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
        <ExerciseHead kind="sayIt" />
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

/* ——— Карточка повторения (UX §3): шаг 1 — вопрос, шаг 2 — ответ, шаг 3 — самооценка ——— */

const GRADES = [1, 2, 3, 4] as const

/** Первая карточка в жизни пользователя: одно объяснение, потом — по «?». */
function FirstTime({ onOk }: { onOk: () => void }) {
  const t = ru.review
  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.center}`}>
        <p className={s.kicker}>{t.blockTitle}</p>
        <h2>{t.explainTitle}</h2>
        {t.explain.map((p) => (
          <p key={p} className={s.explainText}>
            {p}
          </p>
        ))}
      </div>
      <div className={s.actions}>
        <button type="button" className={ui.primary} onClick={onOk}>
          {t.ok}
        </button>
      </div>
    </div>
  )
}

export function CardView({ screen, hanziMode, onDone }: Props<'card'>) {
  const settings = useSettings()
  const t = ru.review
  const w = wordById.get(screen.word)!
  const kind = screen.cardKind
  const [intervals, setIntervals] = useState<Record<Grade14, number> | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [hint, setHint] = useState(false)
  const [given, setGiven] = useState<string | null>(null)
  const started = useRef(0)
  const explained = useLiveQuery(async () => ({ v: !!(await db.getMeta('cardsExplained')) }), [])
  useEffect(() => {
    started.current = Date.now()
    void db.cards.get(screen.cardId).then((r: CardRow | undefined) => {
      if (r) setIntervals(previewIntervals(r, Date.now(), settings.desiredRetention))
    })
  }, [screen.cardId, settings.desiredRetention])
  // Вопрос звучит сам там, где он на слух: «на слух» и «тоны». В остальных типах образец — после проверки.
  useAutoplay(kind === 1 || kind === 4 ? screen.word : null, [screen.cardId])

  const finish = async (grade: Grade14) => {
    await answerCard(screen.cardId, grade, Date.now() - started.current, settings.desiredRetention).catch((e) => console.error(e))
    if (kind === 3) await addToday({ spoken: 1 }).catch(() => {})
    onDone({ correct: grade >= 2, spoken: kind === 3 })
  }
  const reveal = () => {
    setRevealed(true)
    if (kind !== 1) void playItem(screen.word).catch(() => {})
  }

  if (!explained) return null
  if (!explained.v) return <FirstTime onOk={() => void db.setMeta('cardsExplained', true)} />

  const showHanzi = hanziMode !== 'never'
  const header = (
    <div className={s.cardHead}>
      <div>
        <p className={s.kicker}>{t.instruction[kind]}</p>
        {kind === 3 && <p className={s.ruBig}>«{wordRu(w)}»</p>}
        <p className={s.stepsLine}>{t.steps[kind]}</p>
      </div>
      <Help title={t.explainTitle} text={t.explain} />
    </div>
  )
  const grades = (
    <div className={s.grades} role="group" aria-label={t.gradeLabel}>
      {GRADES.map((g) => (
        <button key={g} type="button" className={g === 3 ? ui.primary : ui.secondary} data-grade={g} onClick={() => void finish(g)}>
          <span>{t.grades[g]}</span>
          {intervals && <span className={s.gradeTime}>{t.gradeWhen(g, formatWhen(intervals[g]))}</span>}
        </button>
      ))}
    </div>
  )

  // Тип 4: выбрать тоновый рисунок — оценка по ответу.
  if (kind === 4) {
    const right = tonePattern(screen.word)
    return (
      <div className={s.view}>
        <div className={`${s.body} ${s.center}`}>
          {header}
          {showHanzi ? <Hanzi className={s.bigHanzi}>{w.hanzi}</Hanzi> : <span className={s.bigRu}>{meaningOf(w)}</span>}
          {given ? (
            <Pinyin numeric={w.pinyin} className={s.bigPinyin} />
          ) : (
            <span className={s.plainPinyin} lang="zh-Latn-pinyin">
              {w.pinyin.replace(/[1-5]/g, '').split(/\s+/).join('')}
            </span>
          )}
          <PlayButton item={screen.word} label={ru.lesson.listenAgain} />
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
          {given && <p className={s.feedbackLine}>{given === right ? ru.lesson.correct : ru.lesson.youChose(given, right)}</p>}
        </div>
        <div className={s.actions}>
          {given ? (
            <button type="button" className={ui.primary} onClick={() => void finish(given === right ? 3 : 1)}>
              {ru.lesson.next}
            </button>
          ) : (
            <p className={s.disabledHint}>{ru.lesson.chooseFirst}</p>
          )}
        </div>
      </div>
    )
  }

  // Шаг 1: только то, что нужно для вопроса
  const prompt =
    kind === 1 ? (
      <>
        <PlayButton item={screen.word} label={ru.lesson.listenAgain} size="l" />
        {hint ? (
          showHanzi && <Hanzi className={s.bigHanzi}>{w.hanzi}</Hanzi>
        ) : (
          <button type="button" className={`${ui.link} ${s.hintLink}`} onClick={() => setHint(true)}>
            {t.hintHanzi}
          </button>
        )}
      </>
    ) : kind === 3 ? (
      hint ? (
        <Pinyin numeric={w.pinyin} className={s.bigPinyin} />
      ) : (
        <button type="button" className={`${ui.link} ${s.hintLink}`} onClick={() => setHint(true)}>
          {t.hintPinyin}
        </button>
      )
    ) : (
      <div className={s.big}>
        {showHanzi && <Hanzi className={s.bigHanzi}>{w.hanzi}</Hanzi>}
        {kind === 2 && <Pinyin numeric={w.pinyin} className={s.bigPinyin} />}
      </div>
    )

  // Шаг 2: ответ целиком
  const answer = (
    <div className={s.big}>
      {showHanzi && <Hanzi className={s.bigHanzi}>{w.hanzi}</Hanzi>}
      <Pinyin numeric={w.pinyin} className={s.bigPinyin} />
      <span className={s.bigRu}>{wordRu(w)}</span>
      <PlayButton item={screen.word} label={ru.lesson.listenAgain} size="s" />
      {(kind === 2 || kind === 5) && w.mnemonic && (
        <p className={s.mnemonic}>
          <b>{t.mnemonic}.</b> <MixedText text={w.mnemonic} />
        </p>
      )}
      {kind === 3 && <RecordCompare item={screen.word} compact />}
    </div>
  )

  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.center}`}>
        {header}
        {revealed ? answer : prompt}
      </div>
      <div className={s.actions}>
        {revealed ? (
          <>
            <p className={s.question}>{kind === 3 ? t.saidRight : t.recalled}</p>
            {grades}
          </>
        ) : (
          <button type="button" className={ui.primary} onClick={reveal}>
            {t.check}
          </button>
        )}
      </div>
    </div>
  )
}