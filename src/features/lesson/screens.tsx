/*
  Экраны урока. Каждый экран сам ведёт своё состояние и по завершении вызывает onDone(result).
  Звук образца стартует сам при появлении экрана; кнопки «ещё раз» — всегда рядом.
*/
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Hanzi, MixedText, Pinyin } from '../../components/Chinese'
import { Mascot } from '../../components/Mascot'
import { PlayButton, PlayChip } from '../../components/Play'
import { ToneChart, ToneGlyph } from '../../components/ToneChart'
import { Link } from 'react-router-dom'
import { RecordCompare } from '../../components/RecordCompare'
import ui from '../../components/ui.module.css'
import { WordTap } from '../../components/WordSheet'
import { sentenceById, wordById } from '../../content'
import type { Item, WordId } from '../../content/types'
import { ru } from '../../i18n/ru'
import { durationOf, playItem, playSeries, stopAudio, voicesOf, wait } from '../../lib/audio/audio'
import { hasAudio, isWordItem, type Voice } from '../../lib/audio/manifest'
import { sfx } from '../../lib/audio/sfx'
import type { AnswerRow, HanziMode } from '../../lib/db/types'
import type { Screen } from '../../lib/lesson/build'
import { pairOf } from '../../lib/lesson/build'
import { markSyllable, toMarked, type Tone } from '../../lib/pinyin/marks'
import { applySandhi, spokenMarked } from '../../lib/pinyin/sandhi'
import { wordRu } from '../../lib/words'
import { ExerciseHead } from './ExerciseHead'
import s from './lesson.module.css'
import { LineView, ReplyView } from './dialogue'
import { AssembleView, CardView, MeaningView, SayItView, SentenceLine, SentenceView } from './phrases'

export type ScreenResult = {
  correct?: boolean
  spoken?: boolean
  answer?: Omit<AnswerRow, 'id' | 'at' | 'source' | 'lessonId' | 'game'>
}

type Props<K extends Screen['kind']> = {
  screen: Extract<Screen, { kind: K }>
  hanziMode: HanziMode
  onDone: (r: ScreenResult) => void
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function Actions({ children }: { children: ReactNode }) {
  return <div className={s.actions}>{children}</div>
}

function NextButton({ onClick, label = ru.lesson.next }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className={ui.primary} onClick={onClick}>
      {label}
    </button>
  )
}

