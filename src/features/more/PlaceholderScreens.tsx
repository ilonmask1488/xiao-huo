import { Placeholder, Screen } from '../../components/ui'
import { ru } from '../../i18n/ru'

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
