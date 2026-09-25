import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppDB } from '../db/db'
import { DEFAULT_SETTINGS, loadSettings, updateSettings } from './settings'

let d: AppDB
beforeEach(() => {
  d = new AppDB('test-settings')
})
afterEach(async () => {
  d.close()
  await Dexie.delete(d.name)
})

describe('настройки', () => {
  it('без записи в базе — значения по умолчанию', async () => {
    expect(await loadSettings(d)).toEqual(DEFAULT_SETTINGS)
  })

  it('изменения накладываются частично и сохраняются', async () => {
    await updateSettings({ theme: 'dark' }, d)
    await updateSettings({ sessionMinutes: 20 }, d)
    expect(await loadSettings(d)).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark', sessionMinutes: 20 })
  })

  it('по умолчанию: 40 минут, целевое удержание 0.9, цвета тонов включены', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ sessionMinutes: 40, desiredRetention: 0.9, toneColors: true })
  })
})
