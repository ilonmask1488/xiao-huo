import { Link } from 'react-router-dom'
import { Placeholder, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { ru } from '../../i18n/ru'

export function SessionScreen() {
  const t = ru.placeholder.session
  return (
    <Screen title={t.title} back paper>
      <Placeholder text={t.text} />
      <p style={{ textAlign: 'center', marginTop: 'var(--space-5)' }}>
        <Link to="/tones" className={ui.secondary} style={{ textDecoration: 'none' }}>
          {ru.tones.title}
        </Link>
      </p>
    </Screen>
  )
}