/** Автовоспроизведение при появлении экрана. */
function useAutoplay(play: () => Promise<unknown>, deps: unknown[] = []) {
  useEffect(() => {
    const t = setTimeout(() => void play().catch(() => {}), 250)
    return () => {
      clearTimeout(t)
      stopAudio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/* ——— Отображение слога или слова ——— */

function ItemView({ item, showHanzi, showRu = true }: { item: Item; showHanzi: boolean; showRu?: boolean }) {
  if (item.startsWith('s-')) {
    const sen = sentenceById.get(item)
    if (!sen) return null
    return (
      <div className={s.big}>
        <SentenceLine sentence={sen} hanziMode={showHanzi ? 'always' : 'never'} big tappable />
        {showRu && <span className={s.bigRu}>{sen.ru}</span>}
      </div>
    )
  }
  if (isWordItem(item)) {
    const w = wordById.get(item)
    if (!w) return null
    return (
      <div className={s.big}>
        <WordTap id={item}>
          {showHanzi && <Hanzi className={s.bigHanzi}>{w.hanzi}</Hanzi>}
          <Pinyin numeric={w.pinyin} className={s.bigPinyin} />
        </WordTap>
        {showRu && <span className={s.bigRu}>{wordRu(w)}</span>}
      </div>
    )
  }
  return (
    <div className={s.big}>
      <Pinyin numeric={item} className={s.bigPinyin} />
    </div>
  )
}

function sylText(syl: string): string {
  return markSyllable(syl).text
}

/* ——— Объяснение ——— */

export function ExplainView({ screen, onDone }: Props<'explain'>) {
  const p = screen.part
  return (
    <div className={s.view}>
      <div className={s.body}>
        <div className={s.explainHead}>
          <h1>{p.title}</h1>
          {p.mascot && <Mascot mood={p.mascot} size={56} />}
        </div>
        {p.chart && (
          <div className={s.chart}>
            <ToneChart tones={p.chart} />
          </div>
        )}
        <div className={s.paragraphs}>
          {p.body.map((t, i) => (
            <p key={i}>
              <MixedText text={t} />
            </p>
          ))}
        </div>
        {p.examples && (
          <div className={s.examples}>
            {p.examples.map((e) => (
              <PlayChip key={e.syl} item={e.syl} label={`Послушать ${sylText(e.syl)}`}>
                <Pinyin numeric={e.syl} className={s.exPinyin} />
                {e.hanzi && <Hanzi className={s.exHanzi}>{e.hanzi}</Hanzi>}
                {e.ru && <span className={s.exRu}>{e.ru}</span>}
              </PlayChip>
            ))}
          </div>
        )}
        {p.words && (
          <div className={s.words}>
            {p.words.map((id) => (
              <WordLine key={id} id={id} showSandhi={p.sandhi?.includes(id)} />
            ))}
          </div>
        )}
        {p.sentences && (
          <div className={s.words}>
            {p.sentences.map((id) => {
              const sen = sentenceById.get(id)
              if (!sen) return null
              return (
                <div key={id} className={s.word} style={{ gridTemplateColumns: '1fr auto' }}>
                  <div>
                    <SentenceLine sentence={sen} tappable />
                    <span className={s.wordRu}>{sen.ru}</span>
                  </div>
                  <PlayButton item={id} label={ru.lesson.listenAgain} size="s" />
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Actions>
        <NextButton onClick={() => onDone({})} />
      </Actions>
    </div>
  )
}

/** Строка слова: иероглифы, пиньинь, «как звучит», перевод, звук в разных голосах. */
export function WordLine({ id, showSandhi, href }: { id: WordId; showSandhi?: boolean; /** ссылка на карточку слова (словарь) */ href?: string }) {
  const w = wordById.get(id)
  const [voice, setVoice] = useState<Voice | undefined>(undefined)
  if (!w) return null
  const sandhi = applySandhi(w.pinyin, w.hanzi)
  const voices = voicesOf(id)
  return (
    <div className={s.word}>
      {href ? (
        <Link to={href} className={s.wordLink} aria-label={ru.dictionary.open(w.hanzi)}>
          <Hanzi className={s.wordHanzi}>{w.hanzi}</Hanzi>
        </Link>
      ) : (
        <Hanzi className={s.wordHanzi}>{w.hanzi}</Hanzi>
      )}
      <div>
        <Pinyin numeric={w.pinyin} className={s.wordPinyin} />
        {(showSandhi || sandhi.applied.length > 0) && sandhi.applied.length > 0 && (
          <span className={s.sandhi}>
            {ru.lesson.sandhiSpoken} <b>{spokenMarked(w.pinyin, w.hanzi)}</b> ·{' '}
            {[...new Set(sandhi.applied.map((a) => ru.lesson.sandhiRule[a.rule]))].join(', ')}
          </span>
        )}
        <span className={s.wordRu}>{wordRu(w)}</span>
        {voices.length > 1 && (
          <span className={s.voices}>
            {voices.map((v) => (
              <button
                key={v}
                type="button"
                className={s.voiceBtn}
                aria-pressed={voice === v}
                onClick={() => {
                  setVoice(v)
                  void playItem(id, { voice: v }).catch(() => {})
                }}
              >
                {ru.lesson.voices[v]}
              </button>
            ))}
          </span>
        )}
      </div>
      <PlayButton item={id} voice={voice} label={`Послушать ${w.hanzi}`} />
    </div>
  )
}

/* ——— Послушай ——— */

export function ListenView({ screen, onDone }: Props<'listen'>) {
  const [active, setActive] = useState(-1)
  const [plays, setPlays] = useState(0)
  useAutoplay(() => playSeries(screen.series, 400, setActive), [plays])
  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.center}`}>
        <ExerciseHead kind="listen" title={screen.title} />
        <div className={s.series}>
          {screen.series.map((item, i) => (
            <PlayChip key={item + i} item={item} active={active === i}>
              {item.startsWith('s-') ? (
                <>
                  <Hanzi className={s.exHanzi}>{sentenceById.get(item)?.tokens.map((t) => t.hanzi).join('') ?? ''}</Hanzi>
                  <span className={s.exRu}>{sentenceById.get(item)?.ru}</span>
                </>
              ) : isWordItem(item) ? (
                <>
                  <Hanzi className={s.exHanzi}>{wordById.get(item)?.hanzi ?? ''}</Hanzi>
                  <Pinyin numeric={wordById.get(item)?.pinyin ?? ''} className={s.exPinyinSmall} />
                  <span className={s.exRu}>{wordRu(wordById.get(item) ?? { ru: [] })}</span>
                </>
              ) : (
                <Pinyin numeric={item} className={s.exPinyin} />
              )}
            </PlayChip>
          ))}
        </div>
        <button type="button" className={ui.secondary} onClick={() => setPlays((n) => n + 1)}>
          {ru.lesson.listenSeries}
        </button>
      </div>
      <Actions>
        <NextButton onClick={() => onDone({})} />
      </Actions>
    </div>
  )
}

/* ——— Повтори вслух: образец → пауза «твоя очередь» → образец → самооценка ——— */

type RepeatPhase = 'sample' | 'turn' | 'compare' | 'assess'

export function RepeatView({ screen, hanziMode, onDone }: Props<'repeat'>) {
  const [phase, setPhase] = useState<RepeatPhase>('sample')
  const [run, setRun] = useState(0)
  const [meh, setMeh] = useState(false)
  const turnMs = Math.max(1200, durationOf(screen.item) * 1.5)
  useEffect(() => {
    let alive = true
    ;(async () => {
      setPhase('sample')
      await wait(250)
      await playItem(screen.item).catch(() => {})
      if (!alive) return
      setPhase('turn')
      await wait(turnMs)
      if (!alive) return
      setPhase('compare')
      await playItem(screen.item).catch(() => {})
      if (alive) setPhase('assess')
    })()
    return () => {
      alive = false
      stopAudio()
    }
  }, [run, screen.item, turnMs])

  const showHanzi = hanziMode === 'always' || (hanziMode === 'after' && (phase === 'compare' || phase === 'assess'))
  const done = (good: boolean) =>
    onDone({ spoken: true, answer: { kind: 'self', item: screen.item, expected: 'ok', given: good ? 'ok' : 'meh', correct: good } })

  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.center}`}>
        <ExerciseHead kind="repeat" />
        <ItemView item={screen.item} showHanzi={showHanzi} />
        <p className={s.phase} aria-live="polite">
          {phase === 'sample' && ru.lesson.listenFirst}
          {phase === 'turn' && ru.lesson.yourTurn}
          {phase === 'compare' && ru.lesson.compare}
          {phase === 'assess' && ru.lesson.selfCheck}
        </p>
        {phase === 'turn' && (
          <div className={s.turnBar}>
            <div key={run} className={s.turnFill} style={{ animationDuration: `${turnMs}ms` }} />
          </div>
        )}
        {meh && <p className={s.feedbackLine}>{ru.lesson.notReallyHint}</p>}
        {phase === 'assess' && <RecordCompare item={screen.item} compact />}
      </div>
      <Actions>
        {phase === 'assess' ? (
          <>
            <div className={s.row}>
              <button type="button" className={ui.secondary} onClick={() => (meh ? done(false) : (setMeh(true), setRun((n) => n + 1)))}>
                {meh ? ru.lesson.next : ru.lesson.notReally}
              </button>
              <button type="button" className={ui.primary} onClick={() => done(true)}>
                {ru.lesson.good}
              </button>
            </div>
          </>
        ) : (
          <button type="button" className={ui.secondary} onClick={() => setRun((n) => n + 1)}>
            {ru.lesson.again}
          </button>
        )}
      </Actions>
    </div>
  )
}

/* ——— Прочитай: сначала сам, потом образец ——— */

export function ReadView({ screen, hanziMode, onDone }: Props<'read'>) {
  const [checked, setChecked] = useState(false)
  const [ruHint, setRuHint] = useState(false)
  const showHanzi = hanziMode === 'always' || (hanziMode === 'after' && checked)
  const done = (good: boolean) =>
    onDone({ spoken: true, answer: { kind: 'self', item: screen.item, expected: 'ok', given: good ? 'ok' : 'meh', correct: good } })
  useEffect(() => () => stopAudio(), [])
  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.center}`}>
        <ExerciseHead kind="read" />
        <ItemView item={screen.item} showHanzi={showHanzi} showRu={checked || ruHint} />
        <p className={s.phase}>{checked ? ru.lesson.selfCheck : ru.lesson.readHint}</p>
        {!checked && !ruHint && (
          <button type="button" className={`${ui.link} ${s.hintLink}`} onClick={() => setRuHint(true)}>
            {ru.lesson.translationHint}
          </button>
        )}
        {checked && <PlayButton item={screen.item} label={ru.lesson.listenAgain} size="m" />}
      </div>
      <Actions>
        {checked ? (
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
              setChecked(true)
              void playItem(screen.item).catch(() => {})
            }}
          >
            {ru.lesson.check}
          </button>
        )}
      </Actions>
    </div>
  )
}

/* ——— Общая логика вопросов ——— */

function Feedback({ correct, text, children }: { correct: boolean; text: string; children?: ReactNode }) {
  const [line] = useState(() => pick(correct ? ru.lines.correct : ru.lines.wrong))
  return (
    <div className={s.feedback} data-kind={correct ? 'right' : 'wrong'} role="status">
      <span className={s.feedbackTitle}>{text}</span>
      {children}
      <span className={s.feedbackLine}>{line}</span>
    </div>
  )
}

function useAnswer<T>(right: T) {
  const [given, setGiven] = useState<T | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const choose = (v: T) => {
    if (given !== null) return false
    setGiven(v)
    const ok = v === right
    sfx(ok ? 'correct' : 'wrong')
    return ok
  }
  const state = (v: T): 'right' | 'wrong' | 'dim' | undefined => {
    if (given === null) return undefined
    if (v === right) return 'right'
    if (v === given) return 'wrong'
    return 'dim'
  }
  return { given, choose, state, answered: given !== null, correct: given === right }
}

/* ——— Угадай тон ——— */

export function GuessToneView({ screen, onDone }: Props<'guessTone'>) {
  const right = markSyllable(screen.syl).tone
  const base = screen.syl.slice(0, -1)
  const a = useAnswer<Tone>(right)
  useAutoplay(() => playItem(screen.syl), [screen.syl])
  const finish = () =>
    onDone({
      correct: a.correct,
      answer: { kind: 'tone', item: screen.syl, expected: String(right), given: String(a.given), correct: a.correct, skill: 'tone' },
    })
  const alt = a.given !== null && a.given !== right ? `${base}${a.given}` : null
  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.center}`}>
        <ExerciseHead kind="guessTone" />
        <PlayButton item={screen.syl} label={ru.lesson.listenAgain} size="l" />
        {a.answered && <Pinyin numeric={screen.syl} className={s.bigPinyin} />}
        <div className={s.choices} role="group" aria-label={ru.lesson.guessTone}>
          {screen.choices.map((t) => (
            <button
              key={t}
              type="button"
              className={s.choice}
              data-state={a.state(t)}
              disabled={a.answered}
              aria-label={`${ru.lesson.toneName(t)} тон`}
              onClick={() => a.choose(t)}
            >
              <ToneGlyph tone={t} size={44} />
              <span className={s.choiceLabel}>{ru.lesson.toneShort(t)}</span>
            </button>
          ))}
        </div>
        {a.answered &&
          (a.correct ? (
            <Feedback correct text={ru.lesson.correct} />
          ) : (
            <Feedback correct={false} text={ru.lesson.youChoseTone(a.given!, right)}>
              <span className={s.feedbackLine}>{ru.lesson.listenBoth}</span>
              <div className={s.both}>
                {alt && hasAudio(alt) && (
                  <PlayChip item={alt}>
                    <Pinyin numeric={alt} className={s.exPinyin} />
                  </PlayChip>
                )}
                <PlayChip item={screen.syl}>
                  <Pinyin numeric={screen.syl} className={s.exPinyin} />
                </PlayChip>
              </div>
            </Feedback>
          ))}
      </div>
      <Actions>{a.answered && <NextButton onClick={finish} />}</Actions>
    </div>
  )
}

/* ——— Какой слог? ——— */

export function WhichSyllableView({ screen, onDone }: Props<'whichSyllable'>) {
  const a = useAnswer<string>(screen.answer)
  useAutoplay(() => playItem(screen.answer), [screen.answer])
  const finish = () =>
    onDone({
      correct: a.correct,
      answer: {
        kind: 'syllable',
        item: screen.answer,
        expected: screen.answer,
        given: a.given ?? '',
        correct: a.correct,
        skill: screen.contrast.skill,
        contrast: screen.contrast.label,
      },
    })
  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.center}`}>
        <ExerciseHead kind="whichSyllable" />
        <PlayButton item={screen.answer} label={ru.lesson.listenAgain} size="l" />
        <div className={s.choices}>
          {screen.options.map((o) => (
            <button key={o} type="button" className={s.choice} data-state={a.state(o)} disabled={a.answered} onClick={() => a.choose(o)}>
              <Pinyin numeric={o} />
            </button>
          ))}
        </div>
        {a.answered &&
          (a.correct ? (
            <Feedback correct text={ru.lesson.correct} />
          ) : (
            <Feedback correct={false} text={ru.lesson.youChose(sylText(a.given!), sylText(screen.answer))}>
              <div className={s.both}>
                <PlayChip item={a.given!}>
                  <Pinyin numeric={a.given!} className={s.exPinyin} />
                </PlayChip>
                <PlayChip item={screen.answer}>
                  <Pinyin numeric={screen.answer} className={s.exPinyin} />
                </PlayChip>
              </div>
            </Feedback>
          ))}
      </div>
      <Actions>{a.answered && <NextButton onClick={finish} />}</Actions>
    </div>
  )
}

/* ——— Какие тоны в слове? ——— */

export function PairChoice({ pair }: { pair: string }) {
  const [x, y] = [Number(pair[0]) as Tone, Number(pair[1]) as Tone]
  return (
    <>
      <span style={{ display: 'flex', gap: 4 }}>
        <ToneGlyph tone={x} size={32} />
        <ToneGlyph tone={y} size={32} />
      </span>
      <span className={s.choiceLabel}>
        {ru.lesson.toneShort(x)} + {ru.lesson.toneShort(y)}
      </span>
    </>
  )
}

export function GuessPairView({ screen, hanziMode, onDone }: Props<'guessPair'>) {
  const right = pairOf(screen.word)
  const w = wordById.get(screen.word)!
  const a = useAnswer<string>(right)
  useAutoplay(() => playItem(screen.word), [screen.word])
  const finish = () =>
    onDone({
      correct: a.correct,
      answer: { kind: 'pair', item: screen.word, expected: right, given: a.given ?? '', correct: a.correct, skill: 'pair' },
    })
  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.center}`}>
        <ExerciseHead kind="guessPair" />
        <PlayButton item={screen.word} label={ru.lesson.listenAgain} size="l" />
        {a.answered && (
          <div className={s.big}>
            {hanziMode !== 'never' && <Hanzi className={s.exHanzi}>{w.hanzi}</Hanzi>}
            <Pinyin numeric={w.pinyin} className={s.wordPinyin} />
            <span className={s.bigRu}>{wordRu(w)}</span>
          </div>
        )}
        <div className={s.choices}>
          {screen.options.map((o) => (
            <button
              key={o}
              type="button"
              className={s.choice}
              data-state={a.state(o)}
              disabled={a.answered}
              aria-label={`${ru.lesson.toneName(Number(o[0]))} и ${ru.lesson.toneName(Number(o[1]))}`}
              onClick={() => a.choose(o)}
            >
              <PairChoice pair={o} />
            </button>
          ))}
        </div>
        {a.answered && (
          <Feedback
            correct={a.correct}
            text={
              a.correct
                ? ru.lesson.correct
                : ru.lesson.youChose(
                    `${ru.lesson.toneShort(Number(a.given![0]))}+${ru.lesson.toneShort(Number(a.given![1]))}`,
                    `${ru.lesson.toneShort(Number(right[0]))}+${ru.lesson.toneShort(Number(right[1]))} (${toMarked(w.pinyin)})`,
                  )
            }
          />
        )}
      </div>
      <Actions>{a.answered && <NextButton onClick={finish} />}</Actions>
    </div>
  )
}

export function ScreenView(props: { screen: Screen; hanziMode: HanziMode; onDone: (r: ScreenResult) => void }) {
  const { screen } = props
  switch (screen.kind) {
    case 'explain':
      return <ExplainView {...props} screen={screen} />
    case 'listen':
      return <ListenView {...props} screen={screen} />
    case 'repeat':
      return <RepeatView {...props} screen={screen} />
    case 'read':
      return <ReadView {...props} screen={screen} />
    case 'guessTone':
      return <GuessToneView {...props} screen={screen} />
    case 'whichSyllable':
      return <WhichSyllableView {...props} screen={screen} />
    case 'guessPair':
      return <GuessPairView {...props} screen={screen} />
    case 'meaning':
      return <MeaningView {...props} screen={screen} />
    case 'sentence':
      return <SentenceView {...props} screen={screen} />
    case 'assemble':
      return <AssembleView {...props} screen={screen} />
    case 'sayIt':
      return <SayItView {...props} screen={screen} />
    case 'card':
      return <CardView {...props} screen={screen} />
    case 'line':
      return <LineView {...props} screen={screen} />
    case 'reply':
      return <ReplyView {...props} screen={screen} />
  }
}
