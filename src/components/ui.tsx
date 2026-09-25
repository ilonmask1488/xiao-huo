import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ru } from '../i18n/ru'
import { IconBack, IconClose } from './Icons'
import { Mascot, type MascotMood } from './Mascot'
import s from './ui.module.css'

type ScreenProps = {
  title: string
  subtitle?: ReactNode
  back?: boolean
  paper?: boolean
  children?: ReactNode
  headerExtra?: ReactNode
}

export function Screen({ title, subtitle, back, paper, children, headerExtra }: ScreenProps) {
  const navigate = useNavigate()
  return (
    <main className={`${s.screen} ${paper ? 'graph-paper' : ''}`}>
      <header className={s.header}>
        {back && (
          <button type="button" className={s.backButton} onClick={() => navigate(-1)} aria-label={ru.placeholder.back}>
            <IconBack />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <h1>{title}</h1>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
        {headerExtra}
      </header>
      {children}
    </main>
  )
}

export function Banner({
  children,
  action,
  onAction,
  onClose,
}: {
  children: ReactNode
  action?: string
  onAction?: () => void
  onClose?: () => void
}) {
  return (
    <div className={s.banner} role="status">
      <p>{children}</p>
      {action && onAction && (
        <button type="button" className={s.link} onClick={onAction}>
          {action}
        </button>
      )}
      {onClose && (
        <button type="button" className={s.iconButton} onClick={onClose} aria-label={ru.banners.close}>
          <IconClose />
        </button>
      )}
    </div>
  )
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className={s.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={s.segment}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint?: ReactNode
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={s.switchRow}
      onClick={() => onChange(!checked)}
    >
      <span className={s.switchText}>
        {label}
        {hint && <span className={s.switchHint}>{hint}</span>}
      </span>
      <span className={s.switchTrack} />
    </button>
  )
}

export function Placeholder({ mood = 'thinking', text }: { mood?: MascotMood; text: string }) {
  return (
    <div className={s.placeholder}>
      <Mascot mood={mood} size={88} />
      <p>{text}</p>
    </div>
  )
}
