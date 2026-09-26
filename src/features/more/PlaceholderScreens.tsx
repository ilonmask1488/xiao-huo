import { useLiveQuery } from 'dexie-react-hooks'
import { Placeholder, Screen } from '../../components/ui'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import { ACHIEVEMENT_IDS } from '../../lib/progress/achievements'
import { computeStreak, localDate } from '../../lib/progress/streak'
import s from './MoreScreen.module.css'

/** Статистика фазы 1: дни на орбите, минуты, Δv, достижения. Графики — в фазе 2. */
export function StatsScreen() {
  const t = ru.stats
  const data = useLiveQuery(async () => {
    const days = await db.days.toArray()
    const streak = computeStreak(new Map(days.map((d) => [d.date, d.seconds])), localDate())
    const got = new Map((await db.achievements.toArray()).map((a) => [a.id, a.unlockedAt]))
    return {
      streak,
      minutes: Math.round(days.reduce((a, d) => a + d.seconds, 0) / 60),
      dv: days.reduce((a, d) => a + d.dv, 0),
      spoken: days.reduce((a, d) => a + d.spokenCount, 0),
      got,
    }
  })
  if (!data) return null
  return (
    <Screen title={t.title} back>
      <dl className={s.licenses}>
        <div>
          <dt>{t.orbit}</dt>
          <dd className="mono">
            {data.streak.days}
            {data.streak.reserveUsed ? ` · ${t.reserveUsed}` : ''}
          </dd>
        </div>
        <div>
          <dt>{t.minutes}</dt>
          <dd className="mono">{data.minutes}</dd>
        </div>
        <div>
          <dt>{t.dv}</dt>
          <dd className="mono">{data.dv} м/с</dd>
        </div>
        <div>
          <dt>{t.spoken}</dt>
          <dd className="mono">{data.spoken}</dd>
        </div>
      </dl>
      <p className={s.note}>{t.orbitRule}</p>
      <h2 style={{ margin: 'var(--space-5) 0 var(--space-3)' }}>{ru.achievements.title}</h2>
      <ul className={s.achievements}>
        {ACHIEVEMENT_IDS.map((id) => {
          const a = ru.achievements.list[id]!
          const at = data.got.get(id)
          return (
            <li key={id} data-got={at ? true : undefined}>
              <span className={s.itemTitle}>{at ? a.name : `${a.name}`}</span>
              <span className={s.itemWhat}>
                {a.what}
                {at ? ` · ${new Date(at).toLocaleDateString('ru-RU')}` : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </Screen>
  )
}

export function EchoScreen() {
  const t = ru.placeholder.echo
  return (
    <Screen title={t.title} back>
      <Placeholder mood="wink" text={t.text} />
    </Screen>
  )
}

export function StoryScreen() {
  const t = ru.placeholder.story
  return (
    <Screen title={t.title} back>
      <Placeholder mood="happy" text={t.text} />
    </Screen>
  )
}
