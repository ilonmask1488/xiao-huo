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
import { lessonById, wordById } from '../../content'
import { ru } from '../../i18n/ru'
import { playItem, preloadItems, stopAudio } from '../../lib/audio/audio'
import { sfx } from '../../lib/audio/sfx'
import { db } from '../../lib/db/db'
import {
  gameAvailable,
  gameMaterial,
  gameRandom,
  pairWeightFor,
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
import { finishBlock } from '../../lib/launch/launch'
import { pairOf, pairOptions } from '../../lib/lesson/build'
import { completedLessonIds } from '../../lib/lesson/progress'
import type { Tone } from '../../lib/pinyin/marks'
import { markSyllable } from '../../lib/pinyin/marks'
import { evaluateAchievements, type AchievementId } from '../../lib/progress/achievements'
import { comboMultiplier, dvForGame } from '../../lib/progress/dv'
import { pairWeights } from '../../lib/progress/heatmap'
import { addToday, recordAnswer } from '../../lib/progress/record'
import s from './games.module.css'

type Question =
  | { kind: 'shooter'; syl: string; tone: Tone; choices: Tone[] }
  | { kind: 'pingpong'; word: string; pair: string; options: string[] }
  | { kind: 'twins'; twin: Twin; options: string[] }

type RoundResult = {
  score: number
  correct: number
  wrong: number
  maxStreak: number
  comboBonus: number
  misses: Record<string, number>
  seconds: number
}

const GAME_IDS: GameId[] = ['shooter', 'pingpong', 'twins']

export function GameScreen() {
  const id = (useParams().id ?? 'shooter') as GameId
  const [params, setParams] = useSearchParams()
  const focus = params.get('focus')
  // Длина раунда: 60 с; параметр seconds — для автотестов.
  const roundSeconds = Math.min(ROUND_SECONDS, Math.max(5, Number(params.get('seconds')) || ROUND_SECONDS))
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
          <p className={s.rules}>{id === 'shooter' ? ru.games.shooterRules : ru.games.rules}</p>
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
          if (fromLaunch) await finishBlock('warmup', { seconds: r.seconds, dv, correct: r.correct, total: r.correct + r.wrong })
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
    const item = q.kind === 'shooter' ? q.syl : q.kind === 'pingpong' ? q.word : q.twin.answer
    void playItem(item).catch(() => {})
    if (q.kind === 'shooter') preloadItems(material.shooter.syllables.slice(0, 8))
    if (q.kind === 'pingpong') preloadItems(material.pingpong.words.slice(0, 6))
  }, [q, material])

  const answer = (given: string) => {
    if (!q || feedback || ended.current) return
    const expected = q.kind === 'shooter' ? String(q.tone) : q.kind === 'pingpong' ? q.pair : q.twin.answer
    const ok = given === expected
    const st = stats.current
    if (ok) {
      const newStreak = streak + 1
      const mult = comboMultiplier(newStreak)
      st.correct++
      st.score += 10 * mult
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
    void recordAnswer(
      q.kind === 'shooter'
        ? { kind: 'tone', source: 'game', game: id, item: q.syl, expected, given, correct: ok, skill: 'tone' }
        : q.kind === 'pingpong'
          ? { kind: 'pair', source: 'game', game: id, item: q.word, expected, given, correct: ok, skill: 'pair' }
          : { kind: 'syllable', source: 'game', game: id, item: q.twin.answer, expected, given, correct: ok, skill: q.twin.skill, contrast: q.twin.contrast },
    ).catch(() => {})
    const delay = q.kind === 'shooter' ? shooterDelay(ok ? streak + 1 : 0) : ok ? 500 : 1100
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
