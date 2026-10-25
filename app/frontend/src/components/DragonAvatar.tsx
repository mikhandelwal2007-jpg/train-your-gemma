import type { FC } from 'react'

interface DragonAvatarProps {
  stage: 'Hatchling' | 'Juvenile' | 'Adult' | string
  size?: number
  celebrating?: boolean
}

export const DragonAvatar: FC<DragonAvatarProps> = ({
  stage = 'Hatchling',
  size = 140,
  celebrating = false,
}) => {
  // Original stylized dragon mascot with SVG vectors
  const isAdult = stage === 'Adult'
  const isJuvenile = stage === 'Juvenile'

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none transition-transform duration-300 ${
        celebrating ? 'scale-110 motion-reduce:transform-none' : ''
      }`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${stage} Dragon Avatar`}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-dragon-600/30 to-amber-500/20 blur-xl animate-pulse-subtle" />

      <svg
        viewBox="0 0 100 100"
        className="w-full h-full relative drop-shadow-md"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Dragon Horns / Crest */}
        {isAdult ? (
          <>
            <path d="M30 35 C15 15, 10 5, 25 10 C35 15, 36 28, 38 35 Z" fill="#c2410c" />
            <path d="M70 35 C85 15, 90 5, 75 10 C65 15, 64 28, 62 35 Z" fill="#c2410c" />
            <path d="M40 25 C30 8, 38 4, 45 15 Z" fill="#ea580c" />
            <path d="M60 25 C70 8, 62 4, 55 15 Z" fill="#ea580c" />
          </>
        ) : isJuvenile ? (
          <>
            <path d="M34 36 C24 20, 26 12, 34 20 C38 25, 38 32, 40 36 Z" fill="#ea580c" />
            <path d="M66 36 C76 20, 74 12, 66 20 C62 25, 62 32, 60 36 Z" fill="#ea580c" />
          </>
        ) : (
          /* Hatchling small nubs */
          <>
            <ellipse cx="38" cy="28" rx="4" ry="7" transform="rotate(-25 38 28)" fill="#f97316" />
            <ellipse cx="62" cy="28" rx="4" ry="7" transform="rotate(25 62 28)" fill="#f97316" />
          </>
        )}

        {/* Dragon Head */}
        <path
          d="M26 48 C26 30, 74 30, 74 48 C74 68, 65 82, 50 82 C35 82, 26 68, 26 48 Z"
          fill="url(#dragonHeadGradient)"
        />

        {/* Snout */}
        <ellipse cx="50" cy="62" rx="14" ry="10" fill="#ea580c" />
        {/* Nostrils */}
        <circle cx="46" cy="62" r="1.5" fill="#7c2d12" />
        <circle cx="54" cy="62" r="1.5" fill="#7c2d12" />

        {/* Big Curious Eyes */}
        <ellipse cx="39" cy="46" rx="6" ry="8" fill="#0f172a" />
        <ellipse cx="61" cy="46" rx="6" ry="8" fill="#0f172a" />

        {/* Golden Eye Iris */}
        <circle cx="39" cy="46" r="4.5" fill="#f59e0b" />
        <circle cx="61" cy="46" r="4.5" fill="#f59e0b" />

        {/* Pupils */}
        <ellipse cx="39" cy="46" rx="2" ry="3.5" fill="#020617" />
        <ellipse cx="61" cy="46" rx="2" ry="3.5" fill="#020617" />

        {/* Eye catchlight sparkles */}
        <circle cx="41" cy="44" r="1.5" fill="#ffffff" />
        <circle cx="63" cy="44" r="1.5" fill="#ffffff" />

        {/* Friendly smile */}
        <path d="M44 70 Q50 75 56 70" stroke="#7c2d12" strokeWidth="2" strokeLinecap="round" />

        {/* Cheeks */}
        <circle cx="33" cy="55" r="3.5" fill="#fb923c" opacity="0.6" />
        <circle cx="67" cy="55" r="3.5" fill="#fb923c" opacity="0.6" />

        {/* Hatchling eggshell cap if hatchling */}
        {!isAdult && !isJuvenile && (
          <path
            d="M32 30 L40 36 L50 29 L60 36 L68 30 C64 22, 36 22, 32 30 Z"
            fill="#e2e8f0"
            opacity="0.9"
          />
        )}

        <defs>
          <linearGradient id="dragonHeadGradient" x1="50" y1="20" x2="50" y2="85" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fb923c" />
            <stop offset="1" stopColor="#c2410c" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
