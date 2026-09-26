/* Кнопка «?» на экране упражнения (UX §1.7): короткое объяснение «как работает это упражнение». */
import { useState } from 'react'
import { ru } from '../i18n/ru'
import s from './Help.module.css'
import ui from './ui.module.css'

export function Help({ title, text }: { title: string; text: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={s.btn} aria-label={ru.help.label} aria-expanded={open} onClick={() => setOpen(true)}>
        ?
      </button>
      {open && (
        <div className={s.scrim} role="dialog" aria-modal="true" aria-label={title} onClick={() => setOpen(false)}>
          <div className={s.panel} onClick={(e) => e.stopPropagation()}>
            <h2>{title}</h2>
            {text.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <button type="button" className={ui.primary} onClick={() => setOpen(false)}>
              {ru.help.ok}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
