/*
  Мини-игры: «Тон-тир», «Пинг-понг пар», «Близнецы». Маршрут /game/:id[?focus=…&from=launch].
  Общее: 60 секунд, очки ×2 после 5 верных подряд и ×3 после 10, ошибка сбрасывает комбо, но не заканчивает игру.
*/
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Hanzi, Pinyin } from '../../components/Chinese'
import { IconClose } from '../../components/Icons'
import { Mascot } from '../../components/Mascot'
import { PlayButton } from '../../components/Play'
import { ToneGlyph } from '../../components/ToneChart'
import { Placeholder, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { isPunct, lessonById, sentenceById, wordById } from '../../content'
import { ru } from '../../i18n/ru'
import { playItem, preloadItems, stopAudio } from '../../lib/audio/audio'
import { sfx } from '../../lib/audio/sfx'
import { db } from '../../lib/db/db'
import {
  gameAvailable,
  gameMaterial,
  gameRandom,
  pairWeightFor,
  ASSEMBLE_SECONDS,
  ROUND_SECONDS,
  saveRecord,
  shooterDelay,
  shooterTimeLimit,
  UNLOCKED_BY,
  weightedPick,
  type GameId,
  type GameMaterial,
  type Twin,
} from '../../lib/games/games'
import { classifySwipe, type Point } from '../../lib/games/swipe'
import { finishSegment } from '../../lib/launch/launch'
import { assembleOrder, meaningOptions, pairOf, pairOptions } from '../../lib/lesson/build'
import { completedLessonIds } from '../../lib/lesson/progress'
import type { Tone } from '../../lib/pinyin/marks'
import { markSyllable } from '../../lib/pinyin/marks'
import { evaluateAchievements, type AchievementId } from '../../lib/progress/achievements'
import { comboMultiplier, dvForGame } from '../../lib/progress/dv'
import { pairWeights } from '../../lib/progress/heatmap'
import { addToday, recordAnswer } from '../../lib/progress/record'
import { meaningOf } from '../../lib/words'
import { SentenceLine } from '../lesson/phrases'
import s from './games.module.css'

type Question =
  | { kind: 'shooter'; syl: string; tone: Tone; choices: Tone[] }
  | { kind: 'pingpong'; word: string; pair: string; options: string[] }
  | { kind: 'twins'; twin: Twin; options: string[] }
  | { kind: 'speed'; word: string; mode: 'text' | 'audio'; options: string[] }
  | { kind: 'assemble'; id: string; order: number[] }

type RoundResult = {
  score: number
  correct: number
  wrong: number
  maxStreak: number
  comboBonus: number
  misses: Record<string, number>
  seconds: number
}

const GAME_IDS: GameId[] = ['shooter', 'pingpong', 'twins', 'speed', 'assemble']

/** Маршрут /game/:id — при смене игры экран создаётся заново (иначе остались бы итоги прошлой). */
export function GameRoute() {
  const id = useParams().id ?? 'shooter'
  return <GameScreen key={id} />
}

export function GameScreen() {
  const id = (useParams().id ?? 'shooter') as GameId
  const [params, setParams] = useSearchParams()
  const focus = params.get('focus')
  // Длина раунда: 60 с; параметр seconds — для автотестов.
  const baseSeconds = id === 'assemble' ? ASSEMBLE_SECONDS : ROUND_SECONDS
  const roundSeconds = Math.min(baseSeconds, Math.max(5, Number(params.get('seconds')) || baseSeconds))
  const fromLaunch = params.get('from') === 'launch'
  const navigate = useNavigate()
  const [data, setData] = useState<{ m: GameMaterial; weights: Map<string, number>; best: number } | null>(null)
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [result, setResult] = useState<{ r: RoundResult; best: number; weekBest: number; isBest: boolean; fresh: AchievementId[]; dv: number } | null>(null)

  useEffect(() => {
    void (async () => {
      const m = gameMaterial(await completedLessonIds())
      const weights = pairWeights(await db.toneStats.toArray())
      const best = (await db.gameRecords.get(id))?.best ?? 0
      setData({ m, weights, best })
    })()
  }, [id, phase])

  if (!GAME_IDS.includes(id)) return null
  const t = ru.games[id]
  const back = () => navigate(fromLaunch ? '/session' : '/tones')
  if (!data) return null

  if (!gameAvailable(id, data.m)) {
    const lesson = lessonById.get(UNLOCKED_BY[id])
    return (
      <Screen title={t.title} back>
        <Placeholder mood="thinking" text={ru.games.locked(lesson?.title ?? '')} />
        {lesson && (
          <p style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
            <button type="button" className={ui.primary} onClick={() => navigate(`/lesson/${lesson.id}`)}>
              {ru.games.toLesson}
            </button>
          </p>
        )}
      </Screen>
    )
  }

  if (phase === 'intro') {
    return (
      <div className={s.wrap}>
        <div className={s.intro}>
          <Mascot mood="wink" size={88} />
          <h1>{t.title}</h1>
          <p>{t.what}</p>
          <p className={s.rules}>{id === 'shooter' ? ru.games.shooterRules : id === 'assemble' ? ru.games.assembleRules : ru.games.rules}</p>
          {focus && <p className={s.focus}>{ru.games.focus(id === 'shooter' ? ru.lesson.toneName(Number(focus)) + ' тон' : pairLabel(focus))}</p>}
          <p className="mono">{ru.games.best(data.best)}</p>
        </div>
        <div className={s.actions}>
          <button type="button" className={ui.primary} onClick={() => setPhase('play')}>
            {ru.games.start}
          </button>
          <button type="button" className={ui.link} onClick={back}>
            {ru.placeholder.back}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'play') {
    return (
      <Round
        id={id}
        material={data.m}
        weights={data.weights}
        focus={focus}
        seconds={roundSeconds}
        onExit={back}
        onEnd={async (r) => {
          const rec = await saveRecord(id, r.score)
          const dv = dvForGame({ seconds: r.seconds, correct: r.correct, wrong: r.wrong, comboBonus: r.comboBonus })
          await addToday({ seconds: r.seconds, dv })
          if (fromLaunch) await finishSegment(params.get('seg') ?? 'warmup', { seconds: r.seconds, dv, correct: r.correct, total: r.correct + r.wrong })
          const fresh = await evaluateAchievements()
          setResult({ r, ...rec, fresh, dv })
          setPhase('end')
        }}
      />
    )
  }

  // Итоги раунда
  const r = result!.r
  const hardest = Object.entries(r.misses).sort((a, b) => b[1] - a[1])[0]?.[0]
  return (
    <div className={s.wrap}>
      <div className={s.intro}>
        <Mascot mood={result!.isBest ? 'celebrate' : r.correct >= r.wrong ? 'happy' : 'thinking'} size={88} />
        <h1>{ru.games.over}</h1>
        <p className={s.bigScore}>{r.score}</p>
        <p className="mono">
          {ru.games.best(result!.best)} · {ru.games.weekBest(result!.weekBest)}
        </p>
        {result!.isBest && <p className={s.badge}>{ru.games.newRecord}</p>}
        <p>{ru.games.stats(r.correct, r.wrong, r.maxStreak, result!.dv)}</p>
        {hardest && (
          <div className={s.hardest}>
            <span>{id === 'shooter' ? ru.games.hardestTone(ru.lesson.toneName(Number(hardest))) : id === 'pingpong' ? ru.games.hardestPair(pairLabel(hardest)) : ru.games.hardestTwin(hardest)}</span>
            {id !== 'twins' && (
              <button
                type="button"
                className={ui.secondary}
                onClick={() => {
                  setParams((p) => {
                    p.set('focus', hardest)
                    return p
                  })
                  setPhase('intro')
                }}
              >
                {ru.games.trainIt}
              </button>
            )}
          </div>
        )}
        {result!.fresh.map((a) => (
          <p key={a} className={s.badge}>
            {ru.lesson.summary.achievement}: {ru.achievements.list[a]?.name}
          </p>
        ))}
      </div>
      <div className={s.actions}>
        <button type="button" className={ui.primary} onClick={fromLaunch ? back : () => setPhase('intro')}>
          {fromLaunch ? ru.lesson.summary.toLaunch : ru.games.again}
        </button>
        {!fromLaunch && (
          <button type="button" className={ui.link} onClick={back}>
            {ru.games.done}
          </button>
        )}
      </div>
    </div>
  )
}

function pairLabel(pair: string): string {
  return `${ru.lesson.toneShort(Number(pair[0]))} + ${ru.lesson.toneShort(Number(pair[1]))}`
}

/* ——— Раунд ——— */

function Round({
  id,
  material,
  weights,
  focus,
  seconds,
  onExit,
  onEnd,
}: {
  id: GameId
  material: GameMaterial
  weights: Map<string, number>
  focus: string | null
  seconds: number
  onExit: () => void
  onEnd: (r: RoundResult) => Promise<void>
}) {
  const ROUND = seconds
  const random = useMemo(() => gameRandom(), [])
  const [left, setLeft] = useState(ROUND)
  const [q, setQ] = useState<Question | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; given: string } | null>(null)
  const stats = useRef<RoundResult>({ score: 0, correct: 0, wrong: 0, maxStreak: 0, comboBonus: 0, misses: {}, seconds: 0 })
  const [streak, setStreak] = useState(0)
  const [score, setScore] = useState(0)
  const ended = useRef(false)
  const last = useRef<string | undefined>(undefined)

  const nextQuestion = (): Question => {
    if (id === 'shooter') {
      const { syllables, tones } = material.shooter
      const syl = weightedPick(syllables, (x) => (focus && x.endsWith(focus) ? 4 : 1), random, last.current)
      last.current = syl
      return { kind: 'shooter', syl, tone: markSyllable(syl).tone, choices: tones }
    }
    if (id === 'pingpong') {
      const word = weightedPick(material.pingpong.words, (w) => pairWeightFor(w, weights, focus), random, last.current)
      last.current = word
      return { kind: 'pingpong', word, pair: pairOf(word), options: pairOptions(word, Math.floor(random() * 1e6)) }
    }
    if (id === 'speed') {
      const word = weightedPick(material.speed.words, () => 1, random, last.current)
      last.current = word
      return { kind: 'speed', word, mode: random() < 0.5 ? 'text' : 'audio', options: meaningOptions(word, Math.floor(random() * 1e6)) }
    }
    if (id === 'assemble') {
      const sid = weightedPick(material.assemble.sentences, () => 1, random, last.current)
      last.current = sid
      return { kind: 'assemble', id: sid, order: assembleOrder(sid, Math.floor(random() * 1e6)) }
    }
    const pairs = material.twins.pairs
    const twin = weightedPick(pairs, () => 1, random, pairs.find((p) => p.answer === last.current))
    const answer = random() < 0.5 ? twin.answer : twin.options.find((o) => o !== twin.answer)!
    last.current = answer
    return { kind: 'twins', twin: { ...twin, answer }, options: twin.options }
  }

  // Таймер раунда
  useEffect(() => {
    const started = Date.now()
    const t = setInterval(() => {
      const l = ROUND - Math.floor((Date.now() - started) / 1000)
      setLeft(Math.max(0, l))
      if (l <= 0 && !ended.current) {
        ended.current = true
        stats.current.seconds = ROUND
        stopAudio()
        void onEnd(stats.current)
      }
    }, 250)
    setQ(nextQuestion())
    return () => {
      clearInterval(t)
      stopAudio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Звук вопроса + предзагрузка возможных следующих
  useEffect(() => {
    if (!q) return
    const item = q.kind === 'shooter' ? q.syl : q.kind === 'pingpong' ? q.word : q.kind === 'twins' ? q.twin.answer : q.kind === 'speed' ? q.word : null
    if (item && (q.kind !== 'speed' || q.mode === 'audio')) void playItem(item).catch(() => {})
    if (q.kind === 'shooter') preloadItems(material.shooter.syllables.slice(0, 8))
    if (q.kind === 'pingpong') preloadItems(material.pingpong.words.slice(0, 6))
  }, [q, material])

  const answer = (given: string) => {
    if (!q || feedback || ended.current) return
    const expected =
      q.kind === 'shooter'
        ? String(q.tone)
        : q.kind === 'pingpong'
          ? q.pair
          : q.kind === 'twins'
            ? q.twin.answer
            : q.kind === 'speed'
              ? q.word
              : `ok:${q.order.length}`
    const ok = given === expected
    const st = stats.current
    if (ok) {
      const newStreak = streak + 1
      const mult = comboMultiplier(newStreak)
      st.correct++
      st.score += (q.kind === 'assemble' ? 5 * Number(given.split(':')[1] ?? 2) : 10) * mult
      st.comboBonus += mult - 1
      st.maxStreak = Math.max(st.maxStreak, newStreak)
      setStreak(newStreak)
      sfx(newStreak === 5 || newStreak === 10 ? 'combo' : 'correct')
    } else {
      st.wrong++
      st.misses[expected] = (st.misses[expected] ?? 0) + 1
      setStreak(0)
      sfx('wrong')
    }
    setScore(st.score)
    setFeedback({ ok, given })
    if (q.kind === 'assemble') {
      void recordAnswer({ kind: 'order', source: 'game', game: id, item: q.id, expected: 'ok', given, correct: ok }).catch(() => {})
      return // следующая фраза — после «Сказал» (повторить вслух)
    }
    if (q.kind === 'speed') {
      void recordAnswer({ kind: 'meaning', source: 'game', game: id, item: q.word, expected, given, correct: ok }).catch(() => {})
      if (q.mode === 'text') void playItem(q.word).catch(() => {})
    } else void recordAnswer(
      q.kind === 'shooter'
        ? { kind: 'tone', source: 'game', game: id, item: q.syl, expected, given, correct: ok, skill: 'tone' }
        : q.kind === 'pingpong'
          ? { kind: 'pair', source: 'game', game: id, item: q.word, expected, given, correct: ok, skill: 'pair' }
          : { kind: 'syllable', source: 'game', game: id, item: q.twin.answer, expected, given, correct: ok, skill: q.twin.skill, contrast: q.twin.contrast },
    ).catch(() => {})
    scheduleNext(q.kind === 'shooter' ? shooterDelay(ok ? streak + 1 : 0) : ok ? 500 : 1100, ok)
  }

  const scheduleNext = (delay: number, ok: boolean) => {
    setTimeout(() => {
      if (ended.current) return
      setFeedback(null)
      setQ(nextQuestion())
    }, delay + (ok ? 0 : 500))
  }

  const mult = comboMultiplier(streak)
  return (
    <div className={s.wrap}>
      <div className={s.hud}>
        <button type="button" className={s.close} onClick={onExit} aria-label={ru.games.exit}>
          <IconClose size={24} />
        </button>
        <span className={`${s.timer} mono`} aria-label={ru.games.secondsLeft(left)}>
          {left}
        </span>
        <span className={`${s.score} mono`} aria-live="polite">
          {score}
        </span>
        <span className={s.combo} data-mult={mult}>
          {mult > 1 ? `×${mult}` : streak > 0 ? `${streak}` : ''}
        </span>
      </div>
      <div className={s.timeBar}>
        <div className={s.timeFill} style={{ width: `${(left / ROUND) * 100}%` }} />
      </div>
      {q?.kind === 'shooter' && <Shooter key={q.syl + stats.current.correct + stats.current.wrong} q={q} feedback={feedback} streak={streak} onAnswer={answer} />}
      {q?.kind === 'pingpong' && <PingPong key={q.word + stats.current.correct + stats.current.wrong} q={q} feedback={feedback} onAnswer={answer} />}
      {q?.kind === 'twins' && <Twins key={q.twin.answer + stats.current.correct + stats.current.wrong} q={q} feedback={feedback} onAnswer={answer} />}
      {q?.kind === 'speed' && <Speed key={q.word + stats.current.correct + stats.current.wrong} q={q} feedback={feedback} onAnswer={answer} />}
      {q?.kind === 'assemble' && (
        <AssembleGame
          key={q.id + stats.current.correct + stats.current.wrong}
          q={q}
          feedback={feedback}
          onAnswer={answer}
          onNext={() => scheduleNext(0, true)}
        />
      )}
    </div>
  )
}

/* ——— Скорострел ——— */

function Speed({
  q,
  feedback,
  onAnswer,
}: {
  q: Extract<Question, { kind: 'speed' }>
  feedback: { ok: boolean; given: string } | null
  onAnswer: (given: string) => void
}) {
  const w = wordById.get(q.word)!
  return (
    <div className={s.play}>
      <p className={s.contrast}>{q.mode === 'text' ? ru.games.speedPromptText : ru.games.speedPromptAudio}</p>
      {q.mode === 'text' || feedback ? (
        <div className={s.reveal}>
          <Hanzi className={s.revealHanzi}>{w.hanzi}</Hanzi>
          <Pinyin numeric={w.pinyin} />
        </div>
      ) : (
        <PlayButton item={q.word} label={ru.lesson.listenAgain} size="l" />
      )}
      <div className={s.speedOptions}>
        {q.options.map((id) => {
          const o = wordById.get(id)!
          return (
            <button
              key={id}
              type="button"
              className={s.option}
              data-state={feedback ? (id === q.word ? 'right' : feedback.given === id ? 'wrong' : undefined) : undefined}
              disabled={!!feedback}
              onClick={() => onAnswer(id)}
            >
              {q.mode === 'text' ? (
                <span className={s.speedRu}>{meaningOf(o)}</span>
              ) : (
                <>
                  <Hanzi className={s.revealHanzi}>{o.hanzi}</Hanzi>
                  <span className={s.optionLabel}>{meaningOf(o)}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ——— Сборка ——— */

function AssembleGame({
  q,
  feedback,
  onAnswer,
  onNext,
}: {
  q: Extract<Question, { kind: 'assemble' }>
  feedback: { ok: boolean; given: string } | null
  onAnswer: (given: string) => void
  onNext: () => void
}) {
  const sen = sentenceById.get(q.id)!
  const right = sen.tokens.map((_, i) => i).filter((i) => !isPunct(sen.tokens[i]!))
  const [placed, setPlaced] = useState<number[]>([])
  useEffect(() => {
    if (placed.length !== right.length || feedback) return
    const ok = placed.every((i, k) => sen.tokens[i]!.hanzi === sen.tokens[right[k]!]!.hanzi)
    onAnswer(`${ok ? 'ok' : 'bad'}:${right.length}`)
    void playItem(q.id).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed])
  const chip = (i: number, onClick?: () => void) => (
    <button key={i} type="button" className={s.wordChip} onClick={onClick} disabled={!onClick}>
      <Hanzi className={s.wordChipHanzi}>{sen.tokens[i]!.hanzi}</Hanzi>
      <Pinyin numeric={sen.tokens[i]!.pinyin} className={s.optionLabel} />
    </button>
  )
  return (
    <div className={s.play}>
      <p className={s.assembleRu}>{sen.ru}</p>
      <div className={s.assembleLine} data-state={feedback ? (feedback.ok ? 'right' : 'wrong') : undefined}>
        {placed.map((i) => chip(i, feedback ? undefined : () => setPlaced((p) => p.filter((x) => x !== i))))}
      </div>
      {feedback ? (
        <div className={s.hardest}>
          {!feedback.ok && <SentenceLine sentence={sen} />}
          <span>{ru.lesson.nowRepeat}</span>
          <PlayButton item={q.id} label={ru.lesson.listenAgain} />
          <button type="button" className={ui.primary} onClick={onNext}>
            {ru.lesson.saidIt}
          </button>
        </div>
      ) : (
        <div className={s.assemblePool}>{q.order.filter((i) => !placed.includes(i)).map((i) => chip(i, () => setPlaced((p) => [...p, i])))}</div>
      )}
    </div>
  )
}

/* ——— Тон-тир ——— */

function Shooter({
  q,
  feedback,
  streak,
  onAnswer,
}: {
  q: Extract<Question, { kind: 'shooter' }>
  feedback: { ok: boolean; given: string } | null
  streak: number
  onAnswer: (given: string) => void
}) {
  const points = useRef<Point[]>([])
  const [trail, setTrail] = useState<Point[]>([])
  const limit = shooterTimeLimit(streak)
  useEffect(() => {
    const t = setTimeout(() => onAnswer('timeout'), limit + 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const toneChoices = q.choices
  return (
    <div className={s.play}>
      <div className={s.limit}>
        <div className={s.limitFill} style={{ animationDuration: `${limit}ms` }} />
      </div>
      <div
        className={s.pad}
        data-feedback={feedback ? (feedback.ok ? 'ok' : 'bad') : undefined}
        role="application"
        aria-label={ru.games.padLabel}
        onPointerDown={(e) => {
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          const r = e.currentTarget.getBoundingClientRect()
          points.current = [{ x: e.clientX - r.left, y: e.clientY - r.top }]
          setTrail(points.current)
        }}
        onPointerMove={(e) => {
          if (!points.current.length) return
          const r = e.currentTarget.getBoundingClientRect()
          points.current.push({ x: e.clientX - r.left, y: e.clientY - r.top })
          setTrail([...points.current])
        }}
        onPointerUp={() => {
          const tone = classifySwipe(points.current)
          points.current = []
          setTrail([])
          if (tone && toneChoices.includes(tone)) onAnswer(String(tone))
        }}
      >
        <svg className={s.trail} aria-hidden>
          <polyline points={trail.map((p) => `${p.x},${p.y}`).join(' ')} />
        </svg>
        {feedback ? (
          <div className={s.padFeedback}>
            <Pinyin numeric={q.syl} className={s.padPinyin} />
            {!feedback.ok && <span>{ru.games.was(ru.lesson.toneName(q.tone))}</span>}
          </div>
        ) : (
          <span className={s.padHint}>{ru.games.swipeHint}</span>
        )}
      </div>
      <div className={s.toneButtons} role="group" aria-label={ru.lesson.guessTone}>
        {toneChoices.map((t) => (
          <button
            key={t}
            type="button"
            className={s.toneBtn}
            aria-label={`${ru.lesson.toneName(t)} тон`}
            data-state={feedback ? (String(t) === String(q.tone) ? 'right' : feedback.given === String(t) ? 'wrong' : undefined) : undefined}
            onClick={() => onAnswer(String(t))}
          >
            <ToneGlyph tone={t} size={30} />
          </button>
        ))}
      </div>
      <PlayButton item={q.syl} label={ru.lesson.listenAgain} size="s" />
    </div>
  )
}

/* ——— Пинг-понг пар ——— */

function PingPong({
  q,
  feedback,
  onAnswer,
}: {
  q: Extract<Question, { kind: 'pingpong' }>
  feedback: { ok: boolean; given: string } | null
  onAnswer: (given: string) => void
}) {
  const w = wordById.get(q.word)!
  return (
    <div className={s.play}>
      <PlayButton item={q.word} label={ru.lesson.listenAgain} size="l" />
      <div className={s.reveal}>
        {feedback && (
          <>
            <Hanzi className={s.revealHanzi}>{w.hanzi}</Hanzi>
            <Pinyin numeric={w.pinyin} />
          </>
        )}
      </div>
      <div className={s.options}>
        {q.options.map((o) => (
          <button
            key={o}
            type="button"
            className={s.option}
            aria-label={`${ru.lesson.toneName(Number(o[0]))} и ${ru.lesson.toneName(Number(o[1]))}`}
            data-state={feedback ? (o === q.pair ? 'right' : feedback.given === o ? 'wrong' : undefined) : undefined}
            disabled={!!feedback}
            onClick={() => onAnswer(o)}
          >
            <span style={{ display: 'flex', gap: 4 }}>
              <ToneGlyph tone={Number(o[0]) as Tone} size={28} />
              <ToneGlyph tone={Number(o[1]) as Tone} size={28} />
            </span>
            <span className={s.optionLabel}>{pairLabel(o)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ——— Близнецы ——— */

function Twins({
  q,
  feedback,
  onAnswer,
}: {
  q: Extract<Question, { kind: 'twins' }>
  feedback: { ok: boolean; given: string } | null
  onAnswer: (given: string) => void
}) {
  return (
    <div className={s.play}>
      <PlayButton item={q.twin.answer} label={ru.lesson.listenAgain} size="l" />
      <p className={s.contrast}>{q.twin.contrast}</p>
      <div className={s.options}>
        {q.options.map((o) => (
          <button
            key={o}
            type="button"
            className={s.option}
            data-state={feedback ? (o === q.twin.answer ? 'right' : feedback.given === o ? 'wrong' : undefined) : undefined}
            disabled={!!feedback}
            onClick={() => onAnswer(o)}
          >
            <Pinyin numeric={o} className={s.twinPinyin} />
          </button>
        ))}
      </div>
    </div>
  )
}
