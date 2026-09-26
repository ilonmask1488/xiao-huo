/*
  Анимация пуска ракеты — единственная «яркая» анимация приложения (итог ступени).
  При prefers-reduced-motion ракета просто стоит с праздничным лицом. Касание закрывает.
*/
import { useEffect } from 'react'
import { sfx } from '../lib/audio/sfx'
import s from './LaunchAnimation.module.css'
import { Mascot } from './Mascot'

export function LaunchAnimation({ title, onDone }: { title: string; onDone: () => void }) {
  useEffect(() => {
    sfx('launch')
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className={s.overlay} role="dialog" aria-label={title} onClick={onDone}>
      <div className={s.stars} aria-hidden />
      <div className={s.rocket}>
        <Mascot mood="celebrate" size={120} />
        <span className={s.smoke} aria-hidden />
      </div>
      <p className={s.title}>{title}</p>
    </div>
  )
}
