/* Иконки навигации — линейные, в духе чертежа. */

type P = { size?: number }

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** «Сегодня» — лист календаря с отметкой дня. */
export function IconToday({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="m9 14.5 2 2 4-4" />
    </svg>
  )
}

/** «Курс» — путь от точки к точке. */
export function IconCourse({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5" strokeDasharray="2.2 2.2" />
    </svg>
  )
}

/** «Тренировка» — мишень. */
export function IconTrain({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
    </svg>
  )
}

/** Ракета — маскот и пуск. */
export function IconLaunch({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <path d="M12 2.5c3 2.5 4.2 6 4.2 9.5v4.5H7.8V12c0-3.5 1.2-7 4.2-9.5Z" />
      <path d="M7.8 13.5 5 17v2.5l2.8-1.5M16.2 13.5 19 17v2.5l-2.8-1.5" />
      <path d="M10.5 19.5 12 22l1.5-2.5" />
      <circle cx="12" cy="9.5" r="1.6" />
    </svg>
  )
}

export function IconTones({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <path d="M3 5h4" />
      <path d="M9 11l3-5" />
      <path d="M14 7l1.5 4 2-3" />
      <path d="M19 6l2 6" />
      <path d="M3 20h18" strokeWidth="1" />
      <path d="M3 16h18" strokeWidth="1" strokeDasharray="1 2.5" />
    </svg>
  )
}

export function IconDictionary({ size = 24 }: P) {
  // 字 — «иероглиф, знак»
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <text
        x="12"
        y="19"
        textAnchor="middle"
        fontSize="19"
        fill="currentColor"
        lang="zh-CN"
        style={{ fontFamily: 'var(--font-hanzi)' }}
      >
        字
      </text>
    </svg>
  )
}

/** «Профиль» — человек. */
export function IconProfile({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
    </svg>
  )
}

export function IconChevron({ size = 20 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

export function IconClose({ size = 20 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function IconBack({ size = 22 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <path d="m15 5-7 7 7 7" />
    </svg>
  )
}
