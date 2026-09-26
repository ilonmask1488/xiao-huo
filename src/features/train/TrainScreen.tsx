/* «Тренировка» (UX §2.4): свободная практика по желанию — разделы с подписью «что это и зачем». */
import { Link } from 'react-router-dom'
import { IconChevron } from '../../components/Icons'
import { Screen } from '../../components/ui'
import { ru } from '../../i18n/ru'
import s from './TrainScreen.module.css'

const ITEMS = [
  { key: 'tones', to: '/tones' },
  { key: 'games', to: '/games' },
  { key: 'echo', to: '/echo' },
  { key: 'story', to: '/story' },
  { key: 'heatmap', to: '/tones#heatmap' },
] as const

export function TrainScreen() {
  const t = ru.train
  return (
    <Screen title={t.title} subtitle={t.subtitle}>
      <ul className={s.list}>
        {ITEMS.map((it) => (
          <li key={it.key}>
            <Link to={it.to} className={s.item}>
              <span>
                <span className={s.itemTitle}>{t.items[it.key].title}</span>
                <span className={s.itemWhat}>{t.items[it.key].what}</span>
              </span>
              <IconChevron />
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  )
}
