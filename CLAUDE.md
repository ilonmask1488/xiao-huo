# 小火 · Сяо Хо — PWA для разговорного китайского

- ТЗ: `docs/SPEC.md`. Работаем по фазам (§16); фаза считается готовой, когда зелёные `npm test`, `npm run check:content`, `npm run e2e`, `npm run build`, обновлён README и сняты скриншоты `docs/screens/phaseN/` (Playwright, не панель браузера — она даёт артефакты при прокрутке в эмуляции).
- Стек: Vite 8 + React 19 + TypeScript 6 (strict), CSS-модули + токены в `src/styles/tokens.css`, Dexie 4, vite-plugin-pwa, HashRouter.
- Все тексты интерфейса — в `src/i18n/ru.ts`. Иероглифы — только через `<Hanzi>` (lang="zh-CN"), пиньинь — через `<Pinyin numeric="ni3 hao3">`; в данных пиньинь с цифрами, ü = v.
- База: только JSON-совместимые значения (время — число мс). Схема в `src/lib/db/schema.ts`: старые версии не правим, добавляем новую + фикстуру в `migrations.test.ts` + `migrateBackup`.
- Весь сгенерированный китайский контент — `reviewed: false`, прогон через `check:content`. Лицензии и версии библиотек проверять, не выдумывать.
- Dev-сервер для панели браузера: `npx vite --host 127.0.0.1 --port 5173` (на `localhost` Vite слушает только ::1, панель туда не достаёт).
