/*
  Плеер «Эхо» (ТЗ §5.5): фраза → автопауза «время фразы × 1,2» → следующая.
  Скорость 0.75 / 1.0, повтор фразы, переключатели иероглифов / пиньиня / перевода, «только звук»,
  запись своей попытки: образец → я → образец.
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Hanzi, Pinyin } from '../../components/Chinese'
import { RecordCompare } from '../../components/RecordCompare'
import { Screen, Segmented } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { characterById, isPunct, sentenceById } from '../../content'
import { ru } from '../../i18n/ru'
import { durationOf, playItem, preloadItems, stopAudio, wait } from '../../lib/audio/audio'
import { autopauseMs, echoTracks, type EchoLine, type EchoTrack } from '../../lib/echo/tracks'
import { completedLessonIds } from '../../lib/lesson/progress'
import { useSettings } from '../../lib/settings/settings'
import { voiceFor } from '../../lib/story/story'
import s from './EchoScreen.module.css'

export function EchoScreen() {
  const { id } = useParams()
  const tracks = useLiveQuery(async () => echoTracks(await completedLessonIds()), [])
  if (!tracks) return null
  const track = id ? tracks.find((t) => t.id === id) : undefined
  if (track) return <EchoPlayer key={track.id} track={track} />
  return <EchoList tracks={tracks} />
}

function EchoList({ tracks }: { tracks: EchoTrack[] }) {
  const t = ru.echo
  const learned = tracks.filter((x) => x.learned)
  const ahead = tracks.filter((x) => !x.learned)
  return (
    <Screen title={t.title} subtitle={t.subtitle} back paper>
      <h2 className={s.groupTitle}>{t.learned}</h2>
      {learned.length ? <TrackList tracks={learned} /> : <p className={s.note}>{t.empty}</p>}
      {ahead.length > 0 && (
        <details className={s.ahead} open={!learned.length || undefined}>
          <summary>
            {t.ahead} <span className="mono">· {ahead.length}</span>
          </summary>
          <p className={s.note}>{t.aheadHint}</p>
          <TrackList tracks={ahead} />
        </details>
      )}
    </Screen>
  )
}

function TrackList({ tracks }: { tracks: EchoTrack[] }) {
  const navigate = useNavigate()
  return (
    <ul className={s.tracks}>
      {tracks.map((tr) => (
        <li key={tr.id}>
          <button type="button" className={s.track} data-kind={tr.kind} onClick={() => navigate(`/echo/${tr.id}`)}>
            <span className={`${s.trackLabel} mono`}>{tr.kind === 'episode' ? ru.story.episode(Number(tr.label)) : tr.label}</span>
            <span className={s.trackTitle}>{tr.title}</span>
            <span className={s.trackMeta}>
              {ru.echo.kind[tr.kind]} · {ru.echo.lines(tr.lines.length)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

type Prefs = { rate: 0.75 | 1; hanzi: boolean; pinyin: boolean; ru: boolean; audioOnly: boolean }
const DEFAULT_PREFS: Prefs = { rate: 1, hanzi: true, pinyin: true, ru: true, audioOnly: false }
const PREFS_KEY = 'xh-echo-prefs'

/** Переключатели — удобство одного устройства, поэтому localStorage (может быть недоступен). */
function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}
function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* приватный режим — просто не запоминаем */
  }
}

