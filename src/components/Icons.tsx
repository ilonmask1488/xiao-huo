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

export function IconMap({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5" strokeDasharray="2.2 2.2" />
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

export function IconMore({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <path d="M4 7h16M4 12h16M4 17h10" />
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
