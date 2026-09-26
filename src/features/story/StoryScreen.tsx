/* «Командировка» (ТЗ §6.3): эпизоды сюжета и персонажи. Маршрут /story. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Hanzi, Pinyin } from '../../components/Chinese'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { content } from '../../content'
import { ru } from '../../i18n/ru'
import { completedLessonIds } from '../../lib/lesson/progress'
import { episodeStates } from '../../lib/story/story'
import s from './StoryScreen.module.css'

export function StoryScreen() {
  const navigate = useNavigate()
  const t = ru.story
  const states = useLiveQuery(async () => episodeStates(await completedLessonIds()), [])
  if (!states) return null
  return (
    <Screen title={t.title} subtitle={t.subtitle} back paper>
      <ol className={s.episodes}>
        {states.map((ep) => (
          <li key={ep.id} className={s.episode} data-open={ep.open || undefined} data-done={ep.done || undefined}>
            <span className={`${s.num} mono`}>{t.episode(ep.n)}</span>
            <h2>{ep.title}</h2>
            <p className={s.blurb}>{ep.blurb}</p>
            <div className={s.foot}>
              <span className={s.status}>{ep.done ? `✓ ${t.done}` : ep.open ? '' : t.after(ep.unlockTitle)}</span>
              <button
                type="button"
                className={ep.open && !ep.done ? ui.primary : ui.secondary}
                onClick={() => navigate(`/lesson/${ep.lessonId}?from=story`)}
              >
                {ep.done ? t.again : t.open}
              </button>
            </div>
          </li>
        ))}
      </ol>
      <p className={s.more}>{t.more}</p>

      <h2 className={s.charsTitle}>{t.characters}</h2>
      <ul className={s.chars}>
        {(content.characters ?? []).map((c) => (
          <li key={c.id} className={s.char}>
            <Hanzi className={s.charHanzi}>{c.hanzi}</Hanzi>
            <Pinyin numeric={c.pinyin} className={s.charPinyin} />
            <span className={s.charRu}>{c.ru}</span>
          </li>
        ))}
      </ul>
    </Screen>
  )
}
