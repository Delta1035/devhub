import { cn } from '@renderer/lib/utils'

export interface DevHubLogoProps extends React.ComponentPropsWithoutRef<'svg'> {
  className?: string
  /**
   * 'auto': adapts dynamically to theme (light ceramic in light mode, obsidian dark in dark mode);
   * 'light': forced light mode appearance (white plate, dark braces, emerald bolt);
   * 'dark': forced dark mode appearance (dark plate, white braces, neon bolt).
   */
  variant?: 'auto' | 'light' | 'dark'
}

/**
 * DevHub desktop application brand logo: code braces with the signature emerald electric bolt { ⚡ }.
 */
export function DevHubLogo({
  className,
  variant = 'auto',
  ...props
}: DevHubLogoProps): React.JSX.Element {
  const isLight = variant === 'light'
  const isDark = variant === 'dark'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      className={cn('size-6 shrink-0 rounded-[6px] select-none', className)}
      role="img"
      aria-label="DevHub"
      {...props}
    >
      <defs>
        {/* Dark theme bolt gradient */}
        <linearGradient id="devhub-bolt-dark" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#4EEDB0" />
          <stop offset="100%" stopColor="#28BE83" />
        </linearGradient>
        {/* Light theme bolt gradient */}
        <linearGradient id="devhub-bolt-light" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        {/* Dark theme radial background */}
        <radialGradient id="devhub-dark-bg" cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#181F2A" />
          <stop offset="100%" stopColor="#080A0D" />
        </radialGradient>
      </defs>

      {/* Squircle base */}
      <rect
        width="512"
        height="512"
        rx="112"
        className={cn(
          isLight && 'fill-white',
          isDark && 'fill-[url(#devhub-dark-bg)]',
          variant === 'auto' && 'fill-white dark:fill-[url(#devhub-dark-bg)]'
        )}
      />

      {/* Plate border */}
      <rect
        x="6"
        y="6"
        width="500"
        height="500"
        rx="106"
        fill="none"
        strokeWidth="10"
        className={cn(
          isLight && 'stroke-slate-300',
          isDark && 'stroke-white/12',
          variant === 'auto' && 'stroke-slate-300 dark:stroke-white/12'
        )}
      />

      {/* Ambient glow in dark mode */}
      <circle
        cx="256"
        cy="256"
        r="110"
        fill="#3ED598"
        className={cn(
          isLight && 'hidden',
          isDark && 'opacity-15',
          variant === 'auto' && 'hidden dark:block dark:opacity-15'
        )}
      />

      {/* Curly braces { } */}
      <g
        fill="none"
        strokeWidth="38"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          isLight && 'stroke-[#0F172A]',
          isDark && 'stroke-white',
          variant === 'auto' && 'stroke-[#0F172A] dark:stroke-white'
        )}
      >
        <path d="M168 120 Q120 120 120 168 V216 Q120 256 80 256 Q120 256 120 296 V344 Q120 392 168 392" />
        <path d="M344 120 Q392 120 392 168 V216 Q392 256 432 256 Q392 256 392 296 V344 Q392 392 344 392" />
      </g>

      {/* Emerald lightning bolt ⚡ */}
      <path
        d="M284 138 L198 272 H252 L226 374 L314 232 H260 Z"
        strokeWidth="16"
        strokeLinejoin="round"
        className={cn(
          isLight && 'fill-[url(#devhub-bolt-light)] stroke-[#047857]',
          isDark && 'fill-[url(#devhub-bolt-dark)] stroke-[#3ED598]',
          variant === 'auto' &&
            'fill-[url(#devhub-bolt-light)] stroke-[#047857] dark:fill-[url(#devhub-bolt-dark)] dark:stroke-[#3ED598]'
        )}
      />
    </svg>
  )
}
