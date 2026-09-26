import { useEffect, useState, type ReactNode } from 'react'
import type { Item } from '../content/types'
import { playItem, stopAudio } from '../lib/audio/audio'
import type { Voice } from '../lib/audio/manifest'
import s from './Play.module.css'

export function IconSpeaker({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  )
}

/** Круглая кнопка «послушать». Во время звучания подсвечена. */
export function PlayButton({
  item,
  voice,
  label,
  size = 'm',
  onPlayed,
}: {
  item: Item
  voice?: Voice
  label: string
  size?: 's' | 'm' | 'l'
  onPlayed?: () => void
}) {
  const [playing, setPlaying] = useState(false)
  useEffect(() => () => stopAudio(), [])
  return (
    <button
      type="button"
      className={`${s.play} ${s[size]}`}
      data-playing={playing || undefined}
      aria-label={label}
      onClick={() => {
        setPlaying(true)
        playItem(item, { voice })
          .catch(() => {})
          .finally(() => {
            setPlaying(false)
            onPlayed?.()
          })
      }}
    >
      <IconSpeaker size={size === 'l' ? 30 : size === 's' ? 18 : 22} />
    </button>
  )
}

/** Кнопка-«чип», которая играет звук: слог, иероглиф, подпись. */
export function PlayChip({ item, children, active, label }: { item: Item; children: ReactNode; active?: boolean; label?: string }) {
  const [playing, setPlaying] = useState(false)
  return (
    <button
      type="button"
      className={s.chip}
      data-playing={playing || active || undefined}
      aria-label={label}
      onClick={() => {
        setPlaying(true)
        playItem(item)
          .catch(() => {})
          .finally(() => setPlaying(false))
      }}
    >
      {children}
    </button>
  )
}