function EchoPlayer({ track }: { track: EchoTrack }) {
  const t = ru.echo
  const navigate = useNavigate()
  const settings = useSettings()
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  /** длительность текущей автопаузы — пока идёт «твоя очередь» */
  const [turn, setTurn] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const [prefs, setPrefsState] = useState(loadPrefs)
  const token = useRef(0)
  const listRef = useRef<HTMLOListElement>(null)
  const lines = track.lines
  const current = lines[index]!

  const setPrefs = (p: Partial<Prefs>) =>
    setPrefsState((old) => {
      const next = { ...old, ...p }
      savePrefs(next)
      return next
    })

  const voiceOf = (line: EchoLine) => (line.speaker ? voiceFor(line.speaker, settings.voice) : undefined)

  useEffect(() => {
    preloadItems(lines.map((l) => l.sentenceId))
    return () => {
      token.current++
      stopAudio()
    }
  }, [lines])

  useEffect(() => {
    listRef.current?.querySelector('[data-current]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [index])

  const halt = () => {
    token.current++
    stopAudio()
    setPlaying(false)
    setTurn(null)
  }

  /** Автовоспроизведение с фразы from до конца дорожки. */
  const run = async (from: number) => {
    const my = ++token.current
    setPlaying(true)
    setFinished(false)
    for (let i = from; i < lines.length; i++) {
      if (my !== token.current) return
      const line = lines[i]!
      setIndex(i)
      setTurn(null)
      try {
        await playItem(line.sentenceId, { voice: voiceOf(line), rate: prefs.rate })
      } catch {
        if (my === token.current) halt()
        return
      }
      if (my !== token.current) return
      const pause = autopauseMs(durationOf(line.sentenceId, voiceOf(line)), prefs.rate)
      setTurn(pause)
      await wait(pause)
    }
    if (my !== token.current) return
    setTurn(null)
    setPlaying(false)
    setFinished(true)
  }

  /** Одна фраза без автопродолжения. */
  const playOnce = async (i: number) => {
    const my = ++token.current
    setIndex(i)
    setTurn(null)
    setFinished(false)
    const line = lines[i]!
    await playItem(line.sentenceId, { voice: voiceOf(line), rate: prefs.rate }).catch(() => {})
    if (my === token.current) setPlaying(false)
  }

  const go = (i: number) => {
    const target = Math.max(0, Math.min(lines.length - 1, i))
    if (playing) void run(target)
    else void playOnce(target)
  }

  const textHidden = prefs.audioOnly

  return (
    <Screen title={track.title} subtitle={`${ru.echo.kind[track.kind]} · ${ru.echo.lines(lines.length)}`} back paper>
      <div className={s.player} data-playing={playing || undefined}>
        <div className={s.options}>
          <Segmented
            label={t.speed}
            value={prefs.rate}
            options={[
              { value: 0.75, label: '0.75×' },
              { value: 1, label: '1.0×' },
            ]}
            onChange={(rate) => {
              setPrefs({ rate })
              if (playing) halt()
            }}
          />
          <div className={s.toggles} role="group" aria-label={t.show}>
            {(['hanzi', 'pinyin', 'ru'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={s.toggle}
                aria-pressed={prefs[k]}
                disabled={textHidden}
                onClick={() => setPrefs({ [k]: !prefs[k] })}
              >
                {k === 'ru' ? t.translation : t[k]}
              </button>
            ))}
            <button type="button" className={s.toggle} aria-pressed={prefs.audioOnly} onClick={() => setPrefs({ audioOnly: !prefs.audioOnly })}>
              {t.audioOnly}
            </button>
          </div>
        </div>

        {textHidden ? (
          <div className={s.audioOnly} aria-live="polite">
            <span className={`${s.bigCount} mono`}>{t.position(index + 1, lines.length)}</span>
            {current.speaker && <SpeakerTag speaker={current.speaker} />}
            <p className={s.note}>{t.audioOnlyHint}</p>
          </div>
        ) : (
          <ol className={s.lines} ref={listRef}>
            {lines.map((line, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={s.line}
                  data-current={i === index || undefined}
                  data-me={line.speaker === 'me' || undefined}
                  onClick={() => go(i)}
                >
                  {line.speaker && <SpeakerTag speaker={line.speaker} />}
                  <LineText id={line.sentenceId} prefs={prefs} />
                </button>
              </li>
            ))}
          </ol>
        )}

        <button type="button" className={ui.link} onClick={() => navigate('/echo')}>
          {t.back}
        </button>

        <div className={s.dock}>
          <div className={s.turn} aria-live="polite">
            {turn !== null ? (
              <>
                <span>{t.yourTurn}</span>
                <span className={s.turnBar}>
                  <span key={`${index}:${turn}`} className={s.turnFill} style={{ animationDuration: `${turn}ms` }} />
                </span>
              </>
            ) : finished ? (
              <span>{t.finished}</span>
            ) : (
              <span className="mono">{t.position(index + 1, lines.length)}</span>
            )}
          </div>

          <div className={s.controls}>
            <button type="button" className={ui.iconButton} aria-label={t.prev} onClick={() => go(index - 1)} disabled={index === 0}>
              <IconPrev />
            </button>
            <button type="button" className={ui.iconButton} aria-label={t.repeat} onClick={() => go(index)}>
              <IconRepeat />
            </button>
            <button
              type="button"
              className={`${ui.primary} ${s.playBtn}`}
              aria-label={playing ? t.pause : t.play}
              data-testid="echo-play"
              onClick={() => (playing ? halt() : void run(finished ? 0 : index))}
            >
              {playing ? <IconPause /> : <IconPlay />}
              <span>{playing ? t.pause : t.play}</span>
            </button>
            <button
              type="button"
              className={ui.iconButton}
              aria-label={t.next}
              onClick={() => go(index + 1)}
              disabled={index === lines.length - 1}
            >
              <IconNext />
            </button>
          </div>

          <RecordCompare item={current.sentenceId} voice={voiceOf(current)} rate={prefs.rate} compact onBusy={halt} />
        </div>
      </div>
    </Screen>
  )
}

function SpeakerTag({ speaker }: { speaker: string }) {
  const c = characterById.get(speaker)
  if (speaker === 'me') return <span className={s.speaker}>{ru.dialogue.me}</span>
  return <span className={s.speaker}>{c ? <Hanzi>{c.hanzi}</Hanzi> : speaker}</span>
}

function LineText({ id, prefs }: { id: string; prefs: Prefs }) {
  const sen = sentenceById.get(id)
  if (!sen) return null
  return (
    <span className={s.text}>
      {(prefs.hanzi || prefs.pinyin) && (
        <span className={s.tokens}>
          {sen.tokens.map((tok, i) =>
            isPunct(tok) ? (
              prefs.hanzi && (
                <span key={i} className={s.punct} lang="zh-CN">
                  {tok.hanzi}
                </span>
              )
            ) : (
              <span key={i} className={s.token}>
                {prefs.hanzi && <Hanzi className={s.tokenHanzi}>{tok.hanzi}</Hanzi>}
                {prefs.pinyin && <Pinyin numeric={tok.pinyin} className={s.tokenPinyin} />}
              </span>
            ),
          )}
        </span>
      )}
      {prefs.ru && <span className={s.ru}>{sen.ru}</span>}
    </span>
  )
}

const svg = { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
function IconPlay() {
  return (
    <svg {...svg}>
      <path d="M7 5l12 7-12 7z" fill="currentColor" />
    </svg>
  )
}
function IconPause() {
  return (
    <svg {...svg}>
      <path d="M8 5v14M16 5v14" strokeWidth={3} />
    </svg>
  )
}
function IconPrev() {
  return (
    <svg {...svg}>
      <path d="M6 5v14M19 5l-10 7 10 7z" />
    </svg>
  )
}
function IconNext() {
  return (
    <svg {...svg}>
      <path d="M18 5v14M5 5l10 7-10 7z" />
    </svg>
  )
}
function IconRepeat() {
  return (
    <svg {...svg}>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5" />
    </svg>
  )
}
