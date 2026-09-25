/*
  小火 (xiǎo huǒ, «Огонёк») — маленькая ракета, собственный рисунок.
  Состояния: радуется, думает, подмигивает, «ой», празднует.
*/

export type MascotMood = 'happy' | 'thinking' | 'wink' | 'oops' | 'celebrate'

type Props = { mood?: MascotMood; size?: number; className?: string; title?: string }

export function Mascot({ mood = 'happy', size = 96, className, title }: Props) {
  return (
    <svg
      viewBox="0 0 120 160"
      width={size}
      height={(size * 160) / 120}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {/* пламя */}
      <path d="M47 122 Q60 162 73 122 Z" fill="var(--flame)" />
      <path d="M53 122 Q60 146 67 122 Z" fill="var(--flame-soft)" />
      {/* стабилизаторы */}
      <path d="M36 86 L18 110 L18 122 L36 112 Z" fill="var(--flame)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M84 86 L102 110 L102 122 L84 112 Z" fill="var(--flame)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      {/* сопло */}
      <path d="M44 112 L76 112 L72 123 L48 123 Z" fill="var(--ink-2)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      {/* корпус */}
      <path
        d="M60 6 C79 22 86 46 86 76 L86 112 L34 112 L34 76 C34 46 41 22 60 6 Z"
        fill="var(--surface)"
        stroke="var(--ink)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* обтекатель */}
      <path d="M60 6 C68 13 74 22 78 32 L42 32 C46 22 52 13 60 6 Z" fill="var(--flame)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      {/* шов ступени */}
      <path d="M34 98 L86 98" stroke="var(--ink)" strokeWidth="2" strokeDasharray="3 3" />
      <Face mood={mood} />
      {mood === 'celebrate' && (
        <g stroke="var(--flame-soft)" strokeWidth="3" strokeLinecap="round">
          <path d="M10 30 L10 42 M4 36 L16 36" />
          <path d="M108 20 L108 30 M103 25 L113 25" />
          <path d="M104 58 L112 58" />
        </g>
      )}
      {mood === 'thinking' && (
        <g fill="var(--ink-2)">
          <circle cx="96" cy="40" r="3" />
          <circle cx="104" cy="28" r="4.5" />
        </g>
      )}
    </svg>
  )
}

function Face({ mood }: { mood: MascotMood }) {
  const ink = 'var(--ink)'
  const cheeks = (
    <g fill="var(--flame)" opacity="0.35">
      <ellipse cx="44" cy="74" rx="5" ry="3" />
      <ellipse cx="76" cy="74" rx="5" ry="3" />
    </g>
  )
  switch (mood) {
    case 'thinking':
      return (
        <g>
          <circle cx="52" cy="60" r="4" fill={ink} />
          <circle cx="72" cy="60" r="4" fill={ink} />
          <path d="M54 78 L66 76" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        </g>
      )
    case 'wink':
      return (
        <g>
          <circle cx="50" cy="62" r="4" fill={ink} />
          <path d="M65 63 Q70 57 75 63" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M50 74 Q60 84 70 74" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          {cheeks}
        </g>
      )
    case 'oops':
      return (
        <g>
          <circle cx="50" cy="62" r="5" fill="none" stroke={ink} strokeWidth="3" />
          <circle cx="70" cy="62" r="5" fill="none" stroke={ink} strokeWidth="3" />
          <ellipse cx="60" cy="79" rx="4" ry="5" fill={ink} />
        </g>
      )
    case 'celebrate':
      return (
        <g>
          <path d="M45 64 Q50 57 55 64" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M65 64 Q70 57 75 64" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M48 72 Q60 90 72 72 Z" fill={ink} />
          {cheeks}
        </g>
      )
    default:
      return (
        <g>
          <circle cx="50" cy="62" r="4" fill={ink} />
          <circle cx="70" cy="62" r="4" fill={ink} />
          <path d="M50 74 Q60 84 70 74" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          {cheeks}
        </g>
      )
  }
}
