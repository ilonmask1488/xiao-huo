/* «Игры» — список мини-игр; закрытые говорят, после какого урока откроются. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Screen } from '../../components/ui'
import { lessonById } from '../../content'
import { ru } from '../../i18n/ru'
import { gameAvailable, gameMaterial, UNLOCKED_BY } from '../../lib/games/games'
import { completedLessonIds } from '../../lib/lesson/progress'
import s from './GamesScreen.module.css'

export function GamesScreen() {
  const navigate = useNavigate()
  const material = useLiveQuery(async () => gameMaterial(await completedLessonIds()), [])
  return (
    <Screen title={ru.gamesScreen.title} subtitle={ru.gamesScreen.subtitle} back>
      <ul className={s.gameList}>
        {(['shooter', 'speed', 'pingpong', 'twins', 'assemble'] as const).map((g) => {
          const open = material ? gameAvailable(g, material) : false
          return (
            <li key={g}>
              <button type="button" className={s.game} data-locked={!open || undefined} onClick={() => navigate(`/game/${g}`)}>
                <span className={s.gameTitle}>{ru.games[g].title}</span>
                <span className={s.gameWhat}>{open ? ru.games[g].what : ru.games.lockedShort(lessonById.get(UNLOCKED_BY[g])?.title ?? '')}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Screen>
  )
}
