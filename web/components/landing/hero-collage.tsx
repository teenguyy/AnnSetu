/**
 * Original collage illustration of a community food-distribution scene (vehicle marked
 * "FOOD FOR ALL", volunteers, buildings) in the duotone ocean/sunshine treatment, cut into a
 * curved panel. Slow Ken Burns zoom (≤3 %), static with reduced motion.
 */
export function HeroCollage({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 520" className={className} role="img" aria-labelledby="hc-title">
      <title id="hc-title">Volunteers unloading a van marked Food for All in a neighbourhood street</title>
      <defs>
        <clipPath id="hc-clip">
          <path d="M60 0 H420 V520 H120 C 50 520, 20 470, 30 400 C 40 330, 0 300, 10 230 C 20 150, 0 90, 20 40 C 30 15, 44 0, 60 0 Z" />
        </clipPath>
        <pattern id="hc-dots" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="1.5" cy="1.5" r="1" fill="#102F46" opacity=".45" />
        </pattern>
        <linearGradient id="hc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#82C5DF" />
          <stop offset="1" stopColor="#A8D9E9" />
        </linearGradient>
      </defs>
      <g clipPath="url(#hc-clip)">
        <g className="hc-zoom">
          <rect width="420" height="520" fill="url(#hc-sky)" />
          <circle cx="330" cy="90" r="46" fill="#FFE28A" opacity=".9" />
          {/* buildings */}
          <g fill="#287FA6">
            <rect x="20" y="150" width="110" height="250" />
            <rect x="140" y="110" width="90" height="290" />
            <rect x="240" y="170" width="160" height="230" />
          </g>
          <g fill="#164B70" opacity=".9">
            {Array.from({ length: 5 }, (_, r) =>
              Array.from({ length: 3 }, (_, c) => (
                <rect key={`a${r}${c}`} x={36 + c * 30} y={170 + r * 42} width="16" height="22" rx="2" />
              )),
            )}
            {Array.from({ length: 6 }, (_, r) =>
              Array.from({ length: 2 }, (_, c) => (
                <rect key={`b${r}${c}`} x={160 + c * 36} y={130 + r * 42} width="18" height="24" rx="2" />
              )),
            )}
            {Array.from({ length: 4 }, (_, r) =>
              Array.from({ length: 4 }, (_, c) => (
                <rect key={`c${r}${c}`} x={258 + c * 36} y={192 + r * 44} width="18" height="24" rx="2" />
              )),
            )}
          </g>
          <rect width="420" height="400" fill="url(#hc-dots)" opacity=".5" />
          {/* street */}
          <rect y="390" width="420" height="130" fill="#164B70" />
          <path d="M0 440 H420" stroke="#F5D98B" strokeWidth="3" strokeDasharray="22 16" opacity=".7" />
          {/* van */}
          <g>
            <rect x="160" y="300" width="210" height="110" rx="10" fill="#F4ECD8" stroke="#102F46" strokeWidth="3" />
            <path d="M370 330 H396 C 408 330, 414 340, 414 352 V410 H370 Z" fill="#E8F4F9" stroke="#102F46" strokeWidth="3" />
            <rect x="378" y="338" width="26" height="26" rx="4" fill="#82C5DF" stroke="#102F46" strokeWidth="2" />
            <text x="265" y="345" textAnchor="middle" fontFamily="var(--font-space-grotesk), sans-serif" fontWeight="700" fontSize="24" fill="#102F46">
              FOOD
            </text>
            <text x="265" y="374" textAnchor="middle" fontFamily="var(--font-space-grotesk), sans-serif" fontWeight="700" fontSize="24" fill="#102F46">
              FOR ALL
            </text>
            <circle cx="205" cy="412" r="20" fill="#102F46" />
            <circle cx="205" cy="412" r="8" fill="#93AAB8" />
            <circle cx="380" cy="412" r="20" fill="#102F46" />
            <circle cx="380" cy="412" r="8" fill="#93AAB8" />
          </g>
          {/* volunteers */}
          <g stroke="#102F46" strokeWidth="2.5">
            <circle cx="72" cy="330" r="13" fill="#E9DDC4" />
            <path d="M52 412 V362 C 52 350, 92 350, 92 362 V412 Z" fill="#E87968" />
            <rect x="84" y="364" width="34" height="26" rx="3" fill="#F5D98B" />
            <circle cx="132" cy="336" r="12" fill="#D9CBB0" />
            <path d="M114 412 V366 C 114 354, 150 354, 150 366 V412 Z" fill="#FFE28A" />
          </g>
        </g>
      </g>
      <style>{`
        .hc-zoom { transform-origin: 60% 60%; animation: hc-kenburns 22s ease-in-out infinite alternate; }
        @keyframes hc-kenburns { from { transform: scale(1); } to { transform: scale(1.03) translate(-4px, -2px); } }
      `}</style>
    </svg>
  );
}
