interface LogoMarkProps {
  size?: number
  className?: string
}

export function LogoMark({ size = 28, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size * 1.25}
      viewBox="0 0 240 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="20" y="20" width="200" height="260" rx="36" fill="white" stroke="var(--accent)" strokeWidth="16" />

      <clipPath id="logo-display-clip">
        <rect x="52" y="56" width="136" height="44" rx="6" />
      </clipPath>
      <rect x="52" y="56" width="136" height="44" rx="6" fill="var(--accent)" />
      <g clipPath="url(#logo-display-clip)">
        <rect x="142" y="40" width="16" height="70" fill="white" transform="skewX(-20)" />
        <rect x="168" y="40" width="10" height="70" fill="white" transform="skewX(-20)" />
      </g>

      <rect x="64" y="118" width="28" height="28" fill="var(--accent)" />
      <rect x="108" y="118" width="28" height="28" fill="var(--accent)" />
      <rect x="152" y="118" width="28" height="28" fill="var(--accent)" />

      <rect x="64" y="154" width="28" height="28" fill="var(--accent)" />
      <rect x="108" y="154" width="28" height="28" fill="var(--accent)" />
      <rect x="152" y="154" width="28" height="28" fill="var(--accent)" />

      <rect x="64" y="190" width="28" height="58" fill="var(--accent)" />
      <rect x="108" y="190" width="28" height="58" fill="var(--accent)" />
      <rect x="152" y="222" width="28" height="26" fill="var(--accent)" />
    </svg>
  )
}
