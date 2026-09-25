import { useState } from 'react'
import { Hanzi } from '../../components/Chinese'
import { Screen } from '../../components/ui'
import { ru } from '../../i18n/ru'
import s from './DictionaryScreen.module.css'

export function DictionaryScreen() {
  const t = ru.dictionary
  const [query, setQuery] = useState('')
  return (
    <Screen title={t.title}>
      <label className={s.search}>
        <span className="visually-hidden">{t.search}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </label>
      <div className={s.filters}>
        {t.filters.map((f) => (
          <button key={f} type="button" className={s.chip} disabled>
            {f}
          </button>
        ))}
      </div>
      <div className={s.empty}>
        <Hanzi className={s.emptyGlyph}>字</Hanzi>
        <p>{t.empty}</p>
      </div>
    </Screen>
  )
}
